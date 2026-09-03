/* =====================================================================
 * sheet-render.test.js - unit tests for sheet-render.js's pure chord-over-
 * lyric wrapping (CW-1: a long line must WRAP, not hard-overflow the stage
 * viewport, while staying column-aligned). No DOM needed - wrapChordLyricPair
 * and renderLyricLine's wrap path are pure string math; the DOM caller
 * (songbook.js showPerform/perfWrapMaxChars) measures the real viewport and
 * passes maxChars in. Mirrors the fitScale Node-testability precedent.
 * Run: node test/sheet-render.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
var SR = require('../music/shared/sheet-render.js');

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

/* ---------- wrapChordLyricPair: the pure column-synced split ---------- */

test('wrapChordLyricPair: a pair that fits within maxChars returns a single unchunked row', function () {
  var rows = SR.wrapChordLyricPair('  C   ', 'Hi there', 20);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].chord, '  C   ');
  assert.strictEqual(rows[0].lyric, 'Hi there');
});

test('wrapChordLyricPair: splits at the last lyric-row space within the window - never mid-word', function () {
  // lyricRow: "Have you ever seen the rain" (28 chars). maxChars=12 forces a
  // split; the last space at/before index 12 is at index 8 ("you ") - keep
  // splitting until every chunk's LYRIC half never contains a broken word.
  var chord = '                            ';
  var lyric = 'Have you ever seen the rain';
  var rows = SR.wrapChordLyricPair(chord, lyric, 12);
  rows.forEach(function (r) {
    assert.ok(!/\s\S+$/.test(r.lyric) || r.lyric.trim().split(/\s+/).every(function (w) { return lyric.indexOf(w) >= 0; }),
      'no fragment word outside the original vocabulary: ' + JSON.stringify(r.lyric));
  });
  // no lyric chunk boundary lands inside a word (each chunk's lyric, once
  // rejoined with single spaces, reproduces the original word sequence)
  var rejoined = rows.map(function (r) { return r.lyric; }).join(' ').replace(/\s+/g, ' ').trim();
  assert.strictEqual(rejoined, lyric);
});

test('wrapChordLyricPair: every cut index is applied identically to both rows (column sync)', function () {
  var chord = '   Am          F   ';
  var lyric = 'a really long lyric line here';
  var rows = SR.wrapChordLyricPair(chord, lyric, 10);
  assert.ok(rows.length > 1, 'expected the line to actually wrap');
  rows.forEach(function (r) {
    // chordRow is always <= lyricRow.length by construction (sheet-render.js
    // header comment) - a chunk's chord half can be shorter than its lyric
    // half, never longer.
    assert.ok(r.chord.length <= r.lyric.length, 'chord chunk must not exceed its lyric chunk: ' + JSON.stringify(r));
  });
});

test('wrapChordLyricPair: a single run with no spaces anywhere in the window hard-cuts (last resort, like CSS overflow-wrap:anywhere)', function () {
  var chord = '';
  var lyric = 'supercalifragilisticexpialidocious';
  var rows = SR.wrapChordLyricPair(chord, lyric, 10);
  assert.ok(rows.length > 1);
  assert.strictEqual(rows.map(function (r) { return r.lyric; }).join(''), lyric, 'hard-cut chunks concatenate back to the original unbroken token');
  rows.forEach(function (r) { assert.ok(r.lyric.length <= 10); });
});

test('wrapChordLyricPair: chordRow shorter than lyricRow (trailing lyric-only tail) never crashes and the tail chunk has an empty chord', function () {
  // renderLyricLine only extends chordRow through the LAST chord match - any
  // lyric after that has no corresponding chord annotation.
  var chord = '  C   ';           // "  C   " (6 chars) - stops after the chord
  var lyric = 'a word tail with lots more words after the last chord';
  var rows = SR.wrapChordLyricPair(chord, lyric, 8);
  var last = rows[rows.length - 1];
  assert.strictEqual(last.chord, '', 'the final chunk is entirely past chordRow.length - empty chord half');
  assert.strictEqual(rows.map(function (r) { return r.lyric; }).join(' ').replace(/\s+/g, ' ').trim(), lyric);
});

