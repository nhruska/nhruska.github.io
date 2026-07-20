/* =====================================================================
 * layout-token-lint.test.js - S-LAYOUT-SSOT regression guard
 * ---------------------------------------------------------------------
 * Static (no DOM/browser) guard that the chord-tile/diagram geometry token
 * block (music/engineering-wiki/systems/layout-tokens.md) stays a single
 * source of truth: the numeric constants are declared exactly once in
 * songbook.css's :root block, the rules that need them consume the var()
 * (never a re-hardcoded literal), and the cross-reference comments this
 * mission added (diagram.js -> --dg-canvas-w, tracks.css's known-gap note)
 * are still present. Comment-stripped the same way tracks-css-lint.test.js
 * is (a naive test would false-positive on the historical "84px"/"62px"
 * figures that legitimately still appear in prose comments explaining the
 * derivation).
 *
 * This test does NOT render anything - see scripts/layout-check.py for the
 * live browser render-verify regression suite (the actual overlap/spill
 * guard). This file only guards the SSOT contract from silently forking
 * back into duplicated literals.
 * Run: node test/layout-token-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var SONGBOOK_CSS = path.join(__dirname, '../music/shared/songbook.css');
var TRACKS_CSS = path.join(__dirname, '../music/shared/tracks.css');
var DIAGRAM_JS = path.join(__dirname, '../music/shared/diagram.js');

var songbookCss = fs.readFileSync(SONGBOOK_CSS, 'utf8');
var tracksCss = fs.readFileSync(TRACKS_CSS, 'utf8');
var diagramJs = fs.readFileSync(DIAGRAM_JS, 'utf8');

// Mirrors a real CSS tokenizer's comment stripping (same technique as
// tracks-css-lint.test.js) - first '/' + '*' open, first following '*' + '/'
// close, non-greedy.
var OPEN = '/' + '*', CLOSE = '*' + '/';
var commentRe = new RegExp(OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
var songbookStripped = songbookCss.replace(commentRe, '');

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

test('no comment in songbook.css closes prematurely (comment-stripping sanity, same guard as tracks-css-lint.test.js)', function () {
  var leftover = songbookStripped.indexOf(CLOSE);
  assert.strictEqual(leftover, -1, 'a ' + CLOSE + ' token survived comment-stripping at offset ' + leftover + ' - a comment likely closed early upstream');
});

test('bare :root declares the S-LAYOUT-SSOT token block (--dg-canvas-w/--tile-min/--tile-gap/--prog-tile-min)', function () {
  var rootBlocks = songbookStripped.match(/:root\s*\{[^}]*\}/g) || [];
  var bareRootBlocks = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); });
  var joined = bareRootBlocks.join(' ');
  ['--dg-canvas-w', '--tile-min', '--tile-gap', '--prog-tile-min'].forEach(function (v) {
    assert.ok(joined.indexOf(v + ':') >= 0, 'expected a bare :root block declaring ' + v + ', got root blocks: ' + JSON.stringify(bareRootBlocks));
  });
});

test('--tile-min derives from --dg-canvas-w via calc() (not a second independent literal)', function () {
  var m = songbookStripped.match(/--tile-min:\s*([^;]+);/);
  assert.ok(m, 'expected a --tile-min declaration');
  assert.ok(/calc\(\s*var\(--dg-canvas-w\)/.test(m[1]), '--tile-min must derive from var(--dg-canvas-w) via calc(), got: ' + m[1]);
});

test('.chordGrid consumes var(--tile-min) and var(--tile-gap), not a re-hardcoded literal', function () {
  var m = songbookStripped.match(/\.chordGrid\{([^}]*)\}/);
  assert.ok(m, 'expected a .chordGrid rule');
  assert.ok(/minmax\(var\(--tile-min\)\s*,\s*1fr\)/.test(m[1]), '.chordGrid grid-template-columns must use var(--tile-min), got: ' + m[1]);
  assert.ok(/gap:\s*var\(--tile-gap\)/.test(m[1]), '.chordGrid gap must use var(--tile-gap), got: ' + m[1]);
  assert.ok(!/minmax\(\s*\d/.test(m[1]), '.chordGrid must not re-hardcode a numeric minmax() floor: ' + m[1]);
});

test('.prog .slot .chord consumes var(--prog-tile-min), not a re-hardcoded literal', function () {
  var m = songbookStripped.match(/\.prog \.slot \.chord\{([^}]*)\}/);
  assert.ok(m, 'expected a .prog .slot .chord rule');
  assert.ok(/min-width:\s*var\(--prog-tile-min\)/.test(m[1]), '.prog .slot .chord min-width must use var(--prog-tile-min), got: ' + m[1]);
});

test('diagram.js cross-references --dg-canvas-w near SIZES.small (documentation-anchor, not a live coupling)', function () {
  assert.ok(diagramJs.indexOf('--dg-canvas-w') >= 0, 'expected diagram.js to mention --dg-canvas-w in a cross-reference comment (see music/engineering-wiki/systems/layout-tokens.md)');
  assert.ok(diagramJs.indexOf('layout-tokens.md') >= 0, 'expected diagram.js to link music/engineering-wiki/systems/layout-tokens.md');
});

test('tracks.css documents the .bt-st-chords known-gap (Practice Studio chords-in-key row, not fixed by this SSOT pass)', function () {
  assert.ok(tracksCss.indexOf('KNOWN GAP') >= 0, 'expected tracks.css to carry the KNOWN GAP comment near .bt-st-chords');
  assert.ok(tracksCss.indexOf('--dg-canvas-w') >= 0, 'expected the known-gap comment to reference --dg-canvas-w (86px reference canvas) for the arithmetic it cites');
});

run();
