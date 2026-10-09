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
var Capabilities = require('../music/shared/capabilities.js');
var MusicianProfile = require('../music/shared/musician-profile.js');

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
    'backup-restore', 'jam-deep-link', 'musician-profile', 'skills-export-import'].forEach(function (id) {
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

test('music/agent/capabilities.json is byte-for-byte Capabilities.json() (ONE source, two destinations)', function () {
  var staticRaw = fs.readFileSync(CAPS_PATH, 'utf8');
  assert.strictEqual(staticRaw, Capabilities.json() + '\n');
});

test('downloadBundle ships capabilities.json at the zip root (guarded on window.Capabilities)', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  var i = src.indexOf('function downloadBundle');
  assert.ok(i !== -1, 'downloadBundle not found');
  var body = src.slice(i, src.indexOf('\n      }', i));
  assert.ok(/global\.Capabilities/.test(body),
    'the bundle must push the capability manifest (guarded on window.Capabilities)');
  assert.ok(/'capabilities\.json'/.test(body),
    'the manifest must land at the AGENTS.md-documented zip-root name: capabilities.json');
});

test('AGENTS.md names capabilities.json as a bundle member', function () {
  assert.ok(/capabilities\.json/.test(AgentReadme.text()),
    'AGENTS.md must tell agents the capability manifest is in the bundle');
});

test('AGENTS.md never contains a literal fenced ```json block (would false-parse via SkillMd.parse)', function () {
  assert.strictEqual(agentsMd.indexOf('```json'), -1,
    'AGENTS.md must not contain the literal ```json fence - it would be mistaken for an importable profile doc');
});

test('the bundled agent-readme.js constants match the real module constants (no drifting copy)', function () {
  assert.strictEqual(AgentReadme.COMPETENCY_SCHEMA, Competency.SCHEMA);
  assert.strictEqual(AgentReadme.BACKUP_APP, 'music');
});

/* ---- Round 18 (operator friction: "I had to export my skills in a separate
 * zip after I started the coaching conversation... to make a single export I
 * can start a new conversation with"): the skills export IS the complete
 * conversation starter - AGENTS.md + SKILL.mds + the FULL backup envelope in
 * one zip. Pins: */
test('downloadBundle ships the backup envelope in the bundle (one export = instructions + skills + latest data)', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  var i = src.indexOf('function downloadBundle');
  assert.ok(i !== -1, 'downloadBundle not found');
  var body = src.slice(i, src.indexOf('\n      }', i));
  assert.ok(/Backup\.snapshot/.test(body),
    'the bundle must snapshot the full backup envelope (guarded on window.Backup)');
  assert.ok(/music-songbook-/.test(body),
    "the envelope must land at the AGENTS.md-documented name: music-songbook-<date>.json");
  assert.ok(/music-agent-bundle\.zip/.test(body),
    'the download is the agent bundle now, not a skills-only zip');
});
test("AGENTS.md tells agents the envelope is IN the bundle (not 'if the user also shared one')", function () {
  var t = AgentReadme.text();
  assert.ok(t.indexOf('if the user also shared one') === -1,
    'stale conditional phrasing - the envelope ships in every Settings export now');
  assert.ok(/included in this bundle/.test(t),
    "the envelope line must say it is included in this bundle");
});

/* ---- UAT batch 6: the zip is the interface -------------------------------
 * "The Standalone skills package should describe itself without any additional
 * prompting just by uploading the zip file to my AI agent."
 * AGENTS.md already said everything, but nothing was NAMED the file a person or
 * an agent opens first in an unfamiliar folder. These pin the front door and the
 * three-case hand-back contract, so a future edit cannot quietly drop either.
 * ----------------------------------------------------------------------- */
