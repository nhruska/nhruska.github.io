# Goal Spec: ux-persona-mission (2026-07-03)

> Persona-driven UX / UI / human-factors enhancement mission for the Music app
> (music/play). Simulated-user testing across real-friend personas -> plan:council ->
> adversarial review + resolution -> atomic sprint plan -> HARD HITL GATE ->
> autonomous execution of sprint-1 draft PRs. Operator is remote (WAN, phone).

## Completion condition (paste into /goal)

> Mission per docs/plans/goal-ux-persona-mission-20260703.md is complete when:
> (1) persona definitions, persona-testing findings, council record, adversarial
> resolution log, and the sprint plan are committed on branch
> claude/ux-persona-mission, each also delivered as an HTML artifact emailed to
> nhruska@gmail.com and telegram-linked; (2) the sprint plan file contains a
> recorded "Approved-by: Nik" line captured from his telegram reply (HARD GATE -
> no execution before it); (3) every sprint-1 atomic item in the approved plan is
> an OPEN DRAFT PR with node test/run-all.js exit 0, GitHub CI checks green,
> phone-viewport Playwright render-verify screenshots, a githack preview link,
> and a telegram notification posted; deferred items are recorded in the plan
> with reasons; (4) a final mission-report HTML artifact is emailed +
> telegram-linked. Zero merges; zero pushes to main.

## Verification

- Artifacts exist + committed: `git ls-tree claude/ux-persona-mission -- docs/artifacts/ docs/plans/` shows the 5 phase artifacts + plan.
- Approval recorded: `grep "Approved-by: Nik" docs/plans/ux-sprint-1-*.md` (with telegram msg timestamp).
- Per PR: `node test/run-all.js` exit 0; `gh pr checks <N>` all pass; draft state; preview link `curl` 200.
- Sprint completeness: open draft PR count + deferred count == plan item count.
- Human-facing copy: `python3 ~/.claude/scripts/validate-no-ai-tells.py` clean on changed UI copy.
- Theory bar: circle.js canonical-sharp contract (FORK-4) tests stay green; any new theory logic ships with node unit tests.

## Personas (first round: Nik's musician friends)

| # | Persona | Core traits | What dismisses them |
|---|---|---|---|
| P1 | Aspiring Pro | Heading to full-time musicianship; setlist/repertoire power user; speed + reliability | Slow flows, lost data, toy feel |
| P2 | Classically Trained / Pianist | Deep theory literacy; new to fretboard geometry; piano -> neck mapping | ANY theory error (instant credibility loss) |
| P3 | First-Time Guitarist | Absolute beginner; needs gentle just-in-time scaffolding | Theory walls, jargon, fear of breaking things |
| P4 | Shape-Fluent Improver (Nik-like) | Knows chords + neck shapes; leveling up scales/modes/keys; the solo-practice loop is FOR them | Friction in the compose->jam loop, shallow theory |

**All personas share:** holding the instrument, ONE-HAND (thumb) phone navigation.

## Design principles (operator-stated, binding on every phase + PR)

1. **Theory rock solid or dismissed.** Sharps/flats: verifiable + deterministic (canonical-sharp FORK-4). Where a genuine user decision exists, make it a Setting; prompt once if absent from localStorage.
2. **Just-in-time tooling.** Tools/theory surface at the point of need in the learning journey - never a wall upfront (per TUTOR-ROADMAP).
3. **One-shot dismissible notables.** Hint/onboarding panels show once, dismissible, persisted in localStorage (namespaced, defensive reads per backup.js rules).
4. **One-hand ergonomics.** Thumb-zone reachability; clumsy-tap tolerance; NO accidental delete/edit - destructive actions gated (edit-mode, confirm, or undo).
5. **Atomic autonomous PRs.** Each sprint item independently mergeable, tests + render-verify included, per repo /ship conventions.

## Phases

