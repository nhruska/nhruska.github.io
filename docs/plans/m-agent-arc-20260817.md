# M-AGENT Arc Record - Spec to Live Demo Loop in One Session (2026-08-17)

> Mission record + session save for the agent-interaction arc: spec (#331) ->
> wave 1 floor (#332, music-v332) -> wave 2 Studio re-home + plugin (#333,
> music-v333-2) -> wave 3 analytics + hardening (#334, music-v334). All merged
> to the live site the same session. This doc is the durable session memory
> (`.claude/sessions/` is gitignored - public repo rule); QUEUE.md carries the
> live state.

## What shipped (all live)

| PR | Version | Contents |
|---|---|---|
| [#331](https://github.com/nhruska/nhruska.github.io/pull/331) | docs | The contract: [goal-agent-interaction](goal-agent-interaction-20260817.md) - read/write seams, self-describing exports, deep-link setups, plugin packaging, L0-L3 degradation ladder |
| [#332](https://github.com/nhruska/nhruska.github.io/pull/332) | music-v332 | Floor: AGENTS.md bundled in the skills zip (`shared/agent-readme.js`), `music/agent/` manifest + consistency gate, agent round-trip test, first `?jam=` deep link (overlay v1) |
| [#333](https://github.com/nhruska/nhruska.github.io/pull/333) | music-v333-2 | Jam links open the REAL Studio (ephemeral track, `TracksModel.jamTrackFromSetup`); shared links survive a fresh device's welcome tour; `plugin/music-coach/` (4 skills, 3 commands, 2 agent profiles, sync gate); `music-setup/v1` import |
| [#334](https://github.com/nhruska/nhruska.github.io/pull/334) | music-v334 | `/music-coach:report` analytics artifact (skill + slot template + gate); SW cross-origin deadline fix; live-run eval fixes (`%23` rule + regression test, computable staleness, `last_evidence` = ISO, precedence rule); [sample artifact](../artifacts/music-report-sample-20260817.html) |

## The demo narrative (one line + the proof points)

**One musician's data, one contract, seven delivery shapes** ([pattern menu](agent-capability-patterns-20260817.md)):
the offline PWA is the floor; a tapped `?jam=` URL is a remote control from any
chat surface; the analytics report is an app rendered BY the agent as a single
file; the plugin makes any Claude Code / Cowork session the coach; everything
degrades to plain files. Proven live this session: an agent operating ONLY from
the shipped plugin files read a generated user export, produced an assessment,
practice plan, parser-verified jam links, and a provenance-stamped profile
hand-back - and its eval findings were fixed at source in the same wave.

## Method notes (what made the arc fast + safe)

- Cheap-tier worktree swarms per wave (2-3 Sonnet agents, locked seam
  contracts, no-push boundary, parent integrates + owns sw.js/cache bumps).
- Every wave render-verified with real pixels before shipping; two real bugs
  root-caused at the welcome-tour/NavHistory seam (param-dropping rewrite;
  layer-eaten-by-unwind), one env artifact correctly attributed (container
  proxy hang -> F-SW-XORIGIN-DEADLINE, fixed in wave 3, never band-aided).
- The live run doubled as an eval: its top finding (`#` truncation -> a VALID
  but WRONG jam) is the silent-corruption class - now regression-asserted so
  the bundled instructions can never drop the encoding rule.

## Open threads (queued, not in flight)

- Wave 4 candidates: marketplace manifest (install plugin by name), demo
  script writeup, `/music:report` alias decision.
- LONG: knowledge-sphere competency viewer; xAPI/LRS bridge (enterprise
  wedge); coach's-office live dashboard (P4); personal-skills second-brain
  graph (operator: separate session).
- Monetization/IP strategy: captured privately (ccp `notes/`, merged).

## Resume pointers

QUEUE.md SHORT S13-S19 all shipped-marked; MID M-AGENT row is the umbrella.
The spec + pattern menu + this record are the three docs a fresh session needs.
