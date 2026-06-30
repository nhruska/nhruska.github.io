# Session: Triad Inversions dynamic artifact (PR #48) - completed + merged

**Date:** 2026-06-29
**Status:** completed
**Branch:** `claude/triad-inversions-dynamic` (squash-merged into main as `ce8205b`)
**PR:** [#48](https://github.com/nhruska/nhruska.github.io/pull/48) - merged

## Session Continuity

| # | Session | Focus |
|---|---------|-------|
| -> | **this** | Polish + ship dynamic Triad Inversions artifact across all [P4, M3] instruments |
| -1 | (none in `nhruska.github.io/.claude/sessions/`) | Prior work was tracked in a remote-execution-environment session that didn't persist locally |

This session was a continuation from a prior conversation that was compacted - the summary at the top of context captured the full arc back to PR #43.

## What shipped

PR #48 squash-merged into `main` as `ce8205b`. Live at [nhruska.github.io/music/play/triad-inversions.html](https://nhruska.github.io/music/play/triad-inversions.html) after the Pages deploy.

### Commits on the PR branch this session (7 total, squash-merged)

| SHA | Subject |
|---|---|
| `980dbf5` | artifact: dynamic tuning + key support, reads main app's instrument |
| `e936b28` | artifact: respond to codex volley 1 + fix uke A/F starting too high |
| `b3ca2ef` | artifact: in-place instrument picker (same as main app's), drop the badge |
| `babbed1` | artifact: match the app's accent palette, no out-of-family colors |
| `ba55e2c` | artifact: accent-only palette, no shake-on-tap, clearer typography |
| `783f6f5` | artifact: clear the fret-base label off the first dot, lock cards from text-select |
| `1a648e3` | artifact: drop the op pills - the prose already says the move |

### What the PR delivers

- **Dynamic across instruments**: artifact now renders for any [P4, M3] interval profile (ukulele G-C-E, guitar D-G-B subset, cigar box D-G-B, banjo D-G-B); reads `music.activeProfile.v1` from main app's localStorage; falls back to URL `?p=` then ukulele.
- **12 keys** in the chip strip (was 4); cycle derived per-key per-instrument from open pitch classes + key root.
- **Multi-string-count diagrams**: 4 / 5 / 6-string layouts, non-played strings shown as muted.
- **Mandolin/mandola fallback**: detects missing [P4, M3] interval, renders explainer + Compose-tab link.
- **In-place instrument picker** (matches main app) so users don't have to navigate back.
- **Accent-theme harmonization**: dots, finger numbers, op styles all read `--accent` triplet from `localStorage.music.accent.v1`.
- **Diagrams legible**: base-fret label moved left of dots so two-digit positions ("10") don't collide.
- **Selection killed**: `user-select:none` on `.step` so long-press doesn't marquee.
- **Op pills dropped end-to-end**: the SLIDE/HAMMER/ROTATE/FLIP labels were misleading ("SLIDE +2" on a one-fret shape change) and redundant with the prose. Pills, footer legend, and "4 operations" explainer all removed; leftover ALL-CAPS prose tokens rewritten.

### SW cache trajectory across session

v20 (pre-session main) -> v22 (initial PR) -> v23 -> v24 -> v25 -> v26 -> **v27** (shipped). Each touched-CORE commit bumped per the project rule.

### Verification

- node syntax-check passes on inline JS in `triad-inversions.html` and `music/sw.js`
- 288 voicings across 4 instruments x 7 natural keys x up to 4 positions resolve to correct major triads via node chord-tone check (run earlier in session, before compaction)
- Codex volley 1 addressed (3 highs + 2 mediums fixed before mark-ready)
- **NOT verified** (no headless browser here): phone-DPI render of the fret label fix and the long-press text-select fix - Nik eyeballed the preview and replied "1 good, 2 [merge]"

## Parallel work that landed during this session

Three PRs from another Claude session landed on `main` during PR #48's life - all Issue #44 (Compose tabs redesign):

| PR | Title |
|---|---|
| [#49](https://github.com/nhruska/nhruska.github.io/pull/49) | Compose: sticky live-loop band + collapsible panels (#44 Phase 1) |
| [#50](https://github.com/nhruska/nhruska.github.io/pull/50) | Phase 0: shared KeyExplorer (Compose + Tracks studio), byte-identical (#44) |
| [#52](https://github.com/nhruska/nhruska.github.io/pull/52) | Phase 1 quick wins: persist active view + fix studio chord squash (#44) (#52) |

**Implication:** the "Compose tabs redesign paused (tasks #27-30)" thread that the prior session summary listed as pending is now substantially shipped on `main`. Tasks #27-#30 cleaned up.

## Outstanding items / forward notes

- [ ] **Visual UAT on live site** post-Pages-deploy. The PR-preview eyeball passed but the live URL is the deliverable - check on phone after deploy completes (~1-2 min from merge).
- [ ] **Pull / sync** before next branch off this repo - local working tree is on the (now-merged) `claude/triad-inversions-dynamic` branch, and `main` is 4 commits ahead (PR #48 squash + #49 + #50 + #52). Standard recovery: `git checkout main && git pull origin main` then start the next feature branch.
- [ ] **Read what #49 / #50 / #52 did to Compose** before assuming any prior plan for Compose still applies - the surface has changed. The "Compose chain artifact-shape voicings" still lives there (PR #43) and the Triad Inversions launcher card the artifact links from should still be present, but the layout around it shifted (sticky live-loop band, collapsible panels, shared KeyExplorer).

## Decisions captured

1. **Op pills were noise, not signal.** The labels couldn't carry quantitative accuracy ("SLIDE +2" was hard-coded for any 'slide' type, including the one-fret-plus-shape-change move) and the prose already described the action precisely. Dropping them removed a class of bug + a class of UI distraction. Pattern: when a visual marker and the prose carry the same information AND the marker can lie, kill the marker.
2. **Same-shape barre Position 1 (where it's a closed shape) still gets the base-fret label.** Position 1 open ones (rect fret-1 marker) and Position 2/3 closed ones (label number) are the same axis, just with different visuals. Label and rect are mutually exclusive; both clear of the first dot now.
3. **Accent-only palette** is the right call when an app already has a per-user accent chooser. Per-element fixed colors compete with the user's choice. Future surfaces: if the app's accent chooser sets `--accent` triplet, mirror it; don't invent a parallel palette.

## Friction

Not formally analyzed via `/conversation:analyze-friction` (not invoked - no need to interrupt the ship). One observable signal:

- **5 separate UAT rounds before ship**: layout was mostly right after the first dynamic-cycle commit; the polish (color, type, click-state, fret label, op pills) ate most of the session. Pattern reflection: when an interactive surface ships, the dynamic-data work converges fast but the surface-polish work is iterative and visible-only-on-phone. Future: front-load the "what does the user see in the first 2 seconds" review before the second dynamic commit, not after the seventh.

## Deferred Options (from final next-steps list)

- (3) Resume Compose tabs redesign - now obsolete; that work shipped via #49/#50/#52 from a parallel session. Replaced with: "Read what changed in Compose."
- (4) Continue working in a new direction (no specific deferred option here).
- (5) Roll back - not chosen; PR merged clean.

## Next Actions

1. -> Verify live deploy: open [nhruska.github.io/music/play/triad-inversions.html](https://nhruska.github.io/music/play/triad-inversions.html) on phone after Pages settles
2. `git checkout main && git pull origin main` to sync local before next feature work
3. Read the #49/#50/#52 diffs to understand the new Compose surface before any further Compose work
4. `/session:learn` if any of the UAT-polish iterations want to be encoded as a rule (e.g. "for any phone-shipped interactive surface, do a phone-render pass before the second commit")
5. New thread - the dog walk that was promised in the previous session arc

**Recommended:** #1 - the artifact going live IS the deliverable; everything else is starting the next thing.

## Artifacts generated this session

- [.claude/sessions/session-20260629-01-triad-inversions-dynamic-pr48-completed.md](session-20260629-01-triad-inversions-dynamic-pr48-completed.md) - this file
