# Theory Engine Architecture

[Wiki](../index.md) > theory-engine > Architecture

## Purpose

The pitch-class core + spelling-as-display split that lets theory computations stay mode-agnostic while display surfaces unify on a single naming policy. The three name-emitting surfaces and the MODE_STEPS single source of truth.

## The pitch-class core

The engine computes on pitch classes (integers 0-11): intervals, diatonic qualities, scale degrees, key relationships, transposition. None of that depends on how a note is spelled - the math is exact and unaffected by any naming policy. [STABLE]

| Computation | Source | Result |
|---|---|---|
| Scale intervals | `Circle.MODE_STEPS` (circle.js:34-37) | Semitone formula per mode (e.g., Major = [0,2,4,5,7,9,11]) |
| Diatonic triads | Stacked thirds within mode (circle.js:107-119) | Pitch class + quality; roman degree + case |
| Scale degrees | Interval comparison vs Major (circle.js:82-87) | "1 2 b3 4 5 b6 b7" (aeolian) |
| Key relationships | Tonic + mode name (circle.js:206-216) | Neighbor roots (fifth up/down, relative) |

Consequence: the naming policy is swappable at display time by changing the named
display seams while theory computations and canonical chord tokens remain untouched.
Track-key storage uses the preferred tonic name; identity normalization folds
enharmonic spellings. See [note-spelling.md](note-spelling.md).

## Naming surfaces: key-aware display, canonical internal tokens [STABLE]

Inside a stated key, display names use the key-aware provider. Chord tokens used for
voicing, audio, suggestions, and progression identity remain canonical-sharp. Keyless
contexts such as the tuner and All-browse palette also remain canonical-sharp.

| Surface | Source | Emits |
|---|---|---|
| Key and scale display | `preferredTonicName` / `scaleInKey` | Preferred key name and letter-per-degree scale spelling |
| Diatonic chord display | `diatonicInKey` / `dispChord` / `dispChordName` | Chord names that agree with key function and roman label |
| Solo-scale display | `soloScaleInKey` | Pentatonic, mode, and blues names spelled by degree function |
| Canonical tokens and keyless display | `ROOTS` / `spell` / `SUGG` | Stable sharp-canonical identities for voicing, audio, suggestions, tuner, and All-browse |

Flat input and sharp input resolve to the same pitch-class identity. Stored track keys
use preferred tonic names (`Bb`, `Eb`); progression chord tokens remain canonical-
sharp. [STABLE]

## MODE_STEPS - single source of truth [STABLE]

Semitone intervals per mode live in `Circle.MODE_STEPS` (circle.js:34-37, exported line 220). Songbook reads them at load time (songbook.js:82-89, syncStepsFromCircle) so the two stay in lockstep. Tests read directly from Circle.MODE_STEPS. [STABLE]

| Mode | Steps | Aliases |
|---|---|---|
| ionian | [0,2,4,5,7,9,11] | 'major' |
| aeolian | [0,2,3,5,7,8,10] | 'minor' |
| dorian | [0,2,3,5,7,9,10] | - |
| phrygian | [0,1,3,5,7,8,10] | - |
| lydian | [0,2,4,6,7,9,11] | - |
| mixolydian | [0,2,4,5,7,9,10] | - |
| locrian | [0,1,3,5,6,8,10] | - |

All computations (diatonic, modeChange, scaleDegrees) derive from this one table - no hand-coded step lists elsewhere. [STABLE]

## Roman numeral convention (mode-local) [STABLE]

Diatonic chords are numbered by their position in the selected mode's own scale (modal/conservatory convention, not parallel-major):

- D minor (aeolian): F = III (the 3rd degree of aeolian), Bb = VI, C = VII
- D major (ionian): D = I, E = II, F# = III

Non-diatonic/borrowed chords keep chromatic labels: C in D major = bVII (circle.js:141-151). [STABLE]

Quality casing follows the chord itself: major/augmented = upper case (V, V+); minor/diminished = lower case (v, ii°). [STABLE]

---

**Anchors verified:** circle.js (ROOTS, MODES, MODE_STEPS; preferredTonicName,
scaleInKey, diatonicInKey, soloScaleInKey, noteInKey), songbook.js (MODE_STEPS sync,
diatonicChords, dispChordName), tracks.js (dispChord/dispKeyRoot, studioTheory),
sugg.js (SUGG), test/theory-canon.test.js, test/key-spelling.test.js
