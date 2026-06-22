# Plan — Redesign `/interview` into a menu-driven, graph-scheduled coach

**Status:** awaiting codex-led review (codex not available in the web sandbox;
run the review volley from the laptop session).
**Owner of merge:** Nik. **Branch:** `claude/interview-skill-intent-k7fur0`.

## Goal
Turn `/interview` from a free-form "ask up to 4 questions per round" prompt into
a deterministic, **menu-first** intake that scales from a typo fix to a fuzzy
taste-driven feature — portable across repos, with a project-aware branch for
this Music app. Output is a durable, committed plan file that a second model
(codex) reviews before any building starts.

## Decisions (shared reality from the interview)
| Topic | Decision |
|---|---|
| Menu scope | General portable top-level intents **+** a project-aware branch that appears only when the intent touches this repo |
| Entry | Menu-first control panel; free-text is always an escape hatch |
| Question engine | Build a **dependency graph** of candidate questions; batch independents (≤4/screen), defer derived ones to later turns where a prior answer loads the options; question density is inferred from the independent-set size, never fixed |
| Stop rule | Confidence-gated; every round carries an always-on "I've got it — draft the plan" bail; no hard cap |
| Plan artifact | Durable, version-controlled plan file at `.claude/plans/<slug>.md` |
| Review | **Codex leads**, Claude reconciles, auto-volley to convergence, then surface the settled plan + what changed |
| Memory | **Offer** to persist a taste profile only when none exists yet (project- or global-scoped); never auto-write |

## Design

### 1. Cold start → control panel
Invoked with or without args. Vague/empty args → open
*"What are you trying to accomplish today?"*. Draft portable top-level intents:

- Build a feature
- Fix a bug
- Review / refactor code
- Git & shipping
- Ops (deploy / CI / config)
- Research / decide
- Design & UX  → routes into `ux-coach` critique mode
- Just talk (free-text)

### 2. Project branch
When the pick touches this repo (detected by presence of `music/shared/`,
`songs.json`), show a project sub-menu: *Songs · Tuner · Compose · Set-list ·
Diagram/Audio · Theme*. In another repo the branch is absent or derived from
that repo, keeping the skill copyable.

### 3. Question-graph engine (the core)
For the chosen intent, generate a candidate question set; tag each with its
dependencies; topologically schedule — independents batched into one
AskUserQuestion screen (≤4), dependents deferred to later turns with options
personalized by prior answers. Only ever ask taste/vision/priority questions.

### 4. Confidence-gated stop
Stop when shared reality is reached. Every round includes an always-present
"I've got it — draft the plan now" option. No hard question cap.

### 5. Reflect → write plan file
Short decisions table, then write `.claude/plans/<slug>.md`: goal, decisions,
concrete steps, files touched, verification, open risks.

### 6. Approval gate → codex-led review volley
After Nik approves: codex reviews the plan first, Claude reconciles notes back
into the file, iterate to convergence, then surface the settled plan + a diff of
what changed.

### 7. Taste-profile offer
If no profile exists (`.claude/taste.md` for project, or the global command
layer), OFFER to persist recurring answers — project- or global-scoped. Never
auto-write.

### 8. Handoff
From the converged plan → `/ship`.

## Files to create / change
- `.claude/commands/interview.md` — rewrite into this menu-driven, graph-scheduled flow.
- `.claude/plans/` — new directory for committed plans (this file seeds it).
- `.claude/taste.md` — created only on Nik's yes (offer step).
- `CLAUDE.md` — update the `/interview` one-liner if behavior changes materially.

## Open risk — codex availability (objected once)
"Both, codex leads" needs a genuinely **independent** reviewer. Codex is **not
reachable from the web sandbox**. Resolution: run the review volley from the
laptop session where codex lives. Fallback if codex is ever unreachable:
degrade to the `/code-review` skill (same brain grading its own homework) — and
say so plainly rather than implying an independent check happened. Whether to
accept that fallback is Nik's call.

## Verification bar
- `/interview` is a markdown prompt, not executable JS — no `node -c`.
- Dry-run the new flow against 2 cases: a typo-fix (should short-circuit to a
  one-line read + proceed) and a fuzzy feature (should open the full graph).
- Confirm project detection logic is repo-relative (no hardcoded Music paths in
  the portable layer).

## Next: build after codex sign-off, then `/ship`.
