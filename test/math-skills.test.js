/* =====================================================================
 * math-skills.test.js  -  unit tests for the skills/competency module
 * (math/skills.js): the 12-skill path, per-skill progress + stars,
 * earned-stars persistence, bands, skillCfg, and the portable
 * skill-competency-profile/v1 export/import.
 * Run: node test/math-skills.test.js   (pure Node assert, no deps)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MS = require('../math/skills.js');
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

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

/* ===================================================================
 * SKILLS path
 * =================================================================== */

test('SKILLS: 12 skills in the exact order with the exact ids', function () {
  var expectedIds = [
    'add-10', 'sub-10', 'add-20', 'sub-20', 'x-2-5-10', 'x-3-4',
    'x-6-7', 'x-8-9', 'div-2-5-10', 'div-3-9', 'x-11-12', 'x-all-12'
  ];
  assert.deepStrictEqual(MS.SKILLS.map(function (s) { return s.id; }), expectedIds);
  assert.strictEqual(MS.SKILLS.length, 12);
});

test('FRAMEWORK carries the arithmetic-facts contract id and the same SKILLS array', function () {
  assert.strictEqual(MS.FRAMEWORK.id, 'arithmetic-facts');
  assert.strictEqual(MS.FRAMEWORK.name, 'Math facts');
  assert.strictEqual(MS.FRAMEWORK.discipline, 'math');
  assert.strictEqual(MS.FRAMEWORK.skills, MS.SKILLS);
});

test('skillById resolves known ids and returns null for unknown', function () {
  assert.strictEqual(MS.skillById('add-10').name, 'Addition to 10');
  assert.strictEqual(MS.skillById('x-all-12').short, '×all');
  assert.strictEqual(MS.skillById('nonexistent'), null);
  assert.strictEqual(MS.skillById(undefined), null);
});

test('no em/en dash or semicolon in any name/short/desc', function () {
  var forbidden = /[–—;]/;
  MS.SKILLS.forEach(function (sk) {
    ['name', 'short', 'desc'].forEach(function (field) {
      assert.ok(!forbidden.test(sk[field]), sk.id + '.' + field + ' has a forbidden char: ' + JSON.stringify(sk[field]));
    });
  });
});

/* ===================================================================
 * factKeys
 * =================================================================== */

test('every skill: factKeys non-empty, distinct, sorted, and matches the engine pool', function () {
  MS.SKILLS.forEach(function (sk) {
    var keys = MS.factKeys(sk);
    assert.ok(keys.length > 0, sk.id + ' factKeys should be non-empty');

    var seen = {};
    keys.forEach(function (k) {
      assert.ok(!seen[k], sk.id + ' duplicate key ' + k);
      seen[k] = true;
    });

    for (var i = 1; i < keys.length; i++) {
      assert.ok(keys[i - 1] <= keys[i], sk.id + ' factKeys not sorted at index ' + i);
    }

    // independently recomputed from the engine, not via MS.factKeys' own logic
    var cfg = E.normalizeCfg(sk.cfg);
    var expected = {};
    cfg.ops.forEach(function (op) {
      E.pool(op, cfg).forEach(function (f) { expected[f.key] = true; });
    });
    assert.deepStrictEqual(keys, Object.keys(expected).sort(), sk.id + ' factKeys should match the engine pool');
  });
});

test('add-10 factKeys count is verified dynamically from the engine (not assumed)', function () {
  var sk = MS.skillById('add-10');
  var cfg = E.normalizeCfg(sk.cfg);
  var expectedCount = Object.keys(E.pool('+', cfg).reduce(function (m, f) { m[f.key] = 1; return m; }, {})).length;
  assert.strictEqual(MS.factKeys(sk).length, expectedCount);
  assert.ok(expectedCount > 0);
});

/* ===================================================================
 * progress
 * =================================================================== */

