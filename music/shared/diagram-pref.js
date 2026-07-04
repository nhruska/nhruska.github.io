/* =====================================================================
 * diagram-pref.js  -  S-DIAGRAM-PREF steps 1-2: the dots|patterns chord-
 * diagram display preference, plus the tiny decision of what label (if
 * any) the 'patterns' render variant should show for a given voicing.
 * ---------------------------------------------------------------------
 * Kept as its OWN module (not folded into diagram.js or notables.js) so
 * both stay agnostic of one another: diagram.js just draws whatever
 * opts.patternLabel string it's given (or nothing - see its header), and
 * notables.js just arbitrates an opaque consumerId. This module is the
 * ONE place that knows "the pref is called music.diagram.pref.v1" and
 * "patterns mode asks ShapeClassify for a label."
 *
 * Storage: music.diagram.pref.v1 = 'dots' | 'patterns'. Additive key,
 * defensive read (a missing key, a corrupt value, or anything other than
 * the literal string 'patterns' all read as the default 'dots' - never
 * throws, never guesses 'patterns'). Falls under backup.js's `music.`
 * OWNED_PREFIXES, so it's captured by backup/restore for free; per
 * backup.js's own header rule ("Additive changes... do NOT need a bump")
 * this new key needs no SCHEMA_VERSION bump.
 *
 *   DiagramPref.KEY                                -> the localStorage key string
 *   DiagramPref.get() -> 'dots' | 'patterns'
 *   DiagramPref.set(value)                         -> persists 'dots' or 'patterns'
 *       (anything else coerces to 'dots' - a bad value is never persisted verbatim)
 *   DiagramPref.labelFor(profileId, chordName, frets) -> string
 *       '' unless the pref is 'patterns' AND window.ShapeClassify (or its
 *       Node require fallback) can classify this exact voicing. Degrades to
 *       '' (no label) for every profile/voicing shape-classify.js doesn't
 *       cover - matches its own "honest null, never a guess" contract.
 * ===================================================================== */
(function (root) {
  'use strict';

  var KEY = 'music.diagram.pref.v1';

  // Bare `localStorage` (matches notables.js/songbook.js convention) so this
  // runs unmodified in the browser; Node tests stub it via
  // test/helpers/local-storage-reset.js, same pattern as notables.test.js.
  function defaultStore() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* storage blocked (private mode / disabled) */ }
    return null;
  }

  function get() {
    var store = defaultStore();
    if (!store) return 'dots';
    try {
      var v = store.getItem(KEY);
      return v === 'patterns' ? 'patterns' : 'dots'; // defensive: anything else -> 'dots'
    } catch (e) { return 'dots'; }
  }

  function set(value) {
    var store = defaultStore();
    if (!store) return;
    try { store.setItem(KEY, value === 'patterns' ? 'patterns' : 'dots'); } catch (e) { /* quota / private mode */ }
  }

  // Resolution mirrors shape-classify.js's own getProfileData() pattern -
  // browser global first, Node require as a fallback - so labelFor() stays
  // testable without needing a <script>-tag load order.
  function classifier() {
    if (typeof window !== 'undefined' && window.ShapeClassify) return window.ShapeClassify;
    if (typeof require === 'function') {
      try { return require('./shape-classify.js'); } catch (e) { /* not available - degrade to no label */ }
    }
    return null;
  }

  function labelFor(profileId, chordName, frets) {
    if (get() !== 'patterns') return '';
    if (!frets || !frets.length) return '';
    var SC = classifier();
    if (!SC) return '';
    var info = SC.classify(profileId, chordName, frets);
    return info ? SC.label(info) : '';
  }

  var API = { KEY: KEY, get: get, set: set, labelFor: labelFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.DiagramPref = API;

})(typeof window !== 'undefined' ? window : this);
