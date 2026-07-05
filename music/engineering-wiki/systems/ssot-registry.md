# Single-Source-Of-Truth (SSOT) Registry

[Wiki](../index.md) > systems > SSOT Registry

## Purpose

Canonical inventory of app-wide singletons: each quantity's ONE owner, its consumers, and the never-redeclare rule. Operator directive (2026-07-04): duplicates of these caused real bugs (wireTap x4, escHTML x8, the shadowed toast timer); this registry is the standing map. Per its own rule, this page POINTS at owners - it never restates their contents.

## Registry

| Quantity | SSOT owner | Consumers | Rule |
|---|---|---|---|
| Theory intervals (modes + solo scales) | [circle.js](../../shared/circle.js) Circle.MODE_STEPS (:34-37) + SOLO_SCALES + BLUES_KEY | key-explorer, tracks, songbook (syncStepsFromCircle), solo-guide, tests | Never recompute steps in a consumer; see [theory-engine/architecture.md](../theory-engine/architecture.md) - do NOT restate interval tables anywhere (including here) |
| Note spelling (FORK-4 canonical-sharp) | [circle.js](../../shared/circle.js) ROOTS/spell() | every name-emitting surface (4, enumerated in [architecture.md](../theory-engine/architecture.md)) | Flats normalize to sharps at entry; key-aware regime lands ONLY via the named #98 seam |
| HTML escaping | [esc.js](../../shared/esc.js) Esc.esc (strict &<>"') | list-item, tracks, repertoire-form, diagram, songbook, both play html pages | Never a local esc variant; user text never hits innerHTML unescaped (D-HARDEN; XSS precedent PR #67) |
| Movement-cancel tap guard | [list-item.js](../../shared/list-item.js) ListItem.wireTap | songbook delegates (wireTapCancel/composeWireTap), scroll-rail actions | Any scroll-rail action MUST route through wireTap (RAIL, [interaction-safety.md](../ux-philosophy/interaction-safety.md)) |
| Toast + undo-toast feedback | [toast.js](../../shared/toast.js) (SHIPPED PR #145 - one timer per host; `showAction`/`wirePauseOnTouch` added M-DESIGN-ENFORCE wave 2, D-ENFORCE-2 - the TOAST+ACTION countdown-bar undo primitive) | songbook library + compose toasts, setlist item-remove undo, Compose Clear undo (thin delegates), play/index.html Settings backup/restore outcomes | Never a local toast timer/element; the shadowed-timer bug class (U9) is why. Never a local undo-countdown timer either - `showAction()` is the one place pause/resume elapsed-time math lives |
| Layout tokens | [songbook.css](../../shared/songbook.css) :root token block (SHIPPED PR #144: --dg-canvas-w, --tile-min, --tile-gap, --prog-tile-min) | chordGrid/keyPalette/prog rules; guarded by test/layout-token-lint.test.js + scripts/layout-check.py | Never hardcode a tokenized quantity outside the block ([layout-tokens.md](layout-tokens.md)) |
| List-item rendering | [list-item.js](../../shared/list-item.js) ListItem render | library, curate results, setlist | One row renderer (the retired songCard/bt-card/setItem history, PR #60) |
| Per-instrument data + voicing seam | [profiles/*.js](../../shared/profiles/) packs + [chord-pack-adapter.js](../../shared/chord-pack-adapter.js) buildAdapter (PR #137) | diagram render, chord picker, shape-classify (reads) | The adapter is the ONLY instrument seam; never hardcode a voicing ([instrument-profiles.md](instrument-profiles.md)) |
| Shape metadata | [shape-classify.js](../../shared/shape-classify.js) (PR #134; consumed by diagram-pref PR #143) | diagram-pref labels | Never infer shape from a chord name; classify the actual frets; unclassifiable = honest null |
| Suggestion table | [sugg.js](../../shared/sugg.js) Sugg.SUGG (PR #137; name-keyed, e.g. SUGG['C'] -> ['G','Am','F','Em','Dm']) | Compose next-chord chips, completions | Never build follower rules in a consumer; FORK-4 agreement is test-locked |
| Storage schema | [storage-migrate.js](../../shared/storage-migrate.js) runner + the key inventory in [data-model.md](data-model.md) (PR #135) | boot (runs first), backup restore (replays it, PR #138) | No shape change without a registered migration; every key lives in the inventory |
| Backup envelope | [backup.js](../../shared/backup.js) OWNED_PREFIXES/EXCLUDE/SCHEMA_VERSION | Settings export/restore | Version-in-envelope + restore-replays-runner is the ruled pair (D-BACKUP-INTEGRATE); tri.* included since PR #138 |
| Guidance copy | [solo-guide.js](../../shared/solo-guide.js) SoloGuide cards (PR #118, P5 fold + professor micro-pass 2026-07-04) | Studio Guide, Compose framing caption | Curated static only (A9); {i} interpolation is the only dynamic step |
| SW precache law | [sw.js](../../sw.js) CACHE/CORE + [sw-verify.test.js](../../../test/sw-verify.test.js) + [check-cache-bump.sh](../../../scripts/check-cache-bump.sh) | every shipped shared/play change | CORE lists every runtime-loaded shared file; CACHE bumps on ANY shared/play content change - identical-string collisions are the known silent failure (PRs #117, #145) |
| UI element conventions | [ux-philosophy/ui-primitives.md](../ux-philosophy/ui-primitives.md) + [component-conventions.md](../ux-philosophy/component-conventions.md) | every view | THE ELEMENT CONSISTENCY LAW (below) |

## The Element Consistency Law (operator directive, 2026-07-04 - standing)

**"Make a prim and enforce consistency" applies to EVERY element in EVERY view.** Concretely:

1. Any UI element class that appears in more than one view derives from ONE primitive (component class family + tokens) documented in [ui-primitives.md](../ux-philosophy/ui-primitives.md) / [component-conventions.md](../ux-philosophy/component-conventions.md).
2. A new view COMPOSES existing primitives; inventing a variant is a lint failure, not a style choice. Enforcement lives in the lint suite (layout-token-lint, tracks-css-lint pattern) and grows with each primitive.
3. Semantic distinction is part of the law: two different MEANINGS never share one look (the U10 camouflage: guidance notable vs in-setlist selection wearing the same surface).
4. UAT consistency findings route to the PRIMITIVE, never patched at the instance.

## Duplication watchlist

| Pattern | Locations | Status |
|---|---|---|
| Selected-state grammar (accent-fill vs surface+ring) | .chip family vs .modeSwitch/.viewToggle | SHIPPED (M-DESIGN-ENFORCE wave 1, D-ENFORCE-1): both now `background:var(--accent);color:var(--on-accent)`; guarded by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js) |
| Notable surface vs selection surface | notable banner vs .listItem inSet highlight | SHIPPED (M-DESIGN-ENFORCE wave 1, D-ENFORCE-1): dedicated `--guide-bg`/`--guide-line` tokens (accent-independent, off `--txt-dim`) + `--brass` left stripe; screenshot-verified both themes |
| Border-radius scatter (7-13px) | button variants across css files | SHIPPED (M-DESIGN-ENFORCE wave 1, D-ENFORCE-1): 5 radius-by-role tokens (`--r-btn`/`--r-btn-sm`/`--r-chip-pill`/`--r-card`/`--r-input`), migrated oddballs to the per-class majority value |
| .bt-st-chords missing the SVG clamp | tracks.css (same U5/#96 class) | flagged by #144; fix queued |
| Pentatonic/blues key-aware spelling | circle.js regime A | blocked on #98 (S-BLUES-B) |

---

**Anchors verified:** circle.js:34-37 + SOLO_SCALES/BLUES_KEY blocks; esc.js; list-item.js wireTap+render; toast.js (PR #145); songbook.css :root tokens (PR #144; `--guide-bg`/`--guide-line`/radius-token blocks, M-DESIGN-ENFORCE wave 1); chord-pack-adapter.js + sugg.js (PR #137); shape-classify.js (PR #134); storage-migrate.js (PR #135); backup.js (PR #138); solo-guide.js (PR #118); sw.js + scripts/check-cache-bump.sh; test/consistency-lint.test.js (E1/E2/E3 static guards); decisions.md registry rows (D-SELECTED-ACCENT, D-ENFORCE-1).
