/* =====================================================================
 * agent-manifest.test.js - S13 A2: the manifest-consistency gate for the
 * static agent capability surface (music/agent/capabilities.json,
 * music/agent/AGENTS.md). Machine-SSOT law (rules/machine-ssot-enforcement):
 * an SSOT with no linter is a suggestion - this is the linter.
 *
 * Asserts:
 *  1. Every capability's data_keys are actually OWNED by backup.js (the
 *     real localStorage prefix gate), so the manifest can't drift from what
 *     the app actually snapshots/restores.
 *  2. Every interchange schema string that names the competency doc equals
 *     Competency.SCHEMA byte-for-byte (no second, drifting copy of the
 *     literal string).
 *  3. music/agent/AGENTS.md is byte-for-byte AgentReadme.text() (+ trailing
 *     newline) - ONE source, two destinations, never hand-authored twice.
 *  4. The jam-deep-link capability documents exactly the locked params
 *     (jam, key, yt, name) - the seam contract shared with the sibling
 *     agent implementing music/shared/jam-link.js.
 * Run: node test/agent-manifest.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var Backup = require('../music/shared/backup.js');
var Competency = require('../music/shared/competency.js');
var AgentReadme = require('../music/shared/agent-readme.js');

var CAPS_PATH = path.join(__dirname, '..', 'music', 'agent', 'capabilities.json');
var AGENTS_MD_PATH = path.join(__dirname, '..', 'music', 'agent', 'AGENTS.md');

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

var caps = JSON.parse(fs.readFileSync(CAPS_PATH, 'utf8'));
var agentsMd = fs.readFileSync(AGENTS_MD_PATH, 'utf8');

test('capabilities.json has the versioned schema + app + a non-empty capability list', function () {
  assert.strictEqual(caps.schema, 'music-app-capabilities/v1');
  assert.strictEqual(caps.app, 'music');
  assert.ok(Array.isArray(caps.capabilities) && caps.capabilities.length > 0);
});

test('every capability has the full {id,name,desc,surfaces,data_keys,interchange} shape', function () {
  caps.capabilities.forEach(function (c) {
    assert.ok(typeof c.id === 'string' && c.id, 'missing id');
    assert.ok(typeof c.name === 'string' && c.name, c.id + ': missing name');
    assert.ok(typeof c.desc === 'string' && c.desc, c.id + ': missing desc');
    assert.ok(Array.isArray(c.surfaces) && c.surfaces.length, c.id + ': missing surfaces');
    assert.ok(Array.isArray(c.data_keys), c.id + ': data_keys must be an array (may be empty)');
    assert.ok('interchange' in c, c.id + ': missing interchange key (null when none)');
  });
});

test('every listed data_key is OWNED by backup.js (real prefix coverage, no drift)', function () {
  caps.capabilities.forEach(function (c) {
    c.data_keys.forEach(function (k) {
      assert.ok(Backup.owned(k), c.id + ': data_key "' + k + '" is not covered by Backup.OWNED_PREFIXES');
    });
  });
});

test('the expected capability ids are all present (no silent drop from the enumerated set)', function () {
  var ids = caps.capabilities.map(function (c) { return c.id; });
  ['tuner', 'jam', 'compose', 'repertoire', 'backing-tracks', 'competency-tracking',
    'backup-restore', 'jam-deep-link', 'skills-export-import'].forEach(function (id) {
    assert.ok(ids.indexOf(id) >= 0, 'missing capability: ' + id);
  });
});

test('every capability naming the competency interchange uses the real Competency.SCHEMA string', function () {
  var named = caps.capabilities.filter(function (c) { return c.interchange === 'skill-competency-profile/v1'; });
  assert.ok(named.length >= 1, 'expected at least one capability to name the competency interchange');
  named.forEach(function (c) {
    assert.strictEqual(c.interchange, Competency.SCHEMA, c.id + ': interchange string has drifted from Competency.SCHEMA');
  });
});

test('jam-deep-link capability documents exactly the locked params (jam, key, yt, name)', function () {
  var jl = caps.capabilities.filter(function (c) { return c.id === 'jam-deep-link'; })[0];
  assert.ok(jl, 'jam-deep-link capability missing');
  var m = /url-params:\s*([a-zA-Z,]+)/.exec(String(jl.interchange || ''));
  assert.ok(m, 'jam-deep-link interchange does not document a url-params list');
  var params = m[1].split(',').map(function (s) { return s.trim(); }).sort();
  assert.deepStrictEqual(params, ['jam', 'key', 'name', 'yt']);
});

test('music/agent/AGENTS.md is byte-for-byte AgentReadme.text() (ONE source, two destinations)', function () {
  assert.strictEqual(agentsMd, AgentReadme.text() + '\n');
});

test('AGENTS.md never contains a literal fenced ```json block (would false-parse via SkillMd.parse)', function () {
  assert.strictEqual(agentsMd.indexOf('```json'), -1,
    'AGENTS.md must not contain the literal ```json fence - it would be mistaken for an importable profile doc');
});

test('the bundled agent-readme.js constants match the real module constants (no drifting copy)', function () {
  assert.strictEqual(AgentReadme.COMPETENCY_SCHEMA, Competency.SCHEMA);
  assert.strictEqual(AgentReadme.BACKUP_APP, 'music');
});

run();
