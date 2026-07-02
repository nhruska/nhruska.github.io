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
    { message: 'Nothing in your repertoire matches in Am.', clearKey: true });
  assert.deepStrictEqual(Songbook.libraryEmptyState({ key: 'F#' }),
    { message: 'Nothing in your repertoire matches in F#.', clearKey: true });
});
test('libraryEmptyState with no key filter keeps the plain message, no link', function () {
  assert.deepStrictEqual(Songbook.libraryEmptyState({ key: 'all' }),
    { message: 'Nothing in your repertoire matches.', clearKey: false });
  assert.deepStrictEqual(Songbook.libraryEmptyState({}),
    { message: 'Nothing in your repertoire matches.', clearKey: false });
  assert.deepStrictEqual(Songbook.libraryEmptyState(null),
    { message: 'Nothing in your repertoire matches.', clearKey: false });
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

run();
