/* =====================================================================
 * compose-all-spelling.test.js  -  P2-1: Compose > All (the non-chip
 * diagram-tile branch, i.e. useChips=false - the default at beginner/
 * intermediate guidance, or whenever the chord-charts pref isn't pinned to
 * 'chips') must respell chord-tile labels key-aware, exactly like the
 * chip branch and the In-key view already do.
 *
 * The bug: buildGrid()'s "All" view called packDiagram(c, 'small') with NO
 * displayName arg in the non-chip branch, so with a key set (F major here -
 * the app's own default is C major, but this file pins F explicitly to
 * match the reported scenario) the tile showed the raw canonical-sharp
 * TOKEN (A#) instead of the key-aware DISPLAY name (Bb) - while the SAME
 * screen's In-key tab (and the chip-mode All view) already showed Bb via
 * dispChordName(c). Two spellings of one pitch on one screen is exactly the
 * bug note-spelling.md's token/display split exists to prevent.
 *
 * Drives the REAL buildGrid() through Songbook.mount() with a minimal stub
 * DOM (same approach as songbook.test.js's mountForGridTests) plus a fake
 * chordPack whose diagram() returns a queryable label node, so packDiagram's
 * real relabel-after-render seam is exercised for real - not re-implemented.
 *
 * Run: node test/compose-all-spelling.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
if (typeof global.window === 'undefined') global.window = global;
// same require order as songbook.test.js: esc/list-item/toast/queue before
// songbook.js so every shared module's IIFE lands on the one global.window.
require('../music/shared/esc.js');
require('../music/shared/list-item.js');
require('../music/shared/toast.js');
require('../music/shared/queue.js');
require('../music/shared/repertoire.js'); // sets global.Repertoire - mount()'s rebuildAll() needs Repertoire.matchKey
require('../music/shared/circle.js'); // sets global.Circle - songbook.js reads it directly (dispChordName's respeller)
var Songbook = require('../music/shared/songbook.js');
var lsReset = require('./helpers/local-storage-reset.js');

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

/* ---------- minimal stub DOM (same shape as songbook.test.js's makeStubEl) ---------- */
function makeStubEl(tag) {
  var e = {
    tagName: tag, children: [], className: '', textContent: '', hidden: false,
    disabled: false, attrs: {}, style: {}, parentNode: null, onclick: null,
    onkeydown: null, dataset: {}, value: '', checked: false,
    appendChild: function (c) { c.parentNode = e; e.children.push(c); return c; },
    insertBefore: function (c) { c.parentNode = e; e.children.push(c); return c; },
    removeChild: function (c) { var i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; },
    setAttribute: function (k, v) { e.attrs[k] = v; },
    _listeners: {},
    addEventListener: function (type, fn) { (e._listeners[type] = e._listeners[type] || []).push(fn); },
    removeEventListener: function () {},
    focus: function () { e._focusCalls = (e._focusCalls || 0) + 1; },
    scrollIntoView: function (opts) { e._scrollCalls = (e._scrollCalls || []); e._scrollCalls.push(opts); },
    click: function () { if (e.onclick) e.onclick(); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(e.attrs, k) ? e.attrs[k] : null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  e.classList = {
    _set: {},
    add: function (c) { this._set[c] = true; },
    remove: function (c) { delete this._set[c]; },
    toggle: function (c, on) { if (on === undefined) { if (this._set[c]) delete this._set[c]; else this._set[c] = true; } else if (on) this._set[c] = true; else delete this._set[c]; },
    contains: function (c) { return !!this._set[c]; }
  };
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return ''; },
    set: function (v) { if (v === '') e.children = []; }
  });
  return e;
}
global.document = {
  createElement: makeStubEl,
  createTextNode: function (t) { return { textContent: t, nodeType: 3 }; },
  body: makeStubEl('body'),
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
  removeEventListener: function () {}
};

