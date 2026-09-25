/* =====================================================================
 * math-engine.test.js  -  unit tests for the pure arithmetic-workout
 * engine (math/engine.js). Run: node test/math-engine.test.js
 * (pure Node assert, no deps)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var E = require('../math/engine.js');

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

function keys(facts) { return facts.map(function (f) { return f.key; }); }
function distinctCount(arr) { return Object.keys(arr.reduce(function (m, v) { m[v] = 1; return m; }, {})).length; }

/* ===================================================================
 * makeFact / key canonicalization / text glyphs
 * =================================================================== */

test('makeFact "+": answer, key (min/max), text with GLYPH', function () {
  var f = E.makeFact('+', 5, 3);
  assert.strictEqual(f.op, '+');
  assert.strictEqual(f.a, 5);
  assert.strictEqual(f.b, 3);
  assert.strictEqual(f.answer, 8);
  assert.strictEqual(f.key, '+:3:5');
  assert.strictEqual(f.text, '5 + 3');
});

test('makeFact "-": answer, key (literal a:b), text with minus glyph', function () {
  var f = E.makeFact('-', 11, 2);
  assert.strictEqual(f.answer, 9);
  assert.strictEqual(f.key, '-:11:2');
  assert.strictEqual(f.text, '11 − 2');
});

test('makeFact "x": answer, key (min/max), text with times glyph', function () {
  var f = E.makeFact('x', 7, 8);
  assert.strictEqual(f.answer, 56);
  assert.strictEqual(f.key, 'x:7:8');
  assert.strictEqual(f.text, '7 × 8');
});

test('makeFact "/": answer, key (literal a:b, a=dividend), text with div glyph', function () {
  var f = E.makeFact('/', 56, 8);
  assert.strictEqual(f.answer, 7);
  assert.strictEqual(f.key, '/:56:8');
  assert.strictEqual(f.text, '56 ÷ 8');
});

test('key canonicalization: "+" and "x" sort operands (commutative), keys match both orders', function () {
  assert.strictEqual(E.makeFact('+', 3, 5).key, E.makeFact('+', 5, 3).key);
  assert.strictEqual(E.makeFact('+', 3, 5).key, '+:3:5');
  assert.strictEqual(E.makeFact('x', 3, 5).key, E.makeFact('x', 5, 3).key);
  assert.strictEqual(E.makeFact('x', 3, 5).key, 'x:3:5');
});

test('key canonicalization: "-" and "/" do NOT sort (order-sensitive)', function () {
  assert.notStrictEqual(E.makeFact('-', 5, 3).key, E.makeFact('-', 3, 5).key);
  assert.notStrictEqual(E.makeFact('/', 56, 8).key, E.makeFact('/', 8, 56).key);
});

/* ===================================================================
 * normalizeCfg
 * =================================================================== */

test('normalizeCfg never throws on garbage top-level input', function () {
  [null, undefined, 'nonsense', 42, [], true, function () {}].forEach(function (junk) {
    assert.doesNotThrow(function () { E.normalizeCfg(junk); });
  });
});

test('normalizeCfg(null/undefined/garbage) returns the documented defaults', function () {
  [null, undefined, 'nonsense', 42, [1, 2], true].forEach(function (junk) {
    var c = E.normalizeCfg(junk);
    assert.deepStrictEqual(c.ops, ['+', '-']);
    assert.strictEqual(c.addRange, 10);
    assert.deepStrictEqual(c.tables, []);
    assert.strictEqual(c.max, 10);
    assert.strictEqual(c.order, 'random');
    assert.strictEqual(c.coach, false);
    assert.strictEqual(c.mode, 'race');
    assert.strictEqual(c.length, 20);
  });
});

test('normalizeCfg: empty/garbage ops falls back to DEFAULT ops', function () {
  assert.deepStrictEqual(E.normalizeCfg({ ops: [] }).ops, ['+', '-']);
  assert.deepStrictEqual(E.normalizeCfg({ ops: ['q', 'nope'] }).ops, ['+', '-']);
  assert.deepStrictEqual(E.normalizeCfg({ ops: 'x' }).ops, ['+', '-']);
});

test('normalizeCfg: ops filtered to known set and deduped', function () {
  assert.deepStrictEqual(E.normalizeCfg({ ops: ['+', '+', 'q', 'x'] }).ops, ['+', 'x']);
});

test('normalizeCfg: tables filtered to 2..12 ints, deduped, sorted', function () {
  var c = E.normalizeCfg({ tables: [1, 2, 2, 99, 7.5, 'x', 12, 5] });
  assert.deepStrictEqual(c.tables, [2, 5, 12]);
});

test('normalizeCfg: max/mode/length/addRange/order fall back on invalid values', function () {
  var c = E.normalizeCfg({ max: 999, mode: 'nope', length: 5, addRange: 99, order: 'weird' });
  assert.strictEqual(c.max, 10);
  assert.strictEqual(c.mode, 'race');
  assert.strictEqual(c.length, 20);
  assert.strictEqual(c.addRange, 10);
  assert.strictEqual(c.order, 'random');
});

test('normalizeCfg: valid explicit values pass through unchanged', function () {
  var c = E.normalizeCfg({ ops: ['x', '/'], addRange: 20, tables: [7, 8], max: 12, order: 'ordered', coach: true, mode: 'sprint', length: 30 });
  assert.deepStrictEqual(c.ops, ['x', '/']);
  assert.strictEqual(c.addRange, 20);
  assert.deepStrictEqual(c.tables, [7, 8]);
  assert.strictEqual(c.max, 12);
  assert.strictEqual(c.order, 'ordered');
  assert.strictEqual(c.coach, true);
  assert.strictEqual(c.mode, 'sprint');
  assert.strictEqual(c.length, 30);
});

/* ===================================================================
 * pool()
 * =================================================================== */

test('pool "+" To10: every fact has a,b>=1 and a+b<=10; count 45', function () {
  var facts = E.pool('+', E.normalizeCfg({ addRange: 10 }));
  assert.strictEqual(facts.length, 45);
  facts.forEach(function (f) {
    assert.ok(f.a >= 1 && f.b >= 1, 'operands >= 1');
    assert.ok(f.a + f.b <= 10, 'sum <= 10');
    assert.strictEqual(f.answer, f.a + f.b);
  });
});

test('pool "+" To20: every fact has a,b in 1..9; count 81', function () {
  var facts = E.pool('+', E.normalizeCfg({ addRange: 20 }));
  assert.strictEqual(facts.length, 81);
  facts.forEach(function (f) {
    assert.ok(f.a >= 1 && f.a <= 9);
    assert.ok(f.b >= 1 && f.b <= 9);
  });
});

test('pool "-" To10: minuend<=10, subtrahend<minuend, answers 1..9; count 45', function () {
  var facts = E.pool('-', E.normalizeCfg({ addRange: 10 }));
  assert.strictEqual(facts.length, 45);
  facts.forEach(function (f) {
    assert.ok(f.a <= 10, 'minuend <= 10');
    assert.ok(f.b >= 1 && f.b < f.a, 'subtrahend in [1, a)');
    assert.ok(f.answer >= 1 && f.answer <= 9, 'answer in 1..9');
  });
});

