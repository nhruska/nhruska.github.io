/* =====================================================================
 * challenges.test.js  -  unit tests for the AI Tutor prototype's
 * scripted microlearning challenges (wave 2 'build' + wave 3 'identify').
 * Run: node test/challenges.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Circle = require('../music/shared/circle.js');
var MiniCompose = require('../music/tutor/mini-compose.js');
var Challenges = require('../music/tutor/challenges.js');

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

function applyAction(state, a) {
  if (a.type === 'clearProgression') return MiniCompose.clearProgression(state);
  if (a.type === 'addChord') return MiniCompose.addChord(state, a.chord);
  if (a.type === 'transpose') return MiniCompose.transpose(state, a.semitones);
  if (a.type === 'selectTrack') return MiniCompose.selectTrack(state, a.track);
  if (a.type === 'reinterpretKey') return MiniCompose.reinterpretKey(state, a.root, a.mode);
  return state; // 'highlight' and anything else is a visual no-op
}
function applyActions(state, actions) {
  actions.forEach(function (a) { state = applyAction(state, a); });
  return state;
}

test('exactly 6 challenges ship this wave: 2 build + 4 identify', function () {
  assert.strictEqual(Challenges.CHALLENGES.length, 6);
  var kinds = Challenges.CHALLENGES.map(function (c) { return c.kind; });
  assert.strictEqual(kinds.filter(function (k) { return k === 'build'; }).length, 2);
  assert.strictEqual(kinds.filter(function (k) { return k === 'identify'; }).length, 4);
});
test('byId resolves every challenge and returns null for an unknown id', function () {
  ['i-iv-v', 'ii-v-i', 'solo-over-it', 'transpose-and-solo', 'solo-over-track', 'relative-swap-solo'].forEach(function (id) {
    assert.ok(Challenges.byId(id), id);
  });
  assert.strictEqual(Challenges.byId('nope'), null);
});
test('challenges run in curriculum order: build first, then identify', function () {
  var ids = Challenges.CHALLENGES.map(function (c) { return c.id; });
  assert.deepStrictEqual(ids, ['i-iv-v', 'ii-v-i', 'solo-over-it', 'transpose-and-solo', 'solo-over-track', 'relative-swap-solo']);
});

/* ---------- 'build' challenges (wave 2, unchanged behavior) ---------- */
['i-iv-v', 'ii-v-i'].forEach(function (id) {
  test(id + ': demoActions() replayed through the reducers pass its own check()', function () {
    var s = MiniCompose.initialState('G', 'major');
    var ch = Challenges.byId(id);
    var afterDemo = applyActions(s, ch.demoActions(s));
    var result = ch.check(afterDemo);
    assert.strictEqual(result.pass, true, result.message);
  });
  test(id + ': setup() clears the progression for the "your turn" phase', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
    var afterSetup = Challenges.byId(id).setup(s);
    assert.deepStrictEqual(afterSetup.progression, []);
  });
});

test('checkRomanShape fails with a length-mismatch message when too few chords', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G']);
  var r = Challenges.checkRomanShape(s, ['I', 'IV', 'V']);
  assert.strictEqual(r.pass, false);
  assert.ok(/1 chord/.test(r.message));
});
test('checkRomanShape is order-sensitive (I-V-IV != I-IV-V)', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'D', 'C']);
  assert.strictEqual(Challenges.checkRomanShape(s, ['I', 'IV', 'V']).pass, false);
});

/* ---------- 'identify' challenges (wave 3) ---------- */
var identifyIds = ['solo-over-it', 'transpose-and-solo', 'solo-over-track', 'relative-swap-solo'];

