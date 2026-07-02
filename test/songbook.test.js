/* =====================================================================
 * songbook.test.js  -  unit tests for the instrument-agnostic engine's
 * pure theory helpers (the bits that don't touch the DOM).
 * Run: node test/songbook.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Songbook = require('../music/shared/songbook.js');
var Circle = require('../music/shared/circle.js');

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

/* ---------- common-progression filling (the canon, transposable) ---------- */
test('chordsFromDegrees fills the 4-chord song (I V vi IV) in C', function () {
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Major', [0, 4, 5, 3]), ['C', 'G', 'Am', 'F']);
});
test('chordsFromDegrees transposes the SAME degrees to any key', function () {
  // the lesson: a I-V-vi-IV is the same intervals everywhere, only the letters move
  assert.deepStrictEqual(Songbook.chordsFromDegrees('G', 'Major', [0, 4, 5, 3]), ['G', 'D', 'Em', 'C']);
  assert.deepStrictEqual(Songbook.chordsFromDegrees('D', 'Major', [0, 4, 5, 3]), ['D', 'A', 'Bm', 'G']);
});
test('chordsFromDegrees keeps every degree incl. the diminished vii (unlike the jam palette)', function () {
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Major', [6]), ['Bdim']);
});
test('every shipped PROGRESSION renders the Roman pattern it claims (round-trip via Circle.romanFor)', function () {
  var EXPECTED = {
    '4-chord song': 'I V vi IV',
    '50s / doo-wop': 'I vi IV V',
    'Pop / Axis': 'vi IV I V',
    'Three-chord rock': 'I IV V',
    'Jazz turnaround': 'ii V I',
    'Pachelbel': 'I V vi iii IV I IV V'
  };
  Songbook.PROGRESSIONS.forEach(function (p) {
    var chords = Songbook.chordsFromDegrees('C', 'Major', p.degrees);
    // label against the KEY tonic (C), not the first chord — Axis starts on vi, not I
    var romans = chords.map(function (c) { return Circle.romanFor(c, 'C'); }).join(' ');
    assert.strictEqual(romans, EXPECTED[p.name], p.name + ' -> ' + romans);
  });
});

/* ---------- enharmonic root parsing (the E#dim-sounds-as-C bug) ---------- */
test('noteToPc parses enharmonics the 12-name table cannot (E#, B#, Cb, Fb, double accidentals)', function () {
  assert.strictEqual(Songbook.noteToPc('E#'), 5);  // == F
  assert.strictEqual(Songbook.noteToPc('B#'), 0);  // == C
  assert.strictEqual(Songbook.noteToPc('Cb'), 11); // == B
  assert.strictEqual(Songbook.noteToPc('Fb'), 4);  // == E
  assert.strictEqual(Songbook.noteToPc('Fx'), 7);  // double sharp == G
  assert.strictEqual(Songbook.noteToPc('Bbb'), 9); // double flat == A
  assert.strictEqual(Songbook.noteToPc('C'), 0);
  assert.strictEqual(Songbook.noteToPc('zz'), null); // junk
});
test('chordRootFreq: E#dim sounds as F, NOT the C fallback (the vii-of-F#-major bug)', function () {
  var fEsharp = Songbook.chordRootFreq('E#dim');
  assert.ok(Math.abs(fEsharp - Songbook.chordRootFreq('F')) < 0.01, 'E# should equal F');
  assert.ok(Math.abs(fEsharp - 261.63) > 1, 'E# must not fall back to C (261.63)');
  // a genuinely unparseable token still falls back to C, by design
  assert.strictEqual(Songbook.chordRootFreq('???'), 261.63);
});

