/* =====================================================================
 * backup.test.js  -  unit tests for the schema/versioned backup+restore.
 * Run: node test/backup.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Backup = require('../music/shared/backup.js');
var StorageMigrate = require('../music/shared/storage-migrate.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- a minimal Storage-like fake ---------- */
function fakeStore(seed) {
  var map = {};
  if (seed) Object.keys(seed).forEach(function (k) { map[k] = seed[k]; });
  return {
    get length() { return Object.keys(map).length; },
    key: function (i) { return Object.keys(map)[i]; },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function (k, v) { map[k] = String(v); },
    removeItem: function (k) { delete map[k]; },
    _map: map
  };
}

/* ---------- owned() namespace gate ---------- */
test('owned() accepts app namespaces, rejects foreign + excluded keys', function () {
  assert.strictEqual(Backup.owned('songbook.setlist.v1'), true);
  assert.strictEqual(Backup.owned('bt.custom.v1'), true);
  assert.strictEqual(Backup.owned('music.accent.v1'), true);
  assert.strictEqual(Backup.owned('someothersite.token'), false);
  assert.strictEqual(Backup.owned('music.devlog.v1'), false);      // dev-only excluded
  assert.strictEqual(Backup.owned('music.lastBackup.v1'), false);  // device-local stamp excluded
  assert.strictEqual(Backup.owned(Backup.SCHEMA_KEY), false);      // the marker itself excluded
  assert.strictEqual(Backup.owned(null), false);
});

/* ---------- REGRESSION: the per-instrument roadcase namespace must be captured ---------- */
test('owned() + snapshot capture the per-instrument roadcase namespace', function () {
  assert.strictEqual(Backup.owned('roadcase-ukulele-gcea.setlist.v1'), true);
  assert.strictEqual(Backup.owned('roadcase-guitar-standard.custom.v1'), true);
  var s = fakeStore({
    'roadcase-ukulele-gcea.setlist.v1': '["s1","s2"]',
    'roadcase-ukulele-gcea.custom.v1': '[{"id":"p1"}]',
    'music.accent.v1': '#5eead4'
  });
  var snap = Backup.snapshot(s, null);
  // the setlist + progressions (roadcase-namespaced) MUST be in the backup, not just accent
  assert.strictEqual(snap.data['roadcase-ukulele-gcea.setlist.v1'], '["s1","s2"]');
  assert.strictEqual(snap.data['roadcase-ukulele-gcea.custom.v1'], '[{"id":"p1"}]');
});

/* ---------- snapshot() only captures owned keys ---------- */
test('snapshot() captures owned keys only and stamps version + time', function () {
  var s = fakeStore({
    'songbook.setlist.v1': '["a","b"]',
    'music.accent.v1': '#5eead4',
    'bt.custom.v1': '[]',
    'music.devlog.v1': 'noise',        // excluded
    'unrelated.key': 'x'               // foreign
  });
  var snap = Backup.snapshot(s, '2026-07-02T00:00:00.000Z');
  assert.strictEqual(snap.app, 'music');
  assert.strictEqual(snap.schema, Backup.SCHEMA_VERSION);
  assert.strictEqual(snap.exportedAt, '2026-07-02T00:00:00.000Z');
  assert.deepStrictEqual(Object.keys(snap.data).sort(), ['bt.custom.v1', 'music.accent.v1', 'songbook.setlist.v1']);
  assert.strictEqual(snap.data['music.devlog.v1'], undefined);
  assert.strictEqual(snap.data['unrelated.key'], undefined);
});

/* ---------- validate() ---------- */
test('validate() accepts a good backup and rejects malformed ones', function () {
  // Contract change (Volley 1): an empty-data backup is now REJECTED. Restoring it
  // writes nothing yet the UI would report "Restored", masking a wrong/corrupt file.
  // A valid backup must carry at least one restorable owned key.
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: {} }).ok, false);
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: { 'songbook.setlist.v1': '["a"]' } }).ok, true);
  assert.strictEqual(Backup.validate(null).ok, false);
  assert.strictEqual(Backup.validate({ app: 'other', schema: 1, data: {} }).ok, false);
  assert.strictEqual(Backup.validate({ app: 'music', data: {} }).ok, false);          // no schema
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1 }).ok, false);          // no data
  assert.strictEqual(Backup.validate({ app: 'music', schema: 999, data: {} }).ok, false); // from the future
});

