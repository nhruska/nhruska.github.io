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

## Chord-tone targeting (M-GUIDE W3a, D-TARGET, amended by the P5 fold) [STABLE]

Chords-in-key doubles as the target surface: tapping a chord (in addition to playing it) marks ALL of that chord's tones, precedence root > chord > blue > scale - `Tracks.targetTones(scalePcs, scaleRootPc, chordName)` (pure pc arithmetic, tracks.js) computes `Circle.chordTones(chord)` against the scale. Tones INSIDE the scale render filled (`kx-root`/`kx-chord`); tones OUTSIDE the scale render as hollow GHOST dots (`kx-ghost`) at their correct fret position - the original "intersection-only, no ghost dot" deferral was killed by a P5 seasoned-player adversarial pass (2026-07-05): for A7 over A blues, C# (the major 3rd) is the money note, and hiding it taught the exact habit the feature exists to break. `targetTones()`'s return shape is `{ byPc, rubPc, ghostPcs }` - `ghostPcs` carries the out-of-scale set. A dominant-quality target (has both the major 3rd and the b7) also marks a "rub" note (chordRootPc+3, dashed ring) when it's in scale - e.g. Eb over C7 in C blues, nothing over a plain IV7 whose rub candidate falls outside the scale. `Tracks.defaultTones(bundle)` is the separate ALWAYS-ON mark: the blues solo scale's b5, independent of any active target.