test('pool "-" To20: minuend<=18, answers 1..9; count 81', function () {
  var facts = E.pool('-', E.normalizeCfg({ addRange: 20 }));
  assert.strictEqual(facts.length, 81);
  facts.forEach(function (f) {
    assert.ok(f.a <= 18, 'minuend <= 18 (x+y, x,y<=9)');
    assert.ok(f.answer >= 1 && f.answer <= 9, 'answer (x) in 1..9');
    assert.ok(f.b >= 1 && f.b <= 9, 'subtrahend (y) in 1..9');
  });
});

test('pool "x": uses the picked tables, k 1..max, whole-number products', function () {
  var facts = E.pool('x', E.normalizeCfg({ tables: [7], max: 12 }));
  assert.strictEqual(facts.length, 12);
  facts.forEach(function (f) {
    assert.strictEqual(f.b, 7, 'table is the fixed operand');
    assert.ok(f.a >= 1 && f.a <= 12, 'multiplier k in 1..max');
    assert.strictEqual(f.answer, f.a * f.b);
  });
});

test('pool "x": empty tables ([]) uses all tables 2..max', function () {
  var facts = E.pool('x', E.normalizeCfg({ tables: [], max: 10 }));
  assert.strictEqual(facts.length, 9 * 10); // tables 2..10 (9) x k 1..10
});

test('pool "x": coach keeps the picked tables as its scope (v1.1: coach = weighting, tables = scope)', function () {
  // v1.1 amendment: a skill set (e.g. x-2-5-10) is Coach-weighted INSIDE its own
  // tables. Custom's Coach chip clears the picks to mean "all tables".
  var picked = E.pool('x', E.normalizeCfg({ tables: [7], max: 10, coach: true }));
  picked.forEach(function (f) { assert.ok(f.a === 7 || f.b === 7, 'fact outside x7: ' + f.text); });
  var all = E.pool('x', E.normalizeCfg({ tables: [], max: 10, coach: true }));
  assert.ok(all.some(function (f) { return f.b === 2; }) && all.some(function (f) { return f.b === 10; }), 'no picks = all tables 2..max');
});

test('pool "/": divisor from picked tables, whole-number quotient 1..max', function () {
  var facts = E.pool('/', E.normalizeCfg({ tables: [7], max: 12 }));
  assert.strictEqual(facts.length, 12);
  facts.forEach(function (f) {
    assert.strictEqual(f.b, 7, 'divisor is the fixed table');
    assert.strictEqual(f.a % f.b, 0, 'dividend is a whole multiple of the divisor');
    assert.ok(f.answer >= 1 && f.answer <= 12, 'quotient (k) in 1..max');
    assert.strictEqual(f.answer, f.a / f.b);
  });
});

test('pool "+"/"x": both display orders exist as separate facts sharing one key', function () {
  var facts = E.pool('x', E.normalizeCfg({ tables: [7, 8], max: 12 }));
  var f78 = facts.filter(function (f) { return f.a === 7 && f.b === 8; });
  var f87 = facts.filter(function (f) { return f.a === 8 && f.b === 7; });
  assert.strictEqual(f78.length, 1);
  assert.strictEqual(f87.length, 1);
  assert.strictEqual(f78[0].key, f87[0].key);
  assert.notStrictEqual(f78[0].text, f87[0].text);
});

/* ===================================================================
 * buildSet
 * =================================================================== */

test('buildSet: returns exactly `count` facts', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-'], length: 20 });
  var set = E.buildSet(cfg, {}, E.rng(1), 20);
  assert.strictEqual(set.length, 20);
});

test('buildSet: defaults count to cfg.length when omitted', function () {
  var cfg = E.normalizeCfg({ ops: ['+'], length: 10 });
  var set = E.buildSet(cfg, {}, E.rng(1));
  assert.strictEqual(set.length, 10);
});

test('buildSet: op counts are balanced (differ by at most 1)', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-', 'x'], length: 20, tables: [7], max: 10 });
  var set = E.buildSet(cfg, {}, E.rng(5), 20);
  var counts = {};
  set.forEach(function (f) { counts[f.op] = (counts[f.op] || 0) + 1; });
  var vals = Object.keys(counts).map(function (k) { return counts[k]; });
  assert.strictEqual(Object.keys(counts).length, 3, 'all 3 ops represented');
  assert.ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) <= 1, 'counts differ by <=1: ' + JSON.stringify(counts));
});

test('buildSet: never the same key twice in a row (across ops and within one op)', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-', 'x', '/'], length: 30, tables: [7, 8], max: 10 });
  for (var seed = 1; seed <= 5; seed++) {
    var set = E.buildSet(cfg, {}, E.rng(seed), 30);
    var ks = keys(set);
    for (var i = 1; i < ks.length; i++) {
      assert.notStrictEqual(ks[i], ks[i - 1], 'seed ' + seed + ' repeated key at index ' + i);
    }
  }
});

test('buildSet: shuffle-bag without replacement - a 12-fact pool in a 12-set has 12 distinct keys', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 12 });
  var set = E.buildSet(cfg, {}, E.rng(3), 12);
  assert.strictEqual(set.length, 12);
  assert.strictEqual(distinctCount(keys(set)), 12, 'every fact in the 12-fact pool appears exactly once');
});

test('buildSet: bag refills and stays without-replacement across the refill boundary', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 12 });
  var set = E.buildSet(cfg, {}, E.rng(9), 24); // exactly 2 full cycles of the 12-fact pool
  var firstCycle = distinctCount(keys(set.slice(0, 12)));
  var secondCycle = distinctCount(keys(set.slice(12, 24)));
  assert.strictEqual(firstCycle, 12);
  assert.strictEqual(secondCycle, 12);
});

test('buildSet: no-repeat holds AT the refill boundary itself (small pool, many forced refills)', function () {
  // A 3-fact pool with count=60 forces ~20 bag refills - the exact seam where a naive
  // reshuffle-without-boundary-check can hand out the same key twice in a row.
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 3 });
  for (var seed = 1; seed <= 8; seed++) {
    var set = E.buildSet(cfg, {}, E.rng(seed), 60);
    var ks = keys(set);
    for (var i = 1; i < ks.length; i++) {
      assert.notStrictEqual(ks[i], ks[i - 1], 'seed ' + seed + ' repeated key at refill-heavy index ' + i);
    }
  }
});

test('buildSet: ordered + single table + ops===["x"] cycles k ascending 1..max', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [5], max: 10, order: 'ordered' });
  var set = E.buildSet(cfg, {}, E.rng(1), 25);
  var ks = set.map(function (f) { return f.a; }); // k is stored as `a` (makeFact('x', k, t))
  assert.deepStrictEqual(ks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5]);
  set.forEach(function (f) { assert.strictEqual(f.b, 5); });
});

test('buildSet: ordered + single table + ops===["/"] cycles k ascending 1..max', function () {
  var cfg = E.normalizeCfg({ ops: ['/'], tables: [6], max: 10, order: 'ordered' });
  var set = E.buildSet(cfg, {}, E.rng(1), 12);
  var ks = set.map(function (f) { return f.answer; }); // quotient k
  assert.deepStrictEqual(ks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2]);
});

test('buildSet: does not mutate its cfg or stats inputs', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-'], length: 10 });
  var cfgSnapshot = JSON.stringify(cfg);
  var stats = { '+:1:2': { n: 1, miss: 0, box: 0, ms: 1000, last: 0 } };
  var statsSnapshot = JSON.stringify(stats);
  E.buildSet(cfg, stats, E.rng(1), 10);
  assert.strictEqual(JSON.stringify(cfg), cfgSnapshot);
  assert.strictEqual(JSON.stringify(stats), statsSnapshot);
});

