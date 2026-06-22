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

run();
