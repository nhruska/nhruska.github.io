/* =====================================================================
 * nav-history-solo.test.js  -  S-NAVHIST regression suite (PR #144 finding).
 * ---------------------------------------------------------------------
 * PR #144's Playwright suite surfaced a real, reproducible bug in
 * songbook.js's #soloBackingBtn "Solo over it" flow: dismissing the inline
 * save/skip choice row synchronously opened a NEW NavHistory layer (the
 * Studio, or the save-name row) from WITHIN nav-history.js's popstate
 * `while` loop (via NavHistory.dismiss() -> history.back() -> popstate),
 * instead of via NavHistory.settleAfter() - the function nav-history.js's
 * own doc comment says exists exactly for "closing one layer opens
 * another". The while-loop's `stack.length` recheck saw the nested push
 * and erroneously double-popped, closing the just-opened layer immediately
 * (Studio/name-row "flashes open then closes").
 *
 * These tests load the REAL nav-history.js (not a stub) against a minimal
 * fake browser `history` (pushState/replaceState/back synchronously
 * dispatching 'popstate', matching the mechanics that matter here - see
 * makeFakeHistory() below) and the REAL songbook.js Songbook.mount(), so
 * the fix is proven against the actual production wiring, not a mock of it.
 *
 * NavHistory is a require-time singleton (module-level closure state), so
 * each test gets a FRESH nav-history.js module instance + a fresh fake
 * history via resetNav() - without this, stack state leaks across tests.
 *
 * Run: node test/nav-history-solo.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
require('../music/shared/list-item.js');
require('../music/shared/toast.js');
var Songbook = require('../music/shared/songbook.js');
require('../music/shared/circle.js');
require('../music/shared/repertoire.js');
require('../music/shared/solo-guide.js');
require('../music/shared/queue.js'); // sets global.Queue - mount()'s QUEUE = global.Queue.createQueue()
var lsReset = require('./helpers/local-storage-reset.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { resetNav(); c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- fake browser history: synchronous popstate dispatch ----------
 * Real browsers fire popstate asynchronously; this bug's mechanism (a
 * NavHistory.open() call made from WITHIN the popstate handler's own
 * synchronous `while` loop) doesn't depend on that timing, so a synchronous
 * dispatch is a faithful, simpler model for these mechanics specifically. */
function makeFakeHistory() {
  var entries = [null];
  var idx = 0;
  var listeners = [];
  global.history = {
    pushState: function (state) { entries = entries.slice(0, idx + 1); entries.push(state); idx = entries.length - 1; },
    replaceState: function (state) { entries[idx] = state; },
    back: function () {
      if (idx <= 0) return;
      idx--;
      var ev = { state: entries[idx] };
      listeners.slice().forEach(function (fn) { fn(ev); });
    }
  };
  global.addEventListener = function (type, fn) { if (type === 'popstate') listeners.push(fn); };
  global.removeEventListener = function () {};
}
var NAV_HISTORY_PATH = require.resolve('../music/shared/nav-history.js');
function resetNav() {
  makeFakeHistory();
  delete require.cache[NAV_HISTORY_PATH];
  delete global.NavHistory;
  require(NAV_HISTORY_PATH); // re-runs the IIFE -> fresh `stack`/`rooted` closure
}

// Deterministic fake clock (mirrors test/toast.test.js's withFakeClock) - needed
// to flush the residual hardware/gesture-Back fallback's setTimeout(fn, 0) defer.
function withFakeClock(fn) {
  var nextId = 1, scheduled = {};
  var realSetTimeout = global.setTimeout;
  global.setTimeout = function (cb) { var id = nextId++; scheduled[id] = cb; return id; };
  try {
    fn({
      fire: function (id) { var cb = scheduled[id]; delete scheduled[id]; if (cb) cb(); },
      pendingIds: function () { return Object.keys(scheduled); }
    });
  } finally {
    global.setTimeout = realSetTimeout;
  }
}

