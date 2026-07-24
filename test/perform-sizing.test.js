/* =====================================================================
 * perform-sizing.test.js - goalpost tests for the Perform sheet's
 * WRAP-FIRST sizing model (operator-approved spec, 2026-07-24 interview).
 * The shrink-vs-wrap behavior regressed 4 times; these are the
 * never-regress gate for the model itself:
 *   1. Wrap-first: NO shrink-to-fit-width auto behavior, no 0.5x
 *      illegibility floor - the font is user-controlled and floors at a
 *      LEGIBLE 0.8x (~13px effective).
 *   2. Pinch-to-zoom exists alongside the +/- buttons, both re-wrap.
 *   3. Font size persists (perfprefs carries fontScale).
 *   4. Any width-affecting change (font step, pinch end, resize/rotate)
 *      recomputes the wrap via the one shared fitStageSheet path.
 * The pixel-level halves of these goalposts live in the pw scenarios
 * (perform-readable-floor.json, perform-font-step-pinch-rewrap.json,
 * perform-font-persist.json, perform-*-orientation*.json); this file
 * locks the WIRING and the pure clamp so a regression fails in the cheap
 * node suite too. Wiring assertions run against comment-STRIPPED source -
 * a comment mentioning "fitScale" or "fontMode" must never satisfy or
 * trip them (assert against code, not prose).
 * Run: node test/perform-sizing.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
require('../music/shared/list-item.js');
require('../music/shared/toast.js');
var Songbook = require('../music/shared/songbook.js');
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

/* ---------- comment stripper (so wiring asserts hit CODE, never prose) ----------
 * Tracks '/" /` string state so a // inside a string literal never eats the
 * rest of the line, and a :// (URL) is never mistaken for a comment. Regex
 * literals are not modeled - none of the stripped files carry an unescaped
 * // or unclosed /* inside one (verified by the sanity test below). */
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
    /* block */
    if (ch === '*' && nx === '/') { state = 'code'; i += 2; continue; }
    if (ch === '\n') out += ch; // keep line numbers roughly stable for debugging
    i++;
  }
  return out;
}

var songbookSrc = fs.readFileSync(path.join(__dirname, '../music/shared/songbook.js'), 'utf8');
var sheetSrc = fs.readFileSync(path.join(__dirname, '../music/shared/sheet-render.js'), 'utf8');
var sbCode = stripComments(songbookSrc);
var srCode = stripComments(sheetSrc);

test('sanity: the stripper removes comments but keeps code (self-check both directions)', function () {
  var s = stripComments("var a = 1; // fitScale in a comment\n/* fontMode prose */ var b = 'https://x//y';");
  assert.ok(s.indexOf('fitScale') === -1, 'line comment not stripped');
  assert.ok(s.indexOf('fontMode') === -1, 'block comment not stripped');
  assert.ok(s.indexOf("'https://x//y'") !== -1, 'string with // must survive');
  assert.ok(s.indexOf('var b') !== -1, 'code after a URL string must survive');
});

/* ---------- goalpost 1: the shrink-to-fit model is GONE ---------- */

test('wrap-first: songbook.js code no longer calls fitScale (shrink-to-fit-width removed)', function () {
  assert.ok(!/\bfitScale\b/.test(sbCode),
    'songbook.js code still references fitScale - the shrink-to-fit auto model is back');
});

