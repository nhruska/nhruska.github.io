/* =====================================================================
 * songbook.test.js  -  unit tests for the instrument-agnostic engine's
 * pure theory helpers (the bits that don't touch the DOM).
 * Run: node test/songbook.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
// A1 harness (the safe-save / Songbook.mount() tests near the bottom of this file):
// every shared module attaches to `(typeof window !== 'undefined' ? window : this)`
// - in the browser that's one shared `window`, so `global.Queue` / `global.Repertoire`
// resolve inside songbook.js's mount(). Node has no `window`; alias it to the real
// global object BEFORE any require so each module's IIFE lands on the SAME object,
// mirroring production instead of each getting its own isolated `this`.
if (typeof global.window === 'undefined') global.window = global;
// S-HARDEN (analysis-refactor-enhance-20260704 A4/A5): songbook.js's
// escHTML/wireTapCancel/composeWireTap are now thin delegates to esc.js's
// Esc.esc and list-item.js's ListItem.wireTap - both must be required (and
// land on the SAME global as above) before songbook.js.
require('../music/shared/esc.js');
require('../music/shared/list-item.js');
// S-TOAST (UAT U9): showToast/showComposeToast are now thin delegates to the
// shared toast.js primitive (see its own test/toast.test.js for unit
// coverage) - must be required before songbook.js for the same reason.
require('../music/shared/toast.js');
var Songbook = require('../music/shared/songbook.js');
var Circle = require('../music/shared/circle.js');
var Repertoire = require('../music/shared/repertoire.js');
// M-GUIDE W3a merged: solo-guide.js now exists (see the soloChipCaption tests below).
var SoloGuide = require('../music/shared/solo-guide.js');
require('../music/shared/queue.js'); // sets global.Queue - mount()'s QUEUE = global.Queue.createQueue()
var lsReset = require('./helpers/local-storage-reset.js');

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

/* ---------- convertProgressionQualities (D-KEYLESS core, m-guide-ia-20260704.md
 * section 4.5): the pure chord-mapping extracted out of convertToMode so both the
 * explicit-key path AND the keyless mode-change handler share one implementation.
 * No songKey mutation, no DOM - chords in, chords out. ---------- */
