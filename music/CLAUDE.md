# CLAUDE.md — the Music app (`music/`)

> Music-app-specific guidance. The repo-root [CLAUDE.md](../CLAUDE.md) owns the app-wide working agreement (who-owns-what, output rules, `/ship`, surface-aware context) for the whole `nhruska.github.io` site; this file owns everything specific to the Music app under `music/`.

**Wiki-first:** [engineering-wiki/](engineering-wiki/AGENTS.md) is CANONICAL for system knowledge - read it before re-deriving from raw sources.

A self-contained **static** slice of the GitHub Pages site, served from `main`. **No build step**; classic `<script>` tags; vanilla JS. Live app: [nhruska.github.io/music/play/](https://nhruska.github.io/music/play/).

## Layout
- `music/index.html` — the Music launcher (cards → the app).
- `music/play/` — the app shell (the real product). Bottom tabs: Library / Jam / Compose / Tune. Opens on a **"Play now" hero**, not a cold list.
- `music/shared/` — the shared, instrument-agnostic runtime:
  - `songbook.js` — the engine (`Songbook.mount(opts)`; full contract in its header).
  - `nav-history.js` — the browser/Android back-button back-stack (`window.NavHistory`; overlays + screen/tab history register close fns).
  - `tracks.js` — the merged Repertoire, backing-track Studio, curation queue.
  - `repertoire.js` / `repertoire-form.js` — the unified song+track model + the Add/Edit form.
  - `tuner.js` — mic autocorrelation tuner + reference tones.
  - `diagram.js`, `audio.js`, `key-explorer.js` — chord diagrams, strum/tone audio, scale/key theory.
  - `songbook.css` / `tracks.css` / `repertoire-form.css` — the theme + every component.
  - `profiles/` + `manifest.json` — per-instrument string/chord data.
  - `songs.json` — the song catalog; `candidates.js` — pre-researched YouTube suggestions for the curation queue.
- `music/sw.js` — the service worker (offline + installable PWA).
- `music/dev/` — `export-data.html` (phone: dump localStorage curation to JSON) + `merge-localstorage.js` (laptop: fold it back into `songs.json`/`tracks.json`).

## Conventions that bite if ignored
- **`songs.json` shape:** `{ t, a, y, d, seq[], sheet[[section, line]…], jam? }`. `d` is a decade chip (`60s`…`10s`) matching year `y`. Chord tokens (in `seq` and `[..]` tags) must match `^[A-G][#b]?…` and reflect the real key. `"jam": true` flags a **Play-now jam-starter**; without flags, jam-starters fall back to fewest-chord songs. After editing, validate: `JSON.parse` + every `seq` chord splits cleanly.
- **Tuner trust:** the needle is smoothed in JS — clarity gate → median → note-name hysteresis → dropout hold. **Keep the red/amber/green status colours fixed**; do NOT tie them to the accent theme. Pitch feedback must stay unambiguous.
- **Accent theming:** the chooser sets `--accent` / `--accent-dim` / `--accent-deep` on `:root`, persisted in `localStorage` (`music.accent.v1`). Things that should re-skin use those vars; tuner status colours don't.
- **`<button>` text doesn't inherit colour** — button-based cards need an explicit `color` or text falls back to system black on the dark theme.
- **Keep diffs surgical** — when scripting edits to `songs.json`, only the intended lines should change (write back with the same 2-space formatting).
- **Note spelling is canonical-sharp (FORK-4).** ONE sharp table app-wide (F major shows `A#`, never `Bb`); the scale note list AND the fretboard must agree, both fed by `Circle` spelling. Flat INPUT normalizes; flats never render. A label under `text-transform:uppercase` must not uppercase an accidental letter (`.bt-st-notes` opts out). Full contract: [engineering-wiki/theory-engine/note-spelling.md](engineering-wiki/theory-engine/note-spelling.md) + `Diagram.scale(opts.names)`.
- **Stored-data changes go through `shared/backup.js`.** localStorage keys are namespaced (`songbook.` / `bt.` / `music.`) and every reader is defensive (try/catch -> safe default), so ADDITIVE changes (a new optional field, a whole new key) need nothing. A BREAKING change - rename/remove a field a reader depends on, retype a value, change a value's *meaning* while keeping its shape, or reshape the container - MUST bump `SCHEMA_VERSION` in `backup.js` AND add the matching `MIGRATIONS[n]` step in the SAME commit. Why it matters: this is an offline PWA, so an old cached build can read data a newer build wrote - additive is safe in both directions, breaking is only safe forward. Backup/Restore stamps and honors that version, so a backup from an older build restores cleanly into a newer one. The `.vN` suffix on a key name guards nothing by itself - the runner is the seam. Keep `test/backup.test.js` green.
- **SW cache version is part of the change, not a follow-up.** Whenever you touch ANY file listed in `music/sw.js` `CORE` (any profile, `songbook.js`, `tracks.js`, `nav-history.js`, `diagram.js`, `tuner.js`, `audio.js`, `songs.json`, the CSS, etc.), bump `CACHE = 'music-vN'` in the SAME commit. Skipping the bump means returning users keep the cached old asset until they manually clear it. Cheap to do; invisible-until-it-isn't to skip. **The bump is a PAIR since M-SETTINGS-CLARITY:** also refresh `shared/build-stamp.js` (`VERSION` = the new CACHE string, `UPDATED_ISO` = now, UTC) in the same commit - `scripts/check-cache-bump.sh` fails on a stamp-less bump or a VERSION/CACHE drift, and `test/build-stamp.test.js` fails the suite on drift too.
- **One screen, above the fold (always preferred).** Maximize what's usable without scrolling on a phone: keep the header minimal, cut redundant controls, size content to the viewport (`100dvh`, orientation-aware grids). Before adding UI, ask "does this push the primary action below the fold?" — if yes, reclaim space first. Portrait and landscape each get a layout that fills the screen.
- **Test the real box.** Prefer live Playwright against the served app (the box OOMs on full e2e suites — run ONE scenario at a time, commit first). Node unit tests via `node test/run-all.js` must stay green.

## Preview links & review (githack)

When a change needs review or phone-testing, **surface a githack preview link** — reviewable on a phone over https (the mic tuner needs https), no merge needed. Two forms:

| Form | URL shape | When |
|---|---|---|
| **Branch (DEFAULT)** | `https://raw.githack.com/nhruska/nhruska.github.io/<branch>/music/play/` | **Always, by default.** Stays current as you push more commits to the branch, so the reviewer keeps testing the latest. Slashed branch names (`claude/music-...`) DO resolve on githack — verified; the old "use the SHA, slashes break the path" note is retired. |
| **Commit (SHA)** | `https://raw.githack.com/nhruska/nhruska.github.io/<full-sha>/music/play/` | ONLY for testing a specific feature/commit **in isolation** (frozen), OR when other commits already on the branch would conflict with or confuse this test. |

Rules of thumb:
- **Default to the branch link.** Only reach for the commit-pinned link when isolation is the point.
- Always **curl-verify** the link is `200` before handing it over, and make it a live tappable markdown link (per the global tappable-links discipline). When the user is on their phone, also send it via the telegram surface.
- `.github/workflows/pr-preview.yml` posts these automatically on every PR (per-instrument tuning links + labelled Commit / Branch / Deployed links). The per-instrument links default to the **branch** form; the **Commit** labelled link is there for isolated testing.
- **Merged work:** link the DEPLOYED GitHub Pages URL (https://nhruska.github.io/music/play/) - never a githack link. Commit-pinned githack URLs 404 after merge (branch deleted - commit garbage-collected); branch-level githack URLs die with the branch too.
- **Open PR:** the branch-level githack link is the default tap target (tracks every push during the PR's life).
- **Commit-pinned githack links** are for isolated per-commit testing ONLY, always labeled "(expires after merge)" - NEVER send one to Telegram or put one in a CTA/footer as the primary link.
- **The app's "must be served over http(s)" boot banner** also fires on a dead-commit 404 (any manifest fetch failure) - if a preview link shows it, suspect an expired commit link first, not a serving-scheme problem.

## CI
- `.github/workflows/tests.yml` runs `node test/run-all.js` (the node unit suite) on PRs.
- `.github/workflows/pr-preview.yml` posts the githack preview comment.
- No other CI gates merging; it's a personal static site.

## Element Consistency Law (operator directive 2026-07-04, standing)

Every UI element class has ONE primitive; every view COMPOSES primitives; two different meanings never share one look; UAT consistency findings are fixed at the PRIMITIVE, never the instance; divergence is a lint failure. Canonical: [engineering-wiki/systems/ssot-registry.md](engineering-wiki/systems/ssot-registry.md) (the law + registry) + [engineering-wiki/ux-philosophy/component-conventions.md](engineering-wiki/ux-philosophy/component-conventions.md) (the conventions).
