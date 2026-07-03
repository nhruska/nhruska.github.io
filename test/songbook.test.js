/* =====================================================================
 * songbook.test.js  -  unit tests for the instrument-agnostic engine's
 * pure theory helpers (the bits that don't touch the DOM).
 * Run: node test/songbook.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Songbook = require('../music/shared/songbook.js');
var Circle = require('../music/shared/circle.js');
var Repertoire = require('../music/shared/repertoire.js');

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
test('chordInKey gates the Markov suggestions to the selected key + mode (C4, pilot UAT)', function () {
  // D minor: i=Dm ii°=Edim III=F iv=Gm v=Am VI=A# VII=C
  assert.strictEqual(Songbook.chordInKey('Dm', 'D', 'Minor'), true);
  assert.strictEqual(Songbook.chordInKey('D', 'D', 'Minor'), false);  // major tonic is NOT in-key
  // (the major V in minor is IN by the harmonic-minor exception - see its own test below)
  assert.strictEqual(Songbook.chordInKey('Am', 'D', 'Minor'), true);
  assert.strictEqual(Songbook.chordInKey('A#', 'D', 'Minor'), true);
  assert.strictEqual(Songbook.chordInKey('Bb', 'D', 'Minor'), true);  // flat input normalizes
  assert.strictEqual(Songbook.chordInKey('E', 'D', 'Minor'), false);  // ii must be dim, not major
  assert.strictEqual(Songbook.chordInKey('Edim', 'D', 'Minor'), true);
  // 7ths reduce to their triad quality
  assert.strictEqual(Songbook.chordInKey('D7', 'G', 'Major'), true);  // V7 in G
  assert.strictEqual(Songbook.chordInKey('C#7', 'D', 'Minor'), false);
  assert.strictEqual(Songbook.chordInKey('Am7', 'G', 'Major'), true); // ii7
  // dim + out-of-scale roots
  assert.strictEqual(Songbook.chordInKey('F#dim', 'G', 'Major'), true);
  assert.strictEqual(Songbook.chordInKey('F#m', 'D', 'Minor'), false); // root off-scale
  assert.strictEqual(Songbook.chordInKey('', 'D', 'Minor'), false);
  assert.strictEqual(Songbook.chordInKey('Dm', null, 'Minor'), false);
  // half-diminished reduces to dim (the diatonic vii of a major key); aug is never diatonic
  assert.strictEqual(Songbook.chordInKey('F#m7b5', 'G', 'Major'), true);
  assert.strictEqual(Songbook.chordInKey('Bm7b5', 'C', 'Major'), true);
  assert.strictEqual(Songbook.chordInKey('Caug', 'C', 'Major'), false);
  assert.strictEqual(Songbook.chordInKey('C+', 'C', 'Major'), false);
});
test('harmonic-minor exception: V and V7 are in-key in Minor (owner ruling, council D1)', function () {
  assert.strictEqual(Songbook.chordInKey('A', 'D', 'Minor'), true);    // V in D minor
  assert.strictEqual(Songbook.chordInKey('A7', 'D', 'Minor'), true);   // V7
  assert.strictEqual(Songbook.chordInKey('E7', 'A', 'Minor'), true);   // V7 in A minor
  assert.strictEqual(Songbook.chordInKey('B7', 'E', 'Minor'), true);   // V7 in E minor
  assert.strictEqual(Songbook.chordInKey('Am', 'D', 'Minor'), true);   // natural v still in
  assert.strictEqual(Songbook.chordInKey('Amaj7', 'D', 'Minor'), false); // Vmaj7 is NOT the harmonic dominant
  assert.strictEqual(Songbook.chordInKey('A', 'D', 'Dorian'), false);  // exception is Minor-only
  assert.strictEqual(Songbook.chordInKey('E', 'C', 'Major'), false);   // III-major in major still out
  // the whitelisted V labels by the CHORD's quality: 'V', never 'v'
  assert.strictEqual(Songbook.romanInKey('A', 'D', 'Minor'), 'V');
  assert.strictEqual(Songbook.romanInKey('A7', 'D', 'Minor'), 'V');
  assert.strictEqual(Songbook.romanInKey('Am', 'D', 'Minor'), 'v');
});
test('mode names are case-normalized (saved items carry lowercase modes) - codex V2', function () {
  assert.strictEqual(Songbook.chordInKey('A7', 'D', 'minor'), true);   // whitelist works lowercase
  assert.strictEqual(Songbook.chordInKey('F', 'D', 'minor'), true);
  assert.strictEqual(Songbook.romanInKey('F', 'D', 'minor'), 'III');   // not chromatic bIII
  assert.strictEqual(Songbook.romanInKey('C', 'D', 'mixolydian'), 'VII');
  assert.strictEqual(Songbook.chordInKey('G', 'C', 'MAJOR'), true);
  // codex V4: the completion path must survive lowercase modes too - no
  // `undefined` chord ever leaks into a completion chip
  assert.deepStrictEqual(Songbook.chordsFromDegrees('D', 'minor', [0, 4]), ['Dm', 'Am']);
  var lc = Songbook.completions(['C', 'G', 'Am'], 'C', 'major');
  assert.ok(lc.length > 0, 'lowercase-major completions must not be empty');
  lc.forEach(function (c) { assert.ok(c.chord, 'completion chord must never be undefined'); });
  assert.ok(lc.some(function (c) { return c.chord === 'F'; }), 'I-V-vi -> IV still completes');
});
test('romanInKey casing across suffix families (7ths, m7b5, maj7) - codex V2', function () {
  assert.strictEqual(Songbook.romanInKey('Dm7', 'C', 'Major'), 'ii');
  assert.strictEqual(Songbook.romanInKey('Bm7b5', 'C', 'Major'), 'vii°');
  assert.strictEqual(Songbook.romanInKey('Fmaj7', 'C', 'Major'), 'IV');
  assert.strictEqual(Songbook.romanInKey('G7', 'C', 'Major'), 'V');
  assert.strictEqual(Songbook.romanInKey('Gm7', 'D', 'Minor'), 'iv');
});
test('mergeSuggestionRow: chip-row merge semantics (filter, float, dedupe, cap, fallback) - codex V3', function () {
  var m = Songbook.mergeSuggestionRow;
  // key filter drops out-of-key picks (D/E major junk in D minor)
  assert.deepStrictEqual(m(['Am', 'D', 'E', 'Gm'], [], 'D', 'Minor'), ['Am', 'Gm']);
  // completions float FIRST and are deduped out of the picks
  assert.deepStrictEqual(m(['G', 'Am', 'F'], ['F'], 'C', 'Major'), ['F', 'G', 'Am']);
  // a completion the ranker never surfaced still leads the row
  assert.deepStrictEqual(m(['G', 'Am'], ['Dm'], 'C', 'Major'), ['Dm', 'G', 'Am']);
  // cap at 5 (completions + picks)
  assert.deepStrictEqual(m(['G', 'Am', 'F', 'Em', 'Dm'], ['C'], 'C', 'Major'),
    ['C', 'G', 'Am', 'F', 'Em']);
  // all-out-of-key -> fallback keeps the unfiltered picks (borrowed beats none)
  assert.deepStrictEqual(m(['D', 'E'], [], 'C', 'Minor'), ['D', 'E']);
  // no key -> no filtering
  assert.deepStrictEqual(m(['D', 'E'], [], null, 'Major'), ['D', 'E']);
  // whitelisted harmonic-minor V7 survives the filter
  assert.deepStrictEqual(m(['A7', 'E'], [], 'D', 'Minor'), ['A7']);
  // empty picks + completions only
  assert.deepStrictEqual(m([], ['F'], 'C', 'Major'), ['F']);
});
test('romanInKey labels diatonic degrees mode-correctly, borrowed chords chromatically', function () {
  // D minor: the natural degrees read III/VI/VII (matching the Studio), never bIII/bVI/bVII
  assert.strictEqual(Songbook.romanInKey('Dm', 'D', 'Minor'), 'i');
  assert.strictEqual(Songbook.romanInKey('F', 'D', 'Minor'), 'III');
  assert.strictEqual(Songbook.romanInKey('A#', 'D', 'Minor'), 'VI');
  assert.strictEqual(Songbook.romanInKey('C', 'D', 'Minor'), 'VII');
  assert.strictEqual(Songbook.romanInKey('Edim', 'D', 'Minor'), 'ii°');
  assert.strictEqual(Songbook.romanInKey('Am', 'D', 'Minor'), 'v');
  // borrowed/non-diatonic falls through to the chromatic romanFor label
  assert.strictEqual(Songbook.romanInKey('D', 'D', 'Minor'), 'I');   // major tonic borrowed in minor
  assert.strictEqual(Songbook.romanInKey('A#', 'C', 'Major'), 'bVII'); // borrowed in major stays flat-labeled
  // major + mixolydian sanity
  assert.strictEqual(Songbook.romanInKey('G', 'C', 'Major'), 'V');
  assert.strictEqual(Songbook.romanInKey('Am', 'D', 'Mixolydian'), 'v');
  assert.strictEqual(Songbook.romanInKey('C', 'D', 'Mixolydian'), 'VII');
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
test('shadowedCatalogIds: forks report the catalog id they shadow, others do not', function () {
  var customs = [
    { id: 'm1', custom: true, seq: ['C', 'G'] },              // a plain composed custom
    { id: 'm2', custom: true, forkOf: 'k7', sheet: [['V', '[C]x']] }, // a fork of catalog k7
    { id: 'm3', custom: true, forkOf: 'k3' }                  // a fork of catalog k3
  ];
  assert.deepStrictEqual(Songbook.shadowedCatalogIds(customs), { k7: true, k3: true });
  assert.deepStrictEqual(Songbook.shadowedCatalogIds([]), {});
  assert.deepStrictEqual(Songbook.shadowedCatalogIds(null), {});
});
test('shadowedCatalogIds: a malformed/foreign forkOf (not kN) shadows nothing', function () {
  assert.deepStrictEqual(Songbook.shadowedCatalogIds([{ forkOf: 'bogus' }, { forkOf: 'm9' }, { forkOf: 'k2' }]), { k2: true });
});

/* ---- buildAllSongs: the PURE core of rebuildAll (shadow + append + sheet-preserve).
 * This is the real changed merge path, extracted so a regression ships RED instead of
 * green - the coverage gap codex flagged across volleys 2-5. ---- */
