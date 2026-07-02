/* =====================================================================
 * nav-history.js  -  browser / Android back-button navigation for the SPA
 * ---------------------------------------------------------------------
 * The Music app changes views via in-app state (tab screens + overlays),
 * never touching browser history - so the hardware/gesture Back button
 * popped the real PAGE history and LEFT the app no matter how deep you were.
 *
 * This is a tiny back-STACK: each dismissible layer (an overlay, or a
 * screen/tab step) registers a close fn when it opens; a single popstate
 * listener closes the topmost layer on Back, so Back walks back OUT of the
 * app's layers before ever leaving the page. When the stack is empty, Back
 * is a real root-back and the browser leaves the app (correct).
 *
 * Uses pushState STATE OBJECTS, never location.hash - the #profile / ?p=
 * instrument deep-link (play/index.html) owns the hash; touching it here
 * would collide. No build step (flat <script>, matches music/shared/).
 *
 * ---- LOCKED API (integration seam - wiring code depends on this exactly) ----
 *   NavHistory.open(tag, closeFn)
 *       Open a dismissible layer. Pushes ONE history entry + registers closeFn
 *       as the raw DOM close for that layer. IDEMPOTENT: if `tag` is already on
 *       top (e.g. an overlay re-renders in place, like the Studio re-opening
 *       after attaching a video), it does NOT push a second entry - it just
 *       refreshes closeFn. closeFn MUST be the RAW close (remove the .on class /
 *       hide the screen) and MUST NOT itself call NavHistory.dismiss (that would
 *       double-pop). Safe to call closeFn more than once (make it idempotent).
 *   NavHistory.dismiss()
 *       Programmatic close (what a close BUTTON calls). Steps history.back(),
 *       which fires popstate, which runs the topmost closeFn - the SINGLE close
 *       path (button and hardware-Back both funnel through popstate; never
 *       double-close). No-op when the stack is empty.
 *   NavHistory.depth()  -> number of open layers (0 = at the app root).
 *
 * WIRING CONTRACT for every layer:
 *   - on OPEN:  NavHistory.open('<uniqueTag>', rawCloseFn)
 *   - close BUTTON onclick: NavHistory.dismiss   (NOT the raw close directly)
 *   - the raw close fn registered = the existing DOM close (idempotent)
 *   A tab/screen step registers a closeFn that returns to the PREVIOUS
 *   tab/screen (see play/index.html + songbook.js switchTab wiring).
 * ===================================================================== */
(function (global) {
  'use strict';

  var stack = [];      // [{ tag, close }] - topmost is the last element
  var rooted = false;  // replaceState the root exactly once

  function root() {
    if (rooted) return;
    rooted = true;
    try { global.history.replaceState({ mnav: 'root' }, ''); } catch (e) {}
  }

  function open(tag, close) {
    if (typeof close !== 'function') return;
    root();
    var top = stack[stack.length - 1];
    if (top && top.tag === tag) { top.close = close; return; } // re-render in place, no new entry
    stack.push({ tag: tag, close: close });
    try { global.history.pushState({ mnav: tag }, ''); } catch (e) {}
  }

  function popAndClose() {
    var top = stack.pop();
    if (top && typeof top.close === 'function') { try { top.close(); } catch (e) {} }
  }

  function dismiss() {
    if (!stack.length) return;
    // Step back so popstate runs the close fn (single close path). If back()
    // is unavailable for any reason, close directly as a fallback.
    try { global.history.back(); } catch (e) { popAndClose(); }
  }

  global.addEventListener('popstate', function () {
    // Back pressed (or dismiss() called): close the topmost layer. Empty stack
    // means a real root-back - do nothing and let the browser leave the app.
    if (stack.length) popAndClose();
  });

  global.NavHistory = {
    open: open,
    dismiss: dismiss,
    depth: function () { return stack.length; }
  };

})(typeof window !== 'undefined' ? window : this);
