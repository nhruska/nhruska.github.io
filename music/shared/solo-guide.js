/* =====================================================================
 * solo-guide.js  -  Practice Studio mentor cards + solo-scale framing
 * ---------------------------------------------------------------------
 * M-GUIDE W3a (D-CARDS-STATIC, m-guide-ia-20260704.md section 3). A NEW,
 * standalone module so W3b's Compose solo chips (songbook.js) can call the
 * SAME framing() the Studio uses, without depending on tracks.js.
 *
 * Locked seam (verbatim in both W3 agents' MVC blocks):
 *   window.SoloGuide = {
 *     framing(scaleId, family) -> string | null   // moved from tracks.js, behavior identical
 *     cards                                       // raw SOLO_GUIDE table (read-only)
 *     card(scaleKey, notes) -> { chooseWhen, resolveTo, hangOn, startEnd, shapes } | null
 *   }
 *   scaleKey in {ionian, aeolian, dorian, mixolydian, pentMajor, pentMinor, blues}
 *   notes = current bundle's note-name array; {i} placeholders interpolate notes[i]
 *   unknown key -> null; no DOM; no throw. Node: module.exports = same object.
 *
 * Content is curated static prose ONLY (A9 discipline) - zero theory derivation
 * here. {i} tokens are degree INDICES into the caller-supplied notes array, not
 * pitch classes; card() does the interpolation, nothing else.
 *
 * S-REL-NAMES (U23, additive - the locked seam above is unchanged): "Name the
 * instance, not just the relationship" (see decisions.md D-REL-NAMES and
 * ux-philosophy/design-principles.md's Theory-authority trust chain). framing()
 * and card() each gain an OPTIONAL 3rd `root` arg; every 2-arg call keeps
 * producing byte-identical output (root absent -> the pre-S-REL-NAMES
 * relationship-only wording). When a root IS supplied, any template carrying a
 * `{relMinor}`/`{relMajor}` token gets the CONCRETE key name for that root -
 * computed via Circle.relativeMinor/relativeMajor (Circle already owns this
 * math; nothing is re-derived here, matching the A9 zero-theory-in-this-module
 * discipline above). See relNames() below.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Guarded Circle reference - SAME dual-environment pattern tracks.js's own
  // circleRef()/notablesRef() already use: window.Circle in the browser, a
  // guarded require() fallback so a Node test can drive this module standalone
  // (this IIFE's `global` is this module's own exports object in Node, never
  // the real window.Circle singleton, so require() is the only way in there).
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }

  // relNames(root, scaleId) -> { relMinor, relMajor } - the concrete related-
  // key names a scale's copy may reference, for the CURRENT root. A thin pass-
  // through onto Circle.relativeMinor/relativeMajor (shift by -3/+3 semitones,
  // sharp-canonical per circle.js's own spelling table) - not a re-derivation.
  // scaleId is accepted for signature symmetry with framing()/card() and to
  // leave room for a future non-relative-key lookup (parallel/dominant) keyed
  // off it without another signature change; today both names are cheap pure
  // math so both are always computed and the caller's template picks whichever
  // token it needs. No root, an unresolvable root, or Circle absent -> both
  // null (matches every safe-empty contract in this file/circle.js - callers
  // degrade to the relationship-only wording, never throw).
  function relNames(root, scaleId) {
    var C = circleRef();
    if (!C || !root) return { relMinor: null, relMajor: null };
    return {
      relMinor: (typeof C.relativeMinor === 'function') ? (C.relativeMinor(root) || null) : null,
      relMajor: (typeof C.relativeMajor === 'function') ? (C.relativeMajor(root) || null) : null
    };
  }

  // Second interpolation pass for the NAMED relationship tokens {relMinor}/
  // {relMajor} - deliberately a SEPARATE regex from interpolate()'s {\d+}
  // degree-index tokens below (disjoint patterns; {relMinor} never matches
  // /\{(\d+)\}/ and vice versa, so both passes coexist without ambiguity).
  // Resolved name -> '<Name> minor'/'<Name> major' (e.g. 'D minor'). Unresolved
  // (no root passed, or the root/scaleId combo has no name) -> the bare
  // relationship phrase ('the relative minor'/'the relative major') - the
  // EXACT pre-S-REL-NAMES wording, so any 2-arg caller sees byte-identical text.
  function interpolateNames(text, names) {
    return text.replace(/\{(relMinor|relMajor)\}/g, function (m, key) {
      var n = names && names[key];
      if (n) return n + (key === 'relMinor' ? ' minor' : ' major');
      return key === 'relMinor' ? 'the relative minor' : 'the relative major';
    });
  }

  // S-BLUES: canned per-selection teaching caption (A9 discipline - no theory
  // computed here, just static prose keyed on scaleId + the scale's own
  // family, P5-voiced). 'mode' scaleId -> null (no caption; keeps that chip's
  // on-screen footprint identical to pre-S-BLUES). `family` is Circle's
  // major/minor family word. MOVED VERBATIM from tracks.js (M-GUIDE W3a).
  // `root` (S-REL-NAMES, optional 3rd arg) names the {relMinor}/{relMajor}
  // token below via relNames()/interpolateNames() - see the file-header note.
  function framing(scaleId, family, root) {
    var text = null;
    if (scaleId === 'pentMajor') {
      // P5 adversarial fold (2026-07-05): "two frets down" was factually wrong -
      // the relative minor is a minor 3rd (3 semitones = 3 frets) below, not 2.
      // Fixed here for consistency with the identical correction in the
      // pentMajor.shapes card block below. S-REL-NAMES (U23): the phrase now
      // NAMES the relative minor instead of only naming the relationship - the
      // fallback wording ("the relative minor pent") is a one-word tweak from
      // the prior "its relative minor pent" so it reads identically to the
      // shapes card's own fallback below; the relationship/claim is unchanged.
      text = 'The inside sound over ' + family + ' and dominant vamps - same shape as {relMinor} pent, three frets lower; keep the root as home.';
    } else if (scaleId === 'pentMinor') {
      text = 'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.';
    } else if (scaleId === 'blues') {
      text = 'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.';
    }
    if (text == null) return null;
    return interpolateNames(text, relNames(root, scaleId));
  }

  // 7 keys x 5 blocks. {i} = degree INDEX into the scale's own note array (NOT a
  // pitch class). Curated per m-guide-ia-20260704.md section 3, THEN amended
  // twice: the professor-fold section-8B corrections (2026-07-04), then a P5
  // seasoned-player adversarial pass (2026-07-05, folded pre-merge into PR #118)
  // that rewrote most blocks toward chord-relative ("target the CURRENT chord",
  // not just the home chord) advice and fixed one factual error (pentMajor's
  // relative-minor-pent distance: a minor 3rd = THREE frets, not two). The P5
  // pass supersedes 8B wherever both touched the same block (dorian.hangOn,
  // pentMinor.startEnd, blues.resolveTo all carry the P5 text below).
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
      // Degrees are 1 2 3 5 6 -> {0}=1,{1}=2,{2}=3,{3}=5,{4}=6 (mapping kept
      // consistent with every other block); P5 wanted "1/3/5 land" -> {0},{2},{3}.
      resolveTo: "Over I, {0}, {2}, or {3} land. Over IV and V, target that chord's own tones.",
      hangOn: '{4} floats - it shines over the IV chord.',
      startEnd: 'Start on {2}, {3}, or {4}; end on a chord tone.',
      // P5 must-fix: relative minor pent is a minor 3rd (THREE frets) below,
      // not two - "two frets down" was a factual error. S-REL-NAMES (U23):
      // {relMinor} names the instance when card() is given a root; the
      // fallback ('the relative minor pent') is byte-identical to the
      // pre-S-REL-NAMES text.
      shapes: 'Same notes as {relMinor} pent, THREE frets lower - same box, different home note.'
    },
    pentMinor: {
      chooseWhen: "Minor keys straight; over major or dominant, it's the rub - rock and blues.",
      resolveTo: 'On minor, land on {0}, {1}, or {3}; over major/dom7, {1} is the rub - bend toward 3.',
      // Keeps the bend technique here (P5: resolveTo names the rub, hangOn gives
      // the move) - deliberately not deduplicated further.
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
  // for an unknown key. No DOM, no throw - matches the SOLO_SCALES-family
  // safe-empty contract the rest of the theory engine uses. `root` (S-REL-
  // NAMES, optional 3rd arg) additionally resolves any {relMinor}/{relMajor}
  // token via relNames()/interpolateNames() - see the file-header note; absent
  // root degrades every block to its pre-S-REL-NAMES text, unchanged.
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
