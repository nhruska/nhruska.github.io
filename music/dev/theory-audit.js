/* =====================================================================
 * theory-audit.js - deterministic theory-credibility audit (mission tool)
 * ---------------------------------------------------------------------
 * Persona P2 (conservatory-trained) probe from the ux-persona mission:
 * for all 12 roots x 4 modes, compare the app's scale spelling, diatonic
 * chord sets, and roman labels against conservatory ground truth
 * (letter-sequential spelling; qualities from stacked thirds).
 *
 * Every delta is classified:
 *   BUG        - wrong pitch class or wrong chord quality (P0: theory error)
 *   CONVENTION - right pitch class, non-traditional spelling (the
 *                canonical-sharp FORK-4 choice vs written-music convention;
 *                feeds the "spelling preference" settings candidate)
 *
 * Run: node music/dev/theory-audit.js        (exit 0 unless BUGs found)
 * ===================================================================== */
'use strict';
var Songbook = require('../shared/songbook.js');
var Circle = require('../shared/circle.js');

// ---- conservatory ground truth ------------------------------------------
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

function pcOf(name) { // parse C, C#, Db, F##, Ebb...
  var m = /^([A-G])(bb|##|b|#)?$/.exec(name);
  if (!m) return null;
  var pc = NATURAL_PC[m[1]];
  var a = m[2] || '';
  pc += (a === '#' ? 1 : a === '##' ? 2 : a === 'b' ? -1 : a === 'bb' ? -2 : 0);
  return ((pc % 12) + 12) % 12;
}
// letter-sequential spelling of a scale from a named tonic (THE conservatory rule:
// seven letters, each used exactly once; accidentals absorb the differences)
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
    // wrap to nearest accidental in [-2, 2]
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
// candidates, keep the letter-sequential spelling with fewer accidentals
// (tie -> flats, matching written-music practice for e.g. Gb vs F#: F# wins 6v6? no -
// F# major 6 sharps vs Gb major 6 flats is a true tie; prefer sharp then, matching
// guitar practice).
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

// ---- the audit ------------------------------------------------------------
var ROOTS = SHARP_NAME; // the app's root vocabulary (canonical sharp)
var bugs = [], conventions = [], checked = 0;

ROOTS.forEach(function (root) {
  Object.keys(MODE_STEPS).forEach(function (mode) {
    var steps = MODE_STEPS[mode], quals = MODE_QUALS[mode];
    var pc = pcOf(root);
    var truth = conventional(pc, steps);

    // 1) app scale spelling (Circle.spellScale) - pitch classes MUST match truth
    var appScale = Circle.spellScale(root, mode === 'Major' ? 'major' : mode === 'Minor' ? 'minor' : mode.toLowerCase());
    if (!appScale || appScale.length !== 7) {
      bugs.push({ key: root + ' ' + mode, kind: 'scale-missing', detail: String(appScale) });
      return;
    }
    for (var d = 0; d < 7; d++) {
      checked++;
      var appPc = pcOf(appScale[d]);
      var truthPc = pcOf(truth.scale[d]);
      if (appPc !== truthPc) {
        bugs.push({ key: root + ' ' + mode, kind: 'scale-pitch', degree: d + 1, app: appScale[d], truth: truth.scale[d] });
      } else if (appScale[d] !== truth.scale[d]) {
        conventions.push({ key: root + ' ' + mode, kind: 'scale-spelling', degree: d + 1, app: appScale[d], truth: truth.scale[d] });
      }
    }

    // 2) diatonic chords (degrees 0..6 via chordsFromDegrees) - root pc + quality
    var appChords = Songbook.chordsFromDegrees(root, mode, [0, 1, 2, 3, 4, 5, 6]);
    if (!appChords || appChords.length !== 7) {
      bugs.push({ key: root + ' ' + mode, kind: 'chords-missing', detail: String(appChords) });
      return;
    }
    for (d = 0; d < 7; d++) {
      checked++;
      var m = /^([A-G](?:bb|##|b|#)?)(m|dim)?$/.exec(appChords[d]);
      if (!m) { bugs.push({ key: root + ' ' + mode, kind: 'chord-parse', degree: d + 1, app: appChords[d] }); continue; }
      var cq = m[2] || '';
      if (pcOf(m[1]) !== pcOf(truth.scale[d])) {
        bugs.push({ key: root + ' ' + mode, kind: 'chord-pitch', degree: d + 1, app: appChords[d], truth: truth.scale[d] + quals[d] });
      } else if (cq !== quals[d]) {
        bugs.push({ key: root + ' ' + mode, kind: 'chord-quality', degree: d + 1, app: appChords[d], truth: truth.scale[d] + quals[d] });
      } else if (m[1] !== truth.scale[d]) {
        conventions.push({ key: root + ' ' + mode, kind: 'chord-spelling', degree: d + 1, app: appChords[d], truth: truth.scale[d] + quals[d] });
      }
    }

    // 3) roman labels (Circle.romanFor against the tonic) - case must track quality
    if (Circle.romanFor) {
      var NUM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
      for (d = 0; d < 7; d++) {
        checked++;
        var rn = Circle.romanFor(appChords[d], root, mode);
        if (rn == null) continue; // romanFor may not support mode arg; skip silently
        var base = String(rn).replace(/[^ivIV]/g, '');
        var wantCase = quals[d] === '' ? NUM[d] : NUM[d].toLowerCase();
        if (base.toUpperCase() !== NUM[d]) {
          bugs.push({ key: root + ' ' + mode, kind: 'roman-degree', degree: d + 1, app: rn });
        } else if (base !== wantCase) {
          bugs.push({ key: root + ' ' + mode, kind: 'roman-case', degree: d + 1, app: rn, truth: wantCase + (quals[d] === 'dim' ? '°' : '') });
        }
      }
    }
  });
});

// ---- report ---------------------------------------------------------------
// Which app keys read "wrong" to a trained reader (any spelling delta)?
var keysWithConv = {};
conventions.forEach(function (c) { keysWithConv[c.key] = (keysWithConv[c.key] || 0) + 1; });

console.log('THEORY AUDIT - 12 roots x 4 modes  (' + checked + ' checks)');
console.log('BUGS (wrong pitch/quality/degree): ' + bugs.length);
bugs.slice(0, 20).forEach(function (b) { console.log('  BUG ' + JSON.stringify(b)); });
console.log('CONVENTION deltas (canonical-sharp vs written-music spelling): ' + conventions.length);
console.log('Keys a trained reader flags (delta count):');
Object.keys(keysWithConv).sort(function (a, b) { return keysWithConv[b] - keysWithConv[a]; })
  .forEach(function (k) { console.log('  ' + k + ': ' + keysWithConv[k]); });
// a compact sample of the worst offenders for the artifact
var sample = conventions.filter(function (c) { return /^(F|A#|D#|G#|C#) (Major|Minor)/.test(c.key); }).slice(0, 12);
console.log('Sample (flat-side keys):');
sample.forEach(function (c) { console.log('  ' + c.key + ' deg' + c.degree + ': app ' + c.app + '  truth ' + (c.truth || '')); });
process.exit(bugs.length ? 1 : 0);
