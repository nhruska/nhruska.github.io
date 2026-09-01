/* =====================================================================
 * jam-queries.js  -  key-aware jam-discovery matrix
 * ---------------------------------------------------------------------
 * Curated static data + a pure query generator that turns the active
 * scale + genre + feel selection into a backing-track search phrase. NO
 * theory derivation, NO DOM, NO network.
 *
 * Keyed on the SAME 7-scale vocabulary solo-guide.js uses
 * (ionian/aeolian/dorian/mixolydian/blues/pentMajor/pentMinor) so the
 * Studio's active scale-chip selection (curScaleId resolved through
 * scaleKeyFor()) maps directly onto a genre list here.
 *
 * The "shuffle vs straight" distinction lives inside the genre lists (e.g.
 * blues carries both 'shuffle blues' and 'slow blues' as separate entries)
 * rather than a 4th axis - tempo/feel stays a clean 3-band scale
 * (slow/mid/up) for every mode.
 *
 * Public API:
 *   JamQueries.genresFor(scaleId) -> string[]                  (>= 3 entries)
 *   JamQueries.feels() -> [{id,label,bpm}, ...]                 (3 bands)
 *   JamQueries.jamQuery(keyName, scaleId, genre, feelId)
 *     -> "A dorian funk backing track slow"   (KEY-AWARE at call time)
 *     `genre` accepts a single string (unchanged, back-compat) OR an array
 *     of genre strings for multi-select - array entries join with single
 *     spaces, in selection order, into one search-phrase term.
 *
 * Dual export: module.exports (Node) + window.JamQueries (browser) - the
 * shape every shared/*.js module here uses.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Curated per-scale genre lists. Every list carries >= 3 genres
  // (locked by jam-queries.test.js), capped at 12. Widened to ~6-8 per scale
  // (operator UAT 2026-07-22: "keep per-scale curation with a larger list of
  // genres"), coach-validated (songwriting-coach + music-theory-coach) so
  // every genre genuinely sits in / exploits its mode - gospel + jam band
  // read as mixolydian (dominant-heavy / bVII), not ionian/dorian.
  //
  // 2026-09-01 (operator directive - jam finder): jazz/smooth jazz/funk/disco
  // added, plus same-vein soul/r&b completions, per-scale reasoning below.
  // Additive only - no existing genre removed, no duplicate within a list
  // (cross-list repeats, e.g. "blues rock" in both dorian and mixolydian,
  // are the existing pattern and stay fine).
  var GENRES = {
    // + jazz: bright major-key swing/standards are functionally tonic-major -
    // the natural complement to the modal jazz already anchored in dorian.
    ionian: ['classic rock', 'pop', 'country', 'folk', 'singer-songwriter', 'soft rock', 'worship', 'jazz'],
    // + soul, disco: minor-key soul (moody ballads) and classic minor-tinged
    // disco ("I Feel Love", Bee Gees minor cuts) both exploit aeolian's
    // darker color, distinct from dorian's brighter natural 6th.
    aeolian: ['rock', 'metal', 'cinematic', 'indie', 'alt rock', 'post-rock', 'synthwave', 'soul', 'disco'],
    // + smooth jazz: dorian is THE jazz mode - its laid-back ii-vamp idiom
    // (Grover Washington Jr. style) joins the existing modal jazz/jazz
    // fusion/soul entries; funk and jazz itself are already covered here.
    dorian: ['funk', 'latin rock', 'modal jazz', 'blues rock', 'soul', 'reggae', 'jazz fusion', 'smooth jazz'],
    // + r&b: classic Motown/R&B bVII-I vamps share mixolydian's dominant
    // color with the existing gospel/funk-rock entries.
    mixolydian: ['jam band', 'country rock', 'blues rock', 'celtic', 'southern rock', 'funk rock', 'gospel', 'r&b'],
    blues: ['slow blues', 'shuffle blues', 'quick change blues', 'minor blues', 'delta blues', 'texas blues', 'jump blues', 'soul blues'],
    // no additions: none of jazz/funk/disco/r&b genuinely exploit major
    // pentatonic's bright bluegrass/country color - forcing them here would
    // be theory-false, not coach-justified.
    pentMajor: ['country', 'pop rock', 'bluegrass', 'folk rock', 'americana', 'classic rock'],
    // + jazz, smooth jazz, funk, disco (operator-directed, mandatory) plus
    // same-vein soul/r&b: not the purest theoretical home for these genres,
    // but pentatonic-minor soloing over funk/jazz-fusion/soul/disco vamps is
    // the practical backing-track-search backbone for this scale.
    pentMinor: ['rock', 'blues rock', 'grunge', 'hard rock', 'metal', 'punk', 'jazz', 'smooth jazz', 'funk', 'disco', 'soul', 'r&b']
  };

  // Tempo/feel bands: slow ~60-80 / mid ~90-110 / up 120+.
  var FEELS = [
    { id: 'slow', label: 'Slow', bpm: '60-80' },
    { id: 'mid', label: 'Mid', bpm: '90-110' },
    { id: 'up', label: 'Up', bpm: '120+' }
  ];

  // The word each scale key contributes to the generated search phrase -
  // matches how the rest of the app talks about these scales
  // (keyLabelFor/SoloGuide labels): major/minor read as bare mode words,
  // the two modal colours + blues read as their own name, the pentatonics
  // spell out "major/minor pentatonic" (a common backing-track search term).
  var SCALE_WORD = {
    ionian: 'major', aeolian: 'minor', dorian: 'dorian', mixolydian: 'mixolydian',
    blues: 'blues', pentMajor: 'major pentatonic', pentMinor: 'minor pentatonic'
  };

  function genresFor(scaleId) {
    return (GENRES[scaleId] || []).slice();
  }

  function feels() {
    return FEELS.map(function (f) { return { id: f.id, label: f.label, bpm: f.bpm }; });
  }

  function feelById(feelId) {
    for (var i = 0; i < FEELS.length; i++) if (FEELS[i].id === feelId) return FEELS[i];
    return null;
  }

  // jamQuery(key, scaleId, genre, feel) -> "A dorian funk backing track slow"
  // KEY-AWARE at tap time: takes whatever key/root name the caller is
  // currently jamming in (spelled upstream - this module does no spelling of
  // its own) plus the active scale + genre + feel selection. Any
  // missing/unknown piece is simply omitted (never throws, never renders
  // "undefined") - the same safe-empty contract the rest of the theory
  // engine uses (circle.js soloScale/chordTones etc.).
  //
  // `genre` accepts a plain string (unchanged behavior - locked by
  // jam-queries.test.js) OR an array of genre strings for multi-select
  // (M-JAM-MULTI, 2026-09-01): array entries join with single spaces, in
  // selection order, into the one search-phrase term the rest of this
  // function already treats as "the genre". A non-array falls through to
  // the original String(...) coercion untouched.
  function jamQuery(keyName, scaleId, genre, feelId) {
    var key = String(keyName == null ? '' : keyName).trim();
    var word = SCALE_WORD[scaleId] || '';
    var g = Array.isArray(genre)
      ? genre.filter(function (x) { return x != null && String(x).trim().length; })
          .map(function (x) { return String(x).trim(); }).join(' ')
      : String(genre == null ? '' : genre).trim();
    var feel = feelById(feelId);
    var parts = [];
    if (key) parts.push(key);
    // Omit the scale word when the genre already spells it out. The blues
    // genre entries ("slow blues"/"shuffle blues"/etc.) already carry
    // "blues"; without this guard the phrase would read "A blues slow blues
    // backing track ...". Every other scale's genre list is disjoint from
    // its own scale word, so this only fires for the blues case.
    if (word && g.toLowerCase().indexOf(word.toLowerCase()) < 0) parts.push(word);
    if (g) parts.push(g);
    parts.push('backing track');
    if (feel) parts.push(feel.label.toLowerCase());
    return parts.join(' ');
  }

  var JamQueries = {
    genresFor: genresFor,
    feels: feels,
    jamQuery: jamQuery,
    // exposed for tests / callers that want the raw scale-id vocabulary
    SCALE_IDS: Object.keys(GENRES)
  };

  global.JamQueries = JamQueries;
  if (typeof module !== 'undefined' && module.exports) module.exports = JamQueries;

})(typeof window !== 'undefined' ? window : this);
