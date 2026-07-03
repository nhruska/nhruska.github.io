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
    // Serialize the FULL 4-mode vocabulary: coarsening dorian/mixolydian to
    // 'major' let a modal track collide with a same-title/artist/key major row
    // in the url overlay. Unknown/absent modes still default to 'major'.
    var m = norm(t.mode);
    if (m !== 'minor' && m !== 'dorian' && m !== 'mixolydian') m = 'major';
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
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
  // The Practice Studio's theory bundle for a key+mode: scale notes, pitch
  // classes, degrees, diatonic chords, display label. Module-scope + exported
  // so tests can drive the SAME function the Studio wiring calls (a direct
  // resolveScaleMode test alone would let the openStudio path regress green).
  // Returns null when Circle is absent or the key is unresolvable (callers
  // fall back to the bare player / a YouTube search).
  function studioTheory(key, mode) {
    var C = circleRef(), k = normRoot(key), rp = rootIndex(k);
    if (!C || rp < 0) return null;
    var scaleMode = resolveScaleMode(mode), notes = C.scale(k, scaleMode);
    return {
      key: k, scaleMode: scaleMode, rootPc: rp, notes: notes, pcs: notesToPcs(notes),
      degrees: C.scaleDegrees(scaleMode), chords: C.diatonic(k, scaleMode),
      label: shortMode(C.modeInfo(scaleMode).label)
    };
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
    function closePlayer() { elPlayer.classList.remove('on'); elPlayer.classList.remove('studio'); elPlayer.innerHTML = ''; }

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
        + esc(th.key) + ' ' + esc(keyName) + '.</div><div class="bt-st-wheel"></div>';
      if (C && C.renderWheel) {
        box.querySelector('.bt-st-wheel').appendChild(C.renderWheel({
          selected: { root: th.key, mode: normMode(th.scaleMode) }
        }));
      }
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
      // "G mixolydian" (modal). th.label is the mode name from circle.js.
      var keyLabel = th.scaleMode === 'ionian' ? esc(th.key)
        : th.scaleMode === 'aeolian' ? esc(th.key) + 'm'
        : esc(th.key + ' ' + th.label.toLowerCase());
      var meta = [keyLabel, t.bpm ? t.bpm + ' bpm' : '', esc(t.genre || '')]
        .filter(Boolean).join(' · ');
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
      var playerBlock = t.yt
        ? '<div class="bt-st-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
          + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
        : '<div class="bt-st-search">'
          + '<a class="bt-st-ytlink" href="' + esc(youtubeSearchUrl(searchQuery(t))) + '" target="_blank" rel="noopener">'
          + 'Watch on YouTube &#8599;</a>'
          + '<div class="bt-st-search-hint">No curated video yet - opens a YouTube search for the best current match.' + attachHint + ' The HUD below works either way.</div>'
          + '</div>';
      // Add/edit-video-URL affordance. A custom user song owns its yt id directly.
      // State-aware (operator UAT): the wording must never say "add a video" once one
      // exists. HAS a video -> a single "Edit song details" button (the Add/Edit form
      // changes the URL AND title/chords/genre). NO video -> a quick inline paste box
      // to attach the video you just found on YouTube (writes cs.yt via onSetVideo),
      // plus an "edit song details" link for the fuller changes. The paste box needs
      // opts.onSetVideo (host writes cs.yt); the edit link needs opts.onEditRequest;
      // each renders only when its callback is wired (graceful degrade). A seed track
      // keeps the trackUrl-overlay editor; an ephemeral session (no id/onSetVideo)
      // gets nothing (a pasted url would have nothing to attach to).
      var urlEditor = t.custom
        ? (t.yt
          ? (opts.onEditRequest
            ? '<div class="bt-st-urled" data-urled><button class="bt-st-editlink" data-editrequest type="button">Edit song details</button></div>'
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
        + '<div class="bt-st-sec"><div class="bt-st-lbl">Solo over it · <span class="bt-st-notes">' + esc(th.notes.join(' ')) + '</span></div>'
        + '<div class="bt-st-scale" data-scale></div>'
        + '<a class="hsrMore" href="' + esc(inversionsHref(th)) + '">Walk the full cycle up the neck →</a></div>'
        + '<div class="bt-st-sec"><div class="bt-st-lbl">Chords in this key - tap to hear</div>'
        + '<div class="bt-st-chords" data-chords></div></div>'
        + '<button class="bt-st-why-toggle" data-whytoggle type="button">Why these notes - the circle</button>'
        + '<div class="bt-st-why" data-why hidden></div>'
        + '</div></div>';
      elPlayer.classList.add('on'); elPlayer.classList.add('studio');
      // scale + chords via the shared KeyExplorer (also used by the Compose tab). Read-only
      // here: tap = hear, never add. The studio supplies its own labels + boxes, so the
      // chord render runs unwrapped into [data-chords] with the studio's cell class.
      try {
        // Fretboard spelling: map each scale pitch-class to the note name the scale
        // carries (canonical sharps post-FORK-4: A#, not Bb, in F major) so the dots
        // match the "Solo over it" list above, whatever names th.notes holds.
        var nameByPc = [];
        th.notes.forEach(function (nm, i) { nameByPc[th.pcs[i]] = nm; });
        global.KeyExplorer.renderScale(elPlayer.querySelector('[data-scale]'), pack, th.rootPc, th.pcs, { frets: 7, names: nameByPc });
      } catch (e) {}
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
        }
      });
      var whyToggle = elPlayer.querySelector('[data-whytoggle]'), whyBox = elPlayer.querySelector('[data-why]');
      whyToggle.onclick = function () {
        var show = whyBox.hidden; whyBox.hidden = !show; whyToggle.classList.toggle('on', show);
        if (show && !whyBox.getAttribute('data-built')) { buildWhy(whyBox, th); whyBox.setAttribute('data-built', '1'); }
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
      var parts = ch.map(function (c) {
        return 'the ' + ORD[c.degree] + ' ' + (c.dir === 'raise' ? 'raised' : 'lowered')
          + ' (<b>' + esc(c.from) + ' → ' + esc(c.to) + '</b>)';
      }).join(', ');
      return '<b>' + esc(shortMode(label)) + '</b> = ' + ref + ' with ' + parts + '.';
    }
    function renderPanel() {
      if (!elPanel || !global.Circle) return;
      if (!state.key) { elPanel.innerHTML = ''; return; }
      var C = global.Circle, label = C.modeInfo(state.scaleMode).label;
      var dia = C.diatonic(state.key, state.scaleMode), nb = C.neighbors(state.key, state.mode);
      var notes = C.scale(state.key, state.scaleMode), degs = C.scaleDegrees(state.scaleMode);
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
        + '<div class="cofKeyName">' + esc(notes[0] || C.keyName(state.key)) + ' ' + esc(shortMode(label)) + '</div>'
        + '<div class="cofModes">' + modeChips + '</div>'
        + '<div class="cofScale">' + strip + '</div>'
        + '<div class="cofHint">' + modeHint(C, label) + '</div>'
        + '<div class="cofWhy">The chords that live in this scale:</div>'
        + '<div class="cofChords">' + chords + '</div>'
        + '<div class="cofNbLbl">Explore next</div>'
        + '<div class="cofNb">'
        + nb.map(function (x) { return nbChip(C.spellRoot(x.root, x.mode), x.mode, x.why); }).join('')
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
      ROOTS.forEach(function (k) {
        elKeys.appendChild(chip(k, state.key === k, function () { state.key = k; rerender(); }));
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
    searchQuery: searchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl,
    embedUrl: embedUrl, parseYouTubeId: parseYouTubeId, mergeTracks: mergeTracks,
    trackKey: trackKey, applyUrlOverlay: applyUrlOverlay,
    notesToPcs: notesToPcs, normMode: normMode, resolveScaleMode: resolveScaleMode,
    studioTheory: studioTheory, migrateUrls: migrateUrls, keyLabelFor: keyLabelFor, mount: mount,
    // P3 seed: { [trackKey]: [{ id, label, note }] } - candidate videos surfaced
    // as tap-to-load suggestions in the curation queue. Populated by candidates.js
    // (loaded after tracks.js); empty when absent. Suggestions only - never applied
    // automatically; the user taps one, then Saves to confirm.
    CANDIDATES: {}
  };
  global.Tracks = Tracks;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tracks;

})(typeof window !== 'undefined' ? window : this);
