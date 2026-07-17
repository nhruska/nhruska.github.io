# Goal: M-13 SONG BUILDER landing zone

Operator keyword fired 2026-07-11. Build-half of song sections in Compose: a
section buffer that assembles progressions into a multi-section custom SONG. The
render-half already exists (`renderSheet` / `renderChordOnly` parse
`sheet[[section, line]]`); this LZ builds the sections that feed it.

## Objective / completion condition

In Compose: snapshot the current progression as a labeled section (Intro / Verse
/ Chorus / Bridge / Outro) into an in-memory buffer, stack multiple sections,
then Assemble them into one custom song that opens in the song view showing every
section header + its chord bars. GREEN when the red-first USDD scenario passes and
`node test/run-all.js` is fully green.

## Locked decisions (bench-consulted: songwriting + pedagogy + ux coaches)

1. **Surface:** a compact SONG tray inside the Compose progression box, after the
   `#prog` strip + its post-prog cue slot. Renders ONLY when the progression has
   >=1 chord OR the buffer has >=1 section (never dead chrome on an empty canvas).
   Must not push the In-key/All toggle or the chord grid below the fold at 412x915.
2. **Section labels:** Intro, Verse, Chorus, Bridge, Outro (standard song form,
   matches catalog `sect` usage). Picker = a compact `<select>` (default "Verse")
   - one control, fold-safe; chips deferred to a follow-up.
3. **Add as section:** snapshots the CURRENT progression (canonical-sharp tokens)
   into an in-memory buffer entry `{label, seq:[...]}`. Does NOT clear the
   progression (the musician builds the chorus by editing the verse). Duplicate
   labels allowed (Verse x2).
4. **Buffer removal:** the ONE inline-remove grammar - reuses the exact
   `armRm`/`disarmRm` primitive (quiet at rest, first tap arms red 1600ms, second
   removes). Shared, not re-implemented.
5. **Assemble:** builds a custom song via the EXISTING `createCustomItem` save
   path. `seq` = first-appearance unique chords across all sections; `sheet` =
   one `[label, "[C] [F] ..."]` pair per section (the existing chord-only
   renderer parses these). Key/mode = current Compose songKey via
   `deriveProgressionKey`. After assemble: buffer clears, success toast, song
   opens in the song view (`openPractice`).
6. **Persistence:** buffer is in-memory (session-scoped) for the LZ - additive,
   NO `backup.js` schema bump. Persisting the buffer is a named next goalpost.
7. **A3:** buffer ops (add/remove section, assemble) do NOT touch the progression,
   so they do NOT call `invalidateClearUndo` - progression Clear-undo survives.

## Red-first evidence (USDD)

`test/pw/scenarios/song-builder.json` written FIRST, run against unmodified code:

```
FAIL song-builder
  - 11:assertVisible [{"action": "assertVisible", "selector": "#songTray"}]: #songTray not visible
```

The tray does not exist before the build, so the first assertion that depends on
it fails. After the build the same scenario passes (see PR V&V). The failing
assert proves the acceptance was red before the code existed.

## Next goalposts (spec-listed, NOT built here)

- ~~M-12 template-suggested sections (`SongTemplates.forSection` offered per label).~~ **DONE - goalpost 1 below.**
- Section reorder within the buffer.
- Buffer persistence across reloads (needs a `backup.js` additive field).
- Lyrics entry per section.

## Verification commands

```
node -c music/shared/songbook.js
node test/run-all.js
python3 test/pw/run-scenario.py test/pw/scenarios/song-builder.json
python3 test/pw/run-scenario.py test/pw/scenarios/song-builder-templates.json   # goalpost 1
```

---

# Goalpost 1 (2026-07-11): TEMPLATE-SUGGESTED SECTIONS - the M-12 -> M-13 payoff

When the buffer holds a section and the Compose canvas is empty (the musician
just wrote a Verse and cleared to build the next section), the SONG tray offers
proven-progression chips for a chosen section label, realized in the song's key.
Tap a chip to fill the progression, tweak, then Add as that section.

## Locked decisions (bench-consulted: songwriting + music-theory + ux + a11y coaches)

1. **Trigger:** chips render INSIDE the tray ONLY when the buffer has >=1 section
   AND the progression is EMPTY. Never over authored chords - suggestions are a
   next-section accelerator, never a blank-page crutch or a stomp on the
   musician's own work (pedagogy: write the verse by hand, then get proven
   options for the chorus).
