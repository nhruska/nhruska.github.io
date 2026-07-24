/* =====================================================================
 * scale-in-key-canon.test.js  -  P2-3: the missing spelling regression NET
 * for the key-aware (regime B) speller. key-spelling.test.js already locks
 * individual hand-picked keys (F major, C# major, the 12 professor traps);
 * this file is the exhaustive counterpart - for ALL 12 chromatic roots x
 * {major, minor, mixolydian, dorian}, it hard-asserts Circle.scaleInKey(root,
 * mode) LETTER-FOR-LETTER against a from-scratch conservatory ground-truth
 * engine (independently re-derived here, NOT read from circle.js's own
 * tables), so a regression that changes both the app and a hand-copied
 * expectation in lockstep can't slip through - the class of gap
 * theory-canon.test.js explicitly scopes OUT (its SCOPE GUARD tests
 * Circle.spellScale, the canonical-sharp legacy function, never letter
 * spelling; scaleInKey's letter-for-letter correctness had no net at all
 * until this file).
 *
 * Ground-truth algorithm (standard conservatory practice):
 *   1. letter-sequential spelling from a named tonic - seven letters, each
 *      used exactly once, accidental chosen (within a whole-tone window) to
 *      hit each scale pitch.
 *   2. the tonic's conventional NAME is whichever of its two enharmonic
 *      candidates (sharp-table vs flat-table) yields FEWER total accidentals
 *      across its own key-aware scale - tie -> SHARP (the same deterministic
 *      product policy documented in circle.js's preferredTonicName and
 *      engineering-wiki/theory-engine/note-spelling.md).
 *
 * Run: node test/scale-in-key-canon.test.js   (no deps; pure Node assert)
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

/* ---------- from-scratch conservatory ground-truth engine ---------- */
var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
var NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// the four jam-modes this net covers (matches the app's MODES subset in use)
var MODE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10]
};
var SHARP_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var FLAT_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function pcOf(name) { // parse C, C#, Db, F##, Ebb...
  var m = /^([A-G])(bb|##|b|#)?$/.exec(name);
  if (!m) return null;
  var pc = NATURAL_PC[m[1]];
  var a = m[2] || '';
  pc += (a === '#' ? 1 : a === '##' ? 2 : a === 'b' ? -1 : a === 'bb' ? -2 : 0);
  return ((pc % 12) + 12) % 12;
}
// letter-sequential spelling of a scale from a named tonic (THE conservatory
// rule: seven letters, each used exactly once; accidentals absorb the diffs).
// Unspellable-in-two-accidentals cases return null (never happens for the
// tonic names this file feeds it, but stays defensive).
function spellFromTonic(tonicName, steps) {
  var m = /^([A-G])(bb|##|b|#)?$/.exec(tonicName);
  if (!m) return null;
  var li = LETTERS.indexOf(m[1]);
  var tonicPc = pcOf(tonicName);
  var out = [];
  for (var d = 0; d < 7; d++) {
    var letter = LETTERS[(li + d) % 7];
    var want = (tonicPc + steps[d]) % 12;
    var diff = want - NATURAL_PC[letter];
    while (diff > 2) diff -= 12;
    while (diff < -2) diff += 12;
    var ACC = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
    if (!(diff in ACC)) return null; // unspellable without triple accidentals
    out.push(letter + ACC[diff]);
  }
  return out;
}
function accCount(spelling) {
  return spelling.reduce(function (n, s) { return n + (s.length - 1); }, 0);
}
// the conventional tonic name for a pitch class in a mode: try both
// enharmonic candidates, keep the letter-sequential spelling with fewer total
// accidentals across the scale; a genuine tie renders SHARP (deterministic
// product policy, not a claim about universal theory practice).
function conventionalTonic(pc, steps) {
  var sName = SHARP_NAME[pc], fName = FLAT_NAME[pc];
  var s1 = spellFromTonic(sName, steps);
  if (sName === fName) return s1; // natural tonic - one spelling, no candidate fight
  var s2 = spellFromTonic(fName, steps);
  if (!s1) return s2;
  if (!s2) return s1;
  return accCount(s2) < accCount(s1) ? s2 : s1;
}

/* ---------- the net: 12 roots x 4 modes, letter-for-letter ---------- */
var totalChecked = 0;
SHARP_NAME.forEach(function (root) {
  Object.keys(MODE_STEPS).forEach(function (mode) {
    test('scaleInKey canon: ' + root + ' ' + mode + ' matches conservatory ground truth', function () {
      totalChecked++;
      var truth = conventionalTonic(pcOf(root), MODE_STEPS[mode]);
      var got = Circle.scaleInKey(root, mode);
      assert.deepStrictEqual(got, truth,
        root + ' ' + mode + ': app scaleInKey ' + JSON.stringify(got) +
        ' != ground truth ' + JSON.stringify(truth));
      // the letter-per-degree invariant: seven distinct letters, each once
      var letters = got.map(function (n) { return n.charAt(0); }).sort().join('');
      assert.strictEqual(letters, 'ABCDEFG', root + ' ' + mode + ' uses every letter once');
    });
  });
});
test('scaleInKey canon matrix size: 12 roots x 4 modes = 48', function () {
  assert.strictEqual(totalChecked, 48,
    'expected 48 checks, ran ' + totalChecked + ' - a root or mode vanished from SHARP_NAME/MODE_STEPS, silently narrowing this net');
});

run();
