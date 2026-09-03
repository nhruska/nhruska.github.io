/* =====================================================================
 * tracks.test.js  -  unit tests for the backing-track finder core
 * Run: node test/tracks.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tracks.js');
var Circle = require('../music/shared/circle.js');
var Notables = require('../music/shared/notables.js');
var GuidanceLevel = require('../music/shared/guidance-level.js');
var lsReset = require('./helpers/local-storage-reset.js');
// compat shim over the shared helper's {clear, fakeStore} API (same as notables.test.js)
function resetLocalStorage(seed) {
  global.localStorage = lsReset.fakeStore();
  if (seed) Object.keys(seed).forEach(function (k) { global.localStorage.setItem(k, seed[k]); });
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

var SEED = [
  { yt: 'a', title: 'Blues in A', artist: 'X', genre: 'blues', key: 'A', mode: 'minor', bpm: 70 },
  { yt: 'b', title: 'C jam', artist: 'Y', genre: 'jam', key: 'C', mode: 'major', bpm: 120 },
  { yt: null, title: 'Reggae D', artist: 'Z', genre: 'reggae', key: 'D', mode: 'major', bpm: 75 }
];

test('uniqueGenres returns sorted distinct genres', function () {
  assert.deepStrictEqual(T.uniqueGenres(SEED), ['blues', 'jam', 'reggae']);
});
test('filterTracks by genre only', function () {
  var r = T.filterTracks(SEED, 'jam', null, 'major');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].track.title, 'C jam');
});
test('filterTracks exact key match ranks first', function () {
  var r = T.filterTracks(SEED, 'all', 'A', 'minor');
  assert.ok(r.length >= 1);
  assert.strictEqual(r[0].track.key, 'A');
  assert.strictEqual(r[0].rank, 0);
});
test('compatibleKeys: A minor includes its relative major C', function () {
  var keys = T.compatibleKeys('A', 'minor').map(function (c) { return c.key + c.mode; });
  assert.ok(keys.indexOf('Cmajor') >= 0, keys.join(','));
});
test('relative-key expansion: A minor surfaces the C-major jam, labelled', function () {
  var r = T.filterTracks(SEED, 'all', 'A', 'minor');
  var c = r.filter(function (x) { return x.track.key === 'C'; })[0];
  assert.ok(c, 'expected the C-major track to surface for A minor');
  assert.ok(c.rank > 0 && /relative/.test(c.why), 'should be a labelled related match');
});
test('parseYouTubeId handles watch / youtu.be / bare id', function () {
  assert.strictEqual(T.parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(T.parseYouTubeId('not a url'), null);
});
test('searchQuery + youtubeSearchUrl build a sane deterministic URL', function () {
  var q = T.searchQuery({ artist: 'Phish', title: 'Tweezer' });
  assert.strictEqual(q, 'Phish Tweezer backing track');
  assert.ok(/youtube\.com\/results\?search_query=/.test(T.youtubeSearchUrl(q)));
});
test('filterQuery composes genre + key', function () {
  assert.strictEqual(T.filterQuery('blues', 'A', 'minor'), 'blues backing track in A minor');
});
test('mergeTracks concatenates seed + custom safely', function () {
  assert.deepStrictEqual(T.mergeTracks([1], [2]), [1, 2]);
  assert.deepStrictEqual(T.mergeTracks(null, null), []);
});
test('notesToPcs maps note names to chromatic pitch classes (flats normalised)', function () {
  assert.deepStrictEqual(T.notesToPcs(['C', 'E', 'G']), [0, 4, 7]);
  assert.deepStrictEqual(T.notesToPcs(['Bb', 'Db']), [10, 1]);
  assert.deepStrictEqual(T.notesToPcs(['C', 'wat', 'G']), [0, 7]); // unknowns drop out
});
test('Studio fretboard input: A minor scale -> the right pitch classes', function () {
  // the exact pcs the scale diagram lights up for an Am backing track
  var pcs = T.notesToPcs(Circle.scale('A', 'aeolian'));
  assert.deepStrictEqual(pcs, [9, 11, 0, 2, 4, 5, 7]);
});
test('notesToPcs handles exotic enharmonics (E#,B#,Cb,Fb + double accidentals)', function () {
  assert.deepStrictEqual(T.notesToPcs(['E#', 'B#', 'Cb', 'Fb']), [5, 0, 11, 4]);
  assert.deepStrictEqual(T.notesToPcs(['F##', 'Bbb']), [7, 9]);
});
test('Studio fretboard: F# major + D# minor light ALL 7 tones (the E# bug)', function () {
  // F# major is spelled F# G# A# B C# D# E# — the E# must not drop
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('F#', 'ionian')), [6, 8, 10, 11, 1, 3, 5]);
  assert.strictEqual(T.notesToPcs(Circle.scale('D#', 'aeolian')).length, 7);
});
test('Studio chords: C major track -> its diatonic triads', function () {
  var chords = Circle.diatonic('C', 'ionian').map(function (d) { return d.chord; });
  assert.deepStrictEqual(chords, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
});
test('Studio chords carry interval (Roman) labels — case-aware, diminished marked', function () {
  // the chord row now shows the interval under each chord; major=UPPER, minor=lower, dim=°
  var romans = Circle.diatonic('C', 'ionian').map(function (d) { return d.roman; });
  assert.deepStrictEqual(romans, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  // minor key relabels the same chords from its own tonic
  var minor = Circle.diatonic('A', 'aeolian').map(function (d) { return d.roman; });
  assert.deepStrictEqual(minor, ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
});

// --- Phase 3: Compose -> backing-track bridge -----------------------------
test('P3 normMode: Major/Minor coarsen to the finder families', function () {
  assert.strictEqual(T.normMode('Major'), 'major');
  assert.strictEqual(T.normMode('Minor'), 'minor');
  assert.strictEqual(T.normMode('minor'), 'minor');
});
test('P3 normMode: church modes coarsen by family', function () {
  assert.strictEqual(T.normMode('Dorian'), 'minor');
  assert.strictEqual(T.normMode('Phrygian'), 'minor');
  assert.strictEqual(T.normMode('Aeolian'), 'minor');
  assert.strictEqual(T.normMode('Mixolydian'), 'major'); // dominant, major-family
  assert.strictEqual(T.normMode('Lydian'), 'major');
  assert.strictEqual(T.normMode('Ionian'), 'major');
});
test('P3 normMode: missing/garbage defaults to major (safe)', function () {
  assert.strictEqual(T.normMode(null), 'major');
  assert.strictEqual(T.normMode(''), 'major');
  assert.strictEqual(T.normMode(undefined), 'major');
});
test('P3 seed end-to-end: a composed A-minor key surfaces matched tracks', function () {
  // the bridge seeds the finder with (root, normMode(mode)) -> filterTracks ranks matches
  var tracks = [
    { title: 'Am jam', genre: 'rock', key: 'A', mode: 'minor', yt: 'aaaaaaaaaaa' },
    { title: 'C jam', genre: 'rock', key: 'C', mode: 'major', yt: 'bbbbbbbbbbb' },
    { title: 'F# blues', genre: 'blues', key: 'F#', mode: 'major', yt: 'ccccccccccc' }
  ];
  var out = T.filterTracks(tracks, 'all', 'A', T.normMode('Minor'));
  assert.strictEqual(out[0].track.title, 'Am jam', 'exact key match ranks first');
  // C major is A minor's relative -> it is a labelled related match, not dropped
  var c = out.filter(function (r) { return r.track.title === 'C jam'; })[0];
  assert.ok(c && c.rank > 0 && /relative/.test(c.why || ''), 'relative major surfaces, labelled');
});

// --- Practice Studio 4-mode fidelity: resolveScaleMode ---------------------
test('resolveScaleMode: capitalized inputs map to the right circle mode', function () {
  assert.strictEqual(T.resolveScaleMode('Minor'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('Dorian'), 'dorian');
  assert.strictEqual(T.resolveScaleMode('Mixolydian'), 'mixolydian');
});
test('resolveScaleMode: lowercase family + mode names', function () {
  assert.strictEqual(T.resolveScaleMode('minor'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('major'), 'ionian');
  assert.strictEqual(T.resolveScaleMode('aeolian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('ionian'), 'ionian');
  assert.strictEqual(T.resolveScaleMode('dorian'), 'dorian');
  assert.strictEqual(T.resolveScaleMode('mixolydian'), 'mixolydian');
});
test('resolveScaleMode: missing/undefined defaults to ionian (safe major)', function () {
  assert.strictEqual(T.resolveScaleMode(undefined), 'ionian');
  assert.strictEqual(T.resolveScaleMode(null), 'ionian');
  assert.strictEqual(T.resolveScaleMode(''), 'ionian');
});
test('resolveScaleMode: unsupported modes coarsen to their major/minor family', function () {
  // phrygian is minor-family -> aeolian (NOT ionian - the original bug), lydian major-family -> ionian
  assert.strictEqual(T.resolveScaleMode('phrygian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('Phrygian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('locrian'), 'aeolian');
  assert.strictEqual(T.resolveScaleMode('lydian'), 'ionian');
});
test('resolveScaleMode: the reported bug - A Minor no longer renders a major scale', function () {
  // regression: 'Minor' used to fall through familyMode()==='ionian', lighting C#/G#.
  // Now it resolves to aeolian, whose A-scale is A B C D E F G (no sharps).
  var pcs = T.notesToPcs(Circle.scale('A', T.resolveScaleMode('Minor')));
  assert.deepStrictEqual(pcs, [9, 11, 0, 2, 4, 5, 7]);
});
test('resolveScaleMode: A Dorian and G Mixolydian light their true modal tones', function () {
  // A dorian = A B C D E F# G  (raised 6th vs aeolian)
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('A', T.resolveScaleMode('Dorian'))), [9, 11, 0, 2, 4, 6, 7]);
  // G mixolydian = G A B C D E F  (lowered 7th vs ionian)
  assert.deepStrictEqual(T.notesToPcs(Circle.scale('G', T.resolveScaleMode('Mixolydian'))), [7, 9, 11, 0, 2, 4, 5]);
});

/* ---------- studioTheory wiring (the real Studio path, not just resolveScaleMode) ---------- */
test('studioTheory: A Dorian renders a true dorian scale (F#, natural G)', function () {
  var th = T.studioTheory('A', 'Dorian');
  assert.ok(th, 'theory bundle should resolve');
  assert.strictEqual(th.scaleMode, 'dorian');
  assert.deepStrictEqual(th.notes, ['A', 'B', 'C', 'D', 'E', 'F#', 'G']);
});
test('studioTheory: G Mixolydian renders a true mixolydian scale (natural F)', function () {
  var th = T.studioTheory('G', 'Mixolydian');
  assert.strictEqual(th.scaleMode, 'mixolydian');
  assert.deepStrictEqual(th.notes, ['G', 'A', 'B', 'C', 'D', 'E', 'F']);
});
test('studioTheory: capitalized Minor is aeolian, never ionian (the regression)', function () {
  var th = T.studioTheory('A', 'Minor');
  assert.strictEqual(th.scaleMode, 'aeolian');
  assert.deepStrictEqual(th.notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
});
test('studioTheory: diatonic chords + degrees follow the resolved mode', function () {
  var th = T.studioTheory('A', 'Dorian');
  assert.strictEqual(th.chords.length, 7);
  assert.strictEqual(th.degrees.length, 7);
  assert.strictEqual(th.pcs.length, 7);
});
test('studioTheory: unresolvable key returns null (caller falls back to player/search)', function () {
  assert.strictEqual(T.studioTheory('H', 'major'), null);
});

/* ---------- M-GUIDE W2: Blues studioTheory/resolveScaleMode wiring ---------- */
test('resolveScaleMode: blues resolves explicitly (not coarsened to major/minor family)', function () {
  assert.strictEqual(T.resolveScaleMode('blues'), 'blues');
  assert.strictEqual(T.resolveScaleMode('Blues'), 'blues'); // case-insensitive, matches every other branch
});
test('studioTheory: blues branches to the solo blues scale + BLUES_KEY palette, not diatonic()', function () {
  var th = T.studioTheory('A', 'blues');
  assert.strictEqual(th.scaleMode, 'blues');
  assert.strictEqual(th.label, 'Blues');
  assert.deepStrictEqual(th.notes, Circle.soloScaleInKey('A', 'blues', 'blues'));
  assert.deepStrictEqual(th.degrees, Circle.soloScaleDegrees('blues'));
  assert.strictEqual(th.pcs.length, 6);
  // chords come from Circle.bluesKey (I7/IV7/V7), never Circle.diatonic
  assert.deepStrictEqual(th.chords, Circle.bluesKey('A'));
  assert.strictEqual(th.chords.length, 3);
  assert.deepStrictEqual(th.chords.map(function (c) { return c.chord; }), ['A7', 'D7', 'E7']);
});
test('studioTheory: blues (capitalized, as songKey.mode carries it) resolves identically to lowercase', function () {
  assert.deepStrictEqual(T.studioTheory('C', 'Blues'), T.studioTheory('C', 'blues'));
});
test('studioTheory: blues unresolvable key returns null (same contract as every other mode)', function () {
  assert.strictEqual(T.studioTheory('H', 'blues'), null);
});

/* ---------- S-BLUES: soloBundle (Studio scale-chip swap, SOLO LAYER ONLY) ---------- */
test("soloBundle: scaleId 'mode' is identical to studioTheory (no reimplementation)", function () {
  var th = T.studioTheory('A', 'minor');
  var bundle = T.soloBundle('A', 'minor', 'mode');
  assert.deepStrictEqual(bundle, { notes: th.notes, pcs: th.pcs, degrees: th.degrees, label: th.label });
});
test('soloBundle: a falsy scaleId also delegates to studioTheory (default chip)', function () {
  var th = T.studioTheory('G', 'major');
  assert.deepStrictEqual(T.soloBundle('G', 'major', null), { notes: th.notes, pcs: th.pcs, degrees: th.degrees, label: th.label });
});
test('soloBundle: pentMajor/pentMinor/blues route through Circle.soloScale, not studioTheory', function () {
  var pm = T.soloBundle('A', 'major', 'pentMajor');
  assert.deepStrictEqual(pm.notes, Circle.soloScaleInKey('A', 'pentMajor', 'major'));
  assert.deepStrictEqual(pm.degrees, Circle.soloScaleDegrees('pentMajor'));
  assert.strictEqual(pm.label, 'Pent major');
  assert.strictEqual(pm.pcs.length, 5);

  var mn = T.soloBundle('A', 'minor', 'pentMinor');
  assert.deepStrictEqual(mn.notes, Circle.soloScaleInKey('A', 'pentMinor', 'minor'));
  assert.strictEqual(mn.label, 'Pent minor');
  assert.strictEqual(mn.pcs.length, 5);

  var bl = T.soloBundle('A', 'minor', 'blues');
  assert.deepStrictEqual(bl.notes, ['A', 'C', 'D', 'Eb', 'E', 'G']); // FORK-4 removal: key-aware blue note (b5 = Eb, never D#)
  assert.strictEqual(bl.label, 'Blues');
  assert.strictEqual(bl.pcs.length, 6);
});
test('soloBundle: unresolvable key -> null for every scaleId, including mode', function () {
  assert.strictEqual(T.soloBundle('H', 'major', 'mode'), null);
  assert.strictEqual(T.soloBundle('H', 'major', 'blues'), null);
});
test('soloBundle: unknown scaleId -> null (safe; never throws)', function () {
  assert.strictEqual(T.soloBundle('A', 'minor', 'nonsense'), null);
});

/* ---------- S-BLUES-BOXES: boxScaleIdFor (which chip selections are box-eligible) ---------- */
test('boxScaleIdFor: an explicit pentMajor/pentMinor/blues chip is always box-eligible, regardless of the underlying mode', function () {
  assert.strictEqual(T.boxScaleIdFor('pentMajor', 'ionian'), 'pentMajor');
  assert.strictEqual(T.boxScaleIdFor('pentMinor', 'aeolian'), 'pentMinor');
  assert.strictEqual(T.boxScaleIdFor('blues', 'dorian'), 'blues');
});
test('boxScaleIdFor: the mode chip is box-eligible ONLY when the track\'s own mode IS blues (M-GUIDE W2)', function () {
  assert.strictEqual(T.boxScaleIdFor('mode', 'blues'), 'blues');
});
test('boxScaleIdFor: the mode chip stays non-box for every 7-note mode (ionian/aeolian/dorian/mixolydian)', function () {
  ['ionian', 'aeolian', 'dorian', 'mixolydian'].forEach(function (m) {
    assert.strictEqual(T.boxScaleIdFor('mode', m), null, m + ' should not be box-eligible');
  });
});
test('boxScaleIdFor: falsy scaleId behaves like \'mode\' (soloBundle\'s own falsy contract)', function () {
  assert.strictEqual(T.boxScaleIdFor(null, 'blues'), 'blues');
  assert.strictEqual(T.boxScaleIdFor(undefined, 'ionian'), null);
});
test('boxScaleIdFor: an unknown non-mode scaleId is never box-eligible (safe)', function () {
  assert.strictEqual(T.boxScaleIdFor('nonsense', 'ionian'), null);
});
// soloScaleFraming MOVED to solo-guide.js (M-GUIDE W3a, D-CARDS-STATIC) as
// SoloGuide.framing() - its coverage now lives in test/solo-guide.test.js.

/* ---------- M-GUIDE W3a (section 2, P5-folded 2026-07-05): targetTones /
 * defaultTones - chord-tone targeting, pure pc arithmetic. C blues scale pcs
 * (Circle.soloScale('C','blues')): [0, 3, 5, 6, 7, 10] = C D# F F# G A#.
 * GHOST DOTS (P5 fold): a chord tone OUTSIDE the scale is no longer silently
 * dropped (the original D-TARGET "intersection-only" deferral) - it comes back
 * as ghostPcs so the caller can render it hollow. ---------- */
test('targetTones: C7 over C blues - root/chord marks, rub at D#(Eb); E (major 3rd) is now a GHOST pc (P5 fold)', function () {
  var scalePcs = Circle.soloScale('C', 'blues').map(function (n) { return T.notesToPcs([n])[0]; });
  var tt = T.targetTones(scalePcs, 0, 'C7');
  assert.deepStrictEqual(tt.byPc, { 0: 'root', 7: 'chord', 10: 'chord' }, JSON.stringify(tt.byPc));
  assert.strictEqual(tt.rubPc, 3, 'rub should land on D#/Eb (chordRootPc+3)');
  assert.deepStrictEqual(tt.ghostPcs, [4], 'E (the major 3rd, pc 4) is outside C blues -> ghost, not dropped');
});
test('targetTones: G7 over C blues - rub at A#(Bb); B and D (pcs 11, 2) are ghosts, matching the plan\'s worked example', function () {
  var scalePcs = Circle.soloScale('C', 'blues').map(function (n) { return T.notesToPcs([n])[0]; });
  var tt = T.targetTones(scalePcs, 0, 'G7');
  assert.deepStrictEqual(tt.byPc, { 7: 'root', 5: 'chord' });
  assert.strictEqual(tt.rubPc, 10, 'rub should land on A#/Bb');
  assert.deepStrictEqual(tt.ghostPcs.slice().sort(function (a, b) { return a - b; }), [2, 11]);
});
test('targetTones: F7 over C blues - dominant-quality but the rub candidate (Ab) is out of scale -> no rub; A (pc 9) is a ghost', function () {
  var scalePcs = Circle.soloScale('C', 'blues').map(function (n) { return T.notesToPcs([n])[0]; });
  var tt = T.targetTones(scalePcs, 0, 'F7');
  assert.deepStrictEqual(tt.byPc, { 5: 'root', 0: 'chord', 3: 'chord' });
  assert.strictEqual(tt.rubPc, null, 'F7\'s rub candidate (Ab, pc 8) is not in the C blues scale');
  assert.deepStrictEqual(tt.ghostPcs, [9]);
});
test('targetTones: A blues + A7 -> C# (pc 1, the major 3rd - "the money note") is a ghost (P5\'s exact must-fix example)', function () {
  var scalePcs = Circle.soloScale('A', 'blues').map(function (n) { return T.notesToPcs([n])[0]; });
  var tt = T.targetTones(scalePcs, 9, 'A7');
  assert.deepStrictEqual(tt.ghostPcs, [1], 'C# (pc 1) must surface as a ghost, not be silently hidden');
  assert.strictEqual(tt.byPc[9], 'root');
});
test('targetTones: falsy/unresolvable chordName -> null (no target)', function () {
  assert.strictEqual(T.targetTones([0, 4, 7], 0, null), null);
  assert.strictEqual(T.targetTones([0, 4, 7], 0, ''), null);
  assert.strictEqual(T.targetTones([0, 4, 7], 0, 'Zmaj7'), null);
});
test('targetTones: no scale-pc intersection -> every chord tone surfaces as a ghost, never throws', function () {
  var tt = T.targetTones([], 0, 'C7');
  assert.deepStrictEqual(tt.byPc, {});
  assert.strictEqual(tt.rubPc, null);
  assert.deepStrictEqual(tt.ghostPcs.slice().sort(function (a, b) { return a - b; }), [0, 4, 7, 10]);
});
test('defaultTones: marks the blues scale\'s b5 (scaleRootPc+6) whenever bundle.label is Blues', function () {
  var bundle = { label: 'Blues', pcs: [0, 3, 5, 6, 7, 10] };
  assert.deepStrictEqual(T.defaultTones(bundle), { byPc: { 6: 'blue' }, rubPc: null });
});
test('defaultTones: non-blues bundle (or missing/empty pcs) -> null', function () {
  assert.strictEqual(T.defaultTones({ label: 'Ionian', pcs: [0, 2, 4, 5, 7, 9, 11] }), null);
  assert.strictEqual(T.defaultTones(null), null);
  assert.strictEqual(T.defaultTones({ label: 'Blues', pcs: [] }), null);
});
test('defaultTones works uniformly for a soloBundle()-shaped bundle (no rootPc field, just pcs)', function () {
  var bundle = T.soloBundle('A', 'minor', 'blues'); // {notes, pcs, degrees, label} - no rootPc
  assert.strictEqual(bundle.label, 'Blues');
  var def = T.defaultTones(bundle);
  assert.ok(def, 'expected a blue-note mark for a blues soloBundle result');
  assert.strictEqual(Object.keys(def.byPc).length, 1);
});

test('harmonization-isolation: chords-in-key are identical before and after any solo-scale selection', function () {
  var before = T.studioTheory('A', 'minor').chords;
  // Exercise every non-mode scaleId - none of them may read or mutate diatonic()/chords.
  ['pentMajor', 'pentMinor', 'blues'].forEach(function (scaleId) { T.soloBundle('A', 'minor', scaleId); });
  var after = T.studioTheory('A', 'minor').chords;
  assert.deepStrictEqual(after, before, 'chords-in-key must be untouched by any solo-scale chip tap');
});
test('harmonization-isolation (M-GUIDE W2): a Blues-mode Studio\'s own I7/IV7/V7 chords survive every solo-scale chip tap', function () {
  var before = T.studioTheory('A', 'blues').chords;
  ['pentMajor', 'pentMinor'].forEach(function (scaleId) { T.soloBundle('A', 'blues', scaleId); });
  var after = T.studioTheory('A', 'blues').chords;
  assert.deepStrictEqual(after, before, 'a Blues studioTheory\'s chords-in-key (BLUES_KEY) must be untouched by any solo-scale chip tap');
});

/* ---------- overlay re-key migration (catalog-key corrections must not orphan
 * a user's curated urls: trackKey embeds the key, so the stored key moves) ---------- */
test('migrateUrls re-keys a legacy overlay entry and deletes the old key', function () {
  var o = { 'sample in a jar|phish|G|major': 'vid1' };
  assert.strictEqual(T.migrateUrls(o), true);
  assert.deepStrictEqual(o, { 'sample in a jar|phish|A|major': 'vid1' });
});
test('migrateUrls never clobbers an entry already saved under the new key', function () {
  var o = { 'sample in a jar|phish|G|major': 'old', 'sample in a jar|phish|A|major': 'new' };
  assert.strictEqual(T.migrateUrls(o), true); // old key still deleted
  assert.deepStrictEqual(o, { 'sample in a jar|phish|A|major': 'new' });
});
test('migrateUrls is a no-op (returns false, no save-back) when nothing is legacy', function () {
  var o = { 'blues in a|x|A|minor': 'keep' };
  assert.strictEqual(T.migrateUrls(o), false);
  assert.deepStrictEqual(o, { 'blues in a|x|A|minor': 'keep' });
  assert.strictEqual(T.migrateUrls({}), false);
});
test('migrateUrls re-keys a modal overlay saved under the old coarsened-major identity', function () {
  var o = { 'santana dorian jam in e minor|search|E|major': 'vidD' };
  assert.strictEqual(T.migrateUrls(o), true);
  assert.deepStrictEqual(o, { 'santana dorian jam in e minor|search|E|dorian': 'vidD' });
});

// --- modal tracks in the keyed finder (the invisible-dorian bug) -----------
test('a dorian track surfaces in its minor-family keyed search', function () {
  var tracks = [{ title: 'Santana style', genre: 'latin', key: 'E', mode: 'dorian', yt: 'x' }];
  var out = T.filterTracks(tracks, 'all', 'E', 'minor');
  assert.strictEqual(out.length, 1, 'dorian track must be visible in an E-minor-family search');
  assert.strictEqual(out[0].rank, 0, 'same-root modal track is an exact-family match');
});
test('a mixolydian track surfaces in its major-family keyed search', function () {
  var tracks = [{ title: 'Dead style', genre: 'jam', key: 'G', mode: 'mixolydian', yt: 'x' }];
  var out = T.filterTracks(tracks, 'all', 'G', 'major');
  assert.strictEqual(out.length, 1, 'mixolydian track must be visible in a G-major-family search');
});

// --- trackKey 4-mode serialization (overlay identity) -----------------------
test('trackKey serializes the full 5-mode vocabulary distinctly (incl. blues, M-GUIDE W2)', function () {
  var base = { title: 'X', artist: 'Y', key: 'E' };
  var kMaj = T.trackKey(Object.assign({}, base, { mode: 'major' }));
  var kDor = T.trackKey(Object.assign({}, base, { mode: 'dorian' }));
  var kMix = T.trackKey(Object.assign({}, base, { mode: 'mixolydian' }));
  var kBlu = T.trackKey(Object.assign({}, base, { mode: 'blues' }));
  assert.ok(/\|major$/.test(kMaj) && /\|dorian$/.test(kDor) && /\|mixolydian$/.test(kMix) && /\|blues$/.test(kBlu));
  assert.notStrictEqual(kDor, kMaj); // the collision codex flagged
  assert.strictEqual(T.trackKey(Object.assign({}, base, { mode: 'weird' })), kMaj); // unknown -> major
});
test('trackKey: blues identity does not collide with major (professor finding, PR #115) - IDENTITY only, normMode facet coarsening unchanged', function () {
  var kBlu = T.trackKey({ title: 'X', artist: 'Y', key: 'A', mode: 'blues' });
  var kMaj = T.trackKey({ title: 'X', artist: 'Y', key: 'A', mode: 'major' });
  assert.notStrictEqual(kBlu, kMaj, 'a saved/curated blues track must not collide with a same-title/artist/key major row');
  // the Library/finder FACET coarsening (normMode) is a SEPARATE, unchanged concern -
  // blues still coarsens to the major family there, per the IA ruling.
  assert.strictEqual(T.normMode('blues'), 'major');
});

// --- mode-honest key labels everywhere a key renders as text ----------------
test('keyLabelFor matches the Studio label convention', function () {
  assert.strictEqual(T.keyLabelFor('A', 'major'), 'A');
  assert.strictEqual(T.keyLabelFor('A', 'minor'), 'Am');
  assert.strictEqual(T.keyLabelFor('E', 'dorian'), 'E dorian');
  assert.strictEqual(T.keyLabelFor('G', 'Mixolydian'), 'G mixolydian');
  assert.strictEqual(T.keyLabelFor('C', null), 'C');
});
test('keyLabelFor: blues reads "<key> blues" (M-GUIDE W2) - previously fell through to the bare key', function () {
  assert.strictEqual(T.keyLabelFor('A', 'blues'), 'A blues');
  assert.strictEqual(T.keyLabelFor('D', 'Blues'), 'D blues'); // case-insensitive like every other branch
});

/* ---------- modeHint "often written Bb" gate (codex V2 fix, V3 test ask) ----------
 * modeHint is closure-bound in mount(), so extract the SHARP2FLAT table + the
 * alt-expression from the source and assert the gate: the flat hint fires ONLY
 * for LOWERED sharp notes (lowered 7th -> "often written Bb"); a RAISED note
 * (lydian/dorian F#) must never claim "often written Gb". */
test('lesson flat-hint fires only for lowered sharp notes (extraction guard)', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'tracks.js'), 'utf8');
  var mapM = /var SHARP2FLAT = \{[^}]*\};/.exec(src);
  var altM = /var alt = \(c\.dir === 'lower' && SHARP2FLAT\[c\.to\]\)[^;]*;/.exec(src);
  assert.ok(mapM, 'SHARP2FLAT table not found in tracks.js modeHint');
  assert.ok(altM, "lowered-only alt gate not found (dir === 'lower' check missing?)");
  var altFor = new Function('c', 'esc', mapM[0] + '\n' + altM[0] + '\nreturn alt;');
  var esc = function (x) { return String(x); };
  assert.strictEqual(altFor({ dir: 'lower', to: 'A#' }, esc), ', often written Bb');
  assert.strictEqual(altFor({ dir: 'raise', to: 'F#' }, esc), '');   // lydian 4th: never "Gb"
  assert.strictEqual(altFor({ dir: 'lower', to: 'F' }, esc), '');    // natural target: no hint
});

