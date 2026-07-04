/* =====================================================================
 * storage-migrate.js  -  general-purpose, versioned localStorage boot
 * migration runner (M-6 STORAGE-MIGRATE, D-STORAGE-LS-MIGRATE, gh #76/#77).
 * ---------------------------------------------------------------------
 * PURPOSE. Today every ad-hoc storage-shape change is hand-rolled inline in
 * its own loader - songbook.js's loadPerfPrefs() falls back from perfprefs.v2
 * to perfprefs.v1 with a value transform; tracks.js's migrateUrls() re-keys
 * trackUrls.v1 entries under LEGACY_TRACKKEYS. Both work, but each is a
 * one-off, undiscoverable, and easy to forget when a NEW breaking change
 * lands. This file is the seam so the NEXT one is one registered migration,
 * not another hand-rolled defensive read: register(fromVersion, fn) once,
 * and run() (called automatically at boot - see the bottom of this file)
 * applies whatever is pending.
 *
 * NOT A REPLACEMENT FOR shared/backup.js. backup.js already owns a very
 * similar SCHEMA_VERSION/MIGRATIONS engine (music.schema.v1), but it is
 * scoped to backup.js's OWNED_PREFIXES and its migrations transform a
 * {key:value} DATA MAP (for the whole-snapshot backup/restore path). THIS
 * runner is lower-level and broader: register(fromVersion, fn) migrations
 * receive the LIVE Storage-like object directly (not a copied map) and are
 * not restricted to any prefix list - any current or future key qualifies.
 * The two compose (see "Known composition gap" below), they do not compete.
 *
 * SHIPPED STATE THIS WAVE: CURRENT = 1, REGISTRY = {} (empty). This is a
 * behavior-preserving no-op baseline - the value delivered now is the RAIL
 * (a versioned, registrable seam + a stamped marker key), not a migration.
 * No existing key changes shape in this commit.
 *
 * FRESH INSTALL vs PRE-RUNNER INSTALL (the "absent marker" ambiguity). When
 * VERSION_KEY is absent, that means either (a) a brand-new device with no
 * app data at all - stamp CURRENT directly, nothing to migrate - or (b) an
 * existing user's device that predates this file ever shipping - its data
 * has been in "implicit v0" the whole time and never had a chance to write
 * the marker. The rule this file applies: absent marker + ANY known-prefix
 * key present -> treat as version 0 and run every registered migration up
 * to CURRENT. Absent marker + NO known-prefix key present -> fresh install,
 * stamp CURRENT with no migrations run. KNOWN_PREFIXES below is therefore a
 * superset of backup.js's OWNED_PREFIXES (it also lists 'tri.', the
 * triad-inversions.html prefix backup.js does not capture - see the gap
 * note below) so this detector does not misclassify a device that only has
 * triad-inversions prefs as "fresh."
 *
 * Known composition gaps (named follow-ups, NOT done this wave - out of this
 * mission's edit grant, which is read-only on backup.js):
 *   1. VERSION_KEY ('music.schema.version') falls under backup.js's 'music.'
 *      OWNED_PREFIXES, so it is NOT yet excluded there the way backup.js's
 *      own SCHEMA_KEY ('music.schema.v1') is (see backup.js's EXCLUDE list).
 *      Follow-up: add 'music.schema.version' to backup.js's EXCLUDE array so
 *      this device-local marker is never swept into a user's backup file as
 *      if it were songbook data.
 *   2. backup.js's restore() does not currently call this file's run() after
 *      writing a payload. Follow-up: have restore() call
 *      StorageMigrate.run(store) once it finishes writing, so a backup taken
 *      on an older build (before some future migration existed) still gets
 *      that migration applied to the restored device.
 *   3. play/triad-inversions.html's 'tri.*' keys are outside backup.js's
 *      OWNED_PREFIXES entirely (a pre-existing gap, not introduced here) -
 *      those prefs are not currently backed up/restored at all. Documented
 *      here because this file's inventory pass surfaced it; fixing it is a
 *      backup.js change, out of this file's scope.
 *
 * Pure + dependency-free: exported for Node unit tests AND attached to
 * window.StorageMigrate in the browser (same dual-mode pattern as
 * backup.js). Every function takes a Storage-LIKE object (real localStorage,
 * or a tiny fake in tests) so nothing here is global except the one
 * documented auto-run side effect at the bottom of this file.
 * ===================================================================== */
