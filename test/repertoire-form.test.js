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

/* ---- 4-mode round-trip (the modal-rewrite bug: a major/minor-only select
 * silently rewrote dorian/mixolydian songs to major on every edit) ---- */
test('normFormMode round-trips the full 4-mode vocabulary', function () {
  assert.strictEqual(RF.normFormMode('dorian'), 'dorian');
  assert.strictEqual(RF.normFormMode('Mixolydian'), 'mixolydian');
  assert.strictEqual(RF.normFormMode('minor'), 'minor');
  assert.strictEqual(RF.normFormMode('MAJOR'), 'major');
  assert.strictEqual(RF.normFormMode(''), 'major');
  assert.strictEqual(RF.normFormMode(null), 'major');
  assert.strictEqual(RF.normFormMode('locrian'), 'major'); // outside the form vocabulary -> safe default
});
test('MODES is the locked 4-mode vocabulary the select renders', function () {
  assert.deepStrictEqual(RF.MODES, ['major', 'minor', 'dorian', 'mixolydian']);
});
test('readFields round-trips a dorian item without rewriting it to major', function () {
  var f = RF.readFields(fakeForm({ title: 'Modal jam', artist: '', key: 'A', mode: 'dorian', genre: '', seq: 'Am D', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.mode, 'dorian');
});
test('readFields in FORK mode (no Chords field) leaves seq undefined, not a crash or []', function () {
  // fork mode hides [data-seq]; querySelector returns null. readFields must NOT
  // throw and must NOT emit an empty seq that would clobber the preserved sheet.
  var form = { querySelector: function (sel) {
    if (sel === '[data-seq]') return null;
    var map = { '[data-title]': 'Let It Be', '[data-artist]': 'The Beatles', '[data-key]': 'C', '[data-mode]': 'major', '[data-genre]': '', '[data-url]': '' };
    return { value: map[sel] != null ? map[sel] : '' };
  } };
  var f = RF.readFields(form, fakeParseYouTubeId);
  assert.strictEqual(f.seq, undefined);
  assert.strictEqual(f.title, 'Let It Be');
});

/* ---- applicableYtHints (U17, M-TRACKLIB w2a): apply-to-empty-only ------
 * DOM wiring (wireYtSuggest) is Playwright/live-check territory (per this
 * file's header note); this covers the pure decision logic it delegates to. */
test('applicableYtHints: all fields empty -> every non-null hint is applicable', function () {
  var out = RF.applicableYtHints(
    { t: 'A Minor Blues Backing Track', a: 'QuickTracks', key: 'A', mode: 'minor', genre: 'blues', bpm: 80 },
    { title: '', artist: '', key: '', mode: 'major', genre: '' }
  );
  assert.deepStrictEqual(out, { title: 'A Minor Blues Backing Track', artist: 'QuickTracks', key: 'A', mode: 'minor', genre: 'blues' });
});
test('applicableYtHints: a field the operator already typed into is NEVER overwritten', function () {
  var out = RF.applicableYtHints(
    { t: 'Suggested Title', a: 'Suggested Artist', key: 'G', mode: 'dorian', genre: 'funk' },
    { title: 'My Own Title', artist: '', key: '', mode: 'major', genre: '' }
  );
  assert.strictEqual(out.title, undefined);
  assert.strictEqual(out.artist, 'Suggested Artist');
  assert.strictEqual(out.key, 'G');
});
test('applicableYtHints: key select already has a value -> key hint withheld', function () {
  var out = RF.applicableYtHints({ t: null, a: null, key: 'D', mode: null, genre: null }, { key: 'C', mode: 'major' });
  assert.strictEqual(out.key, undefined);
});
test('applicableYtHints: mode select already off its default -> mode hint withheld', function () {
  var out = RF.applicableYtHints({ mode: 'mixolydian' }, { mode: 'dorian' });
  assert.strictEqual(out.mode, undefined);
});
test('applicableYtHints: mode select still at the untouched default -> mode hint applies', function () {
  var out = RF.applicableYtHints({ mode: 'mixolydian' }, { mode: 'major' });
  assert.strictEqual(out.mode, 'mixolydian');
});
test('applicableYtHints: no hints at all -> empty applicable set', function () {
  assert.deepStrictEqual(RF.applicableYtHints({}, { title: '', artist: '', key: '', mode: 'major', genre: '' }), {});
});
test('applicableYtHints: whitespace-only existing value counts as empty', function () {
  var out = RF.applicableYtHints({ genre: 'rock' }, { genre: '   ' });
  assert.strictEqual(out.genre, 'rock');
});

run();
