/* =====================================================================
 * key-explorer-boxes.test.js  -  unit tests for KeyExplorer.boxes()
 * (S-BLUES-BOXES): the pure pitch-class math behind the Studio's named
 * Box 1-5 positions for pentMajor/pentMinor/blues. 12 roots x guitar
 * (EADGBE) + ukulele (GCEA) x 3 scale ids - box count, startFret range,
 * root-string anchor correctness (by pc math, not a golden fret table),
 * non-empty labels/moveHints, plus the openPcsFromPack() pack-metadata
 * helper. The renderScale() DOM wiring (chip + pager-snap) is covered by
 * key-explorer.dom.test.js.
 * Run: node test/key-explorer-boxes.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var KE = require('../music/shared/key-explorer.js');

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

/* ---- independent ground truth (hand-typed, not read from key-explorer.js) ---- */
var SHARP_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function pcOf(root) { return SHARP_NAME.indexOf(root); }

var GUITAR_OPEN = ['E', 'A', 'D', 'G', 'B', 'E'].map(pcOf);   // low E -> high E, index 0..5
var UKE_OPEN = ['G', 'C', 'E', 'A'].map(pcOf);                // GCEA, index 0..3

var SCALE_IDS = ['pentMajor', 'pentMinor', 'blues'];
var TUNINGS = { guitar: GUITAR_OPEN, ukulele: UKE_OPEN };

/* ---------- matrix: 12 roots x 3 scales x 2 tunings ---------- */
var registered = 0;
Object.keys(TUNINGS).forEach(function (tuningName) {
  var openPcs = TUNINGS[tuningName];
  SHARP_NAME.forEach(function (root) {
    var rootPc = pcOf(root);
    SCALE_IDS.forEach(function (scaleId) {
      registered++;
      test('boxes: ' + root + ' ' + scaleId + ' on ' + tuningName, function () {
        var list = KE.boxes(rootPc, scaleId, openPcs);

        // exactly 5 boxes, numbered 1-5 in order
        assert.strictEqual(list.length, 5, root + ' ' + scaleId + '/' + tuningName + ' box count');
        list.forEach(function (b, i) { assert.strictEqual(b.n, i + 1, 'box n out of order at index ' + i); });

        list.forEach(function (b) {
          // startFret stays inside the pager's mapped range [0, 14]
          assert.ok(b.startFret >= 0 && b.startFret <= 14,
            root + ' ' + scaleId + '/' + tuningName + ' box ' + b.n + ' startFret out of range: ' + b.startFret);

          // rootString is a valid index into this tuning
          assert.ok(b.rootString >= 0 && b.rootString < openPcs.length,
            root + ' ' + scaleId + '/' + tuningName + ' box ' + b.n + ' rootString out of range: ' + b.rootString);

          // the labeled root-string anchor must ACTUALLY carry rootPc at SOME
          // fret >= 0 (the pc-math anchor invariant, not a curated fret table)
          var m = /fret (\d+)$/.exec(b.label);
          assert.ok(m, 'label missing a trailing fret number: ' + b.label);
          var labeledFret = Number(m[1]);
          var soundedPc = ((openPcs[b.rootString] + labeledFret) % 12 + 12) % 12;
          assert.strictEqual(soundedPc, rootPc,
            root + ' ' + scaleId + '/' + tuningName + ' box ' + b.n + ' anchor does not sound the root: ' + b.label);

          // non-empty label + moveHint (A9 template-generated, never blank)
          assert.ok(b.label && b.label.length, 'empty label for box ' + b.n);
          assert.ok(b.moveHint && b.moveHint.length, 'empty moveHint for box ' + b.n);
        });
      });
    });
  });
});
test('matrix size: 12 roots x 3 scales x 2 tunings = 72 box-table cases', function () {
  assert.strictEqual(registered, 72,
    'expected 72 per-root-per-scale-per-tuning cases, registered ' + registered);
});

/* ---------- pentMajor/pentMinor share IDENTICAL box windows (same 5-note
 * pitch-class set, relative major/minor) - only the labeled root differs ---------- */
