/* =====================================================================
 * toast.test.js  -  unit tests for the shared toast.js primitive (S-TOAST,
 * UAT U9 fix).
 * ---------------------------------------------------------------------
 * The whole point of this module is per-host timer isolation, so the tests
 * below drive it with a deterministic fake clock (no real waits, matching
 * this suite's synchronous test() harness - see songbook.test.js's own
 * comment on why no async/fake-timer library is used elsewhere in this
 * repo) rather than monkey-patching global.setTimeout/clearTimeout inline
 * per test.
 *
 * Run: node test/toast.test.js
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

// Deterministic fake clock: replaces global.setTimeout/clearTimeout for the
// duration of `fn`, so tests can fire a scheduled callback on demand instead
// of actually waiting real milliseconds. Mirrors the existing repo pattern of
// monkey-patching a global for the length of one test (see songbook.test.js's
// global.localStorage.setItem stubs in the A1/H4 blocks).
function withFakeClock(fn) {
  var nextId = 1;
  var scheduled = {}; // id -> { cb, ms }
  var cleared = [];
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { cleared.push(id); delete scheduled[id]; };
  try {
    fn({
      fire: function (id) { var s = scheduled[id]; delete scheduled[id]; if (s) s.cb(); },
      pendingIds: function () { return Object.keys(scheduled); },
      wasCleared: function (id) { return cleared.indexOf(id) >= 0; }
    });
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
}

test('show() paints immediately via onShow, forwarding msg + error flag', function () {
  var calls = [];
  var host = { name: 'h1' };
  withFakeClock(function () {
    Toast.show('Added to setlist', {
      host: host, error: true,
      onShow: function (h, m, isErr) { calls.push([h, m, isErr]); }
    });
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], host);
  assert.strictEqual(calls[0][1], 'Added to setlist');
  assert.strictEqual(calls[0][2], true);
});

test('show() schedules exactly one auto-hide timer at the given duration (default 1600ms)', function () {
  var host = { name: 'h2' };
  withFakeClock(function (clock) {
    Toast.show('hi', { host: host, onShow: function () {}, onHide: function () {} });
    assert.strictEqual(clock.pendingIds().length, 1);
    Toast.show('hi again', { host: host, duration: 3000, onShow: function () {}, onHide: function () {} });
    // the SAME host re-showing must clear its OWN prior timer before
    // scheduling the new one, never leaving two pending for one host.
    assert.strictEqual(clock.pendingIds().length, 1);
  });
});

test('auto-hide fires onHide with the host after the scheduled duration elapses', function () {
  var host = { name: 'h3' };
  var hidden = null;
  withFakeClock(function (clock) {
    Toast.show('bye soon', { host: host, onShow: function () {}, onHide: function (h) { hidden = h; } });
    var id = Number(clock.pendingIds()[0]);
    assert.strictEqual(hidden, null, 'must not hide before the timer fires');
    clock.fire(id);
    assert.strictEqual(hidden, host);
  });
});

test('persist:true never schedules an auto-hide timer', function () {
  var host = { name: 'h4' };
  var hidden = false;
  withFakeClock(function (clock) {
    Toast.show('sticks around', { host: host, persist: true, onShow: function () {}, onHide: function () { hidden = true; } });
    assert.strictEqual(clock.pendingIds().length, 0, 'persist:true must not schedule a timer');
    assert.strictEqual(hidden, false);
  });
});

test('hide(host) cancels a pending timer and paints hidden immediately, even for a persist toast', function () {
  var host = { name: 'h5' };
  var hiddenCalls = 0;
  withFakeClock(function (clock) {
    Toast.show('a', { host: host, persist: true, onShow: function () {}, onHide: function () { hiddenCalls++; } });
    Toast.hide(host, { onHide: function () { hiddenCalls++; } });
    assert.strictEqual(hiddenCalls, 1, 'explicit hide() must paint hidden exactly once');
  });
});

/* =====================================================================
 * S-TOAST core regression: two INDEPENDENT hosts must never clobber each
 * other's timer, no matter how they interleave. This is the exact bug
 * shape from UAT U9 - see toast.js's header comment for the full trace.
 * Before this module existed, songbook.js's showToast (Library toast) and
 * showComposeToast (Compose toast) shared ONE `var toastTimer` in the same
 * mount() closure, so a persist:true showComposeToast() call fired
 * immediately after showToast() would clearTimeout() the Library toast's
 * pending 1600ms auto-hide and never reschedule one - leaving the Library
 * toast stuck on-screen forever.
 * ===================================================================== */
test('S-TOAST/U9: a persist:true show() on host B does NOT cancel host A\'s already-pending auto-hide timer', function () {
  var hostA = { name: 'library-toast' }, hostB = { name: 'compose-toast' };
  var hiddenA = false, hiddenB = false;
  withFakeClock(function (clock) {
    // Reproduces toggleSet()'s showToast('Added to setlist') - schedules
    // host A's 1600ms auto-hide.
    Toast.show('Added to setlist', {
      host: hostA, duration: 1600,
      onShow: function () {}, onHide: function () { hiddenA = true; }
    });
    var idA = Number(clock.pendingIds()[0]);
    assert.strictEqual(clock.pendingIds().length, 1, 'host A must have exactly one pending timer after its own show()');

    // Reproduces saveProgression's showComposeToast(..., persist: true) firing
    // in the SAME synchronous tick, on a totally different host.
    Toast.show('Saved to your Library', {
      host: hostB, persist: true,
      onShow: function () {}, onHide: function () { hiddenB = true; }
    });

    // The bug: host A's timer must survive host B's persist:true call.
    assert.strictEqual(clock.wasCleared(idA), false, 'host B must never clear host A\'s timer id');
    assert.ok(clock.pendingIds().indexOf(String(idA)) !== -1, 'host A\'s timer must still be pending after host B\'s call');

    // And when host A's own timer elapses, it must still fire (the actual
    // U9 symptom: it never did, because clearTimeout(sharedVar) had already
    // silently killed it).
    clock.fire(idA);
    assert.strictEqual(hiddenA, true, 'host A must still auto-hide on schedule');
    assert.strictEqual(hiddenB, false, 'host B (persist:true) must never auto-hide on its own');
  });
});

test('S-TOAST/U9 (reverse order): showing host B (non-persist) after host A does not touch host A\'s timer either', function () {
  var hostA = { name: 'library-toast' }, hostB = { name: 'compose-toast' };
  var hiddenA = false, hiddenB = false;
  withFakeClock(function (clock) {
    Toast.show('Added to setlist', { host: hostA, duration: 1600, onShow: function () {}, onHide: function () { hiddenA = true; } });
    var idA = Number(clock.pendingIds()[0]);
    Toast.show('Saved to your Library', { host: hostB, duration: 3000, onShow: function () {}, onHide: function () { hiddenB = true; } });
    assert.strictEqual(clock.pendingIds().length, 2, 'two independent hosts must each keep their own pending timer');
    assert.strictEqual(clock.wasCleared(idA), false);
    clock.fire(idA);
    assert.strictEqual(hiddenA, true);
    assert.strictEqual(hiddenB, false, 'host B must not have fired yet - it has its own, longer, independent timer');
  });
});

run();
