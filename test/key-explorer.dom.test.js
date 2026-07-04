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
  var src = fs.readFileSync(path.join(__dirname, '../music/play/index.html'), 'utf8');
  assert.ok(/adapter\.scaleDiagram\.supportsStart\s*=\s*true/.test(src),
    'music/play/index.html no longer sets scaleDiagram.supportsStart - the position control would silently vanish app-wide');
});

run();
