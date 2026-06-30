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
test('normalize derives key from the first chord when none is given (fixes "Key?")', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'Let It Be', seq: ['C', 'G', 'Am', 'F'] })), 'C');
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['Am', 'F', 'C', 'G'] })), 'Am'); // minor first chord
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['F#m', 'D'] })), 'F#m');
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['Cmaj7', 'G'] })), 'C'); // maj7 is NOT minor
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x' })), null); // no chords, no key -> still null ("Key?")
  // an explicit key always wins over derivation
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D', mode: 'minor', seq: ['G', 'C'] })), 'Dm');
});
test('action ladder: curated video -> Video (in-app); no video -> Search (external)', function () {
  var play = LI.action(LI.normalize({ yt: 'abcdefghijk' }));
  assert.strictEqual(play.kind, 'play'); assert.strictEqual(play.label, 'Video'); assert.strictEqual(play.external, false);
  var search = LI.action(LI.normalize({ t: 'x' }));
  assert.strictEqual(search.kind, 'search'); assert.strictEqual(search.label, 'Search'); assert.strictEqual(search.external, true);
});
test('hazards: accidental-root -> sharps/flats; extended -> 7ths; plain -> none', function () {
  assert.deepStrictEqual(LI.hazards(LI.normalize({ seq: ['A', 'F#m', 'D'] })), ['sharps/flats']);
  assert.deepStrictEqual(LI.hazards(LI.normalize({ seq: ['Am', 'C', 'G7'] })), ['7ths']);
  assert.deepStrictEqual(LI.hazards(LI.normalize({ seq: ['C', 'G', 'Am'] })), []);
});
test('keyLabel: A minor -> Am, C major -> C, no key -> null', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'A', mode: 'minor' })), 'Am');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'C', mode: 'major' })), 'C');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D', mode: 'dorian' })), 'Dm'); // minor-family
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x' })), null);
});
test('metaCells: SONG -> count only at rest (chords/capo/mine are badges/markers, not meta)', function () {
  // plain open chords -> no hazard; custom + capo do NOT appear in the meta row
  var cells = LI.metaCells(LI.normalize({ seq: ['A', 'D', 'E'], custom: true, capo: 2 }));
  assert.deepStrictEqual(cells, ['3 chords']);
});
test('metaCells: TRACK -> bpm then genre (capo is a badge, not meta), universal order', function () {
  var cells = LI.metaCells(LI.normalize({ genre: 'rock', bpm: 73, capo: 2 }));
  assert.deepStrictEqual(cells, ['73 bpm', 'rock']);
});
test('metaCells: chords + track data -> count, hazard, bpm, genre (no per-chord spell-out)', function () {
  var cells = LI.metaCells(LI.normalize({ seq: ['C', 'G7'], genre: 'folk', bpm: 90 }));
  assert.deepStrictEqual(cells, ['2 chords', '7ths', '90 bpm', 'folk']);
});

run();
