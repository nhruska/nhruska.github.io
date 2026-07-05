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
test('action ladder: curated video -> Video (in-app); no video -> no action (F25: external Search removed)', function () {
  var play = LI.action(LI.normalize({ yt: 'abcdefghijk' }));
  assert.strictEqual(play.kind, 'play'); assert.strictEqual(play.label, 'Video'); assert.strictEqual(play.external, false);
  var none = LI.action(LI.normalize({ t: 'x' }));
  assert.strictEqual(none, null, 'a row with no in-app video must advertise no action - no leave-the-app link');
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

/* ---------- wireTap (S-HARDEN A4: the SSOT movement-cancel tap guard) ----------
 * songbook.js's wireTapCancel/composeWireTap now delegate here, so this is the
 * authoritative test suite for the pattern - same "just enough DOM" fake
 * element approach as test/songbook.test.js's (now-delegating) wireTapCancel
 * tests, no jsdom dependency. */
function FakeTapEl() { this._h = {}; }
FakeTapEl.prototype.addEventListener = function (type, fn) { (this._h[type] = this._h[type] || []).push(fn); };
FakeTapEl.prototype.fire = function (type, evt) { (this._h[type] || []).forEach(function (fn) { fn(evt); }); };
function touch(x, y) { return { touches: [{ clientX: x, clientY: y }] }; }
function clickEvt() { return { stopPropagation: function () {}, marker: 'click-evt' }; }

test('wireTap: a still tap (no touchmove past threshold) fires fn', function () {
  var el = new FakeTapEl(), fired = 0;
  LI.wireTap(el, function () { fired++; });
  el.fire('touchstart', touch(100, 100));
  el.fire('touchmove', touch(103, 98)); // 3px, well under the 10px threshold
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 1);
});

test('wireTap: a scroll-grab (touchmove > 10px) suppresses fn', function () {
  var el = new FakeTapEl(), fired = 0;
  LI.wireTap(el, function () { fired++; });
  el.fire('touchstart', touch(100, 100));
  el.fire('touchmove', touch(100, 130)); // 30px vertical scroll-grab
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 0);
});

test('wireTap: threshold is exclusive-over-10px and checks EITHER axis', function () {
  var el = new FakeTapEl(), fired = 0;
  LI.wireTap(el, function () { fired++; });
  el.fire('touchstart', touch(0, 0));
  el.fire('touchmove', touch(11, 0)); // x-only breach
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 0, 'x-axis breach alone must cancel');

  var el2 = new FakeTapEl(), fired2 = 0;
  LI.wireTap(el2, function () { fired2++; });
  el2.fire('touchstart', touch(0, 0));
  el2.fire('touchmove', touch(0, 10)); // exactly at threshold, not over
  el2.fire('click', clickEvt());
  assert.strictEqual(fired2, 1, 'exactly-10px move must still count as a tap');
});

test('wireTap: a mouse click with no touch events at all still fires (desktop unaffected)', function () {
  var el = new FakeTapEl(), fired = 0;
  LI.wireTap(el, function () { fired++; });
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 1);
});

test('wireTap: no-op guard when el or fn is missing (never throws)', function () {
  assert.doesNotThrow(function () { LI.wireTap(null, function () {}); });
  assert.doesNotThrow(function () { LI.wireTap(new FakeTapEl(), null); });
});

test('wireTap: fn receives the triggering click event (composeWireTap\'s prior contract, preserved on dedup)', function () {
  var el = new FakeTapEl(), receivedArg;
  LI.wireTap(el, function (e) { receivedArg = e; });
  var evt = clickEvt();
  el.fire('click', evt);
  assert.strictEqual(receivedArg, evt, 'fn must receive the click event, not be called with zero args');
});

run();