test('Major -> Minor re-qualify: roots hold, degree qualities flip, a non-scale root stays unchanged', function () {
  // C major I V vi IV (C G Am F) -> C minor: i and v and iv re-qualify minor;
  // Am's root (offset 9) is not a degree of natural minor -> borrowed, left alone.
  var out = Songbook.convertProgressionQualities(['C', 'G', 'Am', 'F'], 'Minor', 'C', 'Major');
  assert.deepStrictEqual(out, ['Cm', 'Gm', 'Am', 'Fm']);
});
test('borrowed/chromatic root (no degree at that offset in the target mode) is left unchanged', function () {
  var out = Songbook.convertProgressionQualities(['F#', 'G'], 'Major', 'C', 'Minor');
  assert.deepStrictEqual(out, ['F#', 'G']); // F# (offset 6) has no Major-scale degree; G (offset 7) is the diatonic V
});
test('same-mode conversion is idempotent: an already-diatonic progression maps to itself', function () {
  var out = Songbook.convertProgressionQualities(['C', 'Am', 'F', 'G'], 'Major', 'C', 'Major');
  assert.deepStrictEqual(out, ['C', 'Am', 'F', 'G']);
});
test('extension re-base: a minor-mode m7 tonic re-bases to a dominant 7 on the major-mode tonic', function () {
  // Cm7 (i7 in C minor) -> C major: the tonic degree is now major, so the minor-7
  // extension collapses to a plain dominant 7th (C7), not a mismatched Cmaj7/Cm7.
  var out = Songbook.convertProgressionQualities(['Cm7'], 'Major', 'C', 'Minor');
  assert.deepStrictEqual(out, ['C7']);
});
test('extension re-base: a dominant 7 landing on a minor degree becomes a minor 7', function () {
  // G7 (V7 in C major) -> C minor: v is a minor degree, so the dominant 7th
  // re-bases to a minor 7th (Gm7), not a mismatched G7/Gmaj7.
  var out = Songbook.convertProgressionQualities(['G7'], 'Minor', 'C', 'Major');
  assert.deepStrictEqual(out, ['Gm7']);
});
test('extension re-base: any 7th-type extension landing on a dim degree collapses to the bare dim triad', function () {
  // Bm7 -> C major: B (offset 11) is the vii° (dim) degree - the m7 extension
  // never survives onto a dim degree (Bdim, not Bdim7/Bm7).
  var out = Songbook.convertProgressionQualities(['Bm7'], 'Major', 'C', 'Minor');
  assert.deepStrictEqual(out, ['Bdim']);
});
test('defensive no-ops: empty chords, unknown target mode, and unresolvable tonic all degrade to unchanged input (never throw)', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities([], 'Minor', 'C', 'Major'), []);
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C', 'G'], 'NotAMode', 'C', 'Major'), ['C', 'G']);
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C', 'G'], 'Minor', null, 'Major'), ['C', 'G']);
  assert.deepStrictEqual(Songbook.convertProgressionQualities(null, 'Minor', 'C', 'Major'), []);
});
test('convertProgressionQualities is pure: never mutates the input array, always returns a fresh one', function () {
  var chords = ['C', 'G', 'Am', 'F'];
  var out = Songbook.convertProgressionQualities(chords, 'Minor', 'C', 'Major');
  assert.notStrictEqual(out, chords, 'must return a new array, not the same reference');
  assert.deepStrictEqual(chords, ['C', 'G', 'Am', 'F'], 'input array must be untouched');
  // mutating the result afterward must never reach back into the source
  out.push('Dm7');
  assert.strictEqual(chords.length, 4);
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
    'Pachelbel': 'I V vi iii IV I IV V',
    // W2 Blues starters: chordsFromDegrees resolves them mod-3 into I7/IV7/V7 chords;
    // this round-trip uses the GENERIC (mode-agnostic) Circle.romanFor, which does not
    // append the '7' (that's Songbook.romanInKey's job, exercised separately below) -
    // so the pattern here is the bare degree sequence (I/IV/V), not I7/IV7/V7.
    '12-bar blues': 'I I I I IV IV I I V IV I V',
    'Quick-change blues': 'I IV I I IV IV I I V IV I V'
  };
  Songbook.PROGRESSIONS.forEach(function (p) {
    // mode-aware: a Blues starter carries its OWN mode (p.mode), not the Major
    // default every diatonic entry above relies on.
    var chords = Songbook.chordsFromDegrees('C', p.mode || 'Major', p.degrees);
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
  // The A1 harness at the bottom of this file aliases global.window so Songbook's
  // mount() tests can share `global.Queue`/`global.Repertoire` the way production
  // scripts share one `window` - which legitimately populates the global.Repertoire
  // fallback those tests need. Null it out for just this assertion so the "truly no
  // deriver reachable, not even via the global fallback" path stays exercised.
  var savedGlobalRepertoire = global.Repertoire;
  delete global.Repertoire;
  try {
    assert.deepStrictEqual(Songbook.soloKeyFor({ t: 'x' }, ['C'], 0, null), { key: null, mode: null });
  } finally {
    global.Repertoire = savedGlobalRepertoire;
  }
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

/* ---------- S-CLEARGUARD (sprint-1 #1): Compose Clear undo snapshot (A3) ----------
 * The binding correctness property: buildClearSnapshot/applyClearSnapshot must
 * be a fully INDEPENDENT copy - later progression/songKey mutations (add/remove
 * chord, transpose, mode or key change) must never leak into a pending Undo,
 * and restoring must never hand back a live alias into the stored snapshot
 * (a second Clear->Undo cycle would otherwise corrupt the first). */
test('buildClearSnapshot is an independent copy - mutating the source after does not touch it', function () {
  var progression = ['C', 'G', 'Am', 'F'];
  var songKey = { root: 'C', mode: 'Major', explicit: true };
  var snap = Songbook.buildClearSnapshot(progression, 2, songKey, 'm123');
  // Mutate the ORIGINALS after the snapshot was taken (the equivalent of the
  // user rebuilding a new progression right after Clear).
  progression.push('Dm'); progression.length = 0;
  songKey.root = 'G'; songKey.mode = 'Minor'; songKey.explicit = false;
  assert.deepStrictEqual(snap.progression, ['C', 'G', 'Am', 'F']);
  assert.strictEqual(snap.cTpose, 2);
  assert.deepStrictEqual(snap.songKey, { root: 'C', mode: 'Major', explicit: true });
  assert.strictEqual(snap.savedComposeId, 'm123');
});
test('applyClearSnapshot returns an independent copy - mutating the result does not corrupt the stored snapshot', function () {
  var snap = Songbook.buildClearSnapshot(['E', 'A', 'Bm', 'D'], -1, { root: 'E', mode: 'Mixolydian', explicit: true }, null);
  var restored = Songbook.applyClearSnapshot(snap);
  assert.deepStrictEqual(restored.progression, ['E', 'A', 'Bm', 'D']);
  assert.strictEqual(restored.cTpose, -1);
  assert.deepStrictEqual(restored.songKey, { root: 'E', mode: 'Mixolydian', explicit: true });
  assert.strictEqual(restored.savedComposeId, null);
  // Mutate what the caller got back (as if the app kept editing after Undo) -
  // the SAVED snapshot object must be untouched, so a second Undo (if the
  // snapshot were still referenced) would still restore the true original.
  restored.progression.push('G'); restored.songKey.root = 'F#';
  assert.deepStrictEqual(snap.progression, ['E', 'A', 'Bm', 'D']);
  assert.strictEqual(snap.songKey.root, 'E');
});
test('buildClearSnapshot -> applyClearSnapshot round-trips the full pre-Clear state (A3 contract)', function () {
  var snap = Songbook.buildClearSnapshot(['G', 'D', 'Em', 'C'], 3, { root: 'G', mode: 'Major', explicit: false }, 'm999');
  assert.deepStrictEqual(Songbook.applyClearSnapshot(snap), {
    progression: ['G', 'D', 'Em', 'C'], cTpose: 3,
    songKey: { root: 'G', mode: 'Major', explicit: false }, savedComposeId: 'm999'
  });
});

/* ---------- Clear-undo wiring pin (A3: "ANY subsequent mutating action
 * invalidates it") ----------
 * The DOM-wired call sites can't run through jsdom-free unit tests, so pin
 * the SOURCE contract the same way the solo-button gate above does: every
 * enumerated mutating action (add/remove chord, transpose, mode change, key
 * change, Save) calls invalidateClearUndo(), Clear itself never regresses to
 * a native confirm(), and the slot remover is movement-cancelled (not a raw
 * onclick) per S-SLOTX. */
test('Clear-undo: every A3-listed mutating action invalidates, Clear never regresses to confirm(), slot-x is movement-cancelled', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  // Clear builds a snapshot and shows the banner - never a native confirm().
  var clearBlock = /el\.cClear\.onclick = function \(\) \{[\s\S]{0,900}?\};/.exec(src);
  assert.ok(clearBlock, 'cClear.onclick handler not found');
  assert.ok(/buildClearSnapshot\(progression, cTpose, songKey, savedComposeId\)/.test(clearBlock[0]), 'Clear must snapshot the full pre-Clear state before wiping it');
  assert.ok(/showClearUndoBanner\(\)/.test(clearBlock[0]), 'Clear must show the persistent undo banner');
  // (matches an actual confirm('...') CALL, not the word appearing in a code comment)
  assert.ok(!/confirm\(['"]/.test(clearBlock[0]), 'Clear must NEVER use a native confirm() dialog (A3)');
  // Each A3-listed mutating action calls invalidateClearUndo() somewhere in its body.
  ['function addChord\\(c\\) \\{', 'function composeTpose\\(st\\) \\{', 'function convertToMode\\(targetMode\\) \\{', 'function loadProgression\\(p\\) \\{', 'function saveProgression\\(done\\) \\{'].forEach(function (headRe) {
    var re = new RegExp(headRe + '[\\s\\S]{0,300}?invalidateClearUndo\\(\\)');
    assert.ok(re.test(src), 'missing invalidateClearUndo() near ' + headRe);
  });
  // remove-chord (the slot .rm tap) and the key root/mode pickers are anonymous
  // closures - just confirm the call count is at least 8 (one per identified
  // mutating site: addChord, remove-chord, composeTpose, convertToMode,
  // loadProgression, saveProgression, root-pick, empty-prog mode-set, keyClear).
  var count = (src.match(/invalidateClearUndo\(\)/g) || []).length;
  assert.ok(count >= 8, 'expected invalidateClearUndo() at every A3 mutating site, found ' + count);
  // S-SLOTX: the slot remover is movement-cancelled (composeWireTap), not a raw onclick.
  assert.ok(/composeWireTap\(rm, function/.test(src), 'slot remover must be movement-cancelled via composeWireTap, not a raw onclick');
  assert.ok(!/rm\.onclick = function/.test(src), 'slot remover must not regress to a raw onclick');
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

/* ---------- wireTapCancel (S-SETX rider a: setlist Clear movement-cancel) ----------
 * Minimal fake element (addEventListener/dispatch only) - same "just enough DOM"
 * approach as test/diagram.dom.test.js, no jsdom dependency. Drives the REAL
 * exported wireTapCancel through touchstart/touchmove/click, mirroring exactly
 * how a scroll-grab vs a tap looks on the wire. */
function FakeTapEl() { this._h = {}; }
FakeTapEl.prototype.addEventListener = function (type, fn) { (this._h[type] = this._h[type] || []).push(fn); };
FakeTapEl.prototype.fire = function (type, evt) { (this._h[type] || []).forEach(function (fn) { fn(evt); }); };
function touch(x, y) { return { touches: [{ clientX: x, clientY: y }] }; }
function clickEvt() { return { stopPropagation: function () {} }; }

test('wireTapCancel: a still tap (no touchmove past threshold) fires fn', function () {
  var el = new FakeTapEl(), fired = 0;
  Songbook.wireTapCancel(el, function () { fired++; });
  el.fire('touchstart', touch(100, 100));
  el.fire('touchmove', touch(103, 98)); // 3px, well under the 10px threshold
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 1);
});

test('wireTapCancel: a scroll-grab (touchmove > 10px) suppresses fn (setlist Clear must not fire)', function () {
  var el = new FakeTapEl(), fired = 0;
  Songbook.wireTapCancel(el, function () { fired++; });
  el.fire('touchstart', touch(100, 100));
  el.fire('touchmove', touch(100, 130)); // 30px vertical scroll-grab
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 0);
});

test('wireTapCancel: threshold is exclusive-over-10px and checks EITHER axis', function () {
  var el = new FakeTapEl(), fired = 0;
  Songbook.wireTapCancel(el, function () { fired++; });
  el.fire('touchstart', touch(0, 0));
  el.fire('touchmove', touch(11, 0)); // x-only breach
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 0, 'x-axis breach alone must cancel');

  var el2 = new FakeTapEl(), fired2 = 0;
  Songbook.wireTapCancel(el2, function () { fired2++; });
  el2.fire('touchstart', touch(0, 0));
  el2.fire('touchmove', touch(0, 10)); // exactly at threshold, not over
  el2.fire('click', clickEvt());
  assert.strictEqual(fired2, 1, 'exactly-10px move must still count as a tap');
});

test('wireTapCancel: a mouse click with no touch events at all still fires (desktop unaffected)', function () {
  var el = new FakeTapEl(), fired = 0;
  Songbook.wireTapCancel(el, function () { fired++; });
  el.fire('click', clickEvt());
  assert.strictEqual(fired, 1);
});

test('wireTapCancel: no-op guard when el or fn is missing (never throws)', function () {
  assert.doesNotThrow(function () { Songbook.wireTapCancel(null, function () {}); });
  assert.doesNotThrow(function () { Songbook.wireTapCancel(new FakeTapEl(), null); });
});

test('setClear wiring: routed through wireTapCancel, not a raw .onclick= (movement-cancel guard, S-SETX)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  assert.ok(/wireTapCancel\(el\.setClear,/.test(src), 'el.setClear must be wired via wireTapCancel(), not a raw onclick=');
  assert.ok(!/el\.setClear\.onclick\s*=/.test(src), 'a raw el.setClear.onclick= would bypass the movement-cancel guard');
  // the underlying confirm() + clear behavior must be unchanged (rider keeps it, only adds the guard)
  assert.ok(/confirm\('Clear your setlist\?'\)/.test(src), 'the native confirm() prompt text must stay unchanged');
});

/* =====================================================================
 * A1 (analysis-refactor-enhance-20260704) - truthful save feedback.
 * ---------------------------------------------------------------------
 * saveCustom/saveSet/saveLast/savePerfPrefs/saveSongView and saveProgression's
 * toast are private closures inside Songbook.mount(opts) - not reachable as
 * standalone exports. Driving them for real means actually mounting, which
 * needs a DOM. Same ~25-line minimal-stub-document approach already used by
 * test/key-explorer.dom.test.js (no jsdom dependency), extended just enough
 * for the compose-save UI (el.prog/catChips/buildGrid/cSave -> the toast +
 * inline save-name row saveProgression drives).
 *
 * saveCustom's return value is exercised directly through the OBSERVABLE
 * toast text/class it drives (the strongest proof: it's the same code path
 * a real user hits). saveSet/saveLast/savePerfPrefs/saveSongView route
 * through the identical safeSet() helper and are passive (no UI signal, not
 * reachable through the mount() controller surface) - validating safeSet via
 * saveCustom's observable effect covers their shared implementation too.
 * ===================================================================== */
function makeStubEl(tag) {
  var e = {
    tagName: tag, children: [], className: '', textContent: '', hidden: false,
    disabled: false, attrs: {}, style: {}, parentNode: null, onclick: null,
    onkeydown: null, dataset: {}, value: '', checked: false,
    appendChild: function (c) { c.parentNode = e; e.children.push(c); return c; },
    insertBefore: function (c) { c.parentNode = e; e.children.push(c); return c; },
    removeChild: function (c) { var i = e.children.indexOf(c); if (i >= 0) e.children.splice(i, 1); return c; },
    setAttribute: function (k, v) { e.attrs[k] = v; },
    // S-PROG-WRAP (UAT U8): real listener recording (was a total no-op) so an
    // element wired via composeWireTap/wireTapCancel (list-item.js's wireTap
    // calls addEventListener directly, never a plain .onclick=) can be driven
    // from a test - fire via fireListeners() below. No existing test called
    // .click() or otherwise depended on addEventListener staying inert (the
    // dedicated wireTapCancel suite uses its own separate FakeTapEl), so this
    // is purely additive capability, not a behavior change for any passing test.
    _listeners: {},
    addEventListener: function (type, fn) { (e._listeners[type] = e._listeners[type] || []).push(fn); },
    // UAT U6/U7 (2026-07-04): both spy-recording, purely additive - no
    // existing test reads _focusCalls/_scrollCalls, so this can't regress
    // anything already passing. focus() records a call count (U7: "focus
    // lands in the dialog"); scrollIntoView() records each call's opts (U6:
    // the quality-filter scroll anchor) - neither exists on a real DOM
    // element by default here, so callers must guard-check before use.
    focus: function () { e._focusCalls = (e._focusCalls || 0) + 1; },
    scrollIntoView: function (opts) { e._scrollCalls = (e._scrollCalls || []); e._scrollCalls.push(opts); },
    click: function () { if (e.onclick) e.onclick(); }
  };
  e.classList = {
    _set: {},
    add: function (c) { this._set[c] = true; },
    remove: function (c) { delete this._set[c]; },
    toggle: function (c, on) { if (on === undefined) { if (this._set[c]) delete this._set[c]; else this._set[c] = true; } else if (on) this._set[c] = true; else delete this._set[c]; },
    contains: function (c) { return !!this._set[c]; }
  };
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return ''; },
    set: function (v) { if (v === '') e.children = []; }
  });
  return e;
}
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: makeStubEl,
    createTextNode: function (t) { return { textContent: t, nodeType: 3 }; },
    body: makeStubEl('body'),
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
}
// A fresh Songbook.mount() with just enough `el` for the Compose save UI
// (ensureComposeUI needs el.prog.parentNode; buildGrid needs catChips+buildGrid
// to actually build chord tiles; cSave is the Save button's own onclick target).
function mountForSaveTests() {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = { prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'), cSave: makeStubEl('button') };
  var ctrl = Songbook.mount({ storagePrefix: 'a1test', el: elMap });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
// Taps the first built chord tile twice (a 2-chord progression), clicks Save,
// then drives the inline name row's own Save button (defaultName accepted,
// "Add to setlist" unchecked so the toggleSet/"Added to setlist" path - out
// of this mission's line-region grant - never fires and can't muddy the assert).
function buildAndSave(m) {
  var tile = m.elMap.buildGrid.children[0];
  tile.onclick(); tile.onclick();
  m.elMap.cSave.onclick();
  var composeRow = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) composeRow = c; });
  if (!composeRow) throw new Error('A1 harness: composeRow was not created - ensureComposeUI() likely returned false');
  var setCheck = composeRow.children[1].children[0]; // setLabel -> its checkbox
  setCheck.checked = false;
  composeRow.children[2].onclick(); // saveBtn -> finish(defaultName) -> saveProgression's done callback
}
function findComposeToast(m) {
  var t = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeToast') === 0) t = c; });
  return t;
}
// showComposeToast sets `.className` as a plain string ('composeToast err tap'),
// not via classList.add() - this stub's classList is a separate no-sync object
// (see makeStubEl), so class membership must be checked on the className string.
function hasClass(el, cls) { return (' ' + el.className + ' ').indexOf(' ' + cls + ' ') >= 0; }