/* ---------- customSearchQuery + tintWheel (codex #89 volley-1) ---------- */
test('customSearchQuery folds genre + progression into the query, skipping junk tokens', function () {
  assert.strictEqual(
    T.customSearchQuery({ artist: 'Me', title: 'Jam 1', genre: 'blues', seq: ['Dm', 'A#', 'C'] }),
    'Me Jam 1 blues Dm A# C backing track');
  // no genre, no seq -> still a sane query
  assert.strictEqual(T.customSearchQuery({ title: 'Idea' }), 'Idea backing track');
  // empty/whitespace chord tokens are dropped (user-edited progressions)
  assert.strictEqual(
    T.customSearchQuery({ title: 'X', seq: ['Dm', '', '  ', 'C'] }),
    'X Dm C backing track');
  // empty seq array behaves like no seq
  assert.strictEqual(T.customSearchQuery({ title: 'X', seq: [] }), 'X backing track');
  // and it URL-encodes cleanly through youtubeSearchUrl (the # in A# survives encoding)
  var url = T.youtubeSearchUrl(T.customSearchQuery({ title: 'X', seq: ['A#'] }));
  assert.ok(url.indexOf('A%23') >= 0, url);
});

/* DOM stub rich enough to run the REAL Circle.renderWheel (createElementNS,
 * setAttribute, appendChild, addEventListener, classList) so the tint test
 * pins the ACTUAL render contract - a render-order change fails here instead
 * of silently dropping the tint at runtime (codex #89 V2). */
