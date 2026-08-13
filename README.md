# nhruska.github.io

Personal site for Nik Hruska, served by GitHub Pages from `main` at https://nhruska.github.io/.

Two parts live here: a portfolio landing page at the root, and the **Music app** - the real product - under `music/`.

| Page | URL |
|---|---|
| Portfolio | https://nhruska.github.io/ |
| Music launcher | https://nhruska.github.io/music/ |
| Music app | https://nhruska.github.io/music/play/ |

## Structure

```
/
├── index.html               # portfolio landing (Problem Solutions brand, dark)
├── scripts/                 # site tooling (portfolio generator, validators, ops)
│   ├── template.html        #   portfolio page template
│   ├── data.json            #   curated portfolio content
│   └── generate.py          #   stdlib-only builder: template + data + GitHub API -> index.html
├── music/
│   ├── index.html           # launcher (cards -> the app)
│   ├── play/                # the app shell (tabs: Songs / Compose / Tune)
│   ├── shared/              # instrument-agnostic runtime: songbook, tracks/Studio,
│   │                        #   tuner, theory, diagrams, audio, CSS, per-instrument profiles
│   ├── backing-tracks/      # curated YouTube backing-track catalog (tracks.json)
│   ├── sw.js                # service worker: offline + installable PWA
│   ├── engineering-wiki/    # canonical system knowledge for the app
│   └── CLAUDE.md            # app conventions (cache-bump law, note spelling, testing)
└── test/                    # node unit suite + declarative Playwright scenarios (test/pw/)
```

## The Music app

A static, no-build-step PWA: classic script tags, vanilla JS, external CSS. It works offline once visited (service-worker cached), installs to a phone home screen, and supports multiple instruments via profiles (ukulele, guitar, banjo, mandolin, mandola) - switch with the `?p=` query, e.g. `music/play/?p=guitar-standard`.

What it does: a harmony teacher wrapped in a music player. Tap a jam to play its backing track, solo over it with the key-aware fretboard and circle-of-fifths Studio, build and save chord progressions, keep a setlist, tune with the mic. YouTube embeds stay behind an explicit tap and the video hides by default - audio-first.

The build stamp in Settings (e.g. `v329-6`) names the exact PR that produced the deployed build.

## Development

There is no build step - edit, test, push. Conventions that bite live in [music/CLAUDE.md](music/CLAUDE.md) (service-worker cache-bump pairing, key-aware note spelling, storage schema rules) and the [engineering wiki](music/engineering-wiki/) is canonical for system knowledge.

Tests:

```
node test/run-all.js                                   # unit suite (runs in CI on PRs)
python3 test/pw/run-scenario.py test/pw/scenarios/<name>.json   # one Playwright usage flow
```

Workflows: `tests.yml` (unit suite on PRs), `pr-preview.yml` (posts tappable githack preview links on PRs), `playlist-sync.yml` (manual playlist-to-catalog sync), `cc-nightly.yml` (command-center snapshot), `retry-pages-deploy.yml` (Pages deploy retry).

## The portfolio page

The root `index.html` is built by `scripts/generate.py` (stdlib only) from `scripts/template.html` + `scripts/data.json` + the public GitHub API. The old daily auto-regeneration workflow is retired (`build.yml.disabled`) - regenerate manually when the portfolio content changes:

```
python scripts/generate.py     # writes ./index.html
```

If the GitHub API is unreachable it reuses the last-good repo list embedded in the current page, so it never ships a broken section.

## Conventions

- **No build step, no dependencies.** Everything is served as authored.
- **Two registers.** The root portfolio uses the Problem Solutions brand; the Music app has its own theme with a user-selectable accent.
- **https unlocks the mic.** The tuner needs https (fine on Pages, blocked on `file://`).
- **Lyrics / IP.** The songbook shows only short chord-over-lyric snippets and links out for full lyrics; no copyrighted media is bundled.
