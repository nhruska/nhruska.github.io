# Component + Token Conventions

[Wiki](../index.md) > ux-philosophy > Component + Token Conventions

## Purpose

The app's design-system reference: canonical style/convention per element class, plus the token palette (color, font, spacing, radius, motion) and contrast/touch floors. Governed by THE ELEMENT CONSISTENCY LAW in [systems/ssot-registry.md](../systems/ssot-registry.md) - one primitive per element class, composed everywhere, enforced by lint. Taxonomy-level primitives (toast/notable/modal/chip) live in [ui-primitives.md](ui-primitives.md); this page is the concrete conventions layer.

## Buttons

| Kind | Class / anchor | Convention |
|---|---|---|
| Primary save (accent fill) | .btn.red ([songbook.css](../../shared/songbook.css) ~:254-257) | var(--accent) fill, var(--on-accent) text (always-dark, both themes); the ONLY accent-filled button; :active scale(.97) |
| Secondary (ghost) | .btn.ghost | transparent bg, var(--txt-soft) text, same active scale - default for non-destructive actions |
| Icon buttons | .iconBtn (~:199-201) | 44x44, var(--surface-2) bg, var(--accent-ink) glyph, radius 10px; active flips to accent fill + on-accent |
| Quick keys (transpose, queue nav, reorder) | .transposeChip button / .queueNav button / .li-up/.li-dn | surface-2 + line-strong border; active scale(.9). KNOWN DEBT: li-up/dn 40x32 sits below the 44px floor (registered) |
| Segmented controls | .modeSwitch / .viewToggle (~:202-219) | container bg-2 + 4px padding + radius 11; on-state = surface-2 + shadow ring TODAY - D-SELECTED-ACCENT rules this converges on the accent-fill grammar (design-enforce wave) |
| Bottom-nav tabs | .tabbar button (~:90-94) | column icon+label, flex-1 (44px+ wide); active = accent-deep bg + accent-ink; label .6rem uppercase 800 |
| Close/X | .setHd .x / .bt-st-x / .rf-x | transparent, txt-soft, 44px hit via padding; color-change feedback only (no scale) - the one sanctioned no-scale button family |

## Labels

| Kind | Class | Convention |
|---|---|---|
| Section labels (VERSE/CHORUS) | .sect | .68rem, var(--brass), uppercase, ls .16em, 700, Space Mono |
| Form/settings labels | .rf-lbl / .setLbl | .68-.78rem, var(--txt-dim), uppercase, ls .06em, 700 |
| Chord names | .chord-name | Space Mono 700 .82rem var(--txt) - chord/degree text is ALWAYS Space Mono |
| Roman numerals | .rn family | Space Mono 700, var(--accent-ink) |
| Meta/dim ladder | .li-title 1.12rem / .li-artist .79rem txt-soft / .li-meta .78rem txt-soft + 4px brass dots / .li-note .72rem | the HF-polish legibility ladder - do not shrink below it |

## Links

- Inline/external: var(--brass) (external) or var(--accent-ink) (in-app), underline offset 2px; external marked with the leave-app glyph (list-item action ladder).
- Link rows: .lyricsLinks / .bt-st-linkrow - centered flex, gap 6px 22px; labels must not wrap at 412px (U4 precedent: shorten text, never wrap).
- URLs users must tap are live links; never code-formatted.

## Modal / Disclosure / Tabs

