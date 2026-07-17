# AGENTS.md - Music App Engineering Wiki Contract

> This wiki is CANONICAL for Music-app system knowledge. Read it BEFORE re-deriving from raw
> sources. If a page conflicts with observed code, trust the code AND fix the page in the same
> change. Public repo: no secrets, no personal data - personas are archetypes, not people.

## Read order

1. [index.md](index.md) - namespace map + "which page owns X" routing.
2. The namespace matching your task. THEORY WORK (spelling, scales, romans, harmonization) MUST read [theory-engine/architecture.md](theory-engine/architecture.md) + [theory-engine/note-spelling.md](theory-engine/note-spelling.md) first - the spelling regime is the app's #1 credibility contract.
3. [decisions.md](decisions.md) when you are about to re-litigate anything - if it has a decision ID, it was ruled; propose a change explicitly instead of drifting.

## Time-sensitivity markers

| Marker | Meaning |
|---|---|
| `[STABLE]` | Load-bearing contract; change requires a decision entry |
| `[TRACKS-#98]` | Statement flips when PR #98 (key-aware spelling) merges - re-verify then |
| `[ROADMAP reviewed YYYY-MM-DD]` | Forward-looking; staleness measured from that date |

## Grounding rule

Every page carries source anchors (file:line or doc refs). A claim without an anchor is a smell; a claim contradicting its anchor is a bug in the page. Line numbers drift - anchor to function/section names where possible, exact lines where necessary, and re-verify anchors when editing a page.

## generated/ contract

Docs in [generated/](generated/) are RENDERED FROM wiki pages - never hand-edit them. Each carries a generation record (source pages + the command that produced it). Regenerate after editing source pages.

## For spawned agents (MVC briefs)

Point sub-agents at 1-3 specific pages as required reading with a one-line "pull if..." decision hook - not the whole wiki. The onboarding brief for new agents: [generated/ONBOARDING-BRIEF.md](generated/ONBOARDING-BRIEF.md).
