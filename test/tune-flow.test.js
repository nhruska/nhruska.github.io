/* =====================================================================
 * tune-flow.test.js  -  the Guided Tune loop, proven without a microphone
 * Run: node test/tune-flow.test.js
 * TuneFlow is a pure state machine: we feed it synthetic detector frames
 * (cents vs target, or null for unvoiced) on a fake clock and assert the
 * operator's tuning model holds - approach from flat, arrival must be
 * SUSTAINED and VOICED, overshoot never advances, done stops the loop.
 * ===================================================================== */
'use strict';
var assert = require('assert');
var TuneFlow = require('../music/shared/tune-flow.js');

var GUITAR = [
  { n: 'E', l: '6th', f: 82.41 }, { n: 'A', l: '5th', f: 110.00 }, { n: 'D', l: '4th', f: 146.83 },
  { n: 'G', l: '3rd', f: 196.00 }, { n: 'B', l: '2nd', f: 246.94 }, { n: 'E', l: '1st', f: 329.63 }
];
var FRAME = 16; // ms between detector frames (~60fps)

function make(strings, opts) {
  var o = opts || {}; o.strings = strings || GUITAR;
  return TuneFlow.create(o);
}
// Feed `n` frames at `cents` starting at clock `t`; returns the clock after the last frame.
function frames(flow, cents, n, t) {
  for (var i = 0; i < n; i++) { flow.feed(cents, t); t += FRAME; }
  return t;
}
// Feed frames at `cents` for `ms` of clock time (frame period FRAME).
function feedFor(flow, cents, ms, t) { return frames(flow, cents, Math.round(ms / FRAME), t); }
// Record every event in order as 'name:index'.
function recorder(flow) {
  var log = [];
  ['retarget', 'landed', 'advance', 'done'].forEach(function (ev) {
    flow.on(ev, function (p) { log.push(ev + (p.index == null ? '' : ':' + p.index)); });
  });
  return log;
}
function count(log, ev) { return log.filter(function (e) { return e.indexOf(ev) === 0; }).length; }
// Drive a fresh flow to 'landed' on string 0 at clock 0; returns the clock after landing.
function landFirst(flow) {
  flow.start();
  var t = feedFor(flow, 0, 700, 0);
  assert.strictEqual(flow.state().phase, 'landed', 'precondition: landed');
  return t;
}

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

// 1. start()
test('start(): approach on the lowest string, one retarget for index 0', function () {
  var flow = make(), log = recorder(flow);
  assert.strictEqual(flow.state().phase, 'idle');
  assert.strictEqual(flow.state().target, null);
  flow.start();
  var st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.index, 0);
  assert.strictEqual(st.target, GUITAR[0]);
  assert.strictEqual(st.cents, null);
  assert.strictEqual(st.hint, null);
  assert.deepStrictEqual(log, ['retarget:0']);
});

// 2. the hold requirement
test('hold: 500ms in the zone is still arriving; 600ms lands it', function () {
  var flow = make(), log = recorder(flow);
  flow.start();
  var t = feedFor(flow, 0, 500, 0);
  var st = flow.state();
  assert.strictEqual(st.phase, 'arriving', 'still arriving at 500ms');
  assert.ok(st.holdProgress >= 0.7 && st.holdProgress <= 0.95, 'holdProgress ' + st.holdProgress);
  assert.strictEqual(count(log, 'landed'), 0, 'must not land before holdMs');
  assert.strictEqual(st.progress[0], false);
  t = feedFor(flow, 0, 150, t);
  st = flow.state();
  assert.strictEqual(st.phase, 'landed');
  assert.strictEqual(st.holdProgress, 1);
  assert.strictEqual(count(log, 'landed'), 1);
  assert.strictEqual(st.progress[0], true);
  assert.strictEqual(typeof st.landedAt, 'number');
});