var CAT = [
  { t: 'Song A', a: 'X', sheet: [['V', '[C] a']] },  // -> k0
  { t: 'Song B', a: 'Y', sheet: [['V', '[G] b']] },  // -> k1
  { t: 'Song C', a: 'Z', sheet: [['V', '[D] c']] }   // -> k2
];
test('buildAllSongs: no customs -> catalog only, kN ids assigned in order', function () {
  var all = Songbook.buildAllSongs(CAT, []);
  assert.deepStrictEqual(all.map(function (s) { return s.id; }), ['k0', 'k1', 'k2']);
});
test('buildAllSongs: a fork SHADOWS its catalog original and appends the fork', function () {
  var fork = { id: 'm1', custom: true, forkOf: 'k1', t: 'My B', a: 'Y', sheet: [['V', '[G] mine']] };
  var all = Songbook.buildAllSongs(CAT, [fork]);
  var ids = all.map(function (s) { return s.id; });
  assert.ok(ids.indexOf('k1') < 0, 'catalog k1 is shadowed (omitted)');
  assert.deepStrictEqual(ids, ['k0', 'k2', 'm1']);           // k1 gone, fork appended
  assert.strictEqual(all.find(function (s) { return s.id === 'm1'; }).t, 'My B');
});
test('buildAllSongs: a fork PRESERVES its own sheet (chords+lyrics), not a chord-only rebuild', function () {
  var fork = { id: 'm1', custom: true, forkOf: 'k0', seq: ['C'], sheet: [['V', '[C] real lyric']] };
  var out = Songbook.buildAllSongs(CAT, [fork]).find(function (s) { return s.id === 'm1'; });
  assert.deepStrictEqual(out.sheet, [['V', '[C] real lyric']]); // own sheet wins over seq
});
test('buildAllSongs: a composed custom with seq (no sheet) gets a chord-only sheet', function () {
  var comp = { id: 'm2', custom: true, seq: ['Am', 'F'] };
  var out = Songbook.buildAllSongs(CAT, [comp]).find(function (s) { return s.id === 'm2'; });
  assert.deepStrictEqual(out.sheet, [['Progression', '[Am] [F]']]);
});
test('buildAllSongs: a video-only custom (no seq, no sheet) gets NO sheet (routes to Studio)', function () {
  var vid = { id: 'm3', custom: true, yt: 'abc' };
  var out = Songbook.buildAllSongs(CAT, [vid]).find(function (s) { return s.id === 'm3'; });
  assert.ok(!out.sheet, 'no fabricated sheet for a video-only track');
});
test('buildAllSongs: deleting the fork (customs without it) RESTORES the catalog original', function () {
  var fork = { id: 'm1', custom: true, forkOf: 'k1', sheet: [['V', 'x']] };
  assert.ok(Songbook.buildAllSongs(CAT, [fork]).map(function (s) { return s.id; }).indexOf('k1') < 0); // shadowed
  assert.ok(Songbook.buildAllSongs(CAT, []).map(function (s) { return s.id; }).indexOf('k1') >= 0);     // reverted
});
test('buildAllSongs: does not mutate the source catalog (fresh records with ids)', function () {
  var cat = [{ t: 'S', a: 'A' }];
  Songbook.buildAllSongs(cat, []);
  assert.ok(cat[0].id == null, 'source catalog record left untouched');
});

