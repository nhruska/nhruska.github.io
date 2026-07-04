# UI Primitives Library

[Wiki](../index.md) > ux-philosophy > UI Primitives Library

## Purpose

Name the app's small set of interaction primitives so a new feature reaches for the RIGHT one instead of inventing a new shape. Seeded by S-TOAST (UAT U9, 2026-07-05): fixing the stuck "Added to setlist" toast required extracting toast.js, and the operator asked for the taxonomy to be written down while the code was fresh.

## The four primitives

### TOAST - transient outcome feedback

A brief, non-blocking confirmation that something just happened. Auto-hides on its own; never demands a tap to dismiss (except the persistent variant below).

- **When to use:** a background action completed and the user should get a lightweight "it happened" cue without losing their place - a save, an add, a toggle.
- **When NOT to use:** anything the user must actively decide (use MODAL); anything that should survive a tab switch or be dismissed forever (use NOTABLE); a destructive action needing a way back (use the persistent-undo pattern, not a toast - see [interaction-safety.md](interaction-safety.md) Undo contract).
- **Code home:** [toast.js](../../shared/toast.js) is the ONE shared primitive (`window.Toast.show(msg, opts)` / `Toast.hide(host, opts)`) - it owns a per-host auto-hide timer and nothing else. Callers keep their own DOM/CSS mechanics via `onShow`/`onHide` paint callbacks, so two visually different toasts can coexist without ever fighting over one timer (see the root-cause comment at the top of toast.js).
- **Two live instances, two different visual mechanics - by design, not yet unified (D-TOAST-PRIMITIVE, keep-both):**
  | Instance | Where | Visual mechanic | Duration | Dismissible early? |
  |---|---|---|---|---|
  | Library toast (`showToast`, songbook.js) | Fixed overlay above the tab bar (`.toast`/`.toast.on`, songbook.css) | opacity/transform fade via a `.on` class toggle | 1600ms | no (auto only) |
  | Compose toast (`showComposeToast`, songbook.js) | Inline row above the progression box (`.composeToast`, songbook.css) | `[hidden]` attribute toggle, plus `.err`/`.tap` classes | 3000ms, or **persistent** (`persist: true`) until tapped | yes, when `persist: true` (tap-anywhere-on-it to dismiss) |
