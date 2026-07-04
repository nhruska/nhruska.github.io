# Note Spelling

[Wiki](../index.md) > theory-engine > Note Spelling

## Purpose

Canonical-sharp spelling policy (FORK-4), the sharp-tie deterministic rule, and the #98 key-aware regime seam that will flip all statements marked `[TRACKS-#98]`.

## Canonical sharps (FORK-4) [STABLE]

The app uses ONE spelling per pitch class, everywhere: C C# D D# E F F# G G# A A# B. What you pick is what every surface shows - choose D#, and the key label, scale, chords-in-key, circle of fifths, and fret notes all say D# (never Eb). [STABLE]

Flat input is accepted (typing or importing Bb), but flats never appear in output (norm() lookup, circle.js:21-25). [STABLE]

| Cost | Accepted |
|---|---|
| Scale listings do not follow letter-per-degree notation | D# mixolydian = D# F G G# A# C C# (letters repeat; no E or B) |
| Some names diverge from common usage | The app says A# where charts say Bb; Studio hints "often written Bb" in prose |
| Instrument chord voicings found enharmonically | A request for A# finds a hand-curated Bb fingering; display name stays canonical |

## Sharp-tie deterministic policy [STABLE]

When a pitch class has two enharmonic spellings with equal accidentals (F#/Gb, C#/Db, A#/Bb, D#/Eb), ties render SHARP (circle.js:20, ROOTS row). This is a PRODUCT POLICY, not standard conservatory practice. [STABLE]

Basis: conservatory practice treats F#/Gb and D#/Eb as legitimate equal-accidental spellings; guitar pedagogy leans sharp. For a fretboard-oriented surface, ties render sharp consistently. [STABLE]

Ground truth: tested against conservatory letter-sequential + stacked-thirds rules (test/theory-canon.test.js). Professor verdict: tie policy documented, not a bug (theory-professor-review-20260703.md, disposition). [STABLE]

| Pitch Class | Sharp | Flat | Rendered |
|---|---|---|---|
| 1 | C# | Db | C# |
| 3 | D# | Eb | D# |
| 6 | F# | Gb | F# |
| 8 | G# | Ab | G# |
| 10 | A# | Bb | A# |

## The #98 key-aware spelling seam [TRACKS-#98]

PR #98 (key-aware spelling) introduces regime B: scale names follow conservatory letter-sequential rules (seven letters, each used once, fewest accidentals). Until #98 merges, regime A (current) uses canonical sharps everywhere. [TRACKS-#98]

| Regime | Active | Policy | Example: Ab-major pitch set |
|---|---|---|---|
| A (CURRENT) | main | Canonical-sharp always; mode does not affect spelling | G# A# C C# D# F G |
| B (POST-#98) | PR #98 in flight | Letter-sequential per key+mode; conventional key naming | Ab Bb C Db Eb F G |

Under regime B, scale names come from `spellScaleKeyAware(root, mode)` + `keyLabel` (seam functions on the #98 branch, circle.js ~105-131). Regime A uses `spellScale(root, mode)` (circle.js:69-72). [TRACKS-#98]

## The 12 golden trap cases (professor adversarial, regime-B acceptance) [TRACKS-#98]

When #98 ships and regime B is live, these must hold:

1. F Major -> scale F G A Bb C D E; chords F Gm Am Bb C Dm Edim
2. C# Major -> render as Db Major; scale Db Eb F Gb Ab Bb C; chords Db Ebm Fm Gb Ab Bbm Cdim
3. F# Major -> scale F# G# A# B C# D# E#; chords F# G#m A#m B C# D#m E#dim
4. C# Mixolydian -> scale C# D# E# F# G# A# B; chords C# D#m E#dim F# G#m A#m B
5. D# Minor -> scale D# E# F# G# A# B C#; chords D#m E#dim F# G#m A#m B C#
6. A# Minor -> render as Bb Minor; scale Bb C Db Eb F Gb Ab; chords Bbm Cdim Db Ebm Fm Gb Ab
7. G# Minor -> KEEP G# Minor (not Ab Minor); scale G# A# B C# D# E F#
8. Eb Dorian -> scale Eb F Gb Ab Bb C Db; chords Ebm Fm Gb Ab Bbm Cdim Db
9. Bb Major shape lookup -> display Bb, Eb; no leaked A#, D#
10. Theoretical D# Major if allowed -> D# E# F## G# A# B# C##; otherwise auto-render Eb Major
11. Theoretical Cb Major if allowed -> Cb Db Eb Fb Gb Ab Bb; otherwise auto-render B Major
12. F# Major vii -> symbol E#dim, tones E# G# B; shape may reuse Fdim internally, display must not leak it

Source: theory-professor-review-20260703.md (adversarial verdicts + trap cases, also posted to PR #98's review thread). [TRACKS-#98]

---

**Anchors verified:** circle.js:20-28 (ROOTS, norm, F2S), circle.js:69-87 (spellScale, modeChange), songbook.js:69 (ROOTS), test/theory-canon.test.js (tie policy), theory-professor-review-20260703.md (12 traps, verdicts), #98 branch circle.js ~105-131 (seam fns)
