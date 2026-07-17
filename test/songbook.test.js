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

/* ---------- S-UI-RECONCILE (Lane A): key-aware song-view / Stage spelling ----------
 * The operator screenshot bug: a saved F-major song rendered "A#" on the song
 * screen (chip row / sheet / transpose readout) instead of "Bb". The song-view
 * and Stage surfaces now route every chord NAME through a view-local key-aware
 * speller (chordSpeller), while chord TOKENS (data-c, audio, storage) stay
 * canonical-sharp. These lock: the respelling, the transpose interplay (the key
 * moves with the transpose, no double-transpose), the keyless fallback, the
 * mapper threading through renderSheet/renderChordOnly, and the delete-button
 * class contract shared with Lane D (songbook.css). */
test('chordSpeller: inside F major, chord ROOTS respell by function (A# -> Bb, D# -> Eb); quality suffix preserved', function () {
  var disp = Songbook.chordSpeller('F', 'major');
  assert.strictEqual(disp('A#'), 'Bb');           // IV of F reads Bb, never A#
  assert.strictEqual(disp('D#'), 'Eb');           // bVII reads Eb
  assert.strictEqual(disp('A#m7'), 'Bbm7');        // root respells, m7 kept verbatim
  assert.strictEqual(disp('A#m7b5'), 'Bbm7b5');
  assert.strictEqual(disp('F'), 'F');              // naturals unchanged
  assert.strictEqual(disp('C'), 'C');
});
test('chordSpeller: keyless (no key / Circle absent) falls back to the raw canonical-sharp token', function () {
  assert.strictEqual(Songbook.chordSpeller(null, 'major')('A#'), 'A#');
  assert.strictEqual(Songbook.chordSpeller('', 'major')('D#'), 'D#');
  // junk / empty tokens pass through untouched, never throw
  assert.strictEqual(Songbook.chordSpeller('F', 'major')(''), '');
});
test('chordSpeller: transpose interplay - the key moves WITH the transpose (F song at +2 spells in G, at +1 in F#)', function () {
  // soloKeyFor already transpose-adjusts the key; chordSpeller must NOT transpose
  // again - both key and tokens live in the one transposed domain.
  var song = { seq: ['F', 'A#', 'C'], key: 'F', mode: 'major' };
  [2, 1].forEach(function (st) {
    var seqT = song.seq.map(function (c) { return Songbook.tpose(c, st); });
    var sk = Songbook.soloKeyFor(song, seqT, st);
    var disp = Songbook.chordSpeller(sk.key, sk.mode);
    // the tonic chip agrees with the transposed key's preferred spelling
    assert.strictEqual(disp(seqT[0]), Circle.preferredTonicName(sk.key, sk.mode));
  });
  // +2 -> G major: the IV token (A# -> C) reads C, agreeing with G
  var seq2 = song.seq.map(function (c) { return Songbook.tpose(c, 2); });
  var sk2 = Songbook.soloKeyFor(song, seq2, 2);
  assert.deepStrictEqual(seq2.map(Songbook.chordSpeller(sk2.key, sk2.mode)), ['G', 'C', 'D']);
});
test('chordSpeller: NO double-transpose - F major at +4 spells the bVII as G, not the Abb a re-transposed key would emit', function () {
  // Regression guard for the exact trap: if the key were transposed a SECOND
  // time (F +4 -> A, then +4 -> C#), the bVII token (D# -> G) would misspell as
  // Abb. The correct single-domain key (A) spells it G.
  var song = { seq: ['F', 'D#'], key: 'F', mode: 'major' };
  var st = 4;
  var seqT = song.seq.map(function (c) { return Songbook.tpose(c, st); }); // ['A','G']
  var sk = Songbook.soloKeyFor(song, seqT, st);                            // {key:'A',mode:'major'}
  assert.strictEqual(sk.key, 'A');
  var disp = Songbook.chordSpeller(sk.key, sk.mode);
  assert.strictEqual(disp('G'), 'G');                                      // correct
  assert.notStrictEqual(disp('G'), Circle.noteInKey(Songbook.tpose(sk.key, st), 'major', 'G')); // != double-transpose result
});
test('renderChordOnly / renderSheet: an optional display map threads through; without it the raw token renders (back-compat)', function () {
  var song = { seq: ['F', 'A#', 'C'], sheet: [['Verse', '[F] [A#] [C]']], key: 'F', mode: 'major' };
  var disp = Songbook.chordSpeller('F', 'major');
  // WITH the map: A# -> Bb in the campfire (chords-only) sheet - the operator bug
  var mapped = Songbook.renderChordOnly(song.sheet, 0, disp);
  assert.ok(mapped.indexOf('>Bb<') >= 0, 'chords-only sheet must show Bb');
  assert.ok(mapped.indexOf('>A#<') < 0, 'chords-only sheet must NOT show A#');
  // WITHOUT the map: unchanged canonical-sharp behavior (every keyless caller)
  var raw = Songbook.renderChordOnly(song.sheet, 0);
  assert.ok(raw.indexOf('>A#<') >= 0, 'no map -> raw token unchanged');
  // both-view (renderSheet default) threads the map too
  var both = Songbook.renderSheet(song, 0, 'both', disp);
  assert.ok(both.indexOf('Bb') >= 0 && both.indexOf('A#') < 0, 'both-view respells via the map');
});
test('deleteBtnClass: a real delete wears the danger primitive, a fork revert stays ghost; both span the row via .full (no inline style)', function () {
  assert.strictEqual(Songbook.deleteBtnClass(false), 'btn danger full'); // Delete progression
  assert.strictEqual(Songbook.deleteBtnClass(true), 'btn ghost full');   // Revert to original (non-destructive)
});

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

/* ---- S-SET-INTEGRITY (UAT U22): load-heal + defensive-nav pure helpers ---- */
test('pruneDanglingSetlist: drops entries the resolver reports missing, keeps the rest, returns the count removed', function () {
  var sl = ['k1', 'ghost1', 'k2', 'ghost2'];
  var real = { k1: true, k2: true };
  var removed = Songbook.pruneDanglingSetlist(sl, function (id) { return !!real[id]; });
  assert.strictEqual(removed, 2);
  assert.deepStrictEqual(sl, ['k1', 'k2']);
});
test('pruneDanglingSetlist: nothing dangling -> 0 removed, array unchanged', function () {
  var sl = ['k1', 'k2'];
  var removed = Songbook.pruneDanglingSetlist(sl, function () { return true; });
  assert.strictEqual(removed, 0);
  assert.deepStrictEqual(sl, ['k1', 'k2']);
});
test('pruneDanglingSetlist: mutates in place (keeps the array reference the queue/STATE hold)', function () {
  var sl = ['k1', 'ghost'];
  var ref = sl;
  Songbook.pruneDanglingSetlist(sl, function (id) { return id === 'k1'; });
  assert.strictEqual(sl, ref);
  assert.deepStrictEqual(sl, ['k1']);
});
test('pruneDanglingSetlist: non-array or non-function resolver is safe (returns 0, no throw)', function () {
  assert.strictEqual(Songbook.pruneDanglingSetlist(null, function () { return true; }), 0);
  assert.strictEqual(Songbook.pruneDanglingSetlist(['a'], null), 0);
});
test('skipNoticeText: singular for 1, plural for 2+', function () {
  assert.strictEqual(Songbook.skipNoticeText(1), '1 removed song skipped');
  assert.strictEqual(Songbook.skipNoticeText(2), '2 removed songs skipped');
  assert.strictEqual(Songbook.skipNoticeText(5), '5 removed songs skipped');
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
test('keySeedToken: canonical-sharp tonic, "m" for every minor-family mode, flat keys normalize', function () {
  assert.strictEqual(Songbook.keySeedToken('C', 'major'), 'C');
  assert.strictEqual(Songbook.keySeedToken('G', 'Major'), 'G');       // case-insensitive mode
  assert.strictEqual(Songbook.keySeedToken('A', 'minor'), 'Am');
  assert.strictEqual(Songbook.keySeedToken('D', 'dorian'), 'Dm');
  assert.strictEqual(Songbook.keySeedToken('E', 'phrygian'), 'Em');
  assert.strictEqual(Songbook.keySeedToken('F#', 'locrian'), 'F#m');
  assert.strictEqual(Songbook.keySeedToken('G', 'aeolian'), 'Gm');
  assert.strictEqual(Songbook.keySeedToken('G', 'mixolydian'), 'G');  // major-family, no suffix
  assert.strictEqual(Songbook.keySeedToken('Eb', 'major'), 'D#');     // flat root normalizes to sharp
  assert.strictEqual(Songbook.keySeedToken('Bb', 'minor'), 'A#m');
  assert.strictEqual(Songbook.keySeedToken('C', null), 'C');          // no mode -> treated as major
});
test('addAffordance: three-way Library "+" state - add / seed / blocked', function () {
  // hasSheet true short-circuits regardless of key - unchanged S-SETADD path.
  assert.strictEqual(Songbook.addAffordance({ key: 'C' }, true), 'add');
  assert.strictEqual(Songbook.addAffordance({}, true), 'add');
  // no sheet, but a key derivable -> S-SETADD-KEYSEED live +.
  assert.strictEqual(Songbook.addAffordance({ key: 'G', mode: 'major' }, false, Repertoire), 'seed');
  assert.strictEqual(Songbook.addAffordance({ key: 'A', mode: 'minor' }, false, Repertoire), 'seed');
  // no sheet, no key -> S-SETADD-EVIDENT ghost (#249), unchanged.
  assert.strictEqual(Songbook.addAffordance({}, false, Repertoire), 'blocked');
  assert.strictEqual(Songbook.addAffordance({ genre: 'rock' }, false, Repertoire), 'blocked');
  assert.strictEqual(Songbook.addAffordance(null, false, Repertoire), 'blocked');
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
 * BOTH the hidden attribute AND inline style.display. (Historical C1/C3 root
 * cause: songbook.css's old `.soloBackingBtn{display:block}` defeated the UA
 * [hidden] rule; F28/F29 renamed the class to `.soloRowBtn` with no display
 * rule, so the dual-set is now defensive.) renderKey() must run at INIT for
 * the first paint. */
test('solo-button gate pins hidden + inline display, and renderKey runs at init', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  assert.ok(/el\.soloBackingBtn\.hidden = !showSolo/.test(src), 'hidden-attribute half of the gate missing');
  assert.ok(/el\.soloBackingBtn\.style\.display = showSolo \? '' : 'none'/.test(src), 'inline-display half of the gate missing (defensive: guards a future display rule re-defeating [hidden])');
  var initM = /\/\/ first paint[\s\S]{0,200}renderKey\(\);/.test(src) || /renderKey\(\);\s*\/\/ init/.test(src) || /init[\s\S]{0,400}renderKey\(\)/i.test(src);
  assert.ok(initM, 'renderKey() init call not found');
  assert.ok(!/forceStarters/.test(src), 'forceStarters must stay removed');
  assert.ok(!/cHelp/.test(src), 'cHelp references must stay removed');
});

/* F28/F29 (UI-std): the Solo entry + the In-key|All toggle share ONE controls
 * row. Structural assertion (stronger than "the id exists somewhere"): both
 * #catChips and #soloBackingBtn must sit INSIDE the #chordCtrlRow div in the
 * real play/index.html, so a regression that moves the Solo button back out of
 * the row fails here. (codex PR #195 V1 Medium: prior pins were source-regex only.) */
test('F28/F29: #catChips and #soloBackingBtn are nested inside #chordCtrlRow (play/index.html)', function () {
  var fs = require('fs'), path = require('path');
  var html = fs.readFileSync(path.join(__dirname, '..', 'music', 'play', 'index.html'), 'utf8');
  var idAt = html.indexOf('id="chordCtrlRow"');
  assert.ok(idAt !== -1, '#chordCtrlRow container missing from play/index.html');
  var openTag = html.lastIndexOf('<div', idAt); // start of the container's own <div ...>
  // Walk div depth from the container open to find its matching </div>.
  var re = /<div\b|<\/div>/g; re.lastIndex = openTag;
  var depth = 0, end = -1, m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { if (--depth === 0) { end = m.index; break; } } else depth++;
  }
  assert.ok(end !== -1, 'could not find the closing </div> of #chordCtrlRow');
  var block = html.slice(openTag, end);
  assert.ok(/id="catChips"/.test(block), '#catChips (In-key|All toggle) must live inside #chordCtrlRow');
  assert.ok(/id="soloBackingBtn"/.test(block), '#soloBackingBtn (Solo entry) must live inside #chordCtrlRow');
});

/* F28 (UI-std) song-view half: the Solo entry (#soloOverBtn) is built dynamically
 * into the .practiceRow controls-row template (songbook.js), closure-bound so it's
 * source-pinned per the repo pattern (see the songbook.js DOM-render note ~767).
 * Asserts the button carries #soloOverBtn AND is concatenated into .practiceRow
 * before the row closes - a regression moving it out fails. (codex PR #195 V2 Medium) */
test('F28: song-view Solo (#soloOverBtn) is appended inside the .practiceRow row (songbook.js)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8');
  assert.ok(/soloRowBtn = canSolo \? '<button[^']*id="soloOverBtn"/.test(src), '#soloOverBtn definition (in soloRowBtn) missing');
  assert.ok(/'<div class="practiceRow">'[\s\S]{0,600}\+ soloRowBtn[\s\S]{0,40}\+ '<\/div>'/.test(src),
    'soloRowBtn (Solo) not appended inside the .practiceRow row before its close - F28 song-view move regressed');
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
  // Window widened 900->1100 (F31) ->1400 (S-CLEAR-INKEY, 2026-07-10). S-SONG-MODE
  // UAT-2 extracted the handler body into clearProgression() (so the Song
  // canvas's "Build the chords" shares the exact guarded path) - the contract
  // now pins THAT function, plus the button's delegation to it.
  var clearBlock = /function clearProgression\(bannerMsg\) \{[\s\S]{0,1400}?\n    \}/.exec(src);
  assert.ok(clearBlock, 'clearProgression() not found');
  assert.ok(/el\.cClear\.onclick = function \(\) \{ clearProgression\(\); \}/.test(src), 'the Clear button must delegate to clearProgression()');
  assert.ok(/buildClearSnapshot\(progression, cTpose, songKey, savedComposeId\)/.test(clearBlock[0]), 'Clear must snapshot the full pre-Clear state before wiping it');
  assert.ok(/showClearUndoBanner\(bannerMsg\)/.test(clearBlock[0]), 'Clear must show the persistent undo banner (with the optional caller message - UAT r2)');
  assert.ok(/hideComposeToast\(\)/.test(clearBlock[0]), 'F31 (UAT): Clear must also end a still-showing save-confirmation toast (Clear does not route through invalidateClearUndo)');
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
    // S-SET-INTEGRITY (UAT U22): Toast.wirePauseOnTouch's teardown() calls
    // el.removeEventListener on its own host el (not just document - see the
    // document-level stub above for the touchend/pointerup listeners it also
    // removes). A no-op is correct here: this stub's addEventListener never
    // actually needs cleanup for these tests (no test simulates the
    // touchstart/pointerdown pause gesture), so nothing needs untracking.
    removeEventListener: function () {},
    // UAT U6/U7 (2026-07-04): both spy-recording, purely additive - no
    // existing test reads _focusCalls/_scrollCalls, so this can't regress
    // anything already passing. focus() records a call count (U7: "focus
    // lands in the dialog"); scrollIntoView() records each call's opts (U6:
    // the quality-filter scroll anchor) - neither exists on a real DOM
    // element by default here, so callers must guard-check before use.
    focus: function () { e._focusCalls = (e._focusCalls || 0) + 1; },
    scrollIntoView: function (opts) { e._scrollCalls = (e._scrollCalls || []); e._scrollCalls.push(opts); },
    click: function () { if (e.onclick) e.onclick(); },
    // S-SET-INTEGRITY (UAT U22): safe no-ops, not real HTML parsing. This
    // stub's innerHTML setter never actually parses markup into children (see
    // below), so a real querySelector/querySelectorAll can't resolve anything
    // meaningful here anyway. list-item.js's ListItem.render() (called by
    // renderSongs()/renderSetlist(), which S-SET-INTEGRITY's tests are the
    // first in this file to actually exercise) already guards every
    // querySelector/querySelectorAll result defensively (`if (body && ...)`,
    // `.forEach` on the returned array) - so null/[] here is a correct,
    // crash-free stand-in, not a semantic claim about what would match on a
    // real DOM. Purely additive: no existing test calls these on a stub el.
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(e.attrs, k) ? e.attrs[k] : null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
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
    querySelectorAll: function () { return []; },
    // S-SET-INTEGRITY (UAT U22): Toast.wirePauseOnTouch (toast.js) listens at
    // the document level for touchend/pointerup ("releasing outside resumes"
    // - see toast.js's header comment). Safe no-ops - no test drives the
    // pause/resume touch gesture itself, only the Undo button's onclick.
    addEventListener: function () {},
    removeEventListener: function () {}
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
  assert.strictEqual(toast.textContent, 'Saved to your Library');
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
  assert.notStrictEqual(toast.textContent, 'Saved to your Library', 'must never claim success on a write that threw');
  assert.strictEqual(warned, 1, 'safeSet must console.warn exactly once for this key, not spam per attempt');
});