/* ---------- fake chordPack: renders by TOKEN, exposes a queryable label ----------
 * Mirrors what a real instrument profile's pack.diagram(name, size) does -
 * paints the canonical-sharp token it was asked for - so packDiagram's real
 * "relabel after render via querySelector('.chord-name, .nm')" seam runs for
 * real, proving the FIX (not a hand-simulated stand-in for it). */
function fakeChordPack() {
  return {
    hasChord: function () { return true; }, // every root/quality stays voiceable -> nothing dropped from CATS
    diagram: function (name, size) {
      var label = { textContent: name };
      return {
        tagName: 'div', className: size === 'big' ? 'bigC' : 'chord',
        _label: label,
        querySelector: function () { return label; },
        querySelectorAll: function () { return [label]; }
      };
    },
    playChord: function () {},
    playNote: function () {},
    playFreq: function () {}
  };
}

function mountForAllViewTest() {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    composeChords: makeStubEl('div'), suggest: makeStubEl('div'),
    keyRoots: makeStubEl('div'), keyModes: makeStubEl('div')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'allviewtest', el: elMap, chordPack: fakeChordPack() });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
// Picks F as the song key via the REAL key-picker root buttons (buildKeyPicker
// populates el.keyRoots at mount INIT, in Songbook.ROOTS order) - not a direct
// closure poke, so this exercises the same code path a real key pick does.
function pickKeyF(m) {
  var fIdx = Songbook.ROOTS.indexOf('F');
  assert.ok(fIdx >= 0, 'harness: F must exist in Songbook.ROOTS');
  m.elMap.keyRoots.children[fIdx].onclick(); // sets songKey.root='F' (mode stays default Major), rebuilds the grid
}
// Forces the "All" segment of the In-key|All toggle (Compose defaults to
// In-key once a key is set - D-DEFAULT-C/S-KEYPICKER-PREFERRED behavior).
function switchToAllView(m) {
  var seg = m.elMap.catChips.children[0]; // .chordSeg, appended fresh by the last buildGrid()
  seg.children[1].onclick(); // ['In key', 'All'] -> 'All'
}
function allViewTiles(m) { return m.elMap.buildGrid.children; }

test('Compose > All (non-chip tiles, key = F major): the A#-token tile respells to Bb, matching the In-key view', function () {
  var m = mountForAllViewTest();
  pickKeyF(m);
  switchToAllView(m);
  var tiles = allViewTiles(m);
  assert.strictEqual(tiles.length, 12, 'expected the full 12-root Major-quality All palette, got ' + tiles.length);
  var idx = Songbook.ROOTS.indexOf('A#');
  assert.ok(idx >= 0);
  assert.strictEqual(tiles[idx]._label.textContent, 'Bb',
    'the A#-token tile in Compose > All must show the key-aware Bb (the IV of F), not the raw canonical-sharp token');
});

test('Compose > All (non-chip tiles, key = F major): no tile leaks a raw sharp token - F major spells every degree with flats/naturals only', function () {
  var m = mountForAllViewTest();
  pickKeyF(m);
  switchToAllView(m);
  var tiles = allViewTiles(m);
  tiles.forEach(function (tile, i) {
    var shown = tile._label.textContent;
    assert.ok(shown.indexOf('#') === -1,
      'tile ' + i + ' (token ' + Songbook.ROOTS[i] + ') leaked a raw sharp (' + shown + ') into the key-F-major All view');
  });
});

test('Compose > In-key (baseline, unaffected by this fix): the same A#-token chord already shows Bb', function () {
  var m = mountForAllViewTest();
  pickKeyF(m); // lands on the In-key view by default once a key is picked
  var tiles = m.elMap.buildGrid.children;
  var shown = tiles.map(function (t) { return t._label.textContent; });
  assert.ok(shown.indexOf('Bb') >= 0, 'expected the In-key palette (F major) to include a Bb tile (the IV chord); got ' + JSON.stringify(shown));
  assert.ok(shown.indexOf('A#') === -1, 'the In-key palette must never leak the raw A# token; got ' + JSON.stringify(shown));
});

run();
