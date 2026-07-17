# Harmonization

[Wiki](../index.md) > theory-engine > Harmonization

## Purpose

How the app builds diatonic triads, filters by key, suggests chord progressions, and handles the harmonic-minor exception.

## Diatonic triads (stacked thirds) [STABLE]

Triads are built by stacking thirds within the mode's own scale (conservatory method). For each scale degree: root, add the 3rd (2 scale degrees up), add the 5th (4 degrees up); measure intervals; derive quality. [STABLE]

| Source | Method |
|---|---|
| circle.js:107-119 (diatonic) | Per degree: stack third + fifth; measure semitone intervals; look up quality |
| circle.js:99-105 (triadQuality) | 4 semitones = major third, 7 = perfect fifth -> major triad; etc. |

Result: pitch-class-correct, mode-correct roman numeral + case, and sharp-canonical chord names (ROOTS-indexed). [STABLE]

Diminished degrees are computed correctly but dropped from the STRUMMING palette (songbook.js diatonicChords) - rarely playable on these instruments. Solo scales retain every tone for fretboard completeness. [STABLE]

## Roman numeral convention (mode-aware) [STABLE]

Diatonic chords are numbered by scale-degree position in the SELECTED MODE (mode-local convention). C in A minor reads III, not bIII. [STABLE]

| Function | Use | Result |
|---|---|---|
| `romanInKey(chord, root, modeKey)` (songbook.js:147-167) | Key known | Mode-degree numeral if in-key (III); chromatic label if borrowed (bVII) |
| `Circle.romanFor(chord, tonicChord)` (circle.js:141-151) | Key unknown / generic interval | Chromatic label always (RN_CHROM: I bII II bIII ...) |

Quality casing: the CHORD's own quality cases the numeral, not the degree's natural quality. Harmonic-minor V (major chord on a naturally-minor degree) reads V, not v. [STABLE]

## Harmonic-minor exception (degree-5 major) [STABLE]

In minor keys, the degree-5 MAJOR triad and its dominant 7th are admitted as in-key (chordInKey whitelist, songbook.js:125-139). [STABLE]

Reason: i -> V -> i is the default cadence of real minor-key songs; strict natural-minor filtering strips the most-played chord. Vmaj7 stays out - not the harmonic-minor dominant. [STABLE]

| Key | In-key degree-5 |
|---|---|
| D minor | A (major); A7 also in-key |
| A minor | E (major); E7 also in-key |

## "Add a chord" suggestion engine [STABLE]

The next-chord suggestion row is built in stages (songbook.js suggestion merge + play/index.html SUGG):

1. **Seed map (SUGG, play/index.html ~295):** hand-curated Markov followers - what commonly comes next.
2. **Key filter (key set):** keep chords whose root sits on a scale degree AND whose quality matches that degree.
3. **Harmonic-minor exception:** minor keys also keep degree-5 major (V, V7).
4. **Famous-progression boost:** chords completing a known progression (I V vi IV, ii V I, ...) float to the front with the accent glow.
5. **Fallback:** if filtering empties the row (out-of-key progression), show unfiltered suggestions - a borrowed suggestion beats none.

Quality matching detail: a dominant 7th reduces to its triad for matching (D7 counts as D in G major; Dm7 does not) (songbook.js:107-139). [STABLE]

All name-emitting surfaces share the same canonical-sharp ROOTS table. [STABLE]

## Blues palette (I7/IV7/V7) - a 3-degree harmonizing key model (M-GUIDE W2) [STABLE]

`MODES.Blues` (songbook.js) is a palette-KIND entry, not a diatonic mode: 3 degrees (`steps: [0, 5, 7]`), every one a dominant quality (`quals: ['7','7','7']`), its own roman set (`romans: ['I','IV','V']`). It sits alongside `Circle.BLUES_KEY`/`Circle.bluesKey(root)` in circle.js (same shape as `Circle.diatonic()` output: `{roman, chord, root, quality}`), which the Studio's `studioTheory` reads directly for its chords-in-key row - the two representations (songbook's MODES entry for Compose, circle.js's BLUES_KEY for the Studio) are kept in lockstep by the theory-canon test (BLUES_KEY_CANON) asserting the same 12-root palette both surfaces derive from. [STABLE]

