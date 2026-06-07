# Shared Songbook - the cross-instrument contract

This folder holds the songbook runtime, shared by every instrument tool under
`music/` (ukulele today, guitar next). The point is anti-proliferation: there
is ONE songbook (catalog + search + chord-over-lyric rendering + setlist +
perform mode). Each instrument adds only a small "chord pack" with its own
fingerings, audio, and tuner. No duplication, no build step, no framework.

```
music/
  shared/
    songs.json          <- THE song catalog (single source of truth)
    songbook.js         <- THE engine (instrument-agnostic). Global: Songbook
    songbook.css        <- THE styles (theme + all components)
    chords-ukulele.js   <- ukulele chord pack. Global: ChordPackUkulele
    README.md           <- this file
  ukulele/
    index.html          <- ukulele page: loads shared modules + ukulele pack
  guitar/
    index.html          <- (future) guitar page: same shared modules + chords-guitar.js
    chords-guitar.js     would go in shared/ alongside chords-ukulele.js
```

Everything loads as plain classic `<script>` / `<link>` tags via relative
paths. It must be served over http(s) (GitHub Pages or a local server) because
the catalog is fetched with `fetch()`. A `file://` open shows a friendly error.

---

## How to build a new instrument tool (the 3-step recipe)

1. Copy `chords-ukulele.js` to `chords-<instrument>.js`. Swap the instrument
   data (chord fingerings, open-string frequencies, tuner string list, tuning
   label) and keep the SAME exported shape. Expose it as a global, e.g.
   `window.ChordPackGuitar`.
2. Copy `music/ukulele/index.html` to `music/<instrument>/index.html`. Change
   the `<script src="../shared/chords-ukulele.js">` line to your pack, and the
   `chordPack:` value in the bootstrap to your global. Keep the markup IDs
   identical (the engine and the pack both reference them by id).
3. Done. The catalog, search, transpose, chord-over-lyric sheets, setlist,
   perform/auto-scroll, and compose grid all work unchanged.

You do NOT touch `songs.json`, `songbook.js`, or `songbook.css`. If you find
yourself editing those for an instrument reason, the abstraction has a leak -
fix the pack interface instead.

---

## 1. `songs.json` schema

A JSON array of song objects. This is the exact shape lifted from the original
inline catalog - do not redesign it without versioning.

```jsonc
[
  {
    "t": "Let It Be",          // title (string, required)
    "a": "The Beatles",        // artist (string, required)
    "y": 1970,                  // year (number, required)
    "d": "70s",                // decade bucket / filter key (string, required)
                                //   matches the engine's `decades` chips
    "seq": ["C", "G", "Am", "F"], // chord NAMES used, in order (string[], required)
                                //   shown on the song card + used for transpose
    "sheet": [                  // the chord-over-lyric body (array of [section, line])
      ["Verse", "[C]When I find myself in [G]times of trouble"],
      ["",      "[Am]Mother Mary [F]comes to me"]
    ]
  }
]
```

`sheet` rules:
- Each entry is a 2-tuple `[section, line]`.
- `section` is a heading ("Verse", "Chorus", ...). Empty string `""` means
  "continue the previous section" (no new heading rendered).
