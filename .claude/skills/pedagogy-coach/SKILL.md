---
name: pedagogy-coach
description: Learning-design coach for the Music app - skill ladders, practice-loop design, spaced repetition, cognitive load, and when to teach vs when to get out of the way. Use BEFORE designing any tutor/drill/tip/guidance feature (TUTOR-ROADMAP, M-0 deterministic tutor, notables copy, guidance levels). Summoned per the SME dynamic-summoning rule.
---

# Pedagogy coach

Decide teaching behavior from learning science, not feature enthusiasm. The
app's teaching surface is DETERMINISTIC (M-0 vision: no-LLM drills on shipped
machinery), so every pedagogical rule here must compile to code.

## Core principles (each compiles to a mechanic)

- **One new thing at a time.** A drill or tip introduces exactly ONE unfamiliar
  element against an otherwise-mastered background (cognitive load). If a
  feature teaches two things, split it into a ladder.
- **Recall beats recognition.** Prompt the user to PRODUCE (finger the chord,
  name the degree) before showing the answer. A tip that only tells is the
  weakest form - prefer ask-then-reveal shapes.
- **Spacing beats massing.** Repetition schedules expand (1, 3, 7, 14 sessions);
  an item answered fast+right graduates, answered wrong resets. Store per-item
  ease additively (localStorage, backup.js additive rule).
- **Success within the first minute.** Every practice surface must let the
  CURRENT level user do something that sounds musical immediately - the
  first-session north star (a heard chord within 5 taps) outranks any lesson.
- **Teach at the moment of relevance, never in bulk.** The notables one-at-a-
  time slot is correct pedagogy: a tip fires when its subject is on screen,
  once, dismissible. Never stack lessons on a screen the user came to USE.
- **Levels gate DEPTH, not access.** A beginner can reach everything; the level
  controls how much prose/theory accompanies it (LEVELS table). Never lock a
  feature behind a level - lock only the explanation density.

## Decision table

| Designing... | Ask |
|---|---|
| A new tip/notable | What action is on screen right now? Does the tip name it? Recall-shaped? One idea? |
| A drill | What is the ONE new element? What is the mastered background? What graduates it? |
| A ladder (roadmap phase) | Can each rung be done with the previous rung's skill + one addition? |
| Guidance copy | Would the TARGET level user know every noun in this sentence? (beginner: no "dominant", no "mode") |
| Removing help | Is the user demonstrating mastery (fast correct actions), or just clicking past? Only the first earns silence. |

## Self-check

1. Does this teach ONE thing, at the moment it is relevant, in the target
   level's vocabulary?
2. Is there a produce-before-reveal shape available?
3. Does a beginner still get to make sound within the first minute?
4. Is mastery data stored additively (no schema break)?

## Related

- [ux-coach](../ux-coach/SKILL.md) - the moment-of-use lens this composes with
- [music-theory-coach](../music-theory-coach/SKILL.md) - WHAT is true; this skill owns how it is learned
- TUTOR-ROADMAP.md + docs/plans/vision-tutor-deterministic-20260705.md - the surfaces this governs