test('A1: the update-in-place branch ("Updated ...") is equally truthful on a throwing store, and warns only once per key', function () {
  var m = mountForSaveTests();
  // First save succeeds (healthy store) - links savedComposeId so a second Save
  // on the same buffer takes the update-in-place branch (not a fresh create).
  buildAndSave(m);
  assert.strictEqual(findComposeToast(m).textContent, 'Saved to your Library');
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
 * saveProgression's showComposeToast(...). Before the toast.js extraction,
 * showComposeToast's clearTimeout(toastTimer) silently killed the Library
 * toast's pending auto-hide via the shared `var toastTimer` both functions
 * used to declare in Songbook.mount()'s closure - leaving "Added to setlist"
 * stuck on-screen forever (the operator's screenshot). This drives that
 * exact call sequence with a fake clock (no real 1600ms wait) and proves the
 * Library toast's auto-hide still fires. F31 (UAT) dropped persist:true from
 * the Save-confirmation call - the Compose toast now schedules its OWN
 * 3000ms auto-hide timer too (see the two F31 tests right below this one for
 * that half of the contract); this test's job stays the ORIGINAL U9
 * regression - the two hosts' timers are fully independent either way.
 * ===================================================================== */
test('S-TOAST/U9: the Library "Added to setlist" toast still auto-hides on schedule even though a Compose toast fires in the same tick', function () {
  var nextId = 1, scheduled = {}, cleared = [];
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { cleared.push(id); delete scheduled[id]; };
  var m;
  try {
    m = mountForSaveTests();
    buildAndSaveAddToSetlist(m); // toggleSet's showToast, THEN showComposeToast() - same tick
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
  var libraryToast = findPlainToast();
  var composeToast = findComposeToast(m);
  assert.ok(libraryToast, 'expected the Library .toast element in document.body');
  assert.strictEqual(libraryToast.textContent, 'Added to setlist');
  assert.ok(composeToast, 'expected the Compose .composeToast element');
  assert.strictEqual(composeToast.textContent, 'Saved to your Library');
  // buildAndSaveAddToSetlist also taps a chord tile twice on the way in, and
  // each tap schedules its OWN unrelated 220ms "sel" class-removal timer
  // (songbook.js's chord-tile tap animation, nothing to do with toasts) - so
  // total scheduled count is noisy. Isolate by duration instead: the Library
  // toast's own 1600ms auto-hide must be the ONLY 1600ms-duration timer, and
  // (F31) the Compose toast must have scheduled EXACTLY ONE 3000ms timer of
  // its own (no persist:true means it's no longer stranded with none at all).
  var byDuration = {};
  Object.keys(scheduled).forEach(function (id) {
    var ms = scheduled[id].ms;
    byDuration[ms] = (byDuration[ms] || []).concat([Number(id)]);
  });
  assert.strictEqual((byDuration[1600] || []).length, 1, 'exactly one pending 1600ms auto-hide timer (the Library toast\'s)');
  assert.strictEqual((byDuration[3000] || []).length, 1, 'F31: the Compose Save-confirmation toast must schedule its OWN 3000ms auto-hide timer (no persist:true)');
  assert.strictEqual(libraryToast.classList.contains('on'), true, 'Library toast is visible immediately after showToast()');
  assert.strictEqual(composeToast.hidden, false, 'Compose toast is visible immediately after showComposeToast()');
  // Fire the Library toast's own scheduled auto-hide (simulates the real
  // 1600ms elapsing) - this is the assertion that FAILED before the fix
  // (the timer had already been silently cancelled and would never fire).
  var id = byDuration[1600][0];
  scheduled[id].cb();
  assert.strictEqual(libraryToast.classList.contains('on'), false, 'Library toast must auto-hide once its own timer elapses - the U9 regression');
  // The Compose toast must remain completely untouched by the Library toast's
  // own hide - the two hosts are fully independent (toast.js's per-host Map).
  assert.strictEqual(composeToast.hidden, false, 'Compose toast must stay visible - unaffected by the unrelated Library toast auto-hiding');
});

/* =====================================================================
 * F31 (UAT): the save confirmation must be an auto-dismissing toast (no
 * persist:true) AND must never linger across a new-progression/Clear action -
 * operator repro: saved, started building a NEW progression, the PREVIOUS
 * save's confirmation was still on screen. Two halves, two tests: (1) the
 * toast auto-dismisses on its own after the normal 3000ms window even with
 * zero further user action; (2) Clear (which does not route through
 * invalidateClearUndo - it's what CREATES the undo snapshot) explicitly ends
 * a still-showing confirmation via hideComposeToast().
 * ===================================================================== */
test('F31: the Compose save-confirmation toast auto-dismisses on its own scheduled timer (no persist:true stranding it forever)', function () {
  var nextId = 1, scheduled = {};
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { delete scheduled[id]; };
  var m, composeToast;
  try {
    m = mountForSaveTests();
    buildAndSave(m);
    composeToast = findComposeToast(m);
    assert.strictEqual(composeToast.hidden, false, 'toast visible immediately after Save');
    var timerId = null;
    Object.keys(scheduled).forEach(function (id) { if (scheduled[id].ms === 3000) timerId = id; });
    assert.ok(timerId, 'expected a scheduled 3000ms auto-hide timer for the Save confirmation');
    scheduled[timerId].cb(); // simulate the real 3000ms elapsing
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
  assert.strictEqual(composeToast.hidden, true, 'the Save confirmation must auto-dismiss once its own timer elapses');
});

test('F31: Clear ends a still-showing save-confirmation toast immediately (hideComposeToast), rather than leaving it stranded over the fresh canvas', function () {
  // cClear.onclick is wired at mount time against el.cClear - mountForSaveTests'
  // elMap doesn't include it (a Save-only harness), so mount directly here with
  // cClear present too.
  global.localStorage = lsReset.fakeStore();
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = { prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'), cSave: makeStubEl('button'), cClear: makeStubEl('button') };
  var ctrl = Songbook.mount({ storagePrefix: 'a1clear', el: elMap });
  var m = { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
  buildAndSave(m);
  var composeToast = findComposeToast(m);
  assert.strictEqual(composeToast.hidden, false, 'sanity: the save confirmation is showing before Clear');
  elMap.cClear.onclick();
  assert.strictEqual(composeToast.hidden, true, 'F31: Clear must hide a still-showing save-confirmation toast (hideComposeToast, not just invalidateClearUndo)');
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

/* ---------- progStripMode (S-PROG-WRAP-2, UAT U8b): COUNT-driven staged
 * density ladder - full diagram cards (1-4) -> one-row compact tokens (5-6)
 * -> a fixed 6-per-row compact grid (7-12, so 12 = two clean rows of 6).
 * Measured width is consulted only as a GUARD for pathological narrow
 * viewports (demotes one stage early rather than let a stage's natural
 * minimum size get squeezed) - it can never PROMOTE back up past the
 * count-driven candidate. Supersedes S-PROG-WRAP's pure width-driven binary
 * full/compact split (see D-PROG-WRAP, amended). ---------- */
test('progStripMode: count alone picks the stage when width is generous - the ladder boundaries', function () {
  assert.strictEqual(Songbook.progStripMode(1, 84, 8, 2000), 'full');
  assert.strictEqual(Songbook.progStripMode(4, 84, 8, 2000), 'full');
  assert.strictEqual(Songbook.progStripMode(5, 84, 8, 2000), 'fill-row');
  assert.strictEqual(Songbook.progStripMode(6, 84, 8, 2000), 'fill-row');
  assert.strictEqual(Songbook.progStripMode(7, 84, 8, 2000), 'grid6');
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, 2000), 'grid6');
});
test('progStripMode: 0 chords is always full - nothing to lay out, regardless of width', function () {
  assert.strictEqual(Songbook.progStripMode(0, 84, 8, 10), 'full');
});
test('progStripMode: a too-narrow strip demotes the full stage one step early (to fill-row) rather than shrink the diagram cards', function () {
  // 4 cards x 84 + 3 gaps x 8 = 336 + 24 = 360 (overflows a 300px strip);
  // 4 compact tokens x 58 + 3 gaps x 8 = 232 + 24 = 256 (fits 300) -> fill-row, not grid6
  assert.strictEqual(Songbook.progStripMode(4, 84, 8, 300), 'fill-row');
});
test('progStripMode: the full-stage width-guard boundary is exclusive - an exact fit stays full', function () {
  assert.strictEqual(Songbook.progStripMode(3, 84, 8, 3 * 84 + 2 * 8), 'full');
  assert.strictEqual(Songbook.progStripMode(3, 84, 8, 3 * 84 + 2 * 8 - 1), 'fill-row');
});
test('progStripMode: an impossibly narrow strip cascades both guards in one call - a full candidate can demote all the way to grid6', function () {
  // 4 cards never fit (360 > 50) -> fill-row; 4 tokens never fit either (256 > 50) -> grid6
  assert.strictEqual(Songbook.progStripMode(4, 84, 8, 50), 'grid6');
});
test('progStripMode: the fill-row-stage width-guard boundary is exclusive too', function () {
  // 5 tokens x 58 + 4 gaps x 8 = 290 + 32 = 322
  assert.strictEqual(Songbook.progStripMode(5, 84, 8, 322), 'fill-row');
  assert.strictEqual(Songbook.progStripMode(5, 84, 8, 321), 'grid6');
});
test('progStripMode: grid6 is the floor stage - no further demotion even at an impossibly narrow width', function () {
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, 1), 'grid6');
});
test('progStripMode: an unmeasured strip (availW <= 0, e.g. before first layout) never demotes - the count-driven candidate stands', function () {
  assert.strictEqual(Songbook.progStripMode(4, 84, 8, 0), 'full');
  assert.strictEqual(Songbook.progStripMode(5, 84, 8, -5), 'fill-row');
  assert.strictEqual(Songbook.progStripMode(12, 84, 8, 0), 'grid6');
});
test('progStripMode: an unmeasured card width (cardW <= 0, e.g. the probe was unavailable) never demotes either', function () {
  assert.strictEqual(Songbook.progStripMode(4, 0, 8, 10), 'full');
  assert.strictEqual(Songbook.progStripMode(12, 0, 8, 10), 'grid6');
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
  assert.deepStrictEqual(Songbook.soloChipScale('D', 'Minor', 'mode'), Circle.scaleInKey('D', 'aeolian'));
  assert.deepStrictEqual(Songbook.soloChipScale('G', 'Mixolydian', 'mode'), Circle.scaleInKey('G', 'mixolydian'));
  assert.deepStrictEqual(Songbook.soloChipScale('E', 'Dorian', 'mode'), Circle.scaleInKey('E', 'dorian'));
});
test('soloChipScale: pentMajor/pentMinor/blues chips read Circle.soloScale directly, independent of the key mode', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'pentMajor'), Circle.soloScaleInKey('A', 'pentMajor', 'major'));
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'pentMinor'), Circle.soloScaleInKey('A', 'pentMinor', 'major'));
  assert.deepStrictEqual(Songbook.soloChipScale('A', 'Major', 'blues'), Circle.soloScaleInKey('A', 'blues', 'major'));
});
test('soloChipScale: the mode chip on a BLUES key IS the 6-note blues scale (why the Blues-key row dedupes the standalone Blues chip)', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('C', 'Blues', 'mode'), Circle.soloScaleInKey('C', 'blues', 'major'));
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
    assert.deepStrictEqual(Songbook.soloChipScale(root, 'Blues', 'mixolydian'), Circle.scaleInKey(root, 'mixolydian'));
  });
});
test('soloChipScale: mixolydian chip is independent of keyMode, like the other non-mode chips', function () {
  assert.deepStrictEqual(Songbook.soloChipScale('E', 'Major', 'mixolydian'), Circle.scaleInKey('E', 'mixolydian'));
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
// S-REL-NAMES (U23): the optional 2nd arg (the key-view's own root) names the
// concrete relative-key instance in the caption text, same as the Practice
// Studio's renderGuide/select() call sites (tracks.js).
test('soloChipCaption: a root NAMES the relative minor instance (pentMajor caption)', function () {
  assert.strictEqual(Songbook.soloChipCaption('pentMajor', 'F'),
    SoloGuide.framing('pentMajor', Circle.soloScaleInfo('pentMajor').family, 'F'));
  assert.ok(/D minor pent/.test(Songbook.soloChipCaption('pentMajor', 'F')), Songbook.soloChipCaption('pentMajor', 'F'));
});
test('soloChipCaption: absent root degrades to the pre-S-REL-NAMES relationship-only wording (byte-identical to the no-root call)', function () {
  assert.strictEqual(Songbook.soloChipCaption('pentMajor'), Songbook.soloChipCaption('pentMajor', undefined));
  assert.ok(/the relative minor pent/.test(Songbook.soloChipCaption('pentMajor')), Songbook.soloChipCaption('pentMajor'));
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
  // Compose now defaults to C major -> In-key view (D-DEFAULT-C, 2026-07-10), so the
  // All-view catTabRow is reached by one segment tap. That tap is an UNFLAGGED render
  // (no anchorFilterRow) - it must still not scroll-anchor.
  m.elMap.catChips.children[0].children[1].onclick(); // In-key|All seg -> 'All'
  var row = findTabRow(m);
  assert.ok(row, 'expected the All-view catTabRow to render');
  assert.ok(!row._scrollCalls || row._scrollCalls.length === 0, 'an unflagged All render must not scroll-anchor');
});

test('U6: tapping a quality-filter chip re-renders catTabRow AND scroll-anchors it to the top of the visible area', function () {
  var m = mountForGridTests();
  m.elMap.catChips.children[0].children[1].onclick(); // In-key|All seg -> 'All' (default is now In-key, D-DEFAULT-C)
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

/* =====================================================================
 * F30 (UAT): "we need a label directly above the suggested chords" - the old
 * "the panel's own 'Next chord' summary already says it" rationale left the
 * suggest row COMPLETELY unlabeled past the 4th chord (no such summary
 * actually exists anywhere on screen). A label must render at every count.
 * ===================================================================== */
function suggLbl(m) {
  var lbl = null;
  m.elMap.suggest.children.forEach(function (c) { if (c.className === 'suggLbl') lbl = c; });
  return lbl;
}
test('F30: renderSuggest labels the suggested-chords row at every progression length, including past the 4th chord', function () {
  var m = mountForGridTests();
  function tap() { m.elMap.buildGrid.children[0].onclick(); }
  tap(); // 1 chord
  assert.strictEqual(suggLbl(m).textContent, 'Add a 2nd chord:');
  tap(); // 2 chords
  assert.strictEqual(suggLbl(m).textContent, 'Add a 3rd chord:');
  tap(); // 3 chords
  assert.strictEqual(suggLbl(m).textContent, 'Add a 4th chord:');
  tap(); // 4 chords - F30's exact gap: this used to render NO label at all
  var lbl = suggLbl(m);
  assert.ok(lbl, 'F30: a label must render above the suggested chords past the 4th chord too');
  assert.strictEqual(lbl.textContent, 'Next chord');
  tap(); // 5 chords - stays labeled, not just a one-time fix at exactly 4
  assert.strictEqual(suggLbl(m).textContent, 'Next chord');
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

// S-POSTPROG-FLOW (operator UAT 2026-07-10): a dismiss gesture must CANCEL (stay on
// Compose), never navigate into the Studio. The old "backdrop/Escape = Skip = open
// Studio" behavior was the "can't cancel out of Solo" trap - these now assert the fix.
test('U7: backdrop tap CANCELS the solo-choice modal (a dismiss must not navigate to the Studio)', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  findComposeBackdrop(m).onclick();
  assert.strictEqual(picks.length, 0, 'a dismiss must NOT open the Studio - it cancels, keeping the progression (S-POSTPROG-FLOW fix)');
  assert.strictEqual(findComposeRow(m).hidden, true, 'the modal must be torn down after cancel');
  assert.strictEqual(findComposeBackdrop(m).hidden, true, 'the backdrop must be re-hidden after cancel');
});

test('U7: Escape CANCELS the solo-choice modal (no Studio navigation)', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  findComposeRow(m).onkeydown({ key: 'Escape' });
  assert.strictEqual(picks.length, 0, 'Escape cancels - it must not open the Studio');
  assert.strictEqual(findComposeRow(m).hidden, true, 'the modal must be torn down after cancel');
});

test('U7: the visible Cancel button dismisses without navigating (discoverable escape hatch)', function () {
  var picks = [];
  var m = mountForSoloChoiceTests(function (target) { picks.push(target); });
  startSoloChoice(m);
  var btnRow = findComposeRow(m).children[1]; // [msg, btnRow]
  btnRow.children[2].onclick(); // [Save & open Studio, Skip, Cancel] - Cancel
  assert.strictEqual(picks.length, 0, 'Cancel must not open the Studio');
  assert.strictEqual(findComposeRow(m).hidden, true, 'the modal must be torn down after Cancel');
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
 * S-PROG-WRAP-2 (2026-07-04, UAT U8b) - staged density ladder.
 * progStripMode's pure-fn coverage (the count-driven stage + width-guard
 * demotion) lives above, near COMPOSE_MAX. These are the DOM-level checks
 * the pure fn can't cover on its own: does renderProg actually build the
 * right markup per stage (diagram cards vs compact tokens, grid column
 * count), does the existing .rm remover still work in every stage, and does
 * the stage re-derive correctly as the progression grows/shrinks across a
 * boundary.
 *
 * Node has no real layout engine, so these tests assert the STRUCTURAL
 * contract only (stage class, child count, inline grid-template-columns
 * presence/absence) - not literal rendered row counts. The visual claim
 * ("11 chords is a clean 6+5, never a 3rd row") is confirmed live via
 * Playwright (see the PR's manual test plan), not here.
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
  // M-13 SONG BUILDER self-injects its tray into el.prog.parentNode (wrapper) -
  // find the injected nodes by class (the same DOM-stub-walk the compose tests use).
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

// Tap the first "All chords" tile (the C major tile - deterministic, per
// buildGrid's default 'all' view + Major-first CATS ordering) N times to
// build an N-chord progression without depending on a named starter's exact
// length (no PROGRESSIONS entry is 5, 6, 7, or 11 chords long). Content
// (all-C) doesn't matter for these structural/layout assertions - count and
// DOM shape are what's under test.
function tapChords(m, n) {
  var tile = m.elMap.buildGrid.children[0];
  for (var i = 0; i < n; i++) tile.onclick();
}
function stageClasses(prog) {
  return ['full', 'fill-row', 'grid6'].filter(function (c) { return prog.classList.contains(c); });
}

test('S-PROG-WRAP-2: 1-4 chords render as full diagram cards (stage "full"), fill-row/grid6 absent', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000; // plenty of room
  loadStarterByName(m, 'Three-chord rock'); // C F G
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['full']);
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, '', 'full stage is flexbox - no grid-template-columns needed');
  assert.strictEqual(m.elMap.prog.children.length, 3);
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(slot.children.some(function (c) { return c.className === 'chord'; }), 'full stage must render the diagram .chord element');
    assert.ok(!slot.children.some(function (c) { return c.className === 'suggChip'; }), 'full stage must not use the compact suggChip token');
  });
});

test('S-PROG-WRAP-2: 5 chords render compact tokens in a ONE-ROW grid sized to the exact count (stage "fill-row")', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 5);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['fill-row']);
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, 'repeat(5, 1fr)');
  assert.strictEqual(m.elMap.prog.children.length, 5);
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(!slot.children.some(function (c) { return c.className === 'chord'; }), 'fill-row must not render the diagram element');
    assert.ok(slot.children.some(function (c) { return c.className === 'suggChip'; }), 'expected the existing suggChip token, reused verbatim (not a 4th chip variant)');
  });
});

