/* =====================================================================
 * challenges.test.js  -  unit tests for the AI Tutor prototype's
 * scripted microlearning challenges (wave 2).
 * Run: node test/challenges.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
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

function applyActions(state, actions) {
  actions.forEach(function (a) {
    if (a.type === 'clearProgression') state = MiniCompose.clearProgression(state);
    else if (a.type === 'addChord') state = MiniCompose.addChord(state, a.chord);
  });
  return state;
}

test('exactly 2 challenges ship this wave (depth over breadth)', function () {
  assert.strictEqual(Challenges.CHALLENGES.length, 2);
});
test('byId resolves both challenges and returns null for an unknown id', function () {
  assert.ok(Challenges.byId('i-iv-v'));
  assert.ok(Challenges.byId('ii-v-i'));
  assert.strictEqual(Challenges.byId('nope'), null);
});

['i-iv-v', 'ii-v-i'].forEach(function (id) {
  test(id + ': demoActions() replayed through the reducers pass its own check()', function () {
    var s = MiniCompose.initialState('G', 'major');
    var ch = Challenges.byId(id);
    var afterDemo = applyActions(s, ch.demoActions(s));
    var result = ch.check(afterDemo);
    assert.strictEqual(result.pass, true, result.message);
  });
  test(id + ': intro() and prompt are non-empty strings mentioning the key', function () {
    var s = MiniCompose.initialState('D', 'major');
    var ch = Challenges.byId(id);
    assert.ok(ch.intro(s).indexOf('D') !== -1);
    assert.ok(typeof ch.prompt === 'string' && ch.prompt.length > 0);
  });
  test(id + ': setup() clears the progression for the "your turn" phase', function () {
    var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
    var ch = Challenges.byId(id);
    var afterSetup = ch.setup(s);
    assert.deepStrictEqual(afterSetup.progression, []);
  });
});

test('checkRomanShape fails with a length-mismatch message when too few chords', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G']);
  var r = Challenges.checkRomanShape(s, ['I', 'IV', 'V']);
  assert.strictEqual(r.pass, false);
  assert.ok(/1 chord/.test(r.message));
});
test('checkRomanShape fails with a shape-mismatch message on wrong chords, right count', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'Am', 'D']);
  var r = Challenges.checkRomanShape(s, ['I', 'IV', 'V']);
  assert.strictEqual(r.pass, false);
  assert.ok(/I-ii-V/.test(r.message));
});
test('checkRomanShape passes and names the key/mode on an exact match', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
  var r = Challenges.checkRomanShape(s, ['I', 'IV', 'V']);
  assert.strictEqual(r.pass, true);
  assert.ok(/G major/.test(r.message));
});
test('checkRomanShape is order-sensitive (I-V-IV != I-IV-V)', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'D', 'C']);
  var r = Challenges.checkRomanShape(s, ['I', 'IV', 'V']);
  assert.strictEqual(r.pass, false);
});

test('a wrong-key attempt at ii-V-I in a different key still checks against the roman shape, not literal chord names', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('D', 'major'), ['Em', 'A', 'D']);
  var ch = Challenges.byId('ii-v-i');
  assert.strictEqual(ch.check(s).pass, true);
});

run();
