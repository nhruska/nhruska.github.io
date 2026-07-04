/* =====================================================================
 * tracks-css-lint.test.js  -  static regression guard against the 2026-07-04
 * tracks.css authoring bug: a comment mentioned a class-name prefix, then an
 * unspaced path-style separator, then another word - and that unspaced
 * asterisk-then-slash adjacency IS a close-comment token, so it terminated
 * the M-GUIDE W3a section comment early and silently swallowed the very next
 * rule (the dark-theme :root block setting --kx-chord/--kx-blue/--kx-ghost).
 * Those vars resolved to empty string in dark theme, so diagram.js's
 * targeting dots rendered fill:black (the SVG default) - the node test
 * suite stayed green the whole time because no test parsed the actual CSS
 * file; only a live browser (real CSSOM) exposed it.
 *
 * This test strips comments the SAME way a real CSS tokenizer does - the
 * first comment-open token up to the first following comment-close token,
 * non-greedy - so an accidental early close reproduces here exactly as it
 * would in a browser, instead of a naive test silently "fixing" the file by
 * matching comments too leniently. (This header avoids ever writing the
 * asterisk-slash adjacency itself, for the same reason - see the OPEN/CLOSE
 * literals built below instead of typed directly.)
 * Run: node test/tracks-css-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var CSS_PATH = path.join(__dirname, '../music/shared/tracks.css');
var css = fs.readFileSync(CSS_PATH, 'utf8');

// Mirrors real CSS comment stripping: '/' + '*' opens, the FIRST following
// '*' + '/' closes - non-greedy, exactly like a browser's tokenizer. Built
// from concatenated literals so THIS file's own comment about the bug can't
// itself trip the same close-comment adjacency during authoring.
var OPEN = '/' + '*', CLOSE = '*' + '/';
var commentRe = new RegExp(OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
var stripped = css.replace(commentRe, '');

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

test('no comment in tracks.css closes prematurely (asterisk directly touching a slash inside comment text)', function () {
  // A well-formed file's comment-stripped text must contain ZERO leftover
  // close-comment tokens - if one remains, some comment's body had an
  // internal early close and the "real" close landed later, past a live
  // rule that then got merged/discarded exactly like the 2026-07-04 bug.
  var leftover = stripped.indexOf(CLOSE);
  assert.strictEqual(leftover, -1, 'a ' + CLOSE + ' token survived comment-stripping at offset ' + leftover + ' - a comment likely closed early upstream, corrupting everything between the early close and this token');
});

test('bare :root declares --kx-chord/--kx-blue/--kx-ghost (the dark-theme defaults survive comment-stripping)', function () {
  // Scoped to a BARE ":root{...}" block (not ":root[data-theme=light]") so this
  // fails exactly the way the original bug did: the dark defaults vanish while
  // the light override (a separately-parsed, self-contained rule) still passes.
  var rootBlocks = stripped.match(/:root\s*\{[^}]*\}/g) || [];
  var bareRootBlocks = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); });
  var joined = bareRootBlocks.join(' ');
  ['--kx-chord', '--kx-blue', '--kx-ghost'].forEach(function (v) {
    assert.ok(joined.indexOf(v + ':') >= 0, 'expected a bare :root block declaring ' + v + ', got root blocks: ' + JSON.stringify(bareRootBlocks));
  });
});

test('bare :root declares --kx-chord-ink/--kx-blue-ink (U3 per-class dot-text ink)', function () {
  var rootBlocks = stripped.match(/:root\s*\{[^}]*\}/g) || [];
  var bareRootBlocks = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); });
  var joined = bareRootBlocks.join(' ');
  ['--kx-chord-ink', '--kx-blue-ink'].forEach(function (v) {
    assert.ok(joined.indexOf(v + ':') >= 0, 'expected a bare :root block declaring ' + v);
  });
});

test('light-theme :root[data-theme="light"] overrides --kx-chord-ink/--kx-blue-ink', function () {
  var lightBlocks = stripped.match(/:root\[data-theme="light"\]\s*\{[^}]*\}/g) || [];
  var joined = lightBlocks.join(' ');
  ['--kx-chord-ink', '--kx-blue-ink'].forEach(function (v) {
    assert.ok(joined.indexOf(v + ':') >= 0, 'expected a :root[data-theme="light"] block overriding ' + v);
  });
});

test('U2: .scalePosBtn is overridden to a 44px (GRIP touch-floor) box', function () {
  var m = stripped.match(/\.scalePosBtn\s*\{([^}]*)\}/);
  assert.ok(m, 'expected a .scalePosBtn override rule in tracks.css');
  assert.ok(/width:\s*44px/.test(m[1]) && /height:\s*44px/.test(m[1]), 'expected explicit 44px width+height, got: ' + m[1]);
});

run();