test('A1: saveProgression on a healthy store shows the real success toast (not an err toast)', function () {
  var m = mountForSaveTests();
  buildAndSave(m);
  var toast = findComposeToast(m);
  assert.strictEqual(toast.textContent, 'Saved to your Repertoire');
  assert.strictEqual(hasClass(toast, 'err'), false, 'a successful save must not carry the err class');
});

test('A1: saveProgression on a throwing (quota-exceeded) store shows a truthful failure toast, never the success message', function () {
  var m = mountForSaveTests();
  var thrown = 0, warned = 0;
  var origWarn = console.warn;
  console.warn = function () { warned++; };
  global.localStorage.setItem = function () {
    thrown++;
    var e = new Error('The quota has been exceeded.');
    e.name = 'QuotaExceededError';
    throw e;
  };
  try {
    buildAndSave(m);
  } finally {
    console.warn = origWarn;
  }
  assert.ok(thrown > 0, 'the stubbed setItem must actually have been called (proves the write was attempted, not skipped)');
  var toast = findComposeToast(m);
  assert.strictEqual(toast.textContent, "Couldn't save - storage is full or blocked. Export a backup from Settings.");
  assert.strictEqual(hasClass(toast, 'err'), true, 'a failed save must carry the err class');
  assert.notStrictEqual(toast.textContent, 'Saved to your Repertoire', 'must never claim success on a write that threw');
  assert.strictEqual(warned, 1, 'safeSet must console.warn exactly once for this key, not spam per attempt');
});

test('A1: the update-in-place branch ("Updated ...") is equally truthful on a throwing store, and warns only once per key', function () {
  var m = mountForSaveTests();
  // First save succeeds (healthy store) - links savedComposeId so a second Save
  // on the same buffer takes the update-in-place branch (not a fresh create).
  buildAndSave(m);
  assert.strictEqual(findComposeToast(m).textContent, 'Saved to your Repertoire');
  // Add one more chord, then start failing storage, then Save again -> the
  // "Updated ..." branch, not the create branch.
  var tile = m.elMap.buildGrid.children[0];
  tile.onclick();
  var warned = 0;
  var origWarn = console.warn;
  console.warn = function () { warned++; };
  global.localStorage.setItem = function () {
    var e = new Error('The quota has been exceeded.');
    e.name = 'QuotaExceededError';
    throw e;
  };
  m.elMap.cSave.onclick(); // no name row this time - savedComposeId is already set
  console.warn = origWarn;
  var toast = findComposeToast(m);
  assert.strictEqual(toast.textContent, "Couldn't save - storage is full or blocked. Export a backup from Settings.");
  assert.strictEqual(hasClass(toast, 'err'), true);
  assert.ok(!/^Updated /.test(toast.textContent), 'must not show the "Updated ..." success wording on a write that threw');
  // the update-in-place branch attempts CUSTOM_KEY twice in one click (once inside
  // updateCustomItem's own internal saveCustom(), once more when saveProgression
  // re-invokes saveCustom() to observe a truthful result - see the code comment at
  // that call site) - both throw, but safeSet warns only once per key.
  assert.strictEqual(warned, 1, 'safeSet must suppress the repeat warning for the same key within one mount');
});

