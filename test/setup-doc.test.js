/* =====================================================================
 * setup-doc.test.js - S17 agent-interaction spec 4b (A8): the batch
 * `music-setup/v1` setup-doc parser (music/shared/setup-doc.js). Locked
 * contract: schema-disambiguated from skill-competency-profile/v1, chord
 * tokens canonical-sharp / key un-respelled / yt keyless (all delegated to
 * jam-link.js's grammar), unknown entry types skip-and-count rather than
 * reject the whole doc, zero valid entries -> ok:false, never throws.
 * Run: node test/setup-doc.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

var SetupDoc = require('../music/shared/setup-doc.js');

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

function baseDoc(entries) {
  return { schema: 'music-setup/v1', created: '2026-08-17T00:00:00Z', source: 'agent:claude-code', entries: entries };
}

test('a valid single jam entry parses into the jam-link setup shape', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'jam', name: 'ii-V-I in G', chords: ['Am7', 'D7', 'Gmaj7'], key: 'G', yt: 'dQw4w9WgXcQ' }
  ]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.schema, 'music-setup/v1');
  assert.strictEqual(r.doc.entries.length, 1);
  assert.deepStrictEqual(r.doc.entries[0], {
    type: 'jam', chords: ['Am7', 'D7', 'Gmaj7'], key: { tonic: 'G', minor: false }, yt: 'dQw4w9WgXcQ', name: 'ii-V-I in G'
  });
  assert.strictEqual(r.skipped, 0);
  assert.strictEqual(r.total, 1);
});

test('a valid single track entry parses with separate key/mode fields', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'track', name: 'Backing jam', yt: 'https://youtu.be/dQw4w9WgXcQ', key: 'Bb', mode: 'minor' }
  ]));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc.entries[0], {
    type: 'track', yt: 'dQw4w9WgXcQ', name: 'Backing jam', key: 'Bb', mode: 'minor'
  });
});

test('track entry with no mode field defaults to major', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'track', yt: 'dQw4w9WgXcQ', key: 'D' }]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries[0].mode, 'major');
});

test('track entry with no key at all -> key null, mode major', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'track', yt: 'dQw4w9WgXcQ' }]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries[0].key, null);
  assert.strictEqual(r.doc.entries[0].mode, 'major');
});

test('flat chord roots normalize to canonical-sharp (jam-link identity rule reused)', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'jam', chords: ['Bb', 'Eb', 'Ab7'] }]));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc.entries[0].chords, ['A#', 'D#', 'G#7']);
});

test('jam entry key tonic is NOT re-spelled (display flavor, not identity)', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'jam', chords: ['C'], key: 'Bb' }]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries[0].key.tonic, 'Bb');
});

test('disambiguation: a skill-competency-profile/v1 doc is rejected, not silently accepted', function () {
  var r = SetupDoc.parse({ schema: 'skill-competency-profile/v1', skill: 'guitar', competencies: [] });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /unrecognized/);
});

test('unknown entry type is SKIPPED and counted, not fatal to the whole doc', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'jam', chords: ['C', 'G'] },
    { type: 'practice-plan', foo: 1 }
  ]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries.length, 1);
  assert.strictEqual(r.skipped, 1);
  assert.strictEqual(r.total, 2);
});

test('a jam entry whose every chord token is invalid drops the ENTRY (whole-jam-drops rule)', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'jam', chords: ['Hm', 'Zzz'] },
    { type: 'track', yt: 'dQw4w9WgXcQ' }
  ]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries.length, 1);
  assert.strictEqual(r.doc.entries[0].type, 'track');
  assert.strictEqual(r.skipped, 1);
});

test('a jam entry with an empty chords array is skipped (nothing to jam on)', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'jam', chords: [] }]));
  assert.strictEqual(r.ok, false);
});

test('a track entry with no yt is REJECTED (yt is required for track)', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'track', name: 'No video' }]));
  assert.strictEqual(r.ok, false);
});

test('a track entry with an unparseable yt is rejected', function () {
  var r = SetupDoc.parse(baseDoc([{ type: 'track', yt: 'https://example.com/not-a-video' }]));
  assert.strictEqual(r.ok, false);
});

test('zero valid entries after skips -> ok:false with a reason naming the skip count', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'unknown-1' }, { type: 'unknown-2' }, { type: 'jam', chords: [] }
  ]));
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /skipped 3 of 3/);
});

test('no entries array at all -> ok:false', function () {
  assert.strictEqual(SetupDoc.parse({ schema: 'music-setup/v1' }).ok, false);
  assert.strictEqual(SetupDoc.parse({ schema: 'music-setup/v1', entries: [] }).ok, false);
});

test('created/source pass through when present, null when absent', function () {
  var withMeta = SetupDoc.parse(baseDoc([{ type: 'track', yt: 'dQw4w9WgXcQ' }]));
  assert.strictEqual(withMeta.doc.created, '2026-08-17T00:00:00Z');
  assert.strictEqual(withMeta.doc.source, 'agent:claude-code');
  var noMeta = SetupDoc.parse({ schema: 'music-setup/v1', entries: [{ type: 'track', yt: 'dQw4w9WgXcQ' }] });
  assert.strictEqual(noMeta.doc.created, null);
  assert.strictEqual(noMeta.doc.source, null);
});

test('accepts a JSON string, not just a parsed object', function () {
  var r = SetupDoc.parse(JSON.stringify(baseDoc([{ type: 'track', yt: 'dQw4w9WgXcQ' }])));
  assert.strictEqual(r.ok, true);
});

test('never throws on garbage input', function () {
  assert.doesNotThrow(function () { SetupDoc.parse('not json'); });
  assert.doesNotThrow(function () { SetupDoc.parse('???&&&==='); });
  assert.doesNotThrow(function () { SetupDoc.parse(12345); });
  assert.doesNotThrow(function () { SetupDoc.parse(null); });
  assert.doesNotThrow(function () { SetupDoc.parse(undefined); });
  assert.doesNotThrow(function () { SetupDoc.parse([1, 2, 3]); });
  assert.doesNotThrow(function () { SetupDoc.parse({}); });
  assert.doesNotThrow(function () { SetupDoc.parse(baseDoc([null, 42, 'garbage', { type: 'jam' }])); });
});

test('a full realistic batch doc (mixed jam + track + one skip)', function () {
  var r = SetupDoc.parse(baseDoc([
    { type: 'jam', name: 'Verse groove', chords: ['G', 'D', 'Em', 'C'], key: 'G' },
    { type: 'track', name: 'Reference cut', yt: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', key: 'G', mode: 'major' },
    { type: 'practice-plan', steps: ['warm up'] }
  ]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.entries.length, 2);
  assert.strictEqual(r.skipped, 1);
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.doc.entries[0].type, 'jam');
  assert.strictEqual(r.doc.entries[1].type, 'track');
});

run();
