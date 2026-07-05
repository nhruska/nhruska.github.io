# Interaction Safety

[Wiki](../index.md) > ux-philosophy > Interaction Safety

## Purpose

Guard every destructive control. The app already ships the patterns; this page names them and anchors the rules.

## Guard taxonomy (ordered by strength)

Every element that deletes, mutates, or loses user work lives behind at least one guard. Absent a guard, the grip-model mis-tap becomes permanent loss.

1. **Confirm (modal):** high-stakes whole-collection acts. Native confirm() is jarring inside a PWA - app-styled preferred. Live uses: the Settings backup/restore flow's restore-confirm (SHIPPED app-styled MODAL, M-DESIGN-ENFORCE wave 2 - see ui-primitives.md MODAL). Setlist clear ✕ (songbook.js setClear) and a couple of other confirm() call sites remain native - registered pre-existing debt, unchanged by wave 2 (out of its grant; see component-conventions.md Findings register), pinned by test/no-native-dialog-lint.test.js so the count can't silently grow. **Amended (S-SET-INTEGRITY, UAT U22):** `deleteCustomItem`'s two native confirm() call sites (custom-song delete / fork revert) stay native confirm()s (still registered debt, still pinned by the lint) but are no longer the ONLY guard - a TOAST+ACTION undo (guard #3) now layers on top, so a mis-confirmed delete is still recoverable for the 6s window.
2. **Edit mode:** destructive controls hidden at rest, revealed behind an explicit Edit toggle. Live use: Set reorder/remove.
3. **TOAST+ACTION undo (amended M-DESIGN-ENFORCE wave 2, UAT U19 - supersedes the untimed "persistent undo banner" this guard used to describe):** prior state held in memory; the toast.js `Toast.showAction()` primitive now times the window (default 6s, visible countdown bar, pause-on-touch - see ui-primitives.md TOAST+ACTION and decisions.md D-ENFORCE-2) IN ADDITION TO the pre-existing mutation-invalidation contract below - whichever fires first ends the pending undo. Live use: Set item remove; Compose Clear (sprint item 1, contract A3, amended); custom-song delete / fork-revert (`showDeleteUndoBanner`, S-SET-INTEGRITY, UAT U22 - see the delete-heal amendment below).
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

## Delete-heal amendment: guarding an INDIRECT consequence, not just the direct action (S-SET-INTEGRITY, UAT U22) [STABLE]

Every guard above protects the element you tapped. This one protects a DIFFERENT
surface a delete can silently damage: deleting a custom song (or reverting a
fork) that happens to be setlisted used to shrink the Jam setlist with zero
signal - the confirm() only asked about the song itself, never mentioned the
set. UAT U22 traced a real bug to exactly this gap (a dangling setlist
reference falling through to the library empty state on Prev/Next - see
[decisions.md](../decisions.md) D-SET-INTEGRITY for the full three-level fix).

