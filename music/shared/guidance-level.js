/* =====================================================================
 * guidance-level.js  -  the beginner|intermediate|advanced self-reported
 * experience level that grades which one-shot Notables guidance tips a
 * player sees.
 * ---------------------------------------------------------------------
 * Storage: music.guidanceLevel.v1 = 'beginner' | 'intermediate' | 'advanced'.
 * A missing key, or any value other than those three, reads as null =
 * "ask pending". There is deliberately NO silent default: when the level
 * has never been answered, the correct behavior is to show the one-time
 * level ask (the 'guidanceask' Notables consumer), not to guess a level.
 * The ask's dismiss-without-choosing path calls set('beginner') explicitly;
 * get() itself never invents a default. (see decisions.md: GUIDANCE_LEVEL)
 *
 * Additive `music.`-prefixed key, so backup.js captures it via OWNED_PREFIXES
 * with no SCHEMA_VERSION bump. Every reader is defensive (try/catch -> null).
 *
 * Pure + dependency-free: exported for Node unit tests AND attached to
 * window.GuidanceLevel in the browser.
 *
 *   GuidanceLevel.KEY     -> 'music.guidanceLevel.v1'
 *   GuidanceLevel.LEVELS  -> ['beginner', 'intermediate', 'advanced'], the
 *       canonical order (ask-card button order; Settings-row cycle order).
 *   GuidanceLevel.get() -> 'beginner' | 'intermediate' | 'advanced' | null
 *       null = unset OR a corrupt/foreign stored value (both mean the ask
 *       has not been answered yet).
 *   GuidanceLevel.set(value)
 *       Persists value ONLY if it is exactly one of LEVELS; anything else
 *       is a silent no-op. Every caller is a fixed-vocabulary tap (an
 *       ask-card button, the ask's x-dismiss default, or a Settings-row
 *       cycle), so there is nothing to coerce from.
 * ===================================================================== */
(function (root) {
  'use strict';

  var KEY = 'music.guidanceLevel.v1';
  var LEVELS = ['beginner', 'intermediate', 'advanced'];

  // Bare `localStorage` so this runs unmodified in the browser; Node tests
  // stub it. Returns null when storage is blocked (private mode / disabled).
  function defaultStore() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* storage blocked (private mode / disabled) */ }
    return null;
  }

  function get() {
    var store = defaultStore();
    if (!store) return null;
    try {
      var v = store.getItem(KEY);
      return LEVELS.indexOf(v) >= 0 ? v : null; // unset or corrupt -> null ("ask pending")
    } catch (e) { return null; }
  }

  function set(value) {
    if (LEVELS.indexOf(value) < 0) return; // fixed vocabulary only - never persists garbage
    var store = defaultStore();
    if (!store) return;
    try { store.setItem(KEY, value); } catch (e) { /* quota / private mode - app still runs */ }
  }

  var API = { KEY: KEY, LEVELS: LEVELS, get: get, set: set };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.GuidanceLevel = API;

})(typeof window !== 'undefined' ? window : this);
