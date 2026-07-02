# AI Tutor prototype, wave 4 - song builder (Phase 5, made real)

> Completion proxy for an autonomous build. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Nik).
>
> **What this is:** wave 4 of the `music/tutor/` sandbox (wave 1: [TUTOR-PROTOTYPE-CHECKLIST.md](TUTOR-PROTOTYPE-CHECKLIST.md), wave 2: [TUTOR-CHALLENGES-CHECKLIST.md](TUTOR-CHALLENGES-CHECKLIST.md), wave 3: [TUTOR-SOLOING-CHALLENGES-CHECKLIST.md](TUTOR-SOLOING-CHALLENGES-CHECKLIST.md)). Directed 2026-07-02 ("locked" on the soloing arc, then "let's see what we'd need" for song structure - this wave builds the plan `TUTOR-ROADMAP.md` already scoped). A song is 3 sections (Verse, Chorus, Bridge); the AI walks you through building each one's progression, then presents 3 keys for the NEXT section - each pre-labeled with why it's a pleasing transition (dominant/subdominant/relative/pivot-chord) - so the choice itself teaches the theory.
>
> **What this is NOT:** still the tutor-owned mini clone, not real Compose/Tracks. Fixed 3-section shape (no arbitrary section count/reordering) - depth over breadth for a first pass. No audio/timing/bar-count. Still scripted, no live LLM.

## Checklist

### song-builder.js (pure logic, Node-testable)
- [x] `createSection(label, key, mode)` - a section IS a mini-compose state (reducers work on it directly), tagged with a label
- [x] `createSong`/`addSection`/`replaceSection` - song CRUD, no mutation
- [x] `analyzeTransition(sectionA, sectionB)` - priority order verified against real data: direct-neighbor (dominant/subdominant/relative) checked BEFORE raw circle-of-fifths distance, because the relative minor is 3 steps away on the circle but is the closest possible relationship (regression-tested explicitly)
- [x] `keyChoicesFor(section)` - the 3 `Circle.neighbors`, each pre-analyzed via `analyzeTransition` so the choice carries its own "why"
- [x] `analyzeSong(song)` - every adjacent transition, for the final readout
- [x] `test/song-builder.test.js` - 16 tests, including the relative-minor priority-order regression case and a hand-verified pivot-chord intersection

### Widget + chat UI (music/tutor/index.html)
- [x] `SONG_TRIGGER` regex (narrower than `CHALLENGE_TRIGGER` - requires a build/write/make verb + "song", not a bare "song"/"section" word, so a genuine theory question doesn't accidentally launch the builder)
- [x] `startSongFlow` / `promptNextSection` / `finishSong` / `handleSectionDone` - reuse the exact same widget DOM (`#wKeyChip`/`#wProgRow`/`#wPickerRow`/`#wCheck`) as challenge mode, gated by a `songMode` flag mutually exclusive with `activeChallenge`
- [x] Widget key-chip shows the section label during song mode (`Verse - C major`)
- [x] `wCheck`'s label switches to "Section done" in song mode, back to "Check my answer" when a challenge starts (defensive reset)
- [x] Existing "Help me build a song" quick-reply (already present since wave 1) now genuinely starts the builder instead of a canned paragraph - no UI change needed there, just the new trigger routing
- [x] Updated `provider.js`'s Phase 4/Phase 5 canned replies - both used to say "not built yet, just the idea"; both are real now (wave 3's relative-swap challenge, this wave's song builder) - stale copy fixed, quick-replies point at the real features

### Quality gates
- [x] `node test/run-all.js` green (19 suites)
- [x] Playwright render-verify desktop + phone, driving a full 3-section song build (Verse -> pick Chorus key -> Chorus -> pick Bridge key -> Bridge -> final summary), zero real console errors, screenshots
- [x] Verified the final summary reads correctly: each section's progression + roman numerals + the "why" behind the transition to it
- [x] `music/TUTOR-ROADMAP.md` updated with a wave-4 pointer
- [x] PR updated: commit pushed, detailed PR comment posted, CI watched green
