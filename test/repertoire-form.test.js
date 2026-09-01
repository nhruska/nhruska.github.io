/* =====================================================================
 * repertoire-form.test.js  -  unit tests for the M2 Add/Edit form's pure
 * field-parsing helpers (repertoire-form.js). DOM-building (mount/open) is
 * exercised via Playwright at integration; these cover the pure logic only.
 * Run: node test/repertoire-form.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
// repertoire-form.js's esc() delegates to esc.js's Esc.esc via the shared
// window/global object (classic-<script>-tag pattern) - alias window to the
// real Node global BEFORE requiring esc.js, same pattern as
// test/diagram.dom.test.js / test/songbook.test.js, so RF.rootOptionsHtml()
// (which calls esc()) doesn't throw when exercised outside a real DOM.
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
var RF = require('../music/shared/repertoire-form.js');
var Circle = require('../music/shared/circle.js');

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

test('parseSeq splits on whitespace and commas, trims, drops empties', function () {
  assert.deepStrictEqual(RF.parseSeq('G  D, Em ,C'), ['G', 'D', 'Em', 'C']);
});
test('parseSeq of empty/blank input -> [] (a standalone video-only track)', function () {
  assert.deepStrictEqual(RF.parseSeq(''), []);
  assert.deepStrictEqual(RF.parseSeq('   '), []);
  assert.deepStrictEqual(RF.parseSeq(undefined), []);
});
test('seqToText round-trips parseSeq output back to a space-joined string', function () {
  var seq = RF.parseSeq('Am F C G');
  assert.strictEqual(RF.seqToText(seq), 'Am F C G');
  assert.strictEqual(RF.seqToText([]), '');
  assert.strictEqual(RF.seqToText(null), '');
});

// readFields needs a minimal fake form (querySelector over a fixed field map) -
// exercises the exact field set songbook.js's createCustomItem/updateCustomItem consume.
function fakeForm(values) {
  var map = {
    '[data-title]': values.title, '[data-artist]': values.artist, '[data-key]': values.key,
    '[data-mode]': values.mode, '[data-genre]': values.genre, '[data-seq]': values.seq, '[data-url]': values.url
  };
  return { querySelector: function (sel) { return { value: map[sel] != null ? map[sel] : '' }; } };
}
function fakeParseYouTubeId(url) {
  var m = /(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})/.exec(url || '');
  return m ? m[1] : null;
}

test('readFields: full create-mode form (song, no video)', function () {
  var f = RF.readFields(fakeForm({ title: 'New Song', artist: 'Me', key: 'G', mode: 'major', genre: 'rock', seq: 'G D Em C', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.title, 'New Song');
  assert.strictEqual(f.key, 'G');
  assert.strictEqual(f.mode, 'major');
  assert.deepStrictEqual(f.seq, ['G', 'D', 'Em', 'C']);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, false);
});
test('readFields: minor mode + no chords -> a standalone track (empty seq)', function () {
  var f = RF.readFields(fakeForm({ title: 'Jam track', artist: '', key: 'A', mode: 'minor', genre: '', seq: '', url: 'https://youtu.be/dQw4w9WgXcQ' }), fakeParseYouTubeId);
  assert.strictEqual(f.mode, 'minor');
  assert.deepStrictEqual(f.seq, []);
  assert.strictEqual(f.yt, 'dQw4w9WgXcQ');
});
test('readFields: an invalid pasted URL is flagged, not silently dropped', function () {
  var f = RF.readFields(fakeForm({ title: 'X', artist: '', key: '', mode: 'major', genre: '', seq: '', url: 'not a url' }), fakeParseYouTubeId);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, true);
});
test('readFields: no video field at all is valid (optional field)', function () {
  var f = RF.readFields(fakeForm({ title: 'X', artist: '', key: '', mode: 'major', genre: '', seq: '', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.yt, null);
  assert.strictEqual(f._urlInvalid, false);
});

/* ---- 4-mode round-trip (the modal-rewrite bug: a major/minor-only select
 * silently rewrote dorian/mixolydian songs to major on every edit) ---- */
