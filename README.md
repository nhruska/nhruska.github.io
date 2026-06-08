# nhruska.github.io

My personal site, live at https://nhruska.github.io/. Two parts: a Problem Solutions-branded portfolio at the root, and a set of browser music tools I actually use.

No build step, no dependencies, no framework. Plain HTML, CSS, and JavaScript, served straight off GitHub Pages.

## Structure

```
/
  index.html                static portfolio (Problem Solutions brand, dark), hand-authored
  music/
    index.html              music hub - one card per instrument
    play/index.html         the app: one shell, any instrument + tuning
    ukulele/index.html      redirect to play/?p=ukulele-gcea
    guitar/index.html       redirect to play/?p=guitar-standard
    shared/
      songbook.js           the engine: library, compose, practice, setlist, perform
      songbook.css          theme + every component
      songs.json            50-song catalog (chord-over-lyric snippets)
      tuner.js              microphone auto-tuner + reference tones
      diagram.js            generic N-string fretboard renderer
      audio.js              strum and tone synthesis (Web Audio)
      profiles/
        manifest.json       the live tunings, in display order
        *.js                one pure-data profile per tuning
  scripts/                  parked git-scraping generator (see "Parked", below)
```

## The music app

The interesting decision here is that instrument and tuning are the same primitive. A tuning profile is pure data:

```js
{ id: "mandolin-gdae", label: "Mandolin", strings: [{n,l,f}, ...], chords: { ... } }
```

The app reads the active profile and builds the chord pack the engine needs from that data plus the shared Diagram, ChordAudio, and Tuner modules. The engine itself knows nothing about ukuleles or mandolins.

Six tunings are live across four instruments:

| Instrument | Tunings |
|---|---|
| Ukulele | GCEA |
| Guitar | standard EADGBE, drop D, open G |
| Mandolin | GDAE |
| Mandola | CGDA |

### Add a tuning

1. Write `music/shared/profiles/<id>.js` (the profile data: strings, open frequencies, chord shapes).
2. Add `<id>` to `music/shared/profiles/manifest.json`.
3. If it is a new instrument, add a card to the `PROJECTS` array in `music/index.html`.

No engine changes. That is the whole point of the profile split.

## Parked

The root `index.html` was originally generated daily from the GitHub API (git-scraping, after Simon Willison): a scheduled Action rebuilt it from a template plus curated data plus a live repo list.

That build is parked. The repos it scraped were stale test projects, so the portfolio is hand-authored static HTML now. The generator is kept but inert (`scripts/`, and `.github/workflows/build.yml.disabled`). Reviving it means renaming the workflow back and refreshing `scripts/template.html` to the current brand.

## Conventions

- Two visual registers. The portfolio uses the Problem Solutions brand (sky `#29AAE1`, Poppins, the PROBLEM SOLUTIONS wordmark). The music section keeps its own dark-teal look (`#5eead4`, Inter + Space Mono).
- The auto-tuner needs https for microphone access. It works on GitHub Pages and is blocked on a local `file://` open, where the reference tones still let you tune by ear.
- Lyrics stay licensed. The songbook shows short chord-over-lyric snippets and links out to full lyrics. It never ships full lyrics itself.
- ASCII punctuation only in all copy. No em dashes, curly quotes, or ellipsis characters - they read as machine-default and break on paste.

## Run it locally

```
python3 -m http.server 8000        # then open http://localhost:8000/
```

The microphone tuner stays disabled on `localhost` and `file://` (browsers gate it behind https). Everything else works offline.

## Deploy

GitHub Pages, from `main`, root directory, https enforced.

| Page | URL |
|---|---|
| Portfolio | https://nhruska.github.io/ |
| Music hub | https://nhruska.github.io/music/ |
| Music app | https://nhruska.github.io/music/play/ |
