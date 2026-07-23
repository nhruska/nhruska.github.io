# SDD Persona Queue - Round 2 (2026-07-23)

> Development-queue feeder built by an SDD persona swarm: 4 read-only adversarial persona analysts (P1-P4, reusing the canonical [ux-personas-20260703.md](ux-personas-20260703.md) set) each mined the app for UNCOVERED UI/UX/human-factors friction and produced red-goalpost scenarios (each fails today, each is a TDD target for a build swarm). Every item is source-grounded and deduped against QUEUE.md + the friction log. The 5 P0s were verified against source before landing here.

Provenance: parallel Sonnet analyst swarm, orchestrated from Claude Code, 2026-07-23. Read-only pass - no app code touched. Feeds [QUEUE.md](QUEUE.md) and the autonomous build swarms.

## How to use this

Each row is a red goalpost: the "Red-goalpost scenario" column is a Playwright/Node assertion that FAILS today. Build order: write the failing scenario first (goalpost), implement until green, re-run. Priority: P0 = theory-authority error / data-loss / destructive-without-guard (persona dismisses the app); P1 = core-loop friction; P2 = polish. Size: S (<2h), M (half-day), L (multi-day).

## P0 - verified against source (2026-07-23)

All five confirmed by direct code inspection this session (line refs in the Verified column).

| ID | Persona | Surface | Friction | Red-goalpost scenario (fails today) | Size | Verified |
|----|---------|---------|----------|-------------------------------------|------|----------|
| P1-1 | P1 | Stage wake lock (`songbook.js` `reqWake`) | Wake Lock requested once on Stage entry, never re-acquired on `visibilitychange` - screen can sleep mid-song after any backgrounding (named P1 dismissal trigger). | Open Stage, dispatch `visibilitychange` (hidden then visible); assert `navigator.wakeLock.request` was called a 2nd time. | S | CONFIRMED - no `visibilitychange` listener; `reqWake()` one-shot @songbook.js:2196 |
| P1-2 | P1 | Stage top row (`.pTop .pmini`) | Live transpose buttons are 36x36px with 6px gaps, packed next to Close/Ctrl/Dim - a mis-tap silently changes the displayed key on stage (no confirm/undo). | Measure `#pUp`/`#pDown` box + gap to `#pClose`; assert >=44x44px and >=8px separation from any non-transpose control. | S | CONFIRMED - `.pTop .pmini` 36x36 @songbook.css:1295, 6px gap @1293 |
| P1-5 | P1 | Stage header (`showPerform`) | Capo is a real per-track field (shown as a Library badge) but never rendered on Stage - contradicts P1's stated JTBD "glance key/capo mid-set." | Load Stage on a track with `capo>0`; assert the perform header shows a capo indicator. | S | CONFIRMED - capo real @repertoire.js:99 + list-item.js:213; zero capo refs in songbook.js perform path |
| P2-1 | P2 | Compose > All view (`buildGrid`) | Non-chip branch calls `packDiagram(c,'small')` with no displayName - at beginner/intermediate (the default), a tile shows raw `A#` while the In-key tab shows `Bb` for the same pitch on the same screen (FORK-4 spelling defect). | key=F major, guidance=beginner, tab=Compose, view=All: assert no `#buildGrid` tile renders `#` when a key-aware spelling exists (`A#` absent, `Bb` present). | S | CONFIRMED - `wireTap(packDiagram(c,'small'),c)` omits displayName @songbook.js:~3530 |
| P3-2 | P3 | Song chord chips (`.chordChips .c`) | Chips are tappable-to-hear (`packPlayChord`) but bare `<span>` with no button semantics, no "tap to hear" cue - the app's single strongest "prove it works" moment is undiscoverable. | Open a song fresh; assert a chip renders as `role="button"`/`<button>` with a discoverable label, OR a one-shot notable says "tap a chord to hear it." | S | CONFIRMED - `<span class="c">` @songbook.js:1821, onclick @1857, no role |

## P1 - core-loop friction (source-grounded, not yet re-verified line-by-line)

