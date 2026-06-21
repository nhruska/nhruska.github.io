# Backing Tracks — Phase 2 plan (the circle of fifths — the soul)

> Scope: turn the flat key-picker into the **circle of fifths** as home + navigation,
> per [DESIGN.md](DESIGN.md) ("the spine"). Tap a key on the wheel → its diatonic
> chords, its relatives, the neighbors worth exploring next, and the tracks in it.
> No nudge engine yet (Phase 3). Builds on the Phase-1 finder.

Static, no build, vanilla JS, reuse `music/shared/`. Verification bar (repo
CLAUDE.md): `node -c` changed JS, `JSON.parse` the catalog, unit-test logic in
Node. No headless browser — eyeball the githack preview the PR posts.

## Why the wheel, not a list (the design argument)
The three growth dimensions (new keys, new chord forms, the "why") are **one
object seen three ways** — the circle. A key is a *position*; its chords are
*derived* from it; its neighbors are *adjacent* on the wheel. A flat A–G# list
hides all of that. The wheel makes "what's one hop away" a spatial fact you can
feel, which is exactly the harmony-growth the surface is for.

## The engine (pure, shared, TDD'd) — `music/shared/circle.js`
A sibling to `diagram.js`: pure music theory + an SVG wheel renderer. Theory is
unit-tested in Node; the renderer is `node -c`'d and eyeballed.

Theory surface:
- `Circle.ORDER` — the 12 roots clockwise by fifths (`C G D A E B F# C# G# D# A# F`).
- `position(root)` / `atPosition(n)` — root ↔ clock index (flats normalized).
- `dominant(root)` / `subdominant(root)` — a fifth up / down (the wheel neighbors).
- `relativeMinor(root)` / `relativeMajor(root)` — the inner ring.
- `neighbors(root)` — `{ dominant, subdominant, relativeMinor }`, each with a "why".
- `diatonic(root, mode)` — the 7 diatonic triads with roman numerals + qualities,
  for `major` and natural `minor` (e.g. `C major → C Dm Em F G Am Bdim`).

Renderer: `Circle.renderWheel({ selected, onPick })` → an SVG of 12 outer
(major) + 12 inner (relative-minor) wedges; the selected key glows in `--accent`;
tapping a wedge calls `onPick(root, mode)`.

## Atomic tasks (ordered)
- **C1 — theory engine + tests** (this is the testable core; ship first in the PR).
- **C2 — wheel SVG renderer** in `circle.js` (`node -c` + eyeball).
- **C3 — wire into the finder**: a wheel above the genre/key bar; tapping a key sets
  `state.key`/`state.mode` (drives the existing Phase-1 filter) AND opens a key panel.
- **C4 — key panel**: the tapped key's diatonic chords (roman + names), its relative
  and dominant/subdominant neighbors as tap-to-jump chips, and a one-line "why".
- **C5 — precache** `circle.js` in `music/sw.js` (bump CACHE); load it in
  `backing-tracks/index.html` before `app.js`.

## Acceptance
- Tapping a wheel key filters the track list to that key (Phase-1 behavior intact).
- The key panel shows correct diatonic chords + relatives for any of the 24 keys
  (12 major + 12 minor) — verified in Node.
- Wheel is legible + tappable at 375px width (eyeball).
- Guardrail: still one surface; the wheel is navigation, not a dashboard.

## Out of scope (Phase 3+)
- Nudge engine ("you keep jamming in Am — C#m is one hop away").
- Per-key stretch/extended voicings on the chord display (reuse `diagram.js` later).