function domEl(tag) {
  var attrs = {}, children = [];
  var el = {
    tagName: tag, attrs: attrs, children: children, textContent: '',
    style: {}, previousElementSibling: null, className: '',
    setAttribute: function (k, v) {
      attrs[k] = String(v);
      if (k === 'class') el.className = String(v);
    },
    getAttribute: function (k) { return attrs[k] != null ? attrs[k] : null; },
    appendChild: function (c) {
      c.previousElementSibling = children.length ? children[children.length - 1] : null;
      children.push(c); return c;
    },
    addEventListener: function () {},
    classList: {
      contains: function (c) { return el.className.split(/\s+/).indexOf(c) >= 0; },
      add: function (c) { if (!el.classList.contains(c)) el.className = (el.className + ' ' + c).trim(); }
    },
    querySelectorAll: function (sel) {
      var cls = sel.replace('.', ''), out = [];
      (function walk(n) {
        n.children.forEach(function (c) {
          if (c.classList.contains(cls)) out.push(c);
          walk(c);
        });
      })(el);
      return out;
    }
  };
  return el;
}
function realWheel(C, key, mode) {
  var origDoc = global.document;
  global.document = {
    createElement: function (t) { return domEl(t); },
    createElementNS: function (ns, t) { return domEl(t); }
  };
  try { return C.renderWheel({ selected: { root: key, mode: mode } }); }
  finally { global.document = origDoc; }
}
test('tintWheel marks the relative key strong + V/IV dim on the REAL renderWheel output', function () {
  var C = require('../music/shared/circle.js');
  var wheel = realWheel(C, 'A', 'major');
  T.tintWheel(wheel, C, 'A', 'major');
  function wedgeClasses(labelText) {
    var labels = wheel.querySelectorAll('.cofLabel');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent === labelText) {
        var w = labels[i].previousElementSibling;
        return (w && w.classList.contains('cofWedge')) ? w.className : '(no wedge sibling)';
      }
    }
    return '(label missing)';
  }
  assert.ok(wedgeClasses('F#m').indexOf('cofWedge-rel') >= 0, 'relative minor F#m: ' + wedgeClasses('F#m'));
  assert.ok(wedgeClasses('E').indexOf('cofWedge-nb') >= 0, 'V (E): ' + wedgeClasses('E'));
  assert.ok(wedgeClasses('D').indexOf('cofWedge-nb') >= 0, 'IV (D): ' + wedgeClasses('D'));
  assert.ok(wedgeClasses('A').indexOf('cofWedge-rel') < 0, 'tonic untinted');
});
/* ---------- S-COF-SPELLING: wheel labels are preferred KEY names ---------- */
test('wheelLabel: printed-COF truth table (flat-preferred majors, conventional minors)', function () {
  var C = require('../music/shared/circle.js');
  assert.strictEqual(C.wheelLabel('A#', 'major'), 'Bb');
  assert.strictEqual(C.wheelLabel('D#', 'major'), 'Eb');
  assert.strictEqual(C.wheelLabel('G#', 'major'), 'Ab');
  assert.strictEqual(C.wheelLabel('C#', 'major'), 'Db');
  assert.strictEqual(C.wheelLabel('F#', 'major'), 'F#');
  assert.strictEqual(C.wheelLabel('A#', 'minor'), 'Bbm');
  assert.strictEqual(C.wheelLabel('D#', 'minor'), 'D#m');
  assert.strictEqual(C.wheelLabel('G#', 'minor'), 'G#m');
  assert.strictEqual(C.wheelLabel('C#', 'minor'), 'C#m');
});
test('renderWheel: labels carry preferred key names + wedges carry data-pc/data-ring identity', function () {
  var C = require('../music/shared/circle.js');
  var wheel = realWheel(C, 'C', 'major');
  var texts = [];
  var nodes = wheel.querySelectorAll('.cofLabel');
  for (var i = 0; i < nodes.length; i++) texts.push(nodes[i].textContent);
  ['Bb', 'Eb', 'Ab', 'Db', 'Bbm', 'D#m', 'G#m'].forEach(function (want) {
    assert.ok(texts.indexOf(want) >= 0, 'label present: ' + want);
  });
  ['A#', 'D#', 'G#', 'C#', 'A#m'].forEach(function (bad) {
    assert.ok(texts.indexOf(bad) < 0, 'sharp-only label absent: ' + bad);
  });
  // structural identity for consumers (markWheelPc): Bb major wedge = pc 10, major ring
  for (var j = 0; j < nodes.length; j++) {
    if (nodes[j].textContent === 'Bb') {
      var w = nodes[j].previousElementSibling;
      assert.strictEqual(w.getAttribute('data-pc'), '10', 'Bb wedge data-pc');
      assert.strictEqual(w.getAttribute('data-ring'), 'major', 'Bb wedge data-ring');
      return;
    }
  }
  assert.fail('Bb label not found for identity check');
});
test('tintWheel matches the NEW preferred labels (A# major: rel Gm strong, F + Eb dim)', function () {
  var C = require('../music/shared/circle.js');
  var wheel = realWheel(C, 'A#', 'major');
  T.tintWheel(wheel, C, 'A#', 'major');
  function cls(labelText) {
    var labels = wheel.querySelectorAll('.cofLabel');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent === labelText) {
        var w = labels[i].previousElementSibling;
        return (w && w.classList.contains('cofWedge')) ? w.className : '(no wedge sibling)';
      }
    }
    return '(label missing)';
  }
  assert.ok(cls('Gm').indexOf('cofWedge-rel') >= 0, 'relative minor Gm: ' + cls('Gm'));
  assert.ok(cls('F').indexOf('cofWedge-nb') >= 0, 'V (F): ' + cls('F'));
  assert.ok(cls('Eb').indexOf('cofWedge-nb') >= 0, 'IV (Eb): ' + cls('Eb'));
});
/* keep a tiny hand stub only for the graceful-degradation case */
function stubWheel(labels) {
  var nodes = labels.map(function (txt) {
    var wedge = domEl('path'); wedge.setAttribute('class', 'cofWedge');
    var label = domEl('text'); label.setAttribute('class', 'cofLabel');
    label.textContent = txt; label.previousElementSibling = wedge;
    return label;
  });
  return { nodes: nodes, querySelectorAll: function (sel) { return sel === '.cofLabel' ? nodes : []; } };
}
test('tintWheel survives a wheel with unexpected labels (no throw, no tint)', function () {
  var C = require('../music/shared/circle.js');
  var wheel = stubWheel(['nonsense', 'labels']);
  T.tintWheel(wheel, C, 'A', 'major'); // must not throw
  assert.strictEqual(wheel.nodes[0].previousElementSibling.className, 'cofWedge');
});

