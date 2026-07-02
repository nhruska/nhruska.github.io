# Music app: UAT round 2 + pilot polish - atomic plan

> Target branch: `claude/music-uat-pilot` off fresh main (post PR #65 merge). Executes as a
> parallel workflow (worktree-isolated agents, one integration PR). Decisions below were locked
> by operator interview 2026-07-01. Commit this file to `docs/plans/` on the arc branch.

## Locked decisions (operator interview 2026-07-01)

| Decision | Choice |
|---|---|
| Library top toggle | Replace with a new main bottom-bar tab named **Jam**; remove `#typeToggle` |
| Song view Stage CTA | Segmented **Lyrics / Chords / Both** + compact fullscreen icon button on one row; same toggle inside Stage view |
| Compose fretboard block | Replace in-flyout solo fretboard + walk-the-cycle link with a **Triads & Inversions** link (Studio owns fretboard/scale) |
| Landing | ONE integration PR off fresh main, own auto-volley |
| Polish | Audit-driven: full-screen screenshot sweep (phone + desktop), consistency findings fixed in-arc |

## Checklist (anchors from pre-merge main; re-verify line numbers after #65 merges)

### Wave 1A - Library (index.html tabbar/library, songbook.js library region, songbook.css)
- [ ] 1. "Jam" main tab in `.tabbar` (index.html:160-164), remove `#typeToggle` (index.html:53); Jam tab hosts the Set/Perform surface the toggle switched to
- [ ] 2. "Mine" filter chip in genre facets - `d: 'Mine'` already exists on custom items (songbook.js renderFilterChips ~407-426)
- [ ] 3. Sticky search + filter chips (`.searchWrap` songbook.css:52); only the song list scrolls
- [ ] 4. Zero-results empty state names the active key filter + offers a one-tap "search Any Key" clearing link (songbook.js ~453)

### Wave 1B - Song view (songbook.js practice/stage region)
- [ ] 5. YouTube search link in song view (reuse `ytSearch` songbook.js ~429; pattern at lyricsLink ~583)
- [ ] 6. Replace `#stageBtn` full-width button (songbook.js ~567/596, `.stageCta` css ~155) with Lyrics/Chords/Both segmented + fullscreen icon on one row
- [ ] 7. Same Lyrics/Chords/Both toggle inside the Stage overlay (index.html #perform ~166-178, songbook.js pCtrls ~756)
- [ ] 8. BUG: Stage opens in ORIGINAL key after song-view transposition - `startPerform` resets `performTpose` to 0 (~735-738) instead of seeding from `STATE.transpose`
- [ ] 9. Transpose chip wraps around at range ends instead of stopping (`shiftKey` ~631, `perfShift` ~783)

### Wave 1C - Compose (songbook.js compose region, key-explorer.js)
- [ ] 10. BUG: fret numbers hidden behind note dots on "Solo over it" fretboard (diagram.js render order ~80-136; verify against post-#65 10px labels)
- [ ] 11. Perf: "chords in key" lag (buildGrid in-key branch ~1047-1069) - profile, then debounce/defer if real
- [ ] 12. Auto-infer key from added chords (suggestNext scoring ~1327) when user hasn't explicitly picked; v1 = auto-select once 2+ chords and no explicit pick
- [ ] 13. Drop standard-progression name from suggested chips (render ~1410-1420) - width blowout causes wrap
- [ ] 14. Shrink "Solo over backing track" block vertical cost (index.html:123)
- [ ] 15. Fold suggested chords into the In key / All segmented (~1035-1086): progressions shown when progression empty, single chords otherwise
- [ ] 16. BUG: key panel preselects major and closes on root pick, forcing reopen to choose minor (~1093, ~1143-1176) - keep panel open after root pick OR root+mode single gesture
- [ ] 17. Prominent pick-a-key CTA in empty in-key state (~1048-1054), replaces hint text
- [ ] 18. BUG: re-tapping already-selected min loses chord list (mode toggle ~1188-1200 calls convertToMode unconditionally) - no-op on same-mode tap
- [ ] 19. Key panel renders ABOVE suggested chords when progression exists (#keyFlyout order, index.html:113-118)
- [ ] 20. Replace in-flyout scale fretboard + HSR chain + walk-link (renderKeyView ~1230-1305) with Triads & Inversions link (locked decision)

### Wave 1D - Inversions + global copy
- [ ] 21. triad-inversions.html explainer (~144-150): add "3 repeating shapes" note - the 3 inversion shapes cycle up the neck; recognize one, you know all positions
- [ ] 22. Em/en dash sweep in user-facing strings (index.html x3, songbook.js x3+, triad-inversions.html prose; middle-dot separators stay)

### Wave 2 - integration (single agent, after 1A-1D merge)
- [ ] Polish audit: Playwright screenshot sweep of every screen at 375x812 + 1440x900, consistency findings (spacing, type scale, button styles, empty states, copy voice, touch targets) fixed or logged
- [ ] SW cache bump (one bump for the batch)
- [ ] Full suite green + live e2e on every changed surface
- [ ] Integration PR with V&V + preview link -> auto-volley

## Conflict discipline

- 1A/1B/1C all touch songbook.js in DISTINCT regions (library / practice / compose); worktree agents must not stray outside their region. 1D touches only triad-inversions.html + string literals (dash sweep deferred to Wave 2 if conflicts).
- music/sw.js is integration-only (Wave 2). songbook.css additions go at each section's existing block, never global rewrites.

## Verification contract (from goal spec)

Unit: every `test/*.test.js` self-runner prints `0 failed`. Syntax: `node --check` per changed JS.
Live: Playwright per changed surface, rendered output inspected, zero page errors.
Dashes: no U+2014/U+2013 in user-facing strings of changed files.
PR: codex auto-volley terminal APPROVE + operator merge keystroke.
