# Org Cockpit - Zoom-Ladder Vision Capture (2026-07-10)

> Operator brainstorm (verbatim core): "solving one problem and applying that pattern in
> domains that encapsulate that... swarm panel -> mission control -> repository control ->
> projects -> engineering control -> organization control... we could zoom out again -
> vertical, industry, markets, economy... we went from trying to learn some chords on the
> ukulele to world domination. I need to articulate this and see what is worth the squeeze.
> I have a feeling it is focused on the cockpit for now. probably up to my organization
> that I can run as a single operator human in the loop."

## The articulation (settled with Fable, 2026-07-10)

**The loop is scale-free.** Queue -> attempt -> deterministic-as-possible verification ->
friction encoded -> better attempt is the same primitive at every altitude, which is why
the panels kept composing: swarm lanes, mission feed, repo board, engineering deck are one
event contract with a different `mission`/`repo` field. The zoom ladder is real because
the primitive is fractal - not because each level needs new machinery.

**The cockpit ends where the actuators end.** A cockpit = observability + CONTROL. Up
through the operator's organization, every level has actuators he owns: emit an event,
fire a mission, merge a PR, re-rank a department's queue. At vertical / industry / market /
economy altitude there are no actuators - only telescopes. Panels there are market-research
dashboards (a legitimate, different product), not cockpits. Zooming past the org trades a
cockpit for a planetarium.

**Worth the squeeze: the single-operator ORGANIZATION cockpit.** One human in the loop,
running Problem Solutions as departments-as-lanes:

| Deck concept (shipped) | Org-cockpit generalization |
|---|---|
| Swarm agents as lanes | Departments / workstreams as lanes |
| Mission queue (QUEUE.md) | Service-delivery pipelines per department |
| Coach bench (music skills) | SKILLS INVENTORY - cross-domain coaches producing each department's artifacts + deliverables ("expertise in any domain is a CE loop") |
| 4 operator queues | Same four - taste / planning / design / interview - fed by every department |
| Evidence-bearing PRs | Deliverables with V&V attached (reports, proposals, releases) |
| ops-emit + event log | Same contract, org-wide; v2 transport (PS Azure + Postgres + SSE) already specced in [ops-deck-vision](ops-deck-vision-20260710.md) |

This IS the "AI Mentor / agent-swarm-as-team" positioning made concrete: the org cockpit
is the productized proof that one operator + the loop runs a firm's departments. Reverse
and recursive CE: each department's workflow gets the same treatment songwriting got today
(corpus of proven examples -> verifier -> coach skill -> loop), then the loops compound.

## Interview set (IV-4 on the Deck - answer ANY subset)

1. First department to cockpit-ify? (Engineering is basically done - candidates:
   proposals/BD, patents/IP, delivery/PM, marketing content.)
2. What is that department's "PR with evidence" - the deliverable + its V&V artifact?
3. Skills inventory home: claude-config (team) vs a new PS org repo?
4. v2 trigger: does the org cockpit WAIT for PS Azure + Postgres, or start as Deck v1
   polling (a Pages/private-repo instance) the way music did?
5. Who besides you reads the org glass - Mike? (Changes auth + surface choices.)

## Assumed answers (until any interview answer arrives)

| Q | Assumed | Basis |
|---|---|---|
| 1 | Unanswered - genuinely operator's (priorities seat) | |
| 3 | Skills inventory splits by audience: shared team capability -> claude-config; PS-business-specific -> a PS repo | existing routing discipline (memory-discipline / ccp scope) |
| 4 | Start as v1 polling on a private repo, swap transport later | the Deck proved v1 in one arc; "transport is swappable" is the whole design |
| 5 | Operator-only first | slack-bridge exists for team-visible status; the cockpit's write-side gates on ONE operator today |

## Not in scope (deliberately)

- Vertical / industry / market / economy panels - no actuators, so no cockpit. If wanted
  later, that is a research-dashboard product with external data feeds (spike first).
- Building any org panel TODAY - this is capture; the squeeze decision + Q1 are the
  operator's, queued as IV-4.

## Related

- [ops-deck-vision-20260710](ops-deck-vision-20260710.md) - the shipped v1 + v2 transport seeds this generalizes
- [sdd-vision-20260710](sdd-vision-20260710.md) - "any domain is a loop", the principle the skills inventory runs on
- claude-config PR #650 - the team-wide encoding of that principle