The guard: `deleteCustomItem`'s outcome message is now TRUTHFUL about the
indirect consequence, not just the direct one -
`"Deleted <title>"` plain, or `"Deleted <title> - also removed from your
setlist"` when it was setlisted (singular - this app has exactly ONE Jam
setlist per profile), or `"Reverted <title> to the original"` for a fork
revert (the set does not shrink there - the slot is replaced in place, so no
"also removed" clause). Undo (guard #3 above) restores BOTH the deleted
record and its exact setlist position, not just the record.

**Generalization for future guards:** when a destructive action can ripple
into a SECOND surface the user isn't directly looking at, the outcome
message must name that ripple, and the undo must restore across BOTH
surfaces atomically - not just the one the user tapped.

## Notables: one-shot dismissible guidance [STABLE]

Infrastructure for once-ever hints ([notables.js](../../shared/notables.js)):

- **Storage:** ONE key `music.notables.v1` = { consumerId: dismissedEpochMs }. Under backup.js's music. prefix (captured by backup/restore free); additive key = no SCHEMA_VERSION bump.
- **API:** claim(consumerId, priority, level) -> granted | release(consumerId) | dismiss(consumerId) | isDismissed(consumerId) | renderBanner(opts). `level` (M-GUIDANCE, optional 3rd arg) grades the claim against a consumerId's declared audience - see below.
- **Arbitration:** single slot; strict-priority preemption (PRIORITY = [guidanceask, firstrun, tunefirst, savebasics, whynote, composeintro, transposetip, scaletip, roman, diagrampref, backup]; lower index wins); equal priority never double-grants - the double-fire guard (A4/A5).
- **Level gate (M-GUIDANCE, docs/plans/guidance-levels-spec-20260705.md):** a LEVELS table (consumerId -> array of `beginner`/`intermediate`/`advanced`) grades some consumers - firstrun/tunefirst/savebasics -> beginner; whynote -> intermediate+advanced; composeintro/transposetip -> intermediate; scaletip -> advanced. `claim()` only grants a level-gated consumerId when the passed `level` is a declared member - an unset/null level (music.guidanceLevel.v1 unanswered, [shared/guidance-level.js](../../shared/guidance-level.js)) never matches, so it blocks everything EXCEPT 'guidanceask' (unrestricted, top priority) - "unset level: only the ask may show." A consumerId not in LEVELS (guidanceask, roman, diagrampref, backup) is unrestricted, same as pre-M-GUIDANCE.
- **Render:** at most ONE notable per tick; the dismiss x is >=44px and persists the dismissal forever. Every auto-appearing (unbidden) consumer's `renderBanner()` call MUST wire `opts.onDismiss` to remove its own element immediately - `dismiss()` alone only persists the storage flag, it does NOT touch the DOM (S-WHYNOTE UAT fix, 2026-07-05: whynote/scaletip's call site initially omitted this, so the x correctly dismissed forever but the banner visibly stayed on screen until the next render - looked completely undismissable). The on-demand SoloGuide `?` card (Studio, `data-guide`) is the deliberate exception: it is a manual collapse/expand toggle the user opens themselves (default-collapsed, never auto-shown), not a Notables consumer at all - no dismiss-forever needed because it was never "unbidden."
- **Consumers live:** guidanceask (universal, one-time level ask), firstrun (Library, beginner), tunefirst (Tune tab first visit, beginner), savebasics (song screen, beginner), whynote (Studio hand-off, intermediate+advanced), composeintro (Compose first visit, intermediate), transposetip (Compose first transpose, intermediate), scaletip (Studio, advanced), diagrampref (fretboard-style ask), backup (backup-staleness nudge). Queued: roman (wave 2).

## Destructive-tap inventory (pre-ship audit)

Enumerate every element that deletes/mutates work; classify guard status; map thumb-zone; verify at 412x915. The sprint-1 inventory (ux-findings geometry table + item-1 PR body) is the reference format.

---

**Anchors verified:** list-item.js (wireTap), notables.js (API + arbitration + LEVELS gate), guidance-level.js (music.guidanceLevel.v1), songbook.js (setClear confirm, showSetUndoBanner, showClearUndoBanner, deleteCustomItem, showDeleteUndoBanner, wireTapCancel, firstrunShouldRender/savebasicsShouldRender), tracks.js (whynoteBanner/scaletipBanner + the onDismiss UAT fix), toast.js (showAction/wirePauseOnTouch), play/index.html (openConfirmModal, renderGuidanceAsk, renderTuneFirstNotable/renderComposeIntroNotable/renderTransposeTipNotable), docs/plans/ux-findings-20260703.md (F1-F3, F7, geometry), docs/plans/ux-sprint-1-20260703.md (A3-A5, A11), docs/plans/uat-walkthrough-20260704.md (U22), docs/plans/guidance-levels-spec-20260705.md (M-GUIDANCE), decisions.md (D-ENFORCE-2, D-SET-INTEGRITY), [test/toast-action.test.js](../../../test/toast-action.test.js), [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js), [test/songbook.test.js](../../../test/songbook.test.js) S-SET-INTEGRITY suite, [test/notables.test.js](../../../test/notables.test.js), [test/guidance-level.test.js](../../../test/guidance-level.test.js)