/* ===================================================================
 * coach mode (buildSet + coachWeight)
 * =================================================================== */

test('coach: weak (box 0) facts are drawn far more often than box-4 facts (seeded 2000-draw sample)', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 10, coach: true });
  var poolArr = E.pool('x', cfg);
  var distinctKeys = poolArr.map(function (f) { return f.key; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
  var stats = {};
  // seed 20 distinct keys as "seen", spread evenly across boxes 0..4, all far overdue.
  distinctKeys.slice(0, 20).forEach(function (k, i) {
    stats[k] = { n: 5, miss: 0, box: i % 5, ms: 1000, last: 0 };
  });
  var now = 1000 * 86400000; // 1000 days later - everything is "due"
  var set = E.buildSet(cfg, stats, E.rng(3), 2000, now);
  var byBox = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  set.forEach(function (f) {
    var s = stats[f.key];
    if (s) byBox[s.box]++;
  });
  assert.ok(byBox[0] > byBox[4] * 3, 'box0 (' + byBox[0] + ') should be drawn far more than box4 (' + byBox[4] + ')');
  assert.ok(byBox[0] > byBox[1], 'box0 drawn more than box1');
  assert.ok(byBox[1] > byBox[2], 'box1 drawn more than box2');
});

test('coach: NEW_CAP respected - at most NEW_CAP unseen keys drawn once the op has history', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 10, coach: true });
  var poolArr = E.pool('x', cfg);
  var distinctKeys = poolArr.map(function (f) { return f.key; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
  var stats = {};
  // Enough history to drill (>= COACH_MIN_SEEN seen keys): only then does the
  // one-new-thing-at-a-time cap apply.
  for (var s0 = 0; s0 < 6; s0++) stats[distinctKeys[s0]] = { n: 5, miss: 0, box: 2, ms: 1000, last: 0 };
  var now = 100 * 86400000;
  var set = E.buildSet(cfg, stats, E.rng(11), 40, now);
  var unseenKeys = {};
  set.forEach(function (f) { if (!stats[f.key]) unseenKeys[f.key] = true; });
  assert.ok(Object.keys(unseenKeys).length <= 3, 'unseen distinct keys drawn (' + Object.keys(unseenKeys).length + ') should be <= NEW_CAP (3)');
});

test('coach: thin history (1-2 seen facts) never repeats a fact back to back and still spreads out', function () {
  // Review finding #5: with 1 seen key and NEW_CAP spent, the coach drew the same
  // fact 17 times in a row. Below COACH_MIN_SEEN seen keys, unseen facts fill in.
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [], max: 12, coach: true });
  var keys = E.pool('x', cfg).map(function (f) { return f.key; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
  [1, 2].forEach(function (seenCount) {
    for (var seed = 1; seed <= 8; seed++) {
      var stats = {};
      for (var k = 0; k < seenCount; k++) stats[keys[k]] = { n: 1, miss: 1, box: 0, ms: 3000, last: 0 };
      var set = E.buildSet(cfg, stats, E.rng(seed), 20, 100 * 86400000);
      for (var i = 1; i < set.length; i++) assert.notStrictEqual(set[i].key, set[i - 1].key, 'back-to-back repeat at ' + i + ' (seen ' + seenCount + ', seed ' + seed + ')');
      var distinct = set.map(function (f) { return f.key; }).filter(function (x, j, a) { return a.indexOf(x) === j; }).length;
      assert.ok(distinct >= 6, 'only ' + distinct + ' distinct facts in a 20-question coach set (seen ' + seenCount + ', seed ' + seed + ')');
    }
  });
});