test('S-PROG-WRAP-2: 6 chords - the ladder\'s upper fill-row boundary - still one row, grid sized to 6', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 6);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['fill-row']);
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, 'repeat(6, 1fr)');
});

test('S-PROG-WRAP-2: 7 chords cross into the FIXED 6-column grid (stage "grid6"), not fill-row', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 7);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['grid6']);
  // grid6 is a FIXED 6 columns (CSS-only) regardless of the actual count - no
  // inline gridTemplateColumns override, unlike fill-row.
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, '');
  assert.strictEqual(m.elMap.prog.children.length, 7);
});

test('S-PROG-WRAP-2: 11 chords (the operator-reported 5+5+1 orphan-row bug) stay in the fixed 6-col grid - no per-count column override that could reintroduce an odd row split', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 11);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['grid6']);
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, '', 'grid6\'s 6 columns come from static CSS, never a JS-computed count - the fixed track list is what guarantees a clean 6+5, not a 5+5+1');
  assert.strictEqual(m.elMap.prog.children.length, 11);
});

test('S-PROG-WRAP-2: 12 chords (the COMPOSE_MAX cap) is exactly two clean rows of 6', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 12);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['grid6']);
  assert.strictEqual(m.elMap.prog.children.length, 12);
});

test('S-PROG-WRAP-2: removing a chord from a compact slot (the x button) still works in fill-row and grid6', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 7); // grid6
  var rm7 = m.elMap.prog.children[0].children.filter(function (c) { return c.className === 'rm'; })[0];
  assert.ok(rm7, 'expected the remove (x) button on a grid6 slot');
  // S-DELETE-UNDO: the first tap only ARMS the remover (protection); the
  // progression must be UNCHANGED until the second tap confirms.
  tapWired(rm7);
  assert.strictEqual(m.elMap.prog.children.length, 7, 'first tap arms - it must NOT delete');
  tapWired(rm7);
  assert.strictEqual(m.elMap.prog.children.length, 6, 'removing from a grid6 slot must shrink the progression by one');
  var rm6 = m.elMap.prog.children[0].children.filter(function (c) { return c.className === 'rm'; })[0];
  assert.ok(rm6, 'expected the remove (x) button on a fill-row slot');
  tapWired(rm6); tapWired(rm6); // arm + confirm
  assert.strictEqual(m.elMap.prog.children.length, 5, 'removing from a fill-row slot must shrink the progression by one');
});

