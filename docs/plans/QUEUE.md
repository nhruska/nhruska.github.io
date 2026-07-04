# Mission Queue - nhruska.github.io (music app)

> The plan-ahead pipeline: agents are never dormant while quota exists and SHORT is non-empty.
> Horizons: NOW (in flight) / SHORT (interviewed + gated = LAUNCH-READY) / MID (vision known,
> needs spec interview) / LONG (idea, needs vision interview). Active-stance reads this file
> at session start; when capacity frees and SHORT has items, the top one launches (trust
> rules per quality profile) with an INFO ping. Operator batches interviews to refill SHORT.

## NOW (in flight)

| Mission | State | Spec |
|---|---|---|
| (idle - M2 SHIPPED 2026-07-04: wiki live, scales live v80, PR #108) | next launch: any SHORT trigger | [wiki-adversarial-fold-20260704.md](wiki-adversarial-fold-20260704.md) |

## SHORT (launch-ready - gated, fire when capacity frees)

| # | Mission | Trigger / launch condition | Spec state |
|---|---|---|---|
| S1 | Wave 2: S-TONES, S-ROMAN+S-KEYPOLICY, S-GOLDEN-B | PR #98 merges (event-triggered) | Fully specced in [ux-sprint-1-20260703.md](ux-sprint-1-20260703.md) items 7-9 + amendments - APPROVED |
| S2 | Sprint 2: M3 songs/tracks full merge | Operator answers finder-rehome **5A or 5B** (one keyword) + #98 merged | Build plan in [UX-FRICTION-LOG](../../music/docs/UX-FRICTION-LOG.md) M3 section; council + chair sequencing decided; needs a 30-min goal-interview to spec-formalize -> then launch-ready |
| S3 | S-BLUES-BOXES: named box positions 1-5 (root string + start fret + neighbor-move) on the Studio scale view | Operator gate on a drafted spec (P5-demanded; drafts from solo-scales.md + posWindow) | Spec DRAFTED: [short-specs-20260704.md](short-specs-20260704.md) - one keyword to launch |
| S4 | S-DIAGRAM-PREF: expertise-adaptive display (dots vs clean patterns + hand-position/fingering guidance) | Operator gate on a drafted spec (I draft from M2's wiki content; 5-min review) | Spec to be DRAFTED during M2 close (the wiki's expertise-adaptive philosophy page becomes its foundation) |

## MID (vision known - needs a spec interview, ~15-30 min each; batchable in one sitting)

| # | Candidate | Vision source |
|---|---|---|
| M-1 | Tutor Phase 4 complete: decoupled solo-scale selector over a FIXED progression (relative/parallel demos in place) | [TUTOR-ROADMAP](../../music/TUTOR-ROADMAP.md) Phase 4 (PARTIAL) |
| M-2 | Tutor Phase 5: song-form coaching (AABA, sections -> whole songs) | TUTOR-ROADMAP Phase 5 (PLANNED) |
| M-3 | Strum-engine revival (draft PR #88: Karplus-Strong + humanized hand) | Existing draft PR - needs vision refresh + quality gate |
| M-4 | Music-app regression suite in CI (Playwright journeys J1-J4 + T-plans as automation) | Sprint-1 harness + test plan exist; needs CI-shape decision (box OOM rule -> CI-dispatched) |

## LONG (ideas - need a vision interview before anything)

- Practice-tracking / streaks (accountability loop per tutor north star)
- Setlist sharing / export for bandmates
- More instrument profiles + per-instrument voicing depth (operator signal: "huge toolset for guitarists AND OTHERS")
- Audio-input features beyond tuner (chord recognition?) - speculative, needs operator vision

## Operating rules

1. SHORT items launch autonomously when their trigger fires and quota is available - INFO ping, no gate re-ask (they were gated at spec time).
2. MID -> SHORT requires one operator interview sitting (batch several per sitting - that is the front-loading).
3. LONG -> MID requires a vision interview (fuzzier, longer).
4. Reviews batch: agent stacks review-ready items with adversarial pre-passes done, operator sweeps them in one window (taste/vision judgment only).
5. Scorecard tracks: dormant-quota-hours (target ~0 while SHORT non-empty), SHORT-queue depth (target >=2), interview-batch efficiency (specs gated per sitting).
