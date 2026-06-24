/* =====================================================================
 * circle.js  -  circle-of-fifths theory engine + wheel renderer (shared)
 * ---------------------------------------------------------------------
 * The "spine" of the Backing Tracks surface (see backing-tracks/DESIGN.md):
 * keys are positions on the circle, chords are derived from it, neighbors
 * are adjacent. Pure music theory here (unit-tested in Node); the SVG wheel
 * renderer is added alongside.
 *
 * Sharp spelling throughout (matches Songbook.ROOTS). Flats are normalized
 * on input. No build step. Exposes window.Circle, and require()-able in Node.
 *   Circle.diatonic('C','major') -> [{roman:'I', chord:'C', root:'C', quality:''}, ...]
 * ===================================================================== */
(function (global) {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var F2S = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  // 12 roots clockwise by fifths (+7 semitones each step) from C
  var ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

  function norm(root) { return F2S[root] || root; }
  function pcOf(root) { return ROOTS.indexOf(norm(root)); }      // -1 if unknown
  function spell(pc) { return ROOTS[((pc % 12) + 12) % 12]; }
  function shift(root, semis) { var p = pcOf(root); return p < 0 ? null : spell(p + semis); }

  // The seven modes as semitone formulas from the root. 'major'/'minor' alias
  // Ionian/Aeolian. Everything below (scales, interval degrees, the "one note
  // changed" hint, and the diatonic triads) derives from these — one source.
  var MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  var MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10]
  };
  var ALIAS = { major: 'ionian', minor: 'aeolian' };
  // ref = the scale a mode is "one note changed" from (its brighter parent)
  var MODE_INFO = {
    ionian: { label: 'Ionian (major)', family: 'major', ref: 'ionian', vibe: 'bright / home' },
    lydian: { label: 'Lydian', family: 'major', ref: 'ionian', vibe: 'dreamy / floating' },
    mixolydian: { label: 'Mixolydian', family: 'major', ref: 'ionian', vibe: 'bluesy / dominant' },
    dorian: { label: 'Dorian', family: 'minor', ref: 'aeolian', vibe: 'hopeful minor' },
    aeolian: { label: 'Aeolian (minor)', family: 'minor', ref: 'aeolian', vibe: 'sad / neutral' },
    phrygian: { label: 'Phrygian', family: 'minor', ref: 'aeolian', vibe: 'Spanish / dark' },
    locrian: { label: 'Locrian', family: 'minor', ref: 'aeolian', vibe: 'unstable' }
  };
  var DEG = ['1', '2', '3', '4', '5', '6', '7'];
  var RN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function modeKey(mode) { return MODES[ALIAS[mode] || mode] ? (ALIAS[mode] || mode) : 'ionian'; }

  // ---- key-aware note spelling ----------------------------------------------
  // Internal note identity stays sharp (ORDER, pcOf, dominant…); spelling is a
  // pure display layer. Conventional root spelling per pitch class: flats on the
  // flat side (Bb/Eb/Ab/Db), F# kept for the F#/Gb enharmonic.
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function accStr(n) { return n === 0 ? '' : n > 0 ? (n > 1 ? '##' : '#') : (n < -1 ? 'bb' : 'b'); }
  // spell a scale from one root-letter so letters A-G are each used once
  function spellFromLetter(rootName, pc, formula) {
    var li = LETTERS.indexOf(rootName.charAt(0)), names = [], badness = 0;
    formula.forEach(function (s, i) {
      var target = (pc + s) % 12, letter = LETTERS[(li + i) % 7];
      var d = (((target - LETTER_PC[letter]) % 12) + 18) % 12 - 6; // nearest accidental, -6..5
      names.push(letter + accStr(d));
      badness += Math.abs(d) > 1 ? 100 + Math.abs(d) : Math.abs(d); // punish double-accidentals hard
    });
    return { names: names, badness: badness };
  }
  // Spell a scale, choosing the root enharmonic that needs the fewest accidentals
  // (so C# minor — 4 sharps — not Db minor's 8 flats / double-flats). Sharp wins ties.
  function spellScale(root, mode) {
    var pc = pcOf(root); if (pc < 0) return [];
    var formula = MODES[modeKey(mode)];
    var cands = ROOTS[pc] === FLAT[pc] ? [ROOTS[pc]] : [ROOTS[pc], FLAT[pc]];
    var best = null;
    cands.forEach(function (rn) {
      var r = spellFromLetter(rn, pc, formula);
      if (!best || r.badness < best.badness) best = r;
    });
    return best.names;
  }
  function spellRoot(root, mode) { var s = spellScale(root, mode); return s.length ? s[0] : root; }
  function keyName(root) { return spellRoot(root, 'major'); } // conventional major-key spelling

  function position(root) { return ORDER.indexOf(norm(root)); }
  function atPosition(n) { return ORDER[((n % 12) + 12) % 12]; }

  function scale(root, mode) { return spellScale(root, mode); }
  // interval label per degree vs the major scale: e.g. dorian -> 1 2 ♭3 4 5 6 ♭7
  function scaleDegrees(mode) {
    return MODES[modeKey(mode)].map(function (s, i) {
      var d = s - MAJOR_STEPS[i];
      return (d < 0 ? '♭' : d > 0 ? '♯' : '') + DEG[i];
    });
  }
  // the note(s) that move vs the parent reference scale — "raise the 6th (F→F#)"
  function modeChange(root, mode) {
    var mk = modeKey(mode), ref = MODE_INFO[mk].ref;
    if (ref === mk) return [];
    if (pcOf(root) < 0) return [];
    var fm = MODES[mk], fr = MODES[ref], rs = spellScale(root, ref), ms = spellScale(root, mk), out = [];
    for (var i = 0; i < 7; i++) {
      if (fm[i] !== fr[i]) out.push({ degree: i + 1, from: rs[i], to: ms[i], dir: fm[i] > fr[i] ? 'raise' : 'lower' });
    }
    return out;
  }
  function triadQuality(third, fifth) {
    if (third === 4 && fifth === 7) return { q: '', t: 'maj' };
    if (third === 3 && fifth === 7) return { q: 'm', t: 'min' };
    if (third === 3 && fifth === 6) return { q: 'dim', t: 'dim' };
    if (third === 4 && fifth === 8) return { q: 'aug', t: 'aug' };
    return { q: '', t: 'maj' };
  }
  // diatonic triads of any mode, built by stacking thirds within its own scale
  function diatonic(root, mode) {
    var pc = pcOf(root); if (pc < 0) return [];
    var sc = spellScale(root, mode);                       // properly-spelled names
    var pcs = MODES[modeKey(mode)].map(function (s) { return (pc + s) % 12; }); // pcs from formula
    return sc.map(function (r, i) {
      var third = (((pcs[(i + 2) % 7] - pcs[i]) % 12) + 12) % 12;
      var fifth = (((pcs[(i + 4) % 7] - pcs[i]) % 12) + 12) % 12;
      var qq = triadQuality(third, fifth);
      var rn = (qq.t === 'min' || qq.t === 'dim') ? RN[i].toLowerCase() : RN[i];
      if (qq.t === 'dim') rn += '°'; else if (qq.t === 'aug') rn += '+';
      return { roman: rn, chord: r + qq.q, root: r, quality: qq.q };
    });
  }
  // split a chord token into its root note and its suffix (everything after the root)
  function chordParts(chord) {
    var m = /^([A-Ga-g][#b]?)(.*)$/.exec((chord || '').trim());
    if (!m) return null;
    return { root: norm(m[1].charAt(0).toUpperCase() + m[1].slice(1)), suffix: m[2] };
  }
  // quality from a chord suffix, for casing the numeral (m/dim -> lower, dim -> °, aug -> +)
  function suffixQuality(suffix) {
    var s = (suffix || '').toLowerCase();
    if (/^(dim|°|o)/.test(s) || /m7?b5|m7-5|ø/.test(s)) return 'dim';
    if (/^(aug|\+)/.test(s)) return 'aug';
    // a leading 'm' that isn't 'maj' means minor
    if (/^m(?!aj)/.test(s)) return 'min';
    return 'maj';
  }
  // chromatic-aware degree numerals: index by semitones above the tonic.
  // Non-diatonic degrees get a flat (bIII, bVII, ...); tritone reads as bV.
  var RN_CHROM = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  // Roman-numeral interval label for `chord` measured against `tonicChord`.
  // Works for ANY progression (diatonic or borrowed): the interval is the
  // semitone distance between roots; the chord's own quality cases the numeral.
  function romanFor(chord, tonicChord) {
    var c = chordParts(chord), t = chordParts(tonicChord);
    if (!c || !t) return '';
    var cp = pcOf(c.root), tp = pcOf(t.root);
    if (cp < 0 || tp < 0) return '';
    var iv = ((cp - tp) % 12 + 12) % 12;
    var rn = RN_CHROM[iv], q = suffixQuality(c.suffix);
    if (q === 'min' || q === 'dim') rn = rn.toLowerCase();
    if (q === 'dim') rn += '°'; else if (q === 'aug') rn += '+';
    return rn;
  }

  /* ---- SVG wheel renderer (browser only; node -c'd, eyeballed) ---- */
  var NS = 'http://www.w3.org/2000/svg';
  function polar(c, r, deg) { var a = (deg - 90) * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; }
  // annular sector (a wedge of a ring) from inner r1 to outer r2, angles a1..a2 (deg)
  function sector(c, r1, r2, a1, a2) {
    var o1 = polar(c, r2, a1), o2 = polar(c, r2, a2), i2 = polar(c, r1, a2), i1 = polar(c, r1, a1);
    return 'M' + o1[0] + ' ' + o1[1] + ' A' + r2 + ' ' + r2 + ' 0 0 1 ' + o2[0] + ' ' + o2[1] +
      ' L' + i2[0] + ' ' + i2[1] + ' A' + r1 + ' ' + r1 + ' 0 0 0 ' + i1[0] + ' ' + i1[1] + ' Z';
  }
  function renderWheel(opts) {
    opts = opts || {};
    var sel = opts.selected || {}, onPick = opts.onPick || function () {};
    var selRoot = sel.root ? norm(sel.root) : null, selMode = sel.mode || 'major';
    var size = 240, c = size / 2;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('class', 'cofWheel');
    var rings = [{ mode: 'major', r1: 74, r2: c - 5, lr: (74 + c - 5) / 2, suffix: '' },
                 { mode: 'minor', r1: 38, r2: 74, lr: (38 + 74) / 2, suffix: 'm' }];
    ORDER.forEach(function (root, i) {
      var a1 = i * 30 - 15, a2 = i * 30 + 15, lp;
      rings.forEach(function (ring) {
        var on = selRoot === root && selMode === ring.mode;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', sector(c, ring.r1, ring.r2, a1, a2));
        path.setAttribute('class', 'cofWedge' + (on ? ' on' : ''));
        path.addEventListener('click', function () { onPick(root, ring.mode); });
        svg.appendChild(path);
        lp = polar(c, ring.lr, i * 30);
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('x', lp[0].toFixed(1)); t.setAttribute('y', lp[1].toFixed(1));
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
        t.setAttribute('class', 'cofLabel' + (on ? ' on' : ''));
        t.style.pointerEvents = 'none';
        t.textContent = spellRoot(root, ring.mode) + ring.suffix; // major+minor each spelled in context
        svg.appendChild(t);
      });
    });
    var wrap = document.createElement('div'); wrap.className = 'cofWrap'; wrap.appendChild(svg);
    return wrap;
  }

  var Circle = {
    ORDER: ORDER,
    position: position,
    atPosition: atPosition,
    dominant: function (root) { return shift(root, 7); },     // a fifth up
    subdominant: function (root) { return shift(root, 5); },  // a fifth down
    relativeMinor: function (root) { return shift(root, -3); },
    relativeMajor: function (root) { return shift(root, 3); },
    // The keys worth exploring next, MODE-AWARE: a fifth up, a fifth down, and the
    // relative key — labelled in the right case for the current mode. Returns an
    // ordered array of { root, mode, why } so the panel renders them directly.
    neighbors: function (root, mode) {
      if (mode === 'minor') return [
        { root: shift(root, 7), mode: 'minor', why: 'a fifth up (the v)' },
        { root: shift(root, 5), mode: 'minor', why: 'a fifth down (the iv)' },
        { root: shift(root, 3), mode: 'major', why: 'its relative major' }
      ];
      return [
        { root: shift(root, 7), mode: 'major', why: 'a fifth up (the V)' },
        { root: shift(root, 5), mode: 'major', why: 'a fifth down (the IV)' },
        { root: shift(root, -3), mode: 'minor', why: 'its relative minor' }
      ];
    },
    diatonic: diatonic,
    romanFor: romanFor,
    MODE_STEPS: MODES,   // raw semitone steps per mode (single source for scale intervals)
    keyName: keyName,
    spellRoot: spellRoot,
    spellScale: spellScale,
    scale: scale,
    scaleDegrees: scaleDegrees,
    modeChange: modeChange,
    modeInfo: function (mode) { return MODE_INFO[modeKey(mode)]; },
    MODE_INFO: MODE_INFO,
    renderWheel: renderWheel
  };

  global.Circle = Circle;
  if (typeof module !== 'undefined' && module.exports) module.exports = Circle;

})(typeof window !== 'undefined' ? window : this);
