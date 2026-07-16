/* =====================================================================
 * toast.js  -  ONE shared transient-feedback primitive for every toast/
 * snackbar in the app (S-TOAST, UAT U9 fix).
 * ---------------------------------------------------------------------
 * Root cause of U9 ("Added to setlist" toast never auto-hides, screenshot-
 * confirmed on device, operator Pixel walkthrough): songbook.js declared
 * `var toastTimer` TWICE inside the SAME Songbook.mount() closure - once
 * for the Library's plain "Added to setlist"/err toast (~old L1454), once
 * for the Compose "Saved to your Library"/"Updated .../err toast
 * (~old L2441). `var` hoists to FUNCTION scope, so both declarations were
 * literally the SAME variable.
 *
 * Confirmed repro: Compose Save with the default-checked "Add to setlist"
 * box calls, in one synchronous tick, toggleSet(cs.id) - which schedules
 * the Library toast's 1600ms auto-hide via that shared var - and THEN
 * showComposeToast(..., persist: true). showComposeToast's own
 * clearTimeout(toastTimer) killed the Library toast's still-pending hide
 * timeout, and persist:true meant nothing ever rescheduled a replacement.
 * The Library "Added to setlist" toast was left on-screen permanently -
 * exactly the stuck state the operator screenshotted.
 *
 * Fix: this module owns ONE timer PER HOST (a Map keyed by the caller's own
 * DOM node), so unrelated toast instances can never clobber each other's
 * schedule no matter how or when they interleave. It does NOT dictate
 * visual mechanics (the Library toast is a fixed-position fade via a `.on`
 * class; the Compose toast is an inline row toggled via `[hidden]` plus an
 * `err`/`tap` class) - callers supply onShow/onHide paint callbacks so each
 * call site's exact existing look-and-feel is preserved byte-for-byte. This
 * is a pure timer-isolation fix, not a visual redesign (see decisions.md
 * D-TOAST-PRIMITIVE: keep-both, not a forced single visual style).
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
   * showAction() - TOAST+ACTION (M-DESIGN-ENFORCE wave 2, UAT U19): the
   * undoable-outcome variant. A NEW entry point, not an option bag on
   * show() above - the two SHIPPED plain-toast consumers (Library "Added
   * to X", Compose save confirmations) stay byte-for-byte unchanged; this
   * is pure addition to a SHIPPED, tested primitive, never a behavior
   * change to it (same discipline D-TOAST-PRIMITIVE already established).
   *
   * Replaces the app's prior ad-hoc "persistent undo banner" pattern
   * (interaction-safety.md guard #3), which had NO time limit at all -
   * only ANY subsequent mutating action would invalidate it. Operator +
   * parent ruling (U19 design refinement) amends that: the undo window is
   * now time-bound (default 6s) with a VISIBLE COUNTDOWN BAR so a user
   * mid-hands-on-instrument who glances away doesn't have the window
   * silently vanish with no signal. Mutating-action invalidation (the
   * app's existing A3 contract) still applies on TOP of this timer -
   * whichever fires first wins; see decisions.md D-ENFORCE-2.
   *
   * Stays DOM-agnostic like show() above (a test can pass a plain object
   * as `host` - see toast.test.js's fake hosts): this module does NOT
   * attach any touchstart/pointerdown listeners itself. Pause-on-touch is
   * exposed as pause()/resume() on the returned handle; wirePauseOnTouch()
   * below is an OPT-IN convenience for real DOM callers so the touch-event
   * boilerplate isn't duplicated at every call site.
   *
   *   opts.host            REQUIRED (unlike show(), no single-toast-page
   *                        fallback - an actionable toast always needs its
   *                        own DOM/state home).
   *   opts.onShow(host, msg, barEl)
   *                        paint the message + insert barEl whereever the
   *                        caller's existing markup wants the countdown
   *                        stripe (same "toast.js times, caller paints"
   *                        split show() already has). barEl is `null` when
   *                        no `document` is available (Node unit tests).
   *   opts.onHide(host)    called exactly once at the end - action fired,
   *                        window expired, or an explicit finish().
   *   opts.duration        ms (default 6000 - DEFAULT_ACTION_DURATION_MS).
   *   opts.now             clock fn, default Date.now (test seam - lets a
   *                        unit test control pause/resume elapsed-time math
   *                        without monkey-patching the global Date).
   *   opts.reducedMotion   force the static (no width-animation) bar;
   *                        default reads prefers-reduced-motion.
   * Returns { bar, finish(), pause(), resume() } or `null` if opts.host is
   * missing. finish() is what the caller's action button (e.g. "Undo")
   * calls on tap - ends the toast (cancels the timer, calls onHide) exactly
   * once, whether reached via tap, timer expiry, or a programmatic call
   * (e.g. invalidateClearUndo() finishing an active toast early because a
   * DIFFERENT mutation just invalidated the pending undo).
   * ------------------------------------------------------------------- */
  // 6000 -> 4000 (operator UAT 2026-07-16: "undo delete timer is about 1.5x
  // too long"). Callers that pass an explicit duration are untouched.
  var DEFAULT_ACTION_DURATION_MS = 4000;
  var actionStates = new Map(); // host -> in-flight state (mirrors `timers` above, kept separate so a plain show() on the same host can never cross-talk with an active showAction())

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
      // pause()/resume() - the touch-approach freeze contract (design
      // refinement: "any touchstart/pointerdown on the toast freezes the
      // countdown... releasing outside resumes"). Wire these to real DOM
      // events via wirePauseOnTouch() below, or call directly.
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
