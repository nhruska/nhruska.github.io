# Shared Songbook - the cross-instrument contract

This folder holds the music runtime. Everything reusable is shared exactly
once; an instrument OR an alternate tuning is just **pure data** - a "tuning
profile." The point is anti-proliferation: there is ONE songbook, ONE tuner,
ONE diagram renderer, ONE audio engine, and ONE versatile app (`music/play/`)
that loads any profile. No duplication, no build step, no framework.

**The key idea: "instrument" and "tuning" are the same primitive.** A guitar in
DADGAD shares nothing with standard guitar except string count - different open
notes, different chord shapes. So the unit is a *profile*, not an instrument.

```
music/
  shared/
    songs.json          <- THE song catalog (single source of truth)
    songbook.js         <- THE engine (catalog/search/transpose/setlist/perform/compose). Global: Songbook
    songbook.css        <- THE styles (theme + all components)
    tuner.js            <- THE mic auto-tuner + reference tones. Global: Tuner
    diagram.js          <- THE generic N-string fretboard renderer. Global: Diagram
    audio.js            <- THE generic chord audio (strum/tone). Global: ChordAudio
    profiles/
      manifest.json     <- { "profiles": ["ukulele-gcea", ...] }  (load order)
      <id>.js           <- ONE pure-data tuning profile per file (self-registers)
    README.md           <- this file
    chords-ukulele.js   <- LEGACY (superseded by profiles/ukulele-gcea.js); unused
    chords-guitar.js    <- LEGACY (superseded by profiles/guitar-standard.js); unused
  play/
    index.html          <- THE versatile app. ?p=<id> picks the profile; in-app picker switches.
  ukulele/ , guitar/
    index.html          <- thin redirects into play/?p=ukulele-gcea / ?p=guitar-standard
```

Everything loads as plain classic `<script>` / `<link>` tags via relative
paths. It must be served over http(s) (GitHub Pages or a local server) because
the catalog + manifest are fetched with `fetch()`.

---

## The tuning-profile schema (the contract)

```js
// music/shared/profiles/<id>.js  - pure data, self-registers, NO other file edits.
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["guitar-dadgad"] = {
    id: "guitar-dadgad",          // matches the filename + ?p= value + manifest entry
    label: "Guitar - DADGAD",     // shown in the picker
    instrument: "guitar",          // groups the picker (optgroup)
    tuning: "DADGAD",
    // display order == fret-array order == left->right on the diagram (low string first)
    strings: [ { n: "D", l: "6th (low)", f: 73.42 }, /* ...note, label, Hz... */ ],
    // chord NAME -> fret per string; -1 = muted, 0 = open, n = fret. One entry per string.
    chords: { "C": [-1,3,2,0,1,0], /* ... */ }
  };
})(typeof window !== 'undefined' ? window : this);
```

`strings[i].f` are the open-string frequencies (Hz). The app derives the tuner
targets, the diagrams (via `Diagram.render`), and the audio (via `ChordAudio`)
entirely from this object - the profile is the only instrument-specific input.

## How to add an instrument or tuning (the recipe)

1. Create `music/shared/profiles/<id>.js` with the schema above. Author exact
   open-string Hz + musically-correct chord shapes. (Minimum useful set: the
   chords used by the catalog - A Am B Bb Bm C C#m D Dm E E7 Em F F# F#m G.)
2. Add `"<id>"` to `music/shared/profiles/manifest.json`.
3. Add a card to the `PROJECTS` array in `music/index.html` with `path:"play/?p=<id>"`.
4. Done. The app renders its diagrams, tuner, and audio with zero new code.
   (Tuner + chord-over-lyric work for any tuning immediately; only the diagram
   fingerings are tuning-specific, so a profile can ship strings-only first.)

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
| Library   | `songsList`, `genreChips`, `keyChips`, `search`, `searchClear`, `libCount`, `addBtn` |
| Practice  | `practiceEmpty`, `practiceBody` |
| Setlist (in Jam) | `setBody`, `setBar`, `setCount`, `setClear`, `setEdit`, `performBtn` |
| Perform   | `perform`, `pSheet`, `pPos`, `pTitle`, `pArtist`, `pKeyLine`, `pPrev`, `pNext`, `pClose`, `pUp`, `pDown`, `pDimBtn`, `pCtrls`, `pSpeed`, `pFontDown`, `pFontUp`, `pFontAuto`, `pViewLyrics`, `pViewChords`, `pViewBoth` |
| Compose   | `prog`, `suggest`, `catChips`, `buildGrid`, `composeChords`, `cClear`, `cSave`, `cMax`, `keyChipSlot`, `keyFlyout`, `keyRoots`, `keyModes`, `keyView`, `keyClear`, `soloBackingBtn` |
| Maximize  | `maxOv`, `maxGrid`, `maxClose` (chord-diagram overlay) |
| Chrome    | `ctxLine` (header subtitle) |

The engine also queries `.tabbar button[data-tab]` and `.screen` by id
(`s-library`, `s-jam`, `s-compose`, `s-practice`, `s-tune`) for tab
switching (the Set/Perform surface lives in the Jam tab - there is no
`s-setlist` screen anymore). Keep those class/id conventions in your
markup. The reference markup is `music/play/index.html` (the legacy
`music/ukulele/index.html` is only a redirect stub now).

### Returned controller

```js
controller.switchTab(name)  // "library" | "jam" | "compose" | "practice" | "tune" (legacy "setlist"/"set"/"tracks"/"repertoire" normalize)
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
Songbook.renderSheet(song, st, view) // view: "lyrics" (words only) | "chords" (bars) | "both" (chords over lyrics; default)
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
  onLeaveTuner: function () { /* delegate: if (Tuner) Tuner.stop(); */ },
  onSwitchTab:  function (name) { /* optional: react to any tab switch */ },

  // --- wiring, called once after the engine mounts ---
  // `engine` gives you { switchTab, chordRootFreq, tpose }. The pack hands its
  // open-string list to the SHARED tuner and wires the #quickTune shortcut.
  init: function (engine) {
    if (window.Tuner) window.Tuner.mount({ strings: TUNER_STRINGS });
    var q = document.getElementById('quickTune');
    if (q) q.onclick = function () { engine.switchTab('tune'); };
  }
};
```

### What the pack owns vs what the engine/tuner owns

| Concern | Owner |
|---|---|
| Song catalog, search, decade filter | engine |
| Chord NAME rendering (chord-over-lyric, chord chart) | engine |
| Transpose math | engine |
| Setlist add/remove/reorder, persistence | engine |
| Perform mode + auto-scroll + stage dim | engine |
| Compose grid layout + suggestions + save | engine (calls pack for diagrams/audio) |
| Chord FINGERINGS / diagrams | pack |
| Chord audio (strum, single tone) | pack |
| Mic auto-tuner + reference-tone drones (the whole Tune tab UI) | **tuner.js (shared)** |
| Which strings the tuner targets (note/label/Hz) | pack (`TUNER_STRINGS`) |

The Tune tab is rendered ONCE by the shared `tuner.js` (pitch detection, the
live needle, Start/Stop mic plumbing, reference-tone drones) so it is not
maintained per-instrument. The only instrument-specific input is the open-string
list, which the pack passes via `Tuner.mount({ strings })` from its `init()`.
`tuner.js` renders into the host markup `#micBox` (live needle) and `#tStrings`
(reference tones); `Tuner.stop()` silences mic + drones when the user leaves the
tab (called from the pack's `onLeaveTuner`).

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
- Behavior is preserved 1:1 with the original single-file app - this
  was an extraction, not a redesign.
