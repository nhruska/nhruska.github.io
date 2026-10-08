/* =====================================================================
 * studio-chip-primitive.test.js - U4 (ui-ux-polish-20261008) source pins
 * ---------------------------------------------------------------------
 * (1) The Studio chord chip `.bt-st-chordchip` (tracks.css) MIRRORS the
 *     song-view chord-chip primitive `.chordChips .c` (songbook.css): same
 *     meaning, one look (Element Consistency Law). The two rules must agree
 *     on the tap floor, type, surface, border, radius and :active grammar -
 *     drift becomes a failure here instead of a UAT finding.
 * (2) The Studio icon buttons carry inline SVG ink, not symbol-text glyphs
 *     (icon-density standard): the sound toggle (PLAY/STOP), the bar menu
 *     (dots) and the mini-bar close (X). The LOCKED SVG strings are shared
 *     verbatim with songbook.js (U2) - pinned here byte for byte.
 * The live geometry proof (offsetHeight >= 44, one row at 412) is the
 * Playwright measurement in the PR; this stops a later edit from silently
 * undoing it. Run: node test/studio-chip-primitive.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
var songCss = strip(fs.readFileSync(path.join(__dirname, '../music/shared/songbook.css'), 'utf8'));
var trkCss = strip(fs.readFileSync(path.join(__dirname, '../music/shared/tracks.css'), 'utf8'));
var trkJs = fs.readFileSync(path.join(__dirname, '../music/shared/tracks.js'), 'utf8');

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

// Declarations of the rule whose selector list is EXACTLY `sel`, as {prop: value}.
function decls(css, sel, label) {
  var esc = sel.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
  var m = css.match(new RegExp('(?:^|\\})\\s*' + esc + '\\s*\\{([^}]*)\\}'));
  assert.ok(m, 'expected a rule for ' + sel + ' in ' + label);
  var out = {};
  m[1].split(';').forEach(function (d) {
    var i = d.indexOf(':');
    if (i < 0) return;
    out[d.slice(0, i).trim()] = d.slice(i + 1).replace(/\s+/g, ' ').trim();
  });
  return out;
}

var PRIM = decls(songCss, '.chordChips .c', 'songbook.css');
var STUDIO = decls(trkCss, '.bt-st-chordchip', 'tracks.css');
var PRIM_ACTIVE = decls(songCss, '.chordChips .c:active', 'songbook.css');
var STUDIO_ACTIVE = decls(trkCss, '.bt-st-chordchip:active', 'tracks.css');

// ---- (1) Studio chip mirrors the song-view primitive ----
['min-height', 'font-family', 'font-weight', 'font-size', 'border-radius', 'background', 'border'].forEach(function (p) {
  test('Studio chord chip agrees with .chordChips .c on ' + p, function () {
    assert.ok(PRIM[p], 'primitive declares no ' + p);
    assert.strictEqual(STUDIO[p], PRIM[p], p + ' drifted: studio "' + STUDIO[p] + '" vs primitive "' + PRIM[p] + '"');
  });
});

test('both chips take the radius and surface from TOKENS, not literals', function () {
  assert.strictEqual(PRIM['border-radius'], 'var(--r-btn-sm)');
  assert.strictEqual(PRIM.background, 'var(--surface-2)');
});

test('tap floor: the Studio chip is >= 44px tall (was 40)', function () {
  var h = /^(\d+)px$/.exec(STUDIO['min-height']);
  assert.ok(h && +h[1] >= 44, 'min-height ' + STUDIO['min-height']);
});

['transform', 'background', 'color'].forEach(function (p) {
  test('Studio chord chip :active agrees with the primitive on ' + p, function () {
    assert.ok(PRIM_ACTIVE[p], 'primitive :active declares no ' + p);
    assert.strictEqual(STUDIO_ACTIVE[p], PRIM_ACTIVE[p], p + ' drifted: "' + STUDIO_ACTIVE[p] + '" vs "' + PRIM_ACTIVE[p] + '"');
  });
});

test('the strip fit survives: flex:1 1 0 + min-width:0 + ellipsis stay on the Studio chip', function () {
  assert.strictEqual(STUDIO.flex, '1 1 0');
  assert.strictEqual(STUDIO['min-width'], '0');
  assert.strictEqual(STUDIO['text-overflow'], 'ellipsis');
  assert.strictEqual(STUDIO['white-space'], 'nowrap');
});

test('an in-song chip keeps a readable :active (accent ink on accent would vanish)', function () {
  var d = decls(trkCss, '.bt-st-chordchip.inSong:active', 'tracks.css');
  assert.strictEqual(d.color, 'var(--on-accent)');
});

// ---- (2) Studio icon glyphs are SVG, not symbol text ----
var LOCKED = {
  PLAY_SVG: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  STOP_SVG: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  CLOSE_SVG: '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
Object.keys(LOCKED).forEach(function (k) {
  test(k + ' is the locked string, byte for byte (shared with songbook.js)', function () {
    assert.ok(trkJs.indexOf("var " + k + " = '" + LOCKED[k] + "';") >= 0, k + ' drifted from the locked interface');
  });
});

test('the &#9658; / &#9632; text glyphs are gone from tracks.js', function () {
  assert.ok(!/&#9658;|&#9632;/.test(trkJs), 'a play/stop entity is still present');
});

test('the sound-toggle markup and its on/off swap carry <svg>, not entities', function () {
  var markup = trkJs.split('\n').filter(function (l) { return l.indexOf('data-soundtoggle type="button"') >= 0; });
  assert.strictEqual(markup.length, 1, 'expected exactly one sound-toggle markup line');
  assert.ok(/PLAY_SVG/.test(markup[0]), 'markup does not use PLAY_SVG: ' + markup[0]);
  assert.ok(/soundToggleEl\.innerHTML = on \? STOP_SVG : PLAY_SVG;/.test(trkJs), 'on/off swap is not SVG');
  assert.ok(/var PLAY_SVG = '<svg /.test(trkJs) && /var STOP_SVG = '<svg /.test(trkJs));
});

test('the bar menu and mini-bar close wear SVG, not the dots / times glyphs', function () {
  var menu = trkJs.split('\n').filter(function (l) { return l.indexOf('bt-st-np-menu') >= 0 && l.indexOf('<button') >= 0; });
  assert.strictEqual(menu.length, 1);
  assert.ok(/DOTS_SVG/.test(menu[0]) && menu[0].indexOf('⋯') < 0, menu[0]);
  var x = trkJs.split('\n').filter(function (l) { return l.indexOf('data-minix') >= 0 && l.indexOf('<button') >= 0; });
  assert.strictEqual(x.length, 1);
  assert.ok(/CLOSE_SVG/.test(x[0]) && x[0].indexOf('&#215;') < 0, x[0]);
});

test('the Studio sound-toggle override keeps the 44px box and drops the text-glyph font-size hack', function () {
  var d = decls(trkCss, '.bt-studio .bt-st-ctrlrow .soundToggle', 'tracks.css');
  assert.strictEqual(d.width, '44px');
  assert.strictEqual(d.height, '44px');
  assert.ok(!('font-size' in d), 'font-size hack is back: ' + d['font-size']);
});

test('the mini-bar close drops its glyph font-size and keeps the 44px box', function () {
  var d = decls(trkCss, '.bt-st-minix', 'tracks.css');
  assert.strictEqual(d.width, '44px');
  assert.strictEqual(d.height, '44px');
  assert.ok(!('font-size' in d), 'font-size hack is back');
});

test('Studio/bar icon svgs never eat the tap and sit block-level', function () {
  var d = decls(trkCss, '.bt-studio button > svg,.bt-st-head button > svg', 'tracks.css');
  assert.strictEqual(d.display, 'block');
  assert.strictEqual(d['pointer-events'], 'none');
});

run();
