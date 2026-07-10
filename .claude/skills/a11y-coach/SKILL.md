---
name: a11y-coach
description: Accessibility coach for the Music app - tap targets, contrast, focus/keyboard paths, screen-reader labels for musical UI (chord diagrams, fretboards, needles), and motion safety. Use BEFORE shipping any new interactive element or visual state, and in every UI review pass. Summoned per the SME dynamic-summoning rule.
---

# A11y coach

Musical UI has a11y problems generic checklists miss: a chord diagram is an
IMAGE of finger positions, a tuner needle is a live analog value, and accent
theming re-colors half the app at runtime.

## The floors (hard, checkable)

- **Tap targets >= 44x44 CSS px** on anything tappable (the delete badge's
  invisible 44px halo over a 24px visual is the house pattern - reuse it).
- **Contrast >= 4.5:1 for text, >= 3:1 for UI glyphs** - AND it must hold under
  EVERY accent theme the chooser offers, not just the default (the accent vars
  re-skin at runtime; a passing default proves nothing). Tuner status colors
  are fixed by contract - verify once, they never re-theme.
- **Focus visible + Escape closes** on every overlay (NavHistory-registered
  layers already own Back; keyboard Escape must match - the Solo modal does).
- **Text floor**: SVG labels >= 10px font-size (the phone-DPI rule in
  CLAUDE.md) - a11y and DPI agree here.

## Musical-surface specifics

- **Chord diagram**: `aria-label` carries name + voicing summary ("C major,
  3rd fret ring finger") or at minimum the display name - never an unlabeled
  SVG button. The DISPLAY name (key-aware Bb), not the internal token.
- **Fretboard scale view**: it is a data visualization - provide the same
  facts as text nearby (the notes line does this; keep them in sync - one
  more reason bundle.notes drives both).
- **Tuner**: the needle is decorative; the STATE (note name + flat/sharp/in-
  tune) must exist as text. Color is never the only signal (red/amber/green
  pair with position + label).
- **Accidentals in labels**: `text-transform: uppercase` corrupts flat names
  ("Bb" -> "BB") - any new label class showing note names needs the
  `.bt-st-notes`-style opt-out. This is now a spelling-correctness AND a11y
  rule (screen readers read "BB" as letters, "B flat" needs the b).
- **Motion**: needle smoothing, chip animations, fadeUp - all fine; anything
  larger honors `prefers-reduced-motion` (fadeUp under 250ms is exempt).

## Self-check

1. New interactive element: 44px? focusable? labeled with the DISPLAY name?
2. New color/state: contrast under every accent theme, and is color paired
   with a non-color signal?
3. New note-name label: uppercase-transform safe? Screen-reader sensible?
4. New overlay: Escape + Back + backdrop all dismiss, focus returns?

## Related

- [ux-coach](../ux-coach/SKILL.md) - emphasis ladder; a11y floors constrain it
- [copy-coach](../copy-coach/SKILL.md) - the words the labels carry
- music/CLAUDE.md phone-DPI text floor + tuner-trust conventions