/* =====================================================================
 * H4 (S-HARDEN, analysis-refactor-enhance-20260704 A1 bug shape): toggleSet's
 * "Added to setlist" toast used to fire unconditionally regardless of whether
 * saveSet() actually persisted. showToast() renders into document.body (not
 * the local compose wrapper), so findPlainToast() below reads it from there -
 * distinguished from a composeToast by requiring className to START WITH
 * 'toast' (composeToast does NOT start with that substring, so no collision).
 *
 * The only reachable path to toggleSet in this stub-DOM harness is through
 * saveProgression's own "Add to setlist" checkbox (checked by default in
 * openSaveNameRow - buildAndSave above explicitly unchecks it to avoid this
 * exact path). Leaving it checked exercises the REAL toggleSet code, just via
 * a different caller than the Library "+" button production code takes -
 * the unit under test (toggleSet's branching logic) is identical either way.
 * ===================================================================== */
function buildAndSaveAddToSetlist(m) {
  var tile = m.elMap.buildGrid.children[0];
  tile.onclick(); tile.onclick();
  m.elMap.cSave.onclick();
  var composeRow = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) composeRow = c; });
  if (!composeRow) throw new Error('H4 harness: composeRow was not created - ensureComposeUI() likely returned false');
  // setCheck defaults to checked=true (openSaveNameRow) - leave it as-is so
  // addToSetlist fires toggleSet(cs.id) and its toast becomes observable.
  composeRow.children[2].onclick(); // saveBtn -> finish(defaultName, true) -> saveProgression's done -> toggleSet
}
function findPlainToast() {
  var kids = document.body.children, t = null;
  for (var i = kids.length - 1; i >= 0; i--) {
    if (kids[i].className && kids[i].className.indexOf('toast') === 0) { t = kids[i]; break; }
  }
  return t;
}

test('H4: toggleSet on a healthy store shows the real success toast (not the err class)', function () {
  var m = mountForSaveTests();
  buildAndSaveAddToSetlist(m);
  var toast = findPlainToast();
  assert.ok(toast, 'expected a .toast element in document.body after Add-to-setlist Save');
  assert.strictEqual(toast.textContent, 'Added to setlist');
  // showToast toggles 'err' via classList (not a plain className string like
  // showComposeToast) - check classList.contains directly, not the hasClass
  // helper above (which reads .className, the composeToast-specific shape).
  assert.strictEqual(toast.classList.contains('err'), false, 'a successful setlist add must not carry the err class');
});

test('H4: toggleSet on a throwing (quota-exceeded) store shows a truthful failure toast, never "Added to setlist"', function () {
  var m = mountForSaveTests();
  var thrown = 0, warned = 0;
  var origWarn = console.warn;
  console.warn = function () { warned++; };
  // First write (the song save itself, CUSTOM_KEY) succeeds; only the
  // SECOND write (the setlist save, STORE_KEY) inside toggleSet must throw -
  // otherwise the create branch itself would fail first and never reach
  // toggleSet at all. Fail only on the setlist key.
  var realSetItem = global.localStorage.setItem;
  global.localStorage.setItem = function (key, value) {
    if (key.indexOf('.setlist.') !== -1) {
      thrown++;
      var e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    }
    return realSetItem.call(global.localStorage, key, value);
  };
  try {
    buildAndSaveAddToSetlist(m);
  } finally {
    console.warn = origWarn;
  }
  assert.ok(thrown > 0, 'the stubbed setItem must actually have been called for the setlist key (proves the write was attempted, not skipped)');
  var toast = findPlainToast();
  assert.ok(toast, 'expected a .toast element in document.body even on a failed setlist save');
  assert.strictEqual(toast.textContent, "Couldn't save - storage is full or blocked. Export a backup from Settings.");
  assert.strictEqual(toast.classList.contains('err'), true, 'a failed setlist add must carry the err class');
  assert.notStrictEqual(toast.textContent, 'Added to setlist', 'must never claim success on a setlist write that threw');
});

/* =====================================================================
 * S-TOAST (UAT U9): the exact end-to-end repro - Compose Save with the
 * default-checked "Add to setlist" box fires toggleSet()'s Library toast
 * (showToast, 1600ms auto-hide) THEN, in the same synchronous tick,
 * saveProgression's showComposeToast(..., persist: true). Before the
 * toast.js extraction, showComposeToast's clearTimeout(toastTimer) silently
 * killed the Library toast's pending auto-hide via the shared `var
 * toastTimer` both functions used to declare in Songbook.mount()'s closure -
 * leaving "Added to setlist" stuck on-screen forever (the operator's
 * screenshot). This drives that exact call sequence with a fake clock (no
 * real 1600ms wait) and proves the Library toast's auto-hide still fires.
 * ===================================================================== */
