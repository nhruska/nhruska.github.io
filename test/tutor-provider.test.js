/* =====================================================================
 * tutor-provider.test.js  -  unit tests for the AI Tutor prototype's
 * canned response provider + settings persistence.
 * Run: node test/tutor-provider.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var TutorProvider = require('../music/tutor/provider.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
// Async-aware runner: a test fn may return a Promise (this file has a couple,
// unlike the rest of the suite) - await it before counting pass/fail so a
// rejected assertion inside .then() is actually caught, not silently green.
async function run() {
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    try { await c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- relativeMinorName ---------- */
test('relativeMinorName: C major -> A, sharps normalized', function () {
  assert.strictEqual(TutorProvider.relativeMinorName('C'), 'A');
  assert.strictEqual(TutorProvider.relativeMinorName('G'), 'E');
  assert.strictEqual(TutorProvider.relativeMinorName('Bb'), TutorProvider.relativeMinorName('A#'));
});
test('relativeMinorName: unknown root falls back to A (C major default)', function () {
  assert.strictEqual(TutorProvider.relativeMinorName('Z'), 'A');
});

/* ---------- pickReply: keyword routing ---------- */
test('pickReply routes "parallel vs relative" to the parallel-relative turn', function () {
  var r = TutorProvider.pickReply('whats the difference between parallel and relative', { key: 'C' });
  assert.ok(/relative/i.test(r.text) && /parallel/i.test(r.text));
  assert.ok(Array.isArray(r.quickReplies) && r.quickReplies.length > 0);
});
test('pickReply routes I-IV-V question and echoes the given key', function () {
  var r = TutorProvider.pickReply('show me I-IV-V vs i-iv-v', { key: 'G' });
  assert.ok(r.text.indexOf('G major') !== -1);
});
test('pickReply routes borrowed-chord question', function () {
  var r = TutorProvider.pickReply('what are borrowed chords and secondary dominants?', {});
  assert.ok(/borrowed/i.test(r.text) && /secondary dominant/i.test(r.text));
});
test('pickReply routes the Phase 4 scale-swap teaser and echoes relative minor of the given key', function () {
  var r = TutorProvider.pickReply('can I swap the solo scale over my progression?', { key: 'D' });
  assert.ok(r.text.indexOf(TutorProvider.relativeMinorName('D') + ' minor') !== -1);
});
test('pickReply routes the Phase 5 song-form teaser', function () {
  var r = TutorProvider.pickReply('help me build a song with a verse and chorus', {});
  assert.ok(/AABA|section/i.test(r.text));
});
test('pickReply falls back to the menu turn on an unrecognized message', function () {
  var r = TutorProvider.pickReply('asdkjhasdkjh nonsense', {});
  assert.deepStrictEqual(r, TutorProvider.FALLBACK);
});
test('pickReply defaults context-less calls to C without throwing', function () {
  assert.doesNotThrow(function () { TutorProvider.pickReply('parallel vs relative'); });
});

/* ---------- createCannedProvider / sendMessage ---------- */
test('createCannedProvider().sendMessage resolves the last user turn\'s reply', function () {
  var provider = TutorProvider.createCannedProvider({ latencyMs: 0 });
  return provider.sendMessage([{ role: 'user', text: 'parallel vs relative' }], { key: 'C' }).then(function (r) {
    assert.ok(/relative/i.test(r.text));
  });
});
test('createCannedProvider().sendMessage on empty history returns the fallback', function () {
  var provider = TutorProvider.createCannedProvider({ latencyMs: 0 });
  return provider.sendMessage([], {}).then(function (r) {
    assert.deepStrictEqual(r, TutorProvider.FALLBACK);
  });
});

/* ---------- settings persistence (Node: no localStorage, must degrade) ---------- */
test('loadSettings without localStorage returns DEFAULT_SETTINGS (no throw)', function () {
  var s = TutorProvider.loadSettings();
  assert.deepStrictEqual(s, TutorProvider.DEFAULT_SETTINGS);
});
test('saveSettings without localStorage returns the merged object (no throw)', function () {
  var s = TutorProvider.saveSettings({ model: 'test-model' });
  assert.strictEqual(s.model, 'test-model');
  assert.strictEqual(s.baseUrl, TutorProvider.DEFAULT_SETTINGS.baseUrl);
});
test('DEFAULT_SETTINGS ships with an empty apiKey (no secret baked in)', function () {
  assert.strictEqual(TutorProvider.DEFAULT_SETTINGS.apiKey, '');
});

/* ---------- localStorage round-trip (simulated) ---------- */
test('settings round-trip through a fake localStorage', function () {
  var store = {};
  global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  try {
    TutorProvider.saveSettings({ model: 'roundtrip-model', baseUrl: 'https://example.test' });
    var loaded = TutorProvider.loadSettings();
    assert.strictEqual(loaded.model, 'roundtrip-model');
    assert.strictEqual(loaded.baseUrl, 'https://example.test');
    assert.strictEqual(loaded.apiKey, ''); // untouched field keeps its default
  } finally {
    delete global.localStorage;
  }
});

run();
