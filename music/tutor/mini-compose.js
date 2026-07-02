/* =====================================================================
 * mini-compose.js  -  AI Tutor prototype, wave 2: a tutor-OWNED practice
 * widget (NOT the real Compose - see music/TUTOR-CHALLENGES-CHECKLIST.md).
 * Pure state + action reducers, no DOM. Node-testable and browser-usable
 * (window.MiniCompose). Reuses the app's own theory engine:
 *   - Circle.diatonic(key, mode)   -> in-key chord choices + roman numerals
 *   - Songbook.tpose(chord, semis) -> transposing a full chord token
 * so this widget's theory matches the real app exactly, not a re-derived copy.
 *
 * State shape: { key, mode, progression: [chord, ...], track }
 * Every reducer takes (state, ...args) and returns a NEW state (state is
 * never mutated) - same shape a future real-app control API would need.
 * ===================================================================== */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../shared/circle.js'), require('../shared/songbook.js'));
  } else {
    global.MiniCompose = factory(global.Circle, global.Songbook);
  }
})(typeof window !== 'undefined' ? window : this, function (Circle, Songbook) {
  'use strict';

  var MOCK_TRACKS = ['No track (silent practice)', 'Slow jam', 'Uptempo groove', 'Laid-back shuffle'];

  function initialState(key, mode) {
    return { key: key || 'C', mode: mode || 'major', progression: [], track: MOCK_TRACKS[0] };
  }

  function setKey(state, root, mode) {
    return Object.assign({}, state, { key: root || state.key, mode: mode || state.mode, progression: [] });
  }
  // Same fields as setKey, but does NOT clear the progression - this is the
  // "same chords, new lens" move (wave 3's relative/parallel scale-swap
  // challenge): the built progression stays exactly as-is, only the key/mode
  // label used for scale + roman-numeral math changes. setKey's fresh-start
  // clear is right when starting a NEW challenge in a new key; this reducer
  // is right when demonstrating that a fixed progression can be reinterpreted.
  function reinterpretKey(state, root, mode) {
    return Object.assign({}, state, { key: root || state.key, mode: mode || state.mode });
  }
  function buildProgression(state, chords) {
    return Object.assign({}, state, { progression: (chords || []).slice() });
  }
  function addChord(state, chord) {
    if (!chord) return state;
    return Object.assign({}, state, { progression: state.progression.concat([chord]) });
  }
  function removeLast(state) {
    return Object.assign({}, state, { progression: state.progression.slice(0, -1) });
  }
  function clearProgression(state) {
    return Object.assign({}, state, { progression: [] });
  }
  function transpose(state, semitones) {
    // Circle doesn't publicly expose root-shifting by an arbitrary semitone
    // count (only wrapped forms like dominant/subdominant/relativeMinor).
    // Songbook.tpose(chord, semis) does exactly this and is what the real
    // Compose transpose control already calls - reuse it, including on the
    // bare key root (a root with no quality suffix round-trips cleanly).
    var newKey = Songbook.tpose(state.key, semitones);
    var newProgression = state.progression.map(function (ch) { return Songbook.tpose(ch, semitones); });
    return Object.assign({}, state, { key: newKey, progression: newProgression });
  }
  function selectTrack(state, track) {
    return Object.assign({}, state, { track: track || state.track });
  }

  // In-key chord choices for the "your turn" picker: Circle.diatonic already
  // returns { roman, chord, root, quality } - exactly what a chip needs.
  function diatonicChoices(state) {
    return Circle.diatonic(state.key, state.mode);
  }

  // Roman-numeral reading of the current progression against the current key
  // (tonic = the I/i chord of the key) - used by challenge checkers and by
  // the widget to show "I - IV - V" style labels under the chord chips.
  function romanNumerals(state) {
    var tonic = diatonicChoices(state)[0];
    var tonicChord = tonic ? tonic.chord : state.key;
    return state.progression.map(function (ch) { return Circle.romanFor(ch, tonicChord); });
  }

  return {
    MOCK_TRACKS: MOCK_TRACKS,
    initialState: initialState,
    setKey: setKey,
    reinterpretKey: reinterpretKey,
    buildProgression: buildProgression,
    addChord: addChord,
    removeLast: removeLast,
    clearProgression: clearProgression,
    transpose: transpose,
    selectTrack: selectTrack,
    diatonicChoices: diatonicChoices,
    romanNumerals: romanNumerals
  };
});
