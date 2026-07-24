/* =====================================================================
 * sheet-render.js  -  chord-over-lyric sheet rendering (instrument-agnostic)
 * ---------------------------------------------------------------------
 * Turns a song's sheet model into HTML: HTML-escaping of user tokens, the
 * key-aware DISPLAY speller, chord-over-lyric line rendering, and the
 * chords-only / lyrics-only / both views. Sizing model is WRAP-FIRST
 * (operator-approved 2026-07-24): the font is a readable size the USER
 * controls; long lines WRAP at the caller's measured character budget.
 * There is deliberately NO fit-to-viewport auto-shrink in this layer.
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
  // `maxChars` (optional, CW-1): when a line's rendered LYRIC row would be
  // wider than the caller's measured viewport (in characters, monospace), wrap
  // it into multiple `.lyrLine` rows instead of rendering one unbroken
  // `white-space:pre` line that hard-overflows the stage view (unreadable
  // mid-performance, both hands on the instrument). Wrapping happens HERE, in
  // JS, at explicit indices shared by both rows - never via CSS soft-wrap -
  // because chordRow/lyricRow only stay column-aligned if both break at the
  // IDENTICAL character offset, and letting the browser word-wrap the chord
  // span and the lyric text node independently (different word/space layout in
  // each) desyncs them. See wrapChordLyricPair for the split algorithm.
  function renderLyricLine(raw, map, maxChars) {
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
    if (!maxChars || lyricRow.length <= maxChars) return oneLyrLine(chordRow, lyricRow);
    return wrapChordLyricPair(chordRow, lyricRow, maxChars).map(function (r) {
      return oneLyrLine(r.chord, r.lyric);
    }).join('');
  }
  function oneLyrLine(chordRow, lyricRow) {
    return '<div class="lyrLine"><span class="crd">' + escHTML(chordRow) + '</span>\n' + escHTML(lyricRow) + '</div>';
  }
  // Splits a (chordRow, lyricRow) pair into synced chunks no wider than
  // maxChars characters each. chordRow is always <= lyricRow.length (it stops
  // after the last chord token; any lyric tail beyond that has no chord to
  // align, which is correct - JS String#slice clamps past chordRow's end and
  // yields '' for those columns). Every cut index is applied identically to
  // BOTH rows, which is what keeps a wrapped chord glued to its lyric: since
  // both rows are built column-for-column in lockstep (renderLyricLine above),
  // slicing them at the same index can never desync a chord from its word.
  // Prefers to cut at the last lyric-row SPACE within the window (never splits
  // a sung word) and falls back to a hard character cut only when a single
  // unbroken run (no space at all) exceeds maxChars on its own - the same
  // last-resort every wrapping scheme (CSS overflow-wrap:anywhere included)
  // has to take for an unbreakable token. Pure + Node-testable, no DOM - the
  // DOM caller (songbook.js fitStageSheet/perfWrapMaxChars) measures the
  // viewport and passes the character budget in.
  function wrapChordLyricPair(chordRow, lyricRow, maxChars) {
    var rows = [], start = 0, total = lyricRow.length;
    while (total - start > maxChars) {
      var limit = start + maxChars, cut = -1;
      for (var i = limit; i > start; i--) { if (lyricRow[i] === ' ') { cut = i; break; } }
      if (cut <= start) cut = limit; // no space in the window - hard cut (one long unbreakable token)
      rows.push({ chord: chordRow.slice(start, cut), lyric: lyricRow.slice(start, cut) });
      start = (lyricRow[cut] === ' ') ? cut + 1 : cut; // drop the boundary space itself, don't waste a column on it
    }
    rows.push({ chord: chordRow.slice(start), lyric: lyricRow.slice(start) });
    return rows;
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
  // blank rows. `maxChars` (optional, wrap-first model): a lyrics-only line is
  // still white-space:pre in the stage sheet, so a long one must WRAP at the
  // caller's character budget too - reuse wrapChordLyricPair with an empty
  // chord row (no alignment constraint here, but the same last-space-in-window
  // cut keeps sung words whole and the row widths consistent with 'both').
  function renderLyricsOnly(sheet, maxChars) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var lyr = line.replace(/\[([^\]]+)\]/g, '').replace(/[ ]{2,}/g, ' ');
      if (!lyr.trim().length) return;
      if (!maxChars || lyr.length <= maxChars) { out.push('<div class="lyrLine">' + escHTML(lyr) + '</div>'); return; }
      wrapChordLyricPair('', lyr, maxChars).forEach(function (r) {
        out.push('<div class="lyrLine">' + escHTML(r.lyric) + '</div>');
      });
    });
    return out.join('');
  }
  // view: 'chords' = chord bars only; 'lyrics' = lyrics only (no chord row);
  // 'both' (default) = chords positioned over lyrics. `maxChars` (optional,
  // wrap-first model) threads through to renderLyricLine ('both') and
  // renderLyricsOnly ('lyrics') - both render white-space:pre rows that must
  // wrap at the measured budget. Irrelevant to 'chords' (already wraps via
  // flex).
  function renderSheet(song, st, view, map, maxChars) {
    if (view === 'chords') return renderChordOnly(song.sheet, st, map);
    if (view === 'lyrics') return renderLyricsOnly(song.sheet, maxChars);
    var html = '', last = null;
    song.sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { html += '<div class="sect">' + escHTML(sect) + '</div>'; last = sect; }
      html += renderLyricLine(tposeLine(line, st), map, maxChars);
    });
    return html;
  }
  global.SongbookSheet = {
    escHTML: escHTML,
    chordSpeller: chordSpeller,
    renderLyricLine: renderLyricLine,
    wrapChordLyricPair: wrapChordLyricPair,
    deleteBtnClass: deleteBtnClass,
    renderChordOnly: renderChordOnly,
    renderLyricsOnly: renderLyricsOnly,
    renderSheet: renderSheet
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SongbookSheet;

})(typeof window !== 'undefined' ? window : this);