/* ---- remapSetlist: the setlist slot mutation on fork-shadow (kN->mN) and revert
 * (mN->kN or drop). Extracted + tested so the private STATE.setlist chain has a real
 * regression guard, not just the live Playwright pass. ---- */
test('remapSetlist: fork replaces EVERY catalog-id slot with the fork id (not just the first)', function () {
  var sl = ['k1', 'k3', 'k1'];           // duplicate defensive case
  assert.strictEqual(Songbook.remapSetlist(sl, 'k1', 'm9'), true);
  assert.deepStrictEqual(sl, ['m9', 'k3', 'm9']);
});
test('remapSetlist: revert with a restore id replaces every fork slot with the catalog id', function () {
  var sl = ['m9', 'k3'];
  assert.strictEqual(Songbook.remapSetlist(sl, 'm9', 'k1'), true);
  assert.deepStrictEqual(sl, ['k1', 'k3']);
});
test('remapSetlist: plain delete (toId null) REMOVES every matching slot', function () {
  var sl = ['m9', 'k3', 'm9'];
  assert.strictEqual(Songbook.remapSetlist(sl, 'm9', null), true);
  assert.deepStrictEqual(sl, ['k3']);
});
test('remapSetlist: no match -> unchanged + returns false', function () {
  var sl = ['k3', 'k4'];
  assert.strictEqual(Songbook.remapSetlist(sl, 'k1', 'm9'), false);
  assert.deepStrictEqual(sl, ['k3', 'k4']);
});
test('remapSetlist: mutates in place (keeps the array reference the queue holds)', function () {
  var sl = ['k1']; var ref = sl;
  Songbook.remapSetlist(sl, 'k1', 'm9');
  assert.strictEqual(ref, sl);           // same reference, mutated
  assert.deepStrictEqual(ref, ['m9']);
});
test('remapSetlist: a non-array is safe (returns false)', function () {
  assert.strictEqual(Songbook.remapSetlist(null, 'k1', 'm9'), false);
});

