/* =====================================================================
 * build-stamp.test.js - M-SETTINGS-CLARITY: the authored version +
 * freshness stamp (music/shared/build-stamp.js).
 * ---------------------------------------------------------------------
 * The load-bearing assertion is the GUARD LOCK: BuildStamp.VERSION is a
 * deliberate duplicate of sw.js's CACHE string (pages can't read a service
 * worker's constant synchronously), and drift between the two must be a
 * failing test - this is the suite-side half of the pair; the git-diff
 * half (UPDATED_ISO must change when CACHE bumps) lives in
 * scripts/check-cache-bump.sh, which needs history a unit test doesn't have.
 * Run: node test/build-stamp.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var BuildStamp = require('../music/shared/build-stamp.js');

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

/* ---------- the guard lock: VERSION mirrors sw.js CACHE ---------- */
test('VERSION mirrors music/sw.js CACHE byte-for-byte (the guard-locked duplicate)', function () {
  var swSrc = fs.readFileSync(path.join(__dirname, '..', 'music', 'sw.js'), 'utf8');
  var m = /CACHE = '([^']+)'/.exec(swSrc);
  assert.ok(m, 'could not extract CACHE from music/sw.js - has the declaration shape changed?');
  assert.strictEqual(BuildStamp.VERSION, m[1],
    'build-stamp VERSION (' + BuildStamp.VERSION + ') drifted from sw.js CACHE (' + m[1] + ') - bump both in the same commit');
});

test('UPDATED_ISO is a parseable ISO 8601 UTC instant', function () {
  var d = new Date(BuildStamp.UPDATED_ISO);
  assert.ok(!isNaN(d.getTime()), 'UPDATED_ISO does not parse: ' + BuildStamp.UPDATED_ISO);
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(BuildStamp.UPDATED_ISO),
    'UPDATED_ISO must be authored as a Z-suffixed UTC instant (readers localize via fmt): ' + BuildStamp.UPDATED_ISO);
});

/* ---------- fmt(): locale rendering, honest on bad input ---------- */
test('fmt() renders a parseable ISO as a non-empty locale string containing the year', function () {
  var out = BuildStamp.fmt('2026-07-05T14:07:09Z');
  assert.ok(out.length > 0, 'expected non-empty');
  assert.ok(out.indexOf('2026') !== -1, 'expected the year in: ' + out);
});
test('fmt() returns "" on an unparseable date (never a "Invalid Date" leak)', function () {
  assert.strictEqual(BuildStamp.fmt('not-a-date'), '');
  assert.strictEqual(BuildStamp.fmt(''), '');
  assert.strictEqual(BuildStamp.fmt(null), '');
});

/* ---------- text(): the footer line ---------- */
test('text() leads with the short version (music- prefix stripped) and includes "updated"', function () {
  var out = BuildStamp.text();
  assert.ok(out.indexOf('music-') === -1, 'music- prefix must be stripped for display: ' + out);
  assert.ok(/^v\d+/.test(out), 'expected a leading vNNN: ' + out);
  assert.ok(out.indexOf(' - updated ') !== -1, 'expected " - updated <datetime>": ' + out);
});

/* ---------- renderInto(): tolerant of a missing element ---------- */
test('renderInto() sets textContent to text(), and no-ops on null', function () {
  var el = { textContent: '' };
  BuildStamp.renderInto(el);
  assert.strictEqual(el.textContent, BuildStamp.text());
  BuildStamp.renderInto(null); // must not throw
});

run();