test('wrapChordLyricPair: terminates (bounded chunk count) even for a pathological all-space lyric row', function () {
  var lyric = new Array(50).join(' '); // 49 spaces, no words at all
  var rows = SR.wrapChordLyricPair('', lyric, 5);
  assert.ok(rows.length < 60, 'must not loop unboundedly');
});

/* ---------- renderLyricLine: the maxChars-aware HTML wiring ---------- */

test('renderLyricLine: no maxChars (default/omitted) renders the original single unbroken pre-line - fully backward compatible', function () {
  var html = SR.renderLyricLine('[C]Hello [G]world');
  assert.strictEqual((html.match(/class="lyrLine"/g) || []).length, 1);
  assert.strictEqual((html.match(/class="crd"/g) || []).length, 1);
  assert.ok(html.indexOf('Hello') >= 0 && html.indexOf('world') >= 0);
});

test('renderLyricLine: content within maxChars renders as a single .lyrLine (no needless wrap)', function () {
  var html = SR.renderLyricLine('[C]Hi', null, 200);
  assert.strictEqual((html.match(/class="lyrLine"/g) || []).length, 1);
});

test('renderLyricLine: content over maxChars renders MULTIPLE .lyrLine rows, each independently escaped/well-formed', function () {
  var raw = '[C]Have you ever seen the [G]rain coming down on a [Am]sunny day watching it all [F]wash away every single one of my [C]dreams from yesterday and the [G]day before that too';
  var html = SR.renderLyricLine(raw, null, 40);
  var lineCount = (html.match(/class="lyrLine"/g) || []).length;
  assert.ok(lineCount > 1, 'expected multiple wrapped rows, got ' + lineCount);
  // every wrapped .lyrLine still carries its own .crd chord span
  assert.strictEqual((html.match(/class="crd"/g) || []).length, lineCount);
  // no row's rendered text exceeds maxChars (chord half is always <= lyric half)
  var lyrLineBodies = html.split('<div class="lyrLine">').slice(1);
  lyrLineBodies.forEach(function (body) {
    var lyricPart = body.split('</span>\n')[1].split('</div>')[0];
    assert.ok(lyricPart.length <= 40, 'row exceeds maxChars: ' + JSON.stringify(lyricPart));
  });
});

