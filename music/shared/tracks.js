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

  /* ---------- backing-track finder data layer ----------
   * Extracted to tracks-model.js (loaded before this file). Rebind as locals
   * so call sites + the Tracks.* re-exports are unchanged.
   * ------------------------------------------------------------------- */
  var TM = global.TracksModel || (typeof require === 'function' ? require('./tracks-model.js') : null);
  var ROOTS = TM.ROOTS;
  var normRoot = TM.normRoot;
  var rootAt = TM.rootAt;
  var rootIndex = TM.rootIndex;
  var compatibleKeys = TM.compatibleKeys;
  var trackMatch = TM.trackMatch;
  var filterTracks = TM.filterTracks;
  var uniqueGenres = TM.uniqueGenres;
  var searchQuery = TM.searchQuery;
  var customSearchQuery = TM.customSearchQuery;
  var tintWheel = TM.tintWheel;
  var filterQuery = TM.filterQuery;
  var youtubeSearchUrl = TM.youtubeSearchUrl;
  var embedUrl = TM.embedUrl;
  var parseYouTubeId = TM.parseYouTubeId;
  var mergeTracks = TM.mergeTracks;
  var trackKey = TM.trackKey;
  var applyUrlOverlay = TM.applyUrlOverlay;
  var LETTER_PC = TM.LETTER_PC;
  var noteToPc = TM.noteToPc;
  var notesToPcs = TM.notesToPcs;
  var esc = TM.esc;
  var focusNoJump = TM.focusNoJump;
  var familyMode = TM.familyMode;
  var normMode = TM.normMode;

  /* ---------- Practice Studio theory + solo-guide + JIT text ----------
   * Extracted to studio-theory.js (loaded before this file). Rebind as
   * locals so call sites + the Tracks.* re-exports are unchanged.
   * ------------------------------------------------------------------- */
  var ST = global.StudioTheory || (typeof require === 'function' ? require('./studio-theory.js') : null);
  var resolveScaleMode = ST.resolveScaleMode;
  var shortMode = ST.shortMode;
  var keyLabelFor = ST.keyLabelFor;
  var circleRef = ST.circleRef;
  var notablesRef = ST.notablesRef;
  var guidanceLevelRef = ST.guidanceLevelRef;
  var soloGuideRef = ST.soloGuideRef;
  var studioTheory = ST.studioTheory;
  var dispKeyRoot = ST.dispKeyRoot;
  var dispChord = ST.dispChord;
  var soloBundle = ST.soloBundle;
  var inferSoloDefault = ST.inferSoloDefault;
  var boxScaleIdFor = ST.boxScaleIdFor;
  var targetTones = ST.targetTones;
  var defaultTones = ST.defaultTones;
  var whynoteText = ST.whynoteText;
  var whynoteScaleText = ST.whynoteScaleText;
  var whynoteBanner = ST.whynoteBanner;
  var scaletipText = ST.scaletipText;
  var scaletipBanner = ST.scaletipBanner;
  var studioFirstText = ST.studioFirstText;
  var studioFirstBanner = ST.studioFirstBanner;

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
  // G6 S-SCALE-MEMORY (2026-07-10): remember the solo-scale chip a player
  // TAPPED for a given track, so the next Studio open pre-selects it instead
  // of re-deriving inferSoloDefault() every time. ADDITIVE - a brand-new
  // localStorage key, defensive try/catch on both read and write (private-
  // mode safety, matching writeTempo's style below in mount()) - so per
  // music/CLAUDE.md's storage-changes convention this needs no backup.js
  // SCHEMA_VERSION bump. Keyed by trackKey(t), the same stable per-track
  // identity music.trackUrls.v1 already uses, so the map survives catalog
  // reordering. Module-scope + exported so the round-trip is unit-testable
  // in Node without the Studio DOM (mirrors readTempo/writeTempo's shape,
  // but those two stay mount()-local since they hold no per-track key).
  var SOLOSCALE_STORE = 'bt.soloScale.v1'; // { [trackKey]: scaleId }
  function readSoloScales() {
    try {
      var s = localStorage.getItem(SOLOSCALE_STORE);
      var o = s ? JSON.parse(s) : {};
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function readSoloScaleFor(t) {
    var o = readSoloScales();
    var k = trackKey(t);
    return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;
  }
  function writeSoloScaleFor(t, scaleId) {
    try {
      var o = readSoloScales();
      o[trackKey(t)] = scaleId;
      localStorage.setItem(SOLOSCALE_STORE, JSON.stringify(o));
    } catch (e) {}
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
    // F13 (operator UAT 2026-07-05): the 3-button Slow/Med/Fast segmented
    // control reclaimed into ONE compact cycling "Speed" button (lives in
    // the new controls row alongside Play/Guide, F12/F15) - tap advances
    // slow -> med -> fast -> slow (wrap). Same 3-value TEMPO_BPM model,
    // just a different control shape.
    var TEMPO_ORDER = ['slow', 'med', 'fast'];
    var TEMPO_LABEL = { slow: 'Slow', med: 'Med', fast: 'Fast' };
    // F17 (operator UAT 2026-07-05): "instead of stopping the animated
    // sequence of notes, just continue it through two octaves with a pause
    // on the root notes." SOLO_OCTAVES/ROOT_DWELL are Studio-only opts passed
    // to Sound.playScale (sound.js) - Compose's OWN key-preview toggle
    // (songbook.js) omits both and keeps its original 1-octave/no-dwell
    // behavior untouched. ROOT_DWELL 2.2x is a "landing" pause distinctly
    // longer than a normal note without reading as a stutter/glitch at any
    // of the 3 tempo settings.
    var SOLO_OCTAVES = 2;
    var ROOT_DWELL = 2.2;
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
        + esc(dispKeyRoot(th.key, th.scaleMode)) + ' ' + esc(keyName) + '.</div><div class="bt-st-wheel"></div>';
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
    // header) can find and mark exactly one note per tick. The CONTAINER
    // (.bt-st-notes, held via data-solonotes) keeps its own class for its own
    // text treatment - "Solo over it" is uppercased by .bt-st-lbl; the NOTE
    // NAMES must NOT be, or a flat "Bb" renders as "BB" (.bt-st-notes opts
    // the whole run out).
    // F14 (operator UAT 2026-07-05): the separate scale-degrees line
    // (renderDegreeTokens, e.g. "1 2 b3 4 5 b6 b7" under the note names) read
    // as a redundant second notes rendering - removed. This is the ONE notes
    // rendering left in the Solo section.
    function renderNoteTokens(notes) {
      return notes.map(function (n, i) {
        return '<span class="soundNote" data-i="' + i + '">' + esc(n) + '</span>';
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
      var dispKey = dispKeyRoot(th.key, th.scaleMode); // FORK-4 removal: display name
      var keyLabelPlain = th.scaleMode === 'ionian' ? dispKey
        : th.scaleMode === 'aeolian' ? dispKey + 'm'
        : (dispKey + ' ' + th.label.toLowerCase());
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
      // M-EAR wave 1.6 (U14): the tempo control's persisted choice - defensive
      // read/write (registered in data-model.md's inventory): private
      // browsing / disabled storage must never throw; any unrecognized
      // stored value falls back to TEMPO_DEFAULT. Studio-scoped (spans every
      // scale chip), not per-track.
      function readTempo() {
        try { var v = localStorage.getItem('music.tempo.v1'); return TEMPO_BPM.hasOwnProperty(v) ? v : TEMPO_DEFAULT; }
        catch (e) { return TEMPO_DEFAULT; }
      }
      function writeTempo(v) {
        try { localStorage.setItem('music.tempo.v1', TEMPO_BPM.hasOwnProperty(v) ? v : TEMPO_DEFAULT); } catch (e) {}
      }
      var tempo = readTempo();
      // F16 (operator UAT 2026-07-05): the Window|Full-neck view toggle is
      // retired - the fretboard always renders frets 0-12 now (noPosCtrl, no
      // pager), regardless of instrument. This drops the pager UI and, with
      // it, the S-BLUES-BOXES box-position label (KeyExplorer.renderScale
      // only ever allocates the box chip when its OWN position-pager is
      // active - see its showPosCtrl gate) - a documented removal, not an
      // oversight: with the whole 0-12 span always on screen there is
      // nothing left to "walk to" a box position for. boxScaleIdFor (below)
      // stays defined/exported/tested as pure pitch-class math - only this
      // render call site stopped wiring it in.
      function scaleRenderOpts(names, tones) {
        return { names: names, tones: tones, frets: 12, noPosCtrl: true };
      }
      // The ONE fretboard render choke point - the initial (mode) render and
      // every scale-chip switch call this instead of duplicating the
      // KeyExplorer.renderScale call, so both paths stay in sync with
      // whichever bundle/scaleId is ACTIVE. Re-derives the [data-scale]
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
            scaleRenderOpts(nameMap, computeTones(bundle, scaleId)));
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
        var query = JQ.jamQuery(dispKeyRoot(th.key, th.scaleMode), scaleKey, jamGenre, jamFeel);
        jamPanel.innerHTML =
          '<div class="bt-st-jamchips bt-st-jamchips-scroll" data-jamgenres>' + genres.map(function (g) {
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
        // F19 (operator UAT 2026-07-05): chord tiles are now flat name-only
        // chips (.bt-st-chordchip), not the old diagram-cell structure.
        var cells = elPlayer.querySelectorAll('.bt-st-chordchip');
        Array.prototype.forEach.call(cells, function (el) { el.classList.remove('targeted'); });
        if (activeTargetChord) tileEl.classList.add('targeted');
        renderLegend();
        if (scaleBoxWrap && typeof scaleBoxWrap.setTones === 'function') scaleBoxWrap.setTones(computeTones(curBundle, curScaleId));
      }
      // Whether this session's video is attachable determines the no-video hint
      // wording below, so compute the seed-track check up front.
      var isSeedTrack = state.seed.some(function (s) { return trackKey(s) === trackKey(t); });
      // F27 (operator UAT 2026-07-05): "paste yt url and add a video are
      // redundant - use single button where yt button is now." canAttach is
      // true whenever a direct-attach mechanism applies to this track (custom
      // song wired for onSetVideo/onEditRequest, or a seed track) - the
      // trigger's label/hint read "Add a video" in that case, state-aware
      // like the has-video "Edit" precedent below. An ephemeral session with
      // nothing to attach keeps the plain "Find a jam" discovery wording.
      var canAttach = t.custom ? !!((opts.onSetVideo && t.id) || opts.onEditRequest) : isSeedTrack;
      // F21 (operator UAT 2026-07-05): "the find a jam link can be moved -
      // it's redundant with existing yt button - but with more user
      // options." Consolidates the OLD standalone "Find a jam" solo-section
      // disclosure (genre/feel-aware discovery, renderJamPanel below) with
      // the stage's own video/search affordance - ONE entry point instead of
      // two. No curated video yet: the old blind "Watch on YouTube" link
      // (single fixed query from the track's own title/artist) becomes THIS
      // toggle, same stage position/prominence (.bt-st-ytlink), now opening
      // the richer genre+feel panel instead. A video is already curated: a
      // smaller secondary "Find another jam" trigger (.bt-st-editlink, same
      // convention as "Edit"/"Or edit song details") sits right under the
      // iframe - discovery is still one tap away without a second big
      // control competing with the video. Both wire to the SAME jamPanel
      // (below); only the trigger's label/prominence differs by video state.
      //
      // F27: the no-video paste box (urlEditor, below) used to render
      // permanently visible right under this trigger - two competing entry
      // points for the same "get a video" goal. It now shares THIS toggle
      // (wired via data-urled-gated further down) instead of standing apart,
      // so there is one button, one disclosure, for both the direct-paste
      // and the genre/feel-search paths.
      var jamPanelHtml = '<div class="bt-st-why" data-jampanel hidden></div>';
      var noVideoLabel = canAttach ? 'Add a video &#8599;' : 'Find a jam &#8599;';
      var noVideoHint = canAttach
        ? 'No curated video yet - tap Add a video to paste a link or find one by genre and feel.'
        // #2 (operator UAT): the genre/feel chips live behind the "Find a jam"
        // toggle (F27 one-button disclosure - it also reveals the paste box), so
        // "below" pointed at empty space until you tapped. Point the hint at the
        // BUTTON instead, so the pointer matches where the controls actually are.
        : 'No curated video yet - tap Find a jam to pick a genre and feel for a backing track. The HUD below works either way.';
      var playerBlock = t.yt
        ? '<div class="bt-st-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
          + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
          + '<button class="bt-st-editlink" data-jamfindtoggle type="button">Find another jam</button>'
          + jamPanelHtml
        : '<div class="bt-st-search">'
          + '<button class="bt-st-ytlink" data-jamfindtoggle type="button">' + noVideoLabel + '</button>'
          + '<div class="bt-st-search-hint">' + noVideoHint + '</div>'
          + '</div>'
          + jamPanelHtml;
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
      //
      // F27 (operator UAT 2026-07-05): the NO-video variants below are marked
      // data-urled-gated + hidden (instead of the always-visible data-urled
      // the HAS-video variants keep) - they're wired to open/close together
      // with jamFindToggle/jamPanel above, not shown unconditionally. Managing
      // an EXISTING curated video (Edit / Curated video URL) is a different
      // job from finding one, so those stay always-visible, untouched.
      var urlEditor = t.custom
        ? (t.yt
          ? (opts.onEditRequest
            ? '<div class="bt-st-urled" data-urled><button class="bt-st-editlink" data-editrequest type="button">Edit</button></div>'
            : '')
          : ((opts.onSetVideo && t.id) || opts.onEditRequest
            ? '<div class="bt-st-urled" data-urled-gated hidden>'
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
          ? '<div class="bt-st-urled"' + (t.yt ? ' data-urled' : ' data-urled-gated hidden') + '>'
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
      // F32 (UI-std UAT): dismiss is the app's STANDARD back affordance (matches
      // the song view's #backLib "iconBtn ←", leading the header, not a trailing
      // "close" text pill) - "the Solo Studio close beats against brand standards
      // - we have a back button and we're looking at the song view." Same
      // NavHistory.dismiss()/closePlayer() wiring as before, just retargeted to
      // the new .bt-st-back selector below (bt-st-x removed - see tracks.css).
      elPlayer.innerHTML =
        '<div class="bt-studio" role="dialog" aria-label="Practice studio">'
        + '<div class="bt-st-stage">'
        + '<div class="bt-st-head"><button class="iconBtn bt-st-back" type="button" title="Back" aria-label="Back"><span aria-hidden="true">←</span></button>'
        + '<div class="bt-st-id"><span class="bt-st-t">' + esc(t.title || '') + '</span>'
        + '<span class="bt-st-meta">' + meta + '</span></div></div>'
        + playerBlock
        // Curation lives in the top panel next to Watch-on-YouTube, so when you
        // return to a videoless track the "add a video" control is immediately at
        // hand (was buried below the scale + chords).
        + urlEditor
        + '</div>'
        + '<div class="bt-st-body">'
        // F12/F13/F15 (operator UAT 2026-07-05): the controls row - Play
        // (primary, 44px, was a 32px .soundToggle lost among the label text),
        // Speed (one compact cycling button, replaces the 3-button Slow/Med/
        // Fast segmented control), and Guide (a `?` icon, replaces the
        // "Guide" text toggle - its content moves below the fretboard, see
        // data-guide further down, F18). Sits at the TOP of the solo
        // section, ahead of the notes line, so it reads as the section's
        // primary controls rather than one more inline label decoration.
        + '<div class="bt-st-sec"><div class="bt-st-ctrlrow" data-ctrlrow>'
        + '<button class="iconBtn soundToggle bt-st-soundtoggle" data-soundtoggle type="button" aria-label="Hear this scale" aria-pressed="false">&#9658;</button>'
        + '<button class="bt-st-speedbtn" data-speedtoggle type="button">' + esc(TEMPO_LABEL[tempo] || TEMPO_LABEL[TEMPO_DEFAULT]) + '</button>'
        + '<button class="iconBtn bt-st-guidebtn" data-guidetoggle type="button" aria-label="Show the scale guide" aria-pressed="false">?</button>'
        + '</div>'
        // "Solo over it" is uppercased by .bt-st-lbl; the NOTE NAMES must NOT be, or
        // a flat "Bb" renders as "BB". Wrap them in a text-transform:none span.
        // F14 (operator UAT 2026-07-05): this is the ONE notes rendering in
        // the section now - the separate scale-degrees line underneath it
        // (redundant second notes-shaped row) was removed.
        + '<div class="bt-st-lbl">Solo over it - <span class="bt-st-notes" data-solonotes>' + renderNoteTokens(th.notes) + '</span></div>'
        // S-BLUES: mode scale (default, unchanged) + pent major/minor + blues.
        // Solo layer only - swapping a chip here never touches chords-in-key below.
        + '<div class="bt-st-scalechips" data-scalechips></div>'
        + '<div class="bt-st-scaleframe" data-scaleframe hidden></div>'
        // F16 (operator UAT 2026-07-05): the Window|Full-neck view toggle is
        // retired - the fretboard always spans frets 0-12 now (see
        // scaleRenderOpts above), so there is nothing left to toggle.
        + '<div class="bt-st-scale" data-scale></div>'
        // M-EAR wave 1.6 (U16): the Legend primitive (shared/legend.js) - dot-
        // swatch + label rows. No wrapping class/hidden attr needed: an empty
        // container (Legend.render() returned null) is already invisible,
        // and Legend.render()'s own returned element carries its own
        // `.legend` styling.
        + '<div data-legend></div>'
        // M-GUIDE W3a, relocated (F18, operator UAT 2026-07-05): the per-
        // scale mentor card (SoloGuide) used to sit ABOVE the fretboard,
        // right after the scale chips, competing with the primary practice
        // flow for attention. It now renders BELOW the fretboard + legend,
        // collapsed by default, opened via the `?` icon in the controls row
        // above (not a one-shot Notable dismiss - the card content is scale-
        // dependent and re-derives on every chip switch, so a permanent
        // dismiss would hide a genuinely reusable re-orientation aid; the `?`
        // itself is the cheap re-open affordance).
        + '<div class="bt-st-why" data-guide hidden></div>'
        + '</div>'
        // F19 (operator UAT 2026-07-05): chords-in-key drops the SVG diagram
        // + roman numeral - name-only chips (like the scale-chip row above),
        // all 7 fit ONE row at 412px. Tap still plays + targets the fretboard
        // (toggleTarget, unchanged) - only the visual weight changed, not the
        // interaction. Rendered by renderChordChips() (below), not
        // KeyExplorer.renderChords (that helper's cell+diagram+roman shape
        // no longer fits; Compose's own use of renderChords is untouched).
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
      // M-GUIDE W3a, relocated (F18): Guide toggle/box element refs (built
      // above in the template string, so they exist as soon as
      // elPlayer.innerHTML lands) - guideToggle now lives in the controls
      // row, guideBox now renders below the fretboard/legend.
      var guideToggle = elPlayer.querySelector('[data-guidetoggle]'), guideBox = elPlayer.querySelector('[data-guide]');
      // M-EAR wave 1.6 (U16): the Legend container ref (replaces the old
      // target-caption ref).
      var legendEl = elPlayer.querySelector('[data-legend]');
      // F21: the jam-discovery trigger + panel, now consolidated with the
      // stage's video/search affordance (see jamPanelHtml, above) - jamPanel
      // itself is unchanged (still driven by renderJamPanel()), only its
      // trigger's location/label moved.
      var jamFindToggle = elPlayer.querySelector('[data-jamfindtoggle]'), jamPanel = elPlayer.querySelector('[data-jampanel]');
      // M-EAR wave 1: the play/stop scale-audition toggle + the notes token
      // line it bounces a marker across (curBundle already tracks whichever
      // scale-chip is active - see the M-GUIDE W3a comment above).
      var soundToggleEl = elPlayer.querySelector('[data-soundtoggle]');
      var notesLineEl = elPlayer.querySelector('[data-solonotes]');
      // M-EAR wave 1.5 (U12): clearSoundMarks/markSoundingNote now ALSO drive
      // the fretboard highlight via scaleBoxWrap.setSounding(pc) - a class-swap
      // over already-rendered dots (key-explorer.js), never a re-render. Reads
      // scaleBoxWrap LIVE (not captured) so it always targets whichever
      // fretboard is on-screen right now (a chip switch or the Window|Full-neck
      // toggle both replace scaleBoxWrap via renderFretboard()).
      // F14: only the notes line remains (the degrees line it used to share
      // this marker-bounce with was removed) - a single element, not an array.
      function clearSoundMarks() {
        if (notesLineEl) {
          Array.prototype.forEach.call(notesLineEl.querySelectorAll('.sounding'), function (el) { el.classList.remove('sounding'); });
        }
        if (scaleBoxWrap && typeof scaleBoxWrap.setSounding === 'function') scaleBoxWrap.setSounding(null);
        markWheelPc(null);
      }
      function markSoundingNote(i, pc) {
        var el = notesLineEl && notesLineEl.querySelector('[data-i="' + i + '"]');
        if (el) el.classList.add('sounding');
        if (scaleBoxWrap && typeof scaleBoxWrap.setSounding === 'function') scaleBoxWrap.setSounding(pc);
        markWheelPc(pc);
      }
      // S-COF-ANIMATE (operator UAT 2026-07-10): the "why these notes" COF
      // pulses the OUTER wedge at the sounding note's pc while the scale
      // audition plays - a major scale is 7 ADJACENT fifths-wedges, so the
      // audition visibly walks the key's neighborhood on the wheel (the
      // teaching moment the static tint can't show). Structural addressing
      // via renderWheel's data-pc/data-ring (never label text); guarded null
      // if the Why panel was never opened (wheel lazily built) or a cached
      // circle.js predates data-pc. Class-swap only, no re-render - same
      // discipline as setSounding on the fretboard.
      function markWheelPc(pc) {
        var wheelEl = elPlayer.querySelector('.bt-st-wheel');
        if (!wheelEl) return;
        Array.prototype.forEach.call(wheelEl.querySelectorAll('.cofWedge-sound'), function (w) { w.classList.remove('cofWedge-sound'); });
        if (pc == null) return;
        var wedge = wheelEl.querySelector('.cofWedge[data-pc="' + (((pc % 12) + 12) % 12) + '"][data-ring="major"]');
        if (wedge) wedge.classList.add('cofWedge-sound');
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
            // F17: continuous two-octave run with a dwell on every root hit,
            // instead of stopping/restarting each single-octave pass.
            octaves: SOLO_OCTAVES,
            rootDwell: ROOT_DWELL,
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
      //
      // M-GUIDANCE UAT fix (2026-07-05, operator: "I couldn't dismiss the
      // guidance on Solo studio... went back, chose solo over -> skip and
      // it's gone"): whynote's x correctly called Notables.dismiss('whynote')
      // (persisted - a fresh Studio open never re-shows it), but this call
      // site never wired opts.onDismiss, so the tap looked broken - the
      // banner element stayed on screen until the NEXT Studio open, which
      // read as "can't dismiss it" even though the dismissal WAS permanent.
      // Both wnOpts and stOpts now get an onDismiss that removes their own
      // element immediately, same as every other auto-appearing Notables
      // consumer in this app (firstrun/diagrampref/backup all already do
      // this - whynote/scaletip are auto-appearing guidance exactly like
      // them, so they get the same one-tap-gone-for-good affordance). The
      // on-demand '?' SoloGuide card (data-guide, above) is deliberately
      // UNCHANGED by this fix - it is a manual collapse/expand toggle the
      // user opens themselves, never auto-shown, so it is not "unbidden"
      // guidance and does not need a dismiss-forever affordance (see its own
      // comment above, "not a one-shot Notable dismiss").
      try {
        var wnOpts = whynoteBanner(th);
        if (wnOpts) wnOpts.onDismiss = function () { if (wnEl && wnEl.parentNode) wnEl.parentNode.removeChild(wnEl); };
        var wnEl = wnOpts ? notablesRef().renderBanner(wnOpts) : null;
        var wnBody = wnEl && elPlayer.querySelector('.bt-st-body');
        if (wnBody) wnBody.insertBefore(wnEl, wnBody.firstChild);
        // M-GUIDANCE (advanced tier): same insertion shape as whynote above -
        // only one of the two can ever actually render (they compete for the
        // SAME Notables slot; scaletip is lower priority, so it only wins once
        // whynote has been dismissed or is level-ineligible for this profile).
        var stOpts = scaletipBanner(th);
        if (stOpts) stOpts.onDismiss = function () { if (stEl && stEl.parentNode) stEl.parentNode.removeChild(stEl); };
        var stEl = stOpts ? notablesRef().renderBanner(stOpts) : null;
        var stBody = stEl && elPlayer.querySelector('.bt-st-body');
        if (stBody) stBody.insertBefore(stEl, stBody.firstChild);
        // S-PERSONA-COPY: the beginner orientation tip - same slot, same shape;
        // it can never contest whynote/scaletip (disjoint LEVELS gates).
        var sfOpts = studioFirstBanner();
        if (sfOpts) sfOpts.onDismiss = function () { if (sfEl && sfEl.parentNode) sfEl.parentNode.removeChild(sfEl); };
        var sfEl = sfOpts ? notablesRef().renderBanner(sfOpts) : null;
        var sfBody = sfEl && elPlayer.querySelector('.bt-st-body');
        if (sfBody) sfBody.insertBefore(sfEl, sfBody.firstChild);
      } catch (e) {}
      // scale + chords via the shared KeyExplorer (also used by the Compose tab). Read-only
      // here: tap = hear, never add. The studio supplies its own labels + boxes, so the
      // chord render runs unwrapped into [data-chords] with the studio's cell class.
      // Fretboard spelling: renderFretboard() maps each scale pitch-class to the
      // note name the scale carries (canonical sharps post-FORK-4: A#, not Bb, in
      // F major) so the dots match the "Solo over it" list above, whatever names
      // th.notes holds - th itself is the 'mode' bundle (curBundle's initial value).
      renderFretboard(th, 'mode');
      // M-EAR wave 1.6 (U16): initial legend render - 'mode' bundle, nothing
      // sounding yet (matches the fresh-open state renderFretboard(th,'mode')
      // just produced above).
      renderLegend();
      // F13 (operator UAT 2026-07-05): the Speed control wiring - one
      // cycling button (slow -> med -> fast -> slow) replacing the old
      // 3-button Slow/Med/Fast segmented control. A tap while playing calls
      // studioSound.setTempo() (live boundary application, no re-tap/click/
      // gap, same as before); a tap while stopped just persists the choice
      // for the NEXT play tap to pick up (playScale's opts.bpm, above).
      var speedBtn = elPlayer.querySelector('[data-speedtoggle]');
      if (speedBtn) {
        speedBtn.onclick = function () {
          var i = TEMPO_ORDER.indexOf(tempo);
          tempo = TEMPO_ORDER[(i + 1) % TEMPO_ORDER.length];
          writeTempo(tempo);
          speedBtn.textContent = TEMPO_LABEL[tempo];
          if (studioSound && typeof studioSound.setTempo === 'function') studioSound.setTempo(TEMPO_BPM[tempo]);
        };
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
        var isBluesKey = (th.scaleMode === 'blues');
        var famInfo = (C && C.modeInfo) ? C.modeInfo(th.scaleMode) : null;
        var keyFam = famInfo ? famInfo.family : null;
        var CHIPS = [
          { id: 'mode', label: th.label },
          { id: 'pentMajor', label: 'Pent major' },
          { id: 'pentMinor', label: 'Pent minor' }
        ];
        // S-SOLO-MODES (music-theory-coach, 2026-07-10): surface the two common non-diatonic
        // MODE colors as context chips, deduped against the key's own mode (if the key IS
        // mixolydian/dorian its 'mode' chip already IS that scale). Mixolydian only over a
        // MAJOR-family key (its major 3rd clashes a minor tonic); Dorian over either family
        // (the raised-6 brightening). Neither on a Blues key (its own scale is blues).
        if (!isBluesKey) {
          if (keyFam === 'major' && th.scaleMode !== 'mixolydian') CHIPS.push({ id: 'mixolydian', label: 'Mixolydian' });
          if (th.scaleMode !== 'dorian') CHIPS.push({ id: 'dorian', label: 'Dorian' });
        }
        CHIPS.push({ id: 'blues', label: 'Blues' });
        // M-GUIDE W2: when the mode chip ITSELF is already Blues (th.scaleMode ===
        // 'blues'), the standalone 'blues' chip would just re-select the same
        // bundle under a redundant second button - drop it.
        if (isBluesKey) CHIPS = CHIPS.filter(function (c) { return c.id !== 'blues'; });
        // S-SOLO-SCALE-DEFAULT (music-theory-coach, 2026-07-10): pre-select the theory-best
        // solo scale for the incoming key AND the actual progression shape (see
        // inferSoloDefault). Guard the result to a chip actually offered for this key, so a
        // deduped mode (e.g. inference returns 'mixolydian' on an already-mixolydian key)
        // falls back to a real chip rather than highlighting nothing.
        // G6 S-SCALE-MEMORY (2026-07-10): chipIds now computed BEFORE curId so a
        // remembered choice can be validated against the actually-offered chips for
        // THIS key before falling back to inferSoloDefault - a remembered scaleId
        // that's no longer offered (e.g. the key's own mode changed) still falls
        // through to inference exactly like an inference-produced mismatch does below.
        var chipIds = CHIPS.map(function (c) { return c.id; });
        var storedScaleId = readSoloScaleFor(t);
        var curId = (storedScaleId != null && chipIds.indexOf(storedScaleId) >= 0)
          ? storedScaleId
          : inferSoloDefault(t.key, t.mode, t.seq);
        if (chipIds.indexOf(curId) < 0) {
          curId = chipIds.indexOf('pentMajor') >= 0 ? 'pentMajor'
            : chipIds.indexOf('pentMinor') >= 0 ? 'pentMinor' : 'mode';
        }
        function render() {
          chipsEl.innerHTML = CHIPS.map(function (c) {
            return '<button class="bt-st-scalechip' + (curId === c.id ? ' on' : '') + '" data-scaleid="' + esc(c.id) + '" type="button">'
              + esc(c.label) + '</button>';
          }).join('');
          Array.prototype.forEach.call(chipsEl.querySelectorAll('.bt-st-scalechip'), function (b) {
            // G6: a chip TAP persists the choice (persist=true); the synthetic
            // select() call below (the initial default landing) passes no 2nd
            // arg, so opening the Studio never writes an inferred default as if
            // it were a deliberate pick.
            b.onclick = function () { select(b.getAttribute('data-scaleid'), true); };
          });
        }
        function select(scaleId, persist) {
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
          if (persist) writeSoloScaleFor(t, scaleId);
          render();
          if (notesLineEl) notesLineEl.innerHTML = renderNoteTokens(bundle.notes);
          // G5 S-WHYNOTE-SCALE: the whynote banner (if it won its slot and is
          // still on-screen) re-derives its TEXT for the now-selected scale -
          // same element, same dismiss wiring, just a textContent swap on the
          // existing .notableBanner-body node (never a re-render/re-claim).
          // wnEl closes over openStudio's scope (var-hoisted); it is null when
          // the banner never rendered (dismissed forever, level-ineligible, or
          // preempted by a higher-priority notable) - guarded below.
          if (wnEl) {
            var wnBodyEl = wnEl.querySelector('.notableBanner-body');
            if (wnBodyEl) wnBodyEl.textContent = whynoteScaleText(th.key, scaleId, th.scaleMode, th.label);
          }
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
          // renderFretboard() is the ONE fretboard render choke point - the
          // initial render and every chip switch both call it.
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
        // S-SOLO-SCALE-DEFAULT: when the theory-best default is a pentatonic (not
        // 'mode'), do a full select() so the fretboard/notes/guide render that scale
        // too - not just the chip highlight. 'mode'/blues keep the already-rendered
        // fretboard (line ~1289 renderFretboard(th,'mode')), so a bare render() there.
        if (curId !== 'mode') select(curId); else render();
      })();
      // F19 (operator UAT 2026-07-05): name-only chip row - no chord
      // diagrams, no roman numerals ("like others", e.g. the scale-chip row
      // above). Hand-rolled instead of KeyExplorer.renderChords: that
      // helper's cell+diagram+roman shape doesn't fit a flat chip; Compose's
      // OWN use of renderChords (songbook.js) is untouched. Tap still plays
      // the chord (pack.playChord) AND toggles the fretboard chord-tone
      // target (toggleTarget) - only the visual weight changed.
      (function renderChordChips() {
        var chordsEl = elPlayer.querySelector('[data-chords]');
        if (!chordsEl || !th.chords) return;
        chordsEl.innerHTML = th.chords.map(function (it) {
          return '<button class="bt-st-chordchip" data-chord="' + esc(it.chord) + '" type="button">' + esc(dispChord(it.chord, th.key, th.scaleMode)) + '</button>';
        }).join('');
        Array.prototype.forEach.call(chordsEl.querySelectorAll('.bt-st-chordchip'), function (d, idx) {
          var c = th.chords[idx].chord;
          d.onclick = function () {
            try { pack.playChord(c); } catch (e) {}
            d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220);
            // M-GUIDE W3a (section 2): one target surface - tap toggles the fretboard
            // chord-tone target in addition to the existing play behavior.
            toggleTarget(c, d);
          };
        });
      })();
      var whyToggle = elPlayer.querySelector('[data-whytoggle]'), whyBox = elPlayer.querySelector('[data-why]');
      whyToggle.onclick = function () {
        var show = whyBox.hidden; whyBox.hidden = !show; whyToggle.classList.toggle('on', show);
        if (show && !whyBox.getAttribute('data-built')) { buildWhy(whyBox, th); whyBox.setAttribute('data-built', '1'); }
      };
      if (guideToggle && guideBox) guideToggle.onclick = function () {
        var show = guideBox.hidden; guideBox.hidden = !show;
        guideToggle.classList.toggle('on', show);
        guideToggle.setAttribute('aria-pressed', show ? 'true' : 'false');
      };
      // F21: same disclosure toggle behavior the old solo-section "Find a
      // jam" button used - collapsed by default, per-open state only (no
      // persistence) - just relocated to the stage (see jamPanelHtml, above).
      // F27 (operator UAT 2026-07-05): the same tap now ALSO reveals the
      // direct-paste box (data-urled-gated) when one applies to this track -
      // one button, one disclosure, instead of a permanently-visible paste
      // box competing with this trigger for the same "get a video" goal.
      var gatedUrled = elPlayer.querySelector('[data-urled-gated]');
      if (jamFindToggle && jamPanel) jamFindToggle.onclick = function () {
        var show = jamPanel.hidden;
        jamPanel.hidden = !show;
        jamFindToggle.classList.toggle('on', show);
        if (gatedUrled) gatedUrled.hidden = !show;
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
      elPlayer.querySelector('.bt-st-back').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else closePlayer(); };
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
      var dia = C.diatonic(state.key, state.scaleMode), nb = C.neighbors(state.key, state.mode);
      // FORK-4 removal: panel note strip + chord labels render key-aware names
      var notes = (C.scaleInKey ? C.scaleInKey : C.scale)(state.key, state.scaleMode), degs = C.scaleDegrees(state.scaleMode);
      dia = dia.map(function (d) { return { roman: d.roman, chord: dispChord(d.chord, state.key, state.scaleMode), root: d.root, quality: d.quality }; });
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
    searchQuery: searchQuery, customSearchQuery: customSearchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl, tintWheel: tintWheel,
    embedUrl: embedUrl, parseYouTubeId: parseYouTubeId, mergeTracks: mergeTracks,
    trackKey: trackKey, applyUrlOverlay: applyUrlOverlay,
    notesToPcs: notesToPcs, normMode: normMode, resolveScaleMode: resolveScaleMode,
    studioTheory: studioTheory, migrateUrls: migrateUrls, keyLabelFor: keyLabelFor, mount: mount,
    whynoteText: whynoteText, whynoteBanner: whynoteBanner,
    // G5 S-WHYNOTE-SCALE: re-derives the whynote copy for a tapped scale chip.
    whynoteScaleText: whynoteScaleText,
    // M-GUIDANCE (advanced tier): scaletipText/scaletipBanner mirror
    // whynoteText/whynoteBanner's export shape exactly.
    scaletipText: scaletipText, scaletipBanner: scaletipBanner,
    // S-PERSONA-COPY: beginner Studio orientation tip - same export shape.
    studioFirstText: studioFirstText, studioFirstBanner: studioFirstBanner,
    // S-BLUES: solo-layer-only scale-chip swap (see the block above studioTheory).
    soloBundle: soloBundle,
    // S-SOLO-SCALE-DEFAULT: progression-aware theory-best default scale (key+mode+seq ->
    // scaleId). Exported for direct unit tests independent of the Studio DOM.
    inferSoloDefault: inferSoloDefault,
    // G6 S-SCALE-MEMORY: per-track solo-scale chip persistence (trackKey -> scaleId).
    readSoloScaleFor: readSoloScaleFor, writeSoloScaleFor: writeSoloScaleFor,
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
