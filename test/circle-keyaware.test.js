/* =====================================================================
 * circle-keyaware.test.js  -  #85 key-aware (conventional) spelling layer.
 * Run: node test/circle-keyaware.test.js   (no deps; pure Node assert)
 *
 * The FORK-4 reversal: theory surfaces render flats in flat keys and sharps
 * in sharp keys (F major -> F G A Bb C D E, never A#). The pitch-class core
 * (spell/spellScale/diatonic) stays canonical-sharp and is asserted UNCHANGED
 * here so the display layer can't silently drift the engine.
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

/* ---------- the enharmonic matrix: every major key, keyed by the STORED
   canonical-sharp root value the picker holds (so 'A#' -> Bb-major spelling). ---------- */
var MAJOR_MATRIX = {
  'C':  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'C#': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],   // Db major (flat key)
  'D':  ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  'D#': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],     // Eb major
  'E':  ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  'F':  ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],        // the canonical example — never A#
  'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],   // F# major has E#
  'G':  ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  'G#': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],     // Ab major
  'A':  ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  'A#': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],       // Bb major
  'B':  ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']
};
Object.keys(MAJOR_MATRIX).forEach(function (root) {
  test('major scale spelled key-aware: ' + root + ' -> ' + MAJOR_MATRIX[root].join(' '), function () {
    assert.deepStrictEqual(Circle.spellScaleKeyAware(root, 'major'), MAJOR_MATRIX[root]);
  });
});

test('F major never renders A# on any degree (the FORK-4 reversal, exactly)', function () {
  var sc = Circle.spellScaleKeyAware('F', 'major');
  assert.ok(sc.indexOf('A#') === -1, 'found A# in ' + sc.join(' '));
  assert.strictEqual(sc[3], 'Bb');
});

/* ---------- natural-minor keys (a few load-bearing ones) ---------- */
var MINOR_MATRIX = {
  'A':  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],          // A minor, no accidentals
  'D':  ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],         // D minor (1 flat)
  'G':  ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],        // G minor (2 flats)
  'C':  ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],       // C minor (3 flats)
  'E':  ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],          // E minor (1 sharp)
  'B':  ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],          // B minor (2 sharps)
  'A#': ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab']      // Bb minor (5 flats), stored as A#
};
Object.keys(MINOR_MATRIX).forEach(function (root) {
  test('minor scale spelled key-aware: ' + root + 'm -> ' + MINOR_MATRIX[root].join(' '), function () {
    assert.deepStrictEqual(Circle.spellScaleKeyAware(root, 'minor'), MINOR_MATRIX[root]);
  });
});

/* ---------- keyLabel: conventional tonic name from the canonical-sharp value ---------- */
test('keyLabel maps canonical-sharp values to conventional key names', function () {
  assert.strictEqual(Circle.keyLabel('A#', 'major'), 'Bb');
  assert.strictEqual(Circle.keyLabel('C#', 'major'), 'Db');
  assert.strictEqual(Circle.keyLabel('D#', 'major'), 'Eb');
  assert.strictEqual(Circle.keyLabel('G#', 'major'), 'Ab');
  assert.strictEqual(Circle.keyLabel('F#', 'major'), 'F#');    // tritone -> sharp side
  assert.strictEqual(Circle.keyLabel('C', 'major'), 'C');
  assert.strictEqual(Circle.keyLabel('F', 'major'), 'F');
  // minor rows are relative-minor coherent with major
  assert.strictEqual(Circle.keyLabel('A#', 'minor'), 'Bb');    // Bb minor
  assert.strictEqual(Circle.keyLabel('D#', 'minor'), 'D#');    // D# minor (rel. of F# major)
  assert.strictEqual(Circle.keyLabel('C', 'minor'), 'C');
});

test('relative-minor coherence: MINOR_KEY_ROOT[pc] pairs with MAJOR_KEY_ROOT[(pc+3)%12]', function () {
  // F# major (pc6) <-> D# minor (pc3): both sharp-side
  assert.strictEqual(Circle.keyLabel('F#', 'major'), 'F#');
  assert.strictEqual(Circle.keyLabel('D#', 'minor'), 'D#');
  // Db major (pc1) <-> Bb minor (pc10): both flat-side
  assert.strictEqual(Circle.keyLabel('C#', 'major'), 'Db');
  assert.strictEqual(Circle.keyLabel('A#', 'minor'), 'Bb');
});

/* ---------- spellKeyAware: chromatic notes follow the key's flat/sharp world ---------- */
test('chromatic notes: flat key renders flats, sharp key renders sharps', function () {
  // F major (flat key): the out-of-scale F#/Gb pc renders Gb
  assert.strictEqual(Circle.spellKeyAware(6, 'F', 'major'), 'Gb');
  // G major (sharp key): the out-of-scale A#/Bb pc renders A#
  assert.strictEqual(Circle.spellKeyAware(10, 'G', 'major'), 'A#');
  // C minor is a flat key (3 flats): out-of-scale F#/Gb -> Gb
  assert.strictEqual(Circle.spellKeyAware(6, 'C', 'minor'), 'Gb');
  // A minor is sharp/natural (raised leading tone G#, not Ab)
  assert.strictEqual(Circle.spellKeyAware(8, 'A', 'minor'), 'G#');
});

test('spellKeyAware: in-scale notes match the key-aware scale spelling', function () {
  // Bb (pc10) is the 4th of F major -> Bb, not A#
  assert.strictEqual(Circle.spellKeyAware(10, 'F', 'major'), 'Bb');
  // F# (pc6) is the 7th of G major -> F#
  assert.strictEqual(Circle.spellKeyAware(6, 'G', 'major'), 'F#');
});

/* ---------- diatonicKeyAware: chord names spell key-aware, structure unchanged ---------- */
test('F major diatonic chords render Bb, not A#, on the IV', function () {
  var chords = Circle.diatonicKeyAware('F', 'major').map(function (c) { return c.chord; });
  assert.deepStrictEqual(chords, ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
});

test('diatonicKeyAware differs from diatonic ONLY in spelling (roman/quality identical)', function () {
  var ka = Circle.diatonicKeyAware('F', 'major');
  var cn = Circle.diatonic('F', 'major');
  assert.strictEqual(ka.length, cn.length);
  ka.forEach(function (c, i) {
    assert.strictEqual(c.roman, cn[i].roman, 'roman drift at ' + i);
    assert.strictEqual(c.quality, cn[i].quality, 'quality drift at ' + i);
  });
  // the IV: canonical A#, key-aware Bb
  assert.strictEqual(cn[3].chord, 'A#');
  assert.strictEqual(ka[3].chord, 'Bb');
});

/* ---------- the pitch-class CORE is UNTOUCHED (canonical sharp still holds) ---------- */
test('spellScale (canonical) still renders sharps — F major keeps A#', function () {
  assert.deepStrictEqual(Circle.spellScale('F', 'major'), ['F', 'G', 'A', 'A#', 'C', 'D', 'E']);
});
test('spellRoot (canonical) still returns the sharp value', function () {
  assert.strictEqual(Circle.spellRoot('A#'), 'A#');
  assert.strictEqual(Circle.spellRoot('Bb'), 'A#');   // flat input normalizes to sharp
});

run();
