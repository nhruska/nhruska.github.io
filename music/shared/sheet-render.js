/* =====================================================================
 * sheet-render.js  -  chord-over-lyric sheet rendering (instrument-agnostic)
 * ---------------------------------------------------------------------
 * Turns a song's sheet model into HTML: HTML-escaping of user tokens, the
 * key-aware DISPLAY speller, chord-over-lyric line rendering, the
 * chords-only / lyrics-only / both views, and the fit-to-viewport scale.
 * Renders chord NAMES only - no instrument knowledge. Builds on theory.js
 * for transposition; escaping delegates to esc.js.
 *
 * No build step. Classic script. Exposes a single global: `SongbookSheet`.
 * Loads AFTER theory.js and BEFORE songbook.js, which rebinds these names.
 * ===================================================================== */
(function (global) {
  'use strict';

  // theory primitives (theory.js, loaded first) - rebind the ones this layer uses
  var T = global.SongbookTheory || (typeof require === 'function' ? require('./theory.js') : null);
  var ROOTS = T.ROOTS;
  var tpose = T.tpose;
  var tposeLine = T.tposeLine;

  /* ---------- sheet rendering (chord-over-lyric, instrument-agnostic) ---------- */
  // Escape EVERYTHING interpolated into sheet/chip innerHTML: custom songs and
  // the localStorage import path accept freeform tokens, so chord names and
  // section labels are user-controlled strings, not trusted vocabulary. The
  // quote entity makes the same helper safe inside attribute values.
  // Delegates to the shared esc.js (loaded before this file everywhere it's
  // consumed) - the one HTML-escaper (see decisions.md: D-HARDEN). Name kept
  // escHTML (not esc) so this file's call sites are unchanged.
  function escHTML(s) { return global.Esc.esc(s); }

  // A view-local key-aware DISPLAY speller.
  // Given a stated key (canonical-sharp token) + mode it returns token->display,
  // routing chord ROOTS through Circle.noteInKey so the bVII of F reads Bb, never
  // A# - the same regime-B contract the Studio/Compose surfaces already honor.
  // The KEY it is given is already in the transposed domain (soloKeyFor moves the
  // key with STATE.transpose) and so are the TOKENS fed in (renderSheet tposes
  // before calling), so no second transpose happens here - both live in one
  // domain. Keyless progressions (no key, or Circle absent) fall back to the raw
  // token unchanged, matching the "keyless contexts stay canonical-sharp" rule.
  // The quality suffix (m7, dim, ...) is preserved verbatim; only the root respells.
  function chordSpeller(key, mode) {
    var C = global.Circle;
    if (!key || !C || !C.noteInKey) return function (tok) { return tok; };
    return function (tok) {
      var t = String(tok == null ? '' : tok);
      var m = /^([A-Ga-g][#b]?)(.*)$/.exec(t.trim());
      if (!m) return tok;
      try { return C.noteInKey(key, mode, m[1]) + m[2]; }
      catch (e) { return tok; }
    };
  }
  // `map` (optional) is a token->display speller from chordSpeller. When absent,
  // the raw (canonical-sharp) token renders - preserving every keyless caller's
  // behavior. Column alignment keys off the DISPLAYED label's length so a
  // respelled name (A# -> Bb, same width; and any exotic double-accidental) never
  // shifts the chord row off its lyric.
  function renderLyricLine(raw, map) {
    var chordRow = "", lyricRow = "", last = 0, m;
    var re = /\[([^\]]+)\]/g;
    while ((m = re.exec(raw))) {
      var before = raw.slice(last, m.index);
      var label = map ? map(m[1]) : m[1];
      lyricRow += before;
      chordRow += " ".repeat(before.length);
      chordRow += label;
      lyricRow += " ".repeat(label.length);
      last = re.lastIndex;
    }
    lyricRow += raw.slice(last);
    return '<div class="lyrLine"><span class="crd">' + escHTML(chordRow) + '</span>\n' + escHTML(lyricRow) + '</div>';
  }
  // The action-ladder class for the song-view
  // remove/revert button. A real destructive delete is the `danger` primitive
  // (was mislabeled `.ghost`, the low-emphasis look); a fork's "Revert to
  // original" is NOT destructive of a user creation (it restores the catalog
  // song), so it keeps `ghost`. Both span the row via the `.full` class
  // (`.actions .btn.full{flex-basis:100%}`) rather than an inline flexBasis style.
  // Pure + exported so the class contract has a real regression test.
  function deleteBtnClass(isFork) { return isFork ? 'btn ghost full' : 'btn danger full'; }
  function renderChordOnly(sheet, st, map) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var re = /\[([^\]]+)\]/g, m, cs = [];
      while ((m = re.exec(line))) cs.push(tpose(m[1], st));
      if (cs.length) out.push('<div class="chordOnly">' + cs.map(function (c) { return '<span class="bar">' + escHTML(map ? map(c) : c) + '</span>'; }).join(' ') + '</div>');
    });
    return out.join('');
  }
  // Lyrics with the [chord] tokens stripped - the sing-along view. Lines that
  // were pure chord calls (all tokens, no words) vanish rather than leaving
  // blank rows.
  function renderLyricsOnly(sheet) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var lyr = line.replace(/\[([^\]]+)\]/g, '').replace(/[ ]{2,}/g, ' ');
      if (lyr.trim().length) out.push('<div class="lyrLine">' + escHTML(lyr) + '</div>');
    });
    return out.join('');
  }
  // view: 'chords' = chord bars only; 'lyrics' = lyrics only (no chord row);
  // 'both' (default) = chords positioned over lyrics.
  function renderSheet(song, st, view, map) {
    if (view === 'chords') return renderChordOnly(song.sheet, st, map);
    if (view === 'lyrics') return renderLyricsOnly(song.sheet);
    var html = '', last = null;
    song.sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { html += '<div class="sect">' + escHTML(sect) + '</div>'; last = sect; }
      html += renderLyricLine(tposeLine(line, st), map);
    });
    return html;
  }
  // Stage/Perform auto-fit scale: shrinks the sheet until it fits BOTH the
  // available height AND width, or grows a short song up to a cap. Lyric lines
  // render with white-space:pre (no wrapping), so a height-only fit lets a
  // short song scale up past its own width and clip words off-screen - width
  // must always be allowed to win. Pure + Node-testable; DOM callers pass real
  // measurements (see applyPerfFont).
  function fitScale(availH, needH, availW, needW) {
    var heightScale = needH > 0 ? availH / needH : Infinity;
    var widthScale = needW > 0 ? availW / needW : Infinity;
    var scale = Math.min(heightScale, widthScale);
    if (!isFinite(scale)) scale = 1;
    return Math.max(0.5, Math.min(2.2, scale));
  }
  global.SongbookSheet = {
    escHTML: escHTML,
    chordSpeller: chordSpeller,
    renderLyricLine: renderLyricLine,
    deleteBtnClass: deleteBtnClass,
    renderChordOnly: renderChordOnly,
    renderLyricsOnly: renderLyricsOnly,
    renderSheet: renderSheet,
    fitScale: fitScale
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SongbookSheet;

})(typeof window !== 'undefined' ? window : this);
