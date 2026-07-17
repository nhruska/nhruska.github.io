<!-- GENERATED from music/engineering-wiki/: theory-engine/architecture.md, theory-engine/note-spelling.md, theory-engine/harmonization.md, theory-engine/solo-scales.md, theory-engine/theory-verification.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Theory

The theory engine is the app's credibility core: one wrong chord spelling or scale note and a theory-literate player dismisses it as a toy forever. This document is the full contract - spelling, harmonization, solo scales, and how it's verified.

## Pitch-class core vs. spelling-as-display

The engine computes on pitch classes (0-11): intervals, diatonic qualities, degrees, key relationships, transposition. That math is exact and independent of naming. Spelling is a separate, swappable display layer fed by four name-emitting surfaces, all currently canonical-sharp:

| Surface | Emits |
|---|---|
| Scale spelling (`Circle.spellScale`) | Sharp note names per pitch class; mode does not affect spelling |
| Diatonic chords (`Songbook.diatonicChords`) | Sharp-named roots from the shared ROOTS table |
| Suggestion seed map (`SUGG`) | Hand-curated progression followers, all roots sharp-canonical |

Flat input normalizes on load (`"Bb" -> "A#"`); flats never appear in output or persisted data.

`Circle.MODE_STEPS` is the single source of truth for every mode's semitone steps - `Songbook` re-syncs from it at load time, and every computation (diatonic, mode-change, degrees) derives from this one table. No hand-coded step lists exist elsewhere.

| Mode | Steps | Aliases |
|---|---|---|
| Ionian (Major) | `[0,2,4,5,7,9,11]` | 'major' |
| Aeolian (Minor) | `[0,2,3,5,7,8,10]` | 'minor' |
| Dorian | `[0,2,3,5,7,9,10]` | - |
| Phrygian | `[0,1,3,5,7,8,10]` | - |
| Lydian | `[0,2,4,6,7,9,11]` | - |
| Mixolydian | `[0,2,4,5,7,9,10]` | - |
| Locrian | `[0,1,3,5,6,8,10]` | - |

## Canonical-sharp spelling (FORK-4)

One spelling per pitch class, everywhere: `C C# D D# E F F# G G# A A# B`. Pick D#, and the key label, scale, chords-in-key, circle of fifths, and fret notes all say D# - never Eb.

| Cost | Accepted because |
|---|---|
| Scale listings don't follow letter-per-degree notation | D# mixolydian = D# F G G# A# C C# (letters repeat) |
| Some names diverge from common usage | App says A# where charts say Bb; Studio prose hints "often written Bb" |
| Chord voicings looked up enharmonically | A request for A# finds a hand-curated Bb fingering; display stays canonical |

