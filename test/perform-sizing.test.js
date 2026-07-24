/* =====================================================================
 * perform-sizing.test.js - goalpost tests for the Perform sheet's
 * sizing model v3: AUTO-FIT-THEN-WRAP (operator-refined 2026-07-24,
 * superseding the same-day wrap-first v2 interview). The shrink-vs-wrap
 * behavior regressed 4 times; these are the never-regress gate:
 *   0. CORE INVARIANT: NO horizontal scroll on the Perform sheet, EVER.
 *      .pSheet overflow-x is hidden; a too-wide row is absorbed by
 *      shrink-font-then-wrap, never a scrollbar.
 *   1. AUTO-FIT default: the font EXPANDS to fill a wide viewport and
 *      SHRINKS on a narrow one, clamped to [0.8 legibility floor, 2.2].
 *      Wrapping engages ONLY when the font is at the floor and a line
 *      still overflows (fit-by-font first, wrap as the last resort).
 *   2. MANUAL A-/A+ and pinch step from the CURRENT EFFECTIVE applied
 *      scale (the A- bug: stepping from a stale stored value could make
 *      A- render BIGGER than what was on screen). A manual size is
 *      respected (overflow wraps at that size); resize still re-wraps.
 *   3. Codex finding (PR #302 review, SHA 237a56c): the wrap decision
 *      and the split loop key on max(chordRow.length, lyricRow.length),
 *      and the boundary-space drop must never eat a chord character.
 *   4. Persistence: fontScale AND fontMode survive in perfprefs.
 * The pixel-level halves live in the pw scenarios (perform-autofit-
 * viewport, perform-trailing-chord-invariant, perform-font-step-pinch-
 * rewrap, perform-font-persist, perform-*-orientation*); this file locks
 * the WIRING, the pure clamp/step math, and the wrap algorithm so a
 * regression fails in the cheap node suite too. Wiring assertions run
 * against comment-STRIPPED source - a comment naming a construct must
 * never satisfy or trip them (assert against code, not prose).
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
var cssSrc = fs.readFileSync(path.join(__dirname, '../music/shared/songbook.css'), 'utf8');
var sbCode = stripComments(songbookSrc);
var srCode = stripComments(sheetSrc);

test('sanity: the stripper removes comments but keeps code (self-check both directions)', function () {
  var s = stripComments("var a = 1; // fitScale in a comment\n/* fontMode prose */ var b = 'https://x//y';");
  assert.ok(s.indexOf('fitScale') === -1, 'line comment not stripped');
  assert.ok(s.indexOf('fontMode') === -1, 'block comment not stripped');
  assert.ok(s.indexOf("'https://x//y'") !== -1, 'string with // must survive');
  assert.ok(s.indexOf('var b') !== -1, 'code after a URL string must survive');
});

/* ---------- goalpost 0: CORE INVARIANT - no horizontal scroll, ever ---------- */

test('CORE INVARIANT: .pSheet overflow-x is hidden (never auto/scroll) - a wide row shrinks/wraps, it NEVER scrolls sideways', function () {
  var m = /\.pSheet\{([^}]*)\}/.exec(cssSrc);
  assert.ok(m, '.pSheet rule not found in songbook.css');
  assert.ok(/overflow-x:\s*hidden/.test(m[1]),
    '.pSheet overflow-x is not hidden: "' + m[1].slice(0, 120) + '"');
  assert.ok(!/overflow-x:\s*(auto|scroll)/.test(m[1]),
    '.pSheet still allows horizontal scrolling');
});

test('CORE INVARIANT: perfWrapMaxChars always returns a usable budget (no null sanity-floor bail back to an unwrapped overflow render)', function () {
  var m = /function perfWrapMaxChars\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'perfWrapMaxChars not found');
  assert.ok(!/chars\s*>=\s*12/.test(m[0]),
    'perfWrapMaxChars still bails to null below a 12-char budget - that path rendered UNWRAPPED overflowing rows');
  assert.ok(/Math\.max\(\s*1\s*,\s*chars\s*\)/.test(m[0]),
    'perfWrapMaxChars does not floor the budget at 1 char (the budget must always exist so wrapping always absorbs width)');
});

/* ---------- goalpost 1: the v3 AUTO-FIT model exists ---------- */

