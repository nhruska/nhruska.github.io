/* Backing Tracks - finder + theory + smart-search + playback + curate
   (Phase 1, T2-T6). Reads tracks.json, merges a localStorage overlay of
   user-saved tracks; filters by genre + key with relative/parallel expansion;
   tapping a card plays it in-app (real yt id, online) or opens a deterministic
   YouTube search (offline / yt:null). Pure functions are exported for Node
   tests; DOM boot only runs in a browser. */
(function () {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT2SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
  var KNOWN_GENRES = ['blues', 'rock', 'jazz', 'funk', 'reggae', 'jam', 'metal',
    'pop', 'soul', 'country', 'lofi', 'lo-fi', 'bossa', 'folk', 'gospel'];
  var STORE = 'bt.custom.v1';

  /* --- pure (testable) music-theory + filter --- */
  function normRoot(r) {
    r = String(r || '').trim();
    if (!r) return '';
    var u = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase(); // canonicalize case
    return FLAT2SHARP[u] || u;                                    // flats -> sharps
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
    var tk = normRoot(t.key), tm = t.mode === 'minor' ? 'minor' : 'major';
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

  /* --- curate (pure parsers; storage/merge below) --- */
  function parseYouTubeId(url) {
    url = String(url || '').trim();
    var m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null;
  }
  function parseTrackFromTitle(title) {
    title = String(title || '').trim();
    var out = { title: title, key: null, mode: 'major', genre: null, bpm: null };
    var b = title.match(/(\d{2,3})\s*bpm/i);
    if (b) out.bpm = parseInt(b[1], 10);
    var k = title.match(/\bin\s+([A-G](?:#|b)?)\s*(minor|min|major|maj|m)?\b/i)
      || title.match(/\b([A-G](?:#|b)?)\s*(minor|min)\b/i)
      || title.match(/\b([A-G](?:#|b)?)(m)\b/);
    if (k) {
      out.key = k[1].charAt(0).toUpperCase() + k[1].slice(1);
      var q = (k[2] || '').toLowerCase();
      if (q === 'm' || q.indexOf('min') === 0) out.mode = 'minor';
    }
    var lt = title.toLowerCase();
    for (var i = 0; i < KNOWN_GENRES.length; i++) {
      if (lt.indexOf(KNOWN_GENRES[i]) >= 0) { out.genre = KNOWN_GENRES[i]; break; }
    }
    return out;
  }
  function mergeTracks(seed, custom) {
    return (Array.isArray(seed) ? seed : []).concat(Array.isArray(custom) ? custom : []);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- DOM boot (browser only) --- */
  function boot() {
    var state = { genre: 'all', key: null, mode: 'major', seed: [], custom: [], tracks: [] };
    var $ = function (id) { return document.getElementById(id); };
    var elGenre = $('genreChips'), elKeys = $('keyChips'), elMode = $('modeToggle');
    var elResults = $('results'), elMore = $('more'), elCount = $('resultCount');
    var elPlayer = $('player');

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
    function closePlayer() { elPlayer.classList.remove('on'); elPlayer.innerHTML = ''; }
    function activate(t) {
      if (t.yt && navigator.onLine !== false) openPlayer(t);
      else openSearch(searchQuery(t));
    }

    function chip(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn;
      return b;
    }
    function rerender() { renderGenre(); renderKeys(); renderMode(); renderResults(); }
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
        elMode.appendChild(chip(m[0], state.mode === m[1], function () { state.mode = m[1]; rerender(); }));
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

    /* curate form */
    function wireAdd() {
      var toggle = $('addToggle'), panel = $('addPanel');
      var aUrl = $('aUrl'), aTitle = $('aTitle'), aKey = $('aKey'),
        aMode = $('aMode'), aGenre = $('aGenre'), aBpm = $('aBpm');
      if (!toggle) return;
      toggle.onclick = function () { panel.hidden = !panel.hidden; if (!panel.hidden) aUrl.focus(); };
      $('aCancel').onclick = function () { panel.hidden = true; };
      aUrl.oninput = function () { aUrl.classList.remove('bad'); };
      aTitle.oninput = function () {
        var p = parseTrackFromTitle(aTitle.value);
        if (!aKey.value && p.key) aKey.value = p.key;
        if (!aGenre.value && p.genre) aGenre.value = p.genre;
        if (!aBpm.value && p.bpm) aBpm.value = p.bpm;
        if (p.mode === 'minor') aMode.value = 'minor';
      };
      $('aSave').onclick = function () {
        var id = parseYouTubeId(aUrl.value);
        var key = normRoot(aKey.value);
        if (!id) { aUrl.focus(); aUrl.classList.add('bad'); return; }
        if (!key || rootIndex(key) < 0) { aKey.focus(); aKey.classList.add('bad'); return; }
        var entry = {
          yt: id, title: aTitle.value.trim() || ('My track ' + id),
          genre: aGenre.value.trim().toLowerCase() || 'other',
          key: key, mode: aMode.value === 'minor' ? 'minor' : 'major',
          bpm: aBpm.value ? parseInt(aBpm.value, 10) : null, capo: 0, custom: true
        };
        state.custom.push(entry); saveCustom(state.custom); remerge();
        aUrl.value = aTitle.value = aKey.value = aGenre.value = aBpm.value = '';
        aUrl.classList.remove('bad'); aKey.classList.remove('bad');
        panel.hidden = true; rerender();
      };
    }

    state.seed = [];
    state.custom = loadCustom();
    fetch('tracks.json').then(function (r) { return r.json(); }).then(function (data) {
      state.seed = Array.isArray(data) ? data : [];
      remerge(); rerender();
    }).catch(function () {
      remerge(); rerender();
      if (!state.tracks.length) elResults.innerHTML = '<div class="bt-empty">Could not load tracks.</div>';
    });
    wireAdd();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
      });
    }
  }

  if (typeof document !== 'undefined') boot();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      compatibleKeys: compatibleKeys, filterTracks: filterTracks, uniqueGenres: uniqueGenres,
      searchQuery: searchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl,
      embedUrl: embedUrl, parseYouTubeId: parseYouTubeId, parseTrackFromTitle: parseTrackFromTitle,
      mergeTracks: mergeTracks
    };
  }
})();
