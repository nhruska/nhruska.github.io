# Expertise-Adaptive Display

[Wiki](../index.md) > ux-philosophy > Expertise-Adaptive Display

## Purpose

Different players read fretboards differently. Show what each player actually navigates by - not one representation for all.

## The problem

Finger-dot diagrams teach beginners: "put this finger here." They become a crutch that silences pattern recognition. A seasoned player (P5) navigates by hand position, shape families (CAGED-adjacent), inversions, and movement vocabulary - a diagram plastered with dots is noise; the clean pattern + hand position IS the guide. Conversely, a learner (P3) without muscle memory needs the dots to start.

Operator framing (verbatim-essence, binding): seasoned players do not need finger dots on fretboard views - the fretboard SCALE view is their guide, plus guidance on hand placement and which fingers to use in the different shapes: patterns to make muscle memory.

## Pattern-first for seasoned players

What P5 actually uses:

- **Hand position** - the fret window the hand spans.
- **Shape families** - movable patterns (C-family, F-family, A-family per CAGED-adjacent thinking).
- **Inversions** - root/1st/2nd tells you the hand shape.
- **Movement vocabulary** - hammer into IV, slide up 2 to V, rotate into the next shape (HGT/HSR system, see [systems/instrument-profiles.md](../systems/instrument-profiles.md)).
- **The fretboard scale view as the guide** - which notes live where in THIS key, up the whole neck.

The existing seed: the Studio scale view already renders position windows ([key-explorer.js](../../shared/key-explorer.js) posWindow: POS_STEP=5, POS_CAP=14 - "how far a hand naturally slides in one move") with note names at phone-DPI floor. The pattern is already the guide; what's missing is the option to strip beginner chrome from CHORD diagrams and add hand-position/fingering language.

## Dots and numbers for learners

The current diagram default ([diagram.js](../../shared/diagram.js)): dots on strings, open/mute marks, base-fret digit. Correct for P3 - keep as the safe default.

## S-DIAGRAM-PREF - the queued setting (spec home) [ROADMAP reviewed 2026-07-04]

One-time prompt (D3 settings-with-prompt pattern; via Notables, never at first-run):

> How do you read a fretboard?
> 1. Dots and finger numbers (I'm learning new shapes)
> 2. Clean patterns with hand position (I move by feel)

- **Storage:** `music.diagram.pref.v1` = 'dots' | 'patterns' (additive key; defensive read; default 'dots').
- **'patterns' rendering:** same fret data, same canvas; strip finger numbers + open/mute chrome; add a hand-position label (e.g. "barre at 3, C-family shape, 1st inversion") and, where the surface knows it, suggested fingering as TEXT (index/middle/ring/pinky), not dots.
- **Never changes:** WHICH diagrams/chords/scales show (style only); the solo scale view (already pattern-first); any theory output.
- **Out of scope:** hiding diagrams, new visual chrome, per-chord custom overlays.

## One surface, two readers

Where a diagram appears in teaching context, co-locate: the diagram (styled per preference) + roman numeral (function) + inversion label (hand shape) + key context. The learner reads dots; the seasoned player reads shape/position/inversion. Same surface, both respected.

## Backlog: full HSR Lens

The complete hammer/slide/rotate visual loop (transitions between shape families up the neck) stays future work; the Studio scale view + S-DIAGRAM-PREF are the pragmatic first slice.

---

**Anchors verified:** key-explorer.js:69-152 (posWindow, renderScale), diagram.js (render + sizes), docs/hsr-notes.md (shape families, HSR Lens - absorbed), notables.js (prompt infra), goal spec P5 + operator omission verbatim, sprint A9 static-template discipline (pattern for any new copy)
