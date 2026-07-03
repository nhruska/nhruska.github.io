/* =====================================================================
 * backup.test.js  -  unit tests for the schema/versioned backup+restore.
 * Run: node test/backup.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Backup = require('../music/shared/backup.js');

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
  assert.strictEqual(Backup.validate({ app: 'music', schema: 1, data: {} }).ok, true);
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

run();
