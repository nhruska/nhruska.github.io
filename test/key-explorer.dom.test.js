/* =====================================================================
 * key-explorer.dom.test.js  -  drives the REAL KeyExplorer.renderScale
 * through a minimal stub document + a recording fake pack: supportsStart
 * detection, the startFret argument actually handed to pack.scaleDiagram,
 * button-click walking (0 -> 5 -> 10), cap truncation, label text, and
 * disabled gating. Closes the "wiring can break green" gap without jsdom.
 * Run: node test/key-explorer.dom.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

/* ---- ~25-line document stub: just enough DOM for renderScale ---- */
function makeEl(tag) {
  var el = {
    tagName: tag, children: [], className: '', textContent: '', disabled: false,
    attrs: {}, parentNode: null, onclick: null,
    appendChild: function (c) { c.parentNode = el; el.children.push(c); return c; },
    setAttribute: function (k, v) { el.attrs[k] = v; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return ''; },
    set: function (v) { if (v === '') el.children = []; }
  });
  return el;
}
global.document = { createElement: makeEl };

var KE = require('../music/shared/key-explorer.js');

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

/* ---- recording fake pack ---- */
function fakePack(supportsStart) {
  var calls = [];
  function scaleDiagram(rootPc, pcs, frets, startFret, names, tones) {
    calls.push({ args: arguments.length, frets: frets, startFret: startFret, tones: tones });
    return makeEl('svg');
  }
  if (supportsStart) scaleDiagram.supportsStart = true;
  return { scaleDiagram: scaleDiagram, calls: calls };
}
function findByClass(root, cls) {
  if ((root.className || '').split(' ').indexOf(cls) >= 0) return root;
  for (var i = 0; i < (root.children || []).length; i++) {
    var hit = findByClass(root.children[i], cls);
    if (hit) return hit;
  }
  return null;
}
function ctrlParts(boxWrap) {
  var ctrl = findByClass(boxWrap, 'scalePosCtrl');
  var btns = ctrl.children.filter(function (c) { return c.className.indexOf('scalePosBtn') >= 0; });
  return { ctrl: ctrl, back: btns[0], fwd: btns[1], lbl: findByClass(ctrl, 'scalePosLbl') };
}

test('supportsStart pack: control renders INSIDE boxWrap, first call starts at fret 0', function () {
  var pack = fakePack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4, 5, 7, 9, 11], { frets: 7 });
  var p = ctrlParts(boxWrap);
  assert.ok(p.ctrl && p.ctrl.parentNode === boxWrap, 'control must live inside boxWrap');
  assert.strictEqual(pack.calls[0].startFret, 0);
  assert.strictEqual(p.lbl.textContent, 'frets 0-7');
  assert.strictEqual(p.back.disabled, true);
  assert.strictEqual(p.fwd.disabled, false);
});

test('forward clicks hand the REAL startFret walk (0 -> 5 -> 10) to pack.scaleDiagram', function () {
  var pack = fakePack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4, 5, 7, 9, 11], { frets: 7 });
  var p = ctrlParts(boxWrap);
  p.fwd.onclick();
  assert.strictEqual(pack.calls[1].startFret, 5);
  assert.strictEqual(p.lbl.textContent, 'frets 5-11');
  p.fwd.onclick();
  assert.strictEqual(pack.calls[2].startFret, 10);
  assert.strictEqual(pack.calls[2].frets, 5, 'cap truncates the shown span to 10-14');
  assert.strictEqual(p.lbl.textContent, 'frets 10-14');
  assert.strictEqual(p.fwd.disabled, true, 'forward disables at the cap stop');
});

test('back clicks walk down and re-enable/disable correctly', function () {
  var pack = fakePack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4], { frets: 7 });
  var p = ctrlParts(boxWrap);
  p.fwd.onclick(); p.fwd.onclick(); // at 10
  p.back.onclick();
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 5);
  assert.strictEqual(p.fwd.disabled, false, 'forward re-enables off the cap');
  p.back.onclick();
  assert.strictEqual(p.back.disabled, true, 'back disables at the open position');
});

test('pack WITHOUT supportsStart: classic 3-arg call, no control rendered', function () {
  var pack = fakePack(false), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4], { frets: 7 });
  assert.strictEqual(pack.calls[0].args, 3, 'startFret must not leak into a 3-arg pack contract');
  assert.strictEqual(findByClass(boxWrap, 'scalePosCtrl'), null, 'no position control without the flag');
});

/* ---------- M-GUIDE W3a: opts.tones passthrough + boxWrap.setTones() ---------- */
test('opts.tones is forwarded to pack.scaleDiagram as the 6th positional arg', function () {
  var pack = fakePack(true), host = makeEl('div');
  var tones = { byPc: { 0: 'root' }, rubPc: null };
  KE.renderScale(host, pack, 0, [0, 2, 4], { frets: 7, tones: tones });
  assert.strictEqual(pack.calls[0].tones, tones);
});
test('boxWrap.setTones(tones) re-renders diagBox ONLY, preserving startFret (no position reset)', function () {
  var pack = fakePack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4, 5, 7, 9, 11], { frets: 7 });
  var p = ctrlParts(boxWrap);
  p.fwd.onclick(); // walk to startFret 5
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 5);
  assert.strictEqual(typeof boxWrap.setTones, 'function');
  var newTones = { byPc: { 2: 'chord' }, rubPc: 1 };
  boxWrap.setTones(newTones);
  var last = pack.calls[pack.calls.length - 1];
  assert.strictEqual(last.startFret, 5, 'setTones must not reset the position walk');
  assert.strictEqual(last.tones, newTones);
  // label + button state should also be unaffected by a tones-only re-render
  assert.strictEqual(p.lbl.textContent, 'frets 5-11');
});
test('boxWrap.setTones(null) clears tones on the next renderBox call', function () {
  var pack = fakePack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 0, [0, 2, 4], { frets: 7, tones: { byPc: { 0: 'root' }, rubPc: null } });
  boxWrap.setTones(null);
  assert.strictEqual(pack.calls[pack.calls.length - 1].tones, null);
});
test('pack WITHOUT supportsStart: tones never leaks into the classic 3-arg call', function () {
  var pack = fakePack(false), host = makeEl('div');
  KE.renderScale(host, pack, 0, [0, 2, 4], { frets: 7, tones: { byPc: {}, rubPc: null } });
  assert.strictEqual(pack.calls[0].args, 3);
});

