/* =====================================================================
 * musician-profile.test.js - unit tests for M-MUSICIAN-PROFILE
 * (music/shared/musician-profile.js): the person-owned musician-profile/v1
 * document, the minimum participation contract as executable merge rules,
 * competencies-vs-assessments with UNASSESSED explicit, progression carried
 * as evidence (never proficiency), modality never overclaimed, stable ids,
 * additive storage.
 * Run: node test/musician-profile.test.js
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

var TAXONOMY_SIZE = C.FRAMEWORKS.reduce(function (n, fw) { return n + fw.competencies.length; }, 0);
var T0 = '2026-09-13T10:00:00.000Z', T1 = '2026-09-13T11:00:00.000Z', T2 = '2026-09-13T12:00:00.000Z';

/* ---------- the document ---------- */
test('blank profile carries the schema, the contract INSIDE the doc, a stable musician id, and every section', function () {
  var d = MP.blank({ id: 'mp_test', now: T0 });
  assert.strictEqual(d.schema, 'musician-profile/v1');
  assert.strictEqual(d.contract.id, 'minimum-participation/v1');
  assert.strictEqual(d.contract.rules.length, 3);
  assert.ok(/unassessed/i.test(d.contract.unassessed));
  assert.strictEqual(d.id, 'mp_test');
  ['participants', 'provenance', 'competencies', 'assessments', 'evidence', 'goals', 'preferences'].forEach(function (k) {
    assert.ok(Array.isArray(d[k]), k + ' must be a list');
  });
  assert.strictEqual(d.plan, null);
  assert.deepStrictEqual(d.extensions, {});
});
test('a minted musician id is stable per device: load() twice on an empty store mints once it is saved', function () {
  var s = FakeStore();
  var a = MP.load(s);
  assert.ok(/^mp_/.test(a.id));
  MP.save(s, a);
  assert.strictEqual(MP.load(s).id, a.id);
});
test('storage key is ADDITIVE under the owned music. prefix (backup.js snapshots it, no schema bump)', function () {
  assert.strictEqual(MP.STORAGE_KEY, 'music.profile.v1');
  var Backup = require('../music/shared/backup.js');
  assert.ok(Backup.owned(MP.STORAGE_KEY));
});
test('a corrupt stored value reads as a fresh blank, never throws', function () {
  var s = FakeStore(); s.setItem(MP.STORAGE_KEY, '{not json');
  assert.strictEqual(MP.loadStored(s), null);
  assert.strictEqual(MP.load(s).schema, MP.SCHEMA);
});

/* ---------- stable ids + branches ---------- */
test('competency ids are namespaced <framework>/<competency> with the existing ids verbatim', function () {
  assert.strictEqual(MP.competencyId('ukulele', 'uke-open-chords'), 'ukulele/uke-open-chords');
});
test('instrument branches: ukulele and guitar sit under strings; crafts are their own branch; an unknown framework is a craft', function () {
  assert.deepStrictEqual(MP.branchFor('ukulele'), ['instrument', 'strings', 'ukulele']);
  assert.deepStrictEqual(MP.branchFor('guitar'), ['instrument', 'strings', 'guitar']);
  assert.deepStrictEqual(MP.branchFor('stringed-instrument'), ['instrument', 'strings']);
  assert.deepStrictEqual(MP.branchFor('lyric-writing'), ['craft', 'lyric-writing']);
  assert.deepStrictEqual(MP.branchFor('theremin'), ['craft', 'theremin']);
});

