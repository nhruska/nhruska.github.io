/* =====================================================================
 * theory.js  -  instrument-agnostic music-theory primitives
 * ---------------------------------------------------------------------
 * The note / key / mode / diatonic / roman-numeral layer the songbook
 * engine builds on. Pure functions over the 12-tone system: chord parsing
 * and transposition, pitch-class math, the jam-mode set (Major / Minor /
 * Mixolydian / Dorian / Blues), in-key membership, mode-aware roman
 * numerals, and roman->chord realization. Scale INTERVALS are owned by
 * circle.js (Circle.MODE_STEPS); this module maps the jam-mode names onto
 * Circle and keeps the jam-specific presentation Circle doesn't model.
 *
 * No build step. Classic script. Exposes a single global: `SongbookTheory`.
 * songbook.js loads AFTER this file and rebinds these names as locals, so
 * every call site inside the engine stays unchanged.
 * ===================================================================== */
(function (global) {
  'use strict';
  /* ---------- music theory (instrument-agnostic) ---------- */
  var ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var F2S = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

  function splitChord(ch) {
    var m = ch.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return null;
    var r = m[1];
    if (F2S[r]) r = F2S[r];
    return { root: r, qual: m[2] || "" };
  }
  // Pitch class (0-11) of ANY note spelling: a letter plus any run of accidentals,
  // including the enharmonics our 12-name ROOTS table can't hold — E#, B#, Cb, Fb,
  // double sharps/flats. Lookup tables miss these and fall back to C (a wrong tone
  // on exotic diatonic chords like the vii° of F# major, E#dim). Returns null on junk.
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToPc(name) {
    var m = /^([A-Ga-g])([#bx]*)$/.exec((name || '').trim());
    if (!m) return null;
    var pc = LETTER_PC[m[1].toUpperCase()];
    for (var i = 0; i < m[2].length; i++) {
      var c = m[2][i];
      pc += (c === '#') ? 1 : (c === 'x') ? 2 : -1; // x = double sharp
    }
    return ((pc % 12) + 12) % 12;
  }
  function tpose(ch, st) {
    var p = splitChord(ch);
    if (!p) return ch;
    var i = ROOTS.indexOf(p.root);
    if (i < 0) return ch;
    return ROOTS[((i + st) % 12 + 12) % 12] + p.qual;
  }
  function tposeLine(raw, st) {
    return raw.replace(/\[([^\]]+)\]/g, function (_, c) { return "[" + tpose(c, st) + "]"; });
  }
  // root frequency of a chord, relative to middle C (used for the chord-chip tap tone).
  // Parse the root pitch class generically so exotic spellings (E#, B#, Cb, Fb) sound
  // the right note instead of falling back to C.
  function chordRootFreq(ch) {
    var m = /^([A-G][#bx]*)/.exec((ch || '').trim());
    var pc = m ? noteToPc(m[1]) : null;
    if (pc == null) return 261.63;
    return 261.63 * Math.pow(2, pc / 12);
  }

  /* ---------- keys / modes (the jam set) ----------
   * The scale INTERVALS (steps) are owned by circle.js (Circle.MODE_STEPS) so there's
   * one source of truth for them; we map our jam-mode names to circle's mode keys and
   * pull the steps from there. We keep, locally, the jam-specific presentation circle
   * doesn't model: the curated 4-mode SET, the display labels, and `quals` with the
   * diminished degree dropped from the strummable palette (kept in the solo scale).
   * If circle is somehow absent, the inline steps are an identical fallback. */
  var CIRCLE_MODE = { Major: "ionian", Minor: "aeolian", Mixolydian: "mixolydian", Dorian: "dorian" };
  // Blues is a PALETTE-KIND key model (I7/IV7/V7), not a 7-note
  // circle-of-fifths mode - it stays OUT of CIRCLE_MODE on purpose
  // (syncStepsFromCircle below only iterates CIRCLE_MODE's keys, so Blues.steps is
  // never overwritten by a nonexistent Circle.MODE_STEPS.blues). `romans` is a
  // Blues-only field (diatonic modes fall back to RN_UP in romanInKey below).
  var MODES = {
    Major:      { label: "Major",      steps: [0, 2, 4, 5, 7, 9, 11], quals: ["", "m", "m", "", "", "m", "dim"] },
    Minor:      { label: "Minor",      steps: [0, 2, 3, 5, 7, 8, 10], quals: ["m", "dim", "", "m", "m", "", ""] },
    Mixolydian: { label: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], quals: ["", "m", "dim", "", "m", "m", ""] },
    Dorian:     { label: "Dorian",     steps: [0, 2, 3, 5, 7, 9, 10], quals: ["m", "m", "", "", "m", "dim", ""] },
    Blues:      { label: "Blues",      steps: [0, 5, 7],             quals: ["7", "7", "7"], romans: ["I", "IV", "V"] }
  };
  (function syncStepsFromCircle() {
    var C = global.Circle;
    if (!C || !C.MODE_STEPS) return; // keep the inline fallback
    Object.keys(CIRCLE_MODE).forEach(function (name) {
      var s = C.MODE_STEPS[CIRCLE_MODE[name]];
      if (s && s.length === 7) MODES[name].steps = s.slice();
    });
  })();
  var MODE_HINT = {
    Major: "bright, resolved", Minor: "dark, moody",
    Mixolydian: "bluesy jam (Dead/Phish)", Dorian: "minor jam, hopeful",
    Blues: "12-bar swagger - three 7th chords"
  };
  function rootPc(root) { var i = ROOTS.indexOf(F2S[root] || root); return i < 0 ? null : i; }
  // diatonic chords in scale-degree order, diminished degrees dropped (rarely strummed
  // in these styles, and the chord pack can't voice them) — leaves the usable jam palette.
  function diatonicChords(root, modeKey) {
    var rp = rootPc(root), m = MODES[canonMode(modeKey)]; if (rp == null || !m) return [];
    var out = [];
    m.steps.forEach(function (s, i) {
      if (m.quals[i] === "dim") return;
      out.push(ROOTS[(rp + s) % 12] + m.quals[i]);
    });
    return out;
  }
  // Does `chord` belong to the key's usable in-key set? Its root must sit on a
  // scale degree AND its triad quality must match that degree's quality - a 7th
  // reduces to its triad (D7 counts as D in G major; Dm7 does not). Used to keep
  // the key-agnostic Markov suggestions honest when a key is set.
  // Suffix parsing mirrors Circle.suffixQuality: half-diminished (m7b5/ø) reduces
  // to dim; aug/+ maps to 'aug', which no mode's quals contain -> never diatonic.
  // HARMONIC-MINOR EXCEPTION: in Minor, the
  // degree-5 MAJOR triad and dominant 7th (A / A7 in D minor) are admitted -
  // i -> V(7) -> i is the default cadence of real minor-key songs; strict
  // natural-minor gating stripped the most-played chord from every minor key.
  // Vmaj7 stays out (not the harmonic-minor dominant).
  // Mode names are case-normalized: saved custom items carry lowercase modes
  // ('minor', per deriveProgressionKey's locked vocabulary) while songKey uses
  // capitalized keys - both must hit the same table (same trap class
  // Circle.modeKey already guards).
  var MODE_CANON = { major: 'Major', minor: 'Minor', mixolydian: 'Mixolydian', dorian: 'Dorian', blues: 'Blues' };
  function canonMode(modeKey) {
    return MODES[modeKey] ? modeKey : (MODE_CANON[String(modeKey || '').toLowerCase()] || modeKey);
  }
  function chordInKey(chord, root, modeKey) {
    var mk = canonMode(modeKey);
    var m = MODES[mk], rp = rootPc(root);
    var cm = /^([A-G][#b]?)(.*)$/.exec((chord || '').trim());
    if (!m || rp == null || !cm) return false;
    var cp = rootPc(cm[1]); if (cp == null) return false;
    var deg = m.steps.indexOf(((cp - rp) % 12 + 12) % 12);
    if (deg < 0) return false;
    var suf = cm[2].toLowerCase();
    var q = (/^(dim|°|o)/.test(suf) || /m7?b5|m7-5|ø/.test(suf)) ? 'dim'
      : /^(aug|\+)/.test(suf) ? 'aug'
      : /^m(?!aj)/.test(suf) ? 'm' : '';
    // BLUES palette degree (I7/IV7/V7, m.quals[deg] === '7'): in-key is the root as
    // a plain major triad OR its dominant 7th - deliberately no ii/dim/maj7/subs
    // (palette minimalism, see decisions.md: D-BLUES-KEY; "All" view is the escape hatch).
    if (m.quals[deg] === '7') return q === '' && (suf === '' || suf === '7');
    if (mk === 'Minor' && deg === 4 && q === '' && (suf === '' || /^7/.test(suf))) return true;
    return q === m.quals[deg];
  }
  // Mode-aware roman numeral for a chord in a KNOWN key: diatonic degrees get the
  // mode-correct numeral (III, VI, VII in minor - matching what the Studio's
  // Circle.diatonic labels), while non-diatonic/borrowed chords keep the
  // chromatic parallel-major label from Circle.romanFor (bVII in major, I for a
  // borrowed major tonic in minor). Without this, a Compose chip said "bIII" for
  // F in D minor while the Studio said "III" for the same chord
  // (see decisions.md: ROMAN-HYBRID).
  var RN_UP = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function romanInKey(chord, root, modeKey) {
    var mk = canonMode(modeKey);
    var m = MODES[mk];
    var cm = /^([A-G][#b]?)(.*)$/.exec((chord || '').trim());
    if (m && cm && chordInKey(chord, root, mk)) {
      var deg = m.steps.indexOf(((rootPc(cm[1]) - rootPc(root)) % 12 + 12) % 12);
      // Case by the CHORD's own quality, not the degree's natural quality: the
      // whitelisted harmonic-minor V is MAJOR on a degree whose natural triad is
      // minor - it must read 'V', not 'v'. For strictly-diatonic chords the two
      // qualities coincide, so this changes nothing else.
      var suf = cm[2].toLowerCase();
      var q = (/^(dim|°|o)/.test(suf) || /m7?b5|m7-5|ø/.test(suf)) ? 'dim'
        : /^m(?!aj)/.test(suf) ? 'm' : '';
      // m.romans (Blues only) overrides the generic 7-degree RN_UP table; every
      // other mode falls back to RN_UP unchanged.
      var romans = m.romans || RN_UP;
      var rn = (q === 'm' || q === 'dim') ? romans[deg].toLowerCase() : romans[deg];
      if (q === 'dim') return rn + '°';
      // BLUES palette degree: the dominant 7th IS the diagnostic label (I7/IV7/V7);
      // a plain triad on the same root reads the bare numeral (I/IV/V).
      if (m.quals[deg] === '7' && suf === '7') return rn + '7';
      return rn;
    }
    // browser: circle.js loaded before us sets global.Circle; Node tests: the UMD
    // `global` is this module's exports, so fall back to require.
    var C = global.Circle || (typeof module !== 'undefined' && typeof require === 'function' ? require('./circle.js') : null);
    return (C && C.romanFor) ? C.romanFor(chord, root) : '';
  }
  // The suggestion chip-row merge, pure and testable: filter the
  // Markov picks to the key (chordInKey; fall back to unfiltered when the
  // filter empties - a borrowed suggestion beats none), dedupe against the
  // progression-completing chords, float completions to the FRONT (their
  // accent glow must read first), cap at 5.
  //   picks: ranked Markov suggestions; completes: chord names that finish a
  //   famous progression; root/modeKey: the selected key (root null = no key).
  function mergeSuggestionRow(picks, completes, root, modeKey) {
    var row = (picks || []).slice();
    if (root) {
      var inKeyPicks = row.filter(function (c) { return chordInKey(c, root, modeKey); });
      if (inKeyPicks.length) row = inKeyPicks;
    }
    (completes || []).forEach(function (chord) {
      var i = row.indexOf(chord);
      if (i >= 0) row.splice(i, 1);
    });
    return (completes || []).concat(row).slice(0, 5);
  }
  // build a concrete chord list from 0-indexed scale degrees in a key (transposable).
  // Unlike diatonicChords this keeps EVERY degree (incl. the diminished vii°), so a
  // named progression maps degree->chord exactly: I-V-vi-IV in G -> G D Em C.
  function chordsFromDegrees(root, modeKey, degrees) {
    var rp = rootPc(root), m = MODES[canonMode(modeKey)]; if (rp == null || !m) return [];
    // Generalized over the mode's OWN degree count (7 for diatonic modes, 3 for
    // Blues' I7/IV7/V7 palette) instead of a hardcoded 7, so a 12-bar blues
    // starter's degrees [0,0,0,0,1,1,...] wrap mod 3, not mod 7.
    var len = m.steps.length;
    return degrees.map(function (deg) {
      var i = ((deg % len) + len) % len;
      return ROOTS[(rp + m.steps[i]) % 12] + m.quals[i];
    });
  }
  // ---- TEMPLATE-SUGGESTED SECTIONS: roman -> chord realization --------
  // Realize a roman-numeral token (SongTemplates.forSection's chromatic-roman
  // shape, e.g. 'I','vi','IV','bVII','i') into a canonical-sharp chord TOKEN in a
  // key, using the app's ONE degree-analysis path (Circle.romanFor) INVERTED by
  // search over the 12 roots - never a second speller (the ONE-path rule). The
  // roman's own casing/markers carry the quality (UPPER = major, lower = minor,
  // '°' = dim, '+' = aug); a leading flat ('bVII') is degree-lowering only, not a
  // quality. Returns null when NO root reproduces the roman under that quality (a
  // borrowed/secondary degree Circle can't place from a bare triad) so the caller
  // SKIPS the suggestion rather than approximating.
  function romanChordSuffix(roman) {
    var r = String(roman == null ? '' : roman).trim();
    if (!r) return null;
    if (/°|dim/i.test(r)) return 'dim';
    if (/\+|aug/i.test(r)) return 'aug';
    var base = r.replace(/^b+/i, '');   // strip the degree-lowering accidental
    if (/^[iv]/.test(base)) return 'm'; // lowercase numeral -> minor triad
    if (/^[IV]/.test(base)) return '';  // uppercase numeral -> major triad
    return null;                        // not a roman numeral we can quality-read
  }
  function realizeRoman(roman, keyRoot) {
    var C = global.Circle;
    if (!C || typeof C.romanFor !== 'function' || !keyRoot) return null;
    var target = String(roman == null ? '' : roman).trim();
    var suffix = romanChordSuffix(target);
    if (suffix == null) return null;
    for (var pc = 0; pc < 12; pc++) {
      var cand = ROOTS[pc] + suffix;
      if (C.romanFor(cand, keyRoot) === target) return cand; // TOKEN stays canonical-sharp
    }
    return null; // no root reproduces this roman under this quality -> skip
  }
  // Realize a whole roman pattern into chord tokens in a key. ALL-or-NOTHING: one
  // unrealizable roman skips the ENTIRE suggestion (never a half-approximated
  // progression). Returns null when any token fails or the input is empty.
  function realizeSection(romanArr, keyRoot) {
    if (!Array.isArray(romanArr) || !romanArr.length) return null;
    var out = [];
    for (var i = 0; i < romanArr.length; i++) {
      var tok = realizeRoman(romanArr[i], keyRoot);
      if (tok == null) return null;
      out.push(tok);
    }
    return out;
  }
  // Key-aware DISPLAY name for a canonical-sharp chord token inside a stated key
  // (the IV of F reads Bb, never A#) - the pure, key-parameterized twin of mount()'s
  // dispChordName, routed through Circle.noteInKey (the ONE display-naming path).
  // Keyless (no keyRoot) -> the token unchanged (canonical sharp), matching the
  // note-spelling regime-B contract for keyless contexts.
  function dispChordNameInKey(c, keyRoot, keyMode) {
    var C = global.Circle;
    if (!keyRoot || !C || !C.noteInKey) return c;
    var m = /^([A-Ga-g][#b]?)(.*)$/.exec(String(c == null ? '' : c).trim());
    if (!m) return c;
    return C.noteInKey(keyRoot, keyMode, m[1]) + m[2];
  }

  global.SongbookTheory = {
    ROOTS: ROOTS,
    F2S: F2S,
    LETTER_PC: LETTER_PC,
    CIRCLE_MODE: CIRCLE_MODE,
    MODES: MODES,
    MODE_HINT: MODE_HINT,
    MODE_CANON: MODE_CANON,
    RN_UP: RN_UP,
    splitChord: splitChord,
    noteToPc: noteToPc,
    tpose: tpose,
    tposeLine: tposeLine,
    chordRootFreq: chordRootFreq,
    rootPc: rootPc,
    diatonicChords: diatonicChords,
    canonMode: canonMode,
    chordInKey: chordInKey,
    romanInKey: romanInKey,
    mergeSuggestionRow: mergeSuggestionRow,
    chordsFromDegrees: chordsFromDegrees,
    romanChordSuffix: romanChordSuffix,
    realizeRoman: realizeRoman,
    realizeSection: realizeSection,
    dispChordNameInKey: dispChordNameInKey
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SongbookTheory;

})(typeof window !== 'undefined' ? window : this);
