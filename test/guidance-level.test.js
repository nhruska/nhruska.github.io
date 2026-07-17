/* =====================================================================
 * guidance-level.test.js  -  unit tests for the M-GUIDANCE experience-level
 * preference (music/shared/guidance-level.js): read/write + the "unset
 * means ask pending, never a guessed default" contract.
 * Run: node test/guidance-level.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var lsReset = require('./helpers/local-storage-reset.js');
function resetLocalStorage(seed) {
  global.localStorage = lsReset.fakeStore();
  if (seed) Object.keys(seed).forEach(function (k) { global.localStorage.setItem(k, seed[k]); });
}

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

var GuidanceLevel = require('../music/shared/guidance-level.js');

/* ---------- KEY + LEVELS ---------- */
test('KEY is the additive, versioned localStorage key the spec names', function () {
  assert.strictEqual(GuidanceLevel.KEY, 'music.guidanceLevel.v1');
});
test('LEVELS is the canonical beginner/intermediate/advanced order', function () {
  assert.deepStrictEqual(GuidanceLevel.LEVELS, ['beginner', 'intermediate', 'advanced']);
});

/* ---------- unset -> null ("ask pending"), never a guessed default ---------- */
test('get() returns null when the key is missing (fresh device) - "ask pending", not a default', function () {
  resetLocalStorage();
  assert.strictEqual(GuidanceLevel.get(), null);
});
test('get() returns null when localStorage is entirely unavailable', function () {
  delete global.localStorage;
  assert.strictEqual(GuidanceLevel.get(), null);
});

/* ---------- read/write round-trip for every valid level ---------- */
['beginner', 'intermediate', 'advanced'].forEach(function (lvl) {
  test('set("' + lvl + '") persists, and get() reads it back', function () {
    resetLocalStorage();
    GuidanceLevel.set(lvl);
    assert.strictEqual(GuidanceLevel.get(), lvl);
  });
});
test('set() overwrites a previously stored level', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced');
  GuidanceLevel.set('beginner');
  assert.strictEqual(GuidanceLevel.get(), 'beginner');
});

/* ---------- defensive read: any other stored value reads as null, never guessed ---------- */
test('a corrupt/foreign stored value reads as null (never thrown, never a guessed level)', function () {
  ['not a real value', '', 'BEGINNER', '42', 'null', 'dots'].forEach(function (bad) {
    resetLocalStorage({ 'music.guidanceLevel.v1': bad });
    assert.doesNotThrow(function () {
      assert.strictEqual(GuidanceLevel.get(), null, 'bad value ' + JSON.stringify(bad) + ' must read as null');
    });
  });
});

/* ---------- set() never persists a bad value ---------- */
test('set() with a bogus value is a silent no-op, never persists garbage', function () {
  resetLocalStorage();
  GuidanceLevel.set('whatever');
  assert.strictEqual(GuidanceLevel.get(), null);
  assert.strictEqual(global.localStorage.getItem('music.guidanceLevel.v1'), null);
});
test('set() with a bogus value never clobbers an existing valid level', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced');
  GuidanceLevel.set('nonsense');
  assert.strictEqual(GuidanceLevel.get(), 'advanced');
});

run();
