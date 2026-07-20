/* =====================================================================
 * chord-collapse.js  -  at the ADVANCED guidance level the Compose
 * palette grids render compact letter+roman chips instead of full
 * fretboard-diagram tiles. A seasoned player navigates by name +
 * function (roman), not finger dots; the Shapes toggle (rendered by
 * songbook.js next to the In key|All segmented control) restores the
 * full diagram grid. The expand affordance is grid-level, never
 * per-chip, so the chips keep their one-tap add/play verb.
 * ---------------------------------------------------------------------
 *   ChordCollapse.active() -> true ONLY when GuidanceLevel.get() ===
 *       'advanced'. beginner / intermediate / unset (null) / corrupt all
 *       read false - the collapse is an advanced-only subtraction, and it
 *       never guesses a level (mirrors guidance-level.js's no-default
 *       rule). window.GuidanceLevel is a lazy optional lookup: a page or
 *       test that never loads it degrades to false (full diagrams), never
 *       throws.
 *   ChordCollapse.chip({ chord, roman, display }) -> <button> compact
 *       chord token. Reuses the app's ONE compact-chord-token primitive
 *       (the suggChip/scName/scRn classes), not a new chip variant. Built
 *       via createElement + textContent (never innerHTML) so a freeform
 *       custom-song chord token can't inject markup (same XSS class as
 *       songbook.js's sheet renderer). `display` is the enharmonic
 *       display name (dispChordName) when the caller has one; `chord`
 *       stays the canonical action token. The chip carries NO behavior of
 *       its own - the caller wires the tap (add + play + flash), exactly
 *       like a diagram tile.
 *
 * The filmstrip half of the collapse lives in songbook.js's
 * progStripMode(collapse) demotion (full diagram cards -> the same
 * compact token); the Studio chords-in-key row already collapses for
 * every level and needs nothing here.
 *
 * Pure + dependency-free at require time: exported for Node unit tests
 * AND attached to window.ChordCollapse. Load order in play/index.html:
 * after guidance-level.js (its input), before songbook.js by convention
 * only - both lookups are lazy. music/sw.js CORE must precache this file.
 * ===================================================================== */
(function (root) {
  'use strict';

  function active() {
    try {
      var g = root && root.GuidanceLevel;
      return !!(g && typeof g.get === 'function' && g.get() === 'advanced');
    } catch (e) { return false; }
  }

  function chip(opts) {
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'suggChip ccChip';
    var nm = document.createElement('span');
    nm.className = 'scName';
    nm.textContent = opts.display || opts.chord || '';
    b.appendChild(nm);
    if (opts.roman) {
      var rn = document.createElement('span');
      rn.className = 'scRn';
      rn.textContent = opts.roman;
      b.appendChild(rn);
    }
    return b;
  }

  var API = { active: active, chip: chip };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.ChordCollapse = API;

})(typeof window !== 'undefined' ? window : this);
