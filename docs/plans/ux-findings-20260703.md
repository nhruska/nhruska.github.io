# Persona Walkthrough Findings - J1-J4 (2026-07-03)

> Phase-2b artifact of the [ux-persona mission](goal-ux-persona-mission-20260703.md).
> Method: headless Playwright at Pixel-10 viewport (412x915), fresh profile, journeys
> J1 (cold start), J2 (tune), J3 (compose loop incl. live destructive probe),
> J4 (setlist prep incl. edit mode). Per-screen interactive-element geometry classified
> for one-hand use (thirds, <44px targets, scroll-rail adjacency, destructive inventory).
> 11 screens captured, 0 console errors. Instrument: default (Ukulele) - geometry/flow
> findings are instrument-independent; guitar diagram width was fixed in PR #96.
> Source-verified: every behavioral finding was confirmed in code, not just observed.

## Findings (severity-ranked)

### F1 - P0 - Compose "Clear" destroys the progression with NO guard [P4, P1 | D5]
- **Observed (live probe):** built E-A-Bm-D in E Mixolydian; one tap on Clear -> 4 slots to 0. No confirm, no undo, nothing.
- **Source-verified inconsistency:** the Setlist header ✕ (`#setClear`) HAS `confirm('Clear your setlist?')` (songbook.js:1168). Compose Clear has nothing. The app already believes whole-collection clears deserve a guard - just not here.
- **Compounding:** Clear (52x42) sits directly beside Save (50x42) in the TOP stretch zone - the exact imprecise-reach position for a thumb stretching from an instrument grip. Mis-reach for Save = work gone.
- **Fix direction:** match the app's own pattern - confirm, or better, the prior council's preferred persistent-undo (as shipped for set-item remove). Sprint candidate S-CLEARGUARD.

### F2 - P1 - Progression slot removers: 24x24px, top zone, unguarded [P4 | D5]
- Each built chord carries an x at 24x24 - nearly half the 44px floor - in the top third. One chord is cheap to rebuild, but tiny adjacent targets invite wrong-chord removal mid-flow.
- **Fix direction:** 44px hit area (padding, not glyph size), movement-cancel, or gate behind the existing maximize/edit surface. Sprint candidate S-SLOTX.

### F3 - P1 - Setlist ✕: guarded but not movement-cancelled, always-hot on the top rail [P1 | D5]
- `#setClear` is always-visible (when the set is non-empty), top-right ON the scroll rail, 44x44. It has confirm() - good - but is NOT movement-cancelled, while [list-item.js](../../music/shared/list-item.js) ships `wireTap` (movement-cancel) for precisely this rail hazard (prior codex insight).
- A scroll-grab opens a surprise modal mid-performance prep. Also: native `confirm()` renders as a browser dialog - jarring inside an installed PWA.
- **Fix direction:** wireTap it; consider relocating into Edit mode; app-styled confirm. Sprint candidate S-SETX.

### F4 - P1 - Zero first-run guidance; the open-a-song affordance is invisible [P3 | D6]
- Cold start lands on the full Library: 42 interactive elements, 36 below the 44px floor, 28 in the top third - and not one guidance affordance. No "start here", no one-shot notable anywhere in the app.
- A song row's only VISIBLE action is "Search" (external). Body-tap opens the song (movement-cancelled, well built) - but nothing signals it. My robot failed to find it on the first attempt; a first-timer scanning for "how do I see the chords?" gets no cue.
- **Fix direction:** the operator's one-shot dismissible notable pattern (D6): a first-run "Tap a song to open its chords" cue + a "3 chords - start here" nudge leveraging the existing chord-count badge. Persisted per D6 (localStorage, defensive reads). Sprint candidates S-NOTABLES, S-FIRSTRUN.

### F5 - P2 - Filter chips below the thumb floor [P3, P1]
- Genre + key chip rows render at ~30px tall in the top third (12 keys x 4 modes worth of chips on Library). Dense, small, stretch-zone.
- **Fix direction:** bump chip min-height toward 40-44px within the one-screen budget (music/CLAUDE.md "one screen, above the fold" constraint means measuring before inflating). Sprint candidate S-CHIPS.

### F6 - P2 - Library key chips will inherit PR #98's spelling [P2]
- Key filter chips currently show sharp-only names (A#, F#m...). Once key-aware spelling (PR #98) lands, verify the chips + key-first tags adopt conventional names (Bb where flat-side). Verification rider on #98, not a new item.

### F7 - POSITIVE - patterns to keep (and reuse)
- **Solo -> Studio interstitial:** "Save to add a video backing track or skip to practice - Save & open Studio / Skip" - a save-confidence gate exactly where P1 wants persistence proof. Reuse this pattern for Clear-undo messaging.
- **Movement-cancelled list actions** (wireTap) - the prior council's rail-safety rule, correctly shipped in list-item.js.
- **Edit-set mode** gating reorder/remove + persistent undo - intact, working.
- **Suggestion row teaching:** "ADD A 3RD CHORD" with roman labels on every chip - JIT theory already leaking through in the right way (D6 direction).
- **J2 Tune:** the cleanest screen in the app - 11 elements, big targets, glanceable. (Mic flow untestable headless; needs a manual pass on device.)

### F8 - P2 - Compose action bar density in the stretch zone [P4]
- The whole control row (flat / key chip / sharp / expand / Clear / Save) lives top-third. Defensible (content owns the fold), but it concentrates six sub-44px-height targets where reach is worst - and puts Clear beside Save (see F1). Resequencing Clear away from Save may fall out of S-CLEARGUARD for free.

## One-hand geometry summary (Pixel-10 viewport)

| Screen | Interactive | <44px | Top-third | Destructive (guard) |
|---|---|---|---|---|
| J1 Library (cold) | 42 | 36 | 28 | - |
| J2 Tune | 11 | 2 | 2 | - |
| J3 Compose (built) | 22 | 13 | 12 | Clear (NONE), 4x slot-x 24px (NONE) |
| J3 Studio hand-off | 23 | 13 | 12 | Clear (NONE), 2x slot-x |
| J4 Library search | 36 | 30 | 29 | search-clear 26px (benign) |
| J4 Setlist | 10 | 5 | 6 | set-✕ 44px rail (confirm, no move-cancel) |
| J4 Edit-set mode | 13 | 8 | 9 | item-x 40px (edit-gated + undo) |

## Sprint candidates emitted (for the council to rank with S-ROMAN / S-TONES / S-GOLDEN)

| ID | What | Personas | Principle |
|---|---|---|---|
| S-CLEARGUARD | Guard Compose Clear (confirm or persistent undo) + separate from Save | P4 P1 | D5 |
| S-SLOTX | 44px slot-remover hit areas + movement-cancel | P4 | D5 |
| S-SETX | wireTap the setlist ✕; app-styled confirm; consider Edit-mode home | P1 | D5 |
| S-NOTABLES | One-shot dismissible notable infrastructure (localStorage, D6 pattern) | P3 all | D6 |
| S-FIRSTRUN | First-run cues: tap-to-open + easy-song nudge (uses S-NOTABLES) | P3 | D6 |
| S-CHIPS | Filter-chip thumb-floor bump within one-screen budget | P3 P1 | D5 |

Method notes: journey harness at scratchpad journeys.py; screenshots j-*.png; raw geometry journeys.json. Robot could not open a song via `.liTitle` selector (no such class) - finding F4's "invisible affordance" observation stands on the visible-action analysis, not the robot failure.
