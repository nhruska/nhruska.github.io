/* =====================================================================
 * song-builder.js  -  AI Tutor prototype, wave 4: song-structure scoping
 * made real. A Song is an ordered list of sections (verse/chorus/bridge/...),
 * each section IS a music/tutor/mini-compose.js state (key/mode/progression)
 * tagged with a label - reuses the same reducers, no new theory for the
 * per-section progression itself.
 *
 * The NEW theory this wave introduces is judging the TRANSITION between two
 * adjacent sections' keys - "is this a pleasing change?" - entirely reused
 * from Circle.js (no new theory functions, per the discovery notes in
 * music/TUTOR-ROADMAP.md, verified against real data before this was written):
 *   - Circle.neighbors(key, mode)  -> dominant/subdominant/relative, with a
 *     human-readable "why" string - the strongest "smooth" signal.
 *   - Circle.diatonic(key, mode)   -> intersecting two keys' diatonic chord
 *     sets finds common-chord pivot candidates (a second "smooth" signal,
 *     catches modulations circle-of-fifths distance alone under-ranks - e.g.
 *     C major -> E minor shares 4 chords despite being 4 steps apart).
 *   - Circle.position(key)         -> circle-of-fifths distance, the
 *     fallback signal when neither of the above fires.
 *
 * Pure state, no DOM - Node-testable (test/song-builder.test.js) and
 * browser-usable (window.SongBuilder).
 * ===================================================================== */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../shared/circle.js'), require('./mini-compose.js'));
  } else {
    global.SongBuilder = factory(global.Circle, global.MiniCompose);
  }
})(typeof window !== 'undefined' ? window : this, function (Circle, MiniCompose) {
  'use strict';

  // ---- sections + song (thin wrapper over mini-compose state) ------------
  function createSection(label, key, mode) {
    return Object.assign({ label: label }, MiniCompose.initialState(key, mode));
  }
  function createSong() { return { sections: [] }; }
  function addSection(song, section) {
    return { sections: song.sections.concat([section]) };
  }
  // Replaces the section at `index` (used while the human is actively
  // building that section's progression via the mini-compose reducers).
  function replaceSection(song, index, newSectionState) {
    var sections = song.sections.slice();
    sections[index] = newSectionState;
    return { sections: sections };
  }

  // ---- transition-quality heuristics (verified against real data) --------
  function diatonicChordNames(key, mode) {
    return Circle.diatonic(key, mode).map(function (d) { return d.chord; });
  }
  function pivotChords(keyA, modeA, keyB, modeB) {
    var a = diatonicChordNames(keyA, modeA), b = diatonicChordNames(keyB, modeB);
    return a.filter(function (c) { return b.indexOf(c) !== -1; });
  }
  function circleSteps(keyA, keyB) {
    var pa = Circle.position(keyA), pb = Circle.position(keyB);
    if (pa < 0 || pb < 0) return null;
    var diff = Math.abs(pa - pb);
    return Math.min(diff, 12 - diff);
  }
  function directNeighbor(keyA, modeA, keyB, modeB) {
    var neighbors = Circle.neighbors(keyA, modeA);
    for (var i = 0; i < neighbors.length; i++) {
      if (neighbors[i].root === keyB && neighbors[i].mode === modeB) return neighbors[i];
    }
    return null;
  }

  // Priority order matters: a direct relationship (dominant/subdominant/
  // relative) reads as smooth REGARDLESS of raw circle-of-fifths distance -
  // the relative minor is 3 steps away on the circle but is the closest
  // possible key relationship (identical notes). Checking distance before
  // the direct-relationship check would misclassify it. Verified against
  // real Circle.js output before encoding this order (see TUTOR-ROADMAP.md).
  function analyzeTransition(sectionA, sectionB) {
    if (sectionA.key === sectionB.key && sectionA.mode === sectionB.mode) {
      return { quality: 'same', reason: 'Same key - no modulation, just a new section label.' };
    }
    var neighbor = directNeighbor(sectionA.key, sectionA.mode, sectionB.key, sectionB.mode);
    if (neighbor) {
      // neighbor.why (from Circle.neighbors) is meant to stand next to the
      // root name, not embedded in a sentence - "A - its relative minor",
      // matching the existing convention in tracks.js's neighbor chips.
      return { quality: 'smooth', reason: sectionB.key + ' ' + sectionB.mode + ' - ' + neighbor.why + ', from ' + sectionA.key + ' ' + sectionA.mode + '.' };
    }
    var pivots = pivotChords(sectionA.key, sectionA.mode, sectionB.key, sectionB.mode);
    if (pivots.length) {
      return { quality: 'smooth', reason: 'Shares ' + pivots.join('/') + ' as a pivot chord between the two keys.', pivotChords: pivots };
    }
    var steps = circleSteps(sectionA.key, sectionB.key);
    if (steps !== null && steps <= 2) {
      return { quality: 'moderate', reason: 'A short hop on the circle of fifths - noticeable, not jarring.' };
    }
    return { quality: 'distant', reason: 'Far apart on the circle of fifths with no shared chords - a bold jump, not a smooth pivot.' };
  }

  // For the "pick the next section's key" moment: rank the 3 keys
  // Circle.neighbors already names (dominant/subdominant/relative) by
  // transition quality against the section you're coming FROM, so the
  // choice itself teaches "why" via analyzeTransition's reason text.
  function keyChoicesFor(fromSection) {
    var neighbors = Circle.neighbors(fromSection.key, fromSection.mode);
    return neighbors.map(function (n) {
      var analysis = analyzeTransition(fromSection, { key: n.root, mode: n.mode });
      return { root: n.root, mode: n.mode, quality: analysis.quality, reason: analysis.reason };
    });
  }

  // Whole-song summary: every adjacent pair's transition, for a final
  // "here's your song" readout.
  function analyzeSong(song) {
    var transitions = [];
    for (var i = 0; i < song.sections.length - 1; i++) {
      transitions.push(analyzeTransition(song.sections[i], song.sections[i + 1]));
    }
    return transitions;
  }

  return {
    createSection: createSection,
    createSong: createSong,
    addSection: addSection,
    replaceSection: replaceSection,
    analyzeTransition: analyzeTransition,
    keyChoicesFor: keyChoicesFor,
    analyzeSong: analyzeSong,
    // exposed for tests / advanced callers
    pivotChords: pivotChords,
    circleSteps: circleSteps,
    directNeighbor: directNeighbor
  };
});