test('S-TOAST/U9: the Library "Added to setlist" toast still auto-hides on schedule even though a persist:true Compose toast fires in the same tick', function () {
  var nextId = 1, scheduled = {}, cleared = [];
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { cleared.push(id); delete scheduled[id]; };
  var m;
  try {
    m = mountForSaveTests();
    buildAndSaveAddToSetlist(m); // toggleSet's showToast, THEN showComposeToast(persist:true) - same tick
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
  var libraryToast = findPlainToast();
  var composeToast = findComposeToast(m);
  assert.ok(libraryToast, 'expected the Library .toast element in document.body');
  assert.strictEqual(libraryToast.textContent, 'Added to setlist');
  assert.ok(composeToast, 'expected the Compose .composeToast element');
  assert.strictEqual(composeToast.textContent, 'Saved to your Repertoire');
  // buildAndSaveAddToSetlist also taps a chord tile twice on the way in, and
  // each tap schedules its OWN unrelated 220ms "sel" class-removal timer
  // (songbook.js's chord-tile tap animation, nothing to do with toasts) - so
  // total scheduled count is noisy. Isolate by duration instead: the Library
  // toast's own 1600ms auto-hide must be the ONLY 1600ms-duration timer, and
  // the persist:true Compose toast must have scheduled NO 3000ms timer at all
  // (that's the bug's exact mechanism - it must neither clobber A's timer
  // nor schedule one of its own it would never clear).
  var byDuration = {};
  Object.keys(scheduled).forEach(function (id) {
    var ms = scheduled[id].ms;
    byDuration[ms] = (byDuration[ms] || []).concat([Number(id)]);
  });
  assert.strictEqual((byDuration[1600] || []).length, 1, 'exactly one pending 1600ms auto-hide timer (the Library toast\'s)');
  assert.strictEqual((byDuration[3000] || []).length, 0, 'a persist:true Compose toast must schedule NO 3000ms timer');
  assert.strictEqual(libraryToast.classList.contains('on'), true, 'Library toast is visible immediately after showToast()');
  assert.strictEqual(composeToast.hidden, false, 'Compose toast (persist:true) is visible with no timer of its own');
  // Fire the Library toast's own scheduled auto-hide (simulates the real
  // 1600ms elapsing) - this is the assertion that FAILED before the fix
  // (the timer had already been silently cancelled and would never fire).
  var id = byDuration[1600][0];
  scheduled[id].cb();
  assert.strictEqual(libraryToast.classList.contains('on'), false, 'Library toast must auto-hide once its own timer elapses - the U9 regression');
  // The persist:true Compose toast must remain completely untouched by the
  // Library toast's own hide - the two hosts are fully independent.
  assert.strictEqual(composeToast.hidden, false, 'Compose toast (persist:true) must stay visible - unaffected by the unrelated Library toast auto-hiding');
});

/* =====================================================================
 * M-GUIDE W2: Blues as a harmonizing key model (I7/IV7/V7), per
 * m-guide-ia-20260704.md section 1 as amended by section 8 (professor fold).
 * ===================================================================== */

/* ---------- chordInKey / romanInKey: Blues palette acceptance ---------- */
test('chordInKey: Blues palette accepts plain triad OR dominant 7th, nothing else', function () {
  // C blues: I7=C7 IV7=F7 V7=G7
  assert.strictEqual(Songbook.chordInKey('C', 'C', 'Blues'), true);   // plain root
  assert.strictEqual(Songbook.chordInKey('C7', 'C', 'Blues'), true);  // dominant 7th
  assert.strictEqual(Songbook.chordInKey('F', 'C', 'Blues'), true);
  assert.strictEqual(Songbook.chordInKey('F7', 'C', 'Blues'), true);
  assert.strictEqual(Songbook.chordInKey('G', 'C', 'Blues'), true);
  assert.strictEqual(Songbook.chordInKey('G7', 'C', 'Blues'), true);
  // no ii/dim/maj7/subs - minimalist palette (D-BLUES-KEY)
  assert.strictEqual(Songbook.chordInKey('Cm', 'C', 'Blues'), false);
  assert.strictEqual(Songbook.chordInKey('Cmaj7', 'C', 'Blues'), false);
  assert.strictEqual(Songbook.chordInKey('Am', 'C', 'Blues'), false);  // off-palette root
  assert.strictEqual(Songbook.chordInKey('Cdim', 'C', 'Blues'), false);
  assert.strictEqual(Songbook.chordInKey('C9', 'C', 'Blues'), false);  // not exactly '7'
});
test('romanInKey: Blues palette dominant 7th IS the label (C7=I7), plain root reads bare (C=I)', function () {
  assert.strictEqual(Songbook.romanInKey('C7', 'C', 'Blues'), 'I7');
  assert.strictEqual(Songbook.romanInKey('C', 'C', 'Blues'), 'I');
  assert.strictEqual(Songbook.romanInKey('F7', 'C', 'Blues'), 'IV7');
  assert.strictEqual(Songbook.romanInKey('F', 'C', 'Blues'), 'IV');
  assert.strictEqual(Songbook.romanInKey('G7', 'C', 'Blues'), 'V7');
  assert.strictEqual(Songbook.romanInKey('G', 'C', 'Blues'), 'V');
  // borrowed root (A over a C blues) falls through to the chromatic label
  assert.strictEqual(Songbook.romanInKey('A7', 'C', 'Blues'), Circle.romanFor('A7', 'C'));
  // lowercase mode name (saved-item vocabulary) resolves the same
  assert.strictEqual(Songbook.romanInKey('D7', 'D', 'blues'), 'I7');
});

/* ---------- chordsFromDegrees: mod-3 generalization over Blues' 3-degree palette ---------- */
test('chordsFromDegrees: Blues wraps mod-3 (I7 IV7 V7), not mod-7', function () {
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Blues', [0, 1, 2]), ['C7', 'F7', 'G7']);
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Blues', [3, 4, 5]), ['C7', 'F7', 'G7']); // wraps
  assert.deepStrictEqual(Songbook.chordsFromDegrees('C', 'Blues', [-1]), ['G7']); // negative wraps to V7
});
test('chordsFromDegrees: the 12-bar blues fill in A matches the shipped starter exactly', function () {
  assert.deepStrictEqual(
    Songbook.chordsFromDegrees('A', 'Blues', [0, 0, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2]),
    ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7']);
});

/* ---------- convertProgressionQualities: all 4 Blues directions (+ fold 8A) ---------- */
test('convertProgressionQualities: Major -> Blues collapses palette roots to root+7, others unchanged', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C', 'F', 'G'], 'Blues', 'C', 'Major'),
    ['C7', 'F7', 'G7']);
  // a prior extension is overridden regardless (I7/IV7/V7 is the whole point)
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['Cmaj7', 'Dm', 'G'], 'Blues', 'C', 'Major'),
    ['C7', 'Dm', 'G7']); // Dm (offset 2) has no Blues-palette degree -> unchanged
});
test('convertProgressionQualities: Minor -> Blues, same palette-degree rule', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['Cm', 'Fm', 'Gm'], 'Blues', 'C', 'Minor'),
    ['C7', 'F7', 'G7']);
});
test('convertProgressionQualities: Blues -> Major, professor fold 8A - only palette roots strip; A7 SURVIVES', function () {
  // C blues [C7 F7 G7 A7] -> Major = [C F G A7] (A7 is not palette material - offset 9
  // from tonic C is not in {0,5,7} - so it is left byte-for-byte unchanged, even
  // though A sits on a valid Major-mode degree (vi) - fold 8A supersedes the old
  // "root on a target degree" gate).
  var out = Songbook.convertProgressionQualities(['C7', 'F7', 'G7', 'A7'], 'Major', 'C', 'Blues');
  assert.deepStrictEqual(out, ['C', 'F', 'G', 'A7']);
});
test('convertProgressionQualities: Blues -> Minor, dom-7-strip on palette roots', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C7', 'F7', 'G7'], 'Minor', 'C', 'Blues'),
    ['Cm', 'Fm', 'Gm']);
});
test('convertProgressionQualities: Blues -> Blues is idempotent (palette roots stay dominant 7ths)', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C7', 'F7', 'G7'], 'Blues', 'C', 'Blues'),
    ['C7', 'F7', 'G7']);
});
test('convertProgressionQualities: a maj7/m7 surviving from Blues on a palette root keeps its own extension-class (not stripped)', function () {
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['Cmaj7'], 'Major', 'C', 'Blues'), ['Cmaj7']);
});
test('convertProgressionQualities: targetMode is canonicalized - lowercase "blues"/"major" (the saved-item/bridge vocabulary) work identically to the capitalized form (professor finding, PR #115)', function () {
  // lowercase 'blues' target must NOT silently no-op (MODES['blues'] is undefined;
  // only MODES['Blues'] exists) - canonMode(targetMode) must resolve it first.
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C', 'F', 'G'], 'blues', 'C', 'Major'),
    ['C7', 'F7', 'G7']);
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C', 'F', 'G'], 'blues', 'C', 'Major'),
    Songbook.convertProgressionQualities(['C', 'F', 'G'], 'Blues', 'C', 'Major'), 'lowercase and capitalized targetMode must match');
  // lowercase 'major' target must strip the palette 7ths back the same as 'Major'
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C7', 'F7', 'G7'], 'major', 'C', 'Blues'),
    ['C', 'F', 'G']);
  assert.deepStrictEqual(Songbook.convertProgressionQualities(['C7', 'F7', 'G7'], 'major', 'C', 'Blues'),
    Songbook.convertProgressionQualities(['C7', 'F7', 'G7'], 'Major', 'C', 'Blues'), 'lowercase and capitalized targetMode must match');
});

/* ---------- completions: Blues never auto-completes (category mismatch, never inferred) ---------- */
test('completions: Blues top guard always returns [] regardless of progression content', function () {
  assert.deepStrictEqual(Songbook.completions(['C7', 'F7', 'G7'], 'C', 'Blues'), []);
  assert.deepStrictEqual(Songbook.completions(['C7', 'F7', 'G7'], 'C', 'blues'), []); // lowercase too
  assert.deepStrictEqual(Songbook.completions([], 'C', 'Blues'), []);
});
test('completions: a mode-carrying (Blues) starter never leaks into a non-Blues key\'s completion canon (professor finding, PR #115)', function () {
  // Before Blues starters existed, ["C"] in C Major only ever matched the diatonic
  // canon (4-chord song / 50s-doo-wop / Pop-Axis / Pachelbel, all starting on I).
  // "Quick-change blues" ALSO starts on degree 0 (I7), so without the p.mode guard
  // it would coincidentally prefix-match here too and leak a bogus completion.
  var preBluesExpected = Songbook.completions(['C'], 'C', 'Major').map(function (c) { return c.name; }).sort();
  assert.ok(preBluesExpected.indexOf('12-bar blues') === -1, 'sanity: 12-bar blues must not appear');
  assert.ok(preBluesExpected.indexOf('Quick-change blues') === -1, 'sanity: Quick-change blues must not appear');
  // the actual regression check: no p.mode-carrying entry contributes ANY completion,
  // across every prefix length a Blues starter could coincidentally share
  [['C'], ['C', 'F'], ['C', 'C'], ['C', 'F', 'C']].forEach(function (seed) {
    var names = Songbook.completions(seed, 'C', 'Major').map(function (c) { return c.name; });
    assert.ok(names.indexOf('12-bar blues') === -1, '12-bar blues leaked for seed ' + seed.join(' '));
    assert.ok(names.indexOf('Quick-change blues') === -1, 'Quick-change blues leaked for seed ' + seed.join(' '));
  });
});

/* ---------- COMPOSE_MAX (D-CAP12): the shared cap constant ---------- */
test('COMPOSE_MAX is exported as 12 (D-CAP12, up from the old 8-chord cap)', function () {
  assert.strictEqual(Songbook.COMPOSE_MAX, 12);
});

