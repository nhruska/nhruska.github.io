# Visual Language (Color Roles + Emphasis Ladder)

[Wiki](../index.md) > ux-philosophy > Visual Language

## Purpose

The app's *behavioral* principles live in [design-principles.md](design-principles.md) and its *interaction* primitives in [ui-primitives.md](ui-primitives.md). This page is the missing third layer: the **visual language** - what each color token MEANS and how emphasis is ranked so every screen has ONE obvious next move. Seeded 2026-07-10 by the "define the UI design language / obvious cues" mission after Compose was found drowning its primary action in accent.

## The core rule: emphasis by scarcity

**Exactly one primary action per screen state wears the loudest treatment; everything else steps down a fixed ladder.** Accent is a scarce signal, not a default. If every interactive thing is accent-filled, none reads as "do this now" - which is exactly how Compose lost its primary (Tune, by contrast, already gets it right: one big "Start mic", everything else quiet - Tune is the reference).

The lever is contrast, not addition: you make the primary loud by making everything else *quieter*, never by adding a new color. This app derives every hue from the user's chosen `--accent` (the fretboard's `--kx-chord`/`--kx-blue` are `oklch(from --accent ... h +/-30)`); the visual language stays inside that discipline - **shade / outline / neutral of the one accent, never a circus of hues.**

## The emphasis ladder

| Tier | Role | Treatment (existing tokens only) |
|---|---|---|
| **Primary** | the ONE main action per screen state | accent **fill** (`.btn.red` = `--accent` + `--on-accent`), generous size. Scarce - one per screen. |
| **Selected** | the current choice in a set | accent **fill** at chip scale (`.chip.on`, D-SELECTED-ACCENT) - or `--accent-deep` for a quieter selected surface (`.chordSegBtn.on`) |
| **Secondary affordance** | controls that act but aren't the primary (accidentals, expand, toggles) | neutral glyph/text (`--txt-soft`) + `--line-strong` **outline**, transparent bg; accent only flashes on `:active` |
| **Chrome / hint** | the app talking (guidance, captions) | `--guide-bg` / `--txt-dim` - accent-**independent**, so it never reads as "you selected this" |
| **Content / data** | information, not a call to action (chord dots, key labels, fretboard tones) | `--accent` / `--kx-*` as a *data* color - present but never competing with the primary |

## Obvious-cue checklist (apply per screen)

1. **Name the one primary.** What is the single thing the user is here to do right now? That gets the fill.
2. **Default INTO the work, not into a chooser.** If a setup decision blocks the first action, pick a sensible default so the primary is reachable on tap one (Compose defaults to C major -> lands on tappable chords; [compose-key-system.md](../systems/compose-key-system.md) D-DEFAULT-C).
3. **Demote the affordances.** Accidental / expand / mode / filter controls are secondary - outline + neutral glyph, not accent fill.
4. **A primary that isn't yet valid demotes until it is.** Save is the compose primary only once there's a progression to save - on an empty canvas it's an outline (`.composeWrap.progEmpty #cSave`), returning to fill the moment a chord lands.
5. **Never add a hue to signal a tier.** Use fill -> outline -> neutral of the single accent. If you reach for a new color, you're breaking the language.

## Interaction with the locked laws

- **D-SELECTED-ACCENT** (accent-fill = selected) stands. This page adds the *emphasis* axis on top: a selected control and the screen's primary can both be fill, so keep selectable controls off the primary screen where you can (the anti-vision's "one surface + one view toggle, never a dashboard"), and let the primary win by size + by everything around it being demoted.
- **THE ELEMENT CONSISTENCY LAW** ([ssot-registry.md](../systems/ssot-registry.md)) stands: a tier is expressed by reusing a primitive's tokens, never a one-off. New tier treatments are guarded by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js).

## Related

- [design-principles.md](design-principles.md) - the behavioral layer (layout, grip, trust)
- [ui-primitives.md](ui-primitives.md) - the interaction primitives this styles
- [component-conventions.md](component-conventions.md) - per-component conventions
- [systems/compose-key-system.md](../systems/compose-key-system.md) - D-DEFAULT-C (the default-into-work example)
- [systems/ssot-registry.md](../systems/ssot-registry.md) - THE ELEMENT CONSISTENCY LAW + token registry

---

**Anchors verified:** music/shared/songbook.css (`.iconBtn` `--txt-soft` glyph, `.btn.red`, `.composeWrap.progEmpty #cSave`, `.chordSegBtn.on` `--accent-deep`), `:root` token block (`--accent`/`--accent-dim`/`--accent-deep`/`--accent-ink`/`--brass`/`--guide-bg`/`--txt-*`), tracks.css `--kx-chord`/`--kx-blue`/`--kx-ghost` (oklch-from-accent), songbook.js renderProg (`.progEmpty` toggle) + buildGrid In-key fallback, decisions.md D-SELECTED-ACCENT/D-ENFORCE-1, test/consistency-lint.test.js.
