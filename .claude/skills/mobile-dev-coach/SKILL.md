---
name: mobile-dev-coach
description: Coach for making the agent's recommended next-steps reliably right so Nik can respond with one digit (or nothing). Use before presenting a next-steps list, or before pausing for input, to decide (a) what belongs at position #1 - the keystroke Nik would actually type - and (b) whether to just DO the next reversible step autonomously instead of asking. The north star is `1 1 1 1` (or silent auto-continue): minimize Nik's typing on a phone. Candidate for global promotion.
---

# Mobile dev coach

Nik drives from a phone, often one-thumbed, often stepping away. Every question and
every mis-ranked #1 costs him a round-trip. This skill makes the agent's next-step
behavior earn the single-digit ideal: **`1 1 1 1` = mastered** (he hits 1/`y` and it's
always what he wanted), or better, the agent just continues and reports.

## Two decisions, every time

### 1. What goes at position #1 - predict the keystroke, don't list options

Position #1 is a **prediction of what Nik would type anyway**, not the "safest" or most
generic option. Get it right and he hits `1`/`y` and stays in flow; get it wrong and he
pays a correction round-trip (which is a signal to learn from, not a failure to hide).

- **Name the target.** `/git:review 107`, `go save-truth`, "build #1" - the exact, executable move, argument included. A #1 he can't act on with one digit isn't a #1.
- **Ground #2-N in observed state** - a failing check, a specific finding, an untracked file. Generic options that would apply to any repo on any day don't earn a slot; drop them.
- **Carry the ladder forward.** If he said "do A then B then C" and A is done, #1 is B (named), not "what's next?". He already told you.
- **One `**Recommended:** #N - <state-grounded why>`** when one option is clearly right - the *why* is what lets him override in one keystroke instead of asking.

### 2. Do it, or ask? - gate only on what Nik owns

Default to **doing the next reversible step autonomously** and reporting, rather than presenting it and waiting. Ask only when the decision is genuinely his.

| Just DO it (no ask, report after) | GATE (ask / present and wait) |
|---|---|
| Reversible local work: edit, test, render, fix, refactor, re-verify | **Vision / scope / priorities** - what to build, what's in/out |
| Push an unprotected branch, watch CI, fix red, re-push | **Merge / deploy** to the live site (Nik-only, always) |
| Routine ticket/PR plumbing: comment, capture a finding to the queue | **Destructive / irreversible** acts |
| Pick a reasonable implementation detail he can't judge (a color, a selector) | **Stakeholder-facing / external** comms |
| The next step of a ladder he already approved | A real fork where his taste/judgment changes the outcome |

If it's in the left column, doing-and-reporting beats asking-and-waiting - that IS "continue without me." If it's in the right column, a mis-fire is expensive, so present it (with a named recommendation so he answers in one digit).

## Reduce the response burden

- **Batch the reversible work**, then surface ONE decision - don't ask three times what you could do twice and ask once.
- **Pre-decide the details.** Never ask "which selector / which shade / which file" - pick the reasonable one, note it in one line, proceed. Only surface choices a human is the right person to make.
- **Permission to disengage.** When autonomous work is running (a build, CI, a render loop), say so in one sentence with scope ("nothing needs you while these finish") so he can put the phone down.
- **When you must gate, make the answer one digit.** A named `**Recommended:**` + a tight numbered list means `1` or `2`, never a paragraph.

## Anti-patterns (each one costs a round-trip)

- A generic #1 ("review the changes") when the specific move is obvious ("`/model-router:codex-review 198`").
- Asking permission for reversible work you could just do and report.
- A wall of prose where a numbered list + one recommendation would do.
- Re-asking a decision he already made ("do A then B") instead of advancing the ladder.
- Presenting 5 options when 2 are real and 3 are filler.

## Self-check before every next-steps list or pause

1. Is #1 the exact keystroke Nik would type - named, argumented, one-digit-executable?
2. Is anything in this list something I could just DO (reversible) and report instead of asking?
3. Am I gating ONLY on what he owns (vision/scope/merge/destructive/external)?
4. Could he answer everything here with a single digit?

## Related

- [ux-coach](../ux-coach/SKILL.md) / [music-theory-coach](../music-theory-coach/SKILL.md) - sibling coaching skills (this one coaches the agent's *own* next-step behavior)
- Global grounding this encodes for the mobile/remote HITL context: the operating contract (who decides vs who executes), single-digit interactive-framework navigation, self-serve autonomous streaks, and permission-to-disengage.