/* ---------- progStripMode (S-PROG-WRAP, UAT U8): measured-width threshold, never a hardcoded count ---------- */
test('progStripMode: a diagram row that fits the strip stays full (unchanged behavior)', function () {
  // 4 cards x 84px + 3 gaps x 8px = 336 + 24 = 360; strip has 400 -> fits
  assert.strictEqual(Songbook.progStripMode(4, 84, 8, 400), 'full');
});
test('progStripMode: the same card/gap size overflows the strip once count grows -> compact', function () {
  // 12 cards x 84px + 11 gaps x 8px = 1008 + 88 = 1096; strip only has 400 -> overflow
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, 400), 'compact');
});
test('progStripMode: the SAME count fits a wider strip and overflows a narrower one - width drives the call, not count alone', function () {
  // 6 cards x 84 + 5 gaps x 8 = 504 + 40 = 544
  assert.strictEqual(Songbook.progStripMode(6, 84, 8, 600), 'full');
  assert.strictEqual(Songbook.progStripMode(6, 84, 8, 500), 'compact');
});
test('progStripMode: an exact fit (needW === availW) is NOT an overflow - the boundary is exclusive', function () {
  assert.strictEqual(Songbook.progStripMode(3, 84, 8, 3 * 84 + 2 * 8), 'full');
  assert.strictEqual(Songbook.progStripMode(3, 84, 8, 3 * 84 + 2 * 8 - 1), 'compact');
});
test('progStripMode: 0 chords never compact even in a tiny strip - nothing to wrap', function () {
  assert.strictEqual(Songbook.progStripMode(0, 84, 8, 10), 'full');
});
test('progStripMode: an unmeasured container (availW <= 0, e.g. before first layout) defaults to full, never spuriously compacts', function () {
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, 0), 'full');
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, -5), 'full');
});
test('progStripMode: an unmeasured card width (cardW <= 0, e.g. the probe was unavailable) defaults to full', function () {
  assert.strictEqual(Songbook.progStripMode(12, 0, 8, 400), 'full');
});

/* ---------- PROGRESSIONS: the two Blues starters carry mode + preview ---------- */
test('PROGRESSIONS: the 12-bar and quick-change Blues starters carry mode + preview fields', function () {
  var blues = Songbook.PROGRESSIONS.filter(function (p) { return p.mode === 'Blues'; });
  assert.strictEqual(blues.length, 2, 'expected exactly 2 Blues starters');
  blues.forEach(function (p) {
    assert.strictEqual(p.preview, 'I7 IV7 V7');
    assert.strictEqual(p.degrees.length, 12);
  });
  assert.ok(blues.some(function (p) { return p.name === '12-bar blues'; }));
  assert.ok(blues.some(function (p) { return p.name === 'Quick-change blues'; }));
});

/* ---------- M-GUIDE W3b: Compose key-view solo-scale PREVIEW (decoupled,
 * non-persisted - m-guide-ia-20260704.md section 3). Pure derivation only;
 * the DOM-touching chip row lives in renderKeyView (untestable here), so the
 * tiny data-derivation it calls is extracted to soloChipScale/soloChipCaption
 * and tested directly, per the DOM-less pattern this file already follows. */
test('soloChipScale: the mode chip returns the KEY scale via Circle.spellScale (A Major = ionian)', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'mode'), Circle.spellScale('A', 'ionian'));
});
test('soloChipScale: Minor/Mixolydian/Dorian mode chips map through CIRCLE_MODE (aeolian/mixolydian/dorian)', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('D', 'Minor', 'mode'), Circle.spellScale('D', 'aeolian'));
  assert.deepStrictEqual(Songbook.soloChipScale('G', 'Mixolydian', 'mode'), Circle.spellScale('G', 'mixolydian'));
  assert.deepStrictEqual(Songbook.soloChipScale('E', 'Dorian', 'mode'), Circle.spellScale('E', 'dorian'));
});
test('soloChipScale: pentMajor/pentMinor/blues chips read Circle.soloScale directly, independent of the key mode', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'pentMajor'), Circle.soloScale('A', 'pentMajor'));
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'pentMinor'), Circle.soloScale('A', 'pentMinor'));
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'blues'), Circle.soloScale('A', 'blues'));
});
test('soloChipScale: the mode chip on a BLUES key IS the 6-note blues scale (why the Blues-key row dedupes the standalone Blues chip)', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('C', 'Blues', 'mode'), Circle.soloScale('C', 'blues'));
});
test('soloChipScale: unresolvable root -> null (never throws)', function () {
  assert.strictEqual(Songbook.soloChipScale('H', 'Major', 'mode'), null);
  assert.strictEqual(Songbook.soloChipScale('H', 'Major', 'pentMajor'), null);
});
// S-CHIPS-PLUS (P5 W3 verdict): the Blues-key row's freed 4th slot is
// Mixolydian - resolved via Circle.spellScale directly (independent of
// keyMode, matching how pentMajor/pentMinor/blues already resolve), checked
// across 3 roots per the mission's V&V bar.
test('soloChipScale: the mixolydian chip resolves via Circle.spellScale for 3 roots (Blues-key row 4th chip)', function () {
  ['A', 'C', 'G'].forEach(function (root) {
    assert.deepStrictEqual(Songbook.soloChipScale(root, 'Blues', 'mixolydian'), Circle.spellScale(root, 'mixolydian'));
  });
});
test('soloChipScale: mixolydian chip is independent of keyMode, like the other non-mode chips', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('E', 'Major', 'mixolydian'), Circle.spellScale('E', 'mixolydian'));
});
test('soloChipScale: mixolydian chip on an unresolvable root -> null (never throws)', function () {
  assert.strictEqual(Songbook.soloChipScale('H', 'Blues', 'mixolydian'), null);
});
test('soloChipCaption: never captions the default/mode chip', function () {
  assert.strictEqual(Songbook.soloChipCaption('mode'), null);
});
// SoloGuide (shared/solo-guide.js) shipped in the sibling W3a wave (merge-order
// free relative to this one, per the guarded require() above) - now that both
// waves are integrated, soloChipCaption resolves to SoloGuide.framing()'s real
// text, exactly as the pre-merge test's own comment anticipated ("a strictly
// stronger, not weaker, outcome").
test('soloChipCaption: resolves the REAL SoloGuide.framing() text once solo-guide.js is present (W3a integrated)', function () {
  assert.strictEqual(Songbook.soloChipCaption('pentMajor'), SoloGuide.framing('pentMajor', Circle.soloScaleInfo('pentMajor').family));
  assert.strictEqual(Songbook.soloChipCaption('pentMinor'), SoloGuide.framing('pentMinor', Circle.soloScaleInfo('pentMinor').family));
  assert.strictEqual(Songbook.soloChipCaption('blues'), SoloGuide.framing('blues', Circle.soloScaleInfo('blues').family));
});
test('soloChipCaption: still never throws for an unknown scale id (safe-null contract preserved)', function () {
  assert.strictEqual(Songbook.soloChipCaption('nonsense'), null);
});
// S-CHIPS-PLUS: framing() has no mixolydian branch - the caption falls back to
// SoloGuide.card('mixolydian').chooseWhen, which needs no {i} note
// interpolation for that block (P5 W3 verdict: "trivially reachable").
test('soloChipCaption: mixolydian resolves via SoloGuide.card().chooseWhen (framing() has no mixolydian branch)', function () {
  assert.strictEqual(Songbook.soloChipCaption('mixolydian'), SoloGuide.card('mixolydian').chooseWhen);
  assert.strictEqual(typeof Songbook.soloChipCaption('mixolydian'), 'string');
});

/* ---------- S-CHIPS-PLUS: the degrees line under the notes line (P5 W3
 * verdict - "how do these notes function"). soloChipDegrees mirrors
 * soloChipScale's own scaleId routing so a chip's notes and its degrees
 * always describe the SAME scale; tested the same DOM-less way. */