test('renderLyricLine: wrapping never drops or reorders words - the wrapped lyric text rejoins to the original', function () {
  var raw = '[C]one two three [G]four five six seven eight nine ten eleven twelve thirteen fourteen';
  var html = SR.renderLyricLine(raw, null, 15);
  // strip tags, collapse the chord-row lines out by keeping only text after each \n that isn't the crd span
  var lyricOnly = html.replace(/<div class="lyrLine"><span class="crd">[^<]*<\/span>\n/g, '').replace(/<\/div>/g, ' ');
  var words = lyricOnly.replace(/\s+/g, ' ').trim().split(' ');
  assert.deepStrictEqual(words, ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen']);
});

test('renderLyricLine: wrapping still escapes hostile content per-chunk (no XSS seam introduced by the split)', function () {
  var raw = '[C]<script>alert(1)<' + '/script> and then some more words to force a wrap past the chunk boundary right here';
  var html = SR.renderLyricLine(raw, null, 20);
  assert.strictEqual(html.indexOf('<script>alert'), -1);
  assert.ok(html.indexOf('&lt;script&gt;') >= 0);
});

test('renderSheet: threads maxChars to BOTH the "both" and "lyrics" views; only "chords" ignores it', function () {
  // VOLLEY-2 nit: the old title claimed the lyrics view ignored maxChars,
  // contradicting renderSheet, which passes it into renderLyricsOnly. The
  // lyrics view renders white-space:pre rows and has to wrap at the budget
  // exactly like 'both' does - so the claim was not just mis-worded, it was
  // an untested path described as a non-path.
  var song = { sheet: [['Verse', '[C]a very long line of words that will definitely need to wrap given a small maxChars budget here']] };
  var wrapped = SR.renderSheet(song, 0, 'both', null, 15);
  assert.ok((wrapped.match(/class="lyrLine"/g) || []).length > 1, 'both view must wrap at the budget');
  var lyricsView = SR.renderSheet(song, 0, 'lyrics', null, 15);
  assert.ok((lyricsView.match(/class="lyrLine"/g) || []).length > 1,
    'lyrics view must ALSO wrap at the budget - renderSheet threads maxChars into renderLyricsOnly');
  var lyricsUnbudgeted = SR.renderSheet(song, 0, 'lyrics', null);
  assert.strictEqual((lyricsUnbudgeted.match(/class="lyrLine"/g) || []).length, 1,
    'with no budget the lyrics view renders one unbroken row - proving the wrap above came from maxChars');
  var chordsView = SR.renderSheet(song, 0, 'chords', null, 15);
  assert.strictEqual(chordsView.indexOf('lyrLine'), -1, 'chords view has no .lyrLine at all, maxChars is a no-op for it');
});

/* ---- UAT batch 3 item 6: the large sheet chord chips are real, playable ----
 * "large chord chips on song details view - make them clickable like all
 * others". They used to be inert <span class="bar">DISPLAY</span> - the display
 * name only, so nothing downstream could even know WHICH chord to play. The
 * contract that makes them wirable is the same one .chordChips .c already uses:
 * a <button> carrying the CANONICAL, already-transposed token in data-c, and
 * the key-aware name as its text/aria-label.
 * --------------------------------------------------------------------- */
test('chords view emits a real button per chord, not an inert span', function () {
  var song = { sheet: [['Verse', '[C]hello [G]world']] };
  var out = SR.renderSheet(song, 0, 'chords', null);
  assert.strictEqual(out.indexOf('<span class="bar"'), -1, 'the inert span form must be gone entirely');
  assert.ok(/<button type="button" class="bar" data-c="C" aria-label="Play C">C<\/button>/.test(out), 'C renders as a typed button carrying its token');
  assert.strictEqual((out.match(/class="bar"/g) || []).length, 2, 'one chip per chord token on the line');
});

test('data-c carries the CANONICAL token while the label carries the key-aware name', function () {
  // The discriminating fixture: a display map that CHANGES the name. If data-c
  // were built from the label (or the label from the token), one of the two
  // assertions below is impossible to satisfy - which is the whole point.
  var song = { sheet: [['Verse', '[A#]one']] };
  var out = SR.renderSheet(song, 0, 'chords', function (c) { return c === 'A#' ? 'Bb' : c; });
  assert.ok(/data-c="A#"/.test(out), 'audio/storage side gets the canonical sharp token');
  assert.ok(/aria-label="Play Bb">Bb</.test(out), 'the human-visible side gets the key-aware spelling');
});

test('data-c is the TRANSPOSED token - what actually sounds, not the source chord', function () {
  var song = { sheet: [['Verse', '[C]one']] };
  var out = SR.renderSheet(song, 2, 'chords', null);
  assert.ok(/data-c="D"/.test(out), 'C transposed +2 stores D, so a tap plays what the screen shows');
  assert.strictEqual(out.indexOf('data-c="C"'), -1, 'the untransposed token must not survive into the chip');
});

test('a hostile chord token cannot break out of the data-c attribute', function () {
  var song = { sheet: [['Verse', '[C" onclick="x]one']] };
  var out = SR.renderSheet(song, 0, 'chords', null);
  assert.strictEqual(out.indexOf('" onclick="x'), -1, 'the raw quote+handler must be escaped, never emitted live');
});

run();
