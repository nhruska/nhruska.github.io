/* =====================================================================
 * esc.js  -  ONE HTML-escape utility for every shared/*.js module and the
 * two play/ HTML entry points that build innerHTML from app/user data.
 * ---------------------------------------------------------------------
 * S-HARDEN (analysis-refactor-enhance-20260704 A5): consolidates the ~8
 * divergent copies that had accumulated - list-item.js/tracks.js/notables.js/
 * repertoire-form.js escaped &<>" ; diagram.js/play/index.html escaped only
 * &<> ; play/triad-inversions.html additionally escaped ' (the actual
 * strictest of the lot). PR #67 volley 6 (chord-pack XSS) is the standing
 * proof this class of divergence is a real, recurring risk, not a style nit.
 *
 * esc() escapes all five HTML-significant characters (&<>"') - a strict
 * superset of every prior variant, so every existing call site keeps
 * rendering identically (escaping ' never changes what a browser DISPLAYS in
 * a text/innerHTML sink; it only closes an attribute-injection seam none of
 * the callers happened to hit yet).
 *
 * Load BEFORE any shared/*.js consumer (play/index.html + play/
 * triad-inversions.html script order; music/sw.js CORE; test files require
 * this first) - classic-<script>-tag codebase, no module loader across
 * files, so consumers reach it via the shared `window`/`global` object.
 * ===================================================================== */
(function (global) {
  'use strict';

  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }

  var Esc = { esc: esc };
  global.Esc = Esc;
  if (typeof module !== 'undefined' && module.exports) module.exports = Esc;

})(typeof window !== 'undefined' ? window : this);