/* ---------- competencies vs assessments: unassessed is explicit ---------- */
test('compose() writes the taxonomy but NO assessment for a musician nothing assessed - every competency reads unassessed, never 0', function () {
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, progression: {}, selfReport: null, now: T0 });
  assert.strictEqual(d.competencies.length, TAXONOMY_SIZE);
  assert.strictEqual(d.assessments.length, 0);
  assert.strictEqual(d.evidence.length, 0);
  assert.deepStrictEqual(MP.status(d, 'ukulele/uke-open-chords'), { status: 'unassessed' });
  var json = JSON.stringify(d);
  assert.ok(json.indexOf('"value":0') === -1 && json.indexOf('"level":0') === -1, 'absence must never be exported as level 0');
});
test('the ONE assessment the app legitimately holds is the self-report, branch-level, band-3, modality UNSPECIFIED', function () {
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, progression: {}, selfReport: 'intermediate', now: T0 });
  assert.strictEqual(d.assessments.length, 1);
  var a = d.assessments[0];
  assert.strictEqual(a.competency, 'stringed-instrument');
  assert.strictEqual(a.value, 'intermediate');
  assert.strictEqual(a.scale, 'band-3');
  assert.strictEqual(a.method, 'self-report');
  assert.strictEqual(a.modality, 'unspecified');
  assert.strictEqual(MP.status(d, 'stringed-instrument').status, 'assessed');
  // the micro-competencies underneath stay unassessed - a branch claim is not a per-competency claim
  assert.strictEqual(MP.status(d, 'stringed-instrument/chord-shapes').status, 'unassessed');
});
test('re-composing with the SAME self-report does not duplicate the assessment; a changed answer updates it in place (deterministic id)', function () {
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T0 });
  d = MP.compose(d, { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T1 });
  assert.strictEqual(d.assessments.length, 1);
  assert.strictEqual(d.assessments[0].at, T0, 'unchanged answer keeps its original stamp');
  d = MP.compose(d, { frameworks: C.FRAMEWORKS, selfReport: 'advanced', now: T2 });
  assert.strictEqual(d.assessments.length, 1);
  assert.strictEqual(d.assessments[0].value, 'advanced');
  assert.strictEqual(d.assessments[0].at, T2);
});
test('status() returns the LATEST assessment by `at`', function () {
  var d = MP.blank({ id: 'x', now: T0 });
  d.assessments.push({ id: 'a1', competency: 'guitar/gtr-barre', value: 30, scale: '0-100', method: 'coach', modality: 'perform', at: T0, source: 'agent:x' });
  d.assessments.push({ id: 'a2', competency: 'guitar/gtr-barre', value: 45, scale: '0-100', method: 'coach', modality: 'perform', at: T2, source: 'agent:x' });
  assert.strictEqual(MP.status(d, 'guitar/gtr-barre').assessment.id, 'a2');
});

