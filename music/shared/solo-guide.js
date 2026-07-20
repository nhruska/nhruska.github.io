/* =====================================================================
 * solo-guide.js  -  Practice Studio mentor cards + solo-scale framing
 * ---------------------------------------------------------------------
 * Standalone module for the solo-scale teaching copy: the Compose solo chips
 * (songbook.js) and the Studio both call the SAME framing() here, so neither
 * depends on tracks.js.
 *
 * Public API (seam):
 *   window.SoloGuide = {
 *     framing(scaleId, family, root?) -> string | null
 *     cards                                       // raw SOLO_GUIDE table (read-only)
 *     card(scaleKey, notes, root?) -> { chooseWhen, resolveTo, hangOn, startEnd, shapes } | null
 *     relNames(root, scaleId) -> { relMinor, relMajor }
 *   }
 *   scaleKey in {ionian, aeolian, dorian, mixolydian, pentMajor, pentMinor, blues}
 *   notes = current bundle's note-name array; {i} placeholders interpolate notes[i]
 *   unknown key -> null; no DOM; no throw. Node: module.exports = same object.
 *
 * Pattern: content is curated static prose only - zero theory is derived here.
 * {i} tokens are degree INDICES into the caller-supplied notes array, not pitch
 * classes; card() interpolates, nothing else.
 *
 * The optional 3rd `root` arg on framing()/card() names concrete related keys:
 * a template carrying a `{relMinor}`/`{relMajor}` token gets the actual key name
 * for that root (via Circle). Omit root and every template falls back to the
 * bare relationship wording ("the relative minor"). See relNames() below.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Guarded Circle reference - window.Circle in the browser, a guarded
  // require() fallback so a Node test can drive this module standalone (in
  // Node this IIFE's `global` is the module's own exports object, never the
  // real window.Circle singleton, so require() is the only way in there).
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }

  // relNames(root, scaleId) -> { relMinor, relMajor } - the concrete related-
  // key names for the current root. A thin pass-through onto
  // Circle.relativeMinor/relativeMajor (shift by -3/+3 semitones); not a
  // re-derivation. scaleId is accepted for signature symmetry with
  // framing()/card() and to leave room for a future parallel/dominant lookup
  // without another signature change; today both names are cheap pure math so
  // both are always computed and the caller's template picks the token it
  // needs. No root, an unresolvable root, or Circle absent -> both null
  // (callers degrade to the relationship-only wording, never throw).
  //
  // Circle.relativeMinor/relativeMajor return a canonical-sharp identity name,
  // not a key-aware name. Route it through
  // Circle.preferredTonicName(shiftedRoot, 'minor'|'major') so a C#-major
  // Studio (displayed Db) names its relative minor "Bb minor", never
  // "A# minor". Falls back to the raw shifted name if preferredTonicName is
  // unavailable.
  function relNames(root, scaleId) {
    var C = circleRef();
    if (!C || !root) return { relMinor: null, relMajor: null };
    var rawMinor = (typeof C.relativeMinor === 'function') ? C.relativeMinor(root) : null;
    var rawMajor = (typeof C.relativeMajor === 'function') ? C.relativeMajor(root) : null;
    var hasPreferred = typeof C.preferredTonicName === 'function';
    return {
      relMinor: rawMinor ? (hasPreferred ? C.preferredTonicName(rawMinor, 'minor') : rawMinor) : null,
      relMajor: rawMajor ? (hasPreferred ? C.preferredTonicName(rawMajor, 'major') : rawMajor) : null
    };
  }

  // Second interpolation pass for the named relationship tokens {relMinor}/
  // {relMajor} - a separate regex from interpolate()'s {\d+} degree-index
  // tokens below (disjoint patterns, so both passes coexist without ambiguity).
  // Resolved name -> '<Name> minor'/'<Name> major' (e.g. 'D minor'). Unresolved
  // (no root passed, or the root has no name) -> the bare relationship phrase
  // ('the relative minor'/'the relative major').
  function interpolateNames(text, names) {
    return text.replace(/\{(relMinor|relMajor)\}/g, function (m, key) {
      var n = names && names[key];
      if (n) return n + (key === 'relMinor' ? ' minor' : ' major');
      return key === 'relMinor' ? 'the relative minor' : 'the relative major';
    });
  }

  // Per-selection teaching caption - static prose keyed on scaleId + the
  // scale's own family word (Circle's major/minor word). scaleId 'mode' -> null
  // (no caption). `root` (optional) names the {relMinor}/{relMajor} token via
  // relNames()/interpolateNames() - see the file-header note.
  function framing(scaleId, family, root) {
    var text = null;
    if (scaleId === 'pentMajor') {
      // The relative minor is a minor 3rd (three frets) below, not two - kept
      // in sync with the identical distance in the pentMajor.shapes card below.
      text = 'The inside sound over ' + family + ' and dominant vamps - same shape as {relMinor} pent, three frets lower; keep the root as home.';
    } else if (scaleId === 'pentMinor') {
      text = 'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.';
    } else if (scaleId === 'blues') {
      text = 'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.';
    }
    if (text == null) return null;
    return interpolateNames(text, relNames(root, scaleId));
  }

  // 7 keys x 5 blocks of curated teaching copy. {i} = degree INDEX into the
  // scale's own note array (NOT a pitch class). Advice is chord-relative
  // ("target the CURRENT chord", not just the home chord).
  var SOLO_GUIDE = {
    ionian: {
      chooseWhen: 'Plain-major progressions (I IV V vi) - the inside, singing sound.',
      resolveTo: "On I, land on {0}, {2}, or {4}; elsewhere, land on that chord's root or 3rd.",
      hangOn: 'Over I, {3} wants to resolve to {2} unless you mean sus; {5} is the major-6 color.',
      startEnd: 'Start on {2} or {4}; close on a chord tone, not automatically {0}.',
      shapes: 'Arpeggiate the chord of the bar - its tones are your strong beats.'
    },
    aeolian: {
      chooseWhen: 'Natural-minor and vi-feel progressions without a strong V7.',
      resolveTo: 'On i, land on {0}, {2}, or {4}. Over changes, target the current chord.',
      hangOn: 'Over i, {5} leans down into {4}; over bVI or iv it can sit.',
      startEnd: 'Start on {2} or {4}, end on {0} or {2}.',
      shapes: 'The i arpeggio anchors; {6} points back to {0} or into bVII.'
    },
    dorian: {
      chooseWhen: 'Minor jams with a lift - Santana vamps, funk grooves.',
      resolveTo: 'On i, land on {0}, {2}, or {4}; hold {5} when the vamp supports the color.',
      hangOn: "{5} IS the dorian color - the natural-6 over i; over IV it's the 3rd.",
      startEnd: 'Start on {4}, {2}, or {5}; end on {0} or a chord tone of the vamp.',
      shapes: 'For i-IV vamps, work the i and IV arpeggios; let {5} connect them.'
    },
    mixolydian: {
      chooseWhen: 'Dominant one-chord jams and V-heavy grooves (Dead, Phish).',
      resolveTo: 'Land on {0}, {2}, or {6}; {4} is neutral.',
      hangOn: '{6} makes the dominant sound - sit on it over I7; resolve when the band turns plain major.',
      startEnd: 'Start on {2}, {4}, or {6}; close on {0}, {2}, or {6}.',
      shapes: 'The I7 arpeggio is the skeleton - decorate around it.'
    },
    pentMajor: {
      chooseWhen: 'Major-key, country/pop, and sweet-side blues - consonant lines.',
      // Degrees are 1 2 3 5 6 -> {0}=1,{1}=2,{2}=3,{3}=5,{4}=6; "1/3/5 land" is
      // {0},{2},{3}.
      resolveTo: "Over I, {0}, {2}, or {3} land. Over IV and V, target that chord's own tones.",
      hangOn: '{4} floats - it shines over the IV chord.',
      startEnd: 'Start on {2}, {3}, or {4}; end on a chord tone.',
      // Relative minor pent is a minor 3rd (THREE frets) below, not two.
      // {relMinor} names the instance when card() is given a root; without one
      // it falls back to 'the relative minor pent'.
      shapes: 'Same notes as {relMinor} pent, THREE frets lower - same box, different home note.'
    },
    pentMinor: {
      chooseWhen: "Minor keys straight; over major or dominant, it's the rub - rock and blues.",
      resolveTo: 'On minor, land on {0}, {1}, or {3}; over major/dom7, {1} is the rub - bend toward 3.',
      // resolveTo names the rub, hangOn gives the move - kept separate on purpose.
      hangOn: 'Bend {2} up toward {3} - the classic move.',
      startEnd: 'Start on {1} or {3}; close on {0}, {3}, or the current chord root.',
      shapes: 'Link the five pent boxes - track {0}, {1}, {2}, {3}, {4} across every shape.'
    },
    blues: {
      chooseWhen: '12-bar or dominant grooves - the rub is the point.',
      resolveTo: "Aim at the current chord's 3rd, b7, or root; {4} is neutral. Over I7, bend {1} toward 3.",
      hangOn: 'Pass through {3}; park there only for obvious tension.',
      startEnd: "Start on {1}, {2}, or {4}; close on that chord's root, 3rd, b7, or {4}.",
      shapes: 'Tap a chord above - its tones light up; hollow dots are outside notes you add by ear.'
    }
  };

  // Interpolate every {i} token in `text` with notes[i] (blank if the index is
  // out of range - never renders the literal word "undefined").
  function interpolate(text, notes) {
    return text.replace(/\{(\d+)\}/g, function (m, d) {
      var n = notes[Number(d)];
      return n == null ? '' : n;
    });
  }

  // card(scaleKey, notes, root) -> the 5 blocks with {i} interpolated, or null
  // for an unknown key. No DOM, no throw. `root` (optional) additionally
  // resolves any {relMinor}/{relMajor} token via relNames()/interpolateNames()
  // - see the file-header note; without a root every block falls back to its
  // relationship-only wording.
  function card(scaleKey, notes, root) {
    var c = SOLO_GUIDE[scaleKey];
    if (!c) return null;
    notes = notes || [];
    var names = relNames(root, scaleKey);
    function build(text) { return interpolateNames(interpolate(text, notes), names); }
    return {
      chooseWhen: build(c.chooseWhen),
      resolveTo: build(c.resolveTo),
      hangOn: build(c.hangOn),
      startEnd: build(c.startEnd),
      shapes: build(c.shapes)
    };
  }

  var SoloGuide = { framing: framing, cards: SOLO_GUIDE, card: card, relNames: relNames };
  global.SoloGuide = SoloGuide;
  if (typeof module !== 'undefined' && module.exports) module.exports = SoloGuide;

})(typeof window !== 'undefined' ? window : this);
