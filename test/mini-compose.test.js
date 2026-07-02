/* =====================================================================
 * mini-compose.test.js  -  unit tests for the AI Tutor prototype's
 * tutor-owned practice-widget state + reducers.
 * Run: node test/mini-compose.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MiniCompose = require('../music/tutor/mini-compose.js');

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

test('initialState defaults to C major, empty progression, first mock track', function () {
  var s = MiniCompose.initialState();
  assert.strictEqual(s.key, 'C');
  assert.strictEqual(s.mode, 'major');
  assert.deepStrictEqual(s.progression, []);
  assert.strictEqual(s.track, MiniCompose.MOCK_TRACKS[0]);
});
test('initialState honors given key/mode', function () {
  var s = MiniCompose.initialState('G', 'minor');
  assert.strictEqual(s.key, 'G');
  assert.strictEqual(s.mode, 'minor');
});

test('setKey changes key/mode and clears the progression (fresh start)', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('C', 'major'), ['C', 'F', 'G']);
  var s2 = MiniCompose.setKey(s, 'D', 'minor');
  assert.strictEqual(s2.key, 'D');
  assert.strictEqual(s2.mode, 'minor');
  assert.deepStrictEqual(s2.progression, []);
});
test('setKey does not mutate the original state', function () {
  var s = MiniCompose.initialState('C', 'major');
  MiniCompose.setKey(s, 'D', 'minor');
  assert.strictEqual(s.key, 'C');
});

test('buildProgression replaces the progression wholesale', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
  assert.deepStrictEqual(s.progression, ['G', 'C', 'D']);
});
test('addChord appends without mutating original', function () {
  var s1 = MiniCompose.initialState('C', 'major');
  var s2 = MiniCompose.addChord(s1, 'C');
  var s3 = MiniCompose.addChord(s2, 'F');
  assert.deepStrictEqual(s1.progression, []);
  assert.deepStrictEqual(s2.progression, ['C']);
  assert.deepStrictEqual(s3.progression, ['C', 'F']);
});
test('addChord with a falsy chord is a no-op', function () {
  var s = MiniCompose.addChord(MiniCompose.initialState(), '');
  assert.deepStrictEqual(s.progression, []);
});
test('removeLast drops the last chord only', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState(), ['C', 'F', 'G']);
  s = MiniCompose.removeLast(s);
  assert.deepStrictEqual(s.progression, ['C', 'F']);
});
test('removeLast on empty progression stays empty (no throw)', function () {
  var s = MiniCompose.removeLast(MiniCompose.initialState());
  assert.deepStrictEqual(s.progression, []);
});
test('clearProgression empties it', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState(), ['C', 'F']);
  s = MiniCompose.clearProgression(s);
  assert.deepStrictEqual(s.progression, []);
});

test('transpose shifts both the key root and every chord in the progression', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('C', 'major'), ['C', 'F', 'G']);
  var t = MiniCompose.transpose(s, 2);
  assert.strictEqual(t.key, 'D');
  assert.deepStrictEqual(t.progression, ['D', 'G', 'A']);
});
test('transpose by 0 is an identity on chord names', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('C', 'major'), ['C', 'Am', 'F', 'G']);
  var t = MiniCompose.transpose(s, 0);
  assert.deepStrictEqual(t.progression, s.progression);
});

test('selectTrack changes the mock track label', function () {
  var s = MiniCompose.selectTrack(MiniCompose.initialState(), 'Uptempo groove');
  assert.strictEqual(s.track, 'Uptempo groove');
});
test('selectTrack with no track keeps the current one', function () {
  var s = MiniCompose.selectTrack(MiniCompose.initialState(), null);
  assert.strictEqual(s.track, MiniCompose.MOCK_TRACKS[0]);
});

test('diatonicChoices returns 7 chords with roman numerals for a major key', function () {
  var choices = MiniCompose.diatonicChoices(MiniCompose.initialState('C', 'major'));
  assert.strictEqual(choices.length, 7);
  assert.strictEqual(choices[0].chord, 'C');
  assert.strictEqual(choices[0].roman, 'I');
  assert.strictEqual(choices[3].chord, 'F');
  assert.strictEqual(choices[4].chord, 'G');
});

test('romanNumerals reads I-IV-V for a built major progression', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['G', 'C', 'D']);
  assert.deepStrictEqual(MiniCompose.romanNumerals(s), ['I', 'IV', 'V']);
});
test('romanNumerals reads ii-V-I for a built jazz turnaround', function () {
  var s = MiniCompose.buildProgression(MiniCompose.initialState('G', 'major'), ['Am', 'D', 'G']);
  assert.deepStrictEqual(MiniCompose.romanNumerals(s), ['ii', 'V', 'I']);
});
test('romanNumerals on an empty progression is an empty array', function () {
  assert.deepStrictEqual(MiniCompose.romanNumerals(MiniCompose.initialState()), []);
});

run();
