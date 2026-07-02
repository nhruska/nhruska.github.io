/* =====================================================================
 * song-builder.test.js  -  unit tests for the AI Tutor prototype's
 * song-structure module (wave 4): sections + transition-quality heuristics.
 * Run: node test/song-builder.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MiniCompose = require('../music/tutor/mini-compose.js');
var SongBuilder = require('../music/tutor/song-builder.js');

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

/* ---------- sections + song CRUD ---------- */
test('createSection tags a mini-compose state with a label', function () {
  var s = SongBuilder.createSection('Verse', 'C', 'major');
  assert.strictEqual(s.label, 'Verse');
  assert.strictEqual(s.key, 'C');
  assert.strictEqual(s.mode, 'major');
  assert.deepStrictEqual(s.progression, []);
});
test('a section is a real mini-compose state - reducers work on it directly', function () {
  var s = SongBuilder.createSection('Verse', 'C', 'major');
  s = MiniCompose.addChord(s, 'C');
  s = MiniCompose.addChord(s, 'F');
  assert.deepStrictEqual(s.progression, ['C', 'F']);
  assert.strictEqual(s.label, 'Verse'); // survives the reducer (Object.assign preserves it)
});
test('createSong starts empty; addSection appends without mutating', function () {
  var song = SongBuilder.createSong();
  assert.deepStrictEqual(song.sections, []);
  var verse = SongBuilder.createSection('Verse', 'C', 'major');
  var song2 = SongBuilder.addSection(song, verse);
  assert.strictEqual(song.sections.length, 0);
  assert.strictEqual(song2.sections.length, 1);
  assert.strictEqual(song2.sections[0].label, 'Verse');
});
test('replaceSection swaps one section by index without touching others', function () {
  var song = SongBuilder.createSong();
  song = SongBuilder.addSection(song, SongBuilder.createSection('Verse', 'C', 'major'));
  song = SongBuilder.addSection(song, SongBuilder.createSection('Chorus', 'G', 'major'));
  var updatedChorus = MiniCompose.addChord(song.sections[1], 'G');
  var song2 = SongBuilder.replaceSection(song, 1, updatedChorus);
  assert.deepStrictEqual(song2.sections[1].progression, ['G']);
  assert.strictEqual(song2.sections[0].label, 'Verse'); // untouched
  assert.deepStrictEqual(song.sections[1].progression, []); // original unmutated
});

/* ---------- transition-quality heuristics (verified against real Circle.js data) ---------- */
function sec(key, mode) { return SongBuilder.createSection('x', key, mode); }

test('same key/mode -> "same", no modulation', function () {
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('C', 'major'));
  assert.strictEqual(r.quality, 'same');
});
test('dominant (a fifth up) -> "smooth" via direct-neighbor, not distance', function () {
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('G', 'major'));
  assert.strictEqual(r.quality, 'smooth');
  assert.ok(/fifth up/.test(r.reason));
});
test('subdominant (a fifth down) -> "smooth"', function () {
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('F', 'major'));
  assert.strictEqual(r.quality, 'smooth');
  assert.ok(/fifth down/.test(r.reason));
});
test('relative minor -> "smooth" DESPITE being 3 circle-of-fifths steps away (priority-order regression case)', function () {
  assert.strictEqual(SongBuilder.circleSteps('C', 'A'), 3); // ground the claim: raw distance alone would NOT call this smooth
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('A', 'minor'));
  assert.strictEqual(r.quality, 'smooth');
  assert.ok(/relative minor/.test(r.reason));
});
test('a distant key with no shared chords and no direct relationship -> "distant"', function () {
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('F#', 'major'));
  assert.strictEqual(r.quality, 'distant');
  assert.deepStrictEqual(SongBuilder.pivotChords('C', 'major', 'F#', 'major'), []);
});
test('a non-neighbor key that still shares pivot chords -> "smooth" via the pivot signal, not distance', function () {
  // C major -> E minor: 4 circle-of-fifths steps (not a direct neighbor of C),
  // but shares C/Em/G/Am diatonically - the pivot signal should still fire.
  var r = SongBuilder.analyzeTransition(sec('C', 'major'), sec('E', 'minor'));
  assert.strictEqual(r.quality, 'smooth');
  assert.ok(r.pivotChords && r.pivotChords.length > 0);
});
test('pivotChords intersection matches hand-verified real data (C major vs G major)', function () {
  var pivots = SongBuilder.pivotChords('C', 'major', 'G', 'major');
  assert.deepStrictEqual(pivots.sort(), ['Am', 'C', 'Em', 'G'].sort());
});
test('circleSteps is symmetric and wraps correctly (tritone = max distance of 6)', function () {
  assert.strictEqual(SongBuilder.circleSteps('C', 'F#'), 6);
  assert.strictEqual(SongBuilder.circleSteps('F#', 'C'), 6);
  assert.strictEqual(SongBuilder.circleSteps('C', 'C'), 0);
});

/* ---------- keyChoicesFor (the "pick the next section's key" moment) ---------- */
test('keyChoicesFor returns exactly the 3 Circle.neighbors, each pre-analyzed as smooth', function () {
  var verse = sec('C', 'major');
  var choices = SongBuilder.keyChoicesFor(verse);
  assert.strictEqual(choices.length, 3);
  choices.forEach(function (c) { assert.strictEqual(c.quality, 'smooth'); });
  var roots = choices.map(function (c) { return c.root + ' ' + c.mode; });
  assert.ok(roots.indexOf('G major') !== -1);
  assert.ok(roots.indexOf('F major') !== -1);
  assert.ok(roots.indexOf('A minor') !== -1);
});

/* ---------- analyzeSong (whole-song readout) ---------- */
test('analyzeSong returns one transition per adjacent pair, in order', function () {
  var song = SongBuilder.createSong();
  song = SongBuilder.addSection(song, sec('C', 'major'));   // verse
  song = SongBuilder.addSection(song, sec('G', 'major'));   // chorus - dominant, smooth
  song = SongBuilder.addSection(song, sec('E', 'minor'));   // bridge - relative minor of G, smooth
  var transitions = SongBuilder.analyzeSong(song);
  assert.strictEqual(transitions.length, 2);
  assert.strictEqual(transitions[0].quality, 'smooth');
  assert.strictEqual(transitions[1].quality, 'smooth');
  assert.ok(/relative minor/.test(transitions[1].reason));
});
test('analyzeSong on a single-section song returns an empty array (no transitions to judge)', function () {
  var song = SongBuilder.addSection(SongBuilder.createSong(), sec('C', 'major'));
  assert.deepStrictEqual(SongBuilder.analyzeSong(song), []);
});
test('analyzeSong on an empty song returns an empty array (no throw)', function () {
  assert.deepStrictEqual(SongBuilder.analyzeSong(SongBuilder.createSong()), []);
});

run();