/* ---- shadowedTrackKeys: a fork suppresses its shadowed catalog song's backing
 * track (so a renamed fork doesn't orphan the original track as a standalone row). ---- */
// Use the REAL Repertoire.matchKey (not a mock) so the test catches normalization /
// call-chain drift - the exact function buildRepertoire passes at runtime.
var MK = Repertoire.matchKey;
test('shadowedTrackKeys: a fork yields its catalog original\'s match key (real matchKey; suppresses that track)', function () {
  var cat = [{ t: 'Let It Be', a: 'The Beatles' }, { t: 'Yellow', a: 'Coldplay' }]; // k0, k1
  var customs = [{ id: 'm1', custom: true, forkOf: 'k0', t: 'Let It Be (uke)', a: 'me' }]; // renamed fork of k0
  var keys = Songbook.shadowedTrackKeys(cat, customs, MK);
  // a backing track carrying the original song's title/artist matches the suppressed key
  assert.ok(keys[MK({ title: 'Let It Be', artist: 'The Beatles' })], 'the original Let It Be track key is suppressed');
  assert.ok(!keys[MK({ title: 'Yellow', artist: 'Coldplay' })], 'an unforked song is not suppressed');
});
test('shadowedTrackKeys: no forks -> empty set; missing matchKeyFn -> empty set', function () {
  var cat = [{ t: 'A', a: 'B' }];
  assert.deepStrictEqual(Songbook.shadowedTrackKeys(cat, [{ id: 'm1', custom: true, seq: ['C'] }], MK), {});
  assert.deepStrictEqual(Songbook.shadowedTrackKeys(cat, [{ forkOf: 'k0' }], null), {});
});

/* ---- studioTarget: a fork's OWN video must reach the Studio, not the merged
 * backing SEED track. This is the call-chain the play/action button uses
 * (repertoireAction -> openStudioCb(studioTarget(rec))); for a sheet-bearing
 * fork the row tap opens Practice instead (studioTarget is only the row-tap path
 * for seq-less video-only tracks). A regression here silently opens the seed
 * track for a fork that matched a backing track, dropping the curated video. ---- */
