/* =====================================================================
 * notables.js  -  one-shot dismissible "notable" infrastructure.
 * ---------------------------------------------------------------------
 * A NOTABLE is a one-time, dismissible tip/prompt (a first-run cue, a JIT
 * "why" explainer at a mode hand-off, a roman-numeral settings nudge, a
 * backup-staleness nudge, ...).
 * At most ONE may render at a time - this module is the single arbiter
 * that decides which consumer (if any) holds that slot right now, plus the
 * persisted "already shown, never again" bookkeeping, plus a ready-styled
 * dismissible banner element. Consumers wire their own call sites on top of
 * this file (S-FIRSTRUN + S-WHYNOTE in songbook.js/tracks.js; S-BACKUP-NUDGE
 * in play/index.html's Settings script; S-ROMAN not yet wired).
 *
 * Storage: ONE key, `music.notables.v1` = { consumerId: dismissedEpochMs }.
 * It falls under backup.js's `music.` prefix (OWNED_PREFIXES), so it is
 * captured by backup/restore for free. Per backup.js's own header rule -
 * "Additive changes (a new optional field, a new key) do NOT need a bump" -
 * this NEW key needs NO SCHEMA_VERSION bump; every reader here is defensive
 * (try/catch -> safe default), matching every other reader in this app.
 *
 * ---- API (siblings build directly on this - keep it stable) ----
 *   Notables.claim(consumerId, priority) -> boolean granted
 *       Requests the single active slot for THIS consumerId. A dismissed
 *       consumer can never claim again (already shown, once, forever).
 *       Otherwise: the first claimant into an EMPTY slot wins. A later
 *       claim only wins by PREEMPTING a lower-priority holder - lower
 *       PRIORITY index wins ('firstrun' > 'whynote' > 'roman' > 'backup',
 *       per the sprint amendment + S-BACKUP-NUDGE). `priority` is optional:
 *       omit it to use the built-in table; pass an explicit number to
 *       override it (for a future consumer not yet in the table, or a
 *       one-off test). Equal
 *       priority does NOT preempt - first-come keeps the slot, so two
 *       simultaneous same-priority claims never both grant true (the
 *       "double-fire" case). At most one consumerId ever holds the slot.
 *   Notables.release(consumerId)
 *       Frees the slot WITHOUT dismissing, if `consumerId` currently holds
 *       it (e.g. its screen was left before the user acted on it) - so a
 *       previously-losing claim can win on its NEXT call ("next tick").
 *       No-op if `consumerId` doesn't hold the slot.
 *   Notables.dismiss(consumerId)
 *       Marks consumerId permanently shown (persisted - it never claims
 *       again). Also releases the slot if consumerId currently holds it,
 *       freeing it for the next candidate.
 *   Notables.isDismissed(consumerId) -> boolean
 *   Notables.renderBanner(opts) -> HTMLElement | null
 *       opts: { consumerId (required), text | html, className, onDismiss }
 *       Builds the accent-card dismissible banner (matches the .setUndo /
 *       list-item look: accent-deep card, accent-dim border). The x button
 *       ALWAYS calls Notables.dismiss(consumerId) first, then opts.onDismiss
 *       (for the caller to remove the element / advance whatever UI state
 *       was waiting on the dismissal). Returns null if no `document` is
 *       available (Node without a DOM stub) rather than throwing.
 * ===================================================================== */
