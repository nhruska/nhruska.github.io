'use strict';
/* playlist-import.js pure-logic tests: playlist-id extraction, the import
 * key ladder (parseHints first, bare-root fallback, honest skip), and
 * entriesFromInfo's dedupe + preferred-name key spelling. The browser
 * driver (iframe enumeration, noembed fetch) is covered by the committed
 * pw scenario (test/pw/scenarios/playlist-import.json), not here. */
const test = require('node:test');
const assert = require('node:assert');

const PI = require('../music/shared/playlist-import.js');
const YtInfo = require('../music/shared/yt-info.js');
const Circle = require('../music/shared/circle.js');

// ---- playlistId ----------------------------------------------------------

test('playlistId: extracts list= from every real URL form', () => {
  const id = 'PLeqWgsYsf6p7gpIKkoHKCmfHNJ1_Lr7XW';
  assert.strictEqual(PI.playlistId('https://www.youtube.com/playlist?list=' + id), id);
  assert.strictEqual(PI.playlistId('https://www.youtube.com/watch?v=abc123DEF45&list=' + id + '&index=2'), id);
  assert.strictEqual(PI.playlistId('https://youtu.be/abc123DEF45?list=' + id), id);
  assert.strictEqual(PI.playlistId('https://music.youtube.com/playlist?list=' + id), id);
  assert.strictEqual(PI.playlistId('  https://www.youtube.com/playlist?list=' + id + '  '), id, 'trims');
});

test('playlistId: accepts a bare id, rejects garbage', () => {
  assert.strictEqual(PI.playlistId('PLeqWgsYsf6p7gpIKkoHKCmfHNJ1_Lr7XW'), 'PLeqWgsYsf6p7gpIKkoHKCmfHNJ1_Lr7XW');
  assert.strictEqual(PI.playlistId('UUabcdefghijk1234567890'), 'UUabcdefghijk1234567890');
  assert.strictEqual(PI.playlistId('https://www.youtube.com/watch?v=abc123DEF45'), null, 'a plain video URL is not a playlist');
  assert.strictEqual(PI.playlistId('hello world'), null);
  assert.strictEqual(PI.playlistId(''), null);
  assert.strictEqual(PI.playlistId(null), null);
});

// ---- resolveKey (the import key ladder) ----------------------------------

function keyFor(title) {
  return PI.resolveKey(title, YtInfo.parseHints(title, 'Chan'));
}

test('resolveKey rung 1: parseHints word/shorthand shapes pass through', () => {
  assert.deepStrictEqual(keyFor('Reggae Backing Track in A Major'), { key: 'A', mode: 'major' });
  assert.deepStrictEqual(keyFor('Funky Jam Backing Track [Fm]'), { key: 'F', mode: 'minor' });
  assert.deepStrictEqual(keyFor('Sweet Mixolydian Jam in D Mixolydian'), { key: 'D', mode: 'mixolydian' });
});

test('resolveKey rung 1: a blues-genre title with a hint key gets mode blues', () => {
  // "Bb blues" parses key A# with mode null (blues is outside yt-info's
  // SUPPORTED_MODES); the ladder resolves mode from the genre.
  assert.deepStrictEqual(keyFor('Bb blues backing track'), { key: 'A#', mode: 'blues' });
});

test('resolveKey rung 2: bare "in <ROOT>" titles - the shapes parseHints misses', () => {
  assert.deepStrictEqual(keyFor('Peaceful Acoustic Jam in G'), { key: 'G', mode: 'major' });
  assert.deepStrictEqual(keyFor('Slow Blues Jam in A'), { key: 'A', mode: 'blues' }, 'blues genre drives blues mode');
  assert.deepStrictEqual(keyFor('Mellow Groove in F#'), { key: 'F#', mode: 'major' });
  assert.deepStrictEqual(keyFor('Sad Ballad in Am'), { key: 'A', mode: 'minor' }, 'bare shorthand minor');
  assert.deepStrictEqual(keyFor('Key of E Groove Jam'), { key: 'E', mode: 'major' });
  assert.deepStrictEqual(keyFor('Funky Blues In C | Backing Track In The Style Of John Mayer'),
    { key: 'C', mode: 'blues' }, 'Title Case "In C" counts');
});