/* ---------- restore() round-trips onto a fresh device ---------- */
test('restore() writes owned keys onto a fresh store and stamps the schema', function () {
  var oldPhone = fakeStore({
    'songbook.setlist.v1': '["song1","song2"]',
    'songbook.custom.v1': '[{"id":"x"}]',
    'music.accent.v1': '#a78bfa'
  });
  var snap = Backup.snapshot(oldPhone, '2026-07-02T00:00:00.000Z');
  var json = JSON.stringify(snap);                 // survives serialization (the real transport)

  var newPhone = fakeStore();
  var n = Backup.restore(newPhone, JSON.parse(json));
  assert.strictEqual(n, 3);
  assert.strictEqual(newPhone.getItem('songbook.setlist.v1'), '["song1","song2"]');
  assert.strictEqual(newPhone.getItem('music.accent.v1'), '#a78bfa');
  assert.strictEqual(newPhone.getItem(Backup.SCHEMA_KEY), String(Backup.SCHEMA_VERSION));
});

test('restore() throws on an invalid payload', function () {
  var s = fakeStore();
  assert.throws(function () { Backup.restore(s, { app: 'other' }); });
});

test('restore() ignores any foreign keys smuggled into data', function () {
  var s = fakeStore();
  var n = Backup.restore(s, { app: 'music', schema: 1, data: { 'songbook.last.v1': 'song9', 'evil.key': 'x' } });
  assert.strictEqual(n, 1);                          // only the owned key written
  assert.strictEqual(s.getItem('evil.key'), null);
});

/* ---------- describe() translates keys into human counts ---------- */
test('describe() breaks setlists/progressions down PER INSTRUMENT', function () {
  var lines = Backup.describe({
    'roadcase-ukulele-gcea.setlist.v1': '["a","b","c"]',       // Ukulele 3
    'roadcase-guitar-standard.setlist.v1': '["d","e"]',        // Guitar 2
    'roadcase-ukulele-gcea.custom.v1': '[{"id":1},{"id":2}]',  // progressions, ukulele only
    'bt.custom.v1': '[{"t":"x"}]',                             // tracks, NOT progressions
    'music.trackUrls.v1': '{"k1":"v","k2":"v"}',
    'music.accent.v1': '#5eead4',
    'music.activeProfile.v1': 'ukulele-gcea'
  });
  var byLabel = {};
  lines.forEach(function (l) { byLabel[l.label] = l; });
  assert.strictEqual(byLabel['Setlist'].detail, 'Ukulele 3 · Guitar 2');   // inline form (for the confirm dialog)
  // multi-instrument also carries per-instrument rows for one-per-line rendering
  assert.deepStrictEqual(byLabel['Setlist'].rows, [{ k: 'Ukulele', v: '3 songs' }, { k: 'Guitar', v: '2 songs' }]);
  assert.strictEqual(byLabel['Saved progressions'].detail, '2 progressions'); // single instrument -> plain, no rows
  assert.ok(!byLabel['Saved progressions'].rows);
  assert.strictEqual(byLabel['Custom tracks'].detail, '1 track');          // bt.custom.v1 stays tracks
  assert.strictEqual(byLabel['Curated track links'].detail, '2 links');
  assert.strictEqual(byLabel['Preferences'].detail, 'accent color, instrument');
});
test('describe() uses provided instrument display names (trimmed at " - ")', function () {
  var lines = Backup.describe(
    { 'roadcase-ukulele-gcea.setlist.v1': '["a","b"]', 'roadcase-guitar-standard.setlist.v1': '["c"]' },
    { 'ukulele-gcea': 'Ukulele', 'guitar-standard': 'Guitar - Standard' }
  );
  assert.strictEqual(lines[0].label, 'Setlist');
  assert.strictEqual(lines[0].detail, 'Ukulele 2 · Guitar 1');
});
test('describe() singularises a single instrument and skips absent keys', function () {
  var lines = Backup.describe({ 'roadcase-ukulele-gcea.setlist.v1': '["only"]' });
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].label, 'Setlist');
  assert.strictEqual(lines[0].detail, '1 song');
});
test('describe() skips empty/malformed keys instead of showing zeros', function () {
  var lines = Backup.describe({ 'bt.custom.v1': 'not json', 'roadcase-ukulele-gcea.setlist.v1': '{}' });
  assert.strictEqual(lines.length, 0); // both resolve to 0 -> no noise rows
});

