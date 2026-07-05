# UI Primitives Library

[Wiki](../index.md) > ux-philosophy > UI Primitives Library

## Purpose

Name the app's small set of interaction primitives so a new feature reaches for the RIGHT one instead of inventing a new shape. Seeded by S-TOAST (UAT U9, 2026-07-05): fixing the stuck "Added to setlist" toast required extracting toast.js, and the operator asked for the taxonomy to be written down while the code was fresh.

## The seven primitives

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
- **Candidate placements, SHIPPED (M-DESIGN-ENFORCE wave 2, UAT U19):** backup completed, restore completed, and every other backup/restore outcome (Backup unavailable, Could not build the backup file, Restore failed, etc.) now route through `showSettingsToast()` in play/index.html - the last "rely on a full-screen `alert()`" gap this section used to flag. A preference-saved toast (e.g. diagram-pref toggle) remains a future candidate, not built.

### TOAST+ACTION - undoable outcome

An outcome toast with exactly ONE action button (e.g. "Undo"), a longer window than a plain TOAST, and a VISIBLE COUNTDOWN BAR across its edge so the user always has a live signal for how much longer the action is reachable. Auto-hides at the end of the window unless the action is tapped first.

- **When to use:** an outcome the user can immediately reverse - a removal, a clear, a delete - where the reversal path IS the toast itself (no separate confirm-before-acting step; the action already happened, the toast is the "walk it back" window). This REPLACES the app's prior ad-hoc "persistent undo banner" pattern (an untimed banner that only mutation-invalidation ever closed) - see decisions.md D-ENFORCE-2.
- **When NOT to use:** a decision the user must make BEFORE anything happens (use MODAL - the action hasn't occurred yet, there's nothing to undo); a plain informational outcome with no reversal path (use TOAST).
- **Code home:** [toast.js](../../shared/toast.js) `Toast.showAction(msg, opts)` - a NEW entry point (not an option on `Toast.show()`), so the two SHIPPED plain-toast consumers stay byte-for-byte unchanged. Same "toast.js times, caller paints" split as TOAST: the caller builds its own message + action button (existing look preserved per consumer), `Toast.showAction` owns the timer AND creates the countdown-bar element (`opts.onShow(host, msg, barEl)` hands it to the caller to insert) - the bar's timing/behavior is the one thing that must be pixel- and behavior-identical everywhere it appears, so it is NOT caller-painted like the message is.
- **Duration + countdown bar (operator + parent ruling, U19 design refinement):** 6 seconds default (`DEFAULT_ACTION_DURATION_MS`), overridable via `opts.duration`. The bar animates its width from 100% to 0% over the window (CSS `transition`, not a JS tick loop) - `.toastBar` (songbook.css), accent-derived color (`background: var(--accent)`), positioned absolute across the bottom edge of a `.toastAction`-modified host (`position:relative;overflow:hidden`, so the bar clips to the host's own rounded corners).
- **Pause-on-touch:** any touchstart/pointerdown on the toast freezes the countdown (thumb-approach = intent - the persona is one hand holding an instrument, a glance-away must not silently eat the undo window); releasing ANYWHERE (not just back on the toast) resumes it. `Toast.showAction()` itself stays DOM-agnostic (a test can pass a plain-object host, matching TOAST's own testability) - it returns `{ bar, finish(), pause(), resume() }`, and `Toast.wirePauseOnTouch(el, handle)` is the opt-in DOM convenience that wires real touch/pointer events to `pause()`/`resume()` without duplicating the boilerplate at every call site.
- **`prefers-reduced-motion` fallback:** NO width animation - a static full-width `.toastBar-static` stripe for the toast's whole lifetime (still the undoable-and-expiring SIGNATURE, just without motion). The toast still auto-hides at the normal duration; only the bar's motion is suppressed.
- **Interaction with mutation-invalidation (A3):** the app's pre-existing "ANY subsequent mutating action invalidates the pending undo" contract still applies ON TOP of the timer - whichever fires first wins. A caller's invalidation path calls the active handle's `finish()` (which fires `onHide` synchronously, same as a natural expiry) rather than duplicating teardown logic.
- **Live consumers (SHIPPED, M-DESIGN-ENFORCE wave 2):**
  | Instance | Where | Message |
  |---|---|---|
  | Setlist item-remove undo | `showSetUndoBanner()`, songbook.js - a STABLE sibling element inserted once before `#setBody` (NOT rebuilt inside `renderSetlist()`'s repaint, so an unrelated re-render - reorder, add - never restarts or leaks the countdown) | "Removed \<song\>" |
  | Compose Clear undo | `showClearUndoBanner()`, songbook.js (the S-CLEARGUARD/A3 banner) | "Progression cleared." |
- **ARIA:** the countdown bar is `aria-hidden="true"` (purely decorative signature) - the toast's own message text carries the live-region semantics (same ARIA-gap-flagged status as plain TOAST above; not fixed by this mission).

### NOTABLE - one-shot educational banner

A dismissed-forever hint, not a repeating nudge.

- **When to use:** first-run guidance, a "did you know" surfaced once per user, anything that should never reappear after the user dismisses it.
- **When NOT to use:** anything that recurs (use TOAST) or that blocks a decision (use MODAL).
- **Code home:** [notables.js](../../shared/notables.js) - `claim(consumerId, priority)` / `release` / `dismiss` / `isDismissed` / `renderBanner(opts)`. One `music.notables.v1` storage key maps `consumerId -> dismissedEpochMs`. Strict-priority single-slot arbitration (only one notable renders per tick). Full contract: [interaction-safety.md](interaction-safety.md#notables-one-shot-dismissible-guidance-stable).
- **Surface (SHIPPED, M-DESIGN-ENFORCE wave 1, U10 finding):** `.notableBanner` used to share `.setUndo`'s accent-deep/accent-dim SELECTION-surface look - a guidance card camouflaged as a selected row. Now uses dedicated `--guide-bg`/`--guide-line` tokens (songbook.css `:root`, computed off `--txt-dim` - accent-INDEPENDENT, so the distinction holds at any user-chosen accent hue) plus a `--brass` left accent stripe. Screenshot-verified side-by-side against `.listItem.inSet` at 412x915, both themes; guarded going forward by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js).
- **ARIA:** the dismiss control is a real button, sized to the 44px floor; text content is plain, no `aria-live` needed since it persists until explicitly dismissed (not transient).

### MODAL - blocking decision

A dialog the user must resolve before anything else on the page is reachable again.

- **When to use:** the user must make an explicit choice, or a destructive action needs a confirm gate that a persistent-undo banner can't cover (rare - most destructive actions in this app use undo, not confirm; see the guard taxonomy in [interaction-safety.md](interaction-safety.md)).
- **When NOT to use:** informational-only feedback (use TOAST or NOTABLE) - a modal for "it saved" is a decision the user didn't need to make.
- **Code home:** the `composeModalBackdrop` pattern (songbook.js `ensureComposeUI`/`openSaveNameRow`/`openSoloChoiceRow`; `.composeModalBackdrop`/`.composeRow.asModal` in songbook.css). Standard shape: a real full-viewport dim `composeModalBackdrop` SIBLING (never a `::before` pseudo-element on the card - a negative z-index child paints ABOVE its own stacking-context root per CSS2.1 painting order, the exact bug F9 caught), a top-anchored card (never vertical-centered, so it clears a soft keyboard), `role="dialog"` + `aria-modal="true"` + a `tabIndex`-focusable root.
- **Dismiss contract:** backdrop tap, Escape, and hardware Back all resolve to the SAME conservative choice (Cancel/Skip - never confirm), routed through `NavHistory.dismiss()` (not the raw close function directly) so the pushed history layer unwinds in step with the modal. Falls back to a direct close only when `NavHistory` isn't loaded (bare test harness).
- **ARIA:** `role="dialog"`, `aria-modal="true"`, focus lands in the dialog on open (`tabIndex = -1` + `.focus()`, or the first focusable input).
- **Second consumer, SHIPPED (M-DESIGN-ENFORCE wave 2, UAT U19):** `openConfirmModal(message, confirmLabel, onConfirm)` in play/index.html - the Settings backup/restore flow's restore-confirm decision (previously a native `confirm()`, the U19 directive's named KNOWN offender). Reuses the SAME `.composeModalBackdrop`/`.composeRow.asModal` classes (a NEW host element pair, appended to `document.body`, not a new visual language) and the SAME `NavHistory.open`/`.settleAfter`/`.dismiss` wiring pattern as `openSaveNameRow`/`openSoloChoiceRow` - this is the second independent MODAL consumer, confirming the pattern generalizes beyond the Compose surface it was first built for. One addition: the modal layers on top of the (non-NavHistory) Settings sheet, so its own Escape handler calls `e.stopPropagation()` to keep the Settings sheet's own document-level Escape listener from ALSO closing the whole sheet in the same keypress.

### CHIP / TOKEN - selection + compact entities

A small tappable pill representing a selectable option or a compact fact (a genre, a key, a mode).

- **When to use:** the user picks one of a small set of options (filter chips, mode/key pickers), or a compact label needs its own tap target (a chord chip, a suggestion chip).
- **When NOT to use:** a primary action (use a button, `.btn`); a destructive control (needs a stronger guard than a chip affords - see interaction-safety.md's guard taxonomy).
- **Code home:** `.chip`/`.chip.on` (songbook.css, `.chip.on { background: var(--accent); color: var(--on-accent) }` - the accent-fill selected-state grammar; radius via `var(--r-chip-pill)`). `.modeSwitch button.on` / `.viewToggle button.on` are SIBLING selected-state controls that used to carry a DIFFERENT grammar (`background: var(--surface-2)` + a `box-shadow` ring) - [D-SELECTED-ACCENT](../decisions.md) SHIPPED (M-DESIGN-ENFORCE wave 1): both now use the SAME accent-fill grammar as `.chip.on` (`background: var(--accent); color: var(--on-accent)`, no border-color override needed since their base rule has `border:none`). Guarded going forward by [test/consistency-lint.test.js](../../../test/consistency-lint.test.js), which fails if any `.xxx.on{...}` rule anywhere reintroduces the surface-2 + box-shadow-ring combination.
- **Layout tokens (in flight, not yet landed):** chord-tile/diagram geometry (sizing, spacing) is being consolidated into ONE CSS-vars + `diagram.js`-metrics source of truth so the two can't fork - tracked as S-LAYOUT-SSOT in the [atomic queue plan](../../../docs/plans/atomic-queue-plan-20260704.md) item 0.1. No `decisions.md` entry yet (still in flight) - re-check this page once it lands.
- **ARIA:** chip/tile taps are movement-cancelled (`wireTap`/`wireTapCancel`/`composeWireTap` - see [interaction-safety.md](interaction-safety.md#wiretap-primitive)); selection state is visual-only (the `.on` class) with no `aria-pressed` today - a gap of the same shape as TOAST's ARIA gap above, not fixed by this mission.

### HELP - always-available explainer

A disclosure the user can open ANY time (not one-shot like NOTABLE, not blocking like MODAL) to understand a surface - "Why these notes?", a Guide card, a "Find a jam" panel.

- **When to use:** an explainer that should remain reachable forever, not just on first encounter (contrast NOTABLE, which is dismissed-forever) and that doesn't block anything else on the page (contrast MODAL).
- **When NOT to use:** a one-time-only hint (use NOTABLE); a decision gate (use MODAL).
- **Icon convention (drafted this mission, M-DESIGN-ENFORCE wave 2, UAT U19 - "help panels clearly noted with an icon"):** when a HELP-nature toggle could otherwise read as ambiguous (is this a settings control? a decorative label? an explainer?), prefix its label with a small `ⓘ`-style glyph so its purpose is unambiguous at a glance. Drafted as a portable CSS-only marker in songbook.css (`.helpIcon` - see component-conventions.md) rather than touching the toggle markup itself, since songbook.css loads on every page (the app's cross-file class SSOT) and the existing HELP-nature toggles (`.bt-st-why-toggle` family: "Guide", "Why these notes?", "Find a jam") live entirely in tracks.js/tracks.css (M-EAR-1.6 grant) - applying the class to their markup is a DEFERRED-TO-SIBLING follow-up, not built in this mission. No HELP-nature toggle was found within this mission's own grant (songbook.js/play/index.html) needing the treatment - the Settings sheet's `.setHint` captions are plain always-visible prose, not toggles, so they don't need it.
- **Code home:** the disclosure MECHANISM itself is unchanged - `.bt-st-why-toggle`/`.bt-st-why` (tracks.js, collapsed by default, text toggle, per-open state only, never persisted - see component-conventions.md "Modal / Disclosure / Tabs"). Only the icon-marker CSS class is new (songbook.css `.helpIcon`).
- **ARIA:** unchanged from the existing disclosure pattern (out of this mission's grant to alter).

### ACCORDION - exclusive disclosure group

A set of titled sections where opening one collapses the others; at most one section is open at a time, and zero-open is a valid state.

- **When to use:** a PANEL surface (bottom sheet, dialog) holding several independent groups of controls where seeing two groups at once has no value - the header row doubles as a table of contents and the sheet stays short (the Settings sheet is the seeded case, operator ask 2026-07-05).
- **When NOT to use:** a SCREEN scroller - decision D6 flattened Compose specifically to kill the nested-scroll swipe trap, and this primitive does not reopen that ruling; a lone explainer (use HELP or NOTABLE - one section is a disclosure, not a group); anything whose open state should persist (the accordion is per-open only, reset to all-collapsed at every sheet open).
- **Code home:** [accordion.js](../../shared/accordion.js) - `Accordion.init(sections, opts) -> handle` (`sections: [{btn, body}]`; `handle.open(i)` / `.closeAll()` / `.openIndex()`). Same "module owns state, caller owns DOM shape" split as TOAST: the module toggles `body.hidden` + `btn` `aria-expanded` and nothing else, so Node tests drive it with plain-object stubs ([test/accordion.test.js](../../../test/accordion.test.js)). The visual is the `.accSec`/`.accBtn`/`.accBody` family in [songbook.css](../../shared/songbook.css) - the ONE accordion look (THE ELEMENT CONSISTENCY LAW; never hand-roll a second). Note the `.accBody[hidden]{display:none}` guard (the U24 lesson: an author display rule on the same element defeats `[hidden]`).
- **Programmatic jump:** a caller can land the user on a named section (`handle.open(i)` - e.g. the backup-staleness nudge opens Settings straight to "Your songbook").
- **ARIA:** header is a real `<button>` (44px floor) with `aria-expanded` + `aria-controls`; the body is `role="region"` + `aria-labelledby`.
- **First consumer (SHIPPED, M-SETTINGS-CLARITY 2026-07-05):** the play/index.html Settings sheet sections (Appearance / Fretboard diagrams / Your songbook).

## Quick lookup

| Need | Primitive |
|---|---|
| "It saved" / "Added to X" | TOAST |
| An outcome the user can immediately reverse (a removal, a Clear) | TOAST+ACTION |
| First-time hint, shown once ever | NOTABLE |
| User must choose Save vs Cancel, or confirm something destructive BEFORE it happens | MODAL |
| Pick one of a small set of options, or a compact tappable fact | CHIP/TOKEN |
| An always-available explainer (Guide, "Why these notes?") | HELP |
| Several control groups in one panel, one visible at a time (Settings sections) | ACCORDION |

---

**Anchors verified:** [toast.js](../../shared/toast.js) (full module, incl. `showAction`/`wirePauseOnTouch`), [songbook.js](../../shared/songbook.js) (`showToast`, `showComposeToast`, `ensureComposeUI`, `openSaveNameRow`, `openSoloChoiceRow`, `showSetUndoBanner`, `showClearUndoBanner`), [songbook.css](../../shared/songbook.css) (`.toast`, `.composeToast`, `.composeModalBackdrop`, `.chip`, `.modeSwitch`, `.toastAction`, `.toastBar`, `.helpIcon`, `.accSec`/`.accBtn`/`.accBody`), [play/index.html](../../play/index.html) (`showSettingsToast`, `openConfirmModal`, the Settings accordion sections), [accordion.js](../../shared/accordion.js) (full module, M-SETTINGS-CLARITY), [notables.js](../../shared/notables.js), [interaction-safety.md](interaction-safety.md), [decisions.md](../decisions.md) (D-SELECTED-ACCENT, D-TOAST-PRIMITIVE, D-ENFORCE-2, D-ACCORDION), [test/toast-action.test.js](../../../test/toast-action.test.js), [test/accordion.test.js](../../../test/accordion.test.js), [test/no-native-dialog-lint.test.js](../../../test/no-native-dialog-lint.test.js), [atomic-queue-plan-20260704.md](../../../docs/plans/atomic-queue-plan-20260704.md) (S-LAYOUT-SSOT, in flight).
