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

- M-12 template-suggested sections (`SongTemplates.forSection` offered per label).
- Section reorder within the buffer.
- Buffer persistence across reloads (needs a `backup.js` additive field).
- Lyrics entry per section.

## Verification commands

```
node -c music/shared/songbook.js
node test/run-all.js
python3 test/pw/run-scenario.py test/pw/scenarios/song-builder.json
```
