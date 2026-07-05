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

- **Storage:** `music.diagram.pref.v1` = 'dots' | 'patterns' (additive key; defensive read; default 'dots'). Owned by [shared/diagram-pref.js](../../shared/diagram-pref.js) (`window.DiagramPref` - `.get()`/`.set()`/`.labelFor()`), the ONE module that knows the key name and asks ShapeClassify for a label; `diagram.js` itself never reads the pref or calls ShapeClassify (see below).
- **Prerequisite (build step 0, P5 fold) - SHIPPED 2026-07-05:** [shared/shape-classify.js](../../shared/shape-classify.js) (`window.ShapeClassify`) - a SHAPE CLASSIFIER mapping a voicing to `{ family, rootString, inversion, barreFret }`. Curated, movable-template-aware, dependency-free (no circle.js coupling). Scope: `guitar-standard` (families `C`/`A`/`G`/`E`/`D` + `barre-E`/`barre-A`) and `ukulele-gcea` (families `C`/`D`/`A`/`F`/`G`/`E` + their `barre-*` variants, plus synthetic movable-only `C-shape`/`F-shape` reachable only via a derived/fallback voicing for a root absent from the named-chord table) - every other profile returns null/`[]` (honest "not classified," never a guess). `classify()` derives rootString/inversion from real pitch-class math (not hardcoded), which is why several ukulele voicings resolve to 1st/2nd/3rd inversion rather than root position - a genuine consequence of GCEA's re-entrant tuning, verified exhaustively in [test/shape-classify.test.js](../../../test/shape-classify.test.js).
  - **Quality coverage note (S-DIM-SHAPES, U21, 2026-07-05):** step 0 originally left dim/dim7/aug quality buckets uncurated (honest null) - the gap the operator hit as a card missing its shape label (chords-in-key vii° Bdim). Now curated for both profiles: `dim`/`dim7` share one symmetric movable voicing per profile (family `dim7-shape`, since the profiles' own "Xdim" entries are actually 4-note fully-diminished-seventh voicings, not 3-note triads); `aug` is the profile's own open-C-major shape with the 5th sharped one fret (family `C`, reused - genuinely the same open-position skeleton). Symmetric chords (dim7 in particular) have no single objective root, so inversion is reported relative to whichever chord NAME the caller asked about, not a claim about "the" root - see shape-classify.js's dim comment and the exhaustive per-root coverage in test/shape-classify.test.js. `aug` has no live chords-in-key anchor (none of the app's 7 supported modes ever produce an augmented triad), so it is curated defensively for Compose free-text entry / future modes.
