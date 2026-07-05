/* =====================================================================
 * backup.js  -  schema versioning + whole-songbook backup / restore.
 * ---------------------------------------------------------------------
 * The app is a single origin, so it owns localStorage. We snapshot every
 * key under the app's namespaces into one portable JSON object, stamp a
 * schema version, and on restore run any pending migrations BEFORE writing
 * the keys back. That makes a backup taken on an older app version restore
 * cleanly into a newer one.
 *
 * The `.vN` suffix on individual keys is just a name - it guards nothing on
 * its own. THIS file is the central seam: one integer version + one ordered
 * migration list. Today SCHEMA_VERSION is 1 and there are no migrations
 * (current shipping data IS the v1 baseline); the machinery exists so the
 * next breaking shape change is a one-line migration, not a rewrite.
 *
 * Pure + dependency-free: exported for Node unit tests AND attached to
 * window.Backup in the browser. Every function takes a Storage-LIKE object
 * (real localStorage, or a tiny fake in tests) so nothing here is global.
 * ===================================================================== */
(function (root) {
  'use strict';

  // Bump ONLY for a stored-shape change old readers can't absorb, and add the
  // matching MIGRATIONS[n] step in the same change. Additive changes (a new
  // optional field, a new key) do NOT need a bump - defensive readers absorb them.
  var SCHEMA_VERSION = 1;
  var SCHEMA_KEY = 'music.schema.v1'; // stores the integer THIS device is on

  // Namespaces the app owns. Everything under these is user data worth backing up.
  // `roadcase-` is the PER-INSTRUMENT songbook namespace the play app mounts with
  // (storagePrefix: 'roadcase-' + profile.id) - it holds each instrument's setlist,
  // composed progressions and perform prefs, so it MUST be captured. `songbook.` is
  // the engine's default prefix (other mount points). Missing `roadcase-` here is a
  // data-loss bug: the setlist + progressions would silently not back up. `tri.` is
  // play/triad-inversions.html's own namespace (activeKey/dismissed/firstVisitSeen) -
  // added by S-BACKUP-INTEGRATE (M-6 follow-up #3); it was a pre-existing gap this
  // inventory surfaced, not introduced by it (see engineering-wiki/systems/data-model.md).
  var OWNED_PREFIXES = ['songbook.', 'roadcase-', 'bt.', 'music.', 'tri.'];
  // ...except these: dev-only scratch, the schema marker, and the device-local
  // "last backed up" stamp (carrying an old stamp into a restore would mislead).
  //
  // Deliberately NOT excluded: 'music.schema.version' (StorageMigrate's own version
  // marker, shared/storage-migrate.js VERSION_KEY). It falls under the 'music.'
  // prefix like everything else and is left in the envelope on purpose (S-BACKUP-
  // INTEGRATE, M-6 follow-up #1+#2, superseding storage-migrate.js's own header note
  // that suggested excluding it). The pair "version travels WITH the data" + "restore
  // replays StorageMigrate.run() below" is the correct design: a backup must carry
  // the SOURCE device's true migration-runner version alongside its data, so restoring
  // it (fresh device, or a device rolled back to an older backup) stamps that TRUE
  // version rather than leaving the DESTINATION's own marker sitting over brand-new
  // (possibly older-shape) data. If we excluded it, the destination's pre-existing
  // marker (or none, on a fresh device) would look "already current" to the runner
  // even though the data it now holds is only as new as the backup's schema - and
  // any migration that data still needs would be silently skipped. Keeping the two
  // keys in lockstep, then replaying the runner immediately after write, is what
  // makes an old backup restore cleanly into a build with newer migrations.
  //
  // music.lastRestore. (M-SETTINGS-CLARITY, 2026-07-05) mirrors the
  // music.lastBackup. reasoning exactly: it is THIS device's own restore
  // time (the Settings Restore row's meta) - restoring a backup must not
  // overwrite when the DESTINATION device last ran a restore.
  var EXCLUDE = ['music.devlog.', 'music.lastBackup.', 'music.lastRestore.', SCHEMA_KEY];

  // Ordered migrations. MIGRATIONS[n] upgrades the {key:value} map FROM (n-1)
  // TO n, returning the new map. Empty today - the seam for future changes.
  //   2: function (data) { /* e.g. rename a key, retype a value */ return data; },
  var MIGRATIONS = {};

  function owned(key) {
    if (typeof key !== 'string') return false;
    for (var i = 0; i < EXCLUDE.length; i++) { if (key === EXCLUDE[i] || key.indexOf(EXCLUDE[i]) === 0) return false; }
    for (var j = 0; j < OWNED_PREFIXES.length; j++) { if (key.indexOf(OWNED_PREFIXES[j]) === 0) return true; }
    return false;
  }

  // { [key]: rawStringValue } for every owned key in a Storage-like object.
  function collect(store) {
    var out = {};
    for (var i = 0; i < store.length; i++) {
      var k = store.key(i);
      if (owned(k)) out[k] = store.getItem(k);
    }
    return out;
  }

  // Run pending migrations on a {key:value} map, from `fromVersion` to current.
  function migrate(data, fromVersion) {
    var v = (typeof fromVersion === 'number' && fromVersion > 0) ? fromVersion : 1;
    while (v < SCHEMA_VERSION) {
      v++;
      var step = MIGRATIONS[v];
      if (typeof step === 'function') data = step(data) || data;
    }
    return data;
  }

  // Read the schema THIS device is stamped with (>=1), independent of the build's
  // SCHEMA_VERSION. Used to detect a device carrying newer-shape data than the
  // running build knows about (old cached page after an app update).
  function deviceSchema(store) {
    try { var n = parseInt(store.getItem(SCHEMA_KEY) || String(SCHEMA_VERSION), 10); return (n >= 1) ? n : SCHEMA_VERSION; }
    catch (e) { return SCHEMA_VERSION; }
  }

  // A portable backup object. `data` holds raw string values exactly as stored,
  // so restore is a byte-faithful write (no re-serialization drift). The backup is
  // labeled with the DEVICE's actual schema, not the build's SCHEMA_VERSION: an old
  // cached build snapshotting a device already upgraded to a newer shape must NOT
  // mislabel that data as its own older version - it stamps the true (newer) schema
  // so newer-shape data is never silently downgraded on a later restore.
  function snapshot(store, nowIso) {
    return { app: 'music', schema: Math.max(deviceSchema(store), SCHEMA_VERSION), exportedAt: nowIso || null, data: collect(store) };
  }

  // Is this parsed object a restorable Music backup? Returns {ok, error}.
  function validate(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'not a backup file' };
    if (payload.app !== 'music') return { ok: false, error: 'not a Music backup' };
    if (typeof payload.schema !== 'number') return { ok: false, error: 'missing schema version' };
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return { ok: false, error: 'no data in backup' };
    if (payload.schema > SCHEMA_VERSION) return { ok: false, error: 'this backup was made by a newer version of the app. Update the app first' };
    // A well-formed-but-empty backup (no restorable owned keys) is almost always a
    // wrong/corrupt file, not an intentional wipe. Reject so restore can't report
    // "Restored" after writing nothing. (restore() itself is additive; validate is
    // the guard against silently applying a payload that carries no songbook data.)
    var restorable = 0, dk = Object.keys(payload.data);
    for (var i = 0; i < dk.length; i++) { if (owned(dk[i]) && typeof payload.data[dk[i]] === 'string') restorable++; }
    if (restorable === 0) return { ok: false, error: 'this backup has no songbook data to restore' };
    return { ok: true };
  }

  // Apply a {key:value} map to a Storage-like object ATOMICALLY: capture the prior
  // value of every key first, then write; if any setItem throws (quota exceeded,
  // storage blocked), roll every written key back and rethrow. localStorage has no
  // transactions, so "atomic" here means all-or-nothing from the caller's view - a
  // failed apply leaves the store exactly as it was found.
  //
  // `also` (optional) is an {key:value} map of NON-owned keys (e.g. the schema
  // marker) that must be written in the SAME transaction. The stamp cannot sit
  // outside the atomic set: if data writes succeed but the stamp throws, the store
  // would carry the data with a stale marker. Including it here means a stamp
  // failure rolls the data back too. Returns the number of owned data keys written.
  function applyAtomic(store, map, also) {
    var dataKeys = Object.keys(map).filter(function (k) { return owned(k) && typeof map[k] === 'string'; });
    var extraKeys = also ? Object.keys(also).filter(function (k) { return typeof also[k] === 'string'; }) : [];
    var all = dataKeys.concat(extraKeys);
    var valueOf = function (k) { return (map[k] != null && owned(k)) ? map[k] : also[k]; };
    var prior = {}, had = {};
    all.forEach(function (k) { var p = store.getItem(k); had[k] = (p !== null && p !== undefined); prior[k] = p; });
    var written = [];
    try {
      for (var i = 0; i < all.length; i++) { store.setItem(all[i], valueOf(all[i])); written.push(all[i]); }
    } catch (e) {
      // Roll back in REVERSE write order: undo the most-recent (space-consuming)
      // write first so restoring an earlier, larger prior value has the freed room
      // and does not itself hit quota. Track whether every undo succeeded so the
      // error message does not falsely claim "no changes were made".
      var clean = true;
      for (var j = written.length - 1; j >= 0; j--) {
        var wk = written[j];
        try { if (had[wk]) store.setItem(wk, prior[wk]); else store.removeItem(wk); } catch (e2) { clean = false; }
      }
      var quota = e && /quota|exceed/i.test(String(e.name) + String(e.message));
      var msg = quota ? 'not enough storage space to restore this backup on this device'
                      : 'restore failed while writing';
      throw new Error(msg + (clean ? ' - no changes were made' : ' - and the store could not be fully rolled back'));
    }
    return dataKeys.length;
  }

  // Restore a backup into a Storage-like object. Migrates first, then writes. The
  // data AND the schema stamp go through ONE atomic apply, so a failure anywhere
  // (quota, blocked storage) leaves the store exactly as found - never half
  // restored, never data-without-stamp. ADDITIVE: keys the backup doesn't mention
  // are left as-is. Returns the number of data keys written.
  function restore(store, payload) {
    var v = validate(payload);
    if (!v.ok) throw new Error(v.error);
    // DOWNGRADE GUARD (mirror of runMigrations'): if THIS device already holds a
    // newer schema than the running build understands, an old cached page must not
    // write older-shape data over it and stamp the marker back down - that destroys
    // newer data and makes the marker lie. Refuse; the user updates the app first.
    if (deviceSchema(store) > SCHEMA_VERSION) {
      throw new Error('this device has newer data than this version of the app can restore into. Update the app first');
    }
    var data = migrate(payload.data, payload.schema);
    var stamp = {}; stamp[SCHEMA_KEY] = String(SCHEMA_VERSION);
    var written = applyAtomic(store, data, stamp);
    // POST-RESTORE MIGRATION REPLAY (S-BACKUP-INTEGRATE, M-6 follow-up #2). The
    // write above just landed on `store` (the payload's own 'music.schema.version'
    // travels inside `data` - see the EXCLUDE comment above for why that key is
    // deliberately left in the envelope), so this device is now stamped with the
    // SOURCE device's true StorageMigrate version sitting on top of the data that
    // version actually describes. Replay the runner now so any migration the
    // restored data still needs (registered after the backup was taken, or never
    // run at all if the backup predates storage-migrate.js entirely) applies
    // immediately instead of waiting for the next full page load. Only runs where
    // the runner is actually wired: today that is play/index.html only (loaded
    // before backup.js there) - triad-inversions.html never loads backup.js at all,
    // so restore() is unreachable there regardless; the guard is defensive, not
    // load-bearing, matching this file's own dependency-free-module discipline (no
    // top-level require of storage-migrate.js). Never lets a migration hiccup here
    // undo an already-successful restore: StorageMigrate.run() already fails soft
    // internally (quota/blocked storage), and the try/catch is belt-and-suspenders
    // in case a future version of that contract changes.
    if (typeof StorageMigrate !== 'undefined' && StorageMigrate && typeof StorageMigrate.run === 'function') {
      try { StorageMigrate.run(store); } catch (e) { /* restore already succeeded; migration replay is best-effort */ }
    }
    return written;
  }

  // Human-readable summary of a {key:value} data map, translating raw keys into
  // songbook concepts with real counts ("Setlist: 12 songs", not "1 item").
  // Returns an ordered array of { label, detail } lines. Used for the Settings
  // sheet summary AND the restore-confirm preview so the user sees WHAT moves.
  // `names` (optional) maps a profile id -> display name (from the app's instrument
  // picker) so the per-instrument breakdown reads "Ukulele 20 · Guitar 4".
  function describe(data, names) {
    data = data || {}; names = names || {};
    var keys = Object.keys(data);
    function has(k) { return typeof data[k] === 'string'; }
    function arrLen(k) { try { var a = JSON.parse(data[k]); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } }
    function objLen(k) { try { var o = JSON.parse(data[k]); return (o && typeof o === 'object') ? Object.keys(o).length : 0; } catch (e) { return 0; } }
    function plural(n, one) { return n + ' ' + one + (n === 1 ? '' : 's'); }
    function anyKey(pred) { return keys.some(pred); }
    // Short instrument name: the picker's display name before its " - <tuning>",
    // else the prettified id's instrument segment (ukulele-gcea -> Ukulele).
    function shortName(id) {
      var n = names[id];
      if (n) return String(n).split(' - ')[0];
      var inst = String(id).split('-')[0];
      return inst ? inst.charAt(0).toUpperCase() + inst.slice(1) : id;
    }
    // Per-instrument counts for a key suffix. Setlists/progressions live under
    // roadcase-<profile>.<suffix>; the Jam/Mine views show ONE instrument, so a
    // per-instrument breakdown reconciles the manifest with what's on screen.
    // Skips empty namespaces. bt.custom.v1 is tracks, never a progression.
    function perInstrument(suffix) {
      var out = [];
      keys.forEach(function (k) {
        if (k.length <= suffix.length || k.slice(-suffix.length) !== suffix) return;
        if (suffix === '.custom.v1' && k === 'bt.custom.v1') return;
        var n = arrLen(k); if (n <= 0) return;
        var ns = k.slice(0, -suffix.length);
        var id = ns.indexOf('roadcase-') === 0 ? ns.slice(9) : ns;
        out.push({ id: id, name: shortName(id), n: n });
      });
      out.sort(function (a, b) { return b.n - a.n; });
      return out;
    }
    // One instrument -> a plain "{label}: 20 songs" line. Several instruments ->
    // the same line PLUS `rows` (one {k:name, v:"20 songs"} per instrument) so the
    // UI can render one instrument per row instead of an ugly wrapping "·" list.
    // `detail` is always the inline form (used by the restore-confirm text).
    function categoryLine(label, items, one) {
      if (!items.length) return null;
      if (items.length === 1) return { label: label, detail: plural(items[0].n, one) };
      return {
        label: label,
        detail: items.map(function (it) { return it.name + ' ' + it.n; }).join(' · '),
        rows: items.map(function (it) { return { k: it.name, v: plural(it.n, one) }; })
      };
    }
    var lines = [];
    var setLine = categoryLine('Setlist', perInstrument('.setlist.v1'), 'song');
    if (setLine) lines.push(setLine);
    var progLine = categoryLine('Saved progressions', perInstrument('.custom.v1'), 'progression');
    if (progLine) lines.push(progLine);
    var tracks = has('bt.custom.v1') ? arrLen('bt.custom.v1') : 0;
    if (tracks > 0) lines.push({ label: 'Custom tracks', detail: plural(tracks, 'track') });
    var links = has('music.trackUrls.v1') ? objLen('music.trackUrls.v1') : 0;
    if (links > 0) lines.push({ label: 'Curated track links', detail: plural(links, 'link') });
    var prefs = [];
    if (has('music.accent.v1')) prefs.push('accent color');
    if (has('music.activeProfile.v1')) prefs.push('instrument');
    if (anyKey(function (k) { return /\.(perfprefs\.v2|songview\.v1|chordsonly\.v1|activeTab\.v1|last\.v1)$/.test(k); })) prefs.push('view + screen prefs');
    if (prefs.length) lines.push({ label: 'Preferences', detail: prefs.join(', ') });
    return lines;
  }

  // S-BACKUP-NUDGE (analysis-refactor-enhance-20260704 B2): thresholds for the
  // one-shot backup-staleness nudge (rendered via the free 'backup' Notables
  // priority slot in play/index.html). Below NUDGE_MIN_SONGS the data-loss risk
  // is low enough to stay silent; above it, the clock only matters once it has
  // actually run past NUDGE_STALE_DAYS (or never run at all).
  var NUDGE_MIN_SONGS = 3;
  var NUDGE_STALE_DAYS = 30;

  // Total songs at risk across EVERY instrument's setlist (roadcase-<id>.setlist.v1,
  // summed) - the same namespace describe()'s 'Setlist' category counts, just
  // collapsed to one number instead of a per-instrument breakdown. Progressions/
  // tracks aren't folded in here: the nudge message talks about "songs"
  // specifically, matching the vocabulary the Settings summary already uses.
  function songCount(data) {
    data = data || {};
    var total = 0;
    Object.keys(data).forEach(function (k) {
      if (k.length <= 11 || k.slice(-11) !== '.setlist.v1') return;
      try { var a = JSON.parse(data[k]); if (Array.isArray(a)) total += a.length; } catch (e) { /* skip malformed */ }
    });
    return total;
  }

  // Pure eligibility/message decision - never touches storage directly, so a
  // caller (play/index.html) supplies the ingredients (songCount(collect(...)),
  // the raw music.lastBackup.v1 ISO string or null, and `nowMs` for tests to pin).
  // Returns { eligible, message }; message is null when not eligible so callers
  // can render nothing without a truthiness dance on `message` itself.
  function backupNudgeState(count, lastBackupIso, nowMs) {
    nowMs = (typeof nowMs === 'number' && !isNaN(nowMs)) ? nowMs : Date.now();
    count = (typeof count === 'number' && count > 0) ? count : 0;
    if (count < NUDGE_MIN_SONGS) return { eligible: false, message: null };
    var songWord = count + ' song' + (count === 1 ? '' : 's');
    var then = lastBackupIso ? new Date(lastBackupIso).getTime() : NaN;
    if (!lastBackupIso || isNaN(then)) {
      return { eligible: true, message: 'Back up your library - ' + songWord + ', never backed up.' };
    }
    var days = Math.floor((nowMs - then) / 86400000);
    if (days < NUDGE_STALE_DAYS) return { eligible: false, message: null };
    return { eligible: true, message: 'Back up your library - last backed up ' + days + ' day' + (days === 1 ? '' : 's') + ' ago.' };
  }

  // Boot-time: bring THIS device's stored data up to the current schema before
  // the app reads it. No-op at v1 (just stamps existing users as the baseline);
  // the hook future breaking changes run through.
  function runMigrations(store) {
    try {
      var cur = parseInt(store.getItem(SCHEMA_KEY) || '1', 10);
      if (!(cur >= 1)) cur = 1;
      // DOWNGRADE GUARD: this device was stamped by a NEWER app build than the one
      // now running (e.g. an old cached PWA loaded after an update wrote a higher
      // schema). We cannot safely read or rewrite data in a shape we do not know,
      // and stamping DOWN to SCHEMA_VERSION would make the marker lie. Leave the
      // newer stamp and the data untouched; the newer build will manage it.
      if (cur > SCHEMA_VERSION) return;
      if (cur < SCHEMA_VERSION) {
        // Migrate is pure (returns a new map without writing); apply atomically WITH
        // the stamp in the same transaction, so a mid-write failure rolls back the
        // data AND leaves the old stamp - never migrated-data-with-stale-marker.
        var stamp = {}; stamp[SCHEMA_KEY] = String(SCHEMA_VERSION);
        applyAtomic(store, migrate(collect(store), cur), stamp);
      } else {
        // Already current (or unmarked baseline): just stamp; no data rewrite.
        store.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
      }
    } catch (e) { /* storage blocked (private mode) - the app still runs */ }
  }

  var API = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SCHEMA_KEY: SCHEMA_KEY,
    OWNED_PREFIXES: OWNED_PREFIXES,
    NUDGE_MIN_SONGS: NUDGE_MIN_SONGS,
    NUDGE_STALE_DAYS: NUDGE_STALE_DAYS,
    owned: owned,
    collect: collect,
    migrate: migrate,
    snapshot: snapshot,
    deviceSchema: deviceSchema,
    applyAtomic: applyAtomic,
    validate: validate,
    describe: describe,
    songCount: songCount,
    backupNudgeState: backupNudgeState,
    restore: restore,
    runMigrations: runMigrations
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Backup = API;
})(typeof window !== 'undefined' ? window : null);
