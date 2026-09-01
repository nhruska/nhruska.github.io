/* =====================================================================
 * jam-queries.test.js  -  unit tests for the M-TRACKLIB wave 1 key-aware
 * jam-discovery matrix (music/shared/jam-queries.js).
 * Run: node test/jam-queries.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var JamQueries = require('../music/shared/jam-queries.js');
var SoloGuide = require('../music/shared/solo-guide.js');

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

/* ---------------------------------------------------------------------
 * Scale vocabulary parity: the same 7 scale keys the Studio's Guide card
 * (solo-guide.js) already teaches - never a silent drift between the two.
 * ------------------------------------------------------------------- */
test('JamQueries.SCALE_IDS matches SoloGuide.cards keys exactly (same 7-scale vocabulary)', function () {
  var jamIds = JamQueries.SCALE_IDS.slice().sort();
  var guideIds = Object.keys(SoloGuide.cards).sort();
  assert.deepStrictEqual(jamIds, guideIds);
});

/* ---------------------------------------------------------------------
 * genresFor - every scale the app teaches carries >= 3 curated genres.
 * ------------------------------------------------------------------- */
JamQueries.SCALE_IDS.forEach(function (scaleId) {
  test('genresFor("' + scaleId + '") returns >= 3 genres, all non-empty strings', function () {
    var g = JamQueries.genresFor(scaleId);
    assert.ok(Array.isArray(g), 'expected an array for ' + scaleId);
    assert.ok(g.length >= 3, 'expected >= 3 genres for ' + scaleId + ', got ' + g.length);
    g.forEach(function (s) { assert.ok(typeof s === 'string' && s.trim().length > 0, 'empty/non-string genre in ' + scaleId); });
  });
});
test('genresFor returns a fresh copy each call (caller cannot mutate the shared table)', function () {
  var a = JamQueries.genresFor('dorian');
  a.push('MUTATED');
  var b = JamQueries.genresFor('dorian');
  assert.ok(b.indexOf('MUTATED') === -1);
});
test('genresFor: unknown scaleId returns [] (safe-empty, matches the theory-engine contract)', function () {
  assert.deepStrictEqual(JamQueries.genresFor('nonexistent'), []);
});

/* ---------------------------------------------------------------------
 * feels - stable 3-band tempo scale.
 * ------------------------------------------------------------------- */
test('feels() returns exactly 3 bands: slow, mid, up, each with a label + bpm range', function () {
  var f = JamQueries.feels();
  assert.strictEqual(f.length, 3);
  assert.deepStrictEqual(f.map(function (x) { return x.id; }), ['slow', 'mid', 'up']);
  f.forEach(function (band) {
    assert.ok(band.label && typeof band.label === 'string');
    assert.ok(band.bpm && typeof band.bpm === 'string');
  });
});
test('feels() returns a fresh copy each call', function () {
  var a = JamQueries.feels();
  a[0].label = 'MUTATED';
  var b = JamQueries.feels();
  assert.notStrictEqual(b[0].label, 'MUTATED');
});

/* ---------------------------------------------------------------------
 * jamQuery - the pure generator. Every (scale x genre x feel) combo across
 * every key the app teaches yields a non-empty, ASCII, key-containing query.
 * ------------------------------------------------------------------- */
var KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var FEEL_IDS = ['slow', 'mid', 'up'];

test('jamQuery: the spec worked example matches exactly - jamQuery("A","dorian","funk","slow")', function () {
  assert.strictEqual(JamQueries.jamQuery('A', 'dorian', 'funk', 'slow'), 'A dorian funk backing track slow');
});

KEYS.forEach(function (key) {
  JamQueries.SCALE_IDS.forEach(function (scaleId) {
    JamQueries.genresFor(scaleId).forEach(function (genre) {
      FEEL_IDS.forEach(function (feelId) {
        test('jamQuery(' + key + ',' + scaleId + ',' + genre + ',' + feelId + '): non-empty, ASCII, contains the key token', function () {
          var q = JamQueries.jamQuery(key, scaleId, genre, feelId);
          assert.ok(typeof q === 'string' && q.length > 0, 'expected a non-empty string');
          assert.ok(/^[\x00-\x7F]*$/.test(q), 'query must be pure ASCII, got: ' + q);
          assert.ok(q.indexOf(key) === 0, 'query must start with the key token, got: ' + q);
          assert.ok(q.indexOf('backing track') >= 0, 'query must mention "backing track", got: ' + q);
          assert.ok(q.indexOf(genre) >= 0, 'query must include the genre, got: ' + q);
        });
      });
    });
  });
});

