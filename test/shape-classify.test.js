/* =====================================================================
 * shape-classify.test.js  -  unit tests for the S-DIAGRAM-PREF step-0
 * shape classifier (music/shared/shape-classify.js).
 * Run: node test/shape-classify.test.js   (no deps; pure Node assert)
 *
 * Coverage note on inversions: guitar-standard's cowboy/barre CAGED shapes
 * (the C/A/G/E/D 'family' buckets) are root-position BY CONSTRUCTION - the
 * templates always anchor the root on the lowest-sounding (leftmost non-
 * muted) string, and barring a shape shifts every string by the same
 * constant, which can never change their relative pitch order. Every one
 * of the 26 real CAGED guitar voicings tested below is therefore,
 * correctly, "root position" - verified against every entry in profiles/
 * guitar-standard.js (see the exhaustive sweep this suite runs at the
 * bottom). Ukulele's re-entrant GCEA tuning is where every inversion
 * actually occurs for REAL CAGED-family named chords (root/1st/2nd/3rd are
 * all asserted below) - see bassInfo()'s header comment in shape-classify.js
 * for why leftmost-string != lowest-pitch there.
 *
 * S-DIM-SHAPES (U21) exception to the guitar root-position-by-construction
 * note above: the dim7-shape family is a fully-symmetric chord (see shape-
 * classify.js's dim comment) - moving the SAME barred voicing does NOT
 * preserve which chord tone lands in the bass across the enharmonic root
 * names sharing one fret group, so guitar's dim7-shape entries legitimately
 * hit all 4 inversions too, unlike its CAGED-family entries.
 * ===================================================================== */
'use strict';
var assert = require('assert');
var SC = require('../music/shared/shape-classify.js');
var GP = require('../music/shared/profiles/guitar-standard.js').MusicProfiles['guitar-standard'];
var UP = require('../music/shared/profiles/ukulele-gcea.js').MusicProfiles['ukulele-gcea'];

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

function classifyG(name) { return SC.classify('guitar-standard', name, GP.chords[name]); }
function classifyU(name) { return SC.classify('ukulele-gcea', name, UP.chords[name]); }
function assertInfo(info, family, rootString, inversion, barreFret, label) {
  assert.ok(info, 'expected a classification, got null');
  assert.strictEqual(info.family, family, 'family');
  assert.strictEqual(info.rootString, rootString, 'rootString');
  assert.strictEqual(info.inversion, inversion, 'inversion');
  assert.strictEqual(info.barreFret, barreFret, 'barreFret');
  if (label != null) assert.strictEqual(SC.label(info), label, 'label');
}

/* ============================ guitar-standard ============================ */

/* ---- open-position families: C, A, G, E, D ---- */
test('guitar: open C, root on 5, root position', function () {
  assertInfo(classifyG('C'), 'C', 5, 'root position', 0, 'open C shape, root on 5, root position');
});
test('guitar: open A, root on 5, root position', function () {
  assertInfo(classifyG('A'), 'A', 5, 'root position', 0, 'open A shape, root on 5, root position');
});
test('guitar: open G, root on 6, root position', function () {
  assertInfo(classifyG('G'), 'G', 6, 'root position', 0, 'open G shape, root on 6, root position');
});
test('guitar: open E, root on 6, root position', function () {
  assertInfo(classifyG('E'), 'E', 6, 'root position', 0, 'open E shape, root on 6, root position');
});
test('guitar: open D, root on 4, root position', function () {
  assertInfo(classifyG('D'), 'D', 4, 'root position', 0, 'open D shape, root on 4, root position');
});

/* ---- minor variants of the open shapes ---- */
test('guitar: Dm stays family D (minor variant of the open D shape)', function () {
  assertInfo(classifyG('Dm'), 'D', 4, 'root position', 0, null);
});
test('guitar: Em stays family E', function () {
  assertInfo(classifyG('Em'), 'E', 6, 'root position', 0, null);
});
test('guitar: Am stays family A', function () {
  assertInfo(classifyG('Am'), 'A', 5, 'root position', 0, null);
});

