/* =====================================================================
 * yt-info.test.js  -  unit tests for shared/yt-info.js (U17, M-TRACKLIB
 * wave 2a). parseHints/parseKeyMode/parseGenre/parseBpm/splitArtistTitle/
 * videoId are pure - covered directly against a realistic fixture set of
 * real-world-shaped backing-track/jam-track titles. fetchInfo's network
 * path is mocked here (a fake fetch impl) - the LIVE network behavior
 * (which of the two endpoints actually survives browser CORS) is verified
 * separately per the shipping PR's V&V section, not by this suite.
 * Run: node test/yt-info.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var YtInfo = require('../music/shared/yt-info.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  var chain = Promise.resolve();
  cases.forEach(function (c) {
    chain = chain.then(function () {
      return Promise.resolve().then(function () { return c[1](); }).then(
        function () { passed++; console.log('  ✓ ' + c[0]); },
        function (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
      );
    });
  });
  chain.then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  });
}

/* ---- videoId: same shapes tracks.js's parseYouTubeId accepts ---------- */
test('videoId: youtu.be short link', function () {
  assert.strictEqual(YtInfo.videoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
test('videoId: watch?v= long link with extra query params', function () {
  assert.strictEqual(YtInfo.videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&t=30s'), 'dQw4w9WgXcQ');
});
test('videoId: bare 11-char id', function () {
  assert.strictEqual(YtInfo.videoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
test('videoId: garbage input -> null', function () {
  assert.strictEqual(YtInfo.videoId('not a url'), null);
  assert.strictEqual(YtInfo.videoId(''), null);
  assert.strictEqual(YtInfo.videoId(null), null);
});

/* ---- parseKeyMode / parseGenre / parseBpm: the sub-parsers ------------ */
test('parseKeyMode: full mode word, natural root', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('A Minor Blues Backing Track'), { key: 'A', mode: 'minor' });
});
test('parseKeyMode: full mode word, flat root normalizes to sharp (FORK-4)', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('Bb Blues Jam Track'), { key: 'A#', mode: null }); // blues not in SUPPORTED_MODES
});
test('parseKeyMode: mixolydian, sharp root', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('G Mixolydian Backing Track'), { key: 'G', mode: 'mixolydian' });
});
test('parseKeyMode: dorian', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('D Dorian Jam - Funky Groove'), { key: 'D', mode: 'dorian' });
});
test('parseKeyMode: chord-shorthand minor ("Cm")', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('Cm Funk Backing Track'), { key: 'C', mode: 'minor' });
});
test('parseKeyMode: shorthand does not false-match inside a longer word', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('Ambient Backing Track'), { key: null, mode: null });
});
test('parseKeyMode: unsupported scale word (lydian) still yields a key, null mode', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('F Lydian Chill Backing Track'), { key: 'F', mode: null });
});
test('parseKeyMode: no key info at all -> both null', function () {
  assert.deepStrictEqual(YtInfo.parseKeyMode('Sweet Home Alabama Backing Track'), { key: null, mode: null });
});
test('parseGenre: first list-order match wins when multiple keywords present', function () {
  assert.strictEqual(YtInfo.parseGenre('Bluesy Funky Backing Track'), 'blues');
});
test('parseGenre: no genre keyword -> null', function () {
  assert.strictEqual(YtInfo.parseGenre('Sweet Home Alabama Backing Track'), null);
});
test('parseBpm: "NN bpm" case-insensitive', function () {
  assert.strictEqual(YtInfo.parseBpm('A Minor Blues Backing Track 80 bpm'), 80);
  assert.strictEqual(YtInfo.parseBpm('Funk Jam 120 BPM Loop'), 120);
});
test('parseBpm: no bpm token -> null', function () {
  assert.strictEqual(YtInfo.parseBpm('G Mixolydian Backing Track'), null);
});

