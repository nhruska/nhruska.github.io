# Phase 3 checklist - backing-track soloing + scale guidance

> Completion proxy for the autonomous build. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Telegram tap), not part of this checklist.
>
> Key finding: the Tracks finder + Practice Studio (genre/key/mode matching, YouTube search+embed, solo-scale panel, fretboard studio, relative/parallel teaching) already shipped on main. Phase 3 is the **bridge**: a "Solo over a backing track" CTA in the Compose loop that carries the built key+mode into that finder. So most boxes are met by *surfacing* existing capability, not rebuilding it.

## Core (must-have)
- [x] From an established key + mode + progression, a "Solo over a backing track" CTA appears in the Compose loop (toggled by `renderKey`; hidden until key+progression exist). Honors the retire-standalone decision - it routes into the Tracks segment of Library, not a new surface.
- [x] The action surfaces YouTube backing tracks matched to key + mode (the finder's `filterTracks`/`compatibleKeys` ranking + curated-URL overlay + search fallback; client-side only, no API key).
- [x] The solo scale for the chosen key + mode is shown: the seeded finder renders the scale panel (notes + degrees + diatonic chords + circle of fifths); the fretboard scale renders one tap deeper in the per-track Practice Studio (`Diagram.scale`).

## Genre picker
- [x] Genre selector refines the search (pre-existing genre chips in the finder, including the "all" / no-genre option). Surfaced by the bridge; not rebuilt.

## Phase 4 teaser
- [x] A solo-scale selector decoupled from chord harmonization: the finder's mode chips (Ionian/Lydian/Mixolydian/Dorian/Aeolian) re-spell the solo scale without touching any progression.
- [x] A one-line relative/parallel "why": the finder's "explore next" row surfaces the relative minor, and `Circle.modeChange` shows the one-note-changed hint. NOTE: full Phase 4 (swap the solo scale over the FIXED Compose progression, in place) remains for Phase 4 proper - this is the teaser only.

## Quality gates
- [x] New Phase-3 unit tests added and passing (`normMode` family-coarsening + a seed->filterTracks end-to-end; 4 cases in test/tracks.test.js, now 19).
- [x] All existing `node test/*.test.js` still pass (6 suites green).
- [x] music/play loads with zero console errors at desktop (1440x900) + phone (375x812) via Playwright; bridge driven end-to-end (build progression -> CTA appears -> click -> Library/Tracks seeded to C -> matched results render). Screenshots captured.
- [x] music/TUTOR-ROADMAP.md updated (Phase 3 -> DONE).
- [x] PR opened from `claude/music-phase3-backing-solo` with V&V block + a curl-verified githack preview link (PR #59).
