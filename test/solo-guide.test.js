/* =====================================================================
 * solo-guide.test.js  -  unit tests for M-GUIDE W3a's SoloGuide module
 * (music/shared/solo-guide.js): the locked seam contract (framing/cards/
 * card), the {i}-index interpolation, the P5 seasoned-player adversarial
 * fold (2026-07-05, supersedes the section-8B professor-fold corrections
 * wherever both touched the same block), the copy budget (block <=90
 * chars, card <=70 words) + tells-clean punctuation lint per
 * m-guide-ia-20260704.md section 3, and S-REL-NAMES (U23, 2026-07-05) - the
 * optional 3rd `root` arg on framing()/card() that names the concrete
 * relative-key instance ({relMinor}/{relMajor} tokens), backed by the pure
 * relNames() resolver (a thin pass-through onto Circle.relativeMinor/
 * relativeMajor - see decisions.md D-REL-NAMES).
 *
 * Run: node test/solo-guide.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Circle = require('../music/shared/circle.js');
var SoloGuide = require('../music/shared/solo-guide.js');

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

var SCALE_KEYS = ['ionian', 'aeolian', 'dorian', 'mixolydian', 'pentMajor', 'pentMinor', 'blues'];
var BLOCKS = ['chooseWhen', 'resolveTo', 'hangOn', 'startEnd', 'shapes'];

/* ---------- framing() - moved verbatim from tracks.js, behavior identical ---------- */
test('framing: pent scales interpolate family; blues has its own fixed line; mode has none', function () {
  // P5 fold (2026-07-05): "two frets down" was a factual error (relative minor
  // is a minor 3rd = THREE frets below) - fixed here to match the identical
  // correction in cards.pentMajor.shapes. S-REL-NAMES (U23, 2026-07-05): the
  // no-root (2-arg) call now falls back to "the relative minor pent" - a
  // one-word tweak from the prior "its relative minor pent" (normalizes to the
  // SAME fallback wording the shapes card below always used) - the
  // relationship/claim itself (three frets lower) is unchanged.
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major'),
    'The inside sound over major and dominant vamps - same shape as the relative minor pent, three frets lower; keep the root as home.');
  assert.strictEqual(SoloGuide.framing('pentMinor', 'minor'),
    'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.');
  assert.strictEqual(SoloGuide.framing('blues'),
    'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.');
  assert.strictEqual(SoloGuide.framing('mode'), null);
});

/* ---------- S-REL-NAMES (U23): framing() names the instance when a root is given ---------- */
test('framing: pentMajor + a root NAMES the relative minor instance ({relMinor} resolves)', function () {
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major', 'F'),
    'The inside sound over major and dominant vamps - same shape as D minor pent, three frets lower; keep the root as home.');
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major', 'A'),
    'The inside sound over major and dominant vamps - same shape as F# minor pent, three frets lower; keep the root as home.');
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major', 'C'),
    'The inside sound over major and dominant vamps - same shape as A minor pent, three frets lower; keep the root as home.');
});
test('framing: a root that has no {relMinor}/{relMajor} token in play (pentMinor/blues) is a no-op - same text with or without root', function () {
  assert.strictEqual(SoloGuide.framing('pentMinor', 'minor', 'F'), SoloGuide.framing('pentMinor', 'minor'));
  assert.strictEqual(SoloGuide.framing('blues', null, 'F'), SoloGuide.framing('blues'));
});
test('framing: an unresolvable root degrades to the same relationship-only fallback as no root at all', function () {
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major', 'nonsense'), SoloGuide.framing('pentMajor', 'major'));
});

/* ---------- cards - the raw table, read-only ---------- */
test('cards: exposes the raw SOLO_GUIDE table with all 7 keys x 5 blocks', function () {
  assert.strictEqual(Object.keys(SoloGuide.cards).length, 7);
  SCALE_KEYS.forEach(function (key) {
    var c = SoloGuide.cards[key];
    assert.ok(c, 'missing card for ' + key);
    BLOCKS.forEach(function (b) { assert.strictEqual(typeof c[b], 'string', key + '.' + b + ' must be a string'); });
  });
});

/* ---------- card() - interpolation + unknown-key safety ---------- */
test('card: unknown scaleKey -> null (safe; never throws)', function () {
  assert.strictEqual(SoloGuide.card('nonsense', ['A', 'B']), null);
  assert.strictEqual(SoloGuide.card('mode', []), null); // 'mode' is a chip id, not a SoloGuide key
});
test('card: {i} placeholders interpolate the caller-supplied note names, by index', function () {
  var notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B']; // C ionian
  var c = SoloGuide.card('ionian', notes);
  assert.strictEqual(c.resolveTo, "On I, land on C, E, or G; elsewhere, land on that chord's root or 3rd.");
  assert.strictEqual(c.hangOn, 'Over I, F wants to resolve to E unless you mean sus; A is the major-6 color.');
  assert.strictEqual(c.startEnd, 'Start on E or G; close on a chord tone, not automatically C.');
});
test('card: pentMajor index mapping is correct against its degree array (1 2 3 5 6) - P5\'s "1/3/5 land" claim', function () {
  var notes = Circle.soloScale('A', 'pentMajor'); // ['A','B','C#','E','F#'] = degrees 1,2,3,5,6
  assert.deepStrictEqual(notes, ['A', 'B', 'C#', 'E', 'F#']);
  var c = SoloGuide.card('pentMajor', notes);
  // {0}=degree1(A), {2}=degree3(C#), {3}=degree5(E) - matches P5's "1/3/5 land"
  assert.strictEqual(c.resolveTo, "Over I, A, C#, or E land. Over IV and V, target that chord's own tones.");
});
test('card: out-of-range index interpolates blank, never the literal word "undefined"', function () {
  var c = SoloGuide.card('aeolian', ['A']); // aeolian uses indices up to {6}; only {0} is real here
  assert.ok(c.shapes.indexOf('undefined') === -1, c.shapes);
});

