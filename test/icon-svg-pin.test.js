/* =====================================================================
 * icon-svg-pin.test.js - U2 (ui-ux-polish-20261008) source pins
 * ---------------------------------------------------------------------
 * Icon-only buttons carry inline SVG (icon-density standard: SVG renders its
 * stated size, text glyphs under-render) and keep an accessible name. Pins the
 * migrated controls at the source so a later edit cannot quietly restore the
 * text glyph. Live geometry proof: test/pw/scenarios/ui-icon-density.json.
 * Run: node test/icon-svg-pin.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var js = fs.readFileSync(path.join(__dirname, '../music/shared/songbook.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, '../music/play/index.html'), 'utf8');
var css = fs.readFileSync(path.join(__dirname, '../music/shared/songbook.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ok ' + c[0]); }
    catch (e) { failed++; console.log('  FAIL ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

var PLAY_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>';
var STOP_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
var CLOSE_SVG = '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function btn(id) {
  var m = html.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>[\\s\\S]*?</button>'));
  assert.ok(m, 'expected button #' + id + ' in play/index.html');
  return m[0];
}

test('locked SVG strings are declared verbatim in songbook.js', function () {
  assert.ok(js.indexOf("var PLAY_SVG = '" + PLAY_SVG + "';") >= 0, 'PLAY_SVG drifted from the locked interface');
  assert.ok(js.indexOf("var STOP_SVG = '" + STOP_SVG + "';") >= 0, 'STOP_SVG drifted from the locked interface');
  assert.ok(js.indexOf("var CLOSE_SVG = '" + CLOSE_SVG + "';") >= 0, 'CLOSE_SVG drifted from the locked interface');
});

test('sound toggle: svg play/stop, no text glyph entities, aria contract kept', function () {
  assert.ok(/soundToggle\.innerHTML = PLAY_SVG;/.test(js), 'initial markup must be PLAY_SVG');
  assert.ok(/soundToggle\.innerHTML = on \? STOP_SVG : PLAY_SVG;/.test(js), 'toggle must swap STOP_SVG/PLAY_SVG');
  assert.ok(!/&#9658;|&#9632;/.test(js), 'songbook.js must not carry the &#9658; / &#9632; text glyphs');
  assert.ok(/setAttribute\('aria-label', 'Hear this scale'\)/.test(js) && /on \? 'Stop' : 'Hear this scale'/.test(js), 'aria-label contract');
  assert.ok(/setAttribute\('aria-pressed'/.test(js), 'aria-pressed contract');
});

test('sound toggle CSS: 44x44 box, no glyph font-size hack', function () {
  var m = css.match(/(?:^|\})\s*\.soundToggle\s*\{([^}]*)\}/);
  assert.ok(m, 'expected a .soundToggle rule');
  assert.ok(/width:44px/.test(m[1]) && /height:44px/.test(m[1]), '.soundToggle must be 44x44');
  assert.ok(!/font-size/.test(m[1]), '.soundToggle must not carry the text-glyph font-size hack');
});

test('shared rule gives migrated svg buttons display:block + pointer-events:none', function () {
  var m = css.match(/(?:^|\})\s*(\.iconBtn > svg[^{]*)\{([^}]*)\}/);
  assert.ok(m, 'expected the shared icon svg rule');
  ['.searchClear > svg', '.songCanvasClose > svg', '.maxClose > svg', '.invModal-x > svg', '.welcomeCard .x > svg', '.setHd .x > svg', '.songSect .rm > svg'].forEach(function (s) {
    assert.ok(m[1].indexOf(s) >= 0, 'shared rule must cover ' + s);
  });
  assert.ok(/display:block/.test(m[2]) && /pointer-events:none/.test(m[2]), 'display:block + pointer-events:none');
});

test('songbook.js JS-built buttons: svg, no symbol glyph', function () {
  assert.ok(/songCloseEl\.innerHTML = CLOSE_SVG;/.test(js), '.songCanvasClose must carry CLOSE_SVG');
  assert.ok(!/songCloseEl\.textContent/.test(js), '.songCanvasClose must not set a text glyph');
  assert.ok(/class="invModal-x" type="button" aria-label="Close">' \+ CLOSE_SVG \+ '</.test(js), '.invModal-x must carry CLOSE_SVG + keep aria-label');
  assert.ok(!/invModal-x[^\n]*✕/.test(js), '.invModal-x must not carry the close glyph');
  assert.ok(/id="moreBtn" type="button"[^\n]*aria-label="More actions"[^\n]*aria-expanded="false">' \+ DOTS_SVG \+ '</.test(js), '#moreBtn must carry DOTS_SVG + keep aria-label');
  assert.ok(/rm\.className = 'rm'; rm\.innerHTML = CLOSE_SVG_SM;/.test(js), 'song-section .rm must carry the small close svg');
  assert.ok(/rm\.setAttribute\('aria-label', 'Remove ' \+ sec\.label/.test(js), 'song-section .rm keeps its aria-label');
});

test('play/index.html close/clear buttons: svg, type=button, aria-label, no glyph', function () {
  ['filterClear', 'searchClear', 'setClear', 'maxClose', 'welcomeSkip', 'setClose'].forEach(function (id) {
    var b = btn(id);
    assert.ok(/<svg /.test(b), '#' + id + ' must carry an inline <svg>');
    assert.ok(!/✕|&#10005;|&times;|&#215;|×/.test(b), '#' + id + ' must not carry a text close glyph');
    assert.ok(/aria-label="[^"]+"/.test(b), '#' + id + ' must keep an aria-label (svg has no text)');
    assert.ok(/aria-hidden="true"/.test(b), '#' + id + ' svg must be aria-hidden');
  });
  ['filterClear', 'searchClear', 'setClear', 'maxClose', 'welcomeSkip', 'setClose'].forEach(function (id) {
    assert.ok(/type="button"/.test(btn(id)), '#' + id + ' must be type=button');
  });
});

run();
