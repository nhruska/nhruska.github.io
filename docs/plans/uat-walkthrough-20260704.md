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