test('pentMajor(C) and pentMinor(A) on guitar: identical startFret windows (relative keys, same shape)', function () {
  var maj = KE.boxes(pcOf('C'), 'pentMajor', GUITAR_OPEN);
  var min = KE.boxes(pcOf('A'), 'pentMinor', GUITAR_OPEN);
  assert.deepStrictEqual(maj.map(function (b) { return b.startFret; }), min.map(function (b) { return b.startFret; }));
});

/* ---------- blues rides the SAME 5 windows as pentMinor (S-BLUES §3a: the
 * b5 passing tone never earns its own box) ---------- */
test('blues(A) and pentMinor(A) on guitar: identical startFret windows', function () {
  var blues = KE.boxes(pcOf('A'), 'blues', GUITAR_OPEN);
  var minor = KE.boxes(pcOf('A'), 'pentMinor', GUITAR_OPEN);
  assert.deepStrictEqual(blues.map(function (b) { return b.startFret; }), minor.map(function (b) { return b.startFret; }));
});

/* ---------- the documented A minor pentatonic / guitar box-1 anchor (matches
 * the classic CAGED-derived teaching diagram: root on the low E string, 5th
 * fret) - a single golden-value regression check on top of the matrix above ---------- */
test('A minor pentatonic, guitar: Box 1 anchors root on the 6th string at fret 5', function () {
  var list = KE.boxes(pcOf('A'), 'pentMinor', GUITAR_OPEN);
  var box1 = list[0];
  assert.strictEqual(box1.startFret, 5);
  assert.strictEqual(box1.rootString, 0);
  assert.strictEqual(box1.label, 'Box 1 - root on 6th string, fret 5');
});

/* ---------- safety: never throws, returns [] on missing input ---------- */
test('boxes: missing rootPc -> [] (safe)', function () {
  assert.deepStrictEqual(KE.boxes(null, 'pentMinor', GUITAR_OPEN), []);
});
test('boxes: empty openPcs -> [] (safe)', function () {
  assert.deepStrictEqual(KE.boxes(pcOf('A'), 'pentMinor', []), []);
});
test('boxes: null openPcs -> [] (safe)', function () {
  assert.deepStrictEqual(KE.boxes(pcOf('A'), 'pentMinor', null), []);
});
test('boxes: unknown scaleId behaves like pentMinor (no relative-minor shift applied)', function () {
  var unknown = KE.boxes(pcOf('A'), 'nonsense', GUITAR_OPEN);
  var minor = KE.boxes(pcOf('A'), 'pentMinor', GUITAR_OPEN);
  assert.deepStrictEqual(unknown.map(function (b) { return b.startFret; }), minor.map(function (b) { return b.startFret; }));
});

/* ---------- openPcsFromPack: the pack-metadata bridge ---------- */
test('openPcsFromPack: derives pitch classes from a guitar-shaped pack.meta.stringNames', function () {
  var pack = { meta: { stringNames: ['E', 'A', 'D', 'G', 'B', 'E'] } };
  assert.deepStrictEqual(KE.openPcsFromPack(pack), GUITAR_OPEN);
});
test('openPcsFromPack: derives pitch classes from a ukulele-shaped pack (re-entrant order preserved)', function () {
  var pack = { meta: { stringNames: ['G', 'C', 'E', 'A'] } };
  assert.deepStrictEqual(KE.openPcsFromPack(pack), UKE_OPEN);
});
test('openPcsFromPack: sharp/flat accidentals resolve too (future-proofing, not used by any shipped profile today)', function () {
  var pack = { meta: { stringNames: ['F#', 'Bb'] } };
  assert.deepStrictEqual(KE.openPcsFromPack(pack), [pcOf('F#'), pcOf('A#')]);
});
test('openPcsFromPack: missing meta/stringNames -> null (safe, never throws)', function () {
  assert.strictEqual(KE.openPcsFromPack(null), null);
  assert.strictEqual(KE.openPcsFromPack({}), null);
  assert.strictEqual(KE.openPcsFromPack({ meta: {} }), null);
});

run();