test('S-PROG-WRAP-2: removing chords crosses stage boundaries downward - grid6 -> fill-row -> full', function () {
  var m = mountForProgWrapTests();
  m.elMap.prog.clientWidth = 1000;
  tapChords(m, 7);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['grid6']);
  function removeFirst() {
    var rm = m.elMap.prog.children[0].children.filter(function (c) { return c.className === 'rm'; })[0];
    tapWired(rm); tapWired(rm); // S-DELETE-UNDO: arm, then confirm
  }
  removeFirst(); // 6 left
  assert.strictEqual(m.elMap.prog.children.length, 6);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['fill-row'], '6 chords must flip back to fill-row');
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, 'repeat(6, 1fr)');
  removeFirst(); removeFirst(); // 4 left
  assert.strictEqual(m.elMap.prog.children.length, 4);
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['full'], '4 chords must flip back to full diagram cards');
  assert.strictEqual(m.elMap.prog.style.gridTemplateColumns, '');
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(slot.children.some(function (c) { return c.className === 'chord'; }), 'must render the diagram element again after flipping back to full');
    assert.ok(!slot.children.some(function (c) { return c.className === 'suggChip'; }), 'must not still show the compact token after flipping back to full');
  });
});

test('S-PROG-WRAP-2: a too-narrow strip demotes the full stage early (width guard) rather than shrinking the diagram cards', function () {
  var m = mountForProgWrapTests();
  // 4 cards x 84 + 3 gaps x 8 = 360 (overflows 300); 4 tokens x 58 + 3 gaps x 8 = 256 (fits 300)
  m.elMap.prog.clientWidth = 300;
  loadStarterByName(m, '4-chord song'); // C G Am F
  assert.deepStrictEqual(stageClasses(m.elMap.prog), ['fill-row'], 'a too-narrow strip must demote rather than shrink the diagram cards');
  assert.strictEqual(m.elMap.prog.children.length, 4);
  m.elMap.prog.children.forEach(function (slot) {
    assert.ok(slot.children.some(function (c) { return c.className === 'suggChip'; }));
  });
});

/* =====================================================================
 * S-SET-INTEGRITY (UAT U22) - delete-heal TOAST+ACTION undo.
 * ---------------------------------------------------------------------
 * deleteCustomItem/showDeleteUndoBanner are private closures - reachable
 * only through a real Songbook.mount(). Library/Setlist rendering
 * (renderSongs/renderSetlist/renderFilterChips) never calls querySelector
 * (only insertBefore/appendChild/textContent - see makeStubEl), so the
 * existing minimal stub-document harness (mountForSaveTests's approach)
 * covers this without needing the fuller DOM a Practice/Stage queue-nav
 * test would require - that surface is covered live (Playwright) + at the
 * algorithm level (test/queue.test.js's stepResolvable suite) instead.
 * ===================================================================== */
function mountForSetIntegrityTests(opts) {
  opts = opts || {};
  var seed = {};
  if (opts.customSongs) seed['settest.custom.v1'] = JSON.stringify(opts.customSongs);
  if (opts.setlist) seed['settest.setlist.v1'] = JSON.stringify(opts.setlist);
  global.localStorage = lsReset.fakeStore(seed);
  var songsList = makeStubEl('div'), libSongs = makeStubEl('div');
  libSongs.appendChild(songsList); // songsList must be libSongs' CHILD (delete-undo banner's insertBefore target)
  var setBody = makeStubEl('div'), setWrapper = makeStubEl('div');
  setWrapper.appendChild(setBody); // setBody.parentNode must exist (ensureSetUndoBanner + ensureDelUndoBanner mirror this contract)
  var elMap = {
    libSongs: libSongs, songsList: songsList, libCount: makeStubEl('div'),
    setBody: setBody, setBar: makeStubEl('div'), setCount: makeStubEl('div'),
    setClear: makeStubEl('button'), setEdit: makeStubEl('button'), performBtn: makeStubEl('button')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'settest', el: elMap, songs: opts.catalog || [] });
  return { ctrl: ctrl, elMap: elMap };
}
function findDelUndoBanner(m) {
  var found = null;
  m.elMap.libSongs.children.forEach(function (c) { if (c.className === 'setUndo toastAction') found = c; });
  return found;
}

test('S-SET-INTEGRITY: deleting a SETLISTED custom song says so, prunes the setlist, and heals the active queue/current', function () {
  var m = mountForSetIntegrityTests({
    customSongs: [
      { id: 'm1', t: 'Song A', a: '', y: 2026, d: 'Mine', custom: true, seq: ['C', 'G'] },
      { id: 'm2', t: 'Song B', a: '', y: 2026, d: 'Mine', custom: true, seq: ['D', 'A'] },
      { id: 'm3', t: 'Song C', a: '', y: 2026, d: 'Mine', custom: true, seq: ['E', 'B'] }
    ],
    setlist: ['m1', 'm2', 'm3']
  });
  m.ctrl.openSong('m2', ['m1', 'm2', 'm3']); // open the middle song into the setlist's queue (STATE.current = m2)
  m.ctrl.deleteCustomItem('m2');
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1', 'm3'], 'the deleted id must be pruned from the setlist immediately');
  assert.ok(!m.ctrl.getSongs().some(function (s) { return s.id === 'm2'; }), 'the deleted song must no longer resolve via ALLSONGS');
  assert.strictEqual(m.ctrl.getState().current, null, 'STATE.current must clear when the song it pointed at was deleted (D3s)');
  var banner = findDelUndoBanner(m);
  assert.ok(banner, 'a delete-undo banner must be inserted into the Library screen');
  assert.strictEqual(banner.hidden, false);
  assert.strictEqual(banner.children[0].textContent, 'Deleted Song B - also removed from your setlist',
    'the outcome message must truthfully say the song was setlisted (singular "your setlist" - this app has exactly one Jam setlist per profile)');
});

test('S-SET-INTEGRITY: Undo restores BOTH the item and its exact setlist position', function () {
  var m = mountForSetIntegrityTests({
    customSongs: [
      { id: 'm1', t: 'Song A', a: '', y: 2026, d: 'Mine', custom: true, seq: ['C', 'G'] },
      { id: 'm2', t: 'Song B', a: '', y: 2026, d: 'Mine', custom: true, seq: ['D', 'A'] },
      { id: 'm3', t: 'Song C', a: '', y: 2026, d: 'Mine', custom: true, seq: ['E', 'B'] }
    ],
    setlist: ['m1', 'm2', 'm3']
  });
  m.ctrl.deleteCustomItem('m2');
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1', 'm3']);
  var banner = findDelUndoBanner(m);
  var undoBtn = banner.children[1];
  assert.strictEqual(undoBtn.textContent, 'Undo');
  undoBtn.onclick();
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1', 'm2', 'm3'], 'Undo must reinsert m2 at its ORIGINAL index (1), not append it at the end');
  assert.ok(m.ctrl.getSongs().some(function (s) { return s.id === 'm2'; }), 'Undo must restore the custom song record itself');
  // Persisted, not just in-memory - a page reload must see the restored state too.
  assert.deepStrictEqual(JSON.parse(global.localStorage.getItem('settest.setlist.v1')), ['m1', 'm2', 'm3']);
  assert.ok(JSON.parse(global.localStorage.getItem('settest.custom.v1')).some(function (cs) { return cs.id === 'm2'; }));
});

test('S-SET-INTEGRITY: deleting a NON-setlisted custom song omits the "also removed" clause, and Undo never touches the setlist', function () {
  var m = mountForSetIntegrityTests({
    customSongs: [{ id: 'm1', t: 'Lonely Song', a: '', y: 2026, d: 'Mine', custom: true, seq: ['C'] }],
    setlist: []
  });
  m.ctrl.deleteCustomItem('m1');
  var banner = findDelUndoBanner(m);
  assert.strictEqual(banner.children[0].textContent, 'Deleted Lonely Song', 'no setlist clause when the song was never setlisted');
  banner.children[1].onclick(); // Undo
  assert.deepStrictEqual(m.ctrl.getState().setlist, [], 'Undo on a never-setlisted item must leave an empty setlist empty, not fabricate an entry');
  assert.ok(m.ctrl.getSongs().some(function (s) { return s.id === 'm1'; }));
});

