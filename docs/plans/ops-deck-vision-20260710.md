# The Operator's Deck - Goal, Vision, Mission, Acceptance (2026-07-10)

> Operator spark (verbatim intent): "a true human in the loop operators environment that I
> can watch and control my agents. And see the queue grow when we plan and see items turning
> into PRs with full evidence reports... I provide ideas and direction and taste. you accept
> missions, interview me for shared vision, plan atomically, autonomous parallel execution,
> show live panels during execution, give reports and evidence on pull requests."
> Articulated jointly with Fable; this doc is the SSOT the deck co-evolves with.

## Vision (the one-paragraph why)

The compound-engineering system already feeds itself - spec -> red goalposts -> persona
scenarios -> swarm builds -> adversarial review -> evidence-bearing PRs -> friction back
into the spec. The Operator's Deck makes that loop OBSERVABLE and STEERABLE from one glass:
the operator watches missions execute play-by-play, sees queues grow as planning happens and
drain as PRs land, and spends attention ONLY at four decision surfaces (taste, planning
approval, design review, interview). Ideas in, taste out - everything else is throughput he
can watch but never has to supervise.

## Goal (this arc)

Ship Deck v1 on the infrastructure we already have (GitHub Pages, no build step), with the
EVENT LOG as the permanent contract and the transport swappable - so v2 (PS-internal Azure +
Postgres, SSE/websockets, multi-repo) upgrades the pipes without rewriting the glass.

## Mission statement (the standing operating loop this deck serves)

Operator provides ideas, direction, taste. The system: infers the mission (the word is
ceremony - see ccp interaction model), interviews to shared vision when spec confidence is
low (answering ANY ONE of N questions is a win; the rest become assumed answers), plans
atomically into the queue, executes in parallel with live panels, and delivers PRs whose
evidence (pixels, suites, audits) is the report. When taste can't resolve a question and it
is not worth operator attention: SME bench first, then a SPIKE row + deep research queued
for absence-time.

## Architecture (v1 real today -> v2 planned)

| Layer | v1 (GitHub Pages, TODAY) | v2 (PS Azure + Postgres) |
|---|---|---|
| Event contract | `docs/artifacts/ops/mission-events.jsonl` - append-only; one emitter call per milestone (`scripts/ops-emit.py`) | same schema -> events table |
| Transport | panel polls same-origin JSON (cache-busted, ~15s) - commits/pushes ARE the broadcast | SSE / websocket push |
| Glass | `docs/artifacts/ops/panel.html` - single-file, no build, phone-first, interactive | same panel, transport module swapped; auth via PS AAD |
| Queues | QUEUE.md (parsed live) + `ops/queues.json` (the 4 operator decision queues) | Postgres-backed, cross-project |
| PR evidence | GitHub REST (unauth, public repo) -> PR cards linking audit comments | GitHub App feed, multi-repo |

Event schema (the durable contract): `{ts, mission, type, title, detail?, agent?, url?}`
with `type` in `start|phase|build|test|red|green|pr|merge|review|report|friction|queue|idle`.

## Acceptance criteria (deterministic goalposts - each checkable, USDD-style)

| # | Goalpost | Check |
|---|---|---|
| A1 | ONE URL on the phone shows the current mission's play-by-play within ~30s of an emitted event | open panel; emit event + push; feed row appears on next poll |
| A2 | Queue view renders live from the repo's QUEUE.md - a newly queued row appears without touching the panel | queue a row, push, poll |
| A3 | PR cards show open PRs + recent merges with links to evidence/audit comments | panel PRs tab vs GitHub |
| A4 | Swarm view: parallel agents render as lanes keyed by the event `agent` field | emit 2 agents' events; 2 lanes |
| A5 | Any mission (any model tier) emits via ONE command per milestone | `python3 scripts/ops-emit.py <type> "<title>" [--push]` |
| A6 | Transport swap requires no glass rewrite | all fetches live in one `transport` object in panel.html |
| A7 | The 4 operator queues (taste-review, planning-approval, design-review, interview) exist as data + panel sections | `ops/queues.json` renders; items addressable by id |
| A8 | Interview contract: N questions queued, answering ANY subset unblocks, remainder -> assumed-answers table in the goal spec | encoded in ccp interaction model; interview queue holds the open sets |
| A9 | Mission-word inference: the operator never needs to type "mission" - directives are accepted as missions by default | ccp interaction model amendment |

v1 ships A1-A7 (A2/A3 functional, phone-verified); A8/A9 are config (ccp); v2 carries
auth, push transport, cross-project aggregation, and write-actions from the panel
(approve/redirect buttons -> command files the session polls - the control half of
"watch and control").

## v2 seeds (named, not built today)

- Panel WRITE path: tap approve/redirect on a queue item -> `ops/commands.jsonl` -> session
  polls + obeys (Pages-compatible control channel; Azure version does it over HTTP).
- Cross-project deck: one panel aggregating every Active Project's events/queues.
- Voice inlet: A13/telegram bursts -> `uat:` events -> the same feed.
- Postgres event store + retention + search; AAD-gated internal hosting.

## Related

- [ux-friction-profiles-20260710](ux-friction-profiles-20260710.md) - the goalpost board the deck displays
- [goal-clear-chessboard-20260710](goal-clear-chessboard-20260710.md) - the mission whose play-by-play seeds the first feed
- ccp HiTL Interaction Model + Execution-Ops Playbook - the operating loop this glass observes
- music/CLAUDE.md Command Center - the session-start sensing sweep this deck extends into live time