| ID | Persona | Surface | Friction | Red-goalpost scenario (fails today) | Size |
|----|---------|---------|----------|-------------------------------------|------|
| P1-3 | P1 | Library add control (`toggleSet`) | Bare index-toggle via `wireTap` (scroll-guard only) - a fast double-tap adds then silently removes, netting the song OUT while the "Added" toast still shows. | Two rapid non-moving taps (<300ms) on a row's `li-add`; assert song IS in `STATE.setlist` after. | S |
| P1-4 | P1 | Perform launch/exit (`startPerform(...,0)`) | Perform hardcodes `startIdx=0`, no resume index - an accidental exit forces re-paging the whole set mid-gig. | Start Perform at index 4, Close, re-open Perform; assert it reopens at index 4. | M |
| P2-2 | P2 | Compose/Studio minor harmony (`diatonicInKey`) | Minor palette is pure natural-minor (Aeolian) with no disclosure it differs from the harmonic-minor functional dominant a classical musician expects. | key=A minor, In-key palette: assert v tile reads "Em" AND an in-context note explains the natural-minor convention (note is absent today). | M |
| P2-3 | P2 | Theory-engine test suite | The 1008-check canon tests the legacy canonical-sharp path, not the live key-aware spelling; only <half the 12x4 root/mode matrix has spelling-regression protection. | New Node canon asserting `Circle.scaleInKey(root,mode)` letter-for-letter vs conservatory ground truth for all 12 roots x {major,minor,mixolydian,dorian}. (Engine probed sound this session - this is the missing NET, not a live miscalc.) | M |
| P3-1 | P3 | Tune tab (`micToggle`) | Denied mic permission leaves the needle dead with only "Mic permission denied." - no recovery path, no pointer to the working reference-tone drones. | Deny getUserMedia on Tune; assert `#micCents` (or sibling) shows recovery guidance AND a pointer to `#tStrings`. | S |
| P3-3 | P3 | Chord diagrams (`diagram.js`) | `x`/`o`/dot convention has no legend/caption anywhere, despite the app's own reusable `Legend.js` pattern - a true first-timer cannot read the diagram. | First diagram render on a fresh profile; assert a legend/caption (or one-shot notable) explaining x/o/dot exists near it. | S |
| P3-4 | P3 | Library list + firstrun banner (`libraryFilter`) | Banner promises "the chord-count badge tells you the easy ones" but there is no sort/filter by chord count - the cue names a signal the UI won't let you act on. | Fresh profile, Library; assert a control exists to sort/filter by ascending chord count (or an "Easy" chip). | M |
| P4-1 | P4 | Compose mode chip (`convertToMode`) | Mode change re-qualifies chords silently (C-F-G -> Cm-Fm-Gm) with no JIT cue - unlike transpose, which does fire one. | Build C-F-G in C major, tap "Minor"; assert a notable/toast names the re-qualification. | S |
| P4-2 | P4 | Compose<->tab nav (`applyTab` -> `invalidateClearUndo`) | Tapping any other tab while the Clear-undo banner is armed silently kills it - for "clumsy taps are normal," an accidental tab-bar tap forfeits the just-shipped safety net. | Build progression, tap Clear (arms undo), tap Tune, tap back to Compose; assert undo survived OR a message explained why not. | S |
| P4-3 | P4 | Studio solo-scale default (`inferSoloDefault`) | The engine computes WHY it upgraded the scale (bVII->Mixolydian) but never surfaces it - the JIT "why" gap the persona doc names verbatim. | Build C-F-A# (I-IV-bVII), Solo -> Just practice; assert the Studio shows attribution text referencing the bVII/Bb chord as the reason for Mixolydian. | S |

## P2 - polish / affordance

| ID | Persona | Surface | Friction | Red-goalpost scenario (fails today) | Size |
|----|---------|---------|----------|-------------------------------------|------|
| P1-6 | P1 | Stage header (`.pKey` CSS) | The glance key-line is rendered at `.7rem`, the smallest text on the Stage screen - the operationally critical "glance key mid-set" line is the least legible. | Measure `#pKeyLine` vs `#pArtist` font-size; assert key-line >= artist-line (or >=13px). | S |
| P3-5 | P3 | Chord chips a11y (same element as P3-2) | Chips have no `role`, `tabindex`, or `aria-label` - unusable by keyboard/screen reader even after P3-2's visual cue. | Query `.chordChips .c`; assert each has an interactive role + accessible name. | S |
| P4-4 | P4 | Studio "why" affordances | Two overlapping "why" entry points (`?` scale-guide vs "Why these notes?") with no signal distinguishing "which scale" from "why these notes in the key." | Open Studio; assert a differentiating affordance (distinct glyph/tooltip, or merged entry) between `[data-guidetoggle]` and `[data-whytoggle]`. | S |
| P4-5 | P4 | Studio panel geometry | The JIT-why `?` Guide toggle is deliberately in the top-third stretch zone; no geometry audit of the OPENED Studio panel exists against the app's own thumb-zone convention. | Run the one-hand geometry classifier against the opened Studio panel (`[data-ctrlrow]`,`[data-guidetoggle]`,`[data-whytoggle]`,`[data-scalechips]`); assert JIT-why affordances are not exclusively top-third. | S |
| P4-6 | P4 | Studio fretboard (F16 full-neck) | F16 hardcoded `frets:12, noPosCtrl:true` for all instruments; no legibility audit for a 6-string 0-12 view, and QUEUE.md's S-BLUES-BOXES spec still assumes the retired pager (possibly stale). | Render Studio scale view, 6-string guitar, 412x915; assert every note-label legible across the full 0-12 span. (Also: reconcile S-BLUES-BOXES vs F16.) | M |
| P2-4 | P2 | Compose picker vs Studio chips | "Mixolydian"/"Dorian" name a KEY MODE in Compose and a SOLO SCALE overlay in Studio with no copy distinguishing them - the theory-literate persona is likeliest to misread the second as re-declaring the key. | One-shot notable the first time a solo-scale chip's family differs from the song's mode (e.g. "Dorian colors your solo - your song is still in C major"). | S |

