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

## Operations: Repo Command Center v1 (shipped 2026-07-05)

**Scope amendment (security):** the portfolio/org meta-layer described above is NOT part of v1. It carries cross-repo and problemsolutions-org data and belongs on the AAD-gated workflows-hub, not on this public site - so it ships separately. v1 builds ONLY the Repo Command Center (the parent layer), scoped exclusively to THIS PUBLIC REPO's own public data (commits, PRs, CI, Pages deploy state, missions, queue). No PIN/encryption needed at this scope - every field is already public (git history, PR metadata, CI status are all visible on the repo's own GitHub pages); the PIN/AES-GCM ruling above stays reserved for the meta-layer's org-spanning data when that ships.

**Pipeline (as built):**

| Step | Artifact |
|---|---|
| Generator | [scripts/command-center-gen.py](../../scripts/command-center-gen.py) - stdlib Python, shells out to authenticated `gh` (tokens never touch the payload) + one read-only `urllib` GET against the deployed `music/sw.js` for the live CACHE version |
| Payload | [docs/artifacts/cc/payload-repo.json](../artifacts/cc/payload-repo.json) - plain JSON (no encryption; see scope amendment) |
| Viewer | [docs/artifacts/cc/repo.html](../artifacts/cc/repo.html) - self-contained HTML, fetches the payload relative to itself, reuses the HiTL Mission Control visual system verbatim (brand header, cockpit, lamps, chips, pills, tabs) |

**What it gathers (this repo only):** HEAD + last 12 commits, open PRs with per-check CI rollup state, last 15 merged PRs, GitHub Pages deploy status, the live deployed Service Worker CACHE version (diffed against the local `music/sw.js` to flag a pending deploy), the mission-pane registry (auto-discovered: any `docs/artifacts/*.html` whose `<title>` contains "HiTL Mission Control"), the vision-doc registry (`docs/plans/vision-*.md`, not yet promoted to a mission), the QUEUE.md NOW/SHORT/MID/LONG horizons (table rows, parsed generically), the unit-test file count, and a fixed set of ops links (Actions, Pages settings, wiki index, decisions registry, UAT log, QUEUE.md, live app).

**Regeneration:** "refresh command center" = `python3 scripts/command-center-gen.py` (rerunnable, idempotent) followed by committing the regenerated `payload-repo.json`. No Service Worker CACHE bump required - `docs/` is outside the app's precache list (verified against `music/sw.js`'s `CORE` array and `scripts/check-cache-bump.sh`'s scope, which only guards `music/shared|play`).

**Decision registered:** D-COMMAND-CENTER (music/engineering-wiki/decisions.md) - keep-both with the meta-layer scope amendment above.