**Sharp-tie policy:** when a pitch class has two equal-accidental spellings (F#/Gb, C#/Db, A#/Bb, D#/Eb), ties render sharp. This is a deliberate PRODUCT policy (not standard conservatory practice) - an independent adversarial review classified it "documented policy, not a bug."

## The #98 key-aware spelling seam (regime flip in flight)

PR #98 introduces regime B: scale names follow conservatory letter-sequential rules (seven letters, each once, fewest accidentals) instead of always-sharp. Until #98 merges, regime A (canonical-sharp, above) is what ships.

| Regime | Active | Ab-major example |
|---|---|---|
| A (current) | main | `G# A# C C# D# F G` |
| B (post-#98) | in flight | `Ab Bb C Db Eb F G` |

Regime B reads through seam functions `spellScaleKeyAware(root, mode)` and `keyLabel` - not yet on main. **Any statement here marked with a #98 seam reference flips when that PR merges; re-verify against the wiki's [note-spelling.md](../theory-engine/note-spelling.md) at that point.**

Twelve adversarial "golden trap" cases gate regime B's acceptance (F major -> `F G A Bb C D E`; C# major renders as Db major; G# minor stays G# minor, not Ab minor; and nine more covering enharmonic-boundary keys). Full list: [note-spelling.md](../theory-engine/note-spelling.md).

## Harmonization

Triads are built by stacking thirds within the mode's own scale (root, +2 degrees for the third, +4 for the fifth; measure the resulting intervals for quality). Diminished degrees are computed correctly but dropped from the strumming palette - solo scales retain every tone.

**Roman numerals are mode-local:** a chord is numbered by its position in the currently-selected mode (D minor: F = III; A# = VI). Borrowed/non-diatonic chords keep chromatic labels (C in D major = bVII). Quality casing follows the chord itself, not the degree's natural quality - so a harmonic-minor V (a major triad on a naturally-minor degree) reads V, not v.

**Harmonic-minor exception:** in minor keys, the major triad on degree 5 (and its dominant 7th) counts as in-key, because i -> V -> i is the default cadence of real minor-key songs. Vmaj7 stays out.

**Suggestion engine** (next-chord row): seed map of hand-curated followers -> filter to the current key's scale degrees + qualities -> keep the harmonic-minor-V exception -> boost chords completing a famous progression (I V vi IV, ii V I, ...) -> fall back to unfiltered suggestions if filtering empties the row. A dominant 7th reduces to its triad for matching (D7 counts as D in G major).

## Solo scales: mode scales, pentatonics, and blues

**The hard boundary:** five- and six-note scales never get a diatonic triad palette. Harmonization runs exclusively on 7-note modes. Pentatonics and blues exist only in the solo layer (Studio fretboard, degree labels) - a chip selection changes what you solo with, never what the progression harmonizes to.

| id | Label | Steps | Degrees | Subset of |
|---|---|---|---|---|
| pentMajor | Major pentatonic | `[0,2,4,7,9]` | `1 2 3 5 6` | ionian, lydian, mixolydian |
| pentMinor | Minor pentatonic | `[0,3,5,7,10]` | `1 b3 4 5 b7` | aeolian, dorian, phrygian |
| blues | Blues | `[0,3,5,6,7,10]` | `1 b3 4 b5 5 b7` | pentMinor + the b5 blue note |

The subset rows are pitch-class-set facts, tested (12 roots x 3 scales) - "one movable pattern works over every mode in the family" is a proof, not marketing.

Code home: `Circle.SOLO_SCALES` (registry), `Circle.soloScale(root, scaleId)` (names), `Circle.soloScaleDegrees(scaleId)`, `Circle.soloScaleInfo(scaleId)` - additive block in `circle.js`, the same interval SSOT (a second theory module would fork the single-source rule).

**Blue-note spelling has two regimes.** Regime A (now): all names via `spell()`; `A blues = A C D D# E G` - the blue note renders sharp because FORK-4's one-table rule keeps the scale list and fretboard in agreement; do not special-case it. Regime B (post-#98, queued, not built): the blue note becomes the key-aware 5th-degree letter flattened (`A blues -> Eb`, never D#). Regime B consumes only the named #98 seam functions - if #98 merges without them, this stays blocked, not improvised.

## Verification: the deterministic canon + an adversarial pass

`test/theory-canon.test.js` asserts pitch-class correctness, chord quality, and roman degree/case for 12 roots x 4 studio modes x (7 scale tones + 7 chords + 7 romans) = **1008 checks**, grouped so a failure names the exact root+mode+degree. It never checks spelling itself (a display-regime choice, not a correctness fact) - the ground-truth encoder uses letter-sequential spelling deliberately, so its output differs from regime-A app output by design; only pitch class, quality, and degree are asserted as facts.

An independent adversarial review (a GPT-5.5 senior-professor persona instructed to refute the theory, given the full app + both regimes) found **no theory bugs**: pitch class, degree order, triad quality, and roman case/symbol all held. Its one finding was the sharp-tie policy call above (documented, not a bug), plus the 12 golden-trap cases for regime B.

A red canon test means a real regression (someone changed `MODE_STEPS`, a quality table, or a labeling path) - never loosen the test, find the change. The canon was corruption-tested at creation: a deliberate quality-table break produced an exact-context failure before being reverted, proving the suite can actually fail.

**Extending the canon** (new scale or mode): add the interval entry at the SSOT (`MODE_STEPS` for 7-note modes, `SOLO_SCALES` for solo scales) -> add pitch-class/degree expectations across all 12 roots -> for pentatonics, hand-verify the subset proofs -> for anything spelling-sensitive, check the golden-trap cases and comment any blue-note-class decision with its regime -> update the Studio UI and the wiki's [solo-scales.md](../theory-engine/solo-scales.md) if user-visible. No hand-coded scale/chord table should exist anywhere else in the codebase.

## Related generated docs

[ARCHITECTURE.md](ARCHITECTURE.md) - where the theory core sits in the runtime. [TESTING.md](TESTING.md) - how the canon runs in CI. [DECISIONS.md](DECISIONS.md) - the ruled decisions (FORK-4, SHARP-TIE, ROMAN-HYBRID, SOLO-BOUNDARY, BLUE-NOTE-A) this page implements.