// 3. sharp resets, sharp never lands
test('sharp while arriving resets to approach with holdProgress 0', function () {
  var flow = make(), log = recorder(flow);
  flow.start();
  var t = feedFor(flow, 0, 300, 0);
  assert.strictEqual(flow.state().phase, 'arriving');
  // a sustained +5 (sustained because the 5-frame median absorbs a lone blip)
  t = feedFor(flow, 5, 300, t);
  var st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.holdProgress, 0);
  assert.strictEqual(st.hint, 'sharp');
  assert.strictEqual(count(log, 'landed'), 0);
});
test('sharp frames alone never land, however long they last', function () {
  var flow = make(), log = recorder(flow);
  flow.start();
  feedFor(flow, 5, 3000, 0);
  assert.strictEqual(flow.state().phase, 'approach');
  assert.strictEqual(flow.state().hint, 'sharp');
  assert.strictEqual(count(log, 'landed'), 0);
  assert.strictEqual(count(log, 'advance'), 0);
});

// 4. unvoiced gaps
test('an unvoiced gap longer than gapMs breaks the arrival', function () {
  var flow = make();
  flow.start();
  var t = feedFor(flow, 0, 200, 0);
  assert.strictEqual(flow.state().phase, 'arriving');
  t = feedFor(flow, null, 180, t);       // > 150ms of nothing
  assert.strictEqual(flow.state().phase, 'approach');
  assert.strictEqual(flow.state().holdProgress, 0);
});
test('an unvoiced gap shorter than gapMs keeps the arrival alive', function () {
  var flow = make();
  flow.start();
  var t = feedFor(flow, 0, 200, 0);
  var before = flow.state().holdProgress;
  t = feedFor(flow, null, 100, t);       // < 150ms
  assert.strictEqual(flow.state().phase, 'arriving');
  frames(flow, 0, 1, t);
  assert.strictEqual(flow.state().phase, 'arriving');
  assert.ok(flow.state().holdProgress > before, 'hold keeps accumulating');
});

// 5. flat approach then land
test('flat approach: sweeping -30 -> 0 lands only after holdMs inside the zone', function () {
  var flow = make(), log = recorder(flow);
  var arrivedAt = null, landedAtEv = null;
  flow.on('landed', function (p) { landedAtEv = p.nowMs; });
  flow.start();
  var t = 0;
  for (var c = -30; c <= 0; c++) {             // one cent per frame, tightening up
    flow.feed(c, t); t += FRAME;
    var st = flow.state();
    assert.notStrictEqual(st.phase, 'landed', 'landed mid-sweep at ' + c);
    if (st.phase === 'arriving' && arrivedAt === null) arrivedAt = t - FRAME;
    if (c < -4) assert.strictEqual(st.hint, 'flat', 'flat hint at ' + c);
  }
  assert.strictEqual(count(log, 'landed'), 0, 'not landed right after the sweep');
  // hold at 0: the EMA settles into the zone, the hold accrues, it lands,
  // celebrates, advances - stop feeding there so string 1 is not tuned too
  for (var i = 0; i < 3000 / FRAME && count(log, 'advance') === 0; i++) {
    flow.feed(0, t); t += FRAME;
    if (flow.state().phase === 'arriving' && arrivedAt === null) arrivedAt = t - FRAME;
  }
  assert.notStrictEqual(arrivedAt, null, 'never entered arriving');
  assert.strictEqual(count(log, 'landed'), 1);
  assert.ok(landedAtEv - arrivedAt >= 600, 'landed ' + (landedAtEv - arrivedAt) + 'ms after arriving');
  assert.deepStrictEqual(log, ['retarget:0', 'landed:0', 'advance:1', 'retarget:1']);
});

// 6. celebration
test('celebration: landed holds with cents frozen, then advances to index 1', function () {
  var flow = make(), log = recorder(flow);
  var t = landFirst(flow);
  var frozen = flow.state().cents, landedAt = flow.state().landedAt;
  t = feedFor(flow, -20, 500, t);              // wild frames during the celebration
  var st = flow.state();
  assert.strictEqual(st.phase, 'landed');
  assert.strictEqual(st.cents, frozen, 'cents frozen on the landing value');
  assert.strictEqual(st.landedAt, landedAt);
  assert.strictEqual(count(log, 'advance'), 0);
  t = feedFor(flow, null, 300, t);             // past celebrateMs (unvoiced frames count too)
  st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.index, 1);
  assert.strictEqual(st.target, GUITAR[1]);
  assert.strictEqual(st.landedAt, null);
  assert.strictEqual(st.cents, null, 'fresh read on the new target');
  assert.deepStrictEqual(log, ['retarget:0', 'landed:0', 'advance:1', 'retarget:1']);
});

