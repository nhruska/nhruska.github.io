/* =====================================================================
 * songbook-firstrun.test.js  -  unit tests for S-FIRSTRUN (sprint-1 item 4,
 * finding F4): Songbook.firstrunShouldRender(Notables), the pure decision fn
 * behind the Library's fresh-profile guidance banner, PLUS M-GUIDANCE's
 * Songbook.savebasicsShouldRender(Notables) (the beginner-tier "save/set
 * basics" cue) PLUS S-CHORDCHIP-A11Y's Songbook.chordtapShouldRender(Notables)
 * (the level-UNRESTRICTED "tap a chord to hear it" cue, PR #300). Drives the REAL notables.js module (not a stub) via
 * test/helpers/local-storage-reset.js, same pattern as notables.test.js -
 * this is a consumer of that module's public API only, never its internals.
 *
 * M-GUIDANCE retro-tagged 'firstrun' as beginner-only in notables.js's
 * LEVELS table (docs/plans/guidance-levels-spec-20260705.md) - every case
 * below that expects a GRANT now seeds music.guidanceLevel.v1 = 'beginner'
 * first (via the real guidance-level.js module, same localStorage fake).
 * Run: node test/songbook-firstrun.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var lsReset = require('./helpers/local-storage-reset.js');
// compat shim over the shared helper's {clear, fakeStore} API (same as notables.test.js)
function resetLocalStorage(seed) {
  global.localStorage = lsReset.fakeStore();
  if (seed) Object.keys(seed).forEach(function (k) { global.localStorage.setItem(k, seed[k]); });
}
var Songbook = require('../music/shared/songbook.js');
var Notables = require('../music/shared/notables.js');
var GuidanceLevel = require('../music/shared/guidance-level.js');

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

/* ---------- fresh profile: claim attempted and granted (level already 'beginner') ---------- */
test('fresh profile, level already beginner (never dismissed, empty slot) -> claim is attempted and granted', function () {
  resetLocalStorage();
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true);
  // the grant is real, not a side-effect-free peek: firstrun now holds the slot
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true); // idempotent re-claim of its own slot
});

/* ---------- M-GUIDANCE: unset level blocks firstrun even though everything
 * else about the profile is fresh - "unset level: only the ask may show" ---------- */
test('fresh profile but UNSET guidance level -> firstrun is blocked (the ask has not been answered yet)', function () {
  resetLocalStorage(); // music.guidanceLevel.v1 never set
  Notables._resetArbitration();
  assert.strictEqual(GuidanceLevel.get(), null);
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), false);
});
test('a non-matching level (intermediate/advanced) also blocks firstrun (beginner-only)', function () {
  ['intermediate', 'advanced'].forEach(function (lvl) {
    resetLocalStorage();
    GuidanceLevel.set(lvl);
    Notables._resetArbitration();
    assert.strictEqual(Songbook.firstrunShouldRender(Notables), false, lvl + ' must not grant firstrun');
  });
});

/* ---------- already dismissed -> no claim attempted, no render ---------- */
test('dismissed consumer -> isDismissed short-circuits, never calls claim(), no render', function () {
  resetLocalStorage();
  GuidanceLevel.set('beginner');
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
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  // an explicit priority BELOW firstrun's built-in index wins the slot first, so
  // firstrun's later claim() cannot preempt it (myP is not < activeGrant.p(-1)).
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
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true);
  assert.strictEqual(Songbook.firstrunShouldRender(Notables), true, 're-claiming its own held slot must stay granted');
});

/* ---------------------------------------------------------------------
 * M-GUIDANCE: Songbook.savebasicsShouldRender(Notables) - same pure-decision
 * shape as firstrunShouldRender above, beginner-tier, consumerId 'savebasics'.
 * ------------------------------------------------------------------- */
test('savebasicsShouldRender: granted for level beginner on a fresh, empty slot', function () {
  resetLocalStorage();
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(Songbook.savebasicsShouldRender(Notables), true);
});
test('savebasicsShouldRender: blocked when the level is unset or non-beginner', function () {
  [null, 'intermediate', 'advanced'].forEach(function (lvl) {
    resetLocalStorage();
    if (lvl) GuidanceLevel.set(lvl);
    Notables._resetArbitration();
    assert.strictEqual(Songbook.savebasicsShouldRender(Notables), false, String(lvl) + ' must not grant savebasics');
  });
});
test('savebasicsShouldRender: dismissed consumer never re-claims', function () {
  resetLocalStorage();
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(Songbook.savebasicsShouldRender(Notables), true);
  Notables.dismiss('savebasics');
  assert.strictEqual(Songbook.savebasicsShouldRender(Notables), false);
});
test('savebasicsShouldRender: no Notables module -> false, never throws', function () {
  assert.doesNotThrow(function () {
    assert.strictEqual(Songbook.savebasicsShouldRender(null), false);
    assert.strictEqual(Songbook.savebasicsShouldRender(undefined), false);
  });
});

/* ---------------------------------------------------------------------
 * S-CHORDCHIP-A11Y (P3 UAT, PR #300): Songbook.chordtapShouldRender(Notables)
 * - the "tap a chord to hear it" one-shot cue that replaced the persistent
 * .chordHint row. UNLIKE firstrun/savebasics, this is deliberately NOT in
 * notables.js's LEVELS table, so - the whole point of the design - it must
 * grant on an UNSET level too, not just 'beginner'.
 * ------------------------------------------------------------------- */
test('chordtapShouldRender: granted on a fresh, empty slot regardless of guidance level (unset/beginner/intermediate/advanced)', function () {
  [null, 'beginner', 'intermediate', 'advanced'].forEach(function (lvl) {
    resetLocalStorage();
    if (lvl) GuidanceLevel.set(lvl);
    Notables._resetArbitration();
    assert.strictEqual(Songbook.chordtapShouldRender(Notables), true, String(lvl) + ' must grant chordtap (unrestricted)');
  });
});
test('chordtapShouldRender: dismissed consumer never re-claims', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Songbook.chordtapShouldRender(Notables), true);
  Notables.dismiss('chordtap');
  assert.strictEqual(Songbook.chordtapShouldRender(Notables), false);
});
test('chordtapShouldRender: loses to a higher-priority live holder (firstrun, beginner) already on the slot', function () {
  resetLocalStorage();
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true); // firstrun claims first, outranks chordtap
  assert.strictEqual(Songbook.chordtapShouldRender(Notables), false);
});
test('chordtapShouldRender: no Notables module -> false, never throws', function () {
  assert.doesNotThrow(function () {
    assert.strictEqual(Songbook.chordtapShouldRender(null), false);
    assert.strictEqual(Songbook.chordtapShouldRender(undefined), false);
  });
});

run();
