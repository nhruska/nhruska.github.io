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
  // firstrun is M-GUIDANCE level-gated to 'beginner' - pass a matching level.
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true);
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.isDismissed('firstrun'), true);
  // a dismissed consumer can never claim again, even into an empty slot
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), false);
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
  assert.strictEqual(Notables.claim('whynote', undefined, 'intermediate'), true);     // whynote outranks roman -> preempts
  assert.strictEqual(Notables.claim('roman'), false);      // roman still loses; whynote holds
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true);    // firstrun outranks whynote -> preempts
  assert.strictEqual(Notables.claim('whynote', undefined, 'intermediate'), false);    // whynote now loses to firstrun
  assert.strictEqual(Notables.claim('roman'), false);      // roman never gets a look-in this round
});

test('release() frees a held slot so a previous loser can win on its next claim ("next tick")', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true);   // preempts roman
  assert.strictEqual(Notables.claim('roman'), false);     // still loses while firstrun holds
  Notables.release('firstrun');
  assert.strictEqual(Notables.claim('roman'), true);      // slot freed -> roman's next claim wins
});

test('dismiss() also releases the slot if the dismissed consumer currently holds it', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true);
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
      assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true, 'corrupt shape ' + bad + ' must not block claiming');
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
  Notables.claim('firstrun', undefined, 'beginner');
  Notables.dismiss('firstrun');
  assert.strictEqual(Notables.isDismissed('firstrun'), true);

  // Force a fresh module instance (fresh in-memory activeGrant) while
  // keeping the SAME localStorage fake, matching a real page reload where
  // the JS module is re-created but the browser's storage persists.
  delete require.cache[require.resolve('../music/shared/notables.js')];
  var ReloadedNotables = require('../music/shared/notables.js');
  assert.strictEqual(ReloadedNotables.isDismissed('firstrun'), true, 'dismissal survives reload via storage');
  assert.strictEqual(ReloadedNotables.claim('firstrun', undefined, 'beginner'), false, 'dismissed consumer never re-claims after reload');
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
test('PRIORITY exposes the M-GUIDANCE order: guidanceask first, then the graded journey, pre-existing 5 unchanged relative order', function () {
  assert.deepStrictEqual(Notables.PRIORITY, [
    'guidanceask',
    // 'chordtap' (P3 UAT, PR #300): the tap-to-hear cue outranks the
    // setlist/save nudges but sits behind the fresh-profile 'firstrun' greeting.
    'firstrun', 'chordtap', 'tunefirst', 'savebasics',
    // S-PERSONA-COPY: studiofirst (beginner Studio orientation) sits beside its
    // studio siblings; disjoint LEVELS gate means it never actually contests them.
    'postprog', 'studiofirst', 'whynote', 'composeintro', 'pulljam', 'transposetip', 'scaletip',
    'roman', 'diagrampref', 'backup'
  ]);
});

/* ---------- S-BACKUP-NUDGE: 'backup' is the lowest priority, never preempts ---------- */
test('backup notable never preempts roman/whynote/firstrun/diagrampref, but wins an empty slot', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);
  assert.strictEqual(Notables.claim('backup'), false);   // roman still outranks backup
  Notables.release('roman');
  assert.strictEqual(Notables.claim('backup'), true);    // empty slot -> backup wins
  assert.strictEqual(Notables.claim('whynote', undefined, 'advanced'), true);   // whynote preempts backup
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

/* ---------------------------------------------------------------------
 * M-GUIDANCE (docs/plans/guidance-levels-spec-20260705.md): the LEVELS
 * gate on claim(consumerId, priority, level).
 * ------------------------------------------------------------------- */

test('LEVELS exposes the graded registry: firstrun/tunefirst/savebasics -> beginner; whynote -> intermediate+advanced; composeintro/transposetip -> intermediate; scaletip -> advanced', function () {
  assert.deepStrictEqual(Notables.LEVELS, {
    firstrun: ['beginner'],
    postprog: ['beginner'],
    studiofirst: ['beginner'],
    tunefirst: ['beginner'],
    savebasics: ['beginner'],
    whynote: ['intermediate', 'advanced'],
    composeintro: ['intermediate'],
    pulljam: ['intermediate'], // slice 2: the P5 pull-a-progression-into-a-section cue
    transposetip: ['intermediate'],
    scaletip: ['advanced']
  });
});

