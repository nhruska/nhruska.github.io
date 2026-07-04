# Music

A pocket-sized practice app for guitar, ukulele, banjo, mandolin, and a few other tunings. No install, no account, no build step - open it and play.

Live app: [nhruska.github.io/music/play/](https://nhruska.github.io/music/play/)

## What it does

**Library** - your songs and backing tracks in one list. Open a song and get the lyrics with chords right above the words, transposable to any key.

**Compose** - pick a key and mode, build a chord progression from a smart suggestion list, and see roman numerals update live. Every chord is theory-checked: the app will not show you a chord that does not belong in the key you picked.

**Studio** - the practice hub. Given a key (and optionally a backing track), it shows you the scale to solo over on a real fretboard, the chords in that key (tap to hear them), and a short "why" explainer for the relationships between them. Solo scale chips let you switch between the full mode scale, major pentatonic, minor pentatonic, and blues without leaving the screen.

**Tune** - a mic-based tuner with reference tones, one tap away from wherever you are in the app.

Everything works offline once loaded. The only thing that needs a network connection is playing a YouTube backing track.

## Who it is for

Whether you read music fluently, just picked up an instrument last week, or have twenty years of neck time and want the theory to catch up to your hands, the app adapts what it shows without ever talking down. See [engineering-wiki/generated/UX-PHILOSOPHY.md](engineering-wiki/generated/UX-PHILOSOPHY.md) for the full picture of who this is built for.

## Quick dev start

No build step. It is classic HTML and JavaScript behind `<script>` tags - open `music/play/` in a browser (any local static server works; the mic tuner needs `https` or `localhost`) and edit files directly.

Run the test suite from the repo root:

```
node test/run-all.js
```

That is dependency-free (pure Node `assert`, no `npm install`) and is what CI runs on every PR.

See [engineering-wiki/generated/DEV-GUIDE.md](engineering-wiki/generated/DEV-GUIDE.md) for the full verify-and-ship bar, and [engineering-wiki/generated/CONTRIBUTING.md](engineering-wiki/generated/CONTRIBUTING.md) for the constraints worth knowing before you change anything.

## Where things live

- `play/` - the app shell (the real product): Library, Jam, Compose, Tune.
- `shared/` - the instrument-agnostic engine (theory, chord diagrams, audio, storage) used by every instrument profile.
- `sw.js` - the service worker that makes the app installable and work offline.
- `dev/` - phone-to-laptop data curation helpers.
- `engineering-wiki/` - the canonical system documentation. Start at [engineering-wiki/generated/ONBOARDING-BRIEF.md](engineering-wiki/generated/ONBOARDING-BRIEF.md) if you are new here.

## Documentation

The canonical source of truth for how this app works is the engineering wiki at `engineering-wiki/`. The `engineering-wiki/generated/` folder holds standalone, synthesized documents rendered from the wiki - read those for a fast, complete picture; go to the wiki's own pages when you need the underlying anchors (file and line references) for a specific claim.

| Doc | What it covers |
|---|---|
| [ONBOARDING-BRIEF.md](engineering-wiki/generated/ONBOARDING-BRIEF.md) | Start here if you are new: read order, the contracts that bite, a routing table |
| [ARCHITECTURE.md](engineering-wiki/generated/ARCHITECTURE.md) | Runtime, offline caching, data model, theory core overview |
| [THEORY.md](engineering-wiki/generated/THEORY.md) | Note spelling, harmonization, solo scales, and how it is all verified |
| [UX-PHILOSOPHY.md](engineering-wiki/generated/UX-PHILOSOPHY.md) | Design constraints, personas, destructive-action guards, expertise-adaptive display |
| [DATA-MODEL.md](engineering-wiki/generated/DATA-MODEL.md) | Song/track shapes, storage namespaces, instrument profiles |
| [DEV-GUIDE.md](engineering-wiki/generated/DEV-GUIDE.md) | How to run, test, and ship a change |
| [CONTRIBUTING.md](engineering-wiki/generated/CONTRIBUTING.md) | Constraints and process, distilled for a first-time contributor |
| [TESTING.md](engineering-wiki/generated/TESTING.md) | Suite map and the theory canon's authority |
| [ROADMAP.md](engineering-wiki/generated/ROADMAP.md) | What is shipped, deferred, and backlogged |
| [DECISIONS.md](engineering-wiki/generated/DECISIONS.md) | Rulings that should not be re-litigated without an explicit proposal |