/* ---------- progression-aware suggestion (the "complete the cliche" nudge) ---------- */
test('degreeOf maps a chord to its 0-indexed major-scale degree (-1 if borrowed)', function () {
  assert.strictEqual(Songbook.degreeOf('C', 'C'), 0);
  assert.strictEqual(Songbook.degreeOf('G', 'C'), 4);   // V
  assert.strictEqual(Songbook.degreeOf('Am', 'C'), 5);  // vi
  assert.strictEqual(Songbook.degreeOf('Eb', 'C'), -1); // borrowed bIII -> not a scale tone
  assert.strictEqual(Songbook.degreeOf('D', 'G'), 4);   // V of G
});
function compNames(cs) { return cs.map(function (c) { return c.name + '->' + c.chord; }); }
test('completions nudges the chord that finishes a famous progression', function () {
  // I-V-vi -> IV completes the 4-chord song
  var c = Songbook.completions(['C', 'G', 'Am'], 'C', 'Major');
  assert.ok(c.some(function (x) { return x.name === '4-chord song' && x.chord === 'F'; }), compNames(c).join(','));
  // ii-V -> I completes the jazz turnaround
  assert.deepStrictEqual(compNames(Songbook.completions(['Dm', 'G'], 'C', 'Major')), ['Jazz turnaround->C']);
});
test('completions is transpose-invariant (same nudge in any key)', function () {
  var c = Songbook.completions(['G', 'D', 'Em'], 'G', 'Major');
  assert.ok(c.some(function (x) { return x.name === '4-chord song' && x.chord === 'C'; }), compNames(c).join(','));
});
test('completions bails on a borrowed chord and on an already-complete progression', function () {
  assert.deepStrictEqual(Songbook.completions(['C', 'Eb'], 'C', 'Major'), []);        // borrowed -> no clean match
  assert.deepStrictEqual(Songbook.completions(['C', 'G', 'Am', 'F'], 'C', 'Major'), []); // 4-chord song done
});

/* ---------- Stage auto-fit scale (the "Ripple" clipping bug: height-only fit
 * let a short song scale up past its own width, clipping words off-screen) ---------- */
test('fitScale: a short/narrow song scales up toward the height fit (no width constraint)', function () {
  // needs 400 tall, 300 wide; screen is 800 tall, 600 wide -> height wins (2x), width has headroom (2x too)
  assert.strictEqual(Songbook.fitScale(800, 400, 600, 300), 2);
});
test('fitScale: width caps the scale when height alone would clip the sheet off-screen', function () {
  // "Ripple"-shaped case: short content (height fit would allow 2x) but the
  // unwrapped (white-space:pre) content is already wide relative to the
  // viewport -> width must win, not height
  assert.strictEqual(Songbook.fitScale(800, 400, 600, 550), 600 / 550);
  assert.ok(Songbook.fitScale(800, 400, 600, 550) < 2, 'width constraint must cap below the height-only scale');
});
test('fitScale: a long song shrinks toward the height fit (below 1x)', function () {
  assert.strictEqual(Songbook.fitScale(400, 1600, 600, 300), 0.5); // 400/1600=0.25, clamped to the 0.5 floor
});
test('fitScale clamps to [0.5, 2.2] on either end', function () {
  assert.strictEqual(Songbook.fitScale(4000, 100, 4000, 100), 2.2); // would be 40x uncapped
  assert.strictEqual(Songbook.fitScale(100, 4000, 100, 4000), 0.5); // would be 0.025x uncapped
});
test('fitScale treats a zero/unknown dimension as unconstrained (falls through to the other axis)', function () {
  assert.strictEqual(Songbook.fitScale(800, 0, 600, 300), 2);   // no height need -> width alone (2x)
  assert.strictEqual(Songbook.fitScale(800, 400, 600, 0), 2);   // no width need -> height alone (2x)
  assert.strictEqual(Songbook.fitScale(0, 0, 0, 0), 1);         // nothing measurable -> neutral 1x
});