/* ---------- migrate() is an identity at the current version ---------- */
test('migrate() is a no-op from v1 to v1', function () {
  var data = { 'songbook.setlist.v1': '["a"]' };
  assert.deepStrictEqual(Backup.migrate(data, 1), data);
});

/* ---------- runMigrations() stamps an unmarked device as the baseline ---------- */
test('runMigrations() stamps an existing (unmarked) device at the baseline', function () {
  var s = fakeStore({ 'songbook.setlist.v1': '["a"]' });
  assert.strictEqual(s.getItem(Backup.SCHEMA_KEY), null);
  Backup.runMigrations(s);
  assert.strictEqual(s.getItem(Backup.SCHEMA_KEY), String(Backup.SCHEMA_VERSION));
  assert.strictEqual(s.getItem('songbook.setlist.v1'), '["a"]'); // data untouched at v1
});

/* ---------- validate() rejects malformed / empty payloads ---------- */
test('validate() rejects array data, foreign-only keys, and non-string values', function () {
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: [] }).ok, false);      // array, not a map
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: { 'foreign.k': 'v' } }).ok, false); // no owned keys
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: { 'songbook.setlist.v1': 42 } }).ok, false); // non-string value
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: { 'songbook.setlist.v1': '["a"]' } }).ok, true);
});

/* ---------- atomic restore rolls back on a mid-write quota throw ---------- */
test('restore() is atomic: a quota throw mid-write rolls back, store unchanged', function () {
  // Seed a device that already holds real data; a restore that throws partway must
  // leave EXACTLY this state, not a half-applied mix.
  var s = fakeStore({ 'songbook.setlist.v1': '["old"]', 'music.accent.v1': '"blue"' });
  var writes = 0;
  s.setItem = function (k, v) { if (++writes === 2) { var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } s._map[k] = String(v); };
  var payload = { app: 'music', schema: 1, data: { 'songbook.setlist.v1': '["new1","new2"]', 'roadcase-ukulele-gcea.setlist.v1': '["x"]' } };
  var threw = null;
  try { Backup.restore(s, payload); } catch (e) { threw = e; }
  assert.ok(threw, 'restore should throw on quota');
  assert.ok(/storage space/i.test(threw.message), 'quota message surfaced: ' + threw.message);
  assert.strictEqual(s._map['songbook.setlist.v1'], '["old"]', 'first key rolled back to prior value');
  assert.ok(!('roadcase-ukulele-gcea.setlist.v1' in s._map), 'new key removed on rollback');
  assert.strictEqual(s._map['music.accent.v1'], '"blue"', 'untouched key intact');
});

/* ---------- downgrade guard: a newer-stamped device is left alone ---------- */
test('runMigrations() does NOT downgrade a device stamped by a newer app build', function () {
  var s = fakeStore({ 'songbook.setlist.v1': '["a"]' });
  s.setItem(Backup.SCHEMA_KEY, String(Backup.SCHEMA_VERSION + 1)); // pretend a future build ran
  Backup.runMigrations(s);
  assert.strictEqual(s.getItem(Backup.SCHEMA_KEY), String(Backup.SCHEMA_VERSION + 1), 'newer stamp preserved, not lied down to current');
  assert.strictEqual(s.getItem('songbook.setlist.v1'), '["a"]', 'data untouched');
});

/* ---------- schema stamp is inside the atomic transaction ---------- */
test('restore() rolls back DATA if the schema stamp write fails (stamp in transaction)', function () {
  // All data writes succeed; the LAST write (the schema stamp) throws. The data
  // must roll back too - never data-written-without-stamp.
  var s = fakeStore({ 'songbook.setlist.v1': '["old"]' });
  var realSet = s.setItem.bind(s);
  s.setItem = function (k, v) { if (k === Backup.SCHEMA_KEY) { throw new Error('QuotaExceededError'); } realSet(k, v); };
  var payload = { app: 'music', schema: 1, data: { 'songbook.setlist.v1': '["new"]' } };
  var threw = null;
  try { Backup.restore(s, payload); } catch (e) { threw = e; }
  assert.ok(threw, 'should throw when the stamp write fails');
  assert.strictEqual(s._map['songbook.setlist.v1'], '["old"]', 'data rolled back to prior value on stamp failure');
});