/* ---------- S-WHYNOTE (sprint-1 item 6): static template selection ---------- */
test('whynoteText: major-family (ionian) uses the exact A9-specified relative-minor template', function () {
  assert.strictEqual(
    T.whynoteText('C', 'ionian', 'Major'),
    'Why this scale works: C major and its relative minor share the same notes - solo either over this progression.');
});
test('whynoteText: minor (aeolian) uses the parallel-phrased equivalent', function () {
  assert.strictEqual(
    T.whynoteText('A', 'aeolian', 'Minor'),
    'Why this scale works: A minor and its parallel major share the same home note, not the same notes - stick with A minor here.');
});
test('whynoteText: dorian and mixolydian share the same non-ionian template shape', function () {
  assert.strictEqual(
    T.whynoteText('E', 'dorian', 'Dorian'),
    'Why this scale works: E dorian and its parallel major share the same home note, not the same notes - stick with E dorian here.');
  assert.strictEqual(
    T.whynoteText('G', 'mixolydian', 'Mixolydian'),
    'Why this scale works: G mixolydian and its parallel major share the same home note, not the same notes - stick with G mixolydian here.');
});
test('whynoteText: only two templates exist - the switch is on scaleMode, nothing else', function () {
  // same key+label, only scaleMode flips -> exactly the two known bodies, never a third shape
  var ionian = T.whynoteText('D', 'ionian', 'Major');
  var aeolian = T.whynoteText('D', 'aeolian', 'Minor');
  assert.notStrictEqual(ionian, aeolian);
  assert.ok(/relative minor/.test(ionian));
  assert.ok(/parallel major/.test(aeolian));
});

/* ---------- S-WHYNOTE: claim/dismiss consumer logic (via Notables) ----------
 * M-GUIDANCE retro-tagged 'whynote' as intermediate+advanced in notables.js's
 * LEVELS table (docs/plans/guidance-levels-spec-20260705.md) - every case
 * below that expects a GRANT now seeds music.guidanceLevel.v1 first (via the
 * real guidance-level.js module, same localStorage fake). */
test('whynoteBanner: a fresh, un-dismissed slot grants renderBanner-ready opts', function () {
  resetLocalStorage();
  GuidanceLevel.set('intermediate');
  Notables._resetArbitration();
  var th = T.studioTheory('C', 'major');
  var opts = T.whynoteBanner(th);
  assert.ok(opts, 'expected a granted banner on a fresh claim');
  assert.strictEqual(opts.consumerId, 'whynote');
  assert.strictEqual(opts.className, 'bt-st-notable');
  assert.strictEqual(opts.text, T.whynoteText('C', 'ionian', 'Major'));
});
test('whynoteBanner: a repeat call while still un-dismissed keeps granting (idempotent re-claim)', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced');
  Notables._resetArbitration();
  var th = T.studioTheory('C', 'major');
  assert.ok(T.whynoteBanner(th), 'first open of the Studio grants the slot');
  assert.ok(T.whynoteBanner(th), 'reopening the Studio before dismissal grants it again');
});
test('whynoteBanner: dismiss() persists forever - a later call skips silently (returns null)', function () {
  resetLocalStorage();
  GuidanceLevel.set('intermediate');
  Notables._resetArbitration();
  var th = T.studioTheory('A', 'minor');
  assert.ok(T.whynoteBanner(th));
  Notables.dismiss('whynote');
  assert.strictEqual(T.whynoteBanner(th), null, 'a dismissed whynote must never render again');
});
test('whynoteBanner: a higher-priority notable (firstrun) already holding the slot preempts it', function () {
  resetLocalStorage();
  GuidanceLevel.set('intermediate');
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun', undefined, 'beginner'), true); // firstrun outranks whynote in PRIORITY
  var th = T.studioTheory('G', 'major');
  assert.strictEqual(T.whynoteBanner(th), null, 'whynote must skip silently while firstrun holds the slot');
});
/* ---------- M-GUIDANCE: whynote's level gate specifically ---------- */
test('whynoteBanner: blocked for beginner or an unset level (intermediate+advanced only)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  var th = T.studioTheory('C', 'major');
  assert.strictEqual(T.whynoteBanner(th), null, 'unset level must not grant whynote');
  GuidanceLevel.set('beginner');
  Notables._resetArbitration();
  assert.strictEqual(T.whynoteBanner(th), null, 'beginner level must not grant whynote');
});

