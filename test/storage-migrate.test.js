/* =====================================================================
 * storage-migrate.test.js  -  unit tests for the versioned localStorage
 * boot migration runner (M-6 STORAGE-MIGRATE, gh #76/#77).
 * Run: node test/storage-migrate.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
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

/* ---------- a minimal Storage-like fake (same shape as backup.test.js's) ---------- */
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

/* ---------- shape sanity ---------- */
test('exports the documented shape', function () {
  assert.strictEqual(StorageMigrate.CURRENT, 1);
  assert.strictEqual(StorageMigrate.VERSION_KEY, 'music.schema.version');
  assert.strictEqual(typeof StorageMigrate.register, 'function');
  assert.strictEqual(typeof StorageMigrate.run, 'function');
  assert.ok(Array.isArray(StorageMigrate.KNOWN_PREFIXES));
  assert.ok(StorageMigrate.KNOWN_PREFIXES.indexOf('music.') !== -1);
});

/* ---------- run() on a bad argument ---------- */
test('run() no-ops on a non-Storage-like argument instead of throwing', function () {
  var r = StorageMigrate.run(null);
  assert.deepStrictEqual(r, { from: null, to: null, ran: [] });
  assert.doesNotThrow(function () { StorageMigrate.run(undefined); });
  assert.doesNotThrow(function () { StorageMigrate.run({}); });
});

/* ---------- fresh install: no marker, no known-prefix key at all ---------- */
test('fresh install (no marker, no legacy data) stamps CURRENT directly, runs nothing', function () {
  var s = fakeStore({ 'unrelated.other-site.key': 'x' }); // foreign key only - not this app's
  var r = StorageMigrate.run(s);
  assert.strictEqual(r.from, 1);
  assert.strictEqual(r.to, 1);
  assert.deepStrictEqual(r.ran, []);
  assert.strictEqual(s.getItem(StorageMigrate.VERSION_KEY), '1');
});

test('fresh install with truly empty store also stamps CURRENT', function () {
  var s = fakeStore();
  var r = StorageMigrate.run(s);
  assert.strictEqual(r.from, 1);
  assert.strictEqual(r.to, 1);
  assert.strictEqual(s.getItem(StorageMigrate.VERSION_KEY), '1');
});

/* ---------- already-current device: re-running is a no-op ---------- */
test('a device already stamped at CURRENT is a no-op on re-run', function () {
  var s = fakeStore();
  s.setItem(StorageMigrate.VERSION_KEY, '1');
  s.setItem('music.accent.v1', '#5eead4');
  var r = StorageMigrate.run(s);
  assert.strictEqual(r.from, 1);
  assert.strictEqual(r.to, 1);
  assert.deepStrictEqual(r.ran, []);
  assert.strictEqual(s.getItem('music.accent.v1'), '#5eead4'); // untouched
});

/* ---------- downgrade guard: never step a newer-than-CURRENT marker back ---------- */
test('a marker ahead of CURRENT (newer build wrote it) is left exactly as-is', function () {
  var s = fakeStore();
  s.setItem(StorageMigrate.VERSION_KEY, '7');
  var r = StorageMigrate.run(s);
  assert.strictEqual(r.from, 7);
  assert.strictEqual(r.to, 7);
  assert.strictEqual(s.getItem(StorageMigrate.VERSION_KEY), '7'); // never rewritten downward
});

/* ---------- hasLegacyData() helper ---------- */
test('hasLegacyData() recognizes every known prefix, ignores the marker + foreign keys', function () {
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'songbook.setlist.v1': '[]' })), true);
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'roadcase-ukulele-gcea.custom.v1': '[]' })), true);
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'bt.custom.v1': '[]' })), true);
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'music.accent.v1': 'x' })), true);
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'tri.activeKey.v1': 'D' })), true);
  var marker = {}; marker[StorageMigrate.VERSION_KEY] = '1';
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore(marker)), false); // the marker alone isn't "legacy data"
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore({ 'someothersite.token': 'x' })), false);
  assert.strictEqual(StorageMigrate.hasLegacyData(fakeStore()), false);
});

/* ---------- readVersion() parsing ---------- */
test('readVersion() parses a stamped integer, returns null when absent/malformed', function () {
  var s = fakeStore();
  assert.strictEqual(StorageMigrate.readVersion(s), null);
  s.setItem(StorageMigrate.VERSION_KEY, '3');
  assert.strictEqual(StorageMigrate.readVersion(s), 3);
  s.setItem(StorageMigrate.VERSION_KEY, 'not-a-number');
  assert.strictEqual(StorageMigrate.readVersion(s), null);
  s.setItem(StorageMigrate.VERSION_KEY, '-1');
  assert.strictEqual(StorageMigrate.readVersion(s), null);
});

/* ---------- register() validation ---------- */
test('register() rejects a bad fromVersion or a non-function fn', function () {
  assert.throws(function () { StorageMigrate.register(-1, function () {}); });
  assert.throws(function () { StorageMigrate.register(1.5, function () {}); });
  assert.throws(function () { StorageMigrate.register('0', function () {}); });
  assert.throws(function () { StorageMigrate.register(0, null); });
});

/* ---------- quota-throw during stamp fails soft ---------- */
test('a throwing store (quota exceeded) fails soft instead of throwing out of run()', function () {
  var s = fakeStore();
  s.setItem = function () { throw new Error('QuotaExceededError'); };
  var r;
  assert.doesNotThrow(function () { r = StorageMigrate.run(s); });
  assert.strictEqual(r.from, 1);   // fresh install detected before the throwing write
  assert.strictEqual(r.to, null);  // stamp never completed - next boot retries
});

/* ---------- THE core migration-chain test: pre-runner install runs 0->CURRENT,
 * the registered step executes exactly once, and a second run() is a no-op.
 * Self-contained in one test body (registers into the ONLY slot CURRENT=1
 * exposes) so it doesn't depend on / interfere with test execution order. ---------- */
test('pre-runner install (legacy key, no marker) runs the registered 0->1 migration exactly once', function () {
  var calls = 0;
  StorageMigrate.register(0, function (store) {
    calls++;
    // idempotent-by-construction rename, matching the shape of the app's
    // existing ad-hoc migrations (songbook.js loadPerfPrefs, tracks.js
    // migrateUrls): read an old key, write its replacement, remove the old.
    var old = store.getItem('roadcase-ukulele-gcea.demo-legacy.v1');
    if (old != null) {
      store.setItem('roadcase-ukulele-gcea.demo-migrated.v1', old);
      store.removeItem('roadcase-ukulele-gcea.demo-legacy.v1');
    }
  });

  var s = fakeStore({ 'roadcase-ukulele-gcea.demo-legacy.v1': 'hello' }); // legacy data, no version marker
  var r1 = StorageMigrate.run(s);
  assert.strictEqual(r1.from, 0);
  assert.strictEqual(r1.to, 1);
  assert.deepStrictEqual(r1.ran, ['0->1']);
  assert.strictEqual(calls, 1);
  assert.strictEqual(s.getItem('roadcase-ukulele-gcea.demo-migrated.v1'), 'hello');
  assert.strictEqual(s.getItem('roadcase-ukulele-gcea.demo-legacy.v1'), null);
  assert.strictEqual(s.getItem(StorageMigrate.VERSION_KEY), '1');

  // Second run on the SAME (now-current) store: must NOT re-invoke the migration.
  var r2 = StorageMigrate.run(s);
  assert.strictEqual(r2.from, 1);
  assert.strictEqual(r2.to, 1);
  assert.deepStrictEqual(r2.ran, []);
  assert.strictEqual(calls, 1); // unchanged - never re-ran
});

run();