| Root | I7 IV7 V7 |
|---|---|
| C | C7 F7 G7 |
| C# | C#7 F#7 G#7 |
| D | D7 G7 A7 |
| D# | D#7 G#7 A#7 |
| E | E7 A7 B7 |
| F | F7 A#7 C7 |
| F# | F#7 B7 C#7 |
| G | G7 C7 D7 |
| G# | G#7 C#7 D#7 |
| A | A7 D7 E7 |
| A# | A#7 D#7 F7 |
| B | B7 E7 F#7 |

**In-key rule (minimalism by design):** `chordInKey` on a Blues palette degree (`m.quals[deg] === '7'`) accepts ONLY a plain root triad OR its dominant 7th - no ii/dim/maj7/subs. The "All" chord view is the deliberate escape hatch for anything outside the palette. `romanInKey` labels the dominant 7th as the diagnostic form (C7 = I7) and the plain triad as the bare numeral (C = I); a borrowed/off-palette root falls through to the chromatic `Circle.romanFor` label, same as any diatonic mode. [STABLE]

**Never auto-inferred:** `inferKey` only ever proposes Major/Minor candidates - Blues is reachable exclusively by an explicit mode pick or one of the two Blues starters (12-bar, quick-change). `completions()` (the famous-progression auto-suggest) top-guards Blues to `[]` outright: its degree-matching measures against the 7-degree MAJOR-scale canon, a category mismatch for a 3-degree palette. [STABLE]

**convertProgressionQualities - the 4 Blues directions (professor fold 8A, m-guide-ia-20260704.md section 8):**

| Direction | Rule |
|---|---|
| Major/Minor/Mixo/Dorian -> Blues | A root at offsets {0,5,7} from the tonic becomes `root + '7'` regardless of any prior extension (the target degree's `baseQual` is `'7'`, which always wins); other roots are left unchanged. |
| Blues -> any diatonic (dom-7-strip) | Applies ONLY when the chord's root sits on a BLUES PALETTE degree - offsets {0,5,7} from the SOURCE tonic, NOT any degree the target mode happens to have there (this is the fold amendment - it supersedes an earlier "root on a target degree" draft). A plain dominant 7th on a palette root is treated as a bare triad before target re-qualification (C7/F7/G7 -> C/F/G in Major, Cm/Fm/Gm in Minor); a surviving m7/maj7 keeps its own extension-class survival (not stripped). A root NOT on the blues palette (e.g. a user-added A7 over a C blues) is not palette material and is left byte-for-byte unchanged, even though it may sit on a valid degree of the target mode - canon case: C blues `[C7, F7, G7, A7]` -> Major = `[C, F, G, A7]` (A7 survives). |
| Blues -> Blues | Idempotent - palette roots stay dominant 7ths. |
| Target-quality branch | Whenever the TARGET degree's `baseQual` is `'7'` (i.e. converting INTO Blues), the extension always collapses to the dominant 7th - checked first, before the extension-detection branches used for every other mode pair. |

---

**Anchors verified:** circle.js:99-151 (triadQuality, diatonic, romanFor, RN_CHROM), circle.js BLUES_KEY/bluesKey/chordTones block (post-SOLO_SCALES), songbook.js:76-83 (MODES.Blues), songbook.js:97-167 (diatonicChords, chordInKey, romanInKey), songbook.js ~238-291 (convertProgressionQualities incl. Blues directions), songbook.js ~325-330 (completions Blues guard), songbook.js suggestion merge (mergeSuggestionRow), play/index.html SUGG (~295), test/theory-canon.test.js BLUES_KEY_CANON, test/songbook.test.js W2 Blues test block, m-guide-ia-20260704.md sections 1 + 8
