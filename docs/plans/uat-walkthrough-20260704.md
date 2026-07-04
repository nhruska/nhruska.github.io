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