- **The U9 bug this fixed:** both instances used to declare `var toastTimer` in the SAME `Songbook.mount()` closure - `var` hoists to function scope, so the two declarations were literally one variable. A `showComposeToast(..., persist: true)` call firing right after `showToast(...)` (the exact shape of Compose Save with "Add to setlist" checked) cleared the Library toast's pending auto-hide and never rescheduled one, leaving it stuck on-screen. toast.js's per-host `Map` makes that class of bug structurally impossible - see test/toast.test.js for the isolation unit tests and test/songbook.test.js's `S-TOAST/U9` test for the exact repro sequence, replayed with a fake clock.
- **ARIA gap (not fixed by this mission):** neither toast host currently sets `role="status"`/`aria-live="polite"`. A screen-reader user gets no announcement when a toast appears. Flagging here as a known gap, not fixing it now (songbook.css is otherwise unmodified by this pass; adding ARIA is a small, separate, low-risk follow-up).
- **Candidate placements not yet built** (operator ask, non-intrusive feedback for actions that currently have none or rely on a full-screen result): backup completed, restore completed, a preference saved (e.g. diagram-pref toggle), transpose applied, song saved (**already exists** - the Compose toast above). Setlist add/remove **with an undo affordance** is a distinct enhancement (ties the transient-toast idea to the PERSISTENT-undo pattern the setlist's `STATE.lastRemoved`/`.setUndo` already uses for removes - see [interaction-safety.md](interaction-safety.md)) - noted as a future candidate, not built in this mission.

### NOTABLE - one-shot educational banner

A dismissed-forever hint, not a repeating nudge.

- **When to use:** first-run guidance, a "did you know" surfaced once per user, anything that should never reappear after the user dismisses it.
- **When NOT to use:** anything that recurs (use TOAST) or that blocks a decision (use MODAL).
- **Code home:** [notables.js](../../shared/notables.js) - `claim(consumerId, priority)` / `release` / `dismiss` / `isDismissed` / `renderBanner(opts)`. One `music.notables.v1` storage key maps `consumerId -> dismissedEpochMs`. Strict-priority single-slot arbitration (only one notable renders per tick). Full contract: [interaction-safety.md](interaction-safety.md#notables-one-shot-dismissible-guidance-stable).
- **ARIA:** the dismiss control is a real button, sized to the 44px floor; text content is plain, no `aria-live` needed since it persists until explicitly dismissed (not transient).

### MODAL - blocking decision

A dialog the user must resolve before anything else on the page is reachable again.

- **When to use:** the user must make an explicit choice, or a destructive action needs a confirm gate that a persistent-undo banner can't cover (rare - most destructive actions in this app use undo, not confirm; see the guard taxonomy in [interaction-safety.md](interaction-safety.md)).
- **When NOT to use:** informational-only feedback (use TOAST or NOTABLE) - a modal for "it saved" is a decision the user didn't need to make.
- **Code home:** the `composeModalBackdrop` pattern (songbook.js `ensureComposeUI`/`openSaveNameRow`/`openSoloChoiceRow`; `.composeModalBackdrop`/`.composeRow.asModal` in songbook.css). Standard shape: a real full-viewport dim `composeModalBackdrop` SIBLING (never a `::before` pseudo-element on the card - a negative z-index child paints ABOVE its own stacking-context root per CSS2.1 painting order, the exact bug F9 caught), a top-anchored card (never vertical-centered, so it clears a soft keyboard), `role="dialog"` + `aria-modal="true"` + a `tabIndex`-focusable root.
- **Dismiss contract:** backdrop tap, Escape, and hardware Back all resolve to the SAME conservative choice (Cancel/Skip - never confirm), routed through `NavHistory.dismiss()` (not the raw close function directly) so the pushed history layer unwinds in step with the modal. Falls back to a direct close only when `NavHistory` isn't loaded (bare test harness).
- **ARIA:** `role="dialog"`, `aria-modal="true"`, focus lands in the dialog on open (`tabIndex = -1` + `.focus()`, or the first focusable input).

### CHIP / TOKEN - selection + compact entities

A small tappable pill representing a selectable option or a compact fact (a genre, a key, a mode).

- **When to use:** the user picks one of a small set of options (filter chips, mode/key pickers), or a compact label needs its own tap target (a chord chip, a suggestion chip).
- **When NOT to use:** a primary action (use a button, `.btn`); a destructive control (needs a stronger guard than a chip affords - see interaction-safety.md's guard taxonomy).
- **Code home:** `.chip`/`.chip.on` (songbook.css, `.chip.on { background: var(--accent); color: var(--on-accent) }` - the accent-fill selected-state grammar). `.modeSwitch button.on` is a SIBLING selected-state control that has **not yet** adopted the same grammar (still `background: var(--surface-2)` as of this writing) - tracked by [D-SELECTED-ACCENT](../decisions.md) (operator ruling: ONE selected-state grammar app-wide, accent-fill, `.modeSwitch` to adopt it; build item S-SELECTED-GRAMMAR, not yet shipped).
- **Layout tokens (in flight, not yet landed):** chord-tile/diagram geometry (sizing, spacing) is being consolidated into ONE CSS-vars + `diagram.js`-metrics source of truth so the two can't fork - tracked as S-LAYOUT-SSOT in the [atomic queue plan](../../../docs/plans/atomic-queue-plan-20260704.md) item 0.1. No `decisions.md` entry yet (still in flight) - re-check this page once it lands.
- **ARIA:** chip/tile taps are movement-cancelled (`wireTap`/`wireTapCancel`/`composeWireTap` - see [interaction-safety.md](interaction-safety.md#wiretap-primitive)); selection state is visual-only (the `.on` class) with no `aria-pressed` today - a gap of the same shape as TOAST's ARIA gap above, not fixed by this mission.

## Quick lookup

| Need | Primitive |
|---|---|
| "It saved" / "Added to X" | TOAST |
| First-time hint, shown once ever | NOTABLE |
| User must choose Save vs Cancel, or confirm something destructive | MODAL |
| Pick one of a few options, or a compact tappable fact | CHIP/TOKEN |
| Undo a destructive action (not a toast) | Persistent undo banner - see [interaction-safety.md](interaction-safety.md) |

---

**Anchors verified:** [toast.js](../../shared/toast.js) (full module), [songbook.js](../../shared/songbook.js) (`showToast`, `showComposeToast`, `ensureComposeUI`, `openSaveNameRow`, `openSoloChoiceRow`), [songbook.css](../../shared/songbook.css) (`.toast`, `.composeToast`, `.composeModalBackdrop`, `.chip`, `.modeSwitch`), [notables.js](../../shared/notables.js), [interaction-safety.md](interaction-safety.md), [decisions.md](../decisions.md) (D-SELECTED-ACCENT, D-TOAST-PRIMITIVE), [atomic-queue-plan-20260704.md](../../../docs/plans/atomic-queue-plan-20260704.md) (S-LAYOUT-SSOT, in flight).