/* ---- 7th / maj7 variants of the open shapes ---- */
test('guitar: C7 stays family C', function () {
  assertInfo(classifyG('C7'), 'C', 5, 'root position', 0, null);
});
test('guitar: G7 stays family G', function () {
  assertInfo(classifyG('G7'), 'G', 6, 'root position', 0, null);
});
test('guitar: Cmaj7 stays family C', function () {
  assertInfo(classifyG('Cmaj7'), 'C', 5, 'root position', 0, null);
});
test('guitar: Amaj7 stays family A', function () {
  assertInfo(classifyG('Amaj7'), 'A', 5, 'root position', 0, null);
});
test('guitar: Dmaj7 stays family D', function () {
  assertInfo(classifyG('Dmaj7'), 'D', 4, 'root position', 0, null);
});
test('guitar: Gmaj7 stays family G', function () {
  assertInfo(classifyG('Gmaj7'), 'G', 6, 'root position', 0, null);
});
test('guitar: Emaj7 stays family E', function () {
  assertInfo(classifyG('Emaj7'), 'E', 6, 'root position', 0, null);
});

/* ---- barre-E at multiple frets (movable-template-aware: F/Fm/F#/F#m/Ab/G#m
   all classify as the E-shape barred, never a new family per root) ---- */
test('guitar: F = barre-E at fret 1 (movable-template-aware, not its own "F" family)', function () {
  assertInfo(classifyG('F'), 'barre-E', 6, 'root position', 1, 'E-shape barre, root on 6, root position');
});
test('guitar: Fm = barre-E (minor) at fret 1', function () {
  assertInfo(classifyG('Fm'), 'barre-E', 6, 'root position', 1, null);
});
test('guitar: F# = barre-E at fret 2', function () {
  assertInfo(classifyG('F#'), 'barre-E', 6, 'root position', 2, null);
});
test('guitar: F#m = barre-E (minor) at fret 2', function () {
  assertInfo(classifyG('F#m'), 'barre-E', 6, 'root position', 2, null);
});
test('guitar: Gm = barre-E (minor) at fret 3', function () {
  assertInfo(classifyG('Gm'), 'barre-E', 6, 'root position', 3, null);
});
test('guitar: Ab = barre-E at fret 4', function () {
  assertInfo(classifyG('Ab'), 'barre-E', 6, 'root position', 4, null);
});

/* ---- barre-A at multiple frets (B/Bm/Cm/Bb/Db/Eb/Bmaj7/Cm7) ---- */
test('guitar: B = barre-A at fret 2', function () {
  assertInfo(classifyG('B'), 'barre-A', 5, 'root position', 2, 'A-shape barre, root on 5, root position');
});
test('guitar: Bb = barre-A at fret 1', function () {
  assertInfo(classifyG('Bb'), 'barre-A', 5, 'root position', 1, null);
});
test('guitar: Cm = barre-A (minor) at fret 3', function () {
  assertInfo(classifyG('Cm'), 'barre-A', 5, 'root position', 3, null);
});
test('guitar: Bm = barre-A (minor) at fret 2', function () {
  assertInfo(classifyG('Bm'), 'barre-A', 5, 'root position', 2, null);
});
test('guitar: Db = barre-A at fret 4', function () {
  assertInfo(classifyG('Db'), 'barre-A', 5, 'root position', 4, null);
});
test('guitar: Eb = barre-A at fret 6', function () {
  assertInfo(classifyG('Eb'), 'barre-A', 5, 'root position', 6, null);
});

/* ---- honest nulls: real cowboy fingerings that are not curated barre/open
   shapes (B7, Fmaj7, Bm7 all use a mute/finger pattern distinct from every
   template above) - never guess ---- */