/* ---- splitArtistTitle: dash convention, both orders -------------------- */
test('splitArtistTitle: "Artist - Title" convention, no channel to disambiguate', function () {
  assert.deepStrictEqual(YtInfo.splitArtistTitle('Bob Marley - No Woman No Cry', ''), { a: 'Bob Marley', t: 'No Woman No Cry' });
});
test('splitArtistTitle: reversed "Title - Channel" convention, channel name resolves it', function () {
  assert.deepStrictEqual(
    YtInfo.splitArtistTitle('A Minor Blues Backing Track - QuickTracks', 'QuickTracks'),
    { a: 'QuickTracks', t: 'A Minor Blues Backing Track' }
  );
});
test('splitArtistTitle: no separator -> whole string is title, channel becomes artist guess', function () {
  assert.deepStrictEqual(YtInfo.splitArtistTitle('Sweet Home Alabama Backing Track', 'QuickTracks'), { a: 'QuickTracks', t: 'Sweet Home Alabama Backing Track' });
});
test('splitArtistTitle: no separator, no channel -> artist stays null (never invented)', function () {
  assert.deepStrictEqual(YtInfo.splitArtistTitle('Sweet Home Alabama Backing Track', ''), { a: null, t: 'Sweet Home Alabama Backing Track' });
});
test('splitArtistTitle: em-dash and pipe separators also split', function () {
  assert.deepStrictEqual(YtInfo.splitArtistTitle('Artist Name — Song Title', ''), { a: 'Artist Name', t: 'Song Title' });
  assert.deepStrictEqual(YtInfo.splitArtistTitle('Artist Name | Song Title', ''), { a: 'Artist Name', t: 'Song Title' });
});

/* ---- parseHints: full pipeline, realistic title fixtures --------------- */
var FIXTURES = [
  { title: 'A Minor Blues Backing Track 80 bpm', author: '', expect: { key: 'A', mode: 'minor', genre: 'blues', bpm: 80 } },
  { title: 'G Mixolydian Jam Track 100 BPM', author: 'QuickTracks', expect: { key: 'G', mode: 'mixolydian', bpm: 100 } },
  { title: 'Cm Funk Backing Track', author: '', expect: { key: 'C', mode: 'minor', genre: 'funk' } },
  { title: 'Bb Blues Shuffle Backing Track', author: '', expect: { key: 'A#', mode: null, genre: 'blues' } },
  { title: 'D Dorian Funk Groove Backing Track', author: '', expect: { key: 'D', mode: 'dorian', genre: 'funk' } },
  { title: 'E Mixolydian Reggae Backing Track 90 bpm', author: '', expect: { key: 'E', mode: 'mixolydian', genre: 'reggae', bpm: 90 } },
  { title: 'F Lydian Chill Jazz Backing Track', author: '', expect: { key: 'F', mode: null, genre: 'jazz' } },
  { title: 'Am Blues Jam Track 60 bpm Slow', author: '', expect: { key: 'A', mode: 'minor', genre: 'blues', bpm: 60 } },
  { title: 'Sweet Home Alabama Backing Track - Lynyrd Skynyrd Style', author: '', expect: { key: null, mode: null, genre: null, bpm: null } },
  { title: 'Wonderwall Backing Track (Oasis Style) - QuickTracks', author: 'QuickTracks', expect: { key: null, mode: null, genre: null, bpm: null }, artist: 'QuickTracks', song: 'Wonderwall Backing Track (Oasis Style)' },
  { title: 'Country Shuffle Backing Track in G 110 BPM', author: '', expect: { genre: 'country', bpm: 110 } },
  { title: 'Rock Backing Track E Minor 130bpm', author: '', expect: { key: 'E', mode: 'minor', genre: 'rock', bpm: 130 } },
  { title: 'Smooth Jazz Backing Track - Bb Major', author: '', expect: { genre: 'jazz' } }, // "Major" not scanned by SHORTHAND_RE; WORD_RE requires root immediately before word - "Bb Major" DOES match WORD_RE
  { title: 'Folk Fingerstyle Jam - Open G Tuning', author: '', expect: { genre: 'folk' } },
  { title: 'Metal Riff Backing Track Drop D 140 bpm', author: '', expect: { genre: 'metal', bpm: 140 } },
  { title: 'Pop Ballad Backing Track - C Major Piano', author: '', expect: { key: 'C', mode: 'major', genre: 'pop' } },
  { title: 'Soulful Backing Track A Minor 75 BPM', author: '', expect: { key: 'A', mode: 'minor', genre: 'soul', bpm: 75 } },
  { title: 'Bluegrass Jam Track G Major', author: '', expect: { key: 'G', mode: 'major', genre: 'bluegrass' } },
  { title: 'Gospel Praise Backing Track Eb Major', author: '', expect: { key: 'D#', mode: 'major', genre: 'gospel' } },
  // "in Ab" - the root and "Blues" aren't adjacent, so key parsing correctly
  // misses here (a documented best-effort limit: WORD_RE/SHORTHAND_RE only
  // match a root immediately followed by its qualifier, not "in <key>"
  // phrasing elsewhere in the title). Genre still resolves independently.
  { title: 'Slow Blues in Ab - 12 Bar Backing Track', author: '', expect: { key: null, mode: null, genre: 'blues' } }
];