test('studioTarget: a custom/fork opens as ITSELF even when merged with a seed track', function () {
  var seed = { id: 't5', yt: 'SEEDvideoAA', key: 'C' };
  // a fork that matched a backing track: Repertoire.build hangs the seed on _track
  var fork = { id: 'm2', custom: true, forkOf: 'k7', t: 'Let It Be', a: 'The Beatles', key: 'C', mode: 'major', yt: 'FORKvideoBB', _track: seed };
  var out = Songbook.studioTarget(fork);
  assert.strictEqual(out.id, 'm2');           // the fork, not the seed
  assert.strictEqual(out.yt, 'FORKvideoBB');  // the curated video wins over the seed track
  // Studio shape: it reads title/artist, NOT the custom-song t/a - normalize or the
  // fork opens with a blank title (the regression volley 4 caught).
  assert.strictEqual(out.title, 'Let It Be');
  assert.strictEqual(out.artist, 'The Beatles');
});
test('studioTarget: a plain custom song with its own video opens as itself, title mapped', function () {
  var custom = { id: 'm9', custom: true, t: 'My Song', a: 'Me', key: 'G', mode: 'major', yt: 'MINEvideoCC', _track: { id: 't1', yt: 'SEEDvideoDD' } };
  var out = Songbook.studioTarget(custom);
  assert.strictEqual(out.id, 'm9');
  assert.strictEqual(out.yt, 'MINEvideoCC');
  assert.strictEqual(out.title, 'My Song'); // t -> title for the Studio
});
test('studioTarget: a custom BACKING TRACK (already title/artist) passes those through', function () {
  var track = { id: 'c1', custom: true, title: 'Jam', artist: 'Nobody', key: 'A', mode: 'minor', yt: 'TRKvideoEE' };
  var out = Songbook.studioTarget(track);
  assert.strictEqual(out.title, 'Jam');   // falls back to rec.title when rec.t absent
  assert.strictEqual(out.artist, 'Nobody');
});
test('studioTarget: preserves a custom rec.video field (the playability gate accepts it)', function () {
  // repertoireAction gates on (rec.yt || rec.video); a hand-picked normalize dropped
  // rec.video, leaving the Studio with no playable media (volley 6 High).
  var out = Songbook.studioTarget({ id: 'm5', custom: true, t: 'V', a: '', key: 'C', mode: 'major', video: 'VIDurl' });
  assert.strictEqual(out.video, 'VIDurl');
  assert.strictEqual(out.title, 'V');
});
test('studioTarget: a NON-custom merged song still opens the seed track (unchanged)', function () {
  var seed = { id: 't3', yt: 'SEEDvideoEE', key: 'G' };
  var merged = { id: 'k4', yt: 'CATvideoFF', _track: seed };   // catalog song merged w/ a track
  assert.strictEqual(Songbook.studioTarget(merged).id, 't3'); // seed track is the intent here
});
test('studioTarget: a bare record with no _track opens as itself', function () {
  var rec = { id: 'k1', yt: 'x' };
  assert.strictEqual(Songbook.studioTarget(rec).id, 'k1');
});
test('hasChordSheet: only items with a real chord sequence can join Practice/Setlist/Stage', function () {
  assert.strictEqual(Songbook.hasChordSheet({ seq: ['C', 'G'] }), true);
  assert.strictEqual(Songbook.hasChordSheet({ seq: [] }), false);   // cleared chords
  assert.strictEqual(Songbook.hasChordSheet({ yt: 'x' }), false);    // pure video-only custom track
  assert.strictEqual(Songbook.hasChordSheet({ seq: 'C G' }), false); // non-array guard
  assert.strictEqual(Songbook.hasChordSheet(null), false);
});
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
test('libraryFilter mine:true keeps ONLY user-owned items', function () {
  var out = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'all', key: 'all', mine: true });
  assert.deepStrictEqual(out.map(function (r) { return r.t; }), ['My Jam', 'Old Save']);
});
test('libraryFilter mine:true still composes with the q and key filters', function () {
  var q = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: 'jam', genre: 'all', key: 'all', mine: true });
  assert.deepStrictEqual(q.map(function (r) { return r.t; }), ['My Jam']);
  var k = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'all', key: 'G', mine: true });
  assert.deepStrictEqual(k.map(function (r) { return r.t; }), ['Old Save']); // seq G D derives key G
});
test('libraryFilter passes non-mine selections through to Repertoire.filter untouched', function () {
  var all = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'all', key: 'all' });
  assert.strictEqual(all.length, 3);
  var rock = Songbook.libraryFilter(RealRepertoire, MINE_LIST, { q: '', genre: 'rock', key: 'all' });
  assert.deepStrictEqual(rock.map(function (r) { return r.t; }), ['Catalog Song', 'My Jam']);
});
test('libraryFilter: a real genre named "mine" filters as a genre, NOT as ownership', function () {
  var list = [
    { t: 'Owned', a: 'Me', genre: 'rock', custom: true, d: 'Mine', seq: ['Am', 'F'] },
    { t: 'Mine-genre catalog', a: 'Band', genre: 'mine', seq: ['C', 'G'] }
  ];
  // genre 'mine' + mine:false -> the catalog item with that genre, not the owned one
  var g = Songbook.libraryFilter(RealRepertoire, list, { q: '', genre: 'mine', key: 'all', mine: false });
  assert.deepStrictEqual(g.map(function (r) { return r.t; }), ['Mine-genre catalog']);
  // ownership facet still works independently
  var o = Songbook.libraryFilter(RealRepertoire, list, { q: '', genre: 'all', key: 'all', mine: true });
  assert.deepStrictEqual(o.map(function (r) { return r.t; }), ['Owned']);
});