test('resolveKey rungs 2b/2c: accidental roots anywhere + natural root glued to a bpm', () => {
  assert.deepStrictEqual(keyFor('Jazz Blues Backing Track - Eb 120bpm'), { key: 'Eb', mode: 'blues' });
  assert.deepStrictEqual(keyFor('F# Groove Backing Track'), { key: 'F#', mode: 'major' });
  assert.deepStrictEqual(keyFor('Smooth Groove A 90bpm'), { key: 'A', mode: 'major' });
  assert.strictEqual(keyFor('Abba Megamix'), null, 'Ab followed by a letter never matches');
});

test('resolveKey rung 3: no key -> null (honest skip, never an invented key)', () => {
  assert.strictEqual(keyFor('Chill Lofi Beats to Study To'), null);
  assert.strictEqual(keyFor('in a sentimental mood'), null, 'lowercase prose root never matches');
  assert.strictEqual(keyFor('Best jam in Dallas'), null, 'root must not lead a longer word');
});

// ---- entriesFromInfo ------------------------------------------------------

test('entriesFromInfo: maps, dedupes, spells keys by preferred tonic name', () => {
  const items = [
    { id: 'aaaaaaaaaa1', title: 'Jazz Blues Jam in Eb', author: 'Benys' },
    { id: 'aaaaaaaaaa2', title: 'Slow Blues Jam in A', author: 'JTG' },
    { id: 'aaaaaaaaaa3', title: 'Chill Lofi Beats to Study To', author: 'Lofi Girl' },
    { id: 'aaaaaaaaaa4', title: null, author: null },
    { id: 'dupdupdupd1', title: 'Anything in C Major', author: 'X' },
    { id: 'aaaaaaaaaa2', title: 'Slow Blues Jam in A', author: 'JTG' } // listed twice
  ];
  const r = PI.entriesFromInfo(items, ['dupdupdupd1'], Circle, YtInfo);
  assert.strictEqual(r.entries.length, 2);
  // "in Eb" -> hints key D# (canonical) -> stored as the PREFERRED name Eb
  assert.deepStrictEqual(r.entries[0], {
    title: 'Jazz Blues Jam in Eb', artist: 'Benys',
    key: Circle.preferredTonicName('D#', 'blues'), mode: 'blues', genre: 'blues', yt: 'aaaaaaaaaa1'
  });
  assert.strictEqual(r.entries[0].key, 'Eb', 'preferred spelling, not D#');
  assert.deepStrictEqual(r.entries[1], {
    title: 'Slow Blues Jam in A', artist: 'JTG',
    key: 'A', mode: 'blues', genre: 'blues', yt: 'aaaaaaaaaa2'
  });
  const reasons = r.skipped.map(s => s.reason).sort();
  assert.deepStrictEqual(reasons, ['duplicate', 'duplicate', 'no-key', 'no-title'],
    'catalog dup + in-playlist dup + lofi (no key) + unreadable title');
});

test('entriesFromInfo: artist is the CHANNEL, title stays verbatim', () => {
  // splitArtistTitle would read "Track - Eb 120bpm" as artist "Jazz Blues
  // Backing Track" / title "Eb 120bpm" - the import must not.
  const items = [{ id: 'bbbbbbbbbb1', title: 'Jazz Blues Backing Track - Eb 120bpm', author: 'Benys Backing Tracks' }];
  const r = PI.entriesFromInfo(items, [], Circle, YtInfo);
  assert.strictEqual(r.entries.length, 1);
  assert.strictEqual(r.entries[0].title, 'Jazz Blues Backing Track - Eb 120bpm');
  assert.strictEqual(r.entries[0].artist, 'Benys Backing Tracks');
  assert.strictEqual(r.entries[0].key, 'Eb');
  assert.strictEqual(r.entries[0].mode, 'blues');
});

test('entriesFromInfo: missing author degrades to empty artist, not a fake', () => {
  const r = PI.entriesFromInfo([{ id: 'cccccccccc1', title: 'Groove in D', author: null }], [], Circle, YtInfo);
  assert.strictEqual(r.entries[0].artist, '');
});
