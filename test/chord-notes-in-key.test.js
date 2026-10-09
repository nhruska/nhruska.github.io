/* =====================================================================
 * chord-notes-in-key.test.js  -  G3 / S-TONES: the chord detail's "Notes"
 * line. Songbook.chordNotesInKey(token, keyRoot, keyMode) spells a chord's
 * tones key-aware: the root via Circle.noteInKey, then letter-per-chord-degree
 * (root letter + 3rd + 5th [+ 7th]) - NEVER a pitch-class respell.
 * Chord TOKENS stay canonical-sharp (Fdim is the token for F#'s E#dim; A# is
 * the token for F's Bb) - the display respells at this seam only.
 * Run: node test/chord-notes-in-key.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
require('../music/shared/list-item.js');
require('../music/shared/toast.js');
require('../music/shared/queue.js');
require('../music/shared/repertoire.js');
require('../music/shared/circle.js');
var Songbook = require('../music/shared/songbook.js');

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
function notes(tok, key, mode) { return Songbook.chordNotesInKey(tok, key, mode).join(' '); }

// ---- the five G3 traps (chord token, key, mode, expected) ----
test('trap 1: IV of F major spells Bb D F (never A# D F)', function () {
  assert.strictEqual(notes('A#', 'F', 'Major'), 'Bb D F');
});
test('trap 2: vii of F# major spells E# G# B (token Fdim; never F G# B)', function () {
  assert.strictEqual(notes('Fdim', 'F#', 'Major'), 'E# G# B');
  // review fix: sus2 / sus4 REPLACE the third (pack vocabulary via QUAL_FALLBACK)
  assert.strictEqual(notes('Dsus4', 'D', 'Major'), 'D G A');
  assert.strictEqual(notes('Dsus2', 'D', 'Major'), 'D E A');
  assert.strictEqual(notes('Asus4', 'E', 'Major'), 'A D E');
  assert.strictEqual(notes('A#sus4', 'F', 'Major'), 'Bb Eb F');
});
test('trap 3: vii of Bb major spells A C Eb (token Adim; Eb never D#)', function () {
  assert.strictEqual(notes('Adim', 'Bb', 'Major'), 'A C Eb');
  assert.strictEqual(notes('Adim', 'A#', 'Major'), 'A C Eb', 'sharp-canonical key token resolves to the Bb regime');
});
test('trap 4: V7 of D minor spells A C# E G', function () {
  assert.strictEqual(notes('A7', 'D', 'Minor'), 'A C# E G');
});
test('trap 5: I of C major spells C E G', function () {
  assert.strictEqual(notes('C', 'C', 'Major'), 'C E G');
});

// ---- extended chords ----
test('extended: G7 in C, Am7 in C, Cmaj7 in C, Dm7 in F', function () {
  assert.strictEqual(notes('G7', 'C', 'Major'), 'G B D F');
  assert.strictEqual(notes('Am7', 'C', 'Major'), 'A C E G');
  assert.strictEqual(notes('Cmaj7', 'C', 'Major'), 'C E G B');
  assert.strictEqual(notes('Dm7', 'F', 'Major'), 'D F A C');
});
test('extended in a flat key: Bbmaj7 in F, Gm7 in F, C7 in F, Ebmaj7 in Bb', function () {
  assert.strictEqual(notes('A#maj7', 'F', 'Major'), 'Bb D F A');
  assert.strictEqual(notes('Gm7', 'F', 'Major'), 'G Bb D F');
  assert.strictEqual(notes('C7', 'F', 'Major'), 'C E G Bb');
  assert.strictEqual(notes('D#maj7', 'A#', 'Major'), 'Eb G Bb D');
});
test('sharp-key chords keep sharps: F#m in A major, C#m7 in E major, G#m in B major', function () {
  assert.strictEqual(notes('F#m', 'A', 'Major'), 'F# A C#');
  assert.strictEqual(notes('C#m7', 'E', 'Major'), 'C# E G# B');
  assert.strictEqual(notes('G#m', 'B', 'Major'), 'G# B D#');
});
test('all seven F# major diatonic triads spell letter-per-degree (E# not F, B# never)', function () {
  // I..vii of F# major, tokens as stored (canonical sharp)
  var exp = { 'F#': 'F# A# C#', 'G#m': 'G# B D#', 'A#m': 'A# C# E#', 'B': 'B D# F#',
              'C#': 'C# E# G#', 'D#m': 'D# F# A#', 'Fdim': 'E# G# B' };
  Object.keys(exp).forEach(function (tok) { assert.strictEqual(notes(tok, 'F#', 'Major'), exp[tok], tok); });
});
test('slash / inversion chords are not part of the app vocabulary: a slash suffix falls back to the plain triad', function () {
  // The chord pack, Compose palette and songs.json carry no slash voicings
  // (only '', m, 7, maj7, m7), so there is no bass-note UI to spell.
  assert.strictEqual(notes('C/E', 'C', 'Major'), 'C E G');
});

// ---- regime fallbacks ----
test('keyless: canonical-sharp pitch-class names, same regime as the chord NAME', function () {
  assert.strictEqual(notes('A#', null, 'Major'), 'A# D F');
  assert.strictEqual(notes('Am7', null, 'Major'), 'A C E G');
  assert.strictEqual(notes('Bb', null, 'Major'), 'A# D F', 'flat INPUT normalizes to the canonical token');
});
test('garbage in -> [] (never throws)', function () {
  assert.deepStrictEqual(Songbook.chordNotesInKey('', 'C', 'Major'), []);
  assert.deepStrictEqual(Songbook.chordNotesInKey(null, 'C', 'Major'), []);
  assert.deepStrictEqual(Songbook.chordNotesInKey('H7', 'C', 'Major'), []);
});
test('first note always equals the chord NAME dispChordNameInKey shows (name and notes cannot disagree)', function () {
  var keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var roots = keys;
  keys.forEach(function (k) {
    ['Major', 'Minor'].forEach(function (mode) {
      roots.forEach(function (r) {
        ['', 'm', '7'].forEach(function (q) {
          var shown = Songbook.dispChordNameInKey(r + q, k, mode).replace(/(m|7)$/, '');
          assert.strictEqual(Songbook.chordNotesInKey(r + q, k, mode)[0], shown, r + q + ' in ' + k + ' ' + mode);
        });
      });
    });
  });
});
test('pitch classes match Circle.chordTones for every root x quality x key (spelling never changes the sound)', function () {
  var C = global.Circle;
  var pcs = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pcOfName(n) {
    var v = pcs[n.charAt(0)];
    for (var i = 1; i < n.length; i++) v += n.charAt(i) === '#' ? 1 : -1;
    return ((v % 12) + 12) % 12;
  }
  var roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  roots.forEach(function (k) {
    ['Major', 'Minor'].forEach(function (mode) {
      roots.forEach(function (r) {
        ['', 'm', 'dim', 'aug', '7', 'm7', 'maj7'].forEach(function (q) {
          var got = Songbook.chordNotesInKey(r + q, k, mode).map(pcOfName);
          assert.deepStrictEqual(got, C.chordTones(r + q), r + q + ' in ' + k + ' ' + mode);
        });
      });
    });
  });
});

run();
