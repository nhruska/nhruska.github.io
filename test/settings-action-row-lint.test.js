/* =====================================================================
 * settings-action-row-lint.test.js - the GATE that ships with the
 * action-row standard (UAT batch 5, 2026-09-03: "too cluttered w text.
 * simplicity FTW. UI standard layout? for export etc buttons, min prose").
 *
 * A convention with no gate is a suggestion. The drift this catches is the
 * exact one that produced the complaint: six rows doing the same job grew
 * FOUR different looks and every one of them a prose description, because
 * each was invented at its call site with nothing to conform to.
 *
 * The standard lives in music/engineering-wiki/ux-philosophy/
 * component-conventions.md ("Action rows"). This file gives it teeth:
 *   1. no description inside an action row (the row is the label)
 *   2. at most ONE caption per accordion body
 *   3. the retired lookalike classes stay retired
 *   4. no raw URL rendered as settings body text
 *
 * Static (no DOM/browser), same style as no-native-dialog-lint.test.js.
 * Run: node test/settings-action-row-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }

// Strip comments BEFORE scanning: this repo's own source quotes the retired
// class names to DOCUMENT the retirement, and a substring check would match
// the prose that explains the rule and fail on a clean tree (evidence-
// integrity `use-not-mention`).
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')     // html comments
    .replace(/\/\*[\s\S]*?\*\//g, '')    // block comments (js + css)
    .replace(/^[ \t]*\/\/.*$/gm, '');    // line comments
}

var HTML = stripComments(read('music/play/index.html'));
var JS_SRC = stripComments(read('music/shared/songbook.js'));
var CSS = stripComments(read('music/shared/songbook.css'));

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

test('every settings action row is the ONE primitive - the retired lookalikes are gone from markup', function () {
  ['setRow', 'aboutLink', 'agentCopyRow'].forEach(function (cls) {
    var re = new RegExp('class="[^"]*\\b' + cls + '\\b', 'g');
    assert.strictEqual((HTML.match(re) || []).length, 0,
      'markup still renders .' + cls + ' - every "do a thing" row composes .setAction now');
    assert.strictEqual((JS_SRC.match(new RegExp("className = '[^']*\\\\b" + cls + "\\\\b", 'g')) || []).length, 0,
      'songbook.js still builds a .' + cls + ' row');
  });
});

test('the retired lookalike RULES are deleted from CSS, not left dormant', function () {
  // A dead rule that still styles a card-with-description is precisely what the
  // next author reuses, and the divergence starts over. Deleting it is the fix.
  ['.setRow{', '.aboutLink{', '.agentCopyRow{'].forEach(function (sel) {
    assert.strictEqual(CSS.indexOf(sel), -1,
      'songbook.css still defines ' + sel + ' - delete it rather than leaving a lookalike to reuse');
  });
  assert.ok(/\.setAction\{/.test(CSS), 'the one action-row primitive must exist');
  assert.ok(/\.setAction \.saLbl\{[^}]*white-space:nowrap/.test(CSS),
    'the label must be nowrap - the ellipsis is the guard that keeps a row to one line');
});

test('no action row carries a description - the row IS the label', function () {
  // .li-artist / .li-title are the LIST-item ladder; inside a settings action
  // row they are the stacked prose this standard removed.
  assert.strictEqual((HTML.match(/class="li-artist"/g) || []).length, 0,
    'a settings row still stacks a description under its label');
  // In JS the tell is a .li-artist built anywhere the Skills/agent panel renders.
  var skillsPanel = JS_SRC.slice(JS_SRC.indexOf('function renderSkillsPanel'));
  var upTo = skillsPanel.indexOf('function mountSkillsPanel');
  var panelSrc = upTo > 0 ? skillsPanel.slice(0, upTo) : skillsPanel;
  assert.strictEqual((panelSrc.match(/className = 'li-artist'/g) || []).length, 0,
    'the Skills panel still builds a stacked description row');
});

test('captions never STACK - no accordion body opens with a wall of paragraphs', function () {
  // The standard is one caption per GROUP, not per section: Preferences legitimately
  // carries three, one above each of its three setting groups (Instrument, Chord
  // charts, Guidance level). Counting per body would have failed that correct
  // structure - the real defect is two captions BACK TO BACK with no control
  // between them, which is what the AI Agent section had (two full paragraphs
  // before the first tappable thing).
  var bodies = HTML.match(/<div class="accBody"[\s\S]*?<\/div>\s*<\/section>/g) || [];
  assert.ok(bodies.length >= 4, 'expected the settings accordion bodies to be found, got ' + bodies.length);
  bodies.forEach(function (b) {
    var id = (b.match(/id="(accBody\w+)"/) || [])[1] || '?';
    var consecutive = /<p class="setHint"[^>]*>[\s\S]*?<\/p>\s*<p class="setHint"/.test(b);
    assert.ok(!consecutive, id + ' opens with stacked caption paragraphs - say it once, then show the controls');
  });
});

test('no raw URL rendered as settings body text', function () {
  // "Live at: https://raw.githack.com/..." wrapped to three lines on a phone and
  // duplicated what the link rows and the copy button already carry.
  var body = HTML.slice(HTML.indexOf('id="settingsBody"'), HTML.indexOf('class="setFoot"'));
  assert.strictEqual(body.indexOf('Live at:'), -1, 'the raw doc URL is back as body text');
  var textUrls = body.match(/>[^<]*https?:\/\/[^<]*</g) || [];
  assert.strictEqual(textUrls.length, 0,
    'a URL is rendered as visible text (' + textUrls.slice(0, 2).join(' | ') + ') - the rows are the links');
});

run();
