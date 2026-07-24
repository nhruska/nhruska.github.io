/* =====================================================================
 * scroll-hint.js  -  horizontal-scroll affordance for chip strips
 * ---------------------------------------------------------------------
 * A horizontally-scrollable strip (the Library genre / key filters, the
 * Tune tab's tunings row, or any other opted-in row) gives no signal that
 * more content sits off-screen beyond a chip clipped at the edge. This
 * module adds a directional affordance: a fade + double-chevron pinned at
 * each edge the strip can STILL scroll toward, shown only when there is
 * more that way and hidden at each extreme - both ends when scrollable
 * either direction (the exact behaviour in the UAT ask).
 *
 * Opt-in, not blanket: a strip participates by living inside a
 * `.chipScrollWrap` (see play/index.html). That keeps this off the `.chips`
 * variants that WRAP instead of scroll (keyModes), are a segmented toggle
 * (#catChips), or carry their own margins (.bt-bar .chips). Wrapping any
 * other strip in `.chipScrollWrap` opts it in with zero further code.
 *
 * The overlay lives in the wrapper (ABOVE the scroller, pointer-events:none)
 * because a background on the scroller itself paints BEHIND the chip
 * children. scroll-hint.js only toggles `.can-l` / `.can-r` on the wrapper;
 * all pixels are CSS (songbook.css .chipScrollWrap / .csh rules).
 *
 * Re-measures on: scroll, element resize (ResizeObserver -> orientation /
 * viewport), and content repopulation (MutationObserver childList -> the
 * filter chips are rebuilt on every facet change). No render-site hooks.
 *
 * Dual export: module.exports (Node) + window.ScrollHint (browser). The
 * pure `sides()` reducer is exported for Node unit tests.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Sub-pixel slack: scrollWidth/clientWidth/scrollLeft can land a pixel or
  // two apart at a true extreme, so treat anything within TOL of an end as
  // "fully scrolled that way" (no ghost chevron stuck on at the last pixel).
  var TOL = 2;

  // Pure reducer: given the three scroll metrics, which edges can still
  // scroll? No overflow at all (max <= TOL) -> neither. Node-testable.
  function sides(scrollLeft, scrollWidth, clientWidth) {
    var max = scrollWidth - clientWidth;
    var over = max > TOL;
    return {
      l: over && scrollLeft > TOL,
      r: over && scrollLeft < max - TOL
    };
  }

  function measure(strip, wrap) {
    var s = sides(strip.scrollLeft, strip.scrollWidth, strip.clientWidth);
    wrap.classList.toggle('can-l', s.l);
    wrap.classList.toggle('can-r', s.r);
  }

  // The two edge overlays (fade + chevron) are pure decoration, so they are
  // created here rather than hand-repeated in every wrapper's markup. They
  // sit ABOVE the scroller (pointer-events:none, see .csh in songbook.css)
  // and are revealed per edge by the wrapper's .can-l / .can-r class.
  function overlay(cls) {
    var d = global.document.createElement('div');
    d.className = 'csh ' + cls;
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  // Wire one `.chipScrollWrap > .chips` scroller. Idempotent (a re-scan
  // never double-wires). The wrapper exists in markup; we inject only the two
  // decoration overlays, then attach listeners + take an initial measure.
  function wire(strip) {
    if (!strip || strip.__scrollHint) return;
    var wrap = strip.parentNode;
    if (!wrap || wrap.className.indexOf('chipScrollWrap') < 0) return;
    strip.__scrollHint = true;
    var lEl = wrap.querySelector('.csh-l') || wrap.appendChild(overlay('csh-l'));
    var rEl = wrap.querySelector('.csh-r') || wrap.appendChild(overlay('csh-r'));
    // Tapping an active edge snaps the strip to that end. The overlay only
    // takes pointer events while its edge is active (CSS), so a tap here is
    // always a deliberate "scroll that way" - and it intercepts the tap that
    // would otherwise fall through to a half-off-screen chip (the UAT).
    var snap = function (toEnd) {
      var rm = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var left = toEnd ? (strip.scrollWidth - strip.clientWidth) : 0;
      if (strip.scrollTo) strip.scrollTo({ left: left, behavior: rm ? 'auto' : 'smooth' });
      else strip.scrollLeft = left;
    };
    lEl.addEventListener('click', function () { snap(false); });
    rEl.addEventListener('click', function () { snap(true); });
    var upd = function () { measure(strip, wrap); };
    strip.addEventListener('scroll', upd, { passive: true });
    if (global.ResizeObserver) { new global.ResizeObserver(upd).observe(strip); }
    if (global.MutationObserver) { new global.MutationObserver(upd).observe(strip, { childList: true }); }
    global.addEventListener('resize', upd);
    upd();
  }

  function autowire(root) {
    root = root || global.document;
    if (!root || !root.querySelectorAll) return;
    var strips = root.querySelectorAll('.chipScrollWrap > .chips');
    for (var i = 0; i < strips.length; i++) wire(strips[i]);
  }

  var ScrollHint = { sides: sides, wire: wire, autowire: autowire };
  global.ScrollHint = ScrollHint;
  if (typeof module !== 'undefined' && module.exports) module.exports = ScrollHint;

  // Auto-run in the browser once the static wrappers exist. Dynamically
  // added wrappers (none today) can call ScrollHint.autowire() themselves.
  if (global.document) {
    var go = function () { autowire(global.document); };
    if (global.document.readyState !== 'loading') go();
    else global.document.addEventListener('DOMContentLoaded', go);
  }

})(typeof window !== 'undefined' ? window : this);
