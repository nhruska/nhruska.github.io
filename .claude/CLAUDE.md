
## Session-Start: Command Center IS the sensing sweep (operator directive 2026-07-05)

On session start in this repo (or `r`/project pick), BEFORE presenting anything:
1. Run `python3 scripts/command-center-gen.py` (when present) - it gathers git/PR/CI/deploy/missions/QUEUE state into docs/artifacts/cc/payload-repo.json. This IS the active-stance evidence sweep.
2. Read the payload + latest `.claude/sessions/` file -> render the standard sensing report (state, inferred next move + WHY, numbered steps). QUEUE NOW/SHORT + open PRs + deferred options drive position 1.
3. If the payload diff is material, commit the refreshed snapshot via the standard docs-only PR flow so the deployed Command Center stays current.
Nightly freshness is best-effort (scheduled workflow / session cron); SESSION-START REFRESH IS THE CORRECTNESS GUARANTEE.