## Cross-persona build batching (for whoever specs the builds)

- **Stage header/top-row redesign (one PR):** P1-2 + P1-4 + P1-5 + P1-6 share the Stage header surface - relocate transpose to the bottom nav (off the stretch zone, away from Close), add capo, persist last index, bump `.pKey` size. Four goalposts, one coherent change.
- **Chord-chip upgrade (one PR):** P3-2 + P3-5 - button semantics + accessible name + a "tap to hear" affordance. P3-2 is arguably a prerequisite for the CE3 J1 cold-start scenario ever passing meaningfully - sequence it before CE3's build.
- **Theory spelling pair:** P2-1 (fix the All-view non-chip branch to pass `dispChordName`) + P2-3 (add the 12x4 spelling regression net so it can't silently regress again).

## Cowork live-render round (2026-07-23) - complementary method

> The 4 persona analysts above worked from SOURCE (read-only, in Claude Code). A parallel Cowork session drove the app LIVE in Chromium at 412x915 (both themes) and measured the rendered DOM. That surfaced render-layer defects invisible to source analysis, and independently corroborated two P0s. Source-analysis + live-render measurement are complementary - run both.

**Corroborations (two methods, same defect):**
- P1-2 transpose geometry: Cowork measured the Perform transpose stepper at 30x34px live (source showed 36px `.pmini`) - both below 44px. Confirmed from two directions.
- P3-2 chord chips: Cowork confirmed no visible "tap to hear" affordance on the chips. Confirmed.

**New items (render-layer - only visible live):**

| ID | Surface | Friction | Red-goalpost scenario (fails today) | Priority | Verified |
|----|---------|----------|-------------------------------------|----------|----------|
| CW-1 | Perform chord sheet (`.lyrLine`) | Chord-over-lyric lines use `white-space:pre` (no wrap) inside a stage view that is `overflow-x:hidden` - long lines HARD-CLIP at 412px ("gonna be[...]"), breaking the one thing you do while playing: read the next words. Highest user-impact defect found. | Render Perform at 412px on a song with a long lyric line; assert no line is horizontally clipped (line wraps or shrink-fits). | P0 | CONFIRMED - `.lyrLine{white-space:pre}` @songbook.css:433 + stage `overflow-x:hidden` @~579 |
| CW-2 | First-run coach-marks | On Setlist/Compose/Tune the callouts overlap the element they point at and each other (Setlist callout covers "Your setlist is empty"; two Compose tips overlap/clip). One-time, but it's the first impression. | Trigger first-run at 412px on each tab; assert no coach-mark rect overlaps its target or another coach-mark. | P1 | Cowork live-render (412px, both themes) |
| CW-3 | Perform | No auto-scroll control - a gigging musician with both hands on the instrument can't advance the sheet hands-free. | Assert Perform exposes a hands-free scroll (auto-scroll toggle or speed control). | P1 | Cowork live-render |
| CW-4 | Light theme muted text | `#5f6875` muted gray on the nav bar measures 4.58:1 - passes AA by ~2%, no margin. | Assert muted-gray-on-nav contrast >= a safer floor (e.g. 4.8:1). | P2 | Cowork measured (4.58:1) |

CW-1 arguably outranks the source-found P0s on user impact (it breaks the core reading task mid-performance) and is a small fix (`.lyrLine` -> `white-space:pre-wrap` or shrink-to-fit). CW-3 pairs with the Stage-header PR. CW-2 is its own onboarding fix. The light-render filter-chip finding overlaps P3-4 (already queued).

## Next

1. Operator greenlight -> assign S-codes and fold P0s into [QUEUE.md](QUEUE.md).
2. First autonomous build swarm targets the 6 verified P0s (the 5 source-verified + CW-1) - write each red-goalpost scenario first, then implement - worktree-isolated, one build per batch, respecting the repo's build conventions (cache-bump, schema, lint gates). CW-1 is the recommended first fix: highest impact, smallest change.
3. Re-run each red-goalpost after build; green = shipped.