/* ---------- progression is EVIDENCE, modality never overclaimed ---------- */
test('the app\'s progression counters ride as evidence (kind app-progression, modality compose), one record per framework with any evidence, NEVER as an assessment', function () {
  var s = FakeStore();
  C.recordEvidence('ukulele', 'uke-repertoire', null, s);   // the "songs you can play" counter...
  C.recordEvidence('ukulele', 'uke-repertoire', null, s);
  C.recordEvidence('music-composition', 'comp-progressions', null, s);
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, progression: C.load(s), now: T1 });
  assert.strictEqual(d.assessments.length, 0, 'counters must not become a proficiency claim');
  assert.strictEqual(d.evidence.length, 2);
  var uke = d.evidence.filter(function (e) { return e.id === 'ev:app:music:anon:progression:ukulele'; })[0];
  assert.ok(uke, 'deterministic per-device evidence id per framework');
  assert.strictEqual(uke.kind, 'app-progression');
  assert.strictEqual(uke.modality, 'compose', '...was earned by COMPOSING in the app - the app never heard anyone play');
  assert.deepStrictEqual(uke.competencies, ['ukulele/uke-repertoire']);
  assert.strictEqual(uke.data.competencies.length, 1, 'only competencies with evidence appear - no level-0 padding');
  assert.strictEqual(uke.data.competencies[0].evidence_count, 2);
  assert.strictEqual(MP.status(d, 'ukulele/uke-repertoire').status, 'unassessed', 'evidence is not an assessment');
});
test('a re-export UPDATES the app\'s own progression record instead of appending a duplicate', function () {
  var s = FakeStore();
  C.recordEvidence('guitar', 'gtr-open-chords', null, s);
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, progression: C.load(s), now: T1 });
  C.recordEvidence('guitar', 'gtr-open-chords', null, s);
  var later = C.load(s); later.guitar.updated = T2;
  d = MP.compose(d, { frameworks: C.FRAMEWORKS, progression: later, now: T2 });
  var gtr = d.evidence.filter(function (e) { return e.id === 'ev:app:music:anon:progression:guitar'; });
  assert.strictEqual(gtr.length, 1);
  assert.strictEqual(gtr[0].data.competencies[0].evidence_count, 2);
});
test('the app\'s progression evidence is scoped PER DEVICE: two devices\' records coexist in the lifelong document, and each device replaces only its own', function () {
  var phone = FakeStore(), laptop = FakeStore();
  for (var i = 0; i < 3; i++) C.recordEvidence('ukulele', 'uke-open-chords', null, phone);
  var out = MP.exportJson(phone, { frameworks: C.FRAMEWORKS, progression: C.load(phone), device: 'phone', now: T0 });
  MP.importJson(out, laptop, { now: T1 });
  C.recordEvidence('ukulele', 'uke-strum-patterns', null, laptop);
  var out2 = JSON.parse(MP.exportJson(laptop, { frameworks: C.FRAMEWORKS, progression: C.load(laptop), device: 'laptop', now: T2 }));
  var ids = out2.evidence.map(function (e) { return e.id; }).sort();
  assert.deepStrictEqual(ids, ['ev:app:music:laptop:progression:ukulele', 'ev:app:music:phone:progression:ukulele']);
  var phoneRec = out2.evidence.filter(function (e) { return e.device === 'phone'; })[0];
  assert.strictEqual(phoneRec.data.competencies[0].evidence_count, 3, 'the phone\'s record survived the laptop export untouched');
  // back on the phone: both records still there, the phone's own record refreshed
  MP.importJson(JSON.stringify(out2), phone, { now: T2 });
  C.recordEvidence('ukulele', 'uke-open-chords', null, phone);
  var out3 = JSON.parse(MP.exportJson(phone, { frameworks: C.FRAMEWORKS, progression: C.load(phone), device: 'phone', now: '2026-09-13T13:00:00.000Z' }));
  assert.strictEqual(out3.evidence.length, 2);
  assert.strictEqual(out3.evidence.filter(function (e) { return e.device === 'phone'; })[0].data.competencies[0].evidence_count, 4);
  assert.strictEqual(out3.evidence.filter(function (e) { return e.device === 'laptop'; })[0].data.competencies[0].evidence_count, 1);
});
test('the device id is minted once per device (music.device.v1) and is NOT backed up - a restore never makes one device impersonate another', function () {
  var s = FakeStore();
  var a = MP.deviceId(s), b = MP.deviceId(s);
  assert.ok(/^dv_/.test(a) && a === b);
  assert.strictEqual(s.getItem(MP.DEVICE_KEY), a);
  var Backup = require('../music/shared/backup.js');
  assert.strictEqual(Backup.owned(MP.DEVICE_KEY), false);
});
test('exportJson returns null and persists NOTHING when the document would carry nothing of the person\'s (an empty device never ships a bundle or flips the first-start lead)', function () {
  var s = FakeStore();
  assert.strictEqual(MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: {}, selfReport: null, now: T0 }), null);
  assert.strictEqual(MP.loadStored(s), null);
  assert.strictEqual(MP.hasData(s), false);
  // one self-report is enough to be worth carrying
  assert.ok(MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: {}, selfReport: 'beginner', now: T0 }));
  assert.strictEqual(MP.hasData(s), true);
});
test('a hand-back with NO id is addressed to the local profile - no random id is minted and no fabricated "merged into" provenance row appears', function () {
  var s = FakeStore();
  MP.exportJson(s, { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T0 });
  var localId = MP.loadStored(s).id;
  var hand = { schema: MP.SCHEMA, updated: T1, goals: [{ id: 'g1', statement: 'x', status: 'active', updated: T1 }] };
  assert.strictEqual(MP.importJson(hand, s, { now: T1 }).ok, true);
  assert.strictEqual(MP.importJson(hand, s, { now: T2 }).ok, true);
  var d = MP.loadStored(s);
  assert.strictEqual(d.id, localId);
  assert.strictEqual(d.provenance.filter(function (p) { return p.action === 'merge'; }).length, 0);
  assert.strictEqual(MP.importJson({ schema: MP.SCHEMA, id: 42 }, s).ok, false, 'a non-string id is rejected');
});
test('an incoming routine app stamp that carries a note is NOT folded into the note-less row (its note survives)', function () {
  var local = MP.blank({ id: 'mp_t', now: T0 });
  local.provenance.push({ source: 'app:music', at: T0, action: 'export' });
  var m = MP.merge(local, { schema: MP.SCHEMA, id: 'mp_t', updated: T1, provenance: [{ source: 'app:music', at: T1, action: 'export', note: 'device: phone' }] });
  assert.strictEqual(m.provenance.length, 2);
  assert.ok(m.provenance.some(function (p) { return p.note === 'device: phone'; }));
});
test('the participant entry declares the app, what it understands, and its deep links (capabilities stay app-side)', function () {
  var d = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, version: 'music-v0', now: T0 });
  var p = d.participants[0];
  assert.strictEqual(p.id, 'app:music');
  assert.strictEqual(p.version, 'music-v0');
  assert.ok(/^https:\/\//.test(p.url) && /^https:\/\//.test(p.capabilities_url));
  assert.deepStrictEqual(p.understands, MP.UNDERSTANDS);
  assert.deepStrictEqual(d.provenance, [{ source: 'app:music', at: T0, action: 'export' }]);
});

