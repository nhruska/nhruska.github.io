/* =====================================================================
 * profile-roundtrip.test.js - M-MUSICIAN-PROFILE: the interoperability
 * floor proven against a HYPOTHETICAL SONGWRITING APP ("LyricLab") that
 * knows nothing about this app. LyricLab is implemented HERE as a minimal
 * participant that follows ONLY the three-rule contract carried inside the
 * document (it never reads AGENTS.md - that file is optional by design):
 *
 *   1. read what you understand   - the lyric-writing branch + goals
 *   2. preserve what you don't    - every ukulele/guitar record, the app's
 *                                   evidence, keys it has never seen
 *   3. add what you legitimately knows - its own branch (songwriting),
 *                                   an OBSERVED assessment in the WRITE
 *                                   modality, a goal, its own extension
 *
 * Trip: Music app export -> LyricLab -> Music app import -> Music app
 * export -> LyricLab reads its own data back intact, plus the app's new
 * evidence. Neither side loses anything; neither side overclaims.
 * Run: node test/profile-roundtrip.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MP = require('../music/shared/musician-profile.js');
var C = require('../music/shared/competency.js');

function FakeStore(seed) {
  var m = seed ? JSON.parse(JSON.stringify(seed)) : {};
  return {
    _m: m,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
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

var T0 = '2026-09-13T10:00:00.000Z', T1 = '2026-09-13T11:00:00.000Z', T2 = '2026-09-13T12:00:00.000Z', T3 = '2026-09-13T13:00:00.000Z';

/* ---------- LyricLab: a minimal participant written against the contract only ---------- */
var LyricLab = {
  ID: 'app:lyriclab',
  // Rule 1: read what you understand. LyricLab knows the lyric-writing branch
  // (by branch path, not by our framework ids - it only recognizes "craft").
  read: function (json) {
    var doc = JSON.parse(json);
    if (!doc || doc.schema !== 'musician-profile/v1') throw new Error('LyricLab: not a musician profile');
    if (!doc.contract || doc.contract.id !== 'minimum-participation/v1') throw new Error('LyricLab: unknown contract');
    var lyric = (doc.competencies || []).filter(function (c) { return c.branch && c.branch[0] === 'craft' && c.branch[1] === 'lyric-writing'; });
    var goals = doc.goals || [];
    return { doc: doc, lyricCompetencies: lyric, goals: goals };
  },
  // Rule 3: add what you legitimately know. LyricLab watched the musician
  // write, so it may claim WRITE modality on what it saw - and nothing else.
  // Rule 2: everything it does not understand is left exactly as found.
  contribute: function (json, now) {
    var doc = JSON.parse(json); // work on the parsed object, touch only our own additions
    doc.participants = (doc.participants || []).concat([{ id: LyricLab.ID, name: 'LyricLab', version: '0.3', url: 'https://lyriclab.example/', understands: ['competencies', 'assessments', 'evidence', 'goals'], last_seen: now }]);
    doc.provenance = (doc.provenance || []).concat([{ source: LyricLab.ID, at: now, action: 'assess' }]);
    doc.competencies = (doc.competencies || []).concat([
      { id: 'songwriting/hook-writing', name: 'Hook writing', desc: 'Land a chorus hook that repeats without wearing out.', branch: ['craft', 'songwriting'], source: LyricLab.ID }
    ]);
    doc.evidence = (doc.evidence || []).concat([
      { id: 'ev:lyriclab:draft-17', at: now, source: LyricLab.ID, kind: 'draft', modality: 'write', competencies: ['lyric-writing/lyr-rhyme', 'songwriting/hook-writing'], data: { words: 212, revisions: 4 } }
    ]);
    doc.assessments = (doc.assessments || []).concat([
      { id: 'as:lyriclab:rhyme:1', competency: 'lyric-writing/lyr-rhyme', value: 55, scale: '0-100', method: 'observed', modality: 'write', at: now, source: LyricLab.ID, evidence: ['ev:lyriclab:draft-17'], note: 'four revisions moved every forced rhyme; slant rhymes chosen on purpose' }
    ]);
    doc.goals = (doc.goals || []).concat([
      { id: 'goal:lyriclab:1', statement: 'Finish the lyric for the campfire song', competencies: ['lyric-writing/lyr-structure'], status: 'active', created: now, updated: now, source: 'human' }
    ]);
    doc.extensions = doc.extensions || {};
    doc.extensions['x-lyriclab'] = { drafts: [17], rhymeScheme: 'ABAB' };
    doc['x-lyriclab-index'] = { version: 1 }; // an unknown TOP-LEVEL key the music app has never seen
    doc.updated = now;
    return JSON.stringify(doc, null, 2);
  }
};