`Diagram.scale(opts)` renders the classes via `opts.tones = { byPc: {pc: class}, rubPc, ghostPcs }` (diagram.js) - EXTEND not overlay: absent `opts.tones` (or an empty/absent `ghostPcs`) renders byte-identical to the pre-targeting default (SHA-256 locked in diagram.dom.test.js). Ghost dots reuse the SAME per-string fret-window math as the in-scale dots (`scalePlan`'s new `ghostsOn(s, wantedPcs)` sibling to `notesOn(s)`), just for pcs the scale doesn't contain - fill:none, `--kx-ghost` stroke + text ink, no dash (the rub's dashed ring stays a distinct signal). `KeyExplorer.renderScale` forwards `opts.tones` through to `pack.scaleDiagram` as its 6th positional arg (the ONE adapter implementation in play/index.html); the returned `boxWrap` carries `setTones(tones)` to re-mark WITHOUT resetting the position-walk (a toggle should never reset `startFret`). A chip switch (Mode/Pent major/Pent minor/Blues) re-applies the same active target (including its ghosts) against the new bundle's pcs.

A static caption renders under the fretboard while a target is active ("Showing C7 inside A blues - accent = chord root, filled = chord tones, hollow = chord tone outside the scale.") - interpolates only already-rendered labels (A9), never a theory computation of its own.

**U3 fix (operator UAT 2026-07-04):** `kx-chord`/`kx-blue` note text used to share the root dot's `--on-accent` ink; tracks.css now defines per-class `--kx-chord-ink`/`--kx-blue-ink` (both themes) so the text stays readable against the deliberately-darkened light-theme fills - see [decisions.md](../decisions.md) if this needs re-litigating.

**U2 fix (operator UAT 2026-07-04):** the position-pager (`key-explorer.js` `.scalePosCtrl`/`.scalePosBtn`) is now an explicit 44px box (was 42px, below the app's GRIP touch floor) with a less extreme disabled-state fade, so back/forward read as equal-size in both states - override lives in tracks.css (loads after songbook.css's base rule).

## Named box positions (S-BLUES-BOXES, D-BLUES-BOXES) [STABLE]

When the active solo scale is pentMajor/pentMinor/blues, the position-pager (above) snaps its back/forward walk to the 5 named box starts computed by `KeyExplorer.boxes(rootPc, scaleId, openPcs)` (key-explorer.js) instead of the fixed 0/5/10 step - 7-note mode scales (ionian/aeolian/dorian/mixolydian) keep the classic fixed walk unchanged. `Tracks.boxScaleIdFor(scaleId, th.scaleMode)` decides eligibility per the currently active chip: an explicit pentMajor/pentMinor/blues chip is always box-eligible; the 'mode' chip is box-eligible ONLY when the track's own key IS the M-GUIDE W2 Blues key (its scale already IS the SOLO_SCALES.blues set). `renderScale`'s `opts.boxScaleId` carries this through; it derives the tuning's open pitch classes from the pack's own `meta.stringNames` via `openPcsFromPack` - no separate profile plumbing needed by the caller, and it degrades silently to the classic walk if that metadata is missing.

A `.scaleBoxChip` element (sibling of `.scalePosCtrl`, tracks.css) shows the current box's label - e.g. "Box 1 - root on 6th string, fret 5" - exactly when the pager's current position lands on a box start; hidden otherwise (an unaligned position, most commonly the initial open view, shows no chip). See [decisions.md](../decisions.md) D-BLUES-BOXES for the box-math contract (CAGED-derived windows, pentMajor/blues sharing rules, wrap-fold) and [theory-engine/solo-scales.md](../theory-engine/solo-scales.md) for the full write-up.

## Guidance cards - SoloGuide (M-GUIDE W3a, D-CARDS-STATIC) [STABLE]

A `Guide` toggle (mirrors `.bt-st-why-toggle`/`.bt-st-why` verbatim - composed, not a new chip variant) sits under the framing line, collapsed by default, re-deriving on every scale-chip select. Content comes from a NEW standalone module, `music/shared/solo-guide.js` (`window.SoloGuide`), loaded before both songbook.js and tracks.js so Compose's solo chips (W3b) can call the identical `framing()` without depending on tracks.js:

- `SoloGuide.framing(scaleId, family)` - MOVED verbatim from tracks.js's old `soloScaleFraming` (identical behavior).
- `SoloGuide.cards` - the raw 7-key x 5-block table (`ionian, aeolian, dorian, mixolydian, pentMajor, pentMinor, blues`), read-only.
- `SoloGuide.card(scaleKey, notes)` - interpolates `{i}` degree-index placeholders against the caller's current note-name array; unknown key -> null, no DOM, no throw.

Content is curated static prose only (A9 discipline, zero theory derivation) - see [decisions.md](../decisions.md) SOLO-BOUNDARY. Card copy was amended twice: the section-8B professor fold (2026-07-04), then a P5 seasoned-player adversarial pass (2026-07-05, [decisions.md](../decisions.md) P5-FOLD) that rewrote most blocks toward chord-relative advice ("target the CURRENT chord," not just the home chord) and fixed one factual error (`pentMajor.shapes`/`framing()`: the relative minor pentatonic is a minor 3rd - THREE frets - below, not two).

## Landscape split refine (M-GUIDE W3a, D-LANDSCAPE-FLEX) [STABLE]

The existing coarse-pointer landscape two-pane split (`.bt-studio{flex-direction:row}`, gated on `(orientation:landscape) and (max-height:600px) and (pointer:coarse)`) tightened to fit the Guide card + target caption's added content: stage pane 48% -> 44%, `.bt-st-body` padding `12px 12px 18px` -> `10px 12px`, gap `12px` -> `10px`.

---

**Anchors verified:** tracks.js:196-296 (studioTheory, normMode), ~459-516 (inversionsHref, buildWhy), ~517-687 (openStudio incl. rehydration + scale chips + whynote), targetTones/defaultTones/computeTones/toggleTarget/renderGuide (openStudio region), boxScaleIdFor (S-BLUES-BOXES), solo-guide.js (SoloGuide), diagram.js `scale()` opts.tones + `scalePlan()`'s `ghostsOn`, key-explorer.js `renderScale`/`setTones`/`boxes`/`openPcsFromPack` (opts.boxScaleId pager-snap + `.scaleBoxChip`), tracks.css EOF kx-* / guide section (incl. `--kx-ghost`, `--kx-chord-ink`/`--kx-blue-ink`, the U2 `.scalePosBtn` 44px override, `.scaleBoxChip`) + landscape media query, songbook.js ~817-830 (bridge), notables.js, candidates.js, docs/plans/m-guide-ia-20260704.md §§2-3, 5, 8, docs/plans/uat-walkthrough-20260704.md U2-U4; P5 seasoned-player adversarial fold (2026-07-05, PR #118); S-STUDIO-POLISH (2026-07-04); S-BLUES-BOXES (2026-07-04, docs/plans/short-specs-20260704.md)
