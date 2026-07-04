# Instrument Profiles

[Wiki](../index.md) > systems > Instrument Profiles

## Purpose

The pack contract - how instrument tuning data loads, fretboards render, and chords play. Profiles are pure data; rendering is shared (diagram.js).

## Profile shape [STABLE]

Each music/shared/profiles/<id>.js self-registers into window.MusicProfiles:

`{ id, label, instrument, tuning, strings: [{n, l, f}...], chords: { "C": [-1,3,2,0,1,0], ... } }`

Fret arrays are per-string (low->high display order): -1 muted, 0 open, N fretted. profiles/manifest.json lists active profiles in load order. 8 profiles ship today (guitar standard/drop-D/open-G, ukulele GCEA, banjo gDGBD, mandolin GDAE, mandola CGDA, cigar box DGBD).

## Consuming surfaces [STABLE]

1. **Diagram.render(frets, opts)** (diagram.js:37-106) - the chord SVG. baseFret windowing (diagram.js:30-35): window starts at the nut unless the shape sits above fret 4, then a base-fret digit renders instead of the nut bar. labelPad (diagram.js:62-73) is RESERVED on every diagram so canvas size is constant across open and offset shapes - without it, offset shapes rendered smaller in grids.
2. **pack.playChord/playNote** - Web Audio via audio.js.
3. **pack.scaleDiagram(...) + supportsStart** (diagram.js scale(), key-explorer renderScale) - fretboard scale map with position-walk (posWindow: POS_STEP=5, POS_CAP=14).

## Enharmonic shape lookup [STABLE]

Canonical-sharp names come in (FORK-4); profile hashes may key voicings under flats (a hand-curated "Bb" fingering). Lookup: exact name first, then the enharmonic twin, then movable-template fallback. The DISPLAY name never changes - only the fingering source. [TRACKS-#98] (regime B shows conventional names; the tolerant lookup already handles both directions)

## HGT/HSR shape families (absorbed from hsr-notes) [STABLE]

**Harmonic Geometry Transfer:** ukulele GCEA's lower three strings (G C E) carry the same interval geometry as guitar's D G B set (P4 + M3) - movable-shape muscle memory transfers across instruments. Shape families (C-family, F-family, A-family) name the movable barre forms; the **Hammer / Slide / Rotate** vocabulary describes moving between I-IV-V shapes up the neck (hammer within a position, slide a shape +2 frets, rotate into the next family). The triad-inversions page teaches this cycle; the future HSR Lens (backlog) would overlay it live.

## Triads & Inversions deep link [STABLE]

music/play/triad-inversions.html accepts `?p=<profile-id>&key=<root>&mode=<mode>` - Studio and Compose link into it carrying the current instrument + key context (tracks.js inversionsHref ~466-489).

---

**Anchors verified:** profiles/* + manifest.json, diagram.js:30-106 (+labelPad rationale comments), key-explorer.js posWindow, tracks.js inversionsHref, docs/hsr-notes.md (absorbed; stub remains), play/index.html buildAdapter enharmonic retry