test('guitar: B7 does not match any curated template - null, not a guess', function () {
  assert.strictEqual(classifyG('B7'), null);
});
test('guitar: Fmaj7 (partial voicing, string muted) - null', function () {
  assert.strictEqual(classifyG('Fmaj7'), null);
});
test('guitar: Bm7 (open-position, not a barre) - null', function () {
  assert.strictEqual(classifyG('Bm7'), null);
});
/* ---- S-DIM-SHAPES (U21): dim/dim7/aug are now curated - see shape-
   classify.js's GUITAR table comments for the voicings + the symmetric-
   chord inversion convention (inversion is always relative to the asked-
   about chord NAME's root, never a claim about which note is "the" root
   of a symmetric chord). ---- */
test('guitar: Cdim = dim7-shape barre at fret 2, root position', function () {
  assertInfo(classifyG('Cdim'), 'dim7-shape', 5, 'root position', 2, 'dim7-shape barre, root on 5, root position');
});
test('guitar: Adim = SAME physical shape as Cdim (identical fret array), but 1st inversion relative to A', function () {
  assertInfo(classifyG('Adim'), 'dim7-shape', 5, '1st inversion', 2, null);
});
test('guitar: F#dim = SAME physical shape as Cdim, 2nd inversion relative to F#', function () {
  assertInfo(classifyG('F#dim'), 'dim7-shape', 5, '2nd inversion', 2, null);
});
test('guitar: D#dim = SAME physical shape as Cdim, 3rd inversion relative to D# (the diminished 7th degree, needs the 4-tone dim7 tone set - see chordTonePcs)', function () {
  assertInfo(classifyG('D#dim'), 'dim7-shape', 5, '3rd inversion', 2, null);
});
test('guitar: Bdim (U21 - the operator-reported card) = dim7-shape barre at fret 4, 1st inversion', function () {
  assertInfo(classifyG('Bdim'), 'dim7-shape', 5, '1st inversion', 4, 'dim7-shape barre, root on 5, 1st inversion');
});

/* ---- dim7 suffix (defensive - no profile chord is literally named "Xdim7"
   today; curated from the identical physical voicing as the 'dim' bucket,
   see shape-classify.js's dim7 comment). Tested via direct classify()
   calls against the real curated fret arrays, mirroring the module's own
   documented synthetic-template testing precedent (see the ukulele
   "C-shape index-bar" test below). ---- */
test('guitar: Cdim7 (synthetic suffix, real Cdim fret array) = dim7-shape barre, root position', function () {
  assertInfo(SC.classify('guitar-standard', 'Cdim7', GP.chords.Cdim), 'dim7-shape', 5, 'root position', 2, 'dim7-shape barre, root on 5, root position');
});
test('guitar: Bdim7 (synthetic suffix, real Bdim fret array) = dim7-shape barre, 1st inversion', function () {
  assertInfo(SC.classify('guitar-standard', 'Bdim7', GP.chords.Bdim), 'dim7-shape', 5, '1st inversion', 4, 'dim7-shape barre, root on 5, 1st inversion');
});

/* ---- aug (defensive - Circle.diatonic() never emits an augmented triad
   for any of the app's 7 supported modes, so no profile chord is named
   "Xaug" either; curated for Compose free-text / future modes). Standard
   open Caug voicing (C-shape, sharp-5) tested at root position and
   transposed (barre) positions. ---- */
test('guitar: Caug = open C shape (sharp-5), root position', function () {
  var info = SC.classify('guitar-standard', 'Caug', [-1, 3, 2, 1, 1, 0]);
  assertInfo(info, 'C', 5, 'root position', 0, 'open C shape, root on 5, root position');
});
test('guitar: Eaug = same shape barred at fret 4 (barre-C), root position', function () {
  var info = SC.classify('guitar-standard', 'Eaug', [-1, 7, 6, 5, 5, 4]);
  assertInfo(info, 'barre-C', 5, 'root position', 4, 'C-shape barre, root on 5, root position');
});
test('guitar: F#aug = same shape barred at fret 6 (barre-C), root position', function () {
  var info = SC.classify('guitar-standard', 'F#aug', [-1, 9, 8, 7, 7, 6]);
  assertInfo(info, 'barre-C', 5, 'root position', 6, null);
});