/* ---------------------------------------------------------------------
 * M-GUIDANCE (advanced tier): T.scaletipText/T.scaletipBanner - the Studio
 * "scale chips work over any chord in the key" JIT cue. Same shape as
 * whynoteText/whynoteBanner above.
 * ------------------------------------------------------------------- */
test('scaletipText interpolates the key', function () {
  assert.strictEqual(
    T.scaletipText('C'),
    'Try the scale chips below - Pent major, Pent minor, and Blues all fit over C too. The fretboard pattern is the guide.'
  );
});
/* ---------------------------------------------------------------------
 * S-UI-RECONCILE Lane C (C3): scaletipText hardcoded 'major' when respelling
 * the key, so a minor-key Studio's tip named the MAJOR-preferred spelling
 * even when it differs from the minor-preferred one (G# minor -> "fit over
 * Ab too", wrong; every other Studio surface says G#m). Threading the real
 * scaleMode fixes it; the no-mode 1-arg call above must stay byte-identical
 * (modeKey(undefined) already falls back to ionian, same as the old
 * hardcoded 'major').
 * ------------------------------------------------------------------- */
test('scaletipText: S-UI-RECONCILE C3 - threading the real scaleMode fixes a minor key whose major- and minor-preferred spellings diverge (G# minor)', function () {
  var th = T.studioTheory('G#', 'minor');
  assert.strictEqual(th.scaleMode, 'aeolian');
  assert.strictEqual(
    T.scaletipText(th.key, th.scaleMode),
    'Try the scale chips below - Pent major, Pent minor, and Blues all fit over G# too. The fretboard pattern is the guide.'
  );
  // the pre-fix bug, pinned so it never comes back: hardcoding 'major' would
  // have produced the WRONG spelling (Ab) for this minor key.
  assert.notStrictEqual(T.scaletipText(th.key, th.scaleMode), T.scaletipText(th.key));
  assert.ok(!/Ab/.test(T.scaletipText(th.key, th.scaleMode)), 'must not leak the major-preferred spelling into a minor-key tip');
});
test('scaletipText: omitting mode (1-arg call) stays byte-identical to before the fix (modeKey(undefined) falls back to ionian, same as the old hardcoded "major")', function () {
  assert.strictEqual(
    T.scaletipText('C'),
    'Try the scale chips below - Pent major, Pent minor, and Blues all fit over C too. The fretboard pattern is the guide.'
  );
});
test('scaletipBanner: granted for level advanced on a fresh, empty slot', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced');
  Notables._resetArbitration();
  var th = T.studioTheory('D', 'major');
  var opts = T.scaletipBanner(th);
  assert.ok(opts, 'expected a granted banner on a fresh claim');
  assert.strictEqual(opts.consumerId, 'scaletip');
  assert.strictEqual(opts.className, 'bt-st-notable');
  assert.strictEqual(opts.text, T.scaletipText('D'));
});
test('scaletipBanner: blocked for beginner/intermediate/unset (advanced only)', function () {
  var th = T.studioTheory('D', 'major');
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(T.scaletipBanner(th), null, 'unset level must not grant scaletip');
  ['beginner', 'intermediate'].forEach(function (lvl) {
    resetLocalStorage();
    GuidanceLevel.set(lvl);
    Notables._resetArbitration();
    assert.strictEqual(T.scaletipBanner(th), null, lvl + ' must not grant scaletip');
  });
});
test('scaletipBanner: a higher-priority notable (whynote) already holding the slot preempts it, even when both are level-eligible', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced'); // eligible for BOTH whynote and scaletip
  Notables._resetArbitration();
  var th = T.studioTheory('E', 'major');
  assert.ok(T.whynoteBanner(th), 'whynote claims the slot first');
  assert.strictEqual(T.scaletipBanner(th), null, 'scaletip must skip silently while whynote holds the slot');
  Notables.dismiss('whynote');
  assert.ok(T.scaletipBanner(th), 'once whynote is dismissed, scaletip can claim on the next Studio open');
});
test('scaletipBanner: dismissed forever - a later call skips silently (returns null)', function () {
  resetLocalStorage();
  GuidanceLevel.set('advanced');
  Notables._resetArbitration();
  var th = T.studioTheory('F', 'major');
  assert.ok(T.scaletipBanner(th));
  Notables.dismiss('scaletip');
  assert.strictEqual(T.scaletipBanner(th), null, 'a dismissed scaletip must never render again');
});

/* =====================================================================
 * F32 (UI-std UAT): the Studio's dismiss is now the app's STANDARD back
 * affordance (matches the song view's #backLib "iconBtn <-"), not the old
 * bordered "close"-text pill (.bt-st-x, trailing on the right). openStudio's
 * DOM-building is Playwright/live-check territory (same convention this
 * file's siblings already use for mount/open-shaped output) - this pins the
 * SOURCE contract instead, mirroring songbook.test.js's existing
 * "solo-button gate pins hidden + inline display" source-regex test.
 * ===================================================================== */
test('F32: Studio dismiss is .bt-st-back (iconBtn, "<-" glyph, title=Back) - the old close-pill CLASS is retired from actual markup/selectors, not left dormant', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'tracks.js'), 'utf8');
  // Targets the actual CODE usages (a rendered class attribute, a live selector
  // call) rather than banning the bare substring outright - a comment
  // documenting the retirement (e.g. "bt-st-x removed - see tracks.css") is
  // fine to keep and should not fail this test.
  assert.ok(!/class="bt-st-x"/.test(src), 'the old close-pill class must not appear in any rendered markup');
  assert.ok(!/querySelector\('\.bt-st-x'\)/.test(src), 'no selector may still target the old close-pill class');
  assert.ok(/class="iconBtn bt-st-back"/.test(src), 'the Studio dismiss control must compose the shared .iconBtn convention (matches #backLib elsewhere)');
  assert.ok(/title="Back" aria-label="Back"/.test(src), 'the dismiss control must carry the standard Back label/aria-label, not "close"');
  assert.ok(/elPlayer\.querySelector\('\.bt-st-back'\)\.onclick/.test(src), 'the NavHistory.dismiss()/closePlayer() wiring must target the new .bt-st-back selector');
});

