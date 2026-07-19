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

test('genres() and keys() build sorted, unique, CASE-INSENSITIVE facet lists (Title-case display; operator UAT 2026-07-19: Jam + jam rendered duplicate chips)', function () {
  var list = R.build([SONG], [TRACK, { title: 'B', artist: 'B', key: 'G', mode: 'minor', genre: 'folk' },
    { title: 'C', artist: 'C', key: 'D', mode: 'major', genre: 'Folk' },
    { title: 'D', artist: 'D', key: 'A', mode: 'major', genre: 'REGGAE' }]);
  assert.deepStrictEqual(R.genres(list), ['Folk', 'Reggae'], 'one chip per genre identity, Title-case display');
  // and filter() honors the same identity: the Title-case chip matches the lowercase record
  var hit = R.filter(list, { genre: 'Folk' });
  assert.ok(hit.length >= 2, 'Folk chip matches folk AND Folk records, got ' + hit.length);
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

test('KEY_ORDER is an internal canonical-sharp RANKING table (not the display spelling) - keyRank canonicalizes before lookup', function () {
  // KEY_ORDER itself is unchanged by the regime-B display fix below: it is only
  // ever consulted after keyRank() canonicalizes a displayed label back to its
  // sharp identity (see the "flat labels rank correctly" case further down).
  var flats = ['Db', 'Ab', 'Eb', 'Bb', 'Gb'];
  R.KEY_ORDER.forEach(function (k) {
    assert.strictEqual(flats.indexOf(k), -1, 'KEY_ORDER should not contain flat name: ' + k);
  });
  assert.deepStrictEqual(R.KEY_ORDER, ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']);
});

/* ---- Regime-B key-aware facet display (2026-07-11 fix - FORK-4 leftover) ----
 * The Library Key facet chips + zero-results message used to force every root
 * to its canonical-sharp spelling (FORK-4). That regime was retired 2026-07-10
 * (note-spelling.md regime B): a key respells via Circle.preferredTonicName,
 * key-aware, so "A# major" reads "Bb major" like the rest of the app. These
 * three cases replace the old FORK-4-pinned assertions below (deliberately
 * updated, not merely relaxed - the old expectations are now WRONG). */
test('a record whose data says a flat key groups + labels under its regime-B preferred name (Bb major, not A#)', function () {
  var list = R.build([], [{ title: 'Flat Key Track', artist: 'X', key: 'Bb', mode: 'major', genre: 'soul' }]);
  assert.strictEqual(R.keyLabel(list[0]), 'Bb', 'Bb-major record labels as Bb (preferredTonicName), not the canonical-sharp A#');
  var ks = R.keys(list);
  assert.deepStrictEqual(ks, ['Bb'], 'facet list holds the preferred display name');
  assert.strictEqual(R.filter(list, { key: 'Bb' }).length, 1, 'picking the Bb chip matches the Bb-keyed record - facet SET and filter() derive from the SAME keyLabel()');
  assert.strictEqual(R.filter(list, { key: 'A#' }).length, 0, 'the canonical-sharp spelling is no longer a valid facet selector once the display respelled to Bb');
});

test('keyLabel respells key-aware per mode (G# minor stays G#, not Ab) - the tie/keep-sharp cases from note-spelling.md', function () {
  assert.strictEqual(R.keyLabel({ key: 'G#', mode: 'minor' }), 'G#m', 'G# minor keeps its sharp spelling (5 sharps beats Ab minor 7 flats)');
  assert.strictEqual(R.keyLabel({ key: 'D#', mode: 'minor' }), 'D#m', 'D# minor stays sharp');
  assert.strictEqual(R.keyLabel({ key: 'F#', mode: 'major' }), 'F#', 'F# major stays sharp on the accidental-count tie');
});

test('keys() facet shows each root under its own regime-B preferred name across a mixed dataset, and keyRank still orders them correctly', function () {
  var list = R.build([], [
    { title: 'A', artist: 'A', key: 'Db', mode: 'major', genre: 'x' },   // C# major -> Db (2 flats beats 7 sharps)
    { title: 'B', artist: 'B', key: 'G#', mode: 'minor', genre: 'x' },   // G# minor stays G#
    { title: 'C', artist: 'C', key: 'Eb', mode: 'major', genre: 'x' }    // D# major -> Eb
  ]);
  var ks = R.keys(list);
  assert.deepStrictEqual(ks, ['Db', 'Eb', 'G#m'], 'ranked by canonical position (C#=7, D#=9, then minors last), displayed under their preferred flat/sharp spelling: ' + ks.join(','));
  assert.strictEqual(R.filter(list, { key: 'Db' }).length, 1);
  assert.strictEqual(R.filter(list, { key: 'Eb' }).length, 1);
  assert.strictEqual(R.filter(list, { key: 'G#m' }).length, 1);
});

run();
