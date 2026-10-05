# Project handoff - nh-pages (Music + Math), 2026-10-05

## This Project

- **Name:** nh-pages (covers the Music app and the Math app).
- **Cloud environment:** Cloud-With-Config (`env_018ePk6pcuQ3xVYDS2dKausA`), which already loads the shared claude-config rules via its token.
- **Repo:** nhruska/nhruska.github.io only. One repo per Project keeps this repo's own `.claude/settings.json` in force (a 2026-10-05 probe showed repo settings only apply in a one-repo Project).
- **Owns:** `music/`, `math/`, the queue in [QUEUE.md](QUEUE.md), and the Command Center snapshot (`docs/artifacts/cc/payload-repo.json`).
- **Merge:** Nik is the only one who merges. The repo [CLAUDE.md](../../CLAUDE.md) says so, and it wins over the `auto` Merge cell in Nik's personal projects table. Report a PR ready and stop.

The coordinator of the nh-pages Project starts here. This doc takes over from the orchestrator session `session_01NLF4L29ZcQu9uoewQeCsGy` ("nh-pages sprint (Math + Music)", at 50% context, past the 40% transfer line) and the #360 thread of `session_01Dz7aGzGjoo6do6HWXyv7Fi` ("cc verify-runtime"). It does not retire either session. Nik decides when they go.

## Why a file

A Project is a view over sessions. Git is the source. Durable state lives in a tracked file, never in session memory (nhruska/claude-config `rules/memory-discipline.md`). If this doc and a live read disagree, trust the live read and fix this doc.

## Read first

1. [CLAUDE.md](../../CLAUDE.md) - working agreement, `/ship`, surface-aware verification.
2. [.claude/CLAUDE.md](../../.claude/CLAUDE.md) - session-start Command Center sweep, SME coach bench.
3. [music/CLAUDE.md](../../music/CLAUDE.md) - SW cache version pair, backup schema, githack preview policy, `scripts/verify.py`.
4. [math/CLAUDE.md](../../math/CLAUDE.md) - `math-v<PR#>[-n]` version in `version.js`.
5. [QUEUE.md](QUEUE.md) NOW + SHORT. The NOW row for M-MATH-V1 still says #355 OPEN, but #355 merged 2026-09-27T23:14Z. Reconcile it on the next queue edit.

## Where things stand

Read 2026-10-05 via GitHub REST and `get_session`/`list_events`. `main` head: `233515d` (2026-10-05T18:34Z, "cc: nightly snapshot refresh").

| Item | State | What moves it |
|---|---|---|
| #360 verify runtime V2 for Music | MERGED 2026-10-05T13:01Z | done (orchestrator still lists it as owed, stale) |
| #363 check-cache-bump judges uncommitted changes | MERGED (on main as `17f1105`) | done |
| #358 Thought-Ware method v0.1 (base of #346/#347) | open, ready, head `cb9fe81` | Nik merges, then retarget #346 to main |
| #351 Musician Profile + VNext model | open, draft, head `6755e2e`, mergeable clean | Nik phone-tests the `6755e2e` commit preview (Settings > Musician profile), replies PASS, then merges |
| #346 calibrate Thought-Ware public claims | open, draft, head `6bbe963`, stacked on #358 | #358 merge, then retarget and mark ready |
| #347 engineering-wiki lifecycle integrity | open, draft, head `e848419`, stacked | after #346 |
| #356 SBS merge plan for the open PRs | open, draft, head `8323e6e` | goes last, after the stack lands |
| #362 allow merge-resolution commands in sprint sessions | open, draft, head `e78b942`, mergeable clean | Nik reviews (touches `.claude/` permissions) |
| Landscape Tune bug: mini-player bar covers the bottom tuner strings | on main, no PR yet | new draft PR with a red-then-green test (orchestrator's offered next step) |

CI state per head: not checked here beyond the orchestrator's 2026-10-04T23:45Z report of green on #351, #356, #358.

## Sessions that touch this repo

| Session | Role | State (2026-10-05) |
|---|---|---|
| `session_01NLF4L29ZcQu9uoewQeCsGy` nh-pages sprint (Math + Music) | orchestrator, env Cloud-With-Config | idle, blocked on Nik, 503k/1M context |
| `session_01Dz7aGzGjoo6do6HWXyv7Fi` cc verify-runtime (#1007 + music #360) | claude-config work, touched #360 | review_ready, 581k/1M context. Its music part (#360) is merged |

Other sessions: not checked.

## Operating rules (do not re-learn them)

- **Ship flow:** branch `claude/<slug>` off `origin/main`, commit, push, open a **draft** PR, post preview links, watch the PR. Never commit to `main`. Never merge.
- **Version per asset-changing commit:** Music `CACHE = 'music-v<PR#>'` plus `shared/build-stamp.js` in the same commit, later commits append `-2`, `-3`. Math uses `math/version.js` the same way. `scripts/check-cache-bump.sh` enforces both.
- **Preview links:** every push Nik is asked to test gets the commit-pinned githack link, labeled with the build version. Branch links are only the bot's evergreen comment. Merged work links the deployed site, never githack.
- **Render-verify bar:** `node -c` on changed JS, `JSON.parse` on JSON, unit-test new logic, then `python3 scripts/verify.py run`. A blocked outbound network is not a reason to skip rendering: serve locally on 127.0.0.1 and use headless Chromium at phone and desktop sizes, zero app console errors.
- **SME coach bench:** consult the domain coach in `.claude/skills/` (music-theory, ux, audio-dsp, pedagogy, copy, a11y, mobile-dev, songwriting, usdd) before a judgment call. No coach for the domain: scaffold one first.
- **Session start:** run `python3 scripts/command-center-gen.py`, read the payload and the newest session record, render the sensing report. Commit a material payload diff through the docs-only PR flow.

## Owed to Nik

1. Merge #358 (ready), then say "next" so #346 gets retargeted to main and readied.
2. Phone-test the #351 commit preview at `6755e2e` (Settings > Musician profile), reply PASS or FAIL, then merge.
3. Review and decide #362 (sprint-session permission change).
4. Pick up or decline the landscape Tune bug PR.
5. Decide when to retire or retitle the two sessions above. This doc does not do it.