/* ---------- rollback runs in reverse write order ---------- */
test('applyAtomic() rolls back in reverse write order', function () {
  var order = [];
  var s = fakeStore({ 'songbook.a.v1': 'A0', 'songbook.b.v1': 'B0' });
  var writes = 0;
  s.setItem = function (k, v) {
    writes++;
    if (writes === 3) throw new Error('boom');   // fail on the 3rd write
    order.push('set:' + k); s._map[k] = String(v);
  };
  // wrap removeItem/setItem-in-rollback tracking via order log
  var origRemove = s.removeItem.bind(s);
  s.removeItem = function (k) { order.push('rm:' + k); origRemove(k); };
  var map = { 'songbook.a.v1': 'A1', 'songbook.b.v1': 'B1', 'songbook.c.v1': 'C1' };
  try { Backup.applyAtomic(s, map); } catch (e) { /* expected: 3rd write throws */ }
  // Wrote a then b, c threw. Both prior values must be restored (rollback correctness);
  // both a and b existed before, so rollback is via setItem, not removeItem.
  assert.strictEqual(s._map['songbook.a.v1'], 'A0', 'a restored to prior');
  assert.strictEqual(s._map['songbook.b.v1'], 'B0', 'b restored to prior');
});

/* ---------- restore() refuses to downgrade a newer-stamped device ---------- */
test('restore() refuses when the device holds a newer schema than this build', function () {
  var s = fakeStore({ 'songbook.setlist.v1': '["newshape"]' });
  s.setItem(Backup.SCHEMA_KEY, String(Backup.SCHEMA_VERSION + 1)); // device upgraded by a future build
  var payload = { app: 'music', schema: Backup.SCHEMA_VERSION, data: { 'songbook.setlist.v1': '["oldshape"]' } };
  var threw = null;
  try { Backup.restore(s, payload); } catch (e) { threw = e; }
  assert.ok(threw && /newer data/i.test(threw.message), 'restore refused with newer-data message');
  assert.strictEqual(s.getItem('songbook.setlist.v1'), '["newshape"]', 'newer data NOT overwritten');
  assert.strictEqual(s.getItem(Backup.SCHEMA_KEY), String(Backup.SCHEMA_VERSION + 1), 'stamp NOT downgraded');
});

/* ---------- S-BACKUP-NUDGE: songCount() sums setlist entries across instruments ---------- */
test('songCount() sums setlist entries across every instrument, ignores everything else', function () {
  assert.strictEqual(Backup.songCount({
    'roadcase-ukulele-gcea.setlist.v1': '["a","b","c"]',
    'roadcase-guitar-standard.setlist.v1': '["d","e"]',
    'roadcase-ukulele-gcea.custom.v1': '[{"id":1},{"id":2}]', // progressions, NOT counted
    'bt.custom.v1': '[{"t":"x"}]',                             // tracks, NOT counted
    'music.accent.v1': '#5eead4'
  }), 5);
  assert.strictEqual(Backup.songCount({}), 0);
  assert.strictEqual(Backup.songCount(), 0);
  // malformed JSON under a real setlist key is skipped, not thrown
  assert.strictEqual(Backup.songCount({ 'roadcase-x.setlist.v1': 'not json' }), 0);
});

/* ---------- S-BACKUP-NUDGE: backupNudgeState() truth table ---------- */
test('backupNudgeState() stays silent below the song-count floor regardless of staleness', function () {
  assert.strictEqual(Backup.backupNudgeState(0, null).eligible, false);
  assert.strictEqual(Backup.backupNudgeState(2, null).eligible, false);
  assert.strictEqual(Backup.backupNudgeState(Backup.NUDGE_MIN_SONGS - 1, '2020-01-01T00:00:00.000Z').eligible, false);
});

test('backupNudgeState() is eligible when never backed up, at/above the song floor', function () {
  var s = Backup.backupNudgeState(Backup.NUDGE_MIN_SONGS, null);
  assert.strictEqual(s.eligible, true);
  assert.strictEqual(s.message, 'Back up your library - 3 songs, never backed up.');
  // a malformed lastBackup string reads the same as never-backed-up
  var s2 = Backup.backupNudgeState(5, 'not-a-date');
  assert.strictEqual(s2.eligible, true);
  assert.ok(/never backed up/.test(s2.message));
});

