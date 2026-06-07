# nhruska.github.io

Personal site for Nik Hruska, served at https://nhruska.github.io/.

The **root** is a Problem Solutions brand portfolio (dark mode). Personal builds live in their own sections, each a self-contained single-file app - no build step.

## Structure

```
/
├── index.html              # portfolio (Problem Solutions brand, dark)
└── music/
    ├── index.html          # music hub (instrument-grouped: Ukulele · Guitar)
    └── ukulele/
        ├── index.html      # Roadcase — ukulele performance kit (tuner + composer + songbook + perform)
        └── composer/
            └── index.html  # Uke Composer — lighter standalone chord builder + tuner
```

URLs:

| Page | URL |
|---|---|
| Portfolio | https://nhruska.github.io/ |
| Music hub | https://nhruska.github.io/music/ |
| Roadcase | https://nhruska.github.io/music/ukulele/ |
| Uke Composer | https://nhruska.github.io/music/ukulele/composer/ |

## Add a build

1. Drop the app folder where it belongs (a new instrument under `music/`, or a new top-level section).
2. Add one entry to the data array:
   - Portfolio section -> `BUILDS` array in `index.html`.
   - Music tool -> `PROJECTS` array in `music/index.html`.
3. Commit / push. The card renders itself - tile, filters, search and counts are automatic.

## Conventions

- **Single-file apps.** Each tool is one `index.html` (inline CSS + JS). No dependencies, no build.
- **Two registers.** The root portfolio uses the Problem Solutions brand (sky `#29AAE1`, Poppins, the PROBLEM SOLUTIONS wordmark). The music section keeps its own dark-teal aesthetic (`#5eead4`, Inter + Space Mono).
- **https unlocks the mic.** Roadcase's microphone auto-tuner needs https (works on GitHub Pages, blocked on local `file://`).
- **Lyrics / IP.** Music tools show only short chord-over-lyric snippets and link out to licensed full lyrics - never full lyrics.

## Deploy

GitHub Pages, deploy from `main` `/(root)`. https enforced.
