/* =====================================================================
 * jam-link.test.js - S14 agent-interaction spec 4b: the `?jam=` deep-link
 * parser (music/shared/jam-link.js). Locked contract: chord tokens stay
 * canonical-sharp, key tonic is NOT re-spelled, yt accepts id or URL, any
 * invalid chord token drops the whole jam (never a partial groove), and
 * parse() never throws.
 * Run: node test/jam-link.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var JamLink = require('../music/shared/jam-link.js');

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

test('happy path: jam + key parse into canonical shape', function () {
  var r = JamLink.parse('?jam=Am,F,C,G&key=Am');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.setup.chords, ['Am', 'F', 'C', 'G']);
  assert.deepStrictEqual(r.setup.key, { tonic: 'A', minor: true });
  assert.strictEqual(r.setup.yt, null);
  assert.strictEqual(r.setup.name, null);
});

test('minor key marker parses; major key has no marker', function () {
  assert.deepStrictEqual(JamLink.parse('?jam=C&key=Am').setup.key, { tonic: 'A', minor: true });
  assert.deepStrictEqual(JamLink.parse('?jam=C&key=G').setup.key, { tonic: 'G', minor: false });
});

test('sharp chord tokens survive verbatim; percent-encoded # decodes', function () {
  var r = JamLink.parse('?jam=A%23m,E');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.setup.chords, ['A#m', 'E']);
});

test('flat chord ROOTS normalize to canonical-sharp for identity', function () {
  var r = JamLink.parse('?jam=Bb,Eb,Ab7,Db,Gb&key=Bb');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.setup.chords, ['A#', 'D#', 'G#7', 'C#', 'F#']);
  // key TONIC is display, not re-spelled - stays exactly what was given.
  assert.strictEqual(r.setup.key.tonic, 'Bb');
});

test('yt: bare 11-char video id', function () {
  var r = JamLink.parse('?yt=dQw4w9WgXcQ');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.setup.yt, 'dQw4w9WgXcQ');
});

test('yt: youtu.be short URL', function () {
  var r = JamLink.parse('?yt=' + encodeURIComponent('https://youtu.be/dQw4w9WgXcQ'));
  assert.strictEqual(r.setup.yt, 'dQw4w9WgXcQ');
});

test('yt: full watch URL with a v= query param', function () {
  var r = JamLink.parse('?yt=' + encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'));
  assert.strictEqual(r.setup.yt, 'dQw4w9WgXcQ');
});

test('yt: embed URL form', function () {
  var r = JamLink.parse('?yt=' + encodeURIComponent('https://www.youtube.com/embed/dQw4w9WgXcQ'));
  assert.strictEqual(r.setup.yt, 'dQw4w9WgXcQ');
});

test('yt: unrecognizable value -> null, never rejects the rest', function () {
  var r = JamLink.parse('?jam=C,G&yt=' + encodeURIComponent('https://example.com/not-a-video'));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.setup.yt, null);
  assert.deepStrictEqual(r.setup.chords, ['C', 'G']);
});

test('name: URL-decoded and trimmed', function () {
  var r = JamLink.parse('?jam=C&name=' + encodeURIComponent('  ii-V-I in G  '));
  assert.strictEqual(r.setup.name, 'ii-V-I in G');
});

test('name: blank/whitespace-only -> null', function () {
  assert.strictEqual(JamLink.parse('?jam=C&name=' + encodeURIComponent('   ')).setup.name, null);
  assert.strictEqual(JamLink.parse('?jam=C').setup.name, null);
});

test('invalid chord token drops the ENTIRE jam - no partial progression', function () {
  var r = JamLink.parse('?jam=C,Hm,G&key=G');
  assert.strictEqual(r.ok, true); // key still usable
  assert.deepStrictEqual(r.setup.chords, []);
  assert.deepStrictEqual(r.setup.key, { tonic: 'G', minor: false });
});

test('a stray empty token (double comma) also drops the whole jam', function () {
  var r = JamLink.parse('?jam=C,,G');
  assert.strictEqual(r.ok, false); // nothing else usable either
});

test('empty jam param with a valid key still parses that key', function () {
  var r = JamLink.parse('?jam=&key=Am');
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.setup.chords, []);
  assert.deepStrictEqual(r.setup.key, { tonic: 'A', minor: true });
});

test('malformed key -> null, never throws, never rejects jam', function () {
  var r = JamLink.parse('?jam=C,G&key=Zzz');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.setup.key, null);
});

test('empty search string -> ok:false', function () {
  assert.deepStrictEqual(JamLink.parse(''), { ok: false });
});

test('absent params (no jam/key/yt/name at all) -> ok:false', function () {
  assert.deepStrictEqual(JamLink.parse('?welcome=1'), { ok: false });
  assert.deepStrictEqual(JamLink.parse(null), { ok: false });
  assert.deepStrictEqual(JamLink.parse(undefined), { ok: false });
});

test('never throws on garbage input', function () {
  assert.doesNotThrow(function () { JamLink.parse('garbage'); });
  assert.doesNotThrow(function () { JamLink.parse('???&&&==='); });
  assert.doesNotThrow(function () { JamLink.parse(12345); });
  assert.doesNotThrow(function () { JamLink.parse({}); });
  assert.doesNotThrow(function () { JamLink.parse(['a', 'b']); });
});

test('a full realistic deep link (all four params)', function () {
  var qs = '?jam=' + encodeURIComponent('Dm7,G7,Cmaj7') + '&key=C&yt=dQw4w9WgXcQ&name=' + encodeURIComponent('ii-V-I in C');
  var r = JamLink.parse(qs);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.setup, {
    chords: ['Dm7', 'G7', 'Cmaj7'],
    key: { tonic: 'C', minor: false },
    yt: 'dQw4w9WgXcQ',
    name: 'ii-V-I in C'
  });
});

run();
