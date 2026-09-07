/* =====================================================================
 * thought-ware-methodology.test.js - guards the proposed method against
 * internally inconsistent claims, lifecycle fields, and study terminology.
 *
 * Run: node test/thought-ware-methodology.test.js
 * ===================================================================== */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var METHOD = 'docs/artifacts/thought-ware-development/';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
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

test('controlled evaluation is distinct from independent replication', function () {
  var current = path.join(ROOT, METHOD + 'experiment-1-controlled-evaluation-protocol.md');
  var retired = path.join(ROOT, METHOD + 'experiment-1-protocol.md');
  assert.ok(fs.existsSync(current), 'controlled-evaluation protocol is missing');
  assert.ok(!fs.existsSync(retired), 'ambiguous legacy protocol filename remains');
  var protocol = fs.readFileSync(current, 'utf8');
  assert.ok(protocol.indexOf('This is a prospective controlled evaluation, not a replication.') !== -1,
    'study terminology must distinguish evaluation from replication');
});

test('Recorded is partial and Controlled is minimum full conformance', function () {
  var spec = read(METHOD + 'specification-v0.1.md');
  assert.ok(spec.indexOf('Recorded adoption') !== -1, 'Recorded adoption boundary is missing');
  assert.ok(spec.indexOf('minimum full-method conformance profile') !== -1,
    'Controlled conformance boundary is missing');
});

test('exceptions cannot convert an unsatisfied MUST into conformance', function () {
  var spec = read(METHOD + 'specification-v0.1.md');
  assert.ok(/exception documents and authorizes risk; it does not make an unsatisfied\nrequirement satisfied/i.test(spec),
    'exception semantics permit conformance laundering');
  assert.ok(spec.indexOf('report `NONCONFORMING`') !== -1,
    'profile result for an active exception is not explicit');
});

test('gate-state precedence is deterministic and fail closed', function () {
  var spec = read(METHOD + 'specification-v0.1.md');
  var fail = spec.indexOf('1. `FAIL`');
  var invalid = spec.indexOf('2. `INVALID_EVIDENCE`');
  var blocked = spec.indexOf('3. `BLOCKED`');
  var unverified = spec.indexOf('4. `UNVERIFIED`');
  var pass = spec.indexOf('5. `PASS`');
  assert.ok(fail !== -1 && fail < invalid && invalid < blocked && blocked < unverified && unverified < pass,
    'gate-state precedence is absent or reordered');
});

test('governed artifact templates expose the canonical lifecycle states', function () {
  var canonical = '`PROPOSED | ACTIVE | DEPRECATED | SUPERSEDED | RETIRED | REJECTED`';
  [
    'authority-record.md', 'conformance-assessment.md', 'decision-record.md',
    'evaluation-result.md', 'friction-record.md', 'goalpost.md', 'red-proof.md',
    'release-evidence-bundle.md', 'scenario-fixture.md', 'uat-capture.md'
  ].forEach(function (name) {
    var body = read(METHOD + 'templates/' + name);
    assert.ok(body.indexOf(canonical) !== -1, name + ' has lifecycle-state drift');
  });
});

test('primary outcomes cannot improve merely through noncompletion', function () {
  var protocol = read(METHOD + 'experiment-1-controlled-evaluation-protocol.md');
  assert.ok(protocol.indexOf('divided by all assigned tasks in the arm') !== -1,
    'assigned-task denominator is missing');
  assert.ok(protocol.indexOf('Both outcomes are required') !== -1,
    'unacceptable completion is not paired with verified success');
  assert.ok(protocol.indexOf('intention-to-treat') !== -1,
    'intention-to-treat protection is missing');
});

test('calibration design is executable and cannot claim effectiveness', function () {
  var runbook = read(METHOD + 'experiment-1-calibration-runbook.md');
  assert.ok(runbook.indexOf('twelve allocation units: six treatment and six baseline') !== -1,
    'calibration allocation is not explicit');
  assert.ok(runbook.indexOf('MUST NOT establish comparative effectiveness') !== -1,
    'calibration claim boundary is missing');
  assert.ok(runbook.indexOf('synthetic analysis dataset') !== -1,
    'analysis rehearsal control is missing');
});

test('normative review preserves unresolved empirical blockers', function () {
  var review = read(METHOD + 'normative-review-20260907.md');
  assert.ok(review.indexOf('twelve material objections resolved') !== -1,
    'review disposition is missing');
  assert.ok(review.indexOf('they do not supply the missing data') !== -1,
    'review overstates what specification changes establish');
});

run();
