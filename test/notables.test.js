/* =====================================================================
 * notables.test.js  -  unit tests for the one-shot dismissible notable
 * infra: claim/dismiss persistence, single-slot priority arbitration,
 * corrupt-storage tolerance, and the renderBanner() dismiss wiring.
 * Run: node test/notables.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var lsReset = require('./helpers/local-storage-reset.js');
// compat shim over the shared helper's {clear, fakeStore} API: the callable
// shape these tests use (fresh global store per case, optional seed object).
function resetLocalStorage(seed) {
  global.localStorage = lsReset.fakeStore();
  if (seed) Object.keys(seed).forEach(function (k) { global.localStorage.setItem(k, seed[k]); });
}

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

/* ---- ~10-line document stub: just enough DOM for renderBanner() ---- */
function makeEl(tag) {
  var el = {
    tagName: tag, className: '', textContent: '', innerHTML: '',
    children: [], attrs: {}, onclick: null,
    appendChild: function (c) { el.children.push(c); return c; },
    setAttribute: function (k, v) { el.attrs[k] = v; }
  };
  return el;
}
global.document = { createElement: makeEl };

// Fresh require per test FILE run (run-all.js spawns one process per file),
// but the module instance is shared across every `test()` case below - so
// arbitration state (in-memory) and persisted state (localStorage) are each
// reset explicitly where a case needs isolation, via _resetArbitration()
// and resetLocalStorage() respectively.
var Notables = require('../music/shared/notables.js');

/* ---------- claim/dismiss round-trip ---------- */
test('claim() grants an empty slot; dismiss() persists it as shown, forever', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.isDismissed('firstrun'), false);
  assert.strictEqual(Notables.claim('firstrun'), true);
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.isDismissed('firstrun'), true);
  // a dismissed consumer can never claim again, even into an empty slot
  assert.strictEqual(Notables.claim('firstrun'), false);
});

/* ---------- double-fire prevention: only ONE grant per slot, ever ---------- */
test('double-fire prevention: two same-priority claims in a row -> only one grant', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  // two unlisted ids, explicit equal priority -> first-come keeps the slot;
  // the second must NOT also be granted true (that would be a double-fire).
  assert.strictEqual(Notables.claim('consumerA', 5), true);
  assert.strictEqual(Notables.claim('consumerB', 5), false);
  // re-claiming the SAME id that already holds the slot is idempotent, not
  // a second grant to a different thing
  assert.strictEqual(Notables.claim('consumerA', 5), true);
});

/* ---------- priority arbitration: firstrun > whynote > roman, call-order independent ---------- */
test('priority arbitration: a higher-priority claim preempts a lower one, regardless of call order', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);       // fills the empty slot
  assert.strictEqual(Notables.claim('whynote'), true);     // whynote outranks roman -> preempts
  assert.strictEqual(Notables.claim('roman'), false);      // roman still loses; whynote holds
  assert.strictEqual(Notables.claim('firstrun'), true);    // firstrun outranks whynote -> preempts
  assert.strictEqual(Notables.claim('whynote'), false);    // whynote now loses to firstrun
  assert.strictEqual(Notables.claim('roman'), false);      // roman never gets a look-in this round
});

test('release() frees a held slot so a previous loser can win on its next claim ("next tick")', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);
  assert.strictEqual(Notables.claim('firstrun'), true);   // preempts roman
  assert.strictEqual(Notables.claim('roman'), false);     // still loses while firstrun holds
  Notables.release('firstrun');
  assert.strictEqual(Notables.claim('roman'), true);      // slot freed -> roman's next claim wins
});

test('dismiss() also releases the slot if the dismissed consumer currently holds it', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun'), true);
  assert.strictEqual(Notables.claim('roman'), false);   // blocked while firstrun holds
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.claim('roman'), true);    // freed by the dismiss, roman now wins
});

/* ---------- corrupt-storage tolerance ---------- */
test('corrupt/foreign-shaped music.notables.v1 is tolerated, never thrown', function () {
  Notables._resetArbitration();
  ['not json at all', '[]', '42', 'null', '"just a string"'].forEach(function (bad) {
    resetLocalStorage({ 'music.notables.v1': bad });
    assert.doesNotThrow(function () {
      assert.strictEqual(Notables.isDismissed('firstrun'), false, 'corrupt shape ' + bad + ' must not read as dismissed');
      assert.strictEqual(Notables.claim('firstrun'), true, 'corrupt shape ' + bad + ' must not block claiming');
    });
    Notables._resetArbitration();
  });
});

test('a missing music.notables.v1 key (fresh device) reads as nothing dismissed', function () {
  resetLocalStorage(); // no seed at all
  assert.strictEqual(Notables.isDismissed('roman'), false);
});