test('S-SET-INTEGRITY: fork-revert ("Delete" on a fork) messages "Reverted", and Undo puts the fork id back where the catalog id now sits', function () {
  var m = mountForSetIntegrityTests({
    catalog: [{ t: 'Original Song', a: 'Some Artist', y: 2020, d: '20s', seq: ['C', 'G'] }], // -> k0
    customSongs: [{ id: 'm1', t: 'Original Song', a: 'Some Artist', y: 2020, d: 'Mine', custom: true, forkOf: 'k0', seq: ['C', 'G', 'Am'] }],
    setlist: ['m1'] // the fork already shadows k0's setlist slot (as if createCustomItem's own remapSetlist had run earlier)
  });
  m.ctrl.deleteCustomItem('m1');
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['k0'], 'reverting a fork REPLACES the slot with the catalog id - never removes it');
  var banner = findDelUndoBanner(m);
  assert.strictEqual(banner.children[0].textContent, 'Reverted Original Song to the original',
    'a fork revert is not a deletion - the message must say so, with no "also removed" clause (the set did not shrink)');
  banner.children[1].onclick(); // Undo
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1'], 'Undo must put the fork id back where the catalog id now sits');
  assert.ok(m.ctrl.getSongs().some(function (s) { return s.id === 'm1' && s.forkOf === 'k0'; }), 'the fork record itself must be restored');
});

test('S-SET-INTEGRITY: Undo on a throwing (quota-exceeded) store shows the truthful SAVE_FAIL_MSG, never a silent success', function () {
  var m = mountForSetIntegrityTests({
    customSongs: [{ id: 'm1', t: 'Song A', a: '', y: 2026, d: 'Mine', custom: true, seq: ['C'] }],
    setlist: ['m1']
  });
  m.ctrl.deleteCustomItem('m1');
  var banner = findDelUndoBanner(m);
  var warned = 0;
  var origWarn = console.warn;
  console.warn = function () { warned++; };
  global.localStorage.setItem = function () {
    var e = new Error('The quota has been exceeded.');
    e.name = 'QuotaExceededError';
    throw e;
  };
  try {
    banner.children[1].onclick(); // Undo - both saveCustom() and saveSet() now throw
  } finally {
    console.warn = origWarn;
  }
  // The in-memory restore still happens (matches saveProgression/D-SAVE-TRUTH: the
  // attempt is truthful about PERSISTENCE, not about whether the UI state changed).
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1']);
  // showToast (the Library "Added to setlist"/failure toast host, S-TOAST)
  // lazily appends its ONE shared toast element to document.body - a
  // different host than delUndoBanner (el.libSongs), so no timer/host
  // collision between the two (toast.js's per-host Map, see its header).
  var libToast = null;
  global.document.body.children.forEach(function (c) { if (c.className && c.className.indexOf('toast') === 0) libToast = c; });
  assert.ok(libToast, 'a failure must surface via the Library toast host (a different host than the delete-undo banner)');
  assert.strictEqual(libToast.textContent, "Couldn't save - storage is full or blocked. Export a backup from Settings.");
  assert.ok(warned >= 1, 'safeSet must console.warn on the failed write');
});

test('S-SET-INTEGRITY (load-heal): a setlist persisted with a dangling ref (pre-fix data, or a restored old backup) is pruned on mount, silently and before the first render', function () {
  var m = mountForSetIntegrityTests({
    customSongs: [{ id: 'm1', t: 'Song A', a: '', y: 2026, d: 'Mine', custom: true, seq: ['C'] }],
    // 'ghost' was never a real custom/catalog id - simulates a dangling ref that
    // slipped past delete-heal (e.g. from before this fix existed, or a restore).
    setlist: ['m1', 'ghost']
  });
  assert.deepStrictEqual(m.ctrl.getState().setlist, ['m1'], 'the dangling ref must be pruned by mount time, before any render');
  assert.deepStrictEqual(JSON.parse(global.localStorage.getItem('settest.setlist.v1')), ['m1'], 'the heal must persist, not just live in memory');
});

// ===================================================================
// M-13 SONG BUILDER - the section buffer -> multi-section song.
// ===================================================================

// --- Pure assemble mapping (buildSongFromSections) ---
test('M-13: assemble maps sections -> first-appearance-unique seq + one bracket sheet line per section', function () {
  var r = Songbook.buildSongFromSections([
    { label: 'Verse', seq: ['C', 'F', 'G'] },
    { label: 'Chorus', seq: ['Am', 'F', 'C', 'G'] }
  ]);
  assert.deepStrictEqual(r.seq, ['C', 'F', 'G', 'Am'], 'seq is the first-appearance unique chords across ALL sections');
  assert.deepStrictEqual(r.sheet, [
    ['Verse', '[C] [F] [G]'],
    ['Chorus', '[Am] [F] [C] [G]']
  ], 'sheet is one [label, bracket-tag line] pair per section');
});

test('M-13: duplicate section labels are preserved (Verse x2) and each keeps its own line', function () {
  var r = Songbook.buildSongFromSections([
    { label: 'Verse', seq: ['C', 'G'] },
    { label: 'Verse', seq: ['C', 'G', 'Am', 'F'] }
  ]);
  assert.deepStrictEqual(r.seq, ['C', 'G', 'Am', 'F'], 'dedupe spans both Verses, first-appearance order');
  assert.strictEqual(r.sheet.length, 2, 'two Verse rows, not merged');
  assert.deepStrictEqual(r.sheet[0], ['Verse', '[C] [G]']);
  assert.deepStrictEqual(r.sheet[1], ['Verse', '[C] [G] [Am] [F]']);
});

test('M-13: assemble is pure/defensive - no sections, empty section, and missing seq all degrade cleanly', function () {
  assert.deepStrictEqual(Songbook.buildSongFromSections([]), { seq: [], sheet: [] }, 'no sections -> empty song');
  assert.deepStrictEqual(Songbook.buildSongFromSections(null), { seq: [], sheet: [] }, 'non-array -> empty song');
  var r = Songbook.buildSongFromSections([{ label: 'Intro', seq: [] }, { label: 'Bridge' }]);
  assert.deepStrictEqual(r.seq, [], 'empty/absent section seqs contribute no chords');
  assert.deepStrictEqual(r.sheet, [['Intro', ''], ['Bridge', '']], 'a labelless-chord section still yields its header row');
});

test('M-13: the assembled sheet is parseable by the render-half (renderChordOnly emits the section headers + chord bars)', function () {
  var r = Songbook.buildSongFromSections([
    { label: 'Verse', seq: ['C', 'F'] },
    { label: 'Chorus', seq: ['G', 'Am'] }
  ]);
  var html = Songbook.renderChordOnly(r.sheet, 0, null);
  assert.ok(/<div class="sect">Verse<\/div>/.test(html), 'Verse header renders');
  assert.ok(/<div class="sect">Chorus<\/div>/.test(html), 'Chorus header renders');
  ['C', 'F', 'G', 'Am'].forEach(function (c) {
    assert.ok(html.indexOf('>' + c + '<') >= 0, 'chord bar ' + c + ' renders');
  });
});

// --- M-13 g1: TEMPLATE-SUGGESTED SECTIONS (roman -> chord realization) ---
// realizeRoman/realizeSection invert the app's ONE degree path (Circle.romanFor)
// - no second speller - and dispChordNameInKey respells canonical-sharp tokens
// key-aware for display. These are the pure core the SONG-tray suggestion chips use.
test('M-13 g1: realizeRoman - diatonic major degrees in C map to the right roots', function () {
  assert.strictEqual(Songbook.realizeRoman('I', 'C'), 'C');
  assert.strictEqual(Songbook.realizeRoman('IV', 'C'), 'F');
  assert.strictEqual(Songbook.realizeRoman('V', 'C'), 'G');
  assert.strictEqual(Songbook.realizeRoman('vi', 'C'), 'Am', 'lowercase numeral -> minor triad');
});

test('M-13 g1: TOKEN stays canonical-sharp, DISPLAY respells key-aware (the IV of F is A# / Bb)', function () {
  // The whole point of regime-B: storage/voicing tokens are canonical-sharp, only
  // the DISPLAY name respells by key. IV of F: token A#, shown Bb (never A#).
  assert.strictEqual(Songbook.realizeRoman('IV', 'F'), 'A#', 'IV of F TOKEN is canonical-sharp A#');
  assert.strictEqual(Songbook.dispChordNameInKey('A#', 'F', 'Major'), 'Bb', 'IV of F DISPLAYS Bb, never A#');
  assert.strictEqual(Songbook.realizeRoman('bVII', 'F'), 'D#', 'bVII of F TOKEN is D#');
  assert.strictEqual(Songbook.dispChordNameInKey('D#', 'F', 'Major'), 'Eb', 'bVII of F DISPLAYS Eb');
});

test('M-13 g1: flat/borrowed + minor-tonic romans realize; bVII of C displays Bb not A#', function () {
  assert.strictEqual(Songbook.realizeRoman('bVII', 'C'), 'A#', 'bVII of C token is A#');
  assert.strictEqual(Songbook.dispChordNameInKey('A#', 'C', 'Major'), 'Bb', 'bVII of C displays Bb, not A#');
  assert.strictEqual(Songbook.realizeRoman('i', 'A'), 'Am', 'minor tonic');
  assert.strictEqual(Songbook.realizeRoman('bVI', 'A'), 'F');
  assert.strictEqual(Songbook.realizeRoman('bIII', 'A'), 'C');
});

test('M-13 g1: realizeSection - whole family realizes; any unrealizable roman skips the WHOLE suggestion', function () {
  assert.deepStrictEqual(Songbook.realizeSection(['I', 'V', 'vi', 'IV'], 'C'), ['C', 'G', 'Am', 'F'], 'Axis in C');
  assert.deepStrictEqual(Songbook.realizeSection(['I', 'bVII', 'IV'], 'F'), ['F', 'D#', 'A#'], 'Mixolydian in F (canonical-sharp tokens)');
  assert.deepStrictEqual(Songbook.realizeSection(['i', 'bVI', 'bIII', 'bVII'], 'A'), ['Am', 'F', 'C', 'G'], 'Minor pop in A');
  assert.strictEqual(Songbook.realizeSection(['I', null, 'IV'], 'C'), null, 'a null roman (unresolvable mined chord) skips the whole suggestion');
  assert.strictEqual(Songbook.realizeSection(['I', '??', 'IV'], 'C'), null, 'a non-roman token skips the whole suggestion');
  assert.strictEqual(Songbook.realizeSection([], 'C'), null, 'empty pattern -> null');
});

test('M-13 g1: dispChordNameInKey is keyless-safe and matches the note-spelling regime-B contract', function () {
  assert.strictEqual(Songbook.dispChordNameInKey('A#', null, 'Major'), 'A#', 'no key -> canonical-sharp token unchanged');
  assert.strictEqual(Songbook.dispChordNameInKey('C', 'C', 'Major'), 'C', 'natural in-key note unchanged');
  assert.strictEqual(Songbook.dispChordNameInKey('Am', 'C', 'Major'), 'Am', 'quality suffix preserved');
});

