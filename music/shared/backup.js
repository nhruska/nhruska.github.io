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
  // data-loss bug: the setlist + progressions would silently not back up.
  var OWNED_PREFIXES = ['songbook.', 'roadcase-', 'bt.', 'music.'];
  // ...except these: dev-only scratch, the schema marker, and the device-local
  // "last backed up" stamp (carrying an old stamp into a restore would mislead).
  var EXCLUDE = ['music.devlog.', 'music.lastBackup.', SCHEMA_KEY];

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

  // A portable backup object. `data` holds raw string values exactly as stored,
  // so restore is a byte-faithful write (no re-serialization drift).
  function snapshot(store, nowIso) {
    return { app: 'music', schema: SCHEMA_VERSION, exportedAt: nowIso || null, data: collect(store) };
  }

  // Is this parsed object a restorable Music backup? Returns {ok, error}.
  function validate(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'not a backup file' };
    if (payload.app !== 'music') return { ok: false, error: 'not a Music backup' };
    if (typeof payload.schema !== 'number') return { ok: false, error: 'missing schema version' };
    if (!payload.data || typeof payload.data !== 'object') return { ok: false, error: 'no data in backup' };
    if (payload.schema > SCHEMA_VERSION) return { ok: false, error: 'backup is from a newer app version (' + payload.schema + ' > ' + SCHEMA_VERSION + ') - update the app first' };
    return { ok: true };
  }

  // Restore a backup into a Storage-like object. Migrates first, then writes.
  // ADDITIVE by default: keys the backup doesn't mention are left as-is. Returns
  // the number of keys written.
  function restore(store, payload) {
    var v = validate(payload);
    if (!v.ok) throw new Error(v.error);
    var data = migrate(payload.data, payload.schema);
    var n = 0;
    Object.keys(data).forEach(function (k) {
      if (owned(k) && typeof data[k] === 'string') { store.setItem(k, data[k]); n++; }
    });
    store.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    return n;
  }

  // Human-readable summary of a {key:value} data map, translating raw keys into
  // songbook concepts with real counts ("Setlist: 12 songs", not "1 item").
  // Returns an ordered array of { label, detail } lines. Used for the Settings
  // sheet summary AND the restore-confirm preview so the user sees WHAT moves.
  function describe(data) {
    data = data || {};
    var keys = Object.keys(data);
    function has(k) { return typeof data[k] === 'string'; }
    function arrLen(k) { try { var a = JSON.parse(data[k]); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } }
    function objLen(k) { try { var o = JSON.parse(data[k]); return (o && typeof o === 'object') ? Object.keys(o).length : 0; } catch (e) { return 0; } }
    function plural(n, one) { return n + ' ' + one + (n === 1 ? '' : 's'); }
    function anyKey(pred) { return keys.some(pred); }
    function sumArr(pred) { var n = 0; keys.forEach(function (k) { if (pred(k)) n += arrLen(k); }); return n; }
    // Match by SUFFIX, not exact name: the play app namespaces per instrument
    // (roadcase-<profile>.setlist.v1 etc.), so counts aggregate across instruments.
    var isSetlist = function (k) { return /\.setlist\.v1$/.test(k); };
    // .custom.v1 is progressions (per-instrument) EXCEPT bt.custom.v1, which is tracks.
    var isProg = function (k) { return /\.custom\.v1$/.test(k) && k !== 'bt.custom.v1'; };
    var isPref = function (k) { return /\.(perfprefs\.v2|songview\.v1|chordsonly\.v1|activeTab\.v1|last\.v1)$/.test(k); };
    var lines = [];
    if (anyKey(isSetlist)) lines.push({ label: 'Setlist', detail: plural(sumArr(isSetlist), 'song') });
    if (anyKey(isProg)) lines.push({ label: 'Saved progressions', detail: plural(sumArr(isProg), 'progression') });
    if (has('bt.custom.v1')) lines.push({ label: 'Custom tracks', detail: plural(arrLen('bt.custom.v1'), 'track') });
    if (has('music.trackUrls.v1')) lines.push({ label: 'Curated track links', detail: plural(objLen('music.trackUrls.v1'), 'link') });
    var prefs = [];
    if (has('music.accent.v1')) prefs.push('accent color');
    if (has('music.activeProfile.v1')) prefs.push('instrument');
    if (anyKey(isPref)) prefs.push('view + screen prefs');
    if (prefs.length) lines.push({ label: 'Preferences', detail: prefs.join(', ') });
    return lines;
  }

  // Boot-time: bring THIS device's stored data up to the current schema before
  // the app reads it. No-op at v1 (just stamps existing users as the baseline);
  // the hook future breaking changes run through.
  function runMigrations(store) {
    try {
      var cur = parseInt(store.getItem(SCHEMA_KEY) || '1', 10);
      if (!(cur >= 1)) cur = 1;
      if (cur < SCHEMA_VERSION) {
        var migrated = migrate(collect(store), cur);
        Object.keys(migrated).forEach(function (k) { if (owned(k) && typeof migrated[k] === 'string') store.setItem(k, migrated[k]); });
      }
      store.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    } catch (e) { /* storage blocked (private mode) - the app still runs */ }
  }

  var API = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SCHEMA_KEY: SCHEMA_KEY,
    OWNED_PREFIXES: OWNED_PREFIXES,
    owned: owned,
    collect: collect,
    migrate: migrate,
    snapshot: snapshot,
    validate: validate,
    describe: describe,
    restore: restore,
    runMigrations: runMigrations
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Backup = API;
})(typeof window !== 'undefined' ? window : null);
