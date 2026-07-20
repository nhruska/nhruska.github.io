/* =====================================================================
 * notables.js  -  one-shot dismissible "notable" infrastructure.
 * ---------------------------------------------------------------------
 * A NOTABLE is a one-time, dismissible tip/prompt (a first-run cue, a JIT
 * "why" explainer at a mode hand-off, a roman-numeral settings nudge, a
 * backup-staleness nudge, ...).
 *
 * Pattern: at most ONE notable renders at a time. This module is the single
 * arbiter that decides which consumer (if any) holds that slot right now,
 * plus the persisted "already shown, never again" bookkeeping, plus a
 * ready-styled dismissible banner element. Consumers wire their own call
 * sites on top of this file (songbook.js / tracks.js / play/index.html's
 * Settings script).
 *
 * Storage: ONE key, `music.notables.v1` = { consumerId: dismissedEpochMs }.
 * It falls under backup.js's `music.` prefix (OWNED_PREFIXES), so it is
 * captured by backup/restore for free. A new key is an additive change, so
 * per backup.js's rule it needs no SCHEMA_VERSION bump; every reader here is
 * defensive (try/catch -> safe default), matching every other reader.
 *
 * ---- API (siblings build directly on this - keep it stable) ----
 *   Notables.claim(consumerId, priority, level) -> boolean granted
 *       Requests the single active slot for THIS consumerId. A dismissed
 *       consumer can never claim again (already shown, once, forever).
 *       Otherwise: the first claimant into an EMPTY slot wins. A later
 *       claim only wins by PREEMPTING a lower-priority holder - lower
 *       PRIORITY index wins. `priority` is optional: omit it to use the
 *       built-in table; pass an explicit number to override it (for a
 *       future consumer not yet in the table, or a one-off test). Equal
 *       priority does NOT preempt - first-come keeps the slot, so two
 *       simultaneous same-priority claims never both grant true (the
 *       "double-fire" case). At most one consumerId ever holds the slot.
 *       `level` (optional 3rd arg) is the CALLER's current
 *       music.guidanceLevel.v1 value ('beginner'|'intermediate'|'advanced'
 *       |null/undefined - this module stays agnostic of what those strings
 *       MEAN, exactly like `priority` is just an opaque number). A
 *       consumerId registered in the LEVELS table below only grants when
 *       `level` is a member of its declared array - an omitted/unset level
 *       never matches, so a level-gated consumer is blocked until the
 *       caller has a real answer (see LEVELS below). A consumerId NOT in
 *       LEVELS is unrestricted - so every 2-arg claim() call works unchanged.
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
  // 'diagrampref' sits after 'roman' and before 'backup': onboarding/theory
  // guidance still wins, but the one-time dots/patterns prompt outranks the
  // lower-urgency backup-staleness nudge. 'backup' stays deliberately last:
  // it never preempts anything, it only shows when nothing higher-priority
  // claims the slot.
  //
  // 'guidanceask' (the one-time "how far along are you?" level prompt) is
  // FIRST - it must win the slot ahead of even 'firstrun' on a truly fresh
  // profile, since firstrun is itself level-gated (see LEVELS below) and
  // would otherwise never get a chance to show before the level exists.
  var PRIORITY = [
    'guidanceask',
    'firstrun', 'tunefirst', 'savebasics',
    'postprog', 'studiofirst', 'whynote', 'composeintro', 'pulljam', 'transposetip', 'scaletip',
    'roman', 'diagrampref', 'backup'
  ];

  // Which music.guidanceLevel.v1 values a consumerId is graded for. A
  // consumerId here ONLY grants claim() when the level passed to claim() is
  // a member of its array - an omitted/null/unset level never matches any
  // array (Array.indexOf(undefined) is always -1), so with no level set only
  // the ask may show and every other listed consumerId stays blocked until a
  // real level exists. A consumerId NOT in this table (guidanceask, roman,
  // diagrampref, backup) is unrestricted.
  var LEVELS = {
    firstrun: ['beginner'],
    postprog: ['beginner'],
    studiofirst: ['beginner'],
    tunefirst: ['beginner'],
    savebasics: ['beginner'],
    whynote: ['intermediate', 'advanced'],
    composeintro: ['intermediate'],
    pulljam: ['intermediate'],
    transposetip: ['intermediate'],
    scaletip: ['advanced']
  };

  function priorityOf(consumerId, explicitPriority) {
    if (typeof explicitPriority === 'number' && !isNaN(explicitPriority)) return explicitPriority;
    var idx = PRIORITY.indexOf(consumerId);
    return idx >= 0 ? idx : PRIORITY.length;
  }

  // Bare `localStorage` (matches songbook.js/tracks.js convention) so this
  // runs unmodified in the browser; Node tests stub it via `global.localStorage`
  // (see test/helpers/local-storage-reset.js).
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

  /* ---------- one tip per SESSION -----------------------------------
   * At most ONE consumerId ever holds the slot per app session. Without
   * this, dismissing a tip lets the NEXT one claim on the user's return to
   * a tab - felt as whack-a-mole. sessionStorage scopes it: a fresh open
   * (new tab / next launch) may surface the next tip; within a session,
   * dismissing one reveals nothing. The session holder itself may re-claim
   * (its banner legitimately re-renders on tab return until dismissed), and
   * a strictly-higher-priority preemption of the CURRENT holder still wins
   * (the boot-race ordering the priority table exists for) and takes over
   * the session record. No sessionStorage (Node, blocked) = gate off. */
  var SESSION_KEY = 'music.notables.session.v1';
  function sessionStore() {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage;
    } catch (e) { /* blocked */ }
    return null;
  }
  function sessionHolder() {
    var st = sessionStore();
    if (!st) return null;
    try { return st.getItem(SESSION_KEY) || null; } catch (e) { return null; }
  }
  function recordSessionHolder(consumerId) {
    var st = sessionStore();
    if (!st) return;
    try { st.setItem(SESSION_KEY, consumerId); } catch (e) { /* quota - gate degrades open */ }
  }

  /* ---------- single-slot arbitration ("one notable per render pass") ---------- */
  var activeGrant = null; // { id: consumerId, p: priority } | null while a slot is held

  // Live banner elements by consumerId. Slot arbitration alone knows who LOST
  // a preemption but does not remove the loser's already-rendered card, which
  // would leave TWO banners on screen. renderBanner() registers here; a
  // preempting claim() tears the ousted holder's element down.
  var liveEls = {};

  function teardownEl(consumerId) {
    var e = liveEls[consumerId];
    delete liveEls[consumerId];
    if (e && e.parentNode && typeof e.parentNode.removeChild === 'function') {
      e.parentNode.removeChild(e);
    }
  }

  function claim(consumerId, priority, level) {
    if (!consumerId || isDismissed(consumerId)) return false;
    // Level gate: a consumerId registered in LEVELS only grants when `level`
    // is one of its declared values - see LEVELS' header above.
    var declaredLevels = LEVELS[consumerId];
    if (declaredLevels && declaredLevels.indexOf(level) < 0) return false;
    var myP = priorityOf(consumerId, priority);
    // Session gate: if a different consumer already had its moment this
    // session, only a strictly-higher-priority preemption of a LIVE holder
    // gets past (and takes over the record below) - an empty slot after a
    // dismissal/release stays empty until next session.
    var sess = sessionHolder();
    if (sess && sess !== consumerId) {
      if (!activeGrant || myP >= activeGrant.p) return false;
    }
    if (!activeGrant) { activeGrant = { id: consumerId, p: myP }; recordSessionHolder(consumerId); return true; }
    if (activeGrant.id === consumerId) return true; // idempotent re-claim of the slot it already holds
    if (myP < activeGrant.p) { // strictly higher priority preempts - AND tears the loser down
      var ousted = activeGrant.id;
      activeGrant = { id: consumerId, p: myP };
      teardownEl(ousted); // one tip at a time - remove the ousted card too
      recordSessionHolder(consumerId);
      return true;
    }
    return false; // ties and lower priority lose to the current holder
  }

  function release(consumerId) {
    if (activeGrant && activeGrant.id === consumerId) activeGrant = null;
  }

  /* ---------- dismissible banner (app-styled; see songbook.css .notableBanner) ---------- */
  // No escape helper here on purpose: opts.html is trusted verbatim per its
  // own contract, and opts.text goes through .textContent, which is safe.

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
      if (liveEls[opts.consumerId] === el) delete liveEls[opts.consumerId];
      if (typeof opts.onDismiss === 'function') opts.onDismiss(opts.consumerId);
    };
    el.appendChild(x);

    // Preempt-teardown registry: the newest rendered element for a consumer is
    // the one a preemption must remove (see claim()).
    if (opts.consumerId) liveEls[opts.consumerId] = el;

    return el;
  }

  var API = {
    PRIORITY: PRIORITY,
    LEVELS: LEVELS,
    claim: claim,
    release: release,
    dismiss: dismiss,
    isDismissed: isDismissed,
    renderBanner: renderBanner,
    // Test-only: clears in-memory arbitration state (NOT persisted dismissals)
    // between cases that share one required module instance. Also clears the
    // per-session one-tip record when a sessionStorage (stub) is present.
    _resetArbitration: function () {
      activeGrant = null; liveEls = {};
      var st = sessionStore();
      if (st) { try { st.removeItem(SESSION_KEY); } catch (e) {} }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Notables = API;

})(typeof window !== 'undefined' ? window : this);
