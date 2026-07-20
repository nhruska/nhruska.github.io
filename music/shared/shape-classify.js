/* =====================================================================
 * shape-classify.js  -  chord-shape classifier
 * ---------------------------------------------------------------------
 * Maps a chord voicing (fret array) to the CAGED-adjacent shape family a
 * seasoned player would name it by, plus which string carries the root, its
 * inversion, and the barre fret (0 = open/nut).
 *
 * Pattern: movable-template aware. A barre voicing at any fret classifies to
 * the SAME family as its open-position ancestor (e.g. guitar F = "barre-E",
 * not a new "F" family) - matching real CAGED/shape-family pedagogy. Every
 * curated template is pre-normalized to min-0; matching normalizes the input
 * and looks up its pattern in the chord-quality bucket.
 *
 * Scope: guitar-standard and ukulele-gcea only. Every other profile (banjo,
 * mandolin, mandola, cigar box, guitar-dropd/guitar-openg) returns null / [] -
 * honest "not classified" beats a wrong label; the render layer shows no shape
 * text for those.
 *
 * Dependency-free by design: does NOT require circle.js (the theory engine),
 * to avoid coupling this module to the app's spelling regime. The tiny
 * root-letter -> pitch-class table below is an intentionally-duplicated subset
 * of the theory engine's chord-pc data (canonical sharp spelling) - small and
 * stable enough that duplication beats pulling in the whole engine for one
 * lookup. suffixQuality()/chordTonePcs() likewise mirror the engine's
 * suffix/chord-tone logic, kept local and tiny rather than imported.
 *
 * Public API + seam invariants:
 *   ShapeClassify.classify(profileId, chordName, frets)
 *     -> { family, rootString, inversion, barreFret } | null
 *   ShapeClassify.families(profileId) -> string[]  - empirically derived:
 *     every distinct family classify() actually produces when run against the
 *     profile's OWN named-chord table. Self-maintaining, so it can never list
 *     a family classify() couldn't produce, and it stays correct if the chord
 *     table changes. Note: synthetic movable-only templates (e.g. the ukulele
 *     "C-shape"/"F-shape" entries) have no anchor in any named-chord table, so
 *     they never appear here even though classify() DOES correctly return them
 *     for a derived/fallback voicing, e.g.
 *     classify('ukulele-gcea','C#',[1,1,1,-1]) -> family 'C-shape'.
 *   ShapeClassify.label(info) -> ASCII display string, e.g.
 *     "E-shape barre, root on 6, root position"
 *
 * frets: the per-string fret array shape every other shared/*.js module uses
 * (display order low->high per profile.strings; -1 = muted, 0 = open, n =
 * fretted) - see diagram.js's header. The ukulele registry deliberately reuses
 * the "C-shape index-bar" / "F-shape barre" movable templates by name; see the
 * UKULELE table for why the third such template, "Em-shape", is NOT re-added.
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---- tiny root-letter -> pitch-class table (duplicated subset; see header) ----
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

  // Mirrors the theory engine's suffixQuality() - see header.
  function suffixQuality(suffix) {
    var s = (suffix || '').toLowerCase();
    if (/^(dim|°|o)/.test(s) || /m7?b5|m7-5|ø/.test(s)) return 'dim';
    if (/^(aug|\+)/.test(s)) return 'aug';
    if (/^m(?!aj)/.test(s)) return 'min';
    return 'maj';
  }

  // Mirrors the theory engine's chordTones() - see header. Returns
  // [rootPc, thirdPc, fifthPc, (seventhPc)] in that fixed order, which
  // inversionFor() below relies on (index 0 = root position, 1 = 1st
  // inversion, ...).
  //
  // A 'dim' quality always gets a 4th tone at root+9 (the diminished 7th),
  // even when the suffix string is a plain "dim" not "dim7": the curated
  // dim/dim7 voicings are all 4-note fully-diminished-seventh shapes, so the
  // physical chord always has 4 notes. Without the added tone, a bass note
  // landing on the (otherwise untracked) diminished 7th relative to the
  // asked-about root would null - which for a fully-symmetric chord happens
  // to exactly half of the enharmonic root names sharing one physical fret
  // group. Adding the diminished-7th tone classifies every enharmonic name of
  // a curated dim/dim7 voicing, not only the subset whose root/b3/b5 includes
  // the physical bass note.
  function chordTonePcs(rootPc, suffix) {
    var q = suffixQuality(suffix);
    var third = (q === 'min' || q === 'dim') ? 3 : 4;
    var fifth = (q === 'dim') ? 6 : (q === 'aug') ? 8 : 7;
    var pcs = [rootPc, (rootPc + third) % 12, (rootPc + fifth) % 12];
    if (q === 'dim') pcs.push((rootPc + 9) % 12);
    else if (/maj7$/i.test(suffix)) pcs.push((rootPc + 11) % 12);
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

  // Frequency -> absolute (octave-aware) semitone number. The full number,
  // not just the pitch class, is needed to find the true lowest-SOUNDING
  // string. Don't drop the octave with a %12: on ukulele's re-entrant GCEA
  // tuning, string index 0 (G, ~392Hz) is NOT the lowest-pitched string (the
  // C string, index 1, is), so a leftmost-non-muted-string assumption (valid
  // only on guitar's linear tuning) would misreport the bass note and the
  // inversion.
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
  // matches none of them (shouldn't happen for a real voicing) -> null rather
  // than a mislabel.
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

  // guitar-standard (EADGBE): every listed chord in the profile includes at
  // least one open string, so all five reference patterns below are the
  // profile's own literal voicings (already at their natural min-0 position).
  // Only E and A ever appear barred elsewhere in this profile (they're the
  // only two closed templates), which is why CAGED calls out "barre-E"/
  // "barre-A" as the two movable shapes and leaves C/G/D open-only.
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
    ],
    // dim: every "Xdim" entry in the profile is actually a 4-note fully-
    // diminished-seventh voicing (functionally substituting for the dim
    // triad). All three fret groups normalize to the identical pattern
    // [-1,1,2,0,2,0], differing only in barreFret - one movable shape with no
    // open home position in the table, so it's a synthetic "*-shape" family
    // (like the ukulele C-shape/F-shape templates below), not a bare letter.
    //
    // Symmetric-chord inversion convention: a fully-diminished-seventh chord
    // has no single objective root - all four notes are equivalent tonic
    // candidates, which is why the profile repeats one fret array under six
    // chord names per group. The classifier doesn't decide which note is "the"
    // root; it defers to the chord NAME the caller passed and reports the
    // inversion relative to that name's root. Two different names sharing one
    // physical voicing therefore (correctly) report two different inversions.
    dim: [
      { family: 'dim7-shape', pattern: [-1, 1, 2, 0, 2, 0] }
    ],
    // dim7 (defensive): no profile chord is named "Xdim7" today (the "dim"
    // entries above already ARE dim7 voicings), so this bucket has no live
    // anchor. Curated on the same physical shape in case a caller (e.g.
    // Compose free-text entry) ever spells the suffix "dim7" explicitly.
    dim7: [
      { family: 'dim7-shape', pattern: [-1, 1, 2, 0, 2, 0] }
    ],
    // aug (defensive): no supported mode emits an augmented triad, so no live
    // chords-in-key anchor; curated for Compose free-text entry / future
    // modes. Standard open Caug: the profile's own open C-major shape with the
    // 3rd-string (G) note raised one fret, sharping the 5th (G->G#) - the
    // classic "C-shape, sharp-5" fingering. Genuinely open (barreFret 0), so
    // it keeps the bare 'C' family letter and reads as "open C shape".
    aug: [
      { family: 'C', pattern: [-1, 3, 2, 1, 1, 0] }
    ]
  };

  // ukulele-gcea (GCEA): unlike guitar, several of the profile's own open
  // voicings are themselves closed/movable (e.g. E major [4,4,4,2] has no open
  // string) and, once normalized, share their pattern with another named open
  // chord a few frets lower - e.g. E-major normalizes to D-major plus 2, so E
  // classifies as "barre-D", not its own family (CAGED principle: name the
  // family after the fingering, not the sounding chord). Two "*-shape" entries
  // are synthetic movable-only templates with no open-position ancestor in the
  // named-chord table.
  //
  // Don't re-add a third movable template, "Em-shape closed barre" [4,4,3,2]:
  // once normalized it is identical to the 'D' family's minor pattern below
  // ([2,2,1,0]) - the SAME finger shape as the open Dm chord, just re-encoded
  // elsewhere without a literal open string. A chord built from that template
  // correctly resolves to "barre-D"; a separate "Em-shape" entry here would be
  // dead, unreachable data that collides with 'D' and no classify() call could
  // ever surface.
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
      // Dm open, unique - also the normalized form of the synthetic
      // "Em-shape closed barre" [4,4,3,2] (see header note); a chord built
      // from that template classifies as barre-D.
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
    ],
    // dim: same rationale as GUITAR's dim bucket above - the profile's three
    // fret groups all normalize to [0,1,0,1], one movable dim7 shape with no
    // fret-0 home position, named "dim7-shape". Same symmetric-chord inversion
    // convention (see GUITAR's dim comment): inversion is reported relative to
    // the chord NAME's root, not an objectively-chosen root.
    dim: [
      { family: 'dim7-shape', pattern: [0, 1, 0, 1] }
    ],
    // dim7 (defensive) - see GUITAR's dim7 comment; no profile chord is named
    // "Xdim7" today, curated for a future/Compose caller using that suffix.
    dim7: [
      { family: 'dim7-shape', pattern: [0, 1, 0, 1] }
    ],
    // aug (defensive) - see GUITAR's aug comment; no live chords-in-key
    // anchor. Standard open Caug: the profile's own open C-major shape with
    // the G string raised one fret, sharping the 5th (G->G#) - same "C-shape,
    // sharp-5" fingering as guitar's. Genuinely open (barreFret 0), so it
    // keeps the bare 'C' family letter, not a synthetic "*-shape".
    aug: [
      { family: 'C', pattern: [1, 0, 0, 3] }
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