test('backupNudgeState() stays silent while the last backup is within the staleness window', function () {
  var now = Date.parse('2026-07-04T00:00:00.000Z');
  var recent = new Date(now - (Backup.NUDGE_STALE_DAYS - 1) * 86400000).toISOString();
  assert.strictEqual(Backup.backupNudgeState(10, recent, now).eligible, false);
  var exactlyAtFloor = new Date(now - (Backup.NUDGE_STALE_DAYS - 1) * 86400000 - 1).toISOString();
  assert.strictEqual(Backup.backupNudgeState(10, exactlyAtFloor, now).eligible, false);
});

test('backupNudgeState() becomes eligible once the last backup is >= the staleness floor', function () {
  var now = Date.parse('2026-07-04T00:00:00.000Z');
  var stale = new Date(now - Backup.NUDGE_STALE_DAYS * 86400000).toISOString();
  var s = Backup.backupNudgeState(4, stale, now);
  assert.strictEqual(s.eligible, true);
  assert.strictEqual(s.message, 'Back up your library - last backed up 30 days ago.');
  var wayStale = new Date(now - 41 * 86400000).toISOString();
  assert.strictEqual(Backup.backupNudgeState(4, wayStale, now).message, 'Back up your library - last backed up 41 days ago.');
});

/* ---------- snapshot() labels the backup with the device's real schema ---------- */
test('snapshot() stamps the DEVICE schema, so an old build cannot mislabel newer data', function () {
  var s = fakeStore({ 'songbook.setlist.v1': '["a"]' });
  s.setItem(Backup.SCHEMA_KEY, String(Backup.SCHEMA_VERSION + 2)); // device is newer than this build
  var snap = Backup.snapshot(s, null);
  assert.strictEqual(snap.schema, Backup.SCHEMA_VERSION + 2, 'backup labeled with the true (newer) device schema');
  // a normal device stamps the build version
  var s2 = fakeStore({ 'songbook.setlist.v1': '["a"]' });
  assert.strictEqual(Backup.snapshot(s2, null).schema, Backup.SCHEMA_VERSION);
});

/* ---------- S-BACKUP-INTEGRATE (M-6 follow-up #3): tri.* (triad-inversions.html)
 * joins OWNED_PREFIXES - a pre-existing gap the M-6 inventory surfaced, not
 * introduced by it (engineering-wiki/systems/data-model.md). ---------- */
test('owned() + snapshot capture the tri.* triad-inversions namespace', function () {
  assert.strictEqual(Backup.owned('tri.activeKey.v1'), true);
  assert.strictEqual(Backup.owned('tri.dismissed.v1'), true);
  assert.strictEqual(Backup.owned('tri.firstVisitSeen.v1'), true);
  var s = fakeStore({
    'tri.activeKey.v1': 'G',
    'tri.dismissed.v1': '["intro"]',
    'music.accent.v1': '#5eead4'
  });
  var snap = Backup.snapshot(s, null);
  assert.strictEqual(snap.data['tri.activeKey.v1'], 'G');
  assert.strictEqual(snap.data['tri.dismissed.v1'], '["intro"]');
});

test('restore() writes tri.* keys back onto a fresh store', function () {
  var s = fakeStore();
  var n = Backup.restore(s, {
    app: 'music', schema: 1,
    data: { 'tri.activeKey.v1': 'F', 'tri.firstVisitSeen.v1': '1' }
  });
  assert.strictEqual(n, 2);
  assert.strictEqual(s.getItem('tri.activeKey.v1'), 'F');
  assert.strictEqual(s.getItem('tri.firstVisitSeen.v1'), '1');
});

/* ---------- S-BACKUP-INTEGRATE (M-6 follow-up #1): music.schema.version
 * (StorageMigrate's own marker) is deliberately NOT excluded - see the EXCLUDE
 * comment in backup.js for the full version-in-envelope rationale. This test
 * does NOT set global.StorageMigrate, so the post-restore replay hook stays a
 * no-op here (same as every OTHER test above it in this file) - it only proves
 * the write-path keeps the key in lockstep with the rest of the envelope. ---------- */
