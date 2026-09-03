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
  var adLikelyOpen = TM.adLikelyOpen;

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
    'modal jam track in d dorian|search|D|major': 'modal jam track in d dorian|search|D|dorian',
    // The 14 playlist-baked tracks shipped one release with artist '' before the
    // artist enrichment landed - urls saved against the empty-artist identity
    // re-key to the enriched one. (Key segment is normRoot output: Eb -> D#.)
    'time jam - pink floyd style||F#|minor': 'time jam - pink floyd style|now you shred backing tracks|F#|minor',
    'guitar backing track in c major - pop style||C|major': 'guitar backing track in c major - pop style|pier gonella jam|C|major',
    'guitar backing track in g major - pop style||G|major': 'guitar backing track in g major - pop style|pier gonella jam|G|major',
    'rock pop backing track g major 70 bpm||G|major': 'rock pop backing track g major 70 bpm|tguitar|G|major',
    'funky jam backing track [fm]||F|minor': 'funky jam backing track [fm]|instrumental avenue|F|minor',
    'pop rock acoustic ballad in g 66bpm||G|major': 'pop rock acoustic ballad in g 66bpm|jam tracks galaxy|G|major',
    'slow rock ballad in c/am 64bpm||C|major': 'slow rock ballad in c/am 64bpm|jam tracks galaxy|C|major',
    'peaceful mellow in e minor||E|minor': 'peaceful mellow in e minor|jam\'in backing tracks|E|minor',
    'funky blues in c - john mayer style||C|blues': 'funky blues in c - john mayer style|freddie edwards|C|blues',
    'blues in f (jazz)||F|blues': 'blues in f (jazz)|guitare improvisation|F|blues',
    'rock pop backing track f major 70 bpm||F|major': 'rock pop backing track f major 70 bpm|tguitar|F|major',
    'ii-v-i jazz play-along - f major||F|major': 'ii-v-i jazz play-along - f major|backing tracks channel|F|major',
    'jazz blues backing track - eb 120bpm||D#|blues': 'jazz blues backing track - eb 120bpm|benys backing tracks|D#|blues',
    'blues in e 90bpm||E|blues': 'blues in e 90bpm|guitare improvisation|E|blues'
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
  // Solid SVG media glyphs for the now-playing bar transport (UAT 2026-08-09:
  // the Unicode text glyphs rendered as thin, spread-apart hairlines pinned to
  // the box edges - &#10072; is literally named LIGHT VERTICAL BAR, and two
  // separate characters put the spacing at the font's mercy). Filled paths on
  // the Material 24-grid, centered, tight. ONE constant per icon so the pp
  // state swaps and the markup builder can never drift apart.
  var ICON_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="2.6" height="14" rx="1"/><path d="M19 5v14l-9.5-7z"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="16.4" y="5" width="2.6" height="14" rx="1"/><path d="M5 5v14l9.5-7z"/></svg>';
  // Shuffle: CURVED crossing arrows (UAT 2026-08-09 round 3 - the straight
  // feather crossing read as an X, not the standard music-player shuffle).
  // Two S-curves crossing at center, chevron arrowheads at the right ends.
  var ICON_SHUFFLE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M3 6 C7.5 6 9.8 8.2 12 12 C14.2 15.8 16.5 18 21 18"/>'
    + '<path d="M3 18 C7.5 18 9.8 15.8 12 12 C14.2 8.2 16.5 6 21 6"/>'
    + '<polyline points="17.5 14.5 21 18 17.5 21.5"/>'
    + '<polyline points="17.5 2.5 21 6 17.5 9.5"/></svg>';
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
    // Eagerly resumes the WebAudio context the instant a finger LANDS
    // anywhere on the player/Studio overlay (pointerdown), rather than
    // waiting for the click on a chord chip that actually schedules the
    // note - see ChordAudio.primeNow()'s header comment in audio.js. elPlayer
    // is created once and reused for both the bare player and the Studio (its
    // innerHTML is replaced per open), so one delegated listener here covers
    // every Studio open without being re-wired per chord chip. Idempotent /
    // cheap (a no-op once already running), harmless on the plain-player path
    // too (no chords there, so it just never has anything to warm for).
    if (window.ChordAudio) elPlayer.addEventListener('pointerdown', function () { window.ChordAudio.primeNow(); }, { passive: true });

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
    // Audio-focus keep-warm (immediate chord taps): true only while the
    // STUDIO (not the bare video player) is the one open - set in openStudio,
    // cleared here. Tracked locally (not just ChordAudio.isWarm()) so
    // closePlayer - shared by both the plain player and the Studio - only
    // releases when IT was the one that actually kept the context warm.
    var studioAudioWarm = false;
    // Backgrounding the tab zeroes ChordAudio's refcount outright. Without
    // this, studioAudioWarm stayed true, so returning to the foreground left
    // the open Studio believing it held a warm context it no longer had -
    // and closePlayer() then released against a zeroed count (volley-1 high).
    if (window.ChordAudio && window.ChordAudio.onHardRelease) {
      window.ChordAudio.onHardRelease(function () { studioAudioWarm = false; });
    }
    function closePlayer() {
      if (global.Sound) global.Sound.stopAll();
      studioSound = null;
      if (studioAudioWarm && window.ChordAudio) window.ChordAudio.releaseWarm();
      studioAudioWarm = false;
      elPlayer.classList.remove('on'); elPlayer.classList.remove('studio'); elPlayer.classList.remove('vidopen'); elPlayer.classList.remove('vidhid'); elPlayer._setVid = null; elPlayer.innerHTML = '';
      exitMini();
      if (nowPlaying) lastStopAt = Date.now(); // round 17: a real stop starts the idle clock
      nowPlaying = null; userPaused = false;
      // UAT batch 7: clear the Media Session so no stale lock-screen card
      // outlives the player.
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } catch (e) {}
      }
      dispatchNowPlaying();
    }

    /* ---- global mini-player (PLAYER-FEEL): playback survives Studio close ----
     * The Studio overlay gains a SECOND collapse level on elPlayer itself:
     * .bt-player.mini re-lays the merged header strip as a persistent bottom
     * bar (title + play/pause + progress + x) while the iframe stays mounted
     * (clipped, still audible - the same never-remove contract as
     * .bt-st-media.min). Dismissing a video-backed Studio MINIMIZES it
     * (dismissStudio below replaces closePlayer as the NavHistory close fn);
     * the bar's x is the real teardown. No DOM is rebuilt or reparented on
     * minimize/expand - the one Studio DOM just changes shape via CSS. */
    var nowPlaying = null;   // the track whose iframe is mounted (yt-backed Studio opens only)
    // ROUND 17 ad-likelihood signals (operator UAT 2026-09-02: "can we detect not
    // playing anything -> playing (first load or idle time) and show the yt video -
    // most likely to have ads. not between every song tho"). A YouTube pre-roll
    // fires when a session STARTS, not on every track, so the video shows itself
    // exactly there and stays out of the way song-to-song.
    var hasPlayedThisLoad = false;  // has any yt-backed Studio opened since page load
    var lastStopAt = 0;             // when playback last really STOPPED (closePlayer)
    var vidState = null;            // last video state (theater|pip|hid) - carried across an open
    var VID_IDLE_MS = 10 * 60 * 1000; // "came back to it" gap. Judgment call, not measured - one constant to tune.
    var userPaused = false;  // last user pp intent - honest state; YT never reports under blocked egress
    // PLAYER-FEEL v6: prev/next/auto-advance walk the current view's playable
    // pool - songbook owns the pool (opts.advance -> playNeighbor), the player
    // owns the trigger (buttons + track-end detection in wireNowPlaying).
    var advanceCb = opts.advance || null;
    // Shuffle is a persisted player mode (additive localStorage key - defensive
    // read, no schema impact). The topbar button reflects it (.on/aria-pressed).
    var shuffleOn = false;
    try { shuffleOn = localStorage.getItem('music.shuffle.v1') === '1'; } catch (e) {}
    function setShuffle(on) {
      shuffleOn = !!on;
      try { localStorage.setItem('music.shuffle.v1', shuffleOn ? '1' : '0'); } catch (e) {}
      var b = elPlayer.querySelector('[data-shuffle]');
      if (b) { b.classList.toggle('on', shuffleOn); b.setAttribute('aria-pressed', shuffleOn ? 'true' : 'false'); }
    }
    function dispatchNowPlaying() {
      // UAT batch 4: the bar's live-state classes ride the SAME dispatch that
      // feeds the rows, so bar and rows can never disagree. npLive gates the
      // accent pop + equalizer (a videoless Studio's bar stays quiet - nothing
      // is playing); npPaused freezes the bar equalizer exactly like a row's
      // isPaused.
      elPlayer.classList.toggle('npLive', !!nowPlaying);
      elPlayer.classList.toggle('npPaused', !!(nowPlaying && userPaused));
      // UAT batch 5: body.studioopen = "the SHEET is expanded" - songbook.css
      // z-raises the tabbar above the full-inset sheet off this class. Every
      // sheet transition (open/expand/minimize/close, video or not) funnels
      // through this dispatch, so the class can never go stale.
      document.body.classList.toggle('studioopen',
        elPlayer.classList.contains('on') && elPlayer.classList.contains('studio') && !elPlayer.classList.contains('mini'));
      // UAT batch 7: mirror the honest play-state into the Media Session so a
      // lock-screen/notification card (when the OS surfaces one) shows the
      // right toggle.
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = nowPlaying ? (userPaused ? 'paused' : 'playing') : 'none'; } catch (e) {}
      }
      refreshMarquee();
      try {
        document.dispatchEvent(new CustomEvent('music:nowplaying', {
          detail: nowPlaying ? { key: trackKey(nowPlaying), paused: userPaused } : { key: null, paused: false }
        }));
      } catch (e) { /* CustomEvent guaranteed on every target browser; belt only */ }
    }
    // UAT batch 4 -> 5 ("scroll... slowly left only and wrap around like music
    // players marquee"): when the bar title overflows its box, LOOP it - a
    // second copy of the title (.bt-st-tx2, 48px wrap gap) is appended and the
    // pair slides left by exactly one copy+gap (CSS, linear infinite), so the
    // wrap point is seamless. Re-measured on every dispatch + setVid (the
    // vidopen strip swap changes the title's share of the bar) + resize;
    // the reset drops the clone first so the measure is the natural
    // single-copy overflow. Reduced-motion: static ellipsis (CSS hides the
    // clone and the animation).
    function refreshMarquee() {
      var tEl = elPlayer.querySelector('.bt-st-t');
      if (!tEl || !tEl.isConnected) return;
      var tx = tEl.querySelector('.bt-st-tx');
      if (!tx) return;
      var old = tx.querySelector('.bt-st-tx2');
      if (old) old.remove();
      tEl.classList.remove('mq');
      var w = tx.scrollWidth; // single-copy width
      if (w - tEl.clientWidth > 4) {
        var c = document.createElement('span');
        c.className = 'bt-st-tx2';
        c.setAttribute('aria-hidden', 'true');
        c.textContent = tx.textContent;
        tx.appendChild(c);
        tEl.style.setProperty('--mq', '-' + (w + 48) + 'px'); // one copy + the wrap gap
        tEl.style.setProperty('--mqd', Math.max(8, Math.round((w + 48) / 22)) + 's'); // ~22px/s, slow
        tEl.classList.add('mq');
      } else {
        tEl.style.removeProperty('--mq');
        tEl.style.removeProperty('--mqd');
      }
    }
    global.addEventListener('resize', function () { refreshMarquee(); });
    function exitMini() {
      elPlayer.classList.remove('mini');
      document.body.classList.remove('miniplayer');
      elPlayer.onclick = null;
    }
    // Round 15 (operator purpose statement: "to be able to skip when needed
    // and not show the video any other time"): PARKED is the only default -
    // every open starts hidden, and the video layer is screen-independent
    // (round 12), so studio-minimize no longer touches it. The old
    // session-sticky preference dissolved into that one law.
    function minimizeStudio() {
      if (!nowPlaying) { closePlayer(); return; }
      if (global.Sound) global.Sound.stopAll();       // synth audition stops; the YT iframe keeps playing
      studioSound = null;
      if (studioAudioWarm && window.ChordAudio) window.ChordAudio.releaseWarm();
      studioAudioWarm = false;
      elPlayer.classList.add('mini');
      document.body.classList.add('miniplayer');
      // Bar-body tap expands back to the full Studio; the pp button and the x
      // keep their own handlers (excluded here so a control tap never expands).
      // Round 11/12: the LEFT zone (eq + title/meta) is the PIP toggle and the
      // PIP's own taps are video-layer acts - both stop propagation, so what
      // reaches here is the remaining bar body, which still expands. The
      // designed Studio door for a video track is the row's details chip
      // (openStudio is idempotent for the playing track - it expands, never
      // rebuilds).
      elPlayer.onclick = function (e) {
        if (!elPlayer.classList.contains('mini')) return;
        if (e.target.closest('[data-nppp],[data-minix],[data-npprog],[data-npprev],[data-npnext],[data-piphide]')) return;
        expandStudio();
      };
      dispatchNowPlaying();
    }
    function expandStudio() {
      exitMini();
      if (window.NavHistory) window.NavHistory.open('studio', dismissStudio);
      dispatchNowPlaying();
    }
    // The registered close fn for a Studio open: a video-backed Studio
    // minimizes on back/dismiss (playback survives); a videoless Studio closes
    // fully as before. The history slot pops either way - the mini bar is
    // non-modal and re-registers a slot only on expand.
    function dismissStudio() {
      if (nowPlaying && elPlayer.classList.contains('studio')) minimizeStudio();
      else closePlayer();
    }
    // Controller-facing transport: routes through the strip's real pp button so
    // icon, paused-intent, and the nowplaying event stay in one code path.
    function togglePlayCtl() {
      var b = elPlayer.querySelector('[data-nppp]');
      if (b) b.click();
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
    function buildWhy(box, th, bundle) {
      var C = global.Circle;
      // Bug #6: the notes STRIP + caption reflect the CURRENTLY selected solo
      // scale (bundle), not the frozen key-mode (th). Without this the strip
      // stayed on the key's home mode when you tapped Pent minor / Blues / etc.
      // The circle WHEEL below stays keyed to the track's KEY center (th) - the
      // solo-scale choice doesn't move the key on the circle of fifths. Falls
      // back to th when no bundle is passed (the mode default before any tap).
      var notes = (bundle && bundle.notes) || th.notes;
      var degrees = (bundle && bundle.degrees) || th.degrees;
      var strip = notes.map(function (n, i) {
        return '<div class="cofDeg"><span class="nt">' + esc(n) + '</span><span class="dg">' + esc(degrees[i]) + '</span></div>';
      }).join('');
      // player-facing scale name: a selected solo scale reads as its own label
      // ("minor pentatonic", "blues"); the mode default reads "minor"/"major"
      // (nicer than "Aeolian") or its own modal name ("A dorian").
      var keyName = (bundle && bundle.label && bundle.label !== th.label)
        ? bundle.label.toLowerCase()
        : (th.scaleMode === 'aeolian' ? 'minor' : th.scaleMode === 'ionian' ? 'major' : th.label.toLowerCase());
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
    // G4 jam-starter resolution + row markup, shared by openStudio's render
    // and the late fill below (the catalog loads async - see injectJamStarterLate).
    function resolveJamStarter(th) {
      var jamStarterRows = filterTracks(state.tracks, 'all', th.key, normMode(th.scaleMode));
      return jamStarterRows.filter(function (r) { return r.rank === 0 && r.track.yt; })[0] || null;
    }
    function jamStarterRowHtml(cand) {
      var g = cand.track.genre ? esc(cand.track.genre) + ' jam' : 'jam';
      return '<div class="bt-st-addvidrow"><button class="bt-jam-starter" data-jamstarter type="button">'
        + 'Play a ' + g + ' in ' + esc(keyLabelFor(cand.track.key, cand.track.mode))
        + '</button></div>';
    }
    // G4 late fill: a no-video Studio opened BEFORE the tracks.json fetch
    // resolved rendered without the starter chip (state.tracks was [] at
    // openStudio time - the deep-link/fast-open race soloOver already
    // documents), and openStudio's idempotent-open guard blocks a plain
    // re-open (same trackKey, same null yt). Patch the standing DOM instead:
    // resolve now, insert the row above the Find-a-jam row, wire through the
    // same activate() path the render-time button uses.
    function injectJamStarterLate() {
      if (!nowPlaying || nowPlaying.yt) return;
      if (!elPlayer.classList.contains('studio')) return;
      if (elPlayer.querySelector('[data-jamstarter]')) return;
      var findBtn = elPlayer.querySelector('[data-jamfindtoggle]');
      if (!findBtn || !findBtn.parentNode || !findBtn.parentNode.parentNode) return;
      var th = studioTheory(nowPlaying.key, nowPlaying.mode);
      if (!th) return;
      var cand = resolveJamStarter(th);
      if (!cand) return;
      var holder = document.createElement('div');
      holder.innerHTML = jamStarterRowHtml(cand);
      var row = holder.firstChild;
      var btn = row.querySelector('[data-jamstarter]');
      if (btn) btn.onclick = function () { activate(cand.track); };
      findBtn.parentNode.parentNode.insertBefore(row, findBtn.parentNode);
    }
    function openStudio(t, o) {
      // o.startMini (PLAYER-FEEL): build + wire the full Studio, then minimize
      // to the bottom bar in the same call - the play-from-row path starts
      // playback (autoplay=1 rides the row-tap's user activation) without
      // covering the list. Any open first leaves a previous mini state.
      o = o || {};
      // UAT batch 4 (idempotent open): opening the track that is ALREADY the
      // now-playing Studio must not rebuild the DOM - a rebuild remounts the
      // iframe and restarts the audio. The details path (row lead chip /
      // openRepertoireItem) just EXPANDS the existing Studio instead. Same yt
      // required: the curated-url save path re-opens the same trackKey with a
      // NEW video id and genuinely needs the rebuild.
      if (nowPlaying && t && elPlayer.classList.contains('studio')
          && trackKey(t) === trackKey(nowPlaying) && (t.yt || null) === (nowPlaying.yt || null)) {
        if (!o.startMini && elPlayer.classList.contains('mini')) expandStudio();
        return;
      }
      exitMini();
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
      // Past this point the Studio (with its playable chord chips + fretboard)
      // is definitely opening - hold the audio engine warm for as long as it
      // stays open, so every chord tap is immediate (see keepWarm() in
      // audio.js). closePlayer() (above) releases it.
      // Guarded: openStudio() is re-entered IN PLACE (save/clear a URL, add a
      // video - see the rerender paths below) without closePlayer() running
      // in between, so an unguarded keepWarm() incremented a refcount only
      // one closePlayer() would ever release. That leak pinned audio focus
      // (background music stays paused) until a reload (volley-1 high).
      if (window.ChordAudio && !studioAudioWarm) { window.ChordAudio.keepWarm(); studioAudioWarm = true; }
      // Mode-honest key label: "A" (ionian), "Am" (aeolian), "A dorian" /
      // "G mixolydian" (modal). th.label is the mode name from circle.js. Plain
      // (unescaped) form kept alongside for the M-GUIDE W3a target caption's
      // textContent - keyLabel (escaped) still feeds the innerHTML meta line.
      // S-COF-INTERACTIVE: keyLabel/meta are recomputed on a circle retune
      // (retuneTo, below), so their derivation lives in helpers keyed to the
      // LIVE bundle, not a one-shot. dispKey/keyLabelPlain/keyLabel stay derived
      // per-bundle; only bpm/genre come from the (unchanging) track t.
      function keyLabelPlainFor(b) {
        var dk = dispKeyRoot(b.key, b.scaleMode); // FORK-4 removal: display name
        return b.scaleMode === 'ionian' ? dk
          : b.scaleMode === 'aeolian' ? dk + 'm'
          : (dk + ' ' + b.label.toLowerCase());
      }
      function metaFor(b) {
        return [esc(keyLabelPlainFor(b)), t.bpm ? t.bpm + ' bpm' : '', esc(t.genre || '')]
          .filter(Boolean).join(' · ');
      }
      var meta = metaFor(th);
      // M-GUIDE W3a (section 2/3): chord-tone targeting + per-scale guidance card
      // state, scoped to this Studio open. scaleBoxWrap is the live boxWrap
      // returned by KeyExplorer.renderScale - toggling a target calls its
      // setTones() (preserves the position-walk); switching a solo-scale chip
      // does a full renderScale() and replaces this reference. curBundle/curScaleId
      // track whichever solo bundle is currently on-screen (the "mode" bundle = th
      // itself, or a soloBundle() chip-swap result) so a chord-target toggle can
      // re-derive tones against the RIGHT scale.
      var scaleBoxWrap = null, activeTargetChord = null, curBundle = th, curScaleId = 'mode';
      // S-COF-INTERACTIVE: the song's own key center, captured before any circle
      // retune, so "back to song key" restores exactly. soloKey/soloMode track
      // whichever key the theory surfaces currently render - the SONG's on open,
      // an EXPLORED key after a wheel tap (retuneTo). The scale-chip machinery
      // reads soloKey/soloMode (not t.key/t.mode directly) so its bundles follow
      // the explored key too; on the song key they are exactly t.key/t.mode.
      var songRoot = th.key, songScaleMode = th.scaleMode;
      var soloKey = t.key, soloMode = t.mode;
      // M-TRACKLIB wave 1: jam-discovery panel selection state - per-open only
      // (no persistence, matching the Guide/scale-chip pattern). jamFeel
      // persists across scale-chip switches (a "slow" preference likely
      // holds across modes).
      //
      // M-JAM-MULTI (2026-09-01): jamGenres is a MULTI-SELECT array (was a
      // single jamGenre string) - a genre chip tap TOGGLES membership so
      // several genres can compose into one search phrase ("smooth jazz funk
      // backing track"). null is the "never rendered yet" sentinel;
      // renderJamPanel below both seeds it on first render and re-filters it
      // on every scale-chip switch: selections that no longer exist in the
      // new scale's list are dropped, keeping whatever intersection survives
      // (or falling back to that scale's own first genre when nothing does).
      // At least one genre stays selected at all times - the toggle handler
      // refuses to remove the last one, so the query builder always has a
      // genre term.
      var jamGenres = null, jamFeel = 'mid';
      // UAT 2026-08-08: until the user touches a genre/feel chip, the jam
      // panel's search targets THIS SONG by name ("<title> <artist> backing
      // track") - the generic key/genre query lost the song identity ("YouTube
      // search term misses the song name"). First chip tap switches to the
      // generic explorer query (that is what the chips are for).
      var jamTouched = false;
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
        // First-ever render seeds a single-genre selection from this scale's
        // own first genre. A scale-chip switch re-filters the CURRENT
        // selection down to whatever still exists in the new list (a stale
        // selection would silently point at a genre the current scale never
        // offered) - keep the surviving intersection, or fall back to the
        // scale's own first genre when nothing survives.
        if (jamGenres == null) {
          jamGenres = [genres[0]];
        } else {
          var keptGenres = jamGenres.filter(function (g) { return genres.indexOf(g) >= 0; });
          jamGenres = keptGenres.length ? keptGenres : [genres[0]];
        }
        var feelBands = JQ.feels();
        // Song-first default (UAT 2026-08-08): a titled track searches for its
        // OWN backing track until a chip is tapped; 'search' is the url-less
        // artist sentinel, never a real name.
        var songQuery = t.title
          ? t.title + (t.artist && t.artist !== 'search' ? ' ' + t.artist : '') + ' backing track'
          : null;
        var query = (!jamTouched && songQuery)
          ? songQuery
          : JQ.jamQuery(dispKeyRoot(th.key, th.scaleMode), scaleKey, jamGenres, jamFeel);
        jamPanel.innerHTML =
          '<div class="bt-st-jamchips bt-st-jamchips-scroll" data-jamgenres>' + genres.map(function (g) {
            return '<button class="chip' + (jamGenres.indexOf(g) >= 0 ? ' on' : '') + '" data-jamgenre="' + esc(g) + '" type="button">' + esc(g) + '</button>';
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
          b.onclick = function () {
            jamTouched = true;
            var g = b.getAttribute('data-jamgenre');
            var idx = jamGenres.indexOf(g);
            if (idx >= 0) {
              // Toggle off - but the last selected chip can't untoggle to
              // empty (min 1 selected, so the query builder always has a
              // genre term). Re-tapping the sole selection is a no-op.
              if (jamGenres.length > 1) jamGenres.splice(idx, 1);
            } else {
              jamGenres.push(g);
            }
            renderJamPanel(scaleId);
          };
        });
        Array.prototype.forEach.call(jamPanel.querySelectorAll('[data-jamfeel]'), function (b) {
          b.onclick = function () { jamTouched = true; jamFeel = b.getAttribute('data-jamfeel'); renderJamPanel(scaleId); };
        });
        var jamAddBtn = jamPanel.querySelector('[data-jamadd]');
        if (jamAddBtn) jamAddBtn.onclick = function () {
          opts.onEditRequest({
            key: th.key, mode: SCALEMODE_TO_FORMMODE[th.scaleMode] || 'major',
            title: '', artist: '', genre: jamGenres.length > 1 ? jamGenres.join(' / ') : jamGenres[0], yt: null
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
      // G4 S-JAM-STARTER (2026-09-01): the no-video empty state used to have NO
      // tappable action of its own - "Find a jam" only OPENS the genre/feel
      // disclosure (F21 above), so a beginner still has to pick a genre, pick a
      // feel, then leave the app to search YouTube before anything plays. This
      // resolves ONE curated, already-playable candidate for the CURRENT key
      // up front, via the SAME resolution the finder's own result cards use
      // (filterTracks -> rank 0 = "your key", tracks-model.js) so "does this
      // track fit my key" is answered in exactly one place, never duplicated.
      // Deterministic: filterTracks's rank sort plus a stable Array#sort keeps
      // ties in tracks.json's own catalog order - no randomness. Any genre is
      // eligible (a beginner in, say, Eb minor has few tracks to choose from;
      // narrowing by genre too would starve the chip for most keys), and only
      // a track that ALREADY has a real video (r.track.yt) counts - the whole
      // point is a jam that plays on this one tap, not another search.
      // Resolved only for the no-video state (the chip can never render when
      // t.yt is set - don't pay the catalog filter/sort on every has-video
      // re-entry of openStudio). Label reads off the CANDIDATE track itself:
      // its own genre ("Play a jam in C" when blank - never "jam jam") and its
      // own key/mode - a blues/modal theory key coarsens to a major/minor
      // family match (normMode), so labeling the chip with th's "C blues"
      // would promise a specificity the resolution doesn't perform.
      var jamStarterCandidate = t.yt ? null : resolveJamStarter(th);
      var jamStarterHtml = jamStarterCandidate ? jamStarterRowHtml(jamStarterCandidate) : '';
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
      //
      // S-STUDIO-FLYOUT (operator device-test 2026-07-25): urlEditor is computed
      // BEFORE playerBlock now so the video-track header can fold the Curated-URL
      // card INTO the `...` fly-out menu (see playerBlock's t.yt branch). For a
      // VIDEO track it renders inside the menu; for a no-video track it stays at
      // its old spot below the stage. The DOM/data-* attrs are unchanged so every
      // existing handler (data-urled/-gated, data-vidin/-save) still binds.
      var urlEditor = t.custom
        ? (t.yt
          // The has-video custom Edit lives in the fly-out menu (data-editrequest);
          // no separate url-editor card for the has-video custom case.
          ? ''
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
      // S-STUDIO-HEADERMERGE (operator UAT 2026-07-27): the pinned header row and
      // the now-playing strip named the SAME track on two stacked rows, eating the
      // vertical space that kept the circle crown + fretboard + chords from all
      // fitting above the fold on a phone. They MERGE into one header row:
      //   [back] [title/key] [play/pause] [progress] [time] [hamburger]   (video)
      //   [back] [title/key] [Optional] [hamburger]                       (no video)
      // headStrip holds the strip's controls, concatenated INTO .bt-st-head (which
      // is now position:relative so the .bt-st-menu fly-out still anchors under it -
      // see tracks.css). The video iframe + countdown drop to mediaBlock, rendered
      // BELOW the merged header. Same data-* attrs, so wireNowPlaying/wireStudioMenu
      // bind unchanged - only the DOM location moved (relocation, not rebuild).
      //
      // S-STUDIO-FLYOUT (operator device-test 2026-07-25): the compact overflow
      // trigger opens a fly-out menu (.bt-st-menu) holding Show/Hide video, Find
      // another jam, Edit, and the Curated-URL card as full-width rows - same
      // data-* attrs, so the existing handlers bind unchanged.
      // PLAYER-FEEL v3 (UAT 2026-08-08, "the same now playing element... don't
      // move it"): the transport strip and the sheet chrome SPLIT. The bar
      // (.bt-st-head, below) is ONE SSOT-rendered element - [title/meta]
      // [pp|Hide-video] [progress] [time] [x] - position:fixed in ONE slot
      // above the tabbar in EVERY state; the back + overflow move to a slim
      // .bt-st-topbar at the top of the SHEET (the Spotify grammar: collapse
      // top-left, menu top-right). menuBlock = the overflow trigger + fly-out
      // (anchors under the topbar); barStrip = the bar's transport controls.
      //
      // One-transport-owner (UAT batch 2) still holds: while the video panel
      // is expanded (.vidopen, setVid keeps it honest), YouTube's own controls
      // own play/pause - the bar's pp/progress/time hide behind the Hide-video
      // CTA. The pp stays in the DOM while hidden, so togglePlay()'s
      // programmatic .click() route works in every state.
      var barStrip = t.yt
        // UAT 2026-08-09 ("move the shuffle button into the now playing"):
        // shuffle LEADS the transport cluster on the ONE bar (the Spotify
        // order: shuffle-prev-play-next), so it rides in mini AND expanded.
        // Standard crossed-arrows glyph (inline SVG, the app's stroke-icon
        // pattern) replaces the old &#8646; text glyph.
        ? '<button class="bt-st-np-shuf' + (shuffleOn ? ' on' : '') + '" data-shuffle type="button" aria-label="Shuffle" aria-pressed="' + (shuffleOn ? 'true' : 'false') + '">' + ICON_SHUFFLE + '</button>'
          // Round 11 ("remove the minimize button from the now playing
          // element"): the bar carries NO video CTA in any state - the theater
          // card owns its own minimize handle ([data-thmin], on the card).
          // The bar's shape is finally constant everywhere.
          // UAT batch 6 ("would like next. and back buttons. it's like a music
          // player"): prev/next flank the pp - they walk the current view's
          // playable pool (opts.advance). They stay visible in the vidopen
          // state too (YouTube's own controls can't do playlist-next).
          + '<button class="bt-st-np-step" data-npprev type="button" aria-label="Previous track">' + ICON_PREV + '</button>'
          + '<button class="bt-st-np-pp" data-nppp type="button" aria-label="Pause">' + ICON_PAUSE + '</button>'
          + '<button class="bt-st-np-step" data-npnext type="button" aria-label="Next track">' + ICON_NEXT + '</button>'
        : '';
      // UAT batch 7 ("stack progress bar and time codes to recover horiz
      // space"): progress + time live on their OWN row under the controls, so
      // the title keeps its width beside the transport. Accent-bordered track
      // (batch 6) unchanged; the row hides with the rest of the transport in
      // the vidopen state (CSS).
      var progRow = t.yt
        ? '<div class="bt-st-progrow">'
          + '<div class="bt-st-np-prog" data-npprog role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Playback position"><i data-npfill></i></div>'
          + '<span class="bt-st-np-time" data-nptime></span>'
          + '</div>'
        : '';
      // S-STUDIO-FLYOUT: the hamburger + fly-out menu (Show/Hide video, Find
      // another jam, Edit, Curated-URL card - or the no-video guidance). Now a
      // child of .bt-st-topbar (position:relative) so the panel anchors under
      // the sheet's top row and drops DOWN over the media/body.
      // S-STUDIO-NOVID: a videoless track is for soloing/exploring - the
      // "Optional" pill stays retired (UAT batch 1); the menu's hint carries
      // the find-a-jam guidance.
      var menuBlock = t.yt
        ? '<button class="iconBtn moreBtn bt-st-np-menu" data-stmenu type="button" aria-haspopup="true" aria-expanded="false" aria-label="More options"><span aria-hidden="true">⋯</span></button>'
          + '<div class="bt-st-menu" data-stmenu-panel hidden role="menu">'
          + '<button class="bt-st-menu-item" data-stcollapse type="button">Collapse player - keeps playing</button>'
          + '<button class="bt-st-menu-item" data-vidtoggle type="button" aria-expanded="true">Minimize video</button>'
          + '<button class="bt-st-menu-item" data-jamfindtoggle type="button">Find another jam</button>'
          + (opts.onEditRequest ? '<button class="bt-st-menu-item" data-editrequest type="button">Edit</button>' : '')
          + urlEditor
          + '</div>'
        // Round 7 (operator UAT 2026-08-09): a videoless track gets NO burger
        // - it held ONE item and sat exactly where the app's Settings gear
        // lives ("the menu takes the settings menu location causing
        // confusion"). The affordance is a slim one-line stage row instead
        // (collapsed by default - most originals will simply never have a
        // video), toggling the same gated paste box + jam panel.
        : '';
      // The video iframe shows on open (see it start), then auto-collapses after a
      // few seconds to audio-only (.bt-st-media.min clips it, never removes it, so
      // audio keeps playing). Countdown caption + the jam panel follow. For a
      // videoless track no static iframe space is reserved - just the jam panel.
      var mediaBlock = t.yt
        ? '<div class="bt-st-media" data-media>'
          // Round 12 ("the pip I can have a button on top to maximize to
          // theater view because clicking the skip after an ad won't be
          // possible in a small pip"): the PIP's visible maximize bar - a top
          // strip mirroring the theater's bottom handle (chevron UP = grow).
          // No handler: its tap bubbles to the media click below, same as a
          // body tap - the button exists to make the affordance visible.
          + '<button class="bt-st-thmax" data-thmax type="button" aria-label="Expand video - the Skip button is tappable in the large view"><span aria-hidden="true">&#8963;</span></button>'
          + '<div class="bt-st-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
          + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
          // Round 11 ("include a button to minimize that is stuck to the PIP
          // overlay"): the theater card's OWN minimize handle - a bottom bar
          // on the card (sheet-handle grammar), shown only in theater (CSS).
          + '<button class="bt-st-thmin" data-thmin type="button" aria-label="Hide video - audio keeps playing"><span aria-hidden="true">&#8964;</span></button>'
          // Round 15: the docked mini video is OPT-IN now - the strip's corner
          // dock chip is its only entry (the theater handle parks outright).
          + '<button class="bt-st-thdock" data-thdock type="button" aria-label="Dock video small"><span aria-hidden="true">&#10064;</span></button>'
          + '</div>'
          // Round 10 ("hide video CTA stuck to left of pip"): the park handle,
          // a slim tab on the PIP's left edge (CSS shows it only while .min).
          + '<button class="bt-st-piphide" data-piphide type="button" aria-label="Hide video - audio keeps playing"><span aria-hidden="true">&#8964;</span></button>'
          // Round 16 (operator UAT 2026-09-02, "don't auto hide yt video. I keep
          // having to open it to skip after ads"): the auto-minimize countdown +
          // its Keep-open / Minimize-now controls are GONE. Nothing hides the
          // video on a timer any more, so there is no window to narrate.
          + jamPanelHtml
        : jamPanelHtml;
      // .bt-st-stage wraps the sheet's top chrome + video: one column in
      // portrait, the left pane in the landscape two-pane split (CSS). Practice
      // content (scale, chords) leads the scrollable body; the url-curation
      // editor sits last - plumbing after the practice.
      // F32 (UI-std UAT): dismiss is the app's STANDARD back affordance (the
      // song view's #backLib "iconBtn ←", leading the SHEET's top row - the
      // Spotify collapse-top-left grammar). Same NavHistory.dismiss() wiring.
      // PLAYER-FEEL v3: the bar (.bt-st-head) renders LAST, as a direct child
      // of .bt-studio - it is position:fixed (one slot above the tabbar in
      // every state), so DOM order is for the mini CSS (hide the sheet, keep
      // the bar + clipped media), not layout.
      elPlayer.innerHTML =
        '<div class="bt-studio" role="dialog" aria-label="Practice studio">'
        + '<div class="bt-st-stage">'
        + '<div class="bt-st-topbar"><button class="iconBtn backArrowBtn bt-st-back" type="button" title="Back" aria-label="Back"><span aria-hidden="true">←</span></button>'
        // (Shuffle moved to the now-playing bar's transport cluster - UAT
        // 2026-08-09; the topbar keeps back + the hamburger only.)
        + menuBlock
        + '</div>'
        + mediaBlock
        // Curation lives in the top panel next to Watch-on-YouTube, so when you
        // return to a videoless track the "add a video" control is immediately at
        // hand (was buried below the scale + chords). S-STUDIO-FLYOUT: for a VIDEO
        // track the urlEditor already renders INSIDE the `...` fly-out menu (see
        // playerBlock), so it must NOT render a second time here - only the
        // no-video path keeps the stage-level card.
        + (t.yt ? '' : jamStarterHtml + '<div class="bt-st-addvidrow"><button class="bt-st-addvid" data-jamfindtoggle type="button" aria-expanded="false">' + noVideoLabel + '</button></div>' + urlEditor)
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
        // G4: the app-wide help-icon convention (songbook.css .helpIcon, an
        // (i)-style glyph prefix) replaces the ad-hoc "?" text - one explainer
        // glyph for the whole app instead of a bespoke one just for the Studio.
        // aria-label is unchanged (screen readers never read the visible glyph).
        + '<button class="iconBtn bt-st-guidebtn helpIcon" data-guidetoggle type="button" aria-label="Show the scale guide" aria-pressed="false"></button>'
        // Round 7 ("need to toggle between COF and fretboard, leaving
        // play/tempo always shown"): one theory visual at a time on a phone.
        // The seg rides the pinned controls row; choice persists.
        + '<div class="bt-st-viewseg" data-stviewseg role="tablist" aria-label="Theory view">'
        + '<button data-stview="fret" role="tab" type="button">Fretboard</button>'
        + '<button data-stview="cof" role="tab" type="button">Circle</button>'
        + '</div>'
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
        // F16 (operator UAT 2026-07-05): the Window|Full-neck view toggle is
        // retired - the fretboard always spans frets 0-12 now (see
        // scaleRenderOpts above), so there is nothing left to toggle.
        + '<div class="bt-st-scale" data-scale></div>'
        // S-STUDIO-GUIDEFOLD (operator UAT 2026-07-27): the scale-DESCRIPTION
        // (data-scaleframe) and the fretboard LEGEND (data-legend) used to sit in
        // the always-visible inline flow (between chips and fretboard, and below
        // it), eating the vertical space that kept the chords-in-key below the
        // fold. They now live inside ONE on-demand container (data-guidewrap) with
        // the per-scale mentor card (data-guide), hidden by default and revealed
        // TOGETHER by the `?` guide toggle in the controls row above. So the inline
        // flow is free of them; tapping `?` shows description + legend + guide.
        // Each still re-derives on Studio open + every chip switch (select() writes
        // data-scaleframe, renderLegend writes data-legend, renderGuide writes
        // data-guide) regardless of the wrapper's hidden state, so content is never
        // stale when the toggle opens. data-scaleframe keeps its own [hidden]
        // (framing-text-present) toggle inside the wrapper - no framing == no empty
        // description row even when the wrapper is open.
        + '<div class="bt-st-guidewrap" data-guidewrap hidden>'
        // M-EAR wave 1.6 (U16): the Legend primitive (shared/legend.js) - dot-
        // swatch + label rows. An empty container (Legend.render() returned null)
        // is already invisible; Legend.render()'s element carries its own .legend
        // styling.
        + '<div class="bt-st-scaleframe" data-scaleframe hidden></div>'
        + '<div data-legend></div>'
        // M-GUIDE W3a: the per-scale mentor card (SoloGuide). Re-derives on every
        // chip switch, so the `?` is a cheap re-open affordance (not a one-shot
        // dismiss). No [hidden] here - the wrapper owns the show/hide now.
        + '<div class="bt-st-why" data-guide></div>'
        + '</div>'
        + '</div>'
        // Circle-of-fifths wheel - BELOW the fretboard (operator UAT
        // 2026-08-09; supersedes the v-crown placement). The fretboard is the
        // practice surface you play against while the track runs, so it leads
        // the body with the Play/Speed/? controls; the wheel is orientation
        // reference, consulted between phrases. Rendered wheel-only + eagerly
        // (see renderCofHero below) - the scale-reactive note names live in the
        // "Solo over it" label; the wheel stays keyed to the track's KEY center
        // (unaffected by solo-scale chips), so it never goes stale.
        + '<div class="bt-st-cofhero" data-cofhero></div>'
        // S-COF-INTERACTIVE: "back to song key" reset - shown only while a circle
        // tap has retuned the theory surfaces to an EXPLORED key (hidden on the
        // song's own key). retuneTo toggles its [hidden]; wired once below.
        + '<div class="bt-st-cofreset" data-cofreset hidden><button class="bt-st-cofresetbtn" data-cofresetbtn type="button">back to song key</button></div>'
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
        // "Why these notes?" toggle + its bottom wheel panel are RETIRED - the
        // circle lives above as data-cofhero (below the fretboard since the
        // 2026-08-09 UAT). Only the neck-walk link remains on this row.
        + '<div class="bt-st-linkrow"><a class="hsrMore" href="' + esc(inversionsHref(th)) + '">Neck walk →</a></div>'
        + '</div>'
        // PLAYER-FEEL v3: the ONE now-playing bar - SSOT rendering, identical
        // in mini and expanded (position:fixed above the tabbar, never moves).
        // The x is the real teardown in every state.
        // UAT batch 4: a yt bar leads with the SAME 3-bar equalizer primitive
        // the rows use (.li-eq - one equalizer, Element Consistency), animated
        // while playing / frozen while paused (.npPaused off dispatch), as the
        // "actively playing" signal; the title marquees when it overflows
        // (refreshMarquee below).
        + '<div class="bt-st-head">'
        // UAT batch 7: two stacked rows - controls up top, progress+time below
        // (the title recovers the width the inline prog/time consumed).
        + '<div class="bt-st-barrow">'
        + (t.yt ? '<span class="li-eq bt-st-bareq" aria-hidden="true"><i></i><i></i><i></i></span>' : '')
        + '<div class="bt-st-id"><span class="bt-st-t"><span class="bt-st-tx">' + esc(t.title || '') + '</span></span>'
        + '<span class="bt-st-meta">' + meta + '</span></div>'
        + barStrip
        + '<button class="bt-st-minix" data-minix type="button" aria-label="Close player">&#215;</button>'
        + '</div>'
        + progRow
        + '</div>'
        + '</div>';
      elPlayer.classList.add('on'); elPlayer.classList.add('studio');
      // .vidopen mirrors "the video is in THEATER"; setVid() below is the
      // single authority. Round 16: a video track OPENS on the REMEMBERED
      // choice, visible by default (the wiring's final setVid(readVidPref(),
      // true) sets the real state) - this class is cleared here so the render
      // never asserts a state setVid has not resolved yet.
      elPlayer.classList.remove('vidopen');
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
      // Now-playing strip + video minimize. The frame shows on open so you see
      // it start, then auto-collapses after a few seconds to the strip (audio
      // keeps playing - the iframe is only clipped, never removed). Show/Hide
      // video re-expands; play/pause drives the YouTube embed over postMessage
      // (enablejsapi=1 on the embed URL). No YT API script needed.
      (function wireNowPlaying() {
        // THE VIDEO'S VISIBILITY IS THE USER'S, NEVER THE APP'S (round 16,
        // operator UAT 2026-09-02: "don't auto hide yt video. I keep having to
        // open it to skip after ads").
        //
        // Twice now an automatic hide has trapped the operator inside a YouTube
        // ad: first a 7s wall-clock auto-collapse (UAT 2026-07-31, mitigated to
        // a 15s playback-anchored window), then round 15's open-PARKED default,
        // which silently undid that mitigation - a pre-roll now ran with no
        // video on screen at all, so reaching "Skip Ads" cost a manual open
        // EVERY time. The ad boundary is undetectable cross-origin, so no timer
        // can ever be tuned safely around it. The durable fix is to stop
        // guessing: the app never hides the video on its own.
        //
        // Round 15's intent ("not show the video any other time") survives as a
        // REMEMBERED CHOICE - park it once and it opens parked from then on, on
        // every track, until you show it again. Fresh state opens VISIBLE, so
        // the Skip button is always reachable without a tap.
        var VID_PREF_KEY = 'music.vidPref.v1'; // additive key - no SCHEMA_VERSION bump (backup.js contract)
        function readVidPref() {
          try {
            var v = localStorage.getItem(VID_PREF_KEY);
            return (v === 'hid' || v === 'pip' || v === 'theater') ? v : 'theater';
          } catch (e) { return 'theater'; } // private mode / blocked storage -> the visible default
        }
        function writeVidPref(state) {
          try { localStorage.setItem(VID_PREF_KEY, state); } catch (e) {}
        }
        var mediaEl = elPlayer.querySelector('[data-media]');
        var vidToggle = elPlayer.querySelector('[data-vidtoggle]');
        var ppBtn = elPlayer.querySelector('[data-nppp]');
        var stateEl = elPlayer.querySelector('[data-npstate]');
        var frameWin = function () { var f = mediaEl && mediaEl.querySelector('iframe'); return f && f.contentWindow; };
        function ytCmd(func, args) {
          var w = frameWin(); if (!w) return;
          try { w.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*'); } catch (e) {}
        }
        // Round 10: THREE video states, one element, the iframe never remounts.
        // 'theater' - floating card overlay (taps reach the embed - YouTube's
        // Skip/controls live there); 'pip' - the docked mini video above the
        // bar; 'hid' - parked INTO the bar title (zero-size clip, NEVER
        // display:none - audio keeps playing).
        // fromOpen=true is the initial restore (it REPLAYS a remembered choice,
        // so it must not re-write it). Every other call is a user act on the
        // video layer, and the app remembers it - there is no automatic caller
        // left to pollute the preference.
        function setVid(state, fromOpen) {
          if (!mediaEl || !mediaEl.isConnected) return; // stale call after the Studio closed/re-opened
          vidState = state;            // round 17: what the NEXT open carries forward
          if (!fromOpen) writeVidPref(state);
          mediaEl.classList.toggle('min', state === 'pip');
          mediaEl.classList.toggle('hid', state === 'hid');
          elPlayer.classList.toggle('vidopen', state === 'theater'); // strip swaps Minimize CTA <-> pp/progress (one transport owner)
          elPlayer.classList.toggle('vidhid', state === 'hid'); // the bar title wears the restore cue (CSS)
          refreshMarquee(); // the swap changes the title's share of the bar
          if (vidToggle) {
            vidToggle.textContent = state === 'theater' ? 'Hide video' : (state === 'hid' ? 'Show video' : 'Expand video');
            vidToggle.setAttribute('aria-expanded', state === 'theater' ? 'true' : 'false');
          }
        }
        // Stashed for the outer closure: minimizeStudio demotes theater->PIP
        // (the video follows the Studio down instead of audio-clipping) and
        // the mini bar's title tap un-parks a hidden video.
        elPlayer._setVid = setVid;
        // The PIP body (and its top maximize bar) expand to the THEATER card,
        // where taps DO reach the embed - the ::after click-catcher (CSS)
        // keeps the embed from eating the tap. Round 12 ("I don't want to
        // switch to the solo view"): expanding the video is a VIDEO-LAYER act
        // - stopPropagation keeps it from also opening the Studio (the card
        // floats over whatever screen you are on). Round 16: nothing can yank a
        // theater the user asked for - there is no auto-min left to cancel.
        if (mediaEl) mediaEl.addEventListener('click', function (e) {
          if (!mediaEl.classList.contains('min')) return;
          e.stopPropagation();
          setVid('theater');
        });
        // Round 15: the menu mirrors the parked<->theater loop - Show video
        // goes straight to the theater (the only reason to show it is to see
        // or skip it), Hide video parks it. Expand (from a docked PIP) still
        // goes to theater.
        if (vidToggle && mediaEl) vidToggle.onclick = function () {
          if (mediaEl.classList.contains('min')) setVid('theater'); // "Expand video"
          else if (mediaEl.classList.contains('hid')) setVid('theater'); // "Show video"
          else setVid('hid'); // "Hide video"
        };
        // "Keep open" cancels the auto-collapse but leaves the video EXPANDED, so the
        // user can tap YouTube's Skip on the iframe. "Minimize now" collapses early
        // (once they've skipped and want the space back).
        // Round 15 ("clicking the down arrow from a theater size view should
        // dismiss it and not cause an intermediate step to the small docked
        // pip"): the theater's bottom handle PARKS the video outright. The
        // docked PIP is opt-in via the strip's corner dock chip instead.
        var thMinBtn = elPlayer.querySelector('[data-thmin]');
        if (thMinBtn && mediaEl) thMinBtn.onclick = function (e) {
          e.stopPropagation();
          setVid('hid');
        };
        var thDockBtn = elPlayer.querySelector('[data-thdock]');
        if (thDockBtn && mediaEl) thDockBtn.onclick = function (e) {
          e.stopPropagation();
          setVid('pip');
        };
        // Round 10 ("hide video CTA stuck to left of pip... collapses pip INTO
        // the song name"): the edge handle parks the video - audio keeps
        // playing, the bar title wears the cue, and the park is remembered for
        // the session so auto-advance never pops it back unasked.
        var pipHideBtn = elPlayer.querySelector('[data-piphide]');
        if (pipHideBtn && mediaEl) pipHideBtn.onclick = function (e) {
          e.stopPropagation(); // in mini, a stage tap would otherwise expand the Studio
          setVid('hid');
        };
        // Round 15 refinement of the round-11 left-zone toggle: showing the
        // video means THEATER now, not the docked PIP - the operator shows
        // the video for exactly one reason (see it / skip an ad), and the
        // small dock can do neither. Parked <-> theater, one tap each way; a
        // showing video (theater OR docked) parks. Videoless tracks return
        // early WITHOUT stopping propagation, so their bar tap still expands
        // the Studio (there is no video to toggle).
        function toggleDock(e) {
          if (!mediaEl || !mediaEl.isConnected) return;
          e.stopPropagation();
          setVid(mediaEl.classList.contains('hid') ? 'theater' : 'hid');
        }
        var idEl = elPlayer.querySelector('.bt-st-id');
        var eqEl = elPlayer.querySelector('.bt-st-bareq');
        if (idEl) idEl.addEventListener('click', toggleDock);
        if (eqEl) eqEl.addEventListener('click', toggleDock);
        // ROUND 17 - WHERE THE VIDEO SHOWS ITSELF (operator UAT 2026-09-02):
        // "detect not playing anything -> playing (first load or idle time) and
        // show the yt video - most likely to have ads. not between every song
        // tho". A pre-roll fires when a listening session STARTS - a fresh embed
        // after the app loads or after a real gap - not on each queue advance.
        // So:
        //   AD-LIKELY open (nothing was playing AND it is the first play of this
        //     load, or the last stop was over VID_IDLE_MS ago) -> SHOW it, so
        //     Skip is on screen without a tap. This is the whole point, so it
        //     beats a stale stored preference (round 16 shipped the memory; the
        //     operator has now twice asked to SEE the video when ads are likely).
        //   MID-SESSION open (the queue advanced, or he tapped another row while
        //     one played) -> CARRY the state he left it in. The video neither
        //     jumps up between songs nor gets yanked away (round 16 stands: the
        //     app never hides it).
        // fromOpen=true: replaying a state must not re-store it as a user choice.
        var wasPlaying = !!nowPlaying; // nowPlaying is still the PREVIOUS track here (set after this wiring)
        var adLikely = adLikelyOpen({ wasPlaying: wasPlaying, hasPlayedThisLoad: hasPlayedThisLoad, lastStopAt: lastStopAt, idleMs: VID_IDLE_MS });
        setVid(adLikely ? 'theater' : (vidState || readVidPref()), true);
        hasPlayedThisLoad = true;
        var paused = false;
        // UAT batch 6 ("when track ends... shows at the last time code and
        // indicates now playing"): detect the embed's END - the onStateChange
        // ended event (info 0) plus a currentTime>=duration fallback - and
        // either AUTO-ADVANCE to the next playable in the current view
        // (opts.advance; the new open rebuilds everything fresh) or, with
        // nothing to advance to, show the honest ENDED state: bar flips to ►,
        // equalizers freeze. One-shot per open (endedFired); a rebuild resets
        // it. Headless/blocked egress never reports, so this only fires where
        // playback is real.
        var endedFired = false;
        function onTrackEnd() {
          if (endedFired || !nowPlaying) return;
          endedFired = true;
          if (advanceCb && advanceCb('next', shuffleOn, trackKey(nowPlaying))) return;
          paused = true; userPaused = true;
          if (ppBtn) { ppBtn.innerHTML = ICON_PLAY; ppBtn.setAttribute('aria-label', 'Play'); }
          dispatchNowPlaying();
        }
        if (ppBtn) ppBtn.onclick = function (e) {
          // stopPropagation is LOAD-BEARING since the SVG glyphs (v328-2): the
          // innerHTML swap below DETACHES the tapped svg mid-bubble, so the mini
          // bar's body-tap exclusion (closest('[data-nppp]') on a now-parentless
          // node) can't recognize the tap - without this, a mini pp tap
          // re-expands the Studio.
          e.stopPropagation();
          paused = !paused;
          ytCmd(paused ? 'pauseVideo' : 'playVideo');
          ppBtn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
          ppBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
          // PLAYER-FEEL: the strip's pp is the one honest play-state authority
          // (YT never reports under blocked egress) - mirror it to the
          // mount-scope intent + tell the list rows.
          userPaused = paused;
          dispatchNowPlaying();
        };
        // Now-playing PROGRESS BAR (operator UAT: title text dropped - the pinned
        // header names the track; show playback position + total time at a glance
        // instead). Real YT time via the embed's JS-API infoDelivery postMessages:
        // send {event:'listening'} so the embed emits them, parse currentTime +
        // duration, drive the bar + m:ss / m:ss label. Graceful: if YT never
        // reports (headless / blocked egress), the bar stays at 0 and the
        // play/pause icon still conveys state. The message listener + the poll
        // both self-unbind once the strip leaves the DOM (no leak across opens).
        var progEl = elPlayer.querySelector('[data-npprog]');
        var progFill = elPlayer.querySelector('[data-npfill]');
        var timeLbl = elPlayer.querySelector('[data-nptime]');
        var ytDur = 0;
        // Round 9 ("support scrub on progress bar"): pointer-drag (or tap)
        // seeks. The fill tracks the finger OPTIMISTICALLY during the drag
        // (infoDelivery updates pause while scrubbing so the bar never fights
        // the finger); release sends ONE seekTo. Honest under blocked egress:
        // no reported duration = nothing to seek into, the gesture no-ops.
        var scrubbing = false;
        if (progEl) (function wireScrub() {
          function fracAt(e) {
            var r = progEl.getBoundingClientRect();
            if (!r.width) return 0;
            return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
          }
          function paint(frac) {
            if (progFill) progFill.style.width = (frac * 100).toFixed(1) + '%';
            progEl.setAttribute('aria-valuenow', Math.round(frac * 100));
            if (timeLbl && ytDur > 0) timeLbl.textContent = fmtTime(frac * ytDur) + ' / ' + fmtTime(ytDur);
          }
          progEl.addEventListener('pointerdown', function (e) {
            if (!(ytDur > 0)) return;
            scrubbing = true;
            // Round 14 ("can't seem to grab it... not easy/accurate"): the
            // fill's .3s width transition was CHASING the finger - kill it
            // for the drag (CSS keys off .scrubbing) so paint is 1:1.
            progEl.classList.add('scrubbing');
            try { progEl.setPointerCapture(e.pointerId); } catch (x) {}
            e.preventDefault();
            paint(fracAt(e));
          });
          progEl.addEventListener('pointermove', function (e) {
            if (!scrubbing) return;
            paint(fracAt(e));
          });
          function scrubEnd(e) {
            if (!scrubbing) return;
            scrubbing = false;
            progEl.classList.remove('scrubbing');
            var frac = fracAt(e);
            paint(frac);
            ytCmd('seekTo', [frac * ytDur, true]);
          }
          progEl.addEventListener('pointerup', scrubEnd);
          progEl.addEventListener('pointercancel', function () { scrubbing = false; progEl.classList.remove('scrubbing'); });
        })();
        function fmtTime(s) { s = Math.max(0, Math.round(s || 0)); var m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
        function onYtMessage(e) {
          if (!progFill || !progFill.isConnected) { global.removeEventListener('message', onYtMessage); return; }
          if (!e || typeof e.data !== 'string') return;
          var d; try { d = JSON.parse(e.data); } catch (x) { return; }
          if (!d) return;
          // UAT batch 6: the embed's ended event (YT player state 0).
          // UAT batch 7 ("when returning, it shows playing animations but no
          // sound"): states 1/2 SYNC our honest UI with the embed's REAL
          // state - covers pauses made on YouTube's own controls AND the
          // mobile background-pause (YouTube stops non-Premium playback when
          // the app hides; on return the bar must show ►, not a lie).
          // Round 15 ("when I pause in the small or theater size pip, the now
          // playing still indicates the song is playing"): one sync path for
          // BOTH the onStateChange delta events AND the playerState field that
          // rides every infoDelivery tick. Deltas can be missed (the listening
          // handshake races the widget boot; ads swallow events) - the
          // per-tick field makes the bar self-healing within a second.
          function syncState(s) {
            if (s === 0) { onTrackEnd(); return; }
            if (s === 2 && !paused) {
              paused = true; userPaused = true;
              if (ppBtn) { ppBtn.innerHTML = ICON_PLAY; ppBtn.setAttribute('aria-label', 'Play'); }
              dispatchNowPlaying();
            } else if (s === 1 && paused) {
              paused = false; userPaused = false; endedFired = false;
              if (ppBtn) { ppBtn.innerHTML = ICON_PAUSE; ppBtn.setAttribute('aria-label', 'Pause'); }
              dispatchNowPlaying();
            }
          }
          if (d.event === 'onStateChange') { syncState(d.info); return; }
          if (d.event !== 'infoDelivery' || !d.info) return;
          if (typeof d.info.playerState === 'number') syncState(d.info.playerState);
          if (typeof d.info.duration === 'number' && d.info.duration > 0) ytDur = d.info.duration;
          if (typeof d.info.currentTime === 'number' && ytDur > 0) {
            if (scrubbing) return; // the finger owns the fill until release
            var frac = Math.max(0, Math.min(1, d.info.currentTime / ytDur));
            progFill.style.width = (frac * 100).toFixed(1) + '%';
            if (progEl) progEl.setAttribute('aria-valuenow', Math.round(frac * 100));
            if (timeLbl) timeLbl.textContent = fmtTime(d.info.currentTime) + ' / ' + fmtTime(ytDur);
            // Fallback end detection when the ended event is missed: the clock
            // reaching the (real, >3s) duration is the end.
            if (ytDur > 3 && d.info.currentTime >= ytDur - 0.4) onTrackEnd();
          }
        }
        if (progFill) {
          global.addEventListener('message', onYtMessage);
          var listenTries = 0;
          var listenIv = setInterval(function () {
            if (!progFill.isConnected) { clearInterval(listenIv); return; }
            var w = frameWin(); if (w) { try { w.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch (x) {} }
            if (++listenTries >= 8) clearInterval(listenIv);
          }, 500);
          // UAT batch 7: returning to the app re-pokes the embed's reporting
          // channel (the initial pings stopped long ago), so the paused-by-
          // background state and the clock resync promptly. Self-unbinds with
          // the strip.
          // Round 9 (operator friction: "changing apps stops music - when
          // returning the play button shows active with no sound until I hit
          // play again"): backgrounding ALWAYS pauses a non-Premium YT embed,
          // so on refocus the honest default is PAUSED - flip the bar to the
          // play glyph immediately instead of waiting on a state report that
          // may never come. The re-poke below still runs; in the rare case
          // playback genuinely survived, the embed's state-1 report flips the
          // bar right back through the existing sync. One tap resumes either
          // way - the bar just never lies about it.
          var onVis = function () {
            if (!progFill.isConnected) { document.removeEventListener('visibilitychange', onVis); return; }
            if (document.visibilityState !== 'visible') return;
            if (nowPlaying && !paused) {
              paused = true; userPaused = true;
              if (ppBtn) { ppBtn.innerHTML = ICON_PLAY; ppBtn.setAttribute('aria-label', 'Play'); }
              dispatchNowPlaying();
            }
            var w = frameWin(); if (w) { try { w.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch (x) {} }
          };
          document.addEventListener('visibilitychange', onVis);
        }
      })();
      // S-STUDIO-FLYOUT (operator device-test 2026-07-25): the `...` menu button
      // in the now-playing strip toggles the .bt-st-menu fly-out (Show/Hide video,
      // Find another jam, Edit, Curated-URL card). Tapping a menu ACTION row or
      // anywhere outside the menu closes it; the URL input/Save inside stay open
      // (they carry their own classes, not .bt-st-menu-item, so the delegated
      // action-close never fires on them). The document listener self-removes once
      // the panel leaves the DOM (Studio close/re-render), so no listener leaks.
      (function wireStudioMenu() {
        var menuBtn = elPlayer.querySelector('[data-stmenu]');
        var menuPanel = elPlayer.querySelector('[data-stmenu-panel]');
        if (!menuBtn || !menuPanel) return;
        function setOpen(open) {
          menuPanel.hidden = !open;
          menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        menuBtn.onclick = function (e) { e.stopPropagation(); setOpen(menuPanel.hidden); };
        // Close when a menu ACTION row is tapped (not the URL input/Save, which
        // reopen the Studio on their own and carry different classes).
        menuPanel.addEventListener('click', function (e) {
          if (e.target.closest('.bt-st-menu-item')) setOpen(false);
        });
        function onDocClick(e) {
          if (!menuPanel.isConnected) { document.removeEventListener('click', onDocClick); return; }
          if (menuPanel.hidden) return;
          if (menuBtn.contains(e.target) || menuPanel.contains(e.target)) return;
          setOpen(false);
        }
        document.addEventListener('click', onDocClick);
      })();
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
      // The scale-audition play path, extracted so BOTH the Play toggle (below)
      // and a circle retune (retuneTo, below) start the same loop against
      // whatever curBundle currently is. Always reads curBundle.pcs LIVE on
      // every tick (see the onNote comment) so a retarget/retune the loop is
      // agnostic to. Caller must stopStudioSound() first if a loop is live.
      function startAudition() {
        if (!global.Sound || !curBundle || !curBundle.pcs || !curBundle.pcs.length) return;
        setSoundToggle(true);
        studioSound = global.Sound.playScale(curBundle.pcs, {
          // M-EAR wave 1.6 (U14): the currently-selected tempo control value -
          // live tempo changes route through studioSound.setTempo() (the tempo
          // toggle's own onclick, below), not a re-call here.
          bpm: TEMPO_BPM[tempo],
          // F17: continuous two-octave run with a dwell on every root hit,
          // instead of stopping/restarting each single-octave pass.
          octaves: SOLO_OCTAVES,
          rootDwell: ROOT_DWELL,
          // M-EAR wave 1.5 (U11): read curBundle.pcs LIVE on every tick, not a
          // value captured at play-start - after a chip-switch retarget OR a
          // circle retune, curBundle already points at the NEW bundle, so the
          // marker + fretboard light always match whichever scale is sounding.
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
      }
      if (soundToggleEl) {
        soundToggleEl.onclick = function () {
          if (studioSound) { stopStudioSound(); return; }
          startAudition();
        };
      }
      // S-COF-INTERACTIVE: retune every theory surface to an EXPLORED key when a
      // circle-crown wedge is tapped (onPick, wired in renderCofHero) - WITHOUT
      // rebuilding elPlayer.innerHTML, so the backing-track <iframe> node is
      // never destroyed and the video/audio keeps playing. The strategy is a
      // single reassignment of the shared `th` closure var: every theory-render
      // helper (renderFretboard/renderChordChips/renderCofHero/renderGuide/
      // renderJamPanel/renderLegend + the notes label + meta line) reads `th`
      // LIVE, so reassigning it and re-calling those helpers in place re-skins
      // the whole harmony HUD. newMode is a mode string studioTheory accepts
      // ('ionian'/'aeolian' from a wheel tap, or the song's own t.mode on reset).
      function retuneTo(newRoot, newMode) {
        // TRAP 1: kill any live audition FIRST - its onNote callback references
        // DOM/bundle a re-skin replaces; a loop ticking against stale nodes is
        // the dangling-handle trap. stopStudioSound() is the ONE genuine stop.
        stopStudioSound();
        var nth = studioTheory(newRoot, newMode);
        if (!nth) return; // unresolvable key - keep the current surfaces on screen
        th = nth; // REASSIGN the shared var - every closure now reads the new key
        curBundle = th; curScaleId = 'mode'; activeTargetChord = null;
        var onSong = (th.key === songRoot && th.scaleMode === songScaleMode);
        // On the song key, restore the exact original soloKey/soloMode (raw
        // t.key/t.mode) so the scale-chip machinery + any persistence match a
        // fresh open; on an explored key, follow the explored key (no persist).
        if (onSong) { soloKey = t.key; soloMode = t.mode; }
        else { soloKey = newRoot; soloMode = newMode; }
        // Re-skin each surface IN PLACE (never a full elPlayer-innerHTML rebuild):
        var metaEl = elPlayer.querySelector('.bt-st-meta');
        if (metaEl) metaEl.innerHTML = metaFor(th);
        var notesEl = elPlayer.querySelector('[data-solonotes]');
        if (notesEl) notesEl.innerHTML = renderNoteTokens(th.notes);
        var neckEl = elPlayer.querySelector('.hsrMore');
        if (neckEl) neckEl.setAttribute('href', inversionsHref(th));
        // TRAP 2: renderCofHero replaces the wheel DOM, so it RE-ATTACHES onPick
        // every call - an omitted onPick would leave the wheel inert after this
        // first tap. renderCofHero owns that re-attach (see its body).
        renderCofHero();
        renderChordChips();            // th.chords -> the new key
        wireScaleChips({ forceMode: true }); // rebuild chip set for new key, default 'mode'
        renderFretboard(th, 'mode');   // th.rootPc (live) -> the new key
        renderGuide(th.scaleMode, th.notes);
        renderJamPanel('mode');
        renderLegend();
        var resetWrap = elPlayer.querySelector('[data-cofreset]');
        if (resetWrap) resetWrap.hidden = onSong; // reset control only off-song
        startAudition();               // audition the new key's scale on the synth
      }
      var cofResetBtn = elPlayer.querySelector('[data-cofresetbtn]');
      // Reset re-tunes to the song's own key+mode; retuneTo detects onSong and
      // re-hides this control, so no explicit hide needed here.
      if (cofResetBtn) cofResetBtn.onclick = function () { retuneTo(t.key, t.mode); };
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
      // S-COF-INTERACTIVE: a named function (was an IIFE) so a circle retune can
      // rebuild the chip row for the EXPLORED key. opts.forceMode skips the
      // stored/inferred song default and lands on 'mode' (retune always resets
      // the solo scale). The bundles come from soloKey/soloMode (the CURRENT
      // key, song or explored) - never t.key/t.mode directly - so a chip tap on
      // an explored key gives that key's pent/blues scales, not the song's.
      function wireScaleChips(opts) {
        opts = opts || {};
        var forceMode = !!opts.forceMode;
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
        // S-COF-INTERACTIVE: a retune forces 'mode' (no stored/inferred lookup -
        // an explored key is not the song and has no persisted default).
        var storedScaleId = forceMode ? null : readSoloScaleFor(t);
        var curId = forceMode ? 'mode'
          : (storedScaleId != null && chipIds.indexOf(storedScaleId) >= 0)
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
          // S-COF-INTERACTIVE: bundle from the CURRENT key (soloKey/soloMode),
          // so an explored-key chip tap gives that key's scales, not the song's.
          var bundle = soloBundle(soloKey, soloMode, scaleId);
          if (!bundle) return;
          // M-EAR wave 1.5 (U11): a scale-chip switch WHILE auditioning
          // retargets the live loop at the next note boundary instead of
          // stopping - keeps playing, no re-tap, a seamless A/B compare of
          // scales. When nothing is playing, stopStudioSound() stays a
          // harmless idempotent reset (same behavior as pre-U11).
          var wasPlaying = !!studioSound;
          if (!wasPlaying) stopStudioSound();
          curId = scaleId;
          // S-COF-INTERACTIVE: only persist a solo-scale choice while ON the
          // song key - an explored key is not the track, so its chip taps must
          // not overwrite the song's stored default.
          if (persist && soloKey === t.key && soloMode === t.mode) writeSoloScaleFor(t, scaleId);
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
          // (Bug #6's "Why these notes?" note-strip refresh lived here on main.
          // That bottom panel is RETIRED on the circle-hero redesign - the crown
          // wheel is the orientation surface now, keyed to the key center, and the
          // scale-reactive note names live in the "Solo over it" label. There is
          // no whyBox to sync, so the #6 refresh is moot here and removed to avoid
          // a dangling reference to the deleted panel.)
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
      }
      wireScaleChips();
      // F19 (operator UAT 2026-07-05): name-only chip row - no chord
      // diagrams, no roman numerals ("like others", e.g. the scale-chip row
      // above). Hand-rolled instead of KeyExplorer.renderChords: that
      // helper's cell+diagram+roman shape doesn't fit a flat chip; Compose's
      // OWN use of renderChords (songbook.js) is untouched. Tap still plays
      // the chord (pack.playChord) AND toggles the fretboard chord-tone
      // target (toggleTarget) - only the visual weight changed.
      // S-COF-INTERACTIVE: named function (was an IIFE) so a circle retune re-runs it.
      function renderChordChips() {
        var chordsEl = elPlayer.querySelector('[data-chords]');
        if (!chordsEl || !th.chords) return;
        // Round 7 ("highlight the chords used in the song if known" - the
        // operator taps chords to jam along): custom songs carry their seq
        // through studioTarget, so mark the in-key chips the SONG actually
        // uses. Match on base triad (normalized root + m/dim quality) so 'Am7'
        // in the sheet lights the 'Am' chip; unknown/absent seq marks nothing.
        var songTok = {};
        (t.seq || t.chords || []).forEach(function (c) {
          var m = /^([A-G][#b]?)(dim|m(?!aj))?/.exec(String(c));
          if (m) songTok[normRoot(m[1]) + (m[2] || '')] = 1;
        });
        var inSong = function (c) {
          var m = /^([A-G][#b]?)(dim|m(?!aj))?/.exec(String(c));
          return !!(m && songTok[normRoot(m[1]) + (m[2] || '')]);
        };
        chordsEl.innerHTML = th.chords.map(function (it) {
          var mine = inSong(it.chord);
          return '<button class="bt-st-chordchip' + (mine ? ' inSong' : '') + '" data-chord="' + esc(it.chord) + '" type="button"'
            + (mine ? ' aria-label="' + esc(dispChord(it.chord, th.key, th.scaleMode)) + ' - in this song"' : '')
            + '>' + esc(dispChord(it.chord, th.key, th.scaleMode)) + '</button>';
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
      }
      renderChordChips();
      // Round 7: ONE theory visual at a time (phone space). The class on
      // .bt-studio drives CSS visibility of fretboard-side (scale + chips +
      // guide) vs circle-side (cofhero + reset); play/speed stay pinned in
      // the controls row. Both surfaces keep rendering eagerly, so switching
      // is a class flip - never a re-derive.
      (function wireStudioView() {
        var seg = elPlayer.querySelector('[data-stviewseg]');
        var sheet = elPlayer.querySelector('.bt-studio');
        if (!seg || !sheet) return;
        var VIEW_KEY = 'music.studioView.v1';
        function applyView(v) {
          v = (v === 'cof') ? 'cof' : 'fret';
          sheet.classList.toggle('stview-cof', v === 'cof');
          Array.prototype.forEach.call(seg.querySelectorAll('[data-stview]'), function (b) {
            var on = b.getAttribute('data-stview') === v;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
          // The beginner studiofirst tip's where-to-look clause must match the
          // ACTIVE view (a persisted Circle pin renders it wrong from the very
          // first paint otherwise). Same live textContent swap as the whynote
          // per-scale re-derive (G5) - never a re-render/re-claim. sfEl closes
          // over openStudio's scope; null when the tip never rendered.
          if (sfEl) {
            var sfBodyEl = sfEl.querySelector('.notableBanner-body');
            if (sfBodyEl) sfBodyEl.textContent = studioFirstText(v);
          }
        }
        Array.prototype.forEach.call(seg.querySelectorAll('[data-stview]'), function (b) {
          b.onclick = function () { applyView(b.getAttribute('data-stview')); };
        });
        var saved = null;
        try { saved = localStorage.getItem(VIEW_KEY); } catch (e) {}
        applyView(saved);
      })();
      // Circle-of-fifths CROWN: render the tinted wheel eagerly at the top
      // (data-cofhero), keyed to the CURRENT key center (song on open, explored
      // after a retune). Wheel-only - kept in a .bt-st-wheel container so
      // markWheelPc's sounding-pulse still finds it.
      // S-COF-INTERACTIVE: now interactive - every wedge is a live key-explore
      // tap via onPick, and this is a named function (was an IIFE) so retuneTo
      // can re-render the wheel with the new selection/tint.
      function renderCofHero() {
        var cofHero = elPlayer.querySelector('[data-cofhero]');
        var C = global.Circle;
        if (!cofHero || !C || !C.renderWheel) return;
        var mode = normMode(th.scaleMode);
        cofHero.innerHTML = '<div class="bt-st-wheel"></div>';
        // TRAP 2: renderWheel REPLACES the wheel DOM every call, so onPick MUST
        // be re-passed here on every render (retuneTo re-calls renderCofHero) -
        // an omitted onPick leaves the wheel inert after the first tap. ring is
        // 'major'/'minor'; map to the studioTheory scale mode.
        var wheelEl = C.renderWheel({
          selected: { root: th.key, mode: mode },
          onPick: function (root, ring) { retuneTo(root, ring === 'minor' ? 'aeolian' : 'ionian'); }
        });
        try { tintWheel(wheelEl, C, th.key, mode); } catch (e) { if (global.console && console.warn) console.warn('COF crown tint skipped:', e); }
        cofHero.querySelector('.bt-st-wheel').appendChild(wheelEl);
      }
      renderCofHero();
      // S-STUDIO-GUIDEFOLD (operator UAT 2026-07-27): the `?` now toggles the whole
      // on-demand wrapper (data-guidewrap) - description + legend + guide card
      // together - not just the guide box. guideBox keeps its own ref (renderGuide
      // writes into it regardless of the wrapper's hidden state, so content is
      // ready when the wrapper opens).
      var guideWrap = elPlayer.querySelector('[data-guidewrap]');
      if (guideToggle && guideWrap) guideToggle.onclick = function () {
        var show = guideWrap.hidden; guideWrap.hidden = !show;
        guideToggle.classList.toggle('on', show);
        guideToggle.setAttribute('aria-pressed', show ? 'true' : 'false');
      };
      // G4 S-JAM-STARTER: tap = load the resolved candidate via activate(), the
      // SAME function every finder result card uses (studio when key+mode
      // resolve, else the bare player) - no duplicate loader. jamStarterCandidate
      // is only non-null when jamStarterHtml actually rendered the button above,
      // so this ref is null exactly when there's nothing to wire.
      var jamStarterBtn = elPlayer.querySelector('[data-jamstarter]');
      if (jamStarterBtn && jamStarterCandidate) jamStarterBtn.onclick = function () { activate(jamStarterCandidate.track); };
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
        function doEdit() {
          opts.onEditRequest(t);
          // S15 (agent-interaction ?jam= re-home): an EPHEMERAL track (no
          // t.id - a jam-link hand-off, or any other no-id Edit request that
          // carries a chord seq) hands its progression to the form the same
          // way a user's own typing would - the form's own public [data-seq]
          // textarea, synchronous with repForm.open() (repertoire-form.js
          // renders inline, per openEditOrAdd's create branch) - never a
          // private songbook.js internal. Gated on t.id == null so an
          // EXISTING custom song's own saved seq is never clobbered here
          // (its Edit always takes the real edit-existing branch instead).
          if (t.id == null && t.seq && t.seq.length) {
            var seqEl = document.querySelector('.rf-ov.on [data-seq]');
            if (seqEl) seqEl.value = t.seq.join(' ');
          }
        }
        if (window.NavHistory) NavHistory.settleAfter(closePlayer, doEdit);
        else { closePlayer(); doEdit(); }
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
      elPlayer.querySelector('.bt-st-back').onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else dismissStudio(); };
      // UAT batch 3 item 4: Back is the app's standard leave-this-screen control
      // (same primitive, same slot, same glyph as the song view's #backLib) and it
      // MINIMIZES rather than tears down, so the music survives. That behaviour was
      // only reachable through an arrow labelled 'Back' - true, but unnamed. The
      // fly-out's first row now SAYS it, without adding a second top-level button
      // that would duplicate Back's destination.
      var stCollapse = elPlayer.querySelector('[data-stcollapse]');
      if (stCollapse) stCollapse.onclick = function () { if (window.NavHistory) window.NavHistory.dismiss(); else dismissStudio(); };
      // PLAYER-FEEL: a yt-backed Studio is the app's now-playing surface - track
      // it, and register dismissStudio (minimize, not teardown) as the close fn
      // so back/dismiss keeps the music going as the bottom bar. A videoless
      // Studio dismisses to a full close exactly as before (dismissStudio picks).
      nowPlaying = t.yt ? t : null;
      userPaused = false;
      var miniX = elPlayer.querySelector('[data-minix]');
      // PLAYER-FEEL v3: the x lives on the ONE bar, visible in BOTH states.
      // Expanded: the Studio holds a NavHistory slot - settle it during the
      // teardown so a later Back never spends a press on a dead layer. Mini
      // holds no slot (the bar is non-modal) - plain teardown.
      if (miniX) miniX.onclick = function (e) {
        e.stopPropagation();
        if (!elPlayer.classList.contains('mini') && window.NavHistory && window.NavHistory.depth() > 0) {
          window.NavHistory.settleAfter(closePlayer, null);
        } else {
          closePlayer();
        }
      };
      // UAT batch 6: prev/next walk the current view's playable pool via
      // opts.advance (songbook playNeighbor - expanded stays expanded, mini
      // stays the bar). stopPropagation keeps a step tap from expanding the
      // mini bar. A false return (nothing to advance to) is a quiet no-op.
      var prevBtn = elPlayer.querySelector('[data-npprev]');
      var nextBtn = elPlayer.querySelector('[data-npnext]');
      function stepTrack(dir) {
        if (advanceCb && nowPlaying) advanceCb(dir, shuffleOn, trackKey(nowPlaying));
      }
      if (prevBtn) prevBtn.onclick = function (e) { e.stopPropagation(); stepTrack('prev'); };
      if (nextBtn) nextBtn.onclick = function (e) { e.stopPropagation(); stepTrack('next'); };
      var shufBtn = elPlayer.querySelector('[data-shuffle]');
      if (shufBtn) shufBtn.onclick = function (e) { e.stopPropagation(); setShuffle(!shuffleOn); };
      // UAT batch 7 ("show media controls in phone notifications / on lock
      // screen if possible"): Media Session metadata + handlers, routed to the
      // SAME transport paths as the bar. Best-effort by design: the audio
      // lives in a cross-origin YouTube iframe, so whether the OS surfaces
      // OUR session (and whether audio may continue in the background at all -
      // YouTube pauses non-Premium background playback in its own player) is
      // outside the page's control. Everything here degrades to a no-op.
      if (t.yt && ('mediaSession' in navigator)) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: t.title || 'Backing track',
            artist: (t.artist && t.artist !== 'search') ? t.artist : 'Music',
            album: 'Music'
          });
          navigator.mediaSession.setActionHandler('play', function () { togglePlayCtl(); });
          navigator.mediaSession.setActionHandler('pause', function () { togglePlayCtl(); });
          navigator.mediaSession.setActionHandler('previoustrack', function () { stepTrack('prev'); });
          navigator.mediaSession.setActionHandler('nexttrack', function () { stepTrack('next'); });
        } catch (e) { /* MediaMetadata absent or handler unsupported - fine */ }
      }
      if (o.startMini && nowPlaying) {
        minimizeStudio();
      } else {
        if (window.NavHistory) window.NavHistory.open('studio', dismissStudio);
        dispatchNowPlaying();
      }
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
      injectJamStarterLate();  // G4: fill a starter-less no-video Studio opened pre-fetch
      if (opts.onReady) opts.onReady();  // M3: tracks loaded -> let the repertoire owner rebuild
    }).catch(function () {
      remerge(); rerender();
      injectJamStarterLate();  // custom tracks alone can still yield a candidate
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
      openStudio: function (t, o) { openStudio(t, o); },
      getTracks: function () { return state.tracks.slice(); },
      // PLAYER-FEEL controller surface: the list rows key their now-playing
      // state off this ({key: trackKey, paused} | null) and toggle transport
      // without opening the overlay.
      nowPlaying: function () { return nowPlaying ? { key: trackKey(nowPlaying), paused: userPaused } : null; },
      togglePlay: togglePlayCtl,
      // PLAYER-FEEL v3: the tabbar stays live under the expanded Studio sheet.
      // A tab tap collapses the sheet (NavHistory.settleAfter in songbook's
      // tab wiring pairs THIS raw close with the tab's own layer swap - the
      // synchronous modal->modal path, no back/push race).
      studioExpanded: function () { return elPlayer.classList.contains('studio') && !elPlayer.classList.contains('mini'); },
      collapseStudioRaw: function () { dismissStudio(); }
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