test('a level-gated consumer only grants when the passed level is a declared member', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('tunefirst', undefined, 'intermediate'), false, 'tunefirst is beginner-only');
  assert.strictEqual(Notables.claim('tunefirst', undefined, 'advanced'), false, 'tunefirst is beginner-only');
  assert.strictEqual(Notables.claim('tunefirst', undefined, 'beginner'), true, 'tunefirst grants for its declared level');
});

test('an omitted/null/undefined level never matches a declared array - "unset level: only the ask may show"', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun'), false, 'no 3rd arg at all -> level is undefined -> blocked');
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun', undefined, null), false, 'explicit null level -> blocked');
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun', undefined, undefined), false, 'explicit undefined level -> blocked');
  // an UNRESTRICTED consumer (not in LEVELS) is unaffected by an unset level -
  // this is exactly what lets 'guidanceask' show while nothing else can.
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('guidanceask'), true, 'guidanceask has no declared levels - always eligible on priority alone');
});

test('whynote (intermediate+advanced) is blocked for beginner and unset, granted for either declared level', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('whynote', undefined, 'beginner'), false);
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('whynote'), false); // unset
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('whynote', undefined, 'intermediate'), true);
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('whynote', undefined, 'advanced'), true);
});

test('dismissed-stays-dismissed holds regardless of a later level change (level gate is checked AFTER the dismissed short-circuit)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('scaletip', undefined, 'advanced'), true);
  Notables.dismiss('scaletip');
  assert.strictEqual(Notables.isDismissed('scaletip'), true);
  // even the correct declared level can never re-claim once dismissed
  assert.strictEqual(Notables.claim('scaletip', undefined, 'advanced'), false);
});

test('guidanceask outranks firstrun - wins the empty slot on a truly fresh profile even though firstrun would also be eligible', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('guidanceask'), true, 'guidanceask claims the empty slot first');
  // firstrun (even with its matching level) cannot preempt - guidanceask outranks it
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), false);
  Notables.dismiss('guidanceask');
  // slot freed by the dismiss -> firstrun can now claim it
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true);
});

/* ---------- S-NOTABLE-PREEMPT-TEARDOWN: a preempting claim removes the
 * ousted holder's rendered banner (the two-cards-on-screen bug, operator
 * pixels 2026-07-10). ---------- */
test('preempting claim() tears down the ousted holder\'s rendered banner', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  // low-priority holder claims the slot and renders (roman is lower than firstrun)
  assert.strictEqual(Notables.claim('roman'), true, 'roman claims the empty slot');
  var slot = makeEl('div');
  slot.removeChild = function (c) {
    var i = slot.children.indexOf(c);
    if (i >= 0) slot.children.splice(i, 1);
  };
  var banner = Notables.renderBanner({ consumerId: 'roman', text: 'why this chord' });
  slot.appendChild(banner);
  banner.parentNode = slot;
  assert.strictEqual(slot.children.length, 1, 'ousted-to-be banner is on screen');
  // higher-priority consumer preempts (guidanceask outranks roman)
  assert.strictEqual(Notables.claim('guidanceask'), true, 'higher priority preempts');
  assert.strictEqual(slot.children.length, 0,
    'preempted banner must be TORN DOWN - one tip at a time, visually too');
});

test('dismiss via the x unregisters the live element (no stale teardown target)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('roman'), true);
  var slot = makeEl('div');
  slot.removeChild = function (c) {
    var i = slot.children.indexOf(c);
    if (i >= 0) slot.children.splice(i, 1);
  };
  var banner = Notables.renderBanner({ consumerId: 'roman', text: 'x' });
  slot.appendChild(banner);
  banner.parentNode = slot;
  var xBtn = banner.children[banner.children.length - 1];
  xBtn.onclick(); // user dismisses; caller normally removes the element itself
  slot.children.length = 0; // simulate the caller's removal
  // a later preemption cycle must not throw or double-remove
  assert.strictEqual(Notables.claim('guidanceask'), true);
});

