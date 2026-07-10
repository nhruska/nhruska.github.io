# Mission Queue - nhruska.github.io (music app)

> The plan-ahead pipeline: agents are never dormant while quota exists and SHORT is non-empty.
> Horizons: NOW (in flight) / SHORT (interviewed + gated = LAUNCH-READY) / MID (vision known,
> needs spec interview) / LONG (idea, needs vision interview). Active-stance reads this file
> at session start; when capacity frees and SHORT has items, the top one launches (trust
> rules per quality profile) with an INFO ping. Operator batches interviews to refill SHORT.

> **RECONCILED 2026-07-10 (git+PR validation):** live version is **music-v121** (PR #195). Since the v113 snapshot below, main shipped v114->v121 across PRs #185-#195 (case study, command-center/panelkit migration, M-SETTINGS-CLARITY, M-SOLO-UX #192, M-GUIDANCE #193, M-LIB-UX #194, M-UI-STD #195) - none dispositioned back into SHORT/MID yet. Only **3 PRs open**: #98 (linchpin, stalled - see NOW), #88 (M-3 strum, draft), #70 (old LLM-tutor goal spec, likely superseded by M-0 - close candidate). Main tree clean.

## NOW (in flight)

| Mission | State | Spec |
|---|---|---|
| **#98 key-aware note spelling** (reverses FORK-4) - the linchpin gating S1 + S2 | STALLED since 2026-07-05, base 8 versions stale (branch sw.js v64->v66 vs main v121). NOT obsolete: `circle.js:214` on main anticipates it ("soloScale() once #98 lands"); main CLAUDE.md still declares canonical-sharp. Overlaps tracks.js (#192 Solo rework) + sw.js (guaranteed CACHE conflict) -> needs rebase/merge-from-main + re-test, then OPERATOR merge gate. **Decision: rebase-and-merge, or close?** | [PR #98](https://github.com/nhruska/nhruska.github.io/pull/98) |
| (v113 snapshot - superseded, kept for trace) idle - EAR-FIRST ARC night shipped v106->v113: audition+retarget+lights+full-neck, tempo+legend+accent-palette, jam matrix+yt-prefill, dim shapes, feedback reconcile w/ countdown undo, keyless playlist pipeline. AWAITING OPERATOR: bake veto + anchors veto -> anchors UI wave; wave-2 candidates: A/B compare, tempo, degree speech; follow-up: tab-switch icon reset | [vision-ear-first](vision-ear-first-20260704.md) |

## SHORT (launch-ready - gated, fire when capacity frees)

| # | Mission | Trigger / launch condition | Spec state |
|---|---|---|---|
| S1 | Wave 2: S-TONES, S-ROMAN+S-KEYPOLICY, S-GOLDEN-B | PR #98 merges (event-triggered) - **BLOCKED: #98 stalled, needs rebase-or-close decision (see NOW)** | Fully specced in [ux-sprint-1-20260703.md](ux-sprint-1-20260703.md) items 7-9 + amendments - APPROVED |
| S2 | Sprint 2: M3 songs/tracks full merge | **5A RESOLVED (operator, 2026-07-04: dissolve the finder - curation to +Add/per-item edit, circle panel into the Studio)**; remaining gate: #98 merged (**stalled - see NOW**) + 30-min spec-formalize interview | Build plan in [UX-FRICTION-LOG](../../music/docs/UX-FRICTION-LOG.md) M3 section; council + chair sequencing decided; needs a 30-min goal-interview to spec-formalize -> then launch-ready |
| S3 | S-BLUES-BOXES: named box positions 1-5 (root string + start fret + neighbor-move) on the Studio scale view | Operator gate on a drafted spec (P5-demanded; drafts from solo-scales.md + posWindow) | Spec DRAFTED: [short-specs-20260704.md](short-specs-20260704.md) - one keyword to launch |
| S4 | S-DIAGRAM-PREF: expertise-adaptive display (dots vs clean patterns + shape-classifier step 0) | **REVIEW-READY: spec already drafted + P5-folded** - 5-min read, then one keyword (go S-DIAGRAM-PREF) | [short-specs-20260704.md](short-specs-20260704.md) + canonical detail in the wiki expertise-adaptive-display page |
| S5 | S-SAVE-TRUTH: silent-fail saves fixed (quota detect + rollback + real failure message on all 5 save paths, backup.js applyAtomic pattern) | **go save-truth** | Spec = [analysis A1](analysis-refactor-enhance-20260704.md) - the verdict's top pick (P1 data-loss trigger) |
| S6 | ~~S-HARDEN~~ FIRED -> NOW (2026-07-04): wireTap dedup x4->1, escHTML dedup x8->1, SW CORE/CACHE verify script wired into tests | **go harden** | Spec = analysis A4+A5+A6 + toggleSet 'Added to setlist' unconditional-toast fix (same A1 bug shape, flagged in #116) + SW verify script asserts CACHE differs from origin/main when shared/ files changed (identical-string v83 collision, PR #117) |
| S8 | S-BACKUP-NUDGE: one-shot Notable "back up your library" via free priority slot + backup.describe() | **go backup-nudge** | Spec = analysis B2 (pairs with S5) |
| S9 | S-CHIPS-PLUS: P5 enhancement asks - Dom7-arpeggio or Mixolydian chip in the Blues-key Compose preview + degrees line under the preview notes; evaluate bar-by-bar target emphasis (3rd/b7/root) remainder after ghost dots | **go chips-plus** | Spec = P5 W3 verdict items (fold doc); ghost dots + card rewrites already folded in-mission |

### Newly queued (findings)

| S-ENFORCE-2B | Registered feedback debt: 3 remaining confirm() calls (songbook delete-item + clear-setlist, repertoire-form) -> modal standard; apply .helpIcon convention to tracks.js help toggles (grants now free) | PR #170 inventory |

| # | Item | Source |
|---|---|---|
| S-NAVHIST | NavHistory double-pop on Solo->Skip path (real bug, live-reproduced) | PR #144 finding |
| S-POSTPROG-FLOW | **Post-progression workflow unclear (any experience level).** After adding a suggested progression, the Solo choice prompt (Save & open Studio / Skip) + the "Solo" button both appear - a new user is curious about Solo, felt they "can't cancel", and had no clear read on the next step. **"Can't cancel" FIXED in PR #197**: the Solo modal gained a visible **Cancel** and dismiss gestures (backdrop/Escape/Back) now stay on Compose instead of navigating into the Studio. REMAINING (needs a vision call): the broader intended after-you-build flow - should Solo/Save auto-surface at all, what is the ideal next-step guidance for a new user. | operator UAT 2026-07-10 (PR #197 preview) |
| S-DELHANDLE-OVERFLOW | **Compose delete-handle overflows the chord card (1-3 chords).** In the `full` diagram-card stage, the per-slot `x` remover floats above/outside the card bounds (disconnected from the chord it deletes). Contain it to the card. | operator UAT 2026-07-10 |
| S-PROG-FIT-6 | **4-6 chords should fit with NO vertical scroll - "so close to fitting".** The fill-row/grid stages nearly fit the fixed region at 5-6 chords but tip into scroll. Tighten card/gap sizing so 4-6 fit above the fold (A7 geometry gate at 412x915). **ADDRESSED (PR #198), needs phone confirm**: trimmed the fixed .prog region (min-height 88->78, padding 12->9, full-stage gap 10->8) to reclaim ~16px WITHOUT shrinking the diagram cards (phone-DPI floor forbids that). Can't verify the fit at 412x915 on the remote box - tap the branch preview to confirm 4-6 fit with no scroll; if still short, the fallback is compacting the 4-chord stage to tokens. | operator UAT 2026-07-10 |
| S-TYPEFILTER-ACCENT | **All-view Maj/Min/7th selected chip is full accent CTA - reads as friction.** The selected type-filter chip is `.chip.on` (accent fill, D-SELECTED-ACCENT). Operator feels it shouts. THIS IS THE D-SELECTED-ACCENT reconsideration flagged in the visual-language design: a secondary FILTER's selected state competing with the one primary. Decision needed: reverse D-SELECTED-ACCENT (selected = outline, fill reserved for primary) app-wide, or a filter-specific quieter selected treatment. | operator UAT 2026-07-10 |
| S-CLEAR-INKEY | **After Clear, the view stayed on a stale "All" pin instead of returning to In-key.** With D-DEFAULT-C the initial state is In-key on C major, but Clear did not reset the view pin - if the user had tapped All while composing, that pin persisted over the fresh canvas. FIXED: Clear now resets chordView to follow-the-key + rebuilds the palette -> In-key on the default key. | operator UAT 2026-07-10 (missed msg) |
| S-SUGG-DIFFERENTIATE | **Suggested next-chords need a visual distinction from the full palette.** The theory-ranked "NEXT CHORD" suggestions and the full In-key grid currently look alike. Differentiate by EMPHASIS + ORDER (music-theory-coach ranks by resolution strength; visual-language gives the suggestions a hair more prominence - a recommended marker/tint - while the full palette stays browse), never a new hue. | operator UAT 2026-07-10 |
| S-SOLO-SCALE-DEFAULT | **Studio solo-scale picker should be theory-aware + emphasis-laddered.** Landing in the Studio (Solo practice, C major from a Compose progression), the "SOLO OVER IT" picker (Ionian / Pent major / Pent minor / Blues) defaults to **Pent minor** - wrong best-choice for a MAJOR-key context (Ionian or Pent major is the natural home over major). Per operator: (1) default-select the theory-BEST scale for the incoming key+mode, (2) OUTLINE the other picks (visual-language emphasis ladder - one filled primary), (3) disable/remove incompatible options where applicable. Best-scale + compatibility logic to come from the new **music-theory-coach** skill. **FIXED (PR #198)**: the picker now default-selects the theory-best pentatonic (major-family key -> Pent major, minor-family -> Pent minor, a Blues key keeps its own blues scale) via the music-theory-coach rule, and does a full select() so the fretboard/notes/guide render that scale too (not just the chip highlight). Part 2 (outline others) is the existing chip emphasis ladder - the one selected chip fills, the rest stay outline. Part 3 (disable incompatible) is n/a: over a diatonic key all four scale choices are playable (major/minor pentatonic interplay is a feature, not an incompatibility), so nothing to disable. **EXTENDED (PR #198)**: (a) the default is now PROGRESSION-AWARE - `Tracks.inferSoloDefault(key,mode,seq)` reads the actual chords via `Circle.romanFor` and upgrades the default to Mixolydian (a bVII-major tell over a major key) or Dorian (a major-IV tell over a minor key), else the safe pentatonic. (b) Mixolydian + Dorian are now SELECTABLE context chips (major key -> +Mixo +Dorian, minor key -> +Dorian, deduped against the key's own mode, none on a Blues key) - their `SoloGuide.card` coaching already shipped. Chip visual + fit need a phone tap on the branch preview. **SKIP-PATH FIX (PR #198)**: the Compose Solo->Skip hand-off (songbook.js) dropped the progression's `seq` (passed only key+mode), so progression-aware inference could never fire on the Skip path - the exact path UAT used. Now Skip carries `progression.slice()` as seq, matching the Save path. | operator UAT 2026-07-10 (post-#197 live) |
| S-KEY-SPELLING | **A note/chord spelled with a SHARP contradicts the degree label the same UI shows (music-theory-coach REJECT).** Building C-F-A# in C major, the third chord shows "A#" under a "bVII" roman-numeral label. Music-theory-coach verdict: over a stated key, spelling is FUNCTION-driven - the bVII is the lowered 7th (B lowered = **Bb**), and "A#" names a raised 6th (#6), the WRONG function. Showing "A#" while labeling it "bVII" is internally self-contradictory (numeral says flat-7, note says sharp-6). Coach REJECTS whenever the UI asserts a key/degree function; sharp spelling is acceptable ONLY in a keyless/chromatic context. This is the FORK-4 canonical-sharp limitation - the fix is key-aware spelling, which is exactly what the stalled linchpin **#98** (`spellScaleKeyAware`/`keyLabel`) delivers. Operator (2026-07-10) AUTHORIZED removing FORK-4 -> key-aware, confirming it is deterministic. **CORE BUILT + PROVEN (PR #198)**: `Circle.spellScaleKeyAware(root,mode)` + `Circle.spellRootInKey(keyRoot,keyMode,noteRoot)` - deterministic letter-per-degree spelling (each of A-G once, accidental to hit each pitch). 14 passing unit tests (`test/key-spelling.test.js`): F major -> Bb (not A#), bVII of C -> Bb, the note name now AGREES with the degree label. REMAINING (the staged wiring = the real FORK-4 removal): (1) route the render paths (chord names, scale note list, fretboard) through the key-aware spellers instead of `spell()`/`spellScale()`; (2) the picker offers SHARP-only key names (A#, D#, G#), and those keys spell to double-sharps under correct theory - so the removal also needs the picker to name flat keys with FLAT letters (Bb not A#). That picker change is a scope/UX call (operator owns). Supersedes the #98 approach with a tested core. | operator UAT 2026-07-10 (music-theory-coach consult + operator go) |
| S-TESTSTEPS-EXECUTABLE | **Friction: prescribed testing steps were not intuitive or possible.** The agent's "build C, Bb, F" test steps failed the operator: (a) Bb is non-diatonic to C so it's not offerable from the suggested/In-key palette (had to discover the All view + that Bb renders as A#), and (b) the agent had not traced the Skip path end-to-end, so the test could not have passed anyway (seq was dropped - see S-SOLO-SCALE-DEFAULT fix). Mobile-dev-coach lesson: never prescribe a manual test the agent has not traced as executable ON THE ACTUAL SURFACE and data-path. Encode: verify the code path carries the data before writing the test steps; write steps in the app's own vocabulary (All view, A# not Bb). | operator UAT 2026-07-10 |

## MID (vision known - needs a spec interview, ~15-30 min each; batchable in one sitting)

| # | Candidate | Vision source |
|---|---|---|
| M-0 | **DETERMINISTIC TUTOR (vision captured 2026-07-05)**: skill ladder + progressive disclosure + ear-training/pitch/recognition drills + spaced repetition - ALL no-LLM on shipped machinery; the Tier-2 sitting centerpiece merging #84 + P4/P5 + M-CONSTRUCT/M-PHRASE | [vision-tutor-deterministic](vision-tutor-deterministic-20260705.md) |
| M-1 | Tutor Phase 4 complete: decoupled solo-scale selector over a FIXED progression (relative/parallel demos in place) | [TUTOR-ROADMAP](../../music/TUTOR-ROADMAP.md) Phase 4 (PARTIAL) |
| M-2 | Tutor Phase 5: song-form coaching (AABA, sections -> whole songs) | TUTOR-ROADMAP Phase 5 (PLANNED); operator Q5 2026-07-04: M-CONSTRUCT is a SEPARATE mission (with future-features intel) - P5 stays teaching-focused, M-CONSTRUCT is builder-focused |
| M-11 | M-CONSTRUCT: song construction + section transitions (OWN mission per operator Q5) - kickoff includes an INTEL pass on possible future features | [vision-ear-first](vision-ear-first-20260704.md) |
| M-3 | Strum-engine revival (draft PR #88: Karplus-Strong + humanized hand) | Existing draft PR - needs vision refresh + quality gate |
| M-4 | Music-app regression suite in CI (Playwright journeys J1-J4 + T-plans as automation) | Sprint-1 harness + test plan exist; needs CI-shape decision (box OOM rule -> CI-dispatched) |
| M-5 | buildAdapter extraction (inline HTML -> shared/chord-pack-adapter.js + real tests) - before next instrument profile or HSR Lens | [analysis A3](analysis-refactor-enhance-20260704.md) |
| M-6 | Client-storage strategy + schema inventory (issues #76 + #77) - the strategic layer above S-SAVE-TRUTH | gh #76/#77 + analysis A1 context |
| M-7 | ~~Jam picker~~ CLOSED WON'T-DO (2026-07-04): the entry point was DELIBERATELY removed by operator interview 3 days earlier (commit 8cf0647, never registered - now D-HERO-REMOVED); re-adding = re-litigation. OPEN FORK for Tier-2 sitting: a lightweight STATIC jam-now affordance (no show/hide-on-filter) - operator call | agent stop + git archaeology |
| M-8 | SUGG table -> shared module + spelling-agreement test; modeSwitch selected-state language unify (taste pick at interview) | analysis A7 + B5 |
| M-9 | mount() god-function incremental extraction - FOLD INTO M3, never big-bang | analysis A2 |
| M-10 | M-PERFORM: true play/perform songbook experience (full sheet layout, auto-scroll?, stage mode?, set flow) - VISION INTERVIEW required | [uat-walkthrough-20260704.md](uat-walkthrough-20260704.md) U1 - first shared-walkthrough finding |

## LONG -> promoted by the 2026-07-04 vision capture

| # | Candidate | State |
|---|---|---|
| M-EAR | Scale/mode AUDITION - hear it, hum it, A/B modes ("music is heard not seen") | Vision CAPTURED ([vision-ear-first](vision-ear-first-20260704.md)); 5 async interview Qs pending; strum-engine #88 revival becomes its foundation |
| M-SONG-ANCHORS | Known-songs-per-mode memory anchors + YT links | same vision doc |
| M-PHRASE | Solo phrasing depth (hang notes, tension/release) | same vision doc; extends shipped mentor layer |
| (merge) | M-CONSTRUCT folds into/ sharpens Tutor Phase 5 (M-2) | operator Q5 pending |

## LONG (ideas - need a vision interview before anything)

- Practice-tracking / streaks (accountability loop per tutor north star)
- Setlist sharing / export for bandmates
- More instrument profiles + per-instrument voicing depth (operator signal: "huge toolset for guitarists AND OTHERS")
- Audio-input features beyond tuner (chord recognition?) - speculative (NOTE: distinct from M-EAR audio-OUTPUT, which is captured)
- Compose UX redesign: tabs + Related Keys lens (gh #44)
- Setlist touch drag-to-reorder (gh #92)

## Operating rules

0. **Atomic tier plan active:** [atomic-queue-plan-20260704.md](atomic-queue-plan-20260704.md) - Tier-0 relay-launches autonomously (5-builder cap); Tier-1 quick picks asked as one round; Tier-2 = one batched sitting. This section governs launch order until superseded.

1. SHORT items launch autonomously when their trigger fires and quota is available - INFO ping, no gate re-ask (they were gated at spec time).
2. MID -> SHORT requires one operator interview sitting (batch several per sitting - that is the front-loading).
3. LONG -> MID requires a vision interview (fuzzier, longer).
4. Reviews batch: agent stacks review-ready items with adversarial pre-passes done, operator sweeps them in one window (taste/vision judgment only).
5. Scorecard tracks: dormant-quota-hours (target ~0 while SHORT non-empty), SHORT-queue depth (target >=2), interview-batch efficiency (specs gated per sitting).