test('M-13 g1: SongTemplates.forSection integration - a real chorus family realizes to concrete chords', function () {
  var ST = require('../music/shared/song-templates.js');
  var raw = ST.forSection('chorus', []); // no catalog -> proven families only; Axis leads chorus
  var axis = raw.filter(function (s) { return s.roman.join(',') === 'I,V,vi,IV'; })[0];
  assert.ok(axis, 'the Axis family is offered for a chorus');
  assert.deepStrictEqual(Songbook.realizeSection(axis.roman, 'C'), ['C', 'G', 'Am', 'F'], 'Axis realizes to C G Am F in C');
  assert.deepStrictEqual(Songbook.realizeSection(axis.roman, 'G'), ['G', 'D', 'Em', 'C'], 'Axis realizes to G D Em C in G');
});

test('M-13 g1 (UAT): sectionConnectScore ranks adjacent-section arrival - V->I strongest, degree-only', function () {
  // The verse ends on V; a chorus that STARTS on I arrives strongest (authentic cadence).
  assert.strictEqual(Songbook.sectionConnectScore('V', 'I'), 4, 'V->I authentic = strongest');
  assert.strictEqual(Songbook.sectionConnectScore('IV', 'I'), 3, 'IV->I plagal');
  assert.strictEqual(Songbook.sectionConnectScore('vi', 'IV'), 2, 'vi->IV common step (case-insensitive)');
  assert.strictEqual(Songbook.sectionConnectScore('I', 'I'), 1, 'shared chord across the seam = smooth overlap');
  assert.strictEqual(Songbook.sectionConnectScore('bVII', 'IV'), 0, 'no recognized connection -> 0');
  assert.strictEqual(Songbook.sectionConnectScore(null, 'I'), 0, 'no previous section -> neutral 0');
  assert.strictEqual(Songbook.sectionConnectScore('V', 'i'), 4, 'quality is ignored - the arrival is degree motion (V->i still resolves)');
});

// --- M-13 g3: competency-profile-driven suggestion re-rank + why-cue ---
test('M-13 g3: suggestionComplexity - distinct romans + altered/borrowed degrees, higher = more varied', function () {
  assert.strictEqual(Songbook.suggestionComplexity(['I', 'IV', 'V']), 3, 'folk cadence: 3 distinct, none altered');
  assert.strictEqual(Songbook.suggestionComplexity(['I', 'V', 'vi', 'IV']), 4, 'Axis: 4 distinct, none altered');
  assert.strictEqual(Songbook.suggestionComplexity(['i', 'bVI', 'bIII', 'bVII']), 7, 'minor pop: 4 distinct + 3 borrowed = 7');
  assert.strictEqual(Songbook.suggestionComplexity(['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I']), 3, '12-bar blues: repeats collapse to 3 distinct');
  assert.strictEqual(Songbook.suggestionComplexity([]), 0, 'empty roman -> 0');
  assert.strictEqual(Songbook.suggestionComplexity(null), 0, 'missing roman -> 0, never throws');
});
test('M-13 g3: matchedPreference - keyword overlap against a suggestion\'s own text, stopwords ignored', function () {
  var prefs = [{ id: 'p1', statement: 'Prefers jazz turnarounds' }];
  assert.strictEqual(Songbook.matchedPreference(prefs, 'Jazz turnaround'), prefs[0], 'case-insensitive word overlap matches');
  assert.strictEqual(Songbook.matchedPreference(prefs, 'Axis (I-V-vi-IV)'), null, 'no shared word -> no match');
  assert.strictEqual(Songbook.matchedPreference(prefs, ''), null, 'empty match text -> null, never throws');
  assert.strictEqual(Songbook.matchedPreference([], 'Jazz turnaround'), null, 'no preferences -> null');
  assert.strictEqual(Songbook.matchedPreference(null, 'Jazz turnaround'), null, 'absent preferences -> null');
  // a preference built entirely of short/stopwords never coincidentally matches
  assert.strictEqual(Songbook.matchedPreference([{ id: 'p2', statement: 'Uses the and for' }], 'Uses the and for real'), null, 'stopwords/short words never drive a match');
});
test('M-13 g3: personalizeSuggestions - NO profile leaves every suggestion untagged with zero boost (graceful absence)', function () {
  var suggestions = [
    { _order: 0, _complexity: 3, _matchText: 'Folk cadence' },
    { _order: 1, _complexity: 7, _matchText: 'Minor pop' }
  ];
  Songbook.personalizeSuggestions(suggestions, null);
  assert.deepStrictEqual(suggestions.map(function (s) { return [s._boost, s._tag]; }), [[0, null], [0, null]], 'no profile -> no nudge, no tag - byte-for-byte todays order stands');
});
test('M-13 g3: personalizeSuggestions - low comp-progressions level boosts the SIMPLE suggestion, tags it "easy fit"', function () {
  var profile = { competencies: [{ id: 'comp-progressions', level: 20 }], preferences: [] };
  var suggestions = [
    { _order: 0, _complexity: 7, _matchText: 'Minor pop' },   // complex, listed first by proven order
    { _order: 1, _complexity: 3, _matchText: 'Folk cadence' } // simple, listed second
  ];
  Songbook.personalizeSuggestions(suggestions, profile);
  assert.deepStrictEqual(suggestions.map(function (s) { return s._boost; }), [0, 1], 'only the simple one is nudged');
  assert.strictEqual(suggestions[1]._tag, 'easy fit');
  assert.strictEqual(suggestions[0]._tag, null);
  // the ranking function's own tiebreak (mirrors templateSuggestions' sort: connect, then boost, then proven order)
  var ranked = suggestions.slice().sort(function (a, b) { return (b._boost - a._boost) || (a._order - b._order); });
  assert.strictEqual(ranked[0]._order, 1, 'a low-level player sees the simple option surface ABOVE its proven-order rank - order genuinely changed');
});
test('M-13 g3: personalizeSuggestions - a level at/above 40 boosts the VARIED suggestion instead, tags it "adds variety"', function () {
  var profile = { competencies: [{ id: 'comp-progressions', level: 65 }], preferences: [] };
  var suggestions = [
    { _order: 0, _complexity: 3, _matchText: 'Folk cadence' },
    { _order: 1, _complexity: 7, _matchText: 'Minor pop' }
  ];
  Songbook.personalizeSuggestions(suggestions, profile);
  assert.strictEqual(suggestions[0]._tag, null, 'simple stays untagged at this level');
  assert.strictEqual(suggestions[1]._tag, 'adds variety');
  var ranked = suggestions.slice().sort(function (a, b) { return (b._boost - a._boost) || (a._order - b._order); });
  assert.strictEqual(ranked[0]._order, 1, 'the varied option now ranks first, above its proven-order position');
});
test('M-13 g3: personalizeSuggestions - a matched PREFERENCE always wins the tag + outranks a mere skill nudge', function () {
  var profile = {
    competencies: [{ id: 'comp-progressions', level: 20 }], // would otherwise favor the SIMPLE suggestion
    preferences: [{ id: 'p1', statement: 'Prefers minor pop progressions' }]
  };
  var suggestions = [
    { _order: 0, _complexity: 3, _matchText: 'Folk cadence' },
    { _order: 1, _complexity: 7, _matchText: 'Minor pop (i-bVI-bIII-bVII)' } // matches the preference, despite being complex
  ];
  Songbook.personalizeSuggestions(suggestions, profile);
  assert.strictEqual(suggestions[0]._tag, 'easy fit', 'the simple one still earns its OWN skill nudge independently');
  assert.strictEqual(suggestions[1]._tag, 'your style', 'the complex one gets the preference tag instead of no tag at all');
  assert.ok(suggestions[1]._boost > suggestions[0]._boost, 'a preference match always out-boosts a mere skill nudge');
});
test('M-13 g3: personalizeSuggestions - a profile with no comp-progressions entry never fabricates a level (graceful)', function () {
  var profile = { competencies: [{ id: 'comp-song-form', level: 10 }], preferences: [] };
  var suggestions = [{ _order: 0, _complexity: 3, _matchText: 'Folk cadence' }];
  Songbook.personalizeSuggestions(suggestions, profile);
  assert.strictEqual(suggestions[0]._boost, 0);
  assert.strictEqual(suggestions[0]._tag, null);
});

// --- Buffer behavior in the live compose engine (add / arm-remove / A3) ---
// The tray self-injects into el.prog.parentNode; locate the injected nodes by class.
function songTrayNodes(m) {
  var out = {};
  (function walk(n) {
    (n.children || []).forEach(function (c) {
      var cls = (c.className || '').split(' ');
      if (cls.indexOf('songTray') >= 0) out.tray = c;
      if (cls.indexOf('songSections') >= 0) out.sections = c;
      if (cls.indexOf('songSectSel') >= 0) out.sel = c;
      if (cls.indexOf('songAddBtn') >= 0) out.addBtn = c;
      if (cls.indexOf('songAssembleBtn') >= 0) out.assemble = c;
      walk(c);
    });
  })(m.wrapper);
  return out;
}

test('M-13/UAT-r2: Add to song captures the progression, then CLEARS the strip so the next section starts fresh (reversibly)', function () {
  var m = mountForProgWrapTests();
  tapChords(m, 3); // C F G (default C-major palette)
  assert.strictEqual(m.elMap.prog.children.length, 3, 'three chords built');
  var t = songTrayNodes(m);
  assert.ok(t.tray, 'the tray self-injected into the progression box');
  assert.strictEqual(t.tray.hidden, false, 'the tray shows once a progression exists');
  t.sel.value = 'Verse';
  t.addBtn.click();
  // UAT r2: the strip clears so the NEXT section is not built on top of this one
  // (the twice-reported append bug). The captured chords are safe - both in the
  // section AND restorable via the Clear-undo banner (asserted in the r2 test below).
  assert.strictEqual(m.elMap.prog.children.length, 0, 'the strip cleared for the next section');
  // S-SONG-MODE: a plain Chords-mode capture STAYS in Chords mode (no context
  // yank mid-noodle) - the cards render on the Song canvas.
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'a plain capture never yanks the editor away');
  assert.strictEqual(t.sections.children.length, 0, 'cards are canvas furniture - not built while the canvas is hidden');
  m.ctrl.setComposeMode('song');
  assert.strictEqual(t.sections.children.length, 1, 'one section card on the canvas (the capture is intact)');
  assert.strictEqual(t.assemble.hidden, false, 'Save song appears once a section is buffered');
});

test('M-13: a section card uses the ONE arm-to-remove grammar - first tap arms (no removal), second removes', function () {
  var m = mountForProgWrapTests();
  tapChords(m, 2);
  var t = songTrayNodes(m);
  t.sel.value = 'Chorus';
  t.addBtn.click();
  m.ctrl.setComposeMode('song'); // cards live on the canvas
  assert.strictEqual(t.sections.children.length, 1, 'one section buffered');
  var rm = t.sections.children[0].children.filter(function (c) { return c.className === 'rm'; })[0];
  assert.ok(rm, 'the card carries a remove (x) button');
  tapWired(rm);
  assert.strictEqual(t.sections.children.length, 1, 'first tap ARMS - it must NOT remove');
  assert.ok(rm.classList.contains('armed'), 'first tap arms the remover (red)');
  tapWired(rm);
  assert.strictEqual(t.sections.children.length, 0, 'second tap removes the buffered section');
  assert.strictEqual(t.assemble.hidden, true, 'Save song hides once the buffer is empty');
  m.ctrl.setComposeMode('chords');
  // UAT r2: the capture cleared the strip, so with the section also removed there
  // is nothing to capture - the tray correctly hides. Re-tap a chord and it returns.
  assert.strictEqual(t.tray.hidden, true, 'empty strip + empty draft -> nothing to add, tray hidden');
  tapChords(m, 1);
  assert.strictEqual(songTrayNodes(m).tray.hidden, false, 'a fresh chord re-shows the capture row');
});

