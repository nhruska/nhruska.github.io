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
test('describe() summarises keys as songbook concepts with real counts', function () {
  var lines = Backup.describe({
    'songbook.setlist.v1': '["a","b","c"]',
    'bt.custom.v1': '[{"t":"x"},{"t":"y"}]',
    'music.trackUrls.v1': '{"k1":"v","k2":"v"}',
    'music.accent.v1': '#5eead4',
    'music.activeProfile.v1': 'ukulele-gcea'
  });
  var byLabel = {};
  lines.forEach(function (l) { byLabel[l.label] = l.detail; });
  assert.strictEqual(byLabel['Setlist'], '3 songs');
  assert.strictEqual(byLabel['Custom tracks'], '2 tracks');
  assert.strictEqual(byLabel['Curated track links'], '2 links');
  assert.strictEqual(byLabel['Preferences'], 'accent colour, instrument');
});
test('describe() singularises a count of one and skips absent keys', function () {
  var lines = Backup.describe({ 'songbook.setlist.v1': '["only"]' });
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].label, 'Setlist');
  assert.strictEqual(lines[0].detail, '1 song');
});
test('describe() tolerates malformed values without throwing', function () {
  var lines = Backup.describe({ 'bt.custom.v1': 'not json', 'songbook.setlist.v1': '{}' });
  // malformed array -> 0; still lists the label rather than crashing
  assert.strictEqual(lines.length, 2);
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