// 7. done
test('last string landing -> done after the celebration; feed is a no-op; start() clears progress', function () {
  var flow = make(GUITAR.slice(0, 2)), log = recorder(flow);
  var doneAt = null;
  flow.on('done', function (p) { doneAt = p.nowMs; });
  flow.start();
  var t = feedFor(flow, 0, 1500, 0);           // land 0, celebrate, advance to 1
  assert.strictEqual(flow.state().index, 1);
  t = feedFor(flow, 0, 1500, t);               // land 1, celebrate, done
  var st = flow.state();
  assert.strictEqual(st.phase, 'done');
  assert.deepStrictEqual(st.progress, [true, true]);
  assert.strictEqual(count(log, 'done'), 1);
  assert.strictEqual(typeof doneAt, 'number');
  assert.strictEqual(count(log, 'advance'), 1, 'no advance past the last string');
  // no-op afterwards
  var snap = JSON.stringify(st);
  t = feedFor(flow, -30, 500, t);
  assert.strictEqual(JSON.stringify(flow.state()), snap);
  flow.retarget(0);
  assert.strictEqual(flow.state().phase, 'done', 'retarget is refused in done');
  // restart
  flow.start();
  st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.index, 0);
  assert.deepStrictEqual(st.progress, [false, false]);
});

// 8. retarget mid-approach
test('retarget(3) mid-approach: index 3, retarget emitted, smoothing reset (first frame snaps)', function () {
  var flow = make(), log = recorder(flow);
  flow.start();
  var t = feedFor(flow, -20, 300, 0);
  assert.strictEqual(flow.state().phase, 'approach');
  flow.retarget(3);
  var st = flow.state();
  assert.strictEqual(st.index, 3);
  assert.strictEqual(st.target, GUITAR[3]);
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.cents, null);
  assert.strictEqual(st.rawCents, null);
  assert.deepStrictEqual(log, ['retarget:0', 'retarget:3']);
  flow.feed(-12, t);
  st = flow.state();
  assert.strictEqual(st.cents, -12, 'no EMA lag after retarget');
  assert.strictEqual(st.rawCents, -12);
  assert.strictEqual(st.hint, 'flat');
});
test('retarget to the current index restarts its approach and emits', function () {
  var flow = make(), log = recorder(flow);
  flow.start();
  var t = feedFor(flow, 0, 300, 0);
  assert.strictEqual(flow.state().phase, 'arriving');
  flow.retarget(0);
  assert.strictEqual(flow.state().phase, 'approach');
  assert.strictEqual(flow.state().holdProgress, 0);
  assert.deepStrictEqual(log, ['retarget:0', 'retarget:0']);
});

// 9. retarget during landed cancels the celebration
test('retarget during landed: no advance for the cancelled string, progress stays true', function () {
  var flow = make(), log = recorder(flow);
  var t = landFirst(flow);
  flow.retarget(4);
  var st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.index, 4);
  assert.strictEqual(st.progress[0], true);
  assert.strictEqual(st.landedAt, null);
  t = feedFor(flow, -20, 1000, t);             // well past celebrateMs
  assert.strictEqual(count(log, 'advance'), 0);
  assert.deepStrictEqual(log, ['retarget:0', 'landed:0', 'retarget:4']);
});

// 10. advance skips done strings and wraps
test('advance skips done strings and wraps: land 0, retarget(2), land it -> advance to 1', function () {
  var flow = make(GUITAR.slice(0, 3)), log = recorder(flow);
  var t = landFirst(flow);
  t = feedFor(flow, null, 800, t);             // celebrate -> advance to 1
  assert.strictEqual(flow.state().index, 1);
  flow.retarget(2);
  t = feedFor(flow, 0, 700, t);                // land 2
  assert.strictEqual(flow.state().phase, 'landed');
  t = feedFor(flow, null, 800, t);             // celebrate, advance (silence on the new target)
  var st = flow.state();
  assert.strictEqual(st.phase, 'approach');
  assert.strictEqual(st.index, 1, 'wrapped past done string 0 to the undone 1');
  assert.deepStrictEqual(st.progress, [true, false, true]);
  assert.deepStrictEqual(log, ['retarget:0', 'landed:0', 'advance:1', 'retarget:1', 'retarget:2', 'landed:2', 'advance:1', 'retarget:1']);
});