/* ---- exhaustive sweep: every entry in guitar-standard.js is either a
   correctly-classified root-position voicing, a correctly-classified dim7-
   shape voicing (any of the 4 inversions - symmetric chord, see above), or
   an explicitly-known null ---- */
test('guitar: exhaustive sweep over every profile chord - no surprise nulls, every non-dim hit is root position, every dim hit is dim7-shape', function () {
  var knownNulls = { B7: 1, Fmaj7: 1, Bm7: 1 };
  var validInversions = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
  Object.keys(GP.chords).forEach(function (name) {
    var info = classifyG(name);
    if (/dim/i.test(name)) {
      assert.ok(info, name + ' (dim) should classify (unexpected null)');
      assert.strictEqual(info.family, 'dim7-shape', name + ' should be family dim7-shape');
      assert.ok(validInversions.indexOf(info.inversion) !== -1, name + ' should have a valid inversion label');
      assert.ok([2, 3, 4].indexOf(info.barreFret) !== -1, name + ' should barre at fret 2, 3, or 4');
      return;
    }
    if (knownNulls[name]) { assert.strictEqual(info, null, name + ' should be the known null'); return; }
    assert.ok(info, name + ' should classify (unexpected null)');
    assert.strictEqual(info.inversion, 'root position', name + ' should be root position');
  });
});

/* ============================ ukulele-gcea ============================ */

/* ---- open-position families, all four inversions occurring for REAL
   named chords (re-entrant GCEA tuning) ---- */
test('ukulele: open C - root position (root C on the C string, string 3)', function () {
  assertInfo(classifyU('C'), 'C', 3, 'root position', 0, 'open C shape, root on 3, root position');
});
test('ukulele: open D - root position', function () {
  assertInfo(classifyU('D'), 'D', 3, 'root position', 0, null);
});
test('ukulele: open F - 2nd inversion (fifth in the bass, re-entrant tuning)', function () {
  assertInfo(classifyU('F'), 'F', 3, '2nd inversion', 0, 'open F shape, root on 3, 2nd inversion');
});
test('ukulele: open G - 2nd inversion', function () {
  assertInfo(classifyU('G'), 'G', 3, '2nd inversion', 0, null);
});
test('ukulele: open A - 1st inversion (third in the bass)', function () {
  assertInfo(classifyU('A'), 'A', 3, '1st inversion', 0, 'open A shape, root on 3, 1st inversion');
});
test('ukulele: open E7 - 3rd inversion (the flat-7th in the bass)', function () {
  assertInfo(classifyU('E7'), 'E', 3, '3rd inversion', 0, 'open E shape, root on 3, 3rd inversion');
});

/* ---- movable-template-aware: a named chord classifies as its shape's
   OPEN ancestor, never a new family per root (E = barre-D+2, D7/Dmaj7 =
   barre-C+2, F/F7/Fmaj7/Fm7 = barre-E+1, B-family = barre-A+2) ---- */
test('ukulele: E major = barre-D at fret 2 (same finger shape as open D, not its own "E" family)', function () {
  assertInfo(classifyU('E'), 'barre-D', 3, 'root position', 2, 'D-shape barre, root on 3, root position');
});
test('ukulele: D7 = barre-C at fret 2', function () {
  assertInfo(classifyU('D7'), 'barre-C', 3, 'root position', 2, null);
});
test('ukulele: Dmaj7 = barre-C at fret 2', function () {
  assertInfo(classifyU('Dmaj7'), 'barre-C', 3, 'root position', 2, null);
});
test('ukulele: F7 = barre-E at fret 1', function () {
  assertInfo(classifyU('F7'), 'barre-E', 3, '3rd inversion', 1, null);
});
test('ukulele: B = barre-A at fret 2', function () {
  assertInfo(classifyU('B'), 'barre-A', 3, '1st inversion', 2, null);
});
test('ukulele: Cm7 = barre-A at fret 3 (three roots deep on the Am7 shape)', function () {
  assertInfo(classifyU('Cm7'), 'barre-A', 3, '1st inversion', 3, null);
});