test('the SHIPPED adapter declares supportsStart (source contract - fake packs alone would let its removal ship green)', function () {
  var fs = require('fs'), path = require('path');
  // S-EXTRACT (analysis-refactor-enhance-20260704 A3): buildAdapter moved out
  // of play/index.html into shared/chord-pack-adapter.js - the source
  // contract now anchors there instead.
  var src = fs.readFileSync(path.join(__dirname, '../music/shared/chord-pack-adapter.js'), 'utf8');
  assert.ok(/adapter\.scaleDiagram\.supportsStart\s*=\s*true/.test(src),
    'music/shared/chord-pack-adapter.js no longer sets scaleDiagram.supportsStart - the position control would silently vanish app-wide');
});

/* ---------- S-BLUES-BOXES: opts.boxScaleId pager-snap + box chip ---------- */
function fakeGuitarPack(supportsStart) {
  var pack = fakePack(supportsStart);
  pack.meta = { stringNames: ['E', 'A', 'D', 'G', 'B', 'E'] };
  return pack;
}
function chipOf(boxWrap) { return findByClass(boxWrap, 'scaleBoxChip'); }

test('boxScaleId absent: no scaleBoxChip element at all (byte-identical to pre-boxes DOM)', function () {
  var pack = fakeGuitarPack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7 });
  assert.strictEqual(chipOf(boxWrap), null);
});

test('boxScaleId set (A pentMinor, guitar): forward SNAPS through box starts (0 -> 3 -> 5 -> 8 -> 10 -> 12), not the fixed 0/5/10 walk', function () {
  var pack = fakeGuitarPack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7, boxScaleId: 'pentMinor' });
  var p = ctrlParts(boxWrap);
  var expected = [3, 5, 8, 10, 12];
  expected.forEach(function (want) {
    p.fwd.onclick();
    assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, want, 'expected snap to fret ' + want);
  });
  assert.strictEqual(p.fwd.disabled, true, 'forward disables once the highest box (fret 12) is reached');
});

test('boxScaleId set: the chip shows "Box 1 - root on 6th string, fret 5" exactly when startFret lands on Box 1, hidden otherwise', function () {
  var pack = fakeGuitarPack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7, boxScaleId: 'pentMinor' });
  var p = ctrlParts(boxWrap), chip = chipOf(boxWrap);
  assert.ok(chip, 'chip element must exist once a box list resolves');
  assert.strictEqual(chip.hidden, true, 'no box aligns with the initial open (fret 0) window');
  p.fwd.onclick(); // -> fret 3 (Box 5, wrapped)
  assert.strictEqual(chip.hidden, false);
  assert.strictEqual(chip.textContent, 'Box 5 - root on 3rd string, fret 2');
  p.fwd.onclick(); // -> fret 5 (Box 1)
  assert.strictEqual(chip.textContent, 'Box 1 - root on 6th string, fret 5');
});

test('boxScaleId set: back SNAPS to the previous lower box start and re-disables at the lowest one', function () {
  var pack = fakeGuitarPack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7, boxScaleId: 'pentMinor' });
  var p = ctrlParts(boxWrap);
  p.fwd.onclick(); p.fwd.onclick(); p.fwd.onclick(); // -> 3, 5, 8
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 8);
  p.back.onclick();
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 5);
  p.back.onclick();
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 3);
  assert.strictEqual(p.back.disabled, true, 'back disables once the lowest box (fret 3) is reached');
});

test('boxScaleId set but pack lacks meta.stringNames: degrades to the classic fixed 0/5/10 walk, no chip, never throws', function () {
  var pack = fakePack(true), host = makeEl('div'); // no .meta at all
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7, boxScaleId: 'pentMinor' });
  var p = ctrlParts(boxWrap);
  assert.strictEqual(chipOf(boxWrap), null);
  p.fwd.onclick();
  assert.strictEqual(pack.calls[pack.calls.length - 1].startFret, 5, 'classic fixed step still applies');
});

test('boxScaleId set on a MODE (non-pentatonic) render is the caller\'s job to omit - passing it anyway still only affects the pager, never the diagram call shape', function () {
  var pack = fakeGuitarPack(true), host = makeEl('div');
  var boxWrap = KE.renderScale(host, pack, 9, [9, 0, 2, 4, 7], { frets: 7, boxScaleId: 'pentMinor' });
  assert.strictEqual(pack.calls[0].args, 6, 'the 6-arg supportsStart call shape is unaffected by box mode');
});

run();
