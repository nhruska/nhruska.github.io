/* =====================================================================
 * theory-canon.test.js  -  deterministic conservatory-theory canon,
 * promoted from the ux-persona mission's one-off P2 audit
 * (music/dev/theory-audit.js) into the permanent suite.
 * ---------------------------------------------------------------------
 * For all 12 roots x 4 modes, hard-asserts the app's scale pitch classes,
 * diatonic chord pitch+quality, and roman degree/case against a
 * from-scratch conservatory ground-truth engine (letter-sequential
 * spelling; qualities from stacked thirds; fewest-accidentals naming with
 * a documented sharp-tie policy) - NOT against the app's own tables, so a
 * regression that changes both the app and a hand-copied expectation in
 * lockstep can't slip through.
 *
 * SCOPE GUARD (current regime only): this file asserts PITCH-CLASS
 * correctness, CHORD QUALITY, and ROMAN DEGREE/CASE - never spelling
 * (letter name) equality. The app is canonical-sharp everywhere (FORK-4,
 * pilot UAT) while conservatory practice spells some keys with flats
 * (e.g. C# Major degree 1 reads "C#" here vs the conservatory's "Db").
 * That is a known, deliberate CONVENTION delta, not a bug - the ground-
 * truth engine below computes the conventional letter-spelling (so a
 * follow-up, e.g. an app-wide spelling-preference feature, has the exact
 * table to assert against) but this file never compares it for equality.
 * Asserting spelling-vs-conservatory here would fail on main today.
 *
 * Run: node test/theory-canon.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Circle = require('../music/shared/circle.js');
var Songbook = require('../music/shared/songbook.js');

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

/* ---------- conservatory ground-truth engine (ported, not re-derived) ---
 * Verbatim in structure from music/dev/theory-audit.js so the two stay in
 * lockstep if the mission script is re-run; this copy is now the durable
 * source. ------------------------------------------------------------- */
var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
var NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
var MODE_STEPS = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10]
};
// diatonic triad qualities per degree (stacked thirds within the mode)
var MODE_QUALS = {
  Major: ['', 'm', 'm', '', '', 'm', 'dim'],
  Minor: ['m', 'dim', '', 'm', 'm', '', ''],
  Mixolydian: ['', 'm', 'dim', '', 'm', 'm', ''],
  Dorian: ['m', 'm', '', '', 'm', 'dim', '']
};
var ACC = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
var NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function pcOf(name) { // parse C, C#, Db, F##, Ebb...
  var m = /^([A-G])(bb|##|b|#)?$/.exec(name);
  if (!m) return null;
  var pc = NATURAL_PC[m[1]];
  var a = m[2] || '';
  pc += (a === '#' ? 1 : a === '##' ? 2 : a === 'b' ? -1 : a === 'bb' ? -2 : 0);
  return ((pc % 12) + 12) % 12;
}
// letter-sequential spelling of a scale from a named tonic (THE conservatory
// rule: seven letters, each used exactly once; accidentals absorb the diffs)
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
    if (!(diff in ACC)) return null; // unspellable without triple accidentals
    out.push(letter + ACC[diff]);
  }
  return out;
}
function accCount(spelling) {
  return spelling.reduce(function (n, s) { return n + (s.length - 1); }, 0);
}
// conventional tonic name for a pitch class in a mode: try both enharmonic
// candidates, keep the letter-sequential spelling with fewer accidentals.
// TIE -> SHARPS is a deterministic PRODUCT POLICY, not standard practice
// (professor-adversarial finding, 2026-07-03: F#/Gb major and D#/Eb minor
// are legitimate equal-accidental spellings in the literature; guitar
// practice leans sharp, so ties render sharp here - documented, deliberate).
var SHARP_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var FLAT_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
function conventional(pc, steps) {
  var s1 = spellFromTonic(SHARP_NAME[pc], steps);
  var s2 = spellFromTonic(FLAT_NAME[pc], steps);
  if (!s1) return { name: FLAT_NAME[pc], scale: s2 };
  if (!s2) return { name: SHARP_NAME[pc], scale: s1 };
  if (SHARP_NAME[pc] === FLAT_NAME[pc]) return { name: SHARP_NAME[pc], scale: s1 };
  return accCount(s2) < accCount(s1) ? { name: FLAT_NAME[pc], scale: s2 }
    : { name: SHARP_NAME[pc], scale: s1 };
}