test('README.md exists, states self-containment, and points at AGENTS.md', function () {
  var r = AgentReadme.readme();
  assert.ok(/^# Musician skill profile/.test(r), 'opens by naming what the folder IS');
  assert.ok(/no network, no app\s*\ncode, no account/.test(r) || /no network/.test(r),
    'states the folder needs no network - the whole point of bundling the docs');
  assert.ok(/`AGENTS\.md`/.test(r), 'points at the full contract');
  assert.ok(/## What to hand back/.test(r), 'says what to return, not just what to read');
});

test('README.md carries no tagged JSON fence - a mis-picked README must fail import cleanly', function () {
  // Same trap AGENTS.md documents in its own header: skill-md.js parse() grabs
  // the FIRST ```json block in any .md handed to the import picker. A doc that
  // almost-parses is worse than one that plainly does not.
  assert.strictEqual(AgentReadme.readme().indexOf('```json'), -1,
    'README.md must not contain a ```json fence');
});

test('the hand-back procedure covers all THREE update cases the operator named', function () {
  var t = AgentReadme.text();
  var hb = t.slice(t.indexOf('## Hand-back procedure'));
  assert.ok(/One competency moved/.test(hb), 'case 1: a practice session moved one level');
  assert.ok(/Porting an outside profile/.test(hb), 'case 2: the user already tracks skills elsewhere');
  assert.ok(/Correcting a fresh install/.test(hb), 'case 3: defaults corrected by a conversation');
  assert.ok(/adds and overwrites, never deletes/.test(hb),
    'the merge semantics must be stated - it is what makes a partial hand-back safe');
});

test('the bundle writes README.md alongside AGENTS.md', function () {
  var src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  assert.ok(/path: 'README\.md', text: global\.AgentReadme\.readme\(\)/.test(src),
    'downloadBundle must write README.md from the ONE source, never a hand-authored copy');
});

/* ---- M-MUSICIAN-PROFILE: capabilities stay APP-SIDE with a deep link each;
 * the person-owned profile is a capability of its own; the bundle ships it. */
test('every capability carries an https deep_link into the live app (capabilities stay app-side, linkable)', function () {
  caps.capabilities.forEach(function (c) {
    assert.ok(/^https:\/\/nhruska\.github\.io\/music\/play\//.test(String(c.deep_link || '')), c.id + ': missing or non-app deep_link');
  });
});
test('the musician-profile capability names the real MusicianProfile.SCHEMA + STORAGE_KEY (no drifting copies)', function () {
  var mp = caps.capabilities.filter(function (c) { return c.id === 'musician-profile'; })[0];
  assert.ok(mp, 'musician-profile capability missing');
  assert.strictEqual(mp.interchange, MusicianProfile.SCHEMA);
  assert.deepStrictEqual(mp.data_keys, [MusicianProfile.STORAGE_KEY]);
  assert.strictEqual(MusicianProfile.CAPABILITIES_URL, 'https://nhruska.github.io/music/agent/capabilities.json',
    'the profile participant entry must point at the served manifest');
});
test('downloadBundle ships profile.json at the zip root (guarded on window.MusicianProfile)', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  var i = src.indexOf('function downloadBundle');
  var body = src.slice(i, src.indexOf('\n      }', i));
  assert.ok(/global\.MusicianProfile/.test(body), 'the bundle must write the profile (guarded)');
  assert.ok(/'profile\.json'/.test(body), 'the profile must land at the AGENTS.md-documented name: profile.json');
});
test('AGENTS.md documents profile.json, the contract id, the three rules, unassessed, modality and the steward role', function () {
  var t = AgentReadme.text();
  assert.ok(t.indexOf(MusicianProfile.SCHEMA) >= 0, 'names the real profile schema string');
  assert.ok(t.indexOf(MusicianProfile.CONTRACT_ID) >= 0, 'names the real contract id');
  assert.strictEqual(AgentReadme.PROFILE_SCHEMA, MusicianProfile.SCHEMA);
  assert.strictEqual(AgentReadme.CONTRACT_ID, MusicianProfile.CONTRACT_ID);
  ['Read what you understand', 'Preserve what you do not understand', 'Add what you legitimately know'].forEach(function (r) {
    assert.ok(t.indexOf(r) >= 0, 'missing contract rule: ' + r);
  });
  assert.ok(/unassessed/.test(t) && /never beginner/.test(t), 'states that absence is unassessed, never beginner');
  assert.ok(/overclaim modality/.test(t) && /modality: "compose"/.test(t), 'states the app\'s own modality honestly');
  assert.ok(/You are the steward/.test(t) && /ASK THE HUMAN/.test(t), 'states the steward role + the human-in-the-loop rule');
  assert.ok(/profile\.json/.test(AgentReadme.readme()), 'README.md names profile.json');
});


/* ---------- M-MUSICIAN-PROFILE-VNEXT: the exported coach contract ---------- */
test('VNEXT: AGENTS.md carries the coach contract - startup read, the adaptive guided interview, music-making-first coaching, continuous profile management, and the plan shape', function () {
  var t = AgentReadme.text();
  ['read the ENTIRE profile', 'guided interview', 'one question at a time', 'DISCRIMINATING', 'music making first',
   'hear -> choose -> play -> notice', 'Manage the profile continuously', 'learning edge', 'plain language',
   'kind: "focus"|"activity"|"edge"', 'deep_link', 'describes', 'THE APP, never the person'].forEach(function (needle) {
    assert.ok(t.indexOf(needle) >= 0, 'AGENTS.md is missing: ' + needle);
  });
});
test('VNEXT: AGENTS.md separates global musicianship from instrument proficiency, keeps the vocabulary open, and states unassessed + confidence + attached-is-not-analyzed', function () {
  var t = AgentReadme.text();
  ['musicianship/*', 'Never collapse these into one level', 'The vocabulary is open', 'flamenco/rasgueado',
   'confidence` = high | medium | low', 'Do not invent precision', 'artifact-analysis', 'analyzed: false',
   '"Audio attached" and "audio', 'level: null', 'Never characterize a musician as a beginner'].forEach(function (needle) {
    assert.ok(t.indexOf(needle) >= 0, 'AGENTS.md is missing: ' + needle);
  });
  MusicianProfile.CORE_TAXONOMY.forEach(function (c) {
    if (/^musicianship\//.test(c.id)) assert.ok(t.indexOf(c.id.split('/')[1]) >= 0, 'AGENTS.md does not name ' + c.id);
  });
  assert.ok(t.indexOf('Settings -> Skills') === -1, 'the surface is Settings -> Musician profile now');
});
test('VNEXT: the triad-inversions capability deep-links to a page that exists, so a plan item can carry a REAL app link', function () {
  var caps = Capabilities.data().capabilities;
  var ti = caps.filter(function (c) { return c.id === 'triad-inversions'; })[0];
  assert.ok(ti, 'triad-inversions capability missing');
  assert.strictEqual(ti.deep_link, 'https://nhruska.github.io/music/play/triad-inversions.html');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'music', 'play', 'triad-inversions.html')));
  assert.strictEqual(MusicianProfile.appLink(ti.deep_link), ti.deep_link);
  caps.forEach(function (c) { assert.ok(c.surfaces.indexOf('Settings -> Skills') === -1, c.id + ' still names the old surface'); });
});

run();
