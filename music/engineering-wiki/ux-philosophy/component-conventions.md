# Component + Token Conventions

[Wiki](../index.md) > ux-philosophy > Component + Token Conventions

## Purpose

The app's design-system reference: canonical style/convention per element class, plus the token palette (color, font, spacing, radius, motion) and contrast/touch floors. Governed by THE ELEMENT CONSISTENCY LAW in [systems/ssot-registry.md](../systems/ssot-registry.md) - one primitive per element class, composed everywhere, enforced by lint. Taxonomy-level primitives (toast/notable/modal/chip) live in [ui-primitives.md](ui-primitives.md); this page is the concrete conventions layer.

## Buttons

| Kind | Class / anchor | Convention |
|---|---|---|
| Primary save (accent fill) | .btn.red ([songbook.css](../../shared/songbook.css) ~:254-257) | var(--accent) fill, var(--on-accent) text (always-dark, both themes); the ONLY accent-filled button; :active scale(.97) |
| Secondary (ghost) | .btn.ghost | transparent bg, var(--txt-soft) text, same active scale - default for non-destructive actions |
| Icon buttons | .iconBtn (~:199-201) | 44x44, var(--surface-2) bg, var(--accent-ink) glyph, radius var(--r-btn-sm); active flips to accent fill + on-accent |
| Quick keys (transpose, queue nav, reorder) | .transposeChip button / .queueNav button / .li-up/.li-dn | surface-2 + line-strong border; active scale(.9). KNOWN DEBT: li-up/dn 40x32 sits below the 44px floor (registered) |
| Segmented controls | .modeSwitch / .viewToggle (~:202-219) | container bg-2 + 4px padding + radius var(--r-btn); on-state = accent-fill (background:var(--accent), color:var(--on-accent)) - D-SELECTED-ACCENT SHIPPED (M-DESIGN-ENFORCE wave 1): was surface-2 + shadow ring, now the SAME grammar as .chip.on |
| Bottom-nav tabs | .tabbar button (~:90-94) | column icon+label, flex-1 (44px+ wide); active = accent-deep bg + accent-ink; label .6rem uppercase 800 |
| Close/X | .setHd .x / .rf-x | transparent, txt-soft, 44px hit via padding; color-change feedback only (no scale) - the one sanctioned no-scale button family |
| Back (drill-down dismiss) | .iconBtn "←" - songbook.js's `#backLib` (song view); tracks.js's `.bt-st-back` (Practice Studio, F32 UI-std UAT) | leading (top-left, before the title), composes the plain .iconBtn convention above - NOT a bordered "close"-text pill. F32: the Studio's dismiss used to be `.bt-st-x` (a `.setHd .x`-style close pill, "close" text, trailing on the right) - retired in favor of matching the app's one standard back affordance, since a drill-down screen (Studio included) always returns via Back, never Close |
| Destructive (real delete) | .btn.danger (F33 UI-std UAT) | transparent bg + var(--bad) border/text at rest (mirrors `#setBody .li-rm`'s existing destructive-at-rest convention); var(--bad) fill + var(--on-danger) ink on `:active` (mirrors `.prog .slot .rm:active`). `.btn.red` is a MISNOMER (accent fill, not danger) - genuinely destructive actions (e.g. repertoire-form.js's real Delete, NOT the non-destructive fork "Revert to original") use `.btn.danger` instead |
| Compact row-companion CTA (Solo entry point) | .soloRowBtn (F28+F29 UI-std UAT) | accent-outlined pill, 44px floor (via the host row's `align-items:stretch`), radius var(--r-btn); shares ONE controls row with an adjacent segmented toggle instead of stacking a full-width CTA below it - Compose's `#chordCtrlRow` (beside the In-key\|All toggle, `#catChips`) and the song view's `.practiceRow` (beside Lyrics/Chords/Both + transpose + Stage). Compact label ("Solo"; a `title` attr carries the full phrase) so it fits the shared row at 375-412px. Entirely absent (not disabled) when there's nothing to solo over |

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

## Legend (dot-swatch + label rows)

`shared/legend.js` (`window.Legend.render(classes) -> HTMLElement|null`, M-EAR wave 1.6, U16, decisions.md D-EAR-1.6) is THE primitive for "here's what each colored dot/mark means" - never hand-roll a prose caption sentence for a dot-class legend again (it replaced exactly that: the old M-GUIDE W3a target-caption sentence).

| Convention | Detail |
|---|---|
| Fixed vocabulary | `LEGEND_ORDER = ['root','chord','blue','ghost','rub','sounding']` - a caller passes WHICH of these are currently visible on-screen (never a caller-invented class); unknown keys are silently dropped |
| Swatch = real tokens, never approximated hex | Each swatch is a tiny inline SVG circle using the SAME `kx-*` class + `var(--kx-*/--accent*/--dg-dot*/--sound-*)` styling `diagram.js`'s actual fretboard dots use - a theme/accent change propagates to the legend for free. `test/legend.test.js`'s Tier 2 static lint enforces ZERO literal hex anywhere in `legend.js`'s source |
| Container surface | `.legend` (tracks.css EOF) is a CARD surface - `--surface-2`/`--line`/`var(--r-card)` (same radius-by-role token every other card consumer uses, per the Spacing/radius section below), NOT a new surface token |
| Row shape | `.legendRow` (flex, gap 8px) > `.legendSwatch` (the SVG) + `.legendLbl` (`.72rem`, `var(--txt-soft)` - the SAME ink family `.bt-st-guide-txt` already uses for a plain description row, no new text-color token) |
| Order | Always renders in the FIXED `LEGEND_ORDER`, regardless of the caller's array order - root leads (the one class every scale render always has), then the D-TARGET precedence order (chord > blue > ghost), then the two MODIFIER classes (rub, sounding) last |
| Null-when-empty | `render()` returns `null` (no DOM, no empty card) when the classes array is empty/falsy - same convention as `KeyExplorer.renderScale`/`Diagram.scale` |
| Reuse, don't reinvent | Any future dot-class legend (a new theory surface, a Compose-side equivalent) MUST call `Legend.render()`, not hand-roll a second caption/legend component - extend `LEGEND_ORDER`/`DEFS` in `legend.js` if a genuinely new class is needed |

## Guidance copy

Any card/caption/notable copy that references a derivable musical object (relative minor/major, parallel key, the V chord, etc.) must NAME the concrete instance for the current key, not just describe the relationship - see [design-principles.md](design-principles.md)'s "Name the instance, not just the relationship" (D-REL-NAMES). `shared/solo-guide.js`'s `{relMinor}`/`{relMajor}` template tokens + `relNames()` resolver are the reference implementation.

## Modal / Disclosure / Tabs

- **Modal:** composeModalBackdrop standard (U7): dim backdrop, centered dialog, role=dialog + aria-modal, focus into dialog, Esc/hardware-Back/backdrop-tap all dismiss through NavHistory (no ghost history entries). Second consumer SHIPPED M-DESIGN-ENFORCE wave 2 (UAT U19): `openConfirmModal()` in play/index.html, the Settings backup/restore restore-confirm decision (was a native `confirm()`) - confirms the pattern generalizes beyond Compose. Layering a NavHistory-registered modal on top of a NON-NavHistory panel (Settings) needs `e.stopPropagation()` in the modal's own Escape handler so the panel's own document-level Escape listener doesn't ALSO fire.
- **Disclosure (single):** the why-toggle/Guide-toggle family (.bt-st-why-toggle pattern): collapsed by default, text toggle, per-open state only, never persisted.
- **Accordion (EXCLUSIVE disclosure group, M-SETTINGS-CLARITY 2026-07-05):** [shared/accordion.js](../../shared/accordion.js) + the `.accSec`/`.accBtn`/`.accBody` family (songbook.css) - one open section at a time, zero-open allowed, per-open state only (reset to all-collapsed at every panel open). For PANEL surfaces (sheets/dialogs) with a single scroller ONLY - decision D6 (Compose = flattened, no accordions) still governs screen scrollers. Header = real button, 44px floor, `aria-expanded` + rotating caret; body carries the `.accBody[hidden]{display:none}` U24 guard. First consumer: the Settings sheet sections. Full taxonomy entry: [ui-primitives.md](ui-primitives.md) ACCORDION.
- **Help icon (M-DESIGN-ENFORCE wave 2, UAT U19 - "help panels clearly noted with an icon"):** when a HELP-nature disclosure toggle (ui-primitives.md HELP primitive) could otherwise read as ambiguous, add the `.helpIcon` class ALONGSIDE the toggle's own class (songbook.css `::before{content:'\24D8'}` - a small circled-i glyph, no markup change). Declared in songbook.css (not tracks.css) since it loads app-wide - the class is portable to any toggle in any file. Application to the existing why-toggle/Guide family (tracks.js, `.bt-st-why-toggle`) is DEFERRED-TO-SIBLING (M-EAR-1.6 grant) - see Findings register below.
- **Tabs:** bottom nav = top-level surfaces ONLY; segmented controls = view switches within a surface. Never nest segmented inside segmented.

## Forms

- Text inputs .bt-in/.search: bg-2 + line-strong, radius 9-12, focus border accent-ink, error class .bad -> var(--bad); placeholder txt-dim.
- Textarea .rf-seq: vertical resize, min-height 44px, Space Mono for sequence data.
- Select .picker: surface-2, radius 10, focus outline 2px var(--accent), max-width 46vw.

## Color tokens

The palette is the :root custom-property block in [songbook.css](../../shared/songbook.css) (dark default ~:14-52, light overrides ~:59-69) - THE token SSOT; never hardcode a color in a component rule. Key semantics: --txt/--txt-soft/--txt-dim (3-step text ladder); --accent (user-hue) with --accent-ink (readable-on-surface form: bright in dark theme, darkened in light), --accent-dim/--accent-deep (muted/deep selection surfaces), --on-accent (always-dark ink for accent fills); --brass (computed accent+dim mix for secondary highlights); --surface/--surface-2/--bg/--bg-2; --line/--line-strong; --warn/--bad/--good. Theme set pre-paint on <html data-theme>; accent hue persisted (music.accent.v1) and applied at runtime - any new accent-derived color MUST be computed (color-mix) so hue changes propagate.

### Note palette (U20, M-EAR wave 1.6, decisions.md D-EAR-1.6)

The kx-* fretboard dot-class colors (root/chord/blue/sounding) derive from the user's OWN `--accent` hue via **CSS Relative Color Syntax** (`oklch(from var(--accent) L C calc(h + offset))`), feature-detected behind `@supports (color: oklch(from red l c h))` - a literal-hex fallback pair (unchanged from pre-U20) covers browsers without support. Only the HUE (`h`) rotates per class; **L** (lightness) and **C** (chroma) are PINNED per theme so an unusually bright or muted user-chosen accent can't blow the contrast floor - only H tracks the picker.

| Class | Hue offset | Dark theme L/C | Light theme L/C | Why this offset |
|---|---|---|---|---|
| root | 0 (= `--accent` itself) | n/a (uses `--accent` directly) | n/a | It IS home - no rotation |
| chord (chord tone) | h + 30 | L .74 / C .15 | L .50 / C .16 | Adjacent - harmonious with root, still distinguishable |
| blue (blue note) | h - 30 | L .74 / C .15 | L .48 / C .18 | Adjacent on the OTHER side from chord - distinct from both root and chord |
| ghost (outside) | unchanged (neutral gray, `--kx-ghost`) | - | - | Deliberately an outline/absence signal, not a "note color" |
| rub | no fill of its own (renders on a plain `--dg-dot` "scale" fill + dashed ring) | - | - | A MODIFIER, not a base class |
| sounding | h + 180 (complementary) | L .22 / C .06 (bg), L .72 / C .10 (line) | L .93 / C .03 (bg), L .42 / C .18 (line) | Needs MAXIMUM perceptual distance - marks a transient "playing right now" state, not a persistent theory class |

Declared: tracks.css (`--kx-chord`/`--kx-blue`, right after their literal-hex fallback), songbook.css (`--sound-bg`/`--sound-line`, right after their `:root[data-theme="light"]` fallback). Guarded by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js)'s "(d) U20" block - every `@supports` palette declaration must derive from `var(--accent)`, zero stray literal hex inside that block. Live-verified (shipping PR's V&V): changing the accent picker re-colors BOTH the real fretboard dots AND the Legend swatches (shared/legend.js reuses the SAME kx-* classes) to the identical resolved color, in both themes - screenshots in the PR body. Not exhaustively re-verified against every one of the app's 7 accent choices; spot-checked at the default (teal) and one hue-shifted pick (coral, light theme) plus one dark-theme pick (violet).

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
- Radius: SHIPPED as 5 SSOT tokens (M-DESIGN-ENFORCE wave 1, songbook.css :root token block; guarded by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js)) - `--r-btn` (11px: buttons + segmented-control containers), `--r-btn-sm` (10px: icon/compact buttons + segmented-control inner buttons), `--r-chip-pill` (18px: the .chip family), `--r-card` (13px: card/panel surfaces incl. .listItem), `--r-input` (10px: applied narrowly - see scope note below). Values are the actual per-class MAJORITY found by inventory, not a fixed default (`--r-card` is 13, not a rounder 14, because 6 of 8 card-shaped consumers already agreed on 13). Modals/overlays (.rf-box, .bt-pl-box, .bt-qpanel-box) keep their OWN 14-16px range, deliberately un-tokenized - a modal is a different bucket from a card. `.search`/`.bt-in` (9-12px) also stay un-tokenized - documented as an accepted input-radius range, not the scatter finding; only the one input consumer that already matched (`.composeRowInput`) was tokenized.
- Motion: transform .08s (press), background/border .15s, opacity .12-.15s; animations fadeUp .26s (screen enter), justSavedPulse 2s (save feedback). Nothing longer without a reason.