// ---- S-SOLO-MODES: Mixolydian + Dorian as selectable solo scales ----
test('soloScale mixolydian is the full 7-note mode (C -> C D E F G A A#)', function () {
  var notes = Circle.soloScale('C', 'mixolydian');
  assert.strictEqual(notes.length, 7, 'mixolydian has 7 notes');
  // canonical-sharp spelling (FORK-4): b7 renders as A#, never Bb
  assert.deepStrictEqual(notes, ['C', 'D', 'E', 'F', 'G', 'A', 'A#'], 'C mixolydian notes');
  assert.deepStrictEqual(Circle.soloScaleDegrees('mixolydian'), ['1', '2', '3', '4', '5', '6', '♭7'], 'mixolydian degrees');
});
test('soloScale dorian is the full 7-note mode (C -> C D D# F G A A#)', function () {
  var notes = Circle.soloScale('C', 'dorian');
  assert.strictEqual(notes.length, 7, 'dorian has 7 notes');
  assert.deepStrictEqual(notes, ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'], 'C dorian notes (b3=D#, b7=A#, canonical-sharp)');
  assert.deepStrictEqual(Circle.soloScaleDegrees('dorian'), ['1', '2', '♭3', '4', '5', '6', '♭7'], 'dorian degrees');
});
test('SoloGuide already ships cards for the two new modes (no blank Guide box)', function () {
  var SG = require('../music/shared/solo-guide.js');
  assert.ok(SG.card('mixolydian', Circle.soloScale('C', 'mixolydian'), 'C'), 'mixolydian Guide card exists');
  assert.ok(SG.card('dorian', Circle.soloScale('C', 'dorian'), 'C'), 'dorian Guide card exists');
});

// ---- S-SOLO-SCALE-DEFAULT: progression-aware theory-best default ----
test('inferSoloDefault: plain diatonic major progression -> pentMajor (safe home)', function () {
  assert.strictEqual(T.inferSoloDefault('C', 'Major', ['C', 'F', 'G', 'Am']), 'pentMajor');
});
test('inferSoloDefault: major progression with a bVII major -> mixolydian', function () {
  // C major with a Bb (bVII) is the Mixolydian tell (b7 rock/backdoor color)
  assert.strictEqual(T.inferSoloDefault('C', 'Major', ['C', 'Bb', 'F', 'C']), 'mixolydian');
});
test('inferSoloDefault: plain diatonic minor progression -> pentMinor', function () {
  assert.strictEqual(T.inferSoloDefault('A', 'Minor', ['Am', 'Dm', 'Em', 'Am']), 'pentMinor');
});
test('inferSoloDefault: minor progression with a MAJOR IV -> dorian', function () {
  // A minor with a D major (major IV, the raised-6) is the Dorian tell
  assert.strictEqual(T.inferSoloDefault('A', 'Minor', ['Am', 'D', 'Am', 'Em']), 'dorian');
});
test('inferSoloDefault: no seq falls back to the key-quality pentatonic', function () {
  assert.strictEqual(T.inferSoloDefault('C', 'Major', null), 'pentMajor');
  assert.strictEqual(T.inferSoloDefault('A', 'Minor', []), 'pentMinor');
});
test('inferSoloDefault: a Blues key keeps its own scale (mode chip IS blues)', function () {
  assert.strictEqual(T.inferSoloDefault('E', 'blues', ['E7', 'A7', 'B7']), 'mode');
});

/* ---------------------------------------------------------------------
 * G5 S-WHYNOTE-SCALE (2026-07-10): T.whynoteScaleText - the whynote banner
 * re-derives its copy for the ACTUALLY-selected scale chip, not just the
 * key's own mode scale.
 * ------------------------------------------------------------------- */
test('whynoteScaleText: scaleId "mode" (or falsy) passes straight through to whynoteText', function () {
  assert.strictEqual(
    T.whynoteScaleText('C', 'mode', 'ionian', 'Major'),
    T.whynoteText('C', 'ionian', 'Major')
  );
  assert.strictEqual(
    T.whynoteScaleText('A', undefined, 'aeolian', 'Minor'),
    T.whynoteText('A', 'aeolian', 'Minor')
  );
});
test('whynoteScaleText: pentMajor names itself and the key', function () {
  var txt = T.whynoteScaleText('C', 'pentMajor', 'ionian', 'Major');
  assert.ok(/Pent major/.test(txt), 'names the chip label');
  assert.ok(/\bC\b/.test(txt), 'names the key');
});
test('whynoteScaleText: pentMinor names itself and the key', function () {
  var txt = T.whynoteScaleText('A', 'pentMinor', 'aeolian', 'Minor');
  assert.ok(/Pent minor/.test(txt), 'names the chip label');
  assert.ok(/\bA\b/.test(txt), 'names the key');
});
test('whynoteScaleText: blues names itself and the key', function () {
  var txt = T.whynoteScaleText('E', 'blues', 'ionian', 'Major');
  assert.ok(/Blues/.test(txt), 'names the chip label');
  assert.ok(/\bE\b/.test(txt), 'names the key');
});
test('whynoteScaleText: mixolydian names itself and the key', function () {
  var txt = T.whynoteScaleText('G', 'mixolydian', 'ionian', 'Major');
  assert.ok(/Mixolydian/.test(txt), 'names the chip label');
  assert.ok(/\bG\b/.test(txt), 'names the key');
});
test('whynoteScaleText: dorian names itself and the key', function () {
  var txt = T.whynoteScaleText('D', 'dorian', 'ionian', 'Major');
  assert.ok(/Dorian/.test(txt), 'names the chip label');
  assert.ok(/\bD\b/.test(txt), 'names the key');
});
test('whynoteScaleText: flat-key display goes through dispKeyRoot (Bb, never A#)', function () {
  var txt = T.whynoteScaleText('A#', 'pentMinor', 'aeolian', 'Minor');
  assert.ok(/\bBb\b/.test(txt), 'expected the preferred flat spelling Bb');
  assert.ok(!/A#/.test(txt), 'must never show the canonical-sharp A# in prose');
});
test('whynoteScaleText: each non-mode scaleId produces a distinct template', function () {
  var ids = ['pentMajor', 'pentMinor', 'blues', 'mixolydian', 'dorian'];
  var texts = ids.map(function (id) { return T.whynoteScaleText('C', id, 'ionian', 'Major'); });
  assert.strictEqual(new Set(texts).size, ids.length, 'every scaleId gets its own copy, no accidental collisions');
});

/* ---------------------------------------------------------------------
 * G6 S-SCALE-MEMORY (2026-07-10): T.readSoloScaleFor / T.writeSoloScaleFor -
 * per-track solo-scale chip persistence (bt.soloScale.v1).
 * ------------------------------------------------------------------- */
test('readSoloScaleFor: a fresh/empty store returns null (no memory yet)', function () {
  resetLocalStorage();
  var t = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  assert.strictEqual(T.readSoloScaleFor(t), null);
});
test('writeSoloScaleFor + readSoloScaleFor: round-trips the chosen scaleId for that track', function () {
  resetLocalStorage();
  var t = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  T.writeSoloScaleFor(t, 'pentMinor');
  assert.strictEqual(T.readSoloScaleFor(t), 'pentMinor');
});
test('writeSoloScaleFor: is keyed per-track (trackKey) - a different track is unaffected', function () {
  resetLocalStorage();
  var t1 = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  var t2 = { title: 'Wonderwall', artist: 'Oasis', key: 'F#', mode: 'minor' };
  T.writeSoloScaleFor(t1, 'blues');
  assert.strictEqual(T.readSoloScaleFor(t1), 'blues');
  assert.strictEqual(T.readSoloScaleFor(t2), null, 'a different track must not inherit t1\'s stored scale');
});
test('writeSoloScaleFor: overwrites a previous choice for the same track', function () {
  resetLocalStorage();
  var t = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  T.writeSoloScaleFor(t, 'pentMajor');
  T.writeSoloScaleFor(t, 'dorian');
  assert.strictEqual(T.readSoloScaleFor(t), 'dorian');
});
test('readSoloScaleFor: tolerates invalid JSON in the store (defensive read -> null)', function () {
  resetLocalStorage();
  global.localStorage.setItem('bt.soloScale.v1', '{not valid json');
  var t = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  assert.strictEqual(T.readSoloScaleFor(t), null);
});
test('readSoloScaleFor: tolerates a non-object JSON value in the store (e.g. an array) -> null', function () {
  resetLocalStorage();
  global.localStorage.setItem('bt.soloScale.v1', '[1,2,3]');
  var t = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  assert.strictEqual(T.readSoloScaleFor(t), null);
});
test('readSoloScaleFor: an unknown track (never written) among other stored tracks -> null', function () {
  resetLocalStorage();
  var t1 = { title: 'Sample in a Jar', artist: 'Phish', key: 'A', mode: 'major' };
  var t2 = { title: 'Wonderwall', artist: 'Oasis', key: 'F#', mode: 'minor' };
  T.writeSoloScaleFor(t1, 'blues');
  assert.strictEqual(T.readSoloScaleFor(t2), null);
});

/* =======================================================================
 * S-UI-RECONCILE Lane C (C1/C2): buildWhy's "why these notes" hint and the
 * jam-discovery query/URL both live INSIDE openStudio()'s per-track closure -
 * not exported, and openStudio's DOM surface is too large (~800 lines) to
 * stub for a direct call. Same static source-scan discipline this repo
 * already uses for seam regressions (consistency-lint.test.js,
 * no-native-dialog-lint.test.js): pin the exact call-site pattern so a
 * future edit that reintroduces the raw-th.key bug fails loud.
 * ===================================================================== */
var fs = require('fs');
var path = require('path');
function readSrc(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
// Extract a named function's full body (brace-matched) from source, so the
// lint below scopes its assertion to the RIGHT function, not a coincidental
// match anywhere else in the file.
function extractFunctionBody(src, signatureRe) {
  var m = signatureRe.exec(src);
  if (!m) return null;
  var braceStart = src.indexOf('{', m.index);
  var depth = 0;
  for (var i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(braceStart, i + 1); }
  }
  return null;
}
test('buildWhy (C1): the "why these notes" hint respells th.key via dispKeyRoot, never the raw canonical-sharp th.key', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function buildWhy\(box, th, bundle\) \{/);
  assert.ok(body, 'buildWhy(box, th, bundle) not found in tracks.js');
  assert.ok(/cofHint/.test(body), 'expected the cofHint prose block inside buildWhy');
  assert.ok(/dispKeyRoot\(th\.key, th\.scaleMode\)/.test(body),
    'buildWhy must call dispKeyRoot(th.key, th.scaleMode) to respell the key in the hint prose');
  assert.ok(!/esc\(th\.key\)/.test(body),
    'buildWhy must not emit the raw canonical-sharp th.key (e.g. "A#") beside the key-aware note names');
});
// Bug #6 regression: the Practice Studio's "Why these notes?" note strip must
// track the SELECTED solo scale, not the frozen key-mode. Three source-level
// locks (the Studio's nested overlay flow is flaky to drive headless, so pin
// the cause-reversal structurally so it can't silently regress):
test('buildWhy (#6): the note strip + caption derive from the selected bundle, not the frozen th', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function buildWhy\(box, th, bundle\) \{/);
  assert.ok(body, 'buildWhy(box, th, bundle) not found');
  assert.ok(/\(bundle && bundle\.notes\) \|\| th\.notes/.test(body),
    'the strip NOTES must come from the selected bundle (fallback th) - not th.notes alone');
  assert.ok(/\(bundle && bundle\.degrees\) \|\| th\.degrees/.test(body),
    'the strip DEGREES must come from the selected bundle (fallback th)');
  assert.ok(/bundle\.label/.test(body),
    'the caption scale name must reflect the selected bundle label');
});
test('select (#6): a scale switch refreshes the scale-reactive notes label (circle-hero retired the "Why these notes?" panel for the crown)', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function select\(scaleId, persist\) \{/);
  assert.ok(body, 'select(scaleId, persist) not found');
  // #6 concern (notes must follow the SELECTED solo scale) is preserved, on the
  // always-visible "Solo over it" label (data-solonotes) - the circle-hero
  // redesign retired the bottom "Why these notes?" panel, so select() syncs the
  // label instead of a buildWhy(whyBox,...) panel rebuild.
  assert.ok(/notesLineEl\.innerHTML = renderNoteTokens\(bundle\.notes\)/.test(body),
    'select() must refresh the "Solo over it" notes label to the selected bundle (the #6 scale-reactive-notes concern, now on the label not the retired panel)');
});
test('#6 (circle-hero): the "Why these notes?" toggle panel is retired - the interactive crown replaces it', function () {
  var src = readSrc('music/shared/tracks.js');
  // The bottom why-panel + its data-built build-once latch + the whyToggle are
  // gone; the interactive circle crown (data-cofhero) is the orientation surface
  // and the notes label (asserted above) carries the #6 scale-reactive sync.
  assert.ok(!/data-built/.test(src),
    'the data-built build-once latch must be removed');
  assert.ok(!/data-whytoggle/.test(src),
    'the retired why-panel toggle must not exist on the circle-hero redesign');
  assert.ok(/data-cofhero/.test(src),
    'the interactive crown wheel (data-cofhero) replaces the retired why panel');
});
test('renderJamPanel (C2): the jam-discovery query passes dispKeyRoot(th.key, th.scaleMode) into JamQueries.jamQuery, never the raw th.key', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderJamPanel\(scaleId\) \{/);
  assert.ok(body, 'renderJamPanel(scaleId) not found in tracks.js');
  assert.ok(/JQ\.jamQuery\(dispKeyRoot\(th\.key, th\.scaleMode\), scaleKey, jamGenres, jamFeel\)/.test(body),
    'jamQuery must be called with dispKeyRoot(th.key, th.scaleMode) as the key argument, not raw th.key, and jamGenres (the multi-select array) as the genre argument');
});
test('renderJamPanel (M-JAM-MULTI): re-filters jamGenres to the surviving intersection with the new scale\'s list, falling back to that scale\'s first genre when nothing survives', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderJamPanel\(scaleId\) \{/);
  assert.ok(body, 'renderJamPanel(scaleId) not found in tracks.js');
  assert.ok(/jamGenres == null/.test(body), 'expected a first-render null-sentinel check for jamGenres');
  assert.ok(/jamGenres = \[genres\[0\]\]/.test(body), 'expected a fallback seed of [genres[0]] on first render / when nothing survives');
  assert.ok(/jamGenres\.filter\(/.test(body), 'expected jamGenres to be re-filtered against the new scale\'s genre list on every render');
});
test('renderJamPanel chip row (M-JAM-MULTI): every genre chip carries .on independently via jamGenres.indexOf(...) >= 0 (multi-select, not a single === comparison)', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderJamPanel\(scaleId\) \{/);
  assert.ok(body, 'renderJamPanel(scaleId) not found in tracks.js');
  assert.ok(/jamGenres\.indexOf\(g\) >= 0/.test(body),
    'genre chip .on class must test jamGenres.indexOf(g) >= 0, not a single-value === comparison');
});
test('renderJamPanel genre-chip click handler (M-JAM-MULTI): toggles membership and refuses to drop the last selected genre (min 1 selected)', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderJamPanel\(scaleId\) \{/);
  assert.ok(body, 'renderJamPanel(scaleId) not found in tracks.js');
  assert.ok(/jamGenres\.indexOf\(g\)/.test(body), 'expected the click handler to look up the tapped genre in jamGenres');
  assert.ok(/jamGenres\.length > 1\)\s*jamGenres\.splice\(idx, 1\)/.test(body),
    'expected the toggle-off branch to be guarded on jamGenres.length > 1 before splicing out the tapped genre');
  assert.ok(/jamGenres\.push\(g\)/.test(body), 'expected the toggle-on branch to push the tapped genre into jamGenres');
});
test('renderJamPanel "Add to library" seed (M-JAM-MULTI): genre is jamGenres.join(\' / \') when multiple are selected, the bare genre when one is', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderJamPanel\(scaleId\) \{/);
  assert.ok(body, 'renderJamPanel(scaleId) not found in tracks.js');
  assert.ok(/genre: jamGenres\.length > 1 \? jamGenres\.join\(' \/ '\) : jamGenres\[0\]/.test(body),
    'the onEditRequest seed object must join multiple selected genres with " / ", or pass the bare single genre');
});
test('wireNowPlaying (round 16, skip-ads UAT 2026-09-02): NOTHING auto-hides the video - no timer, no countdown, no parked-open', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function wireNowPlaying\(\) \{/);
  assert.ok(body, 'wireNowPlaying() not found in tracks.js');
  // TWICE an automatic hide trapped the operator inside a YouTube ad: a 7s
  // wall-clock collapse (UAT 2026-07-31, mitigated to a 15s playback-anchored
  // window), then round 15's open-PARKED default, which silently undid that
  // mitigation - the pre-roll ran with no video on screen, so reaching "Skip
  // Ads" cost a manual open EVERY time. The ad boundary is undetectable
  // cross-origin, so no timer can be tuned safely around it. The law is now:
  // the app never hides the video on its own.
  assert.ok(!/AUTOMIN_MS/.test(body), 'no auto-minimize window may exist (round 16: nothing auto-hides)');
  assert.ok(!/startCountdown|endCountdown|cdStarted|autoTimer/.test(body),
    'the auto-collapse countdown machinery must be gone entirely, not merely dormant');
  assert.ok(!/setTimeout\([\s\S]{0,40}setVid\(/.test(body), 'no timer may drive setVid');
  assert.ok(!/\[data-keepopen\]/.test(body) && !/\[data-minnow\]/.test(body),
    'the Keep-open / Minimize-now controls narrated a window that no longer exists');
  // The playerState field that rides every infoDelivery tick still syncs the
  // bar (pausing inside the embed must flip the bar even when the
  // onStateChange delta was missed) - untouched by the round-16 removal.
  assert.ok(/playerState/.test(body) && /function syncState\(/.test(body),
    'the per-tick playerState field must route through the same syncState path as onStateChange');
});
test('round 17 (BEHAVIOR): adLikelyOpen answers "is a pre-roll likely on this open?" across all four states', function () {
  var TM = require('../music/shared/tracks-model.js'); // the PURE model - T above is tracks.js (the DOM module)
  var M = 10 * 60 * 1000, now = 1e12;
  // Mid-session: the queue advanced or he tapped another row while one played.
  // An ad is unlikely AND a video jumping up between songs is the friction the
  // operator explicitly ruled out ("not between every song tho").
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: true, hasPlayedThisLoad: true, lastStopAt: 0, now: now, idleMs: M }), false,
    'anything already playing means mid-session - never ad-likely, whatever the clock says');
  // Session start, the dominant case: app loads, he hits play, YouTube pre-rolls.
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: false, hasPlayedThisLoad: false, now: now, idleMs: M }), true,
    'the first play of an app load is the canonical ad moment');
  // Stopped and immediately restarted - still one continuous session.
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: false, hasPlayedThisLoad: true, lastStopAt: now - 20000, now: now, idleMs: M }), false,
    'a 20s gap is song-to-song, not a new session - the video must not pop up');
  // Put the phone down, came back: a fresh embed, ads likely again.
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: false, hasPlayedThisLoad: true, lastStopAt: now - 30 * 60000, now: now, idleMs: M }), true,
    'past the idle gap it is a new session again');
  // Boundary: exactly at the gap counts as a new session (>=, not >).
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: false, hasPlayedThisLoad: true, lastStopAt: now - M, now: now, idleMs: M }), true,
    'the idle threshold is inclusive');
  assert.strictEqual(TM.adLikelyOpen({ wasPlaying: false, hasPlayedThisLoad: true, lastStopAt: now - M + 1, now: now, idleMs: M }), false,
    'one ms under the gap is still the same session');
});
test('round 17: the video shows itself exactly where ADS ARE LIKELY - session start, not every song', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function wireNowPlaying\(\) \{/);
  // Operator: "detect not playing anything -> playing (first load or idle time)
  // and show the yt video - most likely to have ads. not between every song tho".
  // A YouTube pre-roll fires when a listening SESSION starts (a fresh embed after
  // load or after a real gap), not on each queue advance.
  assert.ok(/var wasPlaying = !!nowPlaying;/.test(body),
    'the open must read nowPlaying BEFORE it is reassigned - that is the "was anything already playing" signal');
  assert.ok(/var adLikely = adLikelyOpen\(\{ wasPlaying: wasPlaying, hasPlayedThisLoad: hasPlayedThisLoad, lastStopAt: lastStopAt, idleMs: VID_IDLE_MS \}\);/.test(body),
    'the open must decide via the PURE adLikelyOpen predicate (behaviour-tested above), not an inline expression only a browser could exercise');
  assert.ok(/setVid\(adLikely \? 'theater' : \(vidState \|\| readVidPref\(\)\), true\);/.test(body),
    'ad-likely opens SHOW the video; every other open CARRIES the state the user left it in (never a jump, never a yank)');
  assert.ok(/hasPlayedThisLoad = true;/.test(body), 'the open must mark the load as having played');
  // The carry var is what makes a mid-session open honest - it tracks every transition.
  assert.ok(/vidState = state;/.test(extractFunctionBody(src, /function setVid\(state, fromOpen\) \{/)),
    'setVid must keep the carry var current so the next open can continue the state');
  // Round 16 still stands underneath: nothing hides it on a timer.
  assert.ok(!/AUTOMIN|startCountdown/.test(body), 'round 16 stands - no auto-hide machinery may return');
});
test('round 17: the idle clock starts on a REAL stop, and the signals are module-scoped', function () {
  var src = readSrc('music/shared/tracks.js');
  var close = extractFunctionBody(src, /function closePlayer\(\) \{/);
  assert.ok(/if \(nowPlaying\) lastStopAt = Date\.now\(\);/.test(close),
    'closePlayer must stamp lastStopAt only when something was actually playing');
  assert.ok(/var hasPlayedThisLoad = false;/.test(src) && /var lastStopAt = 0;/.test(src) && /var vidState = null;/.test(src),
    'the three session signals must live at module scope (they outlive any single Studio open)');
  assert.ok(/VID_IDLE_MS = 10 \* 60 \* 1000;/.test(src), 'the idle gap must be one named, tunable constant');
});
test('round 16 (still standing): the pref is written by USER acts only, never by the open that replays it', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function setVid\(state, fromOpen\) \{/);
  assert.ok(/if \(!fromOpen\) writeVidPref\(state\);/.test(body),
    'setVid must persist every non-open (user) transition, and must NOT re-write on a restoring open');
  var read = extractFunctionBody(src, /function readVidPref\(\) \{/);
  assert.ok(/'theater'/.test(read) && /catch/.test(read),
    'unset OR unreadable storage falls back to the VISIBLE theater');
  assert.ok(/VID_PREF_KEY = 'music\.vidPref\.v1'/.test(src), 'the pref key stays the namespaced additive music.vidPref.v1');
});
test('round 16: the video preference is written by USER acts only, never by the open that replays it', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function setVid\(state, fromOpen\) \{/);
  assert.ok(body, 'setVid(state, fromOpen) not found');
  assert.ok(/if \(!fromOpen\) writeVidPref\(state\);/.test(body),
    'setVid must persist every non-open (i.e. user) transition, and must NOT re-write on the restoring open');
  // Additive localStorage key -> no SCHEMA_VERSION bump needed (backup.js contract).
  assert.ok(/VID_PREF_KEY = 'music\.vidPref\.v1'/.test(src), 'the pref key must be the namespaced additive music.vidPref.v1');
});