(function (root) {
  'use strict';

  // Bump ONLY when a migration needs to run for every remaining device on an
  // older version. Add the matching REGISTRY[n] step (register(n-1, fn)) in
  // the SAME change - see register() below.
  var CURRENT = 1;
  // Device-local implementation marker, NOT user data. Deliberately named
  // distinctly from backup.js's own SCHEMA_KEY ('music.schema.v1') - the two
  // markers track two different engines (see the module header). Falls
  // under the 'music.' prefix per KNOWN_PREFIXES/backup.js's OWNED_PREFIXES;
  // see "Known composition gaps" #1 above for the pending backup.js exclusion.
  var VERSION_KEY = 'music.schema.version';

  // Every prefix this app has ever stored data under. Kept as a literal,
  // load-order-safe copy (NOT a reference to window.Backup.OWNED_PREFIXES) -
  // this file loads BEFORE backup.js (play/index.html script order), so it
  // cannot depend on window.Backup existing yet. Superset of backup.js's
  // OWNED_PREFIXES (adds 'tri.' - see the module header gap note). Update
  // alongside backup.js's OWNED_PREFIXES and
  // test/helpers/local-storage-reset.js's DEFAULT_PREFIXES if the app adds a
  // new storage prefix.
  var KNOWN_PREFIXES = ['songbook.', 'roadcase-', 'bt.', 'music.', 'tri.'];

  // Ordered migration registry. REGISTRY[n] brings a device FROM (n-1) TO n.
  // Empty today (see module header - this wave ships the no-op baseline).
  var REGISTRY = {};

  // Register a migration step. `fn(storageLike)` MUST mutate the live store
  // directly (get/set/removeItem - not return a new map; contrast with
  // backup.js's MIGRATIONS, which transform a data map) and MUST be
  // idempotent - run() may invoke it on a device that already partially
  // applied it if an earlier step in the same run() call threw.
  function register(fromVersion, fn) {
    if (typeof fromVersion !== 'number' || fromVersion < 0 || (fromVersion | 0) !== fromVersion) {
      throw new Error('StorageMigrate.register: fromVersion must be a non-negative integer');
    }
    if (typeof fn !== 'function') throw new Error('StorageMigrate.register: fn must be a function');
    var toVersion = fromVersion + 1;
    if (REGISTRY[toVersion]) throw new Error('StorageMigrate.register: a migration into version ' + toVersion + ' is already registered');
    REGISTRY[toVersion] = fn;
  }

  // Storage-like duck-type check (length/key/getItem/setItem) - the same
  // shape backup.js and test/helpers/local-storage-reset.js's fakeStore()
  // expose. Guards run() against being handed something that isn't a real
  // (or fake) Storage object.
  function isStorageLike(s) {
    return !!(s && typeof s.getItem === 'function' && typeof s.setItem === 'function' && typeof s.key === 'function' && typeof s.length === 'number');
  }

  // Does this store hold ANY key under a known app prefix (excluding the
  // version marker itself, which never counts as "legacy data")? Used only
  // to disambiguate a genuinely fresh install from a pre-runner install when
  // the version marker is absent (see the module header).
  function hasLegacyData(store) {
    for (var i = 0; i < store.length; i++) {
      var k = store.key(i);
      if (typeof k !== 'string' || k === VERSION_KEY) continue;
      for (var j = 0; j < KNOWN_PREFIXES.length; j++) {
        if (k.indexOf(KNOWN_PREFIXES[j]) === 0) return true;
      }
    }
    return false;
  }

  // Parsed integer version currently stamped on this device, or null if
  // absent/unparseable (readVersion never throws - defensive read, matches
  // every other reader in this app).
  function readVersion(store) {
    try {
      var raw = store.getItem(VERSION_KEY);
      if (raw == null) return null;
      var n = parseInt(raw, 10);
      return (!isNaN(n) && n >= 0) ? n : null;
    } catch (e) { return null; }
  }

  // Run every pending migration on `store`, in order, then stamp CURRENT.
  // Never throws - a failure (quota, storage blocked) fails soft, same as
  // backup.js's runMigrations(); a partial/failed run leaves result.to
  // short of CURRENT so the caller can tell, and the NEXT boot retries from
  // wherever readVersion() finds the marker (or re-detects legacy data).
  // Returns { from: int|null, to: int|null, ran: string[] } - `ran` lists
  // each applied step as "fromVersion->toVersion"; `from`/`to` are null only
  // if `store` isn't Storage-like at all (nothing was touched).
  function run(store) {
    var result = { from: null, to: null, ran: [] };
    if (!isStorageLike(store)) return result;
    try {
      var from = readVersion(store);
      if (from === null) from = hasLegacyData(store) ? 0 : CURRENT;
      result.from = from;
      if (from >= CURRENT) {
        // Nothing pending: either a fresh install stamping CURRENT for the
        // first time, or a marker already at/ahead of CURRENT (a newer
        // build's stamp on an older cached page) - never step it backward,
        // mirroring backup.js's downgrade guard.
        if (readVersion(store) === null) store.setItem(VERSION_KEY, String(from));
        result.to = from;
        return result;
      }
      var v = from;
      while (v < CURRENT) {
        var to = v + 1;
        var fn = REGISTRY[to];
        if (typeof fn === 'function') { fn(store); result.ran.push(v + '->' + to); }
        v = to;
      }
      store.setItem(VERSION_KEY, String(CURRENT));
      result.to = CURRENT;
    } catch (e) { /* storage blocked or quota - fails soft; next boot retries */ }
    return result;
  }

  var API = {
    CURRENT: CURRENT,
    VERSION_KEY: VERSION_KEY,
    KNOWN_PREFIXES: KNOWN_PREFIXES,
    register: register,
    run: run,
    readVersion: readVersion,       // exposed for tests + future composers (e.g. backup.js restore integration)
    hasLegacyData: hasLegacyData    // exposed for tests
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) {
    root.StorageMigrate = API;
    // Auto-run at script load, browser only. This IS the "wire at app boot"
    // step: play/index.html adds exactly one <script> tag (no inline call),
    // placed as the very first script tag (right after theme.js, before the
    // pre-paint theme/accent read and every shared/*.js consumer) so this
    // completes before backup.js/songbook.js or anything else reads
    // persisted state. Guarded end-to-end: root.localStorage access itself
    // can throw in some private-browsing modes, so this never assumes it's
    // safe to touch.
    try { if (root.localStorage) run(root.localStorage); } catch (e) { /* storage blocked - app still runs */ }
  }
})(typeof window !== 'undefined' ? window : null);
