/* =====================================================================
 * toast.js  -  ONE shared transient-feedback primitive for every toast/
 * snackbar in the app (S-TOAST, UAT U9 fix).
 * ---------------------------------------------------------------------
 * Root cause of U9 ("Added to setlist" toast never auto-hides, screenshot-
 * confirmed on device, operator Pixel walkthrough): songbook.js declared
 * `var toastTimer` TWICE inside the SAME Songbook.mount() closure - once
 * for the Library's plain "Added to setlist"/err toast (~old L1454), once
 * for the Compose "Saved to your Repertoire"/"Updated .../err toast
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

  var Toast = { show: show, hide: hide };
  global.Toast = Toast;
  if (typeof module !== 'undefined' && module.exports) module.exports = Toast;

})(typeof window !== 'undefined' ? window : this);
