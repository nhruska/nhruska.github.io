/* =====================================================================
 * diagram-pref.test.js  -  unit tests for the S-DIAGRAM-PREF dots|patterns
 * preference (music/shared/diagram-pref.js): read/write + default, and the
 * labelFor() decision of whether/what to show in 'patterns' mode.
 * Run: node test/diagram-pref.test.js   (no deps; pure Node assert)
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

var DiagramPref = require('../music/shared/diagram-pref.js');
var GP = require('../music/shared/profiles/guitar-standard.js').MusicProfiles['guitar-standard'];

/* ---------- KEY + default ---------- */
test('KEY is the additive, versioned localStorage key the spec names', function () {
  assert.strictEqual(DiagramPref.KEY, 'music.diagram.pref.v1');
});
test('get() defaults to "dots" when the key is missing (fresh device)', function () {
  resetLocalStorage();
  assert.strictEqual(DiagramPref.get(), 'dots');
});
test('get() defaults to "dots" when localStorage is entirely unavailable', function () {
  delete global.localStorage;
  assert.strictEqual(DiagramPref.get(), 'dots');
});

/* ---------- read/write round-trip ---------- */
test('set("patterns") persists, and get() reads it back', function () {
  resetLocalStorage();
  DiagramPref.set('patterns');
  assert.strictEqual(DiagramPref.get(), 'patterns');
});
test('set("dots") persists, and get() reads it back', function () {
  resetLocalStorage();
  DiagramPref.set('patterns'); // flip away from default first, to prove this call actually wrote
  DiagramPref.set('dots');
  assert.strictEqual(DiagramPref.get(), 'dots');
});

/* ---------- defensive read: any other stored value coerces to 'dots' ---------- */
test('a corrupt/foreign stored value reads as "dots", never thrown, never "patterns"', function () {
  ['not a real value', '', 'PATTERNS', '42', 'null'].forEach(function (bad) {
    resetLocalStorage({ 'music.diagram.pref.v1': bad });
    assert.doesNotThrow(function () {
      assert.strictEqual(DiagramPref.get(), 'dots', 'bad value ' + JSON.stringify(bad) + ' must read as dots');
    });
  });
});

/* ---------- set() never persists a bad value verbatim ---------- */
test('set() with a bogus value coerces to "dots" rather than persisting garbage', function () {
  resetLocalStorage();
  DiagramPref.set('whatever');
  assert.strictEqual(DiagramPref.get(), 'dots');
  assert.strictEqual(global.localStorage.getItem('music.diagram.pref.v1'), 'dots');
});

/* ---------- labelFor(): the 'patterns'-mode decision ---------- */
test('labelFor() returns "" in dots mode (default), regardless of a classifiable voicing', function () {
  resetLocalStorage();
  var label = DiagramPref.labelFor('guitar-standard', 'E', GP.chords.E);
  assert.strictEqual(label, '');
});
test('labelFor() returns the ShapeClassify label in patterns mode for a classifiable voicing', function () {
  resetLocalStorage();
  DiagramPref.set('patterns');
  var label = DiagramPref.labelFor('guitar-standard', 'E', GP.chords.E);
  assert.strictEqual(label, 'open E shape, root on 6, root position');
});
test('labelFor() returns "" in patterns mode when the profile/voicing is not classifiable (honest null, never a guess)', function () {
  resetLocalStorage();
  DiagramPref.set('patterns');
  // banjo-gdgbd is out of ShapeClassify's scope entirely (guitar-standard and
  // ukulele-gcea only) - any voicing on it must degrade to no label.
  assert.strictEqual(DiagramPref.labelFor('banjo-gdgbd', 'G', [0, 0, 0, 0, 0]), '');
});
test('labelFor() returns "" in patterns mode when frets is absent/empty (no chord to classify)', function () {
  resetLocalStorage();
  DiagramPref.set('patterns');
  assert.strictEqual(DiagramPref.labelFor('guitar-standard', 'Zzz', null), '');
  assert.strictEqual(DiagramPref.labelFor('guitar-standard', 'Zzz', []), '');
});

run();
