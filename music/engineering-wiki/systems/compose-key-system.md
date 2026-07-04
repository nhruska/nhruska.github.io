# Compose Key System

[Wiki](../index.md) > systems > Compose Key System

## Purpose

One source of truth for "what key am I in": songKey drives the palette, the roman labels, the transpose readout, and the Studio hand-off - with no drift.

## songKey - the single authority [STABLE]

`songKey = { root, mode, explicit }` (songbook.js ~1459 region... declared with the key-picker block ~1677). Picking a key sets it (explicit); with no explicit pick, the root derives from the first chord. The compact key chip (fixed width, injected into the button bar) doubles as the transpose readout and the fly-out toggle.

## Transpose == key movement [STABLE]

Transposing the progression moves songKey.root by the same semitone delta (and picking a NEW root transposes the built progression by the tonic delta, shortest direction). The readout, palette, and Studio all follow together - no picker-key vs transposer-key split. Decision D1.

## Mode change ALWAYS re-harmonizes [STABLE]

The one key/mode filter drives the chords: root change transposes; mode change re-qualifies (modal interchange) via convertToMode. C major I-IV-V -> C minor i-iv-v. Best-effort rule: a chord whose root is not a degree of the target mode is left unchanged (borrowed chords survive). Rationale (locked): this app is solo-practice - pick key+mode -> harmonized progression -> solo; freezing chords against a mode change belongs to a composing app. Decision D3. Re-tapping the CURRENT mode is a no-op confirm: with a root set it closes the panel (guards against list-swap surprises); with no root yet it re-renders instead of no-op-ing entirely, so the chip stays visibly live (F12 dead-chip fix, decision D-KEYLESS).

The mapping itself - re-qualify each chord's root against the target mode's degree quality, re-basing any 7th-type extension, leaving a chromatic/borrowed root unchanged - is a pure extracted function, `convertProgressionQualities(chords, targetMode, tonicRoot, sourceMode)` (songbook.js, exported on `Songbook`). `convertToMode` (root-set path) is now: call the pure fn + set songKey.root/mode/explicit + close the panel + full re-render - unchanged behavior. `sourceMode` now also drives the W2 Blues-aware directions - see [harmonization.md](../theory-engine/harmonization.md) for the full 4-direction table (Major/Minor/Mixo/Dorian <-> Blues) and the professor-fold amendment (D-BLUES-KEY).

## Keyless-until-pick: chord-list actions never auto-establish a key [STABLE]

Decision D-KEYLESS: once the key has been cleared (or never set), further chord-list actions on the progression - mode-chip taps and transpose - do NOT resurrect a root. Only an explicit ROOT pick (or the pre-existing 2+-chord auto-infer at add-time, unrelated to this decision) sets `songKey.root`.

