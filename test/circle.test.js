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
test('diatonic accepts flat roots (Bb major)', function () {
  var d = Circle.diatonic('Bb', 'major');
  // Bb major spelled in sharps: A# C# D# ... but engine uses sharp spelling consistently
  assert.strictEqual(d[0].chord, 'A#'); // root normalized to sharp
  assert.strictEqual(d.length, 7);
});
test('unknown root returns empty diatonic', function () {
  assert.deepStrictEqual(Circle.diatonic('H', 'major'), []);
});

/* ---------- modes: scales, degrees, the "one note changed" ---------- */
test('scale() spells the mode from the root (sharp spelling)', function () {
  assert.deepStrictEqual(Circle.scale('C', 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.deepStrictEqual(Circle.scale('A', 'dorian'), ['A', 'B', 'C', 'D', 'E', 'F#', 'G']);
  assert.deepStrictEqual(Circle.scale('G', 'mixolydian'), ['G', 'A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepStrictEqual(Circle.scale('C', 'minor'), ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#']); // minor == aeolian
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

run();
