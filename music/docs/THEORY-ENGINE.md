# Theory engine - behavior, assumptions, and limitations

User-facing contract for how the app names notes, labels chords, and suggests
what to play next. Written for a musician audience (including gigging and
classically trained players) - these are deliberate simplifications, not bugs.
Owner-approved design decisions are marked with their decision IDs.

## Architecture: pitch-class core, spelling as a display policy

The engine computes on PITCH CLASSES (integers 0-11): intervals, diatonic
qualities, scale degrees, key relationships, transposition. None of that
depends on how a note is spelled - the math is exact and unaffected by any
naming policy. Spelling is a display concern owned by a SINGLE source of truth:
circle.js's key-aware layer (spellScaleKeyAware / diatonicKeyAware / keyLabel /
spellKeyAware). The theory surfaces DELEGATE to it - songbook.js's Compose chips +
key picker and tracks.js's Studio scale/chords/fretboard all call the circle.js
key-aware functions rather than re-spelling (#85 SSOT: songbook.js keeps only an
inline canonical-sharp fallback for the circle-absent case, mirroring how it
already pulls MODE_STEPS from circle). Pitch-class math, its tests, and stored
data are untouched by any respelling, so the policy below is swappable (per
release, eventually per user preference) by changing that one engine. Key-aware
conventional spelling is the current policy, not a structural commitment.

## Note naming: key-aware conventional spelling (#85, reverses FORK-4)

- The app spells each key the way a musician reads it: FLAT keys render flats,
  SHARP keys render sharps, C/naturals stay natural. F major is F G A Bb C D E
  (never A#); G major is G A B C D E F#; Db major is Db Eb F Gb Ab Bb C.
- Scale spelling follows letter-per-degree notation rules: each of the seven
  degrees takes the next letter name, so no letter repeats or is skipped (F major
  uses B-flat for its 4th, not A-sharp). This REVERSES the earlier FORK-4
  "canonical sharp everywhere" policy, whose known cost was exactly this (D#
  mixolydian rendered D# F G G# A# C C#, letters repeating).
- Chromatic (out-of-key) notes follow the key's flat/sharp orientation: a passing
  F#/Gb reads Gb in a flat key, F# in a sharp key.
- The KEY PICKER and key labels show the conventional name while the stored value
  stays canonical-sharp (so transpose / chord-membership / filtering are unchanged
  - only the label flips): the A# button reads "Bb", C# reads "Db".
- The tritone key is spelled on the sharp side (F# major, D# minor), so F# major
  legitimately carries an E#.
- Instrument chord voicings are found enharmonically, bidirectionally: flat keys
  hit the curated flat fingerings (Bb, Eb, Ab, Db) directly; a canonical-sharp
  request still resolves too. The displayed name follows the key.
- NOT yet key-aware (kept canonical, deliberate follow-up): the circle-of-fifths
  WHEEL labels + its neighbour tinting (parallel-key spelling + tint-string
  matching need their own pass), and the Library/Repertoire key facet + curated
  track-data labels.

## Roman numerals: mode-degree convention

- Diatonic chords are numbered by their position in the selected mode's own
  scale: in D minor, F is III, Bb is VI, C is VII (classical/modal convention).
- This intentionally differs from the parallel-major convention common in
  rock/jam charts (bIII, bVI, bVII). One convention is used consistently across
  Compose and the Studio - that consistency is the point.
- Non-diatonic (borrowed) chords keep chromatic parallel-major labels: a D major
  chord in D minor reads I; an A# chord in C major reads bVII.
- Quality casing follows the chord itself: major = upper case (V), minor =
  lower case (v), diminished = lower case with a degree sign (ii°).

## "Add a chord" suggestions: how the row is built

1. A seed map of common progressions proposes followers of what you just played
   (and, weighted lower, of everything in your progression so far).
2. When a key is set, the row is filtered to chords that belong to the key:
   root on a scale degree AND matching triad quality (7ths count as their
   triad: D7 counts as D in G major, Dm7 does not).
3. Harmonic-minor exception (D1): in a minor key, the degree-5 MAJOR triad and
   dominant 7th (A and A7 in D minor) are treated as in-key - the i -> V7 -> i
   cadence is the default grammar of real minor-key songs. Vmaj7 is not.
4. Chords that would complete a famous progression (I V vi IV, doo-wop,
   ii V I, Pachelbel, ...) jump to the front of the row with an accent glow.
5. If the filter would empty the row (your progression is out-of-key), the
   unfiltered suggestions show instead - a borrowed suggestion beats none, and
   its numeral is labeled chromatically and honestly.

Verified golden paths (start with the tonic, tap the first suggestion 3 times):

| Key | Path | Romans |
|---|---|---|
| C Major | C -> G -> Am -> F | I V vi IV (the "4-chord song") |
| D Minor | Dm -> Am -> Bb -> F | i v VI III (A7 = V appears in the row) |
| A Minor | Am -> Em -> F -> C | i v VI III |

## Known limitations (documented, not hidden)

- Suggestions come from a hand-written seed map, not generative harmony - deep
  jazz substitutions, modal interchange and chromatic planing are out of scope.
  The full chromatic palette is always one tap away in the All tab.
- After filtering, a row may hold fewer than 5 chips. Fewer-but-honest is the
  current design; the All tab is the escape hatch.
- The mode-degree numeral convention (VII in mixolydian rather than bVII) can
  differ from what jam-pedagogy content teaches. If pilot feedback shows
  confusion, the revisit is app-wide, not per-surface.
- Key-aware spelling covers the Compose + Studio theory surfaces; the circle-of-
  fifths wheel, the Library/Repertoire key facet and curated track-data labels
  remain canonical-sharp (see "Note naming" above - deliberate follow-up wave).
