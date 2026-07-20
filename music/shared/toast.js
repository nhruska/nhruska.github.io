/* =====================================================================
 * toast.js  -  ONE shared transient-feedback primitive for every toast/
 * snackbar in the app.
 * ---------------------------------------------------------------------
 * Pattern: this module owns the TIMING, callers own the PAINT. It holds
 * ONE timer PER HOST (a Map keyed by the caller's own DOM node) so
 * unrelated toast instances can never clobber each other's schedule, no
 * matter how or when they interleave. It does not dictate visual mechanics
 * - callers supply onShow/onHide paint callbacks, so each call site keeps
 * its own look-and-feel (a fixed-position fade, an inline row toggle, etc.).
 *
 * DON'T give two toasts on the same page a shared timer variable: if one
 * schedules an auto-hide and another then clears "the timer", the first
 * toast's hide is cancelled and it sticks on-screen forever. Keying every
 * timer by host is what prevents that cross-talk.
 *
 * No build step. Classic script + CommonJS export, same shape as esc.js /
 * list-item.js. Load BEFORE any shared/*.js consumer that shows a toast
 * (play/index.html script order; music/sw.js CORE).
 * ===================================================================== */
(function (global) {
  'use strict';

  var DEFAULT_DURATION_MS = 1600;
  // host (a caller-owned DOM node, or `undefined` for a single-toast page
  // that never passes one) -> the pending setTimeout id for THAT host only.
  var timers = new Map();

  function clearHostTimer(host) {
    var id = timers.get(host);
    if (id) clearTimeout(id);
    timers.delete(host);
  }

  /* ---------------------------------------------------------------------
   * showAction() - the undoable-outcome variant of a toast: a message plus
   * a time-bound action window with a VISIBLE COUNTDOWN BAR. Separate entry
   * point from show(), not an option bag on it, so the plain-toast callers
   * stay untouched. The window is time-bound (default 4s) so a user
   * mid-hands-on-instrument gets a visible signal instead of a banner that
   * lingers or vanishes with no cue. A caller's own mutating-action
   * invalidation can still finish the toast early, on top of this timer -
   * whichever fires first wins.
   *
   * Stays DOM-agnostic like show() (a test can pass a plain object as
   * `host`): this module does NOT attach any touchstart/pointerdown
   * listeners itself. Pause-on-touch is exposed as pause()/resume() on the
   * returned handle; wirePauseOnTouch() below is an OPT-IN convenience for
   * real DOM callers so the touch-event boilerplate isn't duplicated at
   * every call site.
   *
   *   opts.host            REQUIRED (unlike show(), no single-toast-page
   *                        fallback - an actionable toast always needs its
   *                        own DOM/state home).
   *   opts.onShow(host, msg, barEl)
   *                        paint the message + insert barEl wherever the
   *                        caller's markup wants the countdown stripe.
   *                        barEl is `null` when no `document` is available
   *                        (Node unit tests).
   *   opts.onHide(host)    called exactly once at the end - action fired,
   *                        window expired, or an explicit finish().
   *   opts.duration        ms (default DEFAULT_ACTION_DURATION_MS).
   *   opts.now             clock fn, default Date.now (test seam for
   *                        pause/resume elapsed-time math without
   *                        monkey-patching the global Date).
   *   opts.reducedMotion   force the static (no width-animation) bar;
   *                        default reads prefers-reduced-motion.
   * Returns { bar, finish(), pause(), resume() } or `null` if opts.host is
   * missing. finish() ends the toast (cancels the timer, calls onHide)
   * exactly once, whether reached via the action button's tap, timer
   * expiry, or a programmatic call.
   * ------------------------------------------------------------------- */
  var DEFAULT_ACTION_DURATION_MS = 4000;
  var actionStates = new Map(); // host -> in-flight state, kept separate from `timers` so a plain show() on the same host can never cross-talk with an active showAction()

  function prefersReducedMotion() {
    try {
      return !!(typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function clearActionState(host) {
    var s = actionStates.get(host);
    if (s && s.timeoutId) clearTimeout(s.timeoutId);
    actionStates.delete(host);
  }

  function showAction(msg, opts) {
    opts = opts || {};
    var host = opts.host;
    if (!host) return null; // an actionable toast always needs an owned host
    clearActionState(host);

    var now = typeof opts.now === 'function' ? opts.now : Date.now;
    var reduced = ('reducedMotion' in opts) ? !!opts.reducedMotion : prefersReducedMotion();
    var total = opts.duration || DEFAULT_ACTION_DURATION_MS;
    var hasDom = typeof document !== 'undefined' && document && typeof document.createElement === 'function';
    var bar = hasDom ? document.createElement('div') : null;
    if (bar) {
      bar.className = 'toastBar' + (reduced ? ' toastBar-static' : '');
      bar.setAttribute('aria-hidden', 'true'); // decorative only - the toast's own message carries the live-region semantics
    }

    var state = { total: total, remaining: total, startedAt: 0, timeoutId: null, resolved: false, paused: false };
    actionStates.set(host, state);

    // Animate the bar from its CURRENT remaining-% down to 0% over `ms` -
    // wall-clock-driven (CSS transition), not a JS tick loop. A forced
    // reflow (bar.offsetWidth) between the pre-transition width write and
    // the transition-on write is required or the browser coalesces both
    // into one paint and never animates from the paused-at width.
    function armBar(ms) {
      if (!bar || reduced) return;
      bar.style.transition = 'none';
      bar.style.width = (state.remaining / state.total * 100) + '%';
      void bar.offsetWidth;
      bar.style.transition = 'width ' + ms + 'ms linear';
      bar.style.width = '0%';
    }
    function arm(ms) {
      state.startedAt = now();
      state.timeoutId = setTimeout(function () { finish(); }, ms);
      armBar(ms);
    }
    function finish() {
      if (state.resolved) return;
      state.resolved = true;
      if (state.timeoutId) clearTimeout(state.timeoutId);
      actionStates.delete(host);
      if (typeof opts.onHide === 'function') opts.onHide(host);
    }

    if (typeof opts.onShow === 'function') opts.onShow(host, msg, bar);
    arm(total);

    return {
      bar: bar,
      finish: finish,
      // pause()/resume() - freeze the countdown while a finger is down on
      // the toast, resume on release. Wire these to real DOM events via
      // wirePauseOnTouch() below, or call directly.
      pause: function () {
        if (state.resolved || state.paused) return;
        state.paused = true;
        if (state.timeoutId) { clearTimeout(state.timeoutId); state.timeoutId = null; }
        var elapsed = now() - state.startedAt;
        state.remaining = Math.max(0, state.remaining - elapsed);
        if (bar && !reduced) { bar.style.transition = 'none'; bar.style.width = (state.remaining / state.total * 100) + '%'; }
      },
      resume: function () {
        if (state.resolved || !state.paused) return;
        state.paused = false;
        arm(state.remaining);
      }
    };
  }

  // wirePauseOnTouch(el, handle) - opt-in DOM convenience so every showAction()
  // call site doesn't re-duplicate the same touch-listener boilerplate.
  // Deliberately kept OUT of showAction() itself so the core timing/state
  // logic above stays testable against a plain-object host (no real DOM
  // required, same contract show() already guarantees). Returns a teardown
  // function - callers invoke it from their own onHide so listeners never
  // leak past the toast's lifetime.
  function wirePauseOnTouch(el, handle) {
    if (!el || !handle || typeof el.addEventListener !== 'function') return function () {};
    var doc = (typeof document !== 'undefined') ? document : null;
    function onDown() { handle.pause(); }
    function onUp() { handle.resume(); }
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('pointerdown', onDown);
    // "releasing OUTSIDE resumes" - a thumb naturally lifts off away from the
    // small toast surface, so listen for release at the document level, not
    // only on the toast element itself.
    if (doc) { doc.addEventListener('touchend', onUp); doc.addEventListener('pointerup', onUp); }
    return function teardown() {
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('pointerdown', onDown);
      if (doc) { doc.removeEventListener('touchend', onUp); doc.removeEventListener('pointerup', onUp); }
    };
  }

  // show(msg, opts) - paint the visible state via opts.onShow, then (unless
  // opts.persist) schedule an auto-hide via opts.onHide for THIS host only.
  //   opts.host                     identifies this toast instance so its
  //                                 timer can never be clobbered by another
  //                                 host's show()/hide() call. Omit only on
  //                                 a page with a single toast (every call
  //                                 then shares one slot).
  //   opts.onShow(host, msg, isErr) paint the visible state onto host.
  //   opts.onHide(host)             paint the hidden state onto host
  //                                 (auto-hide OR an explicit hide() call).
  //   opts.error                    bool, forwarded to onShow as isErr.
  //   opts.persist                  true = do not schedule an auto-hide;
  //                                 caller owns dismissal (e.g. tap-to-close)
  //                                 and/or an explicit hide() call.
  //   opts.duration                 ms before auto-hide (default 1600).
  function show(msg, opts) {
    opts = opts || {};
    var host = opts.host;
    clearHostTimer(host); // cancel only THIS host's pending hide, never another's
    if (typeof opts.onShow === 'function') opts.onShow(host, msg, !!opts.error);
    if (opts.persist) return;
    var duration = opts.duration || DEFAULT_DURATION_MS;
    var onHide = opts.onHide;
    var id = setTimeout(function () {
      timers.delete(host);
      if (typeof onHide === 'function') onHide(host);
    }, duration);
    timers.set(host, id);
  }

  // hide(host, opts) - explicit/early dismiss (e.g. a persistent toast's
  // tap-to-close). Cancels any pending auto-hide for this host (so a
  // stale timer can never fire a redundant repaint later) and paints the
  // hidden state now via opts.onHide.
  function hide(host, opts) {
    opts = opts || {};
    clearHostTimer(host);
    if (typeof opts.onHide === 'function') opts.onHide(host);
  }

  var Toast = { show: show, hide: hide, showAction: showAction, wirePauseOnTouch: wirePauseOnTouch };
  global.Toast = Toast;
  if (typeof module !== 'undefined' && module.exports) module.exports = Toast;

})(typeof window !== 'undefined' ? window : this);
