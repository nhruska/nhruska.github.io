/* =====================================================================
 * tune-idle-pin.test.js - G2 (ui-ux-polish-20261008) source pins
 * ---------------------------------------------------------------------
 * The Tune card's IDLE state (before Start / after Stop) must not show a bare
 * middle dot in the big-note slot, and must not reserve the live readout's
 * room. The live geometry proof is test/pw/scenarios/tune-idle-compact.json;
 * these pins only stop a later edit from restoring the dot or the reserved
 * rows. Comments are stripped first so a mention never satisfies a pin.
 * Run: node test/tune-idle-pin.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
var js = strip(fs.readFileSync(path.join(__dirname, '../music/shared/tuner.js'), 'utf8'));
var css = strip(fs.readFileSync(path.join(__dirname, '../music/shared/songbook.css'), 'utf8'));

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

test('tuner.js code has no middle-dot placeholder literal', function () {
  assert.ok(js.indexOf('·') === -1, 'a lone middle dot is back in tuner.js code');
});

test('the idle branch of renderGuided takes its note + hint from the idle helpers', function () {
  var m = js.match(/if \(phase === 'idle'\) \{([^}]*)\}/);
  assert.ok(m, 'idle branch not found');
  assert.ok(/note = idleNote\(\)/.test(m[1]), 'idle note must come from idleNote()');
  assert.ok(/txt = idleHint\(\)/.test(m[1]), 'idle hint must come from idleHint()');
});

test('idleNote names the first string (guided) and never returns an empty or dot value', function () {
  var m = js.match(/function idleNote\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(m, 'idleNote not found');
  assert.ok(/STRINGS\[0\]\.n/.test(m[1]), 'guided idle must name the first string');
  assert.ok(/return 'Tune'/.test(m[1]), 'empty-strings fallback must be a word');
});

test('every idle entry point flips the .idle class (build, mode switch, stop, live frames)', function () {
  assert.ok(/box\.classList\.add\('idle'\)/.test(js), 'buildMic must start idle');
  // review fix: setMode / stopFree / buildMic funnel through ONE renderIdle() (placeholder +
  // hint + .idle together) - pin the funnel, not a raw setIdle call count.
  var ri = /function renderIdle\(\) \{[\s\S]*?\n  \}/.exec(js);
  assert.ok(ri, 'renderIdle helper must exist');
  assert.ok(/setIdle\(true\)/.test(ri[0]) && /idleNote\(\)/.test(ri[0]) && /idleHint\(\)/.test(ri[0]), 'renderIdle must set the placeholder, the hint and the .idle class together');
  assert.ok((js.match(/\brenderIdle\(\);/g) || []).length >= 2, 'setMode and stopFree must land in idle through renderIdle()');
  assert.ok(/setIdle\(phase === 'idle'\)/.test(js), 'renderGuided must derive idle from the phase');
  assert.ok(/setIdle\(false\)/.test(js), 'startFree must leave idle');
});

test('CSS: idle card hugs its content, hides the runway, portrait only', function () {
  assert.ok(/@media not \(\(orientation:landscape\) and \(max-height:560px\)\)\{[\s\S]*?\.tCard:has\(\.micBox\.idle\)\{flex:0 0 auto;\}/.test(css), 'idle card must stop growing (outside short landscape)');
  assert.ok(/\.micBox\.idle > \.runway/.test(css) && /display:none/.test(css.match(/\.micBox\.idle > \.runway[^{]*\{[^}]*\}/)[0]), 'idle must hide the runway');
  assert.ok(/\.micNote\.idle\{color:var\(--txt-dim\)\;\}/.test(css), 'idle note is dimmed');
});

run();