/* ---------- merge: the floor ---------- */
function coachDoc() {
  return {
    schema: MP.SCHEMA, id: 'mp_t', updated: T2,
    participants: [{ id: 'agent:claude', name: 'Claude coach', understands: ['assessments', 'goals', 'plan'], last_seen: T2 }],
    provenance: [{ source: 'agent:claude', at: T2, action: 'assess' }],
    competencies: [{ id: 'ukulele/uke-open-chords', name: 'Open chords', desc: 'RENAMED BY COACH', branch: ['x'], source: 'agent:claude' }],
    assessments: [{ id: 'as:claude:1', competency: 'ukulele/uke-open-chords', value: 40, scale: '0-100', target: 90, method: 'coach', modality: 'perform', at: T2, source: 'agent:claude', evidence: ['ev:app:music:anon:progression:ukulele'], note: 'heard a clean C-F-G loop on a shared recording; musician confirmed' }],
    evidence: [{ id: 'ev:claude:rec1', at: T2, source: 'agent:claude', kind: 'recording', modality: 'perform', competencies: ['ukulele/uke-open-chords'], data: { duration_s: 42 } }],
    goals: [{ id: 'goal:1', statement: 'Play Riptide start to finish at a campfire', competencies: ['ukulele/uke-repertoire'], status: 'active', created: T2, updated: T2, source: 'human' }],
    plan: { updated: T2, steward: 'agent:claude', items: [{ id: 'plan:1', statement: 'Am-G-C-F loop at 70bpm, 5 min', competencies: ['stringed-instrument/transitions'], goal: 'goal:1', status: 'todo', updated: T2 }] },
    extensions: { 'x-claude': { session: 'abc' } },
    'x-future-section': { anything: true }
  };
}
test('merge: known sections union by id; a known competency keeps the LOCAL name/desc/branch; the coach\'s assessment, evidence, goal, plan and extensions all land', function () {
  var local = MP.compose(MP.blank({ id: 'mp_t', now: T0 }), { frameworks: C.FRAMEWORKS, now: T1 });
  var m = MP.merge(local, coachDoc());
  var comp = m.competencies.filter(function (c) { return c.id === 'ukulele/uke-open-chords'; })[0];
  assert.strictEqual(comp.desc, 'The core open shapes under the fingers.');
  assert.deepStrictEqual(comp.branch, ['instrument', 'strings', 'ukulele']);
  assert.strictEqual(m.competencies.length, TAXONOMY_SIZE, 'no duplicate for a known id');
  assert.strictEqual(m.assessments.length, 1);
  assert.strictEqual(MP.status(m, 'ukulele/uke-open-chords').assessment.method, 'coach');
  assert.strictEqual(m.evidence.length, 1);
  assert.strictEqual(m.goals.length, 1);
  assert.strictEqual(m.plan.steward, 'agent:claude');
  assert.deepStrictEqual(m.extensions['x-claude'], { session: 'abc' });
  assert.strictEqual(m.participants.length, 2);
  assert.strictEqual(m.updated, T2);
});
test('merge: an UNKNOWN top-level key is preserved byte-for-byte (rule 2 of the contract)', function () {
  var local = MP.blank({ id: 'mp_t', now: T0 });
  var m = MP.merge(local, coachDoc());
  assert.deepStrictEqual(m['x-future-section'], { anything: true });
  // and survives a second merge from a doc that does not carry it
  var m2 = MP.merge(m, { schema: MP.SCHEMA, id: 'mp_t', updated: T2 });
  assert.deepStrictEqual(m2['x-future-section'], { anything: true });
});
test('merge: same id, LATER stamp wins; an older copy never rewrites a newer record (append-only in spirit)', function () {
  var local = MP.blank({ id: 'mp_t', now: T2 }); // the local doc is genuinely newer
  local.assessments.push({ id: 'as:1', competency: 'guitar/gtr-barre', value: 50, at: T2, method: 'coach', modality: 'perform', source: 'a' });
  local.goals.push({ id: 'goal:1', statement: 'new', status: 'active', updated: T2 });
  local.plan = { updated: T2, steward: 'a', items: [] };
  var stale = { schema: MP.SCHEMA, id: 'mp_t', updated: T1,
    assessments: [{ id: 'as:1', competency: 'guitar/gtr-barre', value: 10, at: T1, method: 'coach', modality: 'perform', source: 'a' }],
    goals: [{ id: 'goal:1', statement: 'old', status: 'active', updated: T1 }],
    plan: { updated: T1, steward: 'b', items: [{ id: 'p' }] } };
  var m = MP.merge(local, stale);
  assert.strictEqual(m.assessments[0].value, 50);
  assert.strictEqual(m.goals[0].statement, 'new');
  assert.strictEqual(m.plan.steward, 'a');
  assert.strictEqual(m.updated, T2);
});
test('merge: provenance concatenates append-only and drops exact duplicates; a musician-id mismatch is RECORDED, not rejected', function () {
  var local = MP.blank({ id: 'mp_A', now: T0 });
  local.provenance.push({ source: 'app:music', at: T0, action: 'export' });
  var other = { schema: MP.SCHEMA, id: 'mp_B', updated: T1, provenance: [{ source: 'app:music', at: T0, action: 'export' }, { source: 'agent:x', at: T1, action: 'assess' }] };
  var m = MP.merge(local, other);
  assert.strictEqual(m.id, 'mp_A');
  var actions = m.provenance.map(function (p) { return p.action; });
  assert.deepStrictEqual(actions.filter(function (a) { return a === 'export'; }).length, 1);
  assert.ok(actions.indexOf('assess') >= 0);
  assert.ok(m.provenance.some(function (p) { return p.action === 'merge' && /mp_B/.test(p.note); }));
});
test('merge: both sides carry the same unknown key -> the NEWER document wins (we cannot judge content we do not understand)', function () {
  var local = MP.blank({ id: 'mp_t', now: T1 }); local['x-app'] = { v: 'local' }; local.extensions['x-e'] = 1;
  var newer = { schema: MP.SCHEMA, id: 'mp_t', updated: T2, 'x-app': { v: 'incoming' }, extensions: { 'x-e': 2 } };
  var older = { schema: MP.SCHEMA, id: 'mp_t', updated: T0, 'x-app': { v: 'stale' }, extensions: { 'x-e': 0 } };
  assert.strictEqual(MP.merge(local, newer)['x-app'].v, 'incoming');
  assert.strictEqual(MP.merge(local, newer).extensions['x-e'], 2);
  assert.strictEqual(MP.merge(local, older)['x-app'].v, 'local');
  assert.strictEqual(MP.merge(local, older).extensions['x-e'], 1);
});

