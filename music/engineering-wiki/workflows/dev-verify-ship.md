# Dev, Verify, Ship

[Wiki](../index.md) > workflows > Dev, Verify, Ship

## Purpose

The protocol for testing, previewing, and merging Music-app changes - what green gates.

## Surface-aware verification bar [STABLE]

| Surface | Capability | Floor |
|---|---|---|
| Android / web (no local toolchain) | no Playwright, no local server | node -c changed JS, JSON.parse changed JSON, post a tappable githack BRANCH preview link, state plainly what was not verified |
| Main laptop | full toolchain: shared venv (~/.claude/.venv) + Playwright/Chromium | all of the above PLUS headless render-verify: serve music/play/, phone (412x915) + desktop screenshots, ZERO console errors before merge |

Detect the surface first: `python -c "import playwright"` in the shared venv AND ~/.cache/ms-playwright/chromium-* present -> laptop.

**Phone-DPI text floor:** any SVG text shipped to a phone uses font-size >= 10 with a canvas sized to fit - a 7.5px digit vanishes at Pixel-DPI. Laptop: confirm a phone-viewport render; no-browser surface: keep fonts conservatively large.

**E2E discipline:** never run a full Playwright SUITE on the dev box (OOM kills the session) - one scenario at a time, commit first; suites belong in CI.

## The /ship flow [STABLE]

Branch `claude/<slug>` (never commit straight to main) -> commits explain the WHY + session trailers -> push -> DRAFT PR -> preview links posted -> watch the PR. The operator is the only one who merges (standing rule; explicit in-session authorization is the only exception).

## Preview links (githack) [STABLE]

| Form | When |
|---|---|
| Branch (DEFAULT): raw.githack.com/nhruska/nhruska.github.io/<branch>/music/play/ | always - tracks every push during the PR's life |
| Commit-pinned | isolation testing ONLY; label "(expires after merge)"; never the primary link |

Always curl-verify 200 before handing over; live tappable markdown link; telegram it when the operator is on phone. Merged work links the DEPLOYED Pages URL - githack links die with the branch.

## What green gates [STABLE]

1. Syntax + parse: node --check changed JS; JSON.parse changed JSON.
2. `node test/run-all.js` - every suite green (dependency-free, no npm).
3. SW CACHE bump in the SAME commit when any CORE file changed ([offline-pwa](../systems/offline-pwa.md)).
4. Zero console errors on the rendered app (laptop surface).
5. Data integrity on songs/tracks edits: token regex + surgical diffs ([data-curation](data-curation.md)).
6. Geometry gate where the fixed Compose top is touched (A7: fold bottom edge +-2px at 412x915).

## CI map [STABLE]

- .github/workflows/tests.yml - node test/run-all.js on PRs
- .github/workflows/pr-preview.yml - githack preview comment (per-instrument links)
- .github/workflows/retry-pages-deploy.yml - auto-re-runs a first-attempt Pages deploy failure once (transient GitHub blips self-heal)
- Pages deploys from main on merge; no other merge gates on this personal site

---

**Anchors verified:** CLAUDE.md (root, surface-aware bar + /ship), music/CLAUDE.md:35-56 (previews + CI), .github/workflows/*, test/run-all.js, docs/plans/ux-sprint-1-20260703.md A7/A10
