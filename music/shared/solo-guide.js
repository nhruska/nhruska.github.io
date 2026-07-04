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
 * ===================================================================== */
(function (global) {
  'use strict';

  // S-BLUES: canned per-selection teaching caption (A9 discipline - no theory
  // computed here, just static prose keyed on scaleId + the scale's own
  // family, P5-voiced). 'mode' scaleId -> null (no caption; keeps that chip's
  // on-screen footprint identical to pre-S-BLUES). `family` is Circle's
  // major/minor family word. MOVED VERBATIM from tracks.js (M-GUIDE W3a).
  function framing(scaleId, family) {
    if (scaleId === 'pentMajor') {
      return 'The inside sound over ' + family + ' and dominant vamps - same shape as its relative minor pent, two frets down; keep the root as home.';
    }
    if (scaleId === 'pentMinor') {
      return 'Home base over minor; the blues-rub color over dominant and major - one movable pattern, walkable up the neck.';
    }
    if (scaleId === 'blues') {
      return 'Pent minor plus the b5 - bend, slide, or pass through it; land on root, b3, 4, or 5 unless you want the rub.';
    }
    return null;
  }

  // 7 keys x 5 blocks. {i} = degree INDEX into the scale's own note array (NOT a
  // pitch class). Curated per m-guide-ia-20260704.md section 3, WITH the
  // professor-fold section-8B corrections (blues.resolveTo, pentMinor.startEnd,
  // dorian.hangOn) applied verbatim - those three lines supersede the section-3
  // table rows they amend.
  var SOLO_GUIDE = {
    ionian: {
      chooseWhen: 'Plain-major progressions (I IV V vi) - the inside, singing sound.',
      resolveTo: 'Land on {0} or {2}; {4} always parks safe.',
      hangOn: "Don't sit on {3} over the I - pass through it; {5} is the sweet color.",
      startEnd: 'Start phrases on {2} or {4}, end them on {0}.',
      shapes: 'Arpeggiate the chord of the bar - its tones are your strong beats.'
    },
    aeolian: {
      chooseWhen: 'Minor keys and vi-feel progressions - darker, heavier.',
      resolveTo: 'Land on {0} or {2}; {4} parks.',
      hangOn: '{5} leans hard into {4} - tension, never home.',
      startEnd: 'Start on {2} or {4}, end on {0} or {2}.',
      shapes: 'The i arpeggio anchors; {6} sets up the turnaround.'
    },
    dorian: {
      chooseWhen: 'Minor jams with a lift - Santana vamps, funk grooves.',
      resolveTo: 'Land on {0} or {2}.',
      // 8B amendment - supersedes the section-3 row.
      hangOn: '{5} IS the dorian color - lean on it over the i chord; over IV it turns into the 3rd.',
      startEnd: 'Start on {4}, end on {0}.',
      shapes: 'Work the i and IV arpeggios - most bars live there.'
    },
    mixolydian: {
      chooseWhen: 'Dominant one-chord jams and V-heavy grooves (Dead, Phish).',
      resolveTo: 'Land on {0} or {2}.',
      hangOn: '{6} against the I chord is the whole flavor - milk it.',
      startEnd: 'Start on {2} or {4}, end on {0}.',
      shapes: 'The I7 arpeggio is the skeleton - decorate around it.'
    },
    pentMajor: {
      chooseWhen: 'Major or dominant backing when you want zero-risk melody.',
      resolveTo: 'Land on {0} or {2}; {3} parks.',
      hangOn: '{4} floats - it shines over the IV chord.',
      startEnd: 'Start on {2}, end on {0} or {3}.',
      shapes: 'Same boxes as the relative minor pent, two frets down - same hands, brighter home.'
    },
    pentMinor: {
      chooseWhen: 'Minor keys straight; over major or dominant it brings the rub - rock and blues.',
      resolveTo: 'Land on {0}; {4} falls to {3}.',
      hangOn: 'Bend {2} up toward {3} - the classic move.',
      // 8B amendment - supersedes the section-3 row.
      startEnd: 'A classic move: bend {2} toward {3}. Start on {1}, end on {0}.',
      shapes: "One movable box walks the whole neck - shift it, don't re-finger it."
    },
    blues: {
      chooseWhen: '12-bar or any dominant groove - the rub is the point.',
      // 8B amendment - supersedes the section-3 row.
      resolveTo: "Aim at the root of the chord you're over; {4} always lands; {1} is the rub - resolve it by ear.",
      hangOn: '{3} passes - bend or slide through it, never park there.',
      startEnd: 'Start on {1}, end on {0} or {4}.',
      shapes: "Tap a chord above - its tones light up; chase them bar by bar."
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

  // card(scaleKey, notes) -> the 5 blocks with {i} interpolated, or null for an
  // unknown key. No DOM, no throw - matches the SOLO_SCALES-family safe-empty
  // contract the rest of the theory engine uses.
  function card(scaleKey, notes) {
    var c = SOLO_GUIDE[scaleKey];
    if (!c) return null;
    notes = notes || [];
    return {
      chooseWhen: interpolate(c.chooseWhen, notes),
      resolveTo: interpolate(c.resolveTo, notes),
      hangOn: interpolate(c.hangOn, notes),
      startEnd: interpolate(c.startEnd, notes),
      shapes: interpolate(c.shapes, notes)
    };
  }

  var SoloGuide = { framing: framing, cards: SOLO_GUIDE, card: card };
  global.SoloGuide = SoloGuide;
  if (typeof module !== 'undefined' && module.exports) module.exports = SoloGuide;

})(typeof window !== 'undefined' ? window : this);
