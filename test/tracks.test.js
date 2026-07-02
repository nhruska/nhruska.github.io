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
test('notesToPcs handles exotic enharmonics (E#,B#,Cb,Fb + double accidentals)', function () {
  assert.deepStrictEqual(T.notesToPcs(['E#', 'B#', 'Cb', 'Fb']), [5, 0, 11, 4]);
  assert.deepStrictEqual(T.notesToPcs(['F##', 'Bbb']), [7, 9]);
});
test('Studio fretboard: F# major + D# minor light ALL 7 tones (the E# bug)', function () {
  // F# major is spelled F# G# A# B C# D# E# — the E# must not drop
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('F#', 'ionian')), [6, 8, 10, 11, 1, 3, 5]);
  assert.strictEqual(T.notesToPcs(Circle.scale('D#', 'aeolian')).length, 7);
});
test('Studio chords: C major track -> its diatonic triads', function () {
  var chords = Circle.diatonic('C', 'ionian').map(function (d) { return d.chord; });
  assert.deepStrictEqual(chords, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
});
test('Studio chords carry interval (Roman) labels — case-aware, diminished marked', function () {
  // the chord row now shows the interval under each chord; major=UPPER, minor=lower, dim=°
  var romans = Circle.diatonic('C', 'ionian').map(function (d) { return d.roman; });
  assert.deepStrictEqual(romans, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  // minor key relabels the same chords from its own tonic
  var minor = Circle.diatonic('A', 'aeolian').map(function (d) { return d.roman; });
  assert.deepStrictEqual(minor, ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
});

// --- Phase 3: Compose -> backing-track bridge -----------------------------
test('P3 normMode: Major/Minor coarsen to the finder families', function () {
  assert.strictEqual(T.normMode('Major'), 'major');
  assert.strictEqual(T.normMode('Minor'), 'minor');
  assert.strictEqual(T.normMode('minor'), 'minor');
});
test('P3 normMode: church modes coarsen by family', function () {
  assert.strictEqual(T.normMode('Dorian'), 'minor');
  assert.strictEqual(T.normMode('Phrygian'), 'minor');
  assert.strictEqual(T.normMode('Aeolian'), 'minor');
  assert.strictEqual(T.normMode('Mixolydian'), 'major'); // dominant, major-family
  assert.strictEqual(T.normMode('Lydian'), 'major');
  assert.strictEqual(T.normMode('Ionian'), 'major');
});
test('P3 normMode: missing/garbage defaults to major (safe)', function () {
  assert.strictEqual(T.normMode(null), 'major');
  assert.strictEqual(T.normMode(''), 'major');
  assert.strictEqual(T.normMode(undefined), 'major');
});
test('P3 seed end-to-end: a composed A-minor key surfaces matched tracks', function () {
  // the bridge seeds the finder with (root, normMode(mode)) -> filterTracks ranks matches
  var tracks = [
    { title: 'Am jam', genre: 'rock', key: 'A', mode: 'minor', yt: 'aaaaaaaaaaa' },
    { title: 'C jam', genre: 'rock', key: 'C', mode: 'major', yt: 'bbbbbbbbbbb' },
    { title: 'F# blues', genre: 'blues', key: 'F#', mode: 'major', yt: 'ccccccccccc' }
  ];
  var out = T.filterTracks(tracks, 'all', 'A', T.normMode('Minor'));
  assert.strictEqual(out[0].track.title, 'Am jam', 'exact key match ranks first');
  // C major is A minor's relative -> it is a labelled related match, not dropped
  var c = out.filter(function (r) { return r.track.title === 'C jam'; })[0];
  assert.ok(c && c.rank > 0 && /relative/.test(c.why || ''), 'relative major surfaces, labelled');
});

// --- Practice Studio 4-mode fidelity: resolveScaleMode ---------------------
test('resolveScaleMode: capitalized inputs map to the right circle mode', function () {
  assert.strictEqual(T.resolveScaleMode('Minor'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('Dorian'), 'dorian');
  assert.strictEqual(T.resolveScaleMode('Mixolydian'), 'mixolydian');
});
test('resolveScaleMode: lowercase family + mode names', function () {
  assert.strictEqual(T.resolveScaleMode('minor'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('major'), 'ionian');
  assert.strictEqual(T.resolveScaleMode('aeolian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('ionian'), 'ionian');
  assert.strictEqual(T.resolveScaleMode('dorian'), 'dorian');
  assert.strictEqual(T.resolveScaleMode('mixolydian'), 'mixolydian');
});
test('resolveScaleMode: missing/undefined defaults to ionian (safe major)', function () {
  assert.strictEqual(T.resolveScaleMode(undefined), 'ionian');
  assert.strictEqual(T.resolveScaleMode(null), 'ionian');
  assert.strictEqual(T.resolveScaleMode(''), 'ionian');
});
test('resolveScaleMode: unsupported modes coarsen to their major/minor family', function () {
  // phrygian is minor-family -> aeolian (NOT ionian - the original bug), lydian major-family -> ionian
  assert.strictEqual(T.resolveScaleMode('phrygian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('Phrygian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('locrian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('lydian'), 'ionian');
});
test('resolveScaleMode: the reported bug - A Minor no longer renders a major scale', function () {
  // regression: 'Minor' used to fall through familyMode()==='ionian', lighting C#/G#.
  // Now it resolves to aeolian, whose A-scale is A B C D E F G (no sharps).
  var pcs = T.notesToPcs(Circle.scale('A', T.resolveScaleMode('Minor')));
  assert.deepStrictEqual(pcs, [9, 11, 0, 2, 4, 5, 7]);
});
test('resolveScaleMode: A Dorian and G Mixolydian light their true modal tones', function () {
  // A dorian = A B C D E F# G  (raised 6th vs aeolian)
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('A', T.resolveScaleMode('Dorian'))), [9, 11, 0, 2, 4, 6, 7]);
  // G mixolydian = G A B C D E F  (lowered 7th vs ionian)
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('G', T.resolveScaleMode('Mixolydian'))), [7, 9, 11, 0, 2, 4, 5]);
});

/* ---------- studioTheory wiring (the real Studio path, not just resolveScaleMode) ---------- */
test('studioTheory: A Dorian renders a true dorian scale (F#, natural G)', function () {
  var th = T.studioTheory('A', 'Dorian');
  assert.ok(th, 'theory bundle should resolve');
  assert.strictEqual(th.scaleMode, 'dorian');
  assert.deepStrictEqual(th.notes, ['A', 'B', 'C', 'D', 'E', 'F#', 'G']);
});
test('studioTheory: G Mixolydian renders a true mixolydian scale (natural F)', function () {
  var th = T.studioTheory('G', 'Mixolydian');
  assert.strictEqual(th.scaleMode, 'mixolydian');
  assert.deepStrictEqual(th.notes, ['G', 'A', 'B', 'C', 'D', 'E', 'F']);
});
test('studioTheory: capitalized Minor is aeolian, never ionian (the regression)', function () {
  var th = T.studioTheory('A', 'Minor');
  assert.strictEqual(th.scaleMode, 'aeolian');
  assert.deepStrictEqual(th.notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});
test('studioTheory: diatonic chords + degrees follow the resolved mode', function () {
  var th = T.studioTheory('A', 'Dorian');
  assert.strictEqual(th.chords.length, 7);
  assert.strictEqual(th.degrees.length, 7);
  assert.strictEqual(th.pcs.length, 7);
});
test('studioTheory: unresolvable key returns null (caller falls back to player/search)', function () {
  assert.strictEqual(T.studioTheory('H', 'major'), null);
});

run();
