/* =====================================================================
 * tracks-catalog.test.js  -  schema validator for the shipped backing-track
 * catalog (music/backing-tracks/tracks.json). The catalog gained a machine
 * pipeline (scripts/playlist-sync.js) that appends entries, so the shape
 * gets a gate in the same PR (ship the linter with the tokens): 9 exact
 * keys per record, well-formed unique yt ids, keys that parse through the
 * real theory module, modes from the app's actual vocabulary.
 * Run: node test/tracks-catalog.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var TM = require('../music/shared/tracks-model.js');

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
var KEYS = ['yt', 'title', 'artist', 'genre', 'key', 'mode', 'bpm', 'capo', 'tags'];
var MODES = ['major', 'minor', 'dorian', 'mixolydian', 'blues'];

function label(t, i) { return '#' + i + ' "' + (t && t.title || '?') + '"'; }

test('catalog is a non-empty array', function () {
  assert.ok(Array.isArray(seed) && seed.length > 0);
});

test('every record has exactly the 9 canonical keys', function () {
  seed.forEach(function (t, i) {
    var got = Object.keys(t).sort().join(',');
    assert.strictEqual(got, KEYS.slice().sort().join(','), label(t, i) + ' keys: ' + got);
  });
});

test('yt is null or a well-formed 11-char YouTube id', function () {
  seed.forEach(function (t, i) {
    assert.ok(t.yt === null || /^[A-Za-z0-9_-]{11}$/.test(t.yt), label(t, i) + ' yt: ' + t.yt);
  });
});

test('non-null yt ids are globally unique', function () {
  var byId = {};
  seed.forEach(function (t, i) {
    if (!t.yt) return;
    assert.ok(!byId[t.yt], 'duplicate yt id ' + t.yt + ' at ' + label(t, i) + ' and ' + byId[t.yt]);
    byId[t.yt] = label(t, i);
  });
});

test('title and artist are strings (artist may be empty, never missing)', function () {
  seed.forEach(function (t, i) {
    assert.strictEqual(typeof t.title, 'string', label(t, i) + ' title');
    assert.ok(t.title.trim().length > 0, label(t, i) + ' empty title');
    assert.strictEqual(typeof t.artist, 'string', label(t, i) + ' artist');
  });
});

test('key parses through the real theory module (flats and sharps both)', function () {
  seed.forEach(function (t, i) {
    assert.ok(TM.rootIndex(t.key) >= 0, label(t, i) + ' unparseable key: ' + t.key);
  });
});

test('mode is from the app vocabulary', function () {
  seed.forEach(function (t, i) {
    assert.ok(MODES.indexOf(t.mode) >= 0, label(t, i) + ' mode: ' + t.mode);
  });
});

test('bpm is null or a finite positive number', function () {
  seed.forEach(function (t, i) {
    assert.ok(t.bpm === null || (typeof t.bpm === 'number' && isFinite(t.bpm) && t.bpm > 0), label(t, i) + ' bpm: ' + t.bpm);
  });
});

test('capo is a non-negative number', function () {
  seed.forEach(function (t, i) {
    assert.ok(typeof t.capo === 'number' && t.capo >= 0, label(t, i) + ' capo: ' + t.capo);
  });
});

test('tags is an array of non-empty strings', function () {
  seed.forEach(function (t, i) {
    assert.ok(Array.isArray(t.tags), label(t, i) + ' tags not an array');
    t.tags.forEach(function (tag) {
      assert.ok(typeof tag === 'string' && tag.trim().length > 0, label(t, i) + ' bad tag: ' + JSON.stringify(tag));
    });
  });
});

run();