test('music.schema.version is owned (not excluded) and round-trips through backup+restore', function () {
  assert.strictEqual(Backup.owned('music.schema.version'), true);
  assert.strictEqual(Backup.owned(Backup.SCHEMA_KEY), false); // backup's OWN marker stays excluded

  var s = fakeStore({ 'songbook.setlist.v1': '["a"]', 'music.schema.version': '1' });
  var snap = Backup.snapshot(s, null);
  assert.strictEqual(snap.data['music.schema.version'], '1', 'the runner marker travels inside the envelope');

  var dest = fakeStore();
  Backup.restore(dest, snap);
  assert.strictEqual(dest.getItem('music.schema.version'), '1', 'restore writes the SOURCE device true runner version');
});

/* ---------- S-BACKUP-INTEGRATE (M-6 follow-up #2): restore() replays
 * StorageMigrate.run() after a successful write. Registers a throwaway
 * migration into StorageMigrate's REGISTRY for the duration of this ONE test
 * (global.StorageMigrate is set then deleted in `finally`, so no other test in
 * this - or any other, since each *.test.js runs in its own child process per
 * test/run-all.js - file observes it). Both scenarios live in ONE test body,
 * matching storage-migrate.test.js's own "self-contained, order-independent"
 * convention: CURRENT=1 exposes exactly ONE registrable slot (0->1), so a
 * second test in this file could not register its own without colliding. ---------- */
test('restore() replays a pending migration exactly once on a legacy backup, and skips it once current', function () {
  var calls = 0;
  StorageMigrate.register(0, function (store) {
    calls++;
    // Same idempotent-rename shape as storage-migrate.test.js's own registered
    // step: read an old key, write its replacement, remove the old.
    var old = store.getItem('roadcase-ukulele-gcea.legacy-demo.v1');
    if (old != null) {
      store.setItem('roadcase-ukulele-gcea.migrated-demo.v1', old);
      store.removeItem('roadcase-ukulele-gcea.legacy-demo.v1');
    }
  });
  global.StorageMigrate = StorageMigrate;
  try {
    // Scenario A: a backup taken BEFORE storage-migrate.js ever shipped - its
    // data map has legacy-shaped owned keys but NO 'music.schema.version' key
    // at all (the marker didn't exist yet on the device that made this backup).
    var legacyPayload = {
      app: 'music', schema: 1,
      data: { 'roadcase-ukulele-gcea.legacy-demo.v1': 'hello', 'music.accent.v1': '#a78bfa' }
    };
    var s1 = fakeStore();
    var n1 = Backup.restore(s1, legacyPayload);
    assert.strictEqual(n1, 2, 'both owned data keys written');
    assert.strictEqual(calls, 1, 'the 0->1 migration ran exactly once, replayed by restore()');
    assert.strictEqual(s1.getItem('roadcase-ukulele-gcea.migrated-demo.v1'), 'hello');
    assert.strictEqual(s1.getItem('roadcase-ukulele-gcea.legacy-demo.v1'), null);
    assert.strictEqual(s1.getItem('music.accent.v1'), '#a78bfa');
    assert.strictEqual(s1.getItem(StorageMigrate.VERSION_KEY), String(StorageMigrate.CURRENT), 'runner stamps CURRENT after replay');

    // Scenario B: a backup that ALREADY carries a current-version marker (taken
    // on a device that had already run this migration) must not re-run it.
    var currentPayload = {
      app: 'music', schema: 1,
      data: { 'songbook.setlist.v1': '["a"]', 'music.schema.version': String(StorageMigrate.CURRENT) }
    };
    var s2 = fakeStore();
    Backup.restore(s2, currentPayload);
    assert.strictEqual(calls, 1, 'no additional migration run - the version-in-envelope marker was already current');
    assert.strictEqual(s2.getItem(StorageMigrate.VERSION_KEY), String(StorageMigrate.CURRENT));
    assert.strictEqual(s2.getItem('songbook.setlist.v1'), '["a"]');
  } finally {
    delete global.StorageMigrate; // never leak into any later test in this file
  }
});

test('restore() never throws when StorageMigrate is not defined in this environment', function () {
  // No global.StorageMigrate set (the default for every OTHER test in this
  // file except the one above, which always cleans up in `finally`) - the
  // guard in backup.js's restore() must no-op silently, exactly as it does
  // today for every page that doesn't load storage-migrate.js.
  assert.strictEqual(typeof global.StorageMigrate, 'undefined');
  var s = fakeStore();
  assert.doesNotThrow(function () {
    Backup.restore(s, { app: 'music', schema: 1, data: { 'music.accent.v1': '#fff' } });
  });
});

run();
