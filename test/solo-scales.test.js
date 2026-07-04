/* =====================================================================
 * solo-scales.test.js  -  unit tests for S-BLUES: Circle.SOLO_SCALES /
 * soloScale / soloScaleDegrees / soloScaleInfo (pentatonic + blues, SOLO
 * LAYER ONLY - zero surface in diatonic()/romanFor()/harmonization; see
 * circle.js's SOLO_SCALES block comment for the regime-A/regime-B seam).
 *
 * 12 roots x 3 scales (pentMajor, pentMinor, blues): pitch classes, names ==
 * spell() (the regime-A no-special-casing invariant), degree glyphs, and
 * formula lengths (5/5/6) - plus unknown-id/unknown-root safety and the two
 * subset proofs from the S-BLUES plan (pentMajor subset of ionian/lydian/
 * mixolydian; pentMinor subset of aeolian/dorian/phrygian).
 *
 * Run: node test/solo-scales.test.js   (no deps; pure Node assert)
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

// Independent ground truth (hand-typed, not read from circle.js's own ROOTS
// table) for the regime-A "names == spell(pc)" invariant below.
var SHARP_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function pcOf(root) { return SHARP_NAME.indexOf(root); }
function spell(pc) { return SHARP_NAME[((pc % 12) + 12) % 12]; }

var SCALE_IDS = ['pentMajor', 'pentMinor', 'blues'];
var EXPECT_LEN = { pentMajor: 5, pentMinor: 5, blues: 6 };
var EXPECT_DEGREES = {
  pentMajor: ['1', '2', '3', '5', '6'],
  pentMinor: ['1', '♭3', '4', '5', '♭7'],
  blues: ['1', '♭3', '4', '♭5', '5', '♭7']
};

var registered = 0;
SHARP_NAME.forEach(function (root) {
  var rootPc = pcOf(root);
  SCALE_IDS.forEach(function (scaleId) {
    registered++;
    test('soloScale/soloScaleDegrees: ' + root + ' ' + scaleId, function () {
      var names = Circle.soloScale(root, scaleId);
      var degrees = Circle.soloScaleDegrees(scaleId);
      var info = Circle.soloScaleInfo(scaleId);

      // lengths (5/5/6)
      assert.strictEqual(names.length, EXPECT_LEN[scaleId], root + ' ' + scaleId + ' note count');
      assert.strictEqual(degrees.length, EXPECT_LEN[scaleId], root + ' ' + scaleId + ' degree count');
      assert.ok(info, root + ' ' + scaleId + ' soloScaleInfo should resolve');
      assert.strictEqual(info.formula.length, EXPECT_LEN[scaleId], root + ' ' + scaleId + ' formula length');

      // pcs: each name's pitch class must equal (rootPc + formula interval) % 12
      names.forEach(function (nm, i) {
        var wantPc = (rootPc + info.formula[i]) % 12;
        assert.strictEqual(pcOf(nm), wantPc, root + ' ' + scaleId + ' deg' + (i + 1) + ' pc: got ' + nm);
      });

      // names == spell(pc) - the regime-A no-special-casing invariant (the
      // blue note is NOT flattened here; it renders sharp like every other
      // chromatic tone under the one spell() table).
      names.forEach(function (nm, i) {
        var wantPc = (rootPc + info.formula[i]) % 12;
        assert.strictEqual(nm, spell(wantPc), root + ' ' + scaleId + ' deg' + (i + 1) + ' name != spell(pc)');
      });

      // degree glyphs match the plan's canon (flat sign, matching scaleDegrees())
      assert.deepStrictEqual(degrees, EXPECT_DEGREES[scaleId], root + ' ' + scaleId + ' degree glyphs');
    });
  });
});

test('matrix size: 12 roots x 3 scales = 36 solo-scale cases', function () {
  assert.strictEqual(registered, 36,
    'expected 36 per-root-per-scale cases, registered ' + registered + ' - a root or scaleId vanished from the loop above');
});

/* ---------- unknown-id / unknown-root safety (never throws) ---------- */
test('soloScale: unknown scaleId -> [] (safe)', function () {
  assert.deepStrictEqual(Circle.soloScale('A', 'nonsense'), []);
});
test('soloScale: unknown root -> [] (safe)', function () {
  assert.deepStrictEqual(Circle.soloScale('H', 'blues'), []);
});
test('soloScaleDegrees: unknown scaleId -> [] (safe)', function () {
  assert.deepStrictEqual(Circle.soloScaleDegrees('nonsense'), []);
});
test('soloScaleInfo: unknown scaleId -> null (safe)', function () {
  assert.strictEqual(Circle.soloScaleInfo('nonsense'), null);
});

/* ---------- subset proofs (S-BLUES plan section 3a) ---------- */
test('pentMajor formula is a subset of ionian/lydian/mixolydian', function () {
  var pm = Circle.SOLO_SCALES.pentMajor.formula;
  ['ionian', 'lydian', 'mixolydian'].forEach(function (mode) {
    var steps = Circle.MODE_STEPS[mode];
    pm.forEach(function (iv) {
      assert.ok(steps.indexOf(iv) >= 0, 'pentMajor interval ' + iv + ' not found in ' + mode + ' (' + steps.join(',') + ')');
    });
  });
});
test('pentMinor formula is a subset of aeolian/dorian/phrygian', function () {
  var pm = Circle.SOLO_SCALES.pentMinor.formula;
  ['aeolian', 'dorian', 'phrygian'].forEach(function (mode) {
    var steps = Circle.MODE_STEPS[mode];
    pm.forEach(function (iv) {
      assert.ok(steps.indexOf(iv) >= 0, 'pentMinor interval ' + iv + ' not found in ' + mode + ' (' + steps.join(',') + ')');
    });
  });
});

run();
