<!-- GENERATED from music/engineering-wiki/: systems/runtime-architecture.md, systems/offline-pwa.md, systems/data-model.md, theory-engine/architecture.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Architecture

How the Music app runs: a static, no-build PWA with a pitch-class theory core, a versioned data model, and an offline-first service worker.

## Static, no-build runtime

Pure HTML + vanilla JS. Classic `<script>` tags, relative paths, no bundler, no npm build. Served by GitHub Pages (any local HTTP server works too; the mic tuner needs a secure context - `https`, or `localhost`). Every module exports to `window` (`window.Songbook`, `window.Circle`, ...).

Load order is dependency order (`music/play/index.html`, script block ~lines 266-281):

```
theme -> nav-history -> queue -> tempo -> circle -> key-explorer -> list-item
-> notables -> repertoire -> repertoire-form -> songbook -> tuner -> diagram
-> audio -> tracks -> candidates -> inline bootstrap
```

**Boot sequence** (the inline bootstrap):

1. Fetch `profiles/manifest.json` -> ordered profile ids.
2. `Promise.allSettled` load of `profiles/<id>.js` (tolerates individual failures).
3. Active profile priority: `?p=<id>` query > legacy `#<id>` hash > `localStorage music.activeProfile.v1` > manifest order > `Object.keys` fallback.
4. Build the instrument picker (grouped by instrument) + Tune-tab tuning chips.
5. Fetch `songs.json`.
6. `Songbook.mount({ songs, chordPack, storagePrefix, getTracks, openStudio, seedBackingKey, ... })`.

**Node/browser duality:** every shared module ships a UMD tail (`module.exports` + window global) so Node tests run without a DOM. Cross-module references use guarded refs (e.g. `tracks.js` `circleRef()`: `global.Circle || require('./circle.js')`) so both browser load order and Node `require` resolve.

**Profile-as-primitive:** an "instrument" IS a tuning profile (guitar-standard and guitar-dropd are siblings). Diagrams, audio, scale maps, and storage namespace all key off the active profile; switching instruments remounts with a different chord pack and a different `storagePrefix`.

## The chord-pack adapter - the only instrument-specific seam

`buildAdapter(profile)` wraps pure profile data into one contract consumed everywhere:

| Method | Purpose |
|---|---|
| `hasChord(name)` | voicing exists on this tuning? |
| `diagram(name, size)` / `diagramChain(names, size)` | fingering SVG(s) - small grid / big overlay |
| `playChord(name)` / `playNote(name)` | Web Audio strum / reference tone |
| `scaleDiagram(rootPc, scalePcs, frets, startFret, names)` | fretboard scale map, position-walk capable |
| `init(engine)` | tuner mount + quick-tune wiring |
| `meta` | instrument/tuning/strings info |

Notable behaviors: **enharmonic tolerance** (a canonical-sharp request finds a flat-keyed fingering via respelling retry), **movable-voicing fallback** (closed shapes slide up the neck for transposed keys; exact -> movable -> name-only), and **artifact-aware ukulele shapes** (C/F/A-shape barre templates inject when the 4-string top-interval pattern matches, aligning I-IV-V chains with the triad-inversions pedagogy).

## Theory core: pitch-class math, spelling is a display layer

The engine computes on pitch classes (integers 0-11): intervals, diatonic qualities, scale degrees, key relationships, transposition. None of that depends on how a note is spelled.

| Computation | Source | Result |
|---|---|---|
| Scale intervals | `Circle.MODE_STEPS` | Semitone formula per mode (Major = `[0,2,4,5,7,9,11]`) |
| Diatonic triads | Stacked thirds within the mode | Pitch class + quality, roman degree + case |
| Scale degrees | Interval comparison vs Major | `"1 2 b3 4 5 6 b7"` (aeolian) |
| Key relationships | Tonic + mode name | Neighbor roots (fifth up/down, relative) |

Because the naming policy only affects display, it is swappable (per release, eventually per user) by changing three name-emitting surfaces - the theory math, tests, and stored data never move. Full spelling contract: see [THEORY.md](THEORY.md).

`Circle.MODE_STEPS` is the single source of truth for every mode's step pattern; `Songbook` re-syncs from it at load time so the two never drift.

## Data model at a glance

| Store | Shape | Notes |
|---|---|---|
| `songs.json` | `{ t, a, y, d, seq[], sheet[[section,line]...], jam? }` | chord tokens match `^[A-G][#b]?...`; `y`/`d` must agree |
| `tracks.json` | `{ title, artist, genre, key, mode, bpm?, capo?, yt?, tags? }` | `trackKey` = `[title, artist, key, mode].join('|').toLowerCase()` |
| Merged repertoire | songs + matching tracks, one list | title+artist match, key tiebreak, `_used` marking |
| `localStorage` | namespaced (`songbook.`, `roadcase-<id>`, `bt.`, `music.`) | every reader is defensive (try/catch -> safe default) |

`SCHEMA_VERSION` (currently 1) gates ADDITIVE vs BREAKING storage changes - additive needs nothing; breaking bumps the version and ships a `MIGRATIONS[n]` step in the same commit. Full contract: [DATA-MODEL.md](DATA-MODEL.md).

## Offline: service worker and CACHE discipline

`music/sw.js` scopes over `play/` + `shared/` + `backing-tracks/`. It precaches a CORE list (app shells, manifest, icons, every profile, all shared runtime JS/CSS, `songs.json`, `tracks.json`, `notables.js`) at install.

- **Same-origin fetches:** network-first (fresh online, cache fallback offline) - `songs.json`/`tracks.json` are mutable, so online users must see the latest.
- **Cross-origin fetches:** cache-first (fonts/icons rarely change).
- **The law:** touch ANY CORE-listed file -> bump `CACHE = 'music-vN'` in the same commit. Skipping it means returning users keep serving the stale precache invisibly. Current: `music-v78`.
- Offline works fully except YouTube playback (explicit tap, degrades to search).

Full detail: [DATA-MODEL.md](DATA-MODEL.md) (data model) and the wiki's [systems/offline-pwa.md](../systems/offline-pwa.md) (service-worker source page).

## Related generated docs

[THEORY.md](THEORY.md) - the full spelling/harmonization/scales contract. [DATA-MODEL.md](DATA-MODEL.md) - storage shapes + instrument profiles. [DEV-GUIDE.md](DEV-GUIDE.md) - how to verify and ship a change here.
