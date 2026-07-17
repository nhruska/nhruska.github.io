/* =====================================================================
 * chord-collapse.test.js  -  unit tests for shared/chord-collapse.js
 * (S-CHORD-COLLAPSE: advanced-level compact chord chips).
 * active(): true ONLY for GuidanceLevel.get() === 'advanced' - beginner /
 * intermediate / unset / corrupt / module-absent all read false (the
 * non-advanced INVERSE is the load-bearing half: a false positive would
 * collapse a beginner's diagrams).
 * chip(): the suggChip/scName/scRn compact-token DOM shape, built via
 * createElement + textContent (never innerHTML - the XSS guard for
 * freeform custom-song chord tokens).
 * Run: node test/chord-collapse.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

/* ---- just enough DOM for chip(): createElement + appendChild + textContent.
 * Setting innerHTML THROWS - proving the primitive can never take the
 * injection-prone path (same discipline the sheet renderer tests enforce). */
global.document = {
  createElement: function (tag) {
    var el = {
      tagName: tag, className: '', type: '', children: [], _text: '',
      appendChild: function (c) { el.children.push(c); return c; }
    };
    Object.defineProperty(el, 'textContent', {
      get: function () { return el._text; },
      set: function (v) { el._text = String(v); }
    });
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return ''; },
      set: function () { throw new Error('chip() must never use innerHTML (XSS guard)'); }
    });
    return el;
  }
};

// Alias window to the real global BEFORE requiring, so the module's IIFE
// lands where the tests can swap GuidanceLevel per case (same pattern as
// test/diagram.dom.test.js).
if (typeof global.window === 'undefined') global.window = global;
var CC = require('../music/shared/chord-collapse.js');

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

function withLevel(value, fn) {
  var prev = global.GuidanceLevel;
  global.GuidanceLevel = value;
  try { fn(); } finally { global.GuidanceLevel = prev; }
}
function levelStub(v) { return { get: function () { return v; } }; }

/* ---------- active(): the decision layer ---------- */
test('active() is true ONLY for advanced', function () {
  withLevel(levelStub('advanced'), function () { assert.strictEqual(CC.active(), true); });
});
test('active() is false for beginner and intermediate (full diagrams unchanged)', function () {
  withLevel(levelStub('beginner'), function () { assert.strictEqual(CC.active(), false); });
  withLevel(levelStub('intermediate'), function () { assert.strictEqual(CC.active(), false); });
});
test('active() is false for the unset level (null = ask pending - never guess)', function () {
  withLevel(levelStub(null), function () { assert.strictEqual(CC.active(), false); });
});
test('active() is false when GuidanceLevel is absent or malformed (lazy optional lookup degrades, never throws)', function () {
  withLevel(undefined, function () { assert.strictEqual(CC.active(), false); });
  withLevel({}, function () { assert.strictEqual(CC.active(), false); });
  withLevel({ get: 'not-a-function' }, function () { assert.strictEqual(CC.active(), false); });
});
test('active() is false when get() throws (defensive read, matches every other reader in the app)', function () {
  withLevel({ get: function () { throw new Error('storage blocked'); } }, function () {
    assert.strictEqual(CC.active(), false);
  });
});

/* ---------- active() through the REAL GuidanceLevel module ----------
 * (Volley 1 Medium #4): the truth-table above stubs GuidanceLevel; this
 * block wires the ACTUAL music/shared/guidance-level.js reader over a
 * fake localStorage, so the real chain a browser executes - stored key
 * -> GuidanceLevel.get() -> ChordCollapse.active() - is what's guarded,
 * not a hand-rolled stand-in. */
var lsReset = require('./helpers/local-storage-reset.js');
var RealGuidance = require('../music/shared/guidance-level.js');
function withStoredLevel(stored, fn) {
  var prevLS = global.localStorage, prevGL = global.GuidanceLevel;
  global.localStorage = lsReset.fakeStore(
    stored === undefined ? null : { 'music.guidanceLevel.v1': stored });
  global.GuidanceLevel = RealGuidance;
  try { fn(); } finally { global.localStorage = prevLS; global.GuidanceLevel = prevGL; }
}
test('REAL chain: stored advanced -> GuidanceLevel.get() -> active() true', function () {
  withStoredLevel('advanced', function () { assert.strictEqual(CC.active(), true); });
});
test('REAL chain: stored beginner/intermediate -> active() false', function () {
  withStoredLevel('beginner', function () { assert.strictEqual(CC.active(), false); });
  withStoredLevel('intermediate', function () { assert.strictEqual(CC.active(), false); });
});
test('REAL chain: no stored key (ask pending) and a corrupt value both read false', function () {
  withStoredLevel(undefined, function () { assert.strictEqual(CC.active(), false); });
  withStoredLevel('expert', function () { assert.strictEqual(CC.active(), false); });
});

/* ---------- chip(): the compact token DOM shape ---------- */
test('chip() builds the suggChip token: button + scName + scRn', function () {
  var b = CC.chip({ chord: 'Dm', roman: 'ii' });
  assert.strictEqual(b.tagName, 'button');
  assert.strictEqual(b.type, 'button');
  assert.strictEqual(b.className, 'suggChip ccChip');
  assert.strictEqual(b.children.length, 2);
  assert.strictEqual(b.children[0].className, 'scName');
  assert.strictEqual(b.children[0].textContent, 'Dm');
  assert.strictEqual(b.children[1].className, 'scRn');
  assert.strictEqual(b.children[1].textContent, 'ii');
});
test('chip() omits the roman span when roman is falsy - honest letter-only token (no key context)', function () {
  var b = CC.chip({ chord: 'C#' });
  assert.strictEqual(b.children.length, 1);
  assert.strictEqual(b.children[0].textContent, 'C#');
  var b2 = CC.chip({ chord: 'F', roman: '' });
  assert.strictEqual(b2.children.length, 1);
});
test('chip() prefers the enharmonic display name for the label, keeps it text-only', function () {
  var b = CC.chip({ chord: 'A#', display: 'Bb', roman: 'IV' });
  assert.strictEqual(b.children[0].textContent, 'Bb');
});
test('chip() renders a hostile chord token inert (textContent path - the innerHTML stub would throw)', function () {
  var evil = '<img src=x onerror=alert(1)>';
  var b = CC.chip({ chord: evil });
  assert.strictEqual(b.children[0].textContent, evil); // stored as TEXT, markup never parsed
});
test('chip({}) and chip() degrade to an empty-label token, never throw', function () {
  assert.strictEqual(CC.chip({}).children[0].textContent, '');
  assert.strictEqual(CC.chip().children[0].textContent, '');
});

run();
