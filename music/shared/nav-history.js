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

  var stack = [];             // [{ tag, close }] - topmost is the last element
  var rooted = false;         // replaceState the root exactly once
  var pendingReplace = false; // one-shot: the next open() REPLACES the top slot (a modal->modal transition)

  function root() {
    if (rooted) return;
    rooted = true;
    try { global.history.replaceState({ mnav: 'root' }, ''); } catch (e) {}
  }

  function open(tag, close) {
    if (typeof close !== 'function') return;
    root();
    var doReplace = pendingReplace && stack.length > 0;
    pendingReplace = false; // consumed by this open()
    if (doReplace) {
      // Opened as part of a transition (settleAfter): take over the CURRENT history
      // slot instead of stacking on top of the just-closed layer. Mutate the stack
      // only AFTER the history op succeeds (never leave a phantom entry).
      try { global.history.replaceState({ mnav: tag }, ''); } catch (e) { return; }
      stack[stack.length - 1] = { tag: tag, close: close };
      return;
    }
    var top = stack[stack.length - 1];
    if (top && top.tag === tag) { top.close = close; return; } // re-render in place, no new entry
    try { global.history.pushState({ mnav: tag }, ''); } catch (e) { return; }
    stack.push({ tag: tag, close: close });
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

  // Modal -> modal transition. Close the CURRENT top layer's DOM (rawClose), then run
  // `runNext` (which may open a new layer). If it opens one, that layer REPLACES the
  // current history slot (same depth - no async back/push race). If it opens nothing,
  // the now-DOM-closed slot is collapsed. This is the correct hand-off from one layer
  // to another (Studio -> Edit form; form Save/Delete -> Practice/Studio/Library).
  function settleAfter(rawClose, runNext) {
    root();
    if (typeof rawClose === 'function') { try { rawClose(); } catch (e) {} }
    pendingReplace = stack.length > 0;
    if (typeof runNext === 'function') { try { runNext(); } catch (e) {} }
    if (pendingReplace) {
      // runNext opened no new layer -> collapse the freed slot. history.back() fires
      // popstate -> pops it; its close fn is the raw close we already ran (idempotent).
      pendingReplace = false;
      try { global.history.back(); } catch (e) { popAndClose(); }
    }
  }

  global.addEventListener('popstate', function () {
    // Back pressed (or dismiss() called): close the topmost layer. Empty stack
    // means a real root-back - do nothing and let the browser leave the app.
    if (stack.length) popAndClose();
  });

  global.NavHistory = {
    open: open,
    dismiss: dismiss,
    settleAfter: settleAfter,
    depth: function () { return stack.length; }
  };

})(typeof window !== 'undefined' ? window : this);
