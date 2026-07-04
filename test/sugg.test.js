/* =====================================================================
 * sugg.test.js  -  regression guard for the chord-progression suggestion
 * map (music/shared/sugg.js), extracted out of music/play/index.html's
 * inline bootstrap script (S-EXTRACT, analysis-refactor-enhance-20260704 A7).
 *
 * Two things this guards:
 *   1. FORK-4 canonical-sharp agreement: every root token (every SUGG key
 *      AND every follower chord name in every SUGG value) must already be
 *      spelled canonical-sharp - the whole app labels A#/D#m, never Bb/Ebm,
 *      so a suggestion chip can never show a flat name beside an in-key
 *      palette that says sharp. Verified by normalizing each root through a
 *      SMALL, LOCAL flat->sharp table (a FORK-4 duplicate - deliberately NOT
 *      importing music/shared/circle.js into this test or into sugg.js
 *      itself; see the module's header comment) and asserting the
 *      normalized root equals the original (i.e. it was already canonical).
 *   2. Content-identity snapshot: the extracted table is byte-for-byte the
 *      same curated data that lived inline in play/index.html before the
 *      move - this is hand-tuned musical data, not derived, so an
 *      accidental edit during a future refactor should fail loudly here.
 * Run: node test/sugg.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var Sugg = require('../music/shared/sugg.js');
var SUGG = Sugg.SUGG;

// FORK-4 duplicate (deliberately NOT importing circle.js - see header
// comment above): flat spellings normalize to their canonical-sharp twin;
// anything already sharp/natural maps to itself.
var FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
function normalizeRoot(root) { return FLAT_TO_SHARP[root] || root; }
function rootOf(name) {
  var m = /^([A-G][#b]?)/.exec(name);
  assert.ok(m, 'not a chord name with a parseable root: ' + name);
  return m[1];
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

test('SUGG is exported and non-empty', function () {
  assert.ok(SUGG && typeof SUGG === 'object');
  assert.ok(Object.keys(SUGG).length > 0);
});

test('every SUGG key root is already canonical-sharp (FORK-4)', function () {
  Object.keys(SUGG).forEach(function (key) {
    var root = rootOf(key);
    assert.strictEqual(normalizeRoot(root), root, 'key "' + key + '" has a non-canonical (flat) root: ' + root);
  });
});

test('every follower chord name in every SUGG array is already canonical-sharp (FORK-4)', function () {
  var offenders = [];
  Object.keys(SUGG).forEach(function (key) {
    SUGG[key].forEach(function (follower) {
      var root = rootOf(follower);
      if (normalizeRoot(root) !== root) offenders.push(key + ' -> ' + follower);
    });
  });
  assert.deepStrictEqual(offenders, [], 'flat-spelled followers found (violates FORK-4): ' + offenders.join(', '));
});

test('no key or follower is spelled with a flat letter at all (stronger check than normalize-equality)', function () {
  var flatPattern = /^[A-G]b/;
  var offenders = [];
  Object.keys(SUGG).forEach(function (key) {
    if (flatPattern.test(key)) offenders.push('key:' + key);
    SUGG[key].forEach(function (follower) { if (flatPattern.test(follower)) offenders.push(key + '->' + follower); });
  });
  assert.deepStrictEqual(offenders, []);
});

test('content-identity snapshot: SUGG matches the pre-move curated literal exactly', function () {
  var GOLDEN = {
    C: ["G", "Am", "F", "Em", "Dm"], G: ["C", "D", "Em", "Am", "D7"], D: ["G", "A", "Bm", "Em", "A7"],
    A: ["D", "E", "Bm", "E7", "F"], E: ["A", "B", "C#m", "B7", "A"], F: ["C", "G", "Dm", "A#", "Am"],
    B: ["E", "A", "F#7", "E7", "G"], Am: ["F", "G", "C", "Dm", "E7"], Em: ["C", "G", "D", "Am", "B7"],
    Dm: ["G", "C", "F", "Am", "A7"], Bm: ["G", "A", "D", "Em", "F#7"], Gm: ["F", "D7", "Cm", "D#", "A#"],
    Cm: ["G7", "Fm", "G#", "D#", "A#"], Fm: ["C7", "A#m", "C#", "G#", "D#"],
    G7: ["C", "Am", "F", "Em"], C7: ["F", "Dm", "G", "Am"], D7: ["G", "Em", "C", "Bm"],
    A7: ["D", "Bm", "G", "F#m"], E7: ["A", "C#m", "F#m", "B7"], F7: ["A#", "Dm", "C", "Gm"],
    B7: ["E", "G#m", "C#m", "F#m"]
  };
  assert.deepStrictEqual(SUGG, GOLDEN);
});

test('every SUGG key names a real chord root+quality shape (no empty strings, no whitespace)', function () {
  Object.keys(SUGG).forEach(function (key) {
    assert.ok(/^[A-G][#b]?[a-zA-Z0-9]*$/.test(key), 'malformed SUGG key: "' + key + '"');
    SUGG[key].forEach(function (follower) {
      assert.ok(/^[A-G][#b]?[a-zA-Z0-9]*$/.test(follower), 'malformed follower under "' + key + '": "' + follower + '"');
    });
  });
});

run();
