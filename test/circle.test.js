/* =====================================================================
 * circle.test.js  -  unit tests for the circle-of-fifths theory engine.
 * Run: node test/circle.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Circle = require('../music/shared/circle.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function names(list) { return list.map(function (c) { return c.chord; }).join(' '); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- the order ---------- */
test('ORDER is the 12 fifths clockwise from C', function () {
  assert.deepStrictEqual(Circle.ORDER, ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']);
});
test('position / atPosition round-trip, flats normalized', function () {
  assert.strictEqual(Circle.position('C'), 0);
  assert.strictEqual(Circle.position('G'), 1);
  assert.strictEqual(Circle.position('F'), 11);
  assert.strictEqual(Circle.position('Bb'), Circle.position('A#')); // flat normalized
  assert.strictEqual(Circle.atPosition(0), 'C');
  assert.strictEqual(Circle.atPosition(12), 'C'); // wraps
  assert.strictEqual(Circle.atPosition(-1), 'F');
});

/* ---------- neighbors on the wheel ---------- */
test('dominant is a fifth up, subdominant a fifth down', function () {
  assert.strictEqual(Circle.dominant('C'), 'G');
  assert.strictEqual(Circle.subdominant('C'), 'F');
  assert.strictEqual(Circle.dominant('F'), 'C');
  assert.strictEqual(Circle.subdominant('G'), 'C');
  assert.strictEqual(Circle.dominant('B'), 'F#');
});
test('relative minor is three semitones down; relative major three up', function () {
  assert.strictEqual(Circle.relativeMinor('C'), 'A');
  assert.strictEqual(Circle.relativeMinor('G'), 'E');
  assert.strictEqual(Circle.relativeMajor('A'), 'C');
  assert.strictEqual(Circle.relativeMajor('E'), 'G');
});
test('neighbors() major key → V, IV, relative minor (mode-aware)', function () {
  var n = Circle.neighbors('C', 'major');
  assert.deepStrictEqual(n.map(function (x) { return x.root + ':' + x.mode; }),
    ['G:major', 'F:major', 'A:minor']);
});
test('neighbors() minor key → v, iv, relative major (mode-aware)', function () {
  var n = Circle.neighbors('A', 'minor');
  assert.deepStrictEqual(n.map(function (x) { return x.root + ':' + x.mode; }),
    ['E:minor', 'D:minor', 'C:major']);
  assert.ok(/relative major/.test(n[2].why));
});

/* ---------- diatonic chords ---------- */
test('C major diatonic triads: C Dm Em F G Am Bdim', function () {
  var d = Circle.diatonic('C', 'major');
  assert.strictEqual(names(d), 'C Dm Em F G Am Bdim');
  assert.deepStrictEqual(d.map(function (x) { return x.roman; }),
    ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
});
test('A natural minor diatonic triads: Am Bdim C Dm Em F G', function () {
  var d = Circle.diatonic('A', 'minor');
  assert.strictEqual(names(d), 'Am Bdim C Dm Em F G');
  assert.deepStrictEqual(d.map(function (x) { return x.roman; }),
    ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
});
test('G major diatonic includes the F# leading tone', function () {
  var d = Circle.diatonic('G', 'major');
  assert.strictEqual(names(d), 'G Am Bm C D Em F#dim');
});
test('diatonic spells canonically sharp (Bb input normalizes to A# major)', function () {
  var d = Circle.diatonic('Bb', 'major');
  assert.strictEqual(names(d), 'A# Cm Dm D# F Gm Adim'); // sharps app-wide (FORK-4)
  assert.strictEqual(d.length, 7);
});
test('unknown root returns empty diatonic', function () {
  assert.deepStrictEqual(Circle.diatonic('H', 'major'), []);
});

/* ---------- modes: scales, degrees, the "one note changed" ---------- */
test('scale() spells canonically sharp - one table app-wide (FORK-4)', function () {
  assert.deepStrictEqual(Circle.scale('C', 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.deepStrictEqual(Circle.scale('A', 'dorian'), ['A', 'B', 'C', 'D', 'E', 'F#', 'G']);
  assert.deepStrictEqual(Circle.scale('G', 'mixolydian'), ['G', 'A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepStrictEqual(Circle.scale('C', 'minor'), ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#']); // sharps, never flats
  assert.deepStrictEqual(Circle.scale('Bb', 'major'), ['A#', 'C', 'D', 'D#', 'F', 'G', 'A']); // flat input -> sharp output
  assert.deepStrictEqual(Circle.scale('F#', 'major'), ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F']); // table names only, no E#
  assert.deepStrictEqual(Circle.scale('A#', 'major'), Circle.scale('Bb', 'major')); // enharmonic inputs, identical output
});
test('no double-accidentals on any wheel-reachable key (ORDER x UI modes)', function () {
  var modes = ['ionian', 'lydian', 'mixolydian', 'dorian', 'aeolian', 'phrygian'];
  Circle.ORDER.forEach(function (root) {
    modes.forEach(function (m) {
      Circle.scale(root, m).forEach(function (n) {
        assert.ok(!/(bb|##)/.test(n), root + ' ' + m + ' produced ' + n);
      });
    });
  });
});
test('dark modes on sharp roots stay readable (C# minor, not Db double-flats)', function () {
  assert.deepStrictEqual(Circle.scale('C#', 'aeolian'), ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B']);
  assert.deepStrictEqual(Circle.scale('G#', 'phrygian'), ['G#', 'A', 'B', 'C#', 'D#', 'E', 'F#']);
});
test('keyName() echoes the canonical sharp name of a root', function () {
  assert.strictEqual(Circle.keyName('A#'), 'A#');
  assert.strictEqual(Circle.keyName('D#'), 'D#'); // what the user picked is what shows
  assert.strictEqual(Circle.keyName('G#'), 'G#');
  assert.strictEqual(Circle.keyName('C#'), 'C#');
  assert.strictEqual(Circle.keyName('F#'), 'F#');
  assert.strictEqual(Circle.keyName('F'), 'F');
  assert.strictEqual(Circle.keyName('Bb'), 'A#'); // flat input normalizes to the table
});
test('D# stays D# in every derived surface - never Eb (S4/C5, pilot UAT)', function () {
  assert.deepStrictEqual(Circle.scale('D#', 'mixolydian'), ['D#', 'F', 'G', 'G#', 'A#', 'C', 'C#']);
  var d = Circle.diatonic('D#', 'mixolydian');
  assert.strictEqual(d[0].chord, 'D#');
  assert.strictEqual(d[0].roman, 'I');
  assert.strictEqual(Circle.spellRoot('D#', 'minor'), 'D#');
  assert.strictEqual(Circle.diatonic('D#', 'minor')[0].chord, 'D#m');
});
test('modeKey is case-insensitive - a capitalized mode never falls back to major', function () {
  assert.deepStrictEqual(Circle.diatonic('D', 'Minor'), Circle.diatonic('D', 'minor'));
  assert.deepStrictEqual(Circle.scale('C', 'MAJOR'), Circle.scale('C', 'major'));
  assert.deepStrictEqual(Circle.scaleDegrees('Dorian'), Circle.scaleDegrees('dorian'));
  // the D-minor palette itself, sharp-spelled: i ii° III iv v VI VII
  var d = Circle.diatonic('D', 'Minor');
  assert.strictEqual(names(d), 'Dm Edim F Gm Am A# C');
  assert.deepStrictEqual(d.map(function (x) { return x.roman; }),
    ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
});
test('scaleDegrees() labels intervals against the major scale', function () {
  assert.deepStrictEqual(Circle.scaleDegrees('dorian'), ['1', '2', '♭3', '4', '5', '6', '♭7']);
  assert.deepStrictEqual(Circle.scaleDegrees('mixolydian'), ['1', '2', '3', '4', '5', '6', '♭7']);
  assert.deepStrictEqual(Circle.scaleDegrees('phrygian'), ['1', '♭2', '♭3', '4', '5', '♭6', '♭7']);
  assert.deepStrictEqual(Circle.scaleDegrees('lydian'), ['1', '2', '3', '♯4', '5', '6', '7']);
});
test('modeChange() reports the note that moves vs the parent scale', function () {
  var d = Circle.modeChange('A', 'dorian'); // vs natural minor: raise the 6th F->F#
  assert.strictEqual(d.length, 1);
  assert.deepStrictEqual({ degree: d[0].degree, from: d[0].from, to: d[0].to, dir: d[0].dir },
    { degree: 6, from: 'F', to: 'F#', dir: 'raise' });
  var m = Circle.modeChange('G', 'mixolydian'); // vs major: lower the 7th F#->F
  assert.deepStrictEqual({ degree: m[0].degree, from: m[0].from, to: m[0].to, dir: m[0].dir },
    { degree: 7, from: 'F#', to: 'F', dir: 'lower' });
  assert.deepStrictEqual(Circle.modeChange('C', 'major'), []); // a reference scale changes nothing
  assert.deepStrictEqual(Circle.modeChange('A', 'minor'), []);
  var x = Circle.modeChange('C', 'mixolydian'); // canonical sharp: the lowered 7th reads A#
  assert.deepStrictEqual({ from: x[0].from, to: x[0].to }, { from: 'B', to: 'A#' });
});
test('modeInfo() carries family + label', function () {
  assert.strictEqual(Circle.modeInfo('dorian').family, 'minor');
  assert.strictEqual(Circle.modeInfo('mixolydian').family, 'major');
  assert.ok(/Dorian/.test(Circle.modeInfo('dorian').label));
});
test('diatonic() generalizes to modes', function () {
  var d = Circle.diatonic('A', 'dorian');
  assert.strictEqual(names(d), 'Am Bm C D Em F#dim G');
  assert.deepStrictEqual(d.map(function (x) { return x.roman; }),
    ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII']);
  var g = Circle.diatonic('G', 'mixolydian');
  assert.strictEqual(names(g), 'G Am Bdim C Dm Em F');
});
test('MODE_STEPS is exported as the single source for scale intervals', function () {
  // songbook.js derives its jam-mode steps from these — they must stay correct
  assert.deepStrictEqual(Circle.MODE_STEPS.ionian, [0, 2, 4, 5, 7, 9, 11]);
  assert.deepStrictEqual(Circle.MODE_STEPS.aeolian, [0, 2, 3, 5, 7, 8, 10]);
  assert.deepStrictEqual(Circle.MODE_STEPS.mixolydian, [0, 2, 4, 5, 7, 9, 10]);
  assert.deepStrictEqual(Circle.MODE_STEPS.dorian, [0, 2, 3, 5, 7, 9, 10]);
});
test('romanFor() labels any chord by its interval from the key (the first chord)', function () {
  var rf = Circle.romanFor;
  // diatonic major: case carries quality, ° marks the diminished
  assert.deepStrictEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'].map(function (c) { return rf(c, 'C'); }),
    ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  // minor key relabels from its own tonic
  assert.deepStrictEqual(['Am', 'Dm', 'Em'].map(function (c) { return rf(c, 'Am'); }), ['i', 'iv', 'v']);
  // borrowed / non-diatonic chords get a flatted numeral
  assert.strictEqual(rf('Bb', 'C'), 'bVII');
  assert.strictEqual(rf('Eb', 'C'), 'bIII');
  assert.strictEqual(rf('F#', 'C'), 'bV');
  // transpose-invariant: a I-IV-V-vi is the same labels in any key
  assert.deepStrictEqual(['D', 'G', 'A', 'Bm'].map(function (c) { return rf(c, 'D'); }), ['I', 'IV', 'V', 'vi']);
  // flat spelling on either side resolves the same as its sharp enharmonic
  assert.strictEqual(rf('Ab', 'C'), 'bVI');
  assert.strictEqual(rf('C', 'Bb'), 'II');
  // garbage in -> empty (caller skips the label)
  assert.strictEqual(rf('???', 'C'), '');
});

run();
