/* =====================================================================
 * shape-classify.js  -  S-DIAGRAM-PREF step 0 (shape classifier)
 * ---------------------------------------------------------------------
 * Curated, per-profile metadata: a chord voicing (fret array) -> the CAGED-
 * adjacent shape family a seasoned player would name it by, which string
 * carries the root, its inversion, and the barre fret (0 = open/nut).
 * Movable-template aware: a barre voicing at any fret classifies to the
 * SAME family as its open-position ancestor (e.g. guitar F = "barre-E",
 * not a new "F" family) - matching real CAGED/shape-family pedagogy.
 *
 * Scope (P5-mandated prerequisite for S-DIAGRAM-PREF's 'patterns' render,
 * see music/engineering-wiki/ux-philosophy/expertise-adaptive-display.md):
 * guitar-standard and ukulele-gcea only. Every other profile (banjo,
 * mandolin, mandola, cigar box, the unlisted guitar-dropd/guitar-openg)
 * returns null / [] - honest "not classified" beats a wrong label; the
 * render layer simply shows no shape text for those.
 *
 * Dependency-free by design (like esc.js): does NOT require circle.js (the
 * theory engine) to avoid coupling this module to the app's spelling
 * regime. The tiny root-letter -> pitch-class table below is a deliberate,
 * intentionally-duplicated subset of Circle's ROOTS/CHORD_PC data (FORK-4 -
 * canonical sharp spelling; same table shape as play/index.html's own local
 * CHORD_PC) - small, stable, and worth the duplication per esc.js's own
 * precedent rather than pulling in the full theory engine for one lookup.
 * The chord-tone-interval logic (suffixQuality/chordTonePcs) mirrors
 * circle.js's suffixQuality()/chordTones() for the same reason - kept local
 * and tiny rather than imported.
 *
 *   ShapeClassify.classify(profileId, chordName, frets)
 *     -> { family, rootString, inversion, barreFret } | null
 *   ShapeClassify.families(profileId) -> string[]  (empirically derived: every
 *     distinct family classify() actually produces when run against the
 *     profile's OWN named chords table - self-maintaining, can never list a
 *     family classify() couldn't produce for a real chord. Scope note: a
 *     handful of synthetic movable-only templates - e.g. this module's
 *     ukulele "C-shape"/"F-shape" entries - have no anchor in any profile's
 *     named-chord table at all, so they never appear in this list even
 *     though classify() DOES correctly return them for a derived/fallback
 *     voicing of a root the table doesn't list, e.g.
 *     classify('ukulele-gcea','C#',[1,1,1,-1]) -> family 'C-shape'.)
 *   ShapeClassify.label(info) -> ASCII display string, e.g.
 *     "E-shape barre, root on 6, root position"
 *
 * frets: same per-string fret array shape every other shared/*.js module
 * uses (display order low->high per profile.strings; -1 = muted, 0 = open,
 * n = fretted) - see diagram.js's header comment and buildAdapter() in
 * play/index.html (movableVoicing/augmentTriadShapes - the ukulele "C-shape
 * index-bar" / "F-shape barre" movable templates this module's ukulele
 * registry deliberately reuses by name; see the UKULELE table below for why
 * the third injected template, "Em-shape", is NOT re-added here).
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---- tiny root-letter -> pitch-class table (FORK-4 duplicate; see header) ----
  var CHORD_PC = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  };

  function parseChordName(name) {
    var m = /^([A-G][#b]?)(.*)$/.exec(String(name == null ? '' : name).trim());
    if (!m) return null;
    var rootPc = CHORD_PC[m[1]];
    if (rootPc == null) return null;
    return { rootPc: rootPc, suffix: m[2] || '' };
  }

  // Mirrors circle.js's suffixQuality() - see header comment.
  function suffixQuality(suffix) {
    var s = (suffix || '').toLowerCase();
    if (/^(dim|°|o)/.test(s) || /m7?b5|m7-5|ø/.test(s)) return 'dim';
    if (/^(aug|\+)/.test(s)) return 'aug';
    if (/^m(?!aj)/.test(s)) return 'min';
    return 'maj';
  }

  // Mirrors circle.js's chordTones() - see header comment. Returns
  // [rootPc, thirdPc, fifthPc, (seventhPc)] in that fixed order, which
  // inversionFor() below relies on (index 0 = root position, 1 = 1st
  // inversion, ...).
  function chordTonePcs(rootPc, suffix) {
    var q = suffixQuality(suffix);
    var third = (q === 'min' || q === 'dim') ? 3 : 4;
    var fifth = (q === 'dim') ? 6 : (q === 'aug') ? 8 : 7;
    var pcs = [rootPc, (rootPc + third) % 12, (rootPc + fifth) % 12];
    if (/maj7$/i.test(suffix)) pcs.push((rootPc + 11) % 12);
    else if (/7$/.test(suffix)) pcs.push((rootPc + 10) % 12);
    return pcs;
  }

  // ---- pure fret-array math (no theory-engine dependency) --------------------

  // Normalizes a fret array to its own lowest fretted position: subtracts the
  // minimum non-muted value from every fretted string (muted stays -1). This
  // is what makes matching movable-template-aware - a barre voicing and its
  // open-position ancestor normalize to the IDENTICAL pattern, differing only
  // in the subtracted amount (which becomes barreFret below).
  function normalizeFrets(frets) {
    var nonMuted = frets.filter(function (f) { return f >= 0; });
    if (!nonMuted.length) return null;   // fully muted - not a real voicing
    var min = Math.min.apply(null, nonMuted);
    return { min: min, pattern: frets.map(function (f) { return f < 0 ? -1 : f - min; }) };
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Mirrors play/index.html's freqPc formula, WITHOUT the trailing %12 - this
  // module needs the full (octave-aware) semitone number, not just the pitch
  // class, to find the true lowest-SOUNDING string. That matters specifically
  // on ukulele's re-entrant GCEA tuning, where string index 0 (G, ~392Hz) is
  // NOT the lowest-pitched string (the C string, index 1, is) - a plain
  // leftmost-non-muted-string assumption (valid on guitar's linear tuning)
  // would silently misreport the bass note and therefore the inversion.
  function freqToSemitone(f) { return Math.round(69 + 12 * Math.log2(f / 440)); }

  // Finds the actual lowest-sounding (not just leftmost) non-muted string.
  function bassInfo(profileStrings, frets) {
    var lowest = null;
    for (var i = 0; i < frets.length; i++) {
      if (frets[i] < 0) continue;
      var semis = freqToSemitone(profileStrings[i].f) + frets[i];
      if (lowest === null || semis < lowest.semis) lowest = { index: i, semis: semis };
    }
    if (lowest === null) return null;
    return { index: lowest.index, pc: ((lowest.semis % 12) + 12) % 12 };
  }

  var INVERSION_LABELS = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
  // tonePcs is chordTonePcs()'s fixed-order [root, third, fifth, (seventh)] -
  // whichever chord tone the bass note IS names the inversion. A bass pc that
  // matches none of them (shouldn't happen for a real voicing) -> null,
  // honest per the "never guess" contract rather than mislabeling.
  function inversionFor(bassPc, tonePcs) {
    for (var i = 0; i < tonePcs.length; i++) if (tonePcs[i] === bassPc) return INVERSION_LABELS[i] || null;
    return null;
  }

  // ---- curated per-profile shape templates ------------------------------------
  // Every pattern below is PRE-NORMALIZED (see normalizeFrets) - i.e. it is the
  // shape's own fret array with its lowest fretted value already subtracted to
  // 0. Matching an input is: normalize the input, look up its pattern in the
  // quality bucket. barreFret is then simply the input's own subtracted
  // minimum - 0 for an open/home-position shape, >0 for the same shape barred
  // elsewhere. A family already named "*-shape" is a synthetic movable-only
  // template with no open home position in the profile's own chord table (it
  // only ever surfaces via a fallback/derived voicing); every other family is
  // a bare CAGED-adjacent letter and gets a "barre-" prefix added at match
  // time (not stored here) whenever its own barreFret > 0.

  // guitar-standard (EADGBE): every listed chord in the profile already
  // includes at least one open string, so ALL five reference patterns below
  // are the profile's own literal voicings (already at their natural min-0
  // position) - verified against every entry in profiles/guitar-standard.js
  // (see test/shape-classify.test.js). Only E and A ever appear barred
  // elsewhere in this profile (they're the only two CLOSED templates - see
  // buildTemplates()'s open-string exclusion in play/index.html), which is
  // exactly why CAGED calls out "barre-E"/"barre-A" as the two movable
  // shapes and leaves C/G/D open-only.
  var GUITAR = {
    '': [
      { family: 'E', pattern: [0, 2, 2, 1, 0, 0] },
      { family: 'A', pattern: [-1, 0, 2, 2, 2, 0] },
      { family: 'C', pattern: [-1, 3, 2, 0, 1, 0] },
      { family: 'G', pattern: [3, 2, 0, 0, 3, 3] },
      { family: 'D', pattern: [-1, -1, 0, 2, 3, 2] }
    ],
    m: [
      { family: 'E', pattern: [0, 2, 2, 0, 0, 0] },
      { family: 'A', pattern: [-1, 0, 2, 2, 1, 0] },
      { family: 'D', pattern: [-1, -1, 0, 2, 3, 1] }
    ],
    '7': [
      { family: 'E', pattern: [0, 2, 0, 1, 0, 0] },
      { family: 'A', pattern: [-1, 0, 2, 0, 2, 0] },
      { family: 'C', pattern: [-1, 3, 2, 3, 1, 0] },
      { family: 'G', pattern: [3, 2, 0, 0, 0, 1] },
      { family: 'D', pattern: [-1, -1, 0, 2, 1, 2] }
    ],
    maj7: [
      { family: 'E', pattern: [0, 2, 1, 1, 0, 0] },
      { family: 'A', pattern: [-1, 0, 2, 1, 2, 0] },
      { family: 'C', pattern: [-1, 3, 2, 0, 0, 0] },
      { family: 'G', pattern: [3, 2, 0, 0, 0, 2] },
      { family: 'D', pattern: [-1, -1, 0, 2, 2, 2] }
    ],
    m7: [
      { family: 'E', pattern: [0, 2, 0, 0, 0, 0] },
      { family: 'A', pattern: [-1, 0, 2, 0, 1, 0] },
      { family: 'D', pattern: [-1, -1, 0, 2, 1, 1] }
    ]
  };

  // ukulele-gcea (GCEA): unlike guitar, several of the profile's OWN open
  // voicings are themselves closed/movable (e.g. E major [4,4,4,2] has no
  // open string) and turn out, once normalized, to share their pattern with
  // ANOTHER named open chord a few frets lower - e.g. D-major normalizes to
  // the same pattern as E-major minus 2, so E classifies as "barre-D", not
  // its own family (matches the CAGED principle: name the family after the
  // shape's fingering, not the sounding chord). Verified exhaustively
  // against every entry in profiles/ukulele-gcea.js in
  // test/shape-classify.test.js. Two "*-shape" entries are synthetic
  // movable-only templates with no open-position ancestor in the named
  // chord table - copied by name and fret data from the "C-shape
  // index-bar"/"F-shape barre" movable templates augmentTriadShapes()
  // injects in play/index.html, normalized here the same way as every
  // other template. A THIRD injected template ("Em-shape closed barre"
  // [4,4,3,2]) is deliberately NOT re-added here: once normalized it is
  // byte-identical to the 'D' family's own minor pattern below ([2,2,1,0])
  // - i.e. it is the SAME finger shape as the open Dm chord, just re-encoded
  // by play/index.html without a literal open string so the app's naive
  // buildTemplates() open-string check (which only inspects raw fret
  // values, not normalized shape) would treat it as movable. A collision
  // check across every quality bucket in both profiles (run against this
  // exact table) caught the duplicate; classifying a chord built from that
  // template correctly - and more honestly - resolves to "barre-D", not a
  // separate "Em-shape" family. Keeping a dead, unreachable entry here
  // would just be wrong data no classify() call could ever surface.
  var UKULELE = {
    '': [
      { family: 'D', pattern: [2, 2, 2, 0] },        // D open; E = barre-D+2
      { family: 'A', pattern: [2, 1, 0, 0] },        // A open; B = barre-A+2
      { family: 'C', pattern: [0, 0, 0, 3] },        // C open, unique
      { family: 'F', pattern: [2, 0, 1, 0] },        // F open, unique
      { family: 'G', pattern: [0, 2, 3, 2] },        // G open, unique
      { family: 'C-shape', pattern: [0, 0, 0, -1] }, // synthetic index-bar (A muted)
      { family: 'F-shape', pattern: [2, 0, 1, -1] }  // synthetic ring/middle barre (A muted)
    ],
    m: [
      { family: 'A', pattern: [2, 0, 0, 0] },        // Am open; Bm = barre-A+2
      { family: 'C', pattern: [0, 3, 3, 3] },        // Cm open, unique
      // Dm open, unique - ALSO the normalized form of play/index.html's
      // synthetic "Em-shape closed barre" [4,4,3,2] (see header note above);
      // a G#m/etc voicing built from that template classifies as barre-D.
      { family: 'D', pattern: [2, 2, 1, 0] },
      { family: 'E', pattern: [0, 4, 3, 2] },        // Em open, unique
      { family: 'F', pattern: [1, 0, 1, 3] },        // Fm open, unique
      { family: 'G', pattern: [0, 2, 3, 1] }         // Gm open, unique
    ],
    '7': [
      { family: 'C', pattern: [0, 0, 0, 1] },        // C7 open; D7 = barre-C+2
      { family: 'E', pattern: [1, 2, 0, 2] },        // E7 open; F7 = barre-E+1
      { family: 'A', pattern: [0, 1, 0, 0] },        // A7 open; B7 = barre-A+2
      { family: 'G', pattern: [0, 2, 1, 2] }         // G7 open, unique
    ],
    maj7: [
      { family: 'C', pattern: [0, 0, 0, 2] },        // Cmaj7 open; Dmaj7 = barre-C+2
      { family: 'E', pattern: [1, 3, 0, 2] },        // Emaj7 open; Fmaj7 = barre-E+1
      { family: 'A', pattern: [1, 1, 0, 0] },        // Amaj7 open; Bmaj7 = barre-A+2
      { family: 'G', pattern: [0, 2, 2, 2] }         // Gmaj7 open, unique
    ],
    m7: [
      { family: 'A', pattern: [0, 0, 0, 0] },        // Am7 open; Bm7 = barre-A+2, Cm7 = barre-A+3
      { family: 'E', pattern: [0, 2, 0, 2] },        // Em7 open; Fm7 = barre-E+1
      { family: 'D', pattern: [1, 1, 0, 2] },        // Dm7, unique (closed - no true open form)
      { family: 'G', pattern: [0, 2, 1, 1] }         // Gm7 open, unique
    ]
  };

  var TEMPLATES = { 'guitar-standard': GUITAR, 'ukulele-gcea': UKULELE };

  // ---- profile data lookup (browser global OR Node require; no hard coupling) ----
  // Only the two profiles this module classifies ever need to be resolved -
  // every other profileId simply isn't a key in TEMPLATES above, so classify()
  // short-circuits before this is ever called for them.
  var REQUIRE_PATHS = {
    'guitar-standard': './profiles/guitar-standard.js',
    'ukulele-gcea': './profiles/ukulele-gcea.js'
  };
  function getProfileData(profileId) {
    if (typeof window !== 'undefined' && window.MusicProfiles && window.MusicProfiles[profileId]) {
      return window.MusicProfiles[profileId];
    }
    if (typeof require === 'function' && REQUIRE_PATHS[profileId]) {
      try {
        var mod = require(REQUIRE_PATHS[profileId]);
        if (mod && mod.MusicProfiles && mod.MusicProfiles[profileId]) return mod.MusicProfiles[profileId];
      } catch (e) { /* fall through to null below */ }
    }
    return null;
  }

  // ---- public API --------------------------------------------------------------

  function classify(profileId, chordName, frets) {
    var reg = TEMPLATES[profileId];
    if (!reg || !Array.isArray(frets) || !frets.length) return null;
    var parsed = parseChordName(chordName);
    if (!parsed) return null;
    var bucket = reg[parsed.suffix];
    if (!bucket) return null;                        // no template for this quality (e.g. dim/aug/sus) - honest null

    var profile = getProfileData(profileId);
    if (!profile || !profile.strings || profile.strings.length !== frets.length) return null;

    var norm = normalizeFrets(frets);
    if (!norm) return null;

    var family = null;
    for (var i = 0; i < bucket.length; i++) {
      if (arraysEqual(bucket[i].pattern, norm.pattern)) { family = bucket[i].family; break; }
    }
    if (!family) return null;                         // shape doesn't match any curated template - never guess
    if (norm.min > 0 && !/-shape$/.test(family)) family = 'barre-' + family;

    var bass = bassInfo(profile.strings, frets);
    if (!bass) return null;
    var tones = chordTonePcs(parsed.rootPc, parsed.suffix);
    var inversion = inversionFor(bass.pc, tones);
    if (!inversion) return null;                      // bass isn't a recognized chord tone - shouldn't happen; honest null if it does

    return {
      family: family,
      rootString: frets.length - bass.index,
      inversion: inversion,
      barreFret: norm.min
    };
  }

  // Empirically derived: every distinct family classify() actually produces
  // across the profile's OWN named chords, in first-seen (source-file) order.
  // Self-maintaining - can never list a family classify() couldn't produce,
  // and stays correct if the profile's chord table changes later.
  function families(profileId) {
    if (!TEMPLATES[profileId]) return [];
    var profile = getProfileData(profileId);
    if (!profile || !profile.chords) return [];
    var seen = {}, order = [];
    Object.keys(profile.chords).forEach(function (name) {
      var info = classify(profileId, name, profile.chords[name]);
      if (info && !seen[info.family]) { seen[info.family] = true; order.push(info.family); }
    });
    return order;
  }

  // ASCII-only display label, e.g. "E-shape barre, root on 6, root position"
  // or "open C shape, root on 5, 1st inversion".
  function label(info) {
    if (!info) return '';
    var famPart;
    if (/-shape$/.test(info.family)) {
      famPart = info.family + (info.barreFret > 0 ? ' barre' : '');
    } else if (/^barre-/.test(info.family)) {
      famPart = info.family.slice('barre-'.length) + '-shape barre';
    } else {
      famPart = 'open ' + info.family + ' shape';
    }
    return famPart + ', root on ' + info.rootString + ', ' + info.inversion;
  }

  var ShapeClassify = { classify: classify, families: families, label: label };
  global.ShapeClassify = ShapeClassify;
  if (typeof module !== 'undefined' && module.exports) module.exports = ShapeClassify;

})(typeof window !== 'undefined' ? window : this);