test('normFormMode round-trips the full 4-mode vocabulary', function () {
  assert.strictEqual(RF.normFormMode('dorian'), 'dorian');
  assert.strictEqual(RF.normFormMode('Mixolydian'), 'mixolydian');
  assert.strictEqual(RF.normFormMode('minor'), 'minor');
  assert.strictEqual(RF.normFormMode('MAJOR'), 'major');
  assert.strictEqual(RF.normFormMode(''), 'major');
  assert.strictEqual(RF.normFormMode(null), 'major');
  assert.strictEqual(RF.normFormMode('locrian'), 'major'); // outside the form vocabulary -> safe default
});
test('MODES is the locked 5-mode vocabulary the select renders', function () {
  // 'blues' joined with the playlist import (M-PLAYLIST-IMPORT): imported
  // blues jams carry mode:'blues' like the seed catalog, and without it in
  // the select an EDIT would rewrite them to major via normFormMode.
  assert.deepStrictEqual(RF.MODES, ['major', 'minor', 'dorian', 'mixolydian', 'blues']);
});
test('readFields round-trips a blues item without rewriting it to major', function () {
  var f = RF.readFields(fakeForm({ title: 'Blues jam', artist: '', key: 'A', mode: 'blues', genre: 'blues', seq: '', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.mode, 'blues');
});
test('readFields round-trips a dorian item without rewriting it to major', function () {
  var f = RF.readFields(fakeForm({ title: 'Modal jam', artist: '', key: 'A', mode: 'dorian', genre: '', seq: 'Am D', url: '' }), fakeParseYouTubeId);
  assert.strictEqual(f.mode, 'dorian');
});
test('readFields in FORK mode (no Chords field) leaves seq undefined, not a crash or []', function () {
  // fork mode hides [data-seq]; querySelector returns null. readFields must NOT
  // throw and must NOT emit an empty seq that would clobber the preserved sheet.
  var form = { querySelector: function (sel) {
    if (sel === '[data-seq]') return null;
    var map = { '[data-title]': 'Let It Be', '[data-artist]': 'The Beatles', '[data-key]': 'C', '[data-mode]': 'major', '[data-genre]': '', '[data-url]': '' };
    return { value: map[sel] != null ? map[sel] : '' };
  } };
  var f = RF.readFields(form, fakeParseYouTubeId);
  assert.strictEqual(f.seq, undefined);
  assert.strictEqual(f.title, 'Let It Be');
});

/* ---- applicableYtHints (U17, M-TRACKLIB w2a): apply-to-empty-only ------
 * DOM wiring (wireYtSuggest) is Playwright/live-check territory (per this
 * file's header note); this covers the pure decision logic it delegates to. */
test('applicableYtHints: all fields empty -> every non-null hint is applicable', function () {
  var out = RF.applicableYtHints(
    { t: 'A Minor Blues Backing Track', a: 'QuickTracks', key: 'A', mode: 'minor', genre: 'blues', bpm: 80 },
    { title: '', artist: '', key: '', mode: 'major', genre: '' }
  );
  assert.deepStrictEqual(out, { title: 'A Minor Blues Backing Track', artist: 'QuickTracks', key: 'A', mode: 'minor', genre: 'blues' });
});
test('applicableYtHints: a field the operator already typed into is NEVER overwritten', function () {
  var out = RF.applicableYtHints(
    { t: 'Suggested Title', a: 'Suggested Artist', key: 'G', mode: 'dorian', genre: 'funk' },
    { title: 'My Own Title', artist: '', key: '', mode: 'major', genre: '' }
  );
  assert.strictEqual(out.title, undefined);
  assert.strictEqual(out.artist, 'Suggested Artist');
  assert.strictEqual(out.key, 'G');
});
test('applicableYtHints: key select already has a value -> key hint withheld', function () {
  var out = RF.applicableYtHints({ t: null, a: null, key: 'D', mode: null, genre: null }, { key: 'C', mode: 'major' });
  assert.strictEqual(out.key, undefined);
});
test('applicableYtHints: mode select already off its default -> mode hint withheld', function () {
  var out = RF.applicableYtHints({ mode: 'mixolydian' }, { mode: 'dorian' });
  assert.strictEqual(out.mode, undefined);
});
test('applicableYtHints: mode select still at the untouched default -> mode hint applies', function () {
  var out = RF.applicableYtHints({ mode: 'mixolydian' }, { mode: 'major' });
  assert.strictEqual(out.mode, 'mixolydian');
});
test('applicableYtHints: no hints at all -> empty applicable set', function () {
  assert.deepStrictEqual(RF.applicableYtHints({}, { title: '', artist: '', key: '', mode: 'major', genre: '' }), {});
});
test('applicableYtHints: whitespace-only existing value counts as empty', function () {
  var out = RF.applicableYtHints({ genre: 'rock' }, { genre: '   ' });
  assert.strictEqual(out.genre, 'rock');
});

/* =====================================================================
 * F33 (UAT): "delete seems to be in a risky place... bottom right should be
 * save. delete buttons should be red." Delete/Revert now renders BEFORE Save
 * in .rf-actions (left, away from the one-hand thumb zone; Save takes the
 * thumb-easy right slot). The REAL Delete is genuinely red (.btn.danger); the
 * fork "Revert to original" is ALSO destructive (discards edits, confirm-gated)
 * but stays .btn.ghost as a deliberate softer signal (.btn.red is a misnomer,
 * it's the accent fill). render()'s DOM-building is
 * Playwright/live-check territory per this file's own header note - this
 * pins the SOURCE contract instead (same convention as tracks.test.js's F32
 * test and songbook.test.js's solo-button-gate source-regex test).
 * ===================================================================== */
test('F33: .rf-actions renders Delete/Revert BEFORE Save (thumb-zone reorder), and the real Delete uses .btn.danger (not .btn.ghost)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  var actionsBlock = /rf-actions[\s\S]{0,600}/.exec(src)[0];
  var deleteIdx = actionsBlock.indexOf('data-delete');
  var saveIdx = actionsBlock.indexOf('data-save');
  assert.ok(deleteIdx >= 0 && saveIdx >= 0, 'expected both data-delete and data-save markup in the rf-actions block');
  assert.ok(deleteIdx < saveIdx, 'F33: Delete/Revert must render BEFORE Save in the template (left/away-from-thumb, not bottom-right)');
  assert.ok(/class="btn ' \+ \(fork \? 'ghost' : 'danger'\)/.test(src), 'the real Delete must use .btn.danger; the fork "Revert to original" stays .btn.ghost - a deliberate softer signal, though it too is destructive (discards edits, confirm-gated)');
  assert.ok(/class="btn red" data-save/.test(src), 'Save keeps its existing .btn.red (primary accent) styling, unchanged by this fix');
});

/* =====================================================================
 * S-UI-RECONCILE Lane B fix (2026-07-11): the Key dropdown's option LABELS
 * were built once at render() time against a HARDCODED 'major', so editing a
 * minor/dorian/mixolydian item showed the wrong enharmonic name and never
 * re-derived when the operator changed the Mode select mid-edit. Fixed by
 * extracting rootOptionsHtml(mode, key, Cir) - called by BOTH the initial
 * paint and the Mode-select change handler - with Cir dependency-injected
 * (same pattern as songbook.js's libraryFilter(Rep, ...)) so these tests can
 * pass the REAL circle.js kernel and lock actual key-aware respelling.
 * render()'s DOM-building stays Playwright/live-check territory (this file's
 * header note); rootOptionsHtml is the pure logic seam that IS unit-testable,
 * plus a source-regex case (same convention as the F33 test above) locking
 * that the Mode select is wired to re-render it live.
 * ===================================================================== */
test('rootOptionsHtml: mode is a real parameter, not hardcoded major - a minor-mode root keeps its minor-preferred spelling', function () {
  var html = RF.rootOptionsHtml('minor', 'D#', Circle);
  assert.ok(/>D#<\/option>/.test(html), 'D# minor should stay D# (not respelled to the major-mode Eb): ' + html);
});
test('rootOptionsHtml: a major-mode root respells to its preferred flat name when Circle is injected (A# major -> Bb)', function () {
  var html = RF.rootOptionsHtml('major', 'A#', Circle);
  assert.ok(/>Bb<\/option>/.test(html), 'A# major should display as Bb: ' + html);
});
test('rootOptionsHtml: without Circle injected, falls back to the raw canonical-sharp token (Node/stale-cache safety net, existing S-KEYPICKER-PREFERRED contract)', function () {
  var html = RF.rootOptionsHtml('major', 'A#', null);
  assert.ok(/>A#<\/option>/.test(html), 'no Circle -> raw token, unchanged behavior: ' + html);
});
test('rootOptionsHtml: the currently-selected key VALUE is preserved regardless of which mode/spelling is displayed', function () {
  var html = RF.rootOptionsHtml('minor', 'G', Circle);
  assert.ok(/value="G" selected/.test(html), 'the selected root token must stay canonical (G), independent of display label: ' + html);
});
test('render() re-derives Key option labels on every Mode-select change (live re-render, not a one-time major-hardcoded paint)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  assert.ok(!/preferredTonicName\(r, 'major'\)/.test(src), 'the old hardcoded-major call must be gone');
  assert.ok(/rootOptionsHtml\(mode, key\)/.test(src), 'initial paint must call rootOptionsHtml with the item\'s actual mode');
  var modeChangeBlock = /modeSel\.addEventListener\('change'[\s\S]{0,300}/.exec(src);
  assert.ok(modeChangeBlock, 'expected a change listener wired on the Mode select');
  assert.ok(/rootOptionsHtml\(modeSel\.value, curKey\)/.test(modeChangeBlock[0]), 'the Mode-change handler must re-render Key labels via rootOptionsHtml against the NEW mode value: ' + modeChangeBlock[0]);
});

/* =====================================================================
 * Delete/Revert is arm-to-delete, not a native confirm() (T3: retire the
 * confirm() dialog into the app's arm-to-delete grammar). armDelBtn/
 * disarmDelBtn/the delBtn.onclick handler are closures inside mount() - not
 * reachable as standalone exports, and mount()/open() need a real document
 * (this file's own header note: DOM-building is Playwright/live-check
 * territory). Same source-regex-pin convention as songbook.js's "setClear
 * wiring" test and this file's own F33/S-UI-RECONCILE tests above: read the
 * real source and assert the state-machine shape, rather than hand-rolling a
 * jsdom stand-in this codebase deliberately avoids.
 * ===================================================================== */
test('delete/revert: no native confirm() dialog remains (arm-to-delete replaces it)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  // Strip // line comments first (evidence-integrity: assert against a USE,
  // not a mention - this file's own header comment now describes the retired
  // confirm() call, which would false-positive a naive whole-source scan).
  var codeOnly = src.split('\n').map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
  assert.ok(!/confirm\(msg\)/.test(codeOnly), 'the old confirm(msg) call must be gone');
  assert.ok(!/\bconfirm\(/.test(codeOnly), 'no native confirm() call of any shape may remain in repertoire-form.js (comments excluded)');
});
test('delete/revert: first activation ARMS and returns without deleting (does not call onDelete)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  var onclickBlock = /delBtn\.onclick = function \(\) \{[\s\S]{0,1000}?\n          \};/.exec(src);
  assert.ok(onclickBlock, 'expected delBtn.onclick handler body');
  var body = onclickBlock[0];
  // The arm-gate must be the FIRST statement and must `return` before any
  // onDelete/settleAfter call - i.e. a first tap on an unarmed button cannot
  // reach the delete path at all.
  var gate = /if \(armedDelBtn !== delBtn\) \{ armDelBtn\(delBtn, fork \? 'Tap again to revert' : 'Tap again to delete'\); return; \}/.exec(body);
  assert.ok(gate, 'expected the arm gate "if (armedDelBtn !== delBtn) { armDelBtn(delBtn, <fork-aware arm label>); return; }" as the first line of the handler: ' + body);
  assert.ok(body.indexOf(gate[0]) < body.indexOf('doDelete'), 'the arm-and-return gate must precede the delete call, so a first (unarmed) tap never reaches onDelete');
});
test('delete/revert: second activation (already armed) disarms and proceeds to delete', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  var onclickBlock = /delBtn\.onclick = function \(\) \{[\s\S]{0,1000}?\n          \};/.exec(src)[0];
  var disarmIdx = onclickBlock.indexOf('disarmDelBtn();');
  var doDeleteIdx = onclickBlock.indexOf('var doDelete');
  assert.ok(disarmIdx >= 0, 'expected disarmDelBtn() to run once the button is already armed');
  assert.ok(doDeleteIdx > disarmIdx, 'disarm must happen before the delete proceeds (armedDelBtn cleared so a stale ref never re-deletes)');
  assert.ok(/if \(global\.NavHistory\) global\.NavHistory\.settleAfter\(close, doDelete\);/.test(onclickBlock), 'a second (armed) tap must still route the actual delete through the existing settleAfter/close hand-off, unchanged from the pre-arm behavior');
});
test('delete/revert: arm auto-disarms after DEL_ARM_MS (1600ms, matches list-item.js RM_ARM_MS)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  assert.ok(/var DEL_ARM_MS = 1600;/.test(src), 'expected DEL_ARM_MS = 1600, matching list-item.js\'s RM_ARM_MS timing');
  assert.ok(/armedDelTimer = setTimeout\(disarmDelBtn, DEL_ARM_MS\);/.test(src), 'armDelBtn must schedule an auto-disarm via setTimeout(disarmDelBtn, DEL_ARM_MS)');
  var disarmFn = /function disarmDelBtn\(\) \{[\s\S]{0,600}?\n    \}/.exec(src);
  assert.ok(disarmFn, 'expected a disarmDelBtn() function');
  assert.ok(/clearTimeout\(armedDelTimer\)/.test(disarmFn[0]), 'disarmDelBtn must clear the pending timer (so re-arming or a real disarm never double-fires)');
  assert.ok(/armedDelBtn\.classList\.remove\('armed'\)/.test(disarmFn[0]), 'disarmDelBtn must remove the .armed class (the visible red-arm signal)');
});
test('delete/revert: armDelBtn adds the .armed class AND relabels (arm signal is never color-only)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  var armFn = /function armDelBtn\(btn, armLabel\) \{[\s\S]{0,600}?\n    \}/.exec(src);
  assert.ok(armFn, 'expected an armDelBtn(btn, armLabel) function');
  assert.ok(/disarmDelBtn\(\);/.test(armFn[0]), 'armDelBtn must disarm any previously-armed button first (module-scope single-armed invariant, mirrors list-item.js)');
  assert.ok(/btn\.classList\.add\('armed'\)/.test(armFn[0]), 'armDelBtn must add the .armed class to the tapped button');
  // Color-only arm signals are invisible on touch (no tooltip) and to
  // colorblind users - the relabel is the accessible half of the signal,
  // mirroring songbook's #delSongBtn "Tap again to ..." grammar.
  assert.ok(/armedDelIdleText = btn\.textContent/.test(armFn[0]), 'armDelBtn must snapshot the idle label so disarm can restore it');
  assert.ok(/if \(armLabel\) btn\.textContent = armLabel/.test(armFn[0]), 'armDelBtn must relabel the armed button (textContent), never rely on color alone');
  assert.ok(/armDelBtn\(delBtn, fork \? 'Tap again to revert' : 'Tap again to delete'\)/.test(src), 'the wiring must pass the fork-aware arm label');
  var disarmFn = /function disarmDelBtn\(\) \{[\s\S]{0,600}?\n    \}/.exec(src);
  assert.ok(/armedDelBtn\.textContent = armedDelIdleText/.test(disarmFn[0]), 'disarmDelBtn must restore the idle label');
});
test('delete/revert: closing the form disarms the pending timer (no leaked setTimeout referencing a detached button)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'repertoire-form.js'), 'utf8');
  assert.ok(/function close\(\) \{ disarmDelBtn\(\); el\.classList\.remove\('on'\); el\.innerHTML = ''; current = null; \}/.test(src), 'close() must call disarmDelBtn() before tearing down the DOM');
});

run();
