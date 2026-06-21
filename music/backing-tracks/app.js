/* Backing Tracks - finder (Phase 1, T2).
   Reads tracks.json and filters by genre + key. Pure filter (matchesTrack)
   is exported for Node unit tests; DOM boot only runs in a browser. */
(function () {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /* --- pure (testable) --- */
  function matchesTrack(t, genre, key) {
    if (genre && genre !== 'all' && t.genre !== genre) return false;
    if (key && t.key !== key) return false;
    return true;
  }
  function uniqueGenres(tracks) {
    var set = {};
    tracks.forEach(function (t) { if (t.genre) set[t.genre] = true; });
    return Object.keys(set).sort();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- DOM boot (browser only) --- */
  function boot() {
    var state = { genre: 'all', key: null, tracks: [] };
    var elGenre = document.getElementById('genreChips');
    var elKeys = document.getElementById('keyChips');
    var elResults = document.getElementById('results');
    var elCount = document.getElementById('resultCount');

    function renderGenreChips() {
      var genres = ['all'].concat(uniqueGenres(state.tracks));
      elGenre.innerHTML = '';
      genres.forEach(function (g) {
        var b = document.createElement('button');
        b.className = 'chip' + (g === state.genre ? ' on' : '');
        b.textContent = g === 'all' ? 'All genres' : g;
        b.onclick = function () { state.genre = g; renderGenreChips(); renderResults(); };
        elGenre.appendChild(b);
      });
    }
    function renderKeyChips() {
      elKeys.innerHTML = '';
      var any = document.createElement('button');
      any.className = 'chip' + (state.key === null ? ' on' : '');
      any.textContent = 'Any key';
      any.onclick = function () { state.key = null; renderKeyChips(); renderResults(); };
      elKeys.appendChild(any);
      ROOTS.forEach(function (k) {
        var b = document.createElement('button');
        b.className = 'chip' + (state.key === k ? ' on' : '');
        b.textContent = k;
        b.onclick = function () { state.key = k; renderKeyChips(); renderResults(); };
        elKeys.appendChild(b);
      });
    }
    function cardEl(t) {
      var el = document.createElement('div');
      el.className = 'bt-card';
      el.innerHTML =
        '<div class="bt-row"><span class="bt-title">' + esc(t.title) + '</span>'
        + '<span class="bt-key">' + esc(t.key) + (t.mode === 'minor' ? 'm' : '') + '</span></div>'
        + '<div class="bt-sub">' + esc(t.artist || '') + '</div>'
        + '<div class="bt-meta"><span>' + esc(t.genre) + '</span>'
        + (t.bpm ? '<span>' + esc(t.bpm) + ' bpm</span>' : '')
        + (t.capo ? '<span>capo ' + esc(t.capo) + '</span>' : '')
        + '</div>';
      return el;
    }
    function renderResults() {
      var list = state.tracks.filter(function (t) { return matchesTrack(t, state.genre, state.key); });
      elResults.innerHTML = '';
      if (!list.length) {
        elResults.innerHTML = '<div class="bt-empty">No tracks for that genre + key yet.'
          + '<div class="sub">smart YouTube search lands in T4</div></div>';
        elCount.textContent = '';
        return;
      }
      list.forEach(function (t) { elResults.appendChild(cardEl(t)); });
      elCount.textContent = list.length + (list.length === 1 ? ' track' : ' tracks');
    }

    fetch('tracks.json').then(function (r) { return r.json(); }).then(function (data) {
      state.tracks = Array.isArray(data) ? data : [];
      renderGenreChips();
      renderKeyChips();
      renderResults();
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
    module.exports = { matchesTrack: matchesTrack, uniqueGenres: uniqueGenres };
  }
})();
