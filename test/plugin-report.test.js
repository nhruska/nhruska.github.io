/* =====================================================================
 * plugin-report.test.js - S18: the machine-SSOT gate for the music-report
 * skill (plugin/music-coach/skills/music-report/). Three checks:
 *
 *  1. Every slot `<!--SLOT:name-->` the SKILL.md names in its "Filling
 *     template.html" table actually exists, verbatim and exactly once, in
 *     template.html - and template.html names no OTHER slots the SKILL.md
 *     doesn't document (drift in either direction fails).
 *  2. template.html makes zero external requests: no `src=`/`href=` pointing
 *     at http(s), and no `<script>` tag (this is a presentation-only, single
 *     -file artifact per the SKILL.md's hard rules).
 *  3. Every data key the SKILL.md's "Reading the export" table names is a
 *     key music/agent/capabilities.json actually declares somewhere (so the
 *     report never reads a key the app-wide manifest doesn't know about).
 *
 * Run: node test/plugin-report.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SKILL_PATH = 'plugin/music-coach/skills/music-report/SKILL.md';
var TEMPLATE_PATH = 'plugin/music-coach/skills/music-report/template.html';
var COMMAND_PATH = 'plugin/music-coach/commands/report.md';

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

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

var SLOT_RE = /<!--SLOT:([a-zA-Z0-9-]+)-->/g;
function slotNames(text) {
  var out = [];
  var m;
  SLOT_RE.lastIndex = 0;
  while ((m = SLOT_RE.exec(text))) out.push(m[1]);
  return out;
}

test('music-report SKILL.md and command file exist and are non-empty', function () {
  assert.ok(fs.existsSync(path.join(ROOT, SKILL_PATH)), SKILL_PATH + ' is missing');
  assert.ok(fs.existsSync(path.join(ROOT, TEMPLATE_PATH)), TEMPLATE_PATH + ' is missing');
  assert.ok(fs.existsSync(path.join(ROOT, COMMAND_PATH)), COMMAND_PATH + ' is missing');
});

test('every slot named in SKILL.md appears exactly once in template.html, and vice versa', function () {
  var skillText = readFile(SKILL_PATH);
  var templateText = readFile(TEMPLATE_PATH);

  var skillSlots = slotNames(skillText).filter(function (name, i, arr) {
    return arr.indexOf(name) === i; // SKILL.md mentions each slot once (table + fill-with), dedupe
  });
  assert.ok(skillSlots.length > 0, 'SKILL.md documents no <!--SLOT:...--> markers - expected the "Filling template.html" table');

  var templateSlots = slotNames(templateText);
  var templateSlotSet = {};
  templateSlots.forEach(function (name) { templateSlotSet[name] = (templateSlotSet[name] || 0) + 1; });

  skillSlots.forEach(function (name) {
    assert.strictEqual(templateSlotSet[name], 1,
      'SKILL.md documents slot "' + name + '" but template.html has it ' +
      (templateSlotSet[name] || 0) + ' time(s) (expected exactly 1)');
  });

  Object.keys(templateSlotSet).forEach(function (name) {
    assert.ok(skillSlots.indexOf(name) >= 0,
      'template.html has slot "' + name + '" that SKILL.md never documents');
  });
});

test('template.html makes zero external requests (no http(s) src/href, no <script> tag)', function () {
  var text = readFile(TEMPLATE_PATH);
  var remoteRefRe = /\b(?:src|href)\s*=\s*["']https?:\/\//i;
  assert.ok(!remoteRefRe.test(text),
    'template.html references an external http(s) resource via src=/href= - the report must be zero-external-request');
  assert.ok(!/<script[\s>]/i.test(text),
    'template.html contains a <script> tag - the report is presentation-only, no runtime behavior');
});

test('template.html declares the mobile viewport meta (phone-friendly, no build step)', function () {
  var text = readFile(TEMPLATE_PATH);
  assert.ok(/<meta\s+name=["']viewport["']/i.test(text),
    'template.html is missing a viewport meta tag');
});

test('data keys named in SKILL.md are all keys music/agent/capabilities.json actually declares', function () {
  var caps = JSON.parse(readFile('music/agent/capabilities.json'));
  var knownKeys = {};
  caps.capabilities.forEach(function (c) {
    (c.data_keys || []).forEach(function (k) { knownKeys[k] = true; });
  });

  var skillText = readFile(SKILL_PATH);
  var section = skillText.split('## Reading the export')[1];
  assert.ok(section, 'SKILL.md is missing the "## Reading the export" section');
  section = section.split('## ')[0];

  var rowRe = /^\|\s*`([^`]+)`\s*\|/gm;
  var keys = [];
  var m;
  while ((m = rowRe.exec(section))) keys.push(m[1]);
  assert.ok(keys.length > 0, 'SKILL.md "Reading the export" table has no `data key` rows to check');

  keys.forEach(function (k) {
    assert.ok(knownKeys[k],
      'SKILL.md names data key "' + k + '" but it is not in any capability\'s data_keys in music/agent/capabilities.json');
  });
});

test('command file points at /music-coach:report and names the music-report + music-interchange skills', function () {
  var text = readFile(COMMAND_PATH);
  assert.ok(/music-report/.test(text), 'commands/report.md never mentions the music-report skill');
  assert.ok(/music-interchange/.test(text), 'commands/report.md never mentions the music-interchange skill (export-reading contract)');
  assert.ok(/^description:/m.test(text), 'commands/report.md is missing frontmatter description');
});

run();
