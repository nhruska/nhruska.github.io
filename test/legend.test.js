/* =====================================================================
 * legend.test.js  -  M-EAR wave 1.6 (U16): unit + static-lint coverage for
 * music/shared/legend.js, the fretboard dot-class Legend primitive.
 * ---------------------------------------------------------------------
 * Tier 1 (DOM-stub unit tests, mirrors diagram.dom.test.js's minimal
 * document stub - no jsdom dependency): Legend.render()'s null-when-empty
 * contract, fixed LEGEND_ORDER regardless of input order/duplicates,
 * unknown-key skip, and that every rendered swatch carries the real kx-*
 * class the actual fretboard render uses for that class.
 *
 * Tier 2 (static source lint, same comment-stripping technique
 * consistency-lint.test.js/tracks-css-lint.test.js use): legend.js's swatch
 * definitions must consume var(--kx-..., --accent..., --dg-dot...,
 * --sound-...) tokens only - NEVER a raw hex color - so a theme/accent
 * change always propagates to the legend (component-conventions.md/
 * ssot-registry.md's Element Consistency Law).
 * Run: node test/legend.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

/* ---- just enough DOM for Legend.render(): createElement + className/innerHTML ---- */
global.document = {
  createElement: function (tag) { return { tagName: tag, className: '', innerHTML: '' }; }
};

var Legend = require('../music/shared/legend.js');

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

/* ---------------------------------------------------------------------
 * Tier 1: Legend.render() contract
 * ------------------------------------------------------------------- */

test('render(): empty/falsy classes -> null (nothing to render)', function () {
  assert.strictEqual(Legend.render([]), null);
  assert.strictEqual(Legend.render(null), null);
  assert.strictEqual(Legend.render(undefined), null);
});

test('render(): unknown keys are silently skipped - a classes array of ONLY unknown keys still returns null', function () {
  assert.strictEqual(Legend.render(['nope', 'also-not-a-thing']), null);
});

test('render(): one row per known class, in the FIXED LEGEND_ORDER regardless of input order', function () {
  var el = Legend.render(['sounding', 'root', 'ghost']);
  assert.ok(el, 'expected a rendered element');
  var rowOrder = el.innerHTML.split('legendRow').length - 1;
  assert.strictEqual(rowOrder, 3, 'expected exactly 3 legendRow divs, got: ' + el.innerHTML);
  // LEGEND_ORDER is root, chord, blue, ghost, rub, sounding - so root's row
  // must appear before ghost's, which must appear before sounding's,
  // regardless of the caller passing sounding first.
  var rootIdx = el.innerHTML.indexOf('kx-root');
  var ghostIdx = el.innerHTML.indexOf('kx-ghost');
  var soundingIdx = el.innerHTML.indexOf('kx-sounding');
  assert.ok(rootIdx >= 0 && ghostIdx >= 0 && soundingIdx >= 0, 'expected all 3 requested classes present');
  assert.ok(rootIdx < ghostIdx, 'root must render before ghost');
  assert.ok(ghostIdx < soundingIdx, 'ghost must render before sounding');
});

test('render(): duplicate keys in the input collapse to ONE row (no double-render)', function () {
  var el = Legend.render(['root', 'root', 'root']);
  var rowCount = el.innerHTML.split('legendRow').length - 1;
  assert.strictEqual(rowCount, 1, 'expected exactly one root row despite 3 duplicate requests, got: ' + el.innerHTML);
});

test('render(): unknown keys mixed with known keys are dropped, known ones still render', function () {
  var el = Legend.render(['root', 'not-a-real-class', 'blue']);
  var rowCount = el.innerHTML.split('legendRow').length - 1;
  assert.strictEqual(rowCount, 2, 'expected exactly root + blue rows, got: ' + el.innerHTML);
});

test('render(): every one of the 6 known classes renders its own real kx-* class + label text', function () {
  var el = Legend.render(Legend.LEGEND_ORDER);
  assert.ok(el, 'expected a rendered element');
  [
    ['kx-root', 'Root'],
    ['kx-chord', 'Chord tone'],
    ['kx-blue', 'Blue note'],
    ['kx-ghost', 'Outside'],
    ['kx-rub', 'Rub'],
    ['kx-sounding', 'Sounding']
  ].forEach(function (pair) {
    assert.ok(el.innerHTML.indexOf(pair[0]) >= 0, 'expected class ' + pair[0] + ' present, got: ' + el.innerHTML);
    assert.ok(el.innerHTML.indexOf(pair[1]) >= 0, 'expected label starting with "' + pair[1] + '" present, got: ' + el.innerHTML);
  });
});

test('render(): the ghost swatch is a HOLLOW ring (fill:none) - never a filled dot, matching diagram.js\'s real ghost-dot markup', function () {
  var el = Legend.render(['ghost']);
  assert.ok(/kx-ghost[^"]*"[^>]*style="fill:none;stroke:var\(--kx-ghost\)"/.test(el.innerHTML) || /style="fill:none;stroke:var\(--kx-ghost\)"[^>]*class="kxDot kx-ghost"/.test(el.innerHTML),
    'expected the ghost swatch to be fill:none, got: ' + el.innerHTML);
});

test('render(): the rub swatch carries a stroke-dasharray (the dashed-ring modifier), the sounding swatch carries NO inline style (CSS !important wins)', function () {
  var rub = Legend.render(['rub']);
  assert.ok(/stroke-dasharray="[\d. ]+"/.test(rub.innerHTML), 'expected a stroke-dasharray on the rub swatch, got: ' + rub.innerHTML);
  var sounding = Legend.render(['sounding']);
  assert.ok(sounding.innerHTML.indexOf('style="') === -1, 'expected NO inline style on the sounding swatch (kx-sounding\'s !important CSS rule owns its look), got: ' + sounding.innerHTML);
});

/* ---------------------------------------------------------------------
 * Tier 2: static source lint - kx/token classes only, never a raw hex
 * ------------------------------------------------------------------- */

var LEGEND_SRC_PATH = path.join(__dirname, '../music/shared/legend.js');
var legendSrc = fs.readFileSync(LEGEND_SRC_PATH, 'utf8');
// Same comment-stripping technique as consistency-lint.test.js/
// tracks-css-lint.test.js - strip /* ... */ blocks before scanning so a
// prose comment mentioning a hex value (there are none here today, but this
// keeps the lint honest against future comment edits) can never false-flag.
var OPEN = '/' + '*', CLOSE = '*' + '/';
var commentRe = new RegExp(OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
var legendStripped = legendSrc.replace(commentRe, '');

test('legend.js swatch styles never hardcode a raw hex color - every fill/stroke is a var(--kx-*/--accent*/--dg-dot*/--sound-*) token', function () {
  // Every style="..." attribute value built by dotSvg() calls in DEFS.
  var styleLiterals = legendStripped.match(/'fill:[^']*'|'stroke:[^']*'|"fill:[^"]*"|"stroke:[^"]*"/g) || [];
  assert.ok(styleLiterals.length > 0, 'expected to find fill/stroke style literals in legend.js');
  styleLiterals.forEach(function (lit) {
    assert.ok(!/#[0-9a-fA-F]{3,6}/.test(lit), 'found a raw hex color in a legend.js swatch style (must be a var(--...) token instead): ' + lit);
  });
});

test('legend.js contains ZERO literal hex colors anywhere in its (comment-stripped) source', function () {
  var m = legendStripped.match(/#[0-9a-fA-F]{3,6}\b/g);
  assert.strictEqual(m, null, 'expected no literal hex colors in legend.js, found: ' + JSON.stringify(m));
});

run();
