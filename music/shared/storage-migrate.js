/* =====================================================================
 * storage-migrate.js  -  general-purpose, versioned localStorage boot
 * migration runner.
 * ---------------------------------------------------------------------
 * A single registrable seam for breaking localStorage-shape changes.
 * Instead of each loader hand-rolling its own defensive fallback read, a
 * breaking change becomes one registered step: register(fromVersion, fn)
 * once, and run() (called automatically at boot - see the bottom of this
 * file) applies whatever is pending and stamps the version marker.
 *
 * Distinct from shared/backup.js. backup.js has its own
 * SCHEMA_VERSION/MIGRATIONS engine scoped to its OWNED_PREFIXES, whose
 * migrations transform a {key:value} DATA MAP for the backup/restore path.
 * This runner is lower-level and broader: its migrations receive the LIVE
 * Storage-like object directly (not a copied map) and are not restricted to
 * any prefix list - any current or future key qualifies. The two compose,
 * they do not compete.
 *
 * FRESH INSTALL vs PRE-RUNNER INSTALL (the "absent marker" ambiguity). An
 * absent VERSION_KEY means either (a) a brand-new device with no app data -
 * stamp CURRENT, nothing to migrate - or (b) an older device whose data
 * predates this runner ("implicit v0") and never wrote the marker. Rule:
 * absent marker + ANY known-prefix key present -> treat as version 0 and run
 * every registered migration up to CURRENT; absent marker + NO known-prefix
 * key -> fresh install, stamp CURRENT with no migrations. KNOWN_PREFIXES is
 * a superset of backup.js's OWNED_PREFIXES (adds 'tri.', see gotcha) so a
 * device holding only triad-inversions prefs is not misclassified as fresh.
 *
 * ---- Public API + seam invariants ----
 *   VERSION_KEY ('music.schema.version') stays IN the backup envelope, NOT
 *     excluded: a backup carries the schema version of its data, and
 *     backup.js restore() replays run() afterward, so old backups migrate
 *     correctly. Excluding it would leave a NEW marker over OLD restored data
 *     and silently skip migrations.
 *   register(fromVersion, fn) / run(store) / readVersion(store) /
 *     hasLegacyData(store) - all take a Storage-LIKE object (real
 *     localStorage or a test fake), so nothing here is global except the one
 *     auto-run side effect at the bottom of this file.
 *
 * GOTCHA: play/triad-inversions.html's 'tri.*' keys are outside backup.js's
 * OWNED_PREFIXES, so they are not backed up/restored at all. Listed here in
 * KNOWN_PREFIXES only so this runner's fresh-install detector sees them;
 * fixing the backup gap is a backup.js change, out of scope here.
 *
 * Pure + dependency-free: exported for Node unit tests AND attached to
 * window.StorageMigrate in the browser (same dual-mode pattern as backup.js).
 * ===================================================================== */
(function (root) {
  'use strict';

  // Bump ONLY when a migration needs to run for every remaining device on an
  // older version. Add the matching REGISTRY[n] step (register(n-1, fn)) in
  // the SAME change - see register() below.
  var CURRENT = 1;
  // Device-local implementation marker, NOT user data. Named distinctly from
  // backup.js's own SCHEMA_KEY ('music.schema.v1') because the two markers
  // track two different engines (see the module header). Falls under the
  // 'music.' prefix per KNOWN_PREFIXES.
  var VERSION_KEY = 'music.schema.version';

  // Every prefix this app has ever stored data under. A literal copy, NOT a
  // reference to window.Backup.OWNED_PREFIXES: this file loads BEFORE
  // backup.js (play/index.html script order), so window.Backup may not exist
  // yet. Superset of backup.js's OWNED_PREFIXES (adds 'tri.'). Keep in sync
  // with backup.js's OWNED_PREFIXES and
  // test/helpers/local-storage-reset.js's DEFAULT_PREFIXES when a new storage
  // prefix is added.
  var KNOWN_PREFIXES = ['songbook.', 'roadcase-', 'bt.', 'music.', 'tri.'];

  // Ordered migration registry. REGISTRY[n] brings a device FROM (n-1) TO n.
  // Empty at CURRENT = 1 (the runner rail, no migrations registered yet).
  var REGISTRY = {};

  // Register a migration step. `fn(storageLike)` MUST mutate the live store
  // directly (get/set/removeItem - not return a new map, unlike backup.js's
  // MIGRATIONS which transform a data map) and MUST be idempotent - run() may
  // invoke it on a device that already partially applied it if an earlier
  // step in the same run() call threw.
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
  // Never throws - a failure (quota, storage blocked) fails soft; a
  // partial/failed run leaves result.to short of CURRENT so the caller can
  // tell, and the NEXT boot retries from wherever readVersion() finds the
  // marker (or re-detects legacy data).
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
        // build's stamp seen by an older cached page) - never step it
        // backward.
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
    // Auto-run at script load, browser only - the app-boot wiring. This
    // <script> is placed first in play/index.html (right after theme.js,
    // before every shared/*.js consumer) so migration completes before
    // backup.js/songbook.js or anything else reads persisted state. Guarded:
    // root.localStorage access itself can throw in some private-browsing
    // modes, so never assume it is safe to touch.
    try { if (root.localStorage) run(root.localStorage); } catch (e) { /* storage blocked - app still runs */ }
  }
})(typeof window !== 'undefined' ? window : null);
