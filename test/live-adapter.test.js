/* =====================================================================
 * live-adapter.test.js - regression guard for the LIVE chord-pack seam in
 * music/play/index.html (buildAdapter's profileVoicing enharmonic fallback).
 *
 * buildAdapter lives inline in the page (browser closure, not require-able),
 * so this test EXTRACTS the profileVoicing source + its ENH table from the
 * HTML and evaluates them against stub profiles. If someone deletes or
 * reverts profileVoicing (codex V2 high: "reverting would ship green"),
 * the extraction fails loudly; if its behavior regresses, the asserts do.
 * Run: node test/live-adapter.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

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

var html = fs.readFileSync(path.join(__dirname, '..', 'music', 'play', 'index.html'), 'utf8');

// Pull the ENH table + profileVoicing function bodies out of buildAdapter.
var enhM = /var ENH = \{[^}]*\};/.exec(html);
var pvM = /function profileVoicing\(name\) \{[\s\S]*?\n    \}/.exec(html);
function makeProfileVoicing(profile) {
  // Evaluate the EXACT page source with `profile` bound, mirroring the closure.
  /* eslint-disable no-new-func */
  return new Function('profile', enhM[0] + '\n' + pvM[0] + '\nreturn profileVoicing;')(profile);
}

test('page still defines the ENH table + profileVoicing (extraction guard)', function () {
  assert.ok(enhM, 'var ENH = {...} not found in play/index.html buildAdapter');
  assert.ok(pvM, 'function profileVoicing(...) not found in play/index.html buildAdapter');
  // and the live lookups actually route through it
  assert.ok(/return profileVoicing\(name\) \|\| movableVoicing/.test(html),
    'voicingFor no longer routes through profileVoicing');
  assert.ok(/movableVoicing\(templates, name\) \|\| profileVoicing\(name\)/.test(html),
    'closedVoicingFor no longer routes through profileVoicing');
});

test('canonical-sharp requests find flat-keyed curated voicings (mandolin regression case)', function () {
  var pv = makeProfileVoicing({ chords: { 'Bb': [3, 0, 1, 1], 'C': [0, 0, 0, 3] } });
  assert.deepStrictEqual(pv('A#'), [3, 0, 1, 1]);   // the V1-council critical: A# -> curated Bb
  assert.deepStrictEqual(pv('Bb'), [3, 0, 1, 1]);   // exact name still wins directly
  assert.deepStrictEqual(pv('C'), [0, 0, 0, 3]);
});

test('suffixes ride along with the respelled root', function () {
  var pv = makeProfileVoicing({ chords: { 'Bbm': [1, 1, 1, 3], 'Eb7': [0, 1, 1, 1] } });
  assert.deepStrictEqual(pv('A#m'), [1, 1, 1, 3]);
  assert.deepStrictEqual(pv('D#7'), [0, 1, 1, 1]);
});

test('flat requests find sharp-keyed voicings (both directions)', function () {
  var pv = makeProfileVoicing({ chords: { 'F#': [2, 4, 4, 3] } });
  assert.deepStrictEqual(pv('Gb'), [2, 4, 4, 3]);
});

test('misses return null (movable fallback stays in charge)', function () {
  var pv = makeProfileVoicing({ chords: { 'C': [0, 0, 0, 3] } });
  assert.strictEqual(pv('A#'), null);
  assert.strictEqual(pv('H'), null);
  assert.strictEqual(pv(''), null);
});

test('no profile.chords -> null, never a throw', function () {
  var pv = makeProfileVoicing({});
  assert.strictEqual(pv('A#'), null);
});

run();