test('round trip: Music app -> LyricLab -> Music app -> LyricLab loses nothing on either side and overclaims nothing', function () {
  // --- Music app, day 1: real composing happened; the musician self-reported "beginner".
  var s = FakeStore();
  for (var i = 0; i < 2; i++) C.recordEvidence('ukulele', 'uke-repertoire', null, s);
  C.recordEvidence('music-composition', 'comp-progressions', null, s);
  var out1 = MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'beginner', version: 'music-v0', now: T0 });
  var musicianId = JSON.parse(out1).id;

  // --- LyricLab reads what it understands.
  var seen = LyricLab.read(out1);
  assert.strictEqual(seen.lyricCompetencies.length, 5, 'LyricLab found the lyric-writing branch by branch path');
  assert.ok(seen.lyricCompetencies.every(function (c) { return MP.status(seen.doc, c.id).status === 'unassessed'; }), 'LyricLab reads UNASSESSED, not beginner, for lyrics the app never observed');
  assert.strictEqual(seen.goals.length, 0);
  // It does not misread the app's compose evidence as performance: the record says so.
  var uke = seen.doc.evidence.filter(function (e) { return e.id === 'ev:app:music:progression:ukulele'; })[0];
  assert.strictEqual(uke.modality, 'compose');

  // --- LyricLab contributes what it legitimately knows and hands back.
  var back1 = LyricLab.contribute(out1, T1);

  // --- Music app imports the hand-back.
  var res = MP.importJson(back1, s, { now: T2 });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.added, { assessments: 1, evidence: 1, goals: 1 });
  var stored = MP.loadStored(s);
  assert.strictEqual(stored.id, musicianId, 'the musician id is stable across the trip');
  // Reads what it understands:
  assert.strictEqual(MP.status(stored, 'lyric-writing/lyr-rhyme').assessment.source, 'app:lyriclab');
  assert.strictEqual(MP.status(stored, 'lyric-writing/lyr-rhyme').assessment.modality, 'write');
  assert.strictEqual(stored.goals[0].id, 'goal:lyriclab:1');
  // Preserves what it doesn't:
  assert.ok(stored.competencies.some(function (c) { return c.id === 'songwriting/hook-writing'; }), 'a branch the app does not ship is preserved verbatim');
  assert.deepStrictEqual(stored.extensions['x-lyriclab'], { drafts: [17], rhymeScheme: 'ABAB' });
  assert.deepStrictEqual(stored['x-lyriclab-index'], { version: 1 }, 'an unknown top-level key survives the import');
  // Its own data is untouched by the trip:
  assert.strictEqual(stored.assessments.filter(function (a) { return a.id === 'as:app:music:self-report'; }).length, 1);
  assert.strictEqual(stored.evidence.filter(function (e) { return e.source === 'app:music'; }).length, 2);
  // And the app's own counters did NOT double from seeing its own progression evidence again:
  var docs = MP.progressionDocs(stored);
  docs.forEach(function (d) { C.importProfile(d, s, { counters: 'max' }); });
  var rep = C.getProfile('ukulele', s).competencies.filter(function (c) { return c.id === 'uke-repertoire'; })[0];
  assert.strictEqual(rep.evidence_count, 2);

  // --- Music app, day 2: more composing, then export again.
  C.recordEvidence('ukulele', 'uke-open-chords', null, s);
  var out2 = MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'beginner', version: 'music-v0', now: T3 });

  // --- LyricLab reads the second export: its contribution is intact, the app's additions are visible.
  var seen2 = LyricLab.read(out2);
  var d2 = seen2.doc;
  assert.deepStrictEqual(d2.extensions['x-lyriclab'], { drafts: [17], rhymeScheme: 'ABAB' });
  assert.deepStrictEqual(d2['x-lyriclab-index'], { version: 1 });
  assert.strictEqual(d2.assessments.filter(function (a) { return a.id === 'as:lyriclab:rhyme:1'; })[0].value, 55);
  assert.ok(d2.evidence.some(function (e) { return e.id === 'ev:lyriclab:draft-17'; }));
  assert.ok(d2.competencies.some(function (c) { return c.id === 'songwriting/hook-writing'; }));
  assert.strictEqual(seen2.goals.length, 1);
  assert.deepStrictEqual(d2.participants.map(function (p) { return p.id; }).sort(), ['app:lyriclab', 'app:music']);
  var uke2 = d2.evidence.filter(function (e) { return e.id === 'ev:app:music:progression:ukulele'; })[0];
  assert.strictEqual(uke2.data.competencies.length, 2, 'day-2 composing is visible to LyricLab as updated evidence');
  assert.strictEqual(uke2.modality, 'compose', 'still honest about modality');
  // Provenance tells the whole story, append-only.
  var trail = d2.provenance.map(function (p) { return p.source + ':' + p.action; });
  assert.deepStrictEqual(trail, ['app:music:export', 'app:lyriclab:assess', 'app:music:import', 'app:music:export']);
  // Nothing LyricLab did turned into a proficiency number for something it did not observe.
  assert.strictEqual(MP.status(d2, 'ukulele/uke-open-chords').status, 'unassessed');
});

test('a participant that strips what it does not understand is DETECTABLE: the merge keeps the local copy, and the trail shows who touched the doc', function () {
  // A badly-behaved app hands back only the sections it knows - the music
  // app's merge is a UNION, so the local records survive regardless.
  var s = FakeStore();
  C.recordEvidence('guitar', 'gtr-open-chords', null, s);
  var out = MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'intermediate', now: T0 });
  var lossy = JSON.parse(out);
  var stripped = { schema: lossy.schema, id: lossy.id, updated: T1,
    participants: [{ id: 'app:lossy', name: 'Lossy', understands: ['goals'], last_seen: T1 }],
    provenance: [{ source: 'app:lossy', at: T1, action: 'edit' }],
    goals: [{ id: 'goal:lossy', statement: 'x', status: 'active', updated: T1 }] };
  assert.strictEqual(MP.importJson(stripped, s, { now: T2 }).ok, true);
  var stored = MP.loadStored(s);
  assert.strictEqual(stored.evidence.length, 1, 'the app\'s evidence survived a lossy hand-back');
  assert.strictEqual(stored.assessments.length, 1);
  assert.strictEqual(stored.competencies.length, 25);
  assert.ok(stored.participants.some(function (p) { return p.id === 'app:lossy'; }));
});

run();