identifyIds.forEach(function (id) {
  test(id + ': demoActions() + correct option id passes check()', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
    var ch = Challenges.byId(id);
    var afterDemo = applyActions(s, ch.demoActions(s));
    var correct = ch.correct(afterDemo);
    var result = ch.check(afterDemo, Challenges.scaleOptionId(correct.root, correct.mode));
    assert.strictEqual(result.pass, true, result.message);
  });
  test(id + ': a wrong option id fails check() with a specific message', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
    var ch = Challenges.byId(id);
    var afterDemo = applyActions(s, ch.demoActions(s));
    var correct = ch.correct(afterDemo);
    var correctId = Challenges.scaleOptionId(correct.root, correct.mode);
    var wrong = ch.options(afterDemo).filter(function (o) { return o.id !== correctId; })[0];
    var result = ch.check(afterDemo, wrong.id);
    assert.strictEqual(result.pass, false);
    assert.ok(result.message.length > 0);
  });
  test(id + ': options() returns exactly 3 distinct choices including the correct one', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
    var ch = Challenges.byId(id);
    var afterDemo = applyActions(s, ch.demoActions(s));
    var opts = ch.options(afterDemo);
    assert.strictEqual(opts.length, 3);
    var ids = opts.map(function (o) { return o.id; });
    assert.strictEqual(new Set(ids).size, 3, 'options must be distinct: ' + ids.join(','));
    var correct = ch.correct(afterDemo);
    assert.ok(ids.indexOf(Challenges.scaleOptionId(correct.root, correct.mode)) !== -1);
  });
  test(id + ': intro() is a non-empty string mentioning theory in play', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('D', 'major'), ['D', 'G', 'A']);
    var ch = Challenges.byId(id);
    assert.ok(typeof ch.intro(s) === 'string' && ch.intro(s).length > 10);
  });
});

test('transpose-and-solo actually shifts the key/progression via demoActions', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('C', 'major'), ['C', 'F', 'G']);
  var ch = Challenges.byId('transpose-and-solo');
  var after = applyActions(s, ch.demoActions(s));
  assert.strictEqual(after.key, 'D');
  assert.deepStrictEqual(after.progression, ['D', 'G', 'A']);
});
test('solo-over-track sets a mock (non-empty, non-real-network) track label', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('C', 'major'), ['C', 'F', 'G']);
  var ch = Challenges.byId('solo-over-track');
  var after = applyActions(s, ch.demoActions(s));
  assert.ok(/mock/i.test(after.track));
});
test('relative-swap-solo reinterprets the key WITHOUT clearing the progression', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
  var ch = Challenges.byId('relative-swap-solo');
  var after = applyActions(s, ch.demoActions(s));
  assert.strictEqual(after.key, Circle.relativeMinor('G'));
  assert.strictEqual(after.mode, 'minor');
  assert.deepStrictEqual(after.progression, ['G', 'C', 'D']); // unchanged - the whole point of the demo
});
test('relative-swap-solo\'s correct answer is the relative minor, and the pre-swap major key is a distractor', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
  var ch = Challenges.byId('relative-swap-solo');
  var after = applyActions(s, ch.demoActions(s));
  var correct = ch.correct(after);
  assert.strictEqual(correct.root, 'E');
  assert.strictEqual(correct.mode, 'minor');
  var optIds = ch.options(after).map(function (o) { return o.id; });
  assert.ok(optIds.indexOf(Challenges.scaleOptionId('G', 'major')) !== -1, 'the original major key should appear as a distractor');
});

/* ---------- shared reflection step ---------- */
test('REFLECTION_OPTIONS has an entry and a canned response for each id', function () {
  assert.ok(Challenges.REFLECTION_OPTIONS.length >= 3);
  Challenges.REFLECTION_OPTIONS.forEach(function (o) {
    assert.ok(Challenges.REFLECTION_RESPONSES[o.id], 'missing response for ' + o.id);
  });
});
test('REFLECTION_PROMPT is a non-empty string', function () {
  assert.ok(typeof Challenges.REFLECTION_PROMPT === 'string' && Challenges.REFLECTION_PROMPT.length > 0);
});

run();