/* ---------- minimal DOM stub (mirrors songbook.test.js's makeStubEl) ---------- */
function makeStubEl(tag) {
  var e = {
    tagName: tag, children: [], className: '', textContent: '', hidden: false,
    disabled: false, attrs: {}, style: {}, parentNode: null, onclick: null,
    onkeydown: null, dataset: {}, value: '', checked: false,
    appendChild: function (c) { c.parentNode = e; e.children.push(c); return c; },
    insertBefore: function (c) { c.parentNode = e; e.children.push(c); return c; },
    removeChild: function (c) { var i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; },
    setAttribute: function (k, v) { e.attrs[k] = v; },
    addEventListener: function () {},
    focus: function () { e._focusCalls = (e._focusCalls || 0) + 1; },
    scrollIntoView: function () {},
    click: function () { if (e.onclick) e.onclick(); }
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
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: makeStubEl,
    createTextNode: function (t) { return { textContent: t, nodeType: 3 }; },
    body: makeStubEl('body'),
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
}

function mountForSoloChoiceTests(openStudioSpy) {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    cSave: makeStubEl('button'), composeChords: makeStubEl('div'), suggest: makeStubEl('div'),
    soloBackingBtn: makeStubEl('button')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'navhisttest', el: elMap, openStudio: openStudioSpy });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
function findComposeRow(m) {
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  return row;
}
function findComposeBackdrop(m) {
  var bd = null;
  m.wrapper.children.forEach(function (c) { if (c.className === 'composeModalBackdrop') bd = c; });
  return bd;
}
function startSoloChoice(m) {
  var startRow = m.elMap.suggest.children[1];
  startRow.children[0].onclick();
  m.elMap.soloBackingBtn.onclick();
}
// A faithful stand-in for tracks.js's REAL openStudio(t): it too calls
// NavHistory.open('studio', closePlayer) synchronously (see tracks.js:1000) -
// the exact "opens a new layer" consequence this bug class is about. Tracks
// whether the Studio is open and how many times its close fn fired (>1 would
// mean a residual double-pop).
function makeOpenStudioSpy(picks, studio) {
  studio.open = false; studio.closeCalls = 0;
  return function (target) {
    picks.push(target);
    studio.open = true;
    if (global.NavHistory) {
      global.NavHistory.open('studio', function () { studio.open = false; studio.closeCalls++; });
    }
  };
}

/* ================= Skip path - the literally-reported bug ================= */

test('S-NAVHIST: Skip on a never-saved progression opens the Studio and does NOT double-pop it shut', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  startSoloChoice(m);
  var depthAtChoice = global.NavHistory.depth();
  assert.ok(depthAtChoice >= 1, 'the choice row must have registered a NavHistory layer');
  var btnRow = findComposeRow(m).children[1]; // [msg, btnRow]
  btnRow.children[1].onclick(); // Skip
  assert.strictEqual(picks.length, 1, 'Skip must open the Studio exactly once');
  assert.strictEqual(picks[0].title, 'Solo practice');
  assert.strictEqual(studio.open, true, 'the Studio must still be open after Skip settles (PR #144: it double-popped shut immediately)');
  assert.strictEqual(studio.closeCalls, 0, 'the Studio close fn must not have fired at all yet');
  assert.strictEqual(global.NavHistory.depth(), depthAtChoice, 'Skip REPLACES the choice-row history slot with the Studio - same depth, not stacked or collapsed');
});

test('S-NAVHIST: one NavHistory.dismiss() after Skip closes the Studio and lands back at the pre-solo depth (no double-pop residue)', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  var depth0 = global.NavHistory.depth();
  startSoloChoice(m);
  findComposeRow(m).children[1].children[1].onclick(); // Skip -> Studio open
  assert.strictEqual(studio.open, true);
  global.NavHistory.dismiss(); // one back-press (matches the Studio's own close button)
  assert.strictEqual(studio.open, false, 'the Studio must close on this back-press');
  assert.strictEqual(studio.closeCalls, 1, 'the Studio close fn must fire EXACTLY once (a residual double-pop would fire it again on a later, unrelated event)');
  assert.strictEqual(global.NavHistory.depth(), depth0, 'one back-press must land exactly where the user expects - the depth before the solo-choice flow ever started');
});

test('S-NAVHIST: backdrop tap resolves to Skip via the same non-buggy settleAfter path', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  startSoloChoice(m);
  findComposeBackdrop(m).onclick();
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(picks[0].title, 'Solo practice');
  assert.strictEqual(studio.open, true, 'backdrop-dismiss must not double-pop the Studio shut either');
});

test('S-NAVHIST: Escape resolves to Skip via the same non-buggy settleAfter path', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  startSoloChoice(m);
  findComposeRow(m).onkeydown({ key: 'Escape' });
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(studio.open, true);
});

