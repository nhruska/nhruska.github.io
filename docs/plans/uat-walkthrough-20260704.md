# UAT Capture - Initial Shared Walkthrough (2026-07-04)

> First walkthrough of the app SHARED with other users (the personas made real). Findings land here verbatim-essence, then route to QUEUE horizons.

## U1 - Songbook does not deliver for true play/perform

**Operator verbatim-essence:** "the built-in songbook doesn't deliver for true play/perform" (typed "play/pedom"; read as play/perform).

**Reading (to be validated in the vision interview):** the library/chord-sheet/Perform surface works as a reference tool but not as a GIG tool. Candidate gaps a working musician hits mid-song: full lyrics+chords sheet layout (not just a progression strip), auto-scroll / hands-free advance, stage-readable type at arm's length, per-song performance notes surfaced at the right moment, set flow (next-song with zero navigation), capo/transpose at a glance, dark stage mode. Today's Perform view + chord meta rows were built one-screen-mobile-first - true perform likely needs a dedicated full-screen sheet experience.

**Routing:** QUEUE MID as M-PERFORM (vision interview required - this is a product-direction item, not a patch). Probe questions for the interview: (1) what happened in the walkthrough moment - reading lyrics? losing place? chords too small? (2) reference artifact: which app/paper workflow does the user reach for instead (OnSong, Ultimate Guitar, paper binder)? (3) is the unit a SONG SHEET (lyrics+chords inline) or a PROGRESSION (what we render today)? (4) hands-free requirement level (foot pedal/auto-scroll/none)?

**Status:** captured; awaiting vision interview (batch with MID sitting).

## U2-U4 - Studio polish round (operator, 2026-07-04, post-v85 walkthrough)

- **U2:** "fretboard section links are all different sizes. I can expect equal sections." -> position-pager segments now equal-width (fixed in S-STUDIO-POLISH).
- **U3:** "selecting a chord on the solo screen, the highlight dot bg a dark shade with black font on top - hard to read." -> per-class dot ink vars, both themes (fixed in S-STUDIO-POLISH).
- **U4:** "two links at the bottom wrap the text. shorten the linked text so no wrap." -> link labels shortened (fixed in S-STUDIO-POLISH).

## U5-U7 - Compose walkthrough round 2 (operator, 2026-07-04, Pixel, post-v88)

- **U5:** "the guitar chords are still overlapping" (All grid, phone) - parent repro at default DPI clean; investigating device font-scale geometry; defensive tile clamps shipped (S-COMPOSE-POLISH2). If it persists on-device, suspect stale PWA precache - operator to check Settings build line.
- **U6:** "clicking one of the filters, the scrolling portion snaps back to the top... suggested chords are hidden... first thing shown should be the filters" - filter-row scroll anchoring shipped (S-COMPOSE-POLISH2).
- **U7:** "the confirmation when clicking solo over a backing track is hidden in the page... should be a dialog that disables the rest of the page with a dim filter" - promoted to the app's modal standard (S-COMPOSE-POLISH2).

## U8 - Progression strip: degrade + wrap instead of horizontal scroll (operator, 2026-07-04)

**Operator verbatim-essence:** "when count chords over width, convert to existing smaller chord icon without chart. wrap chords to keep in view without scroll horiz."

**Spec sketch (S-PROG-WRAP, Tier-0 relay - fires when S-COMPOSE-POLISH2 frees the region):** when the progression's chord count exceeds what fits one row at diagram-card size, the strip re-renders ALL entries as the existing compact chord token (name + roman, no diagram chart) and flex-WRAPS - no horizontal scroll. Tap/remove interactions unchanged. Threshold derived from measured width, not hardcoded count. A7 gate: wrapped height at 12 chords must hold the one-screen budget at 412x915 (compact tokens ~2 rows vs today's scrolling diagram row - measure). Amends the D-CAP12 note ("strip scrolls") to "strip degrades + wraps".