2. **Source:** `SongTemplates.forSection(label, CATALOG)` - the M-12 SSOT
   (mined-catalog patterns first by count, then proven families). No re-ranking
   (music-theory-coach: a picker should not re-sort forSection's order). Cap 4.
3. **Realization (roman -> chord TOKEN):** the app's ONE degree-analysis path,
   `Circle.romanFor`, INVERTED by search over the 12 roots - NOT a second speller
   (the ONE-path rule). The roman's own casing/markers carry the quality; a bVII
   is degree-only. TOKENS stay canonical-sharp (storage/voicing/audio); an
   unrealizable roman (a borrowed/secondary degree Circle can't place) SKIPS the
   whole suggestion, never approximates. Pure + Node-tested: `realizeRoman`,
   `realizeSection`, `romanChordSuffix`.
4. **Realization key:** the live Compose `songKey` when set, else the key the
   BUFFERED sections establish (`deriveProgressionKey` does exactly this fallback).
   Post-Clear the inferred non-explicit key is nulled, so the SONG's own key (the
   verse already written) is what the chips realize in.
5. **DISPLAY:** key-aware via `dispChordNameInKey` (the pure twin of the tray's
   `dispChordName`, now delegating to it - ONE display path). The IV of F reads
   Bb, never A#, even though the TOKEN is canonical-sharp A#.
6. **Chip anatomy:** roman pattern (mono) + realized key-aware chord names +
   provenance (mined -> "from <song>", family -> its name). 44px targets,
   suggestion-tier grammar (dashed outline + surface fill, NOT the accent-fill of
   a selected state - these are offers, not the current pick).
7. **Tap a chip:** fills through the SAME `addChord` path chord taps use (packs/
   voicings resolve, A3 clear-undo invalidates), and pre-sets the add-row label to
   the seeded section so the next "Add section" tags it correctly.
8. **Label switcher:** reuses the `.chordSeg` segmented primitive (Element
   Consistency Law), tappable (ux-coach: recognition over recall). Default Verse.

## UAT addendum folded in (operator live test, 2026-07-11 ~04:45 ET)

1. **Adjacent-section compatibility ranking:** suggestions re-rank by how strongly
   they ARRIVE from the previous buffered section (its last chord as a roman in the
   song key) - the cadence ladder V->I (4) > IV->I (3) > vi->IV (2) > shared chord
   (1), forSection's proven order breaking ties. Caller-side re-rank only (no
   `song-templates.js` edit). Pure + Node-tested: `sectionConnectScore`. Live proof:
   after a Verse ending on V (G in C), the chorus chip starting on I (Axis) ranks
   first.
2. **Assembly cue line:** ONE quiet chrome-tier hint in the tray (`#songTrayCue`,
   S-POSTPROG-CUE grammar, never a modal) naming the next move contextually - "Add
   this as a section to start a song." / "Pick a label - proven <label> options
   below." / "Add another section, or assemble when ready." copy-coach: short,
   sentence case, jargon-honest.
3. **Proven-library provenance:** already satisfied structurally - `forSection` is
   passed `CATALOG` (songs.json, the proven library) NOT the user's own customs, so
   every mined suggestion is catalog-mined, ranked above the generic families, and
   the chip shows the source song title ("from With or Without You").

## Red-first evidence (USDD)

`test/pw/scenarios/song-builder-templates.json` written FIRST. On unmodified
main `#songSuggest` does not exist, so `assertVisible #songSuggest` fails - the
acceptance is red before the code exists.

## Verification (Claude web container - Playwright via /opt/pw-browsers)

- `node -c music/shared/songbook.js` - PASS.
- `node test/run-all.js` - **45 files, 0 failed** (incl. 7 new `M-13 g1` unit
  tests in `songbook.test.js` proving realizeRoman/realizeSection tokens +
  key-aware display + skip-unrealizable + the SongTemplates integration +
  sectionConnectScore).
- Playwright scenario `song-builder-templates.json`:
  - RED-first against unmodified main - fails at `assertVisible #songSuggest`.
  - GREEN (40 steps) with song-templates.js temporarily wired - full flow: build
    Verse, clear, suggestion chips (key-aware, catalog-cited, connection-ranked),
    tap a chip fills + A3 invalidates + label carries forward, Add as Chorus,
    Assemble shows Verse + Chorus. The temp wiring was reverted before commit (the
    committed diff stays boundary-clean; parent does the real wiring at merge).
  - Live render-verified at 412x915 (evidence: chorus-suggestions.png).

## OPEN - parent wiring required to take the scenario GREEN (coupled 3-file step)

`music/shared/song-templates.js` (the M-12 library, #216) was never wired into
the browser - not script-tagged in `play/index.html`, not in `sw.js` CORE. The
chips read `window.SongTemplates`, so they stay empty until it loads. Wiring is a
COUPLED change that lands in files this goalpost was scoped OUT of
(`play/index.html`, `sw.js`, `build-stamp.js` - the last two parent-owned for
cache-version coordination). To flip the scenario green:

1. `play/index.html`: `<script src="../shared/song-templates.js"></script>` after
   `repertoire.js` (its guarded refs) and before `songbook.js` (its consumer).
2. `sw.js` CORE: add `'./shared/song-templates.js'` + bump `CACHE` (the A6 lint
   `every shared/*.js <script> is precached in CORE` enforces the pairing).
3. `build-stamp.js`: refresh `VERSION`/`UPDATED_ISO` to match the CACHE bump
   (`check-cache-bump.sh` + `build-stamp.test.js` enforce the pairing).

## Next goalposts (still open)

- Mode-aware suggestion filtering (drop a minor-tonic family over a major song).
- Section reorder within the buffer.
- Buffer persistence across reloads.
- Lyrics entry per section.
