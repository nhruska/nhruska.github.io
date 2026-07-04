/* =====================================================================
 * tracks.test.js  -  unit tests for the backing-track finder core
 * Run: node test/tracks.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tracks.js');
var Circle = require('../music/shared/circle.js');
var Notables = require('../music/shared/notables.js');
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
  assert.deepStrictEqual(th.notes, Circle.soloScale('A', 'blues'));
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
  assert.deepStrictEqual(pm.notes, Circle.soloScale('A', 'pentMajor'));
  assert.deepStrictEqual(pm.degrees, Circle.soloScaleDegrees('pentMajor'));
  assert.strictEqual(pm.label, 'Pent major');
  assert.strictEqual(pm.pcs.length, 5);

  var mn = T.soloBundle('A', 'minor', 'pentMinor');
  assert.deepStrictEqual(mn.notes, Circle.soloScale('A', 'pentMinor'));
  assert.strictEqual(mn.label, 'Pent minor');
  assert.strictEqual(mn.pcs.length, 5);

  var bl = T.soloBundle('A', 'minor', 'blues');
  assert.deepStrictEqual(bl.notes, ['A', 'C', 'D', 'D#', 'E', 'G']); // regime-A: sharp-spelled blue note
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
test('soloScaleFraming: pent scales interpolate family; blues has its own fixed line; mode has none', function () {
  assert.strictEqual(T.soloScaleFraming('pentMajor', 'major'),
    'The inside sound over major and dominant vamps - same shape as its relative minor pent, two frets down; keep the root as home.');
  assert.strictEqual(T.soloScaleFraming('pentMinor', 'minor'),
    'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.');
  assert.strictEqual(T.soloScaleFraming('blues'),
    'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.');
  assert.strictEqual(T.soloScaleFraming('mode'), null);
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

/* ---------- S-WHYNOTE: claim/dismiss consumer logic (via Notables) ---------- */
test('whynoteBanner: a fresh, un-dismissed slot grants renderBanner-ready opts', function () {
  resetLocalStorage();
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
  Notables._resetArbitration();
  var th = T.studioTheory('C', 'major');
  assert.ok(T.whynoteBanner(th), 'first open of the Studio grants the slot');
  assert.ok(T.whynoteBanner(th), 'reopening the Studio before dismissal grants it again');
});
test('whynoteBanner: dismiss() persists forever - a later call skips silently (returns null)', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  var th = T.studioTheory('A', 'minor');
  assert.ok(T.whynoteBanner(th));
  Notables.dismiss('whynote');
  assert.strictEqual(T.whynoteBanner(th), null, 'a dismissed whynote must never render again');
});
test('whynoteBanner: a higher-priority notable (firstrun) already holding the slot preempts it', function () {
  resetLocalStorage();
  Notables._resetArbitration();
  assert.strictEqual(Notables.claim('firstrun'), true); // firstrun outranks whynote in PRIORITY
  var th = T.studioTheory('G', 'major');
  assert.strictEqual(T.whynoteBanner(th), null, 'whynote must skip silently while firstrun holds the slot');
});

run();
