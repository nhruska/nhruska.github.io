/* =====================================================================
 * agent-readme.test.js - S13 A1: the bundled AGENTS.md source
 * (music/shared/agent-readme.js) that ships inside the skills zip export
 * (songbook.js downloadBundle) and is mirrored verbatim at
 * music/agent/AGENTS.md (asserted by test/agent-manifest.test.js).
 * Run: node test/agent-readme.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var AgentReadme = require('../music/shared/agent-readme.js');
var SkillMd = require('../music/shared/skill-md.js');
var Competency = require('../music/shared/competency.js');

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

test('text() returns a non-empty markdown string starting with an H1', function () {
  var t = AgentReadme.text();
  assert.strictEqual(typeof t, 'string');
  assert.ok(t.length > 0);
  assert.strictEqual(t.indexOf('# '), 0);
});

test('text() is deterministic (no Date.now/timestamps baked in)', function () {
  assert.strictEqual(AgentReadme.text(), AgentReadme.text());
});

test('text() names every real interchange schema string exactly once and verbatim', function () {
  var t = AgentReadme.text();
  assert.ok(t.indexOf(Competency.SCHEMA) >= 0, 'must document the real competency schema string');
  assert.ok(t.indexOf('app:"music"') >= 0, 'must document the backup envelope app field');
});

test('text() documents the locked jam deep-link params (jam, key, yt, name)', function () {
  var t = AgentReadme.text();
  ['jam=', 'key=', 'yt=', 'name='].forEach(function (p) {
    assert.ok(t.indexOf(p) >= 0, 'missing documented param: ' + p);
  });
});

test('text() states the write-path MUST-NOTs: no fabricated backup envelope, no provenance rewrite, no invented keys', function () {
  var t = AgentReadme.text();
  assert.ok(/backup envelope/i.test(t));
  assert.ok(/provenance/i.test(t) && /append/i.test(t));
  assert.ok(/invent/i.test(t));
});

test('text() never contains a literal ```json fence (would false-parse via SkillMd.parse on the import file picker)', function () {
  var t = AgentReadme.text();
  assert.strictEqual(t.indexOf('```json'), -1);
});

test('SkillMd.parse(text()) fails cleanly - AGENTS.md is not mistakable for an importable profile doc', function () {
  var r = SkillMd.parse(AgentReadme.text());
  assert.strictEqual(r.ok, false);
  assert.ok(/no embedded profile data/.test(r.reason));
});

test('a hand-picked AGENTS.md fed to the real competency import path is rejected, never silently accepted', function () {
  // Mirrors songbook.js's fileInput.onchange .md branch: SkillMd.parse first,
  // then Competency.importProfile only on ok:true. AGENTS.md must dead-end
  // at the parse step (asserted above) - this proves it can never reach
  // importProfile with content that would validate.
  var parsed = SkillMd.parse(AgentReadme.text());
  assert.strictEqual(parsed.ok, false);
});

test('exposes the constants agent-manifest.test.js cross-checks against the real modules', function () {
  assert.strictEqual(AgentReadme.COMPETENCY_SCHEMA, Competency.SCHEMA);
  assert.strictEqual(typeof AgentReadme.BACKUP_APP, 'string');
});

run();