/* ---------- storage-backed export / import ---------- */
test('exportJson persists the composed profile and returns the pretty document; importJson merges into the store and reports what landed', function () {
  var s = FakeStore();
  C.recordEvidence('ukulele', 'uke-open-chords', null, s);
  var json = MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'beginner', now: T1 });
  var doc = JSON.parse(json);
  assert.strictEqual(doc.schema, MP.SCHEMA);
  assert.strictEqual(MP.loadStored(s).id, doc.id, 'stored');
  var hand = coachDoc(); hand.id = doc.id;
  var res = MP.importJson(JSON.stringify(hand), s, { now: T2 });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.added, { assessments: 1, evidence: 1, goals: 1 });
  assert.strictEqual(res.plan, true);
  var stored = MP.loadStored(s);
  assert.strictEqual(stored.assessments.length, 2, 'self-report + coach');
  assert.ok(stored.provenance.some(function (p) { return p.action === 'import'; }));
});
test('a device with NO stored profile ADOPTS the imported musician id (same person, new device)', function () {
  var s = FakeStore();
  var res = MP.importJson({ schema: MP.SCHEMA, id: 'mp_phone', updated: T1 }, s, { now: T2 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(MP.loadStored(s).id, 'mp_phone');
});
test('importJson rejects the wrong schema, malformed JSON, non-objects and mistyped sections - never a silent accept', function () {
  var s = FakeStore();
  assert.ok(/unrecognized/.test(MP.importJson({ schema: 'skill-competency-profile/v1' }, s).reason));
  assert.ok(/not valid JSON/.test(MP.importJson('{oops', s).reason));
  assert.strictEqual(MP.importJson([], s).ok, false);
  assert.strictEqual(MP.importJson(null, s).ok, false);
  assert.ok(/must be a list/.test(MP.importJson({ schema: MP.SCHEMA, assessments: {} }, s).reason));
  assert.ok(/must be an object/.test(MP.importJson({ schema: MP.SCHEMA, plan: [] }, s).reason));
  assert.strictEqual(MP.loadStored(s), null, 'nothing written on rejection');
});
test('vocabularies: methods + modalities are the published sets and never include a proficiency-from-counters method', function () {
  assert.deepStrictEqual(MP.METHODS, ['self-report', 'observed', 'coach', 'inferred']);
  assert.ok(MP.MODALITIES.indexOf('compose') >= 0 && MP.MODALITIES.indexOf('perform') >= 0 && MP.MODALITIES.indexOf('unspecified') >= 0);
});

/* ---------- volley 1 fixes ---------- */
test('stamps are PARSED, not string-compared: a UTC-offset stamp and a second-precision Z stamp order correctly against millisecond Z stamps', function () {
  var local = MP.blank({ id: 'mp_t', now: '2026-09-13T13:30:00.000Z' });
  local.plan = { updated: '2026-09-13T13:30:00.000Z', steward: 'a', items: [] };
  var staleWithOffset = { schema: MP.SCHEMA, id: 'mp_t', updated: '2026-09-13T14:00:00+02:00', plan: { updated: '2026-09-13T14:00:00+02:00', steward: 'b', items: [] } }; // = 12:00Z, OLDER
  assert.strictEqual(MP.merge(local, staleWithOffset).plan.steward, 'a', 'an older offset stamp must not win by string order');
  var newerSecondPrecision = { schema: MP.SCHEMA, id: 'mp_t', updated: '2026-09-13T13:31:00Z', plan: { updated: '2026-09-13T13:31:00Z', steward: 'c', items: [] } };
  assert.strictEqual(MP.merge(local, newerSecondPrecision).plan.steward, 'c');
  var garbage = { schema: MP.SCHEMA, id: 'mp_t', updated: 'yesterday', plan: { updated: 'yesterday', steward: 'd', items: [] } };
  assert.strictEqual(MP.merge(local, garbage).plan.steward, 'a', 'a garbage stamp never beats a real one');
});
test('a tie on `updated` goes to the INCOMING document for unknown keys and extensions - a coach\'s second-round edit is never dropped for leaving `updated` alone', function () {
  var local = MP.blank({ id: 'mp_t', now: T1 }); local.extensions['x-claude'] = { session: 'abc' }; local['x-notes'] = 1;
  var second = { schema: MP.SCHEMA, id: 'mp_t', updated: T1, extensions: { 'x-claude': { session: 'def' } }, 'x-notes': 2 };
  var m = MP.merge(local, second);
  assert.strictEqual(m.extensions['x-claude'].session, 'def');
  assert.strictEqual(m['x-notes'], 2);
});
test('the app keeps ONE export and ONE import provenance stamp (latest `at`); other participants\' rows stay append-only and deduped', function () {
  var s = FakeStore(); // a self-report makes the doc worth carrying (an empty doc is never persisted)
  MP.exportJson(s, { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T0 });
  MP.exportJson(s, { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T1 });
  MP.exportJson(s, { frameworks: C.FRAMEWORKS, selfReport: 'beginner', now: T2 });
  var d = MP.loadStored(s);
  var exports = d.provenance.filter(function (p) { return p.source === 'app:music' && p.action === 'export'; });
  assert.strictEqual(exports.length, 1);
  assert.strictEqual(exports[0].at, T2);
  var hand = { schema: MP.SCHEMA, id: d.id, updated: T2, provenance: [{ source: 'agent:x', at: T1, action: 'assess' }, { source: 'agent:x', at: T1, action: 'assess' }, { source: 'agent:x', at: T2, action: 'assess' }] };
  MP.importJson(hand, s, { now: T2 }); MP.importJson(hand, s, { now: T2 });
  d = MP.loadStored(s);
  assert.strictEqual(d.provenance.filter(function (p) { return p.source === 'agent:x'; }).length, 2, 'exact duplicates dropped, distinct rows kept');
  assert.strictEqual(d.provenance.filter(function (p) { return p.action === 'import'; }).length, 1);
});

run();
