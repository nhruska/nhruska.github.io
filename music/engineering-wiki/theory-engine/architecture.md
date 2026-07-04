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

Consequence: the naming policy is swappable at display time (per release, eventually per user preference) by changing the four name-emitting surfaces only - the theory computations, their tests, and stored data are untouched.

## Four name-emitting surfaces (all canonical-sharp) [STABLE]

Every surface echoes the same sharp table (ROOTS row, circle.js:20) and normalizes flat input on entry (F2S lookup, circle.js:21-22):

| Surface | Source | Emits |
|---|---|---|
| Scale spelling | `Circle.spellScale(root, mode)` (circle.js:69-72) | Sharp note names per pitch class; mode does not affect spelling [TRACKS-#98] |
| Diatonic chords | `Songbook.diatonicChords(root, modeKey)` (songbook.js:97-105) | Sharp-named roots from the ROOTS table (songbook.js:69, mirrors circle.js ROOTS) |
| Suggestion seed map | `SUGG` (play/index.html:295-304) | Hand-curated progression followers; all roots are sharp-canonical |
| Solo scales | `Circle.soloScale(root, scaleId)` (SOLO_SCALES block) | Pentatonic/blues names via the same internal spell() provider - the regime-B seam swaps only this provider [TRACKS-#98] |

Flat input resolves to sharp on load: "Bb" -> "A#" (norm() / F2S lookup). Flats never appear in output or persisted data. [STABLE]

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

- D minor (aeolian): F = III (the 3rd degree of aeolian), A# = VI, C = VII
- D major (ionian): D = I, E = II, F# = III

Non-diatonic/borrowed chords keep chromatic labels: C in D major = bVII (circle.js:141-151). [STABLE]

Quality casing follows the chord itself: major/augmented = upper case (V, V+); minor/diminished = lower case (v, ii°). [STABLE]

---

**Anchors verified:** circle.js:20-37 (ROOTS, MODES, MODE_STEPS), circle.js:69-75 (spellScale/spellRoot), songbook.js:69-89 (ROOTS, MODE_STEPS sync), songbook.js:97-105 (diatonicChords), play/index.html:295-304 (SUGG), test/theory-canon.test.js
