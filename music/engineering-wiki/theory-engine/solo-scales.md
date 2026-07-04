# Solo Scales

[Wiki](../index.md) > theory-engine > Solo Scales

## Purpose

The solo layer: mode scales, pentatonic major/minor, and blues - what you solo WITH, as distinct from what harmonizes the progression. Includes the S-BLUES contract (binding, per wiki-ia-20260704.md §3).

## The solo-vs-harmonization boundary [STABLE]

**Amended by M-GUIDE W2** (m-guide-ia-20260704.md section 1, professor-fold-confirmed display-only per section 8C): Blues now ALSO exists as a separate, palette-KIND harmonizing key model - `songbook.js MODES.Blues` / `Circle.BLUES_KEY` (I7/IV7/V7, 3 degrees) - reachable via an explicit Compose mode pick or a Blues starter. The boundary below narrows accordingly: **PENTATONICS never harmonize** (pentMajor/pentMinor stay solo-layer-only, no triad palette, exactly as before); Blues is the one solo-layer scale that now has a harmonizing counterpart, and the two are DELIBERATELY KEPT SEPARATE - the SOLO_SCALES.blues 6-note scale (this page) never feeds chordInKey/romanInKey/completions, and BLUES_KEY's 3-note I7/IV7/V7 palette never feeds the solo fretboard/degree rendering. See [harmonization.md](harmonization.md) for the full BLUES_KEY contract.

Five- and six-note SOLO scales NEVER get a diatonic triad palette (this remains true for pentatonics unconditionally, and for the blues SOLO scale specifically - only the separate BLUES_KEY model harmonizes). Harmonization (chords-in-key, roman labels, mode re-harmonize) runs on 7-note modes plus the one 3-degree Blues palette. Pentatonics exist ONLY in the solo layer: the Studio's scale panel, fretboard rendering, and degree labels. A chip selection changes what you solo with - never what the progression harmonizes to. [STABLE]

## Mode scales (7 notes) [STABLE]

Interval steps per mode (Circle.MODE_STEPS, circle.js:34-37). Studio-curated teaching set = Major (ionian), Minor (aeolian), Mixolydian, Dorian; the full 7 modes are reachable via the circle-of-fifths surfaces. Rendered in canonical-sharp spelling. [TRACKS-#98]

| Mode | Steps | Degrees |
|---|---|---|
| Ionian (Major) | [0,2,4,5,7,9,11] | 1 2 3 4 5 6 7 |
| Aeolian (Minor) | [0,2,3,5,7,8,10] | 1 2 b3 4 5 b6 b7 |
| Dorian | [0,2,3,5,7,9,10] | 1 2 b3 4 5 6 b7 |
| Mixolydian | [0,2,4,5,7,9,10] | 1 2 3 4 5 6 b7 |

## Pentatonic + blues tables (S-BLUES §3a) [STABLE]

| id | Label | Steps | Degrees | Subset of |
|---|---|---|---|---|
| pentMajor | Major pentatonic | [0,2,4,7,9] | 1 2 3 5 6 | ionian, lydian, mixolydian |
| pentMinor | Minor pentatonic | [0,3,5,7,10] | 1 b3 4 5 b7 | aeolian, dorian, phrygian |
| blues | Blues | [0,3,5,6,7,10] | 1 b3 4 b5 5 b7 | pentMinor + the b5 blue note |

Degree glyphs use the flat sign matching circle.js scaleDegrees. The subset rows are pitch-class-set FACTS, tested in test/solo-scales.test.js. Player phrasing of the same fact: the relative-pent trick - C major pent IS the A minor pent shape; keep C as home. [STABLE]

**Box-position labels (Box 1-5, root-string + start-fret callouts) SHIPPED (S-BLUES-BOXES, 2026-07-04)** - `KeyExplorer.boxes(rootPc, scaleId, openPcs)` (key-explorer.js) computes the 5 CAGED-derived teaching windows purely from pitch-class math: each box's start fret is the natural fret on the lowest string (index 0 of the caller's openPcs) where the next pentatonic-minor scale degree (root, b3, 4, 5, b7) occurs above the previous box, wrap-folded back an octave if it would exceed the pager's fret-14 cap (never below fret 0). blues rides the SAME 5 windows as pentMinor (the b5 passing tone never earns its own box); pentMajor's windows derive from the relative-minor root (rootPc - 3, "the same shapes" - see the pentatonic table above), but each box's labeled root-string anchor is re-solved for the ACTUAL major rootPc so the highlighted tonic always matches the query. moveHint is template-generated (A9 discipline - no curated per-box prose): the fret delta to the next box in NECK order (ascending startFret, not box-number order). Generalizes to every instrument profile via `openPcsFromPack` (derives openPcs from the profile's own `strings[].n` letter names - "lowest string" is this codebase's existing string-index-0 convention, not necessarily lowest acoustic pitch on a re-entrant neck like ukulele). Captions/docs may now speak "box" language (P5 fold unlocked). See [D-BLUES-BOXES](../decisions.md) + [systems/practice-studio.md](../systems/practice-studio.md).

