# Interaction Safety

[Wiki](../index.md) > ux-philosophy > Interaction Safety

## Purpose

Guard every destructive control. The app already ships the patterns; this page names them and anchors the rules.

## Guard taxonomy (ordered by strength)

Every element that deletes, mutates, or loses user work lives behind at least one guard. Absent a guard, the grip-model mis-tap becomes permanent loss.

1. **Confirm (modal):** high-stakes whole-collection acts. Native confirm() is jarring inside a PWA - app-styled preferred (backlog: SETX phase 2). Live use: setlist clear ✕ (songbook.js setClear).
2. **Edit mode:** destructive controls hidden at rest, revealed behind an explicit Edit toggle. Live use: Set reorder/remove.
3. **Persistent undo banner:** prior state held in memory; banner persists until any mutating action invalidates it (NOT a timed toast). Live use: Set item remove; Compose Clear (sprint item 1, contract A3).
4. **Movement-cancel (wireTap):** the tap fires only if the touch did not move past threshold - kills scroll-grab accidents. Live use: list-item body + actions, setlist ✕, Compose slot removers.
5. **Sizing (44px floor):** larger hit areas compound with movement-cancel; not a guard alone.

## Scroll-rail rule [STABLE]

The right-edge scroll rail is the MOST dangerous home for always-hot actions: the thumb scrolls there and stabilizes the phone; a scroll-grab touches with movement, not intent; an action firing on scroll-grab is invisible to the user. **Scroll-rail actions MUST be movement-cancelled and/or mode-gated.** (Prior HF council + codex ruling; re-verified in sprint 1.)

## wireTap primitive

Movement-cancelled tap helper: record touchstart, mark moved if >10px drift, suppress click when moved. Canonical implementation: [list-item.js](../../shared/list-item.js) wireTap; local adaptations exist where classic-script scoping requires (songbook.js wireTapCancel, composeWireTap) - keep logic in sync, future dedup candidate.

## Undo contract (A3) [STABLE]

- **Snapshot:** the full pre-Clear state - progression array + cTpose + songKey (+ linked saved-song id).
- **Invalidation:** ANY mutating action (add/remove chord, transpose, mode change, key change, Save) clears it.
- **Lifetime:** route-local, in-memory, session-only - dies on tab-switch/reload. Matches the Set-remove undo precedent; zero backup.js surface.
- **Visibility:** banner persists until invalidation - never a timed toast.

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

**Anchors verified:** list-item.js (wireTap), notables.js (API + arbitration), songbook.js (setClear confirm, clear-undo banner, wireTapCancel), docs/plans/ux-findings-20260703.md (F1-F3, F7, geometry), docs/plans/ux-sprint-1-20260703.md (A3-A5, A11)
