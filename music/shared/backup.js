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
  // storage blocked), roll every written key back to its prior value and rethrow.
  // localStorage has no transactions, so "atomic" here means all-or-nothing from
  // the caller's view - a failed apply leaves the store exactly as it was found.
  // Returns the number of keys written.
  function applyAtomic(store, map) {
    var keys = Object.keys(map).filter(function (k) { return owned(k) && typeof map[k] === 'string'; });
    var prior = {}, had = {};
    keys.forEach(function (k) { var p = store.getItem(k); had[k] = (p !== null && p !== undefined); prior[k] = p; });
    var written = [];
    try {
      for (var i = 0; i < keys.length; i++) { store.setItem(keys[i], map[keys[i]]); written.push(keys[i]); }
    } catch (e) {
      // Roll back everything we wrote this call, restoring prior value or removing
      // keys that did not exist before, so no partial-restore state survives.
      for (var j = 0; j < written.length; j++) {
        var wk = written[j];
        try { if (had[wk]) store.setItem(wk, prior[wk]); else store.removeItem(wk); } catch (e2) { /* best-effort */ }
      }
      var msg = (e && /quota|exceed/i.test(String(e.name) + String(e.message)))
        ? 'not enough storage space to restore this backup on this device'
        : 'restore failed while writing - no changes were made';
      throw new Error(msg);
    }
    return keys.length;
  }

  // Restore a backup into a Storage-like object. Migrates first, then writes.
  // ADDITIVE by default: keys the backup doesn't mention are left as-is. Atomic:
  // a mid-write failure (quota, blocked storage) rolls back and throws, so the
  // store is never left half-restored. Returns the number of keys written.
  function restore(store, payload) {
    var v = validate(payload);
    if (!v.ok) throw new Error(v.error);
    var data = migrate(payload.data, payload.schema);
    var n = applyAtomic(store, data);
    // Only stamp the schema AFTER the data write fully succeeds - so the marker
    // never claims a shape the store did not actually receive.
    store.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    return n;
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
        // Migrate is pure (returns a new map without writing); apply atomically so
        // a mid-write failure rolls back rather than leaving a half-migrated store.
        // Stamp only after the write fully succeeds.
        applyAtomic(store, migrate(collect(store), cur));
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
    applyAtomic: applyAtomic,
    validate: validate,
    describe: describe,
    restore: restore,
    runMigrations: runMigrations
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Backup = API;
})(typeof window !== 'undefined' ? window : null);
