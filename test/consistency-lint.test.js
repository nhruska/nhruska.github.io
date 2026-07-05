/* =====================================================================
 * consistency-lint.test.js - M-DESIGN-ENFORCE E4, THE ELEMENT CONSISTENCY
 * LAW's teeth (music/CLAUDE.md; engineering-wiki/systems/ssot-registry.md).
 * -----------------------------------------------------------------------
 * Static (no DOM/browser) guard that three design-enforce findings stay
 * fixed once fixed, so a future edit can't silently re-introduce them:
 *
 *   (a) GUIDANCE vs SELECTION surface separation (U10 camouflage, E1): a
 *       guidance rule (.notableBanner) never re-adopts the SELECTION-surface
 *       tokens (--accent-deep/--accent-dim), and a known selection-surface
 *       rule never adopts the GUIDANCE tokens (--guide-bg/--guide-line).
 *   (b) ONE selected-state grammar app-wide (D-SELECTED-ACCENT, E2): no
 *       ".xxx.on{...}" rule anywhere in songbook.css/tracks.css combines
 *       "background:var(--surface-2)" with a "box-shadow:0 0 0 ..." ring -
 *       the exact duplicate grammar the law killed in .modeSwitch/.viewToggle.
 *   (c) Radius-by-role tokens are consumed, not re-hardcoded (E3): every
 *       migrated/tokenized consumer class's border-radius is a var(--r-*)
 *       reference, never a literal px, in ALL THREE component css files.
 *
 * Comment-stripped the SAME way tracks-css-lint.test.js is (a naive test
 * would false-positive on legitimate historical px figures inside prose
 * comments explaining a migration's before/after values).
 * Run: node test/consistency-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var SONGBOOK_CSS = path.join(__dirname, '../music/shared/songbook.css');
var TRACKS_CSS = path.join(__dirname, '../music/shared/tracks.css');
var RF_CSS = path.join(__dirname, '../music/shared/repertoire-form.css');

var songbookCss = fs.readFileSync(SONGBOOK_CSS, 'utf8');
var tracksCss = fs.readFileSync(TRACKS_CSS, 'utf8');
var rfCss = fs.readFileSync(RF_CSS, 'utf8');

// Mirrors a real CSS tokenizer's comment stripping (same technique as
// tracks-css-lint.test.js / layout-token-lint.test.js) - first '/' + '*'
// open, first following '*' + '/' close, non-greedy.
var OPEN = '/' + '*', CLOSE = '*' + '/';
var commentRe = new RegExp(OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
var songbookStripped = songbookCss.replace(commentRe, '');
var tracksStripped = tracksCss.replace(commentRe, '');
var rfStripped = rfCss.replace(commentRe, '');

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

test('comment-stripping sanity: no stray close-comment token survives in any of the 3 files', function () {
  [['songbook.css', songbookStripped], ['tracks.css', tracksStripped], ['repertoire-form.css', rfStripped]].forEach(function (pair) {
    var leftover = pair[1].indexOf(CLOSE);
    assert.strictEqual(leftover, -1, 'a ' + CLOSE + ' token survived comment-stripping in ' + pair[0] + ' at offset ' + leftover);
  });
});

/* ---------------------------------------------------------------------
 * (a) GUIDANCE vs SELECTION surface separation (E1)
 * ------------------------------------------------------------------- */

function ruleBody(stripped, selectorLiteral) {
  // Anchor the selector to the START of a top-level rule (preceded by rule-boundary
  // '}'/';' or start-of-string) - otherwise a descendant-combinator compound selector
  // that HAPPENS to end in the same class (e.g. ".practiceRow .modeSwitch{") would
  // false-match a lookup for the base ".modeSwitch{" rule and return the WRONG (often
  // radius-less) rule body.
  var escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(?:^|[};])\\s*' + escaped + '\\s*\\{([^}]*)\\}');
  var m = stripped.match(re);
  return m ? m[1] : null;
}

test('.notableBanner (guidance) never re-adopts the SELECTION-surface tokens (--accent-deep/--accent-dim)', function () {
  var body = ruleBody(songbookStripped, '.notableBanner');
  assert.ok(body !== null, 'expected a .notableBanner rule in songbook.css');
  assert.ok(body.indexOf('--accent-deep') === -1, '.notableBanner must not use --accent-deep (that is the SELECTION surface .listItem.inSet/.setUndo share) - got: ' + body);
  assert.ok(body.indexOf('--accent-dim') === -1, '.notableBanner must not use --accent-dim (that is the SELECTION surface .listItem.inSet/.setUndo share) - got: ' + body);
  assert.ok(body.indexOf('--guide-bg') >= 0, '.notableBanner must consume var(--guide-bg), got: ' + body);
  assert.ok(body.indexOf('--guide-line') >= 0, '.notableBanner must consume var(--guide-line), got: ' + body);
});

