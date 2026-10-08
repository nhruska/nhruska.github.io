/* =====================================================================
 * song-sheet-wrap.test.js - U5 (ui-ux-polish-20261008): the song view's
 * practice sheet (#sheetBox) wraps chord-over-lyric rows at a MEASURED
 * character budget, exactly like the Stage, instead of overflowing sideways
 * inside its overflow-x:auto box (742px in a 329px box on Mr. Jones at
 * Pixel 5). This file locks the WIRING in the cheap node suite; the pixel
 * half is test/pw/scenarios/sheet-wraps-at-phone-width.json.
 *   a. the song-view render path passes a budget into renderSheet
 *   b. the Stage and the song view share ONE measurement helper
 *      (sheetWrapMaxChars) - no second probe
 *   c. the 'chords' view stays untouched; the resize listener re-fits
 *   d. the wrap contract the budget feeds (pure): every row fits, a chord
 *      stays over its word, a chord label is never split
 * Wiring assertions run against comment-STRIPPED source.
 * Run: node test/song-sheet-wrap.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
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

/* comment stripper (string-aware) so wiring asserts hit CODE, never prose */
function stripComments(src) {
  var out = '', i = 0, n = src.length, state = 'code', q = '';
  while (i < n) {
    var ch = src[i], nx = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && nx === '/' && src[i - 1] !== ':') { state = 'line'; i += 2; continue; }
      if (ch === '/' && nx === '*') { state = 'block'; i += 2; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { state = 'str'; q = ch; out += ch; i++; continue; }
      out += ch; i++; continue;
    }
    if (state === 'str') {
      if (ch === '\\') { out += ch + (nx || ''); i += 2; continue; }
      if (ch === q) state = 'code';
      out += ch; i++; continue;
    }
    if (state === 'line') { if (ch === '\n') { state = 'code'; out += ch; } i++; continue; }
    if (ch === '*' && nx === '/') { state = 'code'; i += 2; continue; }
    if (ch === '\n') out += ch;
    i++;
  }
  return out;
}
var sbCode = stripComments(fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8'));

test('(a) the song-view sheet is filled by fillSongSheet, which passes a measured budget into renderSheet', function () {
  var m = /function fillSongSheet\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'fillSongSheet not found');
  assert.ok(/sheetWrapMaxChars\(box\)/.test(m[0]), 'fillSongSheet does not measure the budget off the mounted sheet element');
  assert.ok(/renderSheet\([^)]*chars/.test(m[0]), 'fillSongSheet does not pass the budget into renderSheet');
  assert.ok(/box\.scrollWidth\s*<=\s*box\.clientWidth/.test(m[0]), 'fillSongSheet does not re-check the render fits and converge');
});

test('(a) renderPractice no longer pre-renders the Lyrics/Both sheet unwrapped (the gap U5 closes)', function () {
  var m = /function renderPractice\s*\(\)[\s\S]*?\n    \}\n/.exec(sbCode);
  assert.ok(m, 'renderPractice not found');
  assert.ok(!/class="sheet" id="sheetBox">'\s*\+\s*renderSheet\(/.test(m[0]),
    'renderPractice renders the sheet into innerHTML with no budget again (id="sheetBox">\' + renderSheet(...))');
  assert.ok(/fillSongSheet\(songSheetCtx\)/.test(m[0]), 'renderPractice never fills the sheet through fillSongSheet');
});

test("(c) the 'chords' campfire view is untouched: still rendered inline, still no budget, and never re-fit", function () {
  var m = /function renderPractice\s*\(\)[\s\S]*?\n    \}\n/.exec(sbCode);
  assert.ok(/renderSheet\(s, STATE\.transpose, 'chords', dispMap\)/.test(m[0]), "the 'chords' view render call changed");
  assert.ok(/view === 'chords' \? null/.test(m[0]), "the 'chords' view is no longer excluded from the budgeted fill");
});

test('(b) ONE measurement: the Stage and the song view both call sheetWrapMaxChars; there is no second probe', function () {
  assert.strictEqual((sbCode.match(/function sheetWrapMaxChars\s*\(/g) || []).length, 1, 'sheetWrapMaxChars must be defined exactly once');
  assert.ok(!/perfWrapMaxChars/.test(sbCode), 'the Stage-only perfWrapMaxChars is back - a second measurement');
  var stage = /function fitStageSheet\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(stage && /sheetWrapMaxChars\(pSheet\)/.test(stage[0]), 'fitStageSheet does not use the shared helper');
  var song = /function fillSongSheet\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(song && /sheetWrapMaxChars\(box\)/.test(song[0]), 'fillSongSheet does not use the shared helper');
  // the char-width probe (a hidden '0123456789' .lyrLine) exists once only
  assert.strictEqual((sbCode.match(/'0123456789'/g) || []).length, 1, 'a second char-width probe exists');
});

test('(c) the shared helper keeps the CORE INVARIANT: the budget always exists (floor 1), never null from a size bail', function () {
  var m = /function sheetWrapMaxChars\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'sheetWrapMaxChars not found');
  assert.ok(/Math\.max\(\s*1\s*,\s*chars\s*\)/.test(m[0]), 'budget no longer floors at 1');
});

test('(c) the debounced window resize listener re-fits the song view (only when mounted, visible, width changed)', function () {
  var m = /stageResizeTimer = setTimeout\([\s\S]*?\}, 150\);/.exec(sbCode);
  assert.ok(m, 'stage resize timer not found');
  assert.ok(/songSheetCtx/.test(m[0]), 'the resize listener does not touch the song-view sheet');
  assert.ok(/isConnected/.test(m[0]) && /clientWidth\s*>\s*0/.test(m[0]) && /clientWidth\s*!==/.test(m[0]),
    'the song-view re-fit is not guarded on mounted + visible + width changed');
  assert.ok(/fillSongSheet\(sc\)/.test(m[0]), 'the resize listener never re-fills the sheet');
});

test('(d) the budget feeds a wrap that fits: a long Mr. Jones-style line splits to rows no wider than the budget', function () {
  var song = { sheet: [['Verse', '[Bb]Mr. Jones strikes up a [F]conversation with a black-haired [Bb]flamenco dancer while they were [F]dancing'], ['', '[Gm]Cut through the [Bb]night']] };
  var budget = 31; // ~ (329 - 2) / 10.5px per char at Pixel 5
  var html = SR.renderSheet(song, 0, 'both', null, budget);
  var rows = html.split('<div class="lyrLine">').slice(1);
  assert.ok(rows.length > 2, 'the long line did not wrap (' + rows.length + ' rows)');
  rows.forEach(function (r) {
    var body = r.replace(/<\/div>.*$/, '').replace(/<[^>]+>/g, '');
    body.split('\n').forEach(function (line) {
      assert.ok(line.length <= budget, 'a wrapped row is ' + line.length + ' chars, over the budget ' + budget + ': ' + JSON.stringify(line));
    });
  });
});

test('(d) wrapping never splits a chord label and keeps the chord in its column over its word', function () {
  var rows = SR.wrapChordLyricPair('Bb        F          Bb', 'Mr. Jones strikes a conversation with a dancer', 20);
  rows.forEach(function (r) {
    assert.ok(r.chord.length <= 20 && r.lyric.length <= 20, 'row over budget');
  });
  var joined = rows.map(function (r) { return r.chord; }).join(' ');
  assert.ok(/Bb/.test(joined) && /\bF\b/.test(joined), 'a chord label was lost or split: ' + JSON.stringify(rows));
});

run();