/* ---------- keyed zero-results empty state (why-is-my-list-empty visibility) ---------- */
test('libraryEmptyState names the active key filter and asks for the clearing link', function () {
  assert.deepStrictEqual(Songbook.libraryEmptyState({ key: 'Am' }),
    { message: 'Nothing matches in Am.', clearKey: true });
  assert.deepStrictEqual(Songbook.libraryEmptyState({ key: 'F#' }),
    { message: 'Nothing matches in F#.', clearKey: true });
});
test('libraryEmptyState with no key filter keeps the plain message, no link', function () {
  assert.deepStrictEqual(Songbook.libraryEmptyState({ key: 'all' }),
    { message: 'Nothing matches.', clearKey: false });
  assert.deepStrictEqual(Songbook.libraryEmptyState({}),
    { message: 'Nothing matches.', clearKey: false });
  assert.deepStrictEqual(Songbook.libraryEmptyState(null),
    { message: 'Nothing matches.', clearKey: false });
});

/* ---------- renderSheet tri-view: lyrics / chords / both ---------- */
var triSong = { sheet: [["Verse", "[C]Hello [G]world"], ["", "[Am]  [F]"]] };
test('renderSheet both (default) positions chords over lyrics', function () {
  var html = Songbook.renderSheet(triSong, 0, 'both');
  assert.ok(html.indexOf('class="crd"') >= 0, 'chord row expected');
  assert.ok(html.indexOf('Hello') >= 0 && html.indexOf('world') >= 0, 'lyric text expected');
  // legacy/default fallthrough: any unknown view token renders the combined sheet
  assert.strictEqual(Songbook.renderSheet(triSong, 0, undefined), html);
});
test('renderSheet lyrics strips chord tokens and drops pure-chord lines', function () {
  var html = Songbook.renderSheet(triSong, 0, 'lyrics');
  assert.ok(html.indexOf('Hello world') >= 0, 'lyric text expected without token gaps');
  assert.strictEqual(html.indexOf('class="crd"'), -1, 'no chord row in lyrics view');
  assert.strictEqual(html.indexOf('Am'), -1, 'pure-chord line must vanish');
  assert.ok(html.indexOf('Verse') >= 0, 'section headers stay');
});
test('renderSheet chords stays the campfire chord-bar view (transposed)', function () {
  var html = Songbook.renderSheet(triSong, 2, 'chords');
  assert.ok(html.indexOf('>D<') >= 0 && html.indexOf('>Bm<') >= 0, 'bars transpose (+2: C->D, Am->Bm)');
  assert.strictEqual(html.indexOf('Hello'), -1, 'no lyric text in chords view');
});

