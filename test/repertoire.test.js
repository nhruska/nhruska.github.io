/* =====================================================================
 * repertoire.test.js  -  unit tests for the M3 merged-repertoire model.
 * Run: node test/repertoire.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var R = require('../music/shared/repertoire.js');

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

var SONG = { id: 'k0', t: 'Three Little Birds', a: 'Bob Marley', y: 1977, d: '70s', seq: ['A', 'D', 'E'], sheet: [['Chorus', '[A]x']] };
var TRACK = { yt: 'abc123', title: 'Three Little Birds', artist: 'Bob Marley', genre: 'reggae', key: 'A', mode: 'major', bpm: 76, capo: 0, tags: ['easy', 'I-IV-V'] };

test('matchKey coalesces case / punctuation / leading article', function () {
  assert.strictEqual(R.matchKey({ t: 'The Beatles Song', a: 'X' }), R.matchKey({ title: 'beatles  song!', artist: 'x' }));
});

test('build merges a song + track on title+artist into ONE item', function () {
  var list = R.build([SONG], [TRACK]);
  assert.strictEqual(list.length, 1, 'one merged item, not two');
  var m = list[0];
  assert.deepStrictEqual(m.sources, ['song', 'track']);
  assert.deepStrictEqual(m.seq, ['A', 'D', 'E'], 'song chords survive');
  assert.strictEqual(m.genre, 'reggae', 'track genre merged in');
  assert.strictEqual(m.bpm, 76, 'track bpm merged in');
  assert.strictEqual(m.yt, 'abc123', 'track video merged in');
  assert.strictEqual(m.id, 'k0', 'song id preserved for openPractice routing');
});

test('mergeRec unions tags and keeps song fields authoritative', function () {
  var m = R.mergeRec({ t: 'S', a: 'A', tags: ['acoustic'], y: 1990 }, { title: 'S', artist: 'A', tags: ['easy', 'acoustic'], genre: 'folk' });
  assert.deepStrictEqual(m.tags.sort(), ['acoustic', 'easy']);
  assert.strictEqual(m.genre, 'folk');
  assert.strictEqual(m.y, 1990);
});

test('a keyless song still merges (key is a tiebreak, not a match requirement)', function () {
  var song = { id: 'k1', t: 'No Key Song', a: 'Band', seq: [] };
  var track = { title: 'No Key Song', artist: 'Band', key: 'G', mode: 'major', genre: 'rock' };
  var list = R.build([song], [track]);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].genre, 'rock');
  assert.strictEqual(list[0].key, 'G', 'track key fills the keyless song');
});

test('when several tracks share title+artist, key tiebreak picks the matching one', function () {
  var song = { id: 'k2', t: 'Dup', a: 'Band', seq: ['G'] }; // derived key G major -> 'G'
  var tracks = [
    { title: 'Dup', artist: 'Band', key: 'C', mode: 'major', genre: 'jazz' },
    { title: 'Dup', artist: 'Band', key: 'G', mode: 'major', genre: 'rock' }
  ];
  var list = R.build([song], tracks);
  var merged = list.filter(function (r) { return r.sources.length === 2; });
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].genre, 'rock', 'G-key track chosen to match song key G');
  var standalone = list.filter(function (r) { return r.sources[0] === 'track' && r.sources.length === 1; });
  assert.strictEqual(standalone.length, 1, 'the non-matching C track stays standalone');
  assert.strictEqual(standalone[0].genre, 'jazz');
});

test('unmatched track becomes a standalone item with an id and no sheet', function () {
  var list = R.build([], [{ title: 'Solo Track', artist: 'X', key: 'D', mode: 'minor', genre: 'blues' }]);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].sources[0], 'track');
  assert.ok(/^tk\d+$/.test(list[0].id), 'assigned a tk<i> id, got ' + list[0].id);
});

test('build does not mutate the input track objects (_used cleaned up)', function () {
  var tracks = [TRACK];
  R.build([SONG], tracks);
  assert.ok(!('_used' in tracks[0]), 'no leftover _used flag on input');
});

test('playability: chord-sheet song -> sheet; pure track -> studio; video flagged', function () {
  assert.deepStrictEqual(R.playability(SONG), { sheet: true, studio: false, video: false });
  assert.deepStrictEqual(R.playability({ key: 'A', mode: 'major' }), { sheet: false, studio: true, video: false });
  assert.deepStrictEqual(R.playability({ key: 'A', mode: 'major', yt: 'x' }), { sheet: false, studio: true, video: true });
  assert.deepStrictEqual(R.playability({ title: 'Nada' }), { sheet: false, studio: false, video: false });
});

test('genres() and keys() build sorted, unique facet lists', function () {
  var list = R.build([SONG], [TRACK, { title: 'B', artist: 'B', key: 'G', mode: 'minor', genre: 'folk' }]);
  assert.deepStrictEqual(R.genres(list), ['folk', 'reggae']);
  var ks = R.keys(list);
  assert.ok(ks.indexOf('A') >= 0 && ks.indexOf('Gm') >= 0, 'A and Gm present: ' + ks.join(','));
});

test('filter narrows by q, genre and key independently', function () {
  var list = R.build([SONG], [TRACK, { title: 'Blue', artist: 'Z', key: 'E', mode: 'major', genre: 'blues' }]);
  assert.strictEqual(R.filter(list, { genre: 'reggae' }).length, 1);
  assert.strictEqual(R.filter(list, { key: 'E' }).length, 1);
  assert.strictEqual(R.filter(list, { q: 'three' }).length, 1);
  assert.strictEqual(R.filter(list, { q: 'zzz' }).length, 0);
  assert.strictEqual(R.filter(list, { genre: 'all', key: 'all', q: '' }).length, 2);
});

/* ---------- 'Mine' facet (M4): custom items form a saved-by-you collection ---------- */
test("genres(): appends 'Mine' after the sorted genres when any custom item exists", function () {
  var list = [{ genre: 'rock' }, { genre: 'blues' }, { custom: true, genre: '' }];
  assert.deepStrictEqual(R.genres(list), ['blues', 'rock', 'Mine']);
});
test("genres(): no 'Mine' chip when nothing custom exists", function () {
  assert.deepStrictEqual(R.genres([{ genre: 'jam' }]), ['jam']);
});
test("filter(): genre 'Mine' matches custom items regardless of their genre string", function () {
  var list = [
    { t: 'saved prog', custom: true },
    { t: 'saved track', custom: true, genre: 'blues' },
    { t: 'catalog', genre: 'blues' }
  ];
  var out = R.filter(list, { genre: 'Mine' });
  assert.deepStrictEqual(out.map(function (r) { return r.t; }), ['saved prog', 'saved track']);
});
test("filter(): real genres still exclude custom items that don't carry them", function () {
  var list = [{ t: 'a', custom: true }, { t: 'b', genre: 'blues' }];
  assert.deepStrictEqual(R.filter(list, { genre: 'blues' }).map(function (r) { return r.t; }), ['b']);
});

run();
