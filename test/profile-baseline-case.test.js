/* =====================================================================
 * profile-baseline-case.test.js - the REAL baseline case from the coaching
 * experiment, as an acceptance fixture (M-MUSICIAN-PROFILE-VNEXT).
 *
 * Musician: piano from ~7, guitar from ~9, ~28 years of bass, ~15 years in a
 * band, recently started ukulele, plays a 17-key C-major kalimba, sustains
 * improvisation over unfamiliar backing tracks, orients tonally by ear,
 * thinks in I/IV/V/vi, pentatonic/blues frameworks, modal fluency, tracks
 * harmonic movement, targets chord tones, moves across positions, triad
 * inversions, maps shapes to solo shapes, sings phrases internally, develops
 * motifs, builds arcs, tension/release, resolves outside notes, transfers
 * mental models across instruments. MOST of it is SELF-REPORTED through a
 * guided interview - none of it was performance-tested.
 *
 * Expected: advanced transferable musicianship COEXISTS with developing /
 * unassessed ukulele mechanics. The system must never call this musician a
 * beginner because ukulele telemetry is sparse.
 * Run: node test/profile-baseline-case.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MP = require('../music/shared/musician-profile.js');
var C = require('../music/shared/competency.js');
var SkillMd = require('../music/shared/skill-md.js');

function FakeStore() {
  var m = {};
  return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
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

var T0 = '2026-09-13T10:00:00.000Z', T1 = '2026-09-13T12:00:00.000Z', T2 = '2026-09-13T14:00:00.000Z';
var COACH = 'agent:music-coach';

// What a coach that FOLLOWED the contract hands back after the interview -
// the SHARED fixture (also uploaded byte-identical through the real file
// picker by test/pw/scenarios/musician-profile-baseline.json). Every claim
// names its method (interview = the musician's word, asked for), its modality,
// its confidence and the interview evidence it cites. Nothing is scored
// 0-100; nothing is claimed as observed. It carries NO `id`: a hand-back is
// addressed to whichever local profile imports it.
var fs = require('fs'), path = require('path');
var FIXTURE = path.join(__dirname, 'fixtures', 'musician-profile-baseline-handback.json');
function baselineHandBack() { return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); }

test('the fixture itself keeps the contract: no id, every assessment names method + modality + confidence and cites evidence, no 0-100 numbers, mandolin named but unassessed', function () {
  var h = baselineHandBack();
  assert.strictEqual(h.schema, MP.SCHEMA); assert.ok(!('id' in h));
  assert.strictEqual(MP.validate(h).ok, true);
  assert.strictEqual(h.assessments.length, 21);
  h.assessments.forEach(function (a) {
    assert.ok(MP.METHODS.indexOf(a.method) >= 0 && MP.MODALITIES.indexOf(a.modality) >= 0 && MP.CONFIDENCE.indexOf(a.confidence) >= 0, a.id);
    assert.strictEqual(typeof a.value, 'string'); assert.ok(a.evidence.length >= 1);
  });
  assert.ok(!h.assessments.some(function (a) { return /^mandolin\//.test(a.competency); }));
  assert.ok(h.competencies.some(function (c) { return c.id === 'mandolin/chord-shapes'; }));
});

// The app's own state on the device: a few compose observations on ukulele
// (the app saw song assembly, never playing) + the beginner self-report the
// musician tapped in the one-time ask before the coaching session.
function seedDevice() {
  var s = FakeStore();
  for (var i = 0; i < 9; i++) C.recordEvidence('ukulele', 'uke-repertoire', null, s);
  MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'beginner', now: T0, device: 'dv_phone' });
  return s;
}

test('BEFORE the coach: the device reads as unassessed - not beginner - for everything but the one tap the musician made', function () {
  var s = seedDevice();
  var d = MP.loadStored(s);
  var sm = MP.summary(d, C.FRAMEWORKS, C.load(s));
  assert.strictEqual(sm.musicianshipAssessed, 0);
  assert.strictEqual(MP.headline(sm)[0], 'Musicianship: not yet assessed');
  var uke = sm.instruments.filter(function (g) { return g.name === 'Ukulele'; })[0];
  assert.strictEqual(uke.observed, 1); assert.strictEqual(uke.assessed, 0);
  var strings = sm.instruments.filter(function (g) { return g.name === 'Stringed instrument'; })[0];
  assert.strictEqual(strings.assessment.value, 'beginner', 'the self-report the musician tapped is honestly carried');
  assert.strictEqual(strings.assessment.method, 'self-report');
});

test('AFTER the coach hand-back: advanced transferable musicianship coexists with developing / unassessed ukulele mechanics - never a beginner because ukulele telemetry is sparse', function () {
  var s = seedDevice();
  var res = MP.importJson(baselineHandBack(), s, { now: T2 });
  assert.strictEqual(res.ok, true, res.reason);
  var d = MP.loadStored(s);
  var sm = MP.summary(d, C.FRAMEWORKS, C.load(s));
  var lines = MP.headline(sm);
  assert.strictEqual(lines[0], 'Musicianship: advanced - 11 of 11 assessed');
  assert.ok(lines.some(function (l) { return l === 'Bass: advanced'; }), lines.join(' | '));
  assert.ok(lines.some(function (l) { return l === 'Guitar: advanced'; }));
  assert.ok(lines.some(function (l) { return l === 'Ukulele: beginner - 1 observed in the app'; }), 'new to the instrument IS what the musician said - an honest claim, not an inference');
  assert.ok(lines.some(function (l) { return l === 'Mandolin: not yet assessed'; }), 'named, never assessed, never 0');
  assert.ok(lines.some(function (l) { return /^Piano: intermediate/.test(l); }));
  assert.ok(lines.some(function (l) { return /^Kalimba: intermediate/.test(l); }));
  // the ukulele MECHANICS themselves stay unassessed - the branch claim does not trickle down
  var uke = sm.instruments.filter(function (g) { return g.name === 'Ukulele'; })[0];
  assert.ok(uke.competencies.every(function (c) { return c.status === 'not yet assessed'; }));
  assert.strictEqual(uke.observed, 1, 'the app\'s 9 compose observations ride beside it as evidence of doing');
  // the branch-level strings claim SUPERSEDED the app's beginner tap, and the tap is history, not gone
  assert.strictEqual(MP.describe(d, 'stringed-instrument'), 'advanced - from a guided interview, high confidence, Sep 13');
  var h = MP.history(d, 'stringed-instrument');
  assert.strictEqual(h.length, 2); assert.strictEqual(h[1].value, 'beginner'); assert.strictEqual(h[1].source, 'app:music');
  // self-reported means self-reported: nothing was promoted to observed, no number was invented
  d.assessments.filter(function (a) { return a.source === COACH; }).forEach(function (a) {
    assert.strictEqual(a.method, 'interview'); assert.strictEqual(typeof a.value, 'string');
    assert.ok(MP.CONFIDENCE.indexOf(a.confidence) >= 0);
  });
  // attached is not analyzed
  var clip = d.evidence.filter(function (e) { return e.id === 'ev:' + COACH + ':clip1'; })[0];
  assert.strictEqual(clip.kind, 'artifact'); assert.strictEqual(clip.data.analyzed, false);
  // the plan is distinct from the assessment, and only app links are renderable
  assert.strictEqual(sm.focus, 'Ukulele mechanics under the musicianship you already have');
  assert.strictEqual(sm.planItems.length, 3);
  assert.ok(sm.planItems.every(function (i) { return !i.deep_link || MP.appLink(i.deep_link); }));
  assert.strictEqual(MP.status(d, 'stringed-instrument/triad-inversions').assessment.value, 'advanced');
  assert.strictEqual(MP.status(d, 'ukulele/uke-chunking').status, 'unassessed', 'a learning edge is not an assessment');
});

test('the word "beginner" never describes this musician\'s musicianship anywhere the app renders from - only the one claim they made about the ukulele', function () {
  var s = seedDevice();
  MP.importJson(baselineHandBack(), s, { now: T2 });
  var d = MP.loadStored(s);
  var sm = MP.summary(d, C.FRAMEWORKS, C.load(s));
  sm.musicianship.forEach(function (g) { g.competencies.forEach(function (c) { assert.ok(!/beginner|\b0\b/.test(c.status), c.id + ': ' + c.status); }); });
  var lines = MP.headline(sm).filter(function (l) { return /beginner/.test(l); });
  assert.deepStrictEqual(lines, ['Ukulele: beginner - 1 observed in the app']);
});

test('the NEXT export carries every coach record, every unknown instrument, the interview evidence and the plan back out - and the legacy SKILL.md for ukulele reads unassessed, not Level 0', function () {
  var s = seedDevice();
  var hand = baselineHandBack();
  MP.importJson(hand, s, { now: T2 });
  var out = JSON.parse(MP.exportJson(s, { frameworks: C.FRAMEWORKS, progression: C.load(s), selfReport: 'beginner', now: T2, device: 'dv_phone' }));
  hand.competencies.forEach(function (c) { assert.deepStrictEqual(out.competencies.filter(function (x) { return x.id === c.id; })[0], c); });
  hand.assessments.forEach(function (a) { assert.deepStrictEqual(out.assessments.filter(function (x) { return x.id === a.id; })[0], a); });
  hand.evidence.forEach(function (e) { assert.deepStrictEqual(out.evidence.filter(function (x) { return x.id === e.id; })[0], e); });
  assert.deepStrictEqual(out.plan, hand.plan);
  assert.deepStrictEqual(out.extensions['x-music-coach'], { interviewVersion: 1 });
  assert.ok(out.participants.some(function (p) { return p.id === COACH; }));
  assert.strictEqual(out.competencies.length, MP.taxonomySize(C.FRAMEWORKS) + hand.competencies.length);
  var md = SkillMd.render(C.exportProfile('ukulele', s));
  assert.ok(md.indexOf('| Open chords | unassessed |') >= 0, 'never-observed ukulele rows read unassessed');
  assert.ok(md.indexOf('| Repertoire | ') >= 0 && !/\| Repertoire \| unassessed/.test(md), 'the observed row keeps its number');
  assert.ok(!/^\| [^|]+ \| 0 \|/m.test(md), 'no Level 0 anywhere in the legacy render (the Level column is the second cell)');
});

run();
