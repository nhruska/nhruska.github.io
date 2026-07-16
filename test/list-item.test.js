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
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'Let It Be', seq: ['C', 'G', 'Am', 'F'] })), 'C major');
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['Am', 'F', 'C', 'G'] })), 'A minor'); // minor first chord
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['F#m', 'D'] })), 'F# minor');
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x', seq: ['Cmaj7', 'G'] })), 'C major'); // maj7 is NOT minor
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x' })), null); // no chords, no key -> still null ("Key?")
  // an explicit key always wins over derivation
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D', mode: 'minor', seq: ['G', 'C'] })), 'D minor');
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
test('keyLabel: spells major/minor out, mode-honest for church modes, no key -> null (F34)', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'A', mode: 'minor' })), 'A minor');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'C', mode: 'major' })), 'C major');
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'E', mode: 'aeolian' })), 'E minor'); // aeolian == natural minor
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'G', mode: 'mixolydian' })), 'G mixolydian'); // NOT "G major"
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D', mode: 'dorian' })), 'D dorian'); // NOT "D minor"
  assert.strictEqual(LI.keyLabel(LI.normalize({ t: 'x' })), null);
});

/* ---- Regime-B key-aware root respelling (2026-07-11 fix - FORK-4 leftover) --
 * The Library row badge (.li-tag.isKey) used to badge the raw stored root
 * verbatim ("A# major" on every row), even though note-spelling.md's regime B
 * (2026-07-10) says a key's root respells key-aware via
 * Circle.preferredTonicName. Node's require-fallback (circleRef()) gives these
 * tests the REAL kernel, so they lock actual respelling, not just a stub. */
test('keyLabel respells the root key-aware (A# major badges as "Bb major", never the canonical-sharp token)', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'A#', mode: 'major' })), 'Bb major');
});
test('keyLabel keeps a tie/keep-sharp root unrespelled (G# minor stays "G# minor", not "Ab minor")', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'G#', mode: 'minor' })), 'G# minor');
});
test('keyLabel is mode-aware for respelling, not hardcoded to major (D# minor stays "D# minor", not the major-mode "Eb minor")', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D#', mode: 'minor' })), 'D# minor');
});
test('keyLabel respelling composes with the mode-honest church-mode suffix (D# dorian -> "Eb dorian")', function () {
  assert.strictEqual(LI.keyLabel(LI.normalize({ key: 'D#', mode: 'dorian' })), 'Eb dorian');
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

test('S-SETRM-ARM source lock: the rm dispatch is arm-gated (first tap can never call onRemove) with the same 1.6s window as the progression .rm', function () {
  var fs = require('fs'), path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'list-item.js'), 'utf8');
  // The grammar constant matches S-DELETE-UNDO's 1600ms window.
  assert.ok(/RM_ARM_MS\s*=\s*1600/.test(src), 'RM_ARM_MS must stay 1600 (the S-DELETE-UNDO arm window)');
  // The rm branch must arm-and-return before onRemove can fire.
  var rmBranch = src.match(/a === 'rm' && opts\.onRemove\) \{([\s\S]*?)\}/);
  assert.ok(rmBranch, 'expected an rm dispatch block in list-item.js');
  assert.ok(/armRmBtn\(b\); return;/.test(rmBranch[1]), 'first tap must ARM and return - never fall through to onRemove');
});

test('S-SETADD-EVIDENT source lock: blocked rows render a GHOST + with the stated reason (never an empty add slot), and its tap dispatches onAddBlocked - not onAdd', function () {
  var fs = require('fs'), path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'list-item.js'), 'utf8');
  // The ghost branch exists for library-segment rows without onAdd but with a reason.
  assert.ok(/addBlockedReason/.test(src), 'renderer must accept addBlockedReason');
  var ghost = src.match(/opts\.addBlockedReason\) \{([\s\S]*?)\}/);
  assert.ok(ghost, 'expected the addBlockedReason ctrl branch');
  assert.ok(/li-add ghost/.test(ghost[1]), 'blocked rows must render the li-add ghost button');
  assert.ok(/aria-label/.test(ghost[1]), 'the ghost + must carry the reason as aria-label');
  // Dispatch: addblocked routes to onAddBlocked, never onAdd.
  assert.ok(/a === 'addblocked' && opts\.onAddBlocked\) opts\.onAddBlocked\(rec\)/.test(src), 'addblocked tap must dispatch onAddBlocked');
});

test('UAT 2026-07-16 setlist thumb-zone play: the set play action renders as a trailing li-play icon in NORMAL mode only, and its tap dispatches onAction', function () {
  var fs = require('fs'), path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'list-item.js'), 'utf8');
  // set segment + not editing -> a li-play button (the compact thumb-zone icon).
  var setBranch = src.match(/if \(seg === 'set'\) \{([\s\S]*?)\} else \{/);
  assert.ok(setBranch, 'expected a seg===set branch for the play action');
  assert.ok(/!opts\.setEdit/.test(setBranch[1]), 'the thumb-zone play shows only in NORMAL mode (edit mode gives the cluster to reorder/remove)');
  assert.ok(/li-play/.test(setBranch[1]), 'set-mode play renders the li-play icon');
  // It is placed in the trailing cluster (with editBtn/ctrl), not inside li-body.
  assert.ok(/setPlay \+ editBtn \+ ctrl/.test(src), 'the play icon sits in the trailing thumb cluster, not the meta row');
  // Dispatch routes to onAction (the same handler the old inline li-act used).
  assert.ok(/a === 'play' && opts\.onAction\) opts\.onAction\(rec\)/.test(src), 'the thumb-zone play tap dispatches onAction');
  // Library rows keep the inline labelled action (the else branch).
  assert.ok(/li-act li-act-/.test(src), 'library rows keep the inline labelled action');
});

run();
