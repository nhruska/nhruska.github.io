/* Backing Tracks - finder + theory expansion + smart search (Phase 1, T2-T4).
   Reads tracks.json; filters by genre + key, widens via relative/parallel keys,
   and every card / the "search more" button opens a deterministic YouTube
   backing-track search (no API key, works offline). Pure functions are exported
   for Node tests; DOM boot only runs in a browser. */
(function () {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT2SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

  /* --- pure (testable) music-theory + filter --- */
  function normRoot(r) { r = String(r || ''); return FLAT2SHARP[r] || r; }
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- DOM boot (browser only) --- */
  function boot() {
    var state = { genre: 'all', key: null, mode: 'major', tracks: [] };
    var elGenre = document.getElementById('genreChips');
    var elKeys = document.getElementById('keyChips');
    var elMode = document.getElementById('modeToggle');
    var elResults = document.getElementById('results');
    var elMore = document.getElementById('more');
    var elCount = document.getElementById('resultCount');

    function openSearch(q) { window.open(youtubeSearchUrl(q), '_blank', 'noopener'); }
    function chip(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : '');
      b.textContent = label;
      b.onclick = fn;
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
      elKeys.appendChild(chip('Any key', state.key === null,
        function () { state.key = null; rerender(); }));
      ROOTS.forEach(function (k) {
        elKeys.appendChild(chip(k, state.key === k, function () { state.key = k; rerender(); }));
      });
    }
    function renderMode() {
      elMode.innerHTML = '';
      [['maj', 'major'], ['min', 'minor']].forEach(function (m) {
        elMode.appendChild(chip(m[0], state.mode === m[1],
          function () { state.mode = m[1]; rerender(); }));
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
        + '<span class="bt-open">YouTube &#8599;</span>'
        + '</div>';
      el.onclick = function () { openSearch(searchQuery(t)); };
      return el;
    }
    function moreButton(label, q) {
      elMore.innerHTML = '';
      var b = document.createElement('button');
      b.className = 'bt-more-btn';
      b.innerHTML = esc(label) + ' <span class="ar">&#8599;</span>';
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

    fetch('tracks.json').then(function (r) { return r.json(); }).then(function (data) {
      state.tracks = Array.isArray(data) ? data : [];
      rerender();
    }).catch(function () {
      elResults.innerHTML = '<div class="bt-empty">Could not load tracks.</div>';
    });

    /* same service worker as the rest of the Music app (scope /music/) */
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
      searchQuery: searchQuery, filterQuery: filterQuery, youtubeSearchUrl: youtubeSearchUrl
    };
  }
})();