// 11. smoothing
test('smoothing: one +60 glitch among 0c frames barely moves cents; four in a row are adopted', function () {
  var flow = make();
  flow.start();
  var t = feedFor(flow, 0, 200, 0);
  var before = flow.state().cents;
  flow.feed(60, t); t += FRAME;
  var st = flow.state();
  assert.ok(Math.abs(st.cents - before) <= 1, 'glitch moved cents by ' + (st.cents - before));
  assert.strictEqual(st.rawCents, 60, 'rawCents still reports the fed value');
  t = frames(flow, 0, 3, t);
  assert.ok(Math.abs(flow.state().cents) <= 1, 'back on 0 after the blip');
  t = frames(flow, 60, 4, t);                  // persistent deviation = a real move
  st = flow.state();
  assert.ok(st.cents > 15, 'adopted after 4 agreeing frames, cents=' + st.cents);
  assert.strictEqual(st.hint, 'sharp');
  t = frames(flow, 60, 20, t);
  assert.ok(flow.state().cents > 55, 'converges onto the new value, cents=' + flow.state().cents);
});
test('smoothing: an unvoiced frame does not disturb the read', function () {
  var flow = make();
  flow.start();
  var t = feedFor(flow, -10, 200, 0);
  var before = flow.state().cents;
  flow.feed(null, t);
  assert.strictEqual(flow.state().cents, before);
  assert.strictEqual(flow.state().rawCents, -10);
});

// 12. state() is a fresh object
test('state() returns a fresh object each call; mutating it does not touch the flow', function () {
  var flow = make();
  flow.start();
  feedFor(flow, 0, 100, 0);
  var a = flow.state(), b = flow.state();
  assert.notStrictEqual(a, b);
  assert.deepStrictEqual(a, b);
  a.phase = 'done'; a.index = 5; a.progress[0] = true; a.cents = 99;
  var c = flow.state();
  assert.strictEqual(c.phase, 'arriving');
  assert.strictEqual(c.index, 0);
  assert.strictEqual(c.progress[0], false);
  assert.strictEqual(c.cents, 0);
});

// 13. on() unsubscribe
test('on() returns an unsubscribe that stops further calls; handlers get the state too', function () {
  var flow = make(), calls = 0, gotState = null;
  var off = flow.on('retarget', function (p, st) { calls++; gotState = st; });
  flow.start();
  assert.strictEqual(calls, 1);
  assert.strictEqual(gotState.phase, 'approach');
  assert.strictEqual(gotState.index, 0);
  off();
  flow.retarget(2);
  assert.strictEqual(calls, 1);
  off(); // idempotent
});

// defaults + stop()
test('create() applies the documented defaults and requires strings', function () {
  assert.throws(function () { TuneFlow.create({}); });
  var flow = make(GUITAR, { holdMs: 200 });
  flow.start();
  var t = feedFor(flow, 0, 150, 0);
  assert.strictEqual(flow.state().phase, 'arriving');
  feedFor(flow, 0, 100, t);
  assert.strictEqual(flow.state().phase, 'landed', 'custom holdMs honoured');
});
test('stop(): idle, timers and smoothing cleared, progress kept, no event', function () {
  var flow = make(), log = recorder(flow);
  var t = landFirst(flow);
  flow.stop();
  var st = flow.state();
  assert.strictEqual(st.phase, 'idle');
  assert.strictEqual(st.cents, null);
  assert.strictEqual(st.holdProgress, 0);
  assert.strictEqual(st.landedAt, null);
  assert.strictEqual(st.progress[0], true);
  assert.deepStrictEqual(log, ['retarget:0', 'landed:0']);
  feedFor(flow, 0, 1000, t);
  assert.strictEqual(flow.state().phase, 'idle', 'feed is a no-op while idle');
});

run();
