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

// ---- FORK-4 removal kernel: preferred tonic names + key-aware twins ----
test('preferredTonicName: A#/D#/C# majors prefer their flat names; F# ties to sharp; naturals unchanged', function () {
  assert.strictEqual(Circle.preferredTonicName('A#', 'major'), 'Bb');
  assert.strictEqual(Circle.preferredTonicName('D#', 'major'), 'Eb');
  assert.strictEqual(Circle.preferredTonicName('C#', 'major'), 'Db');
  assert.strictEqual(Circle.preferredTonicName('F#', 'major'), 'F#');
  assert.strictEqual(Circle.preferredTonicName('C', 'major'), 'C');
});
test('preferredTonicName: G# minor stays sharp (5# beats Ab minor 7b); A# minor prefers Bb minor', function () {
  assert.strictEqual(Circle.preferredTonicName('G#', 'minor'), 'G#');
  assert.strictEqual(Circle.preferredTonicName('A#', 'minor'), 'Bb');
});
test('scaleInKey: A#-major context renders as Bb major (no double-sharps ever shown)', function () {
  assert.deepStrictEqual(Circle.scaleInKey('A#', 'major'), ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
});
test('scaleInKey: C mixolydian shows Bb (the b7 the operator kept hitting as A#)', function () {
  assert.deepStrictEqual(Circle.scaleInKey('C', 'mixolydian'), ['C', 'D', 'E', 'F', 'G', 'A', 'Bb']);
});
test('diatonicInKey: F major chords spell Bb (IV), matching their roman labels', function () {
  var chords = Circle.diatonicInKey('F', 'major').map(function (d) { return d.chord; });
  assert.deepStrictEqual(chords, ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
});
test('soloScaleInKey: C blues is the standard C Eb F Gb G Bb; A pent-minor stays natural', function () {
  assert.deepStrictEqual(Circle.soloScaleInKey('C', 'blues', 'major'), ['C', 'Eb', 'F', 'Gb', 'G', 'Bb']);
  assert.deepStrictEqual(Circle.soloScaleInKey('A', 'pentMinor', 'minor'), ['A', 'C', 'D', 'E', 'G']);
});
test('soloScaleInKey: pc identity holds - key-aware names hit the same pitch classes as legacy', function () {
  var SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function pc(n){var m=/^([A-G])([#b]*)$/.exec(n);var p={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]];for(var i=0;i<m[2].length;i++)p+=m[2][i]==='#'?1:-1;return((p%12)+12)%12;}
  SHARP.forEach(function (root) {
    ['pentMajor','pentMinor','blues','mixolydian','dorian'].forEach(function (id) {
      var a = Circle.soloScale(root, id).map(pc);
      var b = Circle.soloScaleInKey(root, id).map(pc);
      assert.deepStrictEqual(b, a, root + ' ' + id + ' pcs must match legacy');
    });
  });
});
test('noteInKey composes with preferred naming (bVII of Bb-major-as-A# reads Ab)', function () {
  assert.strictEqual(Circle.noteInKey('A#', 'major', 'G#'), 'Ab');
});

// ---- The 12 professor trap cases (theory-professor-review-20260703, the
// regime-B acceptance bar from engineering-wiki/theory-engine/note-spelling.md)
// - now permanent regression guards. Trap 11 (Cb major) is N/A by design:
// Cb is not an accepted input (norm()'s flat table covers the five common
// flats); unknown roots fail safe to [].
test('professor traps 1-10 + 12: the regime-B acceptance table holds', function () {
  function scale(r, m) { return Circle.scaleInKey(r, m).join(' '); }
  function chords(r, m) { return Circle.diatonicInKey(r, m).map(function (d) { return d.chord; }).join(' '); }
  assert.strictEqual(scale('F', 'major'), 'F G A Bb C D E');                       // 1
  assert.strictEqual(chords('F', 'major'), 'F Gm Am Bb C Dm Edim');
  assert.strictEqual(Circle.preferredTonicName('C#', 'major'), 'Db');              // 2
  assert.strictEqual(scale('C#', 'major'), 'Db Eb F Gb Ab Bb C');
  assert.strictEqual(chords('C#', 'major'), 'Db Ebm Fm Gb Ab Bbm Cdim');
  assert.strictEqual(scale('F#', 'major'), 'F# G# A# B C# D# E#');                 // 3
  assert.strictEqual(chords('F#', 'major'), 'F# G#m A#m B C# D#m E#dim');
  assert.strictEqual(scale('C#', 'mixolydian'), 'C# D# E# F# G# A# B');            // 4
  assert.strictEqual(scale('D#', 'minor'), 'D# E# F# G# A# B C#');                 // 5
  assert.strictEqual(Circle.preferredTonicName('A#', 'minor'), 'Bb');              // 6
  assert.strictEqual(scale('A#', 'minor'), 'Bb C Db Eb F Gb Ab');
  assert.strictEqual(Circle.preferredTonicName('G#', 'minor'), 'G#');              // 7
  assert.strictEqual(scale('G#', 'minor'), 'G# A# B C# D# E F#');
  assert.strictEqual(scale('Eb', 'dorian'), 'Eb F Gb Ab Bb C Db');                 // 8
  assert.strictEqual(scale('A#', 'major').indexOf('A#'), -1);                      // 9 (no leaked sharps in Bb ctx)
  assert.strictEqual(Circle.preferredTonicName('D#', 'major'), 'Eb');              // 10 (auto-render Eb major)
  assert.strictEqual(Circle.noteInKey('F#', 'major', 'F') + 'dim', 'E#dim');       // 12 (display never leaks Fdim)
});

run();
