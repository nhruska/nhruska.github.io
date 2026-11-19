/* =====================================================================
 * wiki-lifecycle-drift.test.js - prevents retired rules and hand-counted
 * evidence summaries from silently presenting as current truth.
 *
 * Run: node test/wiki-lifecycle-drift.test.js
 * ===================================================================== */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var WIKI = path.join(ROOT, 'music', 'engineering-wiki');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce(function (out, entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) return out.concat(markdownFiles(full));
    if (/\.md$/.test(entry.name)) out.push(full);
    return out;
  }, []);
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

test('retired TRACKS-#98 marker is absent from the entire engineering wiki', function () {
  var offenders = markdownFiles(WIKI).filter(function (file) {
    return fs.readFileSync(file, 'utf8').indexOf('[TRACKS-#98]') !== -1;
  }).map(function (file) { return path.relative(ROOT, file); });
  assert.deepStrictEqual(offenders, [],
    'retired marker still presents an uncompleted future transition in: ' + offenders.join(', '));
});

test('generated handoffs do not present the completed #98 transition as future work', function () {
  var banned = [
    'Waiting on PR #98',
    'PR #98 introduces regime B',
    'post-#98',
    'independent adversarial review',
    'twice independently'
  ];
  var offenders = [];
  markdownFiles(WIKI).forEach(function (file) {
    var body = fs.readFileSync(file, 'utf8');
    banned.forEach(function (phrase) {
      if (body.toLowerCase().indexOf(phrase.toLowerCase()) !== -1) {
        offenders.push(path.relative(ROOT, file) + ': ' + phrase);
      }
    });
  });
  assert.deepStrictEqual(offenders, [],
    'stale transition or independence claim remains: ' + offenders.join(', '));
});

test('marker contract distinguishes active, proposed, and retired content', function () {
  var agents = read('music/engineering-wiki/AGENTS.md');
  ['[ACTIVE since YYYY-MM-DD]', '[RETIRED YYYY-MM-DD -> DECISION-ID]', '[PROPOSED]'].forEach(function (marker) {
    assert.ok(agents.indexOf(marker) !== -1, 'missing lifecycle marker definition: ' + marker);
  });
  assert.ok(agents.indexOf('Historical content must carry') !== -1,
    'marker contract must prevent STABLE-only historical content');
});

test('source and generated onboarding identify key-aware spelling as active', function () {
  var source = read('music/engineering-wiki/theory-engine/note-spelling.md');
  var onboarding = read('music/engineering-wiki/generated/ONBOARDING-BRIEF.md');
  var theory = read('music/engineering-wiki/generated/THEORY.md');
  assert.ok(/KEY-AWARE spelling regime.*ACTIVE since 2026-07-10/.test(source),
    'source note-spelling must name the active regime');
  assert.ok(onboarding.indexOf('Key-aware display spelling') !== -1,
    'generated onboarding must present key-aware display as current');
  assert.ok(theory.indexOf('Key-aware display spelling (active)') !== -1,
    'generated theory must present key-aware display as current');
});

test('FORK-4 is visibly retired and points to its replacement decision', function () {
  var decisions = read('music/engineering-wiki/decisions.md');
  assert.ok(/\| FORK-4 \| \*\*RETIRED 2026-07-10 by D-KEY-STORE-PREF\*\*/.test(decisions),
    'FORK-4 row must be retired with replacement');
  assert.ok(/\| S-BLUES-B \| \*\*SHIPPED 2026-07-10\*\*/.test(decisions),
    'S-BLUES-B must be current shipped history, not queued work');
});

test('persona inventory count in README matches committed persona scenarios', function () {
  var scenarioDir = path.join(ROOT, 'test', 'pw', 'scenarios');
  var actual = fs.readdirSync(scenarioDir).filter(function (name) {
    return /^persona-.*\.json$/.test(name);
  }).length;
  var readme = read('test/pw/README.md');
  var declared = /and (\d+) `persona-\*\.json`/.exec(readme);
  assert.ok(declared, 'README must declare the reproducible persona-scenario inventory');
  assert.strictEqual(Number(declared[1]), actual,
    'README persona inventory drifted from committed scenarios');
});

test('adversarial-fold summary reconciles to the enumerated catch cells', function () {
  var record = read('docs/plans/m-guide-adversarial-fold-20260704.md');
  var rows = record.split('\n').filter(function (line) { return /^\| [1-4]\./.test(line); });
  assert.strictEqual(rows.length, 4, 'expected four adversarial-round rows');
  var count = rows.reduce(function (sum, line) {
    var catchesCell = line.split('|')[3] || '';
    return sum + (catchesCell.match(/\([a-z]\)/g) || []).length;
  }, 0);
  assert.strictEqual(count, 13, 'enumerated catch total changed; reconcile the summary');
  assert.ok(/thirteen substantive catches/.test(record),
    'summary must state the reconciled thirteen-catch total');
  [
    'docs/artifacts/case-study-music-app.html',
    'docs/artifacts/m-guide-mission-20260704.html'
  ].forEach(function (rel) {
    var artifact = read(rel);
    assert.ok(/4 rounds(?:,| and) 13 catches/.test(artifact),
      rel + ' must carry the reconciled public count');
    assert.ok(!/4 rounds(?:,| and) 10 catches/.test(artifact),
      rel + ' still carries the stale public count');
  });
});

run();
