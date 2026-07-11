# Cockpit Tactical UI - Vision Synthesis (2026-07-11)

> Operator directive (final-push burst, 2026-07-11): take the tactical command-portal
> inspiration, keep the PS brand and the Cockpit name, replace the map, explore 3
> angles, desktop AND mobile (mobile is the true test), and land the whole day's
> dreaming - fractal granularity, portfolio view, compounded skills, competency
> profiles, department onboarding - as an articulated vision plus pixels.

## 1. The dream, distilled

The Cockpit is a **fractal command surface**. One pane of glass at portfolio level
where nothing on screen is raw data - every element is a decision-ready signal that
rolls up from the layer below and drills down on tap. The military mockup's lesson
is not the map: it is that a commander never reads logs. They read POSTURE
(operational / degraded), THREAT (a 1-5 level, not a list), and TASKING (what needs
me now). Our engineering equivalent already exists in fragments - QUEUE boards,
mission events, PR states, CI runs, ce-wins, competency evidence from the music
app. The Cockpit composes them.

## 1.5 Core tenet: one environment, zero context switching (operator burst, folded in live)

The operator stays IN the Cockpit to act, not just to look. Every signal that
asks for input carries its action inline (tap/digit/burst/interview), and every
action can DISPATCH REAL WORK: the glass fronts an agent-execution backplane
(Claude Agent SDK or equivalent) running with the operator's full primitive
stack loaded - the claude-config skills/commands/rules/protocols, the coach
bench, the CE loops. Peeling a queue item from the phone launches the same
execution a terminal session would, with the same standing delegations and
evidence gates. The Cockpit is where skills are GATHERED and COMPOUNDED in
continuous-improvement loops - observability and operation are one surface.

## 2. The granularity ladder (the "right level" question, answered)

```
org
 +- department            (Engineering, Compound Ops, R&D, ...)
     +- portfolio          <- THE COCKPIT'S DEFAULT ALTITUDE
         +- project        (a repo, or several: monorepo/product)
             +- mission    (an operator directive with a goal spec)
                 +- swarm  (parallel lanes executing one mission)
                     +- plan / PR
                         +- task
```

Rules that keep cognitive load flat at every altitude:

- **One altitude per screen.** A screen shows its level's entities plus ONE
  roll-up summary of each child. Never two levels of detail at once.
- **Tap = descend one level. Back = ascend.** The ladder is the navigation.
- **Every tile answers three questions** (the operator signal contract, see the
  friction profile): What needs me? What is running? What shipped?
- **Roll-up algebra:** status = worst-of(children status) with a momentum
  modifier (rate of green events last 24h); attention = sum of operator-gated
  queue items below this node; wins = count of merged/shipped below this node.
  Deterministic, computable in SQL, no LLM in the read path.

A sprint is a mission; a feature is a plan-node under it; several PRs roll into a
feature; features roll into the mission's progress bar; missions roll into the
project tile; projects into the portfolio posture. Same math at every rung -
that is what "fractal" buys: ONE renderer, ONE schema, every altitude.

## 3. Why v2 leaves the single-file artifact

v1 (the shipped Cockpit panel) polls three JSON files on GitHub Pages. Honest,
zero-infra, but bounded by (a) GitHub-only facts, (b) append-only log commits as
transport, (c) no cross-repo joins, (d) no write path from the glass.

**v2 architecture (Python + Postgres, the environment the operator has ready):**

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI (async) | SSE streaming + JSON, tiny, typed |
| Store | Postgres | entities + events + rollups; LISTEN/NOTIFY feeds SSE |
| Live | SSE (`/stream`) | one-way push to the glass; polling fallback |
| Ingest | adapters, all writing ONE event shape | GitHub webhook (PRs/CI/pushes), ops-emit HTTP mode (replaces log-commit transport), music-app competency events, Jira later |
| Write path | `/act` endpoint | peeling a queue item IS a tap on the glass (v1's missing half) |
| Execution | agent backplane: Claude Agent SDK sessions (or headless claude -p) spawned server-side with the operator's primitive stack (claude-config clone) mounted | a Cockpit action = a real mission dispatch with standing delegations + evidence gates; results stream back as events - no context switch to a terminal |
| Auth | single-operator token now; dept roles later | portfolio glass is personal first |

**Schema spine (4 tables carry the whole fractal):**

```sql
entity  (id, kind, parent_id, name, meta jsonb)          -- the ladder itself
event   (id, entity_id, ts, type, title, detail jsonb)   -- ops-emit shape, superset
rollup  (entity_id, status, attention, momentum, wins,
         computed_at)                                     -- materialized, trigger-refreshed
queue_item (id, entity_id, priority, form, ask, state)   -- the operator stream
```

`ops-emit.py` gains an HTTP mode (`--post $COCKPIT_URL`) with the SAME event
shape - v1 and v2 coexist during migration; the panel keeps working.

## 4. The skills epiphany: competency is the same fractal

Any skill can be compounded: stringed-musician + composition + lyricist working
with a tutor/coach/mentor SME of the same discipline, against an expert-model
competency profile. Structurally that is the ladder again:

```
learner profile (the operator)
 +- discipline           (music, engineering, ...)
     +- skill             (chords, strumming, theory, composition, lyrics)
         +- evidence      (events: drills passed, songs built, scenarios green)
```

- **Evidence events** are ordinary Cockpit events (`type: competency`,
  entity = the skill node). The music app becomes the first emitter: a
  completed drill, a saved progression in a new key, a tutor level-up.
- **SME coaches bind to skill nodes**: the coach that teaches it is the coach
  that assesses it (music-theory-coach scores theory evidence; pedagogy-coach
  owns the ladder shape). Expert-model profile = the target vector per skill.
- **The Cockpit renders it as an instrument**: a competency radar/gauge on the
  operator's own tile - the same drill-down grammar (profile -> discipline ->
  skill -> evidence timeline).