test('coach: an op with zero history draws unseen facts freely (falls back to plain-random-like coverage)', function () {
  var cfg = E.normalizeCfg({ ops: ['x'], tables: [7], max: 10, coach: true });
  var poolArr = E.pool('x', cfg);
  var distinctKeys = poolArr.map(function (f) { return f.key; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
  var set = E.buildSet(cfg, {}, E.rng(2), 500, 100 * 86400000); // empty stats - no history anywhere
  var seenOfEach = {};
  set.forEach(function (f) { seenOfEach[f.key] = true; });
  // every unseen fact has equal weight (3), so over 500 draws across ~54 distinct keys, coverage
  // should be broad - not stuck cycling a tiny NEW_CAP-limited subset.
  assert.ok(Object.keys(seenOfEach).length > distinctKeys.length * 0.5, 'broad coverage expected: got ' + Object.keys(seenOfEach).length + ' of ' + distinctKeys.length);
});

/* ===================================================================
 * coachWeight
 * =================================================================== */

test('v1.1 recordAnswer: ok counts first-try-correct in a row, a miss resets it (accuracy-only mastery)', function () {
  var f = E.makeFact('+', 3, 4), st = {};
  st = E.recordAnswer(st, { fact: f, ms: 9000, wrongs: 0 }, 1);
  assert.strictEqual(st[f.key].ok, 1, 'slow but right still counts - accuracy only');
  st = E.recordAnswer(st, { fact: f, ms: 9000, wrongs: 0 }, 2);
  assert.strictEqual(st[f.key].ok, 2);
  st = E.recordAnswer(st, { fact: f, ms: 900, wrongs: 1 }, 3);
  assert.strictEqual(st[f.key].ok, 0, 'a miss resets the streak');
  var legacy = {}; legacy[f.key] = { n: 4, miss: 0, box: 2, ms: 1000, last: 0 }; // pre-v1.1 stat, no ok
  var up = E.recordAnswer(legacy, { fact: f, ms: 900, wrongs: 0 }, 5);
  assert.strictEqual(up[f.key].ok, 1, 'a stat without ok starts the streak at 1');
});

test('coachWeight: unseen fact returns 3', function () {
  var f = E.makeFact('+', 1, 2);
  assert.strictEqual(E.coachWeight(f, {}, 1000), 3);
});

test('coachWeight: box weights and due multiplier', function () {
  var f = E.makeFact('+', 1, 2);
  var boxWeights = [8, 4, 2, 1, 0.5];
  var dueDays = [0, 0, 1, 3, 7];
  boxWeights.forEach(function (w, box) {
    var stats = {};
    stats[f.key] = { n: 5, miss: 0, box: box, ms: 1000, last: 0 };
    var dueDayMs = dueDays[box] * 86400000;
    // exactly at the due threshold -> due (>=)
    assert.strictEqual(E.coachWeight(f, stats, dueDayMs), w, 'box ' + box + ' due weight');
    // one day earlier than threshold (or now=last for box 0/1, which is still due since threshold is 0)
    if (dueDays[box] > 0) {
      var notDueNow = dueDayMs - 1;
      assert.strictEqual(E.coachWeight(f, stats, notDueNow), w * 0.25, 'box ' + box + ' not-due weight');
    }
  });
});

test('coachWeight: now omitted treats every seen fact as due (documented fallback)', function () {
  var f = E.makeFact('+', 1, 2);
  var stats = {};
  stats[f.key] = { n: 5, miss: 0, box: 4, ms: 1000, last: 1000000 };
  assert.strictEqual(E.coachWeight(f, stats, null), 0.5);
  assert.strictEqual(E.coachWeight(f, stats, undefined), 0.5);
});

test('coachFocus: top-n seen facts by coachWeight across cfg.ops pools, distinct keys', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-'] });
  var fAdd = E.makeFact('+', 1, 2), fSub = E.makeFact('-', 5, 2);
  var stats = {};
  stats[fAdd.key] = { n: 5, miss: 0, box: 0, ms: 1000, last: 0 };   // weight 8 (due)
  stats[fSub.key] = { n: 5, miss: 0, box: 4, ms: 1000, last: 0 };   // weight 0.5 (due)
  var focus = E.coachFocus(cfg, stats, 100 * 86400000, 3);
  assert.strictEqual(focus.length, 2, 'only seen facts are included');
  assert.strictEqual(focus[0].key, fAdd.key, 'weakest (highest weight) fact leads');
  assert.strictEqual(focus[1].key, fSub.key);
});

test('coachFocus: n truncates the result', function () {
  var cfg = E.normalizeCfg({ ops: ['+'] });
  var stats = {};
  E.pool('+', cfg).slice(0, 5).forEach(function (f, i) { stats[f.key] = { n: 1, miss: 0, box: i % 5, ms: 1000, last: 0 }; });
  var focus = E.coachFocus(cfg, stats, 100 * 86400000, 2);
  assert.strictEqual(focus.length, 2);
});

/* ===================================================================
 * fastMs
 * =================================================================== */

test('fastMs: fewer than 5 seen facts of that op returns 4000', function () {
  assert.strictEqual(E.fastMs({}, '+'), 4000);
  var stats = {};
  ['+:1:2', '+:1:3', '+:1:4', '+:1:5'].forEach(function (k) { stats[k] = { n: 1, miss: 0, box: 0, ms: 500, last: 0 }; });
  assert.strictEqual(E.fastMs(stats, '+'), 4000, '4 seen still under threshold');
});

test('fastMs: 5+ seen facts uses clamp(1.25 * median, 1200, 4000)', function () {
  var stats = {};
  [1000, 1100, 1200, 1300, 1400].forEach(function (ms, i) { stats['+:1:' + (i + 2)] = { n: 1, miss: 0, box: 0, ms: ms, last: 0 }; });
  assert.strictEqual(E.fastMs(stats, '+'), 1500); // median 1200 * 1.25 = 1500
});

test('fastMs: clamps to the 1200 floor', function () {
  var stats = {};
  [100, 100, 100, 100, 100].forEach(function (ms, i) { stats['+:1:' + (i + 2)] = { n: 1, miss: 0, box: 0, ms: ms, last: 0 }; });
  assert.strictEqual(E.fastMs(stats, '+'), 1200);
});

test('fastMs: clamps to the 4000 ceiling', function () {
  var stats = {};
  [10000, 10000, 10000, 10000, 10000].forEach(function (ms, i) { stats['+:1:' + (i + 2)] = { n: 1, miss: 0, box: 0, ms: ms, last: 0 }; });
  assert.strictEqual(E.fastMs(stats, '+'), 4000);
});

test('fastMs: only counts facts for the given op', function () {
  var stats = {};
  [1000, 1000, 1000, 1000, 1000].forEach(function (ms, i) { stats['x:1:' + (i + 2)] = { n: 1, miss: 0, box: 0, ms: ms, last: 0 }; });
  assert.strictEqual(E.fastMs(stats, '+'), 4000, 'no "+" facts seen, so falls to the <5 default');
});

/* ===================================================================
 * recordAnswer
 * =================================================================== */

test('recordAnswer: first answer creates a fresh stat, ms = the raw ms (no EWMA yet)', function () {
  var fact = E.makeFact('+', 3, 5);
  var out = E.recordAnswer({}, { fact: fact, ms: 900, wrongs: 0 }, 5000);
  assert.deepStrictEqual(out[fact.key], { n: 1, miss: 0, box: 1, ms: 900, last: 5000, ok: 1 });
});

test('recordAnswer: does not mutate the input stats object', function () {
  var fact = E.makeFact('+', 3, 5);
  var stats = {};
  var snapshot = JSON.stringify(stats);
  E.recordAnswer(stats, { fact: fact, ms: 900, wrongs: 0 }, 5000);
  assert.strictEqual(JSON.stringify(stats), snapshot);
});

test('recordAnswer: wrongs>0 resets box to 0 and increments miss', function () {
  var fact = E.makeFact('+', 3, 5);
  var stats = {};
  stats[fact.key] = { n: 3, miss: 0, box: 3, ms: 1000, last: 0 };
  var out = E.recordAnswer(stats, { fact: fact, ms: 2000, wrongs: 1 }, 6000);
  assert.strictEqual(out[fact.key].box, 0);
  assert.strictEqual(out[fact.key].miss, 1);
  assert.strictEqual(out[fact.key].n, 4);
});

test('recordAnswer: correct + fast (ms <= fastMs) promotes box, capped at 4', function () {
  var fact = E.makeFact('+', 3, 5);
  var stats = {};
  stats[fact.key] = { n: 1, miss: 0, box: 4, ms: 1000, last: 0 }; // already at cap
  var out = E.recordAnswer(stats, { fact: fact, ms: 100, wrongs: 0 }, 6000);
  assert.strictEqual(out[fact.key].box, 4, 'box does not exceed 4');
});

test('recordAnswer: correct + slow (ms > fastMs) leaves box unchanged', function () {
  var fact = E.makeFact('+', 3, 5);
  var stats = {};
  // seed 5 other "+" facts so fastMs is median-based rather than the <5-seen 4000 default
  [1000, 1000, 1000, 1000, 1000].forEach(function (ms, i) { stats['+:1:' + (i + 20)] = { n: 1, miss: 0, box: 0, ms: ms, last: 0 }; });
  stats[fact.key] = { n: 1, miss: 0, box: 2, ms: 1000, last: 0 };
  var threshold = E.fastMs(stats, '+'); // 1250
  var out = E.recordAnswer(stats, { fact: fact, ms: threshold + 500, wrongs: 0 }, 6000);
  assert.strictEqual(out[fact.key].box, 2, 'box unchanged when the answer is slower than the fast threshold');
});

test('recordAnswer: ms is an EWMA (0.7 old + 0.3 new, rounded) after the first answer', function () {
  var fact = E.makeFact('+', 3, 5);
  var stats = {};
  stats[fact.key] = { n: 1, miss: 0, box: 0, ms: 1000, last: 0 };
  var out = E.recordAnswer(stats, { fact: fact, ms: 2000, wrongs: 0 }, 6000);
  assert.strictEqual(out[fact.key].ms, Math.round(0.7 * 1000 + 0.3 * 2000));
});

/* ===================================================================
 * createRun / elapsed / current / press
 * =================================================================== */

test('createRun: produces the documented initial shape', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var cfg = E.normalizeCfg({});
  var run = E.createRun(cfg, facts, 1234);
  assert.deepStrictEqual(run, {
    cfg: cfg, facts: facts, idx: 0, input: '', wrongs: 0, reveal: false,
    results: [], penaltyMs: 0, startedAt: 1234, pausedAt: null,
    pausedTotal: 0, qStart: 0, done: false
  });
});