/* ---------- S-REL-NAMES (U23): card() names the instance when a root is given ---------- */
test('card: pentMajor.shapes + a root NAMES the relative minor instance ({relMinor} resolves)', function () {
  var notes = Circle.soloScale('F', 'pentMajor');
  var c = SoloGuide.card('pentMajor', notes, 'F');
  assert.strictEqual(c.shapes, 'Same notes as D minor pent, THREE frets lower - same box, different home note.');
});
test('card: S-UI-RECONCILE C4 - a C#-major (displayed Db) root NAMES its relative minor pent "Bb minor", never the raw canonical-sharp "A# minor"', function () {
  var notes = Circle.soloScale('C#', 'pentMajor');
  var c = SoloGuide.card('pentMajor', notes, 'C#');
  assert.strictEqual(c.shapes, 'Same notes as Bb minor pent, THREE frets lower - same box, different home note.');
  assert.ok(c.shapes.indexOf('A#') === -1, c.shapes);
});
test('card: absent root falls back to the pre-S-REL-NAMES relationship-only wording (byte-identical to the 2-arg call)', function () {
  var notes = Circle.soloScale('F', 'pentMajor');
  var withRoot = SoloGuide.card('pentMajor', notes, 'F');
  var noRoot = SoloGuide.card('pentMajor', notes);
  assert.strictEqual(noRoot.shapes, 'Same notes as the relative minor pent, THREE frets lower - same box, different home note.');
  assert.notStrictEqual(withRoot.shapes, noRoot.shapes); // the whole point - naming changes the text
});
test('card: an unresolvable root degrades to the same fallback as no root at all (never throws)', function () {
  var notes = Circle.soloScale('F', 'pentMajor');
  assert.strictEqual(SoloGuide.card('pentMajor', notes, 'nonsense').shapes, SoloGuide.card('pentMajor', notes).shapes);
});
test('card: {i} and {relMinor}/{relMajor} interpolation compose - a block with BOTH kinds of token resolves both (pentMajor.resolveTo has {i} tokens; shapes has the named one; same card() call)', function () {
  var notes = Circle.soloScale('F', 'pentMajor');
  var c = SoloGuide.card('pentMajor', notes, 'F');
  // resolveTo's {i} degree tokens still resolve exactly as before, unaffected by the root arg
  assert.strictEqual(c.resolveTo, "Over I, F, A, or C land. Over IV and V, target that chord's own tones.");
  assert.strictEqual(c.shapes, 'Same notes as D minor pent, THREE frets lower - same box, different home note.');
});

/* ---------- S-REL-NAMES (U23): relNames() - the pure resolver, a thin pass-
 * through onto Circle.relativeMinor/relativeMajor, never a re-derivation. ---------- */
test('relNames: canon spot-checks named in the U23 spec (F->D minor, A->F# minor, C->A minor)', function () {
  assert.strictEqual(SoloGuide.relNames('F', 'pentMajor').relMinor, 'D');
  assert.strictEqual(SoloGuide.relNames('A', 'pentMajor').relMinor, 'F#');
  assert.strictEqual(SoloGuide.relNames('C', 'pentMajor').relMinor, 'A');
});
test('relNames: parity with Circle.preferredTonicName(relativeMinor/relativeMajor(root)) across all 12 roots (S-UI-RECONCILE C4: the shifted root is respelled key-aware, not the raw canonical-sharp shift)', function () {
  Circle.ORDER.forEach(function (root) {
    var names = SoloGuide.relNames(root, 'pentMajor');
    assert.strictEqual(names.relMinor, Circle.preferredTonicName(Circle.relativeMinor(root), 'minor'), root + ' relMinor mismatch');
    assert.strictEqual(names.relMajor, Circle.preferredTonicName(Circle.relativeMajor(root), 'major'), root + ' relMajor mismatch');
  });
});
test('relNames: C4 fix in effect - a canonical-sharp relative root respells to its key-aware name (C major -> Eb major, not D#; G# minor -> B major, not raw sharp shift where it differs)', function () {
  assert.strictEqual(SoloGuide.relNames('C', 'pentMajor').relMajor, 'Eb');
  assert.strictEqual(SoloGuide.relNames('G', 'pentMajor').relMajor, 'Bb');
  assert.strictEqual(SoloGuide.relNames('C#', 'pentMajor').relMinor, 'Bb');
  assert.strictEqual(SoloGuide.relNames('A#', 'pentMajor').relMajor, 'Db');
});
test('relNames: no root, an unresolvable root, or Circle absence all degrade to { relMinor: null, relMajor: null } (never throws)', function () {
  assert.deepStrictEqual(SoloGuide.relNames(null, 'pentMajor'), { relMinor: null, relMajor: null });
  assert.deepStrictEqual(SoloGuide.relNames('', 'pentMajor'), { relMinor: null, relMajor: null });
  assert.deepStrictEqual(SoloGuide.relNames('nonsense', 'pentMajor'), { relMinor: null, relMajor: null });
});