test('S-NAVHIST: a genuine hardware/gesture Back (bypassing every button/backdrop/Escape handler) still resolves to Skip without a double-pop', function () {
  withFakeClock(function (clock) {
    var picks = [], studio = {};
    var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
    startSoloChoice(m);
    var depthAtChoice = global.NavHistory.depth();
    // Simulate a REAL hardware/gesture Back: fire history.back() directly - no
    // songbook.js handler runs first. Only the closeFn registered via
    // NavHistory.open() can react, and it runs from INSIDE nav-history.js's
    // popstate `while` loop.
    global.history.back();
    assert.strictEqual(picks.length, 0, 'onPick must be deferred, never fired synchronously from inside the popstate loop');
    assert.strictEqual(clock.pendingIds().length, 1, 'expected exactly one deferred (setTimeout) callback');
    clock.fire(clock.pendingIds()[0]);
    assert.strictEqual(picks.length, 1, 'the deferred callback must fire exactly once, after the popstate handler fully unwound');
    assert.strictEqual(studio.open, true, 'the Studio must be open, not double-popped shut');
    assert.strictEqual(global.NavHistory.depth(), depthAtChoice, 'must land at the same depth the choice row occupied (in-place replace)');
  });
});

/* ============ Save path - adjacent bug found while fixing S-NAVHIST ============
 * "Save & open Studio" on a never-saved progression chains straight into
 * openSaveNameRow, reusing the SAME composeRow container. The identical
 * dismiss()-inside-a-popstate-loop mechanics applied here too (one layer
 * earlier): the name-entry row itself flashed open then closed, before the
 * user could ever type a name. */

test('S-NAVHIST (adjacent): "Save & open Studio" opens the name-entry row and does NOT double-pop it shut', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  startSoloChoice(m);
  var depthAtChoice = global.NavHistory.depth();
  findComposeRow(m).children[1].children[0].onclick(); // 'Save & open Studio'
  assert.strictEqual(picks.length, 0, 'Save must open the NAME row first, not the Studio directly');
  var nameRow = findComposeRow(m);
  assert.ok(nameRow, 'the name-entry row must be present (PR #144-class bug: it flashed open then closed)');
  assert.ok(nameRow.classList.contains('asModal'), 'the name-entry row must still be open, presenting as a modal');
  assert.strictEqual(nameRow.children.length, 4, 'expected [input, setLabel, saveBtn, cancelBtn] to have actually rendered and survived');
  assert.strictEqual(global.NavHistory.depth(), depthAtChoice, 'Save REPLACES the choice-row slot with the name row - same depth, not stacked or collapsed');
});

test('S-NAVHIST (adjacent): confirming Save in the name row opens the Studio and does NOT double-pop it shut', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  startSoloChoice(m);
  var depthAtChoice = global.NavHistory.depth();
  findComposeRow(m).children[1].children[0].onclick(); // 'Save & open Studio' -> name row
  var nameRow = findComposeRow(m);
  nameRow.children[2].onclick(); // [input, setLabel, saveBtn, cancelBtn] - saveBtn
  assert.strictEqual(picks.length, 1, 'confirming Save must open the Studio for the newly-saved song');
  assert.strictEqual(picks[0].custom, true);
  assert.strictEqual(studio.open, true, 'the Studio must still be open (not double-popped shut)');
  assert.strictEqual(global.NavHistory.depth(), depthAtChoice, 'the name row REPLACES its own slot with the Studio - same depth');
});

test('S-NAVHIST (adjacent): Cancel in the name row still uses plain dismiss() - never opens a layer, unaffected by the settleAfter change', function () {
  var picks = [], studio = {};
  var m = mountForSoloChoiceTests(makeOpenStudioSpy(picks, studio));
  var depth0 = global.NavHistory.depth();
  startSoloChoice(m);
  findComposeRow(m).children[1].children[0].onclick(); // 'Save & open Studio' -> name row
  var nameRow = findComposeRow(m);
  nameRow.children[3].onclick(); // cancelBtn
  assert.strictEqual(picks.length, 0, 'Cancel must never open the Studio');
  assert.strictEqual(studio.open, false);
  assert.strictEqual(global.NavHistory.depth(), depth0, 'Cancel must fully unwind back to the pre-solo-choice depth');
});

run();
