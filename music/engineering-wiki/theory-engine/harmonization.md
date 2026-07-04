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

---

**Anchors verified:** circle.js:99-151 (triadQuality, diatonic, romanFor, RN_CHROM), songbook.js:97-167 (diatonicChords, chordInKey, romanInKey), songbook.js suggestion merge (mergeSuggestionRow), play/index.html SUGG (~295)
