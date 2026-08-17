---
description: Build an evidence-based practice plan from a Music-app profile, honoring the app's teaching style and any stated preferences
argument-hint: <path to the export folder, or a skill id to focus on>
---

Build a practice plan from: $ARGUMENTS

Read the export per the `music-interchange` skill (competency levels are
ground truth for what the user can already do - never assume less or more).
Apply `pedagogy-coach` for how to sequence it:

- One new element at a time, against an otherwise-mastered background.
- Recall-shaped (produce-before-reveal), not just recognition drills.
- Spacing over massing - if the export shows per-item ease/schedule data, plan
  around it; otherwise default to items due for review before brand-new ones.
- The plan must let the user sound musical within the first session, not just
  grind fundamentals.

Where a plan touches chord/scale choices or progression material, defer
correctness to `music-theory-coach` and proven-pattern choices to
`songwriting-coach` - do not invent theory content this coach bench already
owns.

Honor `preferences[]` from the profile doc (e.g. a stated instrument, a
disliked drill style, a genre lean) - state which preferences shaped the plan.

Output: a numbered plan (3-5 items) - each item names the ONE new thing, the
mastered background it builds on, and how it will be marked done. If a plan
item would work well as a jam-over-progression session, hand it to
`/music-coach:jam` rather than describing it in prose.
