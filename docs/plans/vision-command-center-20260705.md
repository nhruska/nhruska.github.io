# Vision Capture: Command Center Hierarchy (operator, 2026-07-05)

> **Operator verbatim-essence:** "Launch a project mission control panel artifact - the PARENT artifact, 1:1 with project/repo: a command center describing everything dev, team, dev mgr need - git, deployment, CI, infra, status and services, Azure CD envs, links to logs, and more; lists missions/arcs/sprints/PRs. Then zoom out a META layer: my project list - mine plus problemsolutions org repos updated in the last 30 days. Deploy interim with 4-digit PIN auth to keep momentum before AAD tomorrow. This is how I become the vehicle for the company dev team to have no choice but to join me - communication, details, quality, philosophy."

## Architecture (three layers, ruled)

| Layer | Artifact | Cadence |
|---|---|---|
| Mission (exists) | Per-mission HiTL panes | Per mission lifecycle |
| **Repo Command Center (NEW - the parent)** | 1:1 per repo: git/branch state, open PRs + CI, deploy state + envs, services/infra links, logs links, missions/arcs/sprints registry (panes linked), QUEUE, sessions | Agent-regenerated: session close + on demand ("refresh command center") |
| **Portfolio meta-layer (NEW)** | Operator's repos + problemsolutions org repos pushed <30d: state summary + link into each command center | Same |

## Interim security ruling (operator: "4-digit pin for now")

GitHack cannot serve private repos; org data cannot sit plaintext on a public host. Interim = **encrypted-payload static artifacts on the public site**: data baked into an AES-GCM blob, key derived from the PIN (PBKDF2, high iterations); the viewer decrypts client-side. HONEST BOUNDARY: a 4-digit PIN is brute-forceable offline - acceptable ONLY because the payload is low-sensitivity (repo/PR/CI metadata) and the real home (workflows-hub behind Entra, per-customer-app decision) lands next. PIN delivered via telegram (private channel), never committed.

## Pipeline

Generator script (repo-side, agent-run with authenticated gh - tokens never in the page) -> JSON payload -> encrypt -> commit artifact + viewer -> Pages deploy. Regeneration = one agent command.

## Strategy note

This is the internal-first face of the U18-style compounding play: the same communication/quality surface that makes the app's library ship curated becomes the team's window into HOW this operation runs - panes, queues, adversarial folds, all linked from one command center.