(function (root) {
  'use strict';

  var KEY = 'music.notables.v1';

  // Lower index = higher priority. An unlisted consumerId (no entry here,
  // no explicit `priority` passed to claim()) falls back to the lowest
  // priority - after every named one - so it never silently outranks them.
  // 'backup' (S-BACKUP-NUDGE) is deliberately last: the backup-staleness nudge
  // never preempts onboarding/theory guidance, it only shows when nothing
  // higher-priority is claiming the slot.
  var PRIORITY = ['firstrun', 'whynote', 'roman', 'backup'];

  function priorityOf(consumerId, explicitPriority) {
    if (typeof explicitPriority === 'number' && !isNaN(explicitPriority)) return explicitPriority;
    var idx = PRIORITY.indexOf(consumerId);
    return idx >= 0 ? idx : PRIORITY.length;
  }

  // Bare `localStorage` (matches songbook.js/tracks.js convention) so this
  // runs unmodified in the browser; Node tests stub it via `global.localStorage`
  // (see test/helpers/local-storage-reset.js), same pattern as diagram.dom.test.js
  // stubbing `global.document`.
  function defaultStore() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* storage blocked (private mode / disabled) */ }
    return null;
  }

  /* ---------- persisted { consumerId: dismissedEpochMs } map ---------- */
  function readMap() {
    var store = defaultStore();
    if (!store) return {};
    try {
      var raw = store.getItem(KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      // Tolerate any non-plain-object shape (array, string, number, corrupt
      // JSON) from an old/corrupt/future build - treat as "nothing dismissed".
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (e) { return {}; }
  }

  function writeMap(map) {
    var store = defaultStore();
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(map)); } catch (e) { /* quota / private mode - app still runs */ }
  }

  function isDismissed(consumerId) {
    if (!consumerId) return false;
    var v = readMap()[consumerId];
    // The writer always stores a number (Date.now()); accept a numeric
    // STRING too so a hand-edited or foreign-format backup still counts as
    // dismissed rather than silently re-showing a notable the user closed.
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(v));
  }

  function dismiss(consumerId) {
    if (!consumerId) return;
    var map = readMap();
    map[consumerId] = Date.now();
    writeMap(map);
    if (activeGrant && activeGrant.id === consumerId) activeGrant = null;
  }

  /* ---------- single-slot arbitration ("one notable per render pass") ---------- */
  var activeGrant = null; // { id: consumerId, p: priority } | null while a slot is held

  function claim(consumerId, priority) {
    if (!consumerId || isDismissed(consumerId)) return false;
    var myP = priorityOf(consumerId, priority);
    if (!activeGrant) { activeGrant = { id: consumerId, p: myP }; return true; }
    if (activeGrant.id === consumerId) return true; // idempotent re-claim of the slot it already holds
    if (myP < activeGrant.p) { activeGrant = { id: consumerId, p: myP }; return true; } // strictly higher priority preempts
    return false; // ties and lower priority lose to the current holder
  }

  function release(consumerId) {
    if (activeGrant && activeGrant.id === consumerId) activeGrant = null;
  }

  /* ---------- dismissible banner (app-styled; see songbook.css .notableBanner) ---------- */
  // S-HARDEN (analysis-refactor-enhance-20260704 A5): the local esc() that used
  // to live here was dead code - renderBanner() below never calls it (opts.html
  // is trusted verbatim per its own contract; opts.text goes through
  // .textContent, which is inherently safe). Removed rather than left as an
  // unused delegate to the new shared esc.js.

  // opts: { consumerId, text (plain, escaped) | html (trusted, verbatim),
  //         className (extra class), onDismiss(consumerId) }
  function renderBanner(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return null;

    var el = document.createElement('div');
    el.className = 'notableBanner' + (opts.className ? ' ' + opts.className : '');

    var body = document.createElement('div');
    body.className = 'notableBanner-body';
    if (opts.html) body.innerHTML = opts.html;
    else body.textContent = opts.text != null ? opts.text : '';
    el.appendChild(body);

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'notableBanner-x';
    if (typeof x.setAttribute === 'function') x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×'; // ×
    x.onclick = function () {
      dismiss(opts.consumerId);
      if (typeof opts.onDismiss === 'function') opts.onDismiss(opts.consumerId);
    };
    el.appendChild(x);

    return el;
  }

  var API = {
    PRIORITY: PRIORITY,
    claim: claim,
    release: release,
    dismiss: dismiss,
    isDismissed: isDismissed,
    renderBanner: renderBanner,
    // Test-only: clears in-memory arbitration state (NOT persisted dismissals)
    // between cases that share one required module instance.
    _resetArbitration: function () { activeGrant = null; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Notables = API;

})(typeof window !== 'undefined' ? window : this);
