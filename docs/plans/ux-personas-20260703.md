# UX Personas - Round 1: Nik's Musician Friends (2026-07-03)

> Phase-1 artifact of the [ux-persona mission](goal-ux-persona-mission-20260703.md).
> Real-user-anchored personas driving simulated testing, council planning, and the
> sprint plan. First round = Nik's musician friends, per operator interview.

## Shared context (every persona, every journey)

- **Grip:** instrument in hands or on lap; phone propped or held in one hand; **one free thumb** does all navigation; arm's-length glances mid-playing.
- **Consequence intolerance:** a mis-tap must never delete or edit anything. Clumsy taps are NORMAL here, not edge cases.
- **Trust chain:** the app is a *theory authority*. One wrong chord spelling or scale note and the skilled personas dismiss it permanently ("toy").
- **Prior coverage (dedupe):** the 2026-06-30 HF council + codex pass already fixed Library list legibility/targets/edit-set-mode ([UX-FRICTION-LOG](../../music/docs/UX-FRICTION-LOG.md)). M3 songs/tracks merge is approved-but-unbuilt. This round targets the UNCOVERED surfaces: Compose, Tune, Studio, first-run, theory credibility, JIT guidance - and treats M3 as backdrop (no sprint item may collide with the merge).

## P1 - The Aspiring Pro ("headed full-time")

- **Who:** gigging weekly, building toward music as the job. Phone-fluent power user.
- **JTBD:** assemble tonight's set fast; glance key/capo mid-set; rely on it ON STAGE.
- **Sweet spot in app:** Library/Set, perform view, (future M3 merged repertoire).
- **Dismissal triggers:** slow flows, ANY lost set/song data, stage-moment surprises (wrong key shown, screen sleep, mis-tap chaos), toy aesthetics.
- **Probes:** J4 setlist-prep journey; perform-mode legibility at arm's length; destructive-tap inventory in Set flows; data-persistence confidence (what says "saved"?).

## P2 - The Conservatory Pianist ("classically trained, new to the neck")

- **Who:** years of formal theory; reads notation; fluent on piano; guitar/uke geometry is NEW. The most credibility-sensitive persona.
- **JTBD:** map known theory onto the fretboard; verify the app agrees with the theory they already know; learn shapes without dumbing down.
- **Sweet spot:** Compose in-key palette, key/mode picker, Studio scale display, Triads & Inversions.
- **Dismissal triggers:** wrong enharmonic spelling for the key context (F major showing A# where every score they've read says Bb), wrong roman-numeral case/quality, mislabeled modes. **One error = app dismissed.**
- **Probes:** deterministic theory audit across 12 roots x 4 modes (spelling, diatonic sets, roman labels); flat-key spelling friction specifically (the canonical-sharp FORK-4 decision vs conservatory convention -> candidate: user-facing spelling SETTING with one-time prompt); mode vocabulary accuracy.

## P3 - The First-Timer ("just bought a guitar")

- **Who:** no theory, no chords yet; installs apps casually, expects consumer-grade onboarding.
- **JTBD:** "what do I do first?"; learn 3 chords; feel progress in week 1 without breaking anything.
- **Sweet spot:** first-run experience, Library easy songs, Tune tab, chord diagrams.
- **Dismissal triggers:** jargon walls (Mixolydian in their face on day 1), no obvious starting point, fear ("did I just mess something up?"), silent failure states.
- **Probes:** J1 cold-start journey (first launch -> playing something) - count the decisions/jargon exposures before first success; one-shot dismissible guidance opportunities; are destructive paths reachable from innocent exploration; Tune tab approachability (J2).

## P4 - The Shape-Fluent Improver ("Nik-like")

- **Who:** all the open chords + neck shapes internalized; wants scales/modes/keys mastery; the tutor north-star user (solo-practice loop).
- **JTBD:** compose a progression in a key/mode -> solo over it with scale guidance -> understand WHY it works - just-in-time, at the point of need.
- **Sweet spot:** Compose -> Solo-over-backing-track -> Studio loop; mode re-harmonization; scale positions up the neck.
- **Dismissal triggers:** friction inside the core loop (extra taps, lost progression on a mis-tap), theory that stops at "what" without the JIT "why", shallow scale guidance.
- **Probes:** J3 compose-loop journey end-to-end (taps counted, thumb-zone mapped); progression-loss vectors (Clear button, key-transpose surprises); JIT "why" affordances (where would a one-shot notable teach the moment?); Studio scale-walk reachability one-handed.

## Journey x persona test matrix (phase 2)

| Journey | Steps | Primary persona | Audits applied |
|---|---|---|---|
| J1 Cold start -> first song | fresh localStorage -> Library -> open song -> chord sheet | P3 | jargon count, decision count, JIT gaps, destructive reachability, console errors |
| J2 Tune up | Tune tab -> tune 6 strings (sim) -> back | P3, P1 | one-hand reach, glanceability, exit clarity |
| J3 Compose loop | Compose -> key E Mixo -> build 4-chord progression -> Solo CTA -> Studio -> scale walk | P4, P2 | tap count, thumb-zone map, loss vectors, theory spot-checks, JIT gaps |
| J4 Setlist prep | Library -> search -> add 3 to Set -> reorder -> perform view | P1 | destructive-tap inventory, saved-state confidence, arm's-length legibility |
| T Theory audit (no browser) | Node: 12 roots x 4 modes - spelling, diatonic sets, roman labels, suggestions in-key | P2 | deterministic pass/fail vs music theory ground truth; flat-key convention deltas cataloged |

**Audit definitions:**
- **Thumb-zone map:** interactive-element geometry classified by one-hand reach (bottom-third = easy, middle = ok, top-third = stretch) + scroll-rail-edge hazard (per prior codex insight).
- **Destructive-tap inventory:** every element that deletes/mutates user work, with its guard status (none / confirm / edit-mode / undo / movement-cancel).
- **JIT gaps:** moments a persona needs a concept exactly then, with no in-context affordance (candidate one-shot notables).
- **Theory ground truth:** conservatory-standard expectations; deviations classified BUG (wrong pitch-class/quality) vs CONVENTION (canonical-sharp spelling where traditional is flat) - conventions feed the settings-with-prompt candidate, bugs are P0.