## Findings register (2026-07-04 audit, wave 1; 2026-07-05 audit, wave 2 UAT U19; wave 3 M-UI-STD)

| Finding | Severity | Disposition |
|---|---|---|
| Solo entry point buried below the In-key\|All toggle (Compose) / bolted below the sheet (song view), not beside the other controls | MED (operator UAT, F28+F29) | SHIPPED (wave 3): `.soloRowBtn` shares ONE controls row with the adjacent segmented toggle on both surfaces - see the Buttons table row above |
| Suggested-chords row has no label at all past the 4th chord | LOW (operator UAT, F30) | SHIPPED (wave 3): `renderSuggest` always renders a `.suggLbl` ("Next chord" past the ordinal range) - the old "the panel's own summary already says it" rationale didn't hold (no such summary existed) |
| Save-confirmation toast (`persist:true`) could outlive a NEW progression/Clear, reading as a stuck panel | HIGH (operator UAT, F31) | SHIPPED (wave 3): dropped `persist:true`; `hideComposeToast()` explicitly ends it on any mutating action (piggybacked on `invalidateClearUndo()`) and on Clear directly |
| Studio dismiss (`.bt-st-x`, a bordered "close"-text pill) didn't match the app's standard Back affordance | MED (operator UAT, F32) | SHIPPED (wave 3): `.bt-st-back` composes the plain `.iconBtn` "←" convention (matches `#backLib`) - see the Buttons table Back row |
| Edit-form Delete sat bottom-right (one-hand thumb zone) and used `.btn.ghost` (non-destructive look) despite being genuinely destructive | HIGH (operator UAT, F33) | SHIPPED (wave 3): reordered (Delete/Revert left, Save right) + `.btn.danger` for the real Delete only - see the Buttons table Destructive row |
| Guidance notable shares the selection surface (U10 camouflage) | HIGH (operator UAT) | SHIPPED (M-DESIGN-ENFORCE wave 1): distinct `--guide-bg`/`--guide-line` guidance-surface tokens, computed off `--txt-dim` (accent-independent) + a `--brass` left accent stripe; screenshot-verified both themes |
| Selected-state dual grammar (chips vs modeSwitch) | MED | SHIPPED (M-DESIGN-ENFORCE wave 1): D-SELECTED-ACCENT - `.modeSwitch button.on` / `.viewToggle button.on` now use the same accent-fill grammar as `.chip.on` |
| Radius scatter | LOW | SHIPPED (M-DESIGN-ENFORCE wave 1): 5 radius-by-role tokens, migrated button/chip/card oddballs - see the Radius line above |
| li-up/dn below 44px floor | MED | registered debt (setlist-edit rider) |
| kx ink vars theme-fragility | MED | correct today ([tracks.css](../../shared/tracks.css) + diagram.js per U3); any fill change re-verifies >=4.5:1 |
| Two stacked, visually inconsistent feedback surfaces on the same action (amber toast + gray inline undo panel) | HIGH (operator UAT, U19 screenshot) | SHIPPED (M-DESIGN-ENFORCE wave 2): TOAST+ACTION primitive (toast.js `Toast.showAction`) - one taxonomy, one visual signature (message + Undo + countdown bar), migrated both the setlist item-remove undo and the Compose Clear undo onto it; see decisions.md D-ENFORCE-2 |
| Native `confirm()`/`alert()` in the Settings backup/restore flow | HIGH (U19-named KNOWN offender) | SHIPPED (M-DESIGN-ENFORCE wave 2): `showSettingsToast()` (outcomes/errors) + `openConfirmModal()` (the restore decision), reusing the existing TOAST/MODAL primitives - zero native dialogs remain in play/index.html; guarded by [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js) |
| Native `confirm()` elsewhere in songbook.js (delete a custom item, clear the whole setlist) and repertoire-form.js (delete confirmation) | LOW-MED (pre-existing, "backlog: SETX phase 2" per this page's Buttons/Modal sections before wave 2) | NOT fixed this wave - out of the U19 grant (backup/restore flow only); count pinned by [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js) so it can't silently grow |
| Help-nature disclosure toggles (Guide / "Why these notes?" / "Find a jam") have no visual marker distinguishing them from a functional control | LOW | Convention DRAFTED this wave (`.helpIcon`, songbook.css) - not yet APPLIED; the toggles themselves live in tracks.js (M-EAR-1.6 grant), DEFERRED-TO-SIBLING |

---

**Anchors verified:** songbook.css :root tokens + component classes (~:14-520, incl. the M-DESIGN-ENFORCE `--guide-bg`/`--guide-line`/radius-token/`.toastAction`/`.toastBar`/`.helpIcon` blocks, wave 3's `.chordCtrlRow`/`.soloRowBtn`/`.btn.danger`); tracks.css kx ink vars + studio classes (wave 3: `.bt-st-back` composes `.iconBtn`, `.bt-st-x` removed); repertoire-form.css form classes; list-item.js action ladder + wireTap; play/index.html pre-paint theme script + picker + `showSettingsToast`/`openConfirmModal` + wave 3's `#chordCtrlRow`; decisions.md (D-SELECTED-ACCENT, D-LAYOUT-SSOT, D-TOAST-PRIMITIVE, D-ENFORCE-1, D-ENFORCE-2, U3/U4/U7 rows, D-EAR-1.6); ui-primitives.md (taxonomy, PR #145; TOAST+ACTION/HELP added wave 2); interaction-safety.md (RAIL, guard #3 amended wave 2); design-principles.md (GRIP); [test/consistency-lint.test.js](../../../test/consistency-lint.test.js) (E1/E2/E3 static guards, wave 3's `.bt-st-x` entry removed - now covered by the pre-existing `.iconBtn` row); shared/legend.js + [test/legend.test.js](../../../test/legend.test.js) (M-EAR wave 1.6, U16 - the Legend primitive + its no-raw-hex source lint); [test/toast-action.test.js](../../../test/toast-action.test.js), [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js) (wave 2 guards); wave 3 (M-UI-STD, F28-F33): songbook.js (`hideComposeToast`, `invalidateClearUndo` extension, `renderSuggest`'s always-on `.suggLbl`, song-view `soloRowBtn` in `.practiceRow`), tracks.js (`.bt-st-back` markup + click wiring), repertoire-form.js (`.rf-actions` reorder + `.btn.danger`), [test/songbook.test.js](../../../test/songbook.test.js) (F30/F31 tests, S-TOAST/U9 updated), [test/tracks.test.js](../../../test/tracks.test.js) (F32 source-pin), [test/repertoire-form.test.js](../../../test/repertoire-form.test.js) (F33 source-pin).
