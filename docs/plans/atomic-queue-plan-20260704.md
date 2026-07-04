# Atomic Queue Plan - Everything Outstanding, Ranked by Operator Cost (2026-07-04)

> Operator directive: plan the whole queue (incl. MID) atomically, sequenced by the number/complexity of decisions needed from the human. Tier 0 runs itself; Tier 1 is one quick-pick round; Tier 2 is one batched sitting. Concurrency governor: max ~5 builders on this box (8GB) - Tier-0 items RELAY-LAUNCH as running agents finish, never all at once.

## Tier 0 - ZERO operator decisions (autonomous; relay-launch order)

| # | Item | Spec source | Fires when |
|---|---|---|---|
| 0.1 | **S-LAYOUT-SSOT** (operator directive, this date): single source of truth for chord-tile/diagram geometry (CSS vars + diagram.js metrics from ONE block) so layout constants cannot fork; + a targeted layout regression suite (tile/diagram measurements at 360/412/768/1440 px AND 1.0/1.3 font scale, overlap assertions) | This plan + U5 class history (#96, U5) | compose-polish2 lands (adjacent files) |
| 0.2 | S-DIAGRAM-PREF steps 1-2 (pref prompt via Notables + patterns render consuming the step-0 classifier) | short-specs + wiki page | step-0 + nudge + polish2 land (notables/diagram free) |
| 0.3 | M-5 buildAdapter extraction -> shared/chord-pack-adapter.js + real tests | analysis A3 | any slot |
| 0.4 | M-8a SUGG table -> shared module + FORK-4 spelling-agreement test | analysis A7 | any slot |
| 0.5 | M-7 jam picker (19 curated records; wiki data-model defines selection + fewest-chord backfill; entry = existing Play-now surface, default flagged veto-able) | analysis B3 + data-model.md | any slot |
| 0.6 | ccp/claude-config: #593 amendments (plan-ahead rule, core-sdlc queue-read, /mission --queue) + Mission Control skill scaffold | learnings tickets | parent-side, any time |

## Event-gated - zero decisions, waiting on PR #98 merge

Wave-2 trio (S-TONES, S-ROMAN+S-KEYPOLICY, S-GOLDEN-B) + S-BLUES-B spelling flip -> auto-fire on merge event. M3 songs/tracks merge (5A resolved) additionally wants its 30-min spec-formalize slot in the Tier-2 sitting.

## Tier 1 - ONE quick pick each (batched into a single round, asked this date)

| Q | Decision | Recommendation |
|---|---|---|
| 1.1 | modeSwitch selected-state language: accent-fill (like chips) vs surface+ring | Accent-fill everywhere (one grammar) |
| 1.2 | Storage strategy (#77): localStorage + schema/migration runner vs IndexedDB move | Stay localStorage + migration runner (scale is small; backup.js mature; IDB = rewrite without user-visible win) |
| 1.3 | Hub customer surface: per-customer SWA app vs per-prefix roles | Per-customer app (hard isolation, per-customer invites/domain; CD matrix already exists) |
| 1.4 | D-CAP12: keep 12-chord cap or revert to 8 | Keep 12 (12-bar fits; strip scrolls) |

## Tier 2 - ONE batched sitting (~45-60 min, schedule at will)

M-PERFORM vision (probes staged in uat file) - M-1 tutor Phase 4 - M-2 tutor Phase 5 - M-3 strum revival (#88) - M-4 CI regression shape (box-OOM -> CI-dispatched) - M3 spec-formalize (post-#98) - hub pilot customer + invite-flow specifics - LONG triage (#44 Compose redesign, #92 drag-reorder, practice streaks, setlists sharing, more profiles, audio-input).

## Standing rules

- Tier-0 relay: when a builder finishes, the next Tier-0 item launches automatically (INFO ping), respecting the 5-builder cap and file-grant disjointness.
- Tier-1 answers convert items to Tier 0 immediately.
- Tier-2 sitting converts MID -> SHORT specs per the pipeline; nothing in Tier 2 blocks Tier 0/1.