| Phase | Work | Model routing | HITL |
|---|---|---|---|
| 0 | Branch claude/ux-persona-mission; ingest UX-FRICTION-LOG.md, TUTOR-ROADMAP.md, music/CLAUDE.md; baseline phone screenshots | Opus (parent) | - |
| 1 | Persona write-ups (JTBD, journeys, grip context) | Opus + Haiku drafting | advisory artifact 1 |
| 2 | Persona testing: Playwright phone-viewport journey walkthroughs per persona; one-hand thumb-zone audit; destructive-tap audit; JIT-discoverability audit; theory-credibility probes (sharps/flats across all 12 keys x modes) | Sonnet agents, Haiku cataloging | advisory artifact 2 |
| 3 | plan:council - chair: **Fable** (visionary tutor-coach-mentor); seats: beginner advocate, theory rigor, one-hand ergonomics, roadmap-fit | Fable chair + Sonnet seats | advisory artifact 3 |
| 4 | Adversarial review of candidate plan (codex/GPT-5.5) + collaboration resolution (**Fable**; every finding FIXED / REFUTED / DEFERRED) | codex + Fable | advisory artifact 4 |
| 5 | Sprint plan synthesis: atomic PR specs (scope, acceptance criteria, verification, MVC block) | **Fable** synthesis | **HARD GATE: telegram approve / adjust / stop** |
| 6 | Execute sprint 1: worktree-isolated implementer swarm, one agent per atomic PR; each: impl + tests + render-verify + draft PR + preview + telegram ping | Sonnet implementers, Haiku PR-body drafting | advisory per PR |
| 7 | Final mission report; /session:save | Opus + Haiku | artifact + telegram |

## Scope

- **In:** music/play/, music/shared/, music/docs/, test/, docs/plans/, docs/artifacts/. Settings panel additions, one-shot notables, one-hand/destructive-action guards, theory-credibility fixes, JIT tooling, compose/jam/tune/library flows.
- **Out:** root index.html (portfolio), tools/, backend/accounts (none exist), new build steps or frameworks (stays vanilla JS, no build), TUTOR-ROADMAP phases 4/5 features except where the plan explicitly slices one in, live-site changes (no merges).

## Guardrails (never do unattended)

- NEVER merge any PR; NEVER push to main; draft PRs on claude/* branches only. Nik merges.
- No deploys (Pages deploys only on merge, which never happens here).
- SW cache bump (music/sw.js CACHE) in the SAME commit as any CORE-listed file change.
- localStorage/schema changes follow backup.js SCHEMA_VERSION + MIGRATIONS rules; keep test/backup.test.js green.
- Theory: never violate canonical-sharp (FORK-4); circle.js spelling is the single source; new theory logic requires unit tests.
- Comms ONLY to Nik's own telegram chat + nhruska@gmail.com. Nothing external.
- No full e2e suites on this box (OOM); ONE Playwright scenario at a time; commit before browser batches.
- Worktree isolation for all parallel implementers; MVC block at every spawn (includes principles 1-4 + no-AI-tells for UI copy).
- **Fable = extra-usage credits (~2x Opus, post 2026-06-23)** - explicitly approved for THIS mission, phases 3/4/5 chair/synthesis moments only. All mechanical work -> Haiku; implementation -> Sonnet; adversarial -> codex (own quota).

## Abort / surface to human (via telegram) when

- Plan gate unanswered: re-ping at 2h; after 24h park cleanly (commit everything, session-save, stop).
- An atomic PR fails verification 3 consecutive attempts -> mark DEFERRED in plan, telegram note, move on. If >1/3 of sprint deferred -> stop, surface.
- Codex or Fable unavailable -> fall back (in-Claude adversarial; Opus chair), note the substitution in the artifact, continue.
- OOM (exit 137) during verification -> commit first, reduce to single-scenario verification, note it.
- Anything requiring a merge, deploy, or external comms -> stop and ask.

## Priorities

Theory correctness > one-hand ergonomics + destructive-action safety > just-in-time discoverability > visual polish. Thoroughness over speed in phases 1-5; small independently-mergeable PRs in phase 6 (cap sprint 1 at ~6-10 items; overflow -> backlog in plan).

## Budget

Research phases ~2-4h wall-clock; execution scales with approved plan (est 3-6h for 6-10 atomic PRs via swarm). Heavy token spend authorized; cheap-routing mandatory for mechanical work; Fable only at the three named judgment points.

## Per-iteration context (each turn re-reads)

- This spec (path above) + current phase + HITL state (which artifacts sent, gate status).
- music/CLAUDE.md conventions (SW bump, backup.js seam, canonical-sharp, preview-link policy, one-screen-above-the-fold).
- The 5 design principles + persona table.
- Telegram = decision channel (poll for replies); email = artifact delivery (`--to nhruska@gmail.com`); phone-remote only if on LAN.
