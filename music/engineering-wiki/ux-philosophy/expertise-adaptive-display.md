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
- **Prerequisite (build step 0, P5 fold):** a SHAPE CLASSIFIER - curated shape-family metadata per voicing (family, root string, inversion, barre fret). The current data path has fret arrays only; without the classifier the promised labels are hand-waving. Ship the classifier (curated table per profile, movable-template aware) before the rendering toggle.
- **'patterns' rendering:** same fret data, same canvas; KEEP the voicing facts (X/O marks, base-fret digit, root/degree tinting) - pros do not hate dots, they hate unlabeled INSTRUCTION dots; strip finger-number instruction chrome; add the classifier's label ("E-shape barre, root on 6, 1st inversion") and fingering as TEXT where curated.
- **Never changes:** WHICH diagrams/chords/scales show (style only); the solo scale view (already pattern-first); any theory output.
- **Out of scope:** hiding diagrams, new visual chrome, per-chord custom overlays.

## One surface, two readers

Where a diagram appears in teaching context, co-locate: the diagram (styled per preference) + roman numeral (function) + inversion label (hand shape) + key context. The learner reads dots; the seasoned player reads shape/position/inversion. Same surface, both respected.

## Chord-tone targeting is the deterministic guidance layer (M-GUIDE W3a, amended by the P5 fold)

Targeting (see [systems/practice-studio.md](../systems/practice-studio.md)) is the mechanism that answers "where do I actually put my fingers over THIS chord" without a single curated fact: `Circle.chordTones()` computed against the current scale, pure pc arithmetic, identically for any key/chord/scale. It is the pattern-first philosophy above made literal - the fretboard itself lights the answer, no finger-number instruction needed. It shipped W3a as intersection-only (a chord tone outside the scale simply didn't render) - P5's own adversarial pass on the shipping PR killed that: for A7 over A blues, C# (the major 3rd) is the note a seasoned player is already reaching for, and hiding it taught the exact habit this feature exists to break. Now every chord tone renders - in-scale filled, out-of-scale as a hollow "ghost" dot at its real fret position - so the derived layer shows P5 the WHOLE picture, not a filtered one. The mentor cards (SoloGuide) are the deliberate exception and stay separate:

- **Targeting = derived, deterministic, infinite coverage** - works for any of the 12 roots x any chord quality, zero curated data. Ghost dots are the same derivation, just unfiltered by scale membership.
- **Cards (SoloGuide) = curated, static, finite coverage (D-CARDS-STATIC)** - 7 known scale keys, hand-written P5-voiced prose, `{i}`-index interpolation only. They exist because "when to reach for this scale" and "what to do at the ends of a phrase" are judgment calls a pc-arithmetic function cannot derive - the same reason S-DIAGRAM-PREF's fingering labels above are deferred pending a curated shape classifier, not computed.

The two compose on one screen exactly per "One surface, two readers" above: the fretboard's colored dots (derived, now including ghosts) sit right beside the Guide card's prose (curated) - a seasoned player reads the dots, a learner reads the card, neither needs the other.

## Backlog: full HSR Lens

The complete hammer/slide/rotate visual loop (transitions between shape families up the neck) stays future work; the Studio scale view + S-DIAGRAM-PREF are the pragmatic first slice.

---

**Anchors verified:** key-explorer.js:69-152 (posWindow, renderScale), diagram.js (render + sizes, opts.tones incl. ghostPcs/kx-ghost), tracks.js targetTones/defaultTones (M-GUIDE W3a, P5-amended), solo-guide.js (SoloGuide card/framing, P5-amended), docs/hsr-notes.md (shape families, HSR Lens - absorbed), notables.js (prompt infra), goal spec P5 + operator omission verbatim, sprint A9 static-template discipline (pattern for any new copy), docs/plans/m-guide-ia-20260704.md §§2-3, P5 seasoned-player adversarial fold (2026-07-05, PR #118)