/* ---------- P5 seasoned-player adversarial fold (2026-07-05) - supersedes
 * section-8B wherever both amended the same block (dorian.hangOn,
 * pentMinor.startEnd, blues.resolveTo). Folded pre-merge into PR #118. ---------- */
test("professor micro-pass: blues.resolveTo scopes the rub to I7 (supersedes the P5 line - over IV7/V7 the b3 is that chord's b7, not a rub)", function () {
  assert.strictEqual(SoloGuide.cards.blues.resolveTo,
    "Aim at the current chord's 3rd, b7, or root; {4} is neutral. Over I7, bend {1} toward 3.");
});
test('P5 fold: pentMinor.startEnd carries the rewrite (supersedes 8B; bend advice moved fully to hangOn)', function () {
  assert.strictEqual(SoloGuide.cards.pentMinor.startEnd,
    'Start on {1} or {3}; close on {0}, {3}, or the current chord root.');
});
test('professor micro-pass: dorian.hangOn names the natural-6 (supersedes the P5 line - "m6 shade" reads as a minor-6 interval; the dorian 6th is major)', function () {
  assert.strictEqual(SoloGuide.cards.dorian.hangOn,
    "{5} IS the dorian color - the natural-6 over i; over IV it's the 3rd.");
});
test('P5 must-fix: pentMajor.shapes says THREE frets lower, not the factually-wrong "two frets down"', function () {
  // S-REL-NAMES (U23): the raw (pre-interpolation) table now carries the
  // {relMinor} token in place of the bare "the relative minor" phrase - see
  // the card()-with-root test below for the resolved/fallback behavior.
  assert.strictEqual(SoloGuide.cards.pentMajor.shapes,
    'Same notes as {relMinor} pent, THREE frets lower - same box, different home note.');
  assert.ok(!/two frets/i.test(SoloGuide.cards.pentMajor.shapes), 'the old wrong claim must not survive anywhere in the card');
});
test('P5 must-fix: no card claims the factually-wrong "zero-risk" framing for pentMajor.chooseWhen', function () {
  assert.ok(!/zero-risk/i.test(SoloGuide.cards.pentMajor.chooseWhen), SoloGuide.cards.pentMajor.chooseWhen);
});

/* ---------- copy budget lint (m-guide-ia-20260704.md section 3: block <=90 chars,
 * card <=70 words) - measured on the PRE-interpolation static template text, since
 * that is what the budget was written against. Every block fits cleanly under 90
 * chars post-P5-fold - no allowlisted exceptions remain. */
test('copy budget: every block <=90 chars', function () {
  SCALE_KEYS.forEach(function (key) {
    BLOCKS.forEach(function (b) {
      var text = SoloGuide.cards[key][b];
      var id = key + '.' + b;
      assert.ok(text.length <= 90, id + ' is ' + text.length + ' chars, budget is <=90');
    });
  });
});
test('copy budget: every card <=70 words (pre-interpolation)', function () {
  SCALE_KEYS.forEach(function (key) {
    var words = BLOCKS.reduce(function (n, b) { return n + SoloGuide.cards[key][b].split(/\s+/).filter(Boolean).length; }, 0);
    assert.ok(words <= 70, key + ' card is ' + words + ' words, budget is <=70');
  });
});

/* ---------- tells-clean punctuation (portable subset of scripts/validate-no-ai-tells.py's
 * hard-fail set - em/en dash, curly quotes, ellipsis char, middle dot). The full
 * validator (~/.claude/scripts/validate-no-ai-tells.py) is run manually in V&V;
 * this keeps a repo-local, dependency-free floor in CI. */
test('tells-clean: no em/en dash, curly quotes, ellipsis char, or middle dot in any block', function () {
  var TELL_RE = /[—–‘’“”…·]/;
  SCALE_KEYS.forEach(function (key) {
    BLOCKS.forEach(function (b) {
      var text = SoloGuide.cards[key][b];
      assert.ok(!TELL_RE.test(text), key + '.' + b + ' contains an AI-tell character: ' + JSON.stringify(text));
    });
  });
});

/* ---------- Node/browser dual export (UMD-like pattern, matches circle.js) ---------- */
test('module.exports mirrors window.SoloGuide shape (framing/cards/card)', function () {
  assert.strictEqual(typeof SoloGuide.framing, 'function');
  assert.strictEqual(typeof SoloGuide.card, 'function');
  assert.strictEqual(typeof SoloGuide.cards, 'object');
});

run();