- **Modal:** composeModalBackdrop standard (U7): dim backdrop, centered dialog, role=dialog + aria-modal, focus into dialog, Esc/hardware-Back/backdrop-tap all dismiss through NavHistory (no ghost history entries).
- **Disclosure (the app's accordion):** the why-toggle/Guide-toggle family (.bt-st-why-toggle pattern): collapsed by default, text toggle, per-open state only, never persisted.
- **Tabs:** bottom nav = top-level surfaces ONLY; segmented controls = view switches within a surface. Never nest segmented inside segmented.

## Forms

- Text inputs .bt-in/.search: bg-2 + line-strong, radius 9-12, focus border accent-ink, error class .bad -> var(--bad); placeholder txt-dim.
- Textarea .rf-seq: vertical resize, min-height 44px, Space Mono for sequence data.
- Select .picker: surface-2, radius 10, focus outline 2px var(--accent), max-width 46vw.

## Color tokens

The palette is the :root custom-property block in [songbook.css](../../shared/songbook.css) (dark default ~:14-52, light overrides ~:59-69) - THE token SSOT; never hardcode a color in a component rule. Key semantics: --txt/--txt-soft/--txt-dim (3-step text ladder); --accent (user-hue) with --accent-ink (readable-on-surface form: bright in dark theme, darkened in light), --accent-dim/--accent-deep (muted/deep selection surfaces), --on-accent (always-dark ink for accent fills); --brass (computed accent+dim mix for secondary highlights); --surface/--surface-2/--bg/--bg-2; --line/--line-strong; --warn/--bad/--good. Theme set pre-paint on <html data-theme>; accent hue persisted (music.accent.v1) and applied at runtime - any new accent-derived color MUST be computed (color-mix) so hue changes propagate.

## Fonts

- Families: Inter (UI), Space Mono (ALL music data: chords, romans, degrees, sequences, section labels).
- Size ladder: 1.12rem titles -> .82 chord names -> .78-.79 meta -> .72-.74 chips/notes -> .68 labels (floor for uppercase labels); SVG text floor 10px (phone DPI).
- Emphasis = weight + color only (400-800); no italics.

## Contrast + touch floors

- Text-on-fill contrast >= 4.5:1 in BOTH themes - the U3 precedent (per-class ink vars when fills differ by theme); any new fill class ships with its ink var and a dom test.
- 44px touch floor (GRIP) for every thumb target; movement-cancel (ListItem.wireTap) mandatory on scroll-rail actions (RAIL).
- One-screen-above-the-fold on phone (A7 gate) for Compose; measure, don't eyeball.

## Spacing / radius / motion

- Gaps: 8px button rows, 6px chip rows, 8-10px grids, 11-13px list padding, 14-16px cards.
- Radius: 11px buttons, 10px icon/secondary, 18px pill chips, 13-15px cards, 14-16px modals, 9-12px inputs. KNOWN SCATTER (7-13px oddballs) - tokenization in the design-enforce wave.
- Motion: transform .08s (press), background/border .15s, opacity .12-.15s; animations fadeUp .26s (screen enter), justSavedPulse 2s (save feedback). Nothing longer without a reason.

## Findings register (from the 2026-07-04 audit)

| Finding | Severity | Disposition |
|---|---|---|
| Guidance notable shares the selection surface (U10 camouflage) | HIGH (operator UAT) | design-enforce wave: distinct guidance surface token |
| Selected-state dual grammar (chips vs modeSwitch) | MED | D-SELECTED-ACCENT ruled: accent-fill everywhere; design-enforce wave |
| Radius scatter | LOW | tokenize in design-enforce wave |
| li-up/dn below 44px floor | MED | registered debt (setlist-edit rider) |
| kx ink vars theme-fragility | MED | correct today ([tracks.css](../../shared/tracks.css) + diagram.js per U3); any fill change re-verifies >=4.5:1 |

---

**Anchors verified:** songbook.css :root tokens + component classes (~:14-520); tracks.css kx ink vars + studio classes; repertoire-form.css form classes; list-item.js action ladder + wireTap; play/index.html pre-paint theme script + picker; decisions.md (D-SELECTED-ACCENT, D-LAYOUT-SSOT, D-TOAST-PRIMITIVE, U3/U4/U7 rows); ui-primitives.md (taxonomy, PR #145); interaction-safety.md (RAIL); design-principles.md (GRIP).
