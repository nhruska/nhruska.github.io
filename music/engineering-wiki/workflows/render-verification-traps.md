# Render-Verification Traps

[Wiki](../index.md) > workflows > Render-Verification Traps

## Purpose

[dev-verify-ship.md](dev-verify-ship.md) says WHEN to render-verify and at what viewport. This page says HOW a render check lies to you. Each row is a way an assertion goes green while the UI is broken - and every one has cost a real defect, in this app or in the sibling internal app that reached the same 44px floor and the same 412x915 review viewport independently.

The human-factors half of mobile work is already owned here: [design-principles.md](../ux-philosophy/design-principles.md) (grip model, one-screen), [interaction-safety.md](../ux-philosophy/interaction-safety.md) (guard taxonomy, scroll-rail), [ui-primitives.md](../ux-philosophy/ui-primitives.md) (which shape to reach for). This page is the other half and does not repeat them.

## The one sentence [STABLE]

**Assert usability, not properties.** The question is always "can a hand USE this", never "is the class present". A property assertion passes while the UI is unusable, and it does so silently.

The founding case came from the sibling app: a nav rail shipped `position:fixed; top:54px` while its sticky header had grown to 88px, clipping the first menu item 20px underneath it. Seven scenario checks stayed GREEN, because they asked whether the open-class toggled. It was caught in ONE GLANCE at a phone screenshot.

Our own version of the same species is the U5/#96 chord-tile overlap ([layout-tokens.md](../systems/layout-tokens.md)): a CSS rule can be present, correct, and still not prevent the overlap, because what actually prevents it is the SVG-shrink clamp - not the token that looks like it should.

## The trap table [STABLE]

| Trap | Reality |
|---|---|
| **Hidden elements return an all-zero rect** | So `top=0`, and a clip/fold test reports the SAME bogus number for every hidden row. Twenty-two identical numbers was the tell. **Skip zero-box elements FIRST**, before any geometry test. Relevant here for every collapsed notable, un-mounted tab pane, and `[hidden]` toast. |
| `display` on the element lies about visibility | A child inside a collapsed group still computes its own `display:flex` - the ANCESTOR is what is `none`. Check the rendered BOX. |
| `offsetParent !== null` | Catches ancestor `display:none`, misses `visibility:hidden` and `opacity:0` - which is exactly how the `.toast`/`.on` opacity-fade mechanic hides. The screenshot is the authority. |
| `position:sticky` inside any `overflow:auto` ancestor | Fails silently. No error, no warning. It just scrolls away. Worth knowing given how many panes here scroll internally by design (`.scaleBox`, `#composeChords`, `.prog`). |
| A selector that never matches | Correct CSS that never applies looks right in review and does nothing. **Verify the selector MATCHES**, not that the declaration is present. |
| Deriving the expected value from the code under test | Reading a constant out of the CSS and asserting the element sits at that constant proves only that CSS parses. **Measure the dependency.** `--dg-canvas-w` is a documentation anchor for exactly this reason - `diagram.js` cannot read it, so the check must measure the real SVG. |
| CSS custom properties do NOT work in `@media` conditions | So a canonical breakpoint can never be a `var()`. It has to be a documented constant. |
| Enumerating a tag list | A tap-target check that lists `button`/`.tile` misses every `<a>`. Select by role/behaviour. |
| Correct `z-index`, unclickable UI | Assert the intended element is **topmost at its own centre point**. An empty overlay button ate clicks with the z-index perfectly correct. |

## The matrix [STABLE]

`scripts/layout-check.py` already runs the right one - this records WHY each axis is there:

| Axis | Values | Why |
|---|---|---|
| Width | 360, **412**, 768, 1440 | 412x915 is the review viewport; 360 is a real Android width and passing 412 while failing 360 is common. |
| Root-font scale | 1.0, **1.3** | Android's accessibility font-size setting reflows everything. This axis is ours - the sibling app does not have it, and it is the one most projects miss. |
| Profile | `guitar-standard` | Widest `SIZES.small` canvas, so it is the worst case for tile overlap. |
| Breakpoints | both sides | The off-by-one is where regressions hide. |

Plus `env(safe-area-inset-*)` in portrait AND landscape.

## Gate discipline [STABLE]

- **Prove the gate RED.** Break it on purpose, watch it fail naming the real cause, then restore. A gate you have only ever seen pass is theatre.
- **A gate that cries wolf is as bad as a blind one.** The zero-box trap above produced 22 identical bogus clip numbers; a check nobody trusts stops being read.
- **Fixing a DETECTOR does not retract the false records it already wrote** - regenerate its baseline in the same change.
- **Measure intermittent defects over >= 20 loads and report the tally.** Never "fix" a race with a delay.
- **Report UNVERIFIED plainly.** On the no-toolchain surface ([dev-verify-ship.md](dev-verify-ship.md)) the honest output is a githack preview link plus a statement of what was not checked - never an implied pass.
- **A known gap stays documented, not silently normalized.** `layout-tokens.md` carries the `.bt-st-chordcell` gap (same U5 bug class, out of that pass's scope) rather than a quiet one-line fix - that is the pattern to copy.

## When the operator catches something anyway [STABLE]

That is the system working - but exactly once per class:

1. Fix it.
2. Write the check that would have caught it, and prove it RED.
3. Regenerate any baseline the old detector polluted, same change.
4. If the miss was a CLASS and not an instance, a ux-philosophy page or [decisions.md](../decisions.md) is missing a line. Add it there, not just in the code.

The operator should not be the linter. Every hand-caught nitpick that does not become a check will be caught by hand again.

---

**Anchors verified:** [dev-verify-ship.md](dev-verify-ship.md) (surface-aware bar, 412x915 render-verify, E2E OOM discipline, A7 geometry gate), [systems/layout-tokens.md](../systems/layout-tokens.md) (`--dg-canvas-w` documentation-anchor rationale, `scripts/layout-check.py` matrix, the `.bt-st-chordcell` known gap), [ux-philosophy/design-principles.md](../ux-philosophy/design-principles.md) (grip model, 44px, one-screen), [ux-philosophy/interaction-safety.md](../ux-philosophy/interaction-safety.md) (guard taxonomy, scroll-rail, wireTap), [ux-philosophy/ui-primitives.md](../ux-philosophy/ui-primitives.md) (toast `[hidden]` vs opacity mechanics)
