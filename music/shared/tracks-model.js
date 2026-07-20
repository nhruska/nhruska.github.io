/* =====================================================================
 * tracks-model.js  -  backing-track finder data layer (pure + testable)
 * ---------------------------------------------------------------------
 * The Backing Tracks finder's non-UI helpers: root/mode normalization,
 * relative/parallel key compatibility, genre x key filtering, the YouTube
 * search/embed/id helpers, the seed+custom track merge and stable track
 * key, the URL-overlay migration, pitch-class helpers, and the
 * circle-of-fifths wheel tint. Depends only on esc.js for escaping.
 *
 * No build step. Classic script. Exposes a single global: `TracksModel`.
 * Loads BEFORE tracks.js, which rebinds these names as locals.
 * ===================================================================== */
(function (global) {
  'use strict';
  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT2SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

  /* --- pure (testable) music-theory + filter --- */
  function normRoot(r) {
    r = String(r || '').trim();
    if (!r) return '';
    var u = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    return FLAT2SHARP[u] || u;
  }
  function rootAt(i) { return ROOTS[((i % 12) + 12) % 12]; }
  function rootIndex(r) { return ROOTS.indexOf(normRoot(r)); }
  function compatibleKeys(root, mode) {
    var i = rootIndex(root);
    if (i < 0) return [];
    mode = mode === 'minor' ? 'minor' : 'major';
    if (mode === 'major') {
      return [
        { key: rootAt(i), mode: 'major', why: 'your key', rank: 0 },
        { key: rootAt(i - 3), mode: 'minor', why: 'relative minor', rank: 1 },
        { key: rootAt(i), mode: 'minor', why: 'parallel minor', rank: 2 }
      ];
    }
    return [
      { key: rootAt(i), mode: 'minor', why: 'your key', rank: 0 },
      { key: rootAt(i + 3), mode: 'major', why: 'relative major', rank: 1 },
      { key: rootAt(i), mode: 'major', why: 'parallel major', rank: 2 }
    ];
  }
  function trackMatch(t, compat) {
    // Coarsen the track's mode to its major/minor FAMILY before comparing:
    // compat rows only speak major/minor, so a raw 'dorian'/'mixolydian'
    // t.mode would never match and the track vanishes from keyed results.
    var tk = normRoot(t.key), tm = normMode(t.mode);
    for (var j = 0; j < compat.length; j++) {
      if (compat[j].key === tk && compat[j].mode === tm) return compat[j];
    }
    return null;
  }
  function filterTracks(tracks, genre, root, mode) {
    var byGenre = tracks.filter(function (t) {
      return !genre || genre === 'all' || t.genre === genre;
    });
    if (!root) return byGenre.map(function (t) { return { track: t, why: null, rank: 0 }; });
    var compat = compatibleKeys(root, mode);
    var out = [];
    byGenre.forEach(function (t) {
      var m = trackMatch(t, compat);
      if (m) out.push({ track: t, why: m.why, rank: m.rank });
    });
    out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  }
  function uniqueGenres(tracks) {
    var set = {};
    tracks.forEach(function (t) { if (t.genre) set[t.genre] = true; });
    return Object.keys(set).sort();
  }

  /* --- smart-search fallback (deterministic; no API key, offline-safe) --- */
  function searchQuery(t) {
    var p = [];
    if (t.artist) p.push(t.artist);
    if (t.title) p.push(t.title);
    p.push('backing track');
    return p.join(' ');
  }
  // S5 (operator UAT): a custom "My progression" song has no real artist/title to
  // search by - searchQuery's bare "<name> My progression backing track" returns
  // generic, unrelated results. Fold in the genre + the actual chord progression
  // (when the song carries one) so the search finds a stylistically/harmonically
  // relevant backing track instead. Curated (non-custom) tracks keep plain
  // searchQuery - they already have a real artist/title.
  function customSearchQuery(t) {
    var p = [];
    if (t.artist) p.push(t.artist);
    if (t.title) p.push(t.title);
    if (t.genre) p.push(t.genre);
    if (Array.isArray(t.seq)) {
      var toks = t.seq.map(function (c) { return String(c == null ? '' : c).trim(); })
        .filter(Boolean);
      if (toks.length) p.push(toks.join(' '));
    }
    p.push('backing track');
    return p.join(' ');
  }
  // Tint the Studio's circle-of-fifths wheel: relative key (strong) + V/IV
  // (dimmer). Post-processes circle.js's renderWheel DOM by matching label
  // text - exported for tests so a circle.js DOM-contract change fails loudly
  // instead of silently dropping the tint (codex #89 V1).
  function tintWheel(wheelEl, C, key, mode) {
    var nb = C.neighbors(key, mode);
    if (!nb || nb.length < 3) return;
    function mark(entry, cls) {
    if (!entry || !entry.root) return;
    // S-COF-SPELLING: the label text comes from the SAME provider renderWheel
    // uses (Circle.wheelLabel - preferred key name, Bb never A#), so the match
    // can't drift when spelling policy changes. spellRoot fallback keeps the
    // old contract for a stale cached circle.js.
    var label = (typeof C.wheelLabel === 'function')
      ? C.wheelLabel(entry.root, entry.mode)
      : C.spellRoot(entry.root) + (entry.mode === 'minor' ? 'm' : '');
    var texts = wheelEl.querySelectorAll('.cofLabel');
    for (var i = 0; i < texts.length; i++) {
      if (texts[i].textContent !== label) continue;
      var wedge = texts[i].previousElementSibling;
      if (wedge && wedge.classList.contains('cofWedge')) wedge.classList.add('cofWedge-' + cls);
      texts[i].classList.add('cofLabel-' + cls);
      break;
    }
    }
    mark(nb[2], 'rel');  // relative minor (or relative major, if the track itself is minor)
    mark(nb[0], 'nb');   // a fifth up (V) - dimmer
    mark(nb[1], 'nb');   // a fifth down (IV) - dimmer
  }
  function filterQuery(genre, root, mode) {
    var g = (genre && genre !== 'all') ? genre + ' ' : '';
    var k = root ? (' in ' + root + (mode === 'minor' ? ' minor' : ' major')) : '';
    return g + 'backing track' + k;
  }
  function youtubeSearchUrl(q) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }
  function embedUrl(id) {
    return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
  }
  function parseYouTubeId(url) {
    url = String(url || '').trim();
    var m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null;
  }
  function mergeTracks(seed, custom) {
    return (Array.isArray(seed) ? seed : []).concat(Array.isArray(custom) ? custom : []);
  }
  // Stable identity for a curated track. tracks.json carries no id field, so the
  // localStorage URL overlay (music.trackUrls.v1) is keyed by a deterministic
  // signature of the immutable descriptive fields. Lowercased + trimmed so a
  // cosmetic whitespace/case diff doesn't orphan an attached url.
  function trackKey(t) {
    t = t || {};
    function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
    // Serialize the FULL 5-mode vocabulary (M-GUIDE W2 adds 'blues'): coarsening
    // dorian/mixolydian/blues to 'major' let a modal/blues track collide with a
    // same-title/artist/key major row in the url overlay. Unknown/absent modes
    // still default to 'major'. IDENTITY only - the Library/finder FACET still
    // coarsens 'blues' to the major family via normMode (unchanged, per the IA);
    // this is a narrower, separate concern (a stable storage key, not a UI facet).
    var m = norm(t.mode);
    if (m !== 'minor' && m !== 'dorian' && m !== 'mixolydian' && m !== 'blues') m = 'major';
    return [norm(t.title), norm(t.artist), normRoot(t.key), m].join('|');
  }
  // Overlay a { trackKey: videoId } map onto a seed list, returning NEW track
  // objects so the original seed is never mutated. A track that already has a
  // curated yt id keeps it unless the overlay explicitly replaces it.
  function applyUrlOverlay(seed, overlay) {
    overlay = overlay || {};
    return (Array.isArray(seed) ? seed : []).map(function (t) {
      var k = trackKey(t), ov = overlay[k];
      if (ov == null || ov === '') return t;
      var copy = {}; for (var p in t) if (Object.prototype.hasOwnProperty.call(t, p)) copy[p] = t[p];
      copy.yt = ov; copy.ytSource = 'overlay';
      return copy;
    });
  }
  // note name -> chromatic pitch class (0-11), parsed generically from the letter
  // + any accidentals. Unlike rootIndex (12 sharps + 5 common flats only), this
  // handles every enharmonic spelling — E#, B#, Cb, Fb and double accidentals.
  // circle.js no longer emits those (canonical sharp table, FORK-4), but freeform
  // user input and legacy saved data still can, so the generic parser stays.
  // -1 if unparseable.
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToPc(name) {
    var m = /^([A-Ga-g])([#b]*)$/.exec(String(name == null ? '' : name).trim());
    if (!m) return -1;
    var pc = LETTER_PC[m[1].toUpperCase()];
    for (var i = 0; i < m[2].length; i++) pc += (m[2].charAt(i) === '#' ? 1 : -1);
    return ((pc % 12) + 12) % 12;
  }
  function notesToPcs(notes) {
    return (notes || []).map(noteToPc).filter(function (p) { return p >= 0; });
  }
  // S-HARDEN (analysis-refactor-enhance-20260704 A5): delegates to the shared
  // esc.js (loaded before this file everywhere it's consumed) - was one of
  // ~8 divergent local copies.
  function esc(s) { return global.Esc.esc(s); }
  function focusNoJump(el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  function familyMode(m) { return m === 'minor' ? 'aeolian' : 'ionian'; }
  // P3: coarsen any mode name (Major/Minor or a church mode) to the major/minor
  // family the backing-track finder filters on. Minor-family: aeolian/dorian/
  // phrygian/locrian (+ "minor"); everything else (ionian/lydian/mixolydian) -> major.
  function normMode(mode) {
    return /min|aeolian|dorian|phrygian|locrian/.test(String(mode == null ? '' : mode).toLowerCase()) ? 'minor' : 'major';
  }
  global.TracksModel = {
    ROOTS: ROOTS,
    normRoot: normRoot,
    rootAt: rootAt,
    rootIndex: rootIndex,
    compatibleKeys: compatibleKeys,
    trackMatch: trackMatch,
    filterTracks: filterTracks,
    uniqueGenres: uniqueGenres,
    searchQuery: searchQuery,
    customSearchQuery: customSearchQuery,
    tintWheel: tintWheel,
    filterQuery: filterQuery,
    youtubeSearchUrl: youtubeSearchUrl,
    embedUrl: embedUrl,
    parseYouTubeId: parseYouTubeId,
    mergeTracks: mergeTracks,
    trackKey: trackKey,
    applyUrlOverlay: applyUrlOverlay,
    LETTER_PC: LETTER_PC,
    noteToPc: noteToPc,
    notesToPcs: notesToPcs,
    esc: esc,
    focusNoJump: focusNoJump,
    familyMode: familyMode,
    normMode: normMode
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.TracksModel;

})(typeof window !== 'undefined' ? window : this);
