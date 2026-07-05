/* =====================================================================
 * toast-action.test.js  -  unit tests for Toast.showAction() / .wirePauseOnTouch()
 * (M-DESIGN-ENFORCE wave 2, UAT U19 TOAST+ACTION primitive).
 * ---------------------------------------------------------------------
 * Mirrors toast.test.js's deterministic fake-clock harness for the timer
 * side (setTimeout/clearTimeout monkey-patched for the duration of a test),
 * plus an injectable `now` clock (opts.now) so the pause()/resume()
 * elapsed-time math is exercised without depending on real wall-clock time
 * or monkey-patching the global Date.
 *
 * Run: node test/toast-action.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
if (typeof global.window === 'undefined') global.window = global;
var Toast = require('../music/shared/toast.js');

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

// Same withFakeClock helper as toast.test.js (kept file-local rather than
// extracted to a shared test helper - both files are small and independent).
function withFakeClock(fn) {
  var nextId = 1;
  var scheduled = {};
  var cleared = [];
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { cleared.push(id); delete scheduled[id]; };
  try {
    fn({
      fire: function (id) { var s = scheduled[id]; delete scheduled[id]; if (s) s.cb(); },
      pendingIds: function () { return Object.keys(scheduled); },
      wasCleared: function (id) { return cleared.indexOf(id) >= 0; },
      msFor: function (id) { return scheduled[id] ? scheduled[id].ms : null; }
    });
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
}

// ~15-line fake DOM element: enough surface for showAction()'s bar (style/
// classList/offsetWidth) and wirePauseOnTouch()'s addEventListener contract.
function makeEl() {
  var listeners = {};
  return {
    className: '', attrs: {}, style: {}, offsetWidth: 0,
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: function (type, fn) {
      var arr = listeners[type] || []; var i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
    },
    _fire: function (type) { (listeners[type] || []).slice().forEach(function (fn) { fn(); }); }
  };
}

test('showAction() returns null when opts.host is missing (always needs its own DOM/state home)', function () {
  var r = Toast.showAction('x', {});
  assert.strictEqual(r, null);
});

test('showAction() paints immediately via onShow, forwarding msg + a bar element when document exists', function () {
  global.document = { createElement: function () { return makeEl(); } };
  var host = { name: 'undo-a' };
  var calls = [];
  withFakeClock(function () {
    Toast.showAction('Removed Song', { host: host, onShow: function (h, m, bar) { calls.push([h, m, bar]); } });
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], host);
  assert.strictEqual(calls[0][1], 'Removed Song');
  assert.ok(calls[0][2] && calls[0][2].className.indexOf('toastBar') === 0, 'expected a .toastBar element, got: ' + (calls[0][2] && calls[0][2].className));
  delete global.document;
});

test('showAction() schedules exactly one timer at DEFAULT_ACTION_DURATION_MS (6000ms) when opts.duration is omitted', function () {
  var host = { name: 'undo-b' };
  withFakeClock(function (clock) {
    Toast.showAction('msg', { host: host, onShow: function () {}, onHide: function () {} });
    assert.strictEqual(clock.pendingIds().length, 1);
    assert.strictEqual(clock.msFor(clock.pendingIds()[0]), 6000);
  });
});

test('expiry fires onHide with the host after the scheduled duration elapses', function () {
  var host = { name: 'undo-c' };
  var hidden = null;
  withFakeClock(function (clock) {
    Toast.showAction('msg', { host: host, duration: 6000, onShow: function () {}, onHide: function (h) { hidden = h; } });
    var id = Number(clock.pendingIds()[0]);
    assert.strictEqual(hidden, null, 'must not hide before the timer fires');
    clock.fire(id);
    assert.strictEqual(hidden, host);
  });
});

test('finish() (the action-tap path) cancels the pending timer and fires onHide exactly once, never twice', function () {
  var host = { name: 'undo-d' };
  var hideCount = 0;
  withFakeClock(function (clock) {
    var handle = Toast.showAction('msg', { host: host, onShow: function () {}, onHide: function () { hideCount++; } });
    var id = Number(clock.pendingIds()[0]);
    handle.finish();
    assert.strictEqual(hideCount, 1);
    assert.ok(clock.wasCleared(id), 'finish() must cancel the pending expiry timer');
    // a stale fire (as if the real timer somehow still ran) must be a no-op -
    // resolved guard, never a second onHide.
    handle.finish();
    assert.strictEqual(hideCount, 1, 'finish() must be idempotent');
  });
});

test('S-TOAST/U9-style isolation: two independent action toasts on different hosts never cross-talk', function () {
  var hostA = { name: 'undo-e' }, hostB = { name: 'undo-f' };
  var hiddenA = false, hiddenB = false;
  withFakeClock(function (clock) {
    var a = Toast.showAction('a', { host: hostA, duration: 3000, onShow: function () {}, onHide: function () { hiddenA = true; } });
    Toast.showAction('b', { host: hostB, duration: 6000, onShow: function () {}, onHide: function () { hiddenB = true; } });
    assert.strictEqual(clock.pendingIds().length, 2, 'both hosts keep independent pending timers');
    a.finish();
    assert.strictEqual(hiddenA, true);
    assert.strictEqual(hiddenB, false, 'finishing host A must never touch host B');
  });
});

/* ---------------------------------------------------------------------
 * pause()/resume() elapsed-time math - the design-refinement contract
 * ("any touchstart/pointerdown on the toast freezes the countdown...
 * releasing outside resumes"). Driven by an injectable `now` clock so the
 * math is deterministic without real wall-clock waits.
 * ------------------------------------------------------------------- */