- `line` is a lyric line with inline chords in square brackets: `[C]lyric`.
  The chord name sits immediately before the syllable it lands on. Chord names
  are instrument-agnostic (C, G, Am, F#m7, Bb, ...). The engine renders them
  identically for every instrument; the chord pack only matters for diagrams
  and sound.

Chord names accepted by the transpose engine: root `[A-G]` plus optional `#`
or `b`, plus any quality suffix (`m`, `7`, `maj7`, `m7`, `sus4`, ...). Flats
are normalized to sharps for transposition math.

---

## 2. `songbook.js` public API

Exposes a single global `Songbook` (classic script, no module system).

### `Songbook.mount(opts) -> controller`

Mounts the songbook into existing DOM. Call once after the DOM and the chord
pack scripts have loaded, with the catalog already fetched.

```js
var controller = Songbook.mount({
  songs:        [...],                 // REQUIRED: array in songs.json shape
  chordPack:    window.ChordPackUkulele, // optional; null => names-only, no audio/diagrams
  storagePrefix:'roadcase',            // optional; localStorage namespace (default "songbook")
  decades:      ["All","70s",...,"10s"], // optional; filter chips
  composeCats:  {...},                 // optional; chord categories for the compose grid
  suggestions:  {...},                 // optional; chord -> [next chords] progression hints
  contexts:     { library:"...", ... },  // optional; per-tab subtitle text for #ctxLine
  el: { ... }                          // DOM element refs (see below)
});
```

`opts.el` is a map of element references. Every field is optional - a missing
element simply disables that piece of UI (so a minimal page can mount just the
library). The fields, grouped by feature:

| Feature   | el fields |
|-----------|-----------|
| Library   | `songsList`, `decadeChips`, `search`, `libCount` |
| Practice  | `practiceEmpty`, `practiceBody` |
| Setlist   | `setBody`, `setBar`, `setCount`, `setClear`, `performBtn` |
| Perform   | `perform`, `pSheet`, `pPos`, `pTitle`, `pArtist`, `pKeyLine`, `pPrev`, `pNext`, `pClose`, `pUp`, `pDown`, `pDimBtn`, `pScroll`, `pSpeed`, `pSpeedR`, `pSpeedV` |
| Compose   | `prog`, `suggest`, `catChips`, `buildGrid`, `cClear`, `cSave`, `cMax` |
| Maximize  | `maxOv`, `maxGrid`, `maxClose` (chord-diagram overlay) |
| Chrome    | `ctxLine` (header subtitle) |

The engine also queries `.tabbar button[data-tab]` and `.screen` by id
(`s-library`, `s-compose`, `s-practice`, `s-setlist`, `s-tune`) for tab
switching. Keep those class/id conventions in your markup. The reference
markup is `music/ukulele/index.html` - copy it.

### Returned controller

```js
controller.switchTab(name)  // "library" | "compose" | "practice" | "setlist" | "tune"
controller.openSong(id)     // open a song in the Practice tab by engine id
controller.getState()       // live STATE object (read-only intent)
controller.getSongs()       // ALLSONGS (catalog + custom progressions), each with an `id`
controller.rebuild()        // re-render after external catalog/custom changes
```

### Static helpers (for chord packs / tests)

```js
Songbook.tpose(chord, semitones)   // transpose a chord name
Songbook.tposeLine(line, semitones)// transpose all [chords] in a lyric line
Songbook.splitChord(chord)         // -> { root, qual } or null
Songbook.chordRootFreq(chord)      // root frequency (Hz) relative to middle C
Songbook.renderSheet(song, st, view) // view: "lyrics" | "chords"
Songbook.ROOTS                     // ["C","C#",...,"B"]
```

### Persistence

The engine persists two things in `localStorage`, namespaced by
`storagePrefix`:
- `<prefix>.setlist.v1` - the current setlist (array of song ids)
- `<prefix>.custom.v1`  - user-composed progressions

Use a distinct `storagePrefix` per instrument if you want separate setlists, or
the same prefix to share. The ukulele page uses `"roadcase"`.

---

## 3. Chord-pack interface

A chord pack is the ONLY instrument-specific code. It is optional: if you mount
the songbook with `chordPack: null`, everything still works in "names only"
mode (chord names render, transpose works, no diagrams, no sound, no Tune tab
wiring).

A pack exposes one global object with this shape. All methods are optional
except `hasChord` (needed for transpose playability checks when a pack is
present). Missing methods degrade gracefully.

```js
window.ChordPackGuitar = {
  // --- metadata (informational; surface it in your own UI if you like) ---
  meta: {
    instrument: "guitar",
    tuning: "EADGBE",
    strings: 6,
    stringNames: ["E", "A", "D", "G", "B", "E"]
  },

  // --- REQUIRED when a pack is supplied ---
  // Does this exact (already-transposed) chord name have a fingering?
  // Drives whether a transposition is offered (engine only transposes to keys
  // where every chord in the song is playable on THIS instrument).
  hasChord: function (name) { /* -> bool */ },

  // --- diagrams ---
  // Return a DOM element for a fingering chart.
  // size: "small" (compose grid + progression slots) | "big" (maximize overlay)
  // Convention: small uses class "chord" with a child ".chord-name";
  //             big uses class "bigC" with a child ".nm".
  // (Those classes are styled in songbook.css.)
  diagram: function (name, size) { /* -> HTMLElement */ },

  // --- audio ---
  playChord: function (name) { /* strum/voice the full chord */ },
  playNote:  function (name) { /* a single representative tone for the chord */ },
  playFreq:  function (freq, durSeconds) { /* raw tone fallback */ },

  // --- tab lifecycle hooks ---
  onLeaveTuner: function () { /* silence any tuner drones when leaving Tune */ },
  onSwitchTab:  function (name) { /* optional: react to any tab switch */ },

  // --- wiring, called once after the engine mounts ---
  // `engine` gives you { switchTab, chordRootFreq, tpose } so the pack can
  // build its own tab (e.g. the Tune tab) and hook buttons like #quickTune.
  init: function (engine) { /* build tuner UI, wire #quickTune, etc. */ }
};
```

### What the pack owns vs what the engine owns

| Concern | Owner |
|---|---|
| Song catalog, search, decade filter | engine |
| Chord NAME rendering (chord-over-lyric, chord chart) | engine |
| Transpose math | engine |
| Setlist add/remove/reorder, persistence | engine |
| Perform mode + auto-scroll + stage dim | engine |
| Compose grid layout + suggestions + save | engine (calls pack for diagrams/audio) |
| Chord FINGERINGS / diagrams | pack |
| All audio (strum, tone, drone, beats) | pack |
| The Tune tab (drones, beat method, relative guide, mic auto-tuner) | pack |

The Tune tab is entirely the pack's responsibility because it is inherently
instrument-specific (string count, open frequencies, tuning method). The pack
builds it in `init()` against markup the host page provides (`#tStrings`,
`#relGuide`, `#micBox`, `#tCanvas`, `#beatIn`, `#beatOff`, `#quickTune`). The
engine only tells the pack when the user leaves the Tune tab
(`onLeaveTuner`) so drones can be stopped.

### Mic auto-tuner note

The mic needle needs a secure context (`window.isSecureContext` true, which
holds over https AND on `http://localhost`). Over a plain remote http origin or
a `file://` open it is unavailable and the pack shows a graceful "host it on
GitHub Pages" message instead. This is unchanged from the original app.

---

## Design decisions (what stayed, what moved)

- The whole song catalog moved to `songs.json` (was an inline `CATALOG` array).
- All engine logic (transpose, sheet render, library, practice, setlist,
  perform, compose orchestration) moved to `songbook.js`, instrument-agnostic.
- All ukulele specifics (the `CHORDS` fingering map, `STR_OPEN` frequencies,
  the `UKE` tuner strings, SVG diagram rendering, the WebAudio strum/tone/
  drone/beat code, and the entire Tune tab build) moved to `chords-ukulele.js`.
- All styles moved to `songbook.css` (theme variables + every component),
  including the Inter + Space Mono font import, so a new instrument page gets
  the dark-teal look with one `<link>`.
- The `SUGG` progression-suggestion map and `CONTEXTS` per-tab subtitles are
  passed in from the host page bootstrap (they are shared content, but kept
  near the page so they are easy to tweak per tool). The engine ships sensible
  defaults for `composeCats` and `decades`.
- Behavior is preserved 1:1 with the original single-file Roadcase app - this
  was an extraction, not a redesign.