test('auto-fit v3: STATE carries fontMode (auto|manual), defaulting to auto and restored from perfprefs', function () {
  var m = /var STATE = \{[\s\S]*?\n    \};/.exec(sbCode);
  assert.ok(m, 'STATE literal not found');
  assert.ok(/fontMode:/.test(m[0]), 'STATE has no fontMode - the v3 auto-fit default mode is missing');
  assert.ok(/_pp\.fontMode/.test(m[0]), 'STATE.fontMode is not restored from perfprefs');
  assert.ok(/'auto'/.test(m[0]), "STATE.fontMode does not default to 'auto'");
});

test('auto-fit v3: fitStageSheet resolves the scale by MODE - manual uses the user scale, auto MEASURES and fits the viewport width (clamped)', function () {
  var m = /function fitStageSheet\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'fitStageSheet not found');
  var body = m[0];
  assert.ok(/STATE\.fontMode\s*===\s*'manual'/.test(body), 'fitStageSheet has no manual/auto mode split');
  assert.ok(/clampFontScale/.test(body), 'fitStageSheet does not clamp the fitted scale to [floor, max]');
  assert.ok(/stageContentWidth/.test(body), 'fitStageSheet does not measure the padding-aware content width');
  // the size must be RESOLVED AND APPLIED before the wrap budget is probed
  // (the budget is measured at the applied --pscale), and the budget must be
  // passed into the wrapped render.
  var applyIdx = body.indexOf('applyScale');
  var budgetIdx = body.indexOf('perfWrapMaxChars');
  assert.ok(applyIdx !== -1, 'fitStageSheet never applies the resolved scale (applyScale)');
  assert.ok(budgetIdx !== -1, 'fitStageSheet never computes the wrap budget');
  assert.ok(applyIdx < budgetIdx, 'fitStageSheet probes the wrap budget BEFORE applying the resolved scale - the budget would be measured at a stale size');
  assert.ok(/renderSheet\([^)]*wrapChars/.test(body), 'fitStageSheet does not pass the wrap budget into renderSheet');
});