test('current(run): returns the fact at idx', function () {
  var facts = [E.makeFact('+', 3, 5), E.makeFact('+', 2, 2)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  assert.strictEqual(E.current(run), facts[0]);
});

test('elapsed(run, now): active time excludes pausedTotal', function () {
  var run = E.createRun(E.normalizeCfg({}), [], 1000);
  run.pausedTotal = 500;
  assert.strictEqual(E.elapsed(run, 3000), 3000 - 1000 - 500);
});

test('elapsed(run, now): while paused, uses pausedAt instead of now', function () {
  var run = E.createRun(E.normalizeCfg({}), [], 1000);
  run.pausedAt = 4000;
  assert.strictEqual(E.elapsed(run, 999999), 4000 - 1000 - 0);
});

test('press: digits append to input while shorter than the answer length (no event)', function () {
  var facts = [E.makeFact('+', 8, 9)]; // answer 17, 2 digits
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '1', 100);
  assert.strictEqual(r.event, null);
  assert.strictEqual(r.run.input, '1');
  assert.strictEqual(r.run.idx, 0, 'not yet evaluated');
});

test('press: auto-submits at full answer length - correct pushes a Result and advances', function () {
  var facts = [E.makeFact('+', 3, 5), E.makeFact('+', 2, 2)]; // answers 8, 4
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '8', 500);
  assert.strictEqual(r.event, 'correct');
  assert.strictEqual(r.run.idx, 1);
  assert.strictEqual(r.run.input, '');
  assert.strictEqual(r.run.wrongs, 0);
  assert.strictEqual(r.run.reveal, false);
  assert.strictEqual(r.run.results.length, 1);
  assert.deepStrictEqual(r.run.results[0], { fact: facts[0], ms: 500 - 0, wrongs: 0 });
  assert.strictEqual(r.run.qStart, 500);
});

test('press: correct on the LAST fact fires "done" and sets done=true', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '8', 100);
  assert.strictEqual(r.event, 'done');
  assert.strictEqual(r.run.done, true);
});

test('press: wrong answer adds the 3000ms penalty, clears input, keeps the same fact', function () {
  var facts = [E.makeFact('+', 3, 5)]; // answer 8
  var run = E.createRun(E.normalizeCfg({ mode: 'race' }), facts, 0);
  var r = E.press(run, '7', 100); // wrong (single-digit answer, so this is a full-length wrong guess)
  assert.strictEqual(r.event, 'wrong');
  assert.strictEqual(r.run.wrongs, 1);
  assert.strictEqual(r.run.input, '');
  assert.strictEqual(r.run.penaltyMs, 3000, 'penalty is exactly the spec-literal 3000ms');
  assert.strictEqual(r.run.idx, 0, 'same fact retried');
});

test('press: wrong answer adds 0 penalty in practice mode', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({ mode: 'practice' }), facts, 0);
  var r = E.press(run, '7', 100);
  assert.strictEqual(r.run.penaltyMs, 0);
});

test('press: reveal turns on after REVEAL_AFTER (2) wrong tries', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r1 = E.press(run, '7', 100);
  assert.strictEqual(r1.run.reveal, false, 'not yet after 1 wrong');
  var r2 = E.press(r1.run, '6', 200);
  assert.strictEqual(r2.run.reveal, true, 'revealed after 2 wrongs');
  assert.strictEqual(r2.event, 'wrong');
});

test('press: a correct answer after reveal still counts wrongs in the pushed Result', function () {
  var facts = [E.makeFact('+', 3, 5)]; // answer 8
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '7', 100); // wrong
  r = E.press(r.run, '6', 200);   // wrong -> reveal
  r = E.press(r.run, '8', 300);   // correct
  assert.strictEqual(r.event, 'done');
  assert.strictEqual(r.run.results[0].wrongs, 2);
});

test('press: "back" removes the last input character', function () {
  var facts = [E.makeFact('+', 8, 9)]; // 2-digit answer
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '1', 100);
  r = E.press(r.run, 'back', 150);
  assert.strictEqual(r.run.input, '');
  assert.strictEqual(r.event, null);
});

test('press: "clear" empties the input', function () {
  var facts = [E.makeFact('+', 8, 9)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '1', 100);
  r = E.press(r.run, 'clear', 150);
  assert.strictEqual(r.run.input, '');
});

test('press: ignored (event null, run unchanged) when done', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var r = E.press(run, '8', 100); // done
  var r2 = E.press(r.run, '1', 200);
  assert.strictEqual(r2.event, null);
  assert.strictEqual(r2.run, r.run, 'same reference returned, no mutation');
});

test('press: ignored (event null, run unchanged) when paused', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var paused = E.pause(run, 500);
  var r = E.press(paused, '8', 600);
  assert.strictEqual(r.event, null);
  assert.strictEqual(r.run, paused);
});

test('press: does not mutate the input run object', function () {
  var facts = [E.makeFact('+', 3, 5)];
  var run = E.createRun(E.normalizeCfg({}), facts, 0);
  var snapshot = JSON.stringify(run);
  E.press(run, '8', 100);
  assert.strictEqual(JSON.stringify(run), snapshot);
});

/* ===================================================================
 * pause / resume
 * =================================================================== */

test('pause: sets pausedAt; elapsed freezes at the pause moment', function () {
  var run = E.createRun(E.normalizeCfg({}), [], 0);
  var paused = E.pause(run, 1000);
  assert.strictEqual(paused.pausedAt, 1000);
  assert.strictEqual(E.elapsed(paused, 5000), 1000);
  assert.strictEqual(E.elapsed(paused, 9000), 1000, 'still frozen regardless of later now');
});

test('resume: adds the paused delta to pausedTotal and clears pausedAt', function () {
  var run = E.createRun(E.normalizeCfg({}), [], 0);
  var paused = E.pause(run, 1000);
  var resumed = E.resume(paused, 4000);
  assert.strictEqual(resumed.pausedAt, null);
  assert.strictEqual(resumed.pausedTotal, 3000);
  assert.strictEqual(E.elapsed(resumed, 5000), 5000 - 0 - 3000);
});

test('pause/resume: does not mutate the input run', function () {
  var run = E.createRun(E.normalizeCfg({}), [], 0);
  var snapshot = JSON.stringify(run);
  E.pause(run, 1000);
  assert.strictEqual(JSON.stringify(run), snapshot);
  var paused = E.pause(run, 1000);
  var pausedSnapshot = JSON.stringify(paused);
  E.resume(paused, 2000);
  assert.strictEqual(JSON.stringify(paused), pausedSnapshot);
});

/* ===================================================================
 * sprint: remaining / tick
 * =================================================================== */

test('remaining: null for non-sprint modes', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'race' }), [], 0);
  assert.strictEqual(E.remaining(run, 1000), null);
});

test('remaining: at t=0 (no elapsed, no penalty) equals the literal SPRINT_MS (60000)', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  assert.strictEqual(E.remaining(run, 0), 60000);
});

test('remaining: SPRINT_MS - elapsed - penaltyMs, floored at 0', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  assert.strictEqual(E.remaining(run, 10000), E.SPRINT_MS - 10000);
  run.penaltyMs = 3000;
  assert.strictEqual(E.remaining(run, 10000), E.SPRINT_MS - 10000 - 3000);
});

test('remaining: floors at 0 when over time', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  assert.strictEqual(E.remaining(run, E.SPRINT_MS + 5000), 0);
});

test('remaining: penalty can shorten it to 0 before the clock alone would', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  run.penaltyMs = E.SPRINT_MS; // penalty alone consumes the whole sprint
  assert.strictEqual(E.remaining(run, 1000), 0);
});

