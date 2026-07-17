# Goal Spec: clear-chessboard (mission, 2026-07-10)

> Operator directive (verbatim intent): "/mission navigate as project lead in my absence
> choosing next steps to play through the turns as me... /goal-interview clear the
> chessboard of PRs and the queue. simulate the different use cases in PW tests. draft a
> full suite of supported usage scenarios we can execute on demand - or at least use
> pw-replay json format and save in proj for increased speed testing capability."
> Acting roles delegated: project lead + PM + PO. Interview answered AS the operator from
> established preferences; every assumed answer is documented below for audit.

## Completion condition (objective)

> Every open PR on nhruska/nhruska.github.io and ccp #12 is dispositioned (merged or
> closed-with-rationale-comment, or explicitly left-open-with-status-comment), the QUEUE's
> "Newly queued (findings)" rows are each FIXED or owner-assigned, `test/pw/scenarios/`
> holds >= 6 runnable JSON scenarios with a runner and each has passed once with screenshot
> evidence, and `node test/run-all.js` exits 0 on post-merge main.

## Verification

- `node test/run-all.js` exit 0 (post-merge main)
- `bash scripts/check-cache-bump.sh` exit 0 on any CORE-touching branch
- `python3 test/pw/run-scenario.py <scenario.json>` exit 0 per scenario + screenshot in test/pw/evidence/
- GitHub PR states via MCP (merged / closed / open-with-comment)

## Scope

- In: nhruska.github.io (PRs #196 #198 #98 #88 #70, QUEUE.md, test/pw/ suite, FORK-4 wiring), ccp #12
- Out: work repos, claude-config conversation-export (deferred-priority tail item), any FORK-4
  data-file rewrites beyond render paths (songs.json chord tokens stay canonical-sharp inputs)

## Guardrails (never do unattended)

- Never commit straight to main; merges are squash via PR with accurate title/body
- Never merge without: adversarial review pass + audit comment + live evidence for integration seams
- SW CACHE + build-stamp pair bump on every CORE-touching commit
- One Playwright scenario per process, sequentially (box OOM rule); commit before long PW runs
- No force-push except --force-with-lease on own feature branches
- No external comms beyond PR comments; no destructive deletes of branches carrying unmerged unique work

## Assumed operator answers (documented for audit - "responses are predictable")

| Question | Assumed answer | Basis |
|---|---|---|
| Merge authorization? | YES for #196/#198/ccp#12 after review+evidence | "clear the chessboard of PRs" + "play through the turns as me" (explicit, this session) |
| Codex volley unavailable on web - alternative? | In-Claude /review pass + audit comment per PR | CLAUDE.md flag-gating: codex OFF-path routes to /review |
| #98 disposition? | Close as superseded (spellScaleKeyAware now fresh+tested in #198; wiring redone on clean main) | He asked to "remove FORK-4" fresh; #98 is 5-days stale w/ guaranteed conflicts |
| #70 disposition? | Close as superseded by M-0 | Recommended twice previously, unobjected |
| #88 disposition? | Leave open + status comment (live WIP, not superseded) | Real feature draft |
| Picker key names in FORK-4 wiring? | Flat names for flat keys (Bb, Eb, Ab) | "there's no B flat, it's labeled as a sharp" - the recurring thorn |
| FORK-4 merge gate? | Merge only if fully proven (suite + PW pixels); else leave ready w/ evidence | Prove-don't-promise contract, quality bar |
| Budget? | This turn + PR-watch follow-up turns; abort->surface after 3 failed fix attempts on any gate | Timeline realism |

## Abort & surface to human when

- A merge conflict can't be resolved preserving both sides' intent
- Any test/PW gate stays red after 3 fix attempts
- Anything requires credentials or an irreversible act outside the guardrails

## Priorities

1. PR clearing (unblocks all) 2. PW scenario suite (merge-gate evidence + the compounding asset)
3. FORK-4 wiring 4. QUEUE reconcile + report 5. conversation-export (tail)

## Per-iteration context

- Repo rules: music/CLAUDE.md (SW pair bump, one-scenario-at-a-time, canonical-sharp contract being retired)
- The PW runner + scenarios in test/pw/ are the durable compound asset - keep them declarative
