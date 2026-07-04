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

The mapping itself - re-qualify each chord's root against the target mode's degree quality, re-basing any 7th-type extension, leaving a chromatic/borrowed root unchanged - is a pure extracted function, `convertProgressionQualities(chords, targetMode, tonicRoot, sourceMode)` (songbook.js, exported on `Songbook`). `convertToMode` (root-set path) is now: call the pure fn + set songKey.root/mode/explicit + close the panel + full re-render - unchanged behavior. `sourceMode` is threaded through now for a future blues-aware mapping (W2).

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

---

**Anchors verified:** songbook.js ~1581-1830 (buildGrid, buildKeyPicker, convertToMode wiring, labelRoman/renderProg signature comment), ~1670-1810 (songKey + fly-out), ~1657-1674 (composeTpose, D-KEYLESS), ~208-243 (convertProgressionQualities, pure extracted mapping), ~1920-1975 (mode-chip onclick: F12 fix + keyless re-qualify branch), music/play/PLAN-key-subsystem-redesign.md (absorbed), TUTOR-ROADMAP locked decisions, docs/plans/ux-sprint-1-20260703.md A7, docs/plans/m-guide-ia-20260704.md section 4
