/* =====================================================================
 * scroll-hint.test.js  -  unit tests for the horizontal-scroll affordance
 * reducer (music/shared/scroll-hint.js `sides()`). The DOM wiring is
 * verified live (headless Playwright); this pins the pure edge logic that
 * decides which chevrons show.
 * Run: node test/scroll-hint.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var ScrollHint = require('../music/shared/scroll-hint.js');

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

var sides = ScrollHint.sides;

// No overflow: content fits the viewport -> neither edge scrollable, no chevron.
test('no overflow (scrollWidth == clientWidth) -> neither edge', function () {
  var s = sides(0, 300, 300);
  assert.strictEqual(s.l, false);
  assert.strictEqual(s.r, false);
});

// Overflow, parked at the start -> only the RIGHT chevron (more that way).
test('overflow at start -> right only', function () {
  var s = sides(0, 1000, 350);
  assert.strictEqual(s.l, false);
  assert.strictEqual(s.r, true);
});

// Overflow, scrolled to the very end -> only the LEFT chevron.
test('overflow at end -> left only', function () {
  var max = 1000 - 350; // 650
  var s = sides(max, 1000, 350);
  assert.strictEqual(s.l, true);
  assert.strictEqual(s.r, false);
});

// Overflow, mid-scroll -> BOTH chevrons (scrollable either way).
test('overflow mid-scroll -> both edges', function () {
  var s = sides(200, 1000, 350);
  assert.strictEqual(s.l, true);
  assert.strictEqual(s.r, true);
});

// Sub-pixel slack: 2px shy of each extreme still counts as that extreme,
// so a rounding remainder never leaves a chevron stuck on at the last pixel.
test('within TOL of the start -> treated as start (no left chevron)', function () {
  var s = sides(2, 1000, 350);
  assert.strictEqual(s.l, false);
  assert.strictEqual(s.r, true);
});
test('within TOL of the end -> treated as end (no right chevron)', function () {
  var max = 1000 - 350;
  var s = sides(max - 2, 1000, 350);
  assert.strictEqual(s.l, true);
  assert.strictEqual(s.r, false);
});

// A 1px overflow is below the tolerance floor -> no affordance (not worth a
// chevron for a pixel the user can't meaningfully scroll to).
test('overflow at or below TOL -> neither edge', function () {
  var s = sides(0, 351, 350);
  assert.strictEqual(s.l, false);
  assert.strictEqual(s.r, false);
});

run();
