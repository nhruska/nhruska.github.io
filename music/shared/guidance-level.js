/* =====================================================================
 * guidance-level.js  -  M-GUIDANCE: the beginner|intermediate|advanced
 * self-reported experience level that grades which one-shot Notables
 * guidance tips a player sees (docs/plans/guidance-levels-spec-20260705.md).
 * ---------------------------------------------------------------------
 * Storage: music.guidanceLevel.v1 = 'beginner' | 'intermediate' | 'advanced'.
 * UNSET (missing key, OR any value other than the 3 above) reads as null -
 * "ask pending". Unlike diagram-pref.js's 'dots' default, there is NO
 * silent default here: the spec's own rule is "unset level: only the ask
 * may show" (notables.js's LEVELS gate, below), so inventing a default in
 * get() would be wrong - the correct behavior for "never answered" is the
 * one-time level ask (the 'guidanceask' Notables consumer, play/index.html
 * renderGuidanceAsk()), not a guess. The ask's own dismiss-without-choosing
 * path calls set('beginner') explicitly (the one safe default the operator
 * spec names) - get() itself never invents that default.
 *
 * Additive key - falls under backup.js's `music.` OWNED_PREFIXES, so it is
 * captured by backup/restore for free; per backup.js's own header rule
 * ("Additive changes... do NOT need a bump") this needs NO SCHEMA_VERSION
 * bump. Every reader here is defensive (try/catch -> null), matching every
 * other reader in this app.
 *
 * Pure + dependency-free (like diagram-pref.js/notables.js): exported for
 * Node unit tests AND attached to window.GuidanceLevel in the browser.
 *
 *   GuidanceLevel.KEY     -> 'music.guidanceLevel.v1'
 *   GuidanceLevel.LEVELS  -> ['beginner', 'intermediate', 'advanced'], the
 *       canonical order (ask-card button order; Settings-row cycle order).
 *   GuidanceLevel.get() -> 'beginner' | 'intermediate' | 'advanced' | null
 *       null = unset OR a corrupt/foreign stored value (never guessed at -
 *       "unset" and "corrupt" both mean the ask has not been answered yet).
 *   GuidanceLevel.set(value)
 *       Persists value ONLY if it is exactly one of LEVELS; anything else
 *       is a silent no-op (never writes garbage, never coerces to a nearby
 *       valid value) - every real caller here is a fixed-vocabulary tap
 *       (an ask-card button, the ask's own x-dismiss default, or a
 *       Settings-row cycle), so there is nothing sensible to coerce FROM.
 * ===================================================================== */
(function (root) {
  'use strict';

  var KEY = 'music.guidanceLevel.v1';
  var LEVELS = ['beginner', 'intermediate', 'advanced'];

  // Bare `localStorage` (matches notables.js/diagram-pref.js convention) so
  // this runs unmodified in the browser; Node tests stub it via
  // test/helpers/local-storage-reset.js, same pattern as diagram-pref.test.js.
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