test('wrap-first: sheet-render.js no longer defines fitScale (no 0.5x floor anywhere)', function () {
  assert.ok(!/\bfunction\s+fitScale\b/.test(srCode) && !/\bfitScale\s*:/.test(srCode),
    'sheet-render.js still defines/exports fitScale');
  assert.ok(!/Math\.max\(0\.5,/.test(srCode), 'the 0.5x illegibility floor is still in sheet-render.js');
});

test('wrap-first: no fontMode auto/manual split remains - the size is simply user-controlled', function () {
  assert.ok(!/\bfontMode\b/.test(sbCode),
    'songbook.js code still carries fontMode - the auto-fit mode machinery is back');
});

/* ---------- goalpost 1b: the legibility floor (pure clamp) ---------- */

test('clampFontScale: floors at 0.8 (legible, ~13px effective at the 1.04rem base) - never the old 0.5', function () {
  assert.strictEqual(typeof Songbook.clampFontScale, 'function', 'clampFontScale not exported');
  assert.strictEqual(Songbook.clampFontScale(0.5), 0.8);
  assert.strictEqual(Songbook.clampFontScale(0.79), 0.8);
  assert.strictEqual(Songbook.clampFontScale(0), 0.8);
  assert.strictEqual(Songbook.clampFontScale(-3), 0.8);
});

test('clampFontScale: caps at 2.2 and passes sane values through', function () {
  assert.strictEqual(Songbook.clampFontScale(9), 2.2);
  assert.strictEqual(Songbook.clampFontScale(2.2), 2.2);
  assert.strictEqual(Songbook.clampFontScale(1), 1);
  assert.strictEqual(Songbook.clampFontScale(1.3), 1.3);
  assert.strictEqual(Songbook.clampFontScale(0.8), 0.8);
});

test('clampFontScale: a non-finite / non-number input lands on the neutral 1 (defensive perfprefs restore)', function () {
  assert.strictEqual(Songbook.clampFontScale(NaN), 1);
  assert.strictEqual(Songbook.clampFontScale(Infinity), 1);
  assert.strictEqual(Songbook.clampFontScale(undefined), 1);
  assert.strictEqual(Songbook.clampFontScale('big'), 1);
});

/* ---------- goalpost 2: pinch + buttons, both re-wrap ---------- */

test('re-wrap wiring: stepFont routes through the shared refit path (fitStageSheet), not a bare rescale', function () {
  var m = /function stepFont\s*\(([\s\S]*?)\n    \}/.exec(sbCode);
  assert.ok(m, 'stepFont not found in songbook.js code');
  assert.ok(/refitStage|fitStageSheet/.test(m[0]),
    'stepFont does not re-wrap: its body never reaches fitStageSheet (a font step changes the char budget, so it MUST re-wrap, not just rescale)');
});

test('pinch wiring: pSheet has touchstart/touchmove pinch handlers and the gesture end re-wraps + persists', function () {
  assert.ok(/addEventListener\(\s*'touchstart'/.test(sbCode), 'no touchstart pinch handler');
  assert.ok(/addEventListener\(\s*'touchmove'/.test(sbCode), 'no touchmove pinch handler');
  assert.ok(/addEventListener\(\s*'touchend'/.test(sbCode), 'no touchend pinch handler');
  // the end-of-gesture path must both re-wrap and save
  var endm = /var pinchEnd = function[\s\S]*?\};/.exec(sbCode);
  assert.ok(endm, 'pinchEnd handler not found');
  assert.ok(/refitStage|fitStageSheet/.test(endm[0]), 'pinch end does not re-wrap');
  assert.ok(/savePerfPrefs/.test(endm[0]), 'pinch end does not persist the size');
});

/* ---------- goalpost 3: persistence ---------- */

test('persistence wiring: savePerfPrefs writes fontScale (size sticks across songs AND sessions)', function () {
  var m = /function savePerfPrefs\s*\(\)[\s\S]*?\}/.exec(sbCode);
  assert.ok(m, 'savePerfPrefs not found');
  assert.ok(/fontScale/.test(m[0]),
    'savePerfPrefs does not persist fontScale - Stage would reset the size every open again');
});

test('persistence wiring: STATE seeds fontScale from the loaded perfprefs through the clamp (bad stored values cannot render below the floor)', function () {
  var m = /var STATE = \{[\s\S]*?fontScale:\s*([^,\n]+)[,\n]/.exec(sbCode);
  assert.ok(m, 'STATE fontScale init not found');
  assert.ok(/clampFontScale/.test(m[1]), 'STATE.fontScale init does not clamp the restored perfprefs value: ' + m[1]);
  assert.ok(/_pp\.fontScale/.test(m[1]), 'STATE.fontScale init does not read the persisted perfprefs fontScale: ' + m[1]);
});

test('persistence wiring: startPerform no longer force-resets the size on every Stage open', function () {
  var m = /function startPerform\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'startPerform not found');
  assert.ok(!/fontScale\s*=\s*1/.test(m[0]),
    'startPerform still resets fontScale to 1 on open - the persisted size would never be seen');
});

/* ---------- goalpost 4: any width change re-wraps via the one shared path ---------- */

test('resize/rotate wiring: refitStage IS the shared path - its body reaches fitStageSheet', function () {
  var m = /function refitStage\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'refitStage not found');
  assert.ok(/fitStageSheet/.test(m[0]), 'refitStage does not call fitStageSheet');
});

test('resize/rotate wiring: the resize listener re-fits whenever the stage is open (no mode gate a manual size could hide behind)', function () {
  var m = /addEventListener\(\s*'resize'[\s\S]*?\}\s*,\s*150\s*\)/.exec(sbCode);
  assert.ok(m, 'stage resize listener not found');
  assert.ok(/refitStage|fitStageSheet/.test(m[0]), 'resize listener does not reach the shared refit path');
  assert.ok(!/fontMode/.test(m[0]), 'resize listener still gates on fontMode');
});

test('wrap-always wiring: fitStageSheet computes the wrap budget up front (wrap-first), not only after an overflow is observed', function () {
  var m = /function fitStageSheet\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'fitStageSheet not found');
  var body = m[0];
  var budgetIdx = body.indexOf('perfWrapMaxChars');
  var renderIdx = body.indexOf('renderSheet');
  assert.ok(budgetIdx !== -1 && renderIdx !== -1, 'fitStageSheet missing budget/render calls');
  assert.ok(budgetIdx < renderIdx,
    'fitStageSheet only wraps reactively (budget computed after the first render) - wrap-first means the budget is computed BEFORE the first render');
});

/* ---------- lyrics-only view: same wrap-first contract (no chord row to align, still must not clip) ---------- */

test('renderLyricsOnly wraps a long lyrics-only line at maxChars (no white-space:pre overflow in the lyrics view)', function () {
  var line = 'Have you ever seen the rain coming down on a sunny day watching it all wash away';
  var html = SR.renderLyricsOnly([['Chorus', line]], 20);
  var rows = html.match(/class="lyrLine"/g) || [];
  assert.ok(rows.length > 1, 'a ' + line.length + '-char lyrics-only line did not wrap at maxChars=20 (got ' + rows.length + ' row)');
  // and the un-budgeted call keeps the old single-row behavior
  var html1 = SR.renderLyricsOnly([['Chorus', line]]);
  assert.strictEqual((html1.match(/class="lyrLine"/g) || []).length, 1);
});

run();
