/* =====================================================================
 * candidates.test.js  -  integrity tests binding the curation-candidates
 * map to the seed catalog through the REAL Tracks.trackKey: every bucket
 * must belong to a real seed track (no orphans - the wrong-serialization
 * bug class), and every url-less seed track must have suggestions (the
 * 35/35 coverage claim, previously proven only by a throwaway script).
 * Run: node test/candidates.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var T = require('../music/shared/tracks.js');
var C = require('../music/shared/candidates.js');

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

var seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../music/backing-tracks/tracks.json'), 'utf8'));

test('candidates module exports the map in Node (browser attaches to Tracks)', function () {
  assert.ok(C.CANDIDATES && typeof C.CANDIDATES === 'object');
  assert.ok(Object.keys(C.CANDIDATES).length > 0);
});

test('every candidates bucket keys a REAL seed track via Tracks.trackKey (no orphans)', function () {
  var seedKeys = {};
  seed.forEach(function (t) { seedKeys[T.trackKey(t)] = true; });
  Object.keys(C.CANDIDATES).forEach(function (k) {
    assert.ok(seedKeys[k], 'orphan candidates bucket (key matches no seed track): ' + k);
  });
});

test('every url-less seed track has at least one candidate (full curation coverage)', function () {
  seed.filter(function (t) { return !t.yt; }).forEach(function (t) {
    var c = C.CANDIDATES[T.trackKey(t)] || [];
    assert.ok(c.length >= 1, 'no candidates for url-less seed track: ' + T.trackKey(t));
  });
});

test('modal seed tracks keep their true-mode bucket (the coarsened-to-major regression)', function () {
  seed.filter(function (t) { return t.mode === 'dorian' || t.mode === 'mixolydian'; }).forEach(function (t) {
    var k = T.trackKey(t);
    assert.ok(/\|(dorian|mixolydian)$/.test(k), 'modal track serialized without its mode: ' + k);
    assert.ok(C.CANDIDATES[k], 'modal track lost its candidates bucket: ' + k);
  });
});

test('every candidate id is a well-formed YouTube video id', function () {
  Object.keys(C.CANDIDATES).forEach(function (k) {
    C.CANDIDATES[k].forEach(function (c) {
      assert.ok(/^[A-Za-z0-9_-]{11}$/.test(c.id), 'bad id in ' + k + ': ' + c.id);
    });
  });
});

run();
