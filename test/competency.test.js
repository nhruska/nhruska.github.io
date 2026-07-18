/* =====================================================================
 * competency.test.js  -  unit tests for M-COMPETENCY LZ
 * (music/shared/competency.js): the per-skill competency profile core -
 * level-movement math, evidence recording, additive storage isolation,
 * and the portable export/import round-trip (incl. the optional
 * preferences array, absent-tolerant).
 * Run: node test/competency.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var C = require('../music/shared/competency.js');

// Minimal Storage-like fake (same shape the app's localStorage exposes).
function FakeStore(seed) {
  var m = seed ? JSON.parse(JSON.stringify(seed)) : {};
  return {
    _m: m,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
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

/* ---------- FRAMEWORKS integrity (the portable id contract) ---------- */
test('FRAMEWORKS carries the 5 disciplines with the contract ids', function () {
  var ids = C.FRAMEWORKS.map(function (f) { return f.id; });
  ['stringed-instrument', 'ukulele', 'guitar', 'music-composition', 'lyric-writing'].forEach(function (id) {
    assert.ok(ids.indexOf(id) >= 0, 'missing framework: ' + id);
  });
});
test('every framework competency has id/name/desc and a 0-100 target', function () {
  C.FRAMEWORKS.forEach(function (fw) {
    assert.ok(fw.competencies.length === 5, fw.id + ' should have 5 competencies');
    fw.competencies.forEach(function (c) {
      assert.ok(c.id && c.name && c.desc, 'incomplete competency in ' + fw.id);
      assert.ok(typeof c.target === 'number' && c.target > 0 && c.target <= 100, 'bad target on ' + c.id);
    });
  });
});
test('contract competency ids are present verbatim', function () {
  function comp(skill, id) {
    var fw = C.FRAMEWORKS.filter(function (f) { return f.id === skill; })[0];
    return fw && fw.competencies.filter(function (c) { return c.id === id; })[0];
  }
  assert.ok(comp('ukulele', 'uke-repertoire'), 'uke-repertoire missing');
  assert.ok(comp('guitar', 'gtr-repertoire'), 'gtr-repertoire missing');
  assert.ok(comp('stringed-instrument', 'chord-shapes'), 'chord-shapes missing');
  assert.ok(comp('music-composition', 'comp-song-form'), 'comp-song-form missing');
  assert.ok(comp('lyric-writing', 'lyr-prosody'), 'lyr-prosody missing');
});

/* ---------- nextLevel: diminishing returns, min 1, cap, hold-at-target ---------- */
test('nextLevel moves a fraction of the remaining gap (min step 1)', function () {
  assert.strictEqual(C.nextLevel(0, 80), 5);   // round(80*0.06)=5
  assert.strictEqual(C.nextLevel(50, 80), 52); // round(30*0.06)=2
  assert.strictEqual(C.nextLevel(78, 80), 79); // round(2*0.06)=0 -> min 1
});
test('nextLevel diminishes as level approaches target', function () {
  var a = C.nextLevel(0, 80) - 0;     // 5
  var b = C.nextLevel(60, 80) - 60;   // round(20*.06)=1
  assert.ok(a > b, 'early gain should exceed late gain (' + a + ' vs ' + b + ')');
});
test('nextLevel never exceeds target and holds once at/above it', function () {
  assert.strictEqual(C.nextLevel(79, 80), 80); // would be 80, capped exactly
  assert.strictEqual(C.nextLevel(80, 80), 80); // at target: hold
  assert.strictEqual(C.nextLevel(85, 80), 85); // above (imported): hold, never regress
});

/* ---------- blankProfile ---------- */
test('blankProfile seeds a v1 doc at level 0 for a known skill', function () {
  var p = C.blankProfile('ukulele');
  assert.strictEqual(p.schema, C.SCHEMA);
  assert.strictEqual(p.skill, 'ukulele');
  assert.strictEqual(p.discipline, 'music');
  assert.ok(Array.isArray(p.competencies) && p.competencies.length === 5);
  p.competencies.forEach(function (c) { assert.strictEqual(c.level, 0); assert.strictEqual(c.evidence_count, 0); assert.strictEqual(c.last_evidence, null); });
});
test('blankProfile is null for an unknown skill', function () {
  assert.strictEqual(C.blankProfile('bagpipes'), null);
});

