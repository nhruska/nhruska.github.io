# Design Principles

[Wiki](../index.md) > ux-philosophy > Design Principles

## Purpose

Why the app feels like it does: the operating constraints that shape every interaction.

## One screen, above the fold

The app never forces a scroll to reach the primary action on a phone (Pixel-10 viewport: 412x915). When UI would push the main task below the fold, reclaim space instead of inflating the screen. Portrait and landscape each get a layout that fills the viewport without waste (100dvh, orientation-aware grids).

Evidence: music/CLAUDE.md:32 ("one screen, above the fold"); songbook.css flex-column + tab-strip layout; tracks.css Studio grid sizing; sprint A7 geometry gate (412x915 Playwright fold check).

## Instrument-in-hands grip model

User is holding an instrument. One free thumb does all navigation. Phone is propped or held in one hand. Glances are arm's-length, mid-playing. This is not "sitting at a laptop with both hands free."

- One-hand targets: 44px minimum hit area.
- Thumb-zone geometry: bottom third = easy reach, middle = OK, top third = stretch. Destructive controls in the stretch zone are inherently at-risk ([ux-findings F1-F2](../../../docs/plans/ux-findings-20260703.md): Compose Clear sat beside Save in the top stretch zone = work-loss vector, fixed in sprint 1).
- Scroll-rail safety: the hot right edge where the thumb scrolls and stabilizes the phone is the MOST dangerous place for always-hot controls - an action there fires on scroll-grab. Scroll-rail actions MUST be movement-cancelled (wireTap) and/or mode-gated. See [interaction-safety.md](interaction-safety.md).
- Consequence intolerance: a mis-tap must never delete or edit anything. Accidental taps are NORMAL here, not edge cases.

Evidence: sprint A3 undo contract; [list-item.js](../../shared/list-item.js) wireTap routing; [personas](personas.md) shared context.

## Theory-authority trust chain

The app is a theory authority. One wrong chord spelling or scale note and the skilled personas dismiss it permanently as a toy ([personas P2](personas.md)). The credibility rests on one unbroken chain: pitch-class core -> spelling-as-display -> fretboard agreement.

- Spelling is canonical-sharp (FORK-4): ONE sharp table app-wide; flat input normalizes, flats never render ([theory-engine/note-spelling.md](../theory-engine/note-spelling.md)). [TRACKS-#98]
- Fretboard scale view and note list agree: both fed by Circle spelling, never derived independently ([key-explorer.js](../../shared/key-explorer.js) header contract; Diagram.scale(opts.names)).
- Progression chips, Compose palette, Studio solo scales - consistent at every surface. A player learning "Bb" from one screen and "A#" from another has left the app.

Evidence: music/CLAUDE.md:29 spelling contract; circle.js MODE_STEPS SSOT + songbook sync; test/theory-canon.test.js (1008 checks).

## Soul + anti-vision

**The soul:** this is a harmony teacher. The Studio backing-track finder is the daily-habit hook; the teaching is the point. Growth means new chord forms, new keys, the "why" - not genre chasing.

**Anti-vision (design against these):**
- No bloat. One surface + one view toggle, never a dashboard. Feature creep is the named enemy.
- Stage speed is sacred. The curated library is local; the only online dependency (YouTube playback) sits behind an explicit tap and degrades gracefully offline.
- Never still a search. If sampling and judging tracks happens live, the design failed. Judgment happens off-stage, calmly, once.

Evidence: backing-tracks design doc (soul/anti-vision sections, absorbed here; stub at [music/docs/backing-tracks-DESIGN.md](../../docs/backing-tracks-DESIGN.md)).

## Functional naming, not product branding

Every control is named by what it does. The Library row action reads "Video" (curated, in-app) vs "Search" (external, leaves app) - named by CONSEQUENCE, not brand ([list-item.js](../../shared/list-item.js) action ladder; prior HF council P0.2 ruling). No phony product names.

---

**Anchors verified:** music/CLAUDE.md:29,32; list-item.js action ladder + wireTap; key-explorer.js header; backing-tracks-DESIGN soul/anti-vision; ux-findings F1-F2; sprint A3/A7; theory-canon