test('jamQuery: missing genre is simply omitted, never renders "undefined"/"null"', function () {
  var q = JamQueries.jamQuery('A', 'dorian', '', 'slow');
  assert.strictEqual(q, 'A dorian backing track slow');
  assert.ok(q.indexOf('undefined') === -1 && q.indexOf('null') === -1);
});
test('jamQuery: unknown scaleId omits the scale word but keeps key/genre/feel', function () {
  var q = JamQueries.jamQuery('A', 'nonexistent', 'funk', 'slow');
  assert.strictEqual(q, 'A funk backing track slow');
});
test('jamQuery: unknown feelId omits the feel word', function () {
  var q = JamQueries.jamQuery('A', 'dorian', 'funk', 'nonexistent');
  assert.strictEqual(q, 'A dorian funk backing track');
});
test('jamQuery: all args missing still returns the bare "backing track" phrase, never throws', function () {
  assert.strictEqual(JamQueries.jamQuery(), 'backing track');
});
test('jamQuery: blues scale word is omitted when the genre already spells it out (no "blues ... blues" duplication)', function () {
  var q = JamQueries.jamQuery('A', 'blues', 'slow blues', 'slow');
  assert.strictEqual(q, 'A slow blues backing track slow');
  assert.ok(q.indexOf('blues slow blues') === -1);
});
test('jamQuery: every blues genre entry contains "blues" (the scale-word-omission rule fires for all of them)', function () {
  JamQueries.genresFor('blues').forEach(function (g) {
    assert.ok(g.toLowerCase().indexOf('blues') >= 0, '"' + g + '" was expected to contain "blues"');
  });
});

/* ---------------------------------------------------------------------
 * M-JAM-MULTI (2026-09-01): new genres (operator directive) + multi-select
 * jamQuery array support.
 * ------------------------------------------------------------------- */
test('genresFor("pentMinor") contains all four operator-directed genres: jazz, smooth jazz, funk, disco', function () {
  var g = JamQueries.genresFor('pentMinor');
  ['jazz', 'smooth jazz', 'funk', 'disco'].forEach(function (want) {
    assert.ok(g.indexOf(want) >= 0, 'expected pentMinor to include "' + want + '", got ' + JSON.stringify(g));
  });
});
test('genresFor: no scale list exceeds 12 entries', function () {
  JamQueries.SCALE_IDS.forEach(function (scaleId) {
    var g = JamQueries.genresFor(scaleId);
    assert.ok(g.length <= 12, scaleId + ' has ' + g.length + ' genres, expected <= 12');
  });
});
test('genresFor: no scale list contains a duplicate genre string', function () {
  JamQueries.SCALE_IDS.forEach(function (scaleId) {
    var g = JamQueries.genresFor(scaleId);
    var unique = g.filter(function (v, i) { return g.indexOf(v) === i; });
    assert.deepStrictEqual(unique, g, scaleId + ' has a duplicate genre entry: ' + JSON.stringify(g));
  });
});
test('jamQuery: a plain string genre behaves exactly as before (back-compat lock)', function () {
  assert.strictEqual(JamQueries.jamQuery('A', 'dorian', 'funk', 'slow'), 'A dorian funk backing track slow');
});
test('jamQuery: an array genre joins with single spaces, in selection order, into the search phrase', function () {
  var q = JamQueries.jamQuery('A', 'pentMinor', ['smooth jazz', 'funk'], 'mid');
  assert.strictEqual(q, 'A minor pentatonic smooth jazz funk backing track mid');
});
test('jamQuery: a single-element array is byte-identical to the equivalent plain string call', function () {
  var arr = JamQueries.jamQuery('A', 'dorian', ['funk'], 'slow');
  var str = JamQueries.jamQuery('A', 'dorian', 'funk', 'slow');
  assert.strictEqual(arr, str);
});
test('jamQuery: an empty array behaves like an empty/missing genre (omitted, never "undefined")', function () {
  var q = JamQueries.jamQuery('A', 'dorian', [], 'slow');
  assert.strictEqual(q, 'A dorian backing track slow');
});
test('jamQuery: array-genre order is preserved (not sorted/reordered)', function () {
  var q1 = JamQueries.jamQuery('A', 'pentMinor', ['disco', 'jazz'], 'up');
  var q2 = JamQueries.jamQuery('A', 'pentMinor', ['jazz', 'disco'], 'up');
  assert.ok(q1.indexOf('disco jazz') >= 0, 'expected "disco jazz" order, got: ' + q1);
  assert.ok(q2.indexOf('jazz disco') >= 0, 'expected "jazz disco" order, got: ' + q2);
});

run();