test('progress on empty stats: 0 stars, level 0, everything else zeroed', function () {
  var sk = MS.skillById('add-10');
  var pr = MS.progress(sk, {});
  assert.ok(pr.total > 0);
  assert.strictEqual(pr.seen, 0);
  assert.strictEqual(pr.right, 0);
  assert.strictEqual(pr.solid, 0);
  assert.strictEqual(pr.level, 0);
  assert.strictEqual(pr.stars, 0);
  assert.strictEqual(pr.mastered, false);
  assert.strictEqual(pr.medianMs, null);
});

test('stars boundaries: just under half -> 0, half right first try -> 1, all right once -> 2, all solid -> 3', function () {
  // div-2-5-10 has an EVEN factKeys total, so "2*right >= total" is tested
  // exactly at equality (2*right === total) rather than with strict slack -
  // an odd-total skill would let a >= vs > mutation slip through undetected.
  var sk = MS.skillById('div-2-5-10');
  var keys = MS.factKeys(sk);
  var total = keys.length;
  assert.strictEqual(total % 2, 0, 'this test relies on an even-total skill');
  var halfNeeded = Math.ceil(total / 2);

  var statsUnder = {};
  keys.slice(0, halfNeeded - 1).forEach(function (k) { statsUnder[k] = { n: 1, ok: 1 }; });
  assert.strictEqual(MS.progress(sk, statsUnder).stars, 0, 'just under half right should be 0 stars');

  var statsHalf = {};
  keys.slice(0, halfNeeded).forEach(function (k) { statsHalf[k] = { n: 1, ok: 1 }; });
  assert.strictEqual(MS.progress(sk, statsHalf).stars, 1, 'half right first try should be 1 star');

  var statsAllRight = {};
  keys.forEach(function (k) { statsAllRight[k] = { n: 1, ok: 1 }; });
  assert.strictEqual(MS.progress(sk, statsAllRight).stars, 2, 'every fact right once should be 2 stars');

  var statsSolid = {};
  keys.forEach(function (k) { statsSolid[k] = { n: 2, ok: 2 }; });
  var prSolid = MS.progress(sk, statsSolid);
  assert.strictEqual(prSolid.stars, 3, 'every fact solid should be 3 stars');
  assert.strictEqual(prSolid.mastered, true);
});

test('ok garbage or missing values are treated as 0, never counted as right/solid', function () {
  var sk = MS.skillById('add-10');
  var keys = MS.factKeys(sk);
  var stats = {};
  stats[keys[0]] = { n: 1, ok: 'abc' };
  stats[keys[1]] = { n: 1, ok: -5 };
  stats[keys[2]] = { n: 1, ok: NaN };
  stats[keys[3]] = { n: 1 }; // ok entirely missing
  // keys[4..] absent from stats entirely

  var pr = MS.progress(sk, stats);
  assert.strictEqual(pr.right, 0, 'garbage/missing ok must never count as right');
  assert.strictEqual(pr.solid, 0);
  assert.strictEqual(pr.seen, 4, 'n >= 1 entries still count as seen regardless of ok');
});

test('level formula: round(100 * sum(min(ok,2)) / (2*total))', function () {
  var sk = MS.skillById('x-6-7');
  var keys = MS.factKeys(sk);
  var total = keys.length;
  var okList = keys.map(function (_, i) { return i % 3; }); // 0,1,2,0,1,2,...
  var stats = {};
  keys.forEach(function (k, i) { stats[k] = { n: 1, ok: okList[i] }; });

  var sumMinOk2 = okList.reduce(function (s, ok) { return s + Math.min(ok, 2); }, 0);
  var expectedLevel = Math.round(100 * sumMinOk2 / (2 * total));
  assert.strictEqual(MS.progress(sk, stats).level, expectedLevel);
});

