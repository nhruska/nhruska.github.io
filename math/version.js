/* =====================================================================
 * version.js  -  the ONE source for the Math app's deploy version.
 * ---------------------------------------------------------------------
 * math/sw.js importScripts()s this file so CACHE == MATH_VERSION with no
 * duplicate literal to drift. Mirrors music/CLAUDE.md's version-is-the-
 * PR-number convention: math-v<PR#> maps the deployed build 1:1 to its PR.
 * ===================================================================== */
(function (root) {
  'use strict';
  root.MATH_VERSION = 'math-v355-3';
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MATH_VERSION;
})(typeof self !== 'undefined' ? self : this);
