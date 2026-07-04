# Practice Studio

[Wiki](../index.md) > systems > Practice Studio

## Purpose

The solo-teaching hub: given key + mode (+ optional backing track), show the scale to solo over on the real fretboard, the chords in key (tap to hear), and the "why" - without page reloads.

## Architecture [STABLE]

Entry: `Tracks.openStudio(t)` (tracks.js ~517-687) - t carries .key, .mode, optional .yt. Both entry paths funnel here: the Tracks list activate() AND Compose's "Solo over a backing track" CTA (songbook.js bridge, ~817-830; the bridge payload rehydrates curated .yt by trackKey before render).

Layout: fixed stage (pinned video iframe or search card + title/BPM/genre + URL curation editor) over a scrollable body (solo scale fretboard -> scale chips -> chords-in-key -> buildWhy).

## Scale-first philosophy [STABLE]

The fretboard is the hero: every note that sounds right in this key/mode, on THIS instrument's geometry, position-walkable up the neck. Chords support the harmony; the pattern is the guide (see [expertise-adaptive-display](../ux-philosophy/expertise-adaptive-display.md)).

## studioTheory bundle [STABLE]

tracks.js (~196-296): computes { key, scaleMode, label, notes, degrees, pcs, rootPc, chords } for a key+mode - the one bundle feeding the notes line, fretboard (via KeyExplorer.renderScale with a pc->name map so list==fretboard), and chords-in-key. Mode coarsening (normMode/resolveScaleMode) maps free-text modes onto the supported set.

## Solo scale chips (S-BLUES) [STABLE]

One chip row `.bt-st-scalechips` in the Solo section: [Mode label | Pent major | Pent minor | Blues]. Default = the mode scale (open behavior unchanged). A tap re-derives ONLY the solo bundle via the pure `Tracks.soloBundle(key, mode, scaleId)` ('mode' delegates to studioTheory; others go through Circle.SOLO_SCALES). Harmonization surfaces are untouched by selection - enforced by the isolation test (chords identical before/after). Per-open state only (no persistence). Framing line per selection is a static template (A9 discipline). See [theory-engine/solo-scales.md](../theory-engine/solo-scales.md).

## buildWhy - the read-only wheel (S2/FORK-3) [STABLE]

The "why these notes" box renders scale degrees + notes + a READ-ONLY tinted circle-of-fifths (relative key highlighted, IV/V neighbors dimmer; tracks.js ~489-516). Deliberately non-interactive: the Studio is for practicing, not key selection - no false affordance. Computed once per Studio open (cached on first toggle).

## whynote JIT banner [STABLE]

One-shot relative/parallel "why" teaching notable at Studio entry (whynoteText/whynoteBanner near studioTheory; claims 'whynote' via Notables; A9 static templates keyed on the mode label). Dismiss = forever.

## Curation loop [STABLE]

Tracks without a curated video show the search card + paste editor; curated URLs persist in the music.trackUrls overlay keyed by trackKey. The candidates queue (candidates.js) seeds pre-researched suggestions. Finder-tab retirement is part of M3 (sprint 2) - the Studio remains reachable from the merged repertoire.

---

**Anchors verified:** tracks.js:196-296 (studioTheory, normMode), ~459-516 (inversionsHref, buildWhy), ~517-687 (openStudio incl. rehydration + scale chips + whynote), songbook.js ~817-830 (bridge), notables.js, candidates.js, docs/plans/wiki-ia-20260704.md §3c