test('medianMs: median over seen keys with ms > 0, excludes ms<=0, null when none', function () {
  var sk = MS.skillById('x-8-9');
  var keys = MS.factKeys(sk);

  var statsZero = {};
  keys.slice(0, 3).forEach(function (k) { statsZero[k] = { n: 1, ok: 1, ms: 0 }; });
  assert.strictEqual(MS.progress(sk, statsZero).medianMs, null, 'ms=0 entries must be excluded, leaving no median');

  var statsOdd = {};
  [1000, 2000, 3000].forEach(function (ms, i) { statsOdd[keys[i]] = { n: 1, ok: 1, ms: ms }; });
  assert.strictEqual(MS.progress(sk, statsOdd).medianMs, 2000);

  var statsEven = {};
  [1000, 2000, 3000, 4000].forEach(function (ms, i) { statsEven[keys[i]] = { n: 1, ok: 1, ms: ms }; });
  assert.strictEqual(MS.progress(sk, statsEven).medianMs, 2500);
});

/* ===================================================================
 * path
 * =================================================================== */

test('path: upNext moves past a mastered skill, and is null when all 12 are mastered', function () {
  var earned = {};
  earned[MS.SKILLS[0].id] = { stars: 3, masteredAt: 1000 };
  var p1 = MS.path({}, earned);
  assert.strictEqual(p1.upNext, MS.SKILLS[1].id, 'upNext should skip the mastered first skill');
  assert.strictEqual(p1.masteredCount, 1);
  assert.strictEqual(p1.skills.length, 12);
  assert.strictEqual(p1.skills[0].stars, 3);
  assert.strictEqual(p1.skills[0].masteredAt, 1000);

  var earnedAll = {};
  MS.SKILLS.forEach(function (sk) { earnedAll[sk.id] = { stars: 3, masteredAt: 1 }; });
  var pAll = MS.path({}, earnedAll);
  assert.strictEqual(pAll.upNext, null, 'upNext should be null when all 12 are mastered');
  assert.strictEqual(pAll.masteredCount, 12);
});

test('path: per-skill stars is max(earned stars, live progress stars)', function () {
  var sk = MS.skillById('sub-20');
  var earned = {};
  earned[sk.id] = { stars: 2, masteredAt: null };
  // live stats currently compute to 0 stars (empty) - earned should win.
  var p = MS.path({}, earned);
  var entry = p.skills.filter(function (e) { return e.skill.id === sk.id; })[0];
  assert.strictEqual(entry.stars, 2);
});

test('band thresholds: 3 mastered -> beginner, 4 -> intermediate, 8 -> intermediate, 9 -> advanced', function () {
  function earnedFor(n) {
    var e = {};
    for (var i = 0; i < n; i++) e[MS.SKILLS[i].id] = { stars: 3, masteredAt: 1 };
    return e;
  }
  assert.strictEqual(MS.path({}, earnedFor(0)).band, 'beginner');
  assert.strictEqual(MS.path({}, earnedFor(3)).band, 'beginner');
  assert.strictEqual(MS.path({}, earnedFor(4)).band, 'intermediate');
  assert.strictEqual(MS.path({}, earnedFor(8)).band, 'intermediate');
  assert.strictEqual(MS.path({}, earnedFor(9)).band, 'advanced');
  assert.strictEqual(MS.path({}, earnedFor(12)).band, 'advanced');
});

/* ===================================================================
 * updateEarned
 * =================================================================== */