/* ---- Dm7 is its OWN closed shape (no true open ancestor in the table) ---- */
test('ukulele: Dm7 is a closed shape at its own fret 1 (family D, not open)', function () {
  assertInfo(classifyU('Dm7'), 'barre-D', 3, 'root position', 1, null);
});

/* ---- synthetic movable-only templates: reachable via a DERIVED voicing for
   a root absent from the named-chord table (mirrors play/index.html's
   augmentTriadShapes movable fallback), never via the table itself ---- */
test('ukulele: C# major via the synthetic "C-shape index-bar" template (derived voicing, root not in the table)', function () {
  var info = SC.classify('ukulele-gcea', 'C#', [1, 1, 1, -1]);
  assertInfo(info, 'C-shape', 3, 'root position', 1, 'C-shape barre, root on 3, root position');
});
test('ukulele: G#m via the same finger shape as open Dm, barred (play/index.html\'s "Em-shape" injection is really barre-D)', function () {
  var info = SC.classify('ukulele-gcea', 'G#m', [8, 8, 7, 6]);
  assertInfo(info, 'barre-D', 3, 'root position', 6, null);
});

/* ---- S-DIM-SHAPES (U21): dim/dim7/aug are now curated - see shape-
   classify.js's UKULELE table comments. Same symmetric-chord inversion
   convention as guitar (see above). ---- */
test('ukulele: Cdim = dim7-shape barre at fret 2, 1st inversion', function () {
  assertInfo(classifyU('Cdim'), 'dim7-shape', 3, '1st inversion', 2, 'dim7-shape barre, root on 3, 1st inversion');
});
test('ukulele: Bdim (U21 - the operator-reported card) = dim7-shape barre at fret 4, 2nd inversion', function () {
  assertInfo(classifyU('Bdim'), 'dim7-shape', 3, '2nd inversion', 4, 'dim7-shape barre, root on 3, 2nd inversion');
});
test('ukulele: F#dim = SAME physical shape as Cdim, 3rd inversion relative to F# (the diminished 7th degree)', function () {
  assertInfo(classifyU('F#dim'), 'dim7-shape', 3, '3rd inversion', 2, null);
});
test('ukulele: Edim = dim7-shape barre at fret 3 (F2 fret group), root position relative to E', function () {
  assertInfo(classifyU('Edim'), 'dim7-shape', 3, 'root position', 3, null);
});

/* ---- dim7 suffix (defensive - no profile chord is literally named
   "Xdim7" today; same physical voicing as the 'dim' bucket) ---- */
test('ukulele: Cdim7 (synthetic suffix, real Cdim fret array) = dim7-shape barre, 1st inversion', function () {
  assertInfo(SC.classify('ukulele-gcea', 'Cdim7', UP.chords.Cdim), 'dim7-shape', 3, '1st inversion', 2, 'dim7-shape barre, root on 3, 1st inversion');
});
test('ukulele: Bdim7 (synthetic suffix, real Bdim fret array) = dim7-shape barre, 2nd inversion', function () {
  assertInfo(SC.classify('ukulele-gcea', 'Bdim7', UP.chords.Bdim), 'dim7-shape', 3, '2nd inversion', 4, 'dim7-shape barre, root on 3, 2nd inversion');
});

/* ---- aug (defensive - see guitar's aug comment; no live chords-in-key
   anchor). Standard open Caug (C-shape, sharp-5), root position and
   transposed (barre). ---- */
test('ukulele: Caug = open C shape (sharp-5), root position', function () {
  var info = SC.classify('ukulele-gcea', 'Caug', [1, 0, 0, 3]);
  assertInfo(info, 'C', 3, 'root position', 0, 'open C shape, root on 3, root position');
});
test('ukulele: Eaug = same shape barred at fret 4 (barre-C), root position', function () {
  var info = SC.classify('ukulele-gcea', 'Eaug', [5, 4, 4, 7]);
  assertInfo(info, 'barre-C', 3, 'root position', 4, 'C-shape barre, root on 3, root position');
});
test('ukulele: F#aug = same shape barred at fret 6 (barre-C), root position', function () {
  var info = SC.classify('ukulele-gcea', 'F#aug', [7, 6, 6, 9]);
  assertInfo(info, 'barre-C', 3, 'root position', 6, null);
});