test('auto-fit v3: no resurrected v1 fitScale helper - the fit lives in fitStageSheet, wrap in sheet-render', function () {
  assert.ok(!/\bfitScale\b/.test(sbCode), 'songbook.js code references fitScale again (the retired v1 shrink helper)');
  assert.ok(!/\bfunction\s+fitScale\b/.test(srCode) && !/\bfitScale\s*:/.test(srCode),
    'sheet-render.js defines/exports fitScale again');
  assert.ok(!/Math\.max\(0\.5,/.test(srCode), 'the 0.5x illegibility floor is back in sheet-render.js');
});

/* ---------- goalpost 1b: the legibility clamp (pure) ---------- */

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

/* ---------- goalpost 2: A-/A+ step from the EFFECTIVE scale (the A- bug) ---------- */

test('A- bug fix (pure): stepScaleFrom is monotonic from the effective scale - A- never larger, A+ never smaller, clamped at the rails', function () {
  assert.strictEqual(typeof Songbook.stepScaleFrom, 'function', 'stepScaleFrom not exported');
  for (var e = 0.8; e <= 2.2001; e += 0.033) {
    var down = Songbook.stepScaleFrom(e, -0.1), up = Songbook.stepScaleFrom(e, 0.1);
    assert.ok(down <= e + 1e-9, 'A- INCREASED the size: ' + e + ' -> ' + down);
    if (e > 0.801) assert.ok(down < e - 1e-9, 'A- did not decrease above the floor: ' + e + ' -> ' + down);
    assert.ok(up >= e - 1e-9, 'A+ DECREASED the size: ' + e + ' -> ' + up);
    if (e < 2.199) assert.ok(up > e + 1e-9, 'A+ did not increase below the cap: ' + e + ' -> ' + up);
  }
  // the historical bug shape: stored manual 1.4, but 0.9 actually on screen -
  // A- must land BELOW 0.9 (stepping from the stale 1.4 rendered BIGGER).
  assert.ok(Songbook.stepScaleFrom(0.9, -0.1) < 0.9, 'A- from an effective 0.9 did not shrink');
  // defensive: a broken effective value steps from the neutral 1
  assert.strictEqual(Songbook.stepScaleFrom(NaN, 0.1), 1.1);
});

test('A- bug fix (wiring): stepFont steps from STATE.effScale via stepScaleFrom and flips to manual mode', function () {
  var m = /function stepFont\s*\(([\s\S]*?)\n    \}/.exec(sbCode);
  assert.ok(m, 'stepFont not found');
  assert.ok(/stepScaleFrom\(\s*STATE\.effScale/.test(m[0]),
    'stepFont does not step from the EFFECTIVE applied scale - the A- bug (stale baseline renders A- bigger) is back');
  assert.ok(/fontMode\s*=\s*'manual'/.test(m[0]), 'stepFont does not enter manual mode');
  assert.ok(/refitStage|fitStageSheet/.test(m[0]), 'stepFont does not re-wrap (a size change moves the char budget)');
  assert.ok(/savePerfPrefs/.test(m[0]), 'stepFont does not persist');
});

test('pinch wiring: the gesture baselines off the EFFECTIVE scale, and gesture end re-wraps + persists in manual mode', function () {
  assert.ok(/addEventListener\(\s*'touchstart'/.test(sbCode), 'no touchstart pinch handler');
  assert.ok(/addEventListener\(\s*'touchmove'/.test(sbCode), 'no touchmove pinch handler');
  assert.ok(/addEventListener\(\s*'touchend'/.test(sbCode), 'no touchend pinch handler');
  assert.ok(/pinchS0\s*=\s*clampFontScale\(\s*STATE\.effScale/.test(sbCode),
    'pinch does not baseline off the EFFECTIVE scale (same stale-baseline bug class as A-)');
  var endm = /var pinchEnd = function[\s\S]*?\};/.exec(sbCode);
  assert.ok(endm, 'pinchEnd handler not found');
  assert.ok(/refitStage|fitStageSheet/.test(endm[0]), 'pinch end does not re-wrap');
  assert.ok(/fontMode\s*=\s*'manual'/.test(endm[0]), 'pinch end does not enter manual mode');
  assert.ok(/savePerfPrefs/.test(endm[0]), 'pinch end does not persist the size');
});

test('reset wiring: the middle size button returns to AUTO mode (re-fit), not to a fixed 1.0 manual size', function () {
  var m = /el\.pFontAuto\.onclick\s*=\s*function[\s\S]*?\};/.exec(sbCode);
  assert.ok(m, 'pFontAuto onclick not found');
  assert.ok(/fontMode\s*=\s*'auto'/.test(m[0]), 'the reset button does not restore auto-fit mode');
  assert.ok(/refitStage/.test(m[0]), 'the reset button does not re-fit');
  assert.ok(/savePerfPrefs/.test(m[0]), 'the reset button does not persist the mode');
});

/* ---------- goalpost 3 (codex finding, PR #302): wrap keys on the WIDER row ---------- */

test('codex fix: wrapChordLyricPair wraps a chord tail LONGER than the lyric row (split loop keyed on max, not lyricRow.length)', function () {
  var rows = SR.wrapChordLyricPair('      Gmaj7add13sus4', 'la la', 12);
  assert.ok(rows.length > 1,
    'a 20-char chord row over a 5-char lyric was never wrapped at maxChars=12 (got ' + rows.length + ' row)');
  rows.forEach(function (r, i) {
    assert.ok(r.chord.length <= 12, 'row ' + i + ' chord over budget: ' + JSON.stringify(r.chord));
    assert.ok(r.lyric.length <= 12, 'row ' + i + ' lyric over budget: ' + JSON.stringify(r.lyric));
  });
});

test('codex fix: no chord character is LOST across a wrap (the boundary-space drop must check BOTH rows before eating the column)', function () {
  function chordChars(rows) { return rows.map(function (r) { return r.chord; }).join('').replace(/ /g, ''); }
  // direct: the cut column is a lyric-side reservation space but a chord-side letter
  var rows = SR.wrapChordLyricPair('      Gmaj7add13sus4', 'la la         ', 12);
  assert.strictEqual(chordChars(rows), 'Gmaj7add13sus4',
    'chord characters were dropped at the wrap boundary: ' + chordChars(rows));
  // and through the real line renderer (trailing wide chord forces the wrap)
  var html = SR.renderLyricLine('la la [Gmaj7add13sus4]', null, 12);
  var crds = html.split('<span class="crd">').slice(1).map(function (p) { return p.split('</span>')[0]; });
  assert.strictEqual(crds.join('').replace(/ /g, ''), 'Gmaj7add13sus4',
    'renderLyricLine dropped chord characters across the wrap: ' + crds.join('|'));
});

test('codex fix: renderLyricLine keys the no-wrap decision on the WIDER row - every rendered row fits the budget', function () {
  var html = SR.renderLyricLine('la la [Gmaj7add13sus4]', null, 12);
  var rows = html.split('<div class="lyrLine">').slice(1);
  assert.ok(rows.length > 1, 'short-lyric + trailing wide chord rendered as one unwrapped row');
  rows.forEach(function (r, i) {
    var crd = r.split('<span class="crd">')[1].split('</span>')[0];
    var lyr = r.split('</span>\n')[1].split('</div>')[0];
    assert.ok(crd.length <= 12, 'row ' + i + ' chord segment over budget (' + crd.length + '): ' + JSON.stringify(crd));
    assert.ok(lyr.length <= 12, 'row ' + i + ' lyric segment over budget (' + lyr.length + '): ' + JSON.stringify(lyr));
  });
});

test('codex fix: identical char-index splits both rows (column alignment survives the max-keyed wrap)', function () {
  // A mixed line: lyric wider than chord early, chord wider than lyric at the tail.
  var chordRow = '   C           Gmaj7add13sus4';
  var lyricRow = 'la la la la la ';
  var rows = SR.wrapChordLyricPair(chordRow, lyricRow, 10);
  // Walk the rows re-accumulating both strings; the concatenation (plus the
  // dropped both-rows-space columns) must reproduce every non-space char of
  // BOTH originals in order - proving the same cut indices were applied to
  // the chord and the lyric row alike.
  var joinedChord = rows.map(function (r) { return r.chord; }).join('').replace(/ /g, '');
  var joinedLyric = rows.map(function (r) { return r.lyric; }).join('').replace(/ /g, '');
  assert.strictEqual(joinedChord, chordRow.replace(/ /g, ''), 'chord chars lost/reordered');
  assert.strictEqual(joinedLyric, lyricRow.replace(/ /g, ''), 'lyric chars lost/reordered');
  rows.forEach(function (r, i) {
    assert.ok(r.chord.length <= 10 && r.lyric.length <= 10, 'row ' + i + ' over budget');
  });
});

/* ---------- goalpost 4: persistence (scale AND mode) ---------- */

test('persistence wiring: savePerfPrefs writes fontScale AND fontMode (a manual size survives sessions; auto stays auto)', function () {
  var m = /function savePerfPrefs\s*\(\)[\s\S]*?\}/.exec(sbCode);
  assert.ok(m, 'savePerfPrefs not found');
  assert.ok(/fontScale/.test(m[0]), 'savePerfPrefs does not persist fontScale');
  assert.ok(/fontMode/.test(m[0]), 'savePerfPrefs does not persist fontMode - a manual size would silently revert to auto');
});

test('persistence wiring: STATE seeds fontScale from perfprefs through the clamp (bad stored values cannot render below the floor)', function () {
  var m = /var STATE = \{[\s\S]*?fontScale:\s*([^,\n]+)[,\n]/.exec(sbCode);
  assert.ok(m, 'STATE fontScale init not found');
  assert.ok(/clampFontScale/.test(m[1]), 'STATE.fontScale init does not clamp the restored perfprefs value: ' + m[1]);
  assert.ok(/_pp\.fontScale/.test(m[1]), 'STATE.fontScale init does not read the persisted perfprefs fontScale: ' + m[1]);
});

test('persistence wiring: startPerform does not force-reset the size on Stage open', function () {
  var m = /function startPerform\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'startPerform not found');
  assert.ok(!/fontScale\s*=\s*1/.test(m[0]), 'startPerform resets fontScale on open - the persisted size would never be seen');
});

/* ---------- goalpost 5: any viewport change re-fits via the one shared path ---------- */

test('resize/rotate wiring: refitStage IS the shared path - its body reaches fitStageSheet', function () {
  var m = /function refitStage\s*\([\s\S]*?\n    \}/.exec(sbCode);
  assert.ok(m, 'refitStage not found');
  assert.ok(/fitStageSheet/.test(m[0]), 'refitStage does not call fitStageSheet');
});

test('resize/rotate wiring: the resize listener re-fits whenever the stage is open - NO mode gate (a manual size must still re-wrap on resize)', function () {
  var m = /addEventListener\(\s*'resize'[\s\S]*?\}\s*,\s*150\s*\)/.exec(sbCode);
  assert.ok(m, 'stage resize listener not found');
  assert.ok(/refitStage|fitStageSheet/.test(m[0]), 'resize listener does not reach the shared refit path');
  assert.ok(!/fontMode/.test(m[0]), 'resize listener gates on fontMode - a manual size would stop re-wrapping on rotation');
});

/* ---------- lyrics-only view: same wrap contract (no chord row, still must not clip) ---------- */

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
