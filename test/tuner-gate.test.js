/* =====================================================================
 * tuner-gate.test.js  -  the voice gate: the string, or just our own tone?
 * Run: node test/tuner-gate.test.js
 * Operator UAT 2026-09-12: with the reference tone on and NO guitar, the
 * tuner read "in tune" and walked every string. The tone comes back through
 * the phone speaker with harmonics the cancellation leaves behind, and that
 * leftover is periodic at exactly the target. The gate says: while the tone
 * plays, a frame is voiced only when the cancelled signal is clearly louder
 * than the quietest cancelled frame heard (the tone's own floor).
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tuner.js');

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
var good = { freq: 110, clarity: 0.97 };

test('tone leftover alone (rms at the floor, perfect clarity) is NOT voiced', function () {
  assert.strictEqual(T.voiceGate(good, 0.010, false, 0.010, 0.9, 0.72, 3), false);
  assert.strictEqual(T.voiceGate(good, 0.025, false, 0.010, 0.9, 0.72, 3), false, '2.5x the floor is still the tone');
});
test('a string clearly above the tone floor IS voiced', function () {
  assert.strictEqual(T.voiceGate(good, 0.040, false, 0.010, 0.9, 0.72, 3), true);
});
test('with the tone off (floor 0) only the clarity hysteresis decides', function () {
  assert.strictEqual(T.voiceGate(good, 0.005, false, 0, 0.9, 0.72, 3), true);
  assert.strictEqual(T.voiceGate({ freq: 110, clarity: 0.8 }, 0.05, false, 0, 0.9, 0.72, 3), false, 'below acquire');
  assert.strictEqual(T.voiceGate({ freq: 110, clarity: 0.8 }, 0.05, true, 0, 0.9, 0.72, 3), true, 'above hold while reading');
});
test('an unset floor (Infinity, first frame after a retarget) blocks nothing but the pitch test', function () {
  assert.strictEqual(T.voiceGate(good, 0.05, false, Infinity, 0.9, 0.72, 3), true);
  assert.strictEqual(T.voiceGate({ freq: -1, clarity: 0 }, 0.05, false, Infinity, 0.9, 0.72, 3), false);
});
test('rmsOf measures what the gate compares', function () {
  var b = new Float32Array(1000); for (var i = 0; i < b.length; i++) b[i] = 0.5 * Math.sin(i / 7);
  assert.ok(Math.abs(T.rmsOf(b) - 0.5 / Math.SQRT2) < 0.01, 'rms ' + T.rmsOf(b));
});
run();
