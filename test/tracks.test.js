/* =====================================================================
 * tracks.test.js  -  unit tests for the backing-track finder core
 * Run: node test/tracks.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tracks.js');
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

var SEED = [
  { yt: 'a', title: 'Blues in A', artist: 'X', genre: 'blues', key: 'A', mode: 'minor', bpm: 70 },
  { yt: 'b', title: 'C jam', artist: 'Y', genre: 'jam', key: 'C', mode: 'major', bpm: 120 },
  { yt: null, title: 'Reggae D', artist: 'Z', genre: 'reggae', key: 'D', mode: 'major', bpm: 75 }
];

test('uniqueGenres returns sorted distinct genres', function () {
  assert.deepStrictEqual(T.uniqueGenres(SEED), ['blues', 'jam', 'reggae']);
});
test('filterTracks by genre only', function () {
  var r = T.filterTracks(SEED, 'jam', null, 'major');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].track.title, 'C jam');
});
test('filterTracks exact key match ranks first', function () {
  var r = T.filterTracks(SEED, 'all', 'A', 'minor');
  assert.ok(r.length >= 1);
  assert.strictEqual(r[0].track.key, 'A');
  assert.strictEqual(r[0].rank, 0);
});
test('compatibleKeys: A minor includes its relative major C', function () {
  var keys = T.compatibleKeys('A', 'minor').map(function (c) { return c.key + c.mode; });
  assert.ok(keys.indexOf('Cmajor') >= 0, keys.join(','));
});
test('relative-key expansion: A minor surfaces the C-major jam, labelled', function () {
  var r = T.filterTracks(SEED, 'all', 'A', 'minor');
  var c = r.filter(function (x) { return x.track.key === 'C'; })[0];
  assert.ok(c, 'expected the C-major track to surface for A minor');
  assert.ok(c.rank > 0 && /relative/.test(c.why), 'should be a labelled related match');
});
test('parseYouTubeId handles watch / youtu.be / bare id', function () {
  assert.strictEqual(T.parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('not a url'), null);
});
test('searchQuery + youtubeSearchUrl build a sane deterministic URL', function () {
  var q = T.searchQuery({ artist: 'Phish', title: 'Tweezer' });
  assert.strictEqual(q, 'Phish Tweezer backing track');
  assert.ok(/youtube\.com\/results\?search_query=/.test(T.youtubeSearchUrl(q)));
});
test('filterQuery composes genre + key', function () {
  assert.strictEqual(T.filterQuery('blues', 'A', 'minor'), 'blues backing track in A minor');
});
test('mergeTracks concatenates seed + custom safely', function () {
  assert.deepStrictEqual(T.mergeTracks([1], [2]), [1, 2]);
  assert.deepStrictEqual(T.mergeTracks(null, null), []);
});
test('notesToPcs maps note names to chromatic pitch classes (flats normalised)', function () {
  assert.deepStrictEqual(T.notesToPcs(['C', 'E', 'G']), [0, 4, 7]);
  assert.deepStrictEqual(T.notesToPcs(['Bb', 'Db']), [10, 1]);
  assert.deepStrictEqual(T.notesToPcs(['C', 'wat', 'G']), [0, 7]); // unknowns drop out
});
test('Studio fretboard input: A minor scale -> the right pitch classes', function () {
  // the exact pcs the scale diagram lights up for an Am backing track
  var pcs = T.notesToPcs(Circle.scale('A', 'aeolian'));
  assert.deepStrictEqual(pcs, [9, 11, 0, 2, 4, 5, 7]);
});
test('Studio chords: C major track -> its diatonic triads', function () {
  var chords = Circle.diatonic('C', 'ionian').map(function (d) { return d.chord; });
  assert.deepStrictEqual(chords, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
});

run();
