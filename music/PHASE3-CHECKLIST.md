# Phase 3 checklist - backing-track soloing + scale guidance

> Completion proxy for the autonomous build. Loop checks each box as it lands. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Telegram tap), not part of this checklist.

## Core (must-have)
- [ ] From an established key + mode + progression, a "Find backing track" action is reachable in the Compose loop (not a resurrected standalone tab - honor the retire-standalone-backing-tracks decision)
- [ ] The action surfaces a YouTube backing track matched to key + mode (curated overlay first via the track-URL store, then a key+mode search-query fallback - client-side only, no API key)
- [ ] The solo scale for the chosen key + mode renders on the fretboard alongside the backing track (reuse Diagram.scale / the Tracks studio fretboard)

## Genre picker
- [ ] Optional genre selector refines the backing-track search, including a no-genre / "varied grooves" option

## Phase 4 teaser
- [ ] A solo-scale selector decoupled from the key/mode harmonization filter lets you swap the scale soloed over a FIXED progression
- [ ] A one-line "why" explains relative (same notes, different home) vs parallel (same home, different notes)

## Quality gates
- [ ] New Phase-3 unit test(s) added and passing (search-query builder + scale-selector logic; pure Node assert, no deps)
- [ ] All existing `node test/*.test.js` still pass
- [ ] music/play loads with zero console errors at desktop (1440x900) + phone (375x812) via Playwright; screenshots captured
- [ ] music/TUTOR-ROADMAP.md updated (Phase 3 -> DONE, Phase 4 teaser noted)
- [ ] PR opened from `claude/music-phase3-backing-solo` with V&V block + a curl-verified githack preview link

_Items may be refined after prior-art recon completes._