test('tick: non-sprint mode always event null', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'race' }), [], 0);
  var r = E.tick(run, 999999999);
  assert.strictEqual(r.event, null);
});

test('tick: fires "done" once remaining hits 0, sets done=true', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  var mid = E.tick(run, 30000);
  assert.strictEqual(mid.event, null);
  assert.strictEqual(mid.run.done, false);
  var end = E.tick(run, E.SPRINT_MS + 1);
  assert.strictEqual(end.event, 'done');
  assert.strictEqual(end.run.done, true);
});

test('tick: already-done run stays a no-op', function () {
  var run = E.createRun(E.normalizeCfg({ mode: 'sprint' }), [], 0);
  var done = E.tick(run, E.SPRINT_MS + 1);
  var again = E.tick(done.run, E.SPRINT_MS + 2);
  assert.strictEqual(again.event, null);
});

/* ===================================================================
 * summarize / toSession
 * =================================================================== */

test('summarize: correct/misses/missed/slowest/elapsedMs/penaltyMs/totalMs', function () {
  var facts = [E.makeFact('+', 3, 5), E.makeFact('+', 2, 2), E.makeFact('+', 1, 1)];
  var cfg = E.normalizeCfg({ mode: 'race' });
  var run = E.createRun(cfg, facts, 0);
  var r = E.press(run, '8', 500);            // correct, ms 500
  r = E.press(r.run, '5', 700);               // wrong on 2+2
  r = E.press(r.run, '4', 1200);              // correct retry, wrongs=1, ms=1200-500=700
  r = E.press(r.run, '2', 1500);              // correct, last -> done, ms=1500-1200=300
  var summary = E.summarize(r.run, 1600);
  assert.strictEqual(summary.mode, 'race');
  assert.strictEqual(summary.n, 3);
  assert.strictEqual(summary.correct, 2);
  assert.strictEqual(summary.misses, 1);
  assert.strictEqual(summary.missed.length, 1);
  assert.strictEqual(summary.missed[0].key, facts[1].key);
  assert.strictEqual(summary.slowest.length, 2, 'only wrongs==0 results are eligible');
  assert.ok(summary.slowest[0].ms >= summary.slowest[summary.slowest.length - 1].ms, 'sorted desc by ms');
  assert.strictEqual(summary.elapsedMs, 1600);
  assert.strictEqual(summary.penaltyMs, E.PENALTY_MS);
  assert.strictEqual(summary.totalMs, 1600 + E.PENALTY_MS);
});

test('summarize: missed lists distinct keys in first-seen order', function () {
  var facts = [E.makeFact('+', 3, 5), E.makeFact('+', 2, 2), E.makeFact('+', 1, 6)];
  var cfg = E.normalizeCfg({ mode: 'practice' }); // no penalty, simplifies the walk
  var run = E.createRun(cfg, facts, 0);
  var r = E.press(run, '9', 100);  // wrong for 3+5=8
  r = E.press(r.run, '8', 200);    // correct retry
  r = E.press(r.run, '9', 300);    // wrong for 2+2=4
  r = E.press(r.run, '4', 400);    // correct retry
  r = E.press(r.run, '0', 500);    // wrong for 1+6=7
  r = E.press(r.run, '7', 600);    // correct, done
  var summary = E.summarize(r.run, 700);
  assert.strictEqual(summary.missed.length, 3);
  assert.deepStrictEqual(summary.missed.map(function (f) { return f.key; }), [facts[0].key, facts[1].key, facts[2].key]);
});

test('toSession: fills ts/cfgKey/label from cfg + summary', function () {
  var cfg = E.normalizeCfg({ ops: ['+', '-'], mode: 'race' });
  var summary = { mode: 'race', n: 5, correct: 5, misses: 0, elapsedMs: 1000, penaltyMs: 0, totalMs: 1000 };
  var session = E.toSession(cfg, summary, 99999);
  assert.strictEqual(session.ts, 99999);
  assert.strictEqual(session.mode, 'race');
  assert.strictEqual(session.cfgKey, E.cfgKey(cfg));
  assert.strictEqual(session.label, E.cfgLabel(cfg));
  assert.strictEqual(session.n, 5);
  assert.strictEqual(session.correct, 5);
  assert.strictEqual(session.misses, 0);
  assert.strictEqual(session.elapsedMs, 1000);
  assert.strictEqual(session.penaltyMs, 0);
  assert.strictEqual(session.totalMs, 1000);
});

/* ===================================================================
 * cfgKey
 * =================================================================== */

test('cfgKey: op order is insensitive', function () {
  var k1 = E.cfgKey({ ops: ['+', '-'], mode: 'race', length: 20 });
  var k2 = E.cfgKey({ ops: ['-', '+'], mode: 'race', length: 20 });
  assert.strictEqual(k1, k2);
});

test('cfgKey: addsub-only cfg excludes tables/max (irrelevant fields)', function () {
  var k1 = E.cfgKey({ ops: ['+', '-'], tables: [7], max: 10, mode: 'race', length: 20 });
  var k2 = E.cfgKey({ ops: ['+', '-'], tables: [8, 9], max: 12, mode: 'race', length: 20 });
  assert.strictEqual(k1, k2, 'tables/max do not affect an addsub-only key');
});

test('cfgKey: x/div-only cfg excludes addRange (irrelevant field)', function () {
  var k1 = E.cfgKey({ ops: ['x'], addRange: 10, tables: [7], max: 12, mode: 'race', length: 20 });
  var k2 = E.cfgKey({ ops: ['x'], addRange: 20, tables: [7], max: 12, mode: 'race', length: 20 });
  assert.strictEqual(k1, k2, 'addRange does not affect an x/div-only key');
});

test('cfgKey: coach and hand-picked sets never share a best, add/sub included', function () {
  var base = { ops: ['+', '-'], addRange: 10, mode: 'race', length: 20 };
  var coach = { ops: ['+', '-'], addRange: 10, mode: 'race', length: 20, coach: true };
  assert.notStrictEqual(E.cfgKey(base), E.cfgKey(coach));
});

test('cfgKey: an in-order single-table race never shares a best with the random one', function () {
  // Review finding #9: 1x7, 2x7, ... in order is easier than random x7.
  var rnd = { ops: ['x'], tables: [7], max: 12, mode: 'race', length: 20, order: 'random' };
  var ord = { ops: ['x'], tables: [7], max: 12, mode: 'race', length: 20, order: 'ordered' };
  assert.notStrictEqual(E.cfgKey(rnd), E.cfgKey(ord));
  // order is irrelevant (and ignored) when it cannot apply: two tables
  var rnd2 = { ops: ['x'], tables: [7, 8], max: 12, mode: 'race', length: 20, order: 'random' };
  var ord2 = { ops: ['x'], tables: [7, 8], max: 12, mode: 'race', length: 20, order: 'ordered' };
  assert.strictEqual(E.cfgKey(rnd2), E.cfgKey(ord2));
});

test('v1.1 normalizeCfg keeps a valid skill id + label, drops junk', function () {
  var c = E.normalizeCfg({ ops: ['+'], skill: 'add-10', label: 'Addition to 10' });
  assert.strictEqual(c.skill, 'add-10');
  assert.strictEqual(c.label, 'Addition to 10');
  var bad = E.normalizeCfg({ ops: ['+'], skill: 'Add 10!<script>', label: 42 });
  assert.strictEqual(bad.skill, undefined);
  assert.strictEqual(bad.label, undefined);
  var long = E.normalizeCfg({ ops: ['+'], label: new Array(60).join('x') });
  assert.ok(long.label.length <= 40);
});

