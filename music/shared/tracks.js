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
    var tk = normRoot(t.key), tm = t.mode || 'major';
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
  // note name -> chromatic pitch class (0-11), parsed generically from the letter
  // + any accidentals. Unlike rootIndex (12 sharps + 5 common flats only), this
  // handles every enharmonic spelling circle.js can emit — E#, B#, Cb, Fb and
  // double accidentals — so exotic keys (F# major spells E#, D# minor too) light
  // ALL seven scale tones on the fretboard, matching the note label. -1 if unparseable.
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
  function shortMode(label) { return label.replace(/\s*\(.*\)/, ''); }

  var STORE = 'bt.custom.v1';
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
    + '<div class="bt-results" data-results></div>'
    + '<div class="bt-more" data-more></div>'
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

    var state = { genre: 'all', key: null, mode: 'major', scaleMode: 'ionian', seed: [], custom: [], tracks: [] };
    var elGenre = $('[data-genre]'), elKeys = $('[data-keys]'), elMode = $('[data-modetoggle]');
    var elResults = $('[data-results]'), elMore = $('[data-more]'), elCount = $('[data-count]');
    var elWheel = $('[data-cof]'), elPanel = $('[data-cofpanel]');

    function loadCustom() {
      try { var s = localStorage.getItem(STORE); var a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
      catch (e) { return []; }
    }
    function saveCustom(a) { try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) {} }
    function remerge() { state.tracks = mergeTracks(state.seed, state.custom); }

    function openSearch(q) { window.open(youtubeSearchUrl(q), '_blank', 'noopener'); }
    function openPlayer(t) {
      elPlayer.innerHTML =
        '<div class="bt-pl-box" role="dialog" aria-label="Player">'
        + '<div class="bt-pl-head"><span class="bt-pl-t">' + esc(t.title || '') + '</span>'
        + '<button class="bt-pl-x" type="button">close</button></div>'
        + '<div class="bt-pl-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
        + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div></div>';
      elPlayer.classList.add('on');
      elPlayer.querySelector('.bt-pl-x').onclick = closePlayer;
      elPlayer.onclick = function (e) { if (e.target === elPlayer) closePlayer(); };
    }
    function closePlayer() { elPlayer.classList.remove('on'); elPlayer.classList.remove('studio'); elPlayer.innerHTML = ''; }

    /* ---- the Practice Studio: the track playing + the theory to solo over it ----
     * Scale-first layout: pinned backing track on top, the fretboard scale to
     * solo as the hero, then the chords in the key (tap to hear), then the circle
     * one tap away. Needs the instrument pack (for the fretboard + chord shapes);
     * without one we fall back to the bare player. The iframe never reloads as you
     * scroll the theory below it. */
    function studioTheory(key, mode) {
      var C = global.Circle, k = normRoot(key), rp = rootIndex(k);
      if (!C || rp < 0) return null;
      var scaleMode = familyMode(mode), notes = C.scale(k, scaleMode);
      return {
        key: k, scaleMode: scaleMode, rootPc: rp, notes: notes, pcs: notesToPcs(notes),
        degrees: C.scaleDegrees(scaleMode), chords: C.diatonic(k, scaleMode),
        label: shortMode(C.modeInfo(scaleMode).label)
      };
    }
    function buildWhy(box, th) {
      var C = global.Circle;
      var strip = th.notes.map(function (n, i) {
        return '<div class="cofDeg"><span class="nt">' + esc(n) + '</span><span class="dg">' + esc(th.degrees[i]) + '</span></div>';
      }).join('');
      // player-facing key name: "A minor" reads better than "A Aeolian"
      var keyName = th.scaleMode === 'aeolian' ? 'minor' : th.scaleMode === 'ionian' ? 'major' : th.label;
      box.innerHTML = '<div class="cofScale">' + strip + '</div>'
        + '<div class="cofHint">The notes that sound "right" over this track, with their scale degrees — '
        + esc(th.key) + ' ' + esc(keyName) + '.</div><div class="bt-st-wheel"></div>';
      if (C && C.renderWheel) {
        box.querySelector('.bt-st-wheel').appendChild(C.renderWheel({
          selected: { root: th.key, mode: th.scaleMode === 'aeolian' ? 'minor' : 'major' }
        }));
      }
    }
    function openStudio(t) {
      var th = studioTheory(t.key, t.mode);
      if (!th || !pack) { openPlayer(t); return; }
      var meta = [esc(t.key) + (t.mode === 'minor' ? 'm' : ''), t.bpm ? t.bpm + ' bpm' : '', esc(t.genre || '')]
        .filter(Boolean).join(' · ');
      elPlayer.innerHTML =
        '<div class="bt-studio" role="dialog" aria-label="Practice studio">'
        + '<div class="bt-st-head"><div class="bt-st-id"><span class="bt-st-t">' + esc(t.title || '') + '</span>'
        + '<span class="bt-st-meta">' + meta + '</span></div>'
        + '<button class="bt-st-x" type="button">close</button></div>'
        + '<div class="bt-st-frame"><iframe src="' + esc(embedUrl(t.yt)) + '" title="' + esc(t.title || '') + '" '
        + 'allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe></div>'
        + '<div class="bt-st-body">'
        + '<div class="bt-st-sec"><div class="bt-st-lbl">Solo over it · ' + esc(th.notes.join(' ')) + '</div>'
        + '<div class="bt-st-scale" data-scale></div></div>'
        + '<div class="bt-st-sec"><div class="bt-st-lbl">Chords in this key — tap to hear</div>'
        + '<div class="bt-st-chords" data-chords></div></div>'
        + '<button class="bt-st-why-toggle" data-whytoggle type="button">Why these notes — the circle</button>'
        + '<div class="bt-st-why" data-why hidden></div>'
        + '</div></div>';
      elPlayer.classList.add('on'); elPlayer.classList.add('studio');
      // scale + chords via the shared KeyExplorer (also used by the Compose tab). Read-only
      // here: tap = hear, never add. The studio supplies its own labels + boxes, so the
      // chord render runs unwrapped into [data-chords] with the studio's cell class.
      try {
        global.KeyExplorer.renderScale(elPlayer.querySelector('[data-scale]'), pack, th.rootPc, th.pcs, { frets: 7 });
      } catch (e) {}
      global.KeyExplorer.renderChords(elPlayer.querySelector('[data-chords]'), th.chords, {
        wrap: false,
        cellClass: 'bt-st-chordcell',
        diagram: function (name, size) { var d = pack.diagram(name, size); d.className += ' bt-st-chip'; return d; },
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
      elPlayer.querySelector('.bt-st-x').onclick = closePlayer;
    }

    function activate(t) {
      if (t.yt && navigator.onLine !== false) { pack ? openStudio(t) : openPlayer(t); }
      else openSearch(searchQuery(t));
    }

    function chip(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn;
      return b;
    }
    function rerender() { renderCircle(); renderPanel(); renderGenre(); renderKeys(); renderMode(); renderResults(); }

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
      if (!ch.length) return '<b>' + esc(shortMode(label)) + '</b> — the home scale you measure the others against.';
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
      var el = document.createElement('div');
      el.className = 'bt-card tap';
      el.innerHTML =
        '<div class="bt-row"><span class="bt-title">' + esc(t.title) + '</span>'
        + '<span class="bt-key">' + esc(t.key) + (t.mode === 'minor' ? 'm' : '') + '</span></div>'
        + '<div class="bt-sub">' + esc(t.artist || '') + '</div>'
        + (row.why && row.rank > 0 ? '<div class="bt-why">' + esc(row.why) + '</div>' : '')
        + '<div class="bt-meta"><span>' + esc(t.genre) + '</span>'
        + (t.bpm ? '<span>' + esc(t.bpm) + ' bpm</span>' : '')
        + (t.capo ? '<span>capo ' + esc(t.capo) + '</span>' : '')
        + '<span class="bt-open">' + (t.yt ? 'Play' : 'YouTube') + ' &#8599;</span>'
        + '</div>';
      el.onclick = function () { activate(t); };
      return el;
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
    fetch(tracksUrl).then(function (r) { return r.json(); }).then(function (data) {
      state.seed = Array.isArray(data) ? data : [];
      remerge(); rerender();
    }).catch(function () {
      remerge(); rerender();
      if (!state.tracks.length) elResults.innerHTML = '<div class="bt-empty">Could not load tracks.</div>';
    });
    wireAdd();
    rerender();
  }

  var Tracks = {
    compatibleKeys: compatibleKeys, filterTracks: filterTracks, uniqueGenres: uniqueGenres,
    searchQuery: searchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl,
    embedUrl: embedUrl, parseYouTubeId: parseYouTubeId, mergeTracks: mergeTracks,
    notesToPcs: notesToPcs, mount: mount
  };
  global.Tracks = Tracks;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tracks;

})(typeof window !== 'undefined' ? window : this);
