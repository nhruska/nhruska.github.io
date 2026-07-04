# Mission Queue - nhruska.github.io (music app)

> The plan-ahead pipeline: agents are never dormant while quota exists and SHORT is non-empty.
> Horizons: NOW (in flight) / SHORT (interviewed + gated = LAUNCH-READY) / MID (vision known,
> needs spec interview) / LONG (idea, needs vision interview). Active-stance reads this file
> at session start; when capacity frees and SHORT has items, the top one launches (trust
> rules per quality profile) with an INFO ping. Operator batches interviews to refill SHORT.

## NOW (in flight)

| Mission | State | Spec |
|---|---|---|
| (idle - M-GUIDE SHIPPED 2026-07-04: Blues key + targeting/ghost dots + mentor cards + Compose chips + density, v85; 4 adversarial rounds, 10 catches folded) | next launch: any SHORT trigger | [fold record](m-guide-adversarial-fold-20260704.md) |

## SHORT (launch-ready - gated, fire when capacity frees)

| # | Mission | Trigger / launch condition | Spec state |
|---|---|---|---|
| S1 | Wave 2: S-TONES, S-ROMAN+S-KEYPOLICY, S-GOLDEN-B | PR #98 merges (event-triggered) | Fully specced in [ux-sprint-1-20260703.md](ux-sprint-1-20260703.md) items 7-9 + amendments - APPROVED |
| S2 | Sprint 2: M3 songs/tracks full merge | **5A RESOLVED (operator, 2026-07-04: dissolve the finder - curation to +Add/per-item edit, circle panel into the Studio)**; remaining gate: #98 merged + 30-min spec-formalize interview | Build plan in [UX-FRICTION-LOG](../../music/docs/UX-FRICTION-LOG.md) M3 section; council + chair sequencing decided; needs a 30-min goal-interview to spec-formalize -> then launch-ready |
| S3 | S-BLUES-BOXES: named box positions 1-5 (root string + start fret + neighbor-move) on the Studio scale view | Operator gate on a drafted spec (P5-demanded; drafts from solo-scales.md + posWindow) | Spec DRAFTED: [short-specs-20260704.md](short-specs-20260704.md) - one keyword to launch |
| S4 | S-DIAGRAM-PREF: expertise-adaptive display (dots vs clean patterns + hand-position/fingering guidance) | Operator gate on a drafted spec (I draft from M2's wiki content; 5-min review) | Spec to be DRAFTED during M2 close (the wiki's expertise-adaptive philosophy page becomes its foundation) |
| S5 | S-SAVE-TRUTH: silent-fail saves fixed (quota detect + rollback + real failure message on all 5 save paths, backup.js applyAtomic pattern) | **go save-truth** | Spec = [analysis A1](analysis-refactor-enhance-20260704.md) - the verdict's top pick (P1 data-loss trigger) |
| S6 | S-HARDEN bundle (3 tiny parallel agents): wireTap dedup x4->1, escHTML dedup x8->1, SW CORE/CACHE verify script wired into tests | **go harden** | Spec = analysis A4+A5+A6 + toggleSet 'Added to setlist' unconditional-toast fix (same A1 bug shape, flagged in #116) + SW verify script asserts CACHE differs from origin/main when shared/ files changed (identical-string v83 collision, PR #117) |
| S7 | S-TEMPO: wire the orphaned tap-tempo engine (tempo.js, tested, zero consumers) into Perform - tap button + beat pulse | **go tempo** | Spec = analysis B1 |
| S8 | S-BACKUP-NUDGE: one-shot Notable "back up your library" via free priority slot + backup.describe() | **go backup-nudge** | Spec = analysis B2 (pairs with S5) |
| S9 | S-CHIPS-PLUS: P5 enhancement asks - Dom7-arpeggio or Mixolydian chip in the Blues-key Compose preview + degrees line under the preview notes; evaluate bar-by-bar target emphasis (3rd/b7/root) remainder after ghost dots | **go chips-plus** | Spec = P5 W3 verdict items (fold doc); ghost dots + card rewrites already folded in-mission |

## MID (vision known - needs a spec interview, ~15-30 min each; batchable in one sitting)

| # | Candidate | Vision source |
|---|---|---|
| M-1 | Tutor Phase 4 complete: decoupled solo-scale selector over a FIXED progression (relative/parallel demos in place) | [TUTOR-ROADMAP](../../music/TUTOR-ROADMAP.md) Phase 4 (PARTIAL) |
| M-2 | Tutor Phase 5: song-form coaching (AABA, sections -> whole songs) | TUTOR-ROADMAP Phase 5 (PLANNED) |
| M-3 | Strum-engine revival (draft PR #88: Karplus-Strong + humanized hand) | Existing draft PR - needs vision refresh + quality gate |
| M-4 | Music-app regression suite in CI (Playwright journeys J1-J4 + T-plans as automation) | Sprint-1 harness + test plan exist; needs CI-shape decision (box OOM rule -> CI-dispatched) |
| M-5 | buildAdapter extraction (inline HTML -> shared/chord-pack-adapter.js + real tests) - before next instrument profile or HSR Lens | [analysis A3](analysis-refactor-enhance-20260704.md) |
| M-6 | Client-storage strategy + schema inventory (issues #76 + #77) - the strategic layer above S-SAVE-TRUTH | gh #76/#77 + analysis A1 context |
| M-7 | Jam picker (19 curated records, zero consuming code) + data-model.md drift fix | analysis B3 |
| M-8 | SUGG table -> shared module + spelling-agreement test; modeSwitch selected-state language unify (taste pick at interview) | analysis A7 + B5 |
| M-9 | mount() god-function incremental extraction - FOLD INTO M3, never big-bang | analysis A2 |
| M-10 | M-PERFORM: true play/perform songbook experience (full sheet layout, auto-scroll?, stage mode?, set flow) - VISION INTERVIEW required | [uat-walkthrough-20260704.md](uat-walkthrough-20260704.md) U1 - first shared-walkthrough finding |

## LONG (ideas - need a vision interview before anything)

- Practice-tracking / streaks (accountability loop per tutor north star)
- Setlist sharing / export for bandmates
- More instrument profiles + per-instrument voicing depth (operator signal: "huge toolset for guitarists AND OTHERS")
- Audio-input features beyond tuner (chord recognition?) - speculative, needs operator vision
- Compose UX redesign: tabs + Related Keys lens (gh #44)
- Setlist touch drag-to-reorder (gh #92)

## Operating rules

1. SHORT items launch autonomously when their trigger fires and quota is available - INFO ping, no gate re-ask (they were gated at spec time).
2. MID -> SHORT requires one operator interview sitting (batch several per sitting - that is the front-loading).
3. LONG -> MID requires a vision interview (fuzzier, longer).
4. Reviews batch: agent stacks review-ready items with adversarial pre-passes done, operator sweeps them in one window (taste/vision judgment only).
5. Scorecard tracks: dormant-quota-hours (target ~0 while SHORT non-empty), SHORT-queue depth (target >=2), interview-batch efficiency (specs gated per sitting).