test('updateEarned: stars rise, never fall after a miss resets ok, masteredAt stamped once and kept, gains + mastered lists, inputs unchanged', function () {
  var sk = MS.skillById('div-2-5-10');
  var keys = MS.factKeys(sk);

  // Call 1: half right -> gain to 1 star, not mastered.
  var stats1 = {};
  keys.slice(0, Math.ceil(keys.length / 2)).forEach(function (k) { stats1[k] = { n: 1, ok: 1 }; });
  var earned0 = {};
  var earned0Snap = deepClone(earned0);
  var stats1Snap = deepClone(stats1);

  var r1 = MS.updateEarned(earned0, stats1, 1000);
  assert.deepStrictEqual(earned0, earned0Snap, 'updateEarned must not mutate its earned input');
  assert.deepStrictEqual(stats1, stats1Snap, 'updateEarned must not mutate its stats input');
  assert.strictEqual(r1.earned[sk.id].stars, 1);
  assert.strictEqual(r1.earned[sk.id].masteredAt, null);
  var gain1 = r1.gains.filter(function (g) { return g.id === sk.id; })[0];
  assert.deepStrictEqual(gain1, { id: sk.id, from: 0, to: 1 });
  assert.strictEqual(r1.mastered.indexOf(sk.id), -1);

  // Call 2: all solid -> masters, stamps masteredAt = now.
  var stats2 = {};
  keys.forEach(function (k) { stats2[k] = { n: 2, ok: 2 }; });
  var r2 = MS.updateEarned(r1.earned, stats2, 2000);
  assert.strictEqual(r2.earned[sk.id].stars, 3);
  assert.strictEqual(r2.earned[sk.id].masteredAt, 2000);
  assert.ok(r2.mastered.indexOf(sk.id) !== -1, 'should be listed as newly mastered on the call it reaches 3');
  var gain2 = r2.gains.filter(function (g) { return g.id === sk.id; })[0];
  assert.deepStrictEqual(gain2, { id: sk.id, from: 1, to: 3 });

  // Call 3: a miss resets ok to 0 everywhere (live progress crashes to 0 stars) -
  // earned stars must not fall, masteredAt must be kept (not re-stamped).
  var stats3 = {};
  keys.forEach(function (k) { stats3[k] = { n: 3, ok: 0 }; });
  var r3 = MS.updateEarned(r2.earned, stats3, 3000);
  assert.strictEqual(r3.earned[sk.id].stars, 3, 'earned stars must never fall after a miss');
  assert.strictEqual(r3.earned[sk.id].masteredAt, 2000, 'masteredAt must be kept, not re-stamped to the later now');
  assert.strictEqual(r3.gains.filter(function (g) { return g.id === sk.id; }).length, 0, 'no gain when stars did not rise');
  assert.strictEqual(r3.mastered.indexOf(sk.id), -1, 'not re-listed as newly mastered');
});

test('updateEarned always emits all 12 skill ids, even from an empty earned map', function () {
  var r = MS.updateEarned({}, {}, 500);
  assert.strictEqual(Object.keys(r.earned).length, 12);
  MS.SKILLS.forEach(function (sk) {
    assert.strictEqual(r.earned[sk.id].stars, 0);
    assert.strictEqual(r.earned[sk.id].masteredAt, null);
  });
  assert.deepStrictEqual(r.gains, []);
  assert.deepStrictEqual(r.mastered, []);
});

/* ===================================================================
 * skillCfg
 * =================================================================== */

test('skillCfg: coach true, skill id, label, ops/tables/max/addRange from the skill, order random, keeps base mode/length', function () {
  var sk = MS.skillById('x-3-4');
  var cfg = MS.skillCfg(sk, { mode: 'sprint', length: 30 });
  assert.strictEqual(cfg.coach, true);
  assert.strictEqual(cfg.skill, 'x-3-4');
  assert.strictEqual(cfg.label, 'Times 3 and 4');
  assert.strictEqual(cfg.order, 'random');
  assert.strictEqual(cfg.mode, 'sprint');
  assert.strictEqual(cfg.length, 30);
  assert.deepStrictEqual(cfg.ops, ['x']);
  assert.deepStrictEqual(cfg.tables, [3, 4]);
  assert.strictEqual(cfg.max, 10);
});

test('skillCfg: an addRange skill carries its own addRange; base is ignored for skill-owned fields', function () {
  var sk = MS.skillById('add-20');
  var cfg = MS.skillCfg(sk, { mode: 'practice', length: 10, addRange: 10, ops: ['x'] });
  assert.strictEqual(cfg.addRange, 20, 'the skill\'s own addRange wins over base');
  assert.deepStrictEqual(cfg.ops, ['+'], 'the skill\'s own ops win over base');
  assert.strictEqual(cfg.mode, 'practice');
  assert.strictEqual(cfg.length, 10);
});

