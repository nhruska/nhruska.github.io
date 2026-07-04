<!-- GENERATED from music/engineering-wiki/: workflows/dev-verify-ship.md, workflows/testing.md, systems/runtime-architecture.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Dev Guide

How to run, test, and ship a change to the Music app - what actually gates a merge, and why.

## No build step

Vanilla JS behind classic `<script>` tags. Edit a file, refresh a browser, done - no compile, no bundler. Modules are loaded in dependency order from `music/play/index.html` and each exports to `window`. Every shared module also carries a UMD tail so Node tests run without a DOM.

## Running the app locally

Serve `music/play/` over any local HTTP server (the mic tuner needs a secure context - `https`, or `localhost` counts). There's no dev-server script beyond a plain static file server; this is a static site.

## Running tests

```
node test/run-all.js
```

Discovers every `test/*.test.js`, spawns one process per file, aggregates. Exit 0 = green. Dependency-free (pure Node `assert`, no npm install). CI runs it on every PR.

| Suite | Covers |
|---|---|
| `circle.test.js` | circle-of-fifths engine: MODE_STEPS, spelling, romans, qualities |
| `theory-canon.test.js` | the 1008-check conservatory canon + scales-canon literals |
| `solo-scales.test.js` | pentatonic/blues tables: pcs, spelled names, degrees, subset proofs |
| `songbook.test.js` | engine theory helpers, suggestion merge, clear-undo snapshot, wireTapCancel |
| `songbook-firstrun.test.js` | first-run notable consumer logic |
| `notables.test.js` | claim/dismiss/priority arbitration, corrupt-storage tolerance |
| `tracks.test.js` | studioTheory, soloBundle, whynote templates, trackKey/migrations |
| `backup.test.js` | SCHEMA_VERSION seam: snapshot/validate/restore, atomicity, downgrade guard |
| `repertoire.test.js` / `repertoire-form.test.js` | merge model + add/edit form |
| `diagram.test.js` / `diagram.dom.test.js` | SVG chord + scale rendering |
| `key-explorer.test.js` / `key-explorer.dom.test.js` | posWindow math + render contracts |
| `list-item.test.js` | unified row rendering + wireTap movement-cancel |
| `tuner.test.js` | autocorrelation smoothing chain |
| `queue.test.js` / `tempo.test.js` / `candidates.test.js` / `chord-pack-xss.test.js` / `live-adapter.test.js` | supporting modules |

A red `theory-canon` run means a theory regression, not a flaky test - never loosen the test, find the change (see [THEORY.md](THEORY.md)).

**Never run the full Playwright suite on a memory-constrained dev box** - it OOMs the session. Run one scenario at a time and commit first; suites belong in CI.

## The surface-aware verification bar

What you can verify depends on where you're working:

| Surface | Capability | Floor |
|---|---|---|
| Android / web (no local toolchain) | no Playwright, no local server | `node -c` on changed JS, `JSON.parse` on changed JSON, post a tappable githack branch preview link, state plainly what wasn't verified |
| Main laptop (full toolchain) | shared venv + Playwright/Chromium | everything above, PLUS headless render-verify: serve `music/play/`, phone (412x915) and desktop screenshots, zero console errors before merge |

Detect which surface you're on: `python -c "import playwright"` succeeding in the shared venv AND `~/.cache/ms-playwright/chromium-*` present means laptop-tier verification is available.

**Phone-DPI text floor:** any SVG text shipped to a phone must be font-size >= 10 with a canvas sized to fit - a 7.5px digit vanishes at Pixel DPI.

## What green gates a merge

1. Syntax + parse: `node --check` on changed JS, `JSON.parse` on changed JSON.
2. `node test/run-all.js` - every suite green.
3. Service-worker `CACHE` bump in the same commit whenever any CORE-listed file changed (see [ARCHITECTURE.md](ARCHITECTURE.md#offline-service-worker-and-cache-discipline)).
4. Zero console errors on the rendered app (laptop surface only).
5. Data integrity on `songs.json`/`tracks.json` edits: token regex + surgical diffs.
6. Geometry gate wherever the fixed Compose top region is touched (fold bottom edge within +-2px at 412x915).

## Shipping (the /ship flow)

Branch as `claude/<slug>` (never commit straight to `main`) -> commits explain the WHY -> push -> open a **draft** PR -> post preview links -> watch the PR. The human operator is the only one who merges - that's a standing rule, not a suggestion.

**Preview links (githack):**

| Form | URL shape | When |
|---|---|---|
| Branch (default) | `raw.githack.com/nhruska/nhruska.github.io/<branch>/music/play/` | Always - tracks every push during the PR's life |
| Commit-pinned | `raw.githack.com/nhruska/nhruska.github.io/<full-sha>/music/play/` | Isolation testing only; label "(expires after merge)" |

Always curl-verify a preview link returns 200 before handing it over. Once merged, link the deployed Pages URL instead - githack links die with the branch/commit.

**CI that runs on every PR:** `tests.yml` (`node test/run-all.js`), `pr-preview.yml` (posts the githack preview comment). `retry-pages-deploy.yml` auto-retries a first-attempt Pages deploy failure once. Nothing else gates merging - it's a personal static site.

## Related generated docs

[CONTRIBUTING.md](CONTRIBUTING.md) - the contributor-facing distillation of this guide plus the design constraints. [TESTING.md](TESTING.md) - the full suite map and canon-authority explanation. [ARCHITECTURE.md](ARCHITECTURE.md) - the runtime this all verifies.