## Code home (S-BLUES §3b) [STABLE]

Additive block in circle.js (the interval SSOT - a second theory module would fork the single-source rule):

- `Circle.SOLO_SCALES` - the registry
- `Circle.soloScale(root, scaleId)` - note names (via the internal spell() provider)
- `Circle.soloScaleDegrees(scaleId)` - degree labels
- `Circle.soloScaleInfo(scaleId)` - metadata

## UI surfacing (S-BLUES §3c) [STABLE]

Studio solo section gets one chip row `.bt-st-scalechips`: [Mode label | Pent major | Pent minor | Blues]. Default = the mode scale (Studio open behavior unchanged). A tap re-derives ONLY the solo bundle - notes line, degrees, fretboard via `KeyExplorer.renderScale` - through the pure `Tracks.soloBundle(key, mode, scaleId)`. Untouched by design: chords-in-key, buildWhy wheel, whynote banner, the Compose palette. No persistence (display preference belongs to the queued S-DIAGRAM-PREF).

**M-GUIDE W2 dedupe:** when the Studio's own mode chip IS already Blues (`th.scaleMode === 'blues'` - i.e. the track/progression is keyed in the BLUES_KEY harmonizing model), the standalone 'Blues' chip is filtered out of the row to avoid a redundant second button offering the identical bundle - the row becomes [Blues | Pent major | Pent minor] (3 chips). Every other mode (major/minor/dorian/mixolydian) still shows all 4.

Framing copy per selection (static templates; P5-fold rewrite, player-true):
- Pent major: "The inside sound over {family} and dominant vamps - same shape as its relative minor pent, two frets down; keep the root as home."
- Pent minor: "Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck."
- Blues: "Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub."

## Blue-note spelling - both regimes (S-BLUES §3d) [TRACKS-#98]

**Regime A (current, canonical-sharp):** all names via spell(); `A blues = A C D D# E G`. The blue note renders sharp-spelled because FORK-4's one-table rule is what keeps the scale list and the fretboard in agreement. Do NOT special-case it. This is documented policy, exactly like the sharp-tie precedent the professor classified policy-not-bug. Player-honesty note (P5): the b5 SHOWS as D# today and will READ as Eb once key-aware spelling lands (S-BLUES-B, queued on #98) - the pitch is right; the letter is scheduled.

**Regime B (post-#98, S-BLUES-B - queued, not built):** pentatonic names come from subsetting `spellScaleKeyAware(root, parentMode)` at the pentatonic degrees; the blue note = the key-aware 5th-degree LETTER flattened one semitone (A blues -> Eb, never D#; invariant: the blue note spells b5, never #4). Consumes ONLY the named #98 seam (`spellScaleKeyAware`, `keyLabel`); if #98 merges without them, S-BLUES-B is BLOCKED, not improvised.

Code seam: soloScale routes every name through ONE internal provider; S-BLUES-B swaps only the provider.

## Testing (S-BLUES §3e) [STABLE]

- test/solo-scales.test.js: 12 roots x 3 scales - pcs match steps mod 12; names match spell(); degree arrays exact; lengths 5/5/6; unknown id safe.
- test/theory-canon.test.js: scales-canon literals (incl. `A blues = A C D D# E G` with the REGIME-A comment marking the deliberate Eb flip at S-BLUES-B); also BLUES_KEY_CANON (the SEPARATE harmonizing-model canon, W2) - 12 roots x literal `C7 F7 G7`-style chord strings + the `['I7','IV7','V7']` roman lock.
- test/tracks.test.js: soloBundle per id; 'mode' delegates to studioTheory; harmonization-isolation (chords identical before/after any chip selection - W2 adds the inverse case: a Blues-mode Studio's own I7/IV7/V7 chords survive every solo-scale chip tap).
- test/key-explorer-boxes.test.js (S-BLUES-BOXES): `KeyExplorer.boxes` - 12 roots x 3 scale ids x 2 tunings (guitar, ukulele) = 72 cases, asserting box count (5), startFret range (0-14), root-string anchor correctness BY PITCH-CLASS MATH (not a golden fret table), non-empty label/moveHint, pentMajor/pentMinor relative-key window equivalence, blues/pentMinor window equivalence, plus `openPcsFromPack` safety. test/key-explorer.dom.test.js covers the renderScale() pager-snap + chip DOM wiring; test/tracks.test.js covers `boxScaleIdFor`.

---

**Anchors verified:** circle.js:34-37 (MODE_STEPS) + SOLO_SCALES block, circle.js BLUES_KEY/bluesKey block (post-SOLO_SCALES, W2), tracks.js solo section + soloBundle + studioTheory's blues branch + the CHIPS dedupe filter + boxScaleIdFor, key-explorer.js renderScale (opts.boxScaleId pager-snap + chip) + boxes/openPcsFromPack (S-BLUES-BOXES), wiki-ia-20260704.md §3 (binding seam) + section 8C (wheel-tint display-only confirmation), test/solo-scales.test.js, test/theory-canon.test.js, test/key-explorer-boxes.test.js