test('pause()/resume(): resuming re-arms the timer for exactly the remaining ms, not the full duration', function () {
  var host = { name: 'undo-pause-2' };
  var t = 0; function now() { return t; }
  withFakeClock(function (clock) {
    var handle = Toast.showAction('msg', { host: host, duration: 6000, now: now, onShow: function () {}, onHide: function () {} });
    var firstId = Number(clock.pendingIds()[0]);
    t = 2000; // 2s of the 6s window elapsed
    handle.pause();
    assert.ok(clock.wasCleared(firstId), 'pause() must cancel the in-flight timer');
    assert.strictEqual(clock.pendingIds().length, 0, 'no timer should be pending while paused');
    t = 2500; // half a second passes WHILE paused - must not count against the remaining window
    handle.resume();
    assert.strictEqual(clock.pendingIds().length, 1, 'resume() re-arms exactly one timer');
    var secondId = Number(clock.pendingIds()[0]);
    assert.strictEqual(clock.msFor(secondId), 4000, 'remaining window must be 6000 - 2000 = 4000ms, unaffected by pause duration');
  });
});

test('pause() is a no-op once already paused or resolved; resume() is a no-op unless currently paused', function () {
  var host = { name: 'undo-pause-3' };
  var t = 0; function now() { return t; }
  var hideCount = 0;
  withFakeClock(function (clock) {
    var handle = Toast.showAction('msg', { host: host, duration: 6000, now: now, onShow: function () {}, onHide: function () { hideCount++; } });
    handle.resume(); // not paused yet - must be a no-op, never double-arm
    assert.strictEqual(clock.pendingIds().length, 1);
    t = 1000; handle.pause();
    t = 1200; handle.pause(); // already paused - must not re-subtract elapsed time again
    handle.resume();
    var id = Number(clock.pendingIds()[0]);
    assert.strictEqual(clock.msFor(id), 5000, 'a redundant pause() call must not shave extra time off the remaining window');
    handle.finish();
    handle.pause(); // resolved - must be a safe no-op, not throw
    assert.strictEqual(hideCount, 1);
  });
});

test('reducedMotion:true (or matched prefers-reduced-motion) marks the bar static and never writes an inline transition/width', function () {
  global.document = { createElement: function () { return makeEl(); } };
  var host = { name: 'undo-reduced' };
  var barSeen = null;
  withFakeClock(function () {
    Toast.showAction('msg', {
      host: host, reducedMotion: true,
      onShow: function (h, m, bar) { barSeen = bar; }
    });
  });
  assert.ok(barSeen, 'expected a bar element even in reduced-motion mode (still the undoable signature, just static)');
  assert.ok(barSeen.className.indexOf('toastBar-static') >= 0, 'reduced-motion bar must carry toastBar-static, got: ' + barSeen.className);
  assert.strictEqual(barSeen.style.transition, undefined, 'reduced-motion bar must never get an inline transition written by JS');
  assert.strictEqual(barSeen.style.width, undefined, 'reduced-motion bar must never get an inline width written by JS - the CSS class supplies the static 100%');
  delete global.document;
});

/* ---------------------------------------------------------------------
 * wirePauseOnTouch() - the opt-in DOM convenience wiring
 * ------------------------------------------------------------------- */
test('wirePauseOnTouch(): touchstart on the element pauses; touchend on the document resumes', function () {
  var el = makeEl();
  var doc = makeEl(); // stands in for `document` here - only addEventListener/removeEventListener/_fire needed
  global.document = doc;
  var pauseCalls = 0, resumeCalls = 0;
  var handle = {
    pause: function () { pauseCalls++; }, resume: function () { resumeCalls++; }
  };
  var teardown = Toast.wirePauseOnTouch(el, handle);
  el._fire('touchstart');
  assert.strictEqual(pauseCalls, 1);
  // per the design refinement, release can land OUTSIDE the toast element -
  // must resume via a document-level listener, not require the touchend to
  // land back on `el` itself.
  doc._fire('touchend');
  assert.strictEqual(resumeCalls, 1);
  teardown();
  el._fire('touchstart');
  doc._fire('touchend');
  assert.strictEqual(pauseCalls, 1, 'teardown() must remove the element-level listener');
  assert.strictEqual(resumeCalls, 1, 'teardown() must remove the document-level listener');
  delete global.document;
});

test('wirePauseOnTouch() is a safe no-op (returns a callable teardown) when el or handle is missing', function () {
  var teardown = Toast.wirePauseOnTouch(null, { pause: function () {}, resume: function () {} });
  assert.strictEqual(typeof teardown, 'function');
  teardown(); // must not throw
});

run();
