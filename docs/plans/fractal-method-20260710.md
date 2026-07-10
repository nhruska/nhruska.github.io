# The Fractal Method - Career-Pattern Articulation (2026-07-10)

> Operator: "I'm still doing the same types of problem solving, but the tools change, but
> my approach remains the same. look for patterns, create loops, zoom in and or out in
> fractals. find the entities, determine what they are a collection of by zooming out.
> zoom in and find the collections within." Provenance: the xAPI/LRS story (operator built
> the first LRS; bridged the DoD-JSON vs AICC-XML camps; Kinect bubble-pop capstone built
> in 2 days on a just-released SDK, tracked live to his LRS in front of military brass).
> This doc is the capstone of today's vision thread (ops-deck -> org-cockpit ->
> guided-and-free); the personal full-story version belongs in knowledge-space when a
> laptop session can reach it.

## The mapping that makes this load-bearing (not nostalgia)

**The Ops Deck IS an LRS for agent work.** Point for point:

| xAPI / the first LRS (2011) | The Deck (today) |
|---|---|
| Statement: actor - verb - object - timestamp | Event: agent - type - title - ts (mission-events.jsonl) |
| Append-only statement store | Append-only event log (the permanent contract) |
| Serialization = CONSUMER preference (JSON or XML, per request) | Transport = swappable object (Pages polling now, Azure SSE later - glass unchanged) |
| Launch anywhere, track centrally (exe, Second Life, Kinect - anything that speaks the protocol is supported) | Emit from anywhere (any model tier, any swarm agent - one stdlib command is the protocol) |
| CaaS: third-party-launched experiences still tracked home | Cross-repo missions broadcasting to one glass |
| The demo IS the argument (bubble-pop live in front of the brass) | A1 live probe (event on the glass in 16s, screenshot committed) |

The operator rebuilt his own 2011 architecture today without planning to - which is the
strongest evidence the METHOD is real: same entity-collection-loop moves, different tools.

**v2 design seed (recorded here + org-cockpit doc):** shape the org cockpit's event store
xAPI-compatibly (or provide an xAPI export surface). Every LRS/analytics consumer ever
built becomes a free consumer of agent-work telemetry - the JSON-or-XML move, played again.

## The method, named (four perspectives)

1. **Adjacent possible** (Kauffman/Johnson - the quote the operator was reaching for:
   things get built when they become newly possible). Career pattern: camp at the edge
   where a capability JUST landed (Kinect SDK days before the conference; LLM loops now -
   karpathy/autoresearch is the same reflex) and demo the loop live before the boundary
   closes.
2. **The bridge move**: when two camps fight over the ENVELOPE (JSON vs XML; guided vs
   free; Pages vs Azure), lift the data one level up and make the surface a consumer
   preference. The standard is the event, not the envelope. (Rails-with-exits and the
   transport object are both this move.)
3. **The composition algebra**: find the unit, find its collection, notice the collection
   is a unit one zoom out - note -> chord -> progression -> song -> album; task -> swarm
   -> mission -> sprint -> repo -> portfolio -> organization. FRACTAL (not merely
   hierarchical) because the same operators apply at every level: queue it, loop it,
   verify it, compound it. The actuator boundary (org-cockpit doc) is where the algebra
   stops being operable, not where it stops being true.
4. **The demo discipline**: every era's unlock shipped as protocol + live proof, never a
   spec alone. SCORM-era smart people were stuck at an innovation boundary until a
   side-scroller reported scores over web services. The CE-era equivalent is the
   evidence-bearing PR + the Deck's live feed - the demo is now continuous.

## What this changes operationally

- org-cockpit v2: xAPI-shaped (or xAPI-exportable) event store - free consumer ecosystem.
- Skill profiles (M-14) have a 15-year-old precedent: the LRS tracked learning experiences;
  the skill graph IS an activity stream over practice events. Same statements, one zoom in.
- When a standards fight appears anywhere in PS work: default to the bridge move.

## Related

- [ops-deck-vision-20260710](ops-deck-vision-20260710.md) / [org-cockpit-vision-20260710](org-cockpit-vision-20260710.md) - the modern LRS + its org zoom
- [guided-and-free-vision-20260710](guided-and-free-vision-20260710.md) - skill graph = activity stream, one zoom in
- claude-config compound-engineering-philosophy "Any domain is a loop" - the principle this method instantiates