test('v1.1 cfgKey: a skill set keys by its skill id; coach sets keep their tables', function () {
  var a = E.cfgKey({ ops: ['x'], tables: [2, 5, 10], max: 10, coach: true, skill: 'x-2-5-10', mode: 'race', length: 10 });
  var b = E.cfgKey({ ops: ['x'], tables: [3, 4], max: 10, coach: true, skill: 'x-3-4', mode: 'race', length: 10 });
  assert.ok(/sk:x-2-5-10/.test(a), a);
  assert.notStrictEqual(a, b);
  var c1 = E.cfgKey({ ops: ['x'], tables: [6, 7], max: 10, coach: true, mode: 'race', length: 10 });
  var c2 = E.cfgKey({ ops: ['x'], tables: [8, 9], max: 10, coach: true, mode: 'race', length: 10 });
  assert.notStrictEqual(c1, c2, 'two coach sets over different tables must not share a best');
});

test('v1.1 cfgLabel: an explicit label wins (skill names in history)', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['+'], addRange: 10, label: 'Addition to 10' }), 'Addition to 10');
});

test('cfgKey: length is excluded for sprint mode', function () {
  var k1 = E.cfgKey({ ops: ['+'], mode: 'sprint', length: 10 });
  var k2 = E.cfgKey({ ops: ['+'], mode: 'sprint', length: 30 });
  assert.strictEqual(k1, k2, 'length is irrelevant for sprint grouping');
});

test('cfgKey: length IS included for race and practice modes', function () {
  var kRace10 = E.cfgKey({ ops: ['+'], mode: 'race', length: 10 });
  var kRace30 = E.cfgKey({ ops: ['+'], mode: 'race', length: 30 });
  assert.notStrictEqual(kRace10, kRace30);
  var kPrac10 = E.cfgKey({ ops: ['+'], mode: 'practice', length: 10 });
  var kPrac30 = E.cfgKey({ ops: ['+'], mode: 'practice', length: 30 });
  assert.notStrictEqual(kPrac10, kPrac30);
});

test('cfgKey: different cfgs produce different keys', function () {
  var k1 = E.cfgKey({ ops: ['+', '-'], addRange: 10, mode: 'race', length: 20 });
  var k2 = E.cfgKey({ ops: ['+', '-'], addRange: 20, mode: 'race', length: 20 });
  assert.notStrictEqual(k1, k2);
});

/* ===================================================================
 * cfgLabel
 * =================================================================== */

test('cfgLabel: addsub example matches the spec verbatim', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['+', '-'], addRange: 10 }), '+ − to 10');
});

test('cfgLabel: tables example matches the spec verbatim', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['x'], tables: [7, 8], max: 12 }), '× 7 8 to 12');
});

test('cfgLabel: coach replaces the table list (coach picks from all tables)', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['x', '/'], tables: [], max: 10, coach: true }), '× ÷ coach to 10');
  assert.strictEqual(E.cfgLabel({ ops: ['x'], tables: [7], max: 12, coach: true }), '× coach to 12');
});

test('cfgLabel: mixed keeps each op group next to its own range (no ambiguous run-on)', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['+', '-', 'x', '/'], addRange: 20, tables: [6, 7, 8], max: 12 }), '+ − to 20, × ÷ 6 7 8 to 12');
});

test('cfgLabel: add/sub-only coach marks coach after the range', function () {
  assert.strictEqual(E.cfgLabel({ ops: ['+'], addRange: 10, coach: true }), '+ to 10 coach');
});

test('cfgLabel: never contains an em dash or en dash character', function () {
  var configs = [
    { ops: ['+', '-'], addRange: 20 },
    { ops: ['x'], tables: [2, 3, 4], max: 11 },
    { ops: ['/'], tables: [], max: 12, coach: true },
    { ops: ['+', '-', 'x', '/'], addRange: 10, tables: [5], max: 10, coach: true }
  ];
  configs.forEach(function (c) {
    var label = E.cfgLabel(c);
    assert.ok(label.indexOf('—') === -1, 'no em dash in: ' + label);
    assert.ok(label.indexOf('–') === -1, 'no en dash in: ' + label);
  });
});

/* ===================================================================
 * isBetter
 * =================================================================== */

test('isBetter: any a beats a null b', function () {
  assert.strictEqual(E.isBetter({ mode: 'race', totalMs: 500 }, null), true);
});

test('isBetter: null a never beats anything', function () {
  assert.strictEqual(E.isBetter(null, { mode: 'race', totalMs: 500 }), false);
});

test('isBetter: race/practice - lower totalMs wins', function () {
  assert.strictEqual(E.isBetter({ mode: 'race', totalMs: 100 }, { mode: 'race', totalMs: 200 }), true);
  assert.strictEqual(E.isBetter({ mode: 'race', totalMs: 300 }, { mode: 'race', totalMs: 200 }), false);
  assert.strictEqual(E.isBetter({ mode: 'practice', totalMs: 100 }, { mode: 'practice', totalMs: 200 }), true);
});

test('isBetter: sprint - more answered (n) wins, even with more misses', function () {
  // Every sprint answer is eventually correct (retry-same-fact); a miss already
  // cost 3s of the 60, so the score is how many were answered.
  assert.strictEqual(E.isBetter({ mode: 'sprint', n: 12, correct: 8, misses: 4 }, { mode: 'sprint', n: 10, correct: 10, misses: 0 }), true);
  assert.strictEqual(E.isBetter({ mode: 'sprint', n: 9, correct: 9, misses: 0 }, { mode: 'sprint', n: 10, correct: 6, misses: 4 }), false);
});

test('isBetter: sprint - tie on answered breaks on fewer misses', function () {
  assert.strictEqual(E.isBetter({ mode: 'sprint', n: 10, correct: 9, misses: 1 }, { mode: 'sprint', n: 10, correct: 7, misses: 3 }), true);
  assert.strictEqual(E.isBetter({ mode: 'sprint', n: 10, correct: 7, misses: 3 }, { mode: 'sprint', n: 10, correct: 9, misses: 1 }), false);
});

/* ===================================================================
 * gridFor
 * =================================================================== */

