/* =====================================================================
 * songbook.test.js  -  unit tests for the instrument-agnostic engine's
 * pure theory helpers (the bits that don't touch the DOM).
 * Run: node test/songbook.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Songbook = require('../music/shared/songbook.js');
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

/* ---------- common-progression filling (the canon, transposable) ---------- */
test('chordsFromDegrees fills the 4-chord song (I V vi IV) in C', function () {
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Major', [0, 4, 5, 3]), ['C', 'G', 'Am', 'F']);
});
test('chordsFromDegrees transposes the SAME degrees to any key', function () {
  // the lesson: a I-V-vi-IV is the same intervals everywhere, only the letters move
  assert.deepStrictEqual(Songbook.chordsFromDegrees('G', 'Major', [0, 4, 5, 3]), ['G', 'D', 'Em', 'C']);
  assert.deepStrictEqual(Songbook.chordsFromDegrees('D', 'Major', [0, 4, 5, 3]), ['D', 'A', 'Bm', 'G']);
});
test('chordsFromDegrees keeps every degree incl. the diminished vii (unlike the jam palette)', function () {
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Major', [6]), ['Bdim']);
});
test('every shipped PROGRESSION renders the Roman pattern it claims (round-trip via Circle.romanFor)', function () {
  var EXPECTED = {
    '4-chord song': 'I V vi IV',
    '50s / doo-wop': 'I vi IV V',
    'Pop / Axis': 'vi IV I V',
    'Three-chord rock': 'I IV V',
    'Jazz turnaround': 'ii V I',
    'Pachelbel': 'I V vi iii IV I IV V'
  };
  Songbook.PROGRESSIONS.forEach(function (p) {
    var chords = Songbook.chordsFromDegrees('C', 'Major', p.degrees);
    // label against the KEY tonic (C), not the first chord — Axis starts on vi, not I
    var romans = chords.map(function (c) { return Circle.romanFor(c, 'C'); }).join(' ');
    assert.strictEqual(romans, EXPECTED[p.name], p.name + ' -> ' + romans);
  });
});

/* ---------- enharmonic root parsing (the E#dim-sounds-as-C bug) ---------- */
test('noteToPc parses enharmonics the 12-name table cannot (E#, B#, Cb, Fb, double accidentals)', function () {
  assert.strictEqual(Songbook.noteToPc('E#'), 5);  // == F
  assert.strictEqual(Songbook.noteToPc('B#'), 0);  // == C
  assert.strictEqual(Songbook.noteToPc('Cb'), 11); // == B
  assert.strictEqual(Songbook.noteToPc('Fb'), 4);  // == E
  assert.strictEqual(Songbook.noteToPc('Fx'), 7);  // double sharp == G
  assert.strictEqual(Songbook.noteToPc('Bbb'), 9); // double flat == A
  assert.strictEqual(Songbook.noteToPc('C'), 0);
  assert.strictEqual(Songbook.noteToPc('zz'), null); // junk
});
test('chordRootFreq: E#dim sounds as F, NOT the C fallback (the vii-of-F#-major bug)', function () {
  var fEsharp = Songbook.chordRootFreq('E#dim');
  assert.ok(Math.abs(fEsharp - Songbook.chordRootFreq('F')) < 0.01, 'E# should equal F');
  assert.ok(Math.abs(fEsharp - 261.63) > 1, 'E# must not fall back to C (261.63)');
  // a genuinely unparseable token still falls back to C, by design
  assert.strictEqual(Songbook.chordRootFreq('???'), 261.63);
});

/* ---------- progression-aware suggestion (the "complete the cliche" nudge) ---------- */
test('degreeOf maps a chord to its 0-indexed major-scale degree (-1 if borrowed)', function () {
  assert.strictEqual(Songbook.degreeOf('C', 'C'), 0);
  assert.strictEqual(Songbook.degreeOf('G', 'C'), 4);   // V
  assert.strictEqual(Songbook.degreeOf('Am', 'C'), 5);  // vi
  assert.strictEqual(Songbook.degreeOf('Eb', 'C'), -1); // borrowed bIII -> not a scale tone
  assert.strictEqual(Songbook.degreeOf('D', 'G'), 4);   // V of G
});
function compNames(cs) { return cs.map(function (c) { return c.name + '->' + c.chord; }); }
test('completions nudges the chord that finishes a famous progression', function () {
  // I-V-vi -> IV completes the 4-chord song
  var c = Songbook.completions(['C', 'G', 'Am'], 'C', 'Major');
  assert.ok(c.some(function (x) { return x.name === '4-chord song' && x.chord === 'F'; }), compNames(c).join(','));
  // ii-V -> I completes the jazz turnaround
  assert.deepStrictEqual(compNames(Songbook.completions(['Dm', 'G'], 'C', 'Major')), ['Jazz turnaround->C']);
});
test('completions is transpose-invariant (same nudge in any key)', function () {
  var c = Songbook.completions(['G', 'D', 'Em'], 'G', 'Major');
  assert.ok(c.some(function (x) { return x.name === '4-chord song' && x.chord === 'C'; }), compNames(c).join(','));
});
test('completions bails on a borrowed chord and on an already-complete progression', function () {
  assert.deepStrictEqual(Songbook.completions(['C', 'Eb'], 'C', 'Major'), []);        // borrowed -> no clean match
  assert.deepStrictEqual(Songbook.completions(['C', 'G', 'Am', 'F'], 'C', 'Major'), []); // 4-chord song done
});

run();
