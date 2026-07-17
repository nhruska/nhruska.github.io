---
name: usdd
description: User-Simulation-Driven Development - the TDD loop where the failing test is a PERSONA-run usage scenario. Use when building or changing any user-facing flow; write the persona scenario FIRST (red), build until it passes (green), keep it as a regression. Personas are deterministic app states (guidance levels seeded pre-load by test/pw/run-scenario.py's `persona` field), so simulated users are fully verifiable, not vibes. Candidate for global promotion after the music-app pilot.
---

# USDD - user-simulation-driven development

TDD where the unit under test is a USER COMPLETING A USE CASE, simulated
deterministically. A persona is not a narrative - it is an app state
(`music.guidanceLevel.v1` + the answered-ask notable, seeded before any script
runs), and the scenario runner drives the same taps a real user makes and
asserts what THAT user sees. Operator insight this encodes: "running scenarios
as the diff user personas, completing the use cases - it's all deterministic
and verifiable."

## The loop (red -> green -> regression)

1. **Goalpost -> scenario FIRST.** Take a UX goalpost (from
   [ux-friction-profiles](../../../docs/plans/ux-friction-profiles-20260710.md)
   or a UAT finding) and write the persona scenario that would PASS if the
   experience existed: `test/pw/scenarios/persona-<level>-<flow>.json` with a
   `"persona"` field and assertions on what that user must (or must NOT) see.
2. **Run it - it must FAIL** (red) for the right reason. A goalpost scenario
   that passes before the build means the goalpost is already met or the
   assertion is too weak - fix the assertion, not the ambition.
3. **Build until green.** Smallest change that makes the persona's experience
   real. Re-run ONLY the affected scenario per iteration (one-at-a-time OOM
   rule).
4. **Keep it.** The scenario stays in the suite forever - the persona now
   guards their own experience on every future change. Run the sibling
   personas' scenarios too: a beginner win must not regress the advanced view
   (the whynote pair is the canonical example).

## Personas = the guidance levels (deterministic)

| Persona | Seeded state | What diverges today (notables LEVELS) |
|---|---|---|
| `beginner` | level=beginner, ask answered | firstrun/tunefirst/savebasics tips; NO whynote/scaletip theory prose |
| `intermediate` | level=intermediate, ask answered | whynote, composeintro, transposetip |
| `advanced` | level=advanced, ask answered | whynote, scaletip |

Proven pair: `persona-beginner-studio.json` vs `persona-advanced-studio.json` -
same taps, opposite whynote assertions, both green. Extend persona state the
same way (seed more keys in the runner's `persona` block) as personas grow
richer (e.g. a returning user with a saved library).

## Rules

- Persona scenarios are DATA (JSON steps) - new verbs go in the runner, never
  imperative code in scenarios.
- Every new user-facing PR cites which persona scenarios ran (green) in its V&V.
- A UAT finding from the operator = a missing scenario. Encode the finding as
  the red scenario before fixing it (S-TESTSTEPS-EXECUTABLE lesson).
- Pixel evidence for merge gates: commit the goalpost screenshot to
  docs/artifacts/ when it backs a PR claim.

## Related

- [test/pw/README.md](../../../test/pw/README.md) - the runner + suite
- [ux-coach](../ux-coach/SKILL.md) / [music-theory-coach](../music-theory-coach/SKILL.md) - what the experience SHOULD be; USDD proves it IS
- [mobile-dev-coach](../mobile-dev-coach/SKILL.md) - the agent's own next-step behavior