FIXTURES.forEach(function (fx, i) {
  test('parseHints fixture ' + (i + 1) + ': "' + fx.title + '"', function () {
    var h = YtInfo.parseHints(fx.title, fx.author);
    var exp = fx.expect;
    if ('key' in exp) assert.strictEqual(h.key, exp.key, 'key');
    if ('mode' in exp) assert.strictEqual(h.mode, exp.mode, 'mode');
    if ('genre' in exp) assert.strictEqual(h.genre, exp.genre, 'genre');
    if ('bpm' in exp) assert.strictEqual(h.bpm, exp.bpm, 'bpm');
    if (fx.artist) assert.strictEqual(h.a, fx.artist, 'artist');
    if (fx.song) assert.strictEqual(h.t, fx.song, 'title-split');
  });
});

test('parseHints: never throws on empty/null input', function () {
  assert.doesNotThrow(function () { YtInfo.parseHints('', ''); });
  assert.doesNotThrow(function () { YtInfo.parseHints(null, null); });
  var h = YtInfo.parseHints(null, null);
  assert.strictEqual(h.key, null);
  assert.strictEqual(h.mode, null);
  assert.strictEqual(h.genre, null);
  assert.strictEqual(h.bpm, null);
});

/* ---- fetchInfo: network path mocked (fake fetch impl) ------------------ */
function fakeFetch(map) {
  return function (url) {
    for (var k in map) {
      if (url.indexOf(k) >= 0) return Promise.resolve({ ok: true, json: function () { return Promise.resolve(map[k]); } });
    }
    return Promise.resolve({ ok: false });
  };
}

test('fetchInfo: invalid url -> resolves null without ever calling fetch', function () {
  var called = false;
  return YtInfo.fetchInfo('not a url', { fetch: function () { called = true; return Promise.reject(new Error('should not be called')); } }).then(function (info) {
    assert.strictEqual(info, null);
    assert.strictEqual(called, false);
  });
});

test('fetchInfo: oEmbed (strategy A) succeeds -> returns title/author', function () {
  var impl = fakeFetch({ 'youtube.com/oembed': { title: 'A Minor Blues Backing Track', author_name: 'QuickTracks' } });
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: impl }).then(function (info) {
    assert.deepStrictEqual(info, { title: 'A Minor Blues Backing Track', author: 'QuickTracks' });
  });
});

test('fetchInfo: strategy A fails (network reject), strategy B (noembed) succeeds', function () {
  var impl = function (url) {
    if (url.indexOf('youtube.com/oembed') >= 0) return Promise.reject(new Error('CORS blocked'));
    if (url.indexOf('noembed.com') >= 0) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ title: 'Fallback Title', author_name: 'Fallback Channel' }); } });
    return Promise.resolve({ ok: false });
  };
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: impl }).then(function (info) {
    assert.deepStrictEqual(info, { title: 'Fallback Title', author: 'Fallback Channel' });
  });
});

test('fetchInfo: both endpoints fail -> resolves null, never throws', function () {
  var impl = function () { return Promise.resolve({ ok: false }); };
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: impl }).then(function (info) {
    assert.strictEqual(info, null);
  });
});

test('fetchInfo: both endpoints reject (offline) -> resolves null, never throws', function () {
  var impl = function () { return Promise.reject(new Error('offline')); };
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: impl }).then(function (info) {
    assert.strictEqual(info, null);
  });
});

test('fetchInfo: malformed JSON response (no title field) -> falls through, resolves null', function () {
  var impl = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } }); };
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: impl }).then(function (info) {
    assert.strictEqual(info, null);
  });
});

test('fetchInfo: no fetch implementation available -> resolves null (fail soft)', function () {
  return YtInfo.fetchInfo('https://youtu.be/dQw4w9WgXcQ', { fetch: null }).then(function (info) {
    assert.strictEqual(info, null);
  });
});

run();