/* ---- exhaustive sweep: every entry in ukulele-gcea.js classifies, dim
   entries as dim7-shape (any of the 4 inversions - symmetric chord) ---- */
test('ukulele: exhaustive sweep over every profile chord - every entry classifies, every dim hit is dim7-shape', function () {
  var validInversions = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
  Object.keys(UP.chords).forEach(function (name) {
    var info = classifyU(name);
    if (/dim/i.test(name)) {
      assert.ok(info, name + ' (dim) should classify (unexpected null)');
      assert.strictEqual(info.family, 'dim7-shape', name + ' should be family dim7-shape');
      assert.ok(validInversions.indexOf(info.inversion) !== -1, name + ' should have a valid inversion label');
      assert.ok([2, 3, 4].indexOf(info.barreFret) !== -1, name + ' should barre at fret 2, 3, or 4');
      return;
    }
    assert.ok(info, name + ' should classify (unexpected null)');
  });
});

/* ============================ families() ============================ */

test('families(guitar-standard) includes every CAGED-adjacent family actually produced, plus dim7-shape (S-DIM-SHAPES)', function () {
  var fams = SC.families('guitar-standard');
  ['C', 'A', 'G', 'E', 'D', 'barre-E', 'barre-A', 'dim7-shape'].forEach(function (f) {
    assert.ok(fams.indexOf(f) !== -1, 'missing family ' + f + ' in ' + JSON.stringify(fams));
  });
  assert.strictEqual(fams.length, 8, 'guitar-standard should have exactly 8 families: ' + JSON.stringify(fams));
});
test('families(ukulele-gcea) includes every family actually produced by the named-chord table, plus dim7-shape (S-DIM-SHAPES)', function () {
  var fams = SC.families('ukulele-gcea');
  ['C', 'D', 'barre-D', 'F', 'G', 'A', 'barre-A', 'E', 'barre-C', 'barre-E', 'dim7-shape'].forEach(function (f) {
    assert.ok(fams.indexOf(f) !== -1, 'missing family ' + f + ' in ' + JSON.stringify(fams));
  });
  // C-shape/F-shape are synthetic-only (see the module header) - never
  // produced by classifying the table's own named chords. The new 'aug'
  // bucket's family is 'C' (reused, not a synthetic "*-shape" name) but
  // never surfaces here either since no "Xaug" chord exists in the table.
  assert.strictEqual(fams.indexOf('C-shape'), -1);
  assert.strictEqual(fams.indexOf('F-shape'), -1);
  assert.strictEqual(fams.length, 11, 'ukulele-gcea should have exactly 11 families: ' + JSON.stringify(fams));
});
test('families() on an unsupported profile returns an empty array, not null', function () {
  assert.deepStrictEqual(SC.families('banjo-gdgbd'), []);
  assert.deepStrictEqual(SC.families('cigarbox-dgbd'), []);
  assert.deepStrictEqual(SC.families('mandolin-gdae'), []);
  assert.deepStrictEqual(SC.families('mandola-cgda'), []);
});

/* ============================ label() ============================ */