/* ---------- nextTranspose: transpose steps wrap at the range ends ---------- */
function always() { return true; }
test('nextTranspose steps by one semitone inside the range', function () {
  assert.strictEqual(Songbook.nextTranspose(0, 1, always), 1);
  assert.strictEqual(Songbook.nextTranspose(0, -1, always), -1);
  assert.strictEqual(Songbook.nextTranspose(3, 1, always), 4);
});
test('nextTranspose wraps at the top: +6 then + lands on -5 (same cycle, keeps going)', function () {
  assert.strictEqual(Songbook.nextTranspose(6, 1, always), -5);
});
test('nextTranspose wraps at the bottom: -5 then - lands on +6 (-6 normalizes to its enharmonic +6)', function () {
  assert.strictEqual(Songbook.nextTranspose(-5, -1, always), 6);
  assert.strictEqual(Songbook.nextTranspose(6, -1, always), 5); // and back down the far side
});
test('nextTranspose cycles through ALL 12 keys on repeated + taps', function () {
  var seen = {}, cur = 0;
  for (var i = 0; i < 12; i++) { seen[cur] = true; cur = Songbook.nextTranspose(cur, 1, always); }
  assert.strictEqual(Object.keys(seen).length, 12, 'twelve distinct transposes before repeating');
  assert.strictEqual(cur, 0, 'thirteenth tap is back where we started');
});
test('nextTranspose skips unplayable candidates ACROSS the wrap boundary', function () {
  // at +5, everything from +6 through -3 unvoiceable -> the next + must land on -2
  var playable = function (st) { return st === -2 || st === 5; };
  assert.strictEqual(Songbook.nextTranspose(5, 1, playable), -2);
});
test('nextTranspose returns null when no other transpose is playable (caller no-ops)', function () {
  assert.strictEqual(Songbook.nextTranspose(2, 1, function (st) { return st === 2; }), null);
  assert.strictEqual(Songbook.nextTranspose(0, 1, function () { return false; }), null);
});

/* ---------- ytSearchURL: the song-view "Hear it on YouTube" link ---------- */
test('ytSearchURL builds title + artist + key into one encoded query', function () {
  var url = Songbook.ytSearchURL({ t: 'Hey Jude', a: 'The Beatles', key: 'F' });
  assert.strictEqual(url, 'https://www.youtube.com/results?search_query=' + encodeURIComponent('Hey Jude The Beatles F key'));
});
test('ytSearchURL accepts long-form fields and skips the missing ones', function () {
  var url = Songbook.ytSearchURL({ title: 'Jolene', artist: 'Dolly Parton' });
  assert.strictEqual(url, 'https://www.youtube.com/results?search_query=' + encodeURIComponent('Jolene Dolly Parton'));
});
test('ytSearchURL encodes attribute-hostile characters so the double-quoted href cannot break out', function () {
  var url = Songbook.ytSearchURL({ t: 'Me & You "live"', a: 'X<Y' });
  assert.strictEqual(url.split('?')[1].indexOf('&'), -1, 'raw & must not survive into the query');
  assert.strictEqual(url.indexOf('"'), -1, 'raw double quote must not survive');
  assert.strictEqual(url.indexOf('<'), -1, 'raw < must not survive');
});

/* ---------- inferKey: Compose's auto-selected key (2+ chords, no explicit pick) ---------- */
test('inferKey: fewer than 2 chords never infers (one chord is not a key)', function () {
  assert.strictEqual(Songbook.inferKey([]), null);
  assert.strictEqual(Songbook.inferKey(['C']), null);
  assert.strictEqual(Songbook.inferKey(null), null);
});
test('inferKey: I-V-vi-IV starting on the tonic lands on that Major key', function () {
  assert.deepStrictEqual(Songbook.inferKey(['C', 'G', 'Am', 'F']), { root: 'C', mode: 'Major' });
  assert.deepStrictEqual(Songbook.inferKey(['G', 'D', 'Em', 'C']), { root: 'G', mode: 'Major' });
});
test('inferKey: two plain major chords already resolve (C + F -> C Major, first-chord tonic tie-break)', function () {
  assert.deepStrictEqual(Songbook.inferKey(['C', 'F']), { root: 'C', mode: 'Major' });
});
test('inferKey: a minor-led progression resolves to the minor key on the first chord', function () {
  // Am F C G fits BOTH C Major and A Minor fully - the first-chord tonic wins
  assert.deepStrictEqual(Songbook.inferKey(['Am', 'F', 'C', 'G']), { root: 'A', mode: 'Minor' });
});
test('inferKey: 7th extensions score as their base triads (G7 counts as G, Am7 as Am, Cmaj7 as C)', function () {
  assert.deepStrictEqual(Songbook.inferKey(['Cmaj7', 'G7', 'Am7', 'F']), { root: 'C', mode: 'Major' });
});
test('inferKey: one borrowed chord does not derail the majority key', function () {
  // Eb is borrowed (bIII) - the other four still say C Major
  assert.deepStrictEqual(Songbook.inferKey(['C', 'G', 'Eb', 'Am', 'F']), { root: 'C', mode: 'Major' });
});
test('inferKey: junk-only input infers nothing', function () {
  assert.strictEqual(Songbook.inferKey(['??', '!!']), null);
});
test('inferKey: DISTINCT triads are the evidence - a repeated single chord is not a key', function () {
  assert.strictEqual(Songbook.inferKey(['C', 'C']), null);        // one chord, twice
  assert.strictEqual(Songbook.inferKey(['Am', 'Am', 'Am']), null); // a one-chord vamp
  // but a real two-chord vamp still infers (distinct C + G -> C Major)
  assert.deepStrictEqual(Songbook.inferKey(['C', 'G', 'C', 'G']), { root: 'C', mode: 'Major' });
});