test('known SELECTION-surface rules never adopt the GUIDANCE tokens (--guide-bg/--guide-line)', function () {
  [
    ['.listItem.inSet', songbookStripped],
    ['.setUndo', songbookStripped],
    ['#setEdit.on', songbookStripped],
    ['.iconBtn.setBtn.on', songbookStripped]
  ].forEach(function (pair) {
    var body = ruleBody(pair[1], pair[0]);
    assert.ok(body !== null, 'expected a ' + pair[0] + ' rule');
    assert.ok(body.indexOf('--guide-bg') === -1, pair[0] + ' is a SELECTION surface and must not use --guide-bg, got: ' + body);
    assert.ok(body.indexOf('--guide-line') === -1, pair[0] + ' is a SELECTION surface and must not use --guide-line, got: ' + body);
  });
});

test('--guide-bg/--guide-line are declared once, computed off --txt-dim (a genuinely accent-independent hue direction from --accent-deep/-dim)', function () {
  var rootBlocks = songbookStripped.match(/:root\s*\{[^}]*\}/g) || [];
  var bareRootBlocks = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); });
  var joined = bareRootBlocks.join(' ');
  assert.ok(joined.indexOf('--guide-bg:') >= 0, 'expected a bare :root block declaring --guide-bg');
  assert.ok(joined.indexOf('--guide-line:') >= 0, 'expected a bare :root block declaring --guide-line');
  assert.ok(/--guide-bg:\s*color-mix\(in srgb,\s*var\(--txt-dim\)/.test(joined), '--guide-bg must derive from var(--txt-dim) via color-mix() (accent-independent), not --brass/--accent-deep/-dim, got: ' + joined);
  assert.ok(/--guide-line:\s*color-mix\(in srgb,\s*var\(--txt-dim\)/.test(joined), '--guide-line must derive from var(--txt-dim) via color-mix() (accent-independent), not --brass/--accent-deep/-dim, got: ' + joined);
});

/* ---------------------------------------------------------------------
 * (a2) SOUNDING vs SELECTION vs GUIDANCE - three-way surface separation
 * (M-EAR wave 1, engineering-wiki/systems/ssot-registry.md's Element
 * Consistency Law: "derive a new --sound-* pair, add it to the consistency
 * lint's semantic-separation assertions - the law grows with the system").
 * ------------------------------------------------------------------- */

test('.soundNote.sounding (the scale-audition marker) never re-adopts the SELECTION or GUIDANCE tokens', function () {
  var body = ruleBody(songbookStripped, '.soundNote.sounding');
  assert.ok(body !== null, 'expected a .soundNote.sounding rule in songbook.css');
  assert.ok(body.indexOf('--accent-deep') === -1, '.soundNote.sounding must not use --accent-deep (SELECTION), got: ' + body);
  assert.ok(body.indexOf('--accent-dim') === -1, '.soundNote.sounding must not use --accent-dim (SELECTION), got: ' + body);
  assert.ok(body.indexOf('--guide-bg') === -1, '.soundNote.sounding must not use --guide-bg (GUIDANCE), got: ' + body);
  assert.ok(body.indexOf('--guide-line') === -1, '.soundNote.sounding must not use --guide-line (GUIDANCE), got: ' + body);
  assert.ok(body.indexOf('--sound-bg') >= 0, '.soundNote.sounding must consume var(--sound-bg), got: ' + body);
  assert.ok(body.indexOf('--sound-line') >= 0, '.soundNote.sounding must consume var(--sound-line), got: ' + body);
});

test('known SELECTION/GUIDANCE-surface rules never adopt the SOUNDING tokens (--sound-bg/--sound-line)', function () {
  [
    ['.listItem.inSet', songbookStripped],
    ['.setUndo', songbookStripped],
    ['.notableBanner', songbookStripped],
    ['.iconBtn.setBtn.on', songbookStripped]
  ].forEach(function (pair) {
    var body = ruleBody(pair[1], pair[0]);
    assert.ok(body !== null, 'expected a ' + pair[0] + ' rule');
    assert.ok(body.indexOf('--sound-bg') === -1, pair[0] + ' must not use --sound-bg (that is the SOUNDING-marker surface), got: ' + body);
    assert.ok(body.indexOf('--sound-line') === -1, pair[0] + ' must not use --sound-line (that is the SOUNDING-marker surface), got: ' + body);
  });
});

