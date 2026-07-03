# Theory engine - behavior, assumptions, and limitations

User-facing contract for how the app names notes, labels chords, and suggests
what to play next. Written for a musician audience (including gigging and
classically trained players) - these are deliberate simplifications, not bugs.
Owner-approved design decisions are marked with their decision IDs.

## Note naming: canonical sharps (FORK-4)

- The app uses ONE spelling per pitch class, everywhere: C C# D D# E F F# G G# A A# B.
- What you pick is what every surface shows: choose D#, and the key label, scale,
  chords-in-key, circle of fifths and fret notes all say D# - never Eb.
- Flat input is accepted (typing or importing Bb resolves to A#), but flats never
  appear in output.
- Known costs, accepted for consistency on a fretboard/tab-oriented surface:
  - Scale listings do not follow letter-per-degree notation rules. D# mixolydian
    renders as D# F G G# A# C C# (letters repeat; no E or B appears). A
    notation-literate reader will notice - it is intentional.
  - Some names diverge from common usage (the app says A# where charts say Bb).
    The Studio's mode lesson bridges this with "often written Bb" hints in its
    prose; labels stay canonical.
- Instrument chord voicings are found enharmonically: a request for A# finds a
  hand-curated Bb fingering. The displayed name stays canonical.

## Roman numerals: mode-degree convention

- Diatonic chords are numbered by their position in the selected mode's own
  scale: in D minor, F is III, A# is VI, C is VII (classical/modal convention).
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
| D Minor | Dm -> Am -> A# -> F | i v VI III (A7 = V appears in the row) |
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
- The canonical-sharp policy does not yet cover the Library/Repertoire key
  facet or curated track data labels (planned follow-up wave).
