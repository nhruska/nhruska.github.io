/* =====================================================================
 * songbook.js  -  instrument-agnostic songbook engine
 * ---------------------------------------------------------------------
 * Lifted out of the original ukulele app so any instrument tool (guitar,
 * mandolin, ...) can reuse the exact same songbook with zero duplication.
 *
 * The engine knows NOTHING about an instrument. It renders chord NAMES
 * (C, G, Am, F#m7, ...) which are identical across instruments. When an
 * OPTIONAL "chord pack" is supplied it delegates instrument-specific work
 * (fingering diagrams, audio, the Tune tab) to that pack. With no pack the
 * songbook still fully works  -  it just shows chord names with no diagrams
 * and no sound.
 *
 * Public API (see music/shared/README.md for the full contract):
 *   Songbook.mount(opts) -> controller
 *
 * No build step. Classic script. Exposes a single global: `Songbook`.
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
  // Blues is a PALETTE-KIND key model (I7/IV7/V7, m-guide-ia-20260704.md section 1),
  // not a 7-note circle-of-fifths mode - it stays OUT of CIRCLE_MODE on purpose
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
  // the key-agnostic Markov suggestions honest when a key is set (C4, pilot UAT).
  // Suffix parsing mirrors Circle.suffixQuality: half-diminished (m7b5/ø) reduces
  // to dim; aug/+ maps to 'aug', which no mode's quals contain -> never diatonic.
  // HARMONIC-MINOR EXCEPTION (owner ruling, volley-1 council D1): in Minor, the
  // degree-5 MAJOR triad and dominant 7th (A / A7 in D minor) are admitted -
  // i -> V(7) -> i is the default cadence of real minor-key songs; strict
  // natural-minor gating stripped the most-played chord from every minor key.
  // Vmaj7 stays out (not the harmonic-minor dominant).
  // Mode names are case-normalized: saved custom items carry lowercase modes
  // ('minor', per deriveProgressionKey's locked vocabulary) while songKey uses
  // capitalized keys - both must hit the same table (codex V2 medium; same trap
  // class Circle.modeKey already guards).
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
    // (D-BLUES-KEY minimalism; the "All" chord view is the escape hatch).
    if (m.quals[deg] === '7') return q === '' && (suf === '' || suf === '7');
    if (mk === 'Minor' && deg === 4 && q === '' && (suf === '' || /^7/.test(suf))) return true;
    return q === m.quals[deg];
  }
  // Mode-aware roman numeral for a chord in a KNOWN key: diatonic degrees get the
  // mode-correct numeral (III, VI, VII in minor - matching what the Studio's
  // Circle.diatonic labels), while non-diatonic/borrowed chords keep the
  // chromatic parallel-major label from Circle.romanFor (bVII in major, I for a
  // borrowed major tonic in minor). Without this, a Compose chip said "bIII" for
  // F in D minor while the Studio said "III" for the same chord (pilot UAT).
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
  // The suggestion chip-row merge, pure and testable (codex V3): filter the
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
  // ---- M-13 g1 TEMPLATE-SUGGESTED SECTIONS: roman -> chord realization --------
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
  // ADJACENT-SECTION FIT (UAT 2026-07-11): score how strongly a suggestion (its
  // FIRST roman) ARRIVES from the previous buffered section (its LAST roman), both
  // as romans in the SAME song key. The songwriting-coach cadence ladder: V->I
  // authentic (strongest arrival into the next section), IV->I plagal, vi->IV the
  // common step, a shared chord = smooth overlap. Degree-only (quality/accidental
  // stripped) - the connection is about scale-position motion, not chord colour.
  // Higher = better fit; 0 = no recognized connection. Pure + deterministic.
  var SECTION_CONNECT = { 'V>I': 4, 'IV>I': 3, 'VI>IV': 2 };
  function sectionConnectScore(prevLastRoman, firstRoman) {
    if (!prevLastRoman || !firstRoman) return 0;
    var p = String(prevLastRoman).replace(/[^IVXivx]/g, '').toUpperCase();
    var f = String(firstRoman).replace(/[^IVXivx]/g, '').toUpperCase();
    if (!p || !f) return 0;
    var s = SECTION_CONNECT[p + '>' + f];
    if (s != null) return s;
    return p === f ? 1 : 0; // shared chord across the seam = smooth overlap
  }
  // ---- M-13 g3 PERSONALIZED RANKING: nudge template suggestions by the
  // musician's OWN competency profile (music.competency.v1, competency.js) -
  // never a filter (pedagogy-coach: levels gate DEPTH, not access), only a
  // re-rank plus a one-line why-cue. A cheap deterministic complexity proxy:
  // distinct romans + altered/borrowed degrees (a leading 'b', a dim/aug
  // marker) - more distinct/altered chords reads as more "varied". Below the
  // SIMPLE threshold favors a comp-progressions level under 40 (early
  // players); at/above the VARIED threshold favors a level at/above it
  // (ready for more color). A matching PREFERENCE (keyword overlap between a
  // recorded preference statement and the suggestion's own family/citation
  // text) always wins the tag slot - an explicit personal signal outranks an
  // inferred skill nudge. No profile, or no signal either way, leaves every
  // suggestion untagged with zero boost - the ranking degrades byte-for-byte
  // to forSection/sectionConnectScore's own order (graceful absence).
  var COMPLEXITY_SIMPLE_MAX = 4, COMPLEXITY_VARIED_MIN = 6;
  var PREF_STOPWORDS = { the: 1, and: 1, uses: 1, use: 1, using: 1, with: 1, your: 1, for: 1, that: 1, this: 1, from: 1, into: 1, over: 1, when: 1 };
  function suggestionComplexity(romanArr) {
    var seen = {}, distinct = 0, altered = 0;
    (romanArr || []).forEach(function (r) {
      var key = String(r == null ? '' : r);
      if (!key) return;
      if (!seen[key]) { seen[key] = true; distinct++; }
      if (/^b/i.test(key) || /°|\+/.test(key)) altered++;
    });
    return distinct + altered;
  }
  function prefWords(statement) {
    return String(statement == null ? '' : statement).toLowerCase().split(/[^a-z]+/).filter(function (w) {
      return w.length >= 4 && !PREF_STOPWORDS[w];
    });
  }
  // First preference (in profile order) whose statement shares a significant
  // word with `text` (case-insensitive substring match) - null if none/absent.
  function matchedPreference(preferences, text) {
    if (!Array.isArray(preferences) || !preferences.length || !text) return null;
    var hay = String(text).toLowerCase();
    for (var i = 0; i < preferences.length; i++) {
      var words = prefWords(preferences[i] && preferences[i].statement);
      for (var j = 0; j < words.length; j++) {
        if (hay.indexOf(words[j]) >= 0) return preferences[i];
      }
    }
    return null;
  }
  // Mutates each suggestion with `_boost` (sort nudge, 0/1/2) + `_tag` (the
  // why-cue string, or null). `suggestions` entries carry `_complexity`
  // (from suggestionComplexity) and `_matchText` (the family/citation text a
  // preference can match against) already set by the caller. `profile` is a
  // competency.js profile object ({competencies, preferences}) or null/absent
  // (no stored data yet) - either way, a missing/incomplete profile is a
  // silent no-op, never a throw. Returns `suggestions` (mutated in place) for
  // convenient chaining/testing.
  function personalizeSuggestions(suggestions, profile) {
    var level = null;
    if (profile && Array.isArray(profile.competencies)) {
      for (var i = 0; i < profile.competencies.length; i++) {
        if (profile.competencies[i] && profile.competencies[i].id === 'comp-progressions') {
          level = profile.competencies[i].level; break;
        }
      }
    }
    var preferences = profile && profile.preferences;
    (suggestions || []).forEach(function (s) {
      s._boost = 0; s._tag = null;
      var pref = matchedPreference(preferences, s._matchText);
      if (pref) { s._boost = 2; s._tag = 'your style'; return; }
      if (typeof level !== 'number') return; // no usable level signal -> no nudge
      if (level < 40 && s._complexity <= COMPLEXITY_SIMPLE_MAX) { s._boost = 1; s._tag = 'easy fit'; }
      else if (level >= 40 && s._complexity >= COMPLEXITY_VARIED_MIN) { s._boost = 1; s._tag = 'adds variety'; }
    });
    return suggestions;
  }
  // MODAL INTERCHANGE core (Phase 2), extracted per m-guide-ia-20260704.md section 4.5 so
  // BOTH the explicit-key path (mount()'s convertToMode) and the keyless mode-change
  // handler share ONE mapping. PURE: no songKey mutation, no DOM - maps each chord's
  // ROOT against `targetMode`'s steps (offset from tonicRoot) to find its scale degree,
  // then re-qualifies to that degree's quality, re-basing any 7th-type extension that
  // survives the quality flip (major degree keeps maj7-ness, else collapses to a
  // dominant/minor 7; a dim degree keeps the bare dim triad). A chord whose root is NOT
  // a degree of the target mode (chromatic/borrowed) is left UNCHANGED (best-effort
  // rule, decision D3) - round-trip is not perfect for those chords (accepted).
  // `sourceMode` feeds the W2 blues-aware rules below (Major/Minor/Mixo/Dorian <->
  // Blues): converting INTO Blues collapses any palette-degree root to a dominant
  // 7th (baseQual === '7', regardless of the original extension); converting OUT
  // OF Blues (fromBlues guard) only re-qualifies a chord whose root sits on the
  // BLUES PALETTE (offsets 0/5/7 from tonicRoot, the professor-fold amendment
  // 8A - NOT "any target-mode degree") - anything else (a user-added secondary
  // like A7 over a C blues) is left byte-for-byte unchanged, and a bare dominant
  // 7th surviving from a palette root is treated as a plain triad before target
  // re-qualification (C7 -> C in Major, -> Cm in Minor); a surviving m7/maj7
  // keeps its own extension-class survival (not stripped).
  function convertProgressionQualities(chords, targetMode, tonicRoot, sourceMode) {
    // Canonicalize targetMode the SAME way sourceMode already is below (canonMode) -
    // callers outside the in-app UI (saved/custom items, the bridge payload) carry
    // the lowercase MODE_CANON vocabulary ('blues', 'major', ...); a bare MODES[targetMode]
    // lookup silently no-ops on those (codex finding, PR #115).
    var tm = canonMode(targetMode);
    var m = MODES[tm];
    if (!chords || !chords.length || !m) return chords ? chords.slice() : [];
    var tonicPc = tonicRoot != null ? rootPc(tonicRoot) : null;
    if (tonicPc == null) return chords.slice();
    var steps = m.steps, quals = m.quals;
    var fromBlues = canonMode(sourceMode) === 'Blues';
    return chords.map(function (c) {
      var p = splitChord(c);
      if (!p) return c;
      var rpc = rootPc(p.root);
      if (rpc == null) return c;
      var offset = ((rpc - tonicPc) % 12 + 12) % 12;
      // BLUES-SOURCE GUARD (professor fold 8A, supersedes the section-1 dom-7-strip
      // scope): a chord surviving FROM Blues only re-qualifies when its root sits on
      // the BLUES PALETTE (I7/IV7/V7 -> offsets 0,5,7 from the blues tonic) - not on
      // any degree the TARGET mode happens to have there. A user-added secondary
      // (A7 over a C blues) is not palette material; leave it fully unchanged.
      if (fromBlues && offset !== 0 && offset !== 5 && offset !== 7) return c;
      var i = steps.indexOf(offset);
      if (i < 0) return c; // chromatic root with no degree at this offset -> leave it
      var baseQual = quals[i]; // "" major triad, "m" minor, "dim" diminished, "7" blues dominant
      // Detect a trailing 7th-type extension on the ORIGINAL chord ("7","maj7","m7").
      var ext = "";
      if (/maj7$/.test(p.qual)) ext = "maj7-like";
      else if (/m7$/.test(p.qual)) ext = "min7-like";
      else if (/7$/.test(p.qual)) ext = "dom7-like";
      // dom-7-strip (fold 8A): a plain dominant 7th surviving from a Blues palette
      // root is treated as a bare triad before re-qualification; m7/maj7 keep their
      // own extension-class survival (handled by the branches below, untouched here).
      if (fromBlues && ext === "dom7-like") ext = "";
      var suffix;
      if (baseQual === "7") {
        // target degree IS a Blues palette root (I7/IV7/V7): the extension class
        // always collapses to the dominant 7th, regardless of what it was.
        suffix = "7";
      } else if (ext === "") {
        suffix = baseQual; // plain triad -> target triad quality
      } else if (baseQual === "dim") {
        suffix = "dim"; // keep the bare diminished triad on a dim degree
      } else if (baseQual === "m") {
        // minor degree: a 7th becomes a minor 7th (m7); a maj7 over a minor degree is
        // uncommon - normalize to m7 to keep the chord diatonic-feeling.
        suffix = "m7";
      } else { // baseQual === "" -> major degree
        // major degree: a maj7 stays maj7; a dominant/minor 7 becomes a dominant 7
        // (the usual major-degree 7th in these jam styles).
        suffix = (ext === "maj7-like") ? "maj7" : "7";
      }
      return p.root + suffix;
    });
  }
  // The canon — famous progressions, by 0-indexed major-scale degree. All diatonic
  // to MAJOR so they fill cleanly from any major key; modal/borrowed ones (Andalusian,
  // i-bVII-bVI) need a different derivation and are a deliberate follow-up. W2 adds
  // two mode-carrying Blues starters (degrees are 0-indexed into MODES.Blues' own
  // 3-entry palette: 0=I7, 1=IV7, 2=V7 - chordsFromDegrees' mod-3 generalization
  // above resolves them) - `mode` + `preview` are OPTIONAL fields the diatonic
  // entries above simply omit (loadProgression/renderSuggest default them).
  var PROGRESSIONS = [
    { name: "4-chord song",     degrees: [0, 4, 5, 3] }, // I  V  vi IV
    { name: "50s / doo-wop",    degrees: [0, 5, 3, 4] }, // I  vi IV V
    { name: "Pop / Axis",       degrees: [5, 3, 0, 4] }, // vi IV I  V
    { name: "Three-chord rock", degrees: [0, 3, 4] },    // I  IV V
    { name: "Jazz turnaround",  degrees: [1, 4, 0] },    // ii V  I
    { name: "Pachelbel",        degrees: [0, 4, 5, 2, 3, 0, 3, 4] }, // I V vi iii IV I IV V
    { name: "12-bar blues",       mode: "Blues", degrees: [0, 0, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2], preview: "I7 IV7 V7" },
    { name: "Quick-change blues", mode: "Blues", degrees: [0, 1, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2], preview: "I7 IV7 V7" }
  ];
  // D-CAP12 (m-guide-ia-20260704.md section 1): the Compose progression cap, raised
  // from 8 to fit the 12-bar starters above. ONE shared const replaces both the
  // addChord and renderProg `>= 8` gates so it can never drift between the two.
  var COMPOSE_MAX = 12;
  // S-PROG-WRAP-2 (UAT U8b, docs/plans/uat-walkthrough-20260704.md section U8b;
  // supersedes S-PROG-WRAP's pure width-driven binary full/compact split - see
  // D-PROG-WRAP, amended): a COUNT-driven staged density ladder, so a short
  // progression keeps generous full diagram cards instead of shrinking to
  // match however crowded a 12-chord strip would be. Three stages:
  //   'full'      1-4 chords  - diagram cards, one row, flex-grown to fill it
  //               (capped - "sane bounds" - never shrunk below their natural
  //               size; see the width guard below for what happens instead).
  //   'fill-row'  5-6 chords  - the existing compact chord token (suggChip:
  //               name + roman, no diagram), one row, equal columns sized to
  //               fill the strip.
  //   'grid6'     7-12 chords - the same compact token, but a FIXED 6-column
  //               grid, so 12 chords (the COMPOSE_MAX cap) is exactly two
  //               clean rows of 6 - never a 3rd orphan row, never horizontal
  //               scroll (the binary mode's failure shape: 11 chords used to
  //               flex-wrap as 5+5+1).
  // Measured width is still consulted, but ONLY as a GUARD for pathological
  // narrow viewports: if a stage's row would overflow the strip at its
  // chords' NATURAL minimum size (cardW for full, the compact token's own
  // CSS min-width for fill-row - TOKEN_MIN_W below, matching .suggChip's
  // min-width in songbook.css), demote ONE stage early (full -> fill-row ->
  // grid6) rather than let cards/tokens shrink below their floor - the guard
  // can cascade both demotions in a single call if the viewport is narrow
  // enough to overflow both. grid6 is the floor stage: no further demotion,
  // since there is nowhere lower to fall back to (accepted: at an extreme
  // viewport its columns may render under their comfortable minimum). Pure +
  // Node-testable, same contract shape as fitScale above: the DOM caller
  // (renderProg) measures cardW/gapW/availW for real and passes them in.
  // Every width-guard boundary is exclusive (an exact fit never demotes early)
  // and an unmeasured input (cardW/availW <= 0, e.g. before first layout)
  // never demotes - the count-driven candidate stands, matching the original
  // "missing measurement defaults safe" invariant.
  var TOKEN_MIN_W = 58; // .suggChip{min-width:58px} in songbook.css
  function progStripMode(count, cardW, gapW, availW, collapse) {
    if (count <= 0) return 'full';
    var stage = count <= 4 ? 'full' : count <= 6 ? 'fill-row' : 'grid6';
    // S-CHORD-COLLAPSE: at the ADVANCED guidance level the filmstrip never
    // shows full diagram cards - 1-4 chords take the SAME compact-token
    // stage 5-6 already use (the maximize overlay stays the shapes view).
    // A 5th positional param (not an opts object) keeps every existing
    // caller/test byte-compatible: undefined is falsy = the old ladder.
    if (collapse && stage === 'full') stage = 'fill-row';
    // unmeasured -> the WIDTH guards below never demote (the count/level-
    // driven candidate above, including the collapse demotion, still stands)
    if (cardW <= 0 || availW <= 0) return stage;
    if (stage === 'full') {
      var fullNeed = count * cardW + Math.max(0, count - 1) * gapW;
      if (fullNeed > availW) stage = 'fill-row';
    }
    if (stage === 'fill-row') {
      var tokenNeed = count * TOKEN_MIN_W + Math.max(0, count - 1) * gapW;
      if (tokenNeed > availW) stage = 'grid6';
    }
    return stage;
  }
  // 0-indexed MAJOR-scale degree of a chord in a key (-1 if its root isn't a scale
  // tone). Used to recognize a progression-in-progress against the canon.
  var MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  function degreeOf(chord, tonic) {
    var cm = /^([A-G][#bx]*)/.exec((chord || '').trim());
    var cp = cm ? noteToPc(cm[1]) : null, tp = rootPc(tonic);
    if (cp == null || tp == null) return -1;
    var iv = ((cp - tp) % 12 + 12) % 12;
    return MAJOR_STEPS.indexOf(iv); // -1 if chromatic (borrowed) chord
  }
  // Recognize the progression-so-far as the START of one or more canon progressions,
  // and return what each one's NEXT chord would be — the "completing" suggestion.
  // Returns [{ name, chord, degree }], the canon entries this progression is a strict
  // diatonic prefix of (longest-context first). Empty if no canon matches.
  function completions(progression, tonic, keyMode) {
    // Blues never auto-completes: degreeOf measures against the MAJOR-scale
    // canon (7 degrees), which is a category mismatch for the 3-degree Blues
    // palette - explicit pick or a Blues starter carries this key, never inference.
    if (canonMode(keyMode) === 'Blues') return [];
    if (!progression.length || !tonic) return [];
    var degs = progression.map(function (c) { return degreeOf(c, tonic); });
    if (degs.indexOf(-1) >= 0) return []; // a borrowed chord -> not a clean canon match
    var out = [];
    PROGRESSIONS.forEach(function (p) {
      // Mode-carrying starters (the W2 Blues entries) are explicit-only - their
      // degrees index into a 3-entry palette, not the 7-degree MAJOR_STEPS canon
      // this loop matches against, so a coincidental degree-index prefix match
      // (e.g. both starting on degree 0) would leak a Blues-derived "completion"
      // into a plain Major/Minor/Mixolydian/Dorian session (codex finding, PR #115).
      if (p.mode) return;
      if (p.degrees.length <= degs.length) return;        // nothing left to add
      var isPrefix = degs.every(function (d, i) { return d === p.degrees[i]; });
      if (!isPrefix) return;
      var nextDeg = p.degrees[degs.length];
      out.push({ name: p.name, degree: nextDeg, chord: chordsFromDegrees(tonic, keyMode || "Major", [nextDeg])[0] });
    });
    return out;
  }
  // AUTO-INFER a song key from the chords themselves (Compose sets it once 2+ chords
  // exist and the user never explicitly picked one). Pure: seq -> {root, mode} | null.
  // Every root x Major/Minor candidate is scored by how many of the progression's BASE
  // triads are diatonic to it (7th extensions stripped: Cmaj7/C7 count as C, Am7 as Am -
  // matching convertToMode's extension classes). Ties break toward the first chord's
  // root as tonic (the app's existing first-chord derivation), then Major, then the
  // first candidate in chromatic order (determinism). Needs at least 2 base triads to
  // fit or nothing is inferred - one matching chord is not a key.
  function baseTriad(ch) {
    var p = splitChord(ch);
    if (!p) return null;
    var q = p.qual;
    if (/maj7$/.test(q)) q = q.slice(0, -4);
    else if (/m7$/.test(q)) q = q.slice(0, -1);
    else if (/7$/.test(q)) q = q.slice(0, -1);
    return p.root + q;
  }
  function inferKey(seq) {
    if (!seq || seq.length < 2) return null;
    // Evidence is DISTINCT triads, not repetitions: ['C','C'] (or a I-I vamp)
    // is one chord, and one matching chord is not a key. A real I-V-I-V still
    // has two distinct triads and infers fine.
    var seen = {}, bases = [];
    seq.map(baseTriad).forEach(function (b) { if (b != null && !seen[b]) { seen[b] = true; bases.push(b); } });
    if (bases.length < 2) return null;
    var firstRoot = (splitChord(seq[0]) || {}).root || null;
    function tieRank(c) { return (c.root === firstRoot ? 2 : 0) + (c.mode === 'Major' ? 1 : 0); }
    var best = null;
    ROOTS.forEach(function (r) {
      ['Major', 'Minor'].forEach(function (mk) {
        var pal = {};
        chordsFromDegrees(r, mk, [0, 1, 2, 3, 4, 5, 6]).forEach(function (c) { pal[c] = true; });
        var score = 0;
        bases.forEach(function (b) { if (pal[b]) score++; });
        var cand = { root: r, mode: mk, score: score };
        if (!best || score > best.score || (score === best.score && tieRank(cand) > tieRank(best))) best = cand;
      });
    });
    return (best && best.score >= 2) ? { root: best.root, mode: best.mode } : null;
  }

  /* ---------- sheet rendering (chord-over-lyric, instrument-agnostic) ---------- */
  // Escape EVERYTHING interpolated into sheet/chip innerHTML: custom songs and
  // the localStorage import path accept freeform tokens, so chord names and
  // section labels are user-controlled strings, not trusted vocabulary. The
  // quote entity makes the same helper safe inside attribute values.
  // S-HARDEN (analysis-refactor-enhance-20260704 A5): delegates to the shared
  // esc.js (loaded before this file everywhere it's consumed) - was one of ~8
  // divergent local copies. Name kept (escHTML, not esc) - this file's ~19
  // call sites are unchanged.
  function escHTML(s) { return global.Esc.esc(s); }

  // S-UI-RECONCILE (Lane A, 2026-07-10): a view-local key-aware DISPLAY speller.
  // Given a stated key (canonical-sharp token) + mode it returns token->display,
  // routing chord ROOTS through Circle.noteInKey so the bVII of F reads Bb, never
  // A# - the same regime-B contract the Studio/Compose surfaces already honor.
  // The KEY it is given is already in the transposed domain (soloKeyFor moves the
  // key with STATE.transpose) and so are the TOKENS fed in (renderSheet tposes
  // before calling), so no second transpose happens here - both live in one
  // domain. Keyless progressions (no key, or Circle absent) fall back to the raw
  // token unchanged, matching the "keyless contexts stay canonical-sharp" rule.
  // The quality suffix (m7, dim, ...) is preserved verbatim; only the root respells.
  function chordSpeller(key, mode) {
    var C = global.Circle;
    if (!key || !C || !C.noteInKey) return function (tok) { return tok; };
    return function (tok) {
      var t = String(tok == null ? '' : tok);
      var m = /^([A-Ga-g][#b]?)(.*)$/.exec(t.trim());
      if (!m) return tok;
      try { return C.noteInKey(key, mode, m[1]) + m[2]; }
      catch (e) { return tok; }
    };
  }
  // `map` (optional) is a token->display speller from chordSpeller. When absent,
  // the raw (canonical-sharp) token renders - preserving every keyless caller's
  // behavior. Column alignment keys off the DISPLAYED label's length so a
  // respelled name (A# -> Bb, same width; and any exotic double-accidental) never
  // shifts the chord row off its lyric.
  function renderLyricLine(raw, map) {
    var chordRow = "", lyricRow = "", last = 0, m;
    var re = /\[([^\]]+)\]/g;
    while ((m = re.exec(raw))) {
      var before = raw.slice(last, m.index);
      var label = map ? map(m[1]) : m[1];
      lyricRow += before;
      chordRow += " ".repeat(before.length);
      chordRow += label;
      lyricRow += " ".repeat(label.length);
      last = re.lastIndex;
    }
    lyricRow += raw.slice(last);
    return '<div class="lyrLine"><span class="crd">' + escHTML(chordRow) + '</span>\n' + escHTML(lyricRow) + '</div>';
  }
  // S-UI-RECONCILE (Lane A): the action-ladder class for the song-view
  // remove/revert button. A real destructive delete is the `danger` primitive
  // (was mislabeled `.ghost`, the low-emphasis look); a fork's "Revert to
  // original" is NOT destructive of a user creation (it restores the catalog
  // song), so it keeps `ghost`. Both span the row via the `.full` class (Lane D:
  // `.actions .btn.full{flex-basis:100%}`) rather than an inline flexBasis style.
  // Pure + exported so the class contract has a real regression test.
  function deleteBtnClass(isFork) { return isFork ? 'btn ghost full' : 'btn danger full'; }
  function renderChordOnly(sheet, st, map) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var re = /\[([^\]]+)\]/g, m, cs = [];
      while ((m = re.exec(line))) cs.push(tpose(m[1], st));
      if (cs.length) out.push('<div class="chordOnly">' + cs.map(function (c) { return '<span class="bar">' + escHTML(map ? map(c) : c) + '</span>'; }).join(' ') + '</div>');
    });
    return out.join('');
  }
  // Lyrics with the [chord] tokens stripped - the sing-along view. Lines that
  // were pure chord calls (all tokens, no words) vanish rather than leaving
  // blank rows.
  function renderLyricsOnly(sheet) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var lyr = line.replace(/\[([^\]]+)\]/g, '').replace(/[ ]{2,}/g, ' ');
      if (lyr.trim().length) out.push('<div class="lyrLine">' + escHTML(lyr) + '</div>');
    });
    return out.join('');
  }
  // view: 'chords' = chord bars only; 'lyrics' = lyrics only (no chord row);
  // 'both' (default) = chords positioned over lyrics.
  function renderSheet(song, st, view, map) {
    if (view === 'chords') return renderChordOnly(song.sheet, st, map);
    if (view === 'lyrics') return renderLyricsOnly(song.sheet);
    var html = '', last = null;
    song.sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { html += '<div class="sect">' + escHTML(sect) + '</div>'; last = sect; }
      html += renderLyricLine(tposeLine(line, st), map);
    });
    return html;
  }
  // Stage/Perform auto-fit scale: shrinks the sheet until it fits BOTH the
  // available height AND width, or grows a short song up to a cap. Lyric lines
  // render with white-space:pre (no wrapping), so a height-only fit lets a
  // short song scale up past its own width and clip words off-screen - width
  // must always be allowed to win. Pure + Node-testable; DOM callers pass real
  // measurements (see applyPerfFont).
  function fitScale(availH, needH, availW, needW) {
    var heightScale = needH > 0 ? availH / needH : Infinity;
    var widthScale = needW > 0 ? availW / needW : Infinity;
    var scale = Math.min(heightScale, widthScale);
    if (!isFinite(scale)) scale = 1;
    return Math.max(0.5, Math.min(2.2, scale));
  }

  // Key/mode payload for the "Solo over it" Studio bridge - TRANSPOSE-AWARE on
  // both paths. An explicit record key moves with the current transpose (the
  // chords on screen are shifted, so the Studio must follow or the player
  // solos in the wrong key); an implicit one derives from the already-transposed
  // sequence the same way repertoire.js's Key facet does. Pure + Node-testable.
  function soloKeyFor(song, transposedSeq, st, Repertoire) {
    if (song && song.key && song.mode) {
      return { key: st ? tpose(song.key, st) : song.key, mode: song.mode };
    }
    var R = Repertoire || global.Repertoire;
    if (R && typeof R.deriveKey === 'function') return R.deriveKey({ seq: transposedSeq });
    return { key: null, mode: null };
  }

  // User-owned ("Mine") repertoire items: everything the user saved or added via
  // +Add / Save progression (custom flag; d:'Mine' is the same marker on records
  // persisted before the flag existed). Pure + Node-testable.
  function isMine(rec) { return !!(rec && (rec.custom || rec.d === 'Mine')); }
  // A chord-sheet item (has a chord sequence) vs a pure video-only track. Only
  // chord-sheet items can open the Practice screen or join a setlist/Stage - a
  // seq-less track would crash s.seq.map / render empty. Pure + Node-testable.
  function hasChordSheet(rec) { return !!(rec && Array.isArray(rec.seq) && rec.seq.length); }
  // S-SETADD-KEYSEED (operator burst 2026-07-12): the seed-chord TOKEN for a row
  // with a known key but no chord sheet - the key's tonic, canonical-sharp. `key`
  // normalizes through this module's own F2S map (same one-liner idiom rootPc()
  // uses below: "Eb" -> "D#"); 'm' is appended for every minor-family mode,
  // mirroring Repertoire.keyLabel's own minor test (min*/aeolian/dorian/phrygian/
  // locrian) WITHOUT its DISPLAY respell - tokens stay canonical-sharp per
  // music/CLAUDE.md note-spelling.md; only rendering (Repertoire.keyLabel, used
  // for the toast) respells. Pure + Node-testable.
  function keySeedToken(key, mode) {
    var root = F2S[key] || key;
    var m = String(mode || '').toLowerCase();
    var minor = m.indexOf('min') === 0 || /aeolian|dorian|phrygian|locrian/.test(m);
    return root + (minor ? 'm' : '');
  }
  // S-SETADD-KEYSEED: Library "+" affordance state for a repertoire row -
  // 'add' (chord sheet -> live +, joins the setlist as-is - S-SETADD unchanged),
  // 'seed' (no sheet but Repertoire.deriveKey resolves a key -> live + that
  // SEEDS one chord instead of a ghost), or 'blocked' (neither -> ghost +,
  // S-SETADD-EVIDENT's #249 reason/toast, unchanged). `hasSheet` is supplied by
  // the caller's own hasChordSheet(songById(sid)) check just above - a seq-less
  // CUSTOM track has an id too, so sid!=null alone can't decide (see
  // hasChordSheet's comment); this function only decides the fallback. Repertoire
  // is DI'd (soloKeyFor's own pattern above) so this stays Node-testable without
  // a browser global. Pure.
  function addAffordance(rec, hasSheet, Repertoire) {
    if (hasSheet) return 'add';
    var R = Repertoire || global.Repertoire;
    var k = (R && typeof R.deriveKey === 'function') ? R.deriveKey(rec || {}) : { key: null };
    return k.key ? 'seed' : 'blocked';
  }
  // Set of catalog ids shadowed by a fork: a custom item with forkOf="<catalogId>"
  // hides that catalog song (its edited copy takes its place). Pure + testable.
  function shadowedCatalogIds(customs) {
    var out = {};
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      // Only a well-formed catalog id (kN) shadows - honors the "catalog ids" contract
      // and ignores a malformed/foreign forkOf rather than hiding an arbitrary id.
      if (cs && cs.forkOf && /^k\d+$/.test(cs.forkOf)) out[cs.forkOf] = true;
    });
    return out;
  }
  // A composed custom's chord-only sheet (one "[C] [G] ..." progression line). Pure.
  // Label is "Verse", not "Progression" (operator UAT 2026-07-17): a saved
  // progression re-entered via Continue building must read as a STANDARD song
  // section - "Progression" isn't in the section set, so it rendered a blank
  // section dropdown and an off-vocabulary card label. A plain progression IS
  // the seed of a verse (the add-row's own default), so name it that from the
  // start. Legacy "Progression"-labeled sheets are mapped at parse time
  // (sectionsFromSheet) and self-heal on their next save.
  function buildSheetFromSeq(seq) {
    return [["Verse", (seq || []).map(function (c) { return "[" + c + "]"; }).join(" ")]];
  }
  // M-13 SONG BUILDER: assemble a section buffer (each {label, seq:[...]}) into
  // the { seq, sheet } shape a custom SONG stores. seq = first-appearance unique
  // chords across ALL sections (the song's chord set - what the Studio/solo reads);
  // sheet = one [label, "[C] [F] ..."] pair per section (the existing chord-only
  // renderer parses these bracket tags). Pure + Node-testable; mirrors
  // buildSheetFromSeq's single-line shape, one line per section.
  function buildSongFromSections(sections) {
    var seq = [], seen = {};
    var sheet = (Array.isArray(sections) ? sections : []).map(function (s) {
      var chords = (s && Array.isArray(s.seq)) ? s.seq : [];
      chords.forEach(function (c) { if (!seen[c]) { seen[c] = true; seq.push(c); } });
      return [String((s && s.label) || 'Section'), chords.map(function (c) { return "[" + c + "]"; }).join(" ")];
    });
    return { seq: seq, sheet: sheet };
  }
  // PURE core of rebuildAll: fold the catalog + customs into the merged ALLSONGS list.
  // Catalog songs get kN ids; a fork (forkOf=kN) SHADOWS its catalog original (omit it);
  // customs append with their sheet resolved (own sheet preferred -> a fork keeps the
  // catalog chords+lyrics verbatim; else a chord-only sheet from seq; else no sheet ->
  // a video-only track routes to the Studio, not a blank Practice screen). Extracted +
  // exported so the changed merge path has a real regression test (not DOM-coupled).
  function buildAllSongs(catalog, customs) {
    // Operator UAT 2026-07-17 ("rows disappear from my view instead of being
    // checked"): a fork now shadows its catalog original IN PLACE - the copy
    // takes the exact list position the original held, so the row the user is
    // looking at never teleports out from under their thumb. Non-fork customs
    // still append after the catalog block, unchanged.
    var byFork = {};
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      // Only a well-formed catalog id (kN) shadows - honors the "catalog ids"
      // contract and ignores a malformed/foreign forkOf.
      if (cs && cs.forkOf && /^k\d+$/.test(cs.forkOf)) byFork[cs.forkOf] = cs;
    });
    function resolveSheet(cs) {
      var withSheet = (cs.sheet && cs.sheet.length) ? {}
        : (cs.seq && cs.seq.length) ? { sheet: buildSheetFromSeq(cs.seq) } : {};
      return Object.assign({}, cs, withSheet);
    }
    var placed = {};
    var all = (Array.isArray(catalog) ? catalog : [])
      .map(function (s, i) { return Object.assign({}, s, { id: "k" + i }); })
      .map(function (s) {
        var f = byFork[s.id];
        if (!f) return s;
        placed[f.id] = true;
        return resolveSheet(f); // the fork sits exactly where its original sat
      });
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      if (cs && placed[cs.id]) return; // already holding its original's slot
      all.push(resolveSheet(cs));
    });
    return all;
  }
  // Match keys of the catalog songs a fork shadows - so their backing tracks get
  // suppressed too. A fork REPLACES its catalog song; without this, the generic backing
  // track that matched the original stays visible (and, once the fork is renamed, orphans
  // into a standalone row - the "fork + original track" duplicate). matchKeyFn is
  // Repertoire.matchKey (title+artist). Pure + Node-testable.
  function shadowedTrackKeys(catalog, customs, matchKeyFn) {
    var out = {};
    if (typeof matchKeyFn !== 'function') return out;
    var byId = {};
    (Array.isArray(catalog) ? catalog : []).forEach(function (s, i) { byId['k' + i] = s; });
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      if (cs && cs.forkOf && byId[cs.forkOf]) out[matchKeyFn(byId[cs.forkOf])] = true;
    });
    return out;
  }
  // Remap the setlist when a fork shadows/reverts its catalog original: replace EVERY
  // slot holding fromId with toId (fork create: kN->mN), or REMOVE every fromId slot
  // when toId is null (plain delete). Mutates in place (keeps the array ref the queue
  // holds) and returns whether anything changed. Pure + Node-testable.
  function remapSetlist(setlist, fromId, toId) {
    if (!Array.isArray(setlist)) return false;
    var changed = false;
    if (toId == null) {
      for (var i = setlist.length - 1; i >= 0; i--) {
        if (setlist[i] === fromId) { setlist.splice(i, 1); changed = true; }
      }
    } else {
      for (var j = 0; j < setlist.length; j++) {
        if (setlist[j] === fromId) { setlist[j] = toId; changed = true; }
      }
    }
    return changed;
  }
  // S-SET-INTEGRITY (UAT U22, load-heal): drop any setlist entry that no
  // longer resolves to a real song - e.g. a setlist persisted before the
  // delete-heal existed, or restored from an older backup taken pre-fix.
  // `resolves(id)` is the caller's lookup (mount()'s songById); kept
  // dependency-injected so this stays Node-testable without a real ALLSONGS.
  // Mutates `setlist` in place (same contract as remapSetlist above - keeps
  // the array reference the queue/STATE hold) and returns the number of
  // entries removed (0 = nothing to heal). This is a defensive READ-TIME
  // pass, not a StorageMigrate registration: a dangling ref is a data-
  // integrity gap that can in principle appear from ANY future bug or an
  // old restored backup, not a one-time shape change gated by a version
  // number - see decisions.md D-SET-INTEGRITY for the "why not a migration"
  // ruling. Pure + Node-testable.
  function pruneDanglingSetlist(setlist, resolves) {
    if (!Array.isArray(setlist) || typeof resolves !== 'function') return 0;
    var removed = 0;
    for (var i = setlist.length - 1; i >= 0; i--) {
      if (!resolves(setlist[i])) { setlist.splice(i, 1); removed++; }
    }
    return removed;
  }
  // A calm, static inline notice for the queue-nav position readout (Practice
  // AND Stage) when defensive nav (S-SET-INTEGRITY, UAT U22) had to step past
  // one or more dangling setlist entries via QUEUE.stepResolvable(). Pure +
  // Node-testable.
  function skipNoticeText(n) {
    return n + ' removed song' + (n === 1 ? '' : 's') + ' skipped';
  }
  // Which record the Studio (video + solo HUD) should open for a Repertoire row.
  // A custom item (incl. a FORK) owns its OWN video + id, so it opens as ITSELF -
  // never as a merged backing SEED track (rec._track), which would drop the user's
  // curated video / fork id. BUT custom SONGS store the name as t/a while the Studio
  // (Tracks.openStudio) reads title/artist - so normalize to the Studio shape (t->title,
  // a->artist) or the fork opens with a blank title. Mirrors the explicit descriptors
  // the other openStudioCb call sites build. A non-custom merged song opens the seed
  // track (its curated key/video is the intent there). Pure + Node-testable.
  function studioTarget(rec) {
    if (!rec) return rec;
    if (rec.custom) {
      // Preserve ALL of the custom/fork's fields (yt AND video, key, mode, id...) and
      // only ADD the title/artist the Studio reads (custom songs store them as t/a).
      // Hand-picking fields dropped rec.video, which the playability gate accepts.
      return Object.assign({}, rec, {
        title: rec.t != null ? rec.t : rec.title,
        artist: rec.a != null ? rec.a : rec.artist
      });
    }
    return rec._track || rec;
  }
  // Library filter = Repertoire.filter + the ownership ("Mine") facet. Ownership
  // is a SEPARATE flag (sel.mine), never a genre value, so a user/catalog genre
  // literally named "mine" filters as a genre and does NOT hijack the ownership
  // facet (matches isMine's "a genre named mine is not ownership" contract). Rep
  // is dependency-injected (same pattern as soloKeyFor) so Node tests pass the
  // real module.
  function libraryFilter(Rep, list, sel) {
    sel = sel || {};
    var mine = !!sel.mine;
    var base = Rep.filter(list, { q: sel.q, genre: sel.genre, key: sel.key });
    return mine ? base.filter(isMine) : base;
  }
  // Zero-results empty state for the Library list. When a key facet is active it
  // NAMES the key - the key chips can sit scrolled out of view, so "why is my
  // list empty" must be readable from the message itself - and clearKey tells
  // the DOM layer to offer the one-tap Any-key clearing link. Pure + Node-testable.
  function libraryEmptyState(sel) {
    var key = sel && sel.key && sel.key !== 'all' ? sel.key : null;
    return {
      message: key ? 'Nothing matches in ' + key + '.' : 'Nothing matches.',
      clearKey: !!key
    };
  }

  // M-GUIDANCE: guarded-reference to guidance-level.js (music.guidanceLevel.v1),
  // same pattern as tracks.js's circleRef()/soloGuideRef()/notablesRef() - a
  // browser global first, a Node require() fallback so songbook-firstrun.test.js
  // and any new guidance-consumer test share the SAME require-cache module
  // instance test/guidance-level.test.js exercises directly (not a duplicate).
  function guidanceLevelRef() {
    if (global.GuidanceLevel) return global.GuidanceLevel;
    if (typeof module !== 'undefined' && typeof require === 'function') {
      try { return require('./guidance-level.js'); } catch (e) { return null; }
    }
    return null;
  }

  // M-GUIDANCE trigger hook: same guarded-dispatch shape as diagram.js's
  // notifyRendered() (S-DIAGRAM-PREF step 1) - fires a lightweight, generic
  // signal so play/index.html can mount its own one-time JIT prompts
  // (tunefirst/composeintro/transposetip) without this generic engine
  // knowing anything about Notables, localStorage, or guidance levels.
  // Guarded: the Node test harness never stubs `window.dispatchEvent`/
  // `CustomEvent`, so this is a safe no-op there.
  function notifyGuidanceEvent(name, detail) {
    if (typeof global.dispatchEvent !== 'function' || typeof global.CustomEvent !== 'function') return;
    try { global.dispatchEvent(new global.CustomEvent(name, detail ? { detail: detail } : undefined)); } catch (e) { /* ignore */ }
  }

  // S-FIRSTRUN (sprint-1 item 4, F4): the fresh-profile Library guidance cue,
  // built on the one-shot Notables infra (music/shared/notables.js). Pure
  // decision fn, Node-testable without a DOM: given a Notables module (real or
  // stub), decide whether the 'firstrun' consumer should render on THIS call -
  // dependency-injected (Notables param) same pattern as libraryFilter's
  // injected Rep, so tests drive a real Notables instance directly. Returns
  // false without claiming if already dismissed (show-once); otherwise
  // attempts Notables.claim('firstrun') and returns whatever it grants.
  // M-GUIDANCE (retro-tagged 'beginner' in notables.js's LEVELS table): the
  // current guidance level is read internally via guidanceLevelRef() - never
  // added as a new argument here, so this stays a drop-in signature for the
  // one existing call site (renderFirstrunNotable, below).
  function firstrunShouldRender(Notables) {
    if (!Notables) return false;
    if (Notables.isDismissed('firstrun')) return false;
    var GL = guidanceLevelRef();
    var level = GL ? GL.get() : null;
    return Notables.claim('firstrun', undefined, level);
  }

  // M-GUIDANCE (beginner tier): "save/set basics after first song open" - a
  // one-shot JIT cue in the practice/song screen, teaching the setlist +
  // save mechanic. Pure decision fn, same dependency-injected shape as
  // firstrunShouldRender above (tests drive a real Notables instance).
  function savebasicsShouldRender(Notables) {
    if (!Notables) return false;
    if (Notables.isDismissed('savebasics')) return false;
    var GL = guidanceLevelRef();
    var level = GL ? GL.get() : null;
    return Notables.claim('savebasics', undefined, level);
  }

  // Transpose stepping WRAPS at the range ends instead of stopping (UAT item 9):
  // from +6 another + lands on -5 and keeps cycling, so repeated taps walk all
  // 12 keys forever. Values normalize into (-6, +6] (a value only matters mod 12
  // - tpose and the key readout are pitch-class based). Tries up to the 11 other
  // pitch classes in tap direction, skipping unplayable ones; null when nothing
  // else is playable (caller no-ops, matching the old stuck-at-end behavior).
  // Pure + Node-testable; `playable` is the caller's seqPlayable predicate.
  function nextTranspose(cur, dir, playable) {
    for (var n = 1; n <= 11; n++) {
      var cand = cur + dir * n;
      while (cand > 6) cand -= 12;
      while (cand <= -6) cand += 12;
      if (playable(cand)) return cand;
    }
    return null;
  }

  // YouTube search URL for a repertoire/song record - the query the ytSearch
  // action opens. Pure + Node-testable; shared by the list-item action ladder
  // and the song-view "Hear it on YouTube" link.
  function ytSearchURL(s) {
    // the 'search' placeholder is a data sentinel, never a real artist - keep it
    // out of the QUERY too, not just the display (codex #91: displayRec masked
    // it for rendering while the action ladder still passed the raw record).
    var artist = s.a || s.artist;
    if (artist === 'search') artist = '';
    // S-UI-RECONCILE (Lane A): the key part of the query reads the PREFERRED tonic
    // name (Bb key, not A# key) so the search matches how charts name the key.
    // The seq tokens further down stay canonical-sharp (identity for the search).
    var keyName = s.key;
    if (keyName && global.Circle && global.Circle.preferredTonicName) {
      keyName = global.Circle.preferredTonicName(s.key, s.mode || 'major');
    }
    var parts = [s.t || s.title, artist, keyName ? keyName + ' key' : ''];
    // custom songs (Compose saves) have no recording to find - fold genre +
    // chords so the search lands on something playable instead of title-only.
    if (s.custom && Array.isArray(s.seq)) {
      var toks = s.seq.map(function (c) { return String(c == null ? '' : c).trim(); }).filter(Boolean);
      if (s.genre) parts.push(s.genre);
      if (toks.length) parts.push(toks.join(' '));
    }
    var q = parts.filter(Boolean).join(' ');
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  // Movement-cancelled tap guard: fires fn only if a touch on `el` did NOT move
  // past the threshold (a tap, not a scroll-grab dragging over this button while
  // the thumb scrolls the setlist rail). Mouse clicks (no touch events) are
  // unaffected.
  // S-HARDEN (analysis-refactor-enhance-20260704 A4): this used to be a LOCAL
  // COPY of music/shared/list-item.js's wireTap() (the "future pass" this
  // comment used to defer). Now a thin delegate - the ONE implementation lives
  // in list-item.js, loaded before this file everywhere it's consumed
  // (play/index.html script order; test/songbook.test.js requires it first).
  // Name + export kept (wireTapCancel) so callers and the existing regression
  // suite (test/songbook.test.js) are untouched. Pure + Node-testable
  // (exported below).
  function wireTapCancel(el, fn) { return global.ListItem.wireTap(el, fn); }
  // S-CLEARGUARD (sprint-1 #1, A3 binding contract): pure snapshot build/apply
  // for the Compose Clear undo banner - extracted so the undo correctness
  // property (a snapshot is a fully INDEPENDENT copy, never aliased to the
  // live progression/songKey) is Node-testable without touching the DOM.
  // buildClearSnapshot captures progression + cTpose + songKey + the linked
  // saved-song id at the moment Clear is tapped; applyClearSnapshot hands
  // back an equally independent copy so a restore can never leak a live
  // reference back into the stored snapshot (which would let a later
  // mutation corrupt an already-consumed undo).
  function buildClearSnapshot(progression, cTpose, songKey, savedComposeId) {
    return {
      progression: progression.slice(),
      cTpose: cTpose,
      songKey: { root: songKey.root, mode: songKey.mode, explicit: songKey.explicit, defaulted: !!songKey.defaulted },
      savedComposeId: savedComposeId
    };
  }
  function applyClearSnapshot(snapshot) {
    return {
      progression: snapshot.progression.slice(),
      cTpose: snapshot.cTpose,
      songKey: { root: snapshot.songKey.root, mode: snapshot.songKey.mode, explicit: snapshot.songKey.explicit, defaulted: !!snapshot.songKey.defaulted },
      savedComposeId: snapshot.savedComposeId
    };
  }

  /* =====================================================================
   * Songbook.mount(opts)
   *
   * opts = {
   *   songs:        Array  -- the catalog (songs.json shape). Required.
   *   chordPack:    Object|null -- optional instrument pack (see README). Default null.
   *   storagePrefix: String -- localStorage namespace. Default "songbook".
   *   decades:      Array  -- decade filter chips. Default ["All","70s",...,"10s"].
   *   composeCats:  Object -- chord categories for the compose grid.
   *                          Default a chromatic Major/Minor/7th/Maj7/Min7 map.
   *   suggestions:  Object -- chord-progression suggestion map (chord -> [next...]).
   *   el: {  -- DOM element references (any subset; missing ones disable that feature)
   *     // library
   *     songsList, genreChips, keyChips, search, searchClear, libCount, addBtn,
   *     // practice
   *     practiceEmpty, practiceBody,
   *     // setlist
   *     setBody, setBar, setCount, setClear, performBtn,
   *     // perform
   *     perform, pSheet, pPos, pTitle, pArtist, pKeyLine,
   *     pPrev, pNext, pClose, pUp, pDown, pDimBtn,
   *     pSpeed, pCtrls,
   *     pFontDown, pFontAuto, pFontUp, pViewLyrics, pViewChords, pViewBoth,
   *     // compose (optional; needs a chord pack for diagrams/audio)
   *     prog, suggest, catChips, buildGrid, cClear, cSave, cMax, cTup, cTdown, keyChipSlot,
   *     // maximize overlay (chord pack diagrams)
   *     maxOv, maxGrid, maxClose,
   *     // context line (optional)
   *     ctxLine
   *   },
   *   contexts:     Object -- map tab name -> context line text (optional)
   * }
   *
   * Returns a controller: { switchTab, openSong, getState, getSongs, rebuild }
   * ===================================================================== */
  // M-GUIDE W3b (m-guide-ia-20260704.md section 3, "Compose solo chips"): the
  // Compose key-view solo-scale PREVIEW (wired inside mount()'s renderKeyView,
  // below) is a decoupled, non-persisted layer - chip taps re-derive ONLY that
  // block, never songKey/progression/palette/grid. Circle-only derivation
  // (Songbook stays Tracks-agnostic), so it works whether or not tracks.js/
  // solo-guide.js are loaded at all. Hoisted to module scope (rather than
  // nested inside mount()) so these pure helpers are directly Node-testable
  // and exportable on the public surface below, matching every other pure
  // helper in this file (chordInKey, romanInKey, convertProgressionQualities, ...).
  function keyViewCircle() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && typeof require === 'function') {
      try { return require('./circle.js'); } catch (e) { return null; }
    }
    return null;
  }
  // SoloGuide (W3a, shared/solo-guide.js) is optional - it ships in a sibling
  // wave whose merge order is free relative to this one. Absent module (not
  // yet merged, or the browser didn't load the script) -> no caption, chips
  // still work fully (locked seam guard, m-guide-ia-20260704.md section 3).
  function keyViewSoloGuide() {
    if (global.SoloGuide) return global.SoloGuide;
    if (typeof module !== 'undefined' && typeof require === 'function') {
      try { return require('./solo-guide.js'); } catch (e) { return null; }
    }
    return null;
  }
  // Pure + exported for tests: the note names for one chip. scaleId is one of
  // 'mode' | 'pentMajor' | 'pentMinor' | 'blues' | 'mixolydian'. 'mode' resolves
  // to the KEY's own scale - the 6-note blues scale when keyMode is Blues
  // (which is exactly why the Blues-key row dedupes the standalone Blues chip:
  // it would show the same notes under a second button), else the mode's
  // 7-note Circle scale via CIRCLE_MODE. 'mixolydian' (S-CHIPS-PLUS, P5 W3
  // verdict) is the chip that fills the freed 4th slot on a Blues key - the
  // dominant-scale option a player actually reaches for over I7-IV7-V7 - and
  // resolves via Circle.spellScale directly, independent of keyMode, so it's
  // callable the same way regardless of which key row a caller is testing.
  // Unresolvable root/Circle/mode -> null (caller keeps whatever was on-screen
  // rather than clearing it, matching soloScale's own contract).
  function soloChipScale(root, keyMode, scaleId) {
    var C = keyViewCircle();
    if (!C) return null;
    // FORK-4 removal: every note list is KEY-AWARE (letter-per-degree from the
    // preferred tonic name) with the legacy sharp fns as fallback - display
    // strings only; no token changes.
    var kmArg = canonMode(keyMode) === 'Minor' ? 'minor' : 'major';
    if (scaleId === 'pentMajor' || scaleId === 'pentMinor' || scaleId === 'blues') {
      var notes = C.soloScaleInKey ? C.soloScaleInKey(root, scaleId, kmArg) : C.soloScale(root, scaleId);
      return notes.length ? notes : null;
    }
    if (scaleId === 'mixolydian') {
      if (typeof C.spellScale !== 'function' && typeof C.scaleInKey !== 'function') return null;
      var mixNotes = C.scaleInKey ? C.scaleInKey(root, 'mixolydian') : C.spellScale(root, 'mixolydian');
      return mixNotes.length ? mixNotes : null;
    }
    var mk = canonMode(keyMode);
    if (mk === 'Blues') {
      var bluesNotes = C.soloScaleInKey ? C.soloScaleInKey(root, 'blues', 'major') : C.soloScale(root, 'blues');
      return bluesNotes.length ? bluesNotes : null;
    }
    var circleMode = CIRCLE_MODE[mk];
    if (!circleMode || (typeof C.spellScale !== 'function' && typeof C.scaleInKey !== 'function')) return null;
    var scaleNotes = C.scaleInKey ? C.scaleInKey(root, circleMode) : C.spellScale(root, circleMode);
    return scaleNotes.length ? scaleNotes : null;
  }
  // Pure + exported for tests (S-CHIPS-PLUS): the scale-degree glyphs for a
  // chip (e.g. ['1','2','3','4','5','6','♭7']), root-independent (degree
  // formulas don't depend on a root) - mirrors soloChipScale's own scaleId
  // routing exactly so a chip's notes and its degrees always describe the
  // SAME scale. Renders as the muted degrees line under the notes line (P5 W3
  // verdict: "how do these notes function", not just their names). Circle
  // absence, or an id neither this fn nor Circle recognizes -> null (caller
  // hides the degrees line rather than showing a stale one).
  function soloChipDegrees(keyMode, scaleId) {
    var C = keyViewCircle();
    if (!C) return null;
    if (scaleId === 'pentMajor' || scaleId === 'pentMinor' || scaleId === 'blues') {
      var d = (typeof C.soloScaleDegrees === 'function') ? C.soloScaleDegrees(scaleId) : [];
      return d.length ? d : null;
    }
    if (scaleId === 'mixolydian') {
      if (typeof C.scaleDegrees !== 'function') return null;
      var mixDeg = C.scaleDegrees('mixolydian');
      return mixDeg.length ? mixDeg : null;
    }
    var mk = canonMode(keyMode);
    if (mk === 'Blues') {
      var bluesDeg = (typeof C.soloScaleDegrees === 'function') ? C.soloScaleDegrees('blues') : [];
      return bluesDeg.length ? bluesDeg : null;
    }
    var circleMode = CIRCLE_MODE[mk];
    if (!circleMode || typeof C.scaleDegrees !== 'function') return null;
    var modeDeg = C.scaleDegrees(circleMode);
    return modeDeg.length ? modeDeg : null;
  }
  // Pure + exported for tests: the one-line teaching caption for a chip, or
  // null. 'mode' never captions (mirrors the Practice Studio, which never
  // captions its default/mode chip even when that scale happens to be Blues -
  // tracks.js wireScaleChips: `info = scaleId !== 'mode' ? ... : null`).
  // SoloGuide absence -> null, never throws (guarded contract above). `root`
  // (S-REL-NAMES, U23, optional 2nd arg) is the key-view's own key root -
  // names any {relMinor}/{relMajor} token in the framing text (e.g.
  // pentMajor's "same shape as {relMinor} pent"); absent root degrades to the
  // pre-S-REL-NAMES relationship-only wording, same as every existing caller.
  function soloChipCaption(scaleId, root) {
    if (scaleId === 'mode') return null;
    var SG = keyViewSoloGuide();
    if (!SG) return null;
    // S-CHIPS-PLUS: SoloGuide.framing() has no mixolydian branch (that table
    // is curated per-scaleId prose from the S-BLUES era) - its card()'s
    // chooseWhen already covers mixolydian and needs no {i} note
    // interpolation for that block, so it's "trivially reachable" per the P5
    // W3 verdict; guarded the same never-throws way as the framing() path.
    if (scaleId === 'mixolydian') {
      if (typeof SG.card !== 'function') return null;
      var mixCard = SG.card('mixolydian');
      return (mixCard && mixCard.chooseWhen) || null;
    }
    var C = keyViewCircle();
    if (!C || typeof SG.framing !== 'function') return null;
    var info = (typeof C.soloScaleInfo === 'function') ? C.soloScaleInfo(scaleId) : null;
    return SG.framing(scaleId, info && info.family, root) || null;
  }
  function mount(opts) {
    opts = opts || {};
    var el = opts.el || {};
    var pack = opts.chordPack || null;
    var prefix = opts.storagePrefix || "songbook";
    var PROFILE_ID = opts.profileId || null; // instrument profile id, carried onto the inversions deep-link
    // ---- M-COMPETENCY LZ (2026-07-11): evidence hooks. GUARDED - a no-op
    // until competency.js is wired into play/index.html + sw.js CORE (the
    // coupled parent merge step). The engine records what the musician DOES
    // (assembling a song, saving a progression, adding a section) against the
    // per-skill competency profile; nothing personal is stored in this repo -
    // the levels live only in the user's localStorage (music.competency.v1).
    function competencyRef() {
      if (global.Competency) return global.Competency;
      if (typeof module !== 'undefined' && module.exports) { try { return require('./competency.js'); } catch (e) {} }
      return null;
    }
    function recordComp(compId) {
      var C = competencyRef(); if (!C || !C.recordEvidence) return;
      try { C.recordEvidence('music-composition', compId); } catch (e) {}
    }
    // M-13 g3: the REAL stored profile for a skill, or null - never a
    // fabricated blank. getProfile() would hand back blankProfile (level 0
    // everywhere) even when the user has never touched competency at all, and
    // that would fabricate a "beginner" signal out of true absence. Reading
    // the raw stored map keeps "no profile" and "profile at level 0" distinct,
    // which is exactly what personalizeSuggestions' graceful-absence contract needs.
    function competencyProfile(skillId) {
      var C = competencyRef(); if (!C || typeof C.load !== 'function') return null;
      try { var map = C.load(); return (map && map[skillId]) || null; } catch (e) { return null; }
    }
    // Map the ACTIVE instrument profile to its repertoire competency; degrade
    // to the shared stringed-instrument chord-shapes when it isn't uke/guitar.
    function recordRepertoire() {
      var C = competencyRef(); if (!C || !C.recordEvidence) return;
      var p = String(PROFILE_ID || '').toLowerCase(), skill = 'stringed-instrument', comp = 'chord-shapes';
      if (p.indexOf('ukulele') === 0) { skill = 'ukulele'; comp = 'uke-repertoire'; }
      else if (p.indexOf('guitar') === 0) { skill = 'guitar'; comp = 'gtr-repertoire'; }
      try { C.recordEvidence(skill, comp); } catch (e) {}
    }
    // P3: seed the backing-track finder with the built key+mode (no-op if not wired).
    var seedBackingKey = opts.seedBackingKey || function () {};
    // M3: the repertoire merges songs.json with the backing-track catalog. getTracks()
    // supplies the (seed + URL overlay + custom) track list; openStudioCb(track) opens
    // the Practice Studio (solo scale + chords + circle) for a track or a composed key.
    var getTracks = opts.getTracks || function () { return []; };
    var openStudioCb = opts.openStudio || null;
    // M2: the unified Add/Edit form (repertoire-form.js) - one mounted overlay reused
    // for create + edit of custom ("Mine") songs/tracks. Absent (no-op guarded below)
    // if the script didn't load, so the rest of the app still works.
    var repForm = (global.RepertoireForm && global.RepertoireForm.mount) ? global.RepertoireForm.mount() : null;
    // ONE shared running-order queue — Studio, Campfire and Stage all read it,
    // so prev/next means the same song everywhere (Phase B: "queue works everywhere").
    var QUEUE = global.Queue.createQueue();
    var CONTEXTS = opts.contexts || {};
    // The all-chords build palette covers ALL 12 chromatic roots (the old default only
    // had the 7 naturals - no sharps/flats). For each category we map every ROOTS entry
    // to its chord, then make each one renderable: if a chord pack is present and lacks
    // the sharp shape, fall back to the enharmonic flat spelling, and omit only if
    // neither spelling is voiceable (no crash). With no pack, names always render so all
    // 12 stay. ROOTS uses sharp spelling (C# D# F# G# A#); S2F is the flat fallback.
    var S2F = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
    var CATS = opts.composeCats || (function () {
      var packHas = function (name) { return opts.chordPack && typeof opts.chordPack.hasChord === 'function' ? opts.chordPack.hasChord(name) : false; };
      var havePack = !!opts.chordPack;
      // pick a spelling the pack can voice: prefer the sharp ROOTS spelling, fall back to
      // the enharmonic flat, return null if neither is voiceable (then the chord is omitted).
      function spell(root, suffix) {
        var sharp = root + suffix;
        if (!havePack) return sharp;          // no pack -> names always render
        if (packHas(sharp)) return sharp;
        var flat = S2F[root] ? (S2F[root] + suffix) : null;
        if (flat && packHas(flat)) return flat;
        return null;                          // neither spelling voiceable -> omit
      }
      function cat(suffix) {
        var out = [];
        ROOTS.forEach(function (root) { var s = spell(root, suffix); if (s) out.push(s); });
        return out;
      }
      return { "Major": cat(""), "Minor": cat("m"), "7th": cat("7"), "Maj7": cat("maj7"), "Min7": cat("m7") };
    })();
    var SUGG = opts.suggestions || {};

    var CATALOG = (opts.songs || []).slice();

    /* ---- chord-pack capability helpers (graceful no-op if absent) ---- */
    function packHasChord(name) { return pack && typeof pack.hasChord === 'function' ? pack.hasChord(name) : false; }
    function packPlayChord(name) { if (pack && typeof pack.playChord === 'function') pack.playChord(name); }
    function packPlayNote(name) {
      if (pack && typeof pack.playNote === 'function') { pack.playNote(name); return; }
      if (pack && typeof pack.playFreq === 'function') { pack.playFreq(chordRootFreq(name), 1.1); }
    }
    // A transposition is "playable" if there is no chord pack (names always render),
    // OR the chord pack knows every chord at that transposition.
    function seqPlayable(seq, st) {
      if (!pack) return true;
      return (seq || []).every(function (c) { return packHasChord(tpose(c, st)); });
    }

    // A1 (analysis-refactor-enhance-20260704): the single write seam every save*
    // function below routes through. Mirrors backup.js's applyAtomic quota-detect
    // (same /quota|exceed/i test against e.name+e.message) but WITHOUT its multi-key
    // atomic-rollback machinery - a routine save is one key, so there is nothing to
    // roll back on failure (the prior value for that key is simply left in place,
    // since a throwing setItem never overwrote it). Returns true on a real write,
    // false if storage threw (quota exceeded, blocked/private-mode storage, etc.).
    // Callers decide whether a false return needs USER-visible feedback: saveProgression
    // (Compose "Saved to your Library", F23) does; the passive prefs/last-opened/song-view
    // writes fail soft (console signal only) per the app's #1 fatal-dismissal trigger
    // being an unconditional SUCCESS message on a save that silently didn't happen -
    // not the passive writes, which never claimed success to begin with.
    var _safeSetWarned = {}; // one console.warn per key for the life of this mount - a
    // blocked-storage device would otherwise spam the console on every keystroke-driven
    // passive save (e.g. the perform-speed slider firing savePerfPrefs repeatedly).
    function safeSet(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (e) {
        if (!_safeSetWarned[key]) {
          _safeSetWarned[key] = true;
          var quota = e && /quota|exceed/i.test(String(e.name) + String(e.message));
          console.warn('[songbook] storage write failed for ' + key + (quota ? ' (quota exceeded)' : '') + ' - further failures for this key are suppressed this session:', e);
        }
        return false;
      }
    }
    // A1/H4 shared failure message (analysis-refactor-enhance-20260704): the one
    // truthful "didn't actually save" message for any USER-INITIATED save whose
    // underlying safeSet() write failed. Shared by saveProgression's create/
    // update branches (D-SAVE-TRUTH) and toggleSet's setlist-add branch
    // (S-HARDEN H4) so the wording can't drift between the two.
    var SAVE_FAIL_MSG = "Couldn't save - storage is full or blocked. Export a backup from Settings.";

    /* ---------- custom (composed) progressions ---------- */
    var CUSTOM_KEY = prefix + ".custom.v1";
    function loadCustom() { try { var r = localStorage.getItem(CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveCustom() { return safeSet(CUSTOM_KEY, JSON.stringify(customSongs)); }
    var customSongs = loadCustom();
    // Fork-to-custom SHADOW + composed-custom append: the pure fold lives in the
    // module-scope buildAllSongs(catalog, customs) (exported + unit-tested). Deleting
    // a fork drops it from customs, so its catalog original reappears (revert).
    function rebuildAll() { ALLSONGS = buildAllSongs(CATALOG, customSongs); }
    var ALLSONGS = [];

    /* ---------- state + persistence ---------- */
    var STORE_KEY = prefix + ".setlist.v1";
    function loadSet() { try { var r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveSet() { return safeSet(STORE_KEY, JSON.stringify(STATE.setlist)); }
    // last-opened song, so the app can greet you already holding a song to play.
    var LAST_KEY = prefix + ".last.v1";
    function loadLast() { try { return localStorage.getItem(LAST_KEY) || null; } catch (e) { return null; } }
    // Passive (no user-visible confirmation anywhere it's called) - fails soft via
    // safeSet's console signal. See safeSet's header comment for the user-initiated
    // vs passive split this mission drew.
    function saveLast(id) { return safeSet(LAST_KEY, id); }
    // perform-screen prefs (scroll speed + view), remembered per device. Font
    // size is NOT persisted - Stage force-opens auto every time (UAT r3).
    // v2: view is the tri-state 'lyrics'|'chords'|'both'. v1's 'lyrics' rendered
    // chords-over-lyrics, which is now called 'both' - migrate it as such.
    var PERF_KEY = prefix + ".perfprefs.v2";
    var PERF_KEY_V1 = prefix + ".perfprefs.v1";
    function loadPerfPrefs() {
      try {
        var r = localStorage.getItem(PERF_KEY);
        if (r) return JSON.parse(r);
        var v1 = localStorage.getItem(PERF_KEY_V1);
        if (v1) { var p = JSON.parse(v1); if (p.view === 'lyrics') p.view = 'both'; return p; }
        return {};
      } catch (e) { return {}; }
    }
    // stageDefaultView = the PERSISTED Stage view preference. STATE.performView is
    // the CURRENT view, which a per-launch seed (song-view Stage) may transiently
    // override without changing the saved default - only an in-Stage view tap
    // (setPerformView) updates the default. Persisting STATE.performView instead
    // would let staging one custom song (forced 'chords') leak into every later
    // setlist Perform. (Assigned just after STATE is built, below.)
    var stageDefaultView;
    // NOTE: font size is intentionally NOT persisted - Stage force-defaults to
    // auto on every open (UAT r3), so a cross-reload size would be dead. Manual
    // A-/A+ still holds in STATE within a Stage session (across prev/next).
    // Passive - see safeSet's header comment (no per-slider-drag toast is wanted here).
    function savePerfPrefs() { return safeSet(PERF_KEY, JSON.stringify({ speed: STATE.scrollSpeed, view: stageDefaultView })); }
    var _pp = loadPerfPrefs();
    var STATE = {
      search: "", genre: "all", mineOnly: false, key: "all", current: null, transpose: 0, view: "lyrics",
      setEditMode: false, lastRemoved: null, // set-edit mode gates reorder/remove; lastRemoved enables undo
      setlist: [], performDim: false, performTpose: 0,
      performView: (_pp.view === 'chords' || _pp.view === 'lyrics' || _pp.view === 'both') ? _pp.view : 'both',
      fontMode: 'auto', // Stage always opens auto-fit (size not persisted; see savePerfPrefs)
      fontScale: 1, ctrlsOpen: false,
      scrolling: false, scrollSpeed: (typeof _pp.speed === 'number' ? _pp.speed : 28), scrollRAF: null, wakeLock: null,
      // S-SET-INTEGRITY (UAT U22): one-shot "N removed song(s) skipped" line,
      // set by navQueue()/pPrev/pNext right before a re-render whenever
      // QUEUE.stepResolvable() had to step past a dangling setlist ref; a nav
      // with nothing to skip clears it back to null. Never persisted.
      queueSkipNotice: null
    };
    STATE.setlist = loadSet();
    stageDefaultView = STATE.performView; // persisted Stage-view default (see savePerfPrefs above)
    function songById(id) { for (var i = 0; i < ALLSONGS.length; i++) if (ALLSONGS[i].id === id) return ALLSONGS[i]; return null; }

    /* ===================== LIBRARY (unified Repertoire; Set lives on the Jam tab) =====
     * The old Songs|Tracks split is dissolved: a song and its curated backing track
     * are ONE item in a single Repertoire (repertoire.js merges + dedups). The old
     * Repertoire|Set top toggle (#typeToggle) is retired too - the Set / Perform
     * surface is its own main tab now ("Jam", #s-jam), so the Library screen is
     * ALWAYS the repertoire: search + the Genre/Key facet chips over the merged
     * list. The finder tab is retired; its Practice Studio (solo scale + chords +
     * circle) stays reachable by tapping a playable item (openStudioCb), and
     * curation moves to +Add / per-item edit (M2). */

    /* ---- merged repertoire (songs.json + backing tracks, deduped) ---- */
    var REPERTOIRE = [];
    // getTracks() (from tracks.js) already applies the URL overlay + custom tracks.
    function buildRepertoire() {
      // Suppress the backing tracks of any catalog song a fork shadows, so a fork
      // REPLACES its original completely (no leftover generic track, and no orphaned
      // standalone track row once the fork is renamed).
      var suppress = shadowedTrackKeys(CATALOG, customSongs, global.Repertoire.matchKey);
      var tracks = getTracks();
      if (Object.keys(suppress).length) {
        // Suppress only the SEED/catalog backing track a fork shadows - NEVER a user's
        // own custom track that happens to share the title (that's their data, keep it).
        tracks = tracks.filter(function (t) { return t.custom || !suppress[global.Repertoire.matchKey(t)]; });
      }
      REPERTOIRE = global.Repertoire.build(ALLSONGS, tracks);
      return REPERTOIRE;
    }
    function chipBtn(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : '');
      b.textContent = label;
      b.onclick = fn;
      return b;
    }
    // Unified facet bar: Genre + Key chips derived from the current repertoire.
    // (Search is the text input; these replace the old decade chips.)
    function renderFilterChips() {
      buildRepertoire();
      // Heal a dead-end facet: deleting the last custom item while filtered to
      // Mine would drop the chip but leave the (now-invisible) filter active,
      // showing an empty Library with nothing selected.
      if (STATE.mineOnly && !REPERTOIRE.some(isMine)) STATE.mineOnly = false;
      if (el.genreChips) {
        el.genreChips.innerHTML = '';
        el.genreChips.appendChild(chipBtn('All genres', STATE.genre === 'all' && !STATE.mineOnly,
          function () { STATE.genre = 'all'; STATE.mineOnly = false; renderFilterChips(); renderSongs(); }));
        // Mine: the user's own saved/added items. An ownership facet pinned ahead
        // of the data-derived genres; shown only when a custom item exists (facet
        // chips reflect what is actually in the repertoire).
        if (REPERTOIRE.some(isMine)) {
          el.genreChips.appendChild(chipBtn('mine', STATE.mineOnly,
            function () { STATE.mineOnly = true; STATE.genre = 'all'; renderFilterChips(); renderSongs(); }));
        }
        global.Repertoire.genres(REPERTOIRE).forEach(function (g) {
          el.genreChips.appendChild(chipBtn(g, STATE.genre === g && !STATE.mineOnly,
            function () { STATE.genre = g; STATE.mineOnly = false; renderFilterChips(); renderSongs(); }));
        });
      }
      if (el.keyChips) {
        el.keyChips.innerHTML = '';
        el.keyChips.appendChild(chipBtn('Any key', STATE.key === 'all',
          function () { STATE.key = 'all'; renderFilterChips(); renderSongs(); }));
        global.Repertoire.keys(REPERTOIRE).forEach(function (k) {
          el.keyChips.appendChild(chipBtn(k, STATE.key === k,
            function () { STATE.key = k; renderFilterChips(); renderSongs(); }));
        });
      }
    }
    // Action-ladder fallback for an item with no curated video: find one on YouTube.
    function ytSearch(s) {
      window.open(ytSearchURL(s), '_blank', 'noopener');
    }
    // Where a repertoire tap lands (approach A): a chord sheet opens the song screen
    // (openPractice); a pure backing track opens the Practice Studio (solo scale +
    // chords + circle); otherwise a YouTube search.
    function openRepertoireItem(rec) {
      var p = global.Repertoire.playability(rec);
      if (p.sheet && rec.id != null && songById(rec.id)) { openPractice(rec.id); return; }
      if (openStudioCb && (p.studio || rec._track)) { openStudioCb(studioTarget(rec)); return; }
      ytSearch(rec);
    }
    // The ▶/↗ action button: a curated video opens the Studio (video + solo HUD);
    // otherwise it's a YouTube search for a backing track.
    function repertoireAction(rec) {
      if ((rec.yt || rec.video) && openStudioCb) { openStudioCb(studioTarget(rec)); return; }
      ytSearch(rec);
    }
    // Display-only record override shared by EVERY ListItem render site (library
    // + setlist - codex #91 caught the setlist rendering raw records):
    // - artist sentinel 'search' (tracks.json placeholder = "resolve via search")
    //   reads as a band literally named "search" -> show 'Unknown'.
    // - an artist-less Compose save would pair a blank artist with the year,
    //   printing a bare "· 2026" -> drop the year so no meta line renders.
    // The real record (navigation/actions/queries) is never mutated.
    function displayRecFor(rec) {
      var artistVal = rec.artist != null ? rec.artist : rec.a;
      if (artistVal === 'search') return Object.assign({}, rec, { artist: 'Unknown', a: 'Unknown' });
      if (!artistVal) return Object.assign({}, rec, { y: null, year: null });
      return rec;
    }
    // S-FIRSTRUN (F4): the fresh-profile Library cue - teaches BOTH "tap a song
    // to open it" and "the chord-count badge tells you the easy ones" in one
    // compact banner, above the song list (never on the search/chip filter
    // chrome renderFilterChips owns, so it survives the future M3 filter-bar
    // rework). renderSongs() calls this on every render; firstrunBannerEl
    // guards against re-inserting a duplicate node on re-renders (search
    // typing, chip taps, tab switches) once it's already showing. Once the x
    // dismisses it, Notables persists that forever and this stays a no-op.
    var firstrunBannerEl = null;
    function renderFirstrunNotable() {
      if (firstrunBannerEl || !el.libSongs || !el.songsList || !global.Notables) return;
      if (!firstrunShouldRender(global.Notables)) return; // dismissed, or slot held elsewhere - skip silently
      var banner = global.Notables.renderBanner({
        consumerId: 'firstrun',
        text: 'Your Library - pick songs here to build your setlist. A song with just a few chords (like 3) is the easiest place to start.',
        onDismiss: function () {
          if (firstrunBannerEl && firstrunBannerEl.parentNode) firstrunBannerEl.parentNode.removeChild(firstrunBannerEl);
          firstrunBannerEl = null;
        }
      });
      if (!banner) return; // no `document` available (Node without a DOM stub)
      firstrunBannerEl = banner;
      el.libSongs.insertBefore(banner, el.songsList);
    }
    function renderSongs() {
      if (!el.songsList) return;
      // Compose calling this right after a save happens while the Library
      // SCREEN is still hidden (display:none - the Compose tab is the one on
      // screen) - offsetParent goes null under a hidden ancestor (the same
      // visibility heuristic self-serve-execution's render-verify rule uses).
      // Only consume pendingHighlightId once the Library is ACTUALLY the
      // screen the user is looking at, or the highlight would fire-and-fade
      // invisibly and never be seen. Until then it just keeps waiting.
      var visible = !!el.songsList.offsetParent;
      renderFirstrunNotable();
      buildRepertoire();
      var filtered = libraryFilter(global.Repertoire, REPERTOIRE, { q: STATE.search, genre: STATE.genre, key: STATE.key, mine: STATE.mineOnly });
      if (filtered.length === 0) {
        var es = libraryEmptyState({ key: STATE.key });
        var box = document.createElement('div');
        box.className = 'empty';
        box.appendChild(document.createTextNode(es.message));
        if (es.clearKey) {
          var clr = document.createElement('button');
          clr.type = 'button';
          clr.className = 'emptyClear';
          clr.textContent = 'Search Any key';
          clr.onclick = function () { STATE.key = 'all'; renderFilterChips(); renderSongs(); };
          box.appendChild(clr);
        }
        el.songsList.innerHTML = '';
        el.songsList.appendChild(box);
        if (el.libCount) el.libCount.textContent = '';
        // do NOT consume here: a filtered/empty render never showed the row -
        // the highlight stays pending until the row actually appears (codex #91).
        return;
      }
      el.songsList.innerHTML = '';
      var justSavedEl = null;
      filtered.forEach(function (rec) {
        var sid = rec.id;
        // only chord-sheet items can join a setlist; a pure/video-only track (no
        // seq) can't - it would later crash s.seq.map in Perform. songById alone
        // is insufficient: a seq-less custom track has an id too.
        var hasSheet = sid != null && hasChordSheet(songById(sid));
        // S-SETADD-KEYSEED: a row with no sheet but a known key gets a LIVE + that
        // seeds one chord (below) instead of the S-SETADD-EVIDENT ghost - the
        // ghost is reserved for rows with NEITHER (addAffordance decides).
        var state = sid == null ? 'blocked' : addAffordance(rec, hasSheet);
        var canAdd = state !== 'blocked';
        var inSet = state === 'add' && STATE.setlist.indexOf(sid) >= 0;
        // SSOT: one shared renderer for every Repertoire / Set item (shared/list-item.js).
        var node = global.ListItem.render(displayRecFor(rec), {
          segment: 'library',
          inSet: inSet,
          onActivate: function () { openRepertoireItem(rec); },
          onAdd: state === 'add' ? function () { toggleSet(sid); }
            : state === 'seed' ? function () { seedKeyChordAndAdd(rec); }
            : null,
          // Operator UAT 2026-07-12: a silently missing + reads as broken ("feels
          // like something is broken"). The ghost + names the limitation at the
          // primitive; tapping teaches the fix path (add chords via edit). Only
          // rows with neither a sheet nor a key still get it (S-SETADD-EVIDENT #249).
          addBlockedReason: canAdd ? null : 'No chords yet - can\'t join a setlist',
          onAddBlocked: canAdd ? null : function () {
            showToast('No chords on this track yet - edit it and add a progression to use it in a setlist.');
          },
          onAction: function () { repertoireAction(rec); }
        });
        el.songsList.appendChild(node);
        if (pendingHighlightId != null && sid === pendingHighlightId) justSavedEl = node;
      });
      if (el.libCount) el.libCount.textContent = filtered.length + ' of ' + REPERTOIRE.length;
      // Post-save discoverability (B3 pilot UAT: "after saving, it's hidden near
      // the bottom of the library's song list") - scroll the new row into view
      // and give it a brief accent pulse (CSS handles the ~2s fade) so it's
      // findable without hunting a long list. Consumed ONLY when the row was
      // actually found and highlighted - a filtered/empty visible render keeps
      // the highlight pending for the render that really shows it (codex #91).
      if (visible && pendingHighlightId != null && justSavedEl) {
        // 'auto' (instant), not 'smooth': on Android a long smooth scroll can be
        // interrupted by re-layout (toast mount) and strand the viewport mid-list
        // - the follow contract needs a GUARANTEED landing on the row.
        if (typeof justSavedEl.scrollIntoView === 'function') justSavedEl.scrollIntoView({ block: 'center' });
        justSavedEl.classList.add('justSaved');
        pendingHighlightId = null;
      }
    }
    function syncSearchClear() { if (el.searchClear) el.searchClear.hidden = !el.search.value.length; }
    if (el.search) el.search.oninput = function () { STATE.search = el.search.value; syncSearchClear(); renderSongs(); };
    if (el.searchClear) el.searchClear.onclick = function () {
      el.search.value = ''; STATE.search = ''; syncSearchClear(); renderSongs(); el.search.focus();
    };

    /* ===================== SONG (views: Lyrics / Chords / Both + Stage) ===================== */
    // A song opens in one of three sheet views - Lyrics (sing-along), Chords
    // (campfire bars) or Both (chords over lyrics, the default) - picked via the
    // segmented control. Stage is a one-shot action - it launches the fullscreen
    // perform overlay over whichever view you're on, but is never persisted as the
    // default-open mode (otherwise every song-tap would trap you in fullscreen with
    // no way back to the chords).
    var SONGVIEW_KEY = prefix + ".songview.v1";
    var CHORDVIEW_KEY = prefix + ".chordsonly.v1"; // legacy 2-way toggle - migration source only
    function loadSongView() {
      try {
        var v = localStorage.getItem(SONGVIEW_KEY);
        if (v === 'lyrics' || v === 'chords' || v === 'both') return v;
        // legacy: chords-only '1' maps to Chords; the old Practice view was chords-over-lyrics = Both
        return localStorage.getItem(CHORDVIEW_KEY) === '1' ? 'chords' : 'both';
      } catch (e) { return 'both'; }
    }
    // Passive - see safeSet's header comment (a view-toggle tap doesn't need a toast).
    function saveSongView(v) { return safeSet(SONGVIEW_KEY, v); }
    STATE.songView = loadSongView();

    // open a song in the song screen. queueIds (optional) sets the running order:
    // opening from the Setlist passes the whole set so prev/next walks it; opening
    // a lone song from the Library passes nothing → a one-song (inactive) queue.
    var practiceOrigin = 'library'; // where the open song detail returns to on back
    function openPractice(id, queueIds) {
      // Operator UAT 2026-07-17: back from the song detail returns WHERE YOU
      // CAME FROM - setlist entries go back to the Setlist, library entries to
      // the Library (it always went to Library before). Capture the origin tab
      // at open time; queue-nav re-renders (openCurrent) never overwrite it.
      practiceOrigin = (currentTab === 'jam') ? 'jam' : 'library';
      if (queueIds && queueIds.length > 1 && queueIds.indexOf(id) >= 0) QUEUE.set(queueIds, queueIds.indexOf(id));
      else QUEUE.set([id]);
      STATE.queueSkipNotice = null; // fresh open - any stale notice from a prior practice session doesn't carry over
      openCurrent();
    }
    // render whatever the queue cursor points at
    function openCurrent() {
      var id = QUEUE.current();
      STATE.current = id ? songById(id) : null;
      STATE.transpose = 0;
      if (!STATE.current) return;
      saveLast(STATE.current.id);
      switchTab('practice');
      renderPractice();
    }
    // S-SET-INTEGRITY (UAT U22): queue-nav step that defends against a
    // dangling setlist ref (a set member deleted elsewhere) - steps past any
    // unresolvable entry via QUEUE.stepResolvable(songById) instead of
    // landing on it (which used to null out STATE.current and fall to the
    // "Choose a song from the Library" empty state - the U22 repro). Sets a
    // one-shot notice for renderPractice's queue-nav counter when anything
    // was actually skipped; clears it on a normal skip-free move.
    function navQueue(dir) {
      var r = QUEUE.stepResolvable(dir, songById);
      STATE.queueSkipNotice = r.skipped > 0 ? skipNoticeText(r.skipped) : null;
      openCurrent();
    }
    // After the setlist is edited (reorder/remove) keep the live queue tracking it,
    // so the queue is the running order rather than a snapshot taken at open time.
    // Only when an active queue is the setlist (the open song is still in the set).
    function syncQueueToSetlist() {
      if (!QUEUE.isActive() || !STATE.current) return;
      var at = STATE.setlist.indexOf(STATE.current.id);
      if (at < 0) return;
      QUEUE.set(STATE.setlist, at);
      renderPractice(); // refresh the queue-nav position (n / N) for the new order
    }
    function setMode(m) {
      // Stage performs the live queue from the current position (one-shot; not sticky).
      // Seed the overlay with the song view's transpose AND its Lyrics/Chords/Both
      // selection so Stage opens in the key AND view you were just practicing in,
      // not the original / a stale stage pref (UAT item 8 + the "over whichever
      // view you're on" contract above).
      // Seed the EFFECTIVE view: a chord-only custom is forced to chords, so seed
      // 'chords' rather than a raw Lyrics/Both songView that would (a) mislabel
      // this Stage and (b) persist the wrong performView for a later non-custom
      // Stage / setlist Perform. A FORK keeps the original's lyrics, so it is NOT
      // forced - it seeds the practiced Lyrics/Chords/Both view like a catalog song.
      if (m === 'stage') {
        if (!STATE.current) return;
        var seedView = (STATE.current.custom && !STATE.current.forkOf) ? 'chords' : STATE.songView;
        startPerform(QUEUE.isActive() ? QUEUE.ids() : [STATE.current.id], QUEUE.isActive() ? QUEUE.index() : 0, STATE.transpose, seedView);
        return;
      }
    }

    // M-GUIDANCE (beginner tier): one-shot "save/set basics" cue, prepended
    // above the song detail card - built via the shared Notables banner (same
    // accent-card + dismiss wiring firstrun/whynote reuse). Called at the end
    // of every renderPractice() (below): el.practiceBody's innerHTML is fully
    // rebuilt on every call (no incremental DOM patch to defend), so this just
    // re-attempts the claim each time - a no-op once dismissed, per the
    // notables.js contract. `bannerEl` is captured by the onDismiss closure so
    // the tap can remove the exact element it built, without a module-level
    // tracking variable (unlike firstrunBannerEl - practiceBody's whole
    // subtree is disposable on the next render anyway).
    function renderSaveBasicsNotable() {
      if (!el.practiceBody || !global.Notables) return;
      // UAT 2026-07-16 (operator: "guidance is misleading - I already have it
      // added to setlist"): don't nudge "save this to your setlist" for a song
      // that IS already in the setlist. The nudge teaches an action already taken.
      if (STATE.current && STATE.setlist.indexOf(STATE.current.id) >= 0) return;
      if (!savebasicsShouldRender(global.Notables)) return; // dismissed, wrong level, or slot held elsewhere - skip silently
      var bannerEl = global.Notables.renderBanner({
        consumerId: 'savebasics',
        text: 'Tap the + up top to save this song to your setlist, so it is easy to find again.',
        onDismiss: function () { if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl); }
      });
      if (!bannerEl) return; // no `document` available (Node without a DOM stub)
      var detail = el.practiceBody.querySelector('.detail');
      if (detail) detail.insertBefore(bannerEl, detail.firstChild);
    }

    function renderPractice() {
      if (!el.practiceBody) return;
      if (!STATE.current) {
        if (el.practiceEmpty) el.practiceEmpty.style.display = 'block';
        el.practiceBody.style.display = 'none';
        return;
      }
      var s = STATE.current;
      // A chord-less item (a pure custom track, or a song whose chords were cleared
      // via the Add/Edit form) is not a song-screen item - show the empty state
      // rather than throwing on s.seq.map.
      if (!s.seq || !s.seq.length) {
        if (el.practiceEmpty) el.practiceEmpty.style.display = 'block';
        el.practiceBody.style.display = 'none';
        return;
      }
      if (el.practiceEmpty) el.practiceEmpty.style.display = 'none';
      el.practiceBody.style.display = 'block';
      var seq = s.seq.map(function (c) { return tpose(c, STATE.transpose); });
      var inSet = STATE.setlist.indexOf(s.id) >= 0;
      // Composed customs are chord calls with no lyric text - Lyrics/Both would
      // render empty, so the view is pinned to Chords. A FORK of a catalog song
      // DOES carry lyrics (preserved sheet), so it respects the view choice like
      // a catalog song.
      var forcedChords = s.custom && !s.forkOf;
      var view = forcedChords ? 'chords' : STATE.songView;
      // header: icon-only back arrow (top-left, beside the title) + a compact
      // setlist checkmark toggle (top-right). The Stage (⛶) button in the view
      // row below is the single fullscreen/maximize control (t2 - the old ⤢
      // "Maximize chords" icon here was redundant with Stage and was removed).
      var head = '<div class="detailHead">'
        + '<button class="iconBtn" id="backLib" title="Back to ' + (practiceOrigin === 'jam' ? 'Setlist' : 'Library') + '" aria-label="Back to ' + (practiceOrigin === 'jam' ? 'Setlist' : 'Library') + '">←</button>'
        // Artist-mirrors-title fix (S5): a Compose-saved song stores an empty
        // artist (no hardcoded placeholder to duplicate the title) - omit the
        // ' · ' separator entirely rather than showing a leading, artist-less dot.
        + '<div class="ti"><h2>' + escHTML(s.t) + '</h2><p>' + (s.a ? escHTML(s.a) + ' · ' : '') + escHTML(s.y) + '</p></div>'
        + '<div class="headActions">'
        + '<button class="iconBtn setBtn' + (inSet ? ' on' : '') + '" id="setToggle" title="' + (inSet ? 'Remove from setlist' : 'Add to setlist') + '">' + (inSet ? '✓' : '+') + '</button>'
        + '</div></div>';
      // F28 (UI-std UAT): resolve the Solo entry point BEFORE the controls row is
      // built, so the button lives IN that row (beside modeSwitch/transpose/stage) -
      // directly above the chord content, not bolted on below the sheet where the
      // operator flagged it as "in the way when you don't need it, and not in the
      // right place when you do." "Solo over it" used to require s.custom (only
      // progressions built in Compose carried a key/mode). Any song can bridge to
      // the Studio if we can determine a key. Prefer the MERGED repertoire record:
      // Repertoire.build copies a matched backing track's authoritative key/mode
      // onto it, which beats re-deriving from the first chord (a non-tonic opener
      // would mislabel). Fall back to the raw record; soloKeyFor still derives from
      // the TRANSPOSED seq when neither has an explicit key, so soloing always
      // matches what's on screen.
      var mergedRec = null;
      for (var ri = 0; ri < REPERTOIRE.length; ri++) { if (REPERTOIRE[ri].id === s.id) { mergedRec = REPERTOIRE[ri]; break; } }
      var soloKey = soloKeyFor((mergedRec && mergedRec.key && mergedRec.mode) ? mergedRec : s, seq, STATE.transpose);
      var canSolo = typeof openStudioCb === 'function' && !!(soloKey.key && soloKey.mode);
      // S-UI-RECONCILE (Lane A): key-aware display speller for every chord NAME on
      // this song screen (chip row, transpose readout, campfire sheet). soloKey is
      // already transpose-adjusted and `seq` is already transposed, so this maps
      // transposed-token -> transposed-key display name (F song at +2 spells in G).
      // Falls back to the raw token when the progression is keyless. Chord TOKENS
      // (data-c, play/audio, storage) stay canonical-sharp - only labels respell.
      var dispMap = chordSpeller(soloKey.key, soloKey.mode);
      // Compact label ("Solo"; the title attr carries the full phrase) so it fits
      // the SAME row as modeSwitch/transposeChip/stageGo at 375-412px - mirrors
      // Compose's #chordCtrlRow treatment on the other surface (songbook.css
      // .soloRowBtn). Entirely absent (not just disabled) when canSolo is false -
      // no dead tap, no row filler.
      var soloRowBtn = canSolo ? '<button class="btn soloRowBtn" id="soloOverBtn" title="Solo over it - open the Practice Studio">Solo</button>' : '';
      // view row: Lyrics / Chords / Both segmented + compact transpose chip +
      // a compact Stage (fullscreen) icon button + (F28) the Solo entry point, all
      // on ONE row (UAT round 2 locked decision - replaces the full-width Stage
      // CTA; F28 UAT folds Solo into the same row instead of a separate CTA below).
      function segBtn(v, lbl) {
        var dis = forcedChords && v !== 'chords';
        return '<button data-v="' + v + '" class="' + (view === v ? 'on' : '') + '"'
          + (dis ? ' disabled' : '') + ' aria-pressed="' + (view === v ? 'true' : 'false') + '">' + lbl + '</button>';
      }
      var switcher = '<div class="practiceRow">'
        + '<div class="modeSwitch">' + segBtn('lyrics', 'Lyrics') + segBtn('chords', 'Chords') + segBtn('both', 'Both') + '</div>'
        + '<div class="transposeChip"><button id="tDown" title="Transpose down">−</button><span class="v" id="keyV">' + escHTML(dispMap(seq[0])) + '</span><button id="tUp" title="Transpose up">+</button></div>'
        + '<button class="iconBtn stageGo" id="stageBtn" title="Stage: perform fullscreen" aria-label="Stage: perform fullscreen"><span aria-hidden="true">⛶</span></button>'
        + soloRowBtn
        + '</div>';
      // queue nav — only when a real running order (the setlist) is loaded.
      // S-SET-INTEGRITY (UAT U22): the position readout appends the one-shot
      // skip notice (see navQueue()) so a defended-against dangling ref is
      // visible, not silent - "N / M" always reflects LIVE (resolvable)
      // entries because load-heal + delete-heal keep QUEUE's own list clean.
      var queueNav = QUEUE.isActive() ? '<div class="queueNav">'
        + '<button id="qPrev" ' + (QUEUE.atStart() ? 'disabled' : '') + '>‹ Prev</button>'
        + '<span class="qPos">' + (QUEUE.index() + 1) + ' / ' + QUEUE.size()
        + (STATE.queueSkipNotice ? ' - ' + escHTML(STATE.queueSkipNotice) : '') + '</span>'
        + '<button id="qNext" ' + (QUEUE.atEnd() ? 'disabled' : '') + '>Next ›</button></div>' : '';
      var chips = '<div class="chordChips">' + seq.map(function (c) { return '<span class="c" data-c="' + escHTML(c) + '">' + escHTML(dispMap(c)) + '</span>'; }).join('') + '</div>';
      // F28: the Solo button now lives in the practiceRow controls row above (the
      // canSolo gate is unchanged) - .actions stays as the Edit/Delete/fork-revert
      // action-ladder host appended further down for custom/catalog songs.
      var actions = '<div class="actions"></div>';
      // Hear the real recording: same YouTube search the list-item action ladder
      // uses (item 5, UAT round 2) - present in BOTH views (it's about the ear,
      // not the sheet). The MERGED record feeds the query so track-derived
      // fields (key etc.) match what the ladder builds from.
      var ytLink = '<a class="lyricsLink" href="' + ytSearchURL(mergedRec || s) + '" target="_blank" rel="noopener">Hear on YouTube ↗</a>';
      var body;
      if (view === 'chords') {
        body = chips
          + '<div class="sheet campfireSheet" id="sheetBox">' + renderSheet(s, STATE.transpose, 'chords', dispMap) + '</div>'
          + actions
          + '<div class="lyricsLinks">' + ytLink + '</div>';
      } else {
        var lyricsURL = "https://genius.com/search?q=" + encodeURIComponent(s.t + " " + s.a);
        var geniusLink = '<a class="lyricsLink" href="' + lyricsURL + '" target="_blank" rel="noopener">Full lyrics on Genius ↗</a>';
        body = chips
          + '<div class="sheet" id="sheetBox">' + renderSheet(s, STATE.transpose, view, dispMap) + '</div>'
          + actions
          // Both secondary links on ONE row (t3) - Hear-on-YouTube + Full-lyrics-on-Genius.
          + '<div class="lyricsLinks">' + ytLink + geniusLink + '</div>'
          + '<p class="note">Sheet shows a short representative snippet. Full lyrics open on a licensed site.</p>';
      }
      el.practiceBody.innerHTML = '<div class="detail">' + head + switcher + queueNav + body + '</div>';
      renderSaveBasicsNotable(); // M-GUIDANCE: one-shot beginner cue, prepended above the card
      var qPrev = el.practiceBody.querySelector('#qPrev'); if (qPrev) qPrev.onclick = function () { navQueue(-1); };
      var qNext = el.practiceBody.querySelector('#qNext'); if (qNext) qNext.onclick = function () { navQueue(1); };
      el.practiceBody.querySelectorAll('.modeSwitch button').forEach(function (b) {
        b.onclick = function () { if (b.disabled) return; STATE.songView = b.dataset.v; saveSongView(STATE.songView); renderPractice(); };
      });
      var stageBtn = el.practiceBody.querySelector('#stageBtn'); if (stageBtn) stageBtn.onclick = function () { setMode('stage'); };
      el.practiceBody.querySelector('#tDown').onclick = function () { shiftKey(-1); };
      el.practiceBody.querySelector('#tUp').onclick = function () { shiftKey(1); };
      el.practiceBody.querySelectorAll('.chordChips .c').forEach(function (elc) { elc.onclick = function () { packPlayChord(elc.dataset.c); }; });
      el.practiceBody.querySelector('#setToggle').onclick = function () { toggleSet(s.id); renderPractice(); renderSongs(); renderSetlist(); };
      el.practiceBody.querySelector('#backLib').onclick = function () { switchTab(practiceOrigin || 'library'); };
      var soloOver = el.practiceBody.querySelector('#soloOverBtn');
      if (soloOver) soloOver.onclick = function () {
        var csv = customById(s.id);
        // Re-resolve the merged record at CLICK time: the tracks catalog loads
        // async, so the merged key/mode (and its curated video) may not have
        // existed when this view rendered - a fast Solo tap must not be stuck
        // with the render-time snapshot.
        var mr = null;
        for (var mi = 0; mi < REPERTOIRE.length; mi++) { if (REPERTOIRE[mi].id === s.id) { mr = REPERTOIRE[mi]; break; } }
        var sk = soloKeyFor((mr && mr.key && mr.mode) ? mr : s, seq, STATE.transpose);
        // Locked interface: no `custom:true` for a catalog song (it isn't a saved
        // custom item, so there's nothing for the Studio's "Edit this track" link
        // to look up). Custom songs keep the exact payload shape they always had.
        // Deliberately NO merged-record yt here: openStudio rehydrates url-less
        // payloads by trackKey and sets ytSource alongside yt - passing mr.yt
        // directly would skip that and lose the overlay Clear button.
        var payload = { id: s.id, title: s.t, artist: s.a, key: sk.key, mode: sk.mode, yt: (csv && csv.yt) || s.yt || null };
        if (s.custom) payload.custom = true;
        openStudioCb(payload);
      };
      var act = el.practiceBody.querySelector('.actions');
      if (act && s.custom) {
        var isFork = !!s.forkOf;
        // S-SONG-MODE Phase B: back into the builder - the sheet parses to
        // sections, the Song canvas reopens, and Save updates THIS song in
        // place. Only offered when the sheet actually yields sections (a
        // track-only custom has nothing to build from).
        if (sectionsFromSheet(s.sheet).length) {
          var cb = document.createElement('button');
          cb.className = 'btn'; cb.textContent = 'Continue building';
          cb.onclick = function () { continueBuilding(s); };
          act.appendChild(cb);
        }
        var eb = document.createElement('button');
        eb.className = 'btn'; eb.textContent = 'Edit';
        eb.onclick = function () { openEditForm(s.id); };
        act.appendChild(eb);
        var db = document.createElement('button');
        // S-UI-RECONCILE (Lane A): danger primitive for a real delete, ghost for a
        // non-destructive fork revert; full-width via CSS `.full` (Lane D), not an
        // inline style. See deleteBtnClass for the full rationale.
        db.className = deleteBtnClass(isFork);
        // A fork shadows a catalog song, so removing it REVERTS to the original
        // rather than deleting a user creation - label + confirm say so.
        db.textContent = isFork ? 'Revert to original' : 'Delete progression';
        db.onclick = function () {
          var msg = isFork ? 'Revert to the original song? Your edits and video will be removed.' : 'Delete this progression?';
          if (confirm(msg)) { deleteCustomItem(s.id); switchTab('library'); }
        };
        act.appendChild(db);
      } else if (act && !s.custom) {
        // Catalog song: fork it into an editable, user-owned copy that SHADOWS
        // the original (add a video, rename, re-key). Chords + lyrics preserved.
        var mb = document.createElement('button');
        // F24 (operator UAT 2026-07-05): "make it mine" -> "Edit" - the user
        // doesn't need to know a fork/copy happens under the hood; behavior
        // (openForkForm below) is unchanged.
        mb.className = 'btn'; mb.textContent = 'Edit';
        // Fork from the MERGED record so a matched backing track's authoritative
        // video/key/mode carry onto the fork (mirrors soloKeyFor/ytSearchURL above);
        // the raw s (from ALLSONGS) lacks those merged fields. mergeRec never copies
        // _track into a saved custom, so forkOf/sheet/seq preservation is unaffected.
        mb.onclick = function () { openForkForm(mergedRec || s); };
        act.appendChild(mb);
      }
    }
    function shiftKey(dir) {
      var cand = nextTranspose(STATE.transpose, dir, function (st) { return seqPlayable(STATE.current.seq, st); });
      if (cand !== null) { STATE.transpose = cand; renderPractice(); }
    }

    /* ===================== MAXIMIZE (chord pack diagrams) ===================== */
    // Raw DOM close for the inversions overlay - idempotent, must NOT call
    // NavHistory.dismiss (that's the button/back-button path, not this).
    function rawCloseMax() { if (el.maxOv) el.maxOv.classList.remove('on'); }
    function openMaxWith(chords) {
      if (!el.maxOv || !el.maxGrid || !pack) return;
      el.maxGrid.innerHTML = '';
      chords.forEach(function (c) {
        // S-UI-RECONCILE (Lane A): the big overlay diagrams are Compose-scoped
        // (opened from the current progression), so relabel via the Compose
        // dispChordName through packDiagram - which resolves the voicing by the
        // canonical token and shows the key-aware name (Bb, not A#), fallback
        // branch included. Was `pack.diagram(c,'big')` with a raw `c` label.
        var bd = packDiagram(c, 'big', dispChordName(c));
        bd.onclick = function () { packPlayChord(c); };
        el.maxGrid.appendChild(bd);
      });
      el.maxOv.classList.add('on');
      if (window.NavHistory) NavHistory.open('inversions', rawCloseMax);
    }
    if (el.maxClose) el.maxClose.onclick = function () { if (window.NavHistory) NavHistory.dismiss(); else rawCloseMax(); };

    /* ===================== SETLIST ===================== */
    // Subtle transient toast - a lightweight "it happened" cue (UAT: Nik).
    // Adds get a toast (removes already have the persistent Undo affordance).
    // isErr (S-HARDEN H4) mirrors showComposeToast's err flag: toggles the same
    // 'err' class name for forward-compat with a future .toast.err rule -
    // songbook.css is out of this mission's grant, so there is no red styling
    // yet, but the message itself is always truthful (see toggleSet below).
    // S-TOAST (UAT U9): delegates to the shared toast.js primitive, which owns
    // ITS OWN per-host timer - the fix for the "Added to setlist" toast that
    // used to get its auto-hide silently cancelled by showComposeToast below
    // (both used to share ONE `var toastTimer` in this closure - see toast.js
    // header comment for the full root-cause trace).
    var toastEl;
    // kind (2nd arg):
    //   falsy        -> neutral confirmation (e.g. "Added to setlist"), quick 1600ms.
    //   true / 'err' -> ERROR (red): something failed. Back-compat: every legacy
    //                   caller passing a boolean still lands here.
    //   'warn'       -> CAUTION (amber): a heads-up, not a failure (e.g. "you've
    //                   already got a song in progress"). Distinct colour so a
    //                   caution never reads as an error.
    // Error AND caution toasts carry REAL text a user must actually read, so
    // their auto-hide scales with message length (min 3.2s, cap 6s) instead of
    // the quick 1.6s confirm floor - operator UAT: the "save or clear it first"
    // caution vanished before it could be read. Neutral confirms stay quick.
    // UAT r5 F6: `action` = optional { label, fn } rendered as a tappable button
    // riding the toast. Action-toast contract: a toast carrying an action earns
    // a LONGER hold (you can't tap what's already gone); plain confirmations
    // keep the quick 1600ms.
    function showToast(msg, kind, action) {
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
      var isErr = (kind === true || kind === 'err');
      var isWarn = (kind === 'warn');
      var dur = (isErr || isWarn) ? Math.min(6000, Math.max(3200, String(msg).length * 55)) : (action ? 5200 : 1600);
      global.Toast.show(msg, {
        host: toastEl,
        error: isErr,
        duration: dur,
        onShow: function (host, m) {
          // Direct textContent write FIRST (replaces any prior children; also
          // what the stub-DOM tests read), then the action button appends after.
          host.textContent = m;
          if (action) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'toastGo'; b.textContent = action.label;
            b.onclick = function () { host.classList.remove('on'); action.fn(); };
            host.appendChild(b);
          }
          host.classList.toggle('withAct', !!action);
          host.classList.toggle('err', isErr);
          host.classList.toggle('warn', isWarn);
          host.classList.add('on');
        },
        onHide: function (host) { host.classList.remove('on'); host.classList.remove('err'); host.classList.remove('warn'); host.classList.remove('withAct'); }
      });
    }
    // toTop (UAT 2026-07-16, operator "should we add new songs/progressions to
    // #1 slot in setlist?"): a JUST-CREATED song from Compose goes to the TOP -
    // recency is intent, the thing you just wrote is the thing you're about to
    // play. A Library "add to setlist" tap keeps appending (browsing the library
    // IS set-building, in the order you want to play). Same two moments, two
    // rules. Only the create paths pass toTop; every existing caller is unchanged.
    function toggleSet(id, toTop) {
      var pos = STATE.setlist.indexOf(id);
      var adding = pos < 0;
      if (pos >= 0) STATE.setlist.splice(pos, 1);
      else if (toTop) STATE.setlist.unshift(id);
      else STATE.setlist.push(id);
      // S-HARDEN H4 (analysis-refactor-enhance-20260704 A1 bug shape): saveSet()
      // can silently fail (quota/blocked storage) - branch the toast on its real
      // result instead of claiming success unconditionally, same pattern as
      // saveProgression (D-SAVE-TRUTH). Removes are unaffected (no toast either
      // way - they rely on the persistent Undo affordance, out of this fix's scope).
      var ok = saveSet();
      // Operator spec 2026-07-17 (verbatim): "the list should not be
      // reordered. it should not scroll....just set item selected." An add
      // NEVER scrolls - and it CANCELS any stale post-save highlight so a
      // leftover save-flag can't fire a scroll on this render either. The
      // row order is stable by construction (in-place shadowing + track-slot
      // merges), so the tapped row simply gains its check where it stands.
      pendingHighlightId = null;
      renderSongs(); renderSetlist();
      if (STATE.current && STATE.current.id === id) renderPractice();
      // UAT r5 F6: the add-confirmation carries a Go to setlist action (and the
      // longer action-toast hold) so "where did it go?" is one tap, not a hunt.
      if (adding) showToast(ok ? 'Added to setlist' : SAVE_FAIL_MSG, !ok,
        ok ? { label: 'Go to setlist', fn: function () { switchTab('jam'); } } : null);
    }
    // S-SETADD-KEYSEED: the 'seed' Library "+" action (addAffordance()==='seed') -
    // a row with a known key but no chords. Persists through the SAME two paths
    // every other library edit uses, so the row updates consistently instead of
    // duplicating: a CUSTOM track-only item (already in customSongs, e.g. a saved
    // backing track) gets its seq updated in place via updateCustomItem; a
    // STANDALONE catalog track (tracks.json, no customSongs entry) is promoted
    // via createCustomItem with no forkOf - the same shape openEditOrAdd already
    // saves for track edits - and Repertoire.build's title+artist matchKey then
    // merges the new custom SONG over the standalone track on the next
    // rebuildAll, so the row updates in place rather than duplicating.
    function seedKeyChordAndAdd(rec) {
      if (!rec || rec.id == null) return;
      var k = (global.Repertoire && typeof global.Repertoire.deriveKey === 'function')
        ? global.Repertoire.deriveKey(rec) : { key: null, mode: null };
      if (!k.key) return; // defensive - addAffordance() already gated this row into 'seed'
      var token = keySeedToken(k.key, k.mode);
      var cs = customById(rec.id);
      var saved = cs
        ? updateCustomItem(rec.id, { seq: [token] })
        : createCustomItem({
          title: rec.title != null ? rec.title : rec.t,
          artist: rec.artist != null ? rec.artist : rec.a,
          genre: rec.genre || '', yt: rec.yt || null,
          key: k.key, mode: k.mode || 'major', seq: [token]
        });
      if (!saved) { showToast(SAVE_FAIL_MSG, true); return; }
      if (STATE.setlist.indexOf(saved.id) < 0) STATE.setlist.push(saved.id);
      var ok = saveSet();
      // Operator spec 2026-07-17: adds never scroll and never reorder - the
      // seeded copy takes the TRACK's own slot in the merge (Repertoire.build
      // track-slot rule), so the row stays exactly where the user tapped it.
      // Cancel any stale post-save highlight so nothing scrolls this render.
      pendingHighlightId = null;
      renderSongs(); renderSetlist();
      // Display spelling via the SAME facet label the Key filter chip shows
      // (Repertoire.keyLabel - canonical-sharp identity + Circle.preferredTonicName
      // + minor suffix) - the seeded chord IS the row's key tonic, so its display
      // name and the key label are the same value. Falls back to the raw token
      // if Repertoire is somehow unavailable (defensive, matches other call sites).
      var disp = (global.Repertoire && global.Repertoire.keyLabel && global.Repertoire.keyLabel(rec)) || token;
      showToast(ok
        ? ('Added - seeded with its key chord (' + disp + '). Edit it to add more.')
        : SAVE_FAIL_MSG, !ok);
    }
    // ---- S-TOAST+ACTION (M-DESIGN-ENFORCE wave 2, UAT U19): the setlist
    // item-remove undo panel, migrated off the old untimed "persistent undo
    // banner" (interaction-safety.md guard #3 as it read before this wave)
    // onto the shared toast.js Toast.showAction() primitive - see
    // decisions.md D-ENFORCE-2. A STABLE sibling element (inserted once,
    // before #setBody), NOT rebuilt inside renderSetlist()'s body.innerHTML
    // wipe-and-repaint - the whole point of the migration is a live 6s
    // countdown + pause-on-touch, which a full DOM rebuild on every
    // unrelated re-render (reorder, add) would silently restart or leak.
    var setUndoBanner = null, setUndoHandle = null, setUndoTeardown = null;
    function ensureSetUndoBanner() {
      if (!el.setBody || !el.setBody.parentNode) return false;
      if (!setUndoBanner) {
        setUndoBanner = document.createElement('div');
        setUndoBanner.className = 'setUndo toastAction';
        setUndoBanner.hidden = true;
        el.setBody.parentNode.insertBefore(setUndoBanner, el.setBody);
      }
      return true;
    }
    function paintSetUndoHidden() {
      if (setUndoTeardown) { setUndoTeardown(); setUndoTeardown = null; }
      setUndoHandle = null;
      if (setUndoBanner) { setUndoBanner.hidden = true; setUndoBanner.innerHTML = ''; }
    }
    // Cancel any pending remove-undo - leaving edit mode, clearing the whole
    // setlist, or a second removal while one is already showing all call this.
    // Safe to call even when nothing is pending (finish() is itself a no-op
    // once resolved).
    function dismissSetUndo() { if (setUndoHandle) setUndoHandle.finish(); }
    function showSetUndoBanner(sid, index) {
      if (!ensureSetUndoBanner()) return;
      dismissSetUndo(); // tear down a stale prior instance first (re-removal mid-window)
      setUndoBanner.hidden = false;
      setUndoBanner.innerHTML = '';
      var rs = songById(sid);
      var msg = document.createElement('span'); msg.textContent = 'Removed ' + (rs ? rs.t : 'song');
      var undoBtn = document.createElement('button');
      undoBtn.type = 'button'; undoBtn.className = 'btn ghost'; undoBtn.textContent = 'Undo';
      undoBtn.onclick = function () {
        var at = Math.min(index, STATE.setlist.length);
        STATE.setlist.splice(at, 0, sid); STATE.lastRemoved = null;
        if (setUndoHandle) setUndoHandle.finish();
        saveSet(); syncQueueToSetlist(); renderSetlist(); renderSongs();
      };
      setUndoBanner.appendChild(msg); setUndoBanner.appendChild(undoBtn);
      setUndoHandle = global.Toast.showAction('Removed ' + (rs ? rs.t : 'song'), {
        host: setUndoBanner,
        onShow: function (host, m, bar) { if (bar) host.appendChild(bar); },
        onHide: function () { STATE.lastRemoved = null; paintSetUndoHidden(); }
      });
      setUndoTeardown = global.Toast.wirePauseOnTouch(setUndoBanner, setUndoHandle);
    }
    function renderSetlist() {
      if (!el.setBody) return;
      var body = el.setBody, bar = el.setBar, count = el.setCount;
      // The Edit toggle reveals reorder/remove (codex: keep the resting set row clean +
      // destructive controls off the scroll rail until the user opts into editing).
      if (el.setEdit) {
        el.setEdit.style.display = STATE.setlist.length ? '' : 'none';
        el.setEdit.textContent = STATE.setEditMode ? 'Done' : 'Edit';
        el.setEdit.classList.toggle('on', STATE.setEditMode);
      }
      // Clear (✕) is a destructive control: UAT 2026-07-16 hides it until EDIT
      // mode (and it wears red - .setDelete) so a resting setlist never shows a
      // one-tap wipe. (Also hidden on an empty setlist - nothing to destroy.)
      if (el.setClear) el.setClear.style.display = (STATE.setEditMode && STATE.setlist.length) ? '' : 'none';
      // Start (perform) lives in the header now (UAT: not a full-width bar). It
      // shows only in NORMAL mode with a non-empty set - performing isn't a thing
      // you do mid-edit, and it sits rightmost (thumb) with Edit to its left.
      if (el.performBtn) el.performBtn.style.display = (!STATE.setEditMode && STATE.setlist.length) ? '' : 'none';
      if (STATE.setlist.length === 0) {
        body.innerHTML = '<div class="setEmpty">Your setlist is empty.<br>Add songs from the Library with the + button.</div>';
        if (bar) bar.style.display = 'none';
        if (count) count.textContent = 'No songs yet';
        STATE.setEditMode = false; dismissSetUndo(); STATE.lastRemoved = null;
        return;
      }
      if (count) count.textContent = STATE.setlist.length + ' song' + (STATE.setlist.length > 1 ? 's' : '')
        + (STATE.setEditMode ? ' · editing' : ' · ready to play');
      body.innerHTML = '';
      STATE.setlist.forEach(function (sid, i) {
        var s = songById(sid); if (!s) return;
        // SSOT: same renderer as Songs/Tracks, in 'set' mode. Reorder/remove only when setEdit.
        body.appendChild(global.ListItem.render(displayRecFor(s), {
          segment: 'set',
          position: i + 1,
          first: i === 0,
          last: i === STATE.setlist.length - 1,
          setEdit: STATE.setEditMode,
          onActivate: function () { openPractice(sid, STATE.setlist); }, // open into the setlist queue
          onUp: function () { if (i > 0) { var a = STATE.setlist[i - 1]; STATE.setlist[i - 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); syncQueueToSetlist(); renderSetlist(); } },
          onDn: function () { if (i < STATE.setlist.length - 1) { var a = STATE.setlist[i + 1]; STATE.setlist[i + 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); syncQueueToSetlist(); renderSetlist(); } },
          onRemove: function () {
            var wasOpen = STATE.current && STATE.current.id === sid;
            STATE.lastRemoved = { sid: sid, index: i }; // enable undo
            STATE.setlist.splice(i, 1); QUEUE.remove(sid); saveSet();
            // keep the live queue + the (maybe hidden) song screen in step with the edit
            if (wasOpen) { var nid = QUEUE.current(); STATE.current = nid ? songById(nid) : null; STATE.transpose = 0; renderPractice(); }
            else syncQueueToSetlist();
            renderSetlist(); renderSongs();
            showSetUndoBanner(sid, i); // S-TOAST+ACTION: after the repaint, so the stable banner sits above the fresh list
          },
          onAction: function () { ytSearch(s); }
        }));
      });
      // (The old full-width Start-performance bar was retired 2026-07-16 - Start
      // now lives compact in the header, toggled above.)
    }
    if (el.setEdit) el.setEdit.onclick = function () {
      STATE.setEditMode = !STATE.setEditMode;
      if (!STATE.setEditMode) { dismissSetUndo(); STATE.lastRemoved = null; } // leaving edit mode dismisses the undo affordance
      renderSetlist();
    };
    // Movement-cancelled (codex A2/S-SETX rider): a scroll-grab on the setlist
    // header rail must not fire the destructive Clear confirm(). Behavior is
    // otherwise unchanged - same native confirm(), same effect. (Native
    // confirm() itself is PRE-EXISTING debt, unchanged by M-DESIGN-ENFORCE
    // wave 2 - see component-conventions.md Findings register: this wave's
    // MODAL-standard grant covers the backup/restore flow only, not every
    // confirm() call app-wide.)
    if (el.setClear) wireTapCancel(el.setClear, function () {
      if (STATE.setlist.length === 0) return;
      if (confirm('Clear your setlist?')) { dismissSetUndo(); STATE.setlist = []; STATE.lastRemoved = null; STATE.setEditMode = false; saveSet(); renderSetlist(); renderSongs(); }
    });

    /* ===================== PERFORM ===================== */
    var performEl = el.perform, pSheet = el.pSheet;
    function reqWake() { try { if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').then(function (w) { STATE.wakeLock = w; }, function () { }); } } catch (e) { } }
    function relWake() { try { if (STATE.wakeLock) { STATE.wakeLock.release(); STATE.wakeLock = null; } } catch (e) { } }
    // Raw DOM close for the Stage overlay - idempotent, must NOT call
    // NavHistory.dismiss (that's the button/back-button path, not this).
    function rawCloseStage() { relWake(); if (performEl) performEl.classList.remove('on'); }
    // Launch fullscreen perform mode for any list of song ids (the setlist, or a
    // single song straight from Practice / the "Play now" hero). seedTpose carries
    // the song view's transpose into the opening song (absent = original key);
    // prev/next still reset to 0 per song, as before.
    function startPerform(ids, startIdx, seedTpose, seedView) {
      if (!ids || !ids.length) return;
      QUEUE.set(ids, startIdx || 0);
      STATE.queueSkipNotice = null; // fresh launch - any stale notice from a prior Stage session doesn't carry over
      // Seed the CURRENT view for this launch only - never persisted here (that
      // would leak a custom song's forced 'chords' into later performances). The
      // setlist Perform button seeds stageDefaultView so it always opens in the
      // saved preference regardless of a prior song-view Stage seed.
      if (seedView === 'lyrics' || seedView === 'chords' || seedView === 'both') {
        STATE.performView = seedView;
      }
      // Default to auto-fit font on every Stage open (UAT r3) - a manual A-/A+
      // size set in one song shouldn't carry into the next open. Reset the stale
      // scale too, so the first A-/A+ after opening steps from the neutral base
      // (auto re-measures immediately, so the 1 is only the manual-step anchor).
      STATE.fontMode = 'auto'; STATE.fontScale = 1;
      STATE.performDim = false; STATE.performTpose = seedTpose || 0;
      // show the overlay BEFORE rendering so auto-fit can measure a real height
      if (performEl) { performEl.classList.remove('dim'); performEl.classList.add('on'); }
      STATE.ctrlsOpen = false; if (el.pSpeed) el.pSpeed.classList.remove('on');
      if (el.pSpeedR) { el.pSpeedR.value = STATE.scrollSpeed; if (el.pSpeedV) el.pSpeedV.textContent = STATE.scrollSpeed; }
      showPerform();
      reqWake();
      if (window.NavHistory) NavHistory.open('stage', rawCloseStage);
    }
    if (el.performBtn) el.performBtn.onclick = function () { startPerform(STATE.setlist, 0, 0, stageDefaultView); };
    if (el.pClose) el.pClose.onclick = function () { if (window.NavHistory) NavHistory.dismiss(); else rawCloseStage(); };
    // S-SET-INTEGRITY (UAT U22): same defensive-nav step as the Practice
    // screen's navQueue() - stepResolvable(songById) walks past a dangling
    // setlist ref instead of landing on it (showPerform's own `if (!s)
    // return` guard would otherwise leave the stage frozen on the prior song
    // with no way forward). See navQueue() above for the full contract.
    if (el.pPrev) el.pPrev.onclick = function () {
      if (QUEUE.atStart()) return;
      var r = QUEUE.stepResolvable(-1, songById);
      STATE.queueSkipNotice = r.skipped > 0 ? skipNoticeText(r.skipped) : null;
      STATE.performTpose = 0; showPerform();
    };
    if (el.pNext) el.pNext.onclick = function () {
      if (QUEUE.atEnd()) { if (window.NavHistory) NavHistory.dismiss(); else rawCloseStage(); return; }
      var r = QUEUE.stepResolvable(1, songById);
      STATE.queueSkipNotice = r.skipped > 0 ? skipNoticeText(r.skipped) : null;
      STATE.performTpose = 0; showPerform();
    };
    if (el.pDown) el.pDown.onclick = function () { perfShift(-1); };
    if (el.pUp) el.pUp.onclick = function () { perfShift(1); };
    if (el.pDimBtn) el.pDimBtn.onclick = function () { STATE.performDim = !STATE.performDim; if (performEl) performEl.classList.toggle('dim', STATE.performDim); };
    // stage controls panel (font size + lyrics/chords/both view; no scroll-speed slider in the current markup)
    if (el.pCtrls) el.pCtrls.onclick = function () { STATE.ctrlsOpen = !STATE.ctrlsOpen; if (el.pSpeed) el.pSpeed.classList.toggle('on', STATE.ctrlsOpen || STATE.scrolling); };
    if (el.pViewLyrics) el.pViewLyrics.onclick = function () { setPerformView('lyrics'); };
    if (el.pViewChords) el.pViewChords.onclick = function () { setPerformView('chords'); };
    if (el.pViewBoth) el.pViewBoth.onclick = function () { setPerformView('both'); };
    if (el.pFontDown) el.pFontDown.onclick = function () { stepFont(-0.1); };
    if (el.pFontUp) el.pFontUp.onclick = function () { stepFont(0.1); };
    if (el.pFontAuto) el.pFontAuto.onclick = function () { STATE.fontMode = 'auto'; applyPerfFont(); updateStageBtns(); savePerfPrefs(); };
    function setPerformView(v) { STATE.performView = v; stageDefaultView = v; showPerform(); savePerfPrefs(); }
    function stepFont(d) {
      // Leaving auto-fit: seed the manual scale from the CURRENT on-screen auto size
      // (the last --pscale applyPerfFont computed), not the neutral 1. Otherwise the
      // first A+ jumps DOWN to 1.1 from a ~1.5 auto-fit (looks like a decrease) and
      // the first A- drops a big step. Continuing from what's visible = no jump.
      if (STATE.fontMode === 'auto' && pSheet) {
        var curScale = parseFloat(pSheet.style.getPropertyValue('--pscale'));
        if (curScale > 0) STATE.fontScale = curScale;
      }
      STATE.fontMode = 'manual';
      STATE.fontScale = Math.max(0.8, Math.min(2.2, +(STATE.fontScale + d).toFixed(2)));
      applyPerfFont(); updateStageBtns(); savePerfPrefs();
    }
    // auto-fit: scale the sheet so a short song fills the screen and a long one
    // shrinks toward fitting; manual mode pins an explicit scale instead.
    function applyPerfFont() {
      if (!pSheet) return;
      if (STATE.fontMode === 'manual') { pSheet.style.setProperty('--pscale', STATE.fontScale); return; }
      var inner = pSheet.firstElementChild;
      if (!inner) { pSheet.style.setProperty('--pscale', 1); return; }
      pSheet.style.setProperty('--pscale', 1);            // measure at base size
      var availH = Math.max(80, pSheet.clientHeight - 112); // leave room for the nav bar
      var needH = inner.scrollHeight;
      var availW = pSheet.clientWidth;
      var needW = inner.scrollWidth; // white-space:pre lyric lines never wrap - width must win
      var scale = fitScale(availH, needH, availW, needW);
      pSheet.style.setProperty('--pscale', scale.toFixed(3));
    }
    function updateStageBtns() {
      if (el.pFontAuto) el.pFontAuto.classList.toggle('on', STATE.fontMode === 'auto');
      // Custom sheets force the chords renderer (showPerform); the segmented
      // control must SAY so - highlight Chords and disable the other views
      // instead of showing a Lyrics/Both highlight over a chords-only sheet.
      var cur = songById(QUEUE.current());
      var forced = !!(cur && cur.custom && !cur.forkOf); // a fork carries lyrics -> not forced
      var v = forced ? 'chords' : STATE.performView;
      if (el.pViewLyrics) { el.pViewLyrics.classList.toggle('on', v === 'lyrics'); el.pViewLyrics.disabled = forced; }
      if (el.pViewChords) el.pViewChords.classList.toggle('on', v === 'chords');
      if (el.pViewBoth) { el.pViewBoth.classList.toggle('on', v === 'both'); el.pViewBoth.disabled = forced; }
    }
    function perfShift(dir) {
      var s = songById(QUEUE.current());
      // A seq-less item (placeholder-rendered in showPerform for a stale setlist)
      // has nothing to transpose - no-op rather than crash in seqPlayable(s.seq).
      if (!hasChordSheet(s)) return;
      var cand = nextTranspose(STATE.performTpose, dir, function (st) { return seqPlayable(s.seq, st); });
      if (cand !== null) { STATE.performTpose = cand; showPerform(); }
    }
    function showPerform() {
      var s = songById(QUEUE.current());
      if (!s) return;
      // S-SET-INTEGRITY (UAT U22): same one-shot skip notice as the Practice
      // queue-nav counter (see navQueue()) - appended to the position readout,
      // not a separate toast (a "calm inline notice", per the spec).
      if (el.pPos) el.pPos.textContent = (QUEUE.index() + 1) + ' / ' + QUEUE.size() + (STATE.queueSkipNotice ? ' - ' + STATE.queueSkipNotice : '');
      if (el.pTitle) el.pTitle.textContent = s.t;
      // Same empty-artist guard as the song-screen header (artist-mirrors-title fix).
      if (el.pArtist) el.pArtist.textContent = (s.a ? s.a + ' · ' : '') + s.y;
      // Defensive: canAdd blocks seq-less tracks from the setlist, but a setlist
      // persisted before that guard could still hold one - render a gentle
      // placeholder instead of crashing on s.seq.map.
      if (!hasChordSheet(s)) {
        if (el.pKeyLine) el.pKeyLine.textContent = '';
        if (pSheet) pSheet.innerHTML = '<div class="pInner"><div class="sect">No chord chart for this track</div></div>';
        updateStageBtns();
        if (el.pNext) el.pNext.textContent = QUEUE.atEnd() ? '✓' : '→';
        return;
      }
      var seq = s.seq.map(function (c) { return tpose(c, STATE.performTpose); });
      // S-UI-RECONCILE (Lane A): key-aware display speller for the Stage surface,
      // built the SAME way as the song screen - prefer the merged record's key,
      // else derive from the transposed seq (soloKeyFor is transpose-aware). Names
      // respell (Bb, not A#); tokens/audio/storage stay canonical-sharp.
      var mrStage = null;
      for (var psi = 0; psi < REPERTOIRE.length; psi++) { if (REPERTOIRE[psi].id === s.id) { mrStage = REPERTOIRE[psi]; break; } }
      var stageKey = soloKeyFor((mrStage && mrStage.key && mrStage.mode) ? mrStage : s, seq, STATE.performTpose);
      var stageDisp = chordSpeller(stageKey.key, stageKey.mode);
      if (el.pKeyLine) el.pKeyLine.textContent = (STATE.performTpose !== 0 ? 'Key ' + stageDisp(seq[0]) + '  ·  ' : '') + seq.map(stageDisp).join('  ');
      if (pSheet) {
        var view = (s.custom && !s.forkOf) ? 'chords' : STATE.performView;
        pSheet.innerHTML = '<div class="pInner">' + renderSheet(s, STATE.performTpose, view, stageDisp) + '</div>';
        pSheet.scrollTop = 0;
        applyPerfFont();
      }
      updateStageBtns();
      if (el.pNext) el.pNext.textContent = QUEUE.atEnd() ? '✓' : '→';
    }
    /* auto-scroll */
    if (el.pSpeedR) el.pSpeedR.oninput = function () { STATE.scrollSpeed = +el.pSpeedR.value; if (el.pSpeedV) el.pSpeedV.textContent = el.pSpeedR.value; savePerfPrefs(); };

    /* ===================== COMPOSE (needs chord pack for diagrams/audio) ===================== */
    var progression = [], cTpose = 0; // cTpose = net semitones shifted from where you started (interval-learning readout)
    // The saved custom-song id the current Compose buffer is linked to (null = an
    // unsaved/fresh progression). Set on save; re-save UPDATES that song in place
    // (no duplicate); "Solo over" opens its Studio directly (no re-prompt). Detached
    // on Clear or when a starter pattern replaces the buffer wholesale.
    var savedComposeId = null;
    // S-SLOTX (sprint-1 #1, F2): movement-cancelled tap for the progression
    // slot remover - fires fn only if the touch did NOT move (a tap, not a
    // scroll-grab on the horizontal .prog filmstrip). Mouse clicks (no touch
    // events) are unaffected.
    // S-HARDEN (analysis-refactor-enhance-20260704 A4): thin delegate to
    // list-item.js's wireTap (the SSOT - see wireTapCancel above for the same
    // move). Name kept - test/songbook.test.js asserts this call site is wired
    // through composeWireTap by name, not a raw onclick.
    function composeWireTap(el, fn) { return global.ListItem.wireTap(el, fn); }
    function packDiagram(name, size, displayName) {
      // FORK-4 removal: `name` is ALWAYS the canonical-sharp TOKEN (keys the
      // voicing pack, audio, storage); `displayName` is the key-aware label to
      // SHOW (Bb for the bVII of C). Relabel after the pack renders - packs
      // stay untouched and keep resolving by token.
      if (pack && typeof pack.diagram === 'function') {
        var el = pack.diagram(name, size);
        if (el && displayName && displayName !== name) {
          var lbl = el.querySelector && el.querySelector('.chord-name, .nm');
          if (lbl) lbl.textContent = displayName;
        }
        return el;
      }
      var wrap = document.createElement('div');
      wrap.className = (size === 'big') ? 'bigC' : 'chord';
      // name is a freeform custom-song token here (no real pack to resolve it),
      // so escape before innerHTML - same XSS class as the sheet renderer.
      wrap.innerHTML = '<span class="' + (size === 'big' ? 'nm' : 'chord-name') + '">' + escHTML(displayName || name) + '</span>';
      return wrap;
    }
    // FORK-4 removal: the key-aware DISPLAY name for a chord token inside the
    // current songKey (bVII of C shows Bb) - tokens stay canonical-sharp for
    // packs/audio/storage/suggestions; keyless contexts (no songKey.root, the
    // All browse) return the token unchanged per the music-theory-coach verdict.
    // Delegates to the pure, key-parameterized dispChordNameInKey (module scope)
    // bound to the live songKey - ONE display-naming path shared with the M-13
    // template-suggestion chips (which pass their own realization key).
    function dispChordName(c) { return dispChordNameInKey(c, songKey.root, songKey.mode); }
    // S-PROG-WRAP (UAT U8): real measurements feeding progStripMode's decision -
    // the DOM-caller half of the fitScale-style contract (pure fn takes plain
    // numbers; the caller measures the real page and passes them in).
    //
    // Card width: a diagram's SVG size is fixed per chord PACK + size, content-
    // independent (drawDiagram's W/H opts never vary by chord - chords-guitar.js/
    // chords-ukulele.js), so ONE off-screen probe per pack gives an accurate width
    // for every future check - including the very first render of a 12-chord
    // starter loaded straight into an EMPTY progression, where no prior full-mode
    // slot exists yet to measure from. Probes the actual first chord in the
    // progression (guaranteed renderable by this pack) rather than a guessed name
    // like "C" (which may not exist in every custom/exotic pack).
    var _progCardW = null, _progCardWPack = null;
    function progCardW() {
      if (!progression.length) return 0; // nothing to measure/degrade yet
      if (_progCardW != null && _progCardWPack === pack) return _progCardW;
      var probe = packDiagram(progression[0], 'small');
      if (probe.style) { probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.left = '-9999px'; probe.style.top = '-9999px'; }
      document.body.appendChild(probe);
      var w = probe.offsetWidth;
      document.body.removeChild(probe);
      // 84 ~= the guitar small-diagram box (70px SVG + 6px x2 padding + 1px x2
      // border - chords-guitar.js smallDiagram + songbook.css .chord) - only hit
      // when offsetWidth is unavailable (a headless/no-layout DOM, e.g. tests).
      _progCardW = (w > 0) ? w : 84;
      _progCardWPack = pack;
      return _progCardW;
    }
    function progGapW() {
      if (!el.prog || typeof global.getComputedStyle !== 'function') return 8; // matches .prog{gap:8px} in songbook.css
      var cs = global.getComputedStyle(el.prog);
      var g = parseFloat(cs.columnGap || cs.gap);
      return (g > 0) ? g : 8;
    }
    function progAvailW() {
      if (!el.prog) return 0;
      var w = el.prog.clientWidth || 0;
      if (typeof global.getComputedStyle === 'function') {
        var cs = global.getComputedStyle(el.prog);
        w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      }
      return w;
    }
    // What tonic do we measure intervals against? The chosen key when one is set
    // (so an Axis progression starting on vi still reads vi-IV-I-V, not I-…), else
    // the first chord as a sensible default for free-built progressions.
    // ONE source of truth for "the key": songKey. `root` is the key center (null
    // until the user explicitly picks, then it stays explicit through transposes);
    // until then we fall back to progression[0] so a free-built progression still
    // reads sensible intervals. `mode` is always set (Major default). See the
    // unified-key refactor (PLAN-key-subsystem-redesign.md): the picker and the
    // transposer used to be two independent key notions and drifted; now a transpose
    // moves songKey.root so the readout, palette and solo scale all follow.
    function labelTonic() { return songKey.root || progression[0]; }
    // ONE roman-label path for every Compose surface (progression slots, in-key
    // palette, suggestion chips): mode-aware in a known key so labels match the
    // Studio's diatonic numerals; chromatic romanFor vs the first chord otherwise.
    function labelRoman(c) {
      if (songKey.root) return romanInKey(c, songKey.root, songKey.mode);
      var t = labelTonic();
      return (t && global.Circle && global.Circle.romanFor) ? global.Circle.romanFor(c, t) : '';
    }
    var lastProgSig = null;
    function renderProg() {
      if (!el.prog) return;
      // Only offer Clear when there's a progression to clear (UAT: Nik).
      if (el.cClear) el.cClear.hidden = progression.length === 0;
      // Gray out the choosers once the COMPOSE_MAX cap (addChord, D-CAP12) is reached.
      // The .maxed class sits on .composeWrap so it covers BOTH regions: the fixed top
      // (controls + key chip; starters render in the scrolling #suggest now) AND the
      // scrolling chord list (in-key cells + all-chords tiles).
      var maxed = progression.length >= COMPOSE_MAX;
      var wrap = document.querySelector('.composeWrap');
      if (wrap) {
        wrap.classList.toggle('maxed', maxed);
        // Save is the compose PRIMARY only once there is something to save. On an empty
        // canvas it demotes to an outline so it does not out-shout the chord cards - the
        // real "obvious next move" (visual-language.md emphasis ladder).
        wrap.classList.toggle('progEmpty', progression.length === 0);
      }
      if (el.maxNote) el.maxNote.hidden = !maxed;
      var tonic = labelTonic();
      // S-PROG-WRAP-2 (UAT U8b): count-driven staged density ladder - full
      // diagram cards (1-4) -> one-row compact tokens (5-6) -> a fixed
      // 6-column compact grid (7-12, so 12 = two clean rows of 6).
      // progStripMode measures real widths only as a narrow-viewport GUARD
      // (early demotion); it never promotes back up past the count-driven
      // candidate stage.
      var mode = progStripMode(progression.length, progCardW(), progGapW(), progAvailW(),
        // S-CHORD-COLLAPSE: lazy optional lookup (same pattern as window.DiagramPref
        // in chord-pack-adapter.js) - a page/test without the module reads false;
        // method-level typeof guard per the buildGrid call site (Volley 2 Medium #1).
        // chartsPref (UAT r5 F5, was composeShapesOn / Volley 2 High #1): the
        // Settings chord-charts choice governs the filmstrip too, not just the
        // palettes. Deliberately that and no more (Volley 3 High #2): at 5+
        // chords the pre-existing S-PROG-WRAP-2 count ladder renders compact
        // tokens for EVERY level - the pref must not override the density
        // ladder that exists for fit reasons; it only governs the level collapse.
        chipsEffective(!!(global.ChordCollapse && typeof global.ChordCollapse.active === 'function'
          && global.ChordCollapse.active())));
      el.prog.classList.toggle('full', mode === 'full');
      el.prog.classList.toggle('fill-row', mode === 'fill-row');
      el.prog.classList.toggle('grid6', mode === 'grid6');
      // 'fill-row' is the only stage whose column count varies with the
      // progression length - grid6 is a FIXED 6 columns (CSS-only) and full
      // is a flexbox row (no column count needed), so only fill-row needs an
      // inline grid-template-columns per render.
      el.prog.style.gridTemplateColumns = (mode === 'fill-row') ? 'repeat(' + progression.length + ', 1fr)' : '';
      // Only repaint the strip when something VISIBLE changed - the chords, their
      // key-relative romans, the maxed cap, or the stage. labelRoman is
      // MODE-aware (a mode toggle flips bVII <-> VII on the same chord), so the
      // mode is part of the visible signature - omitting it left stale romans
      // after a mode change (codex V2 high). Same reasoning for the strip stage:
      // a resize that flips between stages must force a repaint even though the
      // chords/tonic/songKey.mode/maxed didn't change.
      var sig = progression.join(',') + '|' + tonic + '|' + songKey.mode + '|' + maxed + '|' + mode;
      if (sig !== lastProgSig) {
        lastProgSig = sig;
        el.prog.innerHTML = '';
        progression.forEach(function (c, i) {
          var slot = document.createElement('div'); slot.className = 'slot';
          var rn = labelRoman(c);
          if (mode !== 'full') {
            // S-PROG-WRAP: the SAME compact token the "Next chord" suggestion
            // row already uses (suggChip/scName/scRn classes) - reused
            // verbatim, not a 4th chip variant. Built via createElement +
            // textContent (not innerHTML, unlike suggChip() itself) so the
            // remove button below stays a plain sibling and content is
            // trivially inspectable. .composeWrap.maxed dims THIS class's
            // chooser role at the cap (see songbook.css); the progression's
            // OWN slots must stay interactive at cap (remove one to add
            // another) - the `.prog .suggChip` CSS carve-out exempts them.
            var tok = document.createElement('button'); tok.type = 'button'; tok.className = 'suggChip';
            var nameSpan = document.createElement('span'); nameSpan.className = 'scName'; nameSpan.textContent = dispChordName(c);
            tok.appendChild(nameSpan);
            if (rn) { var rnSpan = document.createElement('span'); rnSpan.className = 'scRn'; rnSpan.textContent = rn; tok.appendChild(rnSpan); }
            tok.onclick = function () { packPlayChord(c); };
            slot.appendChild(tok);
          } else {
            var d = packDiagram(c, 'small', dispChordName(c)); d.onclick = function () { packPlayChord(c); };
            slot.appendChild(d);
            // interval relative to the key — think I IV V, not shapes
            if (rn) { var lbl = document.createElement('span'); lbl.className = 'rn'; lbl.textContent = rn; slot.appendChild(lbl); }
          }
          // S-PROG-REORDER (prototype, operator directive 2026-07-10): the slot
          // is draggable to reorder - see wireSlotDrag below the render loop.
          wireSlotDrag(slot, i);
          var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×';
          // S-SLOTX: movement-cancelled (composeWireTap, not a raw onclick) so a
          // scroll-grab on this horizontal filmstrip can't remove a chord.
          // Unchanged by S-PROG-WRAP - the remover works identically in both
          // full and compact mode.
          composeWireTap(rm, function () {
            // S-DELETE-UNDO (operator UAT 2026-07-10): the first tap ARMS the
            // remover (red, 1.6s auto-disarm) - protection against accidental
            // deletes while tapping through chords to hear them; the second
            // tap deletes and pushes onto the bounded remove-undo stack.
            if (armedRm !== rm) { armRm(rm); return; }
            disarmRm();
            // A3: Clear-undo + stale toast invalidate as before; the remove-undo
            // stack deliberately SURVIVES a remove - it IS the remove trail.
            invalidateClearUndo(true);
            pushRemoveUndo(progression[i], i);
            progression.splice(i, 1);
            var kc = reinferKey();
            renderProg(); renderSuggest(); renderKey();
            if (kc && el.keyRoots) { renderKeyView(); buildGrid(); }
          });
          slot.appendChild(rm);
          el.prog.appendChild(slot);
        });
      }
      renderSuggest();
      renderSongTray(); // M-13: the tray's visibility + add-control track the progression
    }

    // ---- M-13 SONG BUILDER: assemble progressions into a multi-section song ----
    // M-13 g2: the section buffer now SURVIVES a reload. Additive namespaced key
    // (songbook.builderBuffer.v1) - already covered by backup.js's OWNED_PREFIXES
    // ('songbook.' prefix), so no SCHEMA_VERSION bump. Defensive load (bad/foreign
    // JSON -> empty buffer, never a boot crash); buildSongFromSections already
    // tolerates a malformed {label, seq} shape per-section, so a half-corrupt
    // buffer degrades gracefully instead of losing the whole thing. The tray
    // (renderSongTray) shows only when a progression exists OR the buffer is
    // non-empty - never dead chrome on an empty canvas.
    var BUILDER_BUFFER_KEY = prefix + ".builderBuffer.v1";
    function loadSongSections() {
      try {
        var r = localStorage.getItem(BUILDER_BUFFER_KEY);
        if (!r) return [];
        var arr = JSON.parse(r);
        if (!Array.isArray(arr)) return [];
        // Keep only well-shaped entries - a hand-edited or partially-corrupt
        // key degrades to dropping the bad rows, not the whole buffer.
        // Operator UAT 2026-07-17 ("don't name things Progression - it poisons
        // the well"): normalize the legacy pre-fix buffer label at load, same
        // mapping sectionsFromSheet applies to saved sheets - the song context
        // only ever speaks the standard section vocabulary.
        return arr.filter(function (s) {
          return s && typeof s.label === 'string' && Array.isArray(s.seq);
        }).map(function (s) {
          return s.label === 'Progression' ? Object.assign({}, s, { label: 'Verse' }) : s;
        });
      } catch (e) { return []; }
    }
    function saveSongSections() { return safeSet(BUILDER_BUFFER_KEY, JSON.stringify(songSections)); }
    var songSections = loadSongSections();
    // S-SECTION-EDIT (operator UAT 2026-07-17): which buffered section is being
    // refined in the builder right now (index into songSections), or null. Set
    // by editSection() when its ✎ is tapped; consumed by addSongSection() to
    // UPDATE that section in place instead of appending a duplicate; cleared on
    // any Clear (clearProgression) so an abandoned edit never silently
    // overwrites a section later. Session-local (not persisted) - a refine is a
    // live intent, not saved state.
    var editingSectionIdx = null;
    // S-SONG-MODE (docs/SONG-MODE-DESIGN.md): Compose is two full-screen views
    // behind one top-level toggle - 'chords' (the progression editor: strip +
    // picker) and 'song' (the arrangement canvas: section cards + proven
    // templates + Save song). The M-13 tray used to squeeze the whole builder
    // into the FIXED composeTop; every added section starved the chord picker's
    // scroll area (the "two sections and I'm stuck" operator report). One
    // altitude on screen at a time. Additive key; invalid stored values fall
    // back to 'chords' (the muscle-memory default).
    // S-COMPOSE-CALM (operator interview 2026-07-19, B+ shape): Compose ALWAYS
    // lands in Chords - the Song canvas is a transient on-demand editor
    // (entered via Save > grow/add, Library > continue building), never a
    // persisted landing. The old <prefix>.composeMode.v1 key is abandoned
    // (readers were defensive; additive removal, no schema bump).
    var composeMode = 'chords';
    // The guided loop: a Song-mode template fill (or "Build the chords") drops
    // into Chords mode to edit; the next "Add to song" returns to the canvas.
    // Manual toggle taps clear the flag - the user taking the wheel wins.
    var returnToSong = false;
    // S-SONG-MODE Phase B: when a draft was loaded FROM a saved song
    // ("Continue building"), Save song UPDATES that song in place instead of
    // creating a copy (the saveProgression update-in-place precedent: no new
    // record, no name prompt). Persisted alongside the buffer so a reload
    // keeps the link; ignored (nulled) when the buffer itself is empty - a
    // stale link must never make a brand-new draft overwrite an old song.
    var BUILDER_SOURCE_KEY = prefix + ".builderSource.v1";
    var builderSourceId = null;
    try { builderSourceId = songSections.length ? (localStorage.getItem(BUILDER_SOURCE_KEY) || null) : null; } catch (e) { /* fresh */ }
    function saveBuilderSource() {
      return builderSourceId ? safeSet(BUILDER_SOURCE_KEY, builderSourceId)
        : (function () { try { localStorage.removeItem(BUILDER_SOURCE_KEY); } catch (e) {} return true; })();
    }
    var navSongOpen = false;
    function rawSetMode(m) {
      composeMode = m;
      stopSectPlay(); // a section preview must not keep sounding under the other view
      renderSongTray();
    }
    function setComposeMode(m) {
      if (m !== 'chords' && m !== 'song') return; // unknown values never wedge the screen
      if (m === composeMode) return;
      // S-COMPOSE-CALM: the canvas is a history layer. Entering registers it so
      // hardware/gesture Back leaves the canvas; ANY programmatic exit routes
      // through NavHistory.dismiss() so the layer unwinds in step (the
      // openSaveNameRow overlay contract). No NavHistory (Node stubs) = raw.
      if (m === 'song') {
        rawSetMode('song');
        if (window.NavHistory && !navSongOpen) {
          navSongOpen = true;
          window.NavHistory.open('songCanvas', function () { navSongOpen = false; rawSetMode('chords'); });
        }
        return;
      }
      if (navSongOpen && window.NavHistory) {
        // Programmatic exit (post-save flows, the canvas X mid-chain): switch
        // the view NOW and leave our history entry in place. Popping it here
        // is unsafe both ways - a synchronous dismiss can be swallowed by
        // NavHistory's in-flight guard (canvas stuck open), and a deferred one
        // can pop a layer that opened in between (observed: it closed the
        // practice screen the save had just navigated to). The stale entry
        // costs at most one visually-empty Back press; its closeFn is
        // idempotent so that press is harmless.
        rawSetMode('chords');
        return;
      }
      rawSetMode('chords');
    }
    // Section preview: strum the section's chords in sequence through the SAME
    // pack path a chord tap uses (packs/voicings resolve identically). A fixed
    // comfortable gap beats silence; the tempo-aware full-song play-through is
    // Phase B (SONG-MODE-DESIGN.md).
    var sectPlayTimers = [];
    function stopSectPlay() { sectPlayTimers.forEach(clearTimeout); sectPlayTimers = []; }
    function playSection(seq) {
      stopSectPlay();
      (seq || []).forEach(function (c, i) {
        sectPlayTimers.push(setTimeout(function () { packPlayChord(c); }, i * 650));
      });
    }
    // The tray is SELF-INJECTED into the progression box (like composeToast /
    // composeRow / the clear-undo banner) - not authored in play/index.html - so
    // the whole feature lives in this file. Built once, into el.prog.parentNode,
    // after the strip. Standard song-form vocabulary (matches catalog `sect`).
    // M-13 g1 section labels - the ONE vocabulary shared by the add-row <select>
    // and the template-suggestion label switcher below.
    // S-PROG-GUIDANCE: Pre-Chorus joins the section set - it's a first-class
    // section in the songwriting canon (the departure+build before the chorus),
    // and it gives the Pre-chorus lift (IV-V) template family a home surface.
    // Solo (operator UAT 2026-07-17): the home for lead/solo-line work built in
    // the Tracks Studio - conventionally sits after the bridge.
    var SONG_SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'];
    var songTrayEl = null, songTrayCueEl = null, songSectSelEl = null, songAddRowEl = null, songMapEl = null,
        songSectionsEl = null, songAssembleBtnEl = null,
        songSuggestEl = null, songSuggestLabelsEl = null, songSuggestChipsEl = null,
        // S-SONG-MODE chrome: the wrap (mode class host), the top-level toggle,
        // and the full-screen Song canvas the tray's builder pieces moved into.
        composeWrapEl = null,
        composeSongEl = null, songCueEl = null, songBuildBtnEl = null;
    // Which section the template chips seed (tappable switcher). Defaults to Verse
    // (the add-row default) - the musician switches to the section they need next.
    var suggestLabel = 'Verse';
    // S-PROG-GUIDANCE: romanText of the suggestion whose FEEL/WHEN/PROVEN
    // guidance panel is open (one at a time; null = all closed). Session-local
    // UI state - a reveal is a moment, not a preference.
    var suggestWhyOpen = null;
    // M-13 g4: drag-swallow flag for the buffer chips, mirroring S-PROG-REORDER's
    // dragSwallowClick (own flag/listener - the progression drag code is untouched
    // per the goalpost's boundary; the grammar is reused, not shared, on purpose).
    var sectionDragSwallowClick = false;
    function ensureSongTray() {
      if (songTrayEl) return true;
      if (!el.prog || !el.prog.parentNode) return false;
      // S-SONG-MODE: three pieces of chrome, built once.
      //   1. The mode toggle (Chords | Song) at the very top of .composeWrap.
      //   2. The slim Chords-mode tray (cue + capture row) inside the progBox.
      //   3. The full-screen Song canvas (cards + templates + Save song),
      //      appended to .composeWrap so it can own the whole viewport.
      // closest() is browser-only (the Node test stub has no traversal) - fall
      // back to el.prog.parentNode there; every piece still builds + wires, the
      // stub just hosts them flat.
      composeWrapEl = (el.prog.closest ? el.prog.closest('.composeWrap') : null) || el.prog.parentNode;
      songTrayEl = document.createElement('div'); songTrayEl.id = 'songTray'; songTrayEl.className = 'songTray'; songTrayEl.hidden = true;
      // UAT: ONE chrome-tier cue line (the quiet S-POSTPROG-CUE grammar, never a
      // modal) that names the next move contextually - drives assembly confidence.
      songTrayCueEl = document.createElement('p'); songTrayCueEl.id = 'songTrayCue'; songTrayCueEl.className = 'songTrayCue'; songTrayCueEl.hidden = true;
      songAddRowEl = document.createElement('div'); songAddRowEl.id = 'songAdd'; songAddRowEl.className = 'songAdd';
      songSectSelEl = document.createElement('select'); songSectSelEl.id = 'songSectSel'; songSectSelEl.className = 'songSectSel';
      songSectSelEl.setAttribute('aria-label', 'Section label');
      SONG_SECTIONS.forEach(function (lbl) {
        var o = document.createElement('option'); o.value = lbl; o.textContent = lbl;
        if (lbl === 'Verse') o.selected = true; // the most common opening section
        songSectSelEl.appendChild(o);
      });
      var addBtn = document.createElement('button');
      // copy-coach: the button names the OUTCOME (it goes into your song), not
      // the mechanism ("Add section" said what the code does).
      addBtn.type = 'button'; addBtn.id = 'songAddBtn'; addBtn.className = 'btn ghost songAddBtn'; addBtn.textContent = 'Add to song';
      addBtn.onclick = function () { addSongSection(); };
      songAddRowEl.appendChild(songSectSelEl); songAddRowEl.appendChild(addBtn);
      // #262 (operator UAT): the SONG MAP - the draft's section list, tappable,
      // living on the CHORDS surface. The friction was the Song<->Chords
      // round-trip just to see the structure or jump into a section's chords;
      // each chip routes through editSection (the #261 in-place-edit path), so
      // "design a chord and place it into a section" never leaves this screen.
      songMapEl = document.createElement('div'); songMapEl.id = 'songMap'; songMapEl.className = 'songMap';
      songMapEl.setAttribute('role', 'group'); songMapEl.setAttribute('aria-label', 'Song sections - tap to edit');
      songMapEl.hidden = true;
      songTrayEl.appendChild(songTrayCueEl); songTrayEl.appendChild(songMapEl); songTrayEl.appendChild(songAddRowEl);
      el.prog.parentNode.appendChild(songTrayEl); // end of the progression box, below the strip + cue slot
      // --- the mode toggle: screen-level chrome, always visible, top of the wrap.
      // Distinct from the chord list's .chordSeg by SCALE and POSITION (bigger,
      // full-width, above everything) - and the two are never on screen together
      // anyway (Song mode hides the chord list wholesale).
      // S-COMPOSE-CALM: the ambient Chords|Song toggle is RETIRED - the jam
      // surface carries zero song chrome. The canvas is entered on demand
      // (Save sheet / Library) and closed via its own X or hardware Back.
      // --- the Song canvas: the arrangement altitude, full screen when active.
      composeSongEl = document.createElement('div'); composeSongEl.id = 'composeSong'; composeSongEl.className = 'composeSong';
      // S-COMPOSE-CALM slice 2: the P5 pull-cue slot sits at the canvas top -
      // rendered by renderPulljamCue (one-shot notable, session-gated).
      var pulljamSlotEl = document.createElement('div');
      pulljamSlotEl.className = 'notableSlot'; pulljamSlotEl.id = 'pulljamSlot';
      composeSongEl.appendChild(pulljamSlotEl);
      // S-COMPOSE-CALM: the canvas's own dismiss - top-right X, 44px floor.
      var songCloseEl = document.createElement('button');
      songCloseEl.type = 'button'; songCloseEl.id = 'songCanvasClose'; songCloseEl.className = 'songCanvasClose';
      songCloseEl.setAttribute('aria-label', 'Close the song canvas');
      songCloseEl.textContent = '\u2715';
      composeWireTap(songCloseEl, function () { returnToSong = false; setComposeMode('chords'); });
      composeSongEl.appendChild(songCloseEl);
      songCueEl = document.createElement('p'); songCueEl.className = 'songTrayCue songCue';
      songSectionsEl = document.createElement('div'); songSectionsEl.id = 'songSections'; songSectionsEl.className = 'songSections';
      // The one-shot click swallow for section-card drops (capture phase, mirrors
      // el.prog's listener below wireSlotDrag): beats the rm/up/dn wireTap click
      // that would otherwise fire on the card the drop landed on.
      songSectionsEl.addEventListener('click', function (e) {
        if (sectionDragSwallowClick) { e.stopPropagation(); e.preventDefault(); }
      }, true);
      // M-13 g1: template-suggestion panel (shells built once, filled per render
      // by renderSongSuggest). In Song mode it is the "add the next section"
      // surface, so it renders whenever the canvas does - proven options with
      // room to breathe instead of squeezing above the chord picker.
      songSuggestEl = document.createElement('div'); songSuggestEl.id = 'songSuggest'; songSuggestEl.className = 'songSuggest'; songSuggestEl.hidden = true;
      songSuggestLabelsEl = document.createElement('div'); songSuggestLabelsEl.className = 'chordSeg songSuggestLabels';
      songSuggestChipsEl = document.createElement('div'); songSuggestChipsEl.className = 'songSuggestChips';
      songSuggestEl.appendChild(songSuggestLabelsEl); songSuggestEl.appendChild(songSuggestChipsEl);
      // The guided loop's empty-handed entry: build the next section's chords
      // yourself. Same round trip as a template fill, minus the fill.
      songBuildBtnEl = document.createElement('button');
      songBuildBtnEl.type = 'button'; songBuildBtnEl.id = 'songBuildBtn'; songBuildBtnEl.className = 'btn ghost songBuildBtn'; songBuildBtnEl.textContent = 'Build the chords';
      composeWireTap(songBuildBtnEl, function () {
        setComposeMode('chords');
        // UAT-2 (2026-07-16): this path's intent is unambiguous - a NEW section -
        // so it starts from a clean strip instead of appending onto the last
        // section's leftover chords. Routed through clearProgression (the same
        // guarded snapshot -> Undo-banner path as the Clear button), so it is
        // reversible; a Chords-mode capture still keeps the progression (A3 -
        // the chorus is usually the verse, edited).
        clearProgression();
        pinKeyToDraft(); // UAT r5 F2: the next section builds in the SONG's key
        returnToSong = true; // programmatic switch keeps the loop; toggle taps clear it
      });
      songAssembleBtnEl = document.createElement('button');
      // copy-coach: "Assemble" was builder jargon; the outcome is a saved song.
      songAssembleBtnEl.type = 'button'; songAssembleBtnEl.id = 'songAssembleBtn'; songAssembleBtnEl.className = 'btn red songAssembleBtn';
      songAssembleBtnEl.textContent = 'Save song'; songAssembleBtnEl.hidden = true;
      songAssembleBtnEl.onclick = function () { assembleSong(); };
      composeSongEl.appendChild(songCueEl);
      composeSongEl.appendChild(songSectionsEl);
      composeSongEl.appendChild(songSuggestEl);
      composeSongEl.appendChild(songBuildBtnEl);
      composeSongEl.appendChild(songAssembleBtnEl);
      composeWrapEl.appendChild(composeSongEl);
      return true;
    }
    // The realization key for template chips: the live Compose songKey when one is
    // set, else the key the buffered sections establish (deriveProgressionKey does
    // exactly this fallback). Post-Clear the inferred key is nulled, so the SONG's
    // own key (the verse the musician already wrote) is what the chips realize in.
    function suggestKey() {
      var km = deriveProgressionKey(buildSongFromSections(songSections).seq);
      // S-SONG-MODE: an EMPTY canvas still shows proven starters (the pedagogy
      // first-minute rule: sound within one tap) - fall back to C major so the
      // template chips realize instead of rendering "no template in this key".
      // deriveProgressionKey already preferred the live Compose songKey when set.
      if (!km.key) return { root: 'C', mode: 'major' };
      return { root: km.key, mode: km.mode };
    }
    // Provenance line for a chip: a mined pattern cites its first real song; a
    // canonical family names itself (minus the roman parenthetical the chip's own
    // roman line already shows).
    function suggestProv(s) {
      if (s.source === 'mined') {
        var c = (s.citations && s.citations[0]) || null;
        return c ? ('from ' + c) : 'from the catalog';
      }
      return s.name ? s.name.replace(/\s*\(.*\)\s*$/, '') : 'proven';
    }
    // M-13 g3: the text a recorded PREFERENCE can match against - a mined
    // suggestion's real-song citations (the musician's own catalog), a
    // family's own name (minus the roman parenthetical, matching suggestProv).
    function suggestMatchText(s) {
      if (s.source === 'mined') return (s.citations || []).join(' ');
      return s.name ? s.name.replace(/\s*\(.*\)\s*$/, '') : '';
    }
    // The previous buffered section's LAST chord as a roman in the song key -
    // the seam a new section arrives from (feeds the adjacent-section ranking).
    function prevSectionLastRoman(keyRoot) {
      var C = global.Circle;
      if (!songSections.length || !C || typeof C.romanFor !== 'function' || !keyRoot) return null;
      var prev = songSections[songSections.length - 1];
      var seq = prev && prev.seq;
      if (!seq || !seq.length) return null;
      return C.romanFor(seq[seq.length - 1], keyRoot) || null;
    }
    // Realized template suggestions for a section, in the current song key. Reads
    // SongTemplates.forSection (the M-12 SSOT - CATALOG-mined patterns first by
    // count, then proven families; CATALOG is songs.json, the proven library, NOT
    // the user's own customs, per the UAT "proven songs, not mine" ask), realizes
    // each roman pattern into canonical-sharp tokens, SKIPS any with an unrealizable
    // roman (no approximation), then RE-RANKS by adjacent-section fit (a suggestion
    // that arrives from the previous section's last chord ranks up) FIRST, then by
    // the musician's OWN competency profile (M-13 g3: personalizeSuggestions - a
    // re-rank + a one-line why-cue on `_tag`, never a filter), keeping forSection's
    // proven order as the final stable tiebreak. Caps at 4.
    function templateSuggestions(label, km) {
      var ST = global.SongTemplates;
      if (!ST || typeof ST.forSection !== 'function' || !km || !km.root) return [];
      var raw = ST.forSection(label, CATALOG) || [];
      var prevRoman = prevSectionLastRoman(km.root);
      var out = [];
      raw.forEach(function (s, i) {
        var tokens = realizeSection(s.roman, km.root);
        if (!tokens) return; // unrealizable roman -> skip, never approximate
        out.push({
          tokens: tokens,
          romanText: s.roman.join('-'),
          chordText: tokens.map(function (t) { return dispChordNameInKey(t, km.root, km.mode); }).join(' '),
          prov: suggestProv(s),
          // S-PROG-GUIDANCE: the chooser's revealable guidance (feel/when from
          // the family - present on mined entries too when the pattern IS a
          // known family, via forSection's sig->family attach). provenText is
          // the PROVEN row: real-song citations for mined, the canon note for
          // pure families.
          feel: s.feel || null,
          when: s.when || null,
          provenText: (s.source === 'mined' && s.citations && s.citations.length)
            ? s.citations.slice(0, 3).join(', ')
            : (s.note || null),
          _order: i,                                                  // forSection's proven rank (mined-first) - stable tiebreak
          _connect: sectionConnectScore(prevRoman, s.roman[0]),       // arrival from the previous section
          _complexity: suggestionComplexity(s.roman),                 // M-13 g3: skill-nudge input
          _matchText: suggestMatchText(s)                             // M-13 g3: preference-match input
        });
      });
      personalizeSuggestions(out, competencyProfile('music-composition'));
      out.sort(function (a, b) { return (b._connect - a._connect) || (b._boost - a._boost) || (a._order - b._order); });
      return out.slice(0, 4);
    }
    // UAT assembly cue: ONE contextual line naming the next move (quiet chrome, not
    // a modal). copy-coach: short, sentence case, jargon-honest. S-SONG-MODE split
    // the cue per view: the tray line teaches capture, the canvas line teaches
    // arrangement (empty state doubles as the one-line "what is a song" lesson,
    // in the beginner vocabulary budget).
    function songTrayCue(hasProg, hasSections) {
      if (hasProg && !hasSections) return 'Add this as a section to start a song.';
      // #262: the song-map's one-shot lesson (dismissible, own key - see the
      // renderSongTray call site picking 'songmap' vs 'capture').
      if (hasSections) return 'Your song so far - tap a section to edit its chords.';
      return '';
    }
    function songCanvasCue(hasSections) {
      return hasSections
        ? 'Tap play to hear a section. Add more, or save when it feels done.'
        : 'A song is chords arranged in sections - verse, chorus, bridge. Start with a proven one, or build your own.';
    }
    // UAT r2 (2026-07-16): "the text guidance should be dismissal messages" -
    // teaching lines are one-shot DISMISSIBLE tips (the notables grammar:
    // teach at the moment of relevance, once; a dismissed lesson never burns
    // the row again - pedagogy earned-silence). Dismissals persist per lesson
    // key (additive storage), so each cue teaches exactly once per device.
    var CUE_DISMISS_KEY = prefix + ".cueDismissed.v1";
    var cueDismissed = {};
    try { cueDismissed = JSON.parse(localStorage.getItem(CUE_DISMISS_KEY) || '{}') || {}; } catch (e) { cueDismissed = {}; }
    function renderCue(host, key, text) {
      if (!host) return;
      host.innerHTML = '';
      if (!text || cueDismissed[key]) { host.hidden = true; return; }
      host.hidden = false;
      var t = document.createElement('span'); t.className = 'cueText'; t.textContent = text;
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'cueDismiss'; x.textContent = '×';
      x.setAttribute('aria-label', 'Dismiss this tip');
      composeWireTap(x, function () {
        cueDismissed[key] = true;
        safeSet(CUE_DISMISS_KEY, JSON.stringify(cueDismissed));
        renderSongTray();
      });
      host.appendChild(t); host.appendChild(x);
    }
    // Fill the empty progression from a tapped template chip, THROUGH addChord -
    // the SAME path chord taps use, so packs/voicings resolve and A3 clear-undo
    // invalidates exactly as a manual build would. Carries the seeded section
    // forward by pre-setting the add-row label, so the next "Add section" tags it
    // as the section the musician was building.
    function fillFromTemplate(tokens, label) {
      if (!tokens || !tokens.length) return;
      // S-SONG-MODE guided loop: templates are tapped on the Song canvas but
      // chords are edited in ONE place - drop into Chords mode with the fill
      // loaded, and let the next "Add to song" return to the canvas.
      setComposeMode('chords');
      returnToSong = true; // set AFTER the switch: toggle taps clear it, this programmatic hop must not
      pinKeyToDraft(); // UAT r5 F2: a template fill edits THIS song - stay in its key
      tokens.forEach(function (t) { addChord(t); });
      if (songSectSelEl) songSectSelEl.value = label;
      packPlayChord(tokens[tokens.length - 1]); // audible confirmation of the fill
      showComposeToast('Filled a ' + label.toLowerCase() + ' - tweak it, then Add to song.');
      recordComp('comp-progressions'); // M-13 g3: accepting a proven suggestion IS progression evidence
    }
    // Returns the number of chips rendered so the tray cue (below) knows whether
    // proven options actually surfaced - avoids a querySelector the lightweight
    // test DOM does not implement.
    function renderSongSuggest(show) {
      if (!songSuggestEl) return 0;
      songSuggestEl.hidden = !show;
      if (!show) { songSuggestChipsEl.innerHTML = ''; return 0; }
      // Tappable section-label switcher (reuses the .chordSeg segmented primitive).
      songSuggestLabelsEl.innerHTML = '';
      SONG_SECTIONS.forEach(function (lbl) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chordSegBtn' + (lbl === suggestLabel ? ' on' : '');
        b.textContent = lbl;
        b.setAttribute('data-label', lbl);
        b.setAttribute('aria-pressed', lbl === suggestLabel ? 'true' : 'false');
        composeWireTap(b, function () { if (suggestLabel !== lbl) { suggestLabel = lbl; renderSongTray(); } });
        songSuggestLabelsEl.appendChild(b);
      });
      // Realized chips for the selected label.
      songSuggestChipsEl.innerHTML = '';
      var km = suggestKey();
      var suggestions = templateSuggestions(suggestLabel, km);
      if (!suggestions.length) {
        var none = document.createElement('p'); none.className = 'songSuggestNone';
        none.textContent = 'No proven ' + suggestLabel.toLowerCase() + ' template in this key yet.';
        songSuggestChipsEl.appendChild(none);
        return 0;
      }
      suggestions.forEach(function (s) {
        // S-PROG-GUIDANCE (operator UAT 2026-07-17): each suggestion is now a
        // ROW - the fill chip plus a "?" reveal (the Studio solo view's "?"
        // convention) that opens a FEEL / WHEN / PROVEN guidance ladder. The
        // "?" is a SIBLING, never nested (a button can't contain a button);
        // one panel open at a time so the list stays scannable (pedagogy:
        // reveal on demand, never push prose).
        var item = document.createElement('div'); item.className = 'songSuggestItem';
        var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'songSuggestChip';
        // M-13 g3: the why-cue rides the SAME provenance line (one visible line,
        // no new element/style - Element Consistency Law) - '<prov> · <tag>' when
        // the profile produced a tag, else the provenance line unchanged.
        var provText = s.prov + (s._tag ? ' · ' + s._tag : '');
        chip.setAttribute('aria-label', 'Fill ' + suggestLabel + ' with ' + s.chordText + (s._tag ? ', ' + s._tag : ''));
        var rn = document.createElement('span'); rn.className = 'ssRoman'; rn.textContent = s.romanText;
        var ch = document.createElement('span'); ch.className = 'ssChords'; ch.textContent = s.chordText;
        var pv = document.createElement('span'); pv.className = 'ssProv'; pv.textContent = provText;
        chip.appendChild(rn); chip.appendChild(ch); chip.appendChild(pv);
        composeWireTap(chip, function () { fillFromTemplate(s.tokens, suggestLabel); });
        item.appendChild(chip);
        var hasGuidance = !!(s.feel || s.when || s.provenText);
        if (hasGuidance) {
          var open = (suggestWhyOpen === s.romanText);
          var why = document.createElement('button'); why.type = 'button';
          why.className = 'ssWhy' + (open ? ' on' : '');
          why.textContent = '?';
          why.setAttribute('aria-expanded', open ? 'true' : 'false');
          why.setAttribute('aria-label', (open ? 'Hide' : 'Show') + ' guidance for ' + s.romanText);
          composeWireTap(why, function () {
            suggestWhyOpen = open ? null : s.romanText;
            renderSongTray();
          });
          item.appendChild(why);
          if (open) {
            var panel = document.createElement('div'); panel.className = 'ssWhyPanel';
            var addRow = function (label, text) {
              if (!text) return;
              var r = document.createElement('div'); r.className = 'ssWhyRow';
              var l = document.createElement('span'); l.className = 'ssWhyLbl'; l.textContent = label;
              var t = document.createElement('span'); t.className = 'ssWhyTxt'; t.textContent = text;
              r.appendChild(l); r.appendChild(t); panel.appendChild(r);
            };
            addRow('Feel', s.feel);
            addRow('When', s.when);
            addRow('Proven', s.provenText);
            item.appendChild(panel);
          }
        }
        songSuggestChipsEl.appendChild(item);
      });
      return suggestions.length;
    }
    function renderSongTray() {
      if (!ensureSongTray()) return;
      var hasProg = progression.length >= 1;
      var hasSections = songSections.length >= 1;
      var inSong = composeMode === 'song';
      // Screen chrome: the wrap class is what actually swaps the two full-screen
      // views (CSS: .composeWrap.songMode hides the editor + picker, shows the
      // canvas); the toggle's active state + the Song count badge track every
      // render so parked work stays visible from Chords mode.
      if (composeWrapEl && composeWrapEl.classList) composeWrapEl.classList.toggle('songMode', inSong);
      // --- S-COMPOSE-CALM: the tray (capture row + map) is TRANSACTION
      // chrome, not ambient chrome. It shows only while a canvas-initiated
      // edit is in flight (a template fill / "Build the chords" hop, or an
      // in-place section edit) - a plain jam session never sees it. Jam-side
      // adds go through the Save sheet's "Add to your song" instead.
      var inFlight = returnToSong || (editingSectionIdx != null);
      songTrayEl.hidden = inSong || !inFlight || (!hasProg && !hasSections);
      songAddRowEl.hidden = !hasProg;
      // #262: the tappable song map - one chip per section, in song order,
      // duplicates numbered ("Verse 2") so every chip names a distinct target.
      // Tap = editSection (the #261 path): chords load into the strip in
      // edit-in-place mode, no Song-tab round-trip. The chip being edited
      // carries the active state.
      if (songMapEl) {
        songMapEl.hidden = inSong || !inFlight || !hasSections;
        songMapEl.innerHTML = '';
        if (!songMapEl.hidden) {
          var seen = {};
          songSections.forEach(function (sec, i) {
            seen[sec.label] = (seen[sec.label] || 0) + 1;
            var nth = seen[sec.label];
            var disp = nth > 1 ? sec.label + ' ' + nth : sec.label;
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'songMapChip' + (editingSectionIdx === i ? ' on' : '');
            chip.textContent = disp;
            chip.setAttribute('aria-label', 'Edit ' + disp);
            chip.setAttribute('aria-pressed', editingSectionIdx === i ? 'true' : 'false');
            composeWireTap(chip, function () { editSection(i); });
            songMapEl.appendChild(chip);
          });
        }
      }
      // UAT r2: cues render as dismissible one-shot tips (see renderCue). The
      // map lesson gets its OWN dismissal key so dismissing the capture cue
      // never mutes it (and vice versa).
      renderCue(songTrayCueEl, hasSections ? 'songmap' : 'capture', inSong ? '' : songTrayCue(hasProg, hasSections));
      // --- Song-mode canvas: cue + cards + templates + actions.
      // Templates render whenever the canvas does - in Song mode they ARE the
      // "add the next section" surface (and the empty state's proven starters).
      renderSongSuggest(inSong);
      renderPulljamCue(inSong);
      renderCue(songCueEl, hasSections ? 'canvas-live' : 'canvas-empty', inSong ? songCanvasCue(hasSections) : '');
      if (songAssembleBtnEl) songAssembleBtnEl.hidden = !hasSections;
      songSectionsEl.innerHTML = '';
      if (!inSong) return; // cards are canvas furniture; skip the build when hidden
      // Respell card chord names in the song's own key (same speller path the
      // template chips use) - the card must read like the sheet will.
      var km = suggestKey();
      songSections.forEach(function (sec, i) {
        // S-SONG-MODE: a full CARD, not a label chip - the section's chords are
        // visible and playable right on the canvas (recognition over recall: you
        // can see and HEAR what's in a section before you arrange or save it).
        var chip = document.createElement('div'); chip.className = 'songSect card';
        var name = document.createElement('span'); name.className = 'songSectName';
        // Label + chord count so a Verse x2 and a 3-vs-5-chord section stay
        // distinguishable at a glance.
        name.textContent = sec.label + ' · ' + sec.seq.length;
        chip.appendChild(name);
        // M-13 g4: the card is draggable to reorder - see wireSectionDrag below
        // moveSongSection. The up/dn handles (below) stay as the keyboard/SR path.
        wireSectionDrag(chip, i);
        var play = document.createElement('button'); play.type = 'button'; play.className = 'songSectPlay';
        play.innerHTML = '&#9654;'; play.setAttribute('aria-label', 'Play ' + sec.label);
        composeWireTap(play, function () { playSection(sec.seq); });
        chip.appendChild(play);
        // S-SECTION-EDIT: ✎ loads THIS section's chords straight into the builder
        // so the operator can refine one part without rebuilding it - "Add to
        // song" then updates this section in place (see editSection/addSongSection).
        var edit = document.createElement('button'); edit.type = 'button'; edit.className = 'songSectEdit';
        edit.innerHTML = '&#9998;'; edit.setAttribute('aria-label', 'Edit ' + sec.label + ' chords in the builder');
        composeWireTap(edit, (function (idx) { return function () { editSection(idx); }; })(i));
        chip.appendChild(edit);
        // S-COMPOSE-CALM slice 2 (songwriting-coach: chorus reuse is one tap):
        // duplicate THIS section right after itself.
        var dup = document.createElement('button'); dup.type = 'button'; dup.className = 'songSectDup';
        dup.innerHTML = '&#10697;'; dup.setAttribute('aria-label', 'Duplicate ' + sec.label);
        composeWireTap(dup, (function (idx) { return function () {
          var src = songSections[idx]; if (!src) return;
          songSections.splice(idx + 1, 0, { label: src.label, seq: src.seq.slice() });
          disarmRm();
          saveSongSections();
          recordComp('comp-song-form');
          renderSongTray();
        }; })(i));
        chip.appendChild(dup);
        var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×';
        rm.setAttribute('aria-label', 'Remove ' + sec.label + ' section');
        // Reuse the ONE inline-remove grammar (armRm/disarmRm): quiet at rest,
        // first tap arms red (1600ms auto-disarm), second tap removes.
        composeWireTap(rm, function () {
          if (armedRm !== rm) { armRm(rm); return; }
          disarmRm();
          stopSectPlay();
          songSections.splice(i, 1);
          saveSongSections();
          // Phase B: an emptied draft drops its saved-song link - a brand-new
          // draft built afterwards must save fresh, never overwrite the old song.
          if (!songSections.length && builderSourceId) { builderSourceId = null; saveBuilderSource(); }
          renderSongTray();
        });
        // M-13 g2: reorder handles - real 44px hit targets (a11y-coach floor),
        // small decorative glyph via ::before, matching the .rm halo convention.
        // Disabled (native `disabled`, not just a CSS class) at the buffer's
        // ends so composeWireTap's click listener never fires there.
        var up = document.createElement('button'); up.type = 'button'; up.className = 'songSectMove up';
        up.innerHTML = '&#9650;'; up.setAttribute('aria-label', 'Move ' + sec.label + ' up');
        up.disabled = (i === 0);
        composeWireTap(up, function () { moveSongSection(i, -1); });
        var dn = document.createElement('button'); dn.type = 'button'; dn.className = 'songSectMove dn';
        dn.innerHTML = '&#9660;'; dn.setAttribute('aria-label', 'Move ' + sec.label + ' down');
        dn.disabled = (i === songSections.length - 1);
        composeWireTap(dn, function () { moveSongSection(i, 1); });
        chip.appendChild(up); chip.appendChild(dn);
        chip.appendChild(rm);
        // Row 2: the chords themselves, respelled in the song key.
        var line = document.createElement('span'); line.className = 'songSectChords';
        line.textContent = sec.seq.map(function (t) { return dispChordNameInKey(t, km.root, km.mode); }).join('  ');
        chip.appendChild(line);
        songSectionsEl.appendChild(chip);
      });
    }
    // M-13 g2: swap section i with its neighbor at i+dir (-1 up, +1 down). No-op
    // past either end (the disabled buttons already guard this, but a defensive
    // bounds check keeps the function safe if ever called directly).
    function moveSongSection(i, dir) {
      var j = i + dir;
      if (j < 0 || j >= songSections.length) return;
      var tmp = songSections[i]; songSections[i] = songSections[j]; songSections[j] = tmp;
      disarmRm(); // reordering changes chip identity under any armed remove handle
      saveSongSections();
      renderSongTray();
    }
    // M-13 g4 (operator directive 2026-07-11): DRAG-to-reorder the buffer chips,
    // reusing the S-PROG-REORDER interaction grammar (pointer-events, long-press
    // lift on touch, movement-slop lift on mouse, 2D nearest-center targeting so
    // the chip strip's flex-wrap second row just works, accent insertion-edge
    // marker, trailing-click swallow). The up/dn handles from g2 STAY as the
    // a11y/keyboard-and-SR-safe fallback - drag is additive, not a replacement.
    // Mirrored (not shared) deliberately: the goalpost's boundary keeps the
    // progression chord-drag code path untouched, so this is its own small
    // copy against the songSections array + its own save/render path instead
    // of `progression` + renderProg/renderSuggest/renderKey.
    function wireSectionDrag(chip, index) {
      chip.addEventListener('pointerdown', function (e) {
        if (songSections.length < 2) return;
        var id = e.pointerId, startX = e.clientX, startY = e.clientY;
        var isTouch = e.pointerType === 'touch';
        var lifted = false, dropAt = null, marked = null, holdTimer = null;
        function chipsNow() { return Array.prototype.slice.call(songSectionsEl.children); }
        function clearMark() { if (marked) { marked.classList.remove('dropBefore'); marked.classList.remove('dropAfter'); marked = null; } }
        function blockScroll(ev) { ev.preventDefault(); }
        function lift() {
          holdTimer = null;
          lifted = true;
          chip.classList.add('dragging');
          try { chip.setPointerCapture(id); } catch (err) {}
          document.addEventListener('touchmove', blockScroll, { passive: false });
        }
        function onMove(ev) {
          if (ev.pointerId !== id) return;
          if (!lifted) {
            var moved = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
            if (isTouch) { if (moved > 8) cleanup(); }
            else if (moved > 6) lift();
            return;
          }
          if (ev.cancelable) ev.preventDefault();
          clearMark();
          var list = chipsNow(), best = -1, bestD = Infinity, bestCx = 0;
          for (var s = 0; s < list.length; s++) {
            var r = list[s].getBoundingClientRect();
            var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            var d = Math.abs(ev.clientX - cx) + Math.abs(ev.clientY - cy);
            if (d < bestD) { bestD = d; best = s; bestCx = cx; }
          }
          if (best < 0) { dropAt = null; return; }
          var after = ev.clientX > bestCx;
          dropAt = best + (after ? 1 : 0);
          marked = list[best];
          marked.classList.add(after ? 'dropAfter' : 'dropBefore');
        }
        function onUp(ev) {
          if (ev.pointerId !== id) return;
          var commit = lifted && dropAt != null;
          var to = dropAt;
          cleanup();
          if (!commit) return;
          // swallow the click that trails this pointerup so the drop never
          // ALSO fires the rm/up/dn wireTap of the chip it landed on.
          sectionDragSwallowClick = true;
          setTimeout(function () { sectionDragSwallowClick = false; }, 150);
          var insert = to > index ? to - 1 : to;
          if (insert === index) return;
          disarmRm(); // reordering changes chip identity under any armed remove handle
          var movedSec = songSections.splice(index, 1)[0];
          songSections.splice(insert, 0, movedSec);
          saveSongSections();
          renderSongTray();
        }
        function cleanup() {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          clearMark();
          chip.classList.remove('dragging');
          try { chip.releasePointerCapture(id); } catch (err) {}
          document.removeEventListener('touchmove', blockScroll);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        }
        if (isTouch) holdTimer = setTimeout(lift, 300);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
    }
    // Snapshot the CURRENT progression (canonical-sharp tokens) as a labeled
    // section. A3: additive - does NOT mutate the progression, so it does NOT
    // invalidate the Clear-undo snapshot. Does NOT clear the progression (the
    // musician often builds the chorus by editing the verse).
    // S-SECTION-EDIT: pull a buffered section's chords back INTO the builder to
    // refine it. Loads its seq into the progression, marks it as the section
    // being edited, points the label selector at it, and drops into the Chords
    // builder so the chords are right there to tweak. "Add to song" then routes
    // through the editingSectionIdx update path below (replace, not append).
    function editSection(i) {
      if (i < 0 || i >= songSections.length) return;
      var sec = songSections[i];
      stopSectPlay(); disarmRm();
      progression = sec.seq.slice(); cTpose = 0;
      editingSectionIdx = i;
      // Operator UAT 2026-07-17 round 2: NEVER append a foreign label as an
      // option ("don't name things Progression") - the dropdown speaks only the
      // standard section set. Labels are normalized at every load boundary
      // (loadSongSections, sectionsFromSheet), so a mismatch here is a truly
      // custom label: default the select to the FIRST standard option and let
      // the user pick - never a blank control, never a poisoned vocabulary.
      if (songSectSelEl) {
        var has = Array.prototype.some.call(songSectSelEl.options || [], function (o) { return o.value === sec.label; });
        songSectSelEl.value = has ? sec.label
          : (songSectSelEl.options && songSectSelEl.options.length ? songSectSelEl.options[0].value : '');
      }
      chordView = null;
      reinferKey();
      renderProg(); renderSuggest(); renderKey();
      if (el.keyRoots) { renderKeyView(); buildGrid(); }
      setComposeMode('chords');
      // #262: setComposeMode no-ops when already in Chords (the song-map tap
      // case) - re-render the tray explicitly so the tapped chip takes the
      // active state and the add-row reappears for the loaded strip.
      renderSongTray();
      showComposeToast('Editing ' + sec.label + ' - tweak it, then Add to song to update.');
    }
    function addSongSection() {
      if (!progression.length) { showComposeToast('Build a progression first.', true); return; }
      var label = (songSectSelEl && songSectSelEl.value) || 'Verse';
      // S-SECTION-EDIT: refining an existing section UPDATES it in place (same
      // slot, new label + chords) instead of appending a duplicate. Read the
      // index first - clearProgression() below nulls editingSectionIdx.
      var editing = editingSectionIdx;
      if (editing != null && editing >= 0 && editing < songSections.length) {
        songSections[editing] = { label: label, seq: progression.slice() };
        disarmRm();
        saveSongSections();
        recordComp('comp-song-form');
        clearProgression('Updated ' + label + ' in your song. Strip cleared - Undo to keep editing.');
        renderSongTray();
        return;
      }
      // S-COMPOSE-CALM slice 2 (songwriting-coach: key consistency): a pull
      // from a differently-keyed jam OFFERS transpose-on-pull. Compare the
      // strip's key against the DRAFT's own inferred key (plain inferKey on
      // the sections' chords - suggestKey would echo the live strip key back).
      var pulled = progression.slice();
      if (songSections.length) {
        var draftIk = inferKey(buildSongFromSections(songSections).seq);
        // The strip's OWN key, inferred from its chords - NOT songKey.root,
        // which the canvas hop deliberately pins to the SONG's key (so an
        // A-D-E part built under a pinned C would read as "C" there).
        var stripIk = inferKey(pulled);
        // Relative major/minor share one pitch set (songwriting-coach): a
        // vi-IV part inferred as "A minor" under a C-major draft is NOT a key
        // departure - never ask there. Compare relative-MAJOR roots.
        function relMajorRoot(ik) {
          if (!ik || !ik.root) return null;
          var i = ROOTS.indexOf(ik.root);
          if (i < 0) return ik.root;
          return String(ik.mode || '').toLowerCase() === 'minor' ? ROOTS[(i + 3) % 12] : ik.root;
        }
        if (draftIk && draftIk.root && stripIk && stripIk.root && relMajorRoot(draftIk) !== relMajorRoot(stripIk)) {
          openTransposeAskRow(stripIk.root, draftIk, label, pulled);
          return; // the ask's deliver() re-enters commitSongSection
        }
      }
      commitSongSection(label, pulled);
    }
    // The actual section commit - shared by the direct path and the
    // transpose-on-pull ask (which may hand over a transposed copy).
    function commitSongSection(label, seq) {
      songSections.push({ label: label, seq: seq });
      disarmRm(); // a fresh add clears any armed chip remover
      saveSongSections();
      recordComp('comp-song-form'); // M-COMPETENCY: shaping a section = song-form practice (small)
      // S-SONG-MODE guided loop: a capture that started from the Song canvas (a
      // template fill or "Build the chords") returns there; a plain Chords-mode
      // capture stays put so a musician mid-noodle never loses their editor.
      if (returnToSong) {
        showComposeToast('Added ' + label + ' to the song.');
        // S-COMPOSE-CALM: the capture semantics are ONE contract everywhere
        // (UAT r2): a captured strip clears so the next idea starts fresh -
        // the hop path previously kept it, leaving a stale strip behind the
        // canvas. Clear BEFORE the switch; the undo banner lands on the jam
        // surface for when the user returns there.
        returnToSong = false;
        clearProgression('Added ' + label + ' to the song. Strip cleared - Undo to keep editing.');
        setComposeMode('song'); return;
      }
      // UAT r2 (2026-07-16): a captured section now CLEARS the strip so the next
      // section starts FRESH. The operator hit "new-section chords append to the
      // old" twice - the A3 keep-the-progression default (2026-07: "the chorus
      // is usually the verse, edited") lost to lived evidence. The edit-the-verse
      // workflow is fully preserved: the Clear-undo banner's Undo restores these
      // exact chords to edit. And the persistent, pausable banner replaces the
      // too-fast "Added X" toast the operator couldn't read (finding 2). The
      // clear snapshots for undo, so nothing is ever lost.
      clearProgression('Added ' + label + ' to your song. Strip cleared for your next section - Undo to edit these chords.');
      renderSongTray();
    }
    // S-COMPOSE-CALM slice 2 (P5 pedagogy, design doc): a songwriter with a
    // SAVED progression learns, once, that it can become a section. Fires on
    // a canvas render when a progression-only custom exists; one-shot +
    // level-gated (intermediate) + session-gated like every notable.
    function renderPulljamCue(inSong) {
      var slot = document.getElementById('pulljamSlot');
      if (!slot) return;
      slot.innerHTML = '';
      if (!inSong || !global.Notables) return;
      var hasProgCustom = customSongs.some(function (c) { return c && c.seq && c.seq.length && !c.sheet; });
      if (!hasProgCustom) return;
      var GL = guidanceLevelRef();
      if (!global.Notables.claim('pulljam', undefined, GL && GL.get ? GL.get() : null)) return;
      var banner = global.Notables.renderBanner({
        consumerId: 'pulljam',
        text: 'A saved progression can become a section - open it from the Library, then Add to song.',
        onDismiss: function () { slot.innerHTML = ''; }
      });
      if (banner) slot.appendChild(banner);
    }
        // S-COMPOSE-CALM slice 2: the transpose-on-pull ask. Strip key differs
    // from the draft's own key - offer to shift the pulled copy into the
    // song's key (songwriting-coach: sections share the song key) or keep it
    // as a deliberate departure. Cancel aborts the add; the strip survives.
    function openTransposeAskRow(stripRoot, draftIk, label, pulled) {
      var delta = (ROOTS.indexOf(draftIk.root) - ROOTS.indexOf(stripRoot) + 12) % 12;
      if (!ensureComposeUI() || delta === 0) { commitSongSection(label, pulled); return; }
      hideComposeRow();
      composeRow.hidden = false;
      composeRow.classList.add('asModal');
      if (composeModalBackdrop) composeModalBackdrop.hidden = false;
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      msg.textContent = 'This part is in ' + stripRoot + ' - your song is in ' + draftIk.root + ' ' + (draftIk.mode || 'major') + '.';
      var shiftBtn = document.createElement('button');
      shiftBtn.type = 'button'; shiftBtn.className = 'btn red ctrlBtn';
      shiftBtn.textContent = 'Shift it to ' + draftIk.root;
      var keepBtn = document.createElement('button');
      keepBtn.type = 'button'; keepBtn.className = 'btn ghost ctrlBtn';
      keepBtn.textContent = 'Keep it in ' + stripRoot;
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Keep building';
      var delivered = false;
      function rawClose() { hideComposeRow(); }
      function deliver(choice) {
        if (delivered) return; delivered = true;
        if (choice === 'shift') commitSongSection(label, pulled.map(function (c) { return tpose(c, delta); }));
        else if (choice === 'keep') commitSongSection(label, pulled);
        // 'cancel': the add aborts; the strip is untouched (returnToSong, if
        // armed by the sheet, stays armed for the next attempt - harmless).
      }
      var pendingDismiss = 'cancel';
      function choose(choice) {
        pendingDismiss = choice;
        if (window.NavHistory) window.NavHistory.settleAfter(function () { rawClose(); }, function () { deliver(choice); });
        else { rawClose(); deliver(choice); }
      }
      shiftBtn.onclick = function () { choose('shift'); };
      keepBtn.onclick = function () { choose('keep'); };
      cancelBtn.onclick = function () { choose('cancel'); };
      composeRow.onkeydown = function (e) { if (e.key === 'Escape') choose('cancel'); };
      if (composeModalBackdrop) composeModalBackdrop.onclick = function () { choose('cancel'); };
      if (window.NavHistory) window.NavHistory.open('composeModal', function () {
        rawClose();
        setTimeout(function () { deliver(pendingDismiss); }, 0);
      });
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      btnRow.appendChild(shiftBtn); btnRow.appendChild(keepBtn); btnRow.appendChild(cancelBtn);
      composeRow.appendChild(msg); composeRow.appendChild(btnRow);
      composeRow.focus();
    }
    // Assemble the buffer into ONE custom song via the existing createCustomItem
    // save path, then open it in the song view. A3: buffer-only op - leaves the
    // progression (and its Clear-undo) intact.
    function assembleSong() {
      if (!songSections.length) { showComposeToast('Add a section first.', true); return; }
      stopSectPlay();
      // Snapshot NOW: the name row waits on a user tap while the canvas stays
      // live behind it (same discipline as saveProgression's snapSeq).
      var built = buildSongFromSections(songSections);
      var km = deriveProgressionKey(built.seq);
      // Phase B: a draft loaded from a saved song ("Continue building") UPDATES
      // that song in place - no new copy, no name prompt (the saveProgression
      // update-in-place precedent). The truthful-signal saveCustom() repeat
      // mirrors that branch exactly (see its comment).
      if (builderSourceId && customById(builderSourceId)) {
        var upd = updateCustomItem(builderSourceId, { seq: built.seq, sheet: built.sheet, key: km.key, mode: km.mode });
        if (upd) {
          var updOk = saveCustom();
          songSections = []; disarmRm(); saveSongSections();
          builderSourceId = null; saveBuilderSource();
          setComposeMode('chords');
          recordComp('comp-song-form'); recordComp('comp-progressions'); recordRepertoire();
          showComposeToast(updOk ? ('Updated ' + upd.t + ' – opening it now.') : SAVE_FAIL_MSG, !updOk);
          if (updOk) openPractice(upd.id);
          return;
        }
        builderSourceId = null; saveBuilderSource(); // the source vanished - fall through to a fresh save
      }
      // S-SONG-MODE: the naming moment. A song the user wrote deserves a name -
      // the old flow shipped every song as "My song" (placeholder text left
      // behind, the S6 finding all over again). Same inline name row + setlist
      // opt-in the progression save uses; cancel keeps the draft intact.
      var defName = km.key ? 'Song in ' + km.key : 'My song';
      openSaveNameRow(defName, function (name, addToSetlist) {
        if (name === null) return; // cancelled - the draft stays on the canvas
        var cs = createCustomItem({
          title: name || defName, seq: built.seq, sheet: built.sheet, key: km.key, mode: km.mode
        });
        songSections = [];
        disarmRm();
        saveSongSections();
        builderSourceId = null; saveBuilderSource(); // Phase B: a fresh save ends any (already-dead) source link
        if (addToSetlist) toggleSet(cs.id, true); // G4/FORK-1: one tap from performance-ready; toTop - a song you just wrote is next up
        // The draft is done - the next Compose visit starts back at the editor.
        setComposeMode('chords');
        // M-COMPETENCY: assembling a whole song is the strongest observable
        // composition evidence - song-form + progressions, plus repertoire on
        // the active instrument (a playable song was produced).
        recordComp('comp-song-form'); recordComp('comp-progressions'); recordRepertoire();
        showComposeToast('Saved ' + cs.t + ' – opening it now.');
        openPractice(cs.id);
      });
    }
    // S-SONG-MODE Phase B ("open songs back up to continue building, not just
    // edit metadata" - operator UAT 2026-07-16): parse a saved song's sheet back
    // into sections, seed the builder, and reopen the Song canvas. Save then
    // updates THIS song in place (builderSourceId above). Guards:
    //   - same song already loaded -> just switch to the canvas (tap-twice safe)
    //   - a DIFFERENT unsaved draft exists -> refuse with an honest toast, never
    //     clobber unsaved work (a merge/replace choice is future polish)
    // UAT r5 F2 (operator 2026-07-19): entering the canvas for a REAL song must
    // land the builder in that song's key - "when I continue building I expect
    // the key I'm working in". Derives from the draft's own chords; a song whose
    // key can't be derived leaves the builder key untouched. The pin is a real
    // pick (explicit, not defaulted) so later strip work stays in the song's key.
    function pinKeyToDraft() {
      var seq = buildSongFromSections(songSections).seq;
      if (!seq.length) return;
      var d = global.Repertoire && global.Repertoire.deriveKey ? global.Repertoire.deriveKey({ seq: seq }) : null;
      if (!d || !d.key) return;
      var mode = String(d.mode || 'major').toLowerCase() === 'minor' ? 'Minor' : 'Major';
      if (songKey.root === d.key && songKey.mode === mode && songKey.explicit && !songKey.defaulted) return;
      songKey.root = d.key; songKey.mode = mode; songKey.explicit = true; songKey.defaulted = false;
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
    }
    function continueBuilding(s) {
      if (!s) return;
      var secs = sectionsFromSheet(s.sheet);
      if (!secs.length) { showToast('No chords to build from on this song yet.', true); return; }
      if (songSections.length && builderSourceId !== s.id) {
        showToast('You already have a song in progress (' + songSections.length + (songSections.length === 1 ? ' section' : ' sections') + '). Save or clear it before opening another.', 'warn');
        return;
      }
      if (!songSections.length) { // fresh load; a same-song re-entry keeps the live draft
        songSections = secs;
        saveSongSections();
        builderSourceId = s.id;
        saveBuilderSource();
      }
      pinKeyToDraft(); // F2: the builder follows the song being continued
      switchTab('compose');
      setComposeMode('song'); // nav-aware: hardware Back leaves the canvas, then the tab
    }
    function addChord(c) {
      if (progression.length >= COMPOSE_MAX) return; // D-CAP12
      invalidateClearUndo(); // A3: adding a chord invalidates any pending Clear-undo
      progression.push(c);
      // AUTO-INFER the key once 2+ chords exist and the user never explicitly picked
      // one, so the key chip + in-key palette light up without a key-panel trip. The
      // inferred key stays NON-explicit: it keeps tracking further adds until the user
      // pins a key themselves (root pick / mode pick / named pattern all set explicit).
      var prevRoot = songKey.root, prevMode = songKey.mode;
      // Re-infer through the SAME helper the remove/Clear paths use, so a later
      // chord that makes inference fail CLEARS a stale non-explicit key instead
      // of leaving the old chip/palette (the inline infer only ever set a key,
      // never cleared one - the asymmetry codex flagged).
      reinferKey();
      renderProg(); renderKey();
      // Key changed under an auto-infer: refresh the fly-out content + the chord list
      // (renderKey/buildKeyPicker already refreshed the chip + roots). Skipped when
      // nothing moved so a plain add never rebuilds the grid mid-tap.
      if ((songKey.root !== prevRoot || songKey.mode !== prevMode) && el.keyRoots) {
        renderKeyView(); buildGrid();
      }
    }
    // Symmetric UN-infer for the remove/Clear paths: an auto-inferred
    // (non-explicit) key must keep tracking the progression the same way
    // addChord's infer does - re-infer at 2+ chords, clear entirely below 2.
    // Otherwise a deleted progression leaves a stale key chip + palette.
    // Returns true when the key actually changed (caller refreshes the
    // fly-out + grid, mirroring addChord's conditional rebuild).
    function reinferKey() {
      // A DEFAULTED key re-infers exactly like a keyless one (UAT r5 F1: the
      // landing C must follow the music, not outrank it) - but on inference
      // failure it falls back to the C landing default instead of clearing,
      // so the "get to work immediately" In-key view never dies under it.
      if (songKey.explicit && !songKey.defaulted) return false;
      var prevRoot = songKey.root, prevMode = songKey.mode;
      if (progression.length >= 2) {
        var ik = inferKey(progression);
        if (ik) { songKey.root = ik.root; songKey.mode = ik.mode; }
        else if (songKey.defaulted) { songKey.root = 'C'; songKey.mode = 'Major'; }
        else { songKey.root = null; }
      } else if (songKey.defaulted) {
        songKey.root = 'C'; songKey.mode = 'Major';
      } else {
        songKey.root = null;
      }
      return songKey.root !== prevRoot || songKey.mode !== prevMode;
    }
    // Fill the progression from a named pattern entry, in the user's key (default C
    // Major). Most patterns are major-diatonic, so we anchor to a Major key by
    // default; a W2 Blues starter carries its own `p.mode` (Blues), overriding that
    // default - keep the picked root if there is one, and sync the key picker so the
    // chord palette + solo scale below match what just got filled in.
    function loadProgression(p) {
      invalidateClearUndo(); // A3: a starter pattern replaces the buffer wholesale
      var root = songKey.root || "C";
      // a named pattern sets an explicit key; mode follows the entry (Major default)
      songKey.root = root; songKey.mode = p.mode || "Major"; songKey.explicit = true; songKey.defaulted = false;
      keyPopoverOpen = false; // a key is set now - the root popover stays closed
      progression = chordsFromDegrees(root, songKey.mode, p.degrees);
      cTpose = 0;
      savedComposeId = null; // a starter is a NEW progression - detach from any saved song
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
    }
    function renderProgPicks() {
      // Common progressions now live inside renderSuggest's empty state (the "Next chord"
      // disclosure). The standalone "Common progressions" disclosure (#discPatterns / #progPicks)
      // was removed from the HTML, so el.progPicks is absent. Kept as a guarded no-op.
      if (!el.progPicks) return;
      el.progPicks.innerHTML = '';
    }
    // Short mode labels for the narrow ctrlBar readout (prevents Save button overflow).
    // Full labels are used everywhere else (key picker chip, key-view title).
    var MODE_SHORT = { Major: 'Maj', Minor: 'Min', Mixolydian: 'Mixo', Dorian: 'Dor', Blues: 'Blues' };
    // transpose the whole progression together — the shape moves, the intervals stay (that's the lesson)
    function renderKey() {
      // The song key/mode is now shown by the button-bar chip (#keyPickerCompact), which
      // both displays the current key (root + abbreviated mode - it tracks songKey, which
      // moves on every transpose, so it doubles as the transpose readout) and opens the
      // key/mode fly-out. buildKeyPicker() is the single source of truth for the chip's
      // text + 'shifted' state, so renderKey just refreshes it. (Light: buildKeyPicker is
      // idempotent and already runs on every key/mode/transpose action.)
      buildKeyPicker();
      // P3: the "Solo over a backing track" CTA appears once a key + progression
      // are established (the roadmap precondition for backing-track soloing).
      if (el.soloBackingBtn) {
        var showSolo = !!(songKey.root && progression.length);
        el.soloBackingBtn.hidden = !showSolo;
        // C1 (pilot UAT) - HISTORICAL, kept as defense: songbook.css used to set
        // `.soloBackingBtn{display:block}` unconditionally, with no paired
        // `[hidden]{display:none}` rule (unlike .chips/.keyFlyout/.composeRow). F28/F29
        // renamed the class to `.soloRowBtn` (no display rule), so [hidden] alone now
        // suffices and the inline style.display below is belt-and-suspenders. Back then
        // the author stylesheet's
        // display:block cascades over the UA [hidden] rule and the button stayed
        // visible (and tappable) even with 0 or 1 chords and no key. That falsely
        // "live" button is what read as a one-chord "dead tap" (C3): nothing
        // happens because songKey.root is still null, not because the click
        // handler has a >=2-chord gate (grepped - it doesn't; the >=2 threshold
        // that DOES exist is inferKey's, and it's deliberate - one chord can't
        // establish a key). Pin display inline (wins over any external
        // stylesheet rule short of !important) so hidden actually hides it.
        el.soloBackingBtn.style.display = showSolo ? '' : 'none';
        // G2 S-POSTPROG-CUE: tell the guidance layer whether the progression is
        // Solo-ready - the postprog notable renders/clears off this event (same
        // notifyGuidanceEvent seam as music:compose-transposed).
        notifyGuidanceEvent('music:compose-progression', { soloReady: showSolo, length: progression.length });
      }
    }
    function composeTpose(st) {
      if (!progression.length) return;
      invalidateClearUndo(); // A3: a transpose invalidates any pending Clear-undo
      progression = progression.map(function (c) { return tpose(c, st); });
      cTpose += st;
      // Move the song key with the chords so the readout, diatonic palette and solo
      // scale never drift from what's actually sounding. If a key center exists
      // (explicit pick, or one derived earlier) shift its root by the same delta.
      // D-KEYLESS (m-guide-ia-20260704.md section 4.3): keyless STAYS keyless on
      // transpose - supersedes codex #90 V1's first-chord-fallback per operator
      // input I4. Accepted consequence: the Solo CTA no longer lights from a
      // keyless transpose alone; the pick-a-key CTA carries that path instead.
      if (songKey.root) {
        songKey.root = tpose(songKey.root, st);
      }
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
      // M-GUIDANCE (intermediate tier): "transpose moves the key with it" JIT
      // cue - play/index.html's renderTransposeTipNotable() listens for this.
      notifyGuidanceEvent('music:compose-transposed');
    }
    // MODAL INTERCHANGE (Phase 2). Re-harmonize the whole built progression to a
    // PARALLEL mode: same tonic, same chord ROOTS, but each chord re-QUALIFIED to the
    // target mode's degree quality. C Major I-IV-V (C F G) -> C Minor i-iv-v (Cm Fm Gm).
    // Distinct from transpose (composeTpose): transpose moves roots and keeps qualities;
    // this keeps roots and flips qualities. Called by the one key/mode filter (#keyModes)
    // whenever the mode changes with a progression present AND a key is explicitly set -
    // the keyless case (no root yet) is handled directly by the mode-chip handler via
    // the same pure fn, without resurrecting a root (D-KEYLESS, m-guide-ia-20260704.md
    // section 4). The mapping itself (best-effort: a chromatic/borrowed root is left
    // unchanged; a 7th extension re-bases onto the new triad quality) lives in the pure,
    // exported convertProgressionQualities() above (section 4.5) so both paths share it.
    function convertToMode(targetMode) {
      if (!progression.length || !MODES[targetMode]) return;
      invalidateClearUndo(); // A3: a mode change invalidates any pending Clear-undo
      // Parallel = same tonic. Use the explicit/derived song key root; else the first
      // chord's root. rootPc handles flat spellings; if it can't resolve, bail safely.
      var tonicRoot = songKey.root || (splitChord(progression[0]) || {}).root || null;
      if (tonicRoot == null || rootPc(tonicRoot) == null) return;
      progression = convertProgressionQualities(progression, targetMode, tonicRoot, songKey.mode);
      // Parallel interchange keeps the tonic fixed; only the mode changes. Roots do not
      // move, so cTpose (the transpose-from-origin readout) is intentionally untouched.
      songKey.root = tonicRoot;
      songKey.mode = targetMode;
      songKey.explicit = true;
      songKey.defaulted = false;
      keyPopoverOpen = false;
      renderProg(); renderKey(); buildKeyPicker(); renderKeyView(); buildGrid(); renderSuggest();
    }
    // ADAPTIVE chord surface (Phase 1, consolidated). ONE chord list with an "In key | All"
    // segmented toggle at the top that swaps the list's CONTENT (not two stacked sections):
    //   - "In key": the diatonic chords for the current song key (root + mode), labeled
    //     with Roman numerals. Default when a key is set.
    //   - "All": the full chromatic grid plus the chord-TYPE tabs (Major/Minor/7th/Maj7/
    //     Min7) as a sub-filter. Default when no key is set (and the In-key segment then
    //     prompts to pick a key).
    // The in-key palette lives ONLY here now (renderKeyView is title + the
    // Triads & Inversions link only - the solo scale + HSR chain moved to the
    // Studio), so the diatonic chords are never duplicated.
    // 'chordView' is the segmented-toggle state ('inkey' | 'all'); null = "follow the key"
    // (auto: in-key when a key is set, all otherwise). An explicit user tap pins it.
    var chordView = null;
    // 'allChordsActiveCat' persists which chromatic category tab (Major/Minor/7th/...)
    // is selected across re-renders, so switching tab doesn't reset to the first category.
    var allChordsActiveCat = Object.keys(CATS)[0] || "Major";
    // S-CHORD-COLLAPSE x UAT r5 F5 (operator 2026-07-19): chart visibility is a
    // SETTINGS choice now - the transient in-surface Shapes toggle is retired
    // ("once I'm clear what the chords are, I don't need the charts"). GLOBAL
    // key (person trait, crosses profiles), absent = follow the guidance level
    // (advanced collapses to chips, everyone else sees charts). Distinct from
    // music.diagram.pref.v1 (Dots|Patterns), which styles the diagrams that DO
    // render - this key decides whether they render at all.
    var CHARTS_KEY = 'music.chordCharts.v1'; // 'charts' | 'chips' | absent
    function chartsPref() { try { return localStorage.getItem(CHARTS_KEY); } catch (e) { return null; } }
    // The one effective-visibility rule both the palettes and the filmstrip key
    // off: an explicit pref wins outright; otherwise the level collapse decides.
    function chipsEffective(collapseActive) {
      var p = chartsPref();
      if (p === 'charts') return false;
      if (p === 'chips') return true;
      return !!collapseActive;
    }
    // Resolve the effective view: an explicit pin wins; otherwise follow the key.
    function effectiveChordView() {
      if (chordView === 'inkey' || chordView === 'all') return chordView;
      return songKey.root ? 'inkey' : 'all';
    }
    function buildGrid(opts) {
      opts = opts || {};
      if (!el.catChips || !el.buildGrid) return;
      var chips = el.catChips, grid = el.buildGrid;
      // FLATTENED layout split:
      //   #catChips  = the FIXED In-key|All toggle (stays in .composeTop, never scrolls).
      //   the scroll area (#composeChords) holds the LIST content: in-key lead, the
      //   All-chords type-tab row, and #buildGrid tiles - so only the list scrolls.
      // Redundant headers ("Chords in <key>", "All chords") are dropped: the key/mode chip
      // already shows the key, and the toggle already says which list you're in.
      chips.className = 'chips';
      chips.innerHTML = ''; grid.innerHTML = '';
      // Remove any list-content nodes a prior render appended to the scroll area,
      // keeping #buildGrid (the tiles container) and #suggest (the suggestion surface -
      // renderSuggest owns its content; it leads the scroll area per the UAT fold-in)
      // in place.
      var scroller = el.composeChords;
      if (scroller) {
        Array.prototype.slice.call(scroller.children).forEach(function (n) {
          if (n !== grid && n !== el.suggest) scroller.removeChild(n);
        });
      }
      var view = effectiveChordView();
      // tap handler shared by every chord tile: add to the progression + play, with a
      // brief selected flash for feedback.
      function wireTap(d, c) {
        d.onclick = function () { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); };
        return d;
      }
      // Segmented control: In key | All. One tap pins the view (chordView), then re-render.
      // Stays in the FIXED #catChips.
      var seg = document.createElement('div'); seg.className = 'chordSeg';
      [['inkey', 'In key'], ['all', 'All']].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chordSegBtn' + (view === pair[0] ? ' on' : '');
        b.textContent = pair[1];
        b.setAttribute('aria-pressed', view === pair[0] ? 'true' : 'false');
        b.onclick = function () { chordView = pair[0]; buildGrid(); };
        seg.appendChild(b);
      });
      chips.appendChild(seg);

      // S-CHORD-COLLAPSE (operator friction 2026-07-16): at the ADVANCED
      // guidance level both palette grids render the compact suggChip token
      // (letter + roman) instead of full diagram tiles - the diagrams were
      // pushing the palette well below the fold. The tap verb is UNCHANGED
      // (one tap = add + play, the G1 persona goalpost encodes it); the
      // Shapes toggle below flips the whole grid back to diagram tiles on
      // demand, so a shape is one tap away, never a scroll away.
      // Method-level guard (Volley 2 Medium #1): mirror reserveLabelSlot's
      // `typeof === 'function'` discipline so a partially-stubbed
      // window.ChordCollapse degrades to full diagrams instead of throwing.
      var collapse = !!(global.ChordCollapse && typeof global.ChordCollapse.active === 'function'
        && typeof global.ChordCollapse.chip === 'function' // chipTile calls it (Volley 3 Medium #2)
        && global.ChordCollapse.active());
      // UAT r5 F5: no in-surface Shapes chip - the chord-charts Settings pref
      // (chipsEffective above) owns visibility; play/index.html repaints the
      // grid via songbookRefreshCompose when the pref changes.
      var useChips = chipsEffective(collapse);
      // Always toggled (not only when useChips) so a level change or a Shapes
      // flip can never leave a stale chip-sizing class on the persistent grid.
      grid.classList.toggle('ccMode', useChips);
      // Compact chip for one palette chord: the shared ChordCollapse primitive
      // + the SAME wireTap add/play/flash every diagram tile gets. Roman is
      // gated on an ACTUAL key (explicit or inferred - the key chip displays
      // it either way): labelRoman's own no-key fallback labels vs
      // progression[0] (labelTonic), which on a cleared-key All view would be
      // a GUESSED roman - the goal spec's honest-omission rule forbids that
      // (Volley 2 High #2; the suggest row / progression slots keep their
      // pre-existing fallback semantics - out of this feature's scope).
      function chipTile(c) {
        return wireTap(global.ChordCollapse.chip({
          chord: c, roman: songKey.root ? labelRoman(c) : '', display: dispChordName(c)
        }), c);
      }

      if (view === 'inkey') {
        if (!songKey.root) {
          // In-key view with no key set: a PROMINENT pick-a-key CTA (replaces the old
          // hint prose) - one tap opens the key panel right above. A short secondary
          // line keeps the All escape hatch discoverable.
          var cta = document.createElement('button');
          cta.type = 'button';
          cta.className = 'btn red pickKeyCta';
          cta.textContent = 'Pick a key';
          cta.onclick = function () { keyPopoverOpen = true; buildKeyPicker(); };
          var hint = document.createElement('p');
          hint.className = 'keyHint chordsHint';
          hint.textContent = 'Its chords will lead this list - or switch to All to browse every chord.';
          if (scroller) { scroller.insertBefore(cta, grid); scroller.insertBefore(hint, grid); }
          return;
        }
        var keyRoot = songKey.root, keyMode = songKey.mode;
        var leadWrap = document.createElement('div'); leadWrap.className = 'inKeyLead';
        // Operator UAT 2026-07-17 ("needs some barrier between suggested and
        // chords in key"): the suggested row flowed straight into the in-key
        // palette with nothing splitting the two groups (the All view gets its
        // split for free from the quality-chip row). A labeled section boundary
        // - the SAME .suggLbl primitive the suggested row uses, plus a top
        // hairline - makes the two zones read as two groups. This supersedes
        // the older "the key chip already names the key, so no list header"
        // rationale (KeyExplorer call below): the header's job here is group
        // separation, naming the key is the bonus. The key ROOT renders inside
        // an uppercase-transform opt-out span (.lblNote) so a flat accidental
        // survives ("Bb", never "BB" - note-spelling.md / a11y rule).
        var ikLbl = document.createElement('div'); ikLbl.className = 'suggLbl inKeyLbl';
        ikLbl.appendChild(document.createTextNode('Chords in '));
        var ikRoot = document.createElement('span'); ikRoot.className = 'lblNote';
        ikRoot.textContent = (global.Circle && global.Circle.preferredTonicName)
          ? global.Circle.preferredTonicName(keyRoot, keyMode) : keyRoot;
        ikLbl.appendChild(ikRoot);
        ikLbl.appendChild(document.createTextNode(' ' + String(keyMode || '')));
        leadWrap.appendChild(ikLbl);
        if (useChips) {
          // S-CHORD-COLLAPSE: compact chip palette - needs no KeyExplorer (the
          // chip is name + roman, both derived right here), so this branch
          // also covers the no-KeyExplorer degraded path.
          var ccWrap = document.createElement('div'); ccWrap.className = 'ccChips';
          diatonicChords(keyRoot, keyMode).forEach(function (c) {
            ccWrap.appendChild(chipTile(c));
          });
          leadWrap.appendChild(ccWrap);
        } else if (global.KeyExplorer) {
          var keItems = diatonicChords(keyRoot, keyMode).map(function (c) {
            return { chord: c, roman: labelRoman(c) };
          });
          // No 'label' opt: the key/mode chip already names the key, so no list header.
          global.KeyExplorer.renderChords(leadWrap, keItems, {
            diagram: function (cc, sz) { return packDiagram(cc, sz, dispChordName(cc)); },
            onTap: function (c, d) { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); }
          });
        } else {
          // Fallback when KeyExplorer isn't loaded: render the diatonic palette as plain
          // chord tiles into #buildGrid (mirrors the All view's tile render) so In-key is
          // never blank and degrades gracefully. wireTap is movement-cancelled like every
          // other chord tile.
          diatonicChords(keyRoot, keyMode).forEach(function (c) {
            grid.appendChild(wireTap(packDiagram(c, 'small', dispChordName(c)), c));
          });
        }
        if (scroller) scroller.insertBefore(leadWrap, grid);
        return;
      }

      // "All" view: the scrollable chord-TYPE tab row (the sub-filter), then the matching
      // chromatic chord tiles in #buildGrid. No "All chords" header (redundant w/ toggle).
      var tabRow = document.createElement('div'); tabRow.className = 'catTabRow';
      Object.keys(CATS).forEach(function (cat) {
        var b = document.createElement('button');
        b.className = 'chip' + (cat === allChordsActiveCat ? ' on' : '');
        b.textContent = cat;
        // UAT U6 (2026-07-04): tapping a quality chip flags this rebuild as a
        // filter tap so the anchor below only fires here - never on the FIRST
        // render of the All view (which should stay at its natural scroll spot).
        b.onclick = function () { allChordsActiveCat = cat; buildGrid({ anchorFilterRow: true }); };
        tabRow.appendChild(b);
      });
      if (scroller) scroller.insertBefore(tabRow, grid);
      (CATS[allChordsActiveCat] || []).forEach(function (c) {
        // S-CHORD-COLLAPSE: same chip-vs-tile fork as the in-key palette;
        // chipTile itself gates the roman on songKey.root, so an un-keyed
        // All view honestly shows letter-only chips - never a roman guessed
        // vs progression[0] via labelRoman's labelTonic fallback (Volley 2
        // High #2; the goal spec's honest-omission rule).
        grid.appendChild(useChips ? chipTile(c) : wireTap(packDiagram(c, 'small'), c));
      });
      // UAT U6 (2026-07-04, operator Pixel walkthrough): tapping a quality filter
      // (Major/Minor/7th/Maj7/Min7) rebuilds #catTabRow + #buildGrid in place, but
      // the scroll area (#composeChords) was snapping back near the top afterward -
      // re-surfacing the #suggest starter strip and hiding the just-tapped filter
      // row + its results below the fold. Anchor the filter row to the top of the
      // visible scroll area instead, so results are immediately visible and the
      // suggestion strip scrolls above. Instant jump (behavior:'auto') - a smooth
      // animation here read as jank on the actual tap, not "the filter I tapped".
      if (opts.anchorFilterRow && tabRow) tabRow.scrollIntoView({ block: 'start', behavior: 'auto' });
    }

    /* ---- Key: pick a key -> its diatonic chord palette (the solo scale/HSR
     * moved to the Studio; the fly-out links out via Triads & Inversions) ----
     * Persistent compact key bar (replaces the old collapse): the current-key chip and
     * the maj/min mode toggle are ALWAYS visible - one tap changes major<->minor, never
     * hidden. The 12-root grid is an on-demand popover, opened by tapping the key chip
     * and closed on selection; tapping the already-selected mode re-confirms and
     * closes it (a no-op re-harmonize guard, not a toggle). */
    // Default to C major so Compose opens in the In-key view with real, tappable
    // chords - "get to work immediately" (operator override of D-KEYLESS, 2026-07-10,
    // made knowingly: the key stays fully changeable / clearable / transposable, so the
    // keyless capability is preserved - only the DEFAULT changed). compose-key-system.md D-DEFAULT-C.
    // `defaulted` (UAT r5 F1, 2026-07-19): the landing default is NOT a user
    // decision. A defaulted key FOLLOWS the music (auto-infer on add, song-derived
    // on the canvas / Continue building); any deliberate key act (root pick, mode,
    // pattern, clear) drops the flag and pins the key for real. Without it the
    // untouched C outranked the music everywhere - templates realized in C while
    // the operator was building in A.
    var songKey = { root: "C", mode: "Major", explicit: true, defaulted: true };
    var keyPopoverOpen = false; // the 12-root grid popover - opens on chip tap, closes on pick
    function buildKeyPicker() {
      if (!el.keyRoots || !el.keyModes) return;
      // Fixed-width key/mode chip: injected once into the button bar (#keyChipSlot). It
      // does double duty - shows the current key (root + abbreviated mode, so it reads as
      // the transpose readout: songKey.root moves with every transpose) AND toggles the
      // fly-out (#keyFlyout: the 12 roots + the mode toggle + the Triads & Inversions link).
      // Abbreviated mode (Maj/Min/Mixo/Dor) keeps it short for the fixed width; the fixed
      // width (.keyPickerCompact in CSS) means "C Maj" and "G# Mixo" render the same size,
      // so the button bar never jumps as the key name changes.
      var chip = document.getElementById('keyPickerCompact');
      if (!chip) {
        var anchor = el.keyChipSlot;
        if (anchor) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.id = 'keyPickerCompact';
          chip.className = 'keyPickerCompact';
          anchor.appendChild(chip);
        }
      }
      if (chip) {
        chip.hidden = false;
        chip.setAttribute('aria-expanded', keyPopoverOpen ? 'true' : 'false');
        chip.setAttribute('aria-controls', 'keyFlyout');
        chip.setAttribute('aria-haspopup', 'true');
        chip.title = 'Key / mode - tap to change';
        // 'shifted' lights the chip when you've transposed off the key you built in
        // (net shift mod an octave), mirroring the old #cKey readout indicator.
        var chipShift = (((cTpose % 12) + 12) % 12) !== 0;
        chip.classList.toggle('shifted', chipShift);
        // Guarded lookup: a bad persisted/imported mode must degrade to the
        // raw string, never hard-crash the key picker on `.label` of undefined.
        var chipMode = MODE_SHORT[songKey.mode] || (MODES[songKey.mode] && MODES[songKey.mode].label) || escHTML(String(songKey.mode || ''));
        // Placeholder is short ("Key") so it fits the fixed-width chip without clipping;
        // the title attr carries the full "Key / mode - tap to change" affordance.
        // FORK-4 removal: the chip shows the preferred enharmonic key name
        // (A# major displays as Bb); songKey.root stays the canonical token.
        var chipRoot = (global.Circle && global.Circle.preferredTonicName)
          ? global.Circle.preferredTonicName(songKey.root, songKey.mode) : songKey.root;
        chip.innerHTML = songKey.root
          ? (chipRoot + ' <span class="kpcMode">' + chipMode + '</span> <span class="kpcCaret" aria-hidden="true">▾</span>')
          : ('Key <span class="kpcCaret" aria-hidden="true">▾</span>');
        chip.onclick = function () { keyPopoverOpen = !keyPopoverOpen; buildKeyPicker(); };
      }
      // The fly-out (roots + mode toggle + Triads & Inversions link) opens/closes with the chip.
      if (el.keyFlyout) el.keyFlyout.hidden = !keyPopoverOpen;
      // Picking a key and picking chords are mutually exclusive - hide the chord
      // picker (In-key/All toggle + chord list + solo-backing CTA) while the
      // key/mode fly-out is open, so the fly-out uses that freed height and the
      // Compose tab fits with no vertical scroll.
      var cwrap = el.keyFlyout && el.keyFlyout.closest ? el.keyFlyout.closest('.composeWrap') : null;
      if (cwrap) cwrap.classList.toggle('keyOpen', keyPopoverOpen);
      // Root grid is always visible INSIDE the fly-out now (no separate popover).
      el.keyRoots.hidden = false;
      el.keyRoots.innerHTML = '';
      ROOTS.forEach(function (r) {
        var b = document.createElement('button');
        b.className = 'chip rootChip' + (r === songKey.root ? ' on' : '');
        // S-KEYPICKER-PREFERRED (operator UAT 2026-07-10: "key selector drift -
        // shows sharps only. SSOT"): a root chip in the KEY picker names a KEY,
        // so it displays the preferred tonic name from the ONE provider
        // (Circle.preferredTonicName - the same call the compact chip below
        // already makes). Mode-aware: the current mode picks the name (A# major
        // -> Bb, but D# minor stays D#m-territory). r stays the canonical token
        // for identity/storage/transpose. Resolves IV-2 (the flat-keys mock).
        b.textContent = (global.Circle && global.Circle.preferredTonicName)
          ? global.Circle.preferredTonicName(r, songKey.mode || 'Major') : r;
        b.setAttribute('aria-pressed', r === songKey.root ? 'true' : 'false');
        b.onclick = function () {
          invalidateClearUndo(); // A3: a key (root) change invalidates any pending Clear-undo
          // Picking a root sets the explicit key and KEEPS the panel open so the mode
          // can be chosen in the same visit (root -> mode is one gesture; the old
          // close-on-root-pick forced a reopen to get minor). A mode tap - or re-tapping
          // the current mode as a "confirm" - closes it. Tapping the currently-selected
          // root clears the key (and stays open for a fresh pick).
          if (songKey.root === r) {
            // Clear the key (context only) - NEVER transpose on clear; the chords stay put.
            songKey.root = null; songKey.explicit = false; songKey.defaulted = false;
            keyPopoverOpen = true;
          } else {
            // Pick a NEW root. If a progression exists, transpose it by the semitone
            // delta between the OLD song-key tonic and the new root. The old tonic is the
            // explicit song key if one was picked; otherwise (a freely-built progression
            // with no key yet) derive it from the first chord's root so picking a key
            // TRANSPOSES the chords into that key instead of just relabeling them. Take
            // the shorter direction around the circle so the shapes move minimally.
            var oldRoot = songKey.root ||
              (progression.length ? ((splitChord(progression[0]) || {}).root || null) : null);
            if (progression.length && oldRoot) {
              var op = rootPc(oldRoot), np = rootPc(r);
              if (op != null && np != null) {
                var delta = ((np - op) % 12 + 12) % 12;
                if (delta > 6) delta -= 12; // shift the short way
                if (delta !== 0) {
                  progression = progression.map(function (c) { return tpose(c, delta); });
                  cTpose += delta; // keep the transpose readout's net-shift accounting consistent
                }
              }
            }
            songKey.root = r; songKey.explicit = true; songKey.defaulted = false;
            // stays open (keyPopoverOpen untouched) - the mode tap completes the gesture
          }
          // Picking/clearing a key resets the chord-list view to "follow the key": a set
          // key -> In key, a cleared key -> All. (An explicit segment tap re-pins it.)
          chordView = null;
          renderProg(); renderKey(); buildKeyPicker(); renderKeyView(); buildGrid();
        };
        el.keyRoots.appendChild(b);
      });
      // maj/min (and the wider mode set) toggle - ALWAYS visible, one tap.
      el.keyModes.hidden = false;
      el.keyModes.innerHTML = '';
      Object.keys(MODES).forEach(function (mk) {
        var b = document.createElement('button');
        b.className = 'chip' + (mk === songKey.mode ? ' on' : '');
        b.textContent = MODES[mk].label;
        b.setAttribute('aria-pressed', mk === songKey.mode ? 'true' : 'false');
        b.onclick = function () {
          // Re-tapping the CURRENT mode is a no-op confirm: change nothing. With a
          // root set the gesture is complete - close the panel. With NO root yet
          // (F12 dead-chip fix, m-guide-ia-20260704.md section 4.1) the chip is
          // already the selected one; still re-render so it stays visibly live/on
          // and the panel stays open for a real pick, instead of doing nothing.
          if (mk === songKey.mode) {
            if (songKey.root) { keyPopoverOpen = false; buildKeyPicker(); }
            else { buildKeyPicker(); }
            return;
          }
          // A real mode change re-harmonizes the built progression (solo-practice
          // scope): the one key/mode filter keeps the chords in sync - a root change
          // transposes, a mode change re-qualifies.
          if (songKey.root) {
            // Explicit key: convertToMode owns convert + set root/mode/explicit +
            // close + full re-render (unchanged path). If the progression is empty
            // there's nothing to harmonize, so just set the mode and close (root +
            // mode both chosen = the gesture is done).
            if (progression.length) {
              convertToMode(mk); // invalidates internally
            } else {
              invalidateClearUndo(); // A3: a mode change invalidates any pending Clear-undo
              songKey.mode = mk;
              keyPopoverOpen = false;
              renderKey(); buildKeyPicker(); renderKeyView(); renderProg(); buildGrid();
            }
          } else {
            // D-KEYLESS mode-change (m-guide-ia-20260704.md section 4.2): no root yet,
            // so re-qualify the progression around the FIRST CHORD's root (the tonic
            // labelRoman already measures against) via the shared pure fn - but the
            // root itself STAYS null (no resurrection, unlike the old unconditional
            // convertToMode call) and the panel stays OPEN so mode taps keep landing.
            invalidateClearUndo(); // A3: a mode change invalidates any pending Clear-undo
            if (progression.length) {
              var firstChordRoot = (splitChord(progression[0]) || {}).root || null;
              if (firstChordRoot) {
                progression = convertProgressionQualities(progression, mk, firstChordRoot, songKey.mode);
              }
              songKey.mode = mk;
              renderProg(); renderKey(); buildKeyPicker(); renderKeyView(); buildGrid(); renderSuggest();
            } else {
              songKey.mode = mk;
              renderKey(); buildKeyPicker(); renderKeyView(); renderProg(); buildGrid();
            }
          }
        };
        el.keyModes.appendChild(b);
      });
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
    }
    // M-EAR wave 1: the Compose key-preview's active scale-audition handle -
    // declared immediately outside renderKeyView (mirrors tracks.js's
    // studioSound var, same reasoning) so a NEW renderKeyView() call (a
    // key/mode change) can silence a playback a PREVIOUS call started,
    // before the DOM subtree it was marking gets wiped below.
    var composeSound = null;
    function renderKeyView() {
      if (composeSound) { composeSound.stop(); composeSound = null; }
      if (!el.keyView) return;
      el.keyView.innerHTML = '';
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
      // #keyView lives INSIDE the key/mode fly-out (below the roots + mode toggle).
      // The fly-out is a pure key/mode PICKER (locked decision: the Studio owns the
      // fretboard + guidance cards + chord-tone targeting) - the I-IV-V HSR chain
      // stays out entirely. What it DOES carry (M-GUIDE W3b): a lightweight, purely
      // decoupled solo-scale PREVIEW (chip row + notes + one-line caption) so you
      // can preview what you'd solo with before ever opening the Studio - plus the
      // key readout line and the "Triads & Inversions" deep-dive link.
      if (!songKey.root) return; // the 12-root grid above IS the empty-state CTA
      var keyRoot = songKey.root, keyMode = songKey.mode; // local aliases for this render
      var title = document.createElement('div'); title.className = 'keyTitle';
      // S-KEYPICKER-PREFERRED: the key readout displays the preferred key name
      // (the same provider the compact chip + root grid use) - picking Bb must
      // never read back as "A# Major" one line below.
      var dispKeyRootName = (global.Circle && global.Circle.preferredTonicName)
        ? global.Circle.preferredTonicName(keyRoot, keyMode) : keyRoot;
      title.innerHTML = '<strong>' + dispKeyRootName + ' ' + ((MODES[keyMode] && MODES[keyMode].label) || escHTML(keyMode)) + '</strong> <span>' + (MODE_HINT[keyMode] || '') + '</span>';
      el.keyView.appendChild(title);
      // M-GUIDE W3b: solo-scale PREVIEW row - DECOUPLED (isolation-tested below).
      // A chip tap here re-renders ONLY this block; it never touches songKey,
      // progression, the In-key palette, or the grid, and nothing persists across
      // renders (every renderKeyView() call defaults back to the mode's own
      // scale). See engineering-wiki/systems/compose-key-system.md.
      (function renderSoloChips() {
        var wrap = document.createElement('div');
        var chipsRow = document.createElement('div'); chipsRow.className = 'keySoloScale';
        var notesLine = document.createElement('div'); notesLine.className = 'keySoloNotes';
        // S-CHIPS-PLUS: a degrees line under the notes line (P5 W3 verdict -
        // "how do these notes function", not just their names). Same styling
        // family as the Practice Studio's degree glyphs (tracks.js
        // studioTheory/soloBundle -> Circle.scaleDegrees/soloScaleDegrees).
        var degreesLine = document.createElement('div'); degreesLine.className = 'keySoloDegrees'; degreesLine.hidden = true;
        var frameLine = document.createElement('div'); frameLine.className = 'keySoloFrame'; frameLine.hidden = true;
        // M-EAR wave 1: per-note tokens (data-i) on notesLine/degreesLine so
        // onNote(i) can bounce a .sounding marker across them, plus the
        // play/stop toggle - composes the SAME .iconBtn.soundToggle primitive
        // the Studio scale panel uses (tracks.js), not a one-off look
        // (Element Consistency Law). notesRow puts the toggle beside the
        // notes line without an extra vertical row (one-screen-above-the-fold).
        var notesRow = document.createElement('div'); notesRow.className = 'keySoloNotesRow';
        var soundToggle = document.createElement('button');
        soundToggle.type = 'button'; soundToggle.className = 'iconBtn soundToggle keySoloSoundToggle';
        soundToggle.setAttribute('aria-label', 'Hear this scale'); soundToggle.setAttribute('aria-pressed', 'false');
        soundToggle.innerHTML = '&#9658;';
        var curNotes = null; // the currently-selected chip's note names (for the toggle to derive pcs from)
        function renderNoteTokens(notes) {
          return notes.map(function (n, i) { return '<span class="soundNote" data-i="' + i + '">' + escHTML(n) + '</span>'; }).join(' ');
        }
        function renderDegreeTokens(degrees) {
          return (degrees || []).map(function (d, i) { return '<span class="soundNote" data-i="' + i + '">' + escHTML(d) + '</span>'; }).join(' ');
        }
        function clearSoundMarks() {
          [notesLine, degreesLine].forEach(function (c) {
            Array.prototype.forEach.call(c.querySelectorAll('.sounding'), function (m) { m.classList.remove('sounding'); });
          });
        }
        function markSoundingNote(i) {
          [notesLine, degreesLine].forEach(function (c) {
            var m = c.querySelector('[data-i="' + i + '"]');
            if (m) m.classList.add('sounding');
          });
        }
        function setSoundToggle(on) {
          soundToggle.classList.toggle('on', on);
          soundToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
          soundToggle.setAttribute('aria-label', on ? 'Stop' : 'Hear this scale');
          soundToggle.innerHTML = on ? '&#9632;' : '&#9658;';
        }
        // Chip switch and any renderKeyView() re-render (key/mode change, the
        // popover closing - see the MutationObserver below) all stop playback
        // (implementation note #3, M-EAR wave 1 spec) - this is the ONE place
        // that does it for the Compose preview.
        function stopComposeSound() {
          if (composeSound) { composeSound.stop(); composeSound = null; }
          setSoundToggle(false);
          clearSoundMarks();
        }
        soundToggle.onclick = function () {
          if (composeSound) { stopComposeSound(); return; }
          if (!global.Sound || !curNotes) return;
          // noteToPc (module scope, above) - the same generic note-name ->
          // pitch-class parser chord transposition already uses.
          var pcs = curNotes.map(noteToPc).filter(function (p) { return p !== null; });
          if (!pcs.length) return;
          setSoundToggle(true);
          composeSound = global.Sound.playScale(pcs, {
            onNote: function (i) { clearSoundMarks(); markSoundingNote(i % pcs.length); },
            onStop: function () { composeSound = null; setSoundToggle(false); clearSoundMarks(); }
          });
        };
        var scaleLabel = (MODES[keyMode] && MODES[keyMode].label) || escHTML(String(keyMode));
        var CHIPS = [
          { id: 'mode', label: scaleLabel },
          { id: 'pentMajor', label: 'Pent major' },
          { id: 'pentMinor', label: 'Pent minor' },
          { id: 'blues', label: 'Blues' }
        ];
        // Blues-key dedup: when the KEY's own mode is already Blues, the standalone
        // Blues chip would just re-select the identical 6-note scale under a second
        // button - drop it (mirrors the Practice Studio's th.scaleMode === 'blues' fold).
        // S-CHIPS-PLUS (P5 W3 verdict): the freed 4th slot becomes Mixolydian - the
        // dominant-scale option a player actually reaches for over I7-IV7-V7 (Blues'
        // own harmonizing palette is I7/IV7/V7, Circle.BLUES_KEY). Non-Blues keys
        // keep their 4th chip as Blues, unchanged.
        if (canonMode(keyMode) === 'Blues') {
          CHIPS = CHIPS.filter(function (c) { return c.id !== 'blues'; });
          CHIPS.push({ id: 'mixolydian', label: 'Mixolydian' });
        }
        var curChipId = 'mode';
        function renderChips() {
          chipsRow.innerHTML = CHIPS.map(function (c) {
            return '<button type="button" class="chip' + (curChipId === c.id ? ' on' : '') + '" data-soloscale="' + escHTML(c.id) + '">' + escHTML(c.label) + '</button>';
          }).join('');
          Array.prototype.forEach.call(chipsRow.querySelectorAll('.chip'), function (b) {
            b.onclick = function () { selectChip(b.getAttribute('data-soloscale')); };
          });
        }
        function selectChip(scaleId) {
          var notes = soloChipScale(keyRoot, keyMode, scaleId);
          if (!notes) return; // unresolvable -> keep whatever was already on-screen
          // M-EAR wave 1 (implementation note #3): a scale-chip switch always
          // stops any in-progress audition - the sounding scale is about to
          // change out from under the marker.
          stopComposeSound();
          curChipId = scaleId;
          curNotes = notes;
          renderChips();
          notesLine.innerHTML = 'Solo over it - <strong>' + renderNoteTokens(notes) + '</strong>';
          // Degrees are best-effort labeling only - notes already resolved above,
          // so a null/empty degrees result just hides the line, never blocks the chip.
          var degrees = soloChipDegrees(keyMode, scaleId);
          if (degrees && degrees.length) { degreesLine.innerHTML = renderDegreeTokens(degrees); degreesLine.hidden = false; }
          else { degreesLine.textContent = ''; degreesLine.hidden = true; }
          // S-REL-NAMES (U23): keyRoot (this render's own key) names any
          // {relMinor}/{relMajor} token in the caption text.
          var caption = soloChipCaption(scaleId, keyRoot);
          if (caption) { frameLine.textContent = caption; frameLine.hidden = false; }
          else { frameLine.textContent = ''; frameLine.hidden = true; }
        }
        renderChips();
        selectChip('mode'); // default every render: the key's own scale, never persisted
        notesRow.appendChild(notesLine); notesRow.appendChild(soundToggle);
        wrap.appendChild(chipsRow); wrap.appendChild(notesRow); wrap.appendChild(degreesLine); wrap.appendChild(frameLine);
        el.keyView.appendChild(wrap);
        // Closing the key/mode flyout popover (buildKeyPicker toggles
        // el.keyFlyout.hidden - out of this function's grant, so observed
        // rather than hooked directly) also silences an in-progress preview -
        // "tab/surface change" (implementation note #3) for the one teardown
        // path that doesn't re-run renderKeyView() itself. One-shot: the next
        // renderKeyView() call rebuilds this whole block and re-observes.
        try {
          if (typeof MutationObserver !== 'undefined' && el.keyFlyout) {
            var mo = new MutationObserver(function () {
              if (el.keyFlyout.hidden) { stopComposeSound(); mo.disconnect(); }
            });
            mo.observe(el.keyFlyout, { attributes: true, attributeFilter: ['hidden'] });
          }
        } catch (e) {}
      })();
      // Carry the current instrument AND key so the inversions page opens in context -
      // same instrument profile, pre-selected to this key. mode rides along too so a
      // future minor-cycle variant can read it; the page ignores params it doesn't use.
      var more = document.createElement('a');
      more.className = 'hsrMore';
      var invParams = [];
      if (PROFILE_ID) invParams.push('p=' + encodeURIComponent(PROFILE_ID));
      invParams.push('key=' + encodeURIComponent(keyRoot));
      invParams.push('mode=' + encodeURIComponent(keyMode));
      more.href = 'triad-inversions.html?' + invParams.join('&');
      more.textContent = 'Triads & Inversions →';
      // Open the deep-dive as a full-screen in-app modal (iframe) instead of
      // navigating away - mirrors the curate-videos overlay. The href stays as a
      // no-JS / direct-open fallback; the iframed page self-themes off
      // music.theme.v1, so it matches Light/Dark. Registers with NavHistory so
      // Android back closes the modal, not the app.
      more.onclick = function (e) {
        e.preventDefault();
        var url = more.getAttribute('href');
        var ov = document.getElementById('invModal');
        if (!ov) {
          ov = document.createElement('div');
          ov.id = 'invModal';
          ov.className = 'invModal';
          ov.innerHTML = '<div class="invModal-box" role="dialog" aria-modal="true" aria-label="Triads & Inversions">'
            + '<button class="invModal-x" type="button" aria-label="Close">✕</button>'
            + '<iframe class="invModal-frame" title="Triads & Inversions"></iframe></div>';
          document.body.appendChild(ov);
          var close = function () { ov.classList.remove('on'); var f = ov.querySelector('.invModal-frame'); if (f) f.removeAttribute('src'); };
          ov._close = close;
          ov.querySelector('.invModal-x').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else close(); };
          ov.onclick = function (ev) { if (ev.target === ov) { if (window.NavHistory) window.NavHistory.dismiss(); else close(); } };
        }
        ov.querySelector('.invModal-frame').src = url;
        ov.classList.add('on');
        if (window.NavHistory) window.NavHistory.open('inversions', ov._close);
      };
      el.keyView.appendChild(more);
    }

    function suggestFor(ch) {
      // Probe the exact name, then the quality-stripped base, each slid across all
      // 12 roots. SUGG only lists natural keys, so a transposed (sharp/flat) chord
      // would otherwise miss and fall back to the C/G/Am/F default — wrong key.
      // Because SUGG relationships are interval-based, we slide ch up to a known
      // root and shift its suggestions back by the same interval, keeping them in
      // the transposed key.
      var variants = [ch, ch.replace(/(maj7|m7|7)$/, '')];
      for (var v = 0; v < variants.length; v++) {
        for (var st = 0; st < 12; st++) {
          var probe = tpose(variants[v], st);
          if (SUGG[probe]) {
            return st === 0 ? SUGG[probe].slice()
              : SUGG[probe].map(function (c) { return tpose(c, -st); });
          }
        }
      }
      return ["C", "G", "Am", "F"];
    }
    function suggestNext(seq) {
      if (!seq.length) return [];
      var last = seq[seq.length - 1], score = {};
      suggestFor(last).forEach(function (c, i) { score[c] = (score[c] || 0) + (10 - i); });
      seq.forEach(function (ch) { suggestFor(ch).forEach(function (c, i) { score[c] = (score[c] || 0) + (4 - Math.min(i, 3)); }); });
      return Object.keys(score).filter(function (c) {
        // only suggest chords the pack can render; if no pack, allow all named chords
        return (pack ? packHasChord(c) : true) && c !== last;
      }).sort(function (a, b) { return score[b] - score[a]; }).slice(0, 5);
    }
    // a COMPACT tappable suggestion chip: chord name + its interval (Roman) label, no
    // fretboard diagram - so "Next chord" stays a few short rows instead of eating the
    // viewport. (The full shapes live in "All chords" / the key palette.) `completes`
    // accent-highlights the chip that finishes a famous progression. The progression
    // NAME itself is deliberately not rendered - the caption blew the chip width and
    // wrapped the row; the glow alone carries the nudge.
    function suggChip(c, tonic, completes) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggChip' + (completes ? ' complete' : '');
      var rn = labelRoman(c);
      var html = '<span class="scName">' + escHTML(dispChordName(c)) + '</span>';
      if (rn) html += '<span class="scRn">' + escHTML(rn) + '</span>';
      chip.innerHTML = html;
      chip.onclick = function () { addChord(c); packPlayChord(c); };
      return chip;
    }
    function renderSuggest() {
      if (!el.suggest) return;
      el.suggest.innerHTML = '';
      if (progression.length === 0) {
        // S-COMPOSE-CALM adaptive default (operator interview 2026-07-19): an
        // ADVANCED player lands on the dense chord palette - the starter cards
        // are beginner/intermediate scaffolding, noise at the top of a
        // maestro's screen. Level gates EMPHASIS here, not access: starters
        // are one In-key browse away regardless.
        var GLs = guidanceLevelRef();
        if (GLs && GLs.get && GLs.get() === 'advanced') return;
        // Empty state: show common progressions so the user has
        // actionable one-tap starters. #suggest leads the SCROLLING chord list (folded
        // in with the In key / All content) so the fixed top region stays short.
        var lbl = document.createElement('div'); lbl.className = 'suggLbl';
        lbl.textContent = 'Start with a common progression';
        el.suggest.appendChild(lbl);
        var row = document.createElement('div'); row.className = 'progPickRow';
        PROGRESSIONS.forEach(function (p) {
          var b = document.createElement('button'); b.className = 'progPick'; b.type = 'button';
          // A Blues starter carries its own short p.preview ('I7 IV7 V7') - the
          // generic per-slot derivation below is Major-diatonic-only and would
          // mislabel a 12-bar/quick-change fill (12 slots collapsing to 3 romans).
          var roman = p.preview || chordsFromDegrees('C', 'Major', p.degrees)
            .map(function (c) { return global.Circle && global.Circle.romanFor ? global.Circle.romanFor(c, 'C') : c; })
            .join(' ');
          b.innerHTML = '<span class="ppRoman">' + roman + '</span><span class="ppName">' + p.name + '</span>';
          b.onclick = function () { loadProgression(p); };
          row.appendChild(b);
        });
        el.suggest.appendChild(row);
        return;
      }
      var tonic = labelTonic();
      // PROGRESSION-AWARE highlight: a chord that COMPLETES a famous progression is
      // flagged right inside the normal "add a chord" list with an accent glow -
      // no separate rows, no forced vertical, no caption. De-duped per chord.
      var comps = completions(progression, tonic, songKey.root ? songKey.mode : "Major");
      var completeBy = {};
      comps.forEach(function (cmp) {
        (completeBy[cmp.chord] = completeBy[cmp.chord] || []).push(cmp.name);
      });

      // C4 (pilot UAT): the Markov map is key-AGNOSTIC; when a key is set the row
      // filters to it, completions float first, capped at 5 - the whole merge is
      // the pure mergeSuggestionRow (unit-tested; codex V3 wanted chip-row-level
      // coverage the closure could not give).
      var picks = mergeSuggestionRow(suggestNext(progression), Object.keys(completeBy),
        songKey.root, songKey.mode);
      if (!picks.length) {
        var hint = document.createElement('p');
        hint.className = 'keyHint suggEmpty';
        hint.textContent = 'No suggestions for this progression yet.';
        el.suggest.appendChild(hint);
        return;
      }
      var n = progression.length;
      // Ordinal guidance for the first few; past that, F30 (UAT): a label must
      // ALWAYS sit directly above the suggested chords - the old "the panel's
      // own summary already says it" rationale didn't hold (no other on-screen
      // text names this row past the 4th chord), so it read as an unlabeled row
      // of chips. Reuse the SAME .suggLbl primitive both branches already share
      // (component-conventions.md section-label convention).
      // Issue #264 (operator UAT 2026-07-17): lead with "Suggested" so the row
      // names its INTENT - the app is proposing coherent next chords, not
      // demanding one - while the ordinal keeps the where-am-I scaffold.
      var lbl = document.createElement('div'); lbl.className = 'suggLbl';
      lbl.textContent = n === 1 ? "Suggested 2nd chord:" : n === 2 ? "Suggested 3rd chord:" : n === 3 ? "Suggested 4th chord:" : "Suggested chords";
      el.suggest.appendChild(lbl);
      var row = document.createElement('div'); row.className = 'suggRow';
      // Interval label shows the ROLE (V, vi…); a completing chord gets the accent
      // glow (no name caption - see suggChip).
      picks.forEach(function (c) {
        row.appendChild(suggChip(c, tonic, !!completeBy[c]));
      });
      el.suggest.appendChild(row);
    }
    /* ---- inline save UI (replaces native prompt()/alert()/confirm() in the
     * save + solo-backing flows). Built on demand, above the progression box,
     * so it costs zero vertical space until it's actually used (per the "one
     * screen, above the fold" rule) - and torn down again the moment it's
     * dismissed, rather than reserving a permanent row. ---- */
    var composeRow = null, composeToast = null, composeModalBackdrop = null;
    // One-shot id for the post-save discoverability scroll+highlight (B3 pilot
    // UAT) - set by saveProgression right before the renderSongs() call that
    // will actually paint the new row, consumed (cleared) on the next
    // renderSongs() regardless of whether a matching row was found.
    var pendingHighlightId = null;
    function ensureComposeUI() {
      if (!el.prog || !el.prog.parentNode) return false;
      if (!composeModalBackdrop) {
        // Real full-viewport dim layer, a SIBLING of composeRow - not a ::before
        // pseudo-element on the card (F9 root cause: a negative z-index child
        // paints ABOVE the stacking-context root's own background per CSS2.1
        // painting order, so the old `.asModal::before{z-index:-1}` washed OUT
        // the card's background/text instead of sitting behind it). A separate
        // lower z-index element can never repaint over its own card.
        composeModalBackdrop = document.createElement('div');
        composeModalBackdrop.className = 'composeModalBackdrop';
        composeModalBackdrop.hidden = true;
        el.prog.parentNode.insertBefore(composeModalBackdrop, el.prog);
      }
      if (!composeRow) {
        composeRow = document.createElement('div');
        composeRow.className = 'composeRow';
        composeRow.hidden = true;
        // UAT U7 (2026-07-04): every composeRow-as-modal consumer (save-name
        // entry, solo-CTA choice) presents as a dialog when .asModal is on -
        // set the a11y contract + a focus target here ONCE rather than per
        // opener. tabIndex lets a button-less modal (the solo-choice row) call
        // composeRow.focus() directly (a plain div isn't focusable otherwise);
        // harmless for the save-name row, which focuses its own input instead.
        composeRow.setAttribute('role', 'dialog');
        composeRow.setAttribute('aria-modal', 'true');
        composeRow.tabIndex = -1;
        el.prog.parentNode.insertBefore(composeRow, el.prog);
      }
      if (!composeToast) {
        composeToast = document.createElement('div');
        composeToast.className = 'composeToast';
        composeToast.hidden = true;
        el.prog.parentNode.insertBefore(composeToast, el.prog);
      }
      return true;
    }
    function hideComposeRow() {
      if (composeRow) { composeRow.hidden = true; composeRow.innerHTML = ''; composeRow.classList.remove('asModal'); }
      if (composeModalBackdrop) composeModalBackdrop.hidden = true;
    }

    // ---- S-CLEARGUARD (sprint-1 #1), migrated to S-TOAST+ACTION (M-DESIGN-
    // ENFORCE wave 2, UAT U19): Compose Clear undo banner ----
    // F1: Clear used to wipe the built progression with NO guard (native
    // confirm() elsewhere in this file, nothing here). A3 (binding): the
    // fix is an undo banner, not a confirm() dialog - snapshot the full
    // pre-Clear state (progression + cTpose + songKey + the linked
    // saved-song id), and let ANY subsequent mutating action (add/remove
    // chord, transpose, mode change, key change, Save) invalidate it. It is
    // route-local, in-memory, session-only - no backup.js surface, dies on
    // tab-switch/reload. It is a SEPARATE element/variable from composeRow/
    // composeToast above (deliberately - so an unrelated save/solo-choice
    // flow that calls hideComposeRow() can never silently clobber this
    // banner's own DOM out from under its tracked snapshot), but reuses the
    // .composeRow/.composeRowMsg/.composeRowBtns classes for the visual
    // look (F7: "reuse this pattern for Clear-undo messaging").
    //
    // U19 amendment (decisions.md D-ENFORCE-2): the banner used to be
    // untimed (interaction-safety.md guard #3 as it read before this wave) -
    // ANY mutation was the only thing that ever invalidated it. It now ALSO
    // times out via the shared toast.js Toast.showAction() primitive (6s
    // window, visible countdown bar, pause-on-touch) - mutation-invalidation
    // (invalidateClearUndo(), unchanged below) and the timer both end the
    // pending undo; whichever fires first wins.
    // #265-C: post-save confirmation with a NEXT STEP. A bare "Saved" toast on
    // the same editing screen left the user without the saved name or a way
    // out (operator UAT). This banner names the asset and offers ONE tap to
    // where it went (Setlist when the opt-in was checked, Library otherwise);
    // doing nothing auto-dismisses = "keep editing" stays the zero-tap default.
    // Same composeRow/toastAction primitive as the Clear-undo banner.
    var saveDoneBanner = null, saveDoneHandle = null, saveDoneTeardown = null;
    function paintSaveDoneHidden() {
      if (saveDoneTeardown) { saveDoneTeardown(); saveDoneTeardown = null; }
      saveDoneHandle = null;
      if (saveDoneBanner) { saveDoneBanner.hidden = true; saveDoneBanner.innerHTML = ''; }
    }
    function hideSaveDoneBanner() {
      if (saveDoneHandle) saveDoneHandle.finish(); else paintSaveDoneHidden();
    }
    function showSaveDoneBanner(cs, addedToSet) {
      if (!el.prog || !el.prog.parentNode || !global.Toast) { showComposeToast('Saved ' + cs.t); return; }
      if (!saveDoneBanner) {
        saveDoneBanner = document.createElement('div');
        saveDoneBanner.className = 'composeRow toastAction saveDone';
        saveDoneBanner.hidden = true;
        el.prog.parentNode.insertBefore(saveDoneBanner, el.prog);
      }
      hideSaveDoneBanner();
      saveDoneBanner.hidden = false;
      saveDoneBanner.innerHTML = '';
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      msg.textContent = 'Saved ' + cs.t + '.';
      var goBtn = document.createElement('button');
      goBtn.type = 'button'; goBtn.className = 'btn ghost';
      goBtn.textContent = addedToSet ? 'Open Setlist' : 'Open Library';
      goBtn.onclick = function () {
        hideSaveDoneBanner();
        switchTab(addedToSet ? 'jam' : 'library');
      };
      saveDoneBanner.appendChild(msg); saveDoneBanner.appendChild(goBtn);
      saveDoneHandle = global.Toast.showAction('Saved ' + cs.t, {
        host: saveDoneBanner,
        onShow: function (host, m, bar) { if (bar) host.appendChild(bar); },
        onHide: function () { paintSaveDoneHidden(); }
      });
      saveDoneTeardown = global.Toast.wirePauseOnTouch(saveDoneBanner, saveDoneHandle);
    }
    var clearUndoBanner = null, clearUndoSnapshot = null, clearUndoHandle = null, clearUndoTeardown = null;
    function ensureClearUndoBanner() {
      if (!el.prog || !el.prog.parentNode) return false;
      if (!clearUndoBanner) {
        clearUndoBanner = document.createElement('div');
        clearUndoBanner.className = 'composeRow toastAction';
        clearUndoBanner.hidden = true;
        el.prog.parentNode.insertBefore(clearUndoBanner, el.prog);
      }
      return true;
    }
    function paintClearUndoHidden() {
      if (clearUndoTeardown) { clearUndoTeardown(); clearUndoTeardown = null; }
      clearUndoHandle = null;
      if (clearUndoBanner) { clearUndoBanner.hidden = true; clearUndoBanner.innerHTML = ''; }
    }
    // Dismiss the banner AND drop the pending snapshot together - the two
    // must never go out of sync (a visible banner with no snapshot, or a
    // snapshot with no way to reach it, are both bugs). Safe to call even
    // when nothing is pending.
    function hideClearUndoBanner() {
      clearUndoSnapshot = null;
      if (clearUndoHandle) clearUndoHandle.finish(); else paintClearUndoHidden();
    }
    // Call at the top of every progression/songKey mutator (add/remove
    // chord, transpose, mode change, key change, Save) - the A3 invalidation
    // contract. A no-op when nothing is pending, so every call site can call
    // it unconditionally with no extra guard.
    // F31 (UAT): piggybacks hideComposeToast() onto the SAME choke point every
    // mutating action already calls (add/remove chord, transpose, mode/key
    // change, a starter load, Save itself) - a stale save-confirmation toast
    // must not survive any of them, the identical "ANY mutating action
    // invalidates prior transient state" contract A3 already applies to the
    // Clear-undo banner below.
    // S-DELETE-UNDO: keepRemoveUndo=true is passed ONLY by the chord-remove
    // path (a remove must not wipe its own undo trail); every other mutating
    // call site passes nothing, so add/transpose/mode/key/starter/Save all
    // invalidate the remove-undo stack too - the same A3 contract.
    function invalidateClearUndo(keepRemoveUndo) {
      if (clearUndoSnapshot) hideClearUndoBanner();
      hideComposeToast();
      hideSaveDoneBanner(); // #265-C: a stale "Saved X" banner must not outlive the next edit
      if (!keepRemoveUndo) invalidateRemoveUndo();
    }
    function showClearUndoBanner(bannerMsg) {
      if (!ensureClearUndoBanner() || !clearUndoSnapshot) return;
      clearUndoBanner.hidden = false;
      clearUndoBanner.innerHTML = '';
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      // UAT r2: the capture path passes its own message (the too-fast "Added X"
      // toast is replaced by this persistent, pausable, actionable banner).
      msg.textContent = bannerMsg || 'Progression cleared.';
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      var undoBtn = document.createElement('button');
      undoBtn.type = 'button'; undoBtn.className = 'btn ghost ctrlBtn'; undoBtn.textContent = 'Undo';
      undoBtn.onclick = function () {
        var snap = clearUndoSnapshot; if (!snap) return;
        var restored = applyClearSnapshot(snap);
        progression = restored.progression; cTpose = restored.cTpose;
        songKey.root = restored.songKey.root; songKey.mode = restored.songKey.mode; songKey.explicit = restored.songKey.explicit; songKey.defaulted = !!restored.songKey.defaulted;
        savedComposeId = restored.savedComposeId;
        hideClearUndoBanner();
        renderProg(); renderKey();
        if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
      };
      btnRow.appendChild(undoBtn);
      clearUndoBanner.appendChild(msg); clearUndoBanner.appendChild(btnRow);
      clearUndoHandle = global.Toast.showAction(bannerMsg || 'Progression cleared.', {
        host: clearUndoBanner,
        onShow: function (host, m, bar) { if (bar) host.appendChild(bar); },
        onHide: function () { clearUndoSnapshot = null; paintClearUndoHidden(); }
      });
      clearUndoTeardown = global.Toast.wirePauseOnTouch(clearUndoBanner, clearUndoHandle);
    }

    // S-PROG-REORDER (PROTOTYPE, operator directive 2026-07-10: "prototype drag
    // and drop to reorder chosen chords in my progression"). Pointer-events
    // drag on every progression slot, all three strip stages (full cards,
    // fill-row, grid6 - nearest-center targeting is 2D so the grid6 second
    // row just works):
    //   touch: LONG-PRESS (300ms still) lifts - early movement is a scroll
    //     and cancels the hold, so the filmstrip's pan gesture is untouched;
    //     once lifted, a non-passive touchmove blocker owns the gesture.
    //   mouse/pen: movement past a small slop lifts immediately.
    // While lifted: source slot dims (.dragging), the nearest slot carries an
    // accent insertion edge (.dropBefore/.dropAfter by pointer side). Release
    // splices the progression (a mutation - full A3 invalidation) and
    // re-renders; the click that trails pointerup is swallowed once so a drop
    // never also strums the chord it landed on.
    var dragSwallowClick = false;
    function wireSlotDrag(slot, index) {
      slot.addEventListener('pointerdown', function (e) {
        if (progression.length < 2) return;
        // NOTE: drags may START on the rm button - its 44px hit area covers a
        // compact chip's center (probed live: elementFromPoint at slot center
        // hits .rm), so excluding it made compact chips undraggable. The two
        // gestures stay separable: the rm tap is movement-cancelled
        // (composeWireTap), and this drag only commits after movement.
        var id = e.pointerId, startX = e.clientX, startY = e.clientY;
        var isTouch = e.pointerType === 'touch';
        var lifted = false, dropAt = null, marked = null, holdTimer = null;
        function slotsNow() { return Array.prototype.slice.call(el.prog.children); }
        function clearMark() { if (marked) { marked.classList.remove('dropBefore'); marked.classList.remove('dropAfter'); marked = null; } }
        function blockScroll(ev) { ev.preventDefault(); }
        function lift() {
          holdTimer = null;
          lifted = true;
          slot.classList.add('dragging');
          try { slot.setPointerCapture(id); } catch (err) {}
          document.addEventListener('touchmove', blockScroll, { passive: false });
        }
        function onMove(ev) {
          if (ev.pointerId !== id) return;
          if (!lifted) {
            var moved = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
            // touch: early movement = the user is scrolling the strip - stand down.
            if (isTouch) { if (moved > 8) cleanup(); }
            else if (moved > 6) lift();
            return;
          }
          if (ev.cancelable) ev.preventDefault();
          clearMark();
          var list = slotsNow(), best = -1, bestD = Infinity, bestCx = 0;
          for (var s = 0; s < list.length; s++) {
            var r = list[s].getBoundingClientRect();
            var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            var d = Math.abs(ev.clientX - cx) + Math.abs(ev.clientY - cy);
            if (d < bestD) { bestD = d; best = s; bestCx = cx; }
          }
          if (best < 0) { dropAt = null; return; }
          var after = ev.clientX > bestCx;
          dropAt = best + (after ? 1 : 0);
          marked = list[best];
          marked.classList.add(after ? 'dropAfter' : 'dropBefore');
        }
        function onUp(ev) {
          if (ev.pointerId !== id) return;
          var commit = lifted && dropAt != null;
          var to = dropAt;
          cleanup();
          if (!commit) return;
          // swallow the click that trails this pointerup so the drop never
          // ALSO plays/strums the chord it landed on (capture listener below).
          dragSwallowClick = true;
          setTimeout(function () { dragSwallowClick = false; }, 150);
          var insert = to > index ? to - 1 : to;
          if (insert === index) return;
          invalidateClearUndo(); // A3: a reorder is a mutation like any other
          var movedChord = progression.splice(index, 1)[0];
          progression.splice(insert, 0, movedChord);
          reinferKey();
          renderProg(); renderSuggest(); renderKey();
        }
        function cleanup() {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          clearMark();
          slot.classList.remove('dragging');
          try { slot.releasePointerCapture(id); } catch (err) {}
          document.removeEventListener('touchmove', blockScroll);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        }
        if (isTouch) holdTimer = setTimeout(lift, 300);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
    }
    // The one-shot click swallow for drops (capture phase so it beats the
    // token/diagram onclick that would otherwise strum the landing chord).
    if (el.prog && el.prog.addEventListener) {
      el.prog.addEventListener('click', function (e) {
        if (dragSwallowClick) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    }

    // S-DELETE-UNDO (operator UAT 2026-07-10: "too easy to delete a chord.
    // protect from simple delete. and offer 1 (or 2?) levels of undo using
    // simple mechanism tracking previous actions"). Two halves:
    //   ARM - the slot remover x never deletes on a single tap: the first tap
    //   arms it (red, 1.6s auto-disarm; arming one x disarms any other), the
    //   second tap deletes. Protection WITHOUT a confirm() dialog (the
    //   feedback-debt direction is removing those).
    //   UNDO - deletes push onto a bounded TWO-level stack surfaced through
    //   the same composeRow + Toast.showAction pattern as the Clear-undo
    //   banner above. Subsequent deletes KEEP the stack (that is the two
    //   levels); every other mutation invalidates it via the A3 choke point
    //   (invalidateClearUndo above). A re-render orphans any armed x - the
    //   arm state simply resets, never deletes.
    var removeUndoStack = [], removeUndoBanner = null, removeUndoHandle = null, removeUndoTeardown = null;
    var armedRm = null, armedRmTimer = null;
    function disarmRm() {
      if (armedRmTimer) { clearTimeout(armedRmTimer); armedRmTimer = null; }
      if (armedRm) { armedRm.classList.remove('armed'); armedRm = null; }
    }
    function armRm(btn) {
      disarmRm();
      armedRm = btn; btn.classList.add('armed');
      armedRmTimer = setTimeout(disarmRm, 1600);
    }
    function ensureRemoveUndoBanner() {
      if (!el.prog || !el.prog.parentNode) return false;
      if (!removeUndoBanner) {
        removeUndoBanner = document.createElement('div');
        removeUndoBanner.className = 'composeRow toastAction';
        removeUndoBanner.hidden = true;
        el.prog.parentNode.insertBefore(removeUndoBanner, el.prog);
      }
      return true;
    }
    function paintRemoveUndoHidden() {
      if (removeUndoTeardown) { removeUndoTeardown(); removeUndoTeardown = null; }
      removeUndoHandle = null;
      if (removeUndoBanner) { removeUndoBanner.hidden = true; removeUndoBanner.innerHTML = ''; }
    }
    function dismissRemoveUndo() { if (removeUndoHandle) removeUndoHandle.finish(); else paintRemoveUndoHidden(); }
    function invalidateRemoveUndo() {
      if (!removeUndoStack.length && !armedRm && !removeUndoHandle) return; // cheap no-op on the common path
      removeUndoStack.length = 0;
      disarmRm();
      dismissRemoveUndo();
    }
    function pushRemoveUndo(chord, index) {
      removeUndoStack.push({ chord: chord, index: index });
      if (removeUndoStack.length > 2) removeUndoStack.shift(); // bounded: 2 levels (operator: "1 (or 2?)")
      showRemoveUndoBanner();
    }
    function showRemoveUndoBanner() {
      if (!ensureRemoveUndoBanner() || !removeUndoStack.length) return;
      // Retime for the newest removal: tear down the prior toast instance but
      // keep the stack (its onHide wipes the stack, so snapshot around it).
      var keep = removeUndoStack.slice();
      dismissRemoveUndo();
      removeUndoStack = keep;
      removeUndoBanner.hidden = false;
      removeUndoBanner.innerHTML = '';
      var last = removeUndoStack[removeUndoStack.length - 1];
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      msg.textContent = 'Removed ' + dispChordName(last.chord) + (removeUndoStack.length > 1 ? ' - 2 undos available' : '');
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      var undoBtn = document.createElement('button');
      undoBtn.type = 'button'; undoBtn.className = 'btn ghost ctrlBtn'; undoBtn.textContent = 'Undo';
      undoBtn.onclick = function () {
        var entry = removeUndoStack.pop();
        if (!entry) { dismissRemoveUndo(); return; }
        progression.splice(Math.min(entry.index, progression.length), 0, entry.chord);
        var kc = reinferKey();
        renderProg(); renderSuggest(); renderKey();
        if (kc && el.keyRoots) { renderKeyView(); buildGrid(); }
        if (removeUndoStack.length) showRemoveUndoBanner(); else dismissRemoveUndo();
      };
      btnRow.appendChild(undoBtn);
      removeUndoBanner.appendChild(msg); removeUndoBanner.appendChild(btnRow);
      removeUndoHandle = global.Toast.showAction('Removed ' + dispChordName(last.chord), {
        host: removeUndoBanner,
        onShow: function (host, m, bar) { if (bar) host.appendChild(bar); },
        onHide: function () { removeUndoStack.length = 0; paintRemoveUndoHidden(); }
      });
      removeUndoTeardown = global.Toast.wirePauseOnTouch(removeUndoBanner, removeUndoHandle);
    }

    // Small non-blocking confirmation/error line (replaces alert()). Auto-hides
    // itself after ~3s so it never permanently claims screen space.
    // F31 (UAT): the Save-confirmation call sites used to pass persist=true
    // ("don't hide the [saved] name after a few seconds", B3 pilot UAT) - that
    // reads as a lingering confirmation panel once a NEW progression starts
    // before the user taps it away (operator repro: saved, built a new
    // progression, the PREVIOUS save's confirmation was still on screen).
    // Reversed: every current caller always auto-dismisses. `persist` stays
    // available on this primitive (and the underlying toast.js `Toast.show`) for
    // a future caller that genuinely needs a tap-to-dismiss toast, but nothing
    // passes true today - see hideComposeToast() below for the explicit-clear
    // half of the F31 fix (any subsequent mutating action ends a still-showing
    // toast immediately, same "ANY mutating action invalidates" contract as A3).
    // S-TOAST (UAT U9): delegates to the shared toast.js primitive - see its
    // header comment and showToast() above for the shared-`toastTimer` root
    // cause this replaces. Every call still goes through its OWN host
    // (composeToast), so this toast's timer can never be clobbered by, nor
    // clobber, the unrelated Library toast above.
    function showComposeToast(msg, isErr, persist) {
      if (!ensureComposeUI()) return;
      global.Toast.show(msg, {
        host: composeToast,
        error: isErr,
        persist: persist,
        duration: 3000,
        onShow: function (host, m, isErrFlag) {
          host.textContent = m;
          host.className = 'composeToast' + (isErrFlag ? ' err' : '') + (persist ? ' tap' : '');
          host.hidden = false;
          // a persistent toast must still be dismissable (codex #91: no clear path
          // could strand stale text indefinitely) - one tap hides it.
          host.onclick = function () { host.hidden = true; };
        },
        onHide: function (host) { host.hidden = true; }
      });
    }
    // F31 (UAT): explicit-clear half of the fix, paired with dropping persist
    // from the Save-confirmation calls above. Ends composeToast NOW (and cancels
    // its pending auto-hide timer via Toast.hide()) rather than leaving a
    // confirmation visible under whatever the user does next. Called from
    // invalidateClearUndo() (the SAME choke point every mutating action already
    // calls - add/remove chord, transpose, mode/key change, a starter load, Save
    // itself) and from Clear directly (Clear does not route through
    // invalidateClearUndo - it's what CREATES the undo snapshot, not what
    // invalidates one).
    function hideComposeToast() {
      if (!composeToast) return;
      global.Toast.hide(composeToast, { onHide: function (host) { host.hidden = true; } });
    }
    // Inline name-entry row (replaces prompt()). done(name|null, addToSetlist)
    // fires once - the trimmed name on Save/Enter (plus whether the "Add to
    // setlist" checkbox was checked), or null on Cancel/Escape (same contract
    // prompt() had: null == the user backed out; addToSetlist is meaningless then).
    function openSaveNameRow(defaultName, done) {
      if (!ensureComposeUI()) { done(defaultName, true); return; }
      hideComposeRow();
      composeRow.hidden = false;
      // Present the save name-entry as a MODAL (backdrop + top-anchored card) so
      // the user can't hit Clear / add more chords / other controls mid-save
      // (UAT: Nik), and the card stays clear of a soft keyboard (F10 - see the
      // top-anchor position in .composeRow.asModal, not vertical-center).
      composeRow.classList.add('asModal');
      if (composeModalBackdrop) composeModalBackdrop.hidden = false;
      var input = document.createElement('input');
      input.type = 'text'; input.className = 'composeRowInput';
      input.placeholder = defaultName; input.value = defaultName;
      input.setAttribute('aria-label', 'Progression name');
      // G4/FORK-1 (B3 pilot UAT): a saved custom song is one tap from
      // performance-ready without a second trip to the Library row's own
      // setToggle - checked by default, same "add to setlist" mechanism as
      // the practice-view setToggle (toggleSet), wired by the caller.
      var setLabel = document.createElement('label');
      setLabel.className = 'composeRowSetToggle';
      var setCheck = document.createElement('input');
      setCheck.type = 'checkbox'; setCheck.checked = true;
      setCheck.setAttribute('aria-label', 'Add to setlist');
      setLabel.appendChild(setCheck);
      setLabel.appendChild(document.createTextNode('Add to setlist'));
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button'; saveBtn.className = 'btn red ctrlBtn'; saveBtn.textContent = 'Save';
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Cancel';
      // S-NAVHIST (2026-07-04, PR #144 finding): rawClose (DOM-only) and
      // deliver (the done() callback, which MAY open a new NavHistory layer -
      // the solo-flow's Save chains straight into openStudioCb) are kept as
      // SEPARATE functions so Save/Enter can route through NavHistory.settleAfter
      // directly instead of NavHistory.dismiss(). `delivered` guards done() from
      // firing twice (settleAfter's own trailing history.back(), when nothing
      // opened a new layer, replays through the registered closeFn below).
      var rawSettled = false;
      function rawClose() { if (rawSettled) return; rawSettled = true; hideComposeRow(); }
      var delivered = false;
      function deliver(name) { if (delivered) return; delivered = true; done(name, setCheck.checked); }
      // UAT U7 (2026-07-04): backdrop tap / Escape / hardware-gesture Back all
      // dismiss like Cancel. Cancel/backdrop/Escape never open a new layer, so
      // they stay on NavHistory.dismiss() (the pushed history layer unwinds in
      // step with the modal, per the WIRING CONTRACT). Defaults to null (Cancel)
      // so a hardware Back press - which fires popstate DIRECTLY, bypassing the
      // settleAfter/dismiss calls below - resolves to Cancel rather than
      // silently confirming whatever pendingDismiss last held.
      //
      // Save/Enter is DIFFERENT (S-NAVHIST, PR #144 finding): its outcome MAY
      // open a new NavHistory layer, so it routes directly through settleAfter
      // instead, bypassing dismiss()'s history.back()+popstate path entirely.
      // The prior dismiss()-based wiring let that NavHistory.open() run from
      // INSIDE nav-history.js's popstate `while` loop (see its own settleAfter()
      // doc comment - exactly the "closing one layer opens another" case that
      // function exists to handle safely), double-popping the just-opened layer
      // shut immediately (the name row would flash open then close, one step
      // before the "Studio flashes open then closes" symptom the PR reported).
      var pendingDismiss = null;
      function choose(name) {
        pendingDismiss = name;
        if (window.NavHistory) window.NavHistory.settleAfter(rawClose, function () { deliver(name); });
        else { rawClose(); deliver(name); }
      }
      function cancel() {
        pendingDismiss = null;
        if (window.NavHistory) window.NavHistory.dismiss(); else { rawClose(); deliver(null); }
      }
      saveBtn.onclick = function () { choose(input.value.trim() || defaultName); };
      cancelBtn.onclick = cancel;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); choose(input.value.trim() || defaultName); }
        else if (e.key === 'Escape') { cancel(); }
      };
      if (composeModalBackdrop) composeModalBackdrop.onclick = cancel;
      // Hardware/gesture Back bypasses all of the above (a real popstate fires
      // directly - no JS interposition point exists before it). This registered
      // closeFn is the only thing that then runs, from INSIDE nav-history.js's
      // popstate `while` loop - deferring `deliver` one tick lets the loop
      // finish unwinding before any nested NavHistory.open() the delivered
      // choice might trigger (pendingDismiss defaults to null/Cancel here, which
      // never opens anything, but the defer is cheap, uniform insurance).
      if (window.NavHistory) window.NavHistory.open('composeModal', function () {
        rawClose();
        setTimeout(function () { deliver(pendingDismiss); }, 0);
      });
      composeRow.appendChild(input); composeRow.appendChild(setLabel);
      composeRow.appendChild(saveBtn); composeRow.appendChild(cancelBtn);
      input.focus();
    }
    // Inline two-choice row (replaces confirm()). onPick('save'|'skip') fires once.
    //
    // UAT U7 (2026-07-04, operator Pixel walkthrough): this used to render as a
    // plain inline composeRow - no backdrop, no dim, nothing stopping the rest
    // of the page from reading as still-interactive - so the confirmation got
    // lost among the surrounding controls ("hidden in the page"). It now
    // presents through the SAME composeModalBackdrop pattern openSaveNameRow
    // already uses (sprint-1 S-MODAL): dimmed backdrop, centered/top-anchored
    // card, page behind inert. Dismiss paths (backdrop tap / Escape / hardware
    // Back) all resolve to 'skip' - the same "did nothing destructive, just
    // didn't confirm" semantics Cancel has on the save-name modal, and the
    // conservative choice here too (Skip never persists anything; Save does).
    // S-SONG-MODE UAT-1 (2026-07-16): with a song draft in the buffer, the
    // Chords-mode "Save" button is genuinely ambiguous - the operator tapped it
    // expecting his SONG and got a progression-only save ("was in wrong toggle
    // but wasn't clear... felt like right thing"). When both things exist, ask
    // - the ONE sanctioned ask-shape (copy-coach): outcome-named options, never
    // a silent guess. Mirrors openSoloChoiceRow's modal + NavHistory wiring
    // (see its comments for the settleAfter/double-pop rationale). Wired at the
    // cSave BUTTON only - the solo flow's internal saveProgression() calls must
    // never grow a nested second modal.
    function openSaveChoiceRow() {
      if (!ensureComposeUI()) { saveProgression(); return; } // no modal surface - old behavior
      hideComposeRow();
      composeRow.hidden = false;
      composeRow.classList.add('asModal');
      if (composeModalBackdrop) composeModalBackdrop.hidden = false;
      var n = songSections.length;
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      // S-COMPOSE-CALM (progression-first, operator interview 2026-07-19):
      // quick capture is the zero-thought primary even with a draft in
      // flight; adding to the draft is the explicit second intent, and the
      // SONG's own save lives on the canvas (one home per action).
      msg.textContent = 'Save this progression, or add it to your song?';
      var progBtn = document.createElement('button');
      progBtn.type = 'button'; progBtn.className = 'btn red ctrlBtn';
      progBtn.textContent = 'Save progression';
      var songBtn = document.createElement('button');
      songBtn.type = 'button'; songBtn.className = 'btn ghost ctrlBtn';
      songBtn.textContent = 'Add to your song (' + n + (n === 1 ? ' section)' : ' sections)');
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Keep building';
      var delivered = false;
      // 'prog' re-renders this SAME composeRow into the name row
      // (openSaveNameRow clears + repopulates it as its own first step), so
      // 'song' and 'cancel' need this row's DOM cleared here.
      function rawClose(choice) { if (choice !== 'prog') hideComposeRow(); }
      function deliver(choice) {
        if (delivered) return; delivered = true;
        if (choice === 'song') { returnToSong = true; addSongSection(); } // strip -> section -> canvas (the grow hop)
        else if (choice === 'prog') saveProgression();
      }
      var pendingDismiss = 'cancel'; // hardware Back = dismiss, never a save
      function choose(choice) {
        pendingDismiss = choice;
        if (window.NavHistory) window.NavHistory.settleAfter(function () { rawClose(choice); }, function () { deliver(choice); });
        else { rawClose(choice); deliver(choice); }
      }
      songBtn.onclick = function () { choose('song'); };
      progBtn.onclick = function () { choose('prog'); };
      cancelBtn.onclick = function () { choose('cancel'); };
      composeRow.onkeydown = function (e) { if (e.key === 'Escape') choose('cancel'); };
      if (composeModalBackdrop) composeModalBackdrop.onclick = function () { choose('cancel'); };
      if (window.NavHistory) window.NavHistory.open('composeModal', function () {
        rawClose(pendingDismiss);
        setTimeout(function () { deliver(pendingDismiss); }, 0);
      });
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      btnRow.appendChild(progBtn); btnRow.appendChild(songBtn); btnRow.appendChild(cancelBtn);
      composeRow.appendChild(msg); composeRow.appendChild(btnRow);
      composeRow.focus();
    }
    // #265-A: intent clarification for a FRESH progression save (no song
    // structure touched). The Chords tab's Save sits next to the "Add to song"
    // machinery, and the operator's UAT found that ambiguous: someone saving a
    // quick idea shouldn't wonder if they just committed to writing a song.
    // Same modal shell + NavHistory wiring as openSaveChoiceRow (its sibling -
    // that one asks the INVERSE question when a song draft DOES exist).
    // "Build a song with it" routes through the existing addSongSection
    // returnToSong path: current strip becomes the dropdown's section and the
    // Song canvas opens with the strip intact (the edit-the-verse workflow).
    function openSaveIntentRow() {
      if (!ensureComposeUI()) { saveProgression(); return; } // no modal surface - old behavior
      hideComposeRow();
      composeRow.hidden = false;
      composeRow.classList.add('asModal');
      if (composeModalBackdrop) composeModalBackdrop.hidden = false;
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      msg.textContent = 'Save this progression, or build it into a song?';
      var progBtn = document.createElement('button');
      progBtn.type = 'button'; progBtn.className = 'btn red ctrlBtn';
      progBtn.textContent = 'Save progression';
      var songBtn = document.createElement('button');
      songBtn.type = 'button'; songBtn.className = 'btn ghost ctrlBtn';
      songBtn.textContent = 'Grow it into a song';
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Keep building';
      var delivered = false;
      // 'prog' re-renders this SAME composeRow into the name row; 'song' and
      // 'cancel' need the row's DOM cleared here (same contract as the sibling).
      function rawClose(choice) { if (choice !== 'prog') hideComposeRow(); }
      function deliver(choice) {
        if (delivered) return; delivered = true;
        if (choice === 'prog') saveProgression();
        else if (choice === 'song') { returnToSong = true; addSongSection(); }
      }
      var pendingDismiss = 'cancel'; // hardware Back = dismiss, never a save
      function choose(choice) {
        pendingDismiss = choice;
        if (window.NavHistory) window.NavHistory.settleAfter(function () { rawClose(choice); }, function () { deliver(choice); });
        else { rawClose(choice); deliver(choice); }
      }
      progBtn.onclick = function () { choose('prog'); };
      songBtn.onclick = function () { choose('song'); };
      cancelBtn.onclick = function () { choose('cancel'); };
      composeRow.onkeydown = function (e) { if (e.key === 'Escape') choose('cancel'); };
      if (composeModalBackdrop) composeModalBackdrop.onclick = function () { choose('cancel'); };
      if (window.NavHistory) window.NavHistory.open('composeModal', function () {
        rawClose(pendingDismiss);
        setTimeout(function () { deliver(pendingDismiss); }, 0);
      });
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      btnRow.appendChild(progBtn); btnRow.appendChild(songBtn); btnRow.appendChild(cancelBtn);
      composeRow.appendChild(msg); composeRow.appendChild(btnRow);
      composeRow.focus();
    }
    function openSoloChoiceRow(onPick) {
      if (!ensureComposeUI()) { onPick('skip'); return; }
      hideComposeRow();
      composeRow.hidden = false;
      composeRow.classList.add('asModal');
      if (composeModalBackdrop) composeModalBackdrop.hidden = false;
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      // S-PERSONA-COPY (copy-coach, 2026-07-10): outcome-named buttons inside the
      // BEGINNER vocabulary budget - no internal jargon ("Studio"), no mechanism
      // names ("Save", "Skip"). Universal copy (better for every level), choice
      // semantics unchanged ('save'/'skip'/'cancel' below).
      msg.textContent = 'Keep this progression, or just practice over it?';
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button'; saveBtn.className = 'btn red ctrlBtn'; saveBtn.textContent = 'Keep + practice';
      var skipBtn = document.createElement('button');
      skipBtn.type = 'button'; skipBtn.className = 'btn ghost ctrlBtn'; skipBtn.textContent = 'Just practice';
      var delivered = false;
      // S-NAVHIST (2026-07-04, PR #144 finding): 'save' hands this SAME
      // composeRow container off to openSaveNameRow (it re-renders in place -
      // not a separate DOM layer, and openSaveNameRow already clears+repopulates
      // it as its own first step) - hiding it here too would wipe the name row
      // it just rendered. 'skip' opens the Studio (a fully separate surface),
      // so THIS row's own DOM genuinely needs clearing.
      function rawClose(choice) { if (choice !== 'save') hideComposeRow(); }
      function deliver(choice) { if (delivered) return; delivered = true; onPick(choice); }
      // pendingDismiss defaults to 'cancel' so a hardware Back press (which
      // bypasses the settleAfter path below entirely - see below) DISMISSES the
      // modal and stays on Compose, matching backdrop/Escape. A dismiss gesture must
      // never navigate: only an explicit Save/Skip button press opens the Studio.
      // (S-POSTPROG-FLOW "can't cancel out of Solo" fix, 2026-07-10.)
      var pendingDismiss = 'cancel';
      // Both outcomes MAY open a new NavHistory layer (Save -> the name-entry
      // row, reusing this modal slot; Skip -> the Studio) - route directly
      // through settleAfter, NOT NavHistory.dismiss(). dismiss() closes via
      // history.back() -> popstate -> nav-history.js's popstate `while` loop,
      // and a NavHistory.open() call made from a closeFn running INSIDE that
      // loop re-triggers its stack.length recheck, double-popping the
      // just-opened layer immediately shut (PR #144's "Studio flashes open
      // then closes" finding). settleAfter runs outside that loop entirely -
      // no double-pop possible.
      function choose(choice) {
        pendingDismiss = choice;
        if (window.NavHistory) window.NavHistory.settleAfter(function () { rawClose(choice); }, function () { deliver(choice); });
        else { rawClose(choice); deliver(choice); }
      }
      saveBtn.onclick = function () { choose('save'); };
      skipBtn.onclick = function () { choose('skip'); };
      composeRow.onkeydown = function (e) { if (e.key === 'Escape') choose('cancel'); };
      if (composeModalBackdrop) composeModalBackdrop.onclick = function () { choose('cancel'); };
      // Hardware/gesture Back bypasses all of the above (a real popstate fires
      // directly - no JS interposition point exists before it). This registered
      // closeFn is the only thing that then runs, from INSIDE nav-history.js's
      // popstate `while` loop - deferring `deliver` one tick lets the loop
      // finish unwinding before any nested NavHistory.open() the delivered
      // choice triggers (the 'skip' default opens the Studio), avoiding the
      // same double-pop.
      if (window.NavHistory) window.NavHistory.open('composeModal', function () {
        rawClose(pendingDismiss);
        setTimeout(function () { deliver(pendingDismiss); }, 0);
      });
      // Cancel: a VISIBLE dismiss so "take me back to my progression" is discoverable,
      // not just a backdrop tap (the operator UAT gap - a new user saw no way out).
      var cancelBtn = document.createElement('button');
      // S-PERSONA-COPY: outcome-named dismiss - closing the modal = back to composing.
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Keep building';
      cancelBtn.onclick = function () { choose('cancel'); };
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      btnRow.appendChild(saveBtn); btnRow.appendChild(skipBtn); btnRow.appendChild(cancelBtn);
      composeRow.appendChild(msg); composeRow.appendChild(btnRow);
      composeRow.focus();
    }
    // Derive key/mode for a saved progression the same way repertoire.js's
    // deriveKey() does (first-chord regex) - reuse it directly (pure, node-tested)
    // rather than duplicating the regex. Falls back to the explicit songKey when
    // one was picked in Compose (more reliable than re-parsing chord #1, e.g. a
    // vi-IV-I-V progression built from a picked key starts on the relative chord).
    function deriveProgressionKey(seq) {
      // songKey.mode is one of the 4 Compose mode names (Major/Minor/Mixolydian/
      // Dorian); lowercase is the exact locked-interface vocabulary. The old
      // `=== 'Minor' ? 'minor' : 'major'` ternary silently relabeled Dorian (a
      // minor-family mode) as major and discarded Mixolydian entirely - a
      // progression built in Dorian would solo over the wrong scale.
      // UAT r5 F1: a DEFAULTED key never outranks the music - prefer the
      // content-derived key and fall back to the default only when the content
      // itself doesn't resolve (so an empty canvas still realizes C starters).
      if (songKey.root && !songKey.defaulted) return { key: songKey.root, mode: songKey.mode.toLowerCase() };
      var d = global.Repertoire && global.Repertoire.deriveKey ? global.Repertoire.deriveKey({ seq: seq }) : { key: null, mode: null };
      if (d.key) return { key: d.key, mode: d.mode || 'major' };
      if (songKey.root) return { key: songKey.root, mode: songKey.mode.toLowerCase() };
      return { key: null, mode: 'major' };
    }
    // #265-B: context-aware default names collide on repeat quick-saves -
    // suffix a count so every saved asset keeps a distinct, scannable title.
    function uniqueCustomName(base) {
      function taken(nm) {
        for (var i = 0; i < customSongs.length; i++) if (customSongs[i].t === nm) return true;
        return false;
      }
      var name = base, n = 2;
      while (taken(name)) name = base + ' ' + (n++);
      return name;
    }
    // Save the in-progress Compose progression as a stable custom song (cs.id).
    // Populates key/mode (Task 2 requirement 1, locked-interface contract) so the
    // saved song is immediately eligible for "Solo over it" + the Studio.
    //
    // Async by necessity: the inline name row (openSaveNameRow) needs a user tap
    // before a name is known, so this can no longer return synchronously the way
    // the old prompt()-based version did. done(record|null) fires once - the
    // saved record on Save, or null if there was nothing to save / the user
    // cancelled the name row. `done` is optional (the plain Save button doesn't
    // need the result - the inline toast already gives feedback).
    function saveProgression(done) {
      done = done || function () {};
      invalidateClearUndo(); // S-CLEARGUARD/A3: Save invalidates any pending Clear-undo
      if (progression.length === 0) { showComposeToast('Build a progression first.', true); done(null); return; }
      // A1 (analysis-refactor-enhance-20260704): one truthful failure message shared
      // by both branches below (update-in-place + fresh save) - a quota/blocked-storage
      // write must never tell the user it saved (the app's #1 named fatal-dismissal
      // trigger is exactly this: a saved song silently vanishing after being told it saved).
      // SAVE_FAIL_MSG is hoisted to mount()'s top scope (near safeSet) as of
      // S-HARDEN H4 so toggleSet's setlist-add branch can reuse the exact same
      // wording instead of drifting its own copy.
      // Snapshot seq AND key/mode NOW: the name row waits on a user tap while
      // the progression and key panel stay live behind it. What gets saved is
      // what the user asked to save - not whatever the session mutated into
      // (or cleared to) while the row was open.
      var snapSeq = progression.slice();
      var km = deriveProgressionKey(snapSeq);
      // Editing a progression already saved this session -> UPDATE that same song in
      // place (no new copy, no name prompt), per the operator's "update the same
      // saved song" choice. The chord edits + any re-key flow straight onto cs.
      if (savedComposeId && customById(savedComposeId)) {
        var upd = updateCustomItem(savedComposeId, { seq: snapSeq, key: km.key, mode: km.mode });
        if (upd) {
          // updateCustomItem already persisted via its own internal saveCustom() call
          // (that function body sits outside this mission's line-region grant, shared
          // with 2 other call sites that have different null-semantics - see PR notes).
          // Re-invoking saveCustom() here writes the SAME already-mutated customSongs
          // array again (a harmless repeat of the identical value) purely to observe
          // THIS write's real success/failure - the only way to get a truthful signal
          // for the "Updated" toast without touching updateCustomItem's body.
          var updOk = saveCustom();
          // F31 (UAT): no persist - the confirmation always auto-dismisses now (see
          // showComposeToast's header comment + hideComposeToast() below).
          if (updOk) recordComp('comp-progressions'); // M-COMPETENCY: a real save is progression evidence
          showComposeToast(updOk ? ('Updated ' + upd.t) : SAVE_FAIL_MSG, !updOk);
          done(upd); return;
        }
        savedComposeId = null; // the saved song vanished - fall through to a fresh save
      }
      // S6 (B3 pilot UAT handoff): a real-title default, not placeholder text.
      // #265-B: the default names the ASSET TYPE - a 4-chord loop saved from
      // the Chords tab is a PROGRESSION, not a "track" (the old 'Original
      // track' default read mismatched in the Library). The song path keeps
      // its own asset-aware default ('Song in C', assembleSong). Uniquified
      // ('Original progression 2', 3...) so repeat quick-saves don't stack
      // identical titles. The ARTIST stays empty (S5 finding: a mirrored
      // artist duplicated the title in the Studio's YouTube query).
      openSaveNameRow(uniqueCustomName('Original progression'), function (name, addToSetlist) {
        if (name === null) { done(null); return; } // cancelled
        var cs = {
          id: 'm' + Date.now(), t: name, a: '', y: new Date().getFullYear(), d: 'Mine',
          seq: snapSeq, custom: true, key: km.key, mode: km.mode, yt: null
        };
        customSongs.push(cs);
        var ok = saveCustom();
        rebuildAll(); renderFilterChips();
        // Post-save discoverability (B3): flag the new row for renderSongs() to
        // scroll-to + highlight - whichever call actually paints it (below, or
        // toggleSet's own renderSongs() when the checkbox added it to the set).
        pendingHighlightId = cs.id;
        if (addToSetlist) toggleSet(cs.id, true); else renderSongs(); // toTop - a just-saved progression is next up
        // Linked regardless of write success: the record lives in customSongs for
        // this session either way (Studio/Setlist keep working until reload), so a
        // second Save click correctly takes the update-in-place branch above rather
        // than creating a duplicate. It will NOT survive a reload if storage stays
        // blocked - the failure toast below says so.
        savedComposeId = cs.id; // link the buffer to the saved song for re-save / re-solo
        if (ok) recordComp('comp-progressions'); // M-COMPETENCY: a real save is progression evidence
        // F31 (UAT): no persist - see showComposeToast's header comment.
        // #265-C: success gets the named-asset banner with a one-tap next step;
        // failure keeps the truthful error toast (never dress up a failed write).
        if (ok) showSaveDoneBanner(cs, addToSetlist); else showComposeToast(SAVE_FAIL_MSG, true);
        done(cs);
      });
    }
    // Create a brand-new custom item from the Add/Edit form (Requirement 3, Task 2).
    // No seq -> a standalone custom TRACK (no chord sheet; playable straight from
    // the Studio per repertoire.js's existing playability() logic). A seq -> a
    // custom SONG (same shape saveProgression() produces).
    function createCustomItem(f) {
      var cs = {
        id: 'm' + Date.now(), t: f.title || 'Untitled', a: f.artist || '', y: new Date().getFullYear(),
        d: 'Mine', genre: f.genre || '', custom: true, key: f.key || null, mode: f.mode || 'major', yt: f.yt || null
      };
      if (f.seq && f.seq.length) cs.seq = f.seq.slice();
      // Fork of a catalog song: record which song it shadows + preserve the
      // original chords+lyrics sheet verbatim (rebuildAll keeps cs.sheet over a
      // chord-only rebuild). The year carries over so the shadow reads identically.
      if (f.forkOf) cs.forkOf = f.forkOf;
      // Clone the preserved sheet so the fork OWNS its rows - a shared reference to the
      // catalog song's sheet array could be mutated in place from either side.
      if (f.sheet && f.sheet.length) cs.sheet = f.sheet.map(function (r) { return Array.isArray(r) ? r.slice() : r; });
      if (f.y != null) cs.y = f.y;
      // Forking a SETLISTED catalog song: rebuildAll shadows the catalog kN id, so
      // the setlist slot pointing at it would go dangling (the song vanishes from
      // the set). Remap kN -> the new fork id so the entry is REPLACED, not lost.
      if (cs.forkOf && remapSetlist(STATE.setlist, cs.forkOf, cs.id)) saveSet();
      customSongs.push(cs); saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
      return cs;
    }
    // Apply an edit (title/artist/genre/key/mode/seq/yt) to an EXISTING custom item.
    function updateCustomItem(id, f) {
      var cs = null;
      for (var i = 0; i < customSongs.length; i++) if (customSongs[i].id === id) { cs = customSongs[i]; break; }
      if (!cs) return null;
      cs.t = f.title || cs.t; cs.a = f.artist != null ? f.artist : cs.a; cs.genre = f.genre != null ? f.genre : cs.genre;
      cs.key = f.key != null ? f.key : cs.key; cs.mode = f.mode || cs.mode; cs.yt = f.yt != null ? f.yt : cs.yt;
      if (f.seq && f.seq.length) cs.seq = f.seq.slice(); else if (f.seq) delete cs.seq;
      // Phase B (additive - no pre-existing caller passes sheet): Continue
      // building's update-in-place save carries the rebuilt section sheet.
      if (f.sheet && f.sheet.length) cs.sheet = f.sheet;
      saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
      if (STATE.current && STATE.current.id === id) {
        if (!cs.seq || !cs.seq.length) switchTab('library'); else renderPractice();
      }
      return cs;
    }
    // S-SET-INTEGRITY (UAT U22, delete-heal): TOAST+ACTION undo for a custom
    // item delete/fork-revert - the interaction-safety.md guard #3 primitive
    // the setlist's own item-remove already has (showSetUndoBanner below),
    // now on the ONE other place a library item can vanish out from under a
    // setlist. Lives in the Library screen (delete/revert always
    // switchTab('library') right after deleteCustomItem returns - see the
    // D3s note there), mirroring showSetUndoBanner's stable-sibling-element
    // pattern (never rebuilt inside renderSongs()'s innerHTML wipe).
    var delUndoBanner = null, delUndoHandle = null, delUndoTeardown = null;
    function ensureDelUndoBanner() {
      if (!el.libSongs || !el.songsList) return false;
      if (!delUndoBanner) {
        delUndoBanner = document.createElement('div');
        delUndoBanner.className = 'setUndo toastAction'; // same primitive skin as the setlist remove-undo
        delUndoBanner.hidden = true;
        el.libSongs.insertBefore(delUndoBanner, el.songsList);
      }
      return true;
    }
    function paintDelUndoHidden() {
      if (delUndoTeardown) { delUndoTeardown(); delUndoTeardown = null; }
      delUndoHandle = null;
      if (delUndoBanner) { delUndoBanner.hidden = true; delUndoBanner.innerHTML = ''; }
    }
    // Only one pending delete-undo at a time - mirrors dismissSetUndo()'s
    // "tear down a stale prior instance first" discipline below.
    function dismissDelUndo() { if (delUndoHandle) delUndoHandle.finish(); }
    // victim: the removed customSongs record (still a live object reference -
    // deleteCustomItem only spliced it OUT of the array, never destroyed it).
    // customIdx/setlistIdx: captured BEFORE the mutation, so Undo can restore
    // both original positions - a plain delete removed a setlist slot
    // outright (setlistIdx>=0, revertToId==null); a fork-revert REPLACED the
    // slot in place with the catalog original (setlistIdx>=0, revertToId is
    // that catalog id) rather than removing it, so the outcome message and
    // the undo restore path both branch on isFork.
    function showDeleteUndoBanner(victim, customIdx, setlistIdx, revertToId) {
      if (!ensureDelUndoBanner()) return;
      dismissDelUndo();
      delUndoBanner.hidden = false;
      delUndoBanner.innerHTML = '';
      var isFork = !!(victim && victim.forkOf);
      var title = (victim && victim.t) || 'song';
      // Singular "your setlist" (this app has exactly ONE Jam setlist per
      // profile, per data-model.md - never plural "N setlists").
      var msg = isFork ? ('Reverted ' + title + ' to the original') : ('Deleted ' + title);
      if (!isFork && setlistIdx >= 0) msg += ' - also removed from your setlist';
      var msgEl = document.createElement('span'); msgEl.textContent = msg;
      var undoBtn = document.createElement('button');
      undoBtn.type = 'button'; undoBtn.className = 'btn ghost'; undoBtn.textContent = 'Undo';
      undoBtn.onclick = function () {
        if (delUndoHandle) delUndoHandle.finish();
        var atC = Math.min(customIdx < 0 ? customSongs.length : customIdx, customSongs.length);
        customSongs.splice(atC, 0, victim);
        var custOk = saveCustom();
        var setOk = true;
        if (setlistIdx >= 0) {
          if (revertToId != null) {
            // fork-revert: put the fork id back wherever the catalog id (that
            // remapSetlist substituted in) now sits - re-resolved at undo
            // time in case another setlist edit happened during the window.
            var at = STATE.setlist.indexOf(revertToId);
            if (at >= 0) STATE.setlist[at] = victim.id;
          } else {
            var atS = Math.min(setlistIdx, STATE.setlist.length); // clamp - a mutation mid-window may have shifted this
            STATE.setlist.splice(atS, 0, victim.id);
          }
          setOk = saveSet();
        }
        rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist(); syncQueueToSetlist();
        // D-SAVE-TRUTH: a restore that silently failed to persist is worse
        // than one that says so - same truthful-on-failure discipline as
        // saveProgression/toggleSet (SAVE_FAIL_MSG), on the Library toast host
        // (a different host than delUndoBanner, so no collision with its
        // own just-finished toast).
        if (!custOk || !setOk) showToast(SAVE_FAIL_MSG, true);
      };
      delUndoBanner.appendChild(msgEl); delUndoBanner.appendChild(undoBtn);
      delUndoHandle = global.Toast.showAction(msg, {
        host: delUndoBanner,
        onShow: function (host, m, bar) { if (bar) host.appendChild(bar); },
        onHide: function () { paintDelUndoHidden(); }
      });
      delUndoTeardown = global.Toast.wirePauseOnTouch(delUndoBanner, delUndoHandle);
    }
    function deleteCustomItem(id) {
      var victim = customById(id);
      var customIdx = customSongs.indexOf(victim); // -1 if already gone (defensive; capture BEFORE the filter below)
      customSongs = customSongs.filter(function (cs) { return cs.id !== id; });
      saveCustom();
      // Capture setlist membership BEFORE remapSetlist mutates it (S-SET-INTEGRITY,
      // UAT U22 delete-heal) - undo needs the ORIGINAL slot to restore into.
      var setlistIdx = STATE.setlist.indexOf(id);
      var revertToId = (victim && victim.forkOf) ? victim.forkOf : null;
      // Reverting a FORK: rebuildAll un-shadows the catalog original, so restore the
      // catalog id into every slot that held the fork (keep the song setlisted). A
      // plain custom delete has no original to fall back to, so drop those slots (null).
      if (remapSetlist(STATE.setlist, id, revertToId)) saveSet();
      // D3s (pilot UAT): a deleted song must not stay reachable via the active
      // running-order queue or a stale STATE.current. Both delete call sites
      // already switchTab('library') right after this returns, but switchTab
      // pushes a NavHistory entry whose Back-button close callback replays
      // applyTab('practice') -> renderPractice() - which would otherwise render
      // the just-deleted song as a still-fully-formed ghost object (its own
      // setToggle could even re-add the dead id back into the setlist). Purging
      // the queue + clearing STATE.current here makes renderPractice's existing
      // "!STATE.current -> empty state" guard the one that actually fires.
      QUEUE.remove(id);
      if (STATE.current && STATE.current.id === id) STATE.current = null;
      rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist();
      if (victim) showDeleteUndoBanner(victim, customIdx, setlistIdx, revertToId);
    }
    function customById(id) { for (var i = 0; i < customSongs.length; i++) if (customSongs[i].id === id) return customSongs[i]; return null; }
    // ---- M2 Add/Edit form entry points ----
    function openAddForm() {
      if (!repForm) return;
      repForm.open({
        mode: 'create',
        onSave: function (f) { createCustomItem(f); }
      });
    }
    // Attach/replace a custom song's video inline from the Studio's "add the video you
    // found" paste box: write cs.yt via updateCustomItem and return the studio-shaped
    // record so the Studio re-renders with the embed. null if the song vanished.
    function setCustomVideo(id, yt) {
      var updated = updateCustomItem(id, { yt: yt });
      if (!updated) return null;
      return { id: updated.id, title: updated.t, artist: updated.a, key: updated.key, mode: updated.mode, custom: true, yt: updated.yt };
    }
    function openEditForm(id) {
      if (!repForm) return;
      var cs = customById(id);
      if (!cs) return;
      repForm.open({
        // A fork edits in FORK mode too (chords hidden, its sheet preserved) -
        // the generic form would expose Chords, but rebuildAll keeps the fork's
        // sheet, so a chord edit would be silently ignored. Chord/lyric editing
        // is slice 2. Its destructive action is "Revert to original".
        mode: 'edit', item: cs, fork: !!cs.forkOf,
        onSave: function (f) {
          var updated = updateCustomItem(id, f);
          // Reopening the Studio here is the actual regression test for the
          // video-persistence bug (Task 2 success criteria): the video now lives
          // on the SAVED item (cs.yt), so a fresh openStudioCb call for the same
          // id shows the same video without any in-memory re-render trick.
          if (updated && updated.yt && openStudioCb) {
            openStudioCb({ id: updated.id, title: updated.t, artist: updated.a, key: updated.key, mode: updated.mode, custom: true, yt: updated.yt });
          }
        },
        onDelete: function () { deleteCustomItem(id); switchTab('library'); }
      });
    }
    // Studio "Edit this track to add a video" entry point. If the studio item maps
    // to a saved custom song/track, edit it; otherwise (an ephemeral or unmatched
    // item) open a prefilled CREATE form so the user can save + curate it. Never a
    // silent close.
    function openEditOrAdd(t) {
      if (!repForm) return;
      var cs = (t && t.id != null) ? customById(t.id) : null;
      if (cs) { openEditForm(cs.id); return; }
      repForm.open({
        mode: 'create',
        item: {
          t: (t && (t.title || t.t)) || '', a: (t && (t.artist || t.a)) || '',
          key: (t && t.key) || '', mode: (t && t.mode) || 'major', yt: (t && t.yt) || null,
          // D-TRACKLIB-1 seam completion: the jam-discovery panel passes genre;
          // forward it so the create form (and saved item) carry it.
          genre: (t && t.genre) || ''
        },
        onSave: function (f) { createCustomItem(f); }
      });
    }
    // Fork a CATALOG song into an editable, user-owned copy that SHADOWS the
    // original (add a video / rename / re-key). Chords + lyrics are preserved
    // verbatim (passed through as sheet + seq); the form hides the Chords field
    // in fork mode. On save, open the new copy so the user lands on their version.
    function openForkForm(song) {
      if (!repForm || !song) return;
      var sk = soloKeyFor(song, (song.seq || []), 0); // derive a key if the record lacks one
      repForm.open({
        mode: 'create', fork: true,
        item: {
          // fall back to title/artist so the form prefills regardless of record shape
          // (a merged/track-shaped record carries title/artist, a song carries t/a)
          t: song.t != null ? song.t : song.title, a: song.a != null ? song.a : song.artist,
          key: song.key || (sk && sk.key) || '', mode: song.mode || (sk && sk.mode) || 'major',
          genre: song.genre || '', yt: song.yt || null
        },
        onSave: function (f) {
          f.forkOf = song.id;                       // shadow this catalog id
          if (song.sheet && song.sheet.length) f.sheet = song.sheet; // preserve chords+lyrics
          if (song.seq && song.seq.length) f.seq = song.seq.slice(); // preserve chord chips / solo key
          if (song.y != null) f.y = song.y;
          var cs = createCustomItem(f);
          if (cs) { STATE.transpose = 0; openPractice(cs.id); }
        }
      });
    }
    if (el.addBtn) el.addBtn.onclick = openAddForm;
    // S-SONG-MODE UAT-2: extracted from the cClear handler verbatim so the Song
    // canvas's "Build the chords" can start a genuinely FRESH section through
    // the exact same guarded path (snapshot -> clear -> re-render -> Undo
    // banner). Behavior of the Clear button itself is unchanged.
    function clearProgression(bannerMsg) {
      if (!progression.length) return; // button is hidden then too - defensive no-op
      // S-CLEARGUARD (F1/A3): snapshot the full pre-Clear state BEFORE wiping
      // it, so the persistent Undo banner (shown below) can restore it
      // exactly. Never a native confirm() - see the banner functions above.
      clearUndoSnapshot = buildClearSnapshot(progression, cTpose, songKey, savedComposeId);
      progression = []; cTpose = 0;
      editingSectionIdx = null; // S-SECTION-EDIT: a Clear cancels an in-flight section edit
      savedComposeId = null;   // fresh canvas - detach from any saved song
      hideComposeRow();        // dismiss an open save/solo dialog (don't strand it over an empty canvas)
      hideComposeToast();      // F31: a stale save-confirmation toast must not survive a Clear (Clear doesn't route through invalidateClearUndo)
      hideSaveDoneBanner();    // #265-C: same F31 contract for the saved-with-next-step banner
      // S-CLEAR-INKEY (UAT 2026-07-10): a fresh canvas returns to the follow-the-key
      // view (In-key on the default key), not a stale 'All' pin from before the Clear -
      // matching the initial default (D-DEFAULT-C). Reset the pin, then always rebuild
      // the palette so the view reflects it even when the key itself didn't change.
      chordView = null;
      var kc = reinferKey();
      renderProg(); renderKey();
      if (el.keyRoots) renderKeyView();
      buildGrid();
      showClearUndoBanner(bannerMsg);
    }
    if (el.cClear) el.cClear.onclick = function () { clearProgression(); };
    // S-SONG-MODE UAT-1: with a song draft buffered, "Save" must ASK, not guess
    // (see openSaveChoiceRow). Draft + no progression -> the song is the only
    // thing to save, go straight there. No draft -> the original flow untouched
    // (and the solo flow's internal saveProgression() calls never see any of
    // this - the gate lives only on the button).
    if (el.cSave) el.cSave.onclick = function () {
      // S-COMPOSE-CALM: with only a draft, the saveable thing IS the song -
      // open its editor (the canvas owns the Save-song action), never a
      // surprise name-row from the jam surface.
      if (songSections.length && !progression.length) { setComposeMode('song'); return; }
      if (songSections.length && progression.length) { openSaveChoiceRow(); return; }
      // #265-A (operator UAT): a FRESH save with no song structure asks intent
      // first - "save a quick progression idea, or build a song with it?" - via
      // openSaveIntentRow. A session-linked re-save (update-in-place) skips the
      // ask: it's a quick update of a thing whose intent was already decided.
      if (savedComposeId && customById(savedComposeId)) { saveProgression(); return; }
      openSaveIntentRow();
    };
    if (el.cMax) el.cMax.onclick = function () { if (progression.length) openMaxWith(progression.slice()); };
    if (el.cTup) el.cTup.onclick = function () { composeTpose(1); };
    if (el.cTdown) el.cTdown.onclick = function () { composeTpose(-1); };
    // P3 (M3): "Solo over a backing track" opens the Practice Studio directly for the
    // composed key+mode - solo scale + chords + circle, plus a curated video or a
    // YouTube search for one. The finder tab is retired, so this goes straight to the
    // studio instead of seeding a finder view. seedBackingKey stays wired as a no-op
    // fallback when no studio callback is present.
    //
    // Bug fix (video-persistence): the ephemeral path passes a THROWAWAY object
    // ({title:'Solo practice', ...}) with no stable id, so any video pasted into
    // that Studio session has nothing to attach to and vanishes on close. Gate
    // video curation behind a SAVED progression via the inline choice row
    // (replaces the old confirm()/prompt()/alert() chain - no native dialogs):
    // "Save & open Studio" saves first (cs.id is what a video attaches to, via
    // the Add/Edit form's updateCustomItem) then opens the Studio for that saved
    // song, matching the locked-interface shape exactly (id/title/artist/key/
    // mode/custom); "Skip" opens the ephemeral Studio unchanged.
    if (el.soloBackingBtn) el.soloBackingBtn.onclick = function () {
      // G2 S-POSTPROG-CUE: tapping Solo is the cue's goal - retire it (listener
      // in play/index.html dismisses 'postprog' + clears the slot).
      notifyGuidanceEvent('music:compose-solo');
      if (!songKey.root || !progression.length) return;
      if (openStudioCb) {
        // Already saved this session: no re-prompt. Save-in-place (updates the linked
        // song if the chords changed, no-op-ish if not) then open its Studio directly
        // - with the Edit button, since it's a real saved song. No duplicate.
        if (savedComposeId && customById(savedComposeId)) {
          saveProgression(function (saved) {
            // S5 handoff: seq + genre widen the payload so the Studio's custom
            // search query (tracks.js) can enrich "Watch on YouTube" with the
            // actual chords/genre instead of the bare title. Additive fields
            // only - saved.genre is normally undefined for a Compose-saved
            // progression (saveProgression sets no genre), which is fine: the
            // consumer treats a falsy genre as "omit it".
            if (saved) openStudioCb({ id: saved.id, title: saved.t, artist: saved.a, key: saved.key, mode: saved.mode, custom: true, seq: saved.seq, genre: saved.genre });
          });
          return;
        }
        // Never saved -> the save/skip choice (Save & open Studio links it going forward).
        openSoloChoiceRow(function (choice) {
          if (choice === 'save') {
            saveProgression(function (saved) {
              if (!saved) return; // user cancelled the inline name row
              openStudioCb({ id: saved.id, title: saved.t, artist: saved.a, key: saved.key, mode: saved.mode, custom: true, seq: saved.seq, genre: saved.genre });
            });
            return;
          }
          if (choice === 'cancel') return; // dismiss - stay on Compose, keep the progression
          // Skip: open the ephemeral Studio without saving (locked vocabulary is
          // lowercase - songKey.mode is one of the capitalized Compose names).
          // S-SOLO-SCALE-DEFAULT (2026-07-10): carry the live progression as `seq` so the
          // Studio's progression-aware default (inferSoloDefault) can read the ACTUAL
          // chords - the Save path already passes saved.seq; Skip dropped it, so a bVII-
          // laden progression could never infer Mixolydian on the (default) Skip path.
          openStudioCb({ title: 'Solo practice', artist: '', key: songKey.root, mode: songKey.mode.toLowerCase(), seq: progression.slice() });
        });
      } else {
        switchTab('library');
        seedBackingKey(songKey.root, songKey.mode);
      }
    };
    // The key/mode chip (#keyPickerCompact) is injected + wired by buildKeyPicker; it
    // opens the fly-out on tap (the old #cKey "snap back to key" readout is retired -
    // the chip is the unified key surface now).
    if (el.keyClear) el.keyClear.onclick = function () { invalidateClearUndo(); songKey.root = null; songKey.explicit = false; songKey.defaulted = false; keyPopoverOpen = false; buildKeyPicker(); renderKeyView(); renderProg(); renderKey(); buildGrid(); };

    /* ===================== TABS ===================== */
    var ACTIVE_TAB_KEY = prefix + ".activeTab.v1";
    // Tracks the screen actually on-screen (post legacy-name normalization).
    // Set once INIT resolves the first-shown screen (see below); drives the
    // screen/tab back-history wiring in switchTab.
    var currentTab = null;
    // Renders the tab/screen switch WITHOUT touching the back-history stack.
    // Used by: the CLOSE side of a screen back-history entry (returning to the
    // previous screen - calling switchTab there would push a second entry),
    // and any future same-name refresh. `name` must already be normalized
    // (the legacy-name remap lives in switchTab, below).
    function applyTab(name) {
      try { localStorage.setItem(ACTIVE_TAB_KEY, name); } catch (e) {} // reopen where you left off
      document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
      document.querySelectorAll('.screen').forEach(function (p) { p.classList.toggle('on', p.id === 's-' + name); });
      if (name === 'practice') renderPractice();
      if (name === 'library') { renderFilterChips(); renderSongs(); }
      if (name === 'jam') renderSetlist();
      // leaving the Tune tab: let the chord pack stop any tuner audio
      if (name !== 'tune' && pack && typeof pack.onLeaveTuner === 'function') pack.onLeaveTuner();
      // S-CLEARGUARD (A3): the Clear-undo banner is route-local - leaving Compose
      // (for any other tab) dies the pending undo, same as a reload would.
      if (name !== 'compose') invalidateClearUndo();
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.scrollTop = 0;
      if (el.ctxLine && CONTEXTS[name] != null) el.ctxLine.textContent = CONTEXTS[name];
      if (pack && typeof pack.onSwitchTab === 'function') pack.onSwitchTab(name);
      // M-GUIDANCE: fires on EVERY tab render, including the initial tab
      // restore at boot (not just button-click switches) - play/index.html's
      // renderTuneFirstNotable()/renderComposeIntroNotable() listen for this
      // to mount their one-time JIT cues at "the tab's first visit."
      notifyGuidanceEvent('music:tab-shown', { tab: name });
    }
    // USER-facing tab/screen switch (tab-bar taps, opening Practice, etc).
    // Pushes ONE back-history layer per actual screen change so hardware/gesture
    // Back returns to the PREVIOUS screen instead of leaving the app straight
    // away; its close fn calls applyTab (never switchTab, which would push a
    // second entry) to restore the prior screen.
    function switchTab(name) {
      // Legacy tab names resolve to the new surfaces: setlist/set -> the Jam tab
      // (the Set / Perform surface), tracks/repertoire -> the unified Library, so
      // old internal callers + deep links still land in the right place. Runs
      // BEFORE computing `from` / calling applyTab so both compare the
      // normalized name.
      if (name === 'setlist' || name === 'set') name = 'jam';
      else if (name === 'tracks' || name === 'repertoire') name = 'library';
      var from = currentTab;
      applyTab(name);
      if (from && from !== name && window.NavHistory) {
        NavHistory.open('screen:' + name, function () { applyTab(from); currentTab = from; });
      }
      currentTab = name;
    }
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });

    /* ===================== INIT ===================== */
    rebuildAll();
    // S-SET-INTEGRITY (UAT U22, load-heal): right after ALLSONGS exists,
    // silently prune any setlist entry that no longer resolves to a real
    // song - defensive like every other reader in this app (no toast; this
    // is housekeeping, not a user action - see safeSet's header comment on
    // passive vs user-initiated feedback). Must run before the first
    // renderSongs()/renderSetlist() so the very first paint never has to
    // defend against a dangling ref either.
    if (pruneDanglingSetlist(STATE.setlist, function (id) { return !!songById(id); })) saveSet();
    renderFilterChips();
    renderSongs();
    renderSetlist();
    // Library is the default-shown screen; set its context line (the tab-restore
    // below overwrites it when a saved non-library tab is reopened).
    if (el.ctxLine && CONTEXTS['library'] != null) el.ctxLine.textContent = CONTEXTS['library'];
    buildGrid();
    buildKeyPicker();
    renderKeyView();
    renderProgPicks();
    renderProg();
    // S-PROG-WRAP (UAT U8): re-evaluate the strip's full/compact threshold on
    // resize/orientation-change too, not just on add/remove - a phone rotated to
    // landscape (wider strip) or a device with a narrower composeWrap needs the
    // same degrade-or-restore check renderProg already runs on every mutation.
    // window.addEventListener is a browser-only API (undefined under Node's
    // test-stub `window`, matching the window.NavHistory guard pattern below) -
    // guarded so this is a no-op outside a real browser. Max 12 slots means a
    // plain re-render per resize tick is cheap enough to skip debouncing.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', function () { renderProg(); });
    }
    // C1: renderKey() is what actually gates #soloBackingBtn's hidden state +
    // inline display (see renderKey above) - nothing else in INIT calls it, so
    // without this the button's very first paint relies on the CSS cascade bug
    // this fix works around, showing it before any key/chord exists.
    renderKey();

    // Give the chord pack a chance to wire its own UI (e.g. the Tune tab).
    if (pack && typeof pack.init === 'function') {
      pack.init({
        switchTab: switchTab,
        chordRootFreq: chordRootFreq,
        tpose: tpose
      });
    }

    // Reopen where you left off: restore the last active tab (Library is the default-shown,
    // so only switch when the saved tab is something else and its button actually exists).
    try {
      var savedTab = localStorage.getItem(ACTIVE_TAB_KEY), tabExists = false;
      // Normalize a legacy saved tab through the SAME mapping switchTab applies,
      // so an old activeTab.v1 written before the Jam rename ('setlist'/'set' ->
      // Jam, 'tracks'/'repertoire' -> Library) restores to the right modern tab
      // instead of failing the tabExists check and falling back to Library.
      if (savedTab === 'setlist' || savedTab === 'set') savedTab = 'jam';
      else if (savedTab === 'tracks' || savedTab === 'repertoire') savedTab = 'library';
      // Pre-Jam versions kept Set/Perform as a Library SUBVIEW under libType.v1
      // (never written by this version). Consume it ONCE: migrate to Jam and
      // REMOVE the legacy key - otherwise a migrated user who later chooses
      // Library would be forced back to Jam on every reload (the sticky-marker
      // bug), since libType.v1 would keep overriding the real saved tab.
      if (localStorage.getItem(prefix + '.libType.v1') === 'set') {
        try { localStorage.removeItem(prefix + '.libType.v1'); } catch (e) {}
        if (!savedTab || savedTab === 'library') savedTab = 'jam';
      }
      // match by iterating buttons (not a built selector) so a malformed stored value can't
      // throw a selector SyntaxError and abort the restore.
      document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.tab === savedTab) tabExists = true; });
      if (savedTab && savedTab !== 'library' && tabExists) {
        switchTab(savedTab); // from=null (currentTab unset yet) -> no history push, just sets currentTab
      }
    } catch (e) {}
    // No restore above set currentTab (savedTab was library, missing, or its
    // button didn't exist) -> the markup's default-shown screen (Library) is
    // what's on screen. Seed currentTab to match so the FIRST real user
    // navigation correctly pushes a back-history layer.
    if (!currentTab) currentTab = 'library';

    /* ---- M-COMPETENCY LZ: the Skills panel, self-injected into the Settings
     * sheet body (#settingsBody). The Settings sheet markup lives in
     * play/index.html (a coupled parent merge surface this engine does not
     * edit), so - matching the songTray / composeToast self-injection pattern -
     * the panel APPENDS itself into the existing #settingsBody DOM node rather
     * than editing that file. It uses the shared .accSec/.accBtn/.accBody look
     * (Element Consistency Law) and drives its own single-section Accordion so
     * its open/close feel matches the other Settings sections. Guarded: if
     * competency.js is not wired (no window.Competency), nothing injects. */
    function mountSkillsPanel() {
      var C = competencyRef();
      if (!C || !C.FRAMEWORKS) return;                 // not wired yet -> no panel
      var body = document.getElementById('settingsBody');
      if (!body || document.getElementById('accSecSkills')) return; // no host, or already mounted

      var sec = document.createElement('section');
      sec.className = 'accSec'; sec.id = 'accSecSkills'; sec.setAttribute('data-acc', 'skills');
      var btn = document.createElement('button');
      btn.className = 'accBtn'; btn.id = 'accBtnSkills'; btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'accBodySkills');
      btn.textContent = 'Skills';
      var pane = document.createElement('div');
      pane.className = 'accBody skillsPanel'; pane.id = 'accBodySkills';
      pane.setAttribute('role', 'region'); pane.setAttribute('aria-labelledby', 'accBtnSkills');
      pane.hidden = true;
      sec.appendChild(btn); sec.appendChild(pane);
      // S-WELCOME (operator 2026-07-18): About stays the LAST Settings section
      // - rarely-needed content sinks to the bottom. Inject Skills above it,
      // not appended after (append was landing Skills below About).
      var aboutSec = body.querySelector('.accSec[data-acc="about"]');
      if (aboutSec) body.insertBefore(sec, aboutSec); else body.appendChild(sec);

      // Hidden file input for import (shared by the first-start lead + the row).
      // S-SKILLS-PORTABLE (operator UAT 2026-07-16): accepts BOTH the v1 JSON
      // document AND a SKILL.md rendered by skill-md.js - a .md file's
      // embedded ```json block is the same document (lossless round-trip),
      // so competency.js's importProfile stays the ONE validator for both.
      var fileInput = document.createElement('input');
      fileInput.type = 'file'; fileInput.id = 'skillsImportFile';
      fileInput.accept = 'application/json,.json,text/markdown,.md'; fileInput.hidden = true;
      sec.appendChild(fileInput);
      fileInput.onchange = function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var rdr = new FileReader();
        rdr.onload = function () {
          var res, text = String(rdr.result);
          try {
            if (/\.md$/i.test(f.name || '') && global.SkillMd && typeof global.SkillMd.parse === 'function') {
              var md = global.SkillMd.parse(text);
              res = md.ok ? C.importProfile(md.doc) : { ok: false, reason: md.reason };
            } else {
              res = C.importProfile(text);
            }
          } catch (e) { res = { ok: false, reason: 'could not read file' }; }
          if (res && res.ok) { showToast('Imported your ' + skillName(res.skill) + ' profile'); }
          else { showToast((res && res.reason) ? ("Couldn't import - " + res.reason) : "Couldn't import that file", true); }
          fileInput.value = ''; // allow re-picking the same file
          renderSkillsPanel();
        };
        rdr.onerror = function () { showToast("Couldn't read that file", true); fileInput.value = ''; };
        rdr.readAsText(f);
      };

      function skillName(id) {
        for (var i = 0; i < C.FRAMEWORKS.length; i++) if (C.FRAMEWORKS[i].id === id) return C.FRAMEWORKS[i].name;
        return id;
      }
      function fmtDate(iso) {
        if (!iso) return '';
        try { var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
      }
      function downloadBlob(blob, filename, doneMsg) {
        try {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 0);
          if (doneMsg) showToast(doneMsg);
        } catch (e) { showToast("Couldn't export on this device", true); }
      }
      // S-SKILLS-PORTABLE: per-skill export is a SKILL.md (open skills format;
      // the v1 JSON travels INSIDE it as the embedded data block - see
      // skill-md.js), named <skill-id>-SKILL.md as a bare download. The
      // whole-bundle export below zips every skill as <skill-id>/SKILL.md
      // (the folder convention) via the dependency-free zip-store.js.
      function downloadProfile(skillId) {
        var json = C.exportProfile(skillId);
        var md = (json && global.SkillMd && typeof global.SkillMd.render === 'function')
          ? global.SkillMd.render(json) : null;
        if (!md) { showToast("Nothing to export yet", true); return; }
        downloadBlob(new Blob([md], { type: 'text/markdown' }), skillId + '-SKILL.md', 'Exported ' + skillName(skillId));
      }
      function downloadBundle() {
        if (!global.SkillMd || !global.ZipStore) { showToast("Couldn't export on this device", true); return; }
        var files = [];
        C.FRAMEWORKS.forEach(function (fw) {
          var json = C.exportProfile(fw.id);
          var md = json ? global.SkillMd.render(json) : null;
          if (md) files.push({ path: global.SkillMd.bundlePath(fw.id), text: md });
        });
        if (!files.length) { showToast("Nothing to export yet", true); return; }
        try {
          var bytes = global.ZipStore.build(files);
          downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'music-skills.zip',
            'Exported all skills (' + files.length + ')');
        } catch (e) { showToast("Couldn't export on this device", true); }
      }

      // Rebuild the panel body from the current working copy every open, so it
      // reflects evidence recorded since it was last viewed.
      function renderSkillsPanel() {
        pane.textContent = '';
        var hint = document.createElement('p'); hint.className = 'setHint';
        hint.textContent = 'Your skills grow as you use the app. Everything here stays on this device - export a profile to carry it to another, or import one to personalize.';
        pane.appendChild(hint);

        var has = C.hasData();
        // First-start lead: no data yet -> import affordance first (never a modal).
        var importRow = document.createElement('button');
        importRow.className = 'listItem setRow skillsImportRow'; importRow.type = 'button';
        var ib = document.createElement('span'); ib.className = 'li-body';
        var it = document.createElement('span'); it.className = 'li-title'; it.textContent = 'Import a profile';
        var ia = document.createElement('span'); ia.className = 'li-artist';
        ia.textContent = has ? 'Merge a profile file from another device.' : 'Have a profile? Import it to personalize.';
        ib.appendChild(it); ib.appendChild(ia); importRow.appendChild(ib);
        importRow.onclick = function () { fileInput.click(); };
        if (!has) pane.appendChild(importRow); // lead with import when empty

        // One expandable row per skill.
        C.FRAMEWORKS.forEach(function (fw) {
          var prof = C.getProfile(fw.id);
          var row = document.createElement('div'); row.className = 'skillRow';
          var head = document.createElement('button'); head.className = 'skillHead'; head.type = 'button';
          head.setAttribute('aria-expanded', 'false');
          var nm = document.createElement('span'); nm.className = 'skillName'; nm.textContent = fw.name;
          var ev = (prof.competencies || []).reduce(function (n, c) { return n + (c.evidence_count || 0); }, 0);
          var meta = document.createElement('span'); meta.className = 'skillMeta';
          meta.textContent = ev > 0 ? (ev + ' session' + (ev === 1 ? '' : 's')) : 'no evidence yet';
          head.appendChild(nm); head.appendChild(meta);
          var detail = document.createElement('div'); detail.className = 'skillDetail'; detail.hidden = true;
          head.onclick = function () {
            var open = detail.hidden;
            detail.hidden = !open;
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
          };

          (prof.competencies || []).forEach(function (c) {
            var cr = document.createElement('div'); cr.className = 'compRow';
            var cn = document.createElement('span'); cn.className = 'compName'; cn.textContent = c.name;
            var bar = document.createElement('div'); bar.className = 'compBar';
            bar.setAttribute('role', 'img');
            bar.setAttribute('aria-label', c.name + ': level ' + (c.level || 0) + ' of a ' + c.target + ' target');
            var fill = document.createElement('div'); fill.className = 'compBarFill';
            fill.style.width = Math.max(0, Math.min(100, c.level || 0)) + '%';
            bar.appendChild(fill);
            var cm = document.createElement('span'); cm.className = 'compMeta';
            var when = fmtDate(c.last_evidence);
            cm.textContent = (c.level || 0) + ' / ' + c.target + (c.evidence_count ? ' · ' + c.evidence_count + '×' : '') + (when ? ' · ' + when : '');
            cr.appendChild(cn); cr.appendChild(bar); cr.appendChild(cm);
            detail.appendChild(cr);
          });

          // Preferences (operator addendum): quiet read-only lines when present.
          if (Array.isArray(prof.preferences) && prof.preferences.length) {
            prof.preferences.forEach(function (p) {
              var pr = document.createElement('p'); pr.className = 'skillPref';
              var n = p.evidence_count || 0;
              pr.textContent = 'Style: ' + (p.statement || '') + (n ? ' - ' + n + ' session' + (n === 1 ? '' : 's') : '');
              detail.appendChild(pr);
            });
          }

          var actRow = document.createElement('div'); actRow.className = 'skillActs';
          var exp = document.createElement('button'); exp.className = 'btn ghost skillExport'; exp.type = 'button';
          exp.textContent = 'Export ' + fw.name;
          exp.onclick = function () { downloadProfile(fw.id); };
          actRow.appendChild(exp); detail.appendChild(actRow);

          row.appendChild(head); row.appendChild(detail); pane.appendChild(row);
        });

        // S-SKILLS-PORTABLE: whole-bundle export - every skill as
        // <skill-id>/SKILL.md in one zip (only when there is data to carry).
        if (has) {
          var exportAllRow = document.createElement('button');
          exportAllRow.className = 'listItem setRow skillsExportAllRow'; exportAllRow.type = 'button';
          var eb = document.createElement('span'); eb.className = 'li-body';
          var et = document.createElement('span'); et.className = 'li-title'; et.textContent = 'Export all skills';
          var ea = document.createElement('span'); ea.className = 'li-artist';
          ea.textContent = 'One zip - every skill as skill-name/SKILL.md.';
          eb.appendChild(et); eb.appendChild(ea); exportAllRow.appendChild(eb);
          exportAllRow.onclick = downloadBundle;
          pane.appendChild(exportAllRow);
        }
        if (has) pane.appendChild(importRow); // populated view: import lives at the bottom
      }

      // S-SETTINGS-UAT (operator UAT 2026-07-16): JOIN the page's 'settings'
      // accordion group instead of running a parallel single-section
      // accordion - the old shape opened Skills WITHOUT collapsing the other
      // sections (two independent groups can both hold an open section), the
      // exact "opens independently" finding. Accordion.join is order-proof
      // (queues if the page group hasn't init'd yet), onOpen keeps the
      // lazy-render-on-every-open behavior, and the primitive itself now
      // scrolls a tapped-open section into view (the "feels like nothing
      // happens - it opened off-screen" half of the finding).
      var joined = !!(global.Accordion && typeof global.Accordion.join === 'function'
        && global.Accordion.join('settings', { btn: btn, body: pane, onOpen: renderSkillsPanel }));
      // Fallback wiring when Accordion is unavailable (keeps the panel usable).
      if (!joined) {
        btn.onclick = function () {
          var open = pane.hidden; pane.hidden = !open;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) renderSkillsPanel();
        };
      }
    }
    try { mountSkillsPanel(); } catch (e) { /* the Settings Skills panel is non-critical - never block mount */ }

    /* ---- controller ---- */
    return {
      switchTab: switchTab,
      openSong: openPractice,
      getState: function () { return STATE; },
      getSongs: function () { return ALLSONGS.slice(); },
      rebuild: function () { rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist(); },
      // S-CHORD-COLLAPSE (Volley 3 High #1): re-render the Compose grids so a
      // guidance-level change (Settings row or the one-time ask) applies to
      // ALREADY-rendered palettes/filmstrip immediately - not on the next
      // compose mutation. Both callees no-op safely when Compose isn't wired
      // (buildGrid checks el.catChips/el.buildGrid, renderProg checks el.prog).
      refreshCompose: function () { buildGrid(); renderProg(); },
      // M2: opens the Add/Edit form for an existing custom item by id. Exposed on
      // the controller so tracks.js's Studio "Edit this track" link (wired via
      // Tracks.mount's onEditRequest) can reach it without a circular require.
      openEditForm: openEditForm,
      openEditOrAdd: openEditOrAdd,
      setCustomVideo: setCustomVideo,
      // S-SET-INTEGRITY (UAT U22): exposed so callers reachable without a real
      // repertoire-form.js (its own Delete/Revert button is the normal UI
      // entry point, already confirm()-gated upstream of this call) can drive
      // the delete-heal + toast+action undo directly - same pattern as
      // openEditForm/setCustomVideo above.
      deleteCustomItem: deleteCustomItem,
      // S-SONG-MODE: the Compose view state, exposed for tests + future callers
      // (e.g. a deep link straight to the Song canvas). setComposeMode ignores
      // unknown values, so this can never wedge the screen.
      composeMode: function () { return composeMode; },
      setComposeMode: setComposeMode,
      // Phase B: reopen a saved song on the Song canvas by id (the song view's
      // "Continue building" button routes here; exposed for tests + deep links).
      continueBuilding: function (id) { continueBuilding(songById(id)); }
    };
  }

  // S-SONG-MODE: the Song toggle's badge text - the count of buffered sections
  // rides the segment label ('Song · 2') so parked song work stays visible from
  // Chords mode (recognition over recall; numbers beat adverbs). Pure, exported
  // for tests; the '·' matches the section chips' existing label convention.
  function songBadgeText(n) { return n > 0 ? 'Song · ' + n : 'Song'; }

  // S-SONG-MODE Phase B: the INVERSE of buildSongFromSections - parse a saved
  // song's sheet back into builder sections so "Continue building" can reopen
  // it on the Song canvas. One section per sheet row that carries at least one
  // [chord] token (a builder-made song round-trips exactly; a lyric-rich or
  // hand-edited sheet still yields its chords - the lyrics stay safe on the
  // saved record, which update-in-place only overwrites with a NEW sheet on
  // save). Chordless rows are skipped, junk shapes never throw. Pure, exported.
  function sectionsFromSheet(sheet) {
    var out = [];
    (Array.isArray(sheet) ? sheet : []).forEach(function (row) {
      if (!Array.isArray(row) || row.length < 2) return;
      var toks = [];
      String(row[1]).replace(/\[([^\]]+)\]/g, function (m, c) { toks.push(c.trim()); return m; });
      var label = String(row[0] || 'Section');
      // Operator UAT 2026-07-17: legacy plain-progression saves carry the
      // off-vocabulary "Progression" label (buildSheetFromSeq pre-fix). Map it
      // to Verse at parse time so the builder + section dropdown always speak
      // the standard section set; the record self-heals to Verse on next save.
      if (label === 'Progression') label = 'Verse';
      if (toks.length) out.push({ label: label, seq: toks });
    });
    return out;
  }

  /* ---------- public surface ---------- */
  global.Songbook = {
    mount: mount,
    songBadgeText: songBadgeText,
    sectionsFromSheet: sectionsFromSheet,
    // pure helpers exposed for chord packs / tests
    tpose: tpose,
    tposeLine: tposeLine,
    splitChord: splitChord,
    noteToPc: noteToPc,
    chordRootFreq: chordRootFreq,
    renderSheet: renderSheet,
    renderChordOnly: renderChordOnly,
    // S-UI-RECONCILE (Lane A): key-aware song-view/Stage display speller + the
    // action-ladder delete-button class contract - exposed for regression tests.
    chordSpeller: chordSpeller,
    deleteBtnClass: deleteBtnClass,
    fitScale: fitScale,
    soloKeyFor: soloKeyFor,
    isMine: isMine,
    hasChordSheet: hasChordSheet,
    keySeedToken: keySeedToken,
    addAffordance: addAffordance,
    shadowedCatalogIds: shadowedCatalogIds,
    buildAllSongs: buildAllSongs,
    buildSheetFromSeq: buildSheetFromSeq,
    buildSongFromSections: buildSongFromSections, // M-13 SONG BUILDER: section buffer -> {seq, sheet}
    shadowedTrackKeys: shadowedTrackKeys,
    remapSetlist: remapSetlist,
    // S-SET-INTEGRITY (UAT U22): load-heal + defensive-nav pure helpers
    pruneDanglingSetlist: pruneDanglingSetlist,
    skipNoticeText: skipNoticeText,
    studioTarget: studioTarget,
    libraryFilter: libraryFilter,
    libraryEmptyState: libraryEmptyState,
    firstrunShouldRender: firstrunShouldRender,
    savebasicsShouldRender: savebasicsShouldRender,
    ytSearchURL: ytSearchURL,
    nextTranspose: nextTranspose,
    chordsFromDegrees: chordsFromDegrees,
    // M-13 g1: roman -> canonical-sharp token realization (via Circle.romanFor,
    // inverted) + key-aware display naming, exposed for unit tests.
    romanChordSuffix: romanChordSuffix,
    realizeRoman: realizeRoman,
    realizeSection: realizeSection,
    dispChordNameInKey: dispChordNameInKey,
    sectionConnectScore: sectionConnectScore, // UAT: adjacent-section fit ranking
    // M-13 g3: competency-profile-driven suggestion re-rank + why-cue, exposed
    // for unit tests (pure - no DOM, no localStorage).
    suggestionComplexity: suggestionComplexity,
    matchedPreference: matchedPreference,
    personalizeSuggestions: personalizeSuggestions,

    convertProgressionQualities: convertProgressionQualities,
    chordInKey: chordInKey,
    romanInKey: romanInKey,
    mergeSuggestionRow: mergeSuggestionRow,
    PROGRESSIONS: PROGRESSIONS,
    COMPOSE_MAX: COMPOSE_MAX, // D-CAP12: the Compose progression cap (12)
    progStripMode: progStripMode, // S-PROG-WRAP (UAT U8): full/compact strip threshold
    degreeOf: degreeOf,
    completions: completions,
    inferKey: inferKey,
    ROOTS: ROOTS,
    wireTapCancel: wireTapCancel,
    buildClearSnapshot: buildClearSnapshot,
    applyClearSnapshot: applyClearSnapshot,
    // M-GUIDE W3b: Compose key-view solo-scale preview - pure derivation, exposed for tests
    soloChipScale: soloChipScale,
    soloChipCaption: soloChipCaption,
    // S-CHIPS-PLUS: degrees-line derivation, same export pattern as the two above
    soloChipDegrees: soloChipDegrees
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Songbook;

})(typeof window !== 'undefined' ? window : this);
