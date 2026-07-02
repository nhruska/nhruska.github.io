/* =====================================================================
 * key-explorer.test.js  -  unit tests for KeyExplorer.posWindow (the pure
 * window math behind the scale position-shift control: shown span, end
 * fret, and the back/forward gating incl. the fret-14 cap). The DOM path
 * (renderScale wiring) is exercised via Playwright at integration.
 * Run: node test/key-explorer.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var KE = require('../music/shared/key-explorer.js');

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

/* ---- the standard 7-fret walk at step 5, cap 14 (0-7 -> 5-11 -> 10-14) ---- */
test('open window (start 0): full span, back disabled, forward enabled', function () {
  assert.deepStrictEqual(KE.posWindow(0, 7, 5, 14), { shown: 7, end: 7, canBack: false, canFwd: true });
});
test('mid window (start 5): full 5-11 span, both directions enabled', function () {
  assert.deepStrictEqual(KE.posWindow(5, 7, 5, 14), { shown: 7, end: 11, canBack: true, canFwd: true });
});
test('cap window (start 10): truncates to 10-14 and forward disables', function () {
  assert.deepStrictEqual(KE.posWindow(10, 7, 5, 14), { shown: 5, end: 14, canBack: true, canFwd: false });
});
test('the window END never passes the cap at any stop of the walk', function () {
  [0, 5, 10].forEach(function (s) {
    var w = KE.posWindow(s, 7, 5, 14);
    assert.ok(w.end <= 14, 'start ' + s + ' rendered past the cap: end ' + w.end);
  });
});

/* ---- non-default spans ---- */
test('narrow span (F=5) walks without truncation until the cap stop', function () {
  assert.deepStrictEqual(KE.posWindow(5, 5, 5, 14), { shown: 5, end: 9, canBack: true, canFwd: true });
  assert.deepStrictEqual(KE.posWindow(10, 5, 5, 14), { shown: 5, end: 14, canBack: true, canFwd: false });
});
test('open window ignores the cap (startFret 0 is the classic first-position view)', function () {
  var w = KE.posWindow(0, 15, 5, 14);
  assert.strictEqual(w.shown, 15); // open view keeps its full span; the cap governs SHIFTED windows
  assert.strictEqual(w.canBack, false);
});

run();