// --- M-13 g2: buffer persistence across a reload + reorder ---
// A minimal fresh mount that does NOT reset global.localStorage - the caller
// controls the store, so two mounts against the SAME store simulate a reload.
function freshMountSharedStore() {
  var progEl = makeStubEl('div'), wrapper = makeStubEl('div');
  wrapper.appendChild(progEl);
  var elMap = {
    prog: progEl, catChips: makeStubEl('div'), buildGrid: makeStubEl('div'),
    cSave: makeStubEl('button'), composeChords: makeStubEl('div'), suggest: makeStubEl('div')
  };
  var ctrl = Songbook.mount({ storagePrefix: 'progwraptest', el: elMap });
  return { ctrl: ctrl, elMap: elMap, wrapper: wrapper };
}

test('M-13 g2: the section buffer persists across a reload (fresh mount, same localStorage)', function () {
  var store = lsReset.fakeStore();
  global.localStorage = store;
  var m1 = freshMountSharedStore();
  tapChords(m1, 2);
  var t1 = songTrayNodes(m1);
  t1.sel.value = 'Verse';
  t1.addBtn.click();
  tapChords(m1, 1);
  t1.sel.value = 'Chorus';
  t1.addBtn.click();
  m1.ctrl.setComposeMode('song'); // cards live on the canvas
  assert.strictEqual(t1.sections.children.length, 2, 'two sections buffered before the reload');
  var stored = JSON.parse(store.getItem('progwraptest.builderBuffer.v1'));
  assert.strictEqual(stored.length, 2, 'the additive builderBuffer key holds both sections');
  assert.deepStrictEqual(stored.map(function (s) { return s.label; }), ['Verse', 'Chorus'], 'stored labels match add order');

  // Reload: a brand-new mount, same localStorage object, no re-add. S-SONG-MODE:
  // the VIEW persists too (music.composeMode.v1) - the musician left on the
  // canvas, the reload lands back on the canvas with their draft.
  var m2 = freshMountSharedStore();
  var t2 = songTrayNodes(m2);
  assert.strictEqual(m2.ctrl.composeMode(), 'song', 'the Song view survives the reload alongside its draft');
  assert.strictEqual(t2.sections.children.length, 2, 'both buffered sections survive the reload');
  assert.strictEqual(t2.assemble.hidden, false, 'Save song stays available after a reload with a restored buffer');
});

test('M-13 g2: a defensively-malformed buffer key drops only the bad rows, never crashes the mount', function () {
  var store = lsReset.fakeStore();
  store.setItem('progwraptest.builderBuffer.v1', JSON.stringify([
    { label: 'Verse', seq: ['C', 'G'] },
    { label: 'Chorus' },              // missing seq -> dropped
    'not-an-object',                  // wrong shape -> dropped
    { seq: ['A'] }                    // missing label -> dropped
  ]));
  global.localStorage = store;
  var m = freshMountSharedStore();
  m.ctrl.setComposeMode('song'); // cards live on the canvas
  var t = songTrayNodes(m);
  assert.strictEqual(t.sections.children.length, 1, 'only the one well-shaped section survives the defensive filter');
});

test('M-13 g2: reorder handles swap adjacent sections, persist the new order, and disable at the ends', function () {
  var m = mountForProgWrapTests();
  var t = songTrayNodes(m);
  // UAT r2: each capture clears the strip, so a fresh progression is tapped per
  // section (which is the real user flow - build a part, add it, build the next).
  tapChords(m, 2); t.sel.value = 'Verse'; t.addBtn.click();
  tapChords(m, 2); t.sel.value = 'Chorus'; t.addBtn.click();
  tapChords(m, 2); t.sel.value = 'Bridge'; t.addBtn.click();
  m.ctrl.setComposeMode('song'); // cards live on the canvas
  assert.strictEqual(t.sections.children.length, 3, 'three sections buffered');

  function labelOf(chip) {
    var name = chip.children.filter(function (c) { return c.className === 'songSectName'; })[0];
    return name.textContent.split(' ').slice(0, -2).join(' '); // strip " · N" count suffix
  }
  function moveBtn(chip, dir) {
    return chip.children.filter(function (c) { return c.className === 'songSectMove ' + dir; })[0];
  }
  assert.deepStrictEqual(t.sections.children.map(labelOf), ['Verse', 'Chorus', 'Bridge'], 'initial buffer order');

  // Move the middle section (Chorus) up -> Chorus, Verse, Bridge.
  var chorusUp = moveBtn(t.sections.children[1], 'up');
  assert.ok(chorusUp, 'a non-first chip carries an up handle');
  assert.strictEqual(chorusUp.disabled, false, 'a middle chip up handle is enabled');
  tapWired(chorusUp);
  var t2 = songTrayNodes(m); // renderSongTray rebuilt songSectionsEl - re-locate nodes
  assert.deepStrictEqual(t2.sections.children.map(labelOf), ['Chorus', 'Verse', 'Bridge'], 'up swaps with the previous section');
  var storedOrder = JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).map(function (s) { return s.label; });
  assert.deepStrictEqual(storedOrder, ['Chorus', 'Verse', 'Bridge'], 'the reorder persists to storage immediately');

  // Boundaries: first chip's up and last chip's down are disabled.
  var firstUp = moveBtn(t2.sections.children[0], 'up');
  var lastDn = moveBtn(t2.sections.children[2], 'dn');
  assert.strictEqual(firstUp.disabled, true, 'the first section cannot move up');
  assert.strictEqual(lastDn.disabled, true, 'the last section cannot move down');

  // Move the last section (Bridge) down: a no-op past the end, order unchanged.
  tapWired(lastDn); // stub does not model native disabled-suppresses-click; assert handler is defensive
  var t3 = songTrayNodes(m);
  assert.deepStrictEqual(t3.sections.children.map(labelOf), ['Chorus', 'Verse', 'Bridge'], 'moving past the end is a no-op');
});

/* ---------- S-SONG-MODE (docs/SONG-MODE-DESIGN.md): the Chords|Song toggle,
 * the guided capture loop, and the Save-song naming moment. These lock the
 * view-state machine (default, persistence, invalid-value hardening), the
 * canvas furniture (chord line on cards, badge), the returnToSong round trip,
 * and that saving names the song + clears the draft + lands back on the
 * editor. ---------- */
function songModeNodes(m) {
  var out = songTrayNodes(m);
  (function walk(n) {
    (n.children || []).forEach(function (c) {
      var cls = (c.className || '').split(' ');
      if (cls.indexOf('composeModeBtn') >= 0) (out.modeBtns = out.modeBtns || []).push(c);
      if (cls.indexOf('songBuildBtn') >= 0) out.buildBtn = c;
      if (cls.indexOf('composeSong') >= 0) out.canvas = c;
      if (cls.indexOf('songSectChords') >= 0) out.cardChords = c;
      walk(c);
    });
  })(m.wrapper);
  return out;
}

test('S-SONG-MODE: songBadgeText is pure - bare label at zero, a count badge past it', function () {
  assert.strictEqual(Songbook.songBadgeText(0), 'Song');
  assert.strictEqual(Songbook.songBadgeText(2), 'Song · 2');
});

test('S-SONG-MODE: defaults to chords; setComposeMode flips + persists; unknown values are ignored', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'muscle-memory default');
  m.ctrl.setComposeMode('song');
  assert.strictEqual(m.ctrl.composeMode(), 'song');
  assert.strictEqual(global.localStorage.getItem('progwraptest.composeMode.v1'), 'song', 'additive key persists the view');
  m.ctrl.setComposeMode('bogus');
  assert.strictEqual(m.ctrl.composeMode(), 'song', 'an unknown mode can never wedge the screen');
  m.ctrl.setComposeMode('chords');
  assert.strictEqual(m.ctrl.composeMode(), 'chords');
});

test('S-SONG-MODE: the Song toggle carries the section-count badge and tracks adds live', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  var n = songModeNodes(m);
  assert.ok(n.modeBtns && n.modeBtns.length === 2, 'the two-segment toggle self-injected');
  assert.strictEqual(n.modeBtns[1].textContent, 'Song', 'no badge with an empty draft');
  tapChords(m, 2);
  n.sel.value = 'Verse'; n.addBtn.click();
  assert.strictEqual(n.modeBtns[1].textContent, 'Song · 1', 'a capture updates the badge from Chords mode - parked work stays visible');
});

test('S-SONG-MODE: a section card shows its chords (canvas furniture, recognition over recall)', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2); // C F off the default C-major palette
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  m.ctrl.setComposeMode('song');
  n = songModeNodes(m); // cards rebuilt on render - re-locate
  assert.ok(n.cardChords, 'the card carries a chords line');
  assert.ok(n.cardChords.textContent.length >= 3, 'the chords line names the section chords: ' + n.cardChords.textContent);
});

test('S-SONG-MODE guided loop: Build-the-chords drops to Chords mode; the next Add to song returns to the canvas; a manual toggle tap breaks the loop', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  var n = songModeNodes(m);
  m.ctrl.setComposeMode('song');
  tapWired(n.buildBtn);
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'Build the chords lands in the editor');
  tapChords(m, 2);
  n.sel.value = 'Chorus'; n.addBtn.click();
  assert.strictEqual(m.ctrl.composeMode(), 'song', 'the capture returns to the canvas (guided loop)');
  // Loop-break: leave via the toggle (the user taking the wheel), then capture again.
  tapWired(n.buildBtn);                        // canvas -> editor, loop armed
  tapWired(n.modeBtns[1]);                     // manual hop to Song...
  tapWired(n.modeBtns[0]);                     // ...and back to Chords - loop must now be broken
  tapChords(m, 1);
  n.sel.value = 'Bridge'; n.addBtn.click();
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'after a manual toggle tap a capture stays put');
});

test('S-SONG-MODE: Save song opens the name row; saving names the song, clears the draft, returns to the editor', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  m.ctrl.setComposeMode('song');
  n.assemble.onclick(); // Save song -> the inline name row (same grammar as the progression save)
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  assert.ok(row, 'the name row opened from the Song canvas');
  row.children[0].value = 'Campfire anthem';       // the name input
  row.children[1].children[0].checked = false;     // skip the setlist toggle path
  // The save chain ends in openPractice (navigate to the new song) - practice-view
  // els are absent from this stub mount, so tolerate a throw from the nav tail;
  // everything asserted below is committed BEFORE the navigation.
  try { row.children[2].onclick(); } catch (e) { /* nav tail only */ }
  var customs = JSON.parse(global.localStorage.getItem('progwraptest.custom.v1') || '[]');
  assert.strictEqual(customs.length, 1, 'one custom song created');
  assert.strictEqual(customs[0].t, 'Campfire anthem', 'the song carries the typed name - never "My song"');
  assert.ok(customs[0].sheet && customs[0].sheet.length === 1, 'the sheet holds the one section line');
  assert.strictEqual(JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).length, 0, 'the draft cleared after save');
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'a finished song lands the next visit back on the editor');
});

test('S-SONG-MODE UAT-1: with a song draft, Save ASKS - the song branch saves all sections, never a silent progression-only save', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click(); // captures + clears the strip (UAT r2)
  tapChords(m, 2);                          // a NEW progression alongside the draft -> Save is ambiguous
  m.elMap.cSave.onclick(); // the ambiguous tap from the operator report
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  assert.ok(row, 'a choice row opened instead of a silent progression save');
  var btnRow = row.children[1];
  assert.strictEqual(btnRow.children[0].textContent, 'Save song (1 section)', 'the song outcome is named, with the count');
  btnRow.children[0].onclick(); // choose the song -> assembleSong -> the name row re-renders in place
  assert.strictEqual(m.ctrl.composeMode(), 'song', 'the canvas comes up behind the name row - you see what you are saving');
  row.children[1].children[0].checked = false; // skip the setlist path
  try { row.children[2].onclick(); } catch (e) { /* openPractice nav tail - practice els absent from this stub mount */ }
  var customs = JSON.parse(global.localStorage.getItem('progwraptest.custom.v1') || '[]');
  assert.strictEqual(customs.length, 1, 'one custom song created');
  assert.ok(customs[0].sheet && customs[0].sheet.length === 1, 'the saved record is the SONG (carries the section sheet), not a bare progression');
});

