/* =====================================================================
 * queue.test.js  -  unit tests for the shared running-order queue.
 * Run: node test/queue.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var createQueue = require('../music/shared/queue.js').createQueue;

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; /* eslint-disable no-console */ console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- empty ---------- */
test('empty queue: no current, index -1, not active', function () {
  var q = createQueue();
  assert.strictEqual(q.size(), 0);
  assert.strictEqual(q.index(), -1);
  assert.strictEqual(q.current(), null);
  assert.strictEqual(q.isActive(), false);
  assert.strictEqual(q.atStart(), true);
  assert.strictEqual(q.atEnd(), true);
});
test('empty queue: next/prev are no-ops returning null', function () {
  var q = createQueue();
  assert.strictEqual(q.next(), null);
  assert.strictEqual(q.prev(), null);
  assert.strictEqual(q.index(), -1);
});

/* ---------- single ---------- */
test('single song: index 0, at both ends, not active', function () {
  var q = createQueue(); q.set(['a']);
  assert.strictEqual(q.size(), 1);
  assert.strictEqual(q.index(), 0);
  assert.strictEqual(q.current(), 'a');
  assert.strictEqual(q.isActive(), false);
  assert.strictEqual(q.atStart(), true);
  assert.strictEqual(q.atEnd(), true);
});
test('single song: next/prev stay put', function () {
  var q = createQueue(); q.set(['a']);
  assert.strictEqual(q.next(), 'a');
  assert.strictEqual(q.prev(), 'a');
  assert.strictEqual(q.index(), 0);
});

/* ---------- multi: navigation + clamping (no wrap) ---------- */
test('multi: starts at given index, clamps out-of-range start', function () {
  var q = createQueue(); q.set(['a', 'b', 'c'], 5);
  assert.strictEqual(q.index(), 2);
  assert.strictEqual(q.current(), 'c');
  var q2 = createQueue(); q2.set(['a', 'b', 'c'], -3);
  assert.strictEqual(q2.index(), 0);
});
test('multi: active when size > 1', function () {
  var q = createQueue(); q.set(['a', 'b']);
  assert.strictEqual(q.isActive(), true);
});
test('multi: next advances and clamps at the end (no wrap)', function () {
  var q = createQueue(); q.set(['a', 'b', 'c']);
  assert.strictEqual(q.next(), 'b');
  assert.strictEqual(q.next(), 'c');
  assert.strictEqual(q.atEnd(), true);
  assert.strictEqual(q.next(), 'c'); // clamp, not wrap
  assert.strictEqual(q.index(), 2);
});
test('multi: prev retreats and clamps at the start (no wrap)', function () {
  var q = createQueue(); q.set(['a', 'b', 'c'], 2);
  assert.strictEqual(q.prev(), 'b');
  assert.strictEqual(q.prev(), 'a');
  assert.strictEqual(q.atStart(), true);
  assert.strictEqual(q.prev(), 'a'); // clamp
  assert.strictEqual(q.index(), 0);
});
test('multi: goto clamps to range and returns current', function () {
  var q = createQueue(); q.set(['a', 'b', 'c']);
  assert.strictEqual(q.goto(1), 'b');
  assert.strictEqual(q.goto(99), 'c');
  assert.strictEqual(q.goto(-5), 'a');
});

/* ---------- membership ---------- */
test('has() reflects membership', function () {
  var q = createQueue(); q.set(['a', 'b']);
  assert.strictEqual(q.has('a'), true);
  assert.strictEqual(q.has('z'), false);
});

/* ---------- remove keeps the cursor sensible ---------- */
test('remove before cursor shifts index so current stays the same song', function () {
  var q = createQueue(); q.set(['a', 'b', 'c'], 2); // on 'c'
  assert.strictEqual(q.remove('a'), true);
  assert.strictEqual(q.current(), 'c'); // still on c
  assert.strictEqual(q.index(), 1);
});
test('remove current keeps index (now the following song), clamps at end', function () {
  var q = createQueue(); q.set(['a', 'b', 'c'], 1); // on 'b'
  q.remove('b');
  assert.strictEqual(q.current(), 'c'); // index 1 now points at c
  assert.strictEqual(q.index(), 1);
  var q2 = createQueue(); q2.set(['a', 'b', 'c'], 2); // on last 'c'
  q2.remove('c');
  assert.strictEqual(q2.current(), 'b'); // clamps back
  assert.strictEqual(q2.index(), 1);
});
test('remove last remaining empties the queue', function () {
  var q = createQueue(); q.set(['a']);
  q.remove('a');
  assert.strictEqual(q.size(), 0);
  assert.strictEqual(q.current(), null);
  assert.strictEqual(q.index(), -1);
});
test('remove of a missing id is a no-op returning false', function () {
  var q = createQueue(); q.set(['a', 'b']);
  assert.strictEqual(q.remove('z'), false);
  assert.strictEqual(q.size(), 2);
});

/* ---------- ids() returns a copy, not the internal array ---------- */
test('ids() returns a defensive copy', function () {
  var q = createQueue(); q.set(['a', 'b']);
  var got = q.ids(); got.push('x');
  assert.strictEqual(q.size(), 2);
});

run();