/* ---------- soloKeyFor: the "Solo over it" Studio-bridge payload ---------- */
var fakeRep = { deriveKey: function (rec) { var c = rec.seq && rec.seq[0]; return c ? { key: c.replace(/m$/, ''), mode: /m$/.test(c) ? 'minor' : 'major' } : { key: null, mode: null }; } };
test('soloKeyFor: explicit key follows the transpose (keyed song shifted +2 solos in B, not A)', function () {
  var out = Songbook.soloKeyFor({ key: 'A', mode: 'minor' }, ['Bm', 'F#m'], 2, fakeRep);
  assert.deepStrictEqual(out, { key: 'B', mode: 'minor' });
});
test('soloKeyFor: explicit key untransposed passes through unchanged', function () {
  assert.deepStrictEqual(Songbook.soloKeyFor({ key: 'G', mode: 'major' }, ['G'], 0, fakeRep), { key: 'G', mode: 'major' });
});
test('soloKeyFor: no explicit key derives from the ALREADY-TRANSPOSED sequence', function () {
  var out = Songbook.soloKeyFor({ t: 'x' }, ['Bm', 'E'], 2, fakeRep);
  assert.deepStrictEqual(out, { key: 'B', mode: 'minor' });
});
test('soloKeyFor: no key and no deriver yields the null payload (solo affordance hidden)', function () {
  assert.deepStrictEqual(Songbook.soloKeyFor({ t: 'x' }, ['C'], 0, null), { key: null, mode: null });
});
// Drive the REAL deriver too (not just fakeRep) so the actual
// Repertoire.deriveKey integration can't regress green behind the mock.
var RealRepertoire = require('../music/shared/repertoire.js');
test('soloKeyFor derives through the REAL Repertoire.deriveKey', function () {
  assert.deepStrictEqual(Songbook.soloKeyFor({}, ['G', 'C', 'D'], 0, RealRepertoire), { key: 'G', mode: 'major' });
  assert.deepStrictEqual(Songbook.soloKeyFor({}, ['Am', 'F', 'C'], 0, RealRepertoire), { key: 'A', mode: 'minor' });
});

/* ---------- the Mine facet (user-owned items in the Library filter bar) ---------- */
test('isMine flags custom items and the legacy d:Mine marker, nothing else', function () {
  assert.strictEqual(Songbook.isMine({ custom: true }), true);
  assert.strictEqual(Songbook.isMine({ d: 'Mine' }), true);          // pre-flag persisted records
  assert.strictEqual(Songbook.isMine({ d: '70s' }), false);
  assert.strictEqual(Songbook.isMine({ t: 'x', genre: 'mine' }), false); // a genre named mine is not ownership
  assert.strictEqual(Songbook.isMine(null), false);
});
var MINE_LIST = [
  { t: 'Catalog Song', a: 'Band', genre: 'rock', seq: ['C', 'G'] },
  { t: 'My Jam', a: 'Me', genre: 'rock', custom: true, d: 'Mine', seq: ['Am', 'F'] },
  { t: 'Old Save', a: 'Me', d: 'Mine', seq: ['G', 'D'] }
];
test('libraryFilter genre:mine keeps ONLY user-owned items', function () {
  var out = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'mine', key: 'all' });
  assert.deepStrictEqual(out.map(function (r) { return r.t; }), ['My Jam', 'Old Save']);
});
test('libraryFilter genre:mine still composes with the q and key filters', function () {
  var q = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: 'jam', genre: 'mine', key: 'all' });
  assert.deepStrictEqual(q.map(function (r) { return r.t; }), ['My Jam']);
  var k = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'mine', key: 'G' });
  assert.deepStrictEqual(k.map(function (r) { return r.t; }), ['Old Save']); // seq G D derives key G
});
test('libraryFilter passes non-mine selections through to Repertoire.filter untouched', function () {
  var all = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'all', key: 'all' });
  assert.strictEqual(all.length, 3);
  var rock = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'rock', key: 'all' });
  assert.deepStrictEqual(rock.map(function (r) { return r.t; }), ['Catalog Song', 'My Jam']);
});

run();