/* ---------- the canon: 12 roots x 4 modes x (scale + chord + roman) x 7 --
 * One test() per root+mode context (48 total) so a failure names the
 * exact context; each context hard-asserts all 21 of its checks (7
 * scale-pitch + 7 chord-pitch/quality + 7 roman-degree/case) and reports
 * every failing degree in one message if any mismatch. 12 x 4 x 21 = 1008
 * checks total (locked by the matrix-size case at the end).
 * ------------------------------------------------------------------------ */
var totalChecked = 0;

SHARP_NAME.forEach(function (root) {
  Object.keys(MODE_STEPS).forEach(function (mode) {
    test('theory canon: ' + root + ' ' + mode + ' (21 checks)', function () {
      var steps = MODE_STEPS[mode], quals = MODE_QUALS[mode];
      var pc = pcOf(root);
      var truth = conventional(pc, steps);
      var failures = [];
      var d;

      // 1) scale pitch classes (Circle.spellScale) must match truth, degree-for-degree
      var circleMode = mode === 'Major' ? 'major' : mode === 'Minor' ? 'minor' : mode.toLowerCase();
      var appScale = Circle.spellScale(root, circleMode);
      if (!appScale || appScale.length !== 7) {
        failures.push('scale-missing: got ' + JSON.stringify(appScale));
      } else {
        for (d = 0; d < 7; d++) {
          totalChecked++;
          var appPc = pcOf(appScale[d]), truthPc = pcOf(truth.scale[d]);
          if (appPc !== truthPc) {
            failures.push('scale-pitch deg' + (d + 1) + ': app ' + appScale[d] + ' (pc ' + appPc +
              ') != truth ' + truth.scale[d] + ' (pc ' + truthPc + ')');
          }
        }
      }

      // 2) diatonic chords (Songbook.chordsFromDegrees) - root pc + quality
      var appChords = Songbook.chordsFromDegrees(root, mode, [0, 1, 2, 3, 4, 5, 6]);
      if (!appChords || appChords.length !== 7) {
        failures.push('chords-missing: got ' + JSON.stringify(appChords));
      } else {
        for (d = 0; d < 7; d++) {
          totalChecked++;
          var cm = /^([A-G](?:bb|##|b|#)?)(m|dim)?$/.exec(appChords[d]);
          if (!cm) { failures.push('chord-parse deg' + (d + 1) + ': ' + appChords[d]); continue; }
          var cq = cm[2] || '';
          var wantPc = pcOf(truth.scale[d]);
          if (pcOf(cm[1]) !== wantPc) {
            failures.push('chord-pitch deg' + (d + 1) + ': app ' + appChords[d] + ' != truth root pc ' +
              wantPc + ' (' + truth.scale[d] + quals[d] + ')');
          } else if (cq !== quals[d]) {
            failures.push('chord-quality deg' + (d + 1) + ': app ' + appChords[d] + ' != truth ' +
              truth.scale[d] + quals[d]);
          }
        }
      }

      // 3) roman labels (Circle.romanFor against the tonic) - degree + case
      if (appChords && appChords.length === 7 && Circle.romanFor) {
        for (d = 0; d < 7; d++) {
          totalChecked++;
          var rn = Circle.romanFor(appChords[d], root);
          if (rn == null) continue; // defensive; romanFor always returns a string today
          var base = String(rn).replace(/[^ivIV]/g, '');
          var wantCase = quals[d] === '' ? NUM[d] : NUM[d].toLowerCase();
          if (base.toUpperCase() !== NUM[d]) {
            failures.push('roman-degree deg' + (d + 1) + ': app ' + rn + ' (want degree ' + NUM[d] + ')');
          } else if (base !== wantCase) {
            failures.push('roman-case deg' + (d + 1) + ': app ' + rn + ' != truth ' + wantCase +
              (quals[d] === 'dim' ? '°' : ''));
          }
        }
      }

      assert.strictEqual(failures.length, 0,
        root + ' ' + mode + ' theory-canon mismatches:\n      ' + failures.join('\n      '));
    });
  });
});

test('theory canon matrix size: 12 roots x 4 modes x 21 checks = 1008', function () {
  assert.strictEqual(totalChecked, 1008,
    'expected 1008 checks, ran ' + totalChecked + ' - the matrix shrank (a root or mode ' +
    'vanished from SHARP_NAME/MODE_STEPS, silently narrowing this canon)');
});

run();