test('skillCfg: falls back to engine defaults for mode/length when base is omitted', function () {
  var sk = MS.skillById('add-10');
  var cfg = MS.skillCfg(sk, undefined);
  assert.strictEqual(cfg.mode, 'race');
  assert.strictEqual(cfg.length, 20);
  assert.strictEqual(cfg.skill, 'add-10');
  assert.strictEqual(cfg.label, 'Addition to 10');
});

/* ===================================================================
 * exportProfile
 * =================================================================== */

test('exportProfile: schema, discipline, 12 competencies, ISO dates, evidence_count, facts+earned carried (cloned)', function () {
  var sk = MS.skillById('add-10');
  var keys = MS.factKeys(sk);
  var stats = {};
  stats[keys[0]] = { n: 3, ok: 2, ms: 1500, last: 5000 };
  stats[keys[1]] = { n: 1, ok: 1, ms: 2000, last: 9000 };
  var earned = {};
  earned[sk.id] = { stars: 2, masteredAt: null };

  var now = 123456789000;
  var doc = MS.exportProfile('Kid A', stats, earned, now);

  assert.strictEqual(doc.schema, 'skill-competency-profile/v1');
  assert.strictEqual(doc.skill, 'arithmetic-facts');
  assert.strictEqual(doc.discipline, 'math');
  assert.strictEqual(doc.player, 'Kid A');
  assert.strictEqual(doc.updated, new Date(now).toISOString());
  assert.strictEqual(doc.provenance.length, 1);
  assert.strictEqual(doc.provenance[0].source, 'app:math');
  assert.strictEqual(doc.provenance[0].at, new Date(now).toISOString());
  assert.strictEqual(doc.competencies.length, 12);

  var comp = doc.competencies.filter(function (c) { return c.id === 'add-10'; })[0];
  assert.strictEqual(comp.target, 100);
  assert.strictEqual(comp.evidence_count, 4); // 3 + 1
  assert.strictEqual(comp.last_evidence, new Date(9000).toISOString());
  assert.strictEqual(comp.stars, 2);
  assert.strictEqual(comp.name, 'Addition to 10');
  assert.strictEqual(comp.desc, sk.desc);

  assert.deepStrictEqual(doc.facts, stats);
  assert.deepStrictEqual(doc.earned, earned);
  assert.notStrictEqual(doc.facts, stats, 'facts must be a clone, not the same reference');
  assert.notStrictEqual(doc.earned, earned, 'earned must be a clone, not the same reference');
});

test('exportProfile: a competency with no evidence gets evidence_count 0 and last_evidence null', function () {
  var doc = MS.exportProfile('Kid B', {}, {}, 1000);
  doc.competencies.forEach(function (c) {
    assert.strictEqual(c.evidence_count, 0);
    assert.strictEqual(c.last_evidence, null);
    assert.strictEqual(c.stars, 0);
    assert.strictEqual(c.level, 0);
  });
});

/* ===================================================================
 * importProfile
 * =================================================================== */

test('importProfile round-trip: export then import into empty reproduces stats/earned', function () {
  var sk = MS.skillById('x-11-12');
  var keys = MS.factKeys(sk);
  var stats = {};
  stats[keys[0]] = { n: 4, ok: 2, ms: 1200, last: 8000, box: 3 };
  stats[keys[1]] = { n: 1, ok: 0, ms: 3000, last: 9000, box: 0 };
  var earned = {};
  earned[sk.id] = { stars: 3, masteredAt: 7000 };

  var doc = MS.exportProfile('Kid C', stats, earned, 10000);
  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(r.stats, stats);
  assert.deepStrictEqual(r.earned, earned);
});

test('importProfile accepts a JSON string as well as a parsed object', function () {
  var doc = MS.exportProfile('Kid D', {}, {}, 1000);
  var r = MS.importProfile(JSON.stringify(doc), {}, {});
  assert.strictEqual(r.ok, true);
});

