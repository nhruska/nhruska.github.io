/* =====================================================================
 * songbook-firstrun.test.js  -  unit tests for S-FIRSTRUN (sprint-1 item 4,
 * finding F4): Songbook.firstrunShouldRender(Notables), the pure decision fn
 * behind the Library's fresh-profile guidance banner. Drives the REAL
 * notables.js module (not a stub) via test/helpers/local-storage-reset.js,
 * same pattern as notables.test.js - this is a consumer of that module's
 * public API only, never its internals.
 * Run: node test/songbook-firstrun.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var resetLocalStorage = require('./helpers/local-storage-reset.js');
var Songbook = require('../music/shared/songbook.js');
var Notables = require('../music/shared/notables.js');

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

/* ---------- fresh profile: claim attempted and granted ---------- */
test('fresh profile (never dismissed, empty slot) -> claim is attempted and granted', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true);
  // the grant is real, not a side-effect-free peek: firstrun now holds the slot
  assert.strictEqual(Notables.claim('firstrun'), true); // idempotent re-claim of its own slot
});

/* ---------- already dismissed -> no claim attempted, no render ---------- */
test('dismissed consumer -> isDismissed short-circuits, never calls claim(), no render', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.isDismissed('firstrun'), true);
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), false);
  // the short-circuit must not have granted the slot to 'firstrun' behind the
  // scenes - a DIFFERENT consumer can still claim the (still-empty) slot
  assert.strictEqual(Notables.claim('roman'), true);
});

/* ---------- claim denied (slot held by a stricter priority) -> no render ---------- */
test('claim-denied (slot already held by a higher-or-equal priority holder) -> no render', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  // an explicit priority BELOW firstrun's built-in 0 wins the slot first, so
  // firstrun's later claim() cannot preempt it (myP(0) is not < activeGrant.p(-1)).
  assert.strictEqual(Notables.claim('someone-else', -1), true);
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), false);
});

/* ---------- missing Notables module (script failed to load) -> safe no-op ---------- */
test('no Notables module available -> returns false, never throws', function () {
  assert.doesNotThrow(function () {
    assert.strictEqual(Songbook.firstrunShouldRender(null), false);
    assert.strictEqual(Songbook.firstrunShouldRender(undefined), false);
  });
});

/* ---------- once granted, a second call is idempotent (re-render safe) ---------- */
test('re-render after the slot is already granted to firstrun stays granted (idempotent)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true);
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true, 're-claiming its own held slot must stay granted');
});

run();
