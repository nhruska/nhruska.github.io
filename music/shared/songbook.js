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
  // root frequency of a chord, relative to middle C (used for the chord-chip tap tone)
  function chordRootFreq(ch) {
    var p = splitChord(ch);
    if (!p) return 261.63;
    var i = ROOTS.indexOf(p.root);
    if (i < 0) return 261.63;
    return 261.63 * Math.pow(2, i / 12);
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
   *     songsList, decadeChips, search, libCount,
   *     // practice
   *     practiceEmpty, practiceBody,
   *     // setlist
   *     setBody, setBar, setCount, setClear, performBtn,
   *     // perform
   *     perform, pSheet, pPos, pTitle, pArtist, pKeyLine,
   *     pPrev, pNext, pClose, pUp, pDown, pDimBtn, pScroll,
   *     pSpeed, pSpeedR, pSpeedV,
   *     // compose (optional; needs a chord pack for diagrams/audio)
   *     prog, suggest, catChips, buildGrid, cClear, cSave, cMax,
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
    var DECADES = opts.decades || ["All", "70s", "80s", "90s", "00s", "10s"];
    var CONTEXTS = opts.contexts || {};
    var CATS = opts.composeCats || {
      "Major": ["C", "D", "E", "F", "G", "A", "B"],
      "Minor": ["Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm"],
      "7th": ["C7", "D7", "E7", "F7", "G7", "A7", "B7"],
      "Maj7": ["Cmaj7", "Dmaj7", "Emaj7", "Fmaj7", "Gmaj7", "Amaj7", "Bmaj7"],
      "Min7": ["Cm7", "Dm7", "Em7", "Fm7", "Gm7", "Am7", "Bm7"]
    };
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
    var STATE = {
      search: "", decade: "All", current: null, transpose: 0, view: "lyrics",
      setlist: [], performIdx: 0, performDim: false, performTpose: 0,
      scrolling: false, scrollSpeed: 28, scrollRAF: null, wakeLock: null
    };
    STATE.setlist = loadSet();
    function songById(id) { for (var i = 0; i < ALLSONGS.length; i++) if (ALLSONGS[i].id === id) return ALLSONGS[i]; return null; }

    /* ===================== LIBRARY ===================== */
    function renderDecadeChips() {
      if (!el.decadeChips) return;
      el.decadeChips.innerHTML = '';
      var ds = DECADES.concat(customSongs.length ? ['Mine'] : []);
      ds.forEach(function (d) {
        var b = document.createElement('button');
        b.className = 'chip' + (d === STATE.decade ? ' on' : '');
        b.textContent = d;
        b.onclick = function () { STATE.decade = d; renderDecadeChips(); renderSongs(); };
        el.decadeChips.appendChild(b);
      });
    }
    function songMatches(s) {
      if (STATE.decade === "Mine" && !s.custom) return false;
      if (STATE.decade !== "All" && STATE.decade !== "Mine" && s.d !== STATE.decade) return false;
      if (STATE.search) {
        var q = STATE.search.toLowerCase();
        return s.t.toLowerCase().indexOf(q) >= 0 || s.a.toLowerCase().indexOf(q) >= 0;
      }
      return true;
    }
    function renderSongs() {
      if (!el.songsList) return;
      var filtered = ALLSONGS.filter(function (s) { return songMatches(s); });
      if (filtered.length === 0) {
        el.songsList.innerHTML = '<div class="empty">No songs match.</div>';
        if (el.libCount) el.libCount.textContent = '';
        return;
      }
      el.songsList.innerHTML = '';
      filtered.forEach(function (s) {
        var inSet = STATE.setlist.indexOf(s.id) >= 0;
        var card = document.createElement('div');
        card.className = 'songCard' + (inSet ? ' inSet' : '');
        var badge = s.custom ? '<span class="dot"></span><span>mine</span>' : '';
        card.innerHTML = '<button class="addBtn">' + (inSet ? '✓' : '+') + '</button>'
          + '<div class="row1"><div><div class="title">' + escHTML(s.t) + '</div><div class="artist">' + escHTML(s.a) + '</div></div><div class="yr">&#39;' + String(s.y).slice(-2) + '</div></div>'
          + '<div class="meta"><span class="chds">' + s.seq.join(' · ') + '</span><span class="dot"></span><span>' + s.seq.length + ' chords</span>' + badge + '</div>';
        card.querySelector('.addBtn').onclick = function (e) { e.stopPropagation(); toggleSet(s.id); };
        card.onclick = function () { openPractice(s.id); };
        el.songsList.appendChild(card);
      });
      if (el.libCount) el.libCount.textContent = filtered.length + ' of ' + ALLSONGS.length + ' songs';
    }
    if (el.search) el.search.oninput = function () { STATE.search = el.search.value; renderSongs(); };

    /* ===================== PRACTICE ===================== */
    function openPractice(id) {
      STATE.current = songById(id);
      STATE.transpose = 0;
      STATE.view = STATE.current && STATE.current.custom ? "chords" : "lyrics";
      switchTab('practice');
      renderPractice();
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
      var s = STATE.current;
      var seq = s.seq.map(function (c) { return tpose(c, STATE.transpose); });
      var inSet = STATE.setlist.indexOf(s.id) >= 0;
      var lyricsURL = "https://genius.com/search?q=" + encodeURIComponent(s.t + " " + s.a);
      var maxBtn = pack ? '<button class="iconBtn" id="maxOpenBtn" title="Maximize chords">⤢</button>' : '';
      el.practiceBody.innerHTML =
        '<div class="detail">'
        + '<div class="detailHead"><div class="ti"><h2>' + escHTML(s.t) + '</h2><p>' + escHTML(s.a) + ' · ' + s.y + '</p></div>' + maxBtn + '</div>'
        + '<div class="ctrl"><div class="pill"><button id="tDown">−</button><div><div class="lbl">Key</div><div class="v" id="keyV">' + seq[0] + '</div></div><button id="tUp">+</button></div></div>'
        + '<div class="viewToggle"><button class="' + (STATE.view === 'lyrics' ? 'on' : '') + '" data-v="lyrics">Lyrics + Chords</button><button class="' + (STATE.view === 'chords' ? 'on' : '') + '" data-v="chords">Chord chart</button></div>'
        + '<div class="chordChips">' + seq.map(function (c) { return '<span class="c" data-c="' + c + '">' + c + '</span>'; }).join('') + '</div>'
        + '<div class="sheet" id="sheetBox">' + renderSheet(s, STATE.transpose, s.custom ? 'chords' : STATE.view) + '</div>'
        + '<div class="actions"><button class="btn ' + (inSet ? 'red' : '') + '" id="setToggle">' + (inSet ? '✓ In setlist' : '+ Add to setlist') + '</button><button class="btn ghost" id="backLib">← Library</button></div>'
        + '<a class="lyricsLink" href="' + lyricsURL + '" target="_blank" rel="noopener">Full lyrics on Genius ↗</a>'
        + '<p class="note">Sheet shows a short representative snippet. Full lyrics open on a licensed site.</p>'
        + '</div>';
      el.practiceBody.querySelector('#tDown').onclick = function () { shiftKey(-1); };
      el.practiceBody.querySelector('#tUp').onclick = function () { shiftKey(1); };
      el.practiceBody.querySelectorAll('.viewToggle button').forEach(function (b) { b.onclick = function () { STATE.view = b.dataset.v; renderPractice(); }; });
      el.practiceBody.querySelectorAll('.chordChips .c').forEach(function (elc) { elc.onclick = function () { packPlayChord(elc.dataset.c); }; });
      el.practiceBody.querySelector('#setToggle').onclick = function () { toggleSet(s.id); renderPractice(); renderSongs(); renderSetlist(); };
      el.practiceBody.querySelector('#backLib').onclick = function () { switchTab('library'); };
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
      if (STATE.setlist.length === 0) {
        body.innerHTML = '<div class="setEmpty">Your setlist is empty.<br>Add songs with the + button.</div>';
        if (bar) bar.style.display = 'none';
        if (count) count.textContent = 'No songs yet';
        return;
      }
      if (count) count.textContent = STATE.setlist.length + ' song' + (STATE.setlist.length > 1 ? 's' : '') + ' · ready to play';
      body.innerHTML = '';
      STATE.setlist.forEach(function (sid, i) {
        var s = songById(sid); if (!s) return;
        var it = document.createElement('div'); it.className = 'setItem';
        it.innerHTML = '<div class="num">' + (i + 1) + '</div><div class="body"><div class="t">' + escHTML(s.t) + '</div><div class="a">' + escHTML(s.a) + ' · ' + s.y + '</div><div class="c">' + s.seq.join(' · ') + '</div></div>'
          + '<div class="setCtrl"><button data-act="up" ' + (i === 0 ? 'disabled' : '') + '>▲</button><button data-act="dn" ' + (i === STATE.setlist.length - 1 ? 'disabled' : '') + '>▼</button></div><button class="rm" data-act="rm">×</button>';
        it.querySelector('[data-act=up]').onclick = function () { if (i > 0) { var a = STATE.setlist[i - 1]; STATE.setlist[i - 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); renderSetlist(); } };
        it.querySelector('[data-act=dn]').onclick = function () { if (i < STATE.setlist.length - 1) { var a = STATE.setlist[i + 1]; STATE.setlist[i + 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); renderSetlist(); } };
        it.querySelector('[data-act=rm]').onclick = function () { STATE.setlist.splice(i, 1); saveSet(); renderSetlist(); renderSongs(); };
        it.querySelector('.body').onclick = function () { openPractice(sid); };
        body.appendChild(it);
      });
      if (bar) bar.style.display = 'flex';
    }
    if (el.setClear) el.setClear.onclick = function () {
      if (STATE.setlist.length === 0) return;
      if (confirm('Clear your setlist?')) { STATE.setlist = []; saveSet(); renderSetlist(); renderSongs(); }
    };

    /* ===================== PERFORM ===================== */
    var performEl = el.perform, pSheet = el.pSheet;
    function reqWake() { try { if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').then(function (w) { STATE.wakeLock = w; }, function () { }); } } catch (e) { } }
    function relWake() { try { if (STATE.wakeLock) { STATE.wakeLock.release(); STATE.wakeLock = null; } } catch (e) { } }
    if (el.performBtn) el.performBtn.onclick = function () {
      if (STATE.setlist.length === 0) return;
      STATE.performIdx = 0; STATE.performDim = false; STATE.performTpose = 0;
      if (performEl) performEl.classList.remove('dim');
      stopScroll(); showPerform();
      if (performEl) performEl.classList.add('on');
      reqWake();
    };
    if (el.pClose) el.pClose.onclick = function () { stopScroll(); relWake(); if (performEl) performEl.classList.remove('on'); };
    if (el.pPrev) el.pPrev.onclick = function () { if (STATE.performIdx > 0) { STATE.performIdx--; STATE.performTpose = 0; showPerform(); } };
    if (el.pNext) el.pNext.onclick = function () {
      if (STATE.performIdx < STATE.setlist.length - 1) { STATE.performIdx++; STATE.performTpose = 0; showPerform(); }
      else { stopScroll(); relWake(); if (performEl) performEl.classList.remove('on'); }
    };
    if (el.pDown) el.pDown.onclick = function () { perfShift(-1); };
    if (el.pUp) el.pUp.onclick = function () { perfShift(1); };
    if (el.pDimBtn) el.pDimBtn.onclick = function () { STATE.performDim = !STATE.performDim; if (performEl) performEl.classList.toggle('dim', STATE.performDim); };
    function perfShift(dir) {
      var s = songById(STATE.setlist[STATE.performIdx]);
      var cur = STATE.performTpose;
      for (var n = 1; n <= 6; n++) {
        var cand = cur + dir * n;
        if (Math.abs(cand) > 6) break;
        if (seqPlayable(s.seq, cand)) { STATE.performTpose = cand; showPerform(); return; }
      }
    }
    function showPerform() {
      var s = songById(STATE.setlist[STATE.performIdx]);
      if (!s) return;
      if (el.pPos) el.pPos.textContent = (STATE.performIdx + 1) + ' / ' + STATE.setlist.length;
      if (el.pTitle) el.pTitle.textContent = s.t;
      if (el.pArtist) el.pArtist.textContent = s.a + ' · ' + s.y;
      var seq = s.seq.map(function (c) { return tpose(c, STATE.performTpose); });
      if (el.pKeyLine) el.pKeyLine.textContent = (STATE.performTpose !== 0 ? 'Key ' + seq[0] + '  ·  ' : '') + seq.join('  ');
      if (pSheet) { pSheet.innerHTML = renderSheet(s, STATE.performTpose, s.custom ? 'chords' : 'lyrics'); pSheet.scrollTop = 0; }
      if (el.pNext) el.pNext.textContent = (STATE.performIdx === STATE.setlist.length - 1) ? '✓' : '→';
    }
    /* auto-scroll */
    if (el.pSpeedR) el.pSpeedR.oninput = function () { STATE.scrollSpeed = +el.pSpeedR.value; if (el.pSpeedV) el.pSpeedV.textContent = el.pSpeedR.value; };
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
      if (el.pSpeed) el.pSpeed.classList.remove('on');
    }
    if (el.pScroll) el.pScroll.onclick = function () { STATE.scrolling ? stopScroll() : startScroll(); };
    if (pSheet) pSheet.onclick = function () { if (STATE.scrolling) stopScroll(); };

    /* ===================== COMPOSE (needs chord pack for diagrams/audio) ===================== */
    var progression = [];
    function packDiagram(name, size) {
      if (pack && typeof pack.diagram === 'function') return pack.diagram(name, size);
      var wrap = document.createElement('div');
      wrap.className = (size === 'big') ? 'bigC' : 'chord';
      wrap.innerHTML = '<span class="' + (size === 'big' ? 'nm' : 'chord-name') + '">' + name + '</span>';
      return wrap;
    }
    function renderProg() {
      if (!el.prog) return;
      el.prog.innerHTML = '';
      progression.forEach(function (c, i) {
        var slot = document.createElement('div'); slot.className = 'slot';
        var d = packDiagram(c, 'small'); d.onclick = function () { packPlayChord(c); };
        slot.appendChild(d);
        var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×';
        rm.onclick = function (e) { e.stopPropagation(); progression.splice(i, 1); renderProg(); renderSuggest(); };
        slot.appendChild(rm);
        el.prog.appendChild(slot);
      });
      renderSuggest();
    }
    function addChord(c) { if (progression.length >= 8) return; progression.push(c); renderProg(); }
    function buildGrid() {
      if (!el.catChips || !el.buildGrid) return;
      var chips = el.catChips, grid = el.buildGrid, active = Object.keys(CATS)[0] || "Major";
      function draw() {
        chips.innerHTML = '';
        Object.keys(CATS).forEach(function (cat) {
          var b = document.createElement('button');
          b.className = 'chip' + (cat === active ? ' on' : '');
          b.textContent = cat;
          b.onclick = function () { active = cat; draw(); };
          chips.appendChild(b);
        });
        grid.innerHTML = '';
        (CATS[active] || []).forEach(function (c) {
          var d = packDiagram(c, 'small');
          d.onclick = function () { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); };
          grid.appendChild(d);
        });
      }
      draw();
    }
    function suggestFor(ch) {
      if (SUGG[ch]) return SUGG[ch];
      var base = ch.replace(/(maj7|m7|7)$/, '');
      if (SUGG[base]) return SUGG[base];
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
    function renderSuggest() {
      if (!el.suggest) return;
      if (progression.length === 0) { el.suggest.innerHTML = ''; return; }
      var picks = suggestNext(progression);
      if (!picks.length) { el.suggest.innerHTML = ''; return; }
      var n = progression.length;
      var label = n === 1 ? "Add a 2nd chord:" : n === 2 ? "Add a 3rd chord:" : n === 3 ? "Add a 4th chord:" : "Next chord:";
      var html = '<div class="suggLbl">' + label + '</div><div class="suggRow">';
      picks.forEach(function (c) { html += '<button class="suggBtn" data-c="' + c + '">' + c + '</button>'; });
      html += '</div>';
      el.suggest.innerHTML = html;
      el.suggest.querySelectorAll('.suggBtn').forEach(function (b) { b.onclick = function () { addChord(b.dataset.c); packPlayChord(b.dataset.c); }; });
    }
    function saveProgression() {
      if (progression.length === 0) { alert('Build a progression first.'); return; }
      var name = prompt('Name this progression:', 'My progression');
      if (name === null) return;
      name = name.trim() || 'My progression';
      var cs = { id: 'm' + Date.now(), t: name, a: 'My progression', y: new Date().getFullYear(), d: 'Mine', seq: progression.slice(), custom: true };
      customSongs.push(cs); saveCustom(); rebuildAll(); renderDecadeChips(); renderSongs();
      alert('Saved to your Songs (filter "Mine"). You can add it to a setlist and perform it.');
    }
    if (el.cClear) el.cClear.onclick = function () { progression = []; renderProg(); };
    if (el.cSave) el.cSave.onclick = saveProgression;
    if (el.cMax) el.cMax.onclick = function () { if (progression.length) openMaxWith(progression.slice()); };

    /* ===================== TABS ===================== */
    function switchTab(name) {
      document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
      document.querySelectorAll('.screen').forEach(function (p) { p.classList.toggle('on', p.id === 's-' + name); });
      if (name === 'setlist') renderSetlist();
      if (name === 'practice') renderPractice();
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
    renderDecadeChips();
    renderSongs();
    renderSetlist();
    buildGrid();
    renderProg();

    // Give the chord pack a chance to wire its own UI (e.g. the Tune tab).
    if (pack && typeof pack.init === 'function') {
      pack.init({
        switchTab: switchTab,
        chordRootFreq: chordRootFreq,
        tpose: tpose
      });
    }

    /* ---- controller ---- */
    return {
      switchTab: switchTab,
      openSong: openPractice,
      getState: function () { return STATE; },
      getSongs: function () { return ALLSONGS.slice(); },
      rebuild: function () { rebuildAll(); renderDecadeChips(); renderSongs(); renderSetlist(); }
    };
  }

  /* ---------- public surface ---------- */
  global.Songbook = {
    mount: mount,
    // pure helpers exposed for chord packs / tests
    tpose: tpose,
    tposeLine: tposeLine,
    splitChord: splitChord,
    chordRootFreq: chordRootFreq,
    renderSheet: renderSheet,
    ROOTS: ROOTS
  };

})(typeof window !== 'undefined' ? window : this);