test('importProfile merge: larger n wins per fact key', function () {
  var local = { 'x:2:3': { n: 2, ok: 1, last: 100 } };
  var incoming = { 'x:2:3': { n: 5, ok: 2, last: 50 } };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incoming, earned: {} };
  var r = MS.importProfile(doc, local, {});
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.stats['x:2:3'], incoming['x:2:3'], 'the entry with the larger n should win, even with an earlier last');
});

test('importProfile merge: smaller n loses, the existing entry is kept', function () {
  var local = { 'x:2:3': { n: 5, ok: 2, last: 100 } };
  var incoming = { 'x:2:3': { n: 2, ok: 1, last: 9999 } };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incoming, earned: {} };
  var r = MS.importProfile(doc, local, {});
  assert.deepStrictEqual(r.stats['x:2:3'], local['x:2:3']);
});

test('importProfile merge: a tie on n breaks on the later last', function () {
  var local = { 'x:2:3': { n: 3, ok: 1, last: 100 } };

  var incomingLater = { 'x:2:3': { n: 3, ok: 2, last: 200 } };
  var rLater = MS.importProfile(
    { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incomingLater, earned: {} },
    local, {}
  );
  assert.deepStrictEqual(rLater.stats['x:2:3'], incomingLater['x:2:3'], 'incoming with the later last should win the tie');

  var incomingEarlier = { 'x:2:3': { n: 3, ok: 2, last: 50 } };
  var rEarlier = MS.importProfile(
    { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incomingEarlier, earned: {} },
    local, {}
  );
  assert.deepStrictEqual(rEarlier.stats['x:2:3'], local['x:2:3'], 'local with the later last should be kept on a tie');
});

test('importProfile merge: earned keeps the max stars', function () {
  var local = {}; local['add-10'] = { stars: 1, masteredAt: null };
  var incoming = {}; incoming['add-10'] = { stars: 3, masteredAt: 9000 };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: incoming };
  var r = MS.importProfile(doc, {}, local);
  assert.strictEqual(r.earned['add-10'].stars, 3);
});

test('importProfile merge: earned keeps the earliest masteredAt when both sides have one', function () {
  var local = {}; local['add-10'] = { stars: 2, masteredAt: 5000 };
  var incoming = {}; incoming['add-10'] = { stars: 3, masteredAt: 9000 };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: incoming };
  var r = MS.importProfile(doc, {}, local);
  assert.strictEqual(r.earned['add-10'].masteredAt, 5000, 'the earlier of the two timestamps should win');
  assert.strictEqual(r.earned['add-10'].stars, 3);
});

test('importProfile merge: earned masteredAt falls back to whichever side actually has one', function () {
  var local = {}; local['add-10'] = { stars: 1, masteredAt: null };
  var incoming = {}; incoming['add-10'] = { stars: 3, masteredAt: 7000 };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: incoming };
  var r = MS.importProfile(doc, {}, local);
  assert.strictEqual(r.earned['add-10'].masteredAt, 7000);
});

/* -------------------------------------------------------------------
 * importProfile hardening (review finding #7 on PR #355)
 * ------------------------------------------------------------------- */

test('importProfile: earned stars are clamped to 0-3 (floored, non-numeric -> 0), visible in path()/masteredCount', function () {
  var earnedIn = {};
  earnedIn['add-10'] = { stars: 99, masteredAt: null };
  earnedIn['sub-10'] = { stars: -1, masteredAt: null };
  earnedIn['add-20'] = { stars: 2.7, masteredAt: null };
  earnedIn['sub-20'] = { stars: '3', masteredAt: null };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: earnedIn };

  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.earned['add-10'].stars, 3, 'stars 99 must clamp to 3, not overflow');
  assert.strictEqual(r.earned['sub-10'].stars, 0, 'negative stars must clamp to 0');
  assert.strictEqual(r.earned['add-20'].stars, 2, 'fractional stars must floor');
  assert.strictEqual(r.earned['sub-20'].stars, 0, 'a non-numeric stars value must become 0, never coerced');

  var p = MS.path({}, r.earned);
  var addTen = p.skills.filter(function (e) { return e.skill.id === 'add-10'; })[0];
  assert.strictEqual(addTen.stars, 3, 'the clamped 3 must be visible through path()');
  assert.strictEqual(p.masteredCount, 1, 'masteredCount must reflect the clamped stars - stars:99 must not show 3 stars while masteredCount stays 0');
});

