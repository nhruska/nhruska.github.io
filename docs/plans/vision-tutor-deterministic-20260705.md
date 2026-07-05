# Vision Capture: Deterministic Adaptive Tutor (operator, 2026-07-05)

> **Operator verbatim-essence:** "Adaptive learning tutor coach mentor, progressive disclosure, beginner to intermediate and advanced. What deterministic learning/knowledge can we provide WITHOUT an LLM?"
> Connects: gh #84 (tutor vision), TUTOR-ROADMAP phases 4/5, the shipped expertise-adaptive seed (S-DIAGRAM-PREF), M-PERFORM/M-CONSTRUCT/M-PHRASE, and the app's proven no-LLM doctrine (every shipped feature is pc-math + curated content + classifiers + interpolated templates).

## The deterministic tutor inventory (no LLM at runtime - all buildable on existing machinery)

| Capability | Mechanism (deterministic) | Existing machinery |
|---|---|---|
| **Skill ladder + progressive disclosure** | Curated level model (beginner/intermediate/advanced) per concept; the SAME surfaces render level-appropriate depth (more scaffolding lines for beginners, terse for advanced) - curated variants, not generation | S-DIAGRAM-PREF pref pattern; cards/captions (A9); notables one-shots |
| **Journey/progress model** | Level inferred from OBSERVABLE local signals: features used, keys/modes explored, drills passed, songs saved - pure rules over data the app already has in localStorage | storage inventory + migration runner; deterministic unlock rules |
| **Ear training (the killer)** | sound.js GENERATES the questions: play an interval/mode/scale -> user picks -> answer checking = pc math. Mode-vs-mode A/B drills, interval recognition, "which degree moved" | sound.js + retarget (SHIPPED); the hum-orientation loop |
| **Pitch verification drills** | "Play F on string 4" -> the TUNER's pitch detection verifies (DSP, no LLM). Fretboard-knowledge drills with real-instrument feedback | tuner.js pitch detection (SHIPPED) |
| **Recognition drills** | Diagram -> name the chord; name -> pick the diagram; shape-family flashcards | shape-classify (SHIPPED); diagram render |
| **Progression construction checks** | "Build a 12-bar in A" -> degree-sequence comparison against the canonical form; "add the IV" -> palette-tap verification | Blues key model + PROGRESSIONS + chordInKey (SHIPPED) |
| **Spaced repetition** | SM-2-style scheduler (pure algorithm) over curated items: chord shapes, scale spellings, key signatures, relative pairs | localStorage + additive keys |
| **Point-of-need mentorship** | The shipped continuum pattern: curated prose + concrete-instance interpolation (D-REL-NAMES), surfaced by context triggers | cards, framing, notables, rel-names (ALL SHIPPED) |
| **Practice tracking/streaks** | Counters + deterministic goals (LONG item, now tutor-integrated) | local data |

## The honest LLM boundary (what deterministic CANNOT do)

Free-form Q&A, personalized feedback on playing beyond pitch/timing, coaching on arbitrary user songs not in curated data. These stay OUT of scope (or become a clearly-separated future opt-in) - the tutor's credibility rides on the same rock-solid determinism as the theory engine.

## Routing

Folds INTO the Tier-2 sitting as the tutor centerpiece: merges gh #84 + TUTOR-ROADMAP P4/P5 + M-CONSTRUCT/M-PHRASE into ONE coherent tutor architecture interview (level model, first drill set, curation scope). Nothing builds before that sitting - this is the vision floor for it.
