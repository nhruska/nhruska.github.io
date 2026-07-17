# Personas

[Wiki](../index.md) > ux-philosophy > Personas

## Purpose

Five archetypes anchoring UX decisions. Each brings distinct needs, dismissal triggers, and a primary journey. Archetypes only - no real people (public repo).

## Shared context (every persona, every journey)

- **Grip:** instrument in hands or lap; phone propped or held one-handed; one free thumb does all navigation; arm's-length glances mid-playing.
- **Consequence intolerance:** a mis-tap must never delete or edit anything. Clumsy taps are NORMAL, not edge cases.
- **Trust chain:** the app is a theory authority. One spelling error or wrong scale note = dismissed forever as a toy.

## P1 - The Aspiring Pro

- **Who:** gigging weekly, building toward full-time music. Phone-fluent power user.
- **JTBD:** assemble tonight's set fast; glance key/capo mid-set; rely on it ON STAGE.
- **Sweet spot:** Library/Set, perform view, the future merged repertoire (M3).
- **Dismissal triggers:** slow flows, ANY lost set/song data, stage-moment surprises, toy aesthetics.
- **Audits:** J4 setlist prep; perform legibility at arm's length; destructive-tap inventory in Set flows; saved-state confidence.

## P2 - The Conservatory Pianist

- **Who:** years of formal theory; reads notation; fluent piano; fretboard geometry is NEW. The most credibility-sensitive persona.
- **JTBD:** map known theory onto the fretboard; verify the app agrees; learn shapes without dumbing down.
- **Sweet spot:** Compose in-key palette, key/mode picker, Studio scale display, Triads & Inversions.
- **Dismissal triggers:** wrong enharmonic spelling for the key context, wrong roman case/quality, mislabeled modes. One error = gone.
- **Audits:** deterministic theory audit (12 roots x 4 modes); flat-key spelling friction (FORK-4 vs convention [TRACKS-#98]); mode vocabulary accuracy.

## P3 - The First-Timer

- **Who:** no theory, no chords yet; installs casually, expects consumer-grade onboarding.
- **JTBD:** "what do I do first?"; learn 3 chords; feel progress in week 1 without breaking anything.
- **Sweet spot:** first-run cues, Library easy songs, Tune tab, chord diagrams.
- **Dismissal triggers:** jargon walls (Mixolydian on day 1), no obvious start, fear ("did I break it?"), silent failures.
- **Audits:** J1 cold-start (decisions/jargon before first success); one-shot guidance; destructive reachability from innocent exploration; Tune approachability.

## P4 - The Shape-Fluent Improver

- **Who:** open chords + neck shapes internalized; wants scales/modes/keys mastery; the tutor north-star user (solo-practice loop).
- **JTBD:** compose in a key/mode -> solo over it with scale guidance -> understand WHY - just-in-time, at the point of need.
- **Sweet spot:** Compose -> Solo-over-backing-track -> Studio loop; mode re-harmonization; scale positions up the neck.
- **Dismissal triggers:** friction in the core loop, "what" without JIT "why", shallow scale guidance.
- **Audits:** J3 compose loop end-to-end; progression-loss vectors; JIT "why" affordances; one-handed scale walk.

## P5 - The Seasoned Guitarist

**Operator-specified.** 20+ years playing; dismisses beginner-splained anything.

- **Who:** decades of neck familiarity; moves by feel, shape families (CAGED-adjacent), position playing; muscle memory is how learning happens.
- **JTBD:** transfer existing patterns + theory to this key/mode/instrument; see the shape families that move across the neck (hammer/slide/rotate chains); work inversions; grab pentatonic/blues boxes instantly.
- **Sweet spot:** key/mode picker, Studio scale positions + patterns, chord shapes + inversions, pentatonic/blues solo chips, harmony-teacher backing tracks.
- **Dismissal triggers:** beginner-splained explanations; dots-and-instructions instead of patterns; chords without hand-placement context; theory that never grounds in muscle memory; positions without inversions.
- **Audits:** blues/pentatonic usefulness (movable patterns, not isolated diagrams); hand-position/fingering co-located with diagrams; [expertise-adaptive-display](expertise-adaptive-display.md) honesty; S-DIAGRAM-PREF scope.

Evidence: mission goal spec P5 definition; [hsr-notes stub](../../../docs/hsr-notes.md) (HGT/HSR shape families, absorbed into [systems/instrument-profiles.md](../systems/instrument-profiles.md)).

## Journey x persona matrix

| Journey | Steps | Primary | Audits |
|---|---|---|---|
| J1 Cold start | fresh profile -> Library -> open song -> sheet | P3 | jargon count, decision count, JIT gaps, destructive reachability |
| J2 Tune | Tune tab -> tune strings -> back | P3, P1 | one-hand reach, glanceability, exit clarity |
| J3 Compose loop | key+mode -> build -> Solo CTA -> Studio -> scale walk | P4, P2, P5 | tap count, thumb-zone, loss vectors, theory spot-checks |
| J4 Setlist prep | search -> add 3 -> reorder -> perform | P1 | destructive inventory, saved-state confidence, legibility |
| T Theory audit | Node: 12 roots x modes/scales | P2, P5 | deterministic pass/fail; pattern usefulness |

## Dismissal triggers (distilled)

| Persona | Fatal trigger | Why |
|---|---|---|
| P1 | lost data, stage surprises | data is the working set; stage speed sacred |
| P2 | one spelling/quality error | theory authority; one error = toy forever |
| P3 | jargon walls, no start, fear | casual consumer expectations |
| P4 | core-loop friction, no "why" | the loop IS the product |
| P5 | beginner-splaining, dots-over-patterns | expertise recognized = respect earned |

---

**Anchors verified:** docs/plans/ux-personas-20260703.md (P1-P4 + matrix + shared context), mission goal spec (P5), docs/plans/ux-findings-20260703.md (audit definitions), docs/hsr-notes.md
