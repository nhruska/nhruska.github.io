/* =====================================================================
 * tempo.test.js  -  unit tests for the Campfire tempo / tap-tempo engine.
 * Run: node test/tempo.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var createTempo = require('../music/shared/tempo.js').createTempo;

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

/* ---------- bpm + interval ---------- */
test('defaults to a sane bpm and 4 beats per bar', function () {
  var t = createTempo();
  assert.strictEqual(t.bpm(), 100);
  assert.strictEqual(t.beatsPerBar(), 4);
});
test('setBpm clamps to [40,240]', function () {
  var t = createTempo();
  assert.strictEqual(t.setBpm(120), 120);
  assert.strictEqual(t.setBpm(10), 40);
  assert.strictEqual(t.setBpm(900), 240);
  assert.strictEqual(t.setBpm(120.6), 121); // rounds
});
test('interval() is ms per beat', function () {
  var t = createTempo(); t.setBpm(120);
  assert.strictEqual(t.interval(), 500);
  t.setBpm(60);
  assert.strictEqual(t.interval(), 1000);
});

/* ---------- tap tempo ---------- */
test('first tap returns null (need two taps to know an interval)', function () {
  var t = createTempo();
  assert.strictEqual(t.tap(0), null);
});
test('two taps 500ms apart = 120 bpm', function () {
  var t = createTempo();
  t.tap(1000);
  assert.strictEqual(t.tap(1500), 120);
  assert.strictEqual(t.bpm(), 120);
});
test('steady taps average to a stable bpm', function () {
  var t = createTempo();
  t.tap(0); t.tap(500); t.tap(1000);
  assert.strictEqual(t.tap(1500), 120); // intervals all 500
});
test('a long gap (> reset window) restarts the tap sequence', function () {
  var t = createTempo();
  t.tap(0);
  assert.strictEqual(t.tap(500), 120);
  assert.strictEqual(t.tap(5000), null); // gap 4500ms > reset → treated as a fresh first tap
});
test('tap bpm is clamped into range', function () {
  var t = createTempo();
  t.tap(0);
  assert.strictEqual(t.tap(100), 240); // 600 bpm raw → clamp 240
  var t2 = createTempo();
  t2.tap(0);
  assert.strictEqual(t2.tap(2000), 40); // 30 bpm raw → clamp 40 (within reset window)
});
test('reset() clears the tap history', function () {
  var t = createTempo();
  t.tap(0); t.tap(500);
  t.reset();
  assert.strictEqual(t.tap(9000), null); // first tap after reset
});

/* ---------- beat clock ---------- */
test('beatIndex counts beats since start, never negative', function () {
  var t = createTempo(); t.setBpm(120); // 500ms/beat
  assert.strictEqual(t.beatIndex(1000, 1000), 0);
  assert.strictEqual(t.beatIndex(1000, 1300), 0);
  assert.strictEqual(t.beatIndex(1000, 1500), 1);
  assert.strictEqual(t.beatIndex(1000, 2600), 3);
  assert.strictEqual(t.beatIndex(1000, 500), 0); // now before start → 0
});
test('beatInBar wraps within the bar (downbeat = 0)', function () {
  var t = createTempo(); t.setBpm(120);
  assert.strictEqual(t.beatInBar(0, 0), 0);
  assert.strictEqual(t.beatInBar(0, 2000), 0); // beat 4 → downbeat
  assert.strictEqual(t.beatInBar(0, 2500), 1); // beat 5 → 1
});

run();