- **Step 1 (Notables prompt) - SHIPPED 2026-07-06:** the exact prompt copy above renders as a two-button banner in the `'diagrampref'` Notables slot (priority: after `roman`, before `backup` - `notables.js` PRIORITY), triggered by a `music:diagram-rendered` CustomEvent that `diagram.js`'s `render()` dispatches every time an ACTUAL chord diagram draws (any tab, any screen) - so the prompt fires at "the first chord-diagram surface" without wiring anything into songbook.js/tracks.js/key-explorer.js. Eligibility also requires `firstrun` to already be dismissed (checked explicitly - Notables' priority arbitration alone doesn't guarantee the ordering, since `firstrun` could simply not be claiming the slot at that instant without yet having been shown+closed). Picking either option, or dismissing via the banner's own [x], is EQUALLY final under Notables' real one-shot semantics (`dismiss()` never re-offers) - the default stays `dots`; there is no "re-offer once more" behavior, since building one would mean inventing new semantics on top of the existing one-shot contract. A Settings row ("Fretboard diagrams", Dots/Patterns segmented control, mirroring the existing Theme control) also SHIPPED as the always-available setter.
- **Step 2 ('patterns' render) - SHIPPED 2026-07-06:** `diagram.js`'s `render()` gained an optional `opts.patternLabel` string (EXTEND-not-overlay, same contract as `scale()`'s `opts.tones`) - absent/falsy renders byte-identical to the pre-existing chord-diagram output (SHA-256-locked in `test/diagram.dom.test.js`); present, it appends the label as an escaped caption below the diagram. `shared/chord-pack-adapter.js`'s `buildAdapter` (the one choke point every chord diagram renders through) computes the label via `DiagramPref.labelFor(profile.id, name, frets)` and passes it through. **Deviation from this page's original phrasing:** the current chord-diagram renderer has never had per-string finger-number digits or root/degree tinting (those only exist on the separate solo-scale `Diagram.scale()` view, gated by its own `opts.tones`) - so "strip finger-number instruction chrome" and "keep... root/degree tinting" are both no-ops on the actual codebase; there was nothing to strip and nothing pre-existing to keep. The only concrete visual difference is additive: the classifier's label text. Per-string curated fingering-as-text (the fingering half of the original ask) has no data source anywhere in the app (no profile lists finger numbers) - deferred as a named follow-up, not built this wave.
- **Step 2b (U21 card-height parity) - SHIPPED 2026-07-05, M-EAR wave 1.6, decisions.md D-EAR-1.6:** in 'patterns' mode, an UNCLASSIFIABLE quality (shape-classify.js's honest null for dim/aug - "no template for this quality") produced a visibly SHORTER, misaligned card next to its classified row-mates (the Studio's "Chords in this key" row - operator screenshot, docs/plans/uat-walkthrough-20260704.md U21). Root cause: `render()`'s label div only ever rendered when `opts.patternLabel` was truthy - an unclassifiable voicing's `labelFor()` always resolves to `''`, same as plain 'dots' mode, so `render()` had no way to tell "dots mode, no label ever intended" from "patterns mode, but THIS card has no label" and never reserved the slot for the latter. Fix: `render()` gained `opts.reserveLabelSlot` (boolean) - when true, the label `<div>` renders (with `min-height:3.75em`, matched to shape-classify.js's typical 3-line label wrap at a small card's width) even when `patternLabel` is `''`, holding an EMPTY div rather than none at all. Absent/false (every pre-existing caller) is BYTE-IDENTICAL to the pre-U21 SHA-256 lock. `chord-pack-adapter.js`'s `buildAdapter` (the same one choke point) computes `reserveLabelSlot: DiagramPref.get() === 'patterns'` (reads the SAME pref `labelFor()` already reads - no new storage key) and passes it alongside `patternLabel` on all 3 `Diagram.render()` call sites (`diagram`/`diagramClosed`/`diagramChain`). Live-verified: a C-major-keyed Studio's 7 chords-in-key cards (incl. the vii° dim card) all render at the identical measured height in 'patterns' mode. Curating actual dim/aug/sus shape templates in shape-classify.js itself (so the dim card eventually gets a REAL label, not just an equal-height empty slot) is a separate, NOT-yet-built follow-up (S-DIM-SHAPES) - out of this fix's scope; the honest-null path stays honest, only the layout stopped collapsing. Tap-to-hear on an unclassified (dim) chord card was live-verified working correctly (no JS errors, the tap-feedback `.sel` flash fires normally) - `Circle.chordTones` already handles diminished quality; no fix was needed there.
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

**Anchors verified:** key-explorer.js:69-152 (posWindow, renderScale), diagram.js (render + sizes, opts.tones incl. ghostPcs/kx-ghost, opts.patternLabel + notifyRendered(), opts.reserveLabelSlot - U21), diagram-pref.js (music.diagram.pref.v1, labelFor()), chord-pack-adapter.js (reserveLabelSlot() - U21), tracks.js targetTones/defaultTones (M-GUIDE W3a, P5-amended), solo-guide.js (SoloGuide card/framing, P5-amended), docs/hsr-notes.md (shape families, HSR Lens - absorbed), notables.js (prompt infra + 'diagrampref' priority slot), goal spec P5 + operator omission verbatim, sprint A9 static-template discipline (pattern for any new copy), docs/plans/m-guide-ia-20260704.md §§2-3, docs/plans/uat-walkthrough-20260704.md U21, decisions.md D-EAR-1.6, P5 seasoned-player adversarial fold (2026-07-05, PR #118), [test/diagram.dom.test.js](../../../test/diagram.dom.test.js), [test/live-adapter.test.js](../../../test/live-adapter.test.js)
