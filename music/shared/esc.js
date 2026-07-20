/* =====================================================================
 * esc.js  -  the ONE HTML-escape utility for every shared/*.js module and
 * the play/ HTML entry points that build innerHTML from app/user data.
 * ---------------------------------------------------------------------
 * Pattern: single source of truth for escaping, exposed on the shared
 * global object (classic-<script>-tag codebase, no module loader across
 * files) and via module.exports for the Node test suite.
 *
 * esc() escapes all five HTML-significant characters (&<>"'). Escaping the
 * quote characters is a superset of what a plain text sink needs - it does
 * not change what a browser DISPLAYS, and it closes the attribute-injection
 * seam for callers that interpolate into an attribute value.
 *
 * Gotcha: load BEFORE any shared/*.js consumer (matches play/ script order,
 * the music/sw.js CORE list, and the test-file require order) - consumers
 * reach it through the shared window/global, so it must exist first.
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
