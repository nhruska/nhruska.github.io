# CLAUDE.md - the Math app (`math/`)

> Math-app-specific guidance. Repo-root [CLAUDE.md](../CLAUDE.md) owns the
> app-wide agreement, and [music/CLAUDE.md](../music/CLAUDE.md) is the reference
> implementation this app mirrors (sibling PWA, same origin).

A self-contained **static** slice of the GitHub Pages site, served from `main`.
**No build step**: classic `<script>` tags, vanilla JS. Live app:
[nhruska.github.io/math/](https://nhruska.github.io/math/).

## Layout

`index.html` (UI shell) + `app.js` (controller) + `engine.js` (pure
`window.MathEngine`, no DOM/storage) + `skills.js` (pure `window.MathSkills`:
the 12-skill path, stars, earned, portable export/import) + `store.js`
(`window.MathStore`, persistence only) + `math.css` + `version.js` + `sw.js` + `manifest.webmanifest`
+ `icon.svg`. Seam contracts: [goal-math-app-v1-20260925.md](../docs/plans/goal-math-app-v1-20260925.md).

## Conventions that bite if ignored

- **`math-v<PR#>[-<n>]` in `version.js` is the ONE version** - `sw.js` reads it
  via `importScripts('version.js')`. First Math-asset commit on a PR uses
  `math-v<PR#>`, each later pushed batch appends a counter (`-2`, `-3`), same as
  Music's S-SW-PER-COMMIT, so Settings' build line shows which push a phone has.
  `scripts/check-cache-bump.sh` fails when `math/` changes (CLAUDE.md aside)
  without a new `MATH_VERSION`.
- **Network-first SW, `math-` caches only.** `sw.js` activate must never touch
  a cache outside its own `math-` family - the origin also hosts Music's
  `music-` caches, and either deleting the other's evicts its offline install.
  Lookups stay in its own cache too (`fromCache`, never `caches.match`).
  test/math-sw.test.js guards both directions, plus every `<script src>` in
  `index.html` being in CORE.
- **`math.` storage prefix, additive-only.** Every `MathStore` reader is
  defensive (try/catch -> safe default). A BREAKING shape change needs a
  `MIGRATIONS[n]` step, same discipline as Music's `backup.js`.
- **ALL CSS is external**, in `math.css`, using Music's `songbook.css` tokens
  only - no new hues, no inline `style=`.
- **Math links `../music/shared/{songbook.css,theme.js,esc.js,toast.js}`
  directly** (not copies) - a fix in one of those four reaches both apps free.
  `Theme.PALETTE` is the shared accent-swatch SSOT.

## Tests + preview

A scenario that looks for a specific fact must match BOTH operand orders: the
engine shows `+:4:5` as "4 + 5" or "5 + 4" (and `x` likewise), so a check on one
spelling fails on a correct run about half the time the fact comes up.

`node test/run-all.js` (discovers `test/math-*.test.js` automatically) +
`test/pw/scenarios/math-*.json` declarative flows
(`python3 test/pw/run-scenario.py test/pw/scenarios/<name>.json`).

Githack preview path: `/math/` (branch-form default, commit-pinned for
isolated testing only) - see `.github/workflows/pr-preview.yml` and
[music/CLAUDE.md](../music/CLAUDE.md#preview-links--review-githack) for the
link-form policy this mirrors.
