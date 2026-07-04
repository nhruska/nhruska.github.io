# Layout Tokens (chord-tile / diagram geometry SSOT)

[Wiki](../index.md) > systems > Layout Tokens

## Purpose

One place explaining the numeric constants that keep a chord-diagram SVG from overlapping its neighbours in a grid (the U5/#96 bug class), and which constants are genuinely independent instead of forced into a false shared source.

## The contract [STABLE]

A rendered chord tile is two nested things: `diagram.js` draws a fixed-size SVG (pixel units, chosen by string count), and `songbook.css` sizes the GRID CELL that SVG sits in. If the cell can shrink narrower than the SVG's intrinsic width and nothing clamps the SVG down, the SVG spills into the next cell - the U5 ("guitar chords overlapping") bug class. Two independent defenses close this:

1. **The cell has a sane minimum** (`--tile-min`, `.chordGrid`'s grid-template-columns) so `auto-fill` rarely has to squeeze a cell below a comfortable size.
2. **The SVG shrinks to fit its cell** (`.chordGrid .chord svg{max-width:100%}` + `.chordGrid .chord{min-width:0}`) so even if the cell DOES end up narrower than the SVG's native size, the SVG scales down instead of overflowing.

Defense 2 is the one that actually prevents overlap; defense 1 just keeps the shrink small enough to be invisible.

## The token block (`music/shared/songbook.css`, right before `.chordGrid`) [STABLE]

```
--dg-canvas-w: 86px;   /* reference: diagram.js SIZES.small canvas width for a
                          6-string guitar (the widest 'small' diagram) - see
                          diagram.js's cross-reference comment on SIZES.small */
--tile-min: calc(var(--dg-canvas-w) - 2px);  /* .chordGrid track min - just
                          under the reference canvas so the SVG-shrink clamp
                          (defense 2) does negligible work in the common case */
--tile-gap: 8px;        /* .chordGrid gap */
--prog-tile-min: 62px;  /* .prog .slot .chord min-width - a touch-target FLOOR
                          for the horizontally-scrolling progression strip,
                          NOT a squeeze-fit value like --tile-min (the strip
                          scrolls instead of squeezing, so tiles render at
                          their natural width) */
```

`--dg-canvas-w` is a **documentation-anchor token**, not a live coupling: `diagram.js` cannot read a CSS custom property (it emits a plain SVG string), so it does not consume this var. It exists so the 86px figure - previously only asserted in a prose comment - is a real, single declared value that `--tile-min` derives from via `calc()`. If `diagram.js`'s `SIZES.small` (`sx`/`padX`/`labelPad`) ever changes the canvas width for the widest instrument, re-derive `--dg-canvas-w` by hand and re-run `scripts/layout-check.py` - see the cross-reference comment at `SIZES.small` in `diagram.js`.

## Independent-by-design (documented, NOT tokenized) [STABLE]

| Constant | Where | Why it's independent |
|---|---|---|
| `diagram.js` `SIZES.small`/`SIZES.big` (`sx`, `padX`, `labelPad`, `H`) | diagram.js | Computed per string-count at render time (a 4-string ukulele and a 6-string guitar produce different canvas widths from the SAME object) - not a single fixed pixel value a CSS var could hold. Cross-referenced from the token block above, not mechanically coupled. |
| `.prog .slot .chord{min-width:var(--prog-tile-min)}` | songbook.css | The progression strip is a horizontally-SCROLLING filmstrip (`.prog{overflow-x:auto;flex-wrap:nowrap}`, `.slot{flex:0 0 auto}`) - tiles render at their natural SVG width and are never squeezed by their container, so there is no overlap-by-squeeze risk here the way there is in a `minmax(...,1fr)` grid. 62px is a minimum-touch-size floor, unrelated to `--dg-canvas-w`. |
| `.suggChip`/`.cofChord` min-width/min-height (songbook.css, tracks.css) | both css files | Neither renders a diagram SVG (suggestion chips are name+interval text; circle-of-fifths chips are name-only) - governed by the 44px GRIP touch floor ([decisions.md](../decisions.md) GRIP), not this SSOT's overlap concern. |

## Known gap - NOT fixed by this SSOT pass (follow-up candidate)

`music/shared/tracks.css`'s `.bt-st-chords{grid-template-columns:repeat(4,minmax(0,1fr))}` (the Practice Studio "chords in this key" row, `music/shared/tracks.js` renders via `KeyExplorer.renderChords(..., {wrap:false, cellClass:'bt-st-chordcell'})`) has **no equivalent of defense 2** - there is no `.bt-st-chordcell .chord svg{max-width:100%}` rule. Arithmetic at a 360px viewport (`.bt-st-body` padding 12px each side, 3 gaps of 6px, 4 columns): `(360 - 24 - 18) / 4 = 79.5px` per column - narrower than a 6-string guitar's 86px reference canvas (`--dg-canvas-w`). This is the SAME bug class as U5/#96, in a location this pass's required scope (All-chords grid + In-key palette + progression strip) did not include. Left as a documented finding per this mission's "report a divergence, don't silently normalize" stop condition - the fix, when picked up, is a one-line mirror of the existing `.chordGrid .chord svg` rule scoped to `.bt-st-chordcell .chord svg`.

## The regression suite (`scripts/layout-check.py`) [STABLE]

Manual/pre-merge dev tool (repo has no CI browser runner - see [pre-pr-ci-parity.md](https://github.com/nhruska/claude-config/blob/main/rules/pre-pr-ci-parity.md) - this is agent-run, not CI-wired). Drives the live app end-to-end in headless Chromium (shared Python-Playwright venv, `~/.claude/.venv`) at 360/412/768/1440px viewport widths x 1.0/1.3 simulated root-font scale, against the `guitar-standard` profile (the widest `SIZES.small` canvas - the exact profile named in the U5 report). Asserts, per config:

- No two chord tiles (All-chords grid, In-key palette, progression strip) have overlapping bounding rects.
- No chord tile's own SVG spills more than 1px past its own `.chord` card (the All-grid + In-key palette clamp).
- The Practice Studio's scale-fretboard box (`.scaleBox`) never renders wider than its own container - it may legitimately scroll INTERNALLY (`overflow-x:auto` by design), but must never force page-level overflow.
- The chord-list scroll container (`#composeChords`) and the document itself never gain horizontal scroll.

Run: `source ~/.claude/.venv/bin/activate && python3 scripts/layout-check.py`.

## Related

- [decisions.md](../decisions.md) - `D-LAYOUT-SSOT` entry
- [runtime-architecture.md](runtime-architecture.md) - no-build static-PWA context this suite runs inside
- [instrument-profiles.md](instrument-profiles.md) - the profile pack contract (`pack.diagram`) `diagram.js` renders for
- `../../../docs/plans/atomic-queue-plan-20260704.md` item 0.1, `../../../docs/plans/uat-walkthrough-20260704.md` U5 - the operator directive + bug report this mission answers