test('importProfile: earned masteredAt only accepts a positive finite number, else null - never invents a time', function () {
  var earnedIn = {};
  earnedIn['add-10'] = { stars: 3, masteredAt: -5 };
  earnedIn['sub-10'] = { stars: 3, masteredAt: 'x' };
  earnedIn['add-20'] = { stars: 3, masteredAt: Infinity };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: earnedIn };

  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.earned['add-10'].stars, 3, 'stars still clamp/keep correctly even when masteredAt is rejected');
  assert.strictEqual(r.earned['add-10'].masteredAt, null, 'a negative masteredAt must become null, never kept as-is');
  assert.strictEqual(r.earned['sub-10'].masteredAt, null, 'a non-numeric masteredAt must become null');
  assert.strictEqual(r.earned['add-20'].masteredAt, null, 'Infinity is not finite - must become null');
});

test('importProfile: an unknown earned id is kept for forward compatibility but capped at a small bound', function () {
  var earnedIn = {};
  for (var i = 0; i < 60; i++) earnedIn['future-skill-' + i] = { stars: 1, masteredAt: null };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: earnedIn };

  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  var unknownCount = Object.keys(r.earned).filter(function (id) { return MS.skillById(id) === null; }).length;
  assert.ok(unknownCount > 0, 'at least some unknown ids should be kept under the cap');
  assert.ok(unknownCount <= 50, 'unknown earned ids must be capped, got ' + unknownCount);
});

test('importProfile: a fact entry with a string numeric field (n: "5") is dropped entirely, never concatenated', function () {
  var incoming = { 'x:2:3': { n: '5', ok: 1 } };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incoming, earned: {} };
  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.stats['x:2:3'], undefined, 'an entry with a string numeric field must never be merged');

  // The same must hold when an existing entry is already present: the bad
  // incoming entry is dropped, the existing one is kept unchanged.
  var local = { 'x:2:3': { n: 1, ok: 1 } };
  var r2 = MS.importProfile(doc, local, {});
  assert.deepStrictEqual(r2.stats['x:2:3'], local['x:2:3'], 'a dropped incoming entry must never overwrite an existing one');
});

test('importProfile: a fact key that fails the shape check is dropped, and never counts toward the cap', function () {
  var incoming = {};
  incoming['not-a-real-key'] = { n: 1, ok: 1 };
  incoming['x:2:3'] = { n: 1, ok: 1 };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incoming, earned: {} };
  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.stats['not-a-real-key'], undefined, 'a junk key must never be imported');
  assert.deepStrictEqual(r.stats['x:2:3'], { n: 1, ok: 1 }, 'a real-shaped key alongside a junk one must still import');
});

test('importProfile: caps the number of imported fact keys at a sane bound (5000)', function () {
  var incoming = {};
  for (var i = 0; i < 6000; i++) incoming['+:' + i + ':0'] = { n: 1 };
  var doc = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: incoming, earned: {} };
  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(Object.keys(r.stats).length, 5000, 'a 6000-key file must be capped at the 5000-key bound');
});

test('importProfile: player is returned sanitized (CR/LF collapsed, trimmed, capped at 40 chars), or null when absent/non-string', function () {
  var docWithName = MS.exportProfile('Kid E\r\nRow2', {}, {}, 1000);
  var r1 = MS.importProfile(docWithName, {}, {});
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.player, 'Kid E  Row2', 'player must have CR/LF replaced with spaces and be trimmed');

  var longName = new Array(60).join('x'); // 59 x's
  var docLong = MS.exportProfile(longName, {}, {}, 1000);
  var r2 = MS.importProfile(docLong, {}, {});
  assert.strictEqual(r2.player.length, 40, 'player must be capped at 40 chars');

  var docNonString = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: {}, player: 42 };
  var r3 = MS.importProfile(docNonString, {}, {});
  assert.strictEqual(r3.player, null, 'a non-string player must be null');

  var docBlank = { schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', facts: {}, earned: {}, player: '   ' };
  var r4 = MS.importProfile(docBlank, {}, {});
  assert.strictEqual(r4.player, null, 'an empty/whitespace-only player must be null');

  var rBad = MS.importProfile('{not valid json', {}, {});
  assert.strictEqual(rBad.player, null, 'player must be null on every ok:false path');
});