test('label() is ASCII-only for a barre shape', function () {
  var s = SC.label(classifyG('F'));
  assert.strictEqual(s, 'E-shape barre, root on 6, root position');
  assert.ok(/^[\x00-\x7F]*$/.test(s), 'label must be ASCII-only: ' + s);
});
test('label() is ASCII-only for an open shape', function () {
  var s = SC.label(classifyG('C'));
  assert.strictEqual(s, 'open C shape, root on 5, root position');
  assert.ok(/^[\x00-\x7F]*$/.test(s), 'label must be ASCII-only: ' + s);
});
test('label() is ASCII-only for a synthetic movable-only shape', function () {
  var s = SC.label(SC.classify('ukulele-gcea', 'C#', [1, 1, 1, -1]));
  assert.strictEqual(s, 'C-shape barre, root on 3, root position');
  assert.ok(/^[\x00-\x7F]*$/.test(s), 'label must be ASCII-only: ' + s);
});
test('label() is ASCII-only for the dim7-shape family (S-DIM-SHAPES, U21 - the operator-reported Bdim card)', function () {
  var s = SC.label(classifyU('Bdim'));
  assert.strictEqual(s, 'dim7-shape barre, root on 3, 2nd inversion');
  assert.ok(/^[\x00-\x7F]*$/.test(s), 'label must be ASCII-only: ' + s);
});
test('label() is ASCII-only for the aug C-shape family (S-DIM-SHAPES)', function () {
  var s = SC.label(SC.classify('guitar-standard', 'Caug', [-1, 3, 2, 1, 1, 0]));
  assert.strictEqual(s, 'open C shape, root on 5, root position');
  assert.ok(/^[\x00-\x7F]*$/.test(s), 'label must be ASCII-only: ' + s);
});
test('label(null) returns an empty string, never throws', function () {
  assert.strictEqual(SC.label(null), '');
});

/* ============================ unknown / junk input -> null ============================ */

test('classify() on an unsupported profile returns null', function () {
  assert.strictEqual(SC.classify('banjo-gdgbd', 'C', [0, 0, 0, 0, 0]), null);
  assert.strictEqual(SC.classify('cigarbox-dgbd', 'C', [0, 0, 0]), null);
  assert.strictEqual(SC.classify('mandolin-gdae', 'G', [0, 0, 0, 0]), null);
  assert.strictEqual(SC.classify('mandola-cgda', 'C', [0, 0, 0, 0]), null);
  assert.strictEqual(SC.classify('guitar-dropd', 'D', [0, 0, 0, 0, 0, 0]), null);
});
test('classify() on a real Cdim voicing from an out-of-scope profile still returns null (S-DIM-SHAPES did not widen scope beyond guitar-standard/ukulele-gcea)', function () {
  assert.strictEqual(SC.classify('banjo-gdgbd', 'Cdim', [-1, 1, 2, 1, 4]), null);
  assert.strictEqual(SC.classify('cigarbox-dgbd', 'Cdim', [1, 2, 1, 4]), null);
  assert.strictEqual(SC.classify('mandolin-gdae', 'Cdim', [2, 1, 3, 2]), null);
  assert.strictEqual(SC.classify('mandola-cgda', 'Cdim', [3, 2, 4, 3]), null);
});
test('classify() on frets that match no curated template returns null (never guesses)', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'C', [9, 9, 9, 9, 9, 9]), null);
  assert.strictEqual(SC.classify('ukulele-gcea', 'C', [11, 11, 11, 11]), null);
});
test('classify() on a malformed chord name returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'Z9', [0, 2, 2, 1, 0, 0]), null);
  assert.strictEqual(SC.classify('guitar-standard', '', [0, 2, 2, 1, 0, 0]), null);
  assert.strictEqual(SC.classify('guitar-standard', null, [0, 2, 2, 1, 0, 0]), null);
});
test('classify() on a wrong-length frets array returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'C', [0, 0, 0]), null);
});
test('classify() on a fully-muted frets array returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'C', [-1, -1, -1, -1, -1, -1]), null);
});
test('classify() on null/non-array frets returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'C', null), null);
  assert.strictEqual(SC.classify('guitar-standard', 'C', undefined), null);
  assert.strictEqual(SC.classify('guitar-standard', 'C', []), null);
});
test('classify() on an unquantifiable quality suffix (sus4 - still uncurated) returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'Csus4', [-1, 3, 3, 0, 1, 0]), null);
});
test('classify() on a curated aug voicing with an unrelated fret shape (not the curated pattern) returns null - never guesses', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'Caug', [-1, 3, 3, 0, 1, 0]), null);
});

run();
