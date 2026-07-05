/* =====================================================================
 * tracks.js  -  backing-track finder + theory, as a mountable surface
 * ---------------------------------------------------------------------
 * The Backing Tracks finder, refactored out of the standalone page so it
 * can mount as a TAB inside the play app (sharing circle.js + the instrument
 * pack). Genre x key -> curated tracks.json (+ a localStorage overlay of
 * saved tracks), relative/parallel-key expansion, a circle-of-fifths key
 * panel, in-app YouTube playback (real id) or a deterministic search (yt:null).
 *
 * Pure functions are exported for Node tests; Tracks.mount(opts) builds the UI.
 *   Tracks.mount({ container, tracksUrl })   // tracksUrl defaults to tracks.json
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
    var label = C.spellRoot(entry.root) + (entry.mode === 'minor' ? 'm' : '');
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
  // Resolve any incoming mode string to the ACTUAL scale mode the Practice Studio
  // renders. The Studio teaches 4 modes faithfully: major/minor plus the two most
  // common modal colours (dorian, mixolydian). Accepts lowercase circle-family
  // names, legacy capitalized inputs (Major/Minor/Dorian/Mixolydian), and bare
  // family words - anything it does not recognize coarsens to the major/minor
  // family via normMode (never throws, never silently lands on ionian for a
  // minor-family input like phrygian). Unlike familyMode this preserves the modal
  // colour so an A Dorian track lights a Dorian scale, not a plain minor one.
  function resolveScaleMode(mode) {
    var m = String(mode == null ? '' : mode).trim().toLowerCase();
    if (m === 'ionian' || m === 'major') return 'ionian';
    if (m === 'aeolian' || m === 'minor') return 'aeolian';
    if (m === 'dorian') return 'dorian';
    if (m === 'mixolydian') return 'mixolydian';
    // M-GUIDE W2: Blues is a harmonizing key model (I7/IV7/V7, songbook.js MODES.Blues),
    // not a circle-of-fifths mode - resolve it explicitly before the major/minor
    // family fallback so a Blues-keyed Compose progression opens the Studio on its
    // own blues scale + BLUES_KEY palette (studioTheory below), not a coarsened major.
    if (m === 'blues') return 'blues';
    return familyMode(normMode(mode));
  }
  function shortMode(label) { return label.replace(/\s*\(.*\)/, ''); }
  // Mode-honest short key label: 'A' (major), 'Am' (minor), 'A dorian' /
  // 'G mixolydian' (modal). Used by the curation-queue rows; the Studio meta
  // derives its own from studioTheory. Library/finder facet labels still
  // coarsen modal modes - unifying them is queued in the UI-polish arc.
  function keyLabelFor(key, mode) {
    var m = String(mode == null ? '' : mode).trim().toLowerCase();
    if (m === 'minor' || m === 'aeolian') return key + 'm';
    if (m === 'dorian' || m === 'mixolydian') return key + ' ' + m;
    if (m === 'blues') return key + ' blues'; // M-GUIDE W2
    return key;
  }
  // Circle source: window.Circle in the browser (classic scripts). Under Node
  // the IIFE's `global` is this module's own exports object, so a test can
  // never inject Circle there - fall back to a guarded require so the REAL
  // studioTheory is drivable from test/tracks.test.js. No-op in the browser.
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }
  // Same guarded-reference pattern as circleRef() above, for the S-NOTABLES
  // singleton: window.Notables in the browser, a require() fallback in Node so
  // test/tracks.test.js drives the SAME module instance test/notables.test.js
  // exercises directly (shared require-cache entry, not a duplicate).
  function notablesRef() {
    if (global.Notables) return global.Notables;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./notables.js'); } catch (e) {}
    }
    return null;
  }
  // The Practice Studio's theory bundle for a key+mode: scale notes, pitch
  // classes, degrees, diatonic chords, display label. Module-scope + exported
  // so tests can drive the SAME function the Studio wiring calls (a direct
  // resolveScaleMode test alone would let the openStudio path regress green).
  // Returns null when Circle is absent or the key is unresolvable (callers
  // fall back to the bare player / a YouTube search).
  function studioTheory(key, mode) {
    var C = circleRef(), k = normRoot(key), rp = rootIndex(k);
    if (!C || rp < 0) return null;
    var scaleMode = resolveScaleMode(mode);
    // M-GUIDE W2: Blues has no Circle.MODE_INFO/diatonic() entry (it is the solo
    // 'blues' scale plus the separate BLUES_KEY I7/IV7/V7 palette, not a circle-
    // of-fifths mode) - branch before the generic diatonic path below.
    if (scaleMode === 'blues') {
      var bnotes = C.soloScale(k, 'blues');
      return {
        key: k, scaleMode: scaleMode, rootPc: rp, notes: bnotes, pcs: notesToPcs(bnotes),
        degrees: C.soloScaleDegrees('blues'), chords: C.bluesKey(k), label: 'Blues'
      };
    }
    // #85: key-aware DISPLAY names (flat keys render flats: F major -> Bb, not A#).
    // pcs are derived from the names but notesToPcs is spelling-agnostic, so the
    // pitch classes the fretboard lights up are UNCHANGED — only the labels flip.
    var notes = C.scaleKeyAware(k, scaleMode);
    return {
      key: k, scaleMode: scaleMode, rootPc: rp, notes: notes, pcs: notesToPcs(notes),
      degrees: C.scaleDegrees(scaleMode), chords: C.diatonicKeyAware(k, scaleMode),
      label: shortMode(C.modeInfo(scaleMode).label),
      keyLabel: C.keyLabel(k, scaleMode)   // conventional key-tonic name (A# -> Bb) for headings
    };
  }
  // S-BLUES: the Practice Studio's scale-chip swap bundle - SOLO LAYER ONLY.
  // scaleId 'mode' (or falsy) delegates straight to studioTheory() so the
  // default chip is IDENTICAL to pre-S-BLUES Studio behavior (no
  // reimplementation, no drift risk). Any other scaleId (a Circle.SOLO_SCALES
  // key: pentMajor/pentMinor/blues) reads ONLY Circle.soloScale/soloScaleDegrees/
  // soloScaleInfo - it never touches C.diatonic()/chords, so chords-in-key,
  // buildWhy, and whynote are untouched by any chip tap (see the
  // harmonization-isolation test in tracks.test.js). Module-scope + exported
  // so tests drive the SAME function the Studio chip wiring calls. Returns
  // null when Circle/key/scaleId can't resolve (callers keep the prior bundle
  // on-screen rather than clearing it).
  function soloBundle(key, mode, scaleId) {
    if (!scaleId || scaleId === 'mode') {
      var th = studioTheory(key, mode);
      return th ? { notes: th.notes, pcs: th.pcs, degrees: th.degrees, label: th.label } : null;
    }
    var C = circleRef(), k = normRoot(key);
    if (!C || rootIndex(k) < 0 || typeof C.soloScale !== 'function') return null;
    var notes = C.soloScale(k, scaleId);
    if (!notes.length) return null;
    var info = C.soloScaleInfo(scaleId);
    return { notes: notes, pcs: notesToPcs(notes), degrees: C.soloScaleDegrees(scaleId), label: info ? info.label : scaleId };
  }
  // S-BLUES-BOXES: which of the 3 box-eligible scale ids (pentMajor/
  // pentMinor/blues) applies to the CURRENTLY selected chip - so the
  // Studio's named-box chip + pager-snap (KeyExplorer.renderScale's
  // opts.boxScaleId) only activate for those, never for a 7-note mode
  // scale. scaleId 'mode' resolves via modeScaleMode (th.scaleMode): the
  // ONLY 'mode' case that's box-eligible is the M-GUIDE W2 Blues key (its
  // own scale IS the SOLO_SCALES.blues 6-note set) - every other mode
  // (ionian/aeolian/dorian/mixolydian) keeps the classic fixed 0/5/10 walk.
  // Module-scope + exported (mirrors soloBundle/scaleKeyFor) so this is
  // directly unit-testable without the Studio DOM.
  var BOX_SCALE_IDS = { pentMajor: true, pentMinor: true, blues: true };
  function boxScaleIdFor(scaleId, modeScaleMode) {
    if (scaleId && scaleId !== 'mode') return BOX_SCALE_IDS[scaleId] ? scaleId : null;
    return modeScaleMode === 'blues' ? 'blues' : null;
  }
  // M-GUIDE W3a (D-CARDS-STATIC): soloScaleFraming MOVED VERBATIM to solo-guide.js
  // as SoloGuide.framing(scaleId, family) - same behavior, same P5-voiced static
  // strings. Moved (not duplicated) so W3b's Compose solo chips (songbook.js) can
  // call the identical function without depending on tracks.js.
  // Same guarded-reference pattern as circleRef()/notablesRef() above: window.SoloGuide
  // in the browser, a require() fallback in Node so tracks.test.js and solo-guide.test.js
  // share one require-cache module instance (not a duplicate).
  function soloGuideRef() {
    if (global.SoloGuide) return global.SoloGuide;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./solo-guide.js'); } catch (e) {}
    }
    return null;
  }
  // M-GUIDE W3a (section 2, chord-tone targeting): pure pc-arithmetic classifier.
  // Precedence root > chord > blue > scale (blue is defaultTones' job below, not
  // this fn's). The chord's root is parsed locally (not read off Circle.chordTones'
  // internal pc order) so this stays independent of that function's array shape.
  // Returns null when chordName is falsy/unresolvable - callers treat that as "no
  // target".
  //
  // GHOST DOTS (P5 seasoned-player adversarial fold, 2026-07-05, supersedes the
  // original D-TARGET "intersection-only" deferral): a chord tone OUTSIDE the
  // current scale is exactly the note a seasoned player reaches for on purpose
  // (e.g. C# - the major 3rd - over A7 in A blues is the money note that IS the
  // rub's resolution target). Hiding it taught the wrong habit. ghostPcs carries
  // those out-of-scale chord tones so the caller can render them as hollow dots
  // at their correct fret positions - never as a filled kx-chord/kx-root mark.
  function targetTones(scalePcs, scaleRootPc, chordName) {
    var C = circleRef();
    if (!C || !chordName) return null;
    var m = /^([A-Ga-g][#b]?)/.exec(String(chordName).trim());
    if (!m) return null;
    var chordRootPc = rootIndex(normRoot(m[1]));
    if (chordRootPc < 0) return null;
    var ctPcs = C.chordTones(chordName);
    if (!ctPcs.length) return null;
    var inScale = {};
    (scalePcs || []).forEach(function (p) { inScale[((p % 12) + 12) % 12] = true; });
    var byPc = {}, ghostPcs = [];
    ctPcs.forEach(function (p) {
      var pc = ((p % 12) + 12) % 12;
      if (!inScale[pc]) { if (ghostPcs.indexOf(pc) < 0) ghostPcs.push(pc); return; }
      byPc[pc] = (pc === chordRootPc) ? 'root' : 'chord';
    });
    // dominant-quality rub: chordTones carries BOTH the major 3rd (+4) and the
    // dominant 7th (+10) -> the target's minor-3rd-equivalent (root+3) is the rub
    // note (e.g. Eb over C7, Bb over G7 in C blues; nothing over a plain IV7).
    var rubPc = null;
    if (ctPcs.indexOf((chordRootPc + 4) % 12) >= 0 && ctPcs.indexOf((chordRootPc + 10) % 12) >= 0) {
      var cand = (chordRootPc + 3) % 12;
      if (inScale[cand]) rubPc = cand;
    }
    return { byPc: byPc, rubPc: rubPc, ghostPcs: ghostPcs };
  }
  // M-GUIDE W3a: the ALWAYS-ON default mark (independent of any active target) -
  // the blues solo scale's b5 (scaleRootPc+6), whenever the blues scale renders.
  // bundle.pcs[0] is always the scale's own root pc (every SOLO_SCALES/diatonic
  // formula starts at semitone 0), so this works for both a studioTheory bundle
  // and a soloBundle() chip-swap result without needing a separate rootPc field.
  function defaultTones(bundle) {
    if (!bundle || bundle.label !== 'Blues' || !bundle.pcs || !bundle.pcs.length) return null;
    var rootPc = bundle.pcs[0];
    var bluePc = (rootPc + 6) % 12;
    var byPc = {}; byPc[bluePc] = 'blue';
    return { byPc: byPc, rubPc: null };
  }
  // S-WHYNOTE (sprint-1 item 6, stretch; A9-bound): a one-shot JIT "why" notable
  // at the Compose -> Studio hand-off (openStudio below - the seam where the
  // solo-scale panel first renders for a key+mode). TWO STATIC templates only,
  // chosen by a plain string switch on th.scaleMode - zero new theory derivation.
  // modeName reuses the exact major/minor/label.toLowerCase() mapping buildWhy
  // already computes for its own "A minor" display line (no new lookup either).
  // Interpolates only th.key + that mode name - both are labels the Studio
  // already renders elsewhere on the same screen.
  function whynoteText(key, scaleMode, label) {
    var modeName = scaleMode === 'aeolian' ? 'minor' : scaleMode === 'ionian' ? 'major' : label.toLowerCase();
    if (scaleMode === 'ionian') {
      return 'Why this scale works: ' + key + ' major and its relative minor share the same notes - solo either over this progression.';
    }
    // Minor/modal (aeolian, dorian, mixolydian): the parallel-phrased equivalent -
    // true for all three (each differs from its parallel major by at least one
    // degree), so one template covers the whole non-ionian family.
    return 'Why this scale works: ' + key + ' ' + modeName + ' and its parallel major share the same home note, not the same notes - stick with ' + key + ' ' + modeName + ' here.';
  }
  // Consumer-side claim + template pick for the 'whynote' notable slot (priority
  // order + show-once persistence are notables.js's job, not re-implemented here).
  // Returns Notables.renderBanner()-ready opts when the slot is won (first ever
  // call, or a repeat call while still un-dismissed); returns null when the slot
  // is denied (already dismissed forever, OR a higher-priority notable - firstrun
  // outranks whynote - currently holds it) or Notables isn't loaded. Callers skip
  // silently on null, matching the notables.js consumer contract.
  function whynoteBanner(th) {
    var N = notablesRef();
    if (!N || typeof N.claim !== 'function' || !N.claim('whynote')) return null;
    return { consumerId: 'whynote', text: whynoteText(th.key, th.scaleMode, th.label), className: 'bt-st-notable' };
  }

  var STORE = 'bt.custom.v1';
  var URLSTORE = 'music.trackUrls.v1';   // { [trackKey]: videoId } overlay for curated tracks
  // Catalog-key corrections change a track's trackKey() storage identity, which
  // would orphan a curated url the user saved under the OLD key. Old -> new map,
  // applied once when the overlay loads; an existing entry under the new key is
  // never clobbered. Module-level + exported so the remap is testable.
  var LEGACY_TRACKKEYS = {
    'sample in a jar|phish|G|major': 'sample in a jar|phish|A|major',
    // trackKey used to coarsen modal modes to 'major' - overlays saved for the
    // 6 modal seed tracks re-key to their true-mode identity.
    'grateful dead style mixolydian jam in g|search|G|major': 'grateful dead style mixolydian jam in g|search|G|mixolydian',
    'southern rock mixolydian jam in e|search|E|major': 'southern rock mixolydian jam in e|search|E|mixolydian',
    'sweet mixolydian jam in d|search|D|major': 'sweet mixolydian jam in d|search|D|mixolydian',
    'santana dorian jam in e minor|search|E|major': 'santana dorian jam in e minor|search|E|dorian',
    'carlos style dorian jam in a|search|A|major': 'carlos style dorian jam in a|search|A|dorian',
    'modal jam track in d dorian|search|D|major': 'modal jam track in d dorian|search|D|dorian'
  };
  function migrateUrls(o) {
    var changed = false;
    Object.keys(LEGACY_TRACKKEYS).forEach(function (oldK) {
      if (o[oldK] == null) return;
      var newK = LEGACY_TRACKKEYS[oldK];
      if (o[newK] == null) o[newK] = o[oldK];
      delete o[oldK]; changed = true;
    });
    return changed;
  }
  var MODE_ORDER = ['ionian', 'lydian', 'mixolydian', 'dorian', 'aeolian', 'phrygian'];
  var ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

  var SHELL =
    '<div class="cof" data-cof></div>'
    + '<div class="cofPanel" data-cofpanel></div>'
    + '<div class="bt-controls">'
    + '  <div class="bt-bar"><span class="bt-tag">genre</span><div class="chips" data-genre></div></div>'
    + '  <div class="bt-bar"><span class="bt-tag">key</span><div class="chips" data-keys></div><div class="bt-mode" data-modetoggle></div></div>'
    + '</div>'
    + '<div class="bt-count" data-count></div>'
    + '<div class="bt-curate-bar" data-curatebar></div>'
    + '<div class="bt-results" data-results></div>'
    + '<div class="bt-more" data-more></div>'
    + '<div class="bt-queue" data-queue hidden></div>'
    + '<div class="bt-add">'
    + '  <button class="bt-add-toggle" data-addtoggle type="button">+ add a track</button>'
    + '  <div class="bt-add-panel" data-addpanel hidden>'
    + '    <input data-aurl class="bt-in" placeholder="Paste a YouTube URL" autocomplete="off">'
    + '    <input data-atitle class="bt-in" placeholder="Title" autocomplete="off">'
    + '    <div class="bt-add-grid">'
    + '      <input data-akey class="bt-in" placeholder="Key (A, C#...)" autocomplete="off">'
    + '      <select data-amode class="bt-in"><option value="major">major</option><option value="minor">minor</option></select>'
    + '      <input data-agenre class="bt-in" placeholder="Genre" autocomplete="off">'
    + '      <input data-abpm class="bt-in" placeholder="BPM" inputmode="numeric" autocomplete="off">'
    + '    </div>'
    + '    <div class="bt-add-actions">'
    + '      <button data-asave class="bt-add-save" type="button">Save to my library</button>'
    + '      <button data-acancel class="bt-add-cancel" type="button">cancel</button>'
    + '    </div>'
    + '  </div>'
    + '</div>';

  function mount(opts) {
    opts = opts || {};
    var container = opts.container;
    if (!container) return;
    var tracksUrl = opts.tracksUrl || 'tracks.json';
    var pack = opts.pack || null;  // instrument pack -> the fretboard Studio (else a bare player)
    container.innerHTML = SHELL;
    var $ = function (sel) { return container.querySelector(sel); };

    // fullscreen player overlay lives on <body> (a fixed element inside a
    // transformed .screen ancestor would be clipped to the tab, not the viewport)
    var elPlayer = document.createElement('div');
    elPlayer.className = 'bt-player';
    document.body.appendChild(elPlayer);

    var state = { genre: 'all', key: null, mode: 'major', scaleMode: 'ionian', view: 'finder', seed: [], custom: [], urls: {}, tracks: [] };
    var elGenre = $('[data-genre]'), elKeys = $('[data-keys]'), elMode = $('[data-modetoggle]');
    var elResults = $('[data-results]'), elMore = $('[data-more]'), elCount = $('[data-count]');
    var elWheel = $('[data-cof]'), elPanel = $('[data-cofpanel]');
    var elQueue = $('[data-queue]'), elCurateBar = $('[data-curatebar]');
    var elControls = $('.bt-controls'), elAdd = $('.bt-add');
    // Optional VISIBLE home for the curate bar (the in-container bar lives inside
    // the retired, permanently-hidden finder tab - unreachable). When the host
    // supplies a slot, the bar renders there and the queue opens as a body-level
    // panel (same pattern as the player/Studio overlay).
    var elCurateHost = opts.curateBarEl || null;
    if (elCurateHost) elCurateBar = elCurateHost;
    var elQueuePanel = document.createElement('div');
    elQueuePanel.className = 'bt-qpanel';
    document.body.appendChild(elQueuePanel);
    function queuePanelOpen() { return elQueuePanel.classList.contains('on'); }
    function renderQueuePanel() {
      var rows = urllessTracks();
      elQueuePanel.innerHTML =
        '<div class="bt-qpanel-box" role="dialog" aria-label="Curation queue">'
        + '<div class="bt-qpanel-head"><span class="bt-qhead">Curate videos</span>'
        + '<button class="bt-pl-x" data-qclose type="button">close</button></div>'
        + '<div class="bt-qhint">' + (rows.length
          ? rows.length + (rows.length === 1 ? ' track has' : ' tracks have') + ' no video yet. Tap a suggestion or paste a YouTube URL - Save makes it the curated video.'
          : 'Every track has a curated video. Nice work.') + '</div>'
        + '<div class="bt-qpanel-list" data-qlist></div></div>';
      var list = elQueuePanel.querySelector('[data-qlist]');
      rows.forEach(function (t) { list.appendChild(queueRow(t)); });
      elQueuePanel.querySelector('[data-qclose]').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else closeQueuePanel(); };
      elQueuePanel.onclick = function (e) { if (e.target === elQueuePanel) { if (window.NavHistory) window.NavHistory.dismiss(); else closeQueuePanel(); } };
    }
    function openQueuePanel() {
      renderQueuePanel(); elQueuePanel.classList.add('on');
      if (window.NavHistory) window.NavHistory.open('queue', closeQueuePanel);
    }
    function closeQueuePanel() { elQueuePanel.classList.remove('on'); elQueuePanel.innerHTML = ''; }

    function loadCustom() {
      try { var s = localStorage.getItem(STORE); var a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
      catch (e) { return []; }
    }
    function saveCustom(a) { try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) {} }
    function loadUrls() {
      try {
        var s = localStorage.getItem(URLSTORE); var o = s ? JSON.parse(s) : {};
        o = (o && typeof o === 'object') ? o : {};
        if (migrateUrls(o)) saveUrls(o); // re-key legacy overlays once, then persist
        return o;
      }
      catch (e) { return {}; }
    }
    function saveUrls(o) { try { localStorage.setItem(URLSTORE, JSON.stringify(o)); } catch (e) {} }
    // Attach a curated url to a seed track by its stable key (or clear it when id is falsy),
    // persist the overlay, and rebuild the merged list. Returns true on a real change.
    function setTrackUrl(t, id) {
      var k = trackKey(t);
      if (id) state.urls[k] = id; else delete state.urls[k];
      saveUrls(state.urls); remerge(); return true;
    }
    // Seed (with url overlay applied) + custom user tracks. Custom tracks already
    // carry their own yt id and aren't part of the overlay.
    function remerge() { state.tracks = mergeTracks(applyUrlOverlay(state.seed, state.urls), state.custom); }
    // Tracks with no playable video: neither a curated tracks.json id nor an overlay url.
    function urllessTracks() {
      return state.tracks.filter(function (t) { return !t.yt; });
    }

    function openSearch(q) { window.open(youtubeSearchUrl(q), '_blank', 'noopener'); }
    function openPlayer(t) {
      // No video = nothing to embed: a bare iframe would load /embed/undefined.
      // Send the player to a YouTube search for the track instead.
      if (!t.yt) { openSearch(searchQuery(t)); return; }
      elPlayer.innerHTML =
        '<div class="bt-pl-box" role="dialog" aria-label="Player">'
        + '<div class="bt-pl-head"><span class="bt-pl-t">' + esc(t.title || '') + '</span>'
        + '<button class="bt-pl-x" type="button">close</button></div>'
        + '<div class="bt-pl-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
        + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div></div>';
      elPlayer.classList.add('on');
      elPlayer.querySelector('.bt-pl-x').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else closePlayer(); };
      elPlayer.onclick = function (e) { if (e.target === elPlayer) { if (window.NavHistory) window.NavHistory.dismiss(); else closePlayer(); } };
      if (window.NavHistory) window.NavHistory.open('player', closePlayer);
    }
    // M-EAR wave 1: the Studio's active scale-audition handle (Sound.playScale's
    // return value), scoped here (same level as elPlayer/closePlayer, ABOVE
    // openStudio) so closePlayer - shared by the plain player AND the Studio,
    // the "tab/surface change" stop condition for whichever is open - can
    // silence it on close regardless of which one is active. Sound.stopAll()
    // is a defensive belt-and-suspenders call (harmless no-op if nothing is
    // playing); studioSound itself resets openStudio's own toggle-icon state
    // via its onStop callback (wired inside openStudio, below).
    var studioSound = null;
    function closePlayer() {
      if (global.Sound) global.Sound.stopAll();
      studioSound = null;
      elPlayer.classList.remove('on'); elPlayer.classList.remove('studio'); elPlayer.innerHTML = '';
    }

    /* ---- the Practice Studio: the track playing + the theory to solo over it ----
     * Scale-first layout: pinned backing track on top, the fretboard scale to
     * solo as the hero, then the chords in the key (tap to hear), then the circle
     * one tap away. Needs the instrument pack (for the fretboard + chord shapes);
     * without one we fall back to the bare player. The iframe never reloads as you
     * scroll the theory below it. */
    // Maps the Studio's resolved circle.js scale-mode name (ionian/aeolian/dorian/
    // mixolydian) to the lowercase major/minor/dorian/mixolydian vocabulary the
    // "walk the cycle" deep-link params use (matching songbook.js's inversions link -
    // triad-inversions.html doesn't read ?mode= yet, but the vocabulary stays
    // consistent for whenever it does).
    var SCALE_MODE_TO_RECORD_MODE = { ionian: 'major', aeolian: 'minor', dorian: 'dorian', mixolydian: 'mixolydian' };
    // M-EAR wave 1.6 (U14): the 3-stop tempo control's bpm values, chosen by
    // ear feel against the wave-1 default (72bpm, D-EAR-1) - Slow keeps that
    // exact hum-along pace unchanged; Med and Fast are roughly +45%/+95%
    // faster, matching the operator's "needs faster tempo" complaint
    // (docs/plans/uat-walkthrough-20260704.md U14) without abandoning the
    // slow option a first-time learner still wants. Default is 'med' (was
    // implicitly 'slow' pre-U14) - the operator's own complaint was that the
    // ONLY speed available was too slow, so the fix ships a faster default
    // alongside the control, not just the control alone.
    var TEMPO_BPM = { slow: 72, med: 104, fast: 140 };
    var TEMPO_DEFAULT = 'med';
    // Deep-link to the same "Walk the full cycle up the neck" inversions page the
    // Compose tab links (songbook.js), now surfaced from the Practice Studio too -
    // carries the active instrument profile (so the page opens on the same fretboard)
    // and the track's key/mode. Profile id comes from the page URL first (explicit),
    // then the last-selected-profile fallback in localStorage; omitted if neither
    // resolves (the page still works with just ?key=, defaulting its own profile).
    function inversionsHref(th) {
      var params = [];
      try {
        var qp = new URLSearchParams(location.search).get('p');
        var pid = qp || localStorage.getItem('music.activeProfile.v1');
        if (pid) params.push('p=' + encodeURIComponent(pid));
      } catch (e) {}
      if (th.key) params.push('key=' + encodeURIComponent(th.key));
      var modeParam = SCALE_MODE_TO_RECORD_MODE[th.scaleMode];
      if (modeParam) params.push('mode=' + encodeURIComponent(modeParam));
      return 'triad-inversions.html' + (params.length ? '?' + params.join('&') : '');
    }
    // S2/FORK-3 (owner-ruled): the Studio's "why these notes" wheel is a read-only
    // teaching aid - it has no onPick wired (the interactive key-picker wheel lives
    // in the retired #s-tracks container, permanently hidden). Statically tint the
    // relative key (+ dimmer for the V/IV neighbors) so the wheel still teaches
    // something on sight, without implying any wedge is tappable. circle.js's
    // renderWheel is shared with that hidden picker, so this post-processes the
    // returned DOM by matching each neighbor's rendered label text ("A"/"Am") to
    // its <text>, then tints that text's immediately-preceding <path> (the wedge
    // renderWheel appends right before its own label) - no circle.js edit needed.
    // studioTheory now lives at module scope (exported for tests) - see above.
    function buildWhy(box, th) {
      var C = global.Circle;
      var strip = th.notes.map(function (n, i) {
        return '<div class="cofDeg"><span class="nt">' + esc(n) + '</span><span class="dg">' + esc(th.degrees[i]) + '</span></div>';
      }).join('');
      // player-facing key name: "A minor" reads better than "A Aeolian"; modal
      // colours (dorian/mixolydian) read as their own names ("A dorian").
      var keyName = th.scaleMode === 'aeolian' ? 'minor' : th.scaleMode === 'ionian' ? 'major' : th.label.toLowerCase();
      box.innerHTML = '<div class="cofScale">' + strip + '</div>'
        + '<div class="cofHint">The notes that sound "right" over this track, with their scale degrees - '
        + esc(th.keyLabel || th.key) + ' ' + esc(keyName) + '.</div><div class="bt-st-wheel"></div>';
      if (C && C.renderWheel) {
        var mode = normMode(th.scaleMode);
        var wheelEl = C.renderWheel({ selected: { root: th.key, mode: mode } });
        try { tintWheel(wheelEl, C, th.key, mode); } catch (e) { if (global.console && console.warn) console.warn('COF tint skipped (wheel DOM contract changed?):', e); }
        box.querySelector('.bt-st-wheel').appendChild(wheelEl);
      }
    }
    // M-EAR wave 1: per-note tokens (instead of one plain joined string) so
    // the scale-audition marker can highlight the currently-sounding note.
    // Each token carries data-i so onNote(i) (i % notes.length, see sound.js's
    // header) can find and mark exactly one note + one degree per tick. The
    // CONTAINER (.bt-st-notes/.bt-st-degrees, held via data-solonotes/
    // data-solodegrees) keeps its own class for its own text treatment -
    // "Solo over it" is uppercased by .bt-st-lbl; the NOTE NAMES must NOT be,
    // or a flat "Bb" renders as "BB" (.bt-st-notes opts the whole run out).
    function renderNoteTokens(notes) {
      return notes.map(function (n, i) {
        return '<span class="soundNote" data-i="' + i + '">' + esc(n) + '</span>';
      }).join(' ');
    }
    function renderDegreeTokens(degrees) {
      return (degrees || []).map(function (d, i) {
        return '<span class="soundNote" data-i="' + i + '">' + esc(d) + '</span>';
      }).join(' ');
    }
    function openStudio(t) {
      // Rehydrate from the merged track list BEFORE rendering: a bridge payload
      // (songbook's "Solo over it") carries only the song record's yt, so a
      // curated overlay url saved for the SAME track would be silently ignored
      // on first open. Match by trackKey; a yt the payload already carries wins.
      if (!t.yt) {
        var hydrated = state.tracks.filter(function (x) { return trackKey(x) === trackKey(t); })[0];
        if (hydrated && hydrated.yt) t = Object.assign({}, t, { yt: hydrated.yt, ytSource: hydrated.ytSource });
      }
      var th = studioTheory(t.key, t.mode);
      if (!th || !pack) { openPlayer(t); return; }
      // Mode-honest key label: "A" (ionian), "Am" (aeolian), "A dorian" /
      // "G mixolydian" (modal). th.label is the mode name from circle.js. Plain
      // (unescaped) form kept alongside for the M-GUIDE W3a target caption's
      // textContent - keyLabel (escaped) still feeds the innerHTML meta line.
      var keyLabelPlain = th.scaleMode === 'ionian' ? th.key
        : th.scaleMode === 'aeolian' ? th.key + 'm'
        : (th.key + ' ' + th.label.toLowerCase());
      var keyLabel = esc(keyLabelPlain);
      var meta = [keyLabel, t.bpm ? t.bpm + ' bpm' : '', esc(t.genre || '')]
        .filter(Boolean).join(' · ');
      // M-GUIDE W3a (section 2/3): chord-tone targeting + per-scale guidance card
      // state, scoped to this Studio open. scaleBoxWrap is the live boxWrap
      // returned by KeyExplorer.renderScale - toggling a target calls its
      // setTones() (preserves the position-walk); switching a solo-scale chip
      // does a full renderScale() and replaces this reference. curBundle/curScaleId
      // track whichever solo bundle is currently on-screen (the "mode" bundle = th
      // itself, or a soloBundle() chip-swap result) so a chord-target toggle can
      // re-derive tones against the RIGHT scale.
      var scaleBoxWrap = null, activeTargetChord = null, curBundle = th, curScaleId = 'mode';
      // M-TRACKLIB wave 1: jam-discovery panel selection state - per-open only
      // (no persistence, matching the Guide/scale-chip pattern). jamGenre resets
      // to the new scale's first genre whenever the active genre isn't in that
      // scale's list (renderJamPanel below); jamFeel persists across scale-chip
      // switches (a "slow" preference likely holds across modes).
      var jamGenre = null, jamFeel = 'mid';
      // scaleId 'mode' resolves to th.scaleMode (one of the 5 SoloGuide-known
      // modal keys, incl. 'blues'); any other scaleId (pentMajor/pentMinor/blues
      // chip) IS the SoloGuide key directly.
      function scaleKeyFor(scaleId, modeScaleKey) {
        return (scaleId && scaleId !== 'mode') ? scaleId : modeScaleKey;
      }
      // Merge the always-on default mark (blue note) with the active target's
      // root/chord/rub/ghost, active-target entries winning on any pc collision
      // (D-TARGET precedence root > chord > blue > scale). Returns null when
      // there is nothing to mark at all, so the fretboard renders byte-identical
      // to the pre-targeting default (Diagram.scale's own opts.tones-absent
      // contract). ghostPcs (P5 fold) passes through untouched - a ghost note is
      // by definition NOT in the scale, so it never participates in the byPc
      // precedence merge.
      function computeTones(bundle, scaleId) {
        var scalePcs = (bundle && bundle.pcs) || [];
        var scaleRootPc = scalePcs.length ? scalePcs[0] : null;
        var merged = {}, rubPc = null, ghostPcs = [];
        var def = defaultTones(bundle);
        if (def) { for (var k in def.byPc) if (Object.prototype.hasOwnProperty.call(def.byPc, k)) merged[k] = def.byPc[k]; }
        if (activeTargetChord) {
          var tt = targetTones(scalePcs, scaleRootPc, activeTargetChord);
          if (tt) {
            for (var k2 in tt.byPc) if (Object.prototype.hasOwnProperty.call(tt.byPc, k2)) merged[k2] = tt.byPc[k2];
            rubPc = tt.rubPc;
            ghostPcs = tt.ghostPcs || [];
          }
        }
        return (Object.keys(merged).length || rubPc != null || ghostPcs.length)
          ? { byPc: merged, rubPc: rubPc, ghostPcs: ghostPcs } : null;
      }
      // M-EAR wave 1.5 (U13): Window|Full-neck fretboard view, Studio-scoped
      // (spans every scale chip, not per-chip state) - persisted across opens
      // via an additive localStorage key (registered in data-model.md's
      // inventory). Defensive read/write: private browsing / disabled storage
      // must never throw; any unrecognized stored value falls back to
      // 'window' (the pre-U13 default behavior).
      function readFretView() {
        try { return localStorage.getItem('music.fretview.v1') === 'full' ? 'full' : 'window'; }
        catch (e) { return 'window'; }
      }
      function writeFretView(v) {
        try { localStorage.setItem('music.fretview.v1', v === 'full' ? 'full' : 'window'); } catch (e) {}
      }
      var fretView = readFretView();
      // M-EAR wave 1.6 (U14): the tempo control's persisted choice - same
      // defensive read/write + additive-key discipline as fretView above
      // (registered in data-model.md's inventory). Studio-scoped (spans every
      // scale chip, like fretView), not per-track.
      function readTempo() {
        try { var v = localStorage.getItem('music.tempo.v1'); return TEMPO_BPM.hasOwnProperty(v) ? v : TEMPO_DEFAULT; }
        catch (e) { return TEMPO_DEFAULT; }
      }
      function writeTempo(v) {
        try { localStorage.setItem('music.tempo.v1', TEMPO_BPM.hasOwnProperty(v) ? v : TEMPO_DEFAULT); } catch (e) {}
      }
      var tempo = readTempo();
      // Full mode: one span fret 0-14 (KeyExplorer.POS_CAP - "small necks (12-
      // fret default) treat full-neck as 0-14 too", so this ignores
      // defaultFrets(pack) entirely), no pager UI (noPosCtrl) - box-snap is
      // pager-only, so omitting boxScaleId here is enough to keep it out of
      // full mode without a separate flag. Window mode is untouched: no frets
      // override (falls back to defaultFrets(pack) same as pre-U13), boxScaleId
      // passes through as before.
      function scaleRenderOpts(names, tones, boxScaleId) {
        return fretView === 'full'
          ? { names: names, tones: tones, frets: global.KeyExplorer.POS_CAP, noPosCtrl: true }
          : { names: names, tones: tones, boxScaleId: boxScaleId };
      }
      // M-EAR wave 1.5: the ONE fretboard render choke point - the initial
      // (mode) render, every scale-chip switch, AND the Window|Full-neck
      // toggle all call this instead of duplicating the KeyExplorer.renderScale
      // call, so all three paths stay in sync with whichever bundle/scaleId is
      // ACTIVE and with the current view mode. Re-derives the [data-scale]
      // container fresh each call (elPlayer's DOM is rebuilt per Studio open,
      // never stale across opens/closes).
      function renderFretboard(bundle, scaleId) {
        var container = elPlayer.querySelector('[data-scale]');
        if (!container || !global.KeyExplorer) return;
        try {
          container.innerHTML = '';
          var nameMap = [];
          bundle.notes.forEach(function (nm, i) { nameMap[bundle.pcs[i]] = nm; });
          scaleBoxWrap = global.KeyExplorer.renderScale(container, pack, th.rootPc, bundle.pcs,
            scaleRenderOpts(nameMap, computeTones(bundle, scaleId), boxScaleIdFor(scaleId, th.scaleMode)));
        } catch (e) {}
      }
      // Renders the 5 labeled SoloGuide.card lines into the Guide box (guarded -
      // solo-guide.js may not have loaded). Called on Studio open + every chip
      // select (re-derives, per m-guide-ia-20260704.md section 3), regardless of
      // the box's hidden state, so content is never stale when the toggle opens.
      // S-REL-NAMES (U23): passes th.key (the Studio's own canonical root, same
      // for every chip - a scale-chip swap changes scaleKey/notes, never the
      // key) as card()'s optional 3rd arg, so any {relMinor}/{relMajor} token
      // in the card text (e.g. pentMajor.shapes) names the concrete instance.
      function renderGuide(scaleKey, notes) {
        if (!guideBox) return;
        var SG = soloGuideRef();
        var card = SG ? SG.card(scaleKey, notes, th.key) : null;
        if (!card) { guideBox.innerHTML = ''; return; }
        var rows = [['When', card.chooseWhen], ['Resolve', card.resolveTo], ['Watch', card.hangOn],
          ['Phrase', card.startEnd], ['Shapes', card.shapes]];
        guideBox.innerHTML = rows.map(function (r) {
          return '<div class="bt-st-guide-row"><span class="bt-st-guide-lbl">' + esc(r[0]) + '</span>'
            + '<span class="bt-st-guide-txt">' + esc(r[1]) + '</span></div>';
        }).join('');
      }
      // M-EAR wave 1.6 (U16): replaces the old renderTargetCaption() prose
      // sentence ("Showing X inside Y - accent = chord root, filled = chord
      // tones, hollow = chord tone outside the scale.") with the Legend
      // primitive (shared/legend.js) - real dot-swatch + label rows instead
      // of a hand-rolled caption string. Derives which classes are
      // CURRENTLY VISIBLE from the SAME computeTones()/defaultTones() the
      // fretboard render itself consumes (never a second, divergent notion
      // of "what's on screen") plus the live sounding state:
      //   - 'root' is ALWAYS included - a solo scale always has a root note,
      //     sounding or not, the one class every fretboard render carries.
      //   - 'chord'/'ghost'/'rub' only when computeTones() actually produced
      //     that piece (an inert tap - e.g. a chord whose tones are already
      //     ALL in-scale with no rub candidate - must not show a dead row).
      //   - 'blue' only for the Blues scale (defaultTones()'s always-on b5).
      //   - 'sounding' only while studioSound is actually playing right now.
      function legendClassesFor(bundle, scaleId, isSounding) {
        var classes = ['root'];
        var tones = computeTones(bundle, scaleId);
        if (tones) {
          var hasChord = false;
          for (var pc in tones.byPc) {
            if (Object.prototype.hasOwnProperty.call(tones.byPc, pc) && tones.byPc[pc] === 'chord') { hasChord = true; break; }
          }
          if (hasChord) classes.push('chord');
          if (tones.ghostPcs && tones.ghostPcs.length) classes.push('ghost');
          if (tones.rubPc != null) classes.push('rub');
        }
        if (defaultTones(bundle)) classes.push('blue');
        if (isSounding) classes.push('sounding');
        return classes;
      }
      function renderLegend() {
        if (!legendEl || !global.Legend) return;
        var el = global.Legend.render(legendClassesFor(curBundle, curScaleId, !!studioSound));
        legendEl.innerHTML = '';
        if (el) legendEl.appendChild(el);
      }
      // M-TRACKLIB wave 1 (docs/plans/vision-ear-first-20260704.md): reverse-map
      // the Circle-internal scaleMode word back to the raw major/minor/dorian/
      // mixolydian/blues vocabulary repertoire-form.js's normFormMode() expects -
      // mirrors how a real track's t.mode already reads elsewhere in this file
      // (keyLabelFor). 'blues' has no MODES entry there either (same pre-existing
      // gap the Studio's own "Or edit song details" button already has for a
      // blues-keyed track) - normFormMode silently defaults it to 'major'.
      var SCALEMODE_TO_FORMMODE = { ionian: 'major', aeolian: 'minor', dorian: 'dorian', mixolydian: 'mixolydian', blues: 'blues' };
      // Renders the key-aware jam-discovery explore panel: genre chips x feel
      // chips (both compose the shared .chip primitive - accent-fill .on, no new
      // chip variant) under the CURRENT key (th.key - unaffected by scale-chip
      // switching) + whichever solo-scale chip is active (scaleId, resolved via
      // scaleKeyFor - same resolution renderGuide uses). Called on Studio open +
      // every scale-chip select (mirrors renderGuide's own call sites), so the
      // genre list and generated query are never stale for the on-screen scale.
      // RESPECTS D-HERO-REMOVED: purely additive/static, no show/hide-on-filter,
      // lives in the Studio only.
      function renderJamPanel(scaleId) {
        if (!jamPanel) return;
        var JQ = global.JamQueries;
        if (!JQ) { jamPanel.innerHTML = ''; return; }
        var scaleKey = scaleKeyFor(scaleId, th.scaleMode);
        var genres = JQ.genresFor(scaleKey);
        if (!genres.length) { jamPanel.innerHTML = ''; return; }
        // A genre carried over from a different scale's list (or the first-ever
        // render) resets to that scale's own first genre - the list itself is
        // scale-specific, so a stale selection would silently point at a genre
        // the current scale never offered.
        if (jamGenre == null || genres.indexOf(jamGenre) < 0) jamGenre = genres[0];
        var feelBands = JQ.feels();
        var query = JQ.jamQuery(th.key, scaleKey, jamGenre, jamFeel);
        jamPanel.innerHTML =
          '<div class="bt-st-jamchips" data-jamgenres>' + genres.map(function (g) {
            return '<button class="chip' + (g === jamGenre ? ' on' : '') + '" data-jamgenre="' + esc(g) + '" type="button">' + esc(g) + '</button>';
          }).join('') + '</div>'
          + '<div class="bt-st-jamchips" data-jamfeels>' + feelBands.map(function (f) {
            return '<button class="chip' + (f.id === jamFeel ? ' on' : '') + '" data-jamfeel="' + esc(f.id) + '" type="button">' + esc(f.label) + '</button>';
          }).join('') + '</div>'
          + '<div class="bt-st-jamquery">' + esc(query) + '</div>'
          + '<div class="bt-st-jamresult">'
          // Leave-app external link (new tab, arrow glyph) - same convention as
          // the "Watch on YouTube" / "Search YouTube" links above.
          + '<a class="bt-st-ytlink" href="' + esc(youtubeSearchUrl(query)) + '" target="_blank" rel="noopener">Search YouTube &#8599;</a>'
          // "Add to library" - only when the host wired onEditRequest (same guard
          // the "Or edit song details" affordance uses). Opens the SAME prefilled
          // create-form seam (songbook.js openEditOrAdd): an object with no .id
          // always takes the create branch. Key + mode prefill through this seam
          // today; genre is carried on the object for a future form-side pickup
          // (repertoire-form.js's create item shape doesn't read it yet) - see
          // the PR notes for the one-line follow-up.
          + (opts.onEditRequest ? '<button class="bt-st-editlink" data-jamadd type="button">Add to library</button>' : '')
          + '</div>';
        Array.prototype.forEach.call(jamPanel.querySelectorAll('[data-jamgenre]'), function (b) {
          b.onclick = function () { jamGenre = b.getAttribute('data-jamgenre'); renderJamPanel(scaleId); };
        });
        Array.prototype.forEach.call(jamPanel.querySelectorAll('[data-jamfeel]'), function (b) {
          b.onclick = function () { jamFeel = b.getAttribute('data-jamfeel'); renderJamPanel(scaleId); };
        });
        var jamAddBtn = jamPanel.querySelector('[data-jamadd]');
        if (jamAddBtn) jamAddBtn.onclick = function () {
          opts.onEditRequest({
            key: th.key, mode: SCALEMODE_TO_FORMMODE[th.scaleMode] || 'major',
            title: '', artist: '', genre: jamGenre, yt: null
          });
        };
      }
      // Chords-in-key tap toggles that chord as the fretboard's target (in addition
      // to the existing play-on-tap behavior) - one target surface, per section 2.
      // Re-tapping the active target clears it; tapping a different chord switches.
      function toggleTarget(chordName, tileEl) {
        activeTargetChord = (activeTargetChord === chordName) ? null : chordName;
        var cells = elPlayer.querySelectorAll('.bt-st-chordcell .chord');
        Array.prototype.forEach.call(cells, function (el) { el.classList.remove('targeted'); });
        if (activeTargetChord) tileEl.classList.add('targeted');
        renderLegend();
        if (scaleBoxWrap && typeof scaleBoxWrap.setTones === 'function') scaleBoxWrap.setTones(computeTones(curBundle, curScaleId));
      }
      // Whether this session's video is attachable determines the no-video hint
      // wording below, so compute the seed-track check up front.
      var isSeedTrack = state.seed.some(function (s) { return trackKey(s) === trackKey(t); });
      // Iframe when a curated yt id is present; otherwise a tap-to-search card.
      // The HUD (scale + chords + circle) stays in both cases - the harmony
      // teacher is the point; the embedded player is convenience. The hint's
      // attach instruction matches what's actually rendered: seed tracks have
      // the paste editor below, custom items attach via Edit, and an ephemeral
      // session (no editor at all) gets no attach instruction.
      var attachHint = t.custom ? (opts.onEditRequest ? ' Attach one anytime via Edit below.' : '')
        : isSeedTrack ? ' Paste the one you like below.'
        : '';
      // S5: a custom song built from a chord progression (t.seq) has no real
      // artist/title to search by - enrich the query with its genre + chords
      // instead of the bare (unhelpful) "My progression backing track" search.
      var ytQuery = (t.custom && Array.isArray(t.seq) && t.seq.length) ? customSearchQuery(t) : searchQuery(t);
      var playerBlock = t.yt
        ? '<div class="bt-st-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
          + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
        : '<div class="bt-st-search">'
          + '<a class="bt-st-ytlink" href="' + esc(youtubeSearchUrl(ytQuery)) + '" target="_blank" rel="noopener">'
          + 'Watch on YouTube &#8599;</a>'
          + '<div class="bt-st-search-hint">No curated video yet - opens a YouTube search for the best current match.' + attachHint + ' The HUD below works either way.</div>'
          + '</div>';
      // Add/edit-video-URL affordance. A custom user song owns its yt id directly.
      // State-aware (operator UAT): the wording must never say "add a video" once one
      // exists. HAS a video -> a single plain "Edit" button (the Add/Edit form changes
      // the URL AND title/chords/genre - one unified affordance, not "edit to add a
      // video"). NO video -> a quick inline paste box to attach the video you just
      // found on YouTube (writes cs.yt via onSetVideo), plus an "edit song details"
      // link for the fuller changes. The paste box needs opts.onSetVideo (host writes
      // cs.yt); the edit link needs opts.onEditRequest; each renders only when its
      // callback is wired (graceful degrade). A seed track keeps the trackUrl-overlay
      // editor; an ephemeral session (no id/onSetVideo) gets nothing (a pasted url
      // would have nothing to attach to).
      var urlEditor = t.custom
        ? (t.yt
          ? (opts.onEditRequest
            ? '<div class="bt-st-urled" data-urled><button class="bt-st-editlink" data-editrequest type="button">Edit</button></div>'
            : '')
          : ((opts.onSetVideo && t.id) || opts.onEditRequest
            ? '<div class="bt-st-urled" data-urled>'
              + ((opts.onSetVideo && t.id)
                ? '<div class="bt-st-urled-lbl">Add the video you found</div>'
                  + '<div class="bt-st-urled-row">'
                  + '<input data-vidin class="bt-in" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">'
                  + '<button data-vidsave class="bt-st-urled-save" type="button">Save</button>'
                  + '</div>'
                : '')
              + (opts.onEditRequest ? '<button class="bt-st-editlink" data-editrequest type="button">Or edit song details (title, chords, genre)</button>' : '')
              + '</div>'
            : ''))
        : (isSeedTrack
          ? '<div class="bt-st-urled" data-urled>'
            + '<div class="bt-st-urled-lbl">' + (t.yt ? 'Curated video URL' : 'Add a video URL') + '</div>'
            + '<div class="bt-st-urled-row">'
            + '<input data-urlin class="bt-in" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">'
            + '<button data-urlsave class="bt-st-urled-save" type="button">Save</button>'
            + (t.ytSource === 'overlay' ? '<button data-urlclear class="bt-st-urled-clear" type="button">Clear</button>' : '')
            + '</div></div>'
          : '');
      // .bt-st-stage wraps the pinned header + video: one column in portrait,
      // the left pane in the landscape two-pane split (CSS). Practice content
      // (scale, chords) leads the scrollable body; the url-curation editor sits
      // last, just above the "why" toggle - plumbing after the practice.
      elPlayer.innerHTML =
        '<div class="bt-studio" role="dialog" aria-label="Practice studio">'
        + '<div class="bt-st-stage">'
        + '<div class="bt-st-head"><div class="bt-st-id"><span class="bt-st-t">' + esc(t.title || '') + '</span>'
        + '<span class="bt-st-meta">' + meta + '</span></div>'
        + '<button class="bt-st-x" type="button">close</button></div>'
        + playerBlock
        // Curation lives in the top panel next to Watch-on-YouTube, so when you
        // return to a videoless track the "add a video" control is immediately at
        // hand (was buried below the scale + chords).
        + urlEditor
        + '</div>'
        + '<div class="bt-st-body">'
        // "Solo over it" is uppercased by .bt-st-lbl; the NOTE NAMES must NOT be, or
        // a flat "Bb" renders as "BB". Wrap them in a text-transform:none span.
        // M-EAR wave 1: the play/stop audition toggle sits on the label row;
        // the notes + degrees lines are now per-note token spans (not one
        // plain string) so onNote(i) can bounce a .sounding marker across them.
        + '<div class="bt-st-sec"><div class="bt-st-solorow"><div class="bt-st-lbl">Solo over it - <span class="bt-st-notes" data-solonotes>' + renderNoteTokens(th.notes) + '</span></div>'
        + '<button class="iconBtn soundToggle bt-st-soundtoggle" data-soundtoggle type="button" aria-label="Hear this scale" aria-pressed="false">&#9658;</button></div>'
        + '<div class="bt-st-degrees" data-solodegrees>' + renderDegreeTokens(th.degrees) + '</div>'
        // M-EAR wave 1.6 (U14): the 3-stop tempo control - reuses the app's
        // existing .viewToggle segmented-control primitive verbatim (same
        // primitive the U13 Window|Full-neck toggle below already reuses),
        // so this ships with ZERO new CSS for the control itself. Sits right
        // under the notes/degrees lines it paces, above the scale chips.
        + '<div class="viewToggle" data-tempo>'
        + '<button class="' + (tempo === 'slow' ? 'on' : '') + '" data-tp="slow" type="button">Slow</button>'
        + '<button class="' + (tempo === 'med' ? 'on' : '') + '" data-tp="med" type="button">Med</button>'
        + '<button class="' + (tempo === 'fast' ? 'on' : '') + '" data-tp="fast" type="button">Fast</button>'
        + '</div>'
        // S-BLUES: mode scale (default, unchanged) + pent major/minor + blues.
        // Solo layer only - swapping a chip here never touches chords-in-key below.
        + '<div class="bt-st-scalechips" data-scalechips></div>'
        + '<div class="bt-st-scaleframe" data-scaleframe hidden></div>'
        // M-GUIDE W3a: per-scale mentor card (SoloGuide) - reuses the
        // .bt-st-why-toggle/.bt-st-why visual pattern verbatim (composed, not a
        // new chip variant). Collapsed by default; renderGuide() re-derives on
        // every chip select.
        + '<button class="bt-st-why-toggle" data-guidetoggle type="button">Guide</button>'
        + '<div class="bt-st-why" data-guide hidden></div>'
        // M-EAR wave 1.5 (U13): Window|Full-neck view toggle - reuses the
        // app's existing .viewToggle segmented-control primitive verbatim
        // (songbook.css; documented but unused until now - ui-primitives.md/
        // component-conventions.md's reserved segmented-control convention),
        // so this needed ZERO new CSS. Sits directly above the fretboard it
        // controls.
        + '<div class="viewToggle" data-fretview>'
        + '<button class="' + (fretView === 'window' ? 'on' : '') + '" data-fv="window" type="button">Window</button>'
        + '<button class="' + (fretView === 'full' ? 'on' : '') + '" data-fv="full" type="button">Full neck</button>'
        + '</div>'
        + '<div class="bt-st-scale" data-scale></div>'
        // M-EAR wave 1.6 (U16): the Legend primitive (shared/legend.js)
        // replaces the old M-GUIDE W3a prose caption ("Showing X inside Y -
        // accent = chord root, filled = chord tones, hollow = chord tone
        // outside the scale.") - dot-swatch + label rows instead of a
        // hand-rolled sentence. No wrapping class/hidden attr needed: an
        // empty container (Legend.render() returned null) is already
        // invisible, and Legend.render()'s own returned element carries its
        // own `.legend` styling.
        + '<div data-legend></div>'
        // M-TRACKLIB wave 1: the key-aware jam-discovery explore panel - reuses
        // the .bt-st-why-toggle/.bt-st-why disclosure pattern verbatim (Guide's
        // own primitive, composed not re-invented). Collapsed by default;
        // wireJamPanel() (below) re-derives the genre list + query on every
        // scale-chip select, same as renderGuide().
        + '<button class="bt-st-why-toggle" data-jamtoggle type="button">Find a jam</button>'
        + '<div class="bt-st-why" data-jampanel hidden></div></div>'
        + '<div class="bt-st-sec"><div class="bt-st-lbl">Chords in this key - tap to hear</div>'
        + '<div class="bt-st-chords" data-chords></div></div>'
        // m-guide-ia-20260704.md section 5 chrome-trim (4): the "walk the cycle" link
        // and the "why these notes" toggle merge onto one row (.bt-st-linkrow) instead
        // of each owning its own row - saves vertical space in the scrollable body.
        // U4 (operator UAT 2026-07-04): shortened from "Walk the full cycle up
        // the neck →" / "Why these notes - the circle" - the long labels wrapped
        // to 2 lines each in .bt-st-linkrow at 412px phone width; meaning preserved,
        // just tighter so both fit on one line side by side.
        + '<div class="bt-st-linkrow"><a class="hsrMore" href="' + esc(inversionsHref(th)) + '">Neck walk →</a>'
        + '<button class="bt-st-why-toggle" data-whytoggle type="button">Why these notes?</button></div>'
        + '<div class="bt-st-why" data-why hidden></div>'
        + '</div></div>';
      elPlayer.classList.add('on'); elPlayer.classList.add('studio');
      // M-GUIDE W3a: Guide toggle/box element refs (built above in the
      // template string, so they exist as soon as elPlayer.innerHTML lands).
      var guideToggle = elPlayer.querySelector('[data-guidetoggle]'), guideBox = elPlayer.querySelector('[data-guide]');
      // M-EAR wave 1.6 (U16): the Legend container ref (replaces the old
      // target-caption ref).
      var legendEl = elPlayer.querySelector('[data-legend]');
      // M-TRACKLIB wave 1: jam-discovery toggle/panel element refs (same
      // built-in-the-template-string pattern as Guide, above).
      var jamToggle = elPlayer.querySelector('[data-jamtoggle]'), jamPanel = elPlayer.querySelector('[data-jampanel]');
      // M-EAR wave 1: the play/stop scale-audition toggle + the notes/degrees
      // token lines it bounces a marker across (curBundle already tracks
      // whichever scale-chip is active - see the M-GUIDE W3a comment above).
      var soundToggleEl = elPlayer.querySelector('[data-soundtoggle]');
      var notesLineEl = elPlayer.querySelector('[data-solonotes]');
      var degreesLineEl = elPlayer.querySelector('[data-solodegrees]');
      // M-EAR wave 1.5 (U12): clearSoundMarks/markSoundingNote now ALSO drive
      // the fretboard highlight via scaleBoxWrap.setSounding(pc) - a class-swap
      // over already-rendered dots (key-explorer.js), never a re-render. Reads
      // scaleBoxWrap LIVE (not captured) so it always targets whichever
      // fretboard is on-screen right now (a chip switch or the Window|Full-neck
      // toggle both replace scaleBoxWrap via renderFretboard()).
      function clearSoundMarks() {
        [notesLineEl, degreesLineEl].forEach(function (c) {
          if (!c) return;
          Array.prototype.forEach.call(c.querySelectorAll('.sounding'), function (el) { el.classList.remove('sounding'); });
        });
        if (scaleBoxWrap && typeof scaleBoxWrap.setSounding === 'function') scaleBoxWrap.setSounding(null);
      }
      function markSoundingNote(i, pc) {
        [notesLineEl, degreesLineEl].forEach(function (c) {
          var el = c && c.querySelector('[data-i="' + i + '"]');
          if (el) el.classList.add('sounding');
        });
        if (scaleBoxWrap && typeof scaleBoxWrap.setSounding === 'function') scaleBoxWrap.setSounding(pc);
      }
      function setSoundToggle(on) {
        if (!soundToggleEl) return;
        soundToggleEl.classList.toggle('on', on);
        soundToggleEl.setAttribute('aria-pressed', on ? 'true' : 'false');
        soundToggleEl.setAttribute('aria-label', on ? 'Stop' : 'Hear this scale');
        soundToggleEl.innerHTML = on ? '&#9632;' : '&#9658;';
      }
      // Studio close (closePlayer, above) still stops outright (implementation
      // note #3, M-EAR wave 1 spec). A scale-chip switch WHILE playing no
      // longer routes through here (M-EAR wave 1.5, U11) - it retargets the
      // live loop instead; stopStudioSound() remains the ONE place a genuine
      // stop happens (second tap on the toggle, or Studio close).
      function stopStudioSound() {
        if (studioSound) { studioSound.stop(); studioSound = null; }
        setSoundToggle(false);
        clearSoundMarks();
      }
      if (soundToggleEl) {
        soundToggleEl.onclick = function () {
          if (studioSound) { stopStudioSound(); return; }
          if (!global.Sound || !curBundle || !curBundle.pcs || !curBundle.pcs.length) return;
          setSoundToggle(true);
          studioSound = global.Sound.playScale(curBundle.pcs, {
            // M-EAR wave 1.6 (U14): the currently-selected tempo control
            // value - live tempo changes route through studioSound.setTempo()
            // (the tempo toggle's own onclick, below), not a re-call here.
            bpm: TEMPO_BPM[tempo],
            // M-EAR wave 1.5 (U11): read curBundle.pcs LIVE on every tick, not
            // a value captured at play-start - after a chip-switch retarget,
            // curBundle already points at the NEW bundle (select() updates it
            // before calling retarget()), so the marker + fretboard light
            // always match whichever scale is actually sounding right now,
            // even across a differing note count (e.g. 7-note mode -> 5-note
            // pentatonic).
            onNote: function (i) {
              var len = curBundle.pcs.length, idx = i % len;
              clearSoundMarks();
              markSoundingNote(idx, curBundle.pcs[idx]);
            },
            onStop: function () { studioSound = null; setSoundToggle(false); clearSoundMarks(); renderLegend(); }
          });
          // U16: the 'sounding' legend row joins/leaves as playback starts/stops
          // (onStop above handles the leaving half).
          renderLegend();
        };
      }
      // S-WHYNOTE: one-shot JIT "why" banner, prepended above the scale/chords
      // content it explains - built via the shared Notables banner (same
      // accent-card + dismiss wiring every consumer reuses), never hand-rolled.
      // whynoteBanner(th) already folds in the claim() check + show-once/priority
      // arbitration; a null return (dismissed forever, or preempted by a
      // higher-priority notable) skips silently, per the notables.js contract.
      try {
        var wnOpts = whynoteBanner(th);
        var wnEl = wnOpts ? notablesRef().renderBanner(wnOpts) : null;
        var wnBody = wnEl && elPlayer.querySelector('.bt-st-body');
        if (wnBody) wnBody.insertBefore(wnEl, wnBody.firstChild);
      } catch (e) {}
      // scale + chords via the shared KeyExplorer (also used by the Compose tab). Read-only
      // here: tap = hear, never add. The studio supplies its own labels + boxes, so the
      // chord render runs unwrapped into [data-chords] with the studio's cell class.
      // Fretboard spelling: renderFretboard() maps each scale pitch-class to the
      // note name the scale carries (key-aware post-#85: Bb, not A#, in F major)
      // so the dots match the "Solo over it" list above, whatever names th.notes
      // holds - th itself is the 'mode' bundle (curBundle's initial value).
      renderFretboard(th, 'mode');
      // M-EAR wave 1.6 (U16): initial legend render - 'mode' bundle, nothing
      // sounding yet (matches the fresh-open state renderFretboard(th,'mode')
      // just produced above).
      renderLegend();
      // M-EAR wave 1.5 (U13): Window|Full-neck toggle wiring - paints the
      // active button, persists the choice, and re-renders whichever bundle
      // is CURRENTLY active (curBundle/curScaleId - a chip switch may have
      // happened since Studio open) so the toggle always reflects on-screen
      // state, not just the initial mode scale.
      var fvToggle = elPlayer.querySelector('[data-fretview]');
      function paintFvToggle() {
        if (!fvToggle) return;
        Array.prototype.forEach.call(fvToggle.querySelectorAll('button'), function (b) {
          b.classList.toggle('on', b.getAttribute('data-fv') === fretView);
        });
      }
      if (fvToggle) {
        Array.prototype.forEach.call(fvToggle.querySelectorAll('button'), function (b) {
          b.onclick = function () {
            var v = b.getAttribute('data-fv');
            if (v === fretView) return;
            fretView = v; writeFretView(fretView); paintFvToggle();
            renderFretboard(curBundle, curScaleId);
          };
        });
      }
      // M-EAR wave 1.6 (U14): tempo control wiring - same paint/persist
      // pattern as the Window|Full-neck toggle above. A tap while playing
      // calls studioSound.setTempo() (live boundary application, no
      // re-tap/click/gap); a tap while stopped just persists the choice for
      // the NEXT play tap to pick up (playScale's opts.bpm, above).
      var tempoToggle = elPlayer.querySelector('[data-tempo]');
      function paintTempoToggle() {
        if (!tempoToggle) return;
        Array.prototype.forEach.call(tempoToggle.querySelectorAll('button'), function (b) {
          b.classList.toggle('on', b.getAttribute('data-tp') === tempo);
        });
      }
      if (tempoToggle) {
        Array.prototype.forEach.call(tempoToggle.querySelectorAll('button'), function (b) {
          b.onclick = function () {
            var v = b.getAttribute('data-tp');
            if (v === tempo || !TEMPO_BPM.hasOwnProperty(v)) return;
            tempo = v; writeTempo(tempo); paintTempoToggle();
            if (studioSound && typeof studioSound.setTempo === 'function') studioSound.setTempo(TEMPO_BPM[tempo]);
          };
        });
      }
      // M-GUIDE W3a: default Guide card is the "mode" bundle (th itself).
      renderGuide(th.scaleMode, th.notes);
      // M-TRACKLIB wave 1: default jam-discovery panel is the "mode" bundle too.
      renderJamPanel('mode');
      // S-BLUES: the scale-chip row - [Mode label | Pent major | Pent minor |
      // Blues]. Default = 'mode' (th itself; the fretboard/notes already
      // rendered above are its output, so no re-render on open). A tap
      // re-derives ONLY the solo bundle (notes line, framing caption,
      // fretboard) via soloBundle() - chords-in-key (already rendered below),
      // buildWhy, and whynote all stay keyed to `th`, untouched by any chip.
      (function wireScaleChips() {
        var chipsEl = elPlayer.querySelector('[data-scalechips]');
        var frameEl = elPlayer.querySelector('[data-scaleframe]');
        if (!chipsEl) return;
        var C = circleRef();
        var CHIPS = [
          { id: 'mode', label: th.label },
          { id: 'pentMajor', label: 'Pent major' },
          { id: 'pentMinor', label: 'Pent minor' },
          { id: 'blues', label: 'Blues' }
        ];
        // M-GUIDE W2: when the mode chip ITSELF is already Blues (th.scaleMode ===
        // 'blues'), the standalone 'blues' chip would just re-select the same
        // bundle under a redundant second button - drop it -> [Blues | Pent major
        // | Pent minor].
        if (th.scaleMode === 'blues') CHIPS = CHIPS.filter(function (c) { return c.id !== 'blues'; });
        var curId = 'mode';
        function render() {
          chipsEl.innerHTML = CHIPS.map(function (c) {
            return '<button class="bt-st-scalechip' + (curId === c.id ? ' on' : '') + '" data-scaleid="' + esc(c.id) + '" type="button">'
              + esc(c.label) + '</button>';
          }).join('');
          Array.prototype.forEach.call(chipsEl.querySelectorAll('.bt-st-scalechip'), function (b) {
            b.onclick = function () { select(b.getAttribute('data-scaleid')); };
          });
        }
        function select(scaleId) {
          var bundle = soloBundle(t.key, t.mode, scaleId);
          if (!bundle) return;
          // M-EAR wave 1.5 (U11): a scale-chip switch WHILE auditioning
          // retargets the live loop at the next note boundary instead of
          // stopping - keeps playing, no re-tap, a seamless A/B compare of
          // scales. When nothing is playing, stopStudioSound() stays a
          // harmless idempotent reset (same behavior as pre-U11).
          var wasPlaying = !!studioSound;
          if (!wasPlaying) stopStudioSound();
          curId = scaleId;
          render();
          if (notesLineEl) notesLineEl.innerHTML = renderNoteTokens(bundle.notes);
          if (degreesLineEl) degreesLineEl.innerHTML = renderDegreeTokens(bundle.degrees);
          var info = (scaleId !== 'mode' && C) ? C.soloScaleInfo(scaleId) : null;
          var SG = soloGuideRef();
          // S-REL-NAMES (U23): th.key names any {relMinor}/{relMajor} token in
          // the framing text (e.g. pentMajor's "same shape as {relMinor} pent").
          var framing = (info && SG) ? SG.framing(scaleId, info.family, th.key) : null;
          if (framing) { frameEl.textContent = framing; frameEl.hidden = false; }
          else { frameEl.textContent = ''; frameEl.hidden = true; }
          // M-GUIDE W3a: re-apply the active target (if any) against the NEW bundle,
          // and re-derive the Guide card for whichever solo scale is now on-screen.
          curBundle = bundle; curScaleId = scaleId;
          renderGuide(scaleKeyFor(scaleId, th.scaleMode), bundle.notes);
          // M-TRACKLIB wave 1: the jam-discovery panel is scale-context-reactive
          // too - a chip switch re-derives its genre list + query LIVE (the spec's
          // own words), never a show/hide of the panel itself (D-HERO-REMOVED).
          renderJamPanel(scaleId);
          // M-EAR wave 1.5: renderFretboard() replaces the old inline
          // KeyExplorer.renderScale try-block (S-BLUES-BOXES boxScaleId
          // passthrough is unchanged - it's computed inside renderFretboard
          // itself now, one choke point for the initial render/every chip
          // switch/the Window|Full-neck toggle).
          renderFretboard(bundle, scaleId);
          // M-EAR wave 1.6 (U16): re-derive the legend for the NEW bundle -
          // unlike the old target caption (whose text never varied by scale,
          // only by activeTargetChord + the invariant keyLabelPlain), the
          // legend's chord/ghost/rub rows DO vary per bundle (a target
          // chord's tones can be in-scale for one scale-chip and a ghost for
          // another), so this call is required here, not just at open/toggle.
          renderLegend();
          // Retarget AFTER curBundle/renderFretboard land, so the very next
          // onNote tick (which reads curBundle + scaleBoxWrap live) already
          // matches the NEW scale/fretboard the instant it fires.
          if (wasPlaying && studioSound) studioSound.retarget(bundle.pcs);
        }
        render();
      })();
      global.KeyExplorer.renderChords(elPlayer.querySelector('[data-chords]'), th.chords, {
        wrap: false,
        cellClass: 'bt-st-chordcell',
        diagram: function (name, size) {
          var d;
          try { d = pack.diagram(name, size); } catch (e) { return null; } // skip a chord the pack can't draw
          d.className += ' bt-st-chip';
          return d;
        },
        onTap: function (c, d) {
          try { pack.playChord(c); } catch (e) {}
          d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220);
          // M-GUIDE W3a (section 2): one target surface - tap toggles the fretboard
          // chord-tone target in addition to the existing play behavior.
          toggleTarget(c, d);
        }
      });
      var whyToggle = elPlayer.querySelector('[data-whytoggle]'), whyBox = elPlayer.querySelector('[data-why]');
      whyToggle.onclick = function () {
        var show = whyBox.hidden; whyBox.hidden = !show; whyToggle.classList.toggle('on', show);
        if (show && !whyBox.getAttribute('data-built')) { buildWhy(whyBox, th); whyBox.setAttribute('data-built', '1'); }
      };
      if (guideToggle && guideBox) guideToggle.onclick = function () {
        var show = guideBox.hidden; guideBox.hidden = !show; guideToggle.classList.toggle('on', show);
      };
      // M-TRACKLIB wave 1: same disclosure toggle behavior as Guide - collapsed by
      // default, per-open state only (no persistence).
      if (jamToggle && jamPanel) jamToggle.onclick = function () {
        var show = jamPanel.hidden; jamPanel.hidden = !show; jamToggle.classList.toggle('on', show);
      };
      // URL editor: paste -> validate -> overlay -> reopen studio so the iframe shows.
      var urlIn = elPlayer.querySelector('[data-urlin]'),
          urlSave = elPlayer.querySelector('[data-urlsave]'),
          urlClear = elPlayer.querySelector('[data-urlclear]');
      if (urlIn) {
        if (t.yt) urlIn.value = 'https://youtu.be/' + t.yt;
        urlIn.oninput = function () { urlIn.classList.remove('bad'); };
      }
      if (urlSave) urlSave.onclick = function () {
        var id = parseYouTubeId(urlIn.value);
        if (!id) { focusNoJump(urlIn); urlIn.classList.add('bad'); return; }
        setTrackUrl(t, id); rerender();
        var merged = state.tracks.filter(function (x) { return trackKey(x) === trackKey(t); })[0] || t;
        openStudio(merged);
      };
      if (urlClear) urlClear.onclick = function () {
        setTrackUrl(t, null); rerender();
        var merged = state.tracks.filter(function (x) { return trackKey(x) === trackKey(t); })[0] || t;
        openStudio(merged);
      };
      var editReq = elPlayer.querySelector('[data-editrequest]');
      if (editReq) editReq.onclick = function () {
        // Transition Studio -> Edit form: close the studio DOM + let the form take over
        // its history slot (no stale studio layer left under the form). settleAfter does
        // the replace; falls back to the raw sequence without NavHistory.
        if (window.NavHistory) NavHistory.settleAfter(closePlayer, function () { opts.onEditRequest(t); });
        else { closePlayer(); opts.onEditRequest(t); }
      };
      // Inline "add the video you found" for a custom song with no video yet: parse the
      // pasted URL, write it via the host (cs.yt), and re-open the Studio so the embed
      // shows immediately.
      var vidIn = elPlayer.querySelector('[data-vidin]'), vidSave = elPlayer.querySelector('[data-vidsave]');
      if (vidIn) vidIn.oninput = function () { vidIn.classList.remove('bad'); };
      if (vidSave) vidSave.onclick = function () {
        var id = parseYouTubeId((vidIn.value || '').trim());
        if (!id) { vidIn.classList.add('bad'); try { vidIn.focus({ preventScroll: true }); } catch (e) { vidIn.focus(); } return; }
        var updated = opts.onSetVideo ? opts.onSetVideo(t.id, id) : null;
        openStudio(updated || Object.assign({}, t, { yt: id }));
      };
      elPlayer.querySelector('.bt-st-x').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else closePlayer(); };
      if (window.NavHistory) window.NavHistory.open('studio', closePlayer);
    }

    // The harmony-teacher HUD (scale + chords-in-key + circle) is the point - the
    // embedded player is convenience. Open the Studio whenever a key + mode are
    // present (covers every curated track), even without a yt id; openStudio
    // swaps the iframe for a tap-to-search card in that case. Pure-search
    // fallback (no key, no pack) still goes straight to YouTube as before.
    function activate(t) {
      if (pack && t.key && t.mode && studioTheory(t.key, t.mode)) { openStudio(t); return; }
      if (t.yt && navigator.onLine !== false) { openPlayer(t); return; }
      openSearch(searchQuery(t));
    }

    function chip(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn;
      return b;
    }
    function applyView() {
      var q = state.view === 'queue';
      // Toggle inline display directly: some of these (the circle wheel, the results
      // grid) carry an explicit display rule in CSS that overrides the [hidden]
      // attribute, so setting .hidden alone leaves them visible. Inline style wins.
      function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }
      show(elControls, !q); show(elWheel, !q); show(elPanel, !q);
      show(elResults, !q); show(elMore, !q); show(elCount, !q); show(elAdd, !q);
      if (elQueue) { elQueue.hidden = !q; elQueue.style.display = q ? '' : 'none'; }
    }
    function rerender() {
      renderCircle(); renderPanel(); renderGenre(); renderKeys(); renderMode();
      renderResults(); renderCurateBar(); renderQueue(); applyView();
    }

    /* ---- curation queue: every track with no playable video ---- */
    function renderCurateBar() {
      if (!elCurateBar) return;
      var n = urllessTracks().length;
      if (elCurateHost) {
        // Visible Library slot: a quiet entry point, only when something needs
        // curating (self-hides at zero). Opens the body-level queue panel.
        elCurateBar.innerHTML = n > 0
          ? '<button class="bt-curate-btn" data-curatetoggle type="button">Curate videos (' + n + ')</button>'
          : '';
        var tg = elCurateBar.querySelector('[data-curatetoggle]');
        if (tg) tg.onclick = openQueuePanel;
        return;
      }
      if (state.view === 'queue') {
        elCurateBar.innerHTML = '<button class="bt-curate-btn on" data-curatetoggle type="button">&#8592; Back to finder</button>';
      } else if (n > 0) {
        elCurateBar.innerHTML = '<button class="bt-curate-btn" data-curatetoggle type="button">Curate videos (' + n + ')</button>';
      } else {
        elCurateBar.innerHTML = '';
      }
      var tog = elCurateBar.querySelector('[data-curatetoggle]');
      if (tog) tog.onclick = function () { state.view = (state.view === 'queue') ? 'finder' : 'queue'; rerender(); };
    }
    function queueRow(t) {
      var el = document.createElement('div');
      el.className = 'bt-qcard';
      var meta = [esc(keyLabelFor(t.key, t.mode)), t.bpm ? esc(t.bpm) + ' bpm' : '', esc(t.genre || '')]
        .filter(Boolean).join(' · ');
      el.innerHTML =
        '<div class="bt-qrow"><span class="bt-qtitle">' + esc(t.title || '') + '</span>'
        + '<a class="bt-qsearch" href="' + esc(youtubeSearchUrl(searchQuery(t))) + '" target="_blank" rel="noopener">Search YouTube &#8599;</a></div>'
        + '<div class="bt-qmeta">' + (t.artist ? esc(t.artist) + ' · ' : '') + meta + '</div>'
        + '<div class="bt-qcands" data-cands></div>'
        + '<div class="bt-st-urled-row">'
        + '<input data-qurlin class="bt-in" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">'
        + '<button data-qurlsave class="bt-st-urled-save" type="button">Save</button>'
        + '</div>';
      // P3 candidate suggestions (if seeded) - tappable to fill the input, not auto-applied.
      var cands = (global.Tracks && global.Tracks.CANDIDATES && global.Tracks.CANDIDATES[trackKey(t)]) || [];
      var candBox = el.querySelector('[data-cands]');
      var urlIn = el.querySelector('[data-qurlin]'), urlSave = el.querySelector('[data-qurlsave]');
      if (cands.length && candBox) {
        candBox.innerHTML = '<div class="bt-qcand-lbl">Suggested - tap to load, then Save to confirm:</div>';
        cands.forEach(function (c) {
          var b = document.createElement('button');
          b.className = 'bt-qcand'; b.type = 'button';
          b.innerHTML = esc(c.label || c.id) + (c.note ? ' <span class="bt-qcand-note">' + esc(c.note) + '</span>' : '');
          b.onclick = function () { urlIn.value = 'https://youtu.be/' + c.id; urlIn.classList.remove('bad'); focusNoJump(urlIn); };
          candBox.appendChild(b);
        });
      }
      urlIn.oninput = function () { urlIn.classList.remove('bad'); };
      urlSave.onclick = function () {
        var id = parseYouTubeId(urlIn.value);
        if (!id) { focusNoJump(urlIn); urlIn.classList.add('bad'); return; }
        setTrackUrl(t, id); rerender();
        // keep the body-level panel walking the remaining queue after a save
        if (queuePanelOpen()) renderQueuePanel();
      };
      return el;
    }
    function renderQueue() {
      if (!elQueue) return;
      var rows = urllessTracks();
      elQueue.innerHTML = '<div class="bt-qhead">Curation queue</div>'
        + '<div class="bt-qhint">' + (rows.length
          ? rows.length + (rows.length === 1 ? ' track has' : ' tracks have') + ' no video yet. Find one on YouTube, paste the URL, and it becomes the curated video.'
          : 'Every track has a curated video. Nice work.') + '</div>';
      rows.forEach(function (t) { elQueue.appendChild(queueRow(t)); });
    }

    /* ---- circle of fifths: home + navigation (reuses shared circle.js) ---- */
    function renderCircle() {
      if (!elWheel || !global.Circle) return;
      elWheel.innerHTML = '';
      elWheel.appendChild(global.Circle.renderWheel({
        selected: { root: state.key, mode: state.mode },
        onPick: function (root, mode) { state.key = root; state.mode = mode; state.scaleMode = familyMode(mode); rerender(); }
      }));
    }
    function nbChip(root, mode, why) {
      return '<button class="cofNbChip" data-root="' + esc(root) + '" data-mode="' + esc(mode) + '">'
        + '<b>' + esc(root) + (mode === 'minor' ? 'm' : '') + '</b> · ' + esc(why) + '</button>';
    }
    function modeHint(C, label) {
      var ch = C.modeChange(state.key, state.scaleMode), info = C.modeInfo(state.scaleMode);
      if (!ch.length) return '<b>' + esc(shortMode(label)) + '</b> - the home scale you measure the others against.';
      var ref = info.ref === 'aeolian' ? 'natural minor' : 'major';
      // Bridge to real-world charts (owner ruling, council D3): the app labels
      // canonically SHARP (FORK-4), but tutorials teach "lower the 7th to Bb" -
      // so the LESSON PROSE (this one surface only) adds "often written Bb"
      // when the changed note is a sharp. Labels/chips stay canonical.
      var SHARP2FLAT = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
      var parts = ch.map(function (c) {
        // LOWERED notes only: charts write a lowered 7th as Bb, but a RAISED
        // 4th is universally F# - "often written Gb" there would be wrong
        // pedagogy (codex V2 medium).
        var alt = (c.dir === 'lower' && SHARP2FLAT[c.to]) ? ', often written ' + esc(SHARP2FLAT[c.to]) : '';
        return 'the ' + ORD[c.degree] + ' ' + (c.dir === 'raise' ? 'raised' : 'lowered')
          + ' (<b>' + esc(c.from) + ' → ' + esc(c.to) + '</b>' + alt + ')';
      }).join(', ');
      return '<b>' + esc(shortMode(label)) + '</b> = ' + ref + ' with ' + parts + '.';
    }
    function renderPanel() {
      if (!elPanel || !global.Circle) return;
      if (!state.key) { elPanel.innerHTML = ''; return; }
      var C = global.Circle, label = C.modeInfo(state.scaleMode).label;
      var dia = C.diatonicKeyAware(state.key, state.scaleMode), nb = C.neighbors(state.key, state.mode);
      var notes = C.scaleKeyAware(state.key, state.scaleMode), degs = C.scaleDegrees(state.scaleMode);
      var changed = {}; C.modeChange(state.key, state.scaleMode).forEach(function (c) { changed[c.degree] = true; });
      var modeChips = MODE_ORDER.map(function (m) {
        return '<button class="cofModeChip' + (state.scaleMode === m ? ' on' : '') + '" data-mode="' + esc(m) + '">'
          + esc(shortMode(C.modeInfo(m).label)) + '</button>';
      }).join('');
      var strip = notes.map(function (n, i) {
        return '<div class="cofDeg' + (changed[i + 1] ? ' char' : '') + '">'
          + '<span class="nt">' + esc(n) + '</span><span class="dg">' + esc(degs[i]) + '</span></div>';
      }).join('');
      var chords = dia.map(function (d) {
        return '<div class="cofChord"><span class="rn">' + esc(d.roman) + '</span><span class="nm">' + esc(d.chord) + '</span></div>';
      }).join('');
      elPanel.innerHTML =
        '<div class="cofPanelInner">'
        + '<div class="cofKeyName">' + esc(notes[0] || C.keyLabel(state.key, state.scaleMode)) + ' ' + esc(shortMode(label)) + '</div>'
        + '<div class="cofModes">' + modeChips + '</div>'
        + '<div class="cofScale">' + strip + '</div>'
        + '<div class="cofHint">' + modeHint(C, label) + '</div>'
        + '<div class="cofWhy">The chords that live in this scale:</div>'
        + '<div class="cofChords">' + chords + '</div>'
        + '<div class="cofNbLbl">Explore next</div>'
        + '<div class="cofNb">'
        + nb.map(function (x) { return nbChip(C.keyLabel(x.root, x.mode), x.mode, x.why); }).join('')
        + '</div></div>';
      Array.prototype.forEach.call(elPanel.querySelectorAll('.cofModeChip'), function (b) {
        b.onclick = function () { state.scaleMode = b.getAttribute('data-mode'); state.mode = C.modeInfo(state.scaleMode).family; rerender(); };
      });
      Array.prototype.forEach.call(elPanel.querySelectorAll('.cofNbChip'), function (b) {
        b.onclick = function () {
          state.key = b.getAttribute('data-root'); state.mode = b.getAttribute('data-mode');
          state.scaleMode = familyMode(state.mode); rerender();
        };
      });
    }

    function renderGenre() {
      elGenre.innerHTML = '';
      ['all'].concat(uniqueGenres(state.tracks)).forEach(function (g) {
        elGenre.appendChild(chip(g === 'all' ? 'All genres' : g, g === state.genre,
          function () { state.genre = g; rerender(); }));
      });
    }
    function renderKeys() {
      elKeys.innerHTML = '';
      elKeys.appendChild(chip('Any key', state.key === null, function () { state.key = null; rerender(); }));
      // #85: chip LABEL is the conventional key name (Bb, not A#), keyed to the current
      // maj/min mode; the stored value `k` stays canonical-sharp so track filtering is unchanged.
      var C = circleRef();
      ROOTS.forEach(function (k) {
        elKeys.appendChild(chip(C ? C.keyLabel(k, state.mode) : k, state.key === k, function () { state.key = k; rerender(); }));
      });
    }
    function renderMode() {
      elMode.innerHTML = '';
      [['maj', 'major'], ['min', 'minor']].forEach(function (m) {
        elMode.appendChild(chip(m[0], state.mode === m[1], function () { state.mode = m[1]; state.scaleMode = familyMode(m[1]); rerender(); }));
      });
    }
    function cardEl(row) {
      var t = row.track;
      // SSOT: same renderer as Songs/Set (music/shared/list-item.js). The track-
      // specific related-match label rides along as the item note; tap + action
      // both route through activate() (the existing play/search ladder).
      return global.ListItem.render(t, {
        segment: 'library',
        note: (row.why && row.rank > 0) ? row.why : null,
        onActivate: function () { activate(t); },
        onAction: function () { activate(t); }
      });
    }
    function moreButton(label, q) {
      elMore.innerHTML = '';
      var b = document.createElement('button');
      b.className = 'bt-more-btn'; b.innerHTML = esc(label) + ' <span class="ar">&#8599;</span>';
      b.onclick = function () { openSearch(q); };
      elMore.appendChild(b);
    }
    function renderResults() {
      var rows = filterTracks(state.tracks, state.genre, state.key, state.mode);
      var fq = filterQuery(state.genre, state.key, state.mode);
      elResults.innerHTML = '';
      if (!rows.length) {
        elResults.innerHTML = '<div class="bt-empty">No curated tracks for that yet.</div>';
        elCount.textContent = '';
        moreButton('Search YouTube for ' + fq, fq);
        return;
      }
      rows.forEach(function (r) { elResults.appendChild(cardEl(r)); });
      var exact = rows.filter(function (r) { return r.rank === 0; }).length;
      var extra = rows.length - exact;
      elCount.textContent = rows.length + (rows.length === 1 ? ' track' : ' tracks')
        + (state.key && extra ? ' (' + exact + ' in key, ' + extra + ' related)' : '');
      moreButton('Search YouTube for more', fq);
    }

    function wireAdd() {
      var toggle = $('[data-addtoggle]'), panel = $('[data-addpanel]');
      var aUrl = $('[data-aurl]'), aTitle = $('[data-atitle]'), aKey = $('[data-akey]'),
        aMode = $('[data-amode]'), aGenre = $('[data-agenre]'), aBpm = $('[data-abpm]');
      if (!toggle) return;
      toggle.onclick = function () {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) { focusNoJump(aUrl); panel.scrollIntoView({ block: 'nearest' }); }
      };
      $('[data-acancel]').onclick = function () { panel.hidden = true; };
      aUrl.oninput = function () { aUrl.classList.remove('bad'); };
      aKey.oninput = function () { aKey.classList.remove('bad'); };
      $('[data-asave]').onclick = function () {
        var id = parseYouTubeId(aUrl.value);
        var key = normRoot(aKey.value);
        if (!id) { focusNoJump(aUrl); aUrl.classList.add('bad'); return; }
        if (!key || rootIndex(key) < 0) { focusNoJump(aKey); aKey.classList.add('bad'); return; }
        var entry = {
          yt: id, title: aTitle.value.trim() || ('My track ' + id),
          genre: aGenre.value.trim().toLowerCase() || 'other',
          key: key, mode: aMode.value === 'minor' ? 'minor' : 'major',
          bpm: aBpm.value ? parseInt(aBpm.value, 10) : null, capo: 0, custom: true
        };
        state.custom.push(entry); saveCustom(state.custom); remerge();
        aUrl.value = aTitle.value = aKey.value = aGenre.value = aBpm.value = '';
        aMode.value = 'major';
        aUrl.classList.remove('bad'); aKey.classList.remove('bad');
        panel.hidden = true; rerender();
      };
    }

    state.seed = [];
    state.custom = loadCustom();
    state.urls = loadUrls();
    fetch(tracksUrl).then(function (r) { return r.json(); }).then(function (data) {
      state.seed = Array.isArray(data) ? data : [];
      remerge(); rerender();
      if (opts.onReady) opts.onReady();  // M3: tracks loaded -> let the repertoire owner rebuild
    }).catch(function () {
      remerge(); rerender();
      if (!state.tracks.length) elResults.innerHTML = '<div class="bt-empty">Could not load tracks.</div>';
      if (opts.onReady) opts.onReady();
    });
    wireAdd();
    rerender();

    // P3 controller: bridge from the Compose loop. seedKey carries a built
    // progression's key + mode into the finder so matched backing tracks + the
    // solo scale surface without the user re-entering the key by hand. Mode is
    // normalized to the major/minor family the finder filters on.
    function seedKey(root, mode) {
      var k = normRoot(root);
      if (rootIndex(k) < 0) return false;
      state.key = k;
      state.mode = normMode(mode);
      state.scaleMode = familyMode(state.mode);
      rerender();
      return true;
    }
    // M3: the finder tab is retired, but the Practice Studio + the curated track
    // data live on. The repertoire (songbook) reaches them through this controller:
    // openStudio(track) opens the body-level studio overlay (scale + chords + circle,
    // the theory HUD is the point); getTracks() is the seed+overlay+custom list the
    // merged repertoire is built from.
    return {
      seedKey: seedKey,
      openStudio: function (t) { openStudio(t); },
      getTracks: function () { return state.tracks.slice(); }
    };
  }

  var Tracks = {
    compatibleKeys: compatibleKeys, filterTracks: filterTracks, uniqueGenres: uniqueGenres,
    searchQuery: searchQuery, customSearchQuery: customSearchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl, tintWheel: tintWheel,
    embedUrl: embedUrl, parseYouTubeId: parseYouTubeId, mergeTracks: mergeTracks,
    trackKey: trackKey, applyUrlOverlay: applyUrlOverlay,
    notesToPcs: notesToPcs, normMode: normMode, resolveScaleMode: resolveScaleMode,
    studioTheory: studioTheory, migrateUrls: migrateUrls, keyLabelFor: keyLabelFor, mount: mount,
    whynoteText: whynoteText, whynoteBanner: whynoteBanner,
    // S-BLUES: solo-layer-only scale-chip swap (see the block above studioTheory).
    soloBundle: soloBundle,
    // S-BLUES-BOXES: which scale-chip selections are box-eligible (pentMajor/
    // pentMinor/blues) - exported for direct unit tests independent of the
    // Studio DOM wiring (mirrors the soloBundle export above it).
    boxScaleIdFor: boxScaleIdFor,
    // M-GUIDE W3a (section 2): chord-tone targeting - pure pc classifiers,
    // exported for direct unit tests independent of the Studio DOM wiring.
    targetTones: targetTones, defaultTones: defaultTones,
    // P3 seed: { [trackKey]: [{ id, label, note }] } - candidate videos surfaced
    // as tap-to-load suggestions in the curation queue. Populated by candidates.js
    // (loaded after tracks.js); empty when absent. Suggestions only - never applied
    // automatically; the user taps one, then Saves to confirm.
    CANDIDATES: {}
  };
  global.Tracks = Tracks;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tracks;

})(typeof window !== 'undefined' ? window : this);