## 5. Department onboarding = the same machinery pointed at people

Standing up a new department from current state:

1. **Encode**: sme-coach skills capture the domain's judgment (the self-growing
   bench pattern already proven on the music app).
2. **Template**: the department's recurring artifacts become templates +
   primitives (first-occurrence codification).
3. **Automate**: steps that repeat become missions with standing delegations
   and evidence gates.
4. **AAR**: every arc ends in an after-action review event; friction becomes a
   rule or a coach amendment (compound engineering's loop, department-scale).

A department tile in the Cockpit is born the moment its entity row exists; its
posture rolls up from day one because the algebra is level-agnostic.

## 5.5 The capability inventory IS the ingest map (operator burst, folded in live)

The signal the operator called out: the primitives already in service define what
the Cockpit consumes, renders, and dispatches. No new report formats - the glass
composes what the compound-engineering repo already produces. The claude-config
repo is the PRIMARY EXECUTION SERVICE: the Cockpit environment loads that same
stack, so capability on the glass equals capability in a Claude Code / Codex
terminal.

| Existing primitive / artifact | Cockpit role |
|---|---|
| Session summaries + conversation history (conversation-browser, conversation-search, session:save) | ENTITY: sessions are first-class ladder nodes under a project; the operator's own history browses as a drill-down leaf and feeds "what was decided" recall |
| Sprint reports (sprint-report skill) | ROLL-UP RENDERER: a sprint report is a mission-level roll-up snapshot; the Cockpit generates it FROM the store instead of re-mining GitHub |
| HITL PR reports (pr-volley hitl-report), adversarial audit comments | DRILL LEAF at PR altitude: the evidence trail behind every merged strip |
| Playwright QA reports (ui-qa), pw-replay scenario evidence | DETERMINISTIC GOALPOSTS: green/red events per entity; the render-proof images are the leaf artifacts |
| Jira (atlassian-cli), GitHub issues | INGEST ADAPTERS: external work items map onto mission/task nodes |
| Engineering/product wikis (wiki-source-of-truth) | KNOWLEDGE LAYER: the SSOT project documentation, MANAGED BY THE SYSTEM ITSELF - agents co-evolve wiki pages in the same PRs (already the rule); the Cockpit links every entity to its wiki page and flags drift |
| ce-wins, learnings log, CONTINUOUS-IMPROVEMENT entries | WINS + COMPOUND FEED: the shipped/learned tickers and the CE-loop instrument |
| Competency evidence (music app, coach assessments) | LEARNER-PROFILE ENTITIES (section 4) |
| Notifications: telegram, email-me, gws, Slack bridge | OUTPUT ADAPTERS: the queue's REQUIRED/SOON/INFO pings fan out per the existing surface conventions; the Cockpit is the durable surface the pings deep-link back into |
| Skills/commands/rules/protocols (the primitive stack) | THE EXECUTION BACKPLANE (section 1.5): dispatch from the glass runs the same primitives with the same delegations |

Corollary: v2's ingest adapters are thin because every source above already has
a machine shape (JSON payloads, JSONL events, markdown with frontmatter, gh/jira
APIs). The store normalizes them into the ONE event shape; the ladder gives them
a home; the roll-up algebra does the rest.

## 6. The three angles (what each explores)

The map's replacement is THE design question: what does the operator navigate by?

| Angle | Centerpiece | Bet it tests |
|---|---|---|
| **A - INSTRUMENTS** ("flight deck") | Gauge cluster: ops tempo, attention load, autonomy ratio, blocker level, CI health, competency radar | You navigate by DERIVED STATE - posture at a glance, numbers only when armed |
| **B - TEMPO** ("flight strips") | Time. Swimlane timeline per project, NOW line, gates ahead of now | You navigate by WHEN - momentum and upcoming gates are the signal |
| **C - SIGNAL** ("queue-first CIC") | Your merged queue as tasking cards + fractal roll-up tiles | You navigate by WHAT NEEDS YOU - the stream is the surface (v1's thesis, matured) |

All three: PS brand (badge, palette, mono-label tactical grammar), Cockpit name,
top posture bar, activity ticker, portfolio altitude by default, drill-down per
the ladder. **Mobile (412px) is the acceptance surface**: roll-ups collapse to
snap-scroll strips and stat tiles; every screen keeps the three-question
contract above the fold; any PR reachable in <= 3 taps.

The pick between them is a taste call - the operator's seat. The mockups exist
so the pick happens on pixels, not prose. (They can also compose: A's gauges as
C's header strip, B's timeline as a drawer. Angles are vocabulary, not walls.)

## 7. SDD harness (I am the user)

The operator friction profile
([operator-friction-profile-20260711.md](operator-friction-profile-20260711.md))
is the persona. Each angle ships with a phone-viewport scenario asserting the
signal contract mechanically: boots clean (zero console errors), needs-me count
above the fold, drill-down reaches mission detail within the tap budget. Taste
cannot be simulated - but the contract can, so taste is the ONLY thing left for
the operator to judge.

## 8. Delivery path

1. **Tonight**: 3 mockup angles under docs/artifacts/cockpit-v2/ + this doc +
   the friction profile + scenarios. Operator picks (or remixes) an angle.
2. **v2 LZ** (next arc, on the keyword): FastAPI + Postgres skeleton, entity +
   event tables, ops-emit HTTP mode, ONE live tile fed by real events - the
   chosen angle's shell rendered from the real store.
3. **Adapters**: GitHub webhook ingest; music-app competency events; the
   write-path `/act` for queue peeling.
4. **Departments**: second entity subtree + the onboarding playbook run once
   for real.