/* ---------- show-once persistence survives a fresh module load ---------- */
test('show-once persists across a fresh require() of the module (simulated reload)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  Notables.claim('firstrun');
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.isDismissed('firstrun'), true);

  // Force a fresh module instance (fresh in-memory activeGrant) while
  // keeping the SAME localStorage fake, matching a real page reload where
  // the JS module is re-created but the browser's storage persists.
  delete require.cache[require.resolve('../music/shared/notables.js')];
  var ReloadedNotables = require('../music/shared/notables.js');
  assert.strictEqual(ReloadedNotables.isDismissed('firstrun'), true, 'dismissal survives reload via storage');
  assert.strictEqual(ReloadedNotables.claim('firstrun'), false, 'dismissed consumer never re-claims after reload');
  // a DIFFERENT, never-dismissed consumer can still claim on the fresh instance
  assert.strictEqual(ReloadedNotables.claim('roman'), true);
});

/* ---------- renderBanner() ---------- */
test('renderBanner() builds an accent-card element and wires the x to dismiss()', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  var dismissedArg = null;
  var el = Notables.renderBanner({
    consumerId: 'firstrun',
    text: 'Tap a song to open it',
    onDismiss: function (id) { dismissedArg = id; }
  });
  assert.ok(el, 'renderBanner should return an element when document is available');
  assert.strictEqual(el.className, 'notableBanner');
  assert.strictEqual(el.children.length, 2, 'body + dismiss button');
  var body = el.children[0], x = el.children[1];
  assert.strictEqual(body.className, 'notableBanner-body');
  assert.strictEqual(body.textContent, 'Tap a song to open it');
  assert.strictEqual(x.className, 'notableBanner-x');
  assert.strictEqual(x.attrs['aria-label'], 'Dismiss');
  assert.strictEqual(Notables.isDismissed('firstrun'), false);

  x.onclick(); // simulate the tap

  assert.strictEqual(Notables.isDismissed('firstrun'), true, 'tapping x dismisses the consumer');
  assert.strictEqual(dismissedArg, 'firstrun', 'onDismiss callback fired with the consumerId');
});

test('renderBanner() escapes plain text but trusts opts.html verbatim', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  var textEl = Notables.renderBanner({ consumerId: 'roman', text: '<b>x</b>' });
  assert.strictEqual(textEl.children[0].textContent, '<b>x</b>'); // textContent, not parsed as markup
  var htmlEl = Notables.renderBanner({ consumerId: 'whynote', html: '<b>x</b>' });
  assert.strictEqual(htmlEl.children[0].innerHTML, '<b>x</b>');
});

test('renderBanner() applies an extra className when given', function () {
  var el = Notables.renderBanner({ consumerId: 'firstrun', text: 'hi', className: 'extra' });
  assert.strictEqual(el.className, 'notableBanner extra');
});

/* ---------- PRIORITY table is exposed and in the expected order ---------- */
test('PRIORITY exposes the sprint order: firstrun > whynote > roman > diagrampref > backup', function () {
  assert.deepStrictEqual(Notables.PRIORITY, ['firstrun', 'whynote', 'roman', 'diagrampref', 'backup']);
});

/* ---------- S-BACKUP-NUDGE: 'backup' is the lowest priority, never preempts ---------- */
test('backup notable never preempts roman/whynote/firstrun/diagrampref, but wins an empty slot', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);
  assert.strictEqual(Notables.claim('backup'), false);   // roman still outranks backup
  Notables.release('roman');
  assert.strictEqual(Notables.claim('backup'), true);    // empty slot -> backup wins
  assert.strictEqual(Notables.claim('whynote'), true);   // whynote preempts backup
  assert.strictEqual(Notables.claim('backup'), false);
});

/* ---------- S-DIAGRAM-PREF: 'diagrampref' outranks 'backup' but loses to
 * 'roman'/'whynote'/'firstrun' - the spec's explicit ordering. ---------- */
test('diagrampref preempts backup but never roman/whynote/firstrun', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('backup'), true);        // empty slot -> backup wins
  assert.strictEqual(Notables.claim('diagrampref'), true);    // diagrampref preempts backup
  assert.strictEqual(Notables.claim('backup'), false);        // backup still loses while diagrampref holds
  assert.strictEqual(Notables.claim('roman'), true);          // roman preempts diagrampref
  assert.strictEqual(Notables.claim('diagrampref'), false);   // diagrampref now loses to roman
});
test('diagrampref, once dismissed, never claims again (one-shot, matches every other notable)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('diagrampref'), true);
  Notables.dismiss('diagrampref');
  assert.strictEqual(Notables.isDismissed('diagrampref'), true);
  assert.strictEqual(Notables.claim('diagrampref'), false);
});

run();