/* ---------- recordEvidence ---------- */
test('recordEvidence increments count, stamps last_evidence, moves level', function () {
  var s = FakeStore();
  var r = C.recordEvidence('music-composition', 'comp-song-form', null, s);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.evidence_count, 1);
  assert.ok(r.level > 0, 'level should move off 0');
  var p = C.getProfile('music-composition', s);
  var comp = p.competencies.filter(function (c) { return c.id === 'comp-song-form'; })[0];
  assert.strictEqual(comp.evidence_count, 1);
  assert.ok(comp.last_evidence, 'last_evidence set');
});
test('recordEvidence accumulates and caps at the target', function () {
  var s = FakeStore();
  for (var i = 0; i < 200; i++) C.recordEvidence('ukulele', 'uke-repertoire', null, s);
  var comp = C.getProfile('ukulele', s).competencies.filter(function (c) { return c.id === 'uke-repertoire'; })[0];
  assert.strictEqual(comp.level, 80, 'capped at target 80');
  assert.strictEqual(comp.evidence_count, 200, 'count keeps rising past the cap');
});
test('recordEvidence rejects unknown skill / competency without throwing', function () {
  var s = FakeStore();
  assert.strictEqual(C.recordEvidence('bagpipes', 'x', null, s).ok, false);
  assert.strictEqual(C.recordEvidence('ukulele', 'nope', null, s).ok, false);
});

/* ---------- additive storage isolation ---------- */
test('recordEvidence writes ONLY music.competency.v1 - never another namespace', function () {
  var s = FakeStore({ 'roadcase-ukulele-gcea.setlist.v1': '["a"]', 'music.accent.v1': '"teal"' });
  C.recordEvidence('ukulele', 'uke-open-chords', null, s);
  assert.strictEqual(s._m['roadcase-ukulele-gcea.setlist.v1'], '["a"]', 'setlist untouched');
  assert.strictEqual(s._m['music.accent.v1'], '"teal"', 'accent untouched');
  assert.ok(s._m['music.competency.v1'], 'competency key written');
  assert.strictEqual(Object.keys(s._m).length, 3, 'exactly one new key added');
});
test('load is defensive against a corrupt value', function () {
  var s = FakeStore({ 'music.competency.v1': 'not json{' });
  assert.deepStrictEqual(C.load(s), {}, 'corrupt value yields empty map, no throw');
});
test('hasData reflects whether the user has any local profile', function () {
  var s = FakeStore();
  assert.strictEqual(C.hasData(s), false);
  C.recordEvidence('guitar', 'gtr-open-chords', null, s);
  assert.strictEqual(C.hasData(s), true);
});

/* ---------- exportProfile ---------- */
test('exportProfile emits a schema-v1 doc with an app:music provenance stamp', function () {
  var s = FakeStore();
  C.recordEvidence('music-composition', 'comp-progressions', null, s);
  var doc = JSON.parse(C.exportProfile('music-composition', s));
  assert.strictEqual(doc.schema, 'skill-competency-profile/v1');
  assert.strictEqual(doc.skill, 'music-composition');
  assert.strictEqual(doc.discipline, 'music');
  assert.ok(Array.isArray(doc.competencies) && doc.competencies.length === 5);
  assert.ok(doc.provenance.some(function (p) { return p.source === 'app:music' && p.at; }), 'export provenance stamped');
});
test('exportProfile works for a skill with no local data (blank export)', function () {
  var doc = JSON.parse(C.exportProfile('lyric-writing', FakeStore()));
  assert.strictEqual(doc.skill, 'lyric-writing');
  doc.competencies.forEach(function (c) { assert.strictEqual(c.level, 0); });
});

/* ---------- importProfile: merge semantics ---------- */
test('importProfile takes the HIGHER level and SUMS evidence per competency', function () {
  var s = FakeStore();
  C.recordEvidence('ukulele', 'uke-open-chords', null, s); // local: level 5-ish, count 1
  var localComp = C.getProfile('ukulele', s).competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0];
  var incoming = {
    schema: C.SCHEMA, skill: 'ukulele', discipline: 'music', updated: '2026-07-11T00:00:00Z', provenance: [],
    competencies: [{ id: 'uke-open-chords', name: 'Open chords', desc: 'x', level: 60, target: 90, evidence_count: 9, last_evidence: '2026-07-10T00:00:00Z' }]
  };
  var r = C.importProfile(JSON.stringify(incoming), s);
  assert.strictEqual(r.ok, true);
  var merged = C.getProfile('ukulele', s).competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0];
  assert.strictEqual(merged.level, 60, 'higher of local vs imported (60) wins');
  assert.strictEqual(merged.evidence_count, localComp.evidence_count + 9, 'evidence counts summed');
});
test('importProfile preserves an UNKNOWN competency id untouched (additive tolerance)', function () {
  var s = FakeStore();
  var incoming = {
    schema: C.SCHEMA, skill: 'guitar', discipline: 'music', provenance: [],
    competencies: [{ id: 'gtr-tapping-future', name: 'Tapping', desc: 'future', level: 40, target: 70, evidence_count: 3, last_evidence: null }]
  };
  assert.strictEqual(C.importProfile(incoming, s).ok, true);
  var merged = C.getProfile('guitar', s).competencies.filter(function (c) { return c.id === 'gtr-tapping-future'; })[0];
  assert.ok(merged, 'unknown competency preserved');
  assert.strictEqual(merged.level, 40);
});
test('importProfile rejects a bad schema / non-profile / unknown skill', function () {
  var s = FakeStore();
  assert.strictEqual(C.importProfile('{"schema":"other/v9","skill":"ukulele","competencies":[]}', s).ok, false);
  assert.strictEqual(C.importProfile('not json{', s).ok, false);
  assert.strictEqual(C.importProfile({ schema: C.SCHEMA, skill: 'bagpipes', competencies: [] }, s).ok, false);
});
test('import tolerates a profile with NO preferences array', function () {
  var s = FakeStore();
  var incoming = { schema: C.SCHEMA, skill: 'music-composition', discipline: 'music', competencies: [{ id: 'comp-melody', level: 30, target: 70, evidence_count: 2 }] };
  var r = C.importProfile(incoming, s);
  assert.strictEqual(r.ok, true);
  var p = C.getProfile('music-composition', s);
  assert.ok(Array.isArray(p.preferences), 'preferences normalized to an array');
});

