/* =====================================================================
 * skill-md.test.js - S-SKILLS-PORTABLE: the SKILL.md render/parse pair
 * (music/shared/skill-md.js). The load-bearing contract is the LOSSLESS
 * round-trip: render() embeds the exact v1 JSON document in a fenced
 * ```json block; parse() extracts it byte-faithfully - the human-facing
 * frontmatter/table are presentation, never the data path.
 * Run: node test/skill-md.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var SkillMd = require('../music/shared/skill-md.js');

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

var DOC = {
  schema: 'skill-competency-profile/v1',
  skill: 'ukulele',
  name: 'Ukulele',
  discipline: 'music',
  updated: '2026-07-16T00:00:00Z',
  provenance: [{ source: 'app:music', at: '2026-07-16T00:00:00Z' }],
  competencies: [
    { id: 'uke-open-chords', name: 'Open chords', desc: 'Core shapes.', level: 42, target: 90, evidence_count: 7, last_evidence: '2026-07-15T00:00:00Z' },
    { id: 'uke-strum-patterns', name: 'Strum | patterns', desc: 'Pipes in names must not break the table.', level: 0, target: 85, evidence_count: 0 }
  ],
  preferences: [{ id: 'p1', statement: 'Learns by ear first', evidence_count: 3 }]
};

test('render -> parse round-trips the exact document (lossless)', function () {
  var md = SkillMd.render(DOC);
  assert.ok(md && md.indexOf('---') === 0, 'starts with frontmatter');
  var back = SkillMd.parse(md);
  assert.strictEqual(back.ok, true);
  assert.deepStrictEqual(back.doc, DOC);
});

test('render accepts the JSON STRING exportProfile() emits', function () {
  var md = SkillMd.render(JSON.stringify(DOC, null, 2));
  var back = SkillMd.parse(md);
  assert.strictEqual(back.ok, true);
  assert.deepStrictEqual(back.doc, DOC);
});

test('frontmatter carries name + description (open skills format shape)', function () {
  var md = SkillMd.render(DOC);
  var head = md.split('---')[1];
  assert.ok(/name: Ukulele/.test(head));
  assert.ok(/description: /.test(head));
});

test('table escapes pipes in competency names (presentation must not corrupt markdown)', function () {
  var md = SkillMd.render(DOC);
  assert.ok(md.indexOf('Strum \\| patterns') >= 0);
});

test('render returns null on garbage (not-JSON string, no skill field, non-object)', function () {
  assert.strictEqual(SkillMd.render('not json'), null);
  assert.strictEqual(SkillMd.render({}), null);
  assert.strictEqual(SkillMd.render(null), null);
});

test('parse fails loudly on a SKILL.md with no embedded data block', function () {
  var r = SkillMd.parse('---\nname: X\n---\n\n# X\n\nprose only');
  assert.strictEqual(r.ok, false);
  assert.ok(/no embedded profile data/.test(r.reason));
});

test('parse fails loudly on an unterminated or corrupt data block', function () {
  var r1 = SkillMd.parse('```json\n{"a":1}');
  assert.strictEqual(r1.ok, false);
  assert.ok(/never closes/.test(r1.reason));
  var r2 = SkillMd.parse('```json\n{oops}\n```');
  assert.strictEqual(r2.ok, false);
  assert.ok(/not valid JSON/.test(r2.reason));
});

test('parse of an empty/non-string input is refused', function () {
  assert.strictEqual(SkillMd.parse('').ok, false);
  assert.strictEqual(SkillMd.parse(null).ok, false);
});

test('bundlePath is <skill-id>/SKILL.md with path separators flattened defensively', function () {
  assert.strictEqual(SkillMd.bundlePath('ukulele'), 'ukulele/SKILL.md');
  assert.strictEqual(SkillMd.bundlePath('a/b\\c'), 'a-b-c/SKILL.md');
});

run();