test('S-SONG-MODE UAT-1: the "Just this progression" branch runs the original save; the draft stays buffered', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click(); // captures + clears the strip (UAT r2)
  tapChords(m, 2);                          // a new progression alongside the draft -> the choice row
  m.elMap.cSave.onclick();
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  row.children[1].children[1].onclick(); // 'Just this progression' -> the classic name row
  row.children[1].children[0].checked = false; // its setlist toggle
  row.children[2].onclick(); // accept the default name
  var customs = JSON.parse(global.localStorage.getItem('progwraptest.custom.v1') || '[]');
  assert.strictEqual(customs.length, 1, 'the progression saved');
  assert.ok(!customs[0].sheet, 'a progression-only save carries no section sheet');
  assert.strictEqual(JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).length, 1, 'the song draft is untouched');
});

test('S-SONG-MODE UAT-1: draft + EMPTY progression - Save goes straight to the song (the only thing to save)', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  m.ctrl.setComposeMode('song');
  tapWired(n.buildBtn);                 // UAT-2 path clears the strip...
  assert.strictEqual(m.elMap.prog.children.length, 0, 'Build the chords starts fresh');
  m.elMap.cSave.onclick();              // ...so Save has exactly one meaning now
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  assert.ok(row, 'the name row opened directly - no choice needed with one thing to save');
  assert.strictEqual(m.ctrl.composeMode(), 'song', 'and the canvas context came up behind it');
});

test('S-SONG-MODE UAT-2/r2: a Chords-mode capture clears the strip; Undo restores the exact chords to edit into the next section', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 3);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  // UAT r2: the strip clears on capture - the next section is not built on top.
  assert.strictEqual(m.elMap.prog.children.length, 0, 'the strip cleared for the next section');
  assert.strictEqual(JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).length, 1, 'the captured Verse is safe in the draft');
  // ...and the edit-the-verse-into-the-chorus workflow is preserved: Undo the
  // clear restores the exact chords (find the clear-undo banner's Undo button).
  var undo = null;
  (function walk(x) { (x.children || []).forEach(function (c) {
    if (c.className && c.className.indexOf('btn ghost') === 0 && c.textContent === 'Undo') undo = c;
    walk(c);
  }); })(m.wrapper);
  assert.ok(undo, 'the capture shows a clear-undo banner (persistent + actionable, not a fast toast)');
  undo.onclick();
  assert.strictEqual(m.elMap.prog.children.length, 3, 'Undo brings the captured chords back to edit');
});

/* ---------- S-SONG-MODE Phase B: Continue building (saved song -> canvas ->
 * update in place). Locks the sheet parser (the buildSongFromSections inverse),
 * the reopen flow, the no-clobber guard for a foreign draft, and the
 * emptied-draft-drops-the-link guard (a stale link must never make a NEW draft
 * overwrite an old song). ---------- */
test('Phase B: sectionsFromSheet round-trips buildSongFromSections, mines lyric-mixed rows, skips chordless rows, never throws on junk', function () {
  var secs = [{ label: 'Verse', seq: ['C', 'G', 'Am'] }, { label: 'Chorus', seq: ['F', 'C'] }];
  var built = Songbook.buildSongFromSections(secs);
  assert.deepStrictEqual(Songbook.sectionsFromSheet(built.sheet), secs, 'a builder-made song round-trips exactly');
  assert.deepStrictEqual(Songbook.sectionsFromSheet([['Verse', 'Well I [C]woke up this [G7]morning']]),
    [{ label: 'Verse', seq: ['C', 'G7'] }], 'chords mined out of a lyric line');
  assert.deepStrictEqual(Songbook.sectionsFromSheet([['Note', 'no chords here'], ['Verse', '[D]']]),
    [{ label: 'Verse', seq: ['D'] }], 'chordless rows are skipped');
  assert.deepStrictEqual(Songbook.sectionsFromSheet(null), [], 'junk in, empty out - never a throw');
  assert.deepStrictEqual(Songbook.sectionsFromSheet([null, 'x', ['only-label']]), [], 'malformed rows dropped');
});

// Save a fresh 2-section song through the canvas and return its stored record.
function saveSongViaCanvas(m, n, name) {
  m.ctrl.setComposeMode('song');
  n.assemble.onclick();
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  row.children[0].value = name;
  row.children[1].children[0].checked = false;
  m.ctrl.getState().current = null; // detach the stub's practice view before the nav tail
  try { row.children[2].onclick(); } catch (e) { /* openPractice nav tail - practice els absent */ }
  return JSON.parse(global.localStorage.getItem('progwraptest.custom.v1') || '[]');
}

test('Phase B: Continue building reopens the saved song on the canvas; Save UPDATES it in place - same record, same name, new sheet', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  var customs = saveSongViaCanvas(m, n, 'First song');
  assert.strictEqual(customs.length, 1, 'the song saved');
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'post-save lands on the editor');
  // Reopen it on the canvas.
  m.ctrl.continueBuilding(customs[0].id);
  assert.strictEqual(m.ctrl.composeMode(), 'song', 'Continue building lands on the canvas');
  assert.strictEqual(JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).length, 1, 'the saved section is back in the draft');
  assert.strictEqual(global.localStorage.getItem('progwraptest.builderSource.v1'), customs[0].id, 'the draft carries its source link');
  // Add a Chorus and save again - update in place, no name row, no copy.
  tapChords(m, 2);
  n.sel.value = 'Chorus'; n.addBtn.click();
  m.ctrl.setComposeMode('song');
  m.ctrl.getState().current = null;
  try { n.assemble.onclick(); } catch (e) { /* nav tail */ }
  var after = JSON.parse(global.localStorage.getItem('progwraptest.custom.v1'));
  assert.strictEqual(after.length, 1, 'STILL one record - updated, not copied');
  assert.strictEqual(after[0].t, 'First song', 'the name survives an update (no re-prompt)');
  assert.strictEqual(after[0].sheet.length, 2, 'the rebuilt sheet carries both sections');
  assert.strictEqual(JSON.parse(global.localStorage.getItem('progwraptest.builderBuffer.v1')).length, 0, 'the draft cleared after the update');
  assert.ok(!global.localStorage.getItem('progwraptest.builderSource.v1'), 'the source link ended with the save');
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'back on the editor');
});

test('Phase B: a DIFFERENT unsaved draft blocks Continue building - never clobber unsaved work', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  var customs = saveSongViaCanvas(m, n, 'Finished song');
  // A brand-new foreign draft...
  tapChords(m, 1);
  n.sel.value = 'Bridge'; n.addBtn.click();
  var before = global.localStorage.getItem('progwraptest.builderBuffer.v1');
  // ...must survive a Continue building attempt untouched.
  m.ctrl.continueBuilding(customs[0].id);
  assert.strictEqual(m.ctrl.composeMode(), 'chords', 'refused - no canvas switch over unsaved work');
  assert.strictEqual(global.localStorage.getItem('progwraptest.builderBuffer.v1'), before, 'the foreign draft is byte-identical');
  assert.ok(!global.localStorage.getItem('progwraptest.builderSource.v1'), 'no source link was planted');
  // The refusal is a CAUTION (you have unsaved work), not a FAILURE - so it
  // paints amber 'warn', never red 'err' (operator UAT: it read as an error and
  // vanished too fast). Colour discipline: warn != err, two meanings two looks.
  var toast = findPlainToast();
  assert.ok(toast, 'the refusal shows a toast');
  assert.strictEqual(toast.classList.contains('warn'), true, 'the "song already in progress" refusal is an amber caution');
  assert.strictEqual(toast.classList.contains('err'), false, 'a caution is never styled as an error');
});

test('Phase B: emptying a continued draft drops the source link - the next draft saves FRESH, never overwriting the old song', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  var customs = saveSongViaCanvas(m, n, 'Keeper');
  m.ctrl.continueBuilding(customs[0].id);
  // Remove the one section (arm + confirm) - the link must die with the draft.
  n = songModeNodes(m); // cards rebuilt on render
  var rm = n.sections.children[0].children.filter(function (c) { return c.className === 'rm'; })[0];
  tapWired(rm); tapWired(rm);
  assert.ok(!global.localStorage.getItem('progwraptest.builderSource.v1'), 'the emptied draft dropped its source link');
  // A new draft saved now must be a SECOND record.
  tapChords(m, 1);
  n.sel.value = 'Intro'; n.addBtn.click();
  var after = saveSongViaCanvas(m, n, 'Brand new');
  assert.strictEqual(after.length, 2, 'a fresh draft saved as a NEW song - Keeper was not overwritten');
  assert.strictEqual(after[0].t, 'Keeper', 'the original record is intact');
});

test('UAT r3: a just-saved song lands at setlist #1 (recency = about to play), above existing entries', function () {
  var store = lsReset.fakeStore();
  // A REAL custom song already in the setlist (a bare id would be pruned at mount
  // by the dangling-setlist heal - S-SET-INTEGRITY).
  store.setItem('progwraptest.custom.v1', JSON.stringify([{ id: 'keep', t: 'Old set song', seq: ['C', 'G'], custom: true }]));
  store.setItem('progwraptest.setlist.v1', JSON.stringify(['keep']));
  global.localStorage = store;
  var m = freshMountSharedStore();
  tapChords(m, 2);
  var n = songModeNodes(m);
  n.sel.value = 'Verse'; n.addBtn.click();
  m.ctrl.setComposeMode('song');
  n.assemble.onclick();
  var row = null;
  m.wrapper.children.forEach(function (c) { if (c.className && c.className.indexOf('composeRow') === 0) row = c; });
  row.children[0].value = 'Fresh song';
  row.children[1].children[0].checked = true; // add to setlist
  m.ctrl.getState().current = null;
  try { row.children[2].onclick(); } catch (e) { /* openPractice nav tail */ }
  var setlist = JSON.parse(global.localStorage.getItem('progwraptest.setlist.v1'));
  var fresh = JSON.parse(global.localStorage.getItem('progwraptest.custom.v1')).filter(function (c) { return c.t === 'Fresh song'; })[0];
  assert.ok(fresh, 'the fresh song saved');
  assert.strictEqual(setlist[0], fresh.id, 'the just-saved song is at the TOP of the setlist');
  assert.deepStrictEqual(setlist.slice(1), ['keep'], 'the existing set entry stays below it');
});

test('UAT r2: teaching cues are dismissible one-shot tips - a dismissal persists per lesson and survives a reload', function () {
  global.localStorage = lsReset.fakeStore();
  var m = freshMountSharedStore();
  tapChords(m, 2); // progression + no sections -> the capture cue is live
  var n = songModeNodes(m);
  function cueParts(host) {
    var out = { text: null, x: null };
    (host.children || []).forEach(function (c) {
      if (c.className === 'cueText') out.text = c;
      if (c.className === 'cueDismiss') out.x = c;
    });
    return out;
  }
  var tray = songTrayNodes(m).tray;
  var cueHost = tray.children[0]; // [cue, addRow]
  var parts = cueParts(cueHost);
  assert.ok(parts.text && parts.x, 'the live cue carries its text and a dismiss button');
  assert.strictEqual(cueHost.hidden, false, 'cue visible before dismissal');
  tapWired(parts.x);
  assert.strictEqual(cueHost.hidden, true, 'dismissed - the row is reclaimed');
  var stored = JSON.parse(global.localStorage.getItem('progwraptest.cueDismissed.v1'));
  assert.strictEqual(stored.capture, true, 'the dismissal persisted per lesson key');
  // Reload: same store, fresh mount - the lesson stays learned.
  var m2 = freshMountSharedStore();
  var t2 = songTrayNodes(m2);
  var tile2 = m2.elMap.buildGrid.children[0]; tile2.onclick(); // progression exists again
  assert.strictEqual(t2.tray.children[0].hidden, true, 'a dismissed cue never returns after reload');
});

run();
