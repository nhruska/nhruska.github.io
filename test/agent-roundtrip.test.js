/* =====================================================================
 * agent-roundtrip.test.js - S13 A4: the executable form of goal spec
 * section 4 (Write path - agent proposes, the app disposes). Simulates a
 * user-side coding agent's write path end to end with the REAL modules
 * (competency.js + skill-md.js) and a fake Storage, never a mock of the
 * merge logic itself:
 *
 *   local progress (recordEvidence) -> exportProfile -> agent edits the
 *   doc (append provenance, bump a competency WITH evidence, add a
 *   preference, carry an unknown competency id) -> SkillMd.render ->
 *   SkillMd.parse (the file-picker import path) -> Competency.importProfile
 *   -> assert merge semantics landed correctly, and that malformed agent
 *   output is rejected rather than silently accepted.
 * Run: node test/agent-roundtrip.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var C = require('../music/shared/competency.js');
var SkillMd = require('../music/shared/skill-md.js');

// Minimal Storage-like fake (same shape competency.test.js / backup.test.js use).
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

// ---------- the happy path: full agent write-path round trip ----------
test('agent write-path round trip: read -> author a partial proposal doc -> SKILL.md render/parse -> importProfile merges correctly', function () {
  var store = FakeStore();

  // 1. The user has real local progress before any agent touches anything.
  for (var i = 0; i < 3; i++) C.recordEvidence('ukulele', 'uke-open-chords', null, store);
  var localBefore = C.getProfile('ukulele', store);
  var localLevel = localBefore.competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0].level;
  var localEvidence = localBefore.competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0].evidence_count;
  assert.ok(localLevel > 0 && localEvidence === 3, 'seed data did not land as expected');

  // 2. The agent READS the full export to evaluate the profile (section 3) -
  //    it does not need to touch competencies it isn't assessing.
  var exportedJson = C.exportProfile('ukulele', store);
  var doc = JSON.parse(exportedJson);
  assert.strictEqual(doc.schema, C.SCHEMA);
  assert.strictEqual(doc.provenance[doc.provenance.length - 1].source, 'app:music');

  // 3. The agent AUTHORS a partial proposal doc per the contract rules
  //    (section 4) - a real agent proposes what it actually assessed, not a
  //    full mirror of everything it read:
  //    - append its own provenance entry
  //    - only the competency it has NEW evidence for, WITH the evidence
  //      delta (evidence_count bumped, last_evidence a human-readable note)
  //    - a preference (additive slot)
  //    - an id-only competency the shipped frameworks may not know yet
  //      (additive tolerance - proves a round trip never drops data)
  var agentDoc = {
    schema: C.SCHEMA, skill: 'ukulele', discipline: 'music', updated: '2026-08-17T12:00:00Z',
    provenance: [{ source: 'agent:claude-code', at: '2026-08-17T12:00:00Z' }],
    competencies: [
      { id: 'uke-strum-patterns', name: 'Strum patterns', desc: 'Common down/up patterns at tempo.', level: 20, target: 85, evidence_count: 1, last_evidence: 'assessed from a shared practice recording 2026-08-17' },
      { id: 'uke-future-competency', name: 'A not-yet-shipped competency', desc: 'from a newer framework version', level: 10, target: 50, evidence_count: 1, last_evidence: '2026-08-17T12:00:00Z' }
    ],
    preferences: [{ id: 'prefers-fingerpicking', statement: 'Leans toward fingerpicked arrangements over strumming', evidence_count: 1, last_evidence: '2026-08-17T12:00:00Z' }]
  };

  // 4. Hand-back: render as SKILL.md, exactly the artifact an agent saves.
  var md = SkillMd.render(agentDoc);
  assert.ok(md && md.indexOf('---') === 0);

  // 5. Import: the user picks the .md file - mirrors songbook.js's
  //    fileInput.onchange .md branch (SkillMd.parse first, then importProfile).
  var parsed = SkillMd.parse(md);
  assert.strictEqual(parsed.ok, true);
  assert.deepStrictEqual(parsed.doc, agentDoc, 'SKILL.md round trip must be lossless');

  var res = C.importProfile(parsed.doc, store);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.skill, 'ukulele');

  // 6. Merge semantics landed correctly.
  var after = C.getProfile('ukulele', store);

  // Provenance is append-only: the original entries are still there, plus
  // the export stamp, plus the agent's own stamp - nothing rewritten.
  assert.ok(after.provenance.some(function (p) { return p.source === 'agent:claude-code'; }), 'agent provenance entry missing after merge');

  // uke-open-chords: not in the agent's proposal at all, so it holds exactly.
  var openAfter = after.competencies.filter(function (c) { return c.id === 'uke-open-chords'; })[0];
  assert.strictEqual(openAfter.level, localLevel);
  assert.strictEqual(openAfter.evidence_count, localEvidence);

  // uke-strum-patterns: mergeInto takes the HIGHER level and SUMS evidence
  // against the local (untouched, blank-at-0) copy.
  var strumAfter = after.competencies.filter(function (c) { return c.id === 'uke-strum-patterns'; })[0];
  assert.strictEqual(strumAfter.level, 20);
  assert.strictEqual(strumAfter.evidence_count, 1);
  assert.strictEqual(strumAfter.last_evidence, 'assessed from a shared practice recording 2026-08-17');

  // The new preference landed.
  assert.ok(after.preferences.some(function (p) { return p.id === 'prefers-fingerpicking'; }), 'agent preference missing after merge');

  // An id the shipped framework doesn't know is preserved untouched
  // (additive tolerance - a round trip never silently drops data).
  var unknown = after.competencies.filter(function (c) { return c.id === 'uke-future-competency'; })[0];
  assert.ok(unknown, 'unknown competency id was dropped instead of preserved');
  assert.strictEqual(unknown.level, 10);
});

test('a full re-export handed back unmodified DOUBLES evidence on every competency it repeats (documents real mergeInto behavior - not an A4 concern to change)', function () {
  // A cautionary case for AGENTS.md readers: mergeInto sums evidence_count
  // for every competency id present in an imported doc, whether or not its
  // value actually changed. An agent proposal should therefore only include
  // competencies it is genuinely adding evidence for (per the test above),
  // not a full mirror of everything it read.
  var store = FakeStore();
  for (var i = 0; i < 3; i++) C.recordEvidence('guitar', 'gtr-open-chords', null, store);
  var before = C.getProfile('guitar', store).competencies.filter(function (c) { return c.id === 'gtr-open-chords'; })[0];
  var doc = JSON.parse(C.exportProfile('guitar', store));
  C.importProfile(doc, store); // re-import the SAME doc, unmodified
  var after = C.getProfile('guitar', store).competencies.filter(function (c) { return c.id === 'gtr-open-chords'; })[0];
  assert.strictEqual(after.evidence_count, before.evidence_count * 2);
});

test('a level bump with NO evidence delta still merges (evidence is a hygiene signal, not an enforced gate)', function () {
  // Section 4 calls a level change with no evidence delta "a smell the
  // import UI may flag" - not a rejection. mergeInto still takes the max.
  var store = FakeStore();
  var doc = JSON.parse(C.exportProfile('guitar', store));
  doc.competencies[0].level = 40; // no evidence_count change
  var res = C.importProfile(doc, store);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(C.getProfile('guitar', store).competencies[0].level, 40);
});

// ---------- malformed / adversarial agent output is rejected, never silently accepted ----------
test('rejects a doc with the wrong schema string', function () {
  var store = FakeStore();
  var res = C.importProfile(JSON.stringify({ schema: 'not-a-real-schema/v9', skill: 'ukulele', competencies: [] }), store);
  assert.strictEqual(res.ok, false);
  assert.ok(/unrecognized profile format/.test(res.reason));
});

test('rejects a doc for an unknown skill (an agent cannot invent a new framework)', function () {
  var store = FakeStore();
  var res = C.importProfile({ schema: C.SCHEMA, skill: 'theremin-mastery', competencies: [] }, store);
  assert.strictEqual(res.ok, false);
  assert.ok(/unknown skill/.test(res.reason));
});

test('rejects a doc with no competencies array', function () {
  var store = FakeStore();
  var res = C.importProfile({ schema: C.SCHEMA, skill: 'ukulele' }, store);
  assert.strictEqual(res.ok, false);
  assert.ok(/no competencies/.test(res.reason));
});

test('rejects malformed JSON text outright', function () {
  var store = FakeStore();
  var res = C.importProfile('{not valid json', store);
  assert.strictEqual(res.ok, false);
  assert.ok(/not valid JSON/.test(res.reason));
});

test('rejects a non-object payload (array, null, number)', function () {
  var store = FakeStore();
  assert.strictEqual(C.importProfile([], store).ok, false);
  assert.strictEqual(C.importProfile(null, store).ok, false);
  assert.strictEqual(C.importProfile(42, store).ok, false);
});

test('an agent hand-back with NO embedded profile data block fails at the SkillMd.parse step, before it ever reaches importProfile', function () {
  var notAProfile = '---\nname: Not a profile\n---\n\n# Just prose, no fenced data block\n';
  var parsed = SkillMd.parse(notAProfile);
  assert.strictEqual(parsed.ok, false);
  assert.ok(/no embedded profile data/.test(parsed.reason));
});

run();