- **Mode change while keyless**: re-qualifies the progression around the FIRST CHORD's root (the same tonic `labelRoman` measures against) via `convertProgressionQualities`, but `songKey.root` stays `null` and `songKey.explicit` stays `false`. The fly-out panel stays OPEN (unlike the root-set path, which closes) so further mode taps keep landing without a re-open trip.
- **Transpose while keyless** (`composeTpose`): moves the chords; `songKey.root` stays `null`. This supersedes the prior first-chord-fallback behavior (codex #90 V1, which derived a key from a one-chord transpose) per operator ruling I4. Accepted consequence: the "Solo over a backing track" CTA (which gates on `songKey.root && progression.length`) no longer lights from a keyless transpose alone - the pick-a-key CTA in the chord list carries that path instead.
- **Root-pick handler is unchanged** (out of scope for D-KEYLESS): picking a root always transposes the progression to the new tonic and sets `explicit = true`; it never re-qualifies. It also does not itself close the fly-out (`keyPopoverOpen` untouched) - the completing gesture is a mode tap (a re-tap of the now-current mode, or a real mode change), which closes the panel once a root is set.

## Key picker: compact chip + fly-out [STABLE]

Always visible: the key/mode chip (root + abbreviated mode; 'shifted' lights when transposed off the built key). On demand: the fly-out with the 12-root grid + mode toggle + Triads & Inversions link (carries ?p&key&mode). Picking a root keeps the panel open for the mode pick (one gesture); tapping the selected root clears the key (context only - chords stay put). While the fly-out is open the chord picker hides (composeWrap.keyOpen) so Compose stays one-screen.

## In-key | All adaptive picker [STABLE]

ONE chord list with a segmented toggle (buildGrid, ~1581+): In-key = diatonic palette with roman labels (default when a key is set; prominent pick-a-key CTA otherwise); All = chromatic grid + type tabs (Major/Minor/7th/...). NOT key-locked by design - blues, borrowed, secondary dominants need the escape hatch (decision D5). Key pick/clear resets the view to follow-the-key; an explicit segment tap pins it.

## Flattened one-screen layout [STABLE]

Two regions: .composeTop (FIXED - action bar + progression strip + key chip + toggle) and .composeChords (the ONLY scroller). No accordions; fixes the nested-scroll swipe trap (decision D6). The fold gate (A7) protects the fixed region's geometry at 412x915.

## Roman labeling - one path [STABLE]

labelRoman(c): key set -> romanInKey(c, root, mode) (mode-aware - a mode toggle flips bVII <-> VII on the same chord); no key -> chromatic romanFor against the derived tonic. The mode is part of the progression strip's render signature so labels never go stale.

## Blues mode row (W2) [STABLE]

`MODES.Blues` is a 5th entry in the same `songbook.js` MODES table the mode-chip loop (`buildKeyPicker`) iterates generically - no special-casing needed for it to appear as a chip. It carries a 3-entry palette (`steps: [0, 5, 7]`, `quals: ['7','7','7']`, its own `romans: ['I','IV','V']`) rather than the 7-entry diatonic shape every other mode uses; every consumer that reads `m.steps`/`m.quals`/`m.romans` (chordInKey, romanInKey, chordsFromDegrees, diatonicChords) is already generic over the array length, so Blues needed zero new branches in those - only `chordInKey`/`romanInKey` gained an explicit `m.quals[deg] === '7'` check for the palette-minimalism rule (plain triad or dominant 7th only; no ii/dim/maj7/subs) and the I7/IV7/V7 labeling. `completions()` (famous-progression auto-suggest) top-guards Blues to `[]` - it measures against the 7-degree MAJOR-scale canon, a category mismatch for a 3-degree palette; Blues is reachable only by explicit pick or a Blues starter, never inference (`inferKey` never proposes it). See [harmonization.md](../theory-engine/harmonization.md) for the full chordInKey/romanInKey/convertProgressionQualities detail.

## 12-bar / quick-change starters + D-CAP12 (W2) [STABLE]

Two `PROGRESSIONS` entries carry optional `mode`/`preview` fields the diatonic entries simply omit: `{ name: '12-bar blues', mode: 'Blues', degrees: [0,0,0,0,1,1,0,0,2,1,0,2], preview: 'I7 IV7 V7' }` and a quick-change variant (`degrees: [0,1,0,0,1,1,0,0,2,1,0,2]`) - both 0-indexed into `MODES.Blues`' own 3-entry palette (0=I7, 1=IV7, 2=V7), resolved by `chordsFromDegrees`'s mod-N generalization (mod-3 for Blues, unchanged mod-7 for every diatonic mode). `loadProgression(p)` takes the whole entry now (was `degrees` alone) so `p.mode` can override the `'Major'` default; `renderSuggest`'s empty-state roman line prefers `p.preview` over the per-slot Major-only derivation (which would mislabel a 12-slot fill as 12 distinct romans).

**D-CAP12**: the Compose progression cap raised from 8 to 12 (fits a 12-bar fill) via one shared `COMPOSE_MAX` const both gates (`addChord`, `renderProg`'s `.maxed` toggle) read - operator-visible via the updated `maxNote` copy ("Max 12 chords..."). The fixed-width `.keyPickerCompact` chip needed 80->88px (chip-clip fold gate caught "G# Blues" clipping - `MODE_SHORT.Blues` is the unabbreviated full word, unlike Maj/Min/Mixo/Dor).

## Solo-scale preview in the key-view fly-out (W3b, extended S-CHIPS-PLUS) [STABLE]

`renderKeyView()` carries a small, DECOUPLED solo-scale preview - a chip row (`.keySoloScale`: `<Scale label> | Pent major | Pent minor | Blues` on a non-Blues key, or `<Blues> | Pent major | Pent minor | Mixolydian` on a Blues key) + a notes line (`.keySoloNotes`) + a degrees line (`.keySoloDegrees`) + an optional one-line teaching caption (`.keySoloFrame`) - directly below the key title and above the "Triads & Inversions" link, whenever `songKey.root` is set. This is a PREVIEW only: the fly-out stays a pure key/mode picker (the fretboard, chord-tone targeting, and full guidance cards are the Practice Studio's job, per the "Key picker: compact chip + fly-out" section above) - Compose gets the one-line framing caption, nothing more.

**Decoupled + non-persisted (isolation-tested):** a chip tap re-derives ONLY this block. It never reads or writes `songKey`, `progression`, the In-key palette, or the build grid - `soloChipScale`/`soloChipDegrees`/`soloChipCaption` (the three pure helpers this wires) take `root`/`keyMode`/`scaleId` as plain arguments and return a value with zero reference to the module's mutable state. Every `renderKeyView()` call defaults back to the mode's own scale (`curChipId = 'mode'`) - nothing about the chip selection survives a re-render, let alone a page reload.

**Derivation is Circle-only** (`soloChipScale(root, keyMode, scaleId)`, songbook.js top-level, exported on `Songbook`): Songbook stays Tracks-agnostic, so it never imports tracks.js. `'mode'` resolves to the KEY's own scale - `Circle.spellScale(root, CIRCLE_MODE[canonMode(keyMode)])` for Major/Minor/Mixolydian/Dorian, or `Circle.soloScale(root, 'blues')` when `keyMode` is Blues. `'pentMajor'`/`'pentMinor'`/`'blues'` read `Circle.soloScale(root, scaleId)` directly, independent of the key's own mode. `'mixolydian'` (S-CHIPS-PLUS) reads `Circle.spellScale(root, 'mixolydian')` directly, same independence.

**Blues-key dedup, and the freed slot's new tenant (S-CHIPS-PLUS):** when `songKey.mode` is already Blues, the row drops the standalone Blues chip because the mode's OWN scale already IS the 6-note blues scale - a 4th "Blues" chip would just re-select the identical notes under a second button (mirrors the Practice Studio's `th.scaleMode === 'blues'` CHIPS filter, tracks.js `wireScaleChips`). The P5 W3 UAT verdict asked for that freed slot to do something useful rather than sit at 3 chips: it now carries **Mixolydian** - the dominant-scale option a player actually reaches for over a Blues key's own I7/IV7/V7 harmonizing palette (`Circle.BLUES_KEY`) - so the Blues-key row is `[Blues | Pent major | Pent minor | Mixolydian]`, 4 chips, same count as every other key's row.

**Degrees line (S-CHIPS-PLUS):** `soloChipDegrees(keyMode, scaleId)` mirrors `soloChipScale`'s own scaleId routing exactly (same branches, same order) so a chip's notes and its degrees line always describe the SAME scale - `Circle.scaleDegrees(mode)` for the mode/mixolydian branches, `Circle.soloScaleDegrees(scaleId)` for pentMajor/pentMinor/blues. Renders as a small monospace muted line (`.keySoloDegrees`, songbook.css) directly under `.keySoloNotes`, same styling family as the Practice Studio's own degree glyphs (tracks.css `.cofDeg .dg`) - e.g. Mixolydian shows `1 2 3 4 5 6 ♭7` under its note names. Root-independent (degree formulas don't need a root) and best-effort: a null/empty result just hides the line, never blocks the chip.

**Caption is a guarded, optional seam** (`soloChipCaption(scaleId)`, also top-level + exported): consumes `window.SoloGuide.framing(scaleId, family)` (shared/solo-guide.js, the W3a wave) when present, via a `global.SoloGuide || require('./solo-guide.js')` guard identical in shape to the existing `global.Circle` guard elsewhere in this file. W3a and W3b are disjoint files with a locked, merge-order-free seam - absent SoloGuide (not yet merged, or the script didn't load) degrades to `null` (no caption shown), never throws; chips stay fully usable either way. `'mode'` never captions, matching the Studio (its default/mode chip never shows a caption either, even when that scale happens to be Blues). `SoloGuide.framing()` has no `mixolydian` branch (it's a curated per-scaleId prose table from the S-BLUES era) - the Mixolydian chip's caption instead falls back to `SoloGuide.card('mixolydian').chooseWhen`, which needs no `{i}` note interpolation for that block and so is "trivially reachable" per the P5 W3 verdict; same never-throws guard shape.

**CSS composes, doesn't redeclare:** `.keySoloScale` (songbook.css) only lays out the row (flex/gap/margin) and the 44px touch-floor override; the chip buttons themselves reuse the existing `.chip` base class (border/background/radius) - no 4th chip-variant style was introduced. `.keySoloDegrees` is new but equally thin: monospace font-family + dim color + small font-size, no layout of its own beyond a bottom margin.

**P5's bar-by-bar target-emphasis ask - disposition (S-CHIPS-PLUS):** the P5 W3 UAT verdict's separate ask - emphasizing the 3rd/b7/root bar-by-bar as the progression plays - is LARGELY satisfied by what already shipped pre-S-CHIPS-PLUS: chords-in-key tap targeting plus the D-TARGET ghost-dot fix (every chord tone renders, in-scale filled / out-of-scale hollow) already answers "which note matters over THIS chord, right now" for any chord the player taps. What remains unbuilt is the **auto-advancing** part - targets that shift on their own in sync with playback, rather than on a manual tap - which needs a playback/transport concept the Studio doesn't have yet. That remainder is explicitly out of scope here and stays a LONG-horizon candidate (no spec) rather than folded into this mission.

---

**Anchors verified:** songbook.js ~1883-2130 (buildGrid, buildKeyPicker, convertToMode wiring, labelRoman/renderProg signature comment), ~1750-1980 (songKey + fly-out, mode-chip onclick incl. Blues palette-degree branches), ~1657-1674 (composeTpose, D-KEYLESS), ~238-291 (convertProgressionQualities, pure extracted mapping incl. W2 blues-aware directions), ~76-83 (MODES.Blues), ~297-310 (PROGRESSIONS Blues starters + COMPOSE_MAX), ~1667-1682 (loadProgression), ~2140-2166 (renderSuggest preview line), ~739-845 (keyViewCircle/keyViewSoloGuide/soloChipScale/soloChipDegrees/soloChipCaption, module top-level, W3b + S-CHIPS-PLUS), ~2194-2271 (renderKeyView's renderSoloChips IIFE, W3b + S-CHIPS-PLUS), music/shared/songbook.css ~502 (keyPickerCompact 88px), ~470-471 + ~528-537 + ~713 (keySoloScale/keySoloNotes/keySoloDegrees/keySoloFrame, W3b + S-CHIPS-PLUS), test/songbook.test.js soloChipScale/soloChipDegrees/soloChipCaption/isolation suite (W3b + S-CHIPS-PLUS), music/play/PLAN-key-subsystem-redesign.md (absorbed), TUTOR-ROADMAP locked decisions, docs/plans/ux-sprint-1-20260703.md A7, docs/plans/m-guide-ia-20260704.md sections 1 + 3 + 8, docs/plans/m-guide-adversarial-fold-20260704.md round 3 (P5 W3 verdict items), docs/plans/QUEUE.md S9
