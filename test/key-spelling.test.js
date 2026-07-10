/* =====================================================================
 * key-spelling.test.js  -  S-KEY-SPELLING: the deterministic key-aware
 * (letter-per-degree) speller that supersedes canonical-sharp (FORK-4).
 *
 * Proves the goalpost: each of the seven letters A-G is used exactly once,
 * accidental chosen to hit each scale pitch, so F major spells Bb (not A#)
 * and a bVII chord reads Bb (a lowered 7th), never A# (a raised 6th) - the
 * note name AGREES with the degree label the UI shows.
 *
 * Run: node test/key-spelling.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Circle = require('../music/shared/circle.js');

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

// ---- diatonic major scales: each letter once, correct accidentals ----
var MAJOR = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],       // the canonical bug: Bb, NOT A#
  Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],     // flat key stays flat
  Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#']
};
Object.keys(MAJOR).forEach(function (k) {
  test('spellScaleKeyAware ' + k + ' major uses each letter once, correct accidentals', function () {
    var got = Circle.spellScaleKeyAware(k, 'major');
    assert.deepStrictEqual(got, MAJOR[k], k + ' major');
    // each of the 7 letters exactly once (the letter-per-degree invariant)
    var letters = got.map(function (n) { return n.charAt(0); }).sort().join('');
    assert.strictEqual(letters, 'ABCDEFG', k + ' uses every letter once');
  });
});

test('spellScaleKeyAware A minor is all-natural (relative of C)', function () {
  assert.deepStrictEqual(Circle.spellScaleKeyAware('A', 'minor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});
test('spellScaleKeyAware D dorian: raised 6th spells B natural, not the parent flat', function () {
  // D dorian = D E F G A B C  (natural 6 = B)
  assert.deepStrictEqual(Circle.spellScaleKeyAware('D', 'dorian'), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
});

// ---- the actual UAT bug: bVII chord over C must read Bb, not A# ----
test('spellRootInKey: the bVII of C major spells Bb (lowered 7th), never A#', function () {
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'A#'), 'Bb');
  // same pitch class fed as a flat name resolves identically
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'Bb'), 'Bb');
});
test('spellRootInKey: diatonic chords keep their plain key spelling', function () {
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'F'), 'F');   // IV
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'G'), 'G');   // V
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'C'), 'C');   // I
});
test('spellRootInKey: a bIII over C reads Eb (lowered 3rd), not D#', function () {
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'D#'), 'Eb');
});
test('spellRootInKey: a bVI over C reads Ab, not G#', function () {
  assert.strictEqual(Circle.spellRootInKey('C', 'major', 'G#'), 'Ab');
});
test('spellRootInKey: the degree label and the note name now AGREE', function () {
  // romanFor already labels A# in C as "bVII"; the note must be a B-letter to match
  var roman = Circle.romanFor('A#', 'C');
  var name = Circle.spellRootInKey('C', 'major', 'A#');
  assert.strictEqual(roman, 'bVII', 'label is flat-seven');
  assert.strictEqual(name.charAt(0), 'B', 'note is a B-letter (agrees with the VII label)');
});

run();
