/* =====================================================================
 * repertoire-form.test.js  -  unit tests for the M2 Add/Edit form's pure
 * field-parsing helpers (repertoire-form.js). DOM-building (mount/open) is
 * exercised via Playwright at integration; these cover the pure logic only.
 * Run: node test/repertoire-form.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var RF = require('../music/shared/repertoire-form.js');

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

test('parseSeq splits on whitespace and commas, trims, drops empties', function () {
  assert.deepStrictEqual(RF.parseSeq('G  D, Em ,C'), ['G', 'D', 'Em', 'C']);
});
test('parseSeq of empty/blank input -> [] (a standalone video-only track)', function () {
  assert.deepStrictEqual(RF.parseSeq(''), []);
  assert.deepStrictEqual(RF.parseSeq('   '), []);
  assert.deepStrictEqual(RF.parseSeq(undefined), []);
});
test('seqToText round-trips parseSeq output back to a space-joined string', function () {
  var seq = RF.parseSeq('Am F C G');
  assert.strictEqual(RF.seqToText(seq), 'Am F C G');
  assert.strictEqual(RF.seqToText([]), '');
  assert.strictEqual(RF.seqToText(null), '');
});

// readFields needs a minimal fake form (querySelector over a fixed field map) -
// exercises the exact field set songbook.js's createCustomItem/updateCustomItem consume.
function fakeForm(values) {
  var map = {
    '[data-title]': values.title, '[data-artist]': values.artist, '[data-key]': values.key,
    '[data-mode]': values.mode, '[data-genre]': values.genre, '[data-seq]': values.seq, '[data-url]': values.url
  };
  return { querySelector: function (sel) { return { value: map[sel] != null ? map[sel] : '' }; } };
}
function fakeParseYouTubeId(url) {
  var m = /(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})/.exec(url || '');
  return m ? m[1] : null;
}

test('readFields: full create-mode form (song, no video)', function () {
  var f = RF.readFields(fakeForm({ title: 'New Song', artist: 'Me', key: 'G', mode: 'major', genre: 'rock', seq: 'G D Em C', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.title, 'New Song');
  assert.strictEqual(f.key, 'G');
  assert.strictEqual(f.mode, 'major');
  assert.deepStrictEqual(f.seq, ['G', 'D', 'Em', 'C']);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, false);
});
test('readFields: minor mode + no chords -> a standalone track (empty seq)', function () {
  var f = RF.readFields(fakeForm({ title: 'Jam track', artist: '', key: 'A', mode: 'minor', genre: '', seq: '', url: 'https://youtu.be/dQw4w9WgXcQ' }), fakeParseYouTubeId);
  assert.strictEqual(f.mode, 'minor');
  assert.deepStrictEqual(f.seq, []);
  assert.strictEqual(f.yt, 'dQw4w9WgXcQ');
});
test('readFields: an invalid pasted URL is flagged, not silently dropped', function () {
  var f = RF.readFields(fakeForm({ title: 'X', artist: '', key: '', mode: 'major', genre: '', seq: '', url: 'not a url' }), fakeParseYouTubeId);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, true);
});
test('readFields: no video field at all is valid (optional field)', function () {
  var f = RF.readFields(fakeForm({ title: 'X', artist: '', key: '', mode: 'major', genre: '', seq: '', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, false);
});

run();