/* ---------------------------------------------------------------------
 * S-COF-INTERACTIVE: the circle-crown retune seam. The wheel's onPick
 * re-tunes every theory surface by REASSIGNING the shared `th` closure var
 * and re-rendering the helpers IN PLACE - it must NEVER rebuild
 * elPlayer.innerHTML (that would destroy the backing-track <iframe> and
 * reload the video). renderCofHero must pass onPick so the wheel is live,
 * and retuneTo must re-call renderCofHero so onPick survives the wheel
 * DOM replacement. Source-lock (openStudio's live DOM is Playwright turf).
 * ------------------------------------------------------------------- */
test('S-COF-INTERACTIVE: retuneTo reassigns th via studioTheory and re-skins in place - never rebuilds elPlayer.innerHTML (video not reloaded)', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function retuneTo\(newRoot, newMode\) \{/);
  assert.ok(body, 'retuneTo(newRoot, newMode) not found in tracks.js');
  assert.ok(/studioTheory\(newRoot, newMode\)/.test(body) && /\bth = nth\b/.test(body),
    'retuneTo must REASSIGN the shared th from studioTheory(newRoot, newMode) so every closure reads the new key');
  assert.ok(!/elPlayer\.innerHTML\s*=/.test(body),
    'retuneTo must NOT rewrite elPlayer.innerHTML - that reloads the backing-track iframe (the whole point is in-place re-skin)');
  assert.ok(/stopStudioSound\(\)/.test(body),
    'retuneTo must stopStudioSound() first (dangling-audition-handle trap)');
  assert.ok(/renderCofHero\(\)/.test(body),
    'retuneTo must re-call renderCofHero() so the wheel re-renders WITH onPick re-attached');
  assert.ok(/renderChordChips\(\)/.test(body) && /renderFretboard\(th, 'mode'\)/.test(body),
    'retuneTo must re-render chords + fretboard against the new th');
  assert.ok(/startAudition\(\)/.test(body),
    'retuneTo must audition the new key scale');
});
test('S-COF-INTERACTIVE: renderCofHero passes onPick to renderWheel (the wheel is live), routing major/minor to ionian/aeolian', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function renderCofHero\(\) \{/);
  assert.ok(body, 'renderCofHero() not found in tracks.js');
  assert.ok(/onPick:\s*function\s*\(root, ring\)/.test(body),
    'renderCofHero must pass an onPick to renderWheel so every wedge is a live key-explore tap');
  assert.ok(/retuneTo\(root, ring === 'minor' \? 'aeolian' : 'ionian'\)/.test(body),
    "onPick must route the ring ('major'/'minor') to the studioTheory scale mode (ionian/aeolian)");
});

