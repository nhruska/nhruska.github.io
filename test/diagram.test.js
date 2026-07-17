/* =====================================================================
 * diagram.test.js  -  unit tests for Diagram.scalePlan (the pure fret-window
 * math behind the position-shift scale map). No DOM needed - scale() itself
 * touches document.createElement, but all of its fret-window logic lives in
 * scalePlan(), which this suite exercises directly.
 * Run: node test/diagram.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var D = require('../music/shared/diagram.js');

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

// standard guitar open pitch classes: E A D G B E -> 4 9 2 7 11 4
var GUITAR_OPEN = [4, 9, 2, 7, 11, 4];
// C major scale pitch classes
var C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

/* ---- window bounds ---- */
test('startFret=0 (default) shows the open window: frets 1-7, showOpen true', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  assert.strictEqual(p.showOpen, true);
  assert.deepStrictEqual(p.trueFrets, [1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(p.start, 1);
  assert.strictEqual(p.end, 7);
});
test('startFret omitted defaults identically to startFret=0', function () {
  var withZero = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, startFret: 0 });
  var omitted = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  ['showOpen', 'frets', 'startFret', 'trueFrets', 'start', 'end', 'markers'].forEach(function (k) {
    assert.deepStrictEqual(withZero[k], omitted[k], 'field ' + k + ' should match');
  });
});
test('shifted window (startFret=5) spans true frets 5-11, no open column', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, startFret: 5 });
  assert.strictEqual(p.showOpen, false);
  assert.deepStrictEqual(p.trueFrets, [5, 6, 7, 8, 9, 10, 11]);
  assert.strictEqual(p.start, 5);
  assert.strictEqual(p.end, 11);
});
test('shifted window at the 14-fret-neck cap (startFret=10) still reports true bounds', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, startFret: 10 });
  assert.strictEqual(p.start, 10);
  assert.strictEqual(p.end, 16); // the window itself doesn't self-clip - the UI cap lives in key-explorer.js
});
test('negative or zero-ish startFret values coerce to 0 (no crash, matches base behavior)', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, startFret: -3 });
  assert.strictEqual(p.showOpen, true);
  assert.deepStrictEqual(p.trueFrets, [1, 2, 3, 4, 5, 6, 7]);
});
test('frets defaults to 7 when omitted or falsy', function () {
  var p1 = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0 });
  assert.strictEqual(p1.frets, 7);
  var p2 = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 0 });
  assert.strictEqual(p2.frets, 7);
});

/* ---- true fret labels (position markers) ---- */
test('markers in the open window are the standard 3-5-7 (12 excluded past a 7-fret window)', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  assert.deepStrictEqual(p.markers, [3, 5, 7]);
});
test('markers in a shifted window use TRUE fret numbers, not window-relative ones', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, startFret: 10 });
  // window spans true frets 10-16 -> true markers 12 and 15 fall inside it
  assert.deepStrictEqual(p.markers, [12, 15]);
});
test('a shifted window whose span contains only fret 9 reports exactly that marker', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 2, startFret: 8 });
  // true frets 8-9: 9 is the only standard marker inside the window
  assert.deepStrictEqual(p.markers, [9]);
});

/* ---- open-string exclusion when shifted ---- */
test('open window (startFret=0) includes fret-0 (open string) notes that are in-scale', function () {
  var p = D.scalePlan({ openPcs: [0], scalePcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, frets: 7 }); // open string = C, C major scale
  var notes = p.notesOn(0);
  assert.ok(notes.some(function (n) { return n.fret === 0; }), 'expected an open-string (fret 0) note');
});
test('shifted window (startFret>0) NEVER includes a fret-0 note, even when the open pitch is in-scale', function () {
  var p = D.scalePlan({ openPcs: [0], scalePcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, frets: 7, startFret: 5 });
  var notes = p.notesOn(0);
  assert.ok(!notes.some(function (n) { return n.fret === 0; }), 'shifted window must not render the open-string column');
  assert.deepStrictEqual(notes.map(function (n) { return n.fret; }), [5, 7, 9, 11]); // C major on a C-tuned open string, window = true frets 5-11
});
test('notesOn reports isRoot correctly for both open and shifted windows', function () {
  var openP = D.scalePlan({ openPcs: [0], scalePcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, frets: 7 });
  var openNotes = openP.notesOn(0);
  var openRoot = openNotes.filter(function (n) { return n.fret === 0; })[0];
  assert.strictEqual(openRoot.isRoot, true);

  // widen the shifted window to 5-12 so the next octave root (fret 12) is in view
  var shiftedP = D.scalePlan({ openPcs: [0], scalePcs: [0, 2, 4, 5, 7, 9, 11], rootPc: 0, frets: 8, startFret: 5 });
  var shiftedRoot = shiftedP.notesOn(0).filter(function (n) { return n.fret === 12; })[0];
  assert.ok(shiftedRoot, 'expected fret 12 (root, one octave up) inside the 5-12 window');
  assert.strictEqual(shiftedRoot.isRoot, true);
});
test('out-of-scale pitch classes never appear in notesOn', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  GUITAR_OPEN.forEach(function (openPc, s) {
    p.notesOn(s).forEach(function (n) {
      assert.ok(C_MAJOR.indexOf(n.pc) !== -1, 'note pc ' + n.pc + ' on string ' + s + ' is not in the C major scale');
    });
  });
});
test('empty scalePcs or openPcs never throws', function () {
  assert.doesNotThrow(function () { D.scalePlan({ openPcs: [], scalePcs: [], rootPc: 0, frets: 7 }); });
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: [], rootPc: 0, frets: 7 });
  assert.deepStrictEqual(p.notesOn(0), []);
});

/* ---- F=12 open window (D-FRETS-4STR, m-guide-ia-20260704.md section 5) ----
 * scalePlan itself has no built-in fret cap (the position-shift cap lives in
 * key-explorer.js's posWindow) - a 12-fret open window is just a wider F, and
 * should render the full 1-12 span with no self-clipping. Geometry: the SVG
 * width formula in Diagram.scale (W = padX + openColW + F*fretW + padX =
 * 15+19+12*25+15 = 349px) is a plain arithmetic consequence of this F, so this
 * pure-math check is the regression lock for the 4-string default. */
test('F=12 open window: full 1-12 span, no self-clipping (the UI cap is key-explorer.js, not here)', function () {
  var p = D.scalePlan({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 12 });
  assert.strictEqual(p.showOpen, true);
  assert.deepStrictEqual(p.trueFrets, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.strictEqual(p.start, 1);
  assert.strictEqual(p.end, 12);
});

run();
