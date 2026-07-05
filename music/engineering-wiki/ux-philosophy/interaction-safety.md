# Interaction Safety

[Wiki](../index.md) > ux-philosophy > Interaction Safety

## Purpose

Guard every destructive control. The app already ships the patterns; this page names them and anchors the rules.

## Guard taxonomy (ordered by strength)

Every element that deletes, mutates, or loses user work lives behind at least one guard. Absent a guard, the grip-model mis-tap becomes permanent loss.

1. **Confirm (modal):** high-stakes whole-collection acts. Native confirm() is jarring inside a PWA - app-styled preferred. Live uses: the Settings backup/restore flow's restore-confirm (SHIPPED app-styled MODAL, M-DESIGN-ENFORCE wave 2 - see ui-primitives.md MODAL). Setlist clear ✕ (songbook.js setClear) and a couple of other confirm() call sites remain native - registered pre-existing debt, unchanged by wave 2 (out of its grant; see component-conventions.md Findings register), pinned by test/no-native-dialog-lint.test.js so the count can't silently grow.
2. **Edit mode:** destructive controls hidden at rest, revealed behind an explicit Edit toggle. Live use: Set reorder/remove.
3. **TOAST+ACTION undo (amended M-DESIGN-ENFORCE wave 2, UAT U19 - supersedes the untimed "persistent undo banner" this guard used to describe):** prior state held in memory; the toast.js `Toast.showAction()` primitive now times the window (default 6s, visible countdown bar, pause-on-touch - see ui-primitives.md TOAST+ACTION and decisions.md D-ENFORCE-2) IN ADDITION TO the pre-existing mutation-invalidation contract below - whichever fires first ends the pending undo. Live use: Set item remove; Compose Clear (sprint item 1, contract A3, amended).
4. **Movement-cancel (wireTap):** the tap fires only if the touch did not move past threshold - kills scroll-grab accidents. Live use: list-item body + actions, setlist ✕, Compose slot removers.
5. **Sizing (44px floor):** larger hit areas compound with movement-cancel; not a guard alone.

## Scroll-rail rule [STABLE]

The right-edge scroll rail is the MOST dangerous home for always-hot actions: the thumb scrolls there and stabilizes the phone; a scroll-grab touches with movement, not intent; an action firing on scroll-grab is invisible to the user. **Scroll-rail actions MUST be movement-cancelled and/or mode-gated.** (Prior HF council + codex ruling; re-verified in sprint 1.)

## wireTap primitive

Movement-cancelled tap helper: record touchstart, mark moved if >10px drift, suppress click when moved. Canonical implementation: [list-item.js](../../shared/list-item.js) wireTap; local adaptations exist where classic-script scoping requires (songbook.js wireTapCancel, composeWireTap) - keep logic in sync, future dedup candidate.

## Undo contract (A3, amended M-DESIGN-ENFORCE wave 2 D-ENFORCE-2) [STABLE]

- **Snapshot:** the full pre-Clear state - progression array + cTpose + songKey (+ linked saved-song id).
- **Invalidation:** ANY mutating action (add/remove chord, transpose, mode change, key change, Save) clears it - unchanged, still binding.
- **Lifetime:** route-local, in-memory, session-only - dies on tab-switch/reload. Matches the Set-remove undo precedent; zero backup.js surface.
- **Visibility (amended):** the banner used to persist until invalidation only - "never a timed toast." It is now ALSO time-bound via toast.js `Toast.showAction()` (default 6s, visible countdown bar, pause-on-touch) - see ui-primitives.md TOAST+ACTION and decisions.md D-ENFORCE-2. Mutation-invalidation and the timer both end the pending undo; whichever fires first wins.

## Notables: one-shot dismissible guidance [STABLE]

Infrastructure for once-ever hints ([notables.js](../../shared/notables.js)):

- **Storage:** ONE key `music.notables.v1` = { consumerId: dismissedEpochMs }. Under backup.js's music. prefix (captured by backup/restore free); additive key = no SCHEMA_VERSION bump.
- **API:** claim(consumerId, priority) -> granted | release(consumerId) | dismiss(consumerId) | isDismissed(consumerId) | renderBanner(opts).
- **Arbitration:** single slot; strict-priority preemption (PRIORITY = [firstrun, whynote, roman]; lower index wins); equal priority never double-grants - the double-fire guard (A4/A5).
- **Render:** at most ONE notable per tick; the dismiss x is >=44px and persists the dismissal forever.
- **Consumers live:** firstrun (Library), whynote (Studio hand-off). Queued: roman (wave 2).

## Destructive-tap inventory (pre-ship audit)

Enumerate every element that deletes/mutates work; classify guard status; map thumb-zone; verify at 412x915. The sprint-1 inventory (ux-findings geometry table + item-1 PR body) is the reference format.

---

**Anchors verified:** list-item.js (wireTap), notables.js (API + arbitration), songbook.js (setClear confirm, showSetUndoBanner, showClearUndoBanner, wireTapCancel), toast.js (showAction/wirePauseOnTouch), play/index.html (openConfirmModal), docs/plans/ux-findings-20260703.md (F1-F3, F7, geometry), docs/plans/ux-sprint-1-20260703.md (A3-A5, A11), decisions.md (D-ENFORCE-2), [test/toast-action.test.js](../../../test/toast-action.test.js), [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js)