test('soloChipDegrees: the mode chip returns the KEY scale degrees via Circle.scaleDegrees (A Major = ionian)', function () {
  assert.deepStrictEqual(Songbook.soloChipDegrees('Major', 'mode'), Circle.scaleDegrees('ionian'));
});
test('soloChipDegrees: Minor/Mixolydian/Dorian mode chips map through CIRCLE_MODE, matching soloChipScale', function () {
  assert.deepStrictEqual(Songbook.soloChipDegrees('Minor', 'mode'), Circle.scaleDegrees('aeolian'));
  assert.deepStrictEqual(Songbook.soloChipDegrees('Mixolydian', 'mode'), Circle.scaleDegrees('mixolydian'));
  assert.deepStrictEqual(Songbook.soloChipDegrees('Dorian', 'mode'), Circle.scaleDegrees('dorian'));
});
test('soloChipDegrees: pentMajor/pentMinor/blues chips read Circle.soloScaleDegrees directly, independent of the key mode', function () {
  assert.deepStrictEqual(Songbook.soloChipDegrees('Major', 'pentMajor'), Circle.soloScaleDegrees('pentMajor'));
  assert.deepStrictEqual(Songbook.soloChipDegrees('Major', 'pentMinor'), Circle.soloScaleDegrees('pentMinor'));
  assert.deepStrictEqual(Songbook.soloChipDegrees('Major', 'blues'), Circle.soloScaleDegrees('blues'));
});
test('soloChipDegrees: the mode chip on a BLUES key IS the blues scale degrees (matches soloChipScale dedup)', function () {
  assert.deepStrictEqual(Songbook.soloChipDegrees('Blues', 'mode'), Circle.soloScaleDegrees('blues'));
});
test('soloChipDegrees: the mixolydian chip (Blues-key 4th chip) resolves via Circle.scaleDegrees', function () {
  assert.deepStrictEqual(Songbook.soloChipDegrees('Blues', 'mixolydian'), Circle.scaleDegrees('mixolydian'));
});
// An unrecognized scaleId is not special-cased (mirrors soloChipScale exactly)
// so it falls through to the KEY's own mode-chip derivation - only an
// unresolvable/unknown KEY MODE (no CIRCLE_MODE entry) yields null, same
// safe-empty contract as soloChipScale's unresolvable-root case.
test('soloChipDegrees: an unresolvable key mode -> null (never throws)', function () {
  assert.strictEqual(Songbook.soloChipDegrees('Nonsense', 'mode'), null);
  assert.strictEqual(Songbook.soloChipDegrees('Nonsense', 'anything'), null);
});
test('isolation: solo-chip derivation never touches harmonization (chordInKey/romanInKey outputs identical before/after chip taps)', function () {
  var beforeIn = Songbook.chordInKey('Am', 'C', 'Major');
  var beforeRoman = Songbook.romanInKey('G', 'C', 'Major');
  Songbook.soloChipScale('C', 'Major', 'pentMajor');
  Songbook.soloChipScale('C', 'Major', 'pentMinor');
  Songbook.soloChipScale('C', 'Major', 'blues');
  Songbook.soloChipScale('C', 'Blues', 'mixolydian');
  Songbook.soloChipDegrees('C', 'pentMajor');
  Songbook.soloChipDegrees('Blues', 'mixolydian');
  Songbook.soloChipCaption('pentMajor');
  Songbook.soloChipCaption('blues');
  Songbook.soloChipCaption('mixolydian');
  assert.strictEqual(Songbook.chordInKey('Am', 'C', 'Major'), beforeIn);
  assert.strictEqual(Songbook.romanInKey('G', 'C', 'Major'), beforeRoman);
});

/* =====================================================================
 * S-COMPOSE-POLISH2 (2026-07-04, operator Pixel UAT round 2) - U6 quality-
 * filter scroll anchor + U7 solo-CTA modal presentation. Same minimal-stub-
 * document mount() approach as the A1/H4 harnesses above; a dedicated
 * mountForGridTests()/mountForSoloChoiceTests() (rather than reusing
 * mountForSaveTests()) so the added el.composeChords/el.suggest/
 * el.soloBackingBtn stubs can't affect the existing A1/H4 assertions above.
 * ===================================================================== */
function mountForGridTests() {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    cSave: makeStubEl('button'), composeChords: makeStubEl('div'), suggest: makeStubEl('div')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'gridtest', el: elMap });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
function findTabRow(m) {
  var row = null;
  m.elMap.composeChords.children.forEach(function (c) { if (c.className === 'catTabRow') row = c; });
  return row;
}

test('U6: the initial (unflagged) buildGrid render never scroll-anchors the filter row', function () {
  var m = mountForGridTests();
  var row = findTabRow(m);
  assert.ok(row, 'expected the All-view catTabRow to render by default (no key set)');
  assert.ok(!row._scrollCalls || row._scrollCalls.length === 0, 'initial render must not scroll-anchor');
});

test('U6: tapping a quality-filter chip re-renders catTabRow AND scroll-anchors it to the top of the visible area', function () {
  var m = mountForGridTests();
  var firstRow = findTabRow(m);
  var minorChip = firstRow.children[1]; // ['Major'(on), 'Minor', '7th', 'Maj7', 'Min7'] - tap 'Minor'
  minorChip.onclick();
  var newRow = findTabRow(m);
  assert.notStrictEqual(newRow, firstRow, 'buildGrid rebuilds a fresh catTabRow node on every call');
  assert.ok(newRow._scrollCalls && newRow._scrollCalls.length === 1, 'the filter tap must scroll-anchor the REBUILT row exactly once');
  assert.deepStrictEqual(newRow._scrollCalls[0], { block: 'start', behavior: 'auto' });
});

test('U6: switching the In-key|All segmented toggle (not a quality-filter tap) never scroll-anchors', function () {
  var m = mountForGridTests();
  var seg = m.elMap.catChips.children[0]; // .chordSeg
  var allBtn = seg.children[1]; // ['In key', 'All'] - re-tap 'All' (re-render, same view)
  allBtn.onclick();
  var row = findTabRow(m);
  assert.ok(row, 'All view still renders after the segmented toggle');
  assert.ok(!row._scrollCalls || row._scrollCalls.length === 0, 'the In-key|All toggle must never anchor - only a quality-filter tap does');
});

function mountForSoloChoiceTests(openStudioSpy) {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    cSave: makeStubEl('button'), composeChords: makeStubEl('div'), suggest: makeStubEl('div'),
    soloBackingBtn: makeStubEl('button')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'solotest', el: elMap, openStudio: openStudioSpy });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
function findComposeRow(m) {
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  return row;
}
function findComposeBackdrop(m) {
  var bd = null;
  m.wrapper.children.forEach(function (c) { if (c.className === 'composeModalBackdrop') bd = c; });
  return bd;
}
// Loads a starter progression (sets songKey.root + a non-empty progression in
// ONE tap - the two prerequisites soloBackingBtn's onclick guards on) via the
// empty-state suggestion row's first starter button, then taps Solo-over -
// "never saved this session" -> openSoloChoiceRow(...).
function startSoloChoice(m) {
  var startRow = m.elMap.suggest.children[1]; // [0]=label, [1]=progPickRow
  startRow.children[0].onclick(); // loadProgression(PROGRESSIONS[0])
  m.elMap.soloBackingBtn.onclick();
}

test('U7: openSoloChoiceRow presents as a modal (asModal + backdrop dim + dialog a11y + focus) - matching the save-name modal pattern', function () {
  var m = mountForSoloChoiceTests(function () {});
  startSoloChoice(m);
  var row = findComposeRow(m);
  var backdrop = findComposeBackdrop(m);
  assert.ok(row, 'expected composeRow to be created');
  assert.ok(row.classList.contains('asModal'), 'solo-choice row must present as a modal, same as the save-name row');
  assert.strictEqual(row.hidden, false);
  assert.ok(backdrop, 'expected the composeModalBackdrop to be created');
  assert.strictEqual(backdrop.hidden, false, 'backdrop must be shown while the solo-choice modal is open');
  assert.strictEqual(row.attrs.role, 'dialog');
  assert.strictEqual(row.attrs['aria-modal'], 'true');
  assert.ok(row._focusCalls >= 1, 'the dialog itself must receive focus (no input to focus, unlike the save-name row)');
});

test('U7: backdrop tap dismisses the solo-choice modal as Skip (no NavHistory loaded in this harness -> falls back to the direct close)', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  findComposeBackdrop(m).onclick();
  assert.strictEqual(picks.length, 1, 'expected the ephemeral-Studio open to fire exactly once (Skip semantics)');
  assert.strictEqual(picks[0].title, 'Solo practice', 'backdrop dismiss must resolve to Skip, not Save');
  assert.strictEqual(findComposeRow(m).hidden, true, 'the modal must be torn down after dismiss');
  assert.strictEqual(findComposeBackdrop(m).hidden, true, 'the backdrop must be re-hidden after dismiss');
});

