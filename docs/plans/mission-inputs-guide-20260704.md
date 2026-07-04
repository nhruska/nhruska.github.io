# Mission Inputs - Studio Guidance + Key-Chooser (operator, 2026-07-04 post-M2 UAT)

> Captured verbatim-essence from the operator's phone notes at M2 close. Seeds the M-GUIDE mission interview.

## I1 - Pent/blues in the Compose key chooser?

Operator: "should pent major, pent minor, blues also be included in the studio key chooser with mixo, maj, min, dorian (instead of just the solo studio)?"

Design fork (touches the SOLO-BOUNDARY decision): (a) mirror the solo chip row INTO Compose (decoupled, progression untouched); (b) add BLUES as a true harmonizing mode (I7-IV7-V7 dominant harmonization + 12-bar starters + pent-minor default solo) - musically the "blues key" answer; (c) keep Studio-only + stronger cross-link. Interview adjudicates.

## I2 - Scale mentorship layer

Operator: "need more guidance tutor mentorship for scales: when to choose, what notes to resolve to/hang on/start and end licks. guidance on using the songs chords shapes in solo."

Candidates: static per-scale guidance cards (choose-when, resolve-to, start/end notes) AND/OR dynamic chord-tone targeting (fretboard highlights the current chord's tones inside the scale; shapes-as-anchors ties into the S-DIAGRAM-PREF classifier + S-BLUES-BOXES). Tutor-roadmap Phase 4/5 adjacent.

## I3 - More fretboard in the Studio

Operator: "can we fit more fretboard on studio? ukulele most prob." - density/window question: more frets visible vs larger render vs chrome trim; 4-string instruments have headroom.

## I4 - BUG: key clear leaves the mode chip dead (F12)

Operator: "key changer allows removing selected key (not mode tho) - defaults back to most recent (ex when transposing). removing key and leaving mode - can't click ex. minor or major (i.e. selected mode)."

Repro/source: songbook.js buildKeyPicker mode handler - `if (mk === songKey.mode)` no-op-confirm branch only closes the panel when a root exists; with root cleared, tapping the SELECTED mode does nothing (feels broken). Also clarify clear-key semantics vs transpose re-deriving a key. Fix ships in the mission's first wave regardless of interview outcomes.