**Shipped as S-PROG-WRAP (PR #141):** width-measured `full`/`compact` binary threshold + flex-wrap. A7 verified: composeTop 379px of 915 with the 12-bar loaded.

### U8b - Staged density ladder, not a binary flex-wrap (operator, 2026-07-04, follow-up screenshot at 11 chords)

**Operator verbatim:** "make 6 per row so no 3rd row wrap. degrade at 8, 10...? keep 3 and 4 chord songs to fill box... gets smaller as you build. keep logical count per row and degrade up to 12 being 2 rows of 6 without shrinking common progressions of 3, 4, etc."

**Root cause of the follow-up:** S-PROG-WRAP's binary `full`/`compact` split was width-only - once a progression's diagram row overflowed, EVERY chord (regardless of count) fell back to the browser's natural flex-wrap line break. At 11 chords on the operator's viewport this broke as an uneven 5+5+1 - a 3rd, mostly-empty row - because flex-wrap has no concept of "keep a logical count per row."

**Spec (S-PROG-WRAP-2): a COUNT-driven staged density ladder**, CSS Grid instead of free flex-wrap:

| Stage | Chords | Render | Row logic |
|---|---|---|---|
| `full` | 1-4 | Diagram cards, sized to fill the strip evenly (grow within sane bounds - "fill box"), never shrunk | Flexbox, one row |
| `fill-row` | 5-6 | Compact token (name + roman, no chart), sized to fill one row evenly | CSS Grid, `repeat(count, 1fr)` |
| `grid6` | 7-12 | Compact token | CSS Grid, FIXED `repeat(6, 1fr)` - 12 = exactly 2 rows of 6, never a 3rd orphan row |

Width is still measured (`progStripMode`), but only as a narrow-viewport GUARD that demotes a stage one step early (never shrinking a card/token below its natural size) - it never overrides the count-driven stage on a normal viewport.

**Shipped as S-PROG-WRAP-2 (this PR):** `progStripMode` reworked to the 3-stage ladder above; `renderProg` toggles `full`/`fill-row`/`grid6` classes on `.prog` and sets the inline `grid-template-columns` for the `fill-row` stage; CSS reworked around the 3 stage classes. Verified live at 412x915: 3/4 chords render as full-size diagram cards filling the row, 5/6 as one compact row, 7-12 as a clean 6-per-row grid (11 as 6+5, 12 as 6+6), with removal re-staging correctly across every boundary.

## U9 - "Added to setlist" toast never auto-hides (operator, 2026-07-04, screenshot)

**Operator verbatim-essence:** "The added to setlist toast confirmation never disappears - navigated to my setlist and it's still showing. We don't have any other patterns that use this, although I think it is valid. Where else could we place this type of non-intrusive message? Should we make it part of our UI Primitives Library?"

**Root cause (parent-verified in source):** `var toastTimer` declared TWICE inside Songbook.mount()'s closure (library toast ~1454, compose toast block ~2441) - var hoisting makes them ONE shared variable; the two toast systems clobber each other's hide timer. Pre-existing latent bug, made visible by the truthful-toast traffic (#124).

**Fix (S-TOAST, in flight):** extraction, not a patch - shared/toast.js primitive owning its own timer (ARIA live region, error/persist variants preserved), both call sites delegate. Ships WITH the operator-requested wiki page ux-philosophy/ui-primitives.md (toast/notable/modal/chip taxonomy + candidate placements: backup done, restore done, pref saved, transpose applied, setlist ops with undo).

## U10 - Guidance notable camouflaged by selection-surface rows (operator, 2026-07-04, screenshot)

**Operator verbatim-essence:** "I like the guidance... but it camouflaged with the highlight rows. Make a prim and enforce consistency - for each element in each view in the whole app so I don't have to type that again."

**Grounding:** Library view - the guidance notable banner and the in-setlist row highlight both use the same pale accent surface; guidance (educational) wears selection's (state) clothes. Fix at the PRIMITIVE: notables get their OWN surface token, distinct from selection surfaces, app-wide.

**Standing directive encoded:** THE ELEMENT CONSISTENCY LAW - music/CLAUDE.md + wiki ssot-registry.md. Never needs re-typing: consistency findings now route to primitives by law.

## U11-U13 - Audition round 1 (operator, 2026-07-04, minutes after v106 shipped)

- **U11:** "need to switch modes and keep playing without hitting play again" -> Sound.retarget at note boundary; chip switch = live A/B (M-EAR 1.5).
- **U12:** "light up the notes on the fretboard" -> kx-sounding pc lights, all octaves, position-preserving (M-EAR 1.5).
- **U13:** "show more fretboard instead of pieces, optionally" -> Window|Full-neck toggle, persisted, full = 0-14 (M-EAR 1.5).

## U14-U18 - Audition round 2 + library strategy (operator, 2026-07-04 evening)

- **U14:** "needs faster tempo. add a slider for slow/med/fast control." -> tempo control on the audition player (M-EAR 1.6).
- **U15:** "I don't see the frets lighting up." -> all v109 bits verified deployed (kx-sounding css + setSounding wiring); primary suspect device SW cache; wave 1.6 re-repros across states AND hardens visibility (if it can be missed, it is too subtle).
- **U16:** "the legend below needs specific color dots listed with description." -> a LEGEND PRIMITIVE (dot swatch + label per visible class: root / chord tone / blue note / ghost / rub / sounding), one component per the Consistency Law, replacing the prose caption (M-EAR 1.6).
- **U17:** "read the info on YouTube given a link to suggest fields when adding tracks - less friction." -> YT-prefill on the add form (oEmbed keyless if CORS permits, feature-detected; title-parse heuristics for key/mode/genre/bpm hints; graceful manual fallback) (M-TRACKLIB w2a - buildable now, no API key needed).
- **U18 (strategy - the north star):** operator curates his own YT playlist across the mode/scale matrix; the app SHIPS with that library baked in ("I put that bonus on all our users so they can compound the time it took us... skip the empty-library phase and move immediately on their journey"). Pipeline: his playlist -> sync (w2b, needs his API key) -> tag/confirm -> BAKE into tracks.json (the shipped catalog) -> all users start with a ready jam library. User-own-playlist connection = later capability; operator judgment curates v1.

## U19-U20 - Feedback-surface reconcile + note-color palette (operator, 2026-07-05 00:01, screenshot)

- **U19:** "Received confirmation that I saved AND that the track was deleted [two stacked inconsistent surfaces: an amber toast + a gray inline undo panel]. Reconcile using our standard primitives across the WHOLE app - see where else popups/confirmations/help appear; be consistent; MODAL with disabled background when necessary; toast when appropriate; help panels clearly noted with an icon; match the UI primitives and DRAFT BRAND STANDARDS where something is missing using best judgment. Consistency and SSOT are the rule - ux/UI/human-factors mobile philosophy definition." -> M-DESIGN-ENFORCE wave 2: full feedback-surface AUDIT (toasts, undo panels, native confirm()/alert() [known in the backup flow], notables, help affordances) -> taxonomy assignment (toast=outcome / toast+action=undoable outcome / modal=decision, NO native dialogs / notable=education / help=icon-marked disclosure) -> reconcile + conventions codified.
- **U20:** "A choice of colors of notes on the fretboard as they play - the most legible option from the legend. Dark mode + accent colors. Colors can become a THEME PALETTE with complementary and/or adjacent tones or hues. Yielding to you." -> palette system derived from the user's accent hue via CSS relative color (hue-rotated complementary/adjacent tones, lightness pinned per theme for contrast) so every kx dot class gets a cohesive, theme-tracking color; folded INTO the in-flight M-EAR 1.6 legend/sounding work (same surfaces).

## U21 - Bdim card missing its shape label (operator, 2026-07-05 00:12, screenshot)

**Operator:** "chord Bdim missing" - the Studio chords-in-key Bdim card renders diagram-only: no classifier label (others show "open X shape, root on N..."), card height/alignment visibly off.

**Root cause (by design, now insufficient):** shape-classify.js returns honest null for diminished quality (dim/dim7/aug were explicitly left uncurated in step 0). Fix: (a) curate dim/dim7/aug templates for guitar-standard + ukulele-gcea (S-DIM-SHAPES - the uke movable dim shape is classic and classifiable); (b) null-label cards reserve the label slot so card heights stay equal whatever the classifier returns (folded into M-EAR 1.6's region). Also verify tap-to-hear fires on dim cards (Circle.chordTones handles dim - confirm live).

## U22 - Setlist Prev/Next loses the current song -> library empty-state (operator, 2026-07-05 01:25, screenshots)

**Operator:** "using next/previous through the songs of the set, we're losing something for the current song and getting an unexpected message [Choose a song from the Library to open it]. Could be data specific to me but..."

**Diagnosis (not his data - a bug class):** DANGLING SETLIST REFERENCE - a set member deleted from the library (he deleted a track tonight during U19 testing) leaves its id in the setlist; queue nav resolves it to nothing and the perform pane falls to the empty state; the N/M counter still counts the ghost. Fix at three levels (S-SET-INTEGRITY): (1) DELETE flow heals: deleting a library item that is in setlists says so and removes the refs (toast+action undo restores both); (2) NAV is defensive: unresolvable entries are skipped with a calm inline notice ("1 removed song skipped"), counter reflects live entries, never the library empty-state mid-set; (3) LOAD-time heal: sets prune/mark dangling refs (migration-runner friendly).
