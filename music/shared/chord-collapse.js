/* =====================================================================
 * chord-collapse.js  -  S-CHORD-COLLAPSE: at the ADVANCED guidance level
 * the Compose palette grids render compact letter+roman chips instead of
 * full fretboard-diagram tiles (operator friction 2026-07-16: "chord
 * charts are too big and cause scroll off page - when I'm in advanced
 * guidance level"; goal spec docs/plans/goal-chord-collapse-advanced-
 * 20260716.md). One-screen-above-the-fold made level-aware: a seasoned
 * player navigates by name + function (roman), not finger dots - the
 * diagrams stay ONE tap away via the Shapes toggle songbook.js renders
 * next to the In key|All segmented control (operator pick 2026-07-16:
 * chips keep the one-tap add/play verb - the G1 persona goalpost encodes
 * it - so the expand affordance is grid-level, never per-chip).
 * ---------------------------------------------------------------------
 *   ChordCollapse.active() -> true ONLY when GuidanceLevel.get() ===
 *       'advanced'. beginner / intermediate / unset (null) / corrupt all
 *       read false - the collapse is an advanced-only subtraction, and
 *       "never guess a level" mirrors guidance-level.js's own no-default
 *       rule. window.GuidanceLevel is a lazy optional lookup (same
 *       pattern as chord-pack-adapter.js's window.DiagramPref): a page
 *       or test that never loads it degrades to false (full diagrams),
 *       never throws.
 *   ChordCollapse.chip({ chord, roman, display }) -> <button> compact
 *       chord token. DELIBERATELY the suggChip/scName/scRn classes - the
 *       app's ONE compact-chord-token primitive (Element Consistency
 *       Law; same reuse S-PROG-WRAP made for the filmstrip tokens, not a
 *       4th chip variant). Built via createElement + textContent (never
 *       innerHTML) so freeform custom-song chord tokens can't inject
 *       markup - same XSS class as songbook.js's sheet renderer.
 *       `display` is the enharmonic display name (dispChordName) when the
 *       caller has one; `chord` stays the canonical action token. The
 *       caller wires the tap (songbook.js reuses its wireTap add+play+
 *       flash - the chip carries NO behavior of its own, exactly like a
 *       diagram tile).
 *
 * The filmstrip half of the collapse lives in songbook.js's
 * progStripMode(collapse) demotion (full diagram cards -> the same
 * compact token); the Studio chords-in-key row already collapsed for
 * every level (F19, 2026-07-05) and needs nothing here.
 *
 * Pure + dependency-free at require time (like guidance-level.js):
 * exported for Node unit tests AND attached to window.ChordCollapse.
 * Load order in play/index.html: after guidance-level.js (its input),
 * before songbook.js only by convention - both lookups are lazy.
 * music/sw.js CORE must precache this file (sw-verify guard).
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
