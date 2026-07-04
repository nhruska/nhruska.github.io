# Runtime Architecture

[Wiki](../index.md) > systems > Runtime Architecture

## Purpose

How the app runs as a static PWA with no build step: classic-script load order, module map, the chord-pack adapter, and profile selection.

## Classic-script stack [STABLE]

Pure static HTML + vanilla JS: classic script tags, relative paths, no bundler, no npm build. Served by GitHub Pages (or any local HTTP server; the mic tuner needs a secure context). Every module exports to window (window.Songbook, window.Circle, ...).

Load order is dependency order (music/play/index.html script block, ~lines 266-284): theme.js (pre-paint) -> esc -> nav-history -> queue -> tempo -> circle -> key-explorer -> list-item -> notables -> repertoire -> repertoire-form -> songbook -> tuner -> diagram -> audio -> tracks -> candidates -> inline bootstrap. esc.js loads first (S-HARDEN, analysis-refactor-enhance-20260704 A5) because list-item/notables/repertoire-form/songbook/diagram/tracks all delegate their local `esc()`/`escHTML()` to it (`global.Esc.esc`) instead of each carrying its own divergent copy - a [test/sw-verify.test.js](../../../test/sw-verify.test.js) guard now asserts every shared/*.js `<script src>` tag is also CORE-precached in sw.js (A6), catching exactly this kind of load-order-dependent gap.

## Boot sequence (inline bootstrap) [STABLE]

1. Fetch profiles/manifest.json -> ordered profile ids.
2. Promise.allSettled load of profiles/<id>.js (tolerates individual failures).
3. Active profile selection priority: `?p=<id>` query > legacy `#<id>` hash > localStorage `music.activeProfile.v1` > manifest order > Object.keys fallback.
4. Build the instrument picker (grouped by instrument, manifest order) + Tune-tab tuning chips.
5. Fetch songs.json.
6. `Songbook.mount({ songs, chordPack, storagePrefix: 'roadcase-' + profile.id, getTracks, openStudio, seedBackingKey, ... })`.

## Chord-pack adapter - the ONLY instrument-specific seam [STABLE]

`buildAdapter(profile)` wraps pure profile data into the pack contract consumed everywhere:

| Method | Purpose |
|---|---|
| hasChord(name) | voicing exists on this tuning? |
| diagram(name, size) / diagramChain(names, size) | fingering SVG(s); 'small' grid / 'big' overlay |
| playChord(name) / playNote(name) | Web Audio strum / reference tone |
| scaleDiagram(rootPc, scalePcs, frets, startFret, names) | fretboard scale map (position-walk capable when supportsStart) |
| init(engine) | tuner mount + quick-tune wiring |
| meta | instrument/tuning/strings info |

Key behaviors: **enharmonic tolerance** (canonical-sharp request finds a flat-keyed fingering via respelling retry), **movable-voicing fallback** (closed templates slide up the neck for transposed keys; fallback chain exact -> movable -> name-only), **artifact-aware ukulele shapes** (C/F/A-shape barre templates injected when the 4-string [P4, M3] top-interval pattern is detected, aligning I-IV-V chains with the triad-inversions pedagogy).

## Node/browser duality [STABLE]

Every shared module ships the UMD tail (module.exports + window global) so node tests run without a DOM. Cross-module references inside shared/ use guarded refs - e.g. tracks.js circleRef()/notablesRef(): global.Circle || require('./circle.js') - so browser load order and Node requires both resolve.

**Un-guarded direct refs (a deliberate narrower variant):** list-item.js's `wireTap()` is now the SSOT movement-cancel tap-guard (S-HARDEN A4) - songbook.js's `wireTapCancel`/`composeWireTap` are one-line delegates (`global.ListItem.wireTap(el, fn)`), and esc.js's `esc()` is the SSOT HTML-escape (A5), delegated to by list-item/tracks/repertoire-form/diagram/songbook (`global.Esc.esc`). Unlike circleRef()'s `||`-guarded fallback, these are unguarded - they assume the dependency already loaded (true by script order in both play/ HTML entry points), so any test file that calls a delegating function must `require()` the dependency (list-item.js / esc.js) BEFORE the consumer, with `global.window = global` aliased first so both land on the same object in Node (see test/songbook.test.js, test/diagram.dom.test.js).

## Profile-as-primitive

An "instrument" IS a tuning profile (guitar-standard vs guitar-dropd are siblings). Everything downstream (diagrams, audio, scale maps, storage namespace) keys off the active profile; switching instruments remounts with a different pack and storagePrefix.

---

**Anchors verified:** music/play/index.html (script order ~266-281; bootstrap ~284-569: activeId, buildPicker, buildAdapter, movableVoicing, augmentTriadShapes), music/shared/README.md (module map, pack contract), tracks.js circleRef/notablesRef, music/CLAUDE.md:100 (no build step)