/* ---------- sheet-render escaping (volley 3: custom/imported chord tokens and
 * section labels are user-controlled strings - never live HTML) ---------- */
test('renderSheet(chords) escapes hostile chord tokens and section labels', function () {
  var hostile = [['<img src=x onerror=a>', 'La [<img/src=x/onerror=b>]la [C]la']];
  var html = Songbook.renderSheet({ sheet: hostile }, 0, 'chords');
  assert.ok(html.indexOf('<img') === -1, 'raw <img must never survive: ' + html);
  assert.ok(html.indexOf('&lt;img') !== -1, 'hostile tokens render as inert text');
});
test('renderSheet lyrics/both views escape section labels and injected tags', function () {
  var hostile = [['<b>sect</b>', '[C]hello <i>world</i>']];
  ['lyrics', 'both'].forEach(function (v) {
    var html = Songbook.renderSheet({ sheet: hostile }, 0, v);
    assert.ok(html.indexOf('<b>') === -1 && html.indexOf('<i>') === -1, v + ' must escape: ' + html);
    assert.ok(html.indexOf('&lt;b&gt;sect') !== -1, v + ' keeps the label as text');
  });
});

/* ---------- Solo-button visibility pin (codex #90 V1 medium) ----------
 * renderKey() is closure-bound, so pin the SOURCE contract: the gate must set
 * BOTH the hidden attribute AND inline style.display (songbook.css's
 * .soloBackingBtn{display:block} defeats the UA [hidden] rule - the C1/C3
 * root cause), and renderKey() must run at INIT for the first paint. */
test('solo-button gate pins hidden + inline display, and renderKey runs at init', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  assert.ok(/el\.soloBackingBtn\.hidden = !showSolo/.test(src), 'hidden-attribute half of the gate missing');
  assert.ok(/el\.soloBackingBtn\.style\.display = showSolo \? '' : 'none'/.test(src), 'inline-display half of the gate missing (CSS display:block would defeat [hidden] again)');
  var initM = /\/\/ first paint[\s\S]{0,200}renderKey\(\);/.test(src) || /renderKey\(\);\s*\/\/ init/.test(src) || /init[\s\S]{0,400}renderKey\(\)/i.test(src);
  assert.ok(initM, 'renderKey() init call not found');
  assert.ok(!/forceStarters/.test(src), 'forceStarters must stay removed');
  assert.ok(!/cHelp/.test(src), 'cHelp references must stay removed');
});

test('ytSearchURL: sentinel + custom-record query hygiene (codex #91)', function () {
  function q(url) { return decodeURIComponent(url.split('=', 2)[1]).replace(/\+/g, ' '); }
  // the 'search' artist sentinel never reaches the query
  assert.strictEqual(q(Songbook.ytSearchURL({ t: 'Slow Blues', a: 'search', key: 'A' })), 'Slow Blues A key');
  // a normal record keeps title + artist + key
  assert.strictEqual(q(Songbook.ytSearchURL({ t: 'Ripple', a: 'Grateful Dead', key: 'G' })), 'Ripple Grateful Dead G key');
  // an artist-less CUSTOM save folds genre + chords (there is no recording to find)
  var u = q(Songbook.ytSearchURL({ t: 'Original track', a: '', key: 'D', custom: true, genre: 'folk', seq: ['Dm', ' ', 'Am'] }));
  assert.strictEqual(u, 'Original track D key folk Dm Am');
  // a custom record without seq degrades to the plain query
  assert.strictEqual(q(Songbook.ytSearchURL({ t: 'Original track', a: '', custom: true })), 'Original track');
});

run();
