# nhruska.github.io

Personal site for Nik Hruska, served at https://nhruska.github.io/.

The **root** is a Problem Solutions brand portfolio (dark mode). Personal builds live in their own sections, each a self-contained single-file app - no build step.

The root `index.html` is **generated** (git-scraping style, after Simon Willison): a daily GitHub Action regenerates it from a template + curated data + the live GitHub API, then commits the result back to `main`. The music section stays hand-authored.

## Structure

```
/
├── index.html              # GENERATED portfolio (Problem Solutions brand, dark) — do not hand-edit
├── scripts/
│   ├── template.html       # the PS-brand page template (injection slots)
│   ├── data.json           # curated content: hero text, featured Music build, Elsewhere links
│   └── generate.py         # stdlib-only builder: template + data + GitHub API -> index.html
└── music/
    ├── index.html          # music hub (instrument-grouped: Ukulele · Guitar)
    └── ukulele/
        ├── index.html      # Ukulele performance kit (tuner + composer + songbook + perform)
        └── composer/
            └── index.html  # Uke Composer — lighter standalone chord builder + tuner
```

URLs:

| Page | URL |
|---|---|
| Portfolio | https://nhruska.github.io/ |
| Music hub | https://nhruska.github.io/music/ |
| Music app | https://nhruska.github.io/music/ukulele/ |
| Uke Composer | https://nhruska.github.io/music/ukulele/composer/ |

## Add a build

1. Drop the app folder where it belongs (a new instrument under `music/`, or a new top-level section).
2. Add one entry to the data source:
   - Portfolio "Builds" section -> `builds` array in `scripts/data.json`, then run `python scripts/generate.py` (or let the daily Action do it).
   - Music tool -> `PROJECTS` array in `music/index.html`.
3. Commit / push. The card renders itself - tile, filters, search and counts are automatic.

## Regenerate the portfolio

```
python scripts/generate.py     # writes ./index.html ; stdlib only, no deps
```

- The **Open source** section is built from `https://api.github.com/users/nhruska/repos` (public, non-fork, non-archived, freshest first). It runs unauthenticated locally (rate-limited) and authenticated in CI via the built-in `GITHUB_TOKEN`.
- If the API is unreachable, the build reuses the last-good repo list embedded in the current `index.html` (or falls back to a profile-link card) — it never ships a broken page.
- `.github/workflows/build.yml` runs `generate.py` on a daily schedule, on `workflow_dispatch`, and on pushes that touch `scripts/**`, then commits the regenerated `index.html` back to `main` with `[skip ci]`.

## Conventions

- **Single-file apps.** Each tool is one `index.html` (inline CSS + JS). No dependencies, no build.
- **Two registers.** The root portfolio uses the Problem Solutions brand (sky `#29AAE1`, Poppins, the PROBLEM SOLUTIONS wordmark). The music section keeps its own dark-teal aesthetic (`#5eead4`, Inter + Space Mono).
- **https unlocks the mic.** The music app's microphone auto-tuner needs https (works on GitHub Pages, blocked on local `file://`).
- **Lyrics / IP.** Music tools show only short chord-over-lyric snippets and link out to licensed full lyrics - never full lyrics.

## Deploy

GitHub Pages, deploy from `main` `/(root)`. https enforced.
