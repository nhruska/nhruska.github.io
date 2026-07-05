/* =====================================================================
 * accordion.test.js - M-SETTINGS-CLARITY: the EXCLUSIVE disclosure-group
 * primitive (music/shared/accordion.js).
 * ---------------------------------------------------------------------
 * Same element-LIKE stub approach as toast.test.js: the module owns the
 * one-open-at-a-time state machine and touches only body.hidden +
 * btn aria-expanded, so a plain-object section pair is a full-fidelity
 * host. First consumer: the play/index.html Settings sheet sections.
 * Run: node test/accordion.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var Accordion = require('../music/shared/accordion.js');

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

function stubSection() {
  return {
    btn: {
      attrs: {},
      onclick: null,
      setAttribute: function (k, v) { this.attrs[k] = v; }
    },
    body: { hidden: false }
  };
}
function make(n) {
  var sections = [];
  for (var i = 0; i < n; i++) sections.push(stubSection());
  return sections;
}
function openStates(sections) {
  return sections.map(function (s) { return !s.body.hidden; });
}

test('init() starts all-collapsed by default, with aria-expanded=false on every header', function () {
  var s = make(3);
  var h = Accordion.init(s);
  assert.deepStrictEqual(openStates(s), [false, false, false]);
  assert.strictEqual(h.openIndex(), -1);
  s.forEach(function (sec) { assert.strictEqual(sec.btn.attrs['aria-expanded'], 'false'); });
});

test('opts.openIndex opens exactly that section initially', function () {
  var s = make(3);
  var h = Accordion.init(s, { openIndex: 1 });
  assert.deepStrictEqual(openStates(s), [false, true, false]);
  assert.strictEqual(h.openIndex(), 1);
  assert.strictEqual(s[1].btn.attrs['aria-expanded'], 'true');
});

test('EXCLUSIVE: tapping a header opens it and collapses the previously open section', function () {
  var s = make(3);
  Accordion.init(s);
  s[0].btn.onclick();
  assert.deepStrictEqual(openStates(s), [true, false, false]);
  s[2].btn.onclick(); // opening 2 must close 0 in the same tap
  assert.deepStrictEqual(openStates(s), [false, false, true]);
  assert.strictEqual(s[0].btn.attrs['aria-expanded'], 'false');
  assert.strictEqual(s[2].btn.attrs['aria-expanded'], 'true');
});

test('tapping the OPEN section\'s header closes it - zero-open is a valid state', function () {
  var s = make(2);
  var h = Accordion.init(s);
  s[1].btn.onclick();
  assert.deepStrictEqual(openStates(s), [false, true]);
  s[1].btn.onclick();
  assert.deepStrictEqual(openStates(s), [false, false]);
  assert.strictEqual(h.openIndex(), -1);
});

test('handle.open(i) opens programmatically (the backup-nudge jump) and collapses the rest', function () {
  var s = make(3);
  var h = Accordion.init(s);
  s[0].btn.onclick();
  h.open(2);
  assert.deepStrictEqual(openStates(s), [false, false, true]);
  assert.strictEqual(h.openIndex(), 2);
});

test('handle.open() ignores an out-of-range or non-numeric index (defensive, never throws)', function () {
  var s = make(2);
  var h = Accordion.init(s, { openIndex: 0 });
  h.open(9); h.open(-3); h.open('songbook');
  assert.deepStrictEqual(openStates(s), [true, false], 'state must be unchanged after bad indexes');
  assert.strictEqual(h.openIndex(), 0);
});

test('handle.closeAll() collapses everything (the per-open, never-persisted reset at each sheet open)', function () {
  var s = make(3);
  var h = Accordion.init(s, { openIndex: 1 });
  h.closeAll();
  assert.deepStrictEqual(openStates(s), [false, false, false]);
  assert.strictEqual(h.openIndex(), -1);
});

test('a section with a missing btn or body is tolerated (defensive against a partial DOM)', function () {
  var ok = stubSection();
  var h = Accordion.init([{ btn: null, body: null }, ok]);
  ok.btn.onclick();
  assert.strictEqual(h.openIndex(), 1);
  assert.strictEqual(ok.body.hidden, false);
});

test('empty init() returns a working handle (no sections, openIndex stays -1)', function () {
  var h = Accordion.init([]);
  assert.strictEqual(h.openIndex(), -1);
  h.closeAll(); // must not throw
});

run();
