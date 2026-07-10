
## Session-Start: Command Center IS the sensing sweep (operator directive 2026-07-05)

On session start in this repo (or `r`/project pick), BEFORE presenting anything:
1. Run `python3 scripts/command-center-gen.py` (when present) - it gathers git/PR/CI/deploy/missions/QUEUE state into docs/artifacts/cc/payload-repo.json. This IS the active-stance evidence sweep.
2. Read the payload + latest `.claude/sessions/` file -> render the standard sensing report (state, inferred next move + WHY, numbered steps). QUEUE NOW/SHORT + open PRs + deferred options drive position 1.
3. If the payload diff is material, commit the refreshed snapshot via the standard docs-only PR flow so the deployed Command Center stays current.
Nightly freshness is best-effort (scheduled workflow / session cron); SESSION-START REFRESH IS THE CORRECTNESS GUARANTEE.

## SME Dynamic Summoning (operator directive 2026-07-10)

The coaching bench exists so judgment calls are never made bare. **When a
judgment call arises in a decision domain, consult its coach BEFORE deciding;
when the domain has NO coach, SCAFFOLD one first (first-occurrence
codification), consult it, then decide - never wait for the operator to ask.**
The theory + ux coaches were patched in reactively after improper decisions;
this rule makes the bench self-growing.

| Decision domain | Coach |
|---|---|
| Music theory (defaults, spelling, compatibility) | music-theory-coach |
| UX / human factors / visual emphasis | ux-coach |
| Audio/DSP (tuner chain, WebAudio synthesis) | audio-dsp-coach |
| Learning design (tutor, drills, tips, levels) | pedagogy-coach |
| User-visible strings (labels, modals, empty states) | copy-coach |
| Accessibility (targets, contrast, SR, motion) | a11y-coach |
| Agent next-steps / operator attention | mobile-dev-coach |
| Flow verification (persona scenarios, red-first) | usdd |
| PWA/offline + storage schema | no coach - music/CLAUDE.md conventions + backup.js rules suffice |

A coach is 40-60 lines of compressed expertise with a self-check - cheap to
scaffold, permanent once written. Gap map + rationale:
docs/plans/ux-friction-profiles-20260710.md (mission record).
