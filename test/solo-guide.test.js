/* =====================================================================
 * solo-guide.test.js  -  unit tests for M-GUIDE W3a's SoloGuide module
 * (music/shared/solo-guide.js): the locked seam contract (framing/cards/
 * card), the {i}-index interpolation, the section-8B verbatim corrections,
 * and the copy budget (block <=90 chars, card <=70 words) + tells-clean
 * punctuation lint per m-guide-ia-20260704.md section 3.
 *
 * Run: node test/solo-guide.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
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
  assert.strictEqual(SoloGuide.framing('pentMajor', 'major'),
    'The inside sound over major and dominant vamps - same shape as its relative minor pent, two frets down; keep the root as home.');
  assert.strictEqual(SoloGuide.framing('pentMinor', 'minor'),
    'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.');
  assert.strictEqual(SoloGuide.framing('blues'),
    'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.');
  assert.strictEqual(SoloGuide.framing('mode'), null);
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
  assert.strictEqual(c.resolveTo, 'Land on C or E; G always parks safe.');
  assert.strictEqual(c.hangOn, "Don't sit on F over the I - pass through it; A is the sweet color.");
  assert.strictEqual(c.startEnd, 'Start phrases on E or G, end them on C.');
});
test('card: out-of-range index interpolates blank, never the literal word "undefined"', function () {
  var c = SoloGuide.card('aeolian', ['A']); // aeolian uses indices up to {6}; only {0} is real here
  assert.ok(c.shapes.indexOf('undefined') === -1, c.shapes);
});

/* ---------- section-8B professor-fold corrections (verbatim, supersede section-3) ---------- */
test('8B correction: blues.resolveTo carries the amended copy verbatim', function () {
  assert.strictEqual(SoloGuide.cards.blues.resolveTo,
    "Aim at the root of the chord you're over; {4} always lands; {1} is the rub - resolve it by ear.");
});
test('8B correction: pentMinor.startEnd carries the amended copy verbatim', function () {
  assert.strictEqual(SoloGuide.cards.pentMinor.startEnd,
    'A classic move: bend {2} toward {3}. Start on {1}, end on {0}.');
});
test('8B correction: dorian.hangOn carries the amended copy verbatim', function () {
  assert.strictEqual(SoloGuide.cards.dorian.hangOn,
    '{5} IS the dorian color - lean on it over the i chord; over IV it turns into the 3rd.');
});

/* ---------- copy budget lint (m-guide-ia-20260704.md section 3: block <=90 chars,
 * card <=70 words) - measured on the PRE-interpolation static template text, since
 * that is what the budget was written against. ONE documented exception: the
 * section-8B blues.resolveTo correction is a BINDING verbatim amendment (95 chars)
 * that supersedes the general soft budget - allowlisted explicitly here so a
 * FUTURE overage elsewhere still fails loudly. */
var BLOCK_BUDGET_EXCEPTIONS = { 'blues.resolveTo': 95 };
test('copy budget: every block <=90 chars (except the documented 8B verbatim exception)', function () {
  SCALE_KEYS.forEach(function (key) {
    BLOCKS.forEach(function (b) {
      var text = SoloGuide.cards[key][b];
      var id = key + '.' + b;
      var allowed = BLOCK_BUDGET_EXCEPTIONS[id];
      if (allowed != null) {
        assert.strictEqual(text.length, allowed, id + ' allowlisted length changed - re-verify against the 8B transcript');
        return;
      }
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