test('gridFor "+": 9x9, null cells when To10 and a+b>10', function () {
  var g = E.gridFor('+', E.normalizeCfg({ addRange: 10 }));
  assert.deepStrictEqual(g.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepStrictEqual(g.cols, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.strictEqual(g.cells.length, 9);
  assert.strictEqual(g.cells[0].length, 9);
  assert.strictEqual(g.cells[0][0], E.makeFact('+', 1, 1).key); // 1+1=2 <= 10
  assert.strictEqual(g.cells[8][8], null); // 9+9=18 > 10
});

test('gridFor "+": To20 has no null cells (max sum 18 always valid)', function () {
  var g = E.gridFor('+', E.normalizeCfg({ addRange: 20 }));
  var anyNull = g.cells.some(function (row) { return row.some(function (c) { return c === null; }); });
  assert.strictEqual(anyNull, false);
});

test('gridFor "-": 9x9, null cells when To10 and x+b>10', function () {
  var g = E.gridFor('-', E.normalizeCfg({ addRange: 10 }));
  assert.strictEqual(g.cells.length, 9);
  assert.strictEqual(g.cells[8][8], null); // b=9 (row), x=9 (col) -> x+b=18 > 10
  assert.strictEqual(g.cells[0][0], E.makeFact('-', 2, 1).key); // b=1,x=1 -> a=2, 2<=10 valid
});

test('gridFor "x": rows 2..12, cols 1..max, no null cells', function () {
  var g = E.gridFor('x', E.normalizeCfg({ max: 10 }));
  assert.deepStrictEqual(g.rows, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepStrictEqual(g.cols, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  var anyNull = g.cells.some(function (row) { return row.some(function (c) { return c === null; }); });
  assert.strictEqual(anyNull, false);
});

test('gridFor "/": rows 2..12 (divisor), cols 1..max (quotient), no null cells', function () {
  var g = E.gridFor('/', E.normalizeCfg({ max: 12 }));
  assert.deepStrictEqual(g.rows, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepStrictEqual(g.cols, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.strictEqual(g.cells[0][0], E.makeFact('/', 2, 2).key); // divisor 2, quotient 1 -> dividend 2
});

/* ===================================================================
 * mastery
 * =================================================================== */

test('mastery: no stat -> new', function () {
  assert.strictEqual(E.mastery(null), 'new');
  assert.strictEqual(E.mastery(undefined), 'new');
});

test('mastery: box 0 -> weak', function () {
  assert.strictEqual(E.mastery({ box: 0 }), 'weak');
});

test('mastery: box 1-2 -> learning', function () {
  assert.strictEqual(E.mastery({ box: 1 }), 'learning');
  assert.strictEqual(E.mastery({ box: 2 }), 'learning');
});

test('mastery: box 3-4 -> strong', function () {
  assert.strictEqual(E.mastery({ box: 3 }), 'strong');
  assert.strictEqual(E.mastery({ box: 4 }), 'strong');
});

/* ===================================================================
 * rng determinism
 * =================================================================== */

test('rng: same seed produces the same sequence (deterministic)', function () {
  var r1 = E.rng(42), r2 = E.rng(42);
  var seq1 = [r1(), r1(), r1()];
  var seq2 = [r2(), r2(), r2()];
  assert.deepStrictEqual(seq1, seq2);
});

test('rng: values stay in [0, 1)', function () {
  var r = E.rng(7);
  for (var i = 0; i < 100; i++) {
    var v = r();
    assert.ok(v >= 0 && v < 1, 'value out of range: ' + v);
  }
});

/* ===================================================================
 * Constants - pinned against the spec's LITERAL values (not
 * self-referential against E.* - a mutated constant must fail these).
 * =================================================================== */

test('constants match the documented literal values', function () {
  assert.strictEqual(E.PENALTY_MS, 3000);
  assert.strictEqual(E.SPRINT_MS, 60000);
  assert.strictEqual(E.REVEAL_AFTER, 2);
  assert.strictEqual(E.NEW_CAP, 3);
  assert.strictEqual(E.COACH_MIN_SEEN, 5);
  assert.deepStrictEqual(E.OPS, ['+', '-', 'x', '/']);
  assert.deepStrictEqual(E.TABLES, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepStrictEqual(E.MAXES, [10, 11, 12]);
  assert.deepStrictEqual(E.LENGTHS, [10, 20, 30]);
  assert.strictEqual(E.GLYPH['+'], '+');
  assert.strictEqual(E.GLYPH['-'], '−');
  assert.strictEqual(E.GLYPH['x'], '×');
  assert.strictEqual(E.GLYPH['/'], '÷');
});

/* ===================================================================
 * Review round 2 (SHA 2aa2dc0): mastery spacing + v1 coach bests
 * =================================================================== */

function fact2(key, a, b, answer) { return { key: key, a: a, b: b, op: '+', answer: answer, text: a + ' + ' + b }; }

test('review#4: a fact right first try twice in ONE run only moves ok by one (runStart given)', function () {
  var f = fact2('+:4:5', 4, 5, 9), runStart = 1000;
  var s = E.recordAnswer({}, { fact: f, wrongs: 0, ms: 900 }, 2000, runStart);
  s = E.recordAnswer(s, { fact: f, wrongs: 0, ms: 900 }, 3000, runStart);
  assert.strictEqual(s['+:4:5'].ok, 1, 'drilled twice in one sitting must not be solid');
  assert.strictEqual(s['+:4:5'].n, 2, 'both answers still counted');
});

test('review#4: the same fact right first try in two SEPARATE runs reaches ok 2', function () {
  var f = fact2('+:4:5', 4, 5, 9);
  var s = E.recordAnswer({}, { fact: f, wrongs: 0, ms: 900 }, 2000, 1000);
  s = E.recordAnswer(s, { fact: f, wrongs: 0, ms: 900 }, 9000, 8000);
  assert.strictEqual(s['+:4:5'].ok, 2);
});

test('review#4: a miss inside the run still resets ok to 0', function () {
  var f = fact2('+:4:5', 4, 5, 9);
  var s = { '+:4:5': { n: 3, miss: 0, box: 2, ms: 900, last: 500, ok: 1 } };
  s = E.recordAnswer(s, { fact: f, wrongs: 0, ms: 900 }, 2000, 1000);
  s = E.recordAnswer(s, { fact: f, wrongs: 1, ms: 900 }, 3000, 1000);
  assert.strictEqual(s['+:4:5'].ok, 0);
});

test('review#4: without runStart the streak rule is unchanged (back-compat)', function () {
  var f = fact2('+:4:5', 4, 5, 9);
  var s = E.recordAnswer({}, { fact: f, wrongs: 0, ms: 900 }, 2000);
  s = E.recordAnswer(s, { fact: f, wrongs: 0, ms: 900 }, 3000);
  assert.strictEqual(s['+:4:5'].ok, 2);
});

test('review#14: a Custom coach set (no tables) keeps its v1 best key', function () {
  // v1 keyed every x/div coach set as 'coach'; v1.1 must not orphan those bests.
  assert.strictEqual(E.cfgKey({ ops: ['x'], tables: [], max: 10, coach: true, mode: 'race', length: 20 }), 'race|x|coach|m10|l20');
  assert.strictEqual(E.cfgKey({ ops: ['x', '/'], tables: [], max: 12, coach: true, mode: 'sprint' }), 'sprint|x/|coach|m12');
});

/* ===================================================================
 * PRESETS / DEFAULT_CFG shape
 * =================================================================== */

test('DEFAULT_CFG matches the documented literal', function () {
  assert.deepStrictEqual(E.DEFAULT_CFG, {
    ops: ['+', '-'], addRange: 10, tables: [], max: 10,
    order: 'random', coach: false, mode: 'race', length: 20
  });
});

test('PRESETS.addsub / PRESETS.tables match the documented shape and are independent objects', function () {
  assert.deepStrictEqual(E.PRESETS.addsub.ops, ['+', '-']);
  assert.deepStrictEqual(E.PRESETS.tables.ops, ['x']);
  assert.strictEqual(E.PRESETS.tables.addRange, E.DEFAULT_CFG.addRange);
  E.PRESETS.addsub.ops.push('zzz'); // mutate the returned preset
  assert.deepStrictEqual(E.PRESETS.tables.ops, ['x'], 'PRESETS.tables.ops unaffected by mutating PRESETS.addsub.ops');
});

run();