/* ---- S-GUIDANCE-CALM (operator interview 2026-07-19): one tip per SESSION.
 * The whack-a-mole finding: dismissing a tip let the next one claim on the
 * user's return to a tab. With a sessionStorage present (stubbed here, real
 * in the browser), at most ONE consumerId ever holds the slot per session -
 * dismissal frees nothing until the next session. Node has no sessionStorage,
 * so every pre-existing case above runs with the gate off (unchanged). */

function stubSessionStorage() {
  var m = {};
  global.sessionStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
}
function unstubSessionStorage() { delete global.sessionStorage; }

test('session gate: after the session holder is DISMISSED, no other tip can claim this session', function () {
  stubSessionStorage();
  try {
    resetLocalStorage();
    Notables._resetArbitration();
    assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true, 'first tip of the session claims normally');
    Notables.dismiss('firstrun');
    assert.strictEqual(Notables.claim('tunefirst', undefined, 'beginner'), false, 'dismissing never reveals another tip until the next session');
    assert.strictEqual(Notables.claim('backup'), false, 'unrestricted consumers are session-gated too');
  } finally { unstubSessionStorage(); }
});

test('session gate: the session holder itself may re-claim (banner re-renders on tab return until dismissed)', function () {
  stubSessionStorage();
  try {
    resetLocalStorage();
    Notables._resetArbitration();
    assert.strictEqual(Notables.claim('tunefirst', undefined, 'beginner'), true);
    Notables.release('tunefirst'); // left the tab without acting
    assert.strictEqual(Notables.claim('tunefirst', undefined, 'beginner'), true, 'the same consumer re-claims freely within its session');
    assert.strictEqual(Notables.claim('backup'), false, 'but a different consumer cannot take the released slot this session');
  } finally { unstubSessionStorage(); }
});

test('session gate: a strictly-higher-priority claim still preempts a LIVE holder and takes over the session record', function () {
  stubSessionStorage();
  try {
    resetLocalStorage();
    Notables._resetArbitration();
    assert.strictEqual(Notables.claim('backup'), true, 'low-priority tip grabs the empty slot at boot');
    assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true, 'the boot-race preemption the priority table exists for still works');
    Notables.release('firstrun');
    assert.strictEqual(Notables.claim('backup'), false, 'the ousted consumer cannot come back this session');
  } finally { unstubSessionStorage(); }
});

test('session gate: a NEW session (cleared sessionStorage) lets the next tip show', function () {
  stubSessionStorage();
  try {
    resetLocalStorage();
    Notables._resetArbitration();
    assert.strictEqual(Notables.claim('scaletip', undefined, 'advanced'), true);
    Notables.dismiss('scaletip');
    assert.strictEqual(Notables.claim('whynote', undefined, 'advanced'), false, 'blocked in the same session');
    Notables._resetArbitration(); // clears the session record - models the next app open
    assert.strictEqual(Notables.claim('whynote', undefined, 'advanced'), true, 'next session, next tip');
  } finally { unstubSessionStorage(); }
});

test('the new journey tips (tunefirst/savebasics/composeintro/transposetip/scaletip) preserve the pre-existing relative order of firstrun/whynote/roman/diagrampref/backup', function () {
  var p = Notables.PRIORITY;
  var idx = {};
  p.forEach(function (id, i) { idx[id] = i; });
  assert.ok(idx.firstrun < idx.whynote, 'firstrun still outranks whynote');
  assert.ok(idx.whynote < idx.roman, 'whynote still outranks roman');
  assert.ok(idx.roman < idx.diagrampref, 'roman still outranks diagrampref');
  assert.ok(idx.diagrampref < idx.backup, 'diagrampref still outranks backup');
  assert.ok(idx.guidanceask < idx.firstrun, 'guidanceask outranks everything else');
});

run();