test('U7: Escape dismisses the solo-choice modal as Skip', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  findComposeRow(m).onkeydown({ key: 'Escape' });
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(picks[0].title, 'Solo practice');
});

test('U7: "Save & open Studio" resolves to save (not skip) and chains into the save-name modal before opening the Studio', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  var btnRow = findComposeRow(m).children[1]; // [msg, btnRow]
  btnRow.children[0].onclick(); // 'Save & open Studio'
  assert.strictEqual(picks.length, 0, 'Save must open the NAME row first, not the Studio directly');
  var nameRow = findComposeRow(m);
  assert.ok(nameRow.classList.contains('asModal'), 'saveProgression chains straight into the save-name modal');
  nameRow.children[2].onclick(); // [input, setLabel, saveBtn, cancelBtn] - saveBtn
  assert.strictEqual(picks.length, 1, 'confirming the save-name row must now open the Studio for the saved song');
  assert.strictEqual(picks[0].custom, true);
});

test('U7: "Skip" resolves to skip and opens the ephemeral Studio directly (no save-name row)', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  var btnRow = findComposeRow(m).children[1];
  btnRow.children[1].onclick(); // 'Skip'
  assert.strictEqual(picks.length, 1);
  assert.strictEqual(picks[0].title, 'Solo practice');
  assert.strictEqual(findComposeRow(m).hidden, true);
});

/* =====================================================================
 * S-PROG-WRAP (2026-07-04, UAT U8) - progression strip degrade+wrap.
 * progStripMode's pure-fn coverage lives above, near COMPOSE_MAX. These are
 * the DOM-level checks the pure fn can't cover on its own: does renderProg
 * actually build the compact/full markup correctly, does the existing .rm
 * remover still work in compact mode, and does the mode flip back to full
 * when the progression shrinks below threshold again.
 *
 * Same minimal-stub-document mount() approach as the harnesses above,
 * dedicated (not reusing mountForSaveTests/mountForGridTests) so setting
 * elMap.prog.clientWidth here can't affect any other suite's assertions.
 * clientWidth is a plain stub property (no real layout engine) - progCardW's
 * off-screen probe measures offsetWidth, which is undefined on these stub
 * elements, so it deterministically falls back to its documented 84px
 * constant; progGapW/progAvailW fall back to 8px/clientWidth respectively
 * (no window.getComputedStyle in Node) - all three fallbacks are asserted
 * against directly in the width arithmetic below rather than left implicit.
 * ===================================================================== */
function mountForProgWrapTests() {
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    cSave: makeStubEl('button'), composeChords: makeStubEl('div'), suggest: makeStubEl('div')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'progwraptest', el: elMap });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}
// Loads a named PROGRESSIONS starter via the empty-state suggestion row (the
// same #suggest -> progPickRow -> loadProgression(p) path startSoloChoice
// above drives for its first entry) - lets these tests pick a KNOWN chord set
// (with known romans) by name instead of depending on buildGrid's tile order.
function loadStarterByName(m, name) {
  var startRow = m.elMap.suggest.children[1]; // [0]=label, [1]=progPickRow
  var idx = Songbook.PROGRESSIONS.map(function (p) { return p.name; }).indexOf(name);
  if (idx < 0) throw new Error('loadStarterByName: unknown starter "' + name + '"');
  startRow.children[idx].onclick();
}
// Fires a stub element's real recorded listeners for `type` (see makeStubEl's
// addEventListener) - the composeWireTap/wireTap path list-item.js wires
// .rm through, which a plain .onclick()/.click() call can't reach.
function fireListeners(el, type, evt) {
  (el._listeners[type] || []).forEach(function (fn) { fn(evt); });
}
// Simulates a plain mouse tap through wireTap: no touchstart/touchmove fired,
// so wireTap's internal `moved` flag stays false and the click handler runs
// fn(e) - matching the dedicated wireTapCancel suite's own "mouse click with
// no touch events at all still fires" case.
function tapWired(el) { fireListeners(el, 'click', { stopPropagation: function () {} }); }

test('S-PROG-WRAP: a progression that fits the strip renders diagram cards (full mode), .wrapped absent', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000; // plenty of room for 3 cards at the 84px fallback width
  loadStarterByName(m, 'Three-chord rock'); // degrees [0,3,4] in C Major -> C F G
  assert.strictEqual(m.elMap.prog.classList.contains('wrapped'), false);
  assert.strictEqual(m.elMap.prog.children.length, 3);
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(slot.children.some(function (c) { return c.className === 'chord'; }), 'full mode must render the diagram .chord element');
    assert.ok(!slot.children.some(function (c) { return c.className === 'suggChip'; }), 'full mode must not use the compact suggChip token');
  });
});

test('S-PROG-WRAP: a progression whose diagram row would overflow the strip degrades to compact tokens (name + roman, no diagram) and flex-wraps', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 50; // narrow strip - even one 84px fallback card overflows
  loadStarterByName(m, '4-chord song'); // degrees [0,4,5,3] in C Major -> C G Am F -> I V vi IV
  assert.strictEqual(m.elMap.prog.classList.contains('wrapped'), true, 'the strip must switch to wrap mode');
  assert.strictEqual(m.elMap.prog.children.length, 4);
  var names = [], romans = [];
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(!slot.children.some(function (c) { return c.className === 'chord'; }), 'compact mode must not render the diagram element');
    var chip = slot.children.filter(function (c) { return c.className === 'suggChip'; })[0];
    assert.ok(chip, 'expected the existing suggChip token, reused verbatim (not a 4th chip variant)');
    var nm = chip.children.filter(function (c) { return c.className === 'scName'; })[0];
    var rn = chip.children.filter(function (c) { return c.className === 'scRn'; })[0];
    names.push(nm.textContent); romans.push(rn.textContent);
  });
  assert.deepStrictEqual(names, ['C', 'G', 'Am', 'F']);
  assert.deepStrictEqual(romans, ['I', 'V', 'vi', 'IV']);
});

test('S-PROG-WRAP: removing a chord from a compact slot (the x button) works the same as full mode', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 50;
  loadStarterByName(m, '4-chord song'); // C G Am F
  assert.strictEqual(m.elMap.prog.children.length, 4);
  var secondSlot = m.elMap.prog.children[1]; // G
  var rm = secondSlot.children.filter(function (c) { return c.className === 'rm'; })[0];
  assert.ok(rm, 'expected the remove (x) button on a compact slot');
  tapWired(rm);
  assert.strictEqual(m.elMap.prog.children.length, 3, 'removing from a compact slot must shrink the progression by one');
  var names = m.elMap.prog.children.map(function (slot) {
    var chip = slot.children.filter(function (c) { return c.className === 'suggChip'; })[0];
    return chip.children.filter(function (c) { return c.className === 'scName'; })[0].textContent;
  });
  assert.deepStrictEqual(names, ['C', 'Am', 'F'], 'G must be the one removed, remaining order preserved');
});

test('S-PROG-WRAP: removing chords back below the threshold flips the strip back to full diagram-card mode', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 250; // 3 cards (3*84+2*8=268) overflow; 2 cards (2*84+1*8=176) fit
  loadStarterByName(m, 'Three-chord rock'); // C F G
  assert.strictEqual(m.elMap.prog.classList.contains('wrapped'), true, '3 chords at the 84px fallback card width overflow a 250px strip');
  var slot0 = m.elMap.prog.children[0];
  var rm = slot0.children.filter(function (c) { return c.className === 'rm'; })[0];
  tapWired(rm); // remove the first chord (C) -> F, G remain
  assert.strictEqual(m.elMap.prog.children.length, 2);
  assert.strictEqual(m.elMap.prog.classList.contains('wrapped'), false, '2 chords must fit and flip back to full diagram mode');
  var remainingSlot = m.elMap.prog.children[0];
  assert.ok(remainingSlot.children.some(function (c) { return c.className === 'chord'; }), 'must render the diagram element again after flipping back to full');
  assert.ok(!remainingSlot.children.some(function (c) { return c.className === 'suggChip'; }), 'must not still show the compact token after flipping back');
});

run();
