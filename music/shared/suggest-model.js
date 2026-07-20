/* =====================================================================
 * suggest-model.js  -  chord-suggestion + progression + key-inference model
 * ---------------------------------------------------------------------
 * The pure ranking / analysis layer behind Compose's suggested chords:
 * adjacent-section cadence fit, competency-driven personalization, the
 * famous-progression table + completion matching, progression re-quality
 * across modes, the strip full/compact threshold, scale-degree analysis,
 * and whole-song key inference. All pure + deterministic (no DOM, no
 * localStorage). Builds on theory.js for the note/key primitives.
 *
 * No build step. Classic script. Exposes a single global: `SongbookSuggest`.
 * Loads AFTER theory.js and BEFORE songbook.js, which rebinds these names.
 * ===================================================================== */
(function (global) {
  'use strict';

  // theory primitives (theory.js, loaded first) - rebind the ones this model uses
  var T = global.SongbookTheory || (typeof require === 'function' ? require('./theory.js') : null);
  var ROOTS = T.ROOTS;
  var MODES = T.MODES;
  var MODE_CANON = T.MODE_CANON;
  var splitChord = T.splitChord;
  var noteToPc = T.noteToPc;
  var rootPc = T.rootPc;
  var canonMode = T.canonMode;
  var chordsFromDegrees = T.chordsFromDegrees;

  // ADJACENT-SECTION FIT: score how strongly a suggestion (its
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
  // ---- PERSONALIZED RANKING: nudge template suggestions by the
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
  // suggestion untagged with zero boost - the ranking degrades exactly
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
  // MODAL INTERCHANGE core - shared so BOTH the explicit-key path (mount()'s
  // convertToMode) and the keyless mode-change
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
  // BLUES PALETTE (offsets 0/5/7 from tonicRoot - NOT "any target-mode
  // degree") - anything else (a user-added secondary like A7 over a
  // C blues) is left unchanged, and a bare dominant
  // 7th surviving from a palette root is treated as a plain triad before target
  // re-qualification (C7 -> C in Major, -> Cm in Minor); a surviving m7/maj7
  // keeps its own extension-class survival (not stripped).
  function convertProgressionQualities(chords, targetMode, tonicRoot, sourceMode) {
    // Canonicalize targetMode the SAME way sourceMode already is below (canonMode) -
    // callers outside the in-app UI (saved/custom items, the bridge payload) carry
    // the lowercase MODE_CANON vocabulary ('blues', 'major', ...); a bare MODES[targetMode]
    // lookup silently no-ops on those.
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
      // BLUES-SOURCE GUARD: a chord surviving FROM Blues only re-qualifies when its
      // root sits on
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
  // The Compose progression cap (see decisions.md: D-CAP12), raised from 8 to fit
  // the 12-bar starters above. ONE shared const replaces both the
  // addChord and renderProg `>= 8` gates so it can never drift between the two.
  var COMPOSE_MAX = 12;
  // A COUNT-driven staged density ladder (see decisions.md: D-PROG-WRAP), so a
  // short progression keeps generous full diagram cards instead of shrinking to
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
    // At the ADVANCED guidance level the filmstrip never
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
      // into a plain Major/Minor/Mixolydian/Dorian session.
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
  global.SongbookSuggest = {
    sectionConnectScore: sectionConnectScore,
    suggestionComplexity: suggestionComplexity,
    prefWords: prefWords,
    matchedPreference: matchedPreference,
    personalizeSuggestions: personalizeSuggestions,
    convertProgressionQualities: convertProgressionQualities,
    progStripMode: progStripMode,
    degreeOf: degreeOf,
    completions: completions,
    baseTriad: baseTriad,
    inferKey: inferKey,
    SECTION_CONNECT: SECTION_CONNECT,
    COMPLEXITY_SIMPLE_MAX: COMPLEXITY_SIMPLE_MAX,
    COMPLEXITY_VARIED_MIN: COMPLEXITY_VARIED_MIN,
    PREF_STOPWORDS: PREF_STOPWORDS,
    PROGRESSIONS: PROGRESSIONS,
    COMPOSE_MAX: COMPOSE_MAX,
    TOKEN_MIN_W: TOKEN_MIN_W,
    MAJOR_STEPS: MAJOR_STEPS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SongbookSuggest;

})(typeof window !== 'undefined' ? window : this);
