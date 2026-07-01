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
  var MODES = {
    Major:      { label: "Major",      steps: [0, 2, 4, 5, 7, 9, 11], quals: ["", "m", "m", "", "", "m", "dim"] },
    Minor:      { label: "Minor",      steps: [0, 2, 3, 5, 7, 8, 10], quals: ["m", "dim", "", "m", "m", "", ""] },
    Mixolydian: { label: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], quals: ["", "m", "dim", "", "m", "m", ""] },
    Dorian:     { label: "Dorian",     steps: [0, 2, 3, 5, 7, 9, 10], quals: ["m", "m", "", "", "m", "dim", ""] }
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
    Mixolydian: "bluesy jam (Dead/Phish)", Dorian: "minor jam, hopeful"
  };
  function rootPc(root) { var i = ROOTS.indexOf(F2S[root] || root); return i < 0 ? null : i; }
  function scalePcs(root, modeKey) {
    var rp = rootPc(root), m = MODES[modeKey]; if (rp == null || !m) return [];
    return m.steps.map(function (s) { return (rp + s) % 12; });
  }
  // diatonic chords in scale-degree order, diminished degrees dropped (rarely strummed
  // in these styles, and the chord pack can't voice them) — leaves the usable jam palette.
  function diatonicChords(root, modeKey) {
    var rp = rootPc(root), m = MODES[modeKey]; if (rp == null || !m) return [];
    var out = [];
    m.steps.forEach(function (s, i) {
      if (m.quals[i] === "dim") return;
      out.push(ROOTS[(rp + s) % 12] + m.quals[i]);
    });
    return out;
  }
  // build a concrete chord list from 0-indexed scale degrees in a key (transposable).
  // Unlike diatonicChords this keeps EVERY degree (incl. the diminished vii°), so a
  // named progression maps degree->chord exactly: I-V-vi-IV in G -> G D Em C.
  function chordsFromDegrees(root, modeKey, degrees) {
    var rp = rootPc(root), m = MODES[modeKey]; if (rp == null || !m) return [];
    return degrees.map(function (deg) {
      var i = ((deg % 7) + 7) % 7;
      return ROOTS[(rp + m.steps[i]) % 12] + m.quals[i];
    });
  }
  // The canon — famous progressions, by 0-indexed major-scale degree. All diatonic
  // to MAJOR so they fill cleanly from any major key; modal/borrowed ones (Andalusian,
  // i-bVII-bVI) need a different derivation and are a deliberate follow-up.
  var PROGRESSIONS = [
    { name: "4-chord song",     degrees: [0, 4, 5, 3] }, // I  V  vi IV
    { name: "50s / doo-wop",    degrees: [0, 5, 3, 4] }, // I  vi IV V
    { name: "Pop / Axis",       degrees: [5, 3, 0, 4] }, // vi IV I  V
    { name: "Three-chord rock", degrees: [0, 3, 4] },    // I  IV V
    { name: "Jazz turnaround",  degrees: [1, 4, 0] },    // ii V  I
    { name: "Pachelbel",        degrees: [0, 4, 5, 2, 3, 0, 3, 4] } // I V vi iii IV I IV V
  ];
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
    if (!progression.length || !tonic) return [];
    var degs = progression.map(function (c) { return degreeOf(c, tonic); });
    if (degs.indexOf(-1) >= 0) return []; // a borrowed chord -> not a clean canon match
    var out = [];
    PROGRESSIONS.forEach(function (p) {
      if (p.degrees.length <= degs.length) return;        // nothing left to add
      var isPrefix = degs.every(function (d, i) { return d === p.degrees[i]; });
      if (!isPrefix) return;
      var nextDeg = p.degrees[degs.length];
      out.push({ name: p.name, degree: nextDeg, chord: chordsFromDegrees(tonic, keyMode || "Major", [nextDeg])[0] });
    });
    return out;
  }

  /* ---------- sheet rendering (chord-over-lyric, instrument-agnostic) ---------- */
  function escHTML(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderLyricLine(raw) {
    var chordRow = "", lyricRow = "", last = 0, m;
    var re = /\[([^\]]+)\]/g;
    while ((m = re.exec(raw))) {
      var before = raw.slice(last, m.index);
      lyricRow += before;
      chordRow += " ".repeat(before.length);
      chordRow += m[1];
      lyricRow += " ".repeat(m[1].length);
      last = re.lastIndex;
    }
    lyricRow += raw.slice(last);
    return '<div class="lyrLine"><span class="crd">' + escHTML(chordRow) + '</span>\n' + escHTML(lyricRow) + '</div>';
  }
  function renderChordOnly(sheet, st) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + sect + '</div>'); last = sect; }
      var re = /\[([^\]]+)\]/g, m, cs = [];
      while ((m = re.exec(line))) cs.push(tpose(m[1], st));
      if (cs.length) out.push('<div class="chordOnly">' + cs.map(function (c) { return '<span class="bar">' + c + '</span>'; }).join(' ') + '</div>');
    });
    return out.join('');
  }
  function renderSheet(song, st, view) {
    if (view === 'chords') return renderChordOnly(song.sheet, st);
    var html = '', last = null;
    song.sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { html += '<div class="sect">' + sect + '</div>'; last = sect; }
      html += renderLyricLine(tposeLine(line, st));
    });
    return html;
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
   *     songsList, decadeChips, search, libCount, libHero,
   *     // practice
   *     practiceEmpty, practiceBody,
   *     // setlist
   *     setBody, setBar, setCount, setClear, performBtn,
   *     // perform
   *     perform, pSheet, pPos, pTitle, pArtist, pKeyLine,
   *     pPrev, pNext, pClose, pUp, pDown, pDimBtn, pScroll,
   *     pSpeed, pSpeedR, pSpeedV, pCtrls,
   *     pFontDown, pFontAuto, pFontUp, pViewLyrics, pViewChords,
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
  function mount(opts) {
    opts = opts || {};
    var el = opts.el || {};
    var pack = opts.chordPack || null;
    var prefix = opts.storagePrefix || "songbook";
    var PROFILE_ID = opts.profileId || null; // instrument profile id, carried onto the inversions deep-link
    // P3: seed the backing-track finder with the built key+mode (no-op if not wired).
    var seedBackingKey = opts.seedBackingKey || function () {};
    // M3: the repertoire merges songs.json with the backing-track catalog. getTracks()
    // supplies the (seed + URL overlay + custom) track list; openStudioCb(track) opens
    // the Practice Studio (solo scale + chords + circle) for a track or a composed key.
    var getTracks = opts.getTracks || function () { return []; };
    var openStudioCb = opts.openStudio || null;
    // ONE shared running-order queue — Studio, Campfire and Stage all read it,
    // so prev/next means the same song everywhere (Phase B: "queue works everywhere").
    var QUEUE = global.Queue.createQueue();
    var DECADES = opts.decades || ["All", "60s", "70s", "80s", "90s", "00s", "10s"];
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
      return seq.every(function (c) { return packHasChord(tpose(c, st)); });
    }

    /* ---------- custom (composed) progressions ---------- */
    var CUSTOM_KEY = prefix + ".custom.v1";
    function loadCustom() { try { var r = localStorage.getItem(CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveCustom() { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customSongs)); } catch (e) { } }
    var customSongs = loadCustom();
    function buildSheetFromSeq(seq) { return [["Progression", seq.map(function (c) { return "[" + c + "]"; }).join(" ")]]; }
    function rebuildAll() {
      ALLSONGS = CATALOG.map(function (s, i) { return Object.assign({}, s, { id: "k" + i }); });
      customSongs.forEach(function (cs) { ALLSONGS.push(Object.assign({}, cs, { sheet: buildSheetFromSeq(cs.seq) })); });
    }
    var ALLSONGS = [];

    /* ---------- state + persistence ---------- */
    var STORE_KEY = prefix + ".setlist.v1";
    function loadSet() { try { var r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveSet() { try { localStorage.setItem(STORE_KEY, JSON.stringify(STATE.setlist)); } catch (e) { } }
    // last-opened song, so the app can greet you already holding a song to play.
    var LAST_KEY = prefix + ".last.v1";
    function loadLast() { try { return localStorage.getItem(LAST_KEY) || null; } catch (e) { return null; } }
    function saveLast(id) { try { localStorage.setItem(LAST_KEY, id); } catch (e) { } }
    // perform-screen prefs (scroll speed, view, font size), remembered per device.
    var PERF_KEY = prefix + ".perfprefs.v1";
    function loadPerfPrefs() { try { var r = localStorage.getItem(PERF_KEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
    function savePerfPrefs() { try { localStorage.setItem(PERF_KEY, JSON.stringify({ speed: STATE.scrollSpeed, view: STATE.performView, size: STATE.fontMode === 'auto' ? 'auto' : STATE.fontScale })); } catch (e) { } }
    var _pp = loadPerfPrefs();
    var STATE = {
      search: "", genre: "all", key: "all", libType: "repertoire", current: null, transpose: 0, view: "lyrics",
      setEditMode: false, lastRemoved: null, // set-edit mode gates reorder/remove; lastRemoved enables undo
      setlist: [], performDim: false, performTpose: 0,
      performView: (_pp.view === 'chords' ? 'chords' : 'lyrics'),
      fontMode: (typeof _pp.size === 'number' ? 'manual' : 'auto'),
      fontScale: (typeof _pp.size === 'number' ? _pp.size : 1), ctrlsOpen: false,
      scrolling: false, scrollSpeed: (typeof _pp.speed === 'number' ? _pp.speed : 28), scrollRAF: null, wakeLock: null
    };
    STATE.setlist = loadSet();
    function songById(id) { for (var i = 0; i < ALLSONGS.length; i++) if (ALLSONGS[i].id === id) return ALLSONGS[i]; return null; }

    /* ===================== LIBRARY (M3: unified Repertoire | Set) =====================
     * The old Songs|Tracks split is dissolved: a song and its curated backing track
     * are ONE item in a single Repertoire (repertoire.js merges + dedups). The toggle
     * is now just Repertoire | Set. The finder tab is retired; its Practice Studio
     * (solo scale + chords + circle) stays reachable by tapping a playable item
     * (openStudioCb), and curation moves to +Add / per-item edit (M2). Search + the
     * Genre/Key facet chips filter the merged list; they show for Repertoire, hide
     * for Set. */
    var LIBTYPE_KEY = prefix + ".libType.v1";
    var LIB_TYPES = [
      { id: 'repertoire', label: 'Repertoire' },
      { id: 'set', label: 'Set' }
    ];
    // migrate the pre-M3 stored value: 'songs'/'tracks' both collapse into 'repertoire'.
    try { var _lt = localStorage.getItem(LIBTYPE_KEY); STATE.libType = (_lt === 'set') ? 'set' : 'repertoire'; } catch (e) {}
    function applyLibType() {
      var t = STATE.libType;
      // sub-view visibility. #libSongs is the Repertoire container now; #s-tracks
      // (the old finder) stays hidden - the studio it powered opens on <body>.
      if (el.libSongs) el.libSongs.hidden = (t !== 'repertoire');
      if (el.libTracks) el.libTracks.hidden = true;
      if (el.libSet) el.libSet.hidden = (t !== 'set');
      // search + facet chips apply to the Repertoire; hidden on Set.
      var repView = (t === 'repertoire');
      if (el.searchWrap) el.searchWrap.hidden = !repView;
      if (el.genreChips) el.genreChips.hidden = !repView;
      if (el.keyChips) el.keyChips.hidden = !repView;
      if (el.libHero) el.libHero.style.display = repView ? '' : 'none';
      if (t === 'repertoire') { renderFilterChips(); renderHero(); renderSongs(); }
      else if (t === 'set') renderSetlist();
      // context line follows the active sub-view
      if (el.ctxLine) {
        var ctx = (t === 'set') ? CONTEXTS['setlist'] : CONTEXTS['library'];
        if (ctx != null) el.ctxLine.textContent = ctx;
      }
    }
    function setLibType(t) {
      STATE.libType = t;
      try { localStorage.setItem(LIBTYPE_KEY, t); } catch (e) {}
      renderTypeToggle();
      applyLibType();
    }
    function renderTypeToggle() {
      if (!el.typeToggle) return;
      el.typeToggle.innerHTML = '';
      LIB_TYPES.forEach(function (lt) {
        var b = document.createElement('button');
        b.className = 'chip' + (lt.id === STATE.libType ? ' on' : '');
        b.textContent = lt.label;
        b.onclick = function () { if (STATE.libType !== lt.id) setLibType(lt.id); };
        el.typeToggle.appendChild(b);
      });
    }

    /* ---- merged repertoire (songs.json + backing tracks, deduped) ---- */
    var REPERTOIRE = [];
    // getTracks() (from tracks.js) already applies the URL overlay + custom tracks.
    function buildRepertoire() {
      REPERTOIRE = global.Repertoire.build(ALLSONGS, getTracks());
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
      if (el.genreChips) {
        el.genreChips.innerHTML = '';
        el.genreChips.appendChild(chipBtn('All genres', STATE.genre === 'all',
          function () { STATE.genre = 'all'; renderFilterChips(); renderSongs(); }));
        global.Repertoire.genres(REPERTOIRE).forEach(function (g) {
          el.genreChips.appendChild(chipBtn(g, STATE.genre === g,
            function () { STATE.genre = g; renderFilterChips(); renderSongs(); }));
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
    /* "Play now" hero: a Continue card + a couple of one-tap jam-starters.
       Shown only on the unfiltered library, so the moment you search or pick a
       decade it gets out of the way and the full list takes over. */
    function quickPicks() {
      var pool = ALLSONGS.filter(function (s) { return !s.custom; });
      if (!pool.length) return [];
      // Curated jam songs ("jam": true in the catalog) lead the picks; the rest
      // are ordered easiest-first so they only backfill when flags run out.
      var jam = pool.filter(function (s) { return s.jam; }).sort(function (a, b) { return a.t.localeCompare(b.t); });
      var rest = pool.filter(function (s) { return !s.jam; })
        .sort(function (a, b) { return a.seq.length - b.seq.length || a.t.localeCompare(b.t); });
      // rotate the jam set by day so revisits feel fresh without being random
      var day = jam.length ? Math.floor(Date.now() / 864e5) % jam.length : 0;
      var ordered = jam.slice(day).concat(jam.slice(0, day)).concat(rest);
      var out = [], seen = {};
      for (var i = 0; i < ordered.length && out.length < 4; i++) {
        var s = ordered[i];
        if (!seen[s.id]) { seen[s.id] = 1; out.push(s); }
      }
      return out;
    }
    // Pick a random jam-flagged song (fall back to the quick-picks pool), so one
    // tap drops you straight into playing something good — no decisions.
    function jamSong() {
      var jam = ALLSONGS.filter(function (s) { return s.jam && !s.custom; });
      var pool = jam.length ? jam : quickPicks();
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    function jamNow() { var s = jamSong(); if (s) { saveLast(s.id); startPerform([s.id]); } }

    function renderHero() {
      if (!el.libHero) return;
      if (STATE.search.trim() || STATE.genre !== 'all' || STATE.key !== 'all') { el.libHero.innerHTML = ''; el.libHero.style.display = 'none'; return; }
      el.libHero.style.display = 'block';
      var html = '<button class="jamNow" id="heroJam">⚡ Jam now</button>';
      var last = loadLast() ? songById(loadLast()) : null;
      if (last) {
        html += '<button class="heroCont" data-id="' + last.id + '">'
          + '<div class="hcKick">▸ Continue</div>'
          + '<div class="hcTitle">' + escHTML(last.t) + '</div>'
          + '<div class="hcSub">' + escHTML(last.a) + '  ·  ' + last.seq.join(' · ') + '</div>'
          + '</button>';
      }
      var picks = quickPicks().filter(function (s) { return !last || s.id !== last.id; }).slice(0, last ? 2 : 4);
      if (picks.length) {
        html += '<div class="heroLbl">' + (last ? 'Or start something' : 'Tap a song — play right now') + '</div><div class="heroRow">';
        picks.forEach(function (s) {
          html += '<button class="heroCard" data-id="' + s.id + '">'
            + '<div class="hcKick">▶ ' + s.seq.length + ' chords</div>'
            + '<div class="hcTitle">' + escHTML(s.t) + '</div>'
            + '<div class="hcArtist">' + escHTML(s.a) + '</div>'
            + '<div class="hcChords">' + s.seq.join(' · ') + '</div>'
            + '</button>';
        });
        html += '</div>';
      }
      el.libHero.innerHTML = html;
      el.libHero.querySelectorAll('[data-id]').forEach(function (b) {
        b.onclick = function () { openPractice(b.dataset.id); };
      });
      var jb = el.libHero.querySelector('#heroJam'); if (jb) jb.onclick = jamNow;
    }

    // Action-ladder fallback for an item with no curated video: find one on YouTube.
    function ytSearch(s) {
      var q = [s.t || s.title, s.a || s.artist, s.key ? s.key + ' key' : '']
        .filter(Boolean).join(' ');
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank', 'noopener');
    }
    // Where a repertoire tap lands (approach A): a chord sheet opens the song screen
    // (openPractice); a pure backing track opens the Practice Studio (solo scale +
    // chords + circle); otherwise a YouTube search.
    function openRepertoireItem(rec) {
      var p = global.Repertoire.playability(rec);
      if (p.sheet && rec.id != null && songById(rec.id)) { openPractice(rec.id); return; }
      if (openStudioCb && (p.studio || rec._track)) { openStudioCb(rec._track || rec); return; }
      ytSearch(rec);
    }
    // The ▶/↗ action button: a curated video opens the Studio (video + solo HUD);
    // otherwise it's a YouTube search for a backing track.
    function repertoireAction(rec) {
      if ((rec.yt || rec.video) && openStudioCb) { openStudioCb(rec._track || rec); return; }
      ytSearch(rec);
    }
    function renderSongs() {
      renderHero();
      if (!el.songsList) return;
      buildRepertoire();
      var filtered = global.Repertoire.filter(REPERTOIRE, { q: STATE.search, genre: STATE.genre, key: STATE.key });
      if (filtered.length === 0) {
        el.songsList.innerHTML = '<div class="empty">Nothing in your repertoire matches.</div>';
        if (el.libCount) el.libCount.textContent = '';
        return;
      }
      el.songsList.innerHTML = '';
      filtered.forEach(function (rec) {
        var sid = rec.id;
        // only chord-sheet items (real song id) can join a setlist; pure tracks can't.
        var canAdd = sid != null && !!songById(sid);
        var inSet = canAdd && STATE.setlist.indexOf(sid) >= 0;
        // SSOT: one shared renderer for every Repertoire / Set item (shared/list-item.js).
        el.songsList.appendChild(global.ListItem.render(rec, {
          segment: 'library',
          inSet: inSet,
          onActivate: function () { openRepertoireItem(rec); },
          onAdd: canAdd ? function () { toggleSet(sid); } : null,
          onAction: function () { repertoireAction(rec); }
        }));
      });
      if (el.libCount) el.libCount.textContent = filtered.length + ' of ' + REPERTOIRE.length + ' in repertoire';
    }
    function syncSearchClear() { if (el.searchClear) el.searchClear.hidden = !el.search.value.length; }
    if (el.search) el.search.oninput = function () { STATE.search = el.search.value; syncSearchClear(); renderSongs(); };
    if (el.searchClear) el.searchClear.onclick = function () {
      el.search.value = ''; STATE.search = ''; syncSearchClear(); renderSongs(); el.search.focus();
    };

    /* ===================== SONG (modes: Studio / Campfire / Stage) ===================== */
    // A song opens in your last-used SCREEN mode (Studio or Campfire). Stage is a
    // one-shot action — it launches the fullscreen perform overlay over whichever
    // screen you're on, but is never persisted as the default-open mode (otherwise
    // every song-tap would trap you in fullscreen with no way back to the chords).
    var SONGMODE_KEY = prefix + ".songmode.v1";
    var TEACH_KEY = prefix + ".songmode.teach.v1";
    function loadSongMode() { try { return localStorage.getItem(SONGMODE_KEY) === 'campfire' ? 'campfire' : 'studio'; } catch (e) { return 'studio'; } }
    function saveSongMode(m) { try { localStorage.setItem(SONGMODE_KEY, m); } catch (e) { } }
    function teachSeen() { try { return localStorage.getItem(TEACH_KEY) === '1'; } catch (e) { return true; } }
    function markTeachSeen() { try { localStorage.setItem(TEACH_KEY, '1'); } catch (e) { } }
    STATE.songMode = loadSongMode();
    STATE.screenMode = STATE.songMode; // studio | campfire

    // open a song in the song screen. queueIds (optional) sets the running order:
    // opening from the Setlist passes the whole set so prev/next walks it; opening
    // a lone song from the Library passes nothing → a one-song (inactive) queue.
    function openPractice(id, queueIds) {
      if (queueIds && queueIds.length > 1 && queueIds.indexOf(id) >= 0) QUEUE.set(queueIds, queueIds.indexOf(id));
      else QUEUE.set([id]);
      openCurrent();
    }
    // render whatever the queue cursor points at, in the last-used screen mode
    function openCurrent() {
      var id = QUEUE.current();
      STATE.current = id ? songById(id) : null;
      STATE.transpose = 0;
      if (!STATE.current) return;
      saveLast(STATE.current.id);
      STATE.screenMode = STATE.songMode; // studio | campfire — never auto-launch Stage
      switchTab('practice');
      renderPractice();
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
      if (m !== 'campfire') stopBeat(); // tempo cue only lives in Campfire — stop it before any early return (incl. Stage)
      // Stage performs the live queue from the current position (one-shot; not sticky)
      if (m === 'stage') { if (STATE.current) startPerform(QUEUE.isActive() ? QUEUE.ids() : [STATE.current.id], QUEUE.isActive() ? QUEUE.index() : 0); return; }
      STATE.screenMode = m; STATE.songMode = m; saveSongMode(m); renderPractice();
    }

    /* ---- Campfire tempo cue: tap-tempo + a visual beat pulse ---- */
    var TEMPO = (global.Tempo && global.Tempo.createTempo) ? global.Tempo.createTempo() : null;
    function perfNow() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }
    function stopBeat() {
      STATE.beatOn = false;
      if (STATE.beatRAF) { cancelAnimationFrame(STATE.beatRAF); STATE.beatRAF = null; }
      var b = el.practiceBody && el.practiceBody.querySelector('#beatToggle'); if (b) b.textContent = '▶';
    }
    function startBeat() {
      if (!TEMPO || STATE.beatOn || !el.practiceBody) return; // no-op if already running (avoid orphaning the rAF loop)
      STATE.beatOn = true; STATE.beatStart = perfNow();
      var btn = el.practiceBody.querySelector('#beatToggle'); if (btn) btn.textContent = '⏸';
      var last = -1;
      function step() {
        if (!STATE.beatOn) return;
        var dot = el.practiceBody.querySelector('#beatDot');
        if (!dot) { STATE.beatOn = false; STATE.beatRAF = null; return; } // left Campfire — stop
        var bi = TEMPO.beatIndex(STATE.beatStart, perfNow());
        if (bi !== last) {
          last = bi;
          dot.classList.remove('on', 'down'); void dot.offsetWidth; // restart the flash
          dot.classList.add('on'); if (bi % TEMPO.beatsPerBar() === 0) dot.classList.add('down');
        }
        STATE.beatRAF = requestAnimationFrame(step);
      }
      STATE.beatRAF = requestAnimationFrame(step);
    }
    function tapTempo() {
      if (!TEMPO || !el.practiceBody) return;
      TEMPO.tap(perfNow());
      var v = el.practiceBody.querySelector('#bpmVal'); if (v) v.textContent = TEMPO.bpm();
      if (STATE.beatOn) STATE.beatStart = perfNow(); // realign the pulse to your tap
    }
    function renderPractice() {
      if (!el.practiceBody) return;
      if (!STATE.current) {
        if (el.practiceEmpty) el.practiceEmpty.style.display = 'block';
        el.practiceBody.style.display = 'none';
        return;
      }
      if (el.practiceEmpty) el.practiceEmpty.style.display = 'none';
      el.practiceBody.style.display = 'block';
      var s = STATE.current, mode = STATE.screenMode || 'studio';
      var seq = s.seq.map(function (c) { return tpose(c, STATE.transpose); });
      var inSet = STATE.setlist.indexOf(s.id) >= 0;
      var maxBtn = pack ? '<button class="iconBtn" id="maxOpenBtn" title="Maximize chords">⤢</button>' : '';
      var switcher = '<div class="modeSwitch">'
        + '<button data-m="studio" class="' + (mode === 'studio' ? 'on' : '') + '">Studio</button>'
        + '<button data-m="campfire" class="' + (mode === 'campfire' ? 'on' : '') + '">Campfire</button>'
        + '<button data-m="stage" class="stageBtn">Stage ▶</button></div>';
      // one-time teaching card explaining the three modes (shown on the first song open)
      var teach = teachSeen() ? '' : '<div class="teachCard" id="teachCard">'
        + '<strong>Three ways to open a song</strong>'
        + '<span><b>Studio</b> — learn it (lyrics + chords) · <b>Campfire</b> — jam the chord chart · <b>Stage</b> — perform fullscreen</span>'
        + '<button class="btn ghost" id="teachOk">Got it</button></div>';
      // queue nav — only when a real running order (the setlist) is loaded
      var queueNav = QUEUE.isActive() ? '<div class="queueNav">'
        + '<button id="qPrev" ' + (QUEUE.atStart() ? 'disabled' : '') + '>‹ Prev</button>'
        + '<span class="qPos">' + (QUEUE.index() + 1) + ' / ' + QUEUE.size() + '</span>'
        + '<button id="qNext" ' + (QUEUE.atEnd() ? 'disabled' : '') + '>Next ›</button></div>' : '';
      var head = '<div class="detailHead"><div class="ti"><h2>' + escHTML(s.t) + '</h2><p>' + escHTML(s.a) + ' · ' + s.y + '</p></div>' + maxBtn + '</div>';
      var keyPill = '<div class="ctrl"><div class="pill"><button id="tDown">−</button><div><div class="lbl">Key</div><div class="v" id="keyV">' + seq[0] + '</div></div><button id="tUp">+</button></div></div>';
      var chips = '<div class="chordChips">' + seq.map(function (c) { return '<span class="c" data-c="' + c + '">' + c + '</span>'; }).join('') + '</div>';
      var actions = '<div class="actions"><button class="btn ' + (inSet ? 'red' : '') + '" id="setToggle">' + (inSet ? '✓ In setlist' : '+ Add to setlist') + '</button><button class="btn ghost" id="backLib">← Library</button></div>';
      var body;
      if (mode === 'campfire') {
        // tempo cue: tap the beat, watch it pulse — sets the jam's feel (no BPM in the data)
        var tempoBar = TEMPO ? '<div class="tempoBar">'
          + '<button id="beatToggle" class="tempoPlay" title="Start/stop the beat">' + (STATE.beatOn ? '⏸' : '▶') + '</button>'
          + '<button id="tapBtn" class="tapBtn">Tap</button>'
          + '<span class="bpmRead"><b id="bpmVal">' + TEMPO.bpm() + '</b> BPM</span>'
          + '<span class="beatDot" id="beatDot"></span></div>' : '';
        body = keyPill + tempoBar + chips
          + '<div class="sheet campfireSheet" id="sheetBox">' + renderSheet(s, STATE.transpose, 'chords') + '</div>'
          + actions;
      } else {
        var lyricsURL = "https://genius.com/search?q=" + encodeURIComponent(s.t + " " + s.a);
        body = keyPill + chips
          + '<div class="sheet" id="sheetBox">' + renderSheet(s, STATE.transpose, s.custom ? 'chords' : 'lyrics') + '</div>'
          + actions
          + '<a class="lyricsLink" href="' + lyricsURL + '" target="_blank" rel="noopener">Full lyrics on Genius ↗</a>'
          + '<p class="note">Sheet shows a short representative snippet. Full lyrics open on a licensed site.</p>';
      }
      el.practiceBody.innerHTML = '<div class="detail">' + head + teach + switcher + queueNav + body + '</div>';
      el.practiceBody.querySelectorAll('.modeSwitch button').forEach(function (b) { b.onclick = function () { setMode(b.dataset.m); }; });
      var qPrev = el.practiceBody.querySelector('#qPrev'); if (qPrev) qPrev.onclick = function () { QUEUE.prev(); openCurrent(); };
      var qNext = el.practiceBody.querySelector('#qNext'); if (qNext) qNext.onclick = function () { QUEUE.next(); openCurrent(); };
      var beatToggle = el.practiceBody.querySelector('#beatToggle'); if (beatToggle) beatToggle.onclick = function () { STATE.beatOn ? stopBeat() : startBeat(); };
      var tapBtn = el.practiceBody.querySelector('#tapBtn'); if (tapBtn) tapBtn.onclick = tapTempo;
      var teachOk = el.practiceBody.querySelector('#teachOk');
      if (teachOk) teachOk.onclick = function () { markTeachSeen(); var c = el.practiceBody.querySelector('#teachCard'); if (c) c.remove(); };
      el.practiceBody.querySelector('#tDown').onclick = function () { shiftKey(-1); };
      el.practiceBody.querySelector('#tUp').onclick = function () { shiftKey(1); };
      el.practiceBody.querySelectorAll('.chordChips .c').forEach(function (elc) { elc.onclick = function () { packPlayChord(elc.dataset.c); }; });
      el.practiceBody.querySelector('#setToggle').onclick = function () { toggleSet(s.id); renderPractice(); renderSongs(); renderSetlist(); };
      el.practiceBody.querySelector('#backLib').onclick = function () { STATE.libType = 'repertoire'; try { localStorage.setItem(LIBTYPE_KEY, 'repertoire'); } catch (e) {} switchTab('library'); };
      var maxOpen = el.practiceBody.querySelector('#maxOpenBtn');
      if (maxOpen) maxOpen.onclick = function () { openMaxWith(seq); };
      if (s.custom) {
        var act = el.practiceBody.querySelector('.actions');
        if (act) {
          var db = document.createElement('button');
          db.className = 'btn ghost'; db.textContent = 'Delete progression'; db.style.flexBasis = '100%';
          db.onclick = function () {
            if (confirm('Delete this progression?')) {
              customSongs = customSongs.filter(function (cs) { return cs.id !== s.id; });
              saveCustom();
              var sp = STATE.setlist.indexOf(s.id);
              if (sp >= 0) { STATE.setlist.splice(sp, 1); saveSet(); }
              rebuildAll(); switchTab('library'); renderSongs(); renderSetlist();
            }
          };
          act.parentNode.insertBefore(db, act.nextSibling);
        }
      }
    }
    function shiftKey(dir) {
      var cur = STATE.transpose;
      for (var n = 1; n <= 6; n++) {
        var cand = cur + dir * n;
        if (Math.abs(cand) > 6) break;
        if (seqPlayable(STATE.current.seq, cand)) { STATE.transpose = cand; renderPractice(); return; }
      }
    }

    /* ===================== MAXIMIZE (chord pack diagrams) ===================== */
    function openMaxWith(chords) {
      if (!el.maxOv || !el.maxGrid || !pack) return;
      el.maxGrid.innerHTML = '';
      chords.forEach(function (c) {
        var bd = pack.diagram ? pack.diagram(c, 'big') : (function () { var d = document.createElement('div'); d.className = 'bigC'; d.textContent = c; return d; })();
        bd.onclick = function () { packPlayChord(c); };
        el.maxGrid.appendChild(bd);
      });
      el.maxOv.classList.add('on');
    }
    if (el.maxClose) el.maxClose.onclick = function () { el.maxOv.classList.remove('on'); };

    /* ===================== SETLIST ===================== */
    function toggleSet(id) {
      var pos = STATE.setlist.indexOf(id);
      if (pos >= 0) STATE.setlist.splice(pos, 1); else STATE.setlist.push(id);
      saveSet(); renderSongs(); renderSetlist();
      if (STATE.current && STATE.current.id === id) renderPractice();
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
      if (STATE.setlist.length === 0) {
        body.innerHTML = '<div class="setEmpty">Your setlist is empty.<br>Add songs with the + button.</div>';
        if (bar) bar.style.display = 'none';
        if (count) count.textContent = 'No songs yet';
        STATE.setEditMode = false; STATE.lastRemoved = null;
        return;
      }
      if (count) count.textContent = STATE.setlist.length + ' song' + (STATE.setlist.length > 1 ? 's' : '')
        + (STATE.setEditMode ? ' · editing' : ' · ready to play');
      body.innerHTML = '';
      // Persistent undo for the last removal (codex: not a short toast). Stays until used or Done.
      if (STATE.lastRemoved) {
        var u = document.createElement('div'); u.className = 'setUndo';
        var rs = songById(STATE.lastRemoved.sid);
        u.innerHTML = '<span>Removed ' + escHTML(rs ? rs.t : 'song') + '</span><button class="btn ghost" type="button">Undo</button>';
        u.querySelector('button').onclick = function () {
          var lr = STATE.lastRemoved; if (!lr) return;
          var at = Math.min(lr.index, STATE.setlist.length);
          STATE.setlist.splice(at, 0, lr.sid); STATE.lastRemoved = null;
          saveSet(); syncQueueToSetlist(); renderSetlist(); renderSongs();
        };
        body.appendChild(u);
      }
      STATE.setlist.forEach(function (sid, i) {
        var s = songById(sid); if (!s) return;
        // SSOT: same renderer as Songs/Tracks, in 'set' mode. Reorder/remove only when setEdit.
        body.appendChild(global.ListItem.render(s, {
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
          },
          onAction: function () { ytSearch(s); }
        }));
      });
      if (bar) bar.style.display = 'flex';
    }
    if (el.setEdit) el.setEdit.onclick = function () {
      STATE.setEditMode = !STATE.setEditMode;
      if (!STATE.setEditMode) STATE.lastRemoved = null; // leaving edit mode dismisses the undo affordance
      renderSetlist();
    };
    if (el.setClear) el.setClear.onclick = function () {
      if (STATE.setlist.length === 0) return;
      if (confirm('Clear your setlist?')) { STATE.setlist = []; STATE.lastRemoved = null; STATE.setEditMode = false; saveSet(); renderSetlist(); renderSongs(); }
    };

    /* ===================== PERFORM ===================== */
    var performEl = el.perform, pSheet = el.pSheet;
    function reqWake() { try { if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').then(function (w) { STATE.wakeLock = w; }, function () { }); } } catch (e) { } }
    function relWake() { try { if (STATE.wakeLock) { STATE.wakeLock.release(); STATE.wakeLock = null; } } catch (e) { } }
    // Launch fullscreen perform mode for any list of song ids (the setlist, or a
    // single song straight from Practice / the "Play now" hero).
    function startPerform(ids, startIdx) {
      if (!ids || !ids.length) return;
      QUEUE.set(ids, startIdx || 0);
      STATE.performDim = false; STATE.performTpose = 0;
      // show the overlay BEFORE rendering so auto-fit can measure a real height
      if (performEl) { performEl.classList.remove('dim'); performEl.classList.add('on'); }
      stopScroll();
      STATE.ctrlsOpen = false; if (el.pSpeed) el.pSpeed.classList.remove('on');
      if (el.pSpeedR) { el.pSpeedR.value = STATE.scrollSpeed; if (el.pSpeedV) el.pSpeedV.textContent = STATE.scrollSpeed; }
      showPerform();
      reqWake();
    }
    if (el.performBtn) el.performBtn.onclick = function () { startPerform(STATE.setlist); };
    if (el.pClose) el.pClose.onclick = function () { stopScroll(); relWake(); if (performEl) performEl.classList.remove('on'); };
    if (el.pPrev) el.pPrev.onclick = function () { if (!QUEUE.atStart()) { QUEUE.prev(); STATE.performTpose = 0; showPerform(); } };
    if (el.pNext) el.pNext.onclick = function () {
      if (!QUEUE.atEnd()) { QUEUE.next(); STATE.performTpose = 0; showPerform(); }
      else { stopScroll(); relWake(); if (performEl) performEl.classList.remove('on'); }
    };
    if (el.pDown) el.pDown.onclick = function () { perfShift(-1); };
    if (el.pUp) el.pUp.onclick = function () { perfShift(1); };
    if (el.pDimBtn) el.pDimBtn.onclick = function () { STATE.performDim = !STATE.performDim; if (performEl) performEl.classList.toggle('dim', STATE.performDim); };
    // stage controls panel (scroll speed + font size + lyrics/chords view)
    if (el.pCtrls) el.pCtrls.onclick = function () { STATE.ctrlsOpen = !STATE.ctrlsOpen; if (el.pSpeed) el.pSpeed.classList.toggle('on', STATE.ctrlsOpen || STATE.scrolling); };
    if (el.pViewLyrics) el.pViewLyrics.onclick = function () { setPerformView('lyrics'); };
    if (el.pViewChords) el.pViewChords.onclick = function () { setPerformView('chords'); };
    if (el.pFontDown) el.pFontDown.onclick = function () { stepFont(-0.1); };
    if (el.pFontUp) el.pFontUp.onclick = function () { stepFont(0.1); };
    if (el.pFontAuto) el.pFontAuto.onclick = function () { STATE.fontMode = 'auto'; applyPerfFont(); updateStageBtns(); savePerfPrefs(); };
    function setPerformView(v) { STATE.performView = v; showPerform(); savePerfPrefs(); }
    function stepFont(d) { STATE.fontMode = 'manual'; STATE.fontScale = Math.max(0.8, Math.min(2.2, +(STATE.fontScale + d).toFixed(2))); applyPerfFont(); updateStageBtns(); savePerfPrefs(); }
    // auto-fit: scale the sheet so a short song fills the screen and a long one
    // shrinks toward fitting; manual mode pins an explicit scale instead.
    function applyPerfFont() {
      if (!pSheet) return;
      if (STATE.fontMode === 'manual') { pSheet.style.setProperty('--pscale', STATE.fontScale); return; }
      var inner = pSheet.firstElementChild;
      if (!inner) { pSheet.style.setProperty('--pscale', 1); return; }
      pSheet.style.setProperty('--pscale', 1);            // measure at base size
      var avail = Math.max(80, pSheet.clientHeight - 112); // leave room for the nav bar
      var need = inner.scrollHeight;
      var scale = need > 0 ? Math.max(0.8, Math.min(2.2, avail / need)) : 1;
      pSheet.style.setProperty('--pscale', scale.toFixed(3));
    }
    function updateStageBtns() {
      if (el.pFontAuto) el.pFontAuto.classList.toggle('on', STATE.fontMode === 'auto');
      if (el.pViewLyrics) el.pViewLyrics.classList.toggle('on', STATE.performView === 'lyrics');
      if (el.pViewChords) el.pViewChords.classList.toggle('on', STATE.performView === 'chords');
    }
    function perfShift(dir) {
      var s = songById(QUEUE.current());
      var cur = STATE.performTpose;
      for (var n = 1; n <= 6; n++) {
        var cand = cur + dir * n;
        if (Math.abs(cand) > 6) break;
        if (seqPlayable(s.seq, cand)) { STATE.performTpose = cand; showPerform(); return; }
      }
    }
    function showPerform() {
      var s = songById(QUEUE.current());
      if (!s) return;
      if (el.pPos) el.pPos.textContent = (QUEUE.index() + 1) + ' / ' + QUEUE.size();
      if (el.pTitle) el.pTitle.textContent = s.t;
      if (el.pArtist) el.pArtist.textContent = s.a + ' · ' + s.y;
      var seq = s.seq.map(function (c) { return tpose(c, STATE.performTpose); });
      if (el.pKeyLine) el.pKeyLine.textContent = (STATE.performTpose !== 0 ? 'Key ' + seq[0] + '  ·  ' : '') + seq.join('  ');
      if (pSheet) {
        var view = s.custom ? 'chords' : STATE.performView;
        pSheet.innerHTML = '<div class="pInner">' + renderSheet(s, STATE.performTpose, view) + '</div>';
        pSheet.scrollTop = 0;
        applyPerfFont();
      }
      updateStageBtns();
      if (el.pNext) el.pNext.textContent = QUEUE.atEnd() ? '✓' : '→';
    }
    /* auto-scroll */
    if (el.pSpeedR) el.pSpeedR.oninput = function () { STATE.scrollSpeed = +el.pSpeedR.value; if (el.pSpeedV) el.pSpeedV.textContent = el.pSpeedR.value; savePerfPrefs(); };
    function startScroll() {
      if (!pSheet) return;
      STATE.scrolling = true;
      if (el.pScroll) el.pScroll.textContent = '⏸';
      if (el.pSpeed) el.pSpeed.classList.add('on');
      var last = null;
      function step(ts) {
        if (!STATE.scrolling) return;
        if (last != null) {
          var dt = (ts - last) / 1000;
          pSheet.scrollTop += STATE.scrollSpeed * dt;
          if (pSheet.scrollTop + pSheet.clientHeight >= pSheet.scrollHeight - 2) { stopScroll(); return; }
        }
        last = ts;
        STATE.scrollRAF = requestAnimationFrame(step);
      }
      STATE.scrollRAF = requestAnimationFrame(step);
    }
    function stopScroll() {
      STATE.scrolling = false;
      if (STATE.scrollRAF) cancelAnimationFrame(STATE.scrollRAF);
      if (el.pScroll) el.pScroll.textContent = '▶';
      // keep the controls panel open if the user opened it via the gear
      if (el.pSpeed) el.pSpeed.classList.toggle('on', STATE.ctrlsOpen);
    }
    if (el.pScroll) el.pScroll.onclick = function () { STATE.scrolling ? stopScroll() : startScroll(); };
    if (pSheet) pSheet.onclick = function () { if (STATE.scrolling) stopScroll(); };

    /* ===================== COMPOSE (needs chord pack for diagrams/audio) ===================== */
    var progression = [], cTpose = 0; // cTpose = net semitones shifted from where you started (interval-learning readout)
    function packDiagram(name, size) {
      if (pack && typeof pack.diagram === 'function') return pack.diagram(name, size);
      var wrap = document.createElement('div');
      wrap.className = (size === 'big') ? 'bigC' : 'chord';
      wrap.innerHTML = '<span class="' + (size === 'big' ? 'nm' : 'chord-name') + '">' + name + '</span>';
      return wrap;
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
    var lastProgSig = null;
    function renderProg() {
      if (!el.prog) return;
      // Gray out the choosers once the 8-chord cap (addChord) is reached. The .maxed class
      // sits on .composeWrap so it covers BOTH regions: the fixed top (starters + toggle)
      // AND the scrolling chord list (in-key cells + all-chords tiles).
      var maxed = progression.length >= 8;
      var wrap = document.querySelector('.composeWrap');
      if (wrap) wrap.classList.toggle('maxed', maxed);
      if (el.maxNote) el.maxNote.hidden = !maxed;
      var tonic = labelTonic();
      // Only repaint the strip when something VISIBLE changed - the chords, their
      // key-relative romans (via tonic), or the maxed cap. A mode toggle re-calls
      // renderProg but changes none of these (romans are root-relative), so a rebuild
      // would just flash the strip with identical content. Suggestions still refresh
      // below (completions are mode-aware).
      var sig = progression.join(',') + '|' + tonic + '|' + maxed;
      if (sig !== lastProgSig) {
        lastProgSig = sig;
        el.prog.innerHTML = '';
        progression.forEach(function (c, i) {
          var slot = document.createElement('div'); slot.className = 'slot';
          var d = packDiagram(c, 'small'); d.onclick = function () { packPlayChord(c); };
          slot.appendChild(d);
          // interval relative to the key — think I IV V, not shapes
          if (global.Circle && global.Circle.romanFor) {
            var rn = global.Circle.romanFor(c, tonic);
            if (rn) { var lbl = document.createElement('span'); lbl.className = 'rn'; lbl.textContent = rn; slot.appendChild(lbl); }
          }
          var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×';
          rm.onclick = function (e) { e.stopPropagation(); progression.splice(i, 1); renderProg(); renderSuggest(); renderKey(); };
          slot.appendChild(rm);
          el.prog.appendChild(slot);
        });
      }
      renderSuggest();
    }
    function addChord(c) { if (progression.length >= 8) return; forceStarters = false; progression.push(c); renderProg(); renderKey(); }
    // Fill the progression from a named pattern, in the user's key (default C Major).
    // These patterns are major-diatonic, so we anchor to a Major key: keep the picked
    // root if there is one, force the mode to Major, and sync the key picker so the
    // chord palette + solo scale below match what just got filled in.
    function loadProgression(degrees) {
      var root = songKey.root || "C";
      forceStarters = false; // a progression is loaded now - leave the starters view
      // a named pattern sets an explicit Major key (patterns are major-diatonic)
      songKey.root = root; songKey.mode = "Major"; songKey.explicit = true;
      keyPopoverOpen = false; // a key is set now - the root popover stays closed
      progression = chordsFromDegrees(root, songKey.mode, degrees);
      cTpose = 0;
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
    var MODE_SHORT = { Major: 'Maj', Minor: 'Min', Mixolydian: 'Mixo', Dorian: 'Dor' };
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
      if (el.soloBackingBtn) el.soloBackingBtn.hidden = !(songKey.root && progression.length);
    }
    function composeTpose(st) {
      if (!progression.length) return;
      progression = progression.map(function (c) { return tpose(c, st); });
      cTpose += st;
      // Move the song key with the chords so the readout, diatonic palette and solo
      // scale never drift from what's actually sounding. If a key center exists
      // (explicit pick, or one derived earlier) shift its root by the same delta;
      // otherwise derive it fresh from the now-transposed first chord.
      if (songKey.root) {
        songKey.root = tpose(songKey.root, st);
      } else {
        var p0 = splitChord(progression[0]);
        if (p0) songKey.root = p0.root;
      }
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
    }
    // MODAL INTERCHANGE (Phase 2). Re-harmonize the whole built progression to a
    // PARALLEL mode: same tonic, same chord ROOTS, but each chord re-QUALIFIED to the
    // target mode's degree quality. C Major I-IV-V (C F G) -> C Minor i-iv-v (Cm Fm Gm).
    // Distinct from transpose (composeTpose): transpose moves roots and keeps qualities;
    // this keeps roots and flips qualities. Called by the one key/mode filter (#keyModes)
    // whenever the mode changes with a progression present - so the filter always keeps
    // the built chords in sync with the chosen mode (no separate re-harmonize button).
    // Best-effort by the user's decision: a chord whose root is NOT a scale degree of the
    // target mode (a chromatic/borrowed root) is left UNCHANGED rather than guessed at.
    // A preserved 7th-type extension is re-based onto the new triad quality where the
    // base triad maps to "" (major) or "m" (minor); on a "dim" degree we keep the bare
    // dim triad. Round-trip is not perfect for chromatic chords (acceptable).
    function convertToMode(targetMode) {
      if (!progression.length || !MODES[targetMode]) return;
      // Parallel = same tonic. Use the explicit/derived song key root; else the first
      // chord's root. rootPc handles flat spellings; if it can't resolve, bail safely.
      var tonicRoot = songKey.root || (splitChord(progression[0]) || {}).root || null;
      var tonicPc = tonicRoot != null ? rootPc(tonicRoot) : null;
      if (tonicPc == null) return;
      var steps = MODES[targetMode].steps, quals = MODES[targetMode].quals;
      progression = progression.map(function (c) {
        var p = splitChord(c);
        if (!p) return c;
        var rpc = rootPc(p.root);
        if (rpc == null) return c;
        var offset = ((rpc - tonicPc) % 12 + 12) % 12;
        var i = steps.indexOf(offset);
        if (i < 0) return c; // chromatic root with no degree at this offset -> leave it
        var baseQual = quals[i]; // "" major triad, "m" minor, "dim" diminished
        // Detect a trailing 7th-type extension on the ORIGINAL chord ("7","maj7","m7").
        // Re-base it onto the target triad quality: major degree -> maj7 keeps its own
        // maj7-ness only if it was maj7; a dominant 7 stays a dominant 7; a minor 7
        // becomes minor on a minor degree, etc. Simpler+correct rule: rebuild from the
        // base triad and re-attach the extension class that survives a quality flip.
        var ext = "";
        if (/maj7$/.test(p.qual)) ext = "maj7-like";
        else if (/m7$/.test(p.qual)) ext = "min7-like";
        else if (/7$/.test(p.qual)) ext = "dom7-like";
        var suffix;
        if (ext === "") {
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
      // Parallel interchange keeps the tonic fixed; only the mode changes. Roots do not
      // move, so cTpose (the transpose-from-origin readout) is intentionally untouched.
      songKey.root = tonicRoot;
      songKey.mode = targetMode;
      songKey.explicit = true;
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
    // The in-key palette lives ONLY here now (renderKeyView keeps the scale + HSR +
    // inversions teaching only), so the diatonic chords are never duplicated.
    // 'chordView' is the segmented-toggle state ('inkey' | 'all'); null = "follow the key"
    // (auto: in-key when a key is set, all otherwise). An explicit user tap pins it.
    var chordView = null;
    // 'allChordsActiveCat' persists which chromatic category tab (Major/Minor/7th/...)
    // is selected across re-renders, so switching tab doesn't reset to the first category.
    var allChordsActiveCat = Object.keys(CATS)[0] || "Major";
    // Resolve the effective view: an explicit pin wins; otherwise follow the key.
    function effectiveChordView() {
      if (chordView === 'inkey' || chordView === 'all') return chordView;
      return songKey.root ? 'inkey' : 'all';
    }
    function buildGrid() {
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
      // Remove any list-content nodes a prior render appended to the scroll area, keeping
      // #buildGrid (the tiles container) in place.
      var scroller = el.composeChords;
      if (scroller) {
        Array.prototype.slice.call(scroller.children).forEach(function (n) {
          if (n !== grid) scroller.removeChild(n);
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

      if (view === 'inkey') {
        if (!songKey.root) {
          // In-key view with no key set: prompt to pick a key (the list is empty until then).
          var hint = document.createElement('p');
          hint.className = 'keyHint chordsHint';
          hint.textContent = 'Pick a key (tap the key chip above) to lead with its chords, or switch to All to browse every chord.';
          if (scroller) scroller.insertBefore(hint, grid);
          return;
        }
        var keyRoot = songKey.root, keyMode = songKey.mode;
        var leadWrap = document.createElement('div'); leadWrap.className = 'inKeyLead';
        if (global.KeyExplorer) {
          var keItems = diatonicChords(keyRoot, keyMode).map(function (c) {
            return { chord: c, roman: (global.Circle && global.Circle.romanFor) ? global.Circle.romanFor(c, keyRoot) : '' };
          });
          // No 'label' opt: the key/mode chip already names the key, so no list header.
          global.KeyExplorer.renderChords(leadWrap, keItems, {
            diagram: packDiagram,
            onTap: function (c, d) { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); }
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
        b.onclick = function () { allChordsActiveCat = cat; buildGrid(); };
        tabRow.appendChild(b);
      });
      if (scroller) scroller.insertBefore(tabRow, grid);
      (CATS[allChordsActiveCat] || []).forEach(function (c) {
        grid.appendChild(wireTap(packDiagram(c, 'small'), c));
      });
    }

    /* ---- Key & scale: pick a key -> its diatonic chord palette + a solo scale box ----
     * Persistent compact key bar (replaces the old collapse): the current-key chip and
     * the maj/min mode toggle are ALWAYS visible - one tap changes major<->minor, never
     * hidden. The 12-root grid is an on-demand popover, opened by tapping the key chip
     * and closed on selection. No "tap the already-selected Major to dismiss" gesture. */
    var songKey = { root: null, mode: "Major", explicit: false };
    var keyPopoverOpen = false; // the 12-root grid popover - opens on chip tap, closes on pick
    function buildKeyPicker() {
      if (!el.keyRoots || !el.keyModes) return;
      // Fixed-width key/mode chip: injected once into the button bar (#keyChipSlot). It
      // does double duty - shows the current key (root + abbreviated mode, so it reads as
      // the transpose readout: songKey.root moves with every transpose) AND toggles the
      // fly-out (#keyFlyout, which holds the 12 roots + the mode toggle + the solo scale).
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
        var chipMode = MODE_SHORT[songKey.mode] || MODES[songKey.mode].label;
        // Placeholder is short ("Key") so it fits the fixed-width chip without clipping;
        // the title attr carries the full "Key / mode - tap to change" affordance.
        chip.innerHTML = songKey.root
          ? (songKey.root + ' <span class="kpcMode">' + chipMode + '</span> <span class="kpcCaret" aria-hidden="true">▾</span>')
          : ('Key <span class="kpcCaret" aria-hidden="true">▾</span>');
        chip.onclick = function () { keyPopoverOpen = !keyPopoverOpen; buildKeyPicker(); };
      }
      // The fly-out (roots + mode toggle + solo scale) opens/closes with the chip.
      if (el.keyFlyout) el.keyFlyout.hidden = !keyPopoverOpen;
      // Root grid is always visible INSIDE the fly-out now (no separate popover).
      el.keyRoots.hidden = false;
      el.keyRoots.innerHTML = '';
      ROOTS.forEach(function (r) {
        var b = document.createElement('button');
        b.className = 'chip rootChip' + (r === songKey.root ? ' on' : '');
        b.textContent = r;
        b.setAttribute('aria-pressed', r === songKey.root ? 'true' : 'false');
        b.onclick = function () {
          // Picking a root sets the explicit key and closes the popover. Tapping the
          // currently-selected root clears the key (and re-opens for a fresh pick).
          if (songKey.root === r) {
            // Clear the key (context only) - NEVER transpose on clear; the chords stay put.
            songKey.root = null; songKey.explicit = false;
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
            songKey.root = r; songKey.explicit = true;
            keyPopoverOpen = false;
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
          // Mode change ALWAYS re-harmonizes the built progression (solo-practice scope):
          // the one key/mode filter keeps the chords in sync - a root change transposes,
          // a mode change re-qualifies. convertToMode sets songKey.mode + re-renders.
          // If the progression is empty there's nothing to harmonize, so just set the
          // mode and re-render the palette/solo scale.
          if (progression.length) {
            convertToMode(mk);
          } else {
            songKey.mode = mk;
            renderKey(); buildKeyPicker(); renderKeyView(); renderProg(); buildGrid();
          }
        };
        el.keyModes.appendChild(b);
      });
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
    }
    function renderKeyView() {
      if (!el.keyView) return;
      el.keyView.innerHTML = '';
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
      // #keyView now lives INSIDE the key/mode fly-out (below the roots + mode toggle), so
      // the solo scale + HSR chain + inversions link show when the fly-out is open.
      if (!songKey.root) {
        el.keyView.innerHTML = '<p class="keyHint">Pick a key to see the scale to solo over.</p>';
        return;
      }
      var keyRoot = songKey.root, keyMode = songKey.mode; // local aliases for this render
      var title = document.createElement('div'); title.className = 'keyTitle';
      title.innerHTML = '<strong>' + keyRoot + ' ' + MODES[keyMode].label + '</strong> <span>' + (MODE_HINT[keyMode] || '') + '</span>';
      el.keyView.appendChild(title);

      // Solo scale via the shared KeyExplorer. The in-key DIATONIC CHORD palette used
      // to render here too, but it now lives ONLY on the adaptive chord surface
      // (buildGrid -> the chord list above this fly-out, which leads with the in-key
      // chords when a key is set) so the diatonic chords are never duplicated across two
      // surfaces. This fly-out keeps the teaching content: title, the solo scale box, the
      // I-IV-V HSR chain, and the "Walk the full cycle" inversions link. Guarded so a
      // future script-load reorder degrades (scale skipped, HSR + title still render)
      // instead of hard-crashing.
      if (global.KeyExplorer) {
        var pcs = scalePcs(keyRoot, keyMode);
        global.KeyExplorer.renderScale(el.keyView, pack, rootPc(keyRoot), pcs, {
          label: 'Solo over it · ' + pcs.map(function (p) { return ROOTS[p]; }).join(' '),
          frets: 7
        });
      }

      // I-IV-V shape chain - HSR-style: I uses the profile's home shape (often
      // open), IV uses a closed movable shape, V is IV slid up 2 frets. The
      // teaching: V is adjacent to IV (same hand shape, 2-fret slide). I sits
      // in a different family - you "rotate" into it via hammer/transform. The
      // adapter's chainVoicings honors this. For HSR-by-design profiles (Cigar
      // Box, Banjo) the same closed barre is the home shape so I+IV+V all use
      // the same family - that profile IS the HSR loop in one shape.
      renderHsrChain();
    }
    // I-IV-V (degree indices 0, 3, 4) - mode-aware: minor modes give i-iv-v.
    // Reuses chordsFromDegrees so any future progression patterns slot in here.
    function renderHsrChain() {
      var keyRoot = songKey.root, keyMode = songKey.mode;
      if (!el.keyView || !keyRoot || !pack) return;
      var chain = chordsFromDegrees(keyRoot, keyMode, [0, 3, 4]);
      if (!chain.length) return;
      var quals = (MODES[keyMode] && MODES[keyMode].quals) || ["", "", "", "", "", "", ""];
      var romanBase = ['I', 'IV', 'V'];
      var labels = [0, 3, 4].map(function (deg, i) {
        return (quals[deg] === 'm' || quals[deg] === 'dim') ? romanBase[i].toLowerCase() : romanBase[i];
      });
      // diagramChain picks a single template family across all three names so
      // the eye sees the same hand shape slid up. Fallback to per-chord
      // diagramClosed when the adapter doesn't expose the chain method.
      var diagrams;
      if (typeof pack.diagramChain === 'function') {
        diagrams = pack.diagramChain(chain, 'small');
      } else if (typeof pack.diagramClosed === 'function') {
        diagrams = chain.map(function (c) { return pack.diagramClosed(c, 'small'); });
      } else {
        diagrams = chain.map(function (c) { return packDiagram(c, 'small'); });
      }
      var hsrLbl = document.createElement('div'); hsrLbl.className = 'keySubLbl';
      hsrLbl.textContent = 'I IV V · V is IV slid up 2 frets';
      el.keyView.appendChild(hsrLbl);
      var row = document.createElement('div'); row.className = 'hsrChain';
      chain.forEach(function (c, i) {
        // Same vertical layout as the diatonic palette + "Add Nth chord" row:
        // chord name (top, inside diagram via chord-name span) -> diagram ->
        // Roman numeral (bottom). Moving Roman from above to below the diagram
        // makes the chord name the most prominent label and matches the other
        // palettes.
        var card = document.createElement('div'); card.className = 'hsrCard';
        card.appendChild(diagrams[i]);
        var rn = document.createElement('span'); rn.className = 'hsrRoman'; rn.textContent = labels[i];
        card.appendChild(rn);
        card.onclick = function () {
          addChord(c); packPlayChord(c);
          card.classList.add('sel'); setTimeout(function () { card.classList.remove('sel'); }, 220);
        };
        row.appendChild(card);
      });
      el.keyView.appendChild(row);
      // Deep-dive: the same I-IV-V relationship walked all the way up the neck
      // using shape rotations (C-shape -> A-shape -> F-shape) and the Hammer /
      // Slide / Rotate / Flip operations. Not the default surface; linked here
      // for the curious.
      var more = document.createElement('a');
      more.className = 'hsrMore';
      // Carry the current instrument AND key so the inversions page opens in context -
      // same instrument profile, pre-selected to this key (the cycle is the same I-IV-V,
      // now anchored to where the user is actually composing). mode rides along too so a
      // future minor-cycle variant can read it; the page ignores params it doesn't use.
      var invParams = [];
      if (PROFILE_ID) invParams.push('p=' + encodeURIComponent(PROFILE_ID));
      if (keyRoot) invParams.push('key=' + encodeURIComponent(keyRoot));
      if (keyMode) invParams.push('mode=' + encodeURIComponent(keyMode));
      more.href = 'triad-inversions.html' + (invParams.length ? '?' + invParams.join('&') : '');
      more.textContent = 'Walk the full cycle up the neck →';
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
    // viewport. (The full shapes live in "All chords" / the key palette.) `completes` (a
    // progression name) accent-highlights the chip and adds a tiny caption in place.
    function suggChip(c, tonic, completes) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggChip' + (completes ? ' complete' : '');
      var rn = (global.Circle && global.Circle.romanFor) ? global.Circle.romanFor(c, tonic) : '';
      var html = '<span class="scName">' + c + '</span>';
      if (rn) html += '<span class="scRn">' + rn + '</span>';
      if (completes) html += '<span class="scCap">' + completes + '</span>';
      chip.innerHTML = html;
      chip.onclick = function () { addChord(c); packPlayChord(c); };
      return chip;
    }
    // The "?" help button can FORCE the starter list to show even when a progression
    // exists (so the starters stay reachable after you've begun). Cleared as soon as a
    // chord is added/loaded so the box returns to its normal built-chord + next-chord view.
    var forceStarters = false;
    function renderSuggest() {
      if (!el.suggest) return;
      el.suggest.innerHTML = '';
      if (progression.length === 0 || forceStarters) {
        // Empty state (or "?" pressed): show common progressions so the user has actionable
        // one-tap starters. The starters live INSIDE the progression box (below #prog).
        var lbl = document.createElement('div'); lbl.className = 'suggLbl';
        lbl.textContent = 'Start with a common progression';
        el.suggest.appendChild(lbl);
        var row = document.createElement('div'); row.className = 'progPickRow';
        PROGRESSIONS.forEach(function (p) {
          var b = document.createElement('button'); b.className = 'progPick'; b.type = 'button';
          var roman = chordsFromDegrees('C', 'Major', p.degrees)
            .map(function (c) { return global.Circle && global.Circle.romanFor ? global.Circle.romanFor(c, 'C') : c; })
            .join(' ');
          b.innerHTML = '<span class="ppRoman">' + roman + '</span><span class="ppName">' + p.name + '</span>';
          b.onclick = function () { loadProgression(p.degrees); };
          row.appendChild(b);
        });
        el.suggest.appendChild(row);
        return;
      }
      var tonic = labelTonic();
      // PROGRESSION-AWARE highlight: a chord that COMPLETES a famous progression is
      // flagged right inside the normal "add a chord" list (accent glow + a tiny name
      // caption) — no separate rows, no forced vertical. De-duped per chord.
      var comps = completions(progression, tonic, songKey.root ? songKey.mode : "Major");
      var completeBy = {};
      comps.forEach(function (cmp) {
        (completeBy[cmp.chord] = completeBy[cmp.chord] || []).push(cmp.name);
      });

      var picks = suggestNext(progression);
      // make sure any completing chord is actually in the list (the Markov ranker might
      // not surface it), and float completions to the front so the highlight reads first.
      Object.keys(completeBy).forEach(function (chord) {
        var i = picks.indexOf(chord);
        if (i >= 0) picks.splice(i, 1);
      });
      picks = Object.keys(completeBy).concat(picks).slice(0, 5);
      if (!picks.length) {
        var hint = document.createElement('p');
        hint.className = 'keyHint suggEmpty';
        hint.textContent = 'No suggestions for this progression yet.';
        el.suggest.appendChild(hint);
        return;
      }
      var n = progression.length;
      // Helpful "Add a Nth chord" guidance only for the first few; past that the panel's own
      // "Next chord" summary already says it (avoid the duplicate header the user flagged).
      if (n <= 3) {
        var lbl = document.createElement('div'); lbl.className = 'suggLbl';
        lbl.textContent = n === 1 ? "Add a 2nd chord:" : n === 2 ? "Add a 3rd chord:" : "Add a 4th chord:";
        el.suggest.appendChild(lbl);
      }
      var row = document.createElement('div'); row.className = 'suggRow';
      // show the actual chord shape, not just a name — same diagram as the build grid
      // below. Interval label shows the ROLE (V, vi…); a completing chord also gets the
      // accent glow + the progression name it finishes.
      picks.forEach(function (c) {
        var names = completeBy[c];
        row.appendChild(suggChip(c, tonic, names ? names.join(' / ') : null));
      });
      el.suggest.appendChild(row);
    }
    function saveProgression() {
      if (progression.length === 0) { alert('Build a progression first.'); return; }
      var name = prompt('Name this progression:', 'My progression');
      if (name === null) return;
      name = name.trim() || 'My progression';
      var cs = { id: 'm' + Date.now(), t: name, a: 'My progression', y: new Date().getFullYear(), d: 'Mine', seq: progression.slice(), custom: true };
      customSongs.push(cs); saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
      alert('Saved to your Songs (filter “Mine”). You can add it to a setlist and perform it.');
    }
    if (el.cClear) el.cClear.onclick = function () { progression = []; cTpose = 0; renderProg(); renderKey(); };
    if (el.cSave) el.cSave.onclick = saveProgression;
    if (el.cMax) el.cMax.onclick = function () { if (progression.length) openMaxWith(progression.slice()); };
    // "?" help: re-show the starter progressions inside the progression box. Toggles off
    // if already forced (and there's a progression to fall back to).
    if (el.cHelp) el.cHelp.onclick = function () {
      forceStarters = (progression.length === 0) ? true : !forceStarters;
      renderSuggest();
    };
    if (el.cTup) el.cTup.onclick = function () { composeTpose(1); };
    if (el.cTdown) el.cTdown.onclick = function () { composeTpose(-1); };
    // P3 (M3): "Solo over a backing track" opens the Practice Studio directly for the
    // composed key+mode - solo scale + chords + circle, plus a curated video or a
    // YouTube search for one. The finder tab is retired, so this goes straight to the
    // studio instead of seeding a finder view. seedBackingKey stays wired as a no-op
    // fallback when no studio callback is present.
    if (el.soloBackingBtn) el.soloBackingBtn.onclick = function () {
      if (!songKey.root || !progression.length) return;
      if (openStudioCb) {
        openStudioCb({ title: 'Solo practice', artist: '', key: songKey.root, mode: songKey.mode });
      } else {
        setLibType('repertoire');
        switchTab('library');
        seedBackingKey(songKey.root, songKey.mode);
      }
    };
    // The key/mode chip (#keyPickerCompact) is injected + wired by buildKeyPicker; it
    // opens the fly-out on tap (the old #cKey "snap back to key" readout is retired -
    // the chip is the unified key surface now).
    if (el.keyClear) el.keyClear.onclick = function () { songKey.root = null; songKey.explicit = false; keyPopoverOpen = false; buildKeyPicker(); renderKeyView(); renderProg(); renderKey(); buildGrid(); };

    /* ===================== TABS ===================== */
    var ACTIVE_TAB_KEY = prefix + ".activeTab.v1";
    function switchTab(name) {
      // Legacy tab names (setlist / tracks) now resolve to the unified Library screen
      // with the matching type filter pre-selected, so old internal callers + deep
      // links still land in the right place after the 3-tab merge.
      if (name === 'setlist') { STATE.libType = 'set'; try { localStorage.setItem(LIBTYPE_KEY, 'set'); } catch (e) {} name = 'library'; }
      else if (name === 'tracks' || name === 'repertoire') { STATE.libType = 'repertoire'; try { localStorage.setItem(LIBTYPE_KEY, 'repertoire'); } catch (e) {} name = 'library'; }
      try { localStorage.setItem(ACTIVE_TAB_KEY, name); } catch (e) {} // reopen where you left off
      document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
      document.querySelectorAll('.screen').forEach(function (p) { p.classList.toggle('on', p.id === 's-' + name); });
      if (name !== 'practice') stopBeat(); // tempo cue stops when you leave the song screen
      if (name === 'practice') renderPractice();
      if (name === 'library') { renderTypeToggle(); applyLibType(); }
      // leaving the Tune tab: let the chord pack stop any tuner audio
      if (name !== 'tune' && pack && typeof pack.onLeaveTuner === 'function') pack.onLeaveTuner();
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.scrollTop = 0;
      if (el.ctxLine && CONTEXTS[name] != null) el.ctxLine.textContent = CONTEXTS[name];
      if (pack && typeof pack.onSwitchTab === 'function') pack.onSwitchTab(name);
    }
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });

    /* ===================== INIT ===================== */
    rebuildAll();
    renderTypeToggle();
    renderFilterChips();
    renderSongs();
    renderSetlist();
    applyLibType(); // set initial sub-view visibility (Songs | Tracks | Set)
    buildGrid();
    buildKeyPicker();
    renderKeyView();
    renderProgPicks();
    renderProg();

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
      // match by iterating buttons (not a built selector) so a malformed stored value can't
      // throw a selector SyntaxError and abort the restore.
      document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.tab === savedTab) tabExists = true; });
      if (savedTab && savedTab !== 'library' && tabExists) {
        switchTab(savedTab);
      }
    } catch (e) {}

    /* ---- controller ---- */
    return {
      switchTab: switchTab,
      openSong: openPractice,
      getState: function () { return STATE; },
      getSongs: function () { return ALLSONGS.slice(); },
      rebuild: function () { rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist(); }
    };
  }

  /* ---------- public surface ---------- */
  global.Songbook = {
    mount: mount,
    // pure helpers exposed for chord packs / tests
    tpose: tpose,
    tposeLine: tposeLine,
    splitChord: splitChord,
    noteToPc: noteToPc,
    chordRootFreq: chordRootFreq,
    renderSheet: renderSheet,
    chordsFromDegrees: chordsFromDegrees,
    PROGRESSIONS: PROGRESSIONS,
    degreeOf: degreeOf,
    completions: completions,
    ROOTS: ROOTS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Songbook;

})(typeof window !== 'undefined' ? window : this);
