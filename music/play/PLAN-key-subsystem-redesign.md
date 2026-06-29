# Plan: Compose key-subsystem redesign

> Status: APPROVED (design locked via interview 2026-06-29). Supersedes PR #56's collapse fix (Fix 2). Keeps PR #56's empty Next-chord state (Fix 1).

## Why

Live UX feedback surfaced that the Compose key picker has structural problems, not just polish gaps:

1. The picker hides the maj/min toggle after a key is set, so changing major<->minor needs a re-expand - obstructs a common action when palette items exist.
2. In a fresh Compose view the picker waits on a maj/min selection that is already defaulted to Major, and the only way to dismiss is to re-tap the already-selected Major. Unintuitive dismiss gesture.
3. The picker and the transposer are two separate "key" concepts that drift out of sync.

Root cause (in `music/shared/songbook.js`): there are **two independent sources of truth for "the key"**:
- Picker key: `keyRoot` / `keyMode` (l.871) - drives the diatonic palette + solo scale.
- Transposer key: the `el.cKey` readout shows `progression[0]` (l.839); `cTpose` tracks net semitones. Transposing moves the chords but never touches `keyRoot`.

## Locked decisions (interview 2026-06-29)

1. **Key picker model** -> Persistent compact key bar.
2. **Picker/transposer** -> Unify into one song key.
3. **Inversions** -> Pass current key via `?key=` + keep the key-view link.
4. **Scope** -> One key-subsystem redesign PR (evolve PR #56).

## Spec

### 1. One unified "song key"

- Single source of truth: `songKey = { root, mode }`. Remove the split between `keyRoot/keyMode` and `progression[0]/cTpose` as separate key notions.
- Picking a key sets `songKey`. **Transposing moves `songKey.root` by the same semitone delta**, so the `cKey` readout, the diatonic palette, and the solo scale all follow and never drift.
- Default with no explicit pick: `songKey.root` derives from `progression[0]`; once the user picks a key it becomes explicit. Transpose always moves it.
- `labelTonic()` returns `songKey.root` always.

### 2. Persistent compact key bar (replaces the collapse)

- Always-visible bar: current-key chip + a maj/min segmented toggle that is **always shown** (one tap, never hidden).
- The 12-root grid becomes an on-demand popover: opens on tapping the key chip, closes on selection. No "tap the already-selected Major to exit."
- Supersedes PR #56's `keyPickerOpen` collapse logic entirely (remove the compact-chip-hides-mode-grid behavior).

### 3. Inversions in context

- The "Walk the full cycle up the neck" link (`songbook.js` l.985) carries the key: `triad-inversions.html?p=<instrument>&key=<root>` (mode too if useful).
- `music/play/triad-inversions.html` reads `?key=` in its key-chip init (it already takes `?p=<instrument-profile>` and has its own key chips + `activeKey`) and pre-selects that key.
- The cycle stays I-IV-V derived from key+mode; no palette-chord dependency, no "selected major" requirement.

## Files

| File | Change |
|---|---|
| `music/shared/songbook.js` | key-state refactor (one `songKey`), compact key bar + root popover, synced transpose, inversions link `?key=` |
| `music/shared/songbook.css` | compact bar, always-visible maj/min segmented toggle, root popover |
| `music/play/triad-inversions.html` | read `?key=` and pre-select the key chip |
| `music/sw.js` | cache bump `music-v31` -> `music-v32` |

## Verification

This redesign is about feel, so it needs a real-device check before merge. Local headless render is NAT/memory-blocked in the Crostini container, so the realistic path is: build -> merge -> Pages deploy -> tap-test on device (the 3 key-picker states + transpose-sync + the inversions-in-context link), fix-forward if needed. Static `node --check` + a logic trace are the pre-merge floor.

## Out of scope (later phases)

- Inline inversions in the palette diagrams (bigger; deferred).
- A standalone always-available inversions entry point (only the contextual key-view link this round).
