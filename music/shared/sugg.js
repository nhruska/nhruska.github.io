/* =====================================================================
 * sugg.js  -  chord-progression suggestion map (instrument-agnostic chord
 * names). Songbook's Compose "suggested next chord" chips read this table
 * (music/shared/songbook.js: `var SUGG = opts.suggestions || {};`).
 * ---------------------------------------------------------------------
 * S-EXTRACT (analysis-refactor-enhance-20260704 A7): moved out of
 * music/play/index.html's inline bootstrap script (previously hand-
 * maintained inline with zero test coverage) into its own module so it can
 * be direct-required and regression-guarded - see test/sugg.test.js, which
 * asserts every key AND every follower chord name resolves under FORK-4
 * canonical-sharp spelling, plus a content-identity snapshot against this
 * exact table.
 *
 * Canonically SHARP names (FORK-4): the whole app labels A#, D#m - never
 * Bb, Ebm - so a suggestion chip can't show "Bb" beside an in-key palette
 * that says "A#". Shape lookup stays intact: the LIVE adapter resolves
 * enharmonics via profileVoicing() in chord-pack-adapter.js's buildAdapter
 * (A# finds a Bb-keyed profile fingering); the legacy standalone packs
 * carry the same logic as shapeFor().
 *
 * music/sw.js CORE must precache this file (test/sw-verify.test.js A6 guard).
 * ===================================================================== */
(function (global) {
  'use strict';

  var SUGG = {
    C: ["G", "Am", "F", "Em", "Dm"], G: ["C", "D", "Em", "Am", "D7"], D: ["G", "A", "Bm", "Em", "A7"],
    A: ["D", "E", "Bm", "E7", "F"], E: ["A", "B", "C#m", "B7", "A"], F: ["C", "G", "Dm", "A#", "Am"],
    B: ["E", "A", "F#7", "E7", "G"], Am: ["F", "G", "C", "Dm", "E7"], Em: ["C", "G", "D", "Am", "B7"],
    Dm: ["G", "C", "F", "Am", "A7"], Bm: ["G", "A", "D", "Em", "F#7"], Gm: ["F", "D7", "Cm", "D#", "A#"],
    Cm: ["G7", "Fm", "G#", "D#", "A#"], Fm: ["C7", "A#m", "C#", "G#", "D#"],
    G7: ["C", "Am", "F", "Em"], C7: ["F", "Dm", "G", "Am"], D7: ["G", "Em", "C", "Bm"],
    A7: ["D", "Bm", "G", "F#m"], E7: ["A", "C#m", "F#m", "B7"], F7: ["A#", "Dm", "C", "Gm"],
    B7: ["E", "G#m", "C#m", "F#m"]
  };

  var Sugg = { SUGG: SUGG };
  global.Sugg = Sugg;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sugg;

})(typeof window !== 'undefined' ? window : this);
