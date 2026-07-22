/* =====================================================================
 * callouts.test.js  -  unit tests for the first-run per-tab callouts
 * (music/shared/callouts.js): the CONFIG shape + the additive show-once
 * store (shownFor / markShown / reset). The browser-only positioning glue
 * (mount) is exercised by the render smoke, not here.
 * Run: node test/callouts.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var lsReset = require('./helpers/local-storage-reset.js');
function resetLocalStorage(seed) {
  global.localStorage = lsReset.fakeStore();
  if (seed) Object.keys(seed).forEach(function (k) { global.localStorage.setItem(k, seed[k]); });
}
resetLocalStorage();
var Callouts = require('../music/shared/callouts.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('exposes the four real tabs, in order', function () {
  assert.deepStrictEqual(Callouts.TABS, ['library', 'jam', 'compose', 'tune']);
});

test('every tab has a primary target with a selector + non-empty text', function () {
  Callouts.TABS.forEach(function (tab) {
    var cfg = Callouts.configFor(tab);
    assert.ok(cfg, tab + ' has config');
    assert.ok(cfg.primary && typeof cfg.primary.sel === 'string' && cfg.primary.sel[0] === '#', tab + ' primary sel is an id');
    assert.ok(cfg.primary.text && cfg.primary.text.length > 0, tab + ' primary has copy');
    assert.ok(Array.isArray(cfg.secondary), tab + ' secondary is an array');
    cfg.secondary.forEach(function (s) {
      assert.ok(typeof s.sel === 'string' && s.text && s.text.length, tab + ' secondary well-formed');
    });
  });
});

test('primary copy stays in beginner vocabulary (no theory jargon)', function () {
  var banned = /\b(dominant|tonic|diatonic|mixolydian|dorian|aeolian|pentatonic)\b/i;
  Callouts.TABS.forEach(function (tab) {
    var cfg = Callouts.configFor(tab);
    assert.ok(!banned.test(cfg.primary.text), tab + ' primary avoids jargon: ' + cfg.primary.text);
    cfg.secondary.forEach(function (s) { assert.ok(!banned.test(s.text), tab + ' secondary avoids jargon'); });
  });
});

test('configFor returns null for an unknown tab', function () {
  assert.strictEqual(Callouts.configFor('practice'), null);
  assert.strictEqual(Callouts.configFor('nope'), null);
});

test('shownFor is false before any mark', function () {
  resetLocalStorage();
  assert.strictEqual(Callouts.shownFor('library'), false);
});

test('markShown flips only the named tab (additive, others untouched)', function () {
  resetLocalStorage();
  Callouts.markShown('library');
  assert.strictEqual(Callouts.shownFor('library'), true);
  assert.strictEqual(Callouts.shownFor('compose'), false);
  Callouts.markShown('compose');
  assert.strictEqual(Callouts.shownFor('library'), true, 'library survives a second mark');
  assert.strictEqual(Callouts.shownFor('compose'), true);
});

test('markShown persists as an object map, never a bare array', function () {
  resetLocalStorage();
  Callouts.markShown('tune');
  var raw = global.localStorage.getItem(Callouts.STORE);
  var o = JSON.parse(raw);
  assert.ok(o && typeof o === 'object' && !Array.isArray(o), 'stored value is an object');
  assert.strictEqual(o.tune, 1);
});

test('reset clears every tab (the "?" replay)', function () {
  resetLocalStorage();
  Callouts.markShown('library'); Callouts.markShown('jam');
  Callouts.reset();
  assert.strictEqual(Callouts.shownFor('library'), false);
  assert.strictEqual(Callouts.shownFor('jam'), false);
});

test('a corrupt store value degrades to "nothing shown" (defensive read)', function () {
  resetLocalStorage();
  global.localStorage.setItem(Callouts.STORE, '["library"]'); // wrong shape (array)
  assert.strictEqual(Callouts.shownFor('library'), false, 'array shape is ignored, not trusted');
  global.localStorage.setItem(Callouts.STORE, 'not json');
  assert.strictEqual(Callouts.shownFor('library'), false, 'garbage is ignored');
});

test('markShown re-marks cleanly after a corrupt read', function () {
  resetLocalStorage();
  global.localStorage.setItem(Callouts.STORE, 'not json');
  Callouts.markShown('compose');
  assert.strictEqual(Callouts.shownFor('compose'), true);
});

cases.forEach(function (c) {
  try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
  catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