test('importProfile: a real exportProfile output still imports losslessly after the hardening (regression guard)', function () {
  var sk = MS.skillById('x-6-7');
  var keys = MS.factKeys(sk);
  var stats = {};
  stats[keys[0]] = { n: 4, ok: 2, ms: 1200, last: 8000, box: 3 };
  stats[keys[1]] = { n: 1, ok: 0, ms: 3000, last: 9000, box: 0 };
  var earned = {};
  earned[sk.id] = { stars: 3, masteredAt: 7000 };

  var doc = MS.exportProfile('Kid F', stats, earned, 10000);
  var r = MS.importProfile(doc, {}, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(r.stats, stats);
  assert.deepStrictEqual(r.earned, earned);
  assert.strictEqual(r.player, 'Kid F');
});

test('importProfile rejects wrong schema, ok:false, inputs untouched', function () {
  var stats = { k: { n: 1 } };
  var earned = { 'add-10': { stars: 1, masteredAt: null } };
  var statsSnap = deepClone(stats), earnedSnap = deepClone(earned);

  var r = MS.importProfile({ schema: 'something-else/v1', skill: 'arithmetic-facts', facts: {}, earned: {} }, stats, earned);
  assert.strictEqual(r.ok, false);
  assert.ok(typeof r.error === 'string' && r.error.length > 0);
  assert.deepStrictEqual(stats, statsSnap, 'the stats argument object must not be mutated');
  assert.deepStrictEqual(earned, earnedSnap, 'the earned argument object must not be mutated');
  assert.deepStrictEqual(r.stats, statsSnap);
  assert.deepStrictEqual(r.earned, earnedSnap);
});

test('importProfile rejects wrong skill, ok:false, inputs untouched', function () {
  var stats = {}, earned = {};
  var r = MS.importProfile({ schema: 'skill-competency-profile/v1', skill: 'ukulele', facts: {}, earned: {} }, stats, earned);
  assert.strictEqual(r.ok, false);
  assert.ok(/ukulele/.test(r.error), 'error message should name the offending skill id');
});

test('importProfile rejects garbage JSON, ok:false, inputs untouched', function () {
  var stats = { a: { n: 1 } }, earned = {};
  var statsSnap = deepClone(stats);
  var r = MS.importProfile('{not valid json', stats, earned);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(stats, statsSnap);
  assert.deepStrictEqual(r.stats, statsSnap);
});

test('importProfile rejects a non-object payload (number/array/null)', function () {
  [42, [1, 2, 3], null].forEach(function (junk) {
    var r = MS.importProfile(junk, {}, {});
    assert.strictEqual(r.ok, false, 'should reject ' + JSON.stringify(junk));
  });
});

/* ===================================================================
 * General immutability across the module
 * =================================================================== */

test('progress/path/exportProfile never mutate their stats/earned inputs', function () {
  var sk = MS.skillById('sub-10');
  var keys = MS.factKeys(sk);
  var stats = {}; stats[keys[0]] = { n: 1, ok: 1 };
  var earned = {}; earned[sk.id] = { stars: 1, masteredAt: null };
  var statsSnap = deepClone(stats), earnedSnap = deepClone(earned);

  MS.progress(sk, stats);
  MS.path(stats, earned);
  MS.exportProfile('X', stats, earned, 1000);

  assert.deepStrictEqual(stats, statsSnap);
  assert.deepStrictEqual(earned, earnedSnap);
});

run();
