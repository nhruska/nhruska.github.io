/* =====================================================================
 * circle.js  -  circle-of-fifths theory engine + wheel renderer (shared)
 * ---------------------------------------------------------------------
 * The "spine" of the Backing Tracks surface (see backing-tracks/DESIGN.md):
 * keys are positions on the circle, chords are derived from it, neighbors
 * are adjacent. Pure music theory here (unit-tested in Node); the SVG wheel
 * renderer is added alongside.
 *
 * CANONICAL SHARP SPELLING throughout (matches Songbook.ROOTS and the sharp-named
 * chord packs: F#m, A#, ...). ONE spelling table app-wide - the ROOTS row indexed
 * by pitch class - so what the user picked is what every derived label shows:
 * D# stays D#, never Eb, across key, scale, chords-in-key, COF and fret notes.
 * Flats are normalized on INPUT (Bb -> A#); they never appear in output.
 * No build step. Exposes window.Circle, and require()-able in Node.
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
  // Case-insensitive: callers pass both 'minor' (repertoire-form) and 'Minor'
  // (songbook's songKey). The old exact-match lookup silently fell back to
  // IONIAN on a capitalized mode - a minor key deriving MAJOR chords.
  function modeKey(mode) {
    var m = String(mode || '').toLowerCase();
    m = ALIAS[m] || m;
    return MODES[m] ? m : 'ionian';
  }

  // ---- canonical note spelling (sharps only) ---------------------------------
  // ONE spelling table app-wide: the sharp ROOTS row, indexed by pitch class.
  // The key picker offers sharps only and every label is sharp-canonical
  // (voicing TABLES may key shapes under either spelling - the pack seam
  // resolves enharmonically), so every derived label echoes what the user picked -
  // D# stays D#, never Eb. Flat INPUT still normalizes (norm/F2S); flats just
  // never appear in output. (The old letter-per-degree/fewest-accidentals
  // speller chose Eb for D# mixolydian while the chord chips said A# - one key,
  // two names on the same screen. Retired by design: FORK-4, pilot UAT.)
  function spellScale(root, mode) {
    var pc = pcOf(root); if (pc < 0) return [];
    return MODES[modeKey(mode)].map(function (s) { return spell(pc + s); });
  }
  // mode no longer affects spelling; the arg is kept so call sites stay valid
  function spellRoot(root, mode) { var pc = pcOf(root); return pc < 0 ? root : spell(pc); }
  function keyName(root) { return spellRoot(root); }

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
        t.textContent = spellRoot(root, ring.mode) + ring.suffix; // canonical sharp name on both rings
        svg.appendChild(t);
      });
    });
    var wrap = document.createElement('div'); wrap.className = 'cofWrap'; wrap.appendChild(svg);
    return wrap;
  }

  // ---- S-BLUES: pentatonic + blues scales, SOLO LAYER ONLY -------------------
  // Zero surface in diatonic()/romanFor()/triadQuality() - these are consumed
  // exclusively by the Practice Studio's scale-swap chips (tracks.js), never by
  // harmonization (chords-in-key, buildWhy, whynote). formula = semitones from
  // the root; degrees use the SAME flat glyph (♭) as scaleDegrees() above.
  //
  // Regime A (NOW, [TRACKS-#98]): soloScale() spells every note through the
  // SAME spell() the rest of this module uses (FORK-4 canonical sharps) - one
  // provider, one seam. So the blue note (blues' formula[3], a flat 5th) comes
  // out SHARP-spelled like any other chromatic tone (e.g. A blues = A C D D# E
  // G) rather than key-aware-flattened. This is NOT special-cased here - doing
  // so would break the list==fretboard invariant every other scale/chord
  // surface on this screen already honors (see spellScale's header comment).
  //
  // Regime B (S-BLUES-B, post-#98, NOT built now): the pentatonic degrees would
  // spell key-aware via spellScaleKeyAware(root, parentMode), and the blue note
  // would spell as the key-aware 5th-degree LETTER flattened (b5 never #4).
  // soloScale() routes every name through this ONE internal provider call by
  // design, so that regime swap only needs to swap the provider inside
  // soloScale() once #98 lands spellScaleKeyAware/keyLabel - nothing else in
  // this file, or in tracks.js, needs to change.
  //
  // Subset proofs (asserted in test/solo-scales.test.js against MODE_STEPS):
  // pentMajor's formula is a subset of ionian/lydian/mixolydian; pentMinor's
  // formula is a subset of aeolian/dorian/phrygian.
  var SOLO_SCALES = {
    pentMajor: { label: 'Pent major', kind: 'pent', family: 'major', formula: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
    pentMinor: { label: 'Pent minor', kind: 'pent', family: 'minor', formula: [0, 3, 5, 7, 10], degrees: ['1', '♭3', '4', '5', '♭7'] },
    blues: { label: 'Blues', kind: 'blues', formula: [0, 3, 5, 6, 7, 10], degrees: ['1', '♭3', '4', '♭5', '5', '♭7'] }
  };
  // Names via spell() - see the regime comment above. Unknown root or unknown
  // scaleId -> [] (safe; never throws, matching pcOf/spellScale's own contract).
  function soloScale(root, scaleId) {
    var pc = pcOf(root), s = SOLO_SCALES[scaleId];
    if (pc < 0 || !s) return [];
    return s.formula.map(function (iv) { return spell(pc + iv); });
  }
  function soloScaleDegrees(scaleId) {
    var s = SOLO_SCALES[scaleId];
    return s ? s.degrees.slice() : [];
  }
  function soloScaleInfo(scaleId) { return SOLO_SCALES[scaleId] || null; }

  // ---- M-GUIDE W2: Blues as a HARMONIZING key model (I7/IV7/V7), distinct from
  // SOLO_SCALES.blues above (the 6-note solo scale). This is the palette-kind
  // entry mirroring the SOLO_SCALES block's shape/pattern: a registry + a pure
  // deriver, additive, zero surface in diatonic()/romanFor()/triadQuality().
  // Consumed by songbook.js's MODES.Blues (the strummable I7/IV7/V7 palette)
  // and the Practice Studio's chords-in-key row (tracks.js studioTheory).
  var BLUES_KEY = {
    label: 'Blues',
    degrees: [ { roman: 'I7', semis: 0 }, { roman: 'IV7', semis: 5 }, { roman: 'V7', semis: 7 } ],
    soloDefault: 'blues'
  };
  // bluesKey(root) -> [{roman:'I7', chord:'C7', root:'C', quality:'7'}, ...]. The
  // 7th is suffix-only (a dominant 7 on each of the three degrees) - unknown/
  // unresolvable root -> [] (matches soloScale/diatonic's own safe-empty contract).
  function bluesKey(root) {
    var pc = pcOf(root); if (pc < 0) return [];
    return BLUES_KEY.degrees.map(function (d) {
      var r = spell(pc + d.semis);
      return { roman: d.roman, chord: r + '7', root: r, quality: '7' };
    });
  }
  // chordTones(chord) -> pitch classes of the chord (triad + optional 7th), pure
  // pc arithmetic against the app's OWN suffixQuality vocabulary ('', m, dim, aug)
  // plus 7th detection: maj7 adds the major 7th (+11); any OTHER trailing 7
  // ('7', 'm7', 'm7b5', ...) adds the minor/dominant 7th (+10). Unknown suffixes
  // fall back to the bare triad rather than throwing - exported so Studio-side
  // chord-tone targeting (W3a) can intersect these against a scale's pcs.
  function chordTones(chord) {
    var p = chordParts(chord);
    if (!p) return [];
    var rpc = pcOf(p.root); if (rpc < 0) return [];
    var q = suffixQuality(p.suffix);
    var third = (q === 'min' || q === 'dim') ? 3 : 4;
    var fifth = (q === 'dim') ? 6 : (q === 'aug') ? 8 : 7;
    var pcs = [rpc, (rpc + third) % 12, (rpc + fifth) % 12];
    if (/maj7$/i.test(p.suffix)) pcs.push((rpc + 11) % 12);
    else if (/7$/.test(p.suffix)) pcs.push((rpc + 10) % 12);
    return pcs;
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
    renderWheel: renderWheel,
    // S-BLUES: solo-layer-only pentatonic/blues scales - see the block above.
    SOLO_SCALES: SOLO_SCALES,
    soloScale: soloScale,
    soloScaleDegrees: soloScaleDegrees,
    soloScaleInfo: soloScaleInfo,
    // M-GUIDE W2: Blues as a harmonizing key model (I7/IV7/V7) - see the block above.
    BLUES_KEY: BLUES_KEY,
    bluesKey: bluesKey,
    chordTones: chordTones
  };

  global.Circle = Circle;
  if (typeof module !== 'undefined' && module.exports) module.exports = Circle;

})(typeof window !== 'undefined' ? window : this);
