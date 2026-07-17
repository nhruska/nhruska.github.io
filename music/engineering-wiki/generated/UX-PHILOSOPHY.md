<!-- GENERATED from music/engineering-wiki/: ux-philosophy/design-principles.md, ux-philosophy/personas.md, ux-philosophy/interaction-safety.md, ux-philosophy/expertise-adaptive-display.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# UX Philosophy

Why the app feels the way it does: the constraints, the people it's built for, the guard rails around destructive actions, and how it adapts to a player's experience level.

## The operating constraints

**One screen, above the fold.** The app never forces a scroll to reach the primary action on a phone (Pixel-10 viewport: 412x915). When UI would push the main task below the fold, reclaim space instead of inflating the screen - both portrait and landscape get a layout that fills the viewport without waste.

**Instrument-in-hands grip model.** The user is holding an instrument. One free thumb does all navigation; glances happen arm's-length, mid-playing. This is not "sitting at a laptop with both hands free."

- One-hand targets: 44px minimum hit area.
- Thumb-zone geometry: bottom third = easy reach, middle = OK, top third = stretch. Destructive controls in the stretch zone are inherently at-risk.
- **Scroll-rail safety:** the hot right edge, where the thumb scrolls and stabilizes the phone, is the MOST dangerous place for an always-hot control - it fires on scroll-grab, not intent.
- **Consequence intolerance:** a mis-tap must never delete or edit anything. Accidental taps are normal here, not edge cases.

**Theory-authority trust chain.** The app is a theory authority. One wrong chord spelling or scale note and a skilled player dismisses it permanently as a toy. The credibility rests on one unbroken chain: pitch-class core -> spelling-as-display -> fretboard agreement. Progression chips, the Compose palette, and the Studio solo scales must all agree - a player learning "Bb" on one screen and "A#" on another has left the app. (Spelling contract: [THEORY.md](THEORY.md).)

**Soul + anti-vision.** This is a harmony teacher, not a jukebox. The Studio backing-track finder is the daily-habit hook; the teaching is the point. Design against: bloat (one surface, one view toggle, never a dashboard), losing stage speed (the curated library is local; the only online dependency - YouTube playback - sits behind an explicit tap and degrades gracefully offline), and turning practice into a live search (judging tracks happens off-stage, calmly, once).

**Functional naming.** Every control is named by what it does, not by product branding. A library row reads "Video" (curated, in-app) vs "Search" (external, leaves the app) - named by consequence.

## Who it's for

Five archetypes anchor every UX decision. All of them share the grip model, consequence intolerance, and the trust chain above.

| Persona | Who | Job to be done | Fatal dismissal trigger |
|---|---|---|---|
| **P1** The Aspiring Pro | Gigging weekly, phone-fluent | Assemble tonight's set fast; rely on it on stage | Slow flows, any lost set/song data, stage surprises |
| **P2** The Conservatory Pianist | Formal theory, fretboard geometry is new | Map known theory onto the fretboard; verify the app agrees | Wrong enharmonic spelling, wrong roman case, mislabeled modes |
| **P3** The First-Timer | No theory, casual consumer expectations | "What do I do first?"; learn 3 chords in week 1 | Jargon walls, no obvious start, fear of breaking something |
| **P4** The Shape-Fluent Improver | Chords + shapes internalized, wants mastery | Compose in a key -> solo over it -> understand why | Core-loop friction, no just-in-time "why" |
| **P5** The Seasoned Guitarist | 20+ years, moves by feel and shape families | Transfer existing patterns to this key/instrument | Beginner-splained explanations, dots instead of patterns |

P2 and P5 are the most credibility-sensitive: one theory error and either persona is gone for good. Full journey-matrix and audit definitions: the wiki's [personas.md](../ux-philosophy/personas.md).

## Guarding destructive actions

Every element that deletes, mutates, or loses user work lives behind at least one guard, strongest to weakest:

1. **Confirm (modal)** - high-stakes whole-collection acts (e.g. setlist clear).
2. **Edit mode** - destructive controls hidden at rest, revealed behind an explicit toggle (Set reorder/remove).
3. **Persistent undo banner** - prior state held in memory until any mutating action invalidates it; never a timed toast (Set item remove, Compose Clear).
4. **Movement-cancel (wireTap)** - a tap fires only if the touch didn't move past a threshold, killing scroll-grab accidents.
5. **Sizing (44px floor)** - compounds with movement-cancel; not a guard alone.

**Scroll-rail rule:** the right-edge scroll rail is the single most dangerous home for an always-hot action - it MUST be movement-cancelled and/or mode-gated.

**Undo contract:** a full pre-Clear snapshot (progression, transpose, key); any mutating action invalidates it; lifetime is route-local, in-memory, session-only (dies on tab-switch/reload); the banner persists until invalidated, never on a timer.

**Notables - one-shot dismissible guidance:** a single-slot system for once-ever hints, keyed by consumer id, strict-priority arbitration (first-run beats a mid-session "why" hint beats a roman-numeral hint), rendered at most once per tick, with a >=44px dismiss that persists forever.

Before shipping, every new destructive control gets enumerated, guard-classified, thumb-zone-mapped, and verified at 412x915.

## Adapting to expertise: dots vs. patterns

Different players read a fretboard differently. A finger-dot diagram teaches a beginner "put this finger here" - and becomes a crutch that silences pattern recognition for a seasoned player. P5 navigates by hand position, shape families (CAGED-adjacent), inversions, and movement vocabulary (hammer/slide/rotate between shapes up the neck) - a diagram covered in dots is noise; the clean pattern plus hand position is the guide. P3, without muscle memory yet, needs the dots to start.

The Studio's scale view already renders position windows (how far a hand naturally slides in one move) with note names - the pattern is already the guide. What's queued (not yet built) is a one-time setting, **S-DIAGRAM-PREF**, letting a player pick "dots and finger numbers" vs "clean patterns with hand position" for CHORD diagrams specifically. It changes styling only - never which chords/scales/theory show, and the solo scale view (already pattern-first) is unaffected. Full spec: the wiki's [expertise-adaptive-display.md](../ux-philosophy/expertise-adaptive-display.md).

Where a diagram appears in a teaching context, it's co-located with the roman numeral (function), inversion label (hand shape), and key context - so the beginner reads the dots and the seasoned player reads the shape, in the same view.

## Related generated docs

[THEORY.md](THEORY.md) - the trust-chain contract this page references. [ROADMAP.md](ROADMAP.md) - where S-DIAGRAM-PREF and other UX backlog items sit. [DECISIONS.md](DECISIONS.md) - GRIP, RAIL, JIT, and SOLO-BOUNDARY as ruled decisions.
