/* =====================================================================
 * shape-classify.test.js  -  unit tests for the S-DIAGRAM-PREF step-0
 * shape classifier (music/shared/shape-classify.js).
 * Run: node test/shape-classify.test.js   (no deps; pure Node assert)
 *
 * Coverage note on inversions: guitar-standard's cowboy/barre CAGED shapes
 * are root-position BY CONSTRUCTION - the E/A/C/G/D templates always anchor
 * the root on the lowest-sounding (leftmost non-muted) string, and barring
 * a shape shifts every string by the same constant, which can never change
 * their relative pitch order. Every one of the 26 real guitar voicings
 * tested below is therefore, correctly, "root position" - verified against
 * every entry in profiles/guitar-standard.js (see the exhaustive sweep this
 * suite runs at the bottom). Ukulele's re-entrant GCEA tuning is where
 * every inversion actually occurs for REAL named chords (root/1st/2nd/3rd
 * are all asserted below) - see bassInfo()'s header comment in
 * shape-classify.js for why leftmost-string != lowest-pitch there.
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
test('guitar: dim7 shapes are not a CAGED family - null (Cdim)', function () {
  assert.strictEqual(classifyG('Cdim'), null);
});

/* ---- exhaustive sweep: every entry in guitar-standard.js is either a
   correctly-classified root-position voicing or an explicitly-known null ---- */
test('guitar: exhaustive sweep over every profile chord - no surprise nulls, every hit is root position', function () {
  var knownNulls = { B7: 1, Fmaj7: 1, Bm7: 1 };
  Object.keys(GP.chords).forEach(function (name) {
    var info = classifyG(name);
    if (/dim/i.test(name)) { assert.strictEqual(info, null, name + ' (dim) should be null'); return; }
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

/* ---- honest null: dim7 (symmetric, not a CAGED-adjacent family here) ---- */
test('ukulele: dim7 shapes are not classified - null (Cdim)', function () {
  assert.strictEqual(classifyU('Cdim'), null);
});

/* ---- exhaustive sweep: every non-dim entry in ukulele-gcea.js classifies ---- */
test('ukulele: exhaustive sweep over every profile chord - every non-dim entry classifies', function () {
  Object.keys(UP.chords).forEach(function (name) {
    var info = classifyU(name);
    if (/dim/i.test(name)) { assert.strictEqual(info, null, name + ' (dim) should be null'); return; }
    assert.ok(info, name + ' should classify (unexpected null)');
  });
});

/* ============================ families() ============================ */

test('families(guitar-standard) includes every CAGED-adjacent family actually produced', function () {
  var fams = SC.families('guitar-standard');
  ['C', 'A', 'G', 'E', 'D', 'barre-E', 'barre-A'].forEach(function (f) {
    assert.ok(fams.indexOf(f) !== -1, 'missing family ' + f + ' in ' + JSON.stringify(fams));
  });
  assert.strictEqual(fams.length, 7, 'guitar-standard should have exactly 7 families: ' + JSON.stringify(fams));
});
test('families(ukulele-gcea) includes every family actually produced by the named-chord table', function () {
  var fams = SC.families('ukulele-gcea');
  ['C', 'D', 'barre-D', 'F', 'G', 'A', 'barre-A', 'E', 'barre-C', 'barre-E'].forEach(function (f) {
    assert.ok(fams.indexOf(f) !== -1, 'missing family ' + f + ' in ' + JSON.stringify(fams));
  });
  // C-shape/F-shape are synthetic-only (see the module header) - never
  // produced by classifying the table's own named chords.
  assert.strictEqual(fams.indexOf('C-shape'), -1);
  assert.strictEqual(fams.indexOf('F-shape'), -1);
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
test('classify() on an unquantifiable quality suffix (sus4/dim/aug) returns null', function () {
  assert.strictEqual(SC.classify('guitar-standard', 'Csus4', [-1, 3, 3, 0, 1, 0]), null);
  assert.strictEqual(SC.classify('guitar-standard', 'Caug', [-1, 3, 2, 1, 1, 0]), null);
});

run();
