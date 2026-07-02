# Backing Tracks - design

> Status: design, pre-code. Directory name `music/backing-tracks/` is provisional and functional; rename before code if a better functional name lands. No phony product names.

A harmony-practice tool wearing a backing-track finder. Lives in the existing
Music app ([nhruska.github.io/music/play/](https://nhruska.github.io/music/play/))
as a sibling surface that reuses `music/shared/`.

## North star

Practice that grows your harmony, with a finder fast enough to never embarrass
you live.

## The soul (center of gravity)

This is a **harmony teacher**. The backing-track finder is the daily-habit hook
that gets you in the door; the teaching is the point. Growth here means
**harmony you currently avoid** - not new genres. Genre is only a *filter* for
finding tracks, never a growth target.

Decided in interview:
- Audience: **me first, clean edges so a stranger benefits too** - never at the
  cost of the personal-curation feel.
- Why: **grow as a musician** (teacher, not jukebox).
- Growth dimensions: **new chord forms, new keys, the why** (theory). NOT genres.
- Personality: **push, but gentle** - ignorable nudges, never naggy.
- Player level: **varies by instrument** - push harder on the strong instrument,
  scaffold on the one being learned (maps onto the existing profile system).
- Hard guardrail: **too slow live is a dealbreaker** - stage speed is sacred.

## The spine: the circle of fifths

The three growth dimensions are not three features - they are three views of one
object. Keys are *positions* on the circle. Chord relationships are *derived*
from it. The "why" *is* it. So the circle of fifths is the **home and the
navigation** of the teaching surface: tap a key on the wheel and get its
relatives, its chords (including the stretch voicings), backing tracks in that
key, and the neighbors worth exploring next.

## The shape: one surface + a Stage *view* (not two modes)

One rich surface that teaches and explores. A **Stage view** toggles on and
*strips* it to instant retrieval: huge targets, favorites + recent, the blessed
library, two taps to playing, nothing to read. Same data, a view toggle - cheap
to build, and it keeps the stage path carrying no teaching weight and no network
in its critical path. This is how "grow" and "too slow live" stop fighting.

The Stage view is the existing Perform mode (stage-dim + auto-scroll) pointed at
the track library instead of a song sheet.

## The compounding loop

Every track you bless grows the library; every new key/chord you try gets logged
- which feeds both the Stage library and the nudge engine's sense of your range.
Use it and it gets more yours. The wasteful YouTube search becomes permanent
curation: search once, never again.

## Anti-vision (design against these)

- **No bloat.** One surface + one view toggle. Never a dashboard. Feature creep
  is the named enemy.
- **Stage speed is sacred.** Curated library is local; the only online dependency
  (YouTube playback) sits behind an explicit tap; degrades gracefully offline
  (the PWA already does this).
- **Never still a search.** If you are sampling and judging tracks live, it
  failed. Judgment happens off-stage, calmly, once.

## Reuse map - mostly assembly, not from scratch

| Capability | Status in the app | Plan |
|---|---|---|
| Key / transpose math | exists (`Songbook.tpose`, `ROOTS`, `chordRootFreq`) | thin helper for relative/parallel-key expansion |
| Chord-progression builder + suggestions | exists (Compose tab: `composeCats`, `suggestions`) | extend with extended/altered voicings |
| Stage view | exists (Perform mode: stage-dim, auto-scroll) | point it at the track library |
| Chord diagrams | exists (`diagram.js`) | reuse for stretch-voicing display |
| Audio (strum/tone) | exists (`audio.js`) | reuse |
| Mic capture | exists (`tuner.js`) | reuse only if a capture feature ships (see cut below) |
| Offline-first | exists (PWA `sw.js`) | the graceful-degrade story is native |
| Genre x key backing-track finder | NEW | `tracks.json` + finder UI |
| Circle of fifths | NEW | shared SVG component, sibling to `diagram.js` |
| Gentle nudge engine | NEW | reads existing localStorage usage history |

## Data model - `tracks.json` (sketch, separate from `songs.json`)

`songs.json` holds internal chord-sheet songs (with a `jam` flag for in-app
jam-starters). Backing tracks are a different thing - external YouTube tracks
you solo/practice over - so they get their own catalog:

```jsonc
[
  {
    "yt": "dQw4w9WgXcQ",   // YouTube id (playback + the smart-search fallback)
    "title": "Slow blues backing track",
    "genre": "blues",       // filter axis only, never a growth target
    "key": "A",             // root
    "mode": "minor",        // major | minor | dorian | ...
    "bpm": 70,
    "capo": 0,              // for capo-transposition suggestions
    "rating": 5,            // personal vetting score
    "tags": ["slow", "12-bar"]
  }
]
```

Theory expansion: a track tagged `C major` is offered for `A minor` practice
(relative keys), widening the pool per key for free via the existing key math.

## Tech constraints (from the repo CLAUDE.md)

- Static GitHub Pages, **no build step**, classic `<script>` tags, vanilla JS,
  served from `main`.
- Reuse `music/shared/` exactly once - do not duplicate the runtime.
- YouTube playback via the IFrame Player API (online); offline or no key -> the
  app builds the perfect YouTube search URL and opens it (deterministic query
  generation, zero API cost). Any live YouTube Data API key must be
  HTTP-referrer-restricted.
- Verification bar: `node -c` changed JS, `JSON.parse` the catalog, unit-test
  any logic in Node. No headless browser - state what was eyeballed vs tested.

## Phasing (each phase ships on its own)

1. **Backing-track finder + Stage view** - genre x key -> curated `tracks.json`,
   relative-key expansion, smart-search URL fallback, save-to-curate. The habit
   hook. (Stage view is cheap - it is Perform mode.)
2. **Key explorer / circle of fifths** - interactive wheel, per-key chord forms,
   the "why", new-keys exploration. The soul.
3. **Gentle nudge engine** - reads the usage history phases 1-2 generate. "You
   keep jamming in Am - C#m is one hop away; here is a track and the 3 chords."
4. ~~Record-over studio~~ - **cut.** See decision below.

## Decisions log

- **Record-over studio: cut.** A browser overdub against a YouTube IFrame cannot
  get sample-accurate sync or low-latency monitoring (you do not own the embed's
  audio buffer), and it is the single most bloat-prone piece against the "too
  slow / too bloated" guardrail. The salvageable kernel - "capture my playing" -
  survives, if wanted, as an optional **sync-free discovery memo** (record a lick
  or new voicing with no backing track overlaid). That sidesteps sync entirely
  and serves the woodshed. Default: dropped; revisit only if the discovery-memo
  earns its place.
- **Stage is a view, not a mode** (user correction). Less surface to maintain.
- **Functional naming only** - no product names. This directory name is
  provisional and functional.
- **Persona focus-group validation** deferred to its own primitive:
  [claude-config #529](https://github.com/nhruska/claude-config/issues/529) -
  roleplay personas under varied conditions to pressure-test this UX later.

## Open questions

- Final functional name for the surface and the wheel.
- Where reusable difficulty defaults live per profile.
- Phase-1 `tracks.json` seed: which 5-6 tracks to hand-curate first.
