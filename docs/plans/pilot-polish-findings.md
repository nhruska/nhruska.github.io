# Pilot polish audit - findings log

Source: integration pass on `claude/music-uat-pilot` (UAT round 2 waves 1A-1D merged).
Method: live Playwright screenshots of every screen (Library, song view x3 views, Stage,
Jam, Compose, Tune, keyed/unkeyed empty states, triad-inversions page) at 375x812 and
1440x900, zero page errors on both.

## Fixed in this pass

| # | Finding | Fix |
|---|---------|-----|
| 1 | Jam empty state said "Add songs with the + button." but the + button lives on the Library tab - dead-end copy on the screen the user is actually looking at | Copy now reads "Add songs from the Library with the + button." (songbook.js renderSetlist) |
| 2 | Clear-setlist X button visible (and tappable, confirm-then-no-op) on an EMPTY setlist - destructive control with nothing to destroy; Edit already hid itself when empty | setClear now hides when the setlist is empty, matching the Edit gating (songbook.js renderSetlist) |
| 3 | music/shared/README.md documented renderSheet view as "lyrics" \| "chords" - stale after 1B made it tri-state with changed lyrics semantics | Doc line updated to lyrics/chords/both with one-phrase semantics each |

## Logged for a later pass (not fixed here)

| # | Finding | Notes |
|---|---------|-------|
| 4 | Song-view sheet lines clip at the card's right edge with no scroll affordance (phone AND desktop; "gonna be all right" cut mid-word). Content is NOT lost - .sheet has overflow-x:auto - but nothing signals "scroll me" | Candidate: right-edge fade mask or scrollbar-width:thin on .sheet. Same applies to the lyrics view |
| 5 | Desktop (1440x900) renders the app as a centered phone-width column with large dark gutters | Deliberate mobile-first design; if desktop use grows, consider a wider max-width for the sheet/list at >=1024px |
| 6 | Library row action label "↗ Search" is ambiguous next to the search input (it means YouTube search, not list filtering) | Intentional prior design (list-item.js distinguishes in-app "▶ Video" vs external "↗ Search"); revisit copy ("YouTube ↗"?) with UAT feedback |
| 7 | Tune screen strobe caption "stands still = in tune · drifts ..." reads edge-to-edge at 375 | Measured: scrollWidth == clientWidth (317px), no actual overflow. No action; keep an eye if copy grows |
| 8 | Jam header shows title-case "The Setlist" + lowercase ctx "tonight's running order" + X on the same row; slight visual weight imbalance vs other screens' headers | Cosmetic only; revisit if the Jam surface gets more chrome in UAT round 3 |

## Follow-up: committed browser-e2e / mount-DOM test harness

Codex flagged the same gap in nearly every PR #67 volley: the mount-level DOM
behaviors (Stage transpose+view seed via #stageBtn, Mine-facet chip render +
last-custom heal, Jam/legacy-tab restore, tri-view .modeSwitch clicks incl.
disabled custom-song buttons) have no COMMITTED regression test - they were
live-verified each volley via ad-hoc Playwright scripts, but those aren't in
the repo, so the class can regress green.

The repo is deliberately dependency-free (per-file node-assert self-runners),
so the options are: (a) a committed Playwright spec + CI job (adds a dev dep +
browser install to tests.yml), or (b) a heavier stub-document harness like
test/key-explorer.dom.test.js scaled up to the full mount(). Decision +
implementation deferred to a dedicated follow-up PR (out of scope for this
UAT arc's convergence). Pure cores (inferKey, nextTranspose, soloKeyFor,
libraryFilter, renderSheet, posWindow, studioTheory, migrateUrls) ARE
unit-covered today.