/* ---------- preferences (operator addendum): round-trip + union merge ---------- */
test('export/import round-trips the optional preferences array', function () {
  var s1 = FakeStore();
  // Seed a working copy carrying a preference (as a future consume-side would).
  var seeded = C.blankProfile('lyric-writing');
  seeded.preferences = [{ id: 'metaphor', statement: 'using metaphors in lyrics', evidence_count: 3, last_evidence: '2026-07-11T00:00:00Z' }];
  var map = {}; map['lyric-writing'] = seeded; s1.setItem('music.competency.v1', JSON.stringify(map));
  var doc = JSON.parse(C.exportProfile('lyric-writing', s1));
  assert.ok(doc.preferences && doc.preferences[0].id === 'metaphor', 'export carries preferences');

  var s2 = FakeStore();
  C.importProfile(doc, s2);
  var got = C.getProfile('lyric-writing', s2).preferences;
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].statement, 'using metaphors in lyrics');
  assert.strictEqual(got[0].evidence_count, 3);
});
test('preferences merge unions by id, sums evidence, keeps the latest statement', function () {
  var s = FakeStore();
  var local = C.blankProfile('lyric-writing');
  local.preferences = [{ id: 'metaphor', statement: 'old phrasing', evidence_count: 2, last_evidence: '2026-07-01T00:00:00Z' }];
  var m = {}; m['lyric-writing'] = local; s.setItem('music.competency.v1', JSON.stringify(m));
  var incoming = {
    schema: C.SCHEMA, skill: 'lyric-writing', competencies: [],
    preferences: [
      { id: 'metaphor', statement: 'newer phrasing', evidence_count: 4, last_evidence: '2026-07-10T00:00:00Z' },
      { id: 'internal-rhyme', statement: 'internal rhyme in the pre-chorus', evidence_count: 1, last_evidence: '2026-07-09T00:00:00Z' }
    ]
  };
  C.importProfile(incoming, s);
  var prefs = C.getProfile('lyric-writing', s).preferences;
  var metaphor = prefs.filter(function (p) { return p.id === 'metaphor'; })[0];
  assert.strictEqual(metaphor.evidence_count, 6, 'summed 2+4');
  assert.strictEqual(metaphor.statement, 'newer phrasing', 'kept the later statement');
  assert.ok(prefs.some(function (p) { return p.id === 'internal-rhyme'; }), 'new preference added');
});

/* ---------- S-SKILLS-PORTABLE (2026-07-16): flexible skill resolution -
 * id stays the contract, but case/whitespace drift and a framework's
 * display NAME resolve instead of bouncing; garbage still denies, and the
 * deny reason names the known ids (self-diagnosing bounce). */
test('resolveSkillId: exact id, case/whitespace drift, and display name all resolve', function () {
  assert.strictEqual(C.resolveSkillId('ukulele'), 'ukulele');
  assert.strictEqual(C.resolveSkillId('  UKULELE '), 'ukulele');
  assert.strictEqual(C.resolveSkillId('Ukulele'), 'ukulele');
  assert.strictEqual(C.resolveSkillId('Stringed instrument'), 'stringed-instrument');
});
test('resolveSkillId: unknown/garbage stays null', function () {
  assert.strictEqual(C.resolveSkillId('theremin'), null);
  assert.strictEqual(C.resolveSkillId(''), null);
  assert.strictEqual(C.resolveSkillId(null), null);
});
test('importProfile accepts a display-name skill and merges into the id-keyed profile', function () {
  var s = new FakeStore();
  var res = C.importProfile({
    schema: C.SCHEMA, skill: 'Ukulele',
    competencies: [{ id: 'uke-open-chords', level: 55, evidence_count: 2 }]
  }, s);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.skill, 'ukulele');
  assert.strictEqual(C.getProfile('ukulele', s).competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0].level, 55);
});
test('importProfile deny reason for an unknown skill lists the known ids', function () {
  var res = C.importProfile({ schema: C.SCHEMA, skill: 'theremin', competencies: [] }, new FakeStore());
  assert.strictEqual(res.ok, false);
  assert.ok(/unknown skill: theremin/.test(res.reason));
  assert.ok(/ukulele/.test(res.reason), 'reason names the known ids');
});

run();
