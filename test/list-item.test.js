/* =====================================================================
 * list-item.test.js  -  unit tests for the SSOT Library list-item model.
 * Run: node test/list-item.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var LI = require('../music/shared/list-item.js');

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

test('normalize a SONG record (t/a/y/seq) to the common shape', function () {
  var it = LI.normalize({ id: 1, t: 'Let It Be', a: 'The Beatles', y: 1970, seq: ['C', 'G', 'Am', 'F'] });
  assert.strictEqual(it.title, 'Let It Be');
  assert.strictEqual(it.artist, 'The Beatles');
  assert.strictEqual(it.year, 1970);
  assert.deepStrictEqual(it.chords, ['C', 'G', 'Am', 'F']);
  assert.strictEqual(it.video, null);
});
test('normalize a TRACK record (title/artist/key/mode/genre/bpm/yt)', function () {
  var it = LI.normalize({ title: 'Three Little Birds', artist: 'Bob Marley', key: 'A', mode: 'major', genre: 'reggae', bpm: 76, yt: 'abcdefghijk' });
  assert.strictEqual(it.title, 'Three Little Birds');
  assert.strictEqual(it.key, 'A');
  assert.strictEqual(it.genre, 'reggae');
  assert.strictEqual(it.bpm, 76);
  assert.strictEqual(it.video, 'abcdefghijk');
  assert.strictEqual(it.chords, null);
});
test('action ladder: curated video -> Play; no video -> YouTube search', function () {
  assert.strictEqual(LI.action(LI.normalize({ yt: 'abcdefghijk' })).kind, 'play');
  assert.strictEqual(LI.action(LI.normalize({ t: 'x' })).kind, 'search');
});
test('keyLabel: A minor -> Am, C major -> C, no key -> null', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'A', mode: 'minor' })), 'Am');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'C', mode: 'major' })), 'C');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D', mode: 'dorian' })), 'Dm'); // minor-family
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x' })), null);
});
test('metaCells: SONG shows each chord + count + "mine" when custom', function () {
  var cells = LI.metaCells(LI.normalize({ seq: ['A', 'D', 'E'], custom: true }));
  assert.deepStrictEqual(cells, ['A', 'D', 'E', '3 chords', 'mine']);
});
test('metaCells: TRACK shows genre + bpm + capo', function () {
  var cells = LI.metaCells(LI.normalize({ genre: 'rock', bpm: 73, capo: 2 }));
  assert.deepStrictEqual(cells, ['rock', '73 bpm', 'capo 2']);
});
test('metaCells: collective union when an item has BOTH chords and track data', function () {
  var cells = LI.metaCells(LI.normalize({ seq: ['C', 'G'], genre: 'folk', bpm: 90 }));
  assert.deepStrictEqual(cells, ['C', 'G', '2 chords', 'folk', '90 bpm']);
});

run();
