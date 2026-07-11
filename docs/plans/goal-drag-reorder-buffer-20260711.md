# Goal: M-13 g4 - drag-to-reorder sections in the song-builder buffer

> Operator keystroke 2026-07-11 ~11:45Z: "then go drag-reorder /mission" - launching the
> deferred M-13 goalpost registered in QUEUE.md ("drag-to-reorder in the buffer,
> S-PROG-REORDER pattern").

## Objective / completion condition

Buffer section chips in the Compose song builder reorder by DRAG (touch long-press lift +
mouse movement lift), reusing the proven S-PROG-REORDER interaction grammar. Complete when:
1. A committed pw scenario proves drag-reorder on real pixels at 412x915 (pointer-sequence
   steps), zero console errors.
2. The existing up/dn handles REMAIN (a11y fallback - drag is not keyboard/SR reachable).
3. Reorder persists via the existing `songbook.builderBuffer.v1` write-through (g2).
4. Unit suite green; song-builder + buffer + personalize scenarios regress green.
5. Full ship chain: PR + CI + audit comment + merge under the operator's mission keystroke,
   SW cache v156 + build-stamp pair serialized by the parent.

## Assumed answers (operator absent-mode defaults, basis cited)

| Question | Assumed answer | Basis |
|---|---|---|
| Drag grammar | S-PROG-REORDER verbatim: 300ms long-press lifts on touch (early movement = scroll), mouse lifts on movement, insertion-edge marker, trailing click swallowed | Operator shipped + passed its feel 2026-07-10 |
| Keep up/dn handles? | YES - drag complements, never replaces | a11y-coach floor (drag has no keyboard/SR path) |
| Scope | Buffer section chips ONLY - progression chord drag already shipped | QUEUE.md deferred row wording |
| Gate | terminal-plan (personal-fast profile); merge authority = the operator's "/mission" keystroke itself | quality-profiles + the in-session directive |

## Scope out

- No changes to progression chord drag (shipped), no sw.js/build-stamp edits by the agent
  (parent serializes v156), no schema changes (reorder rides g2's persistence).

## Verification commands

- `node test/run-all.js`
- `python3 test/pw/run-scenario.py test/pw/scenarios/song-builder-drag-reorder.json`
- Regressions: song-builder, song-builder-buffer, song-builder-personalize scenarios
- `bash scripts/check-cache-bump.sh origin/main` (after parent bump)

## Abort conditions

Any gate red 3x -> labeled draft PR + status comment, stop the lane.