test('--sound-bg/--sound-line are declared per-theme with distinct literal values (not aliasing SELECTION/GUIDANCE)', function () {
  var rootBlocks = songbookStripped.match(/:root(?:\[data-theme="light"\])?\s*\{[^}]*\}/g) || [];
  var bareRoot = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); }).join(' ');
  var lightRoot = rootBlocks.filter(function (b) { return /^:root\[data-theme="light"\]\s*\{/.test(b); }).join(' ');
  assert.ok(/--sound-bg:\s*#[0-9a-fA-F]{6}/.test(bareRoot), 'expected a literal-hex --sound-bg in the dark :root block, got: ' + bareRoot);
  assert.ok(/--sound-line:\s*#[0-9a-fA-F]{6}/.test(bareRoot), 'expected a literal-hex --sound-line in the dark :root block, got: ' + bareRoot);
  assert.ok(/--sound-bg:\s*#[0-9a-fA-F]{6}/.test(lightRoot), 'expected a literal-hex --sound-bg override in the light theme block, got: ' + lightRoot);
  assert.ok(/--sound-line:\s*#[0-9a-fA-F]{6}/.test(lightRoot), 'expected a literal-hex --sound-line override in the light theme block, got: ' + lightRoot);
});

/* ---------------------------------------------------------------------
 * (b) ONE selected-state grammar app-wide (D-SELECTED-ACCENT, E2)
 * ------------------------------------------------------------------- */

function onStateRules(stripped) {
  return stripped.match(/[^\s{},]+\.on\s*\{[^}]*\}/g) || [];
}

test('no ".xxx.on{...}" rule (songbook.css) combines surface-2 background with a box-shadow ring (the D-SELECTED-ACCENT duplicate grammar)', function () {
  var rules = onStateRules(songbookStripped);
  assert.ok(rules.length > 5, 'expected multiple .on state rules in songbook.css, found ' + rules.length);
  rules.forEach(function (rule) {
    var hasSurface2Bg = /background:\s*var\(--surface-2\)/.test(rule);
    var hasRing = /box-shadow:\s*0 0 0/.test(rule);
    assert.ok(!(hasSurface2Bg && hasRing), 'found the banned surface-2 + box-shadow-ring selected-state grammar in: ' + rule);
  });
});

test('no ".xxx.on{...}" rule (tracks.css) combines surface-2 background with a box-shadow ring', function () {
  var rules = onStateRules(tracksStripped);
  rules.forEach(function (rule) {
    var hasSurface2Bg = /background:\s*var\(--surface-2\)/.test(rule);
    var hasRing = /box-shadow:\s*0 0 0/.test(rule);
    assert.ok(!(hasSurface2Bg && hasRing), 'found the banned surface-2 + box-shadow-ring selected-state grammar in: ' + rule);
  });
});

test('.modeSwitch button.on and .viewToggle button.on use the accent-fill grammar (D-SELECTED-ACCENT shipped)', function () {
  [['.modeSwitch button.on', songbookStripped], ['.viewToggle button.on', songbookStripped]].forEach(function (pair) {
    var body = ruleBody(pair[1], pair[0]);
    assert.ok(body !== null, 'expected a ' + pair[0] + ' rule');
    assert.ok(/background:\s*var\(--accent\)/.test(body), pair[0] + ' must use background:var(--accent), got: ' + body);
    assert.ok(/color:\s*var\(--on-accent\)/.test(body), pair[0] + ' must use color:var(--on-accent), got: ' + body);
    assert.ok(body.indexOf('box-shadow') === -1, pair[0] + ' must not carry a box-shadow ring anymore, got: ' + body);
  });
});

/* ---------------------------------------------------------------------
 * (c) Radius-by-role tokens are consumed, not re-hardcoded (E3)
 * ------------------------------------------------------------------- */

test('bare :root (songbook.css) declares the 5 M-DESIGN-ENFORCE radius tokens', function () {
  var rootBlocks = songbookStripped.match(/:root\s*\{[^}]*\}/g) || [];
  var bareRootBlocks = rootBlocks.filter(function (b) { return /^:root\s*\{/.test(b); });
  var joined = bareRootBlocks.join(' ');
  ['--r-btn', '--r-btn-sm', '--r-chip-pill', '--r-card', '--r-input'].forEach(function (v) {
    assert.ok(joined.indexOf(v + ':') >= 0, 'expected a bare :root block declaring ' + v + ', got root blocks: ' + JSON.stringify(bareRootBlocks));
  });
});

// [selector literal, stripped-source, expected var name] - every consumer this
// wave tokenized or migrated. A selector appears once even if reused by other
// consumers not in this pass's grant (out of scope, not re-checked here).
var RADIUS_CONSUMERS = [
  // --r-btn (11px): primary/secondary buttons + segmented-control containers
  ['.ab-btn', songbookStripped, '--r-btn'],
  ['.viewToggle', songbookStripped, '--r-btn'],
  ['.modeSwitch', songbookStripped, '--r-btn'],
  ['.transposeChip', songbookStripped, '--r-btn'],
  ['.btn', songbookStripped, '--r-btn'],
  ['.empty .emptyClear', songbookStripped, '--r-btn'],
  ['.chordSeg', songbookStripped, '--r-btn'],
  ['.allChordsToggle', songbookStripped, '--r-btn'],
  ['.bt-more-btn', tracksStripped, '--r-btn'],
  ['.bt-add-save', tracksStripped, '--r-btn'],
  // --r-btn-sm (10px): icon/compact buttons + segmented-control inner buttons
  ['.tabbar button', songbookStripped, '--r-btn-sm'],
  ['.iconBtn', songbookStripped, '--r-btn-sm'],
  ['.viewToggle button', songbookStripped, '--r-btn-sm'],
  ['.queueNav button', songbookStripped, '--r-btn-sm'],
  ['.modeSwitch button', songbookStripped, '--r-btn-sm'],
  ['.transposeChip button', songbookStripped, '--r-btn-sm'],
  ['.tBtn', songbookStripped, '--r-btn-sm'],
  ['.relStep .rp', songbookStripped, '--r-btn-sm'],
  ['.scalePosBtn', songbookStripped, '--r-btn-sm'],
  ['.ctrlBar .iconBtn', songbookStripped, '--r-btn-sm'],
  ['.maxClose', songbookStripped, '--r-btn-sm'],
  ['.pTop .pmini', songbookStripped, '--r-btn-sm'],
  ['.pTop .x', songbookStripped, '--r-btn-sm'],
  ['.invModal-x', songbookStripped, '--r-btn-sm'],
  ['.bt-add-toggle', tracksStripped, '--r-btn-sm'],
  ['.bt-st-urled-save', tracksStripped, '--r-btn-sm'],
  ['.bt-st-urled-clear', tracksStripped, '--r-btn-sm'],
  ['.bt-curate-btn', tracksStripped, '--r-btn-sm'],
  ['.bt-pl-x', tracksStripped, '--r-btn-sm'],
  ['.bt-st-x', tracksStripped, '--r-btn-sm'],
  ['.bt-st-ytlink', tracksStripped, '--r-btn-sm'],
  ['.rf-x', rfStripped, '--r-btn-sm'],
  ['.bt-st-editlink', rfStripped, '--r-btn-sm'],
  // --r-chip-pill (18px): pill-shaped chip/token primitive
  ['.chip', songbookStripped, '--r-chip-pill'],
  ['.bt-st-scalechip', tracksStripped, '--r-chip-pill'],
  ['.cofModeChip', tracksStripped, '--r-chip-pill'],
  // --r-card (13px): card/panel surfaces
  ['.listItem', songbookStripped, '--r-card'],
  ['.detail', songbookStripped, '--r-card'],
  ['.tCanvasWrap', songbookStripped, '--r-card'],
  ['.tCard', songbookStripped, '--r-card'],
  ['.bigC', songbookStripped, '--r-card'],
  ['.bt-add-panel', tracksStripped, '--r-card'],
  ['.bt-qcard', tracksStripped, '--r-card'],
  ['.cofPanelInner', tracksStripped, '--r-card'],
  // M-EAR wave 1.6 (U16): the Legend primitive's own card surface.
  ['.legend', tracksStripped, '--r-card'],
  // --r-input (10px): text-input controls (narrow application - see the
  // :root token block's scope note; .search/.bt-in deliberately NOT migrated)
  ['.composeRowInput', songbookStripped, '--r-input']
];

RADIUS_CONSUMERS.forEach(function (entry) {
  var selector = entry[0], stripped = entry[1], tokenVar = entry[2];
  test('"' + selector + '" consumes var(' + tokenVar + '), not a re-hardcoded radius literal', function () {
    var body = ruleBody(stripped, selector);
    assert.ok(body !== null, 'expected a "' + selector + '" rule');
    var m = body.match(/border-radius:\s*([^;]+);/);
    assert.ok(m, '"' + selector + '" has no border-radius declaration, got: ' + body);
    assert.strictEqual(m[1].trim(), 'var(' + tokenVar + ')', '"' + selector + '" border-radius must be var(' + tokenVar + '), got: ' + m[1]);
  });
});

/* ---------------------------------------------------------------------
 * (d) U20 (M-EAR wave 1.6, docs/plans/uat-walkthrough-20260704.md,
 * decisions.md D-EAR-1.6) - the accent-derived kx/sound palette. Every
 * color declared INSIDE an `@supports (color: oklch(from red l c h))`
 * feature-detect block must derive from `var(--accent)` via CSS Relative
 * Color Syntax - never a stray literal hex smuggled into the "modern
 * browser" palette layer. The literal-hex FALLBACK declarations OUTSIDE
 * the @supports block (checked by the pre-existing `.sound-bg`/`.sound-line`
 * literal-hex test above) are correct and expected - this assertion is
 * scoped to the @supports block's own content only.
 * ------------------------------------------------------------------- */

function supportsBlockBody(stripped) {
  var m = stripped.match(/@supports\s*\(color:\s*oklch\(from red l c h\)\)\s*\{([\s\S]*)\}\s*$/);
  if (!m) return null;
  // Trim to the LAST top-level closing brace that matches the @supports
  // block's own opening one (a naive [\s\S]* is greedy to end-of-file,
  // which is fine here since nothing follows the block in either file
  // today - re-derive properly if that ever changes).
  return m[1];
}

test('tracks.css: the U20 @supports palette block derives --kx-chord/--kx-blue from var(--accent) via oklch(), never a stray literal hex', function () {
  var body = supportsBlockBody(tracksStripped);
  assert.ok(body !== null, 'expected an @supports (color: oklch(from red l c h)) block in tracks.css');
  assert.ok(body.indexOf('--kx-chord:oklch(from var(--accent)') >= 0, 'expected --kx-chord derived from var(--accent), got: ' + body);
  assert.ok(body.indexOf('--kx-blue:oklch(from var(--accent)') >= 0, 'expected --kx-blue derived from var(--accent), got: ' + body);
  assert.strictEqual(/#[0-9a-fA-F]{3,6}\b/.test(body), false, 'found a stray literal hex color inside the @supports palette block: ' + body);
});

test('songbook.css: the U20 @supports palette block derives --sound-bg/--sound-line from var(--accent) via oklch(), never a stray literal hex', function () {
  var body = supportsBlockBody(songbookStripped);
  assert.ok(body !== null, 'expected an @supports (color: oklch(from red l c h)) block in songbook.css');
  assert.ok(body.indexOf('--sound-bg:oklch(from var(--accent)') >= 0, 'expected --sound-bg derived from var(--accent), got: ' + body);
  assert.ok(body.indexOf('--sound-line:oklch(from var(--accent)') >= 0, 'expected --sound-line derived from var(--accent), got: ' + body);
  assert.strictEqual(/#[0-9a-fA-F]{3,6}\b/.test(body), false, 'found a stray literal hex color inside the @supports palette block: ' + body);
});

test('U20: the complementary (sounding, h+180) and adjacent (chord/blue, h+-30) hue offsets are each declared exactly once per file, both themes', function () {
  var tracksBody = supportsBlockBody(tracksStripped);
  var songbookBody = supportsBlockBody(songbookStripped);
  // tracks.css: 2 rule blocks (bare :root + light override), each declaring
  // both --kx-chord (h + 30) and --kx-blue (h - 30) -> 2 occurrences apiece.
  var chordPlus30 = (tracksBody.match(/calc\(h \+ 30\)/g) || []).length;
  var bluesMinus30 = (tracksBody.match(/calc\(h - 30\)/g) || []).length;
  assert.strictEqual(chordPlus30, 2, 'expected --kx-chord\'s h+30 offset declared once per theme (dark + light), got ' + chordPlus30);
  assert.strictEqual(bluesMinus30, 2, 'expected --kx-blue\'s h-30 offset declared once per theme (dark + light), got ' + bluesMinus30);
  // songbook.css: 2 rule blocks, each declaring --sound-bg AND --sound-line
  // at h + 180 -> 4 occurrences total.
  var complementary180 = (songbookBody.match(/calc\(h \+ 180\)/g) || []).length;
  assert.strictEqual(complementary180, 4, 'expected the complementary h+180 offset on both --sound-bg and --sound-line, both themes (4 total), got ' + complementary180);
});

run();