/* =======================================================================
 * G4 S-JAM-STARTER: the no-video empty state's one-tap starter chip. The
 * RESOLUTION algorithm (filterTracks -> rank 0 + a real yt) is pure and
 * already exercised end to end below against the real catalog; the DOM
 * wiring (openStudio's markup/gating/click-handler) is source-locked, same
 * discipline as the other openStudio internals above (its DOM surface is
 * Playwright turf, not jsdom-stubbable).
 * ===================================================================== */
var REAL_TRACKS = require('../music/backing-tracks/tracks.json');
test('G4: filterTracks resolves a real, already-playable curated candidate for a sample key (A major)', function () {
  var rows = T.filterTracks(REAL_TRACKS, 'all', 'A', T.normMode('major'));
  var candidate = rows.filter(function (r) { return r.rank === 0 && r.track.yt; })[0];
  assert.ok(candidate, 'expected at least one rank-0 (exact key), real-video candidate for A major in the shipped catalog');
  assert.strictEqual(candidate.track.key, 'A');
  assert.ok(candidate.track.yt, 'the resolved candidate must carry a real yt id - the whole point is one tap TO PLAYING, not to another search');
});
test('G4: the same resolution is deterministic across repeated calls (no randomness) - same catalog, same key, same candidate', function () {
  var a = T.filterTracks(REAL_TRACKS, 'all', 'G', T.normMode('minor')).filter(function (r) { return r.rank === 0 && r.track.yt; })[0];
  var b = T.filterTracks(REAL_TRACKS, 'all', 'G', T.normMode('minor')).filter(function (r) { return r.rank === 0 && r.track.yt; })[0];
  assert.strictEqual(a ? a.track.yt : null, b ? b.track.yt : null);
});
test('G4: a key with no exact-match curated video resolves to no candidate (graceful degrade, not a wrong-key fallback)', function () {
  // SYNTHETIC catalog, deliberately not the shipped one: the shipped C#/F#
  // gaps are RESERVED for the operator's curated gap playlist (QUEUE), so
  // pinning "C# has zero tracks" would rot red the day those land - the same
  // content-pinned-rot class the persona scenarios fixed four times over.
  // The absence property under test belongs to the ALGORITHM, so a fixture
  // with a known gap proves it durably.
  var cat = [
    { yt: 'dQw4w9WgXcQ', title: 'A jam', artist: 'x', genre: 'rock', key: 'A', mode: 'major', bpm: 100, capo: 0, tags: [] },
    { yt: 'dQw4w9WgXcR', title: 'E jam', artist: 'x', genre: 'blues', key: 'E', mode: 'major', bpm: 90, capo: 0, tags: [] }
  ];
  var rows = T.filterTracks(cat, 'all', 'C#', T.normMode('major'));
  var candidate = rows.filter(function (r) { return r.rank === 0 && r.track.yt; })[0];
  assert.strictEqual(candidate, undefined, 'expected no rank-0+yt candidate for a key the catalog does not carry');
});
test('G4: openStudio resolves jamStarterCandidate via filterTracks(state.tracks, \'all\', th.key, normMode(th.scaleMode)) - the SAME resolution the finder\'s own result cards use, not a duplicate', function () {
  var src = readSrc('music/shared/tracks.js');
  // Resolution + markup live in resolveJamStarter/jamStarterRowHtml (shared
  // with the async-catalog late fill, injectJamStarterLate) - pin them there.
  var body = extractFunctionBody(src, /function resolveJamStarter\(th\) \{/);
  assert.ok(body, 'resolveJamStarter(th) not found in tracks.js');
  assert.ok(/filterTracks\(state\.tracks, 'all', th\.key, normMode\(th\.scaleMode\)\)/.test(body),
    'jamStarterRows must resolve via filterTracks against state.tracks (the merged seed+overlay+custom list) for the CURRENT key, any genre');
  assert.ok(/\.filter\(function \(r\) \{ return r\.rank === 0 && r\.track\.yt; \}\)\[0\] \|\| null/.test(body),
    'jamStarterCandidate must be the first exact-key ("your key") row that already carries a real video, or null');
  var rowFn = extractFunctionBody(src, /function jamStarterRowHtml\(cand\) \{/);
  assert.ok(rowFn, 'jamStarterRowHtml(cand) not found in tracks.js');
  assert.ok(/keyLabelFor\(cand\.track\.key, cand\.track\.mode\)/.test(rowFn),
    'the chip label must read the CANDIDATE track\'s own key/mode (a blues/modal theory key coarsens to a family match - labeling with th would overpromise)');
  assert.ok(/cand\.track\.genre \? esc\(cand\.track\.genre\) \+ ' jam' : 'jam'/.test(rowFn),
    'a genre-less candidate must read "Play a jam in ..." - never the "jam jam" stutter of genre-fallback + literal " jam"');
  assert.ok(/injectJamStarterLate\(\);/.test(src) && /function injectJamStarterLate\(\) \{/.test(src),
    'the tracks.json fetch handlers must late-fill a starter-less no-video Studio opened before the catalog resolved (openStudio\'s idempotent guard blocks a plain re-open)');
});
test('G4: the starter chip renders ONLY in the no-video branch and never replaces the existing Find-a-jam disclosure row', function () {
  var src = readSrc('music/shared/tracks.js');
  assert.ok(/\(t\.yt \? '' : jamStarterHtml \+ '<div class="bt-st-addvidrow"><button class="bt-st-addvid" data-jamfindtoggle/.test(src),
    'jamStarterHtml must render ahead of (not instead of) the existing no-video addvidrow, and only when t.yt is falsy');
  assert.ok(/data-jamstarter/.test(src), 'the starter button must carry a data-jamstarter hook');
});
test('G4: tapping the starter chip loads the candidate via activate() - the same function every finder result card uses, no duplicate loader', function () {
  var src = readSrc('music/shared/tracks.js');
  assert.ok(/jamStarterBtn\.onclick = function \(\) \{ activate\(jamStarterCandidate\.track\); \}/.test(src),
    'the starter button must call activate(jamStarterCandidate.track), the same dispatcher cardEl()\'s onActivate uses');
});
test('G4: the no-candidate case wires nothing (jamStarterBtn is only truthy when jamStarterCandidate is truthy)', function () {
  var src = readSrc('music/shared/tracks.js');
  assert.ok(/if \(jamStarterBtn && jamStarterCandidate\) jamStarterBtn\.onclick/.test(src),
    'the click handler must be guarded on jamStarterCandidate - jamStarterHtml is empty (no button in the DOM) when there is no candidate');
});
test('G4: the Studio guide toggle carries the app-wide .helpIcon convention (songbook.css) instead of a bespoke "?" glyph', function () {
  var src = readSrc('music/shared/tracks.js');
  assert.ok(/class="iconBtn bt-st-guidebtn helpIcon" data-guidetoggle/.test(src),
    'the guide toggle button must carry helpIcon alongside its own classes, per the app-wide convention (songbook.css .helpIcon::before)');
  assert.ok(!/bt-st-guidebtn" data-guidetoggle[^>]*>\?</.test(src),
    'the bespoke literal "?" text content must be removed now that .helpIcon supplies the glyph via ::before');
  assert.ok(/aria-label="Show the scale guide"/.test(src),
    'the aria-label must survive the glyph swap (screen readers never read the visible ::before content)');
});

/* =======================================================================
 * Studiofirst tip is VIEW-AWARE (operator UAT 2026-09-01): the beginner
 * orientation copy's where-to-look clause must match the active theory
 * view - a persisted Circle pin otherwise renders a tip pointing at a
 * fretboard that is not on screen.
 * ===================================================================== */
test('studiofirst copy: Fretboard view points at the neck, Circle view at the wheel - action clause identical', function () {
  var ST = require('../music/shared/studio-theory.js');
  var fret = ST.studioFirstText();
  var cof = ST.studioFirstText('cof');
  assert.ok(/neck/.test(fret) && !/wheel/.test(fret), 'default (fretboard) copy points at the neck');
  assert.ok(/wheel/.test(cof) && !/neck/.test(cof), 'circle copy points at the wheel, never the neck');
  assert.strictEqual(fret.split(' - ')[0], cof.split(' - ')[0], 'the action clause ("Tap a chord below to hear it") is identical in both views');
});
test('studiofirst tip re-derives on view toggle (applyView swaps the live banner body, G5 pattern)', function () {
  var src = readSrc('music/shared/tracks.js');
  var body = extractFunctionBody(src, /function applyView\(v\) \{/);
  assert.ok(body, 'applyView(v) not found in tracks.js');
  assert.ok(/sfBodyEl\.textContent = studioFirstText\(v\)/.test(body),
    'applyView must swap the studiofirst banner body to studioFirstText(v) - the persisted-Circle-pin first paint AND live toggles both route through applyView');
});

run();
