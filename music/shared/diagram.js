/* =====================================================================
 * diagram.js  -  generic N-string fretboard SVG renderer (shared)
 * ---------------------------------------------------------------------
 * One renderer for every instrument. Takes a FRET ARRAY (one entry per
 * string, in display order low->high / left->right) and draws an SVG
 * chord diagram. Handles any string count, plus:
 *   -1 = muted (x above the nut),  0 = open (o above the nut),  n = fretted.
 * High-position shapes (lowest fretted note > 4) render in a 4-fret window
 * with just the digit ("5", "10") as a base-fret label instead of the nut bar.
 *
 * Replaces the per-instrument renderers that used to live in each chord
 * pack. A profile supplies only the fret arrays (data); this draws them.
 *
 *   Diagram.render(frets, { size:'small'|'big', name:'C' }) -> HTMLElement
 * ===================================================================== */
(function (global) {
  'use strict';

  var SIZES = {
    // baseFont sized to render readable digit on phone screens. Was 7.5 (small)
    // - the "5" / "10" digits were technically present in the SVG but crammed
    // against "fr" at a sub-pixel width on high-DPI mobile. Dropping "fr" frees
    // ~16px of horizontal labelPad that was eating into the diagram width.
    small: { wrapClass: 'chord', nameClass: 'chord-name', sx: 9.6, padX: 12, padY: 13, bottomPad: 6, rows: 4, dotR: 4.6, markR: 3, sw: 1.1, nutPad: 1, nutH: 3, basePad: 4, baseFont: 10, markY: 7, markSw: 1.2, H: 74 },
    big: { wrapClass: 'bigC', nameClass: 'nm', sx: 22, padX: 22, padY: 30, bottomPad: 12, rows: 4, dotR: 11, markR: 6, sw: 1.5, nutPad: 2, nutH: 5, basePad: 6, baseFont: 14, markY: 16, markSw: 2, H: 184 }
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function baseFret(frets) {
    var fretted = frets.filter(function (x) { return x > 0; });
    if (!fretted.length) return 1;
    var hi = Math.max.apply(null, fretted), lo = Math.min.apply(null, fretted);
    return hi <= 4 ? 1 : lo; // window starts at the nut unless the shape sits high
  }

  function render(frets, opts) {
    opts = opts || {};
    var o = SIZES[opts.size === 'big' ? 'big' : 'small'];
    var name = opts.name || '';
    var wrap = document.createElement('div');
    wrap.className = o.wrapClass;
    var nameSpan = '<span class="' + o.nameClass + '">' + esc(name) + '</span>';
    if (!frets || !frets.length) { wrap.innerHTML = nameSpan; return wrap; }

    var n = frets.length, cols = n - 1;
    var sx = o.sx, padX = o.padX, padY = o.padY;
    var W = padX * 2 + cols * sx;
    var H = o.H;
    var base = baseFret(frets);
    var fretted = frets.filter(function (x) { return x > 0; });
    var hi = fretted.length ? Math.max.apply(null, fretted) : 0;
    // expand the window so a wide/stretch shape (e.g. mandolin C7 [5,2,1,3]) fits
    // instead of drawing dots below the board.
    var rows = Math.max(o.rows, hi - base + 1);
    var sy = (H - padY - o.bottomPad) / rows;

    // High-position shapes render a single base-fret digit to the LEFT of the
    // diagram (e.g. just "5" instead of "5fr"). The label is right-anchored at
    // x = padX - basePad and grows leftward. Dropping the "fr" suffix saves
    // ~16px of labelPad that was eating into the diagram width on phone-sized
    // cards. The canvas + viewBox extend leftward by labelPad to make room.
    // labelPad sized to fit two digits at the current baseFont. Small size:
    // 10px monospace x 2 chars ~= 12px; pad to 14 for breathing room. Big size:
    // 14px monospace x 2 chars ~= 17px; pad to 20.
    //
    // labelPad is RESERVED for EVERY diagram (not just base>1) so that the canvas
    // dimensions are identical across open and offset shapes. Without this, offset
    // shapes had a wider canvas and rendered SMALLER than open shapes in the
    // maximize grid (the wider canvas hit the width cap first, shrinking the fret
    // grid). A constant canvas size makes the fretboard render uniformly regardless
    // of fret offset; for base-1 shapes the reserved space is simply empty.
    var labelPad = (opts.size === 'big' ? 20 : 14);
    var canvasW = W + labelPad;
    var svg = '<svg width="' + canvasW + '" height="' + H + '" viewBox="' + (-labelPad) + ' 0 ' + canvasW + ' ' + H + '">';
    // nut bar (window starts at fret 1) or base-fret label (high shape)
    if (base === 1) {
      svg += '<rect x="' + (padX - o.nutPad) + '" y="' + (padY - o.nutPad - 1) + '" width="' + (cols * sx + 2 * o.nutPad) + '" height="' + o.nutH + '" fill="#e8ebf0" rx="1"/>';
    } else {
      svg += '<text x="' + (padX - o.basePad) + '" y="' + (padY + sy * 0.55) + '" fill="#9aa3b2" font-size="' + o.baseFont + '" font-family="monospace" text-anchor="end">' + base + '</text>';
    }
    // string verticals
    for (var st = 0; st < n; st++) { var x = padX + st * sx; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (padY + rows * sy) + '" stroke="#3a4150" stroke-width="' + o.sw + '"/>'; }
    // fret horizontals
    for (var r = 0; r <= rows; r++) { var y = padY + r * sy; svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (padX + cols * sx) + '" y2="' + y + '" stroke="#3a4150" stroke-width="' + o.sw + '"/>'; }
    // per-string markers
    frets.forEach(function (fr, s) {
      var x = padX + s * sx;
      if (fr > 0) {
        var rel = fr - (base - 1);
        var y = padY + (rel - 0.5) * sy;
        // fill/stroke via inline style so the dot follows the live --accent theme
        // (SVG presentation attributes can't read CSS vars; the hex is a fallback).
        svg += '<circle cx="' + x + '" cy="' + y + '" r="' + o.dotR + '" fill="#5eead4" stroke="#2a4f49" stroke-width="1.3" style="fill:var(--accent);stroke:var(--accent-dim)"/>';
      } else if (fr === 0) {
        svg += '<circle cx="' + x + '" cy="' + (padY - o.markY) + '" r="' + o.markR + '" fill="none" stroke="#e8ebf0" stroke-width="' + o.markSw + '"/>';
      } else { // muted
        var mY = padY - o.markY, d = o.markR;
        svg += '<line x1="' + (x - d) + '" y1="' + (mY - d) + '" x2="' + (x + d) + '" y2="' + (mY + d) + '" stroke="#7a8294" stroke-width="' + o.markSw + '"/>';
        svg += '<line x1="' + (x - d) + '" y1="' + (mY + d) + '" x2="' + (x + d) + '" y2="' + (mY - d) + '" stroke="#7a8294" stroke-width="' + o.markSw + '"/>';
      }
    });
    svg += '</svg>';
    wrap.innerHTML = nameSpan + svg;
    return wrap;
  }

  // ----- scale map: a horizontal neck showing every scale tone in a fret window -----
  // opts: { openPcs:[pc per string, low->high], scalePcs:[pc,...], rootPc, frets, startFret }
  // Root tones glow in the live --accent; other tones are dim. Note letters labelled.
  // startFret (default 0) slides the window up the neck for soloing beyond the first
  // position: 0 keeps the original open-string + frets-1..F window; >0 drops the open
  // column entirely and shows F frets starting at startFret, labelled with their TRUE
  // fret numbers (a player fingers by the real number, not a relative one).
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var MARK_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21]; // standard neck position-marker frets

  // ----- pure fret-window math (exported for Node unit tests; no DOM touched) -----
  // scalePlan({openPcs, scalePcs, rootPc, frets, startFret}) -> the column plan scale()
  // renders from:
  //   showOpen   - true only when startFret is 0 (open strings get their own column)
  //   trueFrets  - the F fretted columns' TRUE fret numbers, in left-to-right order
  //                (never includes fret 0 - that's the separate open column, showOpen-gated)
  //   markers    - MARK_FRETS entries that fall inside this window (already true numbers)
  //   notesOn(s) - fn(stringIndex) -> [{ fret, pc, isRoot }] in-scale notes on that string,
  //                left-to-right column order (fret 0 / open included only when showOpen)
  function scalePlan(opts) {
    opts = opts || {};
    var openPcs = opts.openPcs || [], scalePcs = opts.scalePcs || [], rootPc = opts.rootPc;
    var F = opts.frets > 0 ? opts.frets : 7;
    var startFret = opts.startFret > 0 ? opts.startFret : 0;
    var showOpen = startFret === 0;
    var trueFrets = [];
    for (var i = 0; i < F; i++) trueFrets.push(showOpen ? (i + 1) : (startFret + i));
    var inScale = {}; scalePcs.forEach(function (p) { inScale[((p % 12) + 12) % 12] = true; });
    var markers = MARK_FRETS.filter(function (fn) { return trueFrets.indexOf(fn) !== -1; });
    function notesOn(s) {
      var openPc = openPcs[s], out = [];
      if (showOpen) {
        var opc = ((openPc % 12) + 12) % 12;
        if (inScale[opc]) out.push({ fret: 0, pc: opc, isRoot: opc === rootPc });
      }
      trueFrets.forEach(function (fn) {
        var pc = ((openPc + fn) % 12 + 12) % 12;
        if (inScale[pc]) out.push({ fret: fn, pc: pc, isRoot: pc === rootPc });
      });
      return out;
    }
    return {
      showOpen: showOpen, frets: F, startFret: startFret, trueFrets: trueFrets,
      start: trueFrets.length ? trueFrets[0] : startFret, end: trueFrets.length ? trueFrets[trueFrets.length - 1] : startFret,
      markers: markers, notesOn: notesOn
    };
  }

  function scale(opts) {
    opts = opts || {};
    var openPcs = opts.openPcs || [], n = openPcs.length;
    var wrap = document.createElement('div'); wrap.className = 'scaleBox';
    if (!n || !(opts.scalePcs && opts.scalePcs.length)) return wrap;
    var plan = scalePlan(opts);
    var F = plan.frets, showOpen = plan.showOpen, trueFrets = plan.trueFrets;
    // dotR/strSpace sized so the 10px note-name labels (phone-DPI floor for SVG
    // text, CLAUDE.md) fit their circles with clearance between adjacent strings.
    var padX = 15, padY = 13, openColW = 19, fretW = 25, strSpace = 21, dotR = 9.2;
    var nutX = showOpen ? (padX + openColW) : padX;
    var W = nutX + F * fretW + padX, H = padY * 2 + (n - 1) * strSpace;
    function yOf(s) { return padY + (n - 1 - s) * strSpace; } // low string (index 0) at the bottom
    // column index: 0 = the open-string column (only when showOpen), 1..F = trueFrets[0..F-1]
    function xOf(col) { return col === 0 ? (padX + openColW / 2) : (nutX + (col - 0.5) * fretW); }
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var f = 0; f <= F; f++) { var x = nutX + f * fretW; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (H - padY) + '" stroke="#3a4150" stroke-width="' + (showOpen && f === 0 ? 3 : 1) + '"/>'; }
    for (var s = 0; s < n; s++) { var y = yOf(s); svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (nutX + F * fretW) + '" y2="' + y + '" stroke="#3a4150" stroke-width="1"/>'; }
    // fret-number labels: font-size 10 is the phone-DPI floor for SVG text (CLAUDE.md) -
    // these are TRUE fret numbers even in a shifted window (plan.markers already reflects that).
    plan.markers.forEach(function (fn) {
      var col = trueFrets.indexOf(fn) + 1;
      svg += '<text x="' + xOf(col) + '" y="' + (H - 1) + '" fill="#6b7280" font-size="10" font-family="monospace" text-anchor="middle">' + fn + '</text>';
    });
    for (var s2 = 0; s2 < n; s2++) {
      var y2 = yOf(s2);
      plan.notesOn(s2).forEach(function (note) {
        var col = (note.fret === 0 && showOpen) ? 0 : (trueFrets.indexOf(note.fret) + 1);
        var cx = xOf(col), isRoot = note.isRoot;
        var fill = isRoot ? '#5eead4' : '#2a3340', stroke = isRoot ? '#2a4f49' : '#4b5563', tf = isRoot ? '#06201c' : '#cbd5e1';
        var st = isRoot ? ' style="fill:var(--accent);stroke:var(--accent-dim)"' : '';
        svg += '<circle cx="' + cx + '" cy="' + y2 + '" r="' + dotR + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"' + st + '/>';
        svg += '<text x="' + cx + '" y="' + (y2 + 3.5) + '" fill="' + tf + '" font-size="10" font-family="monospace" font-weight="700" text-anchor="middle"' + (isRoot ? ' style="fill:#06201c"' : '') + '>' + NOTE_NAMES[note.pc] + '</text>';
      });
    }
    svg += '</svg>';
    wrap.innerHTML = svg;
    return wrap;
  }

  global.Diagram = { render: render, baseFret: baseFret, scale: scale, scalePlan: scalePlan };

  // expose the pure fret-window math for Node unit tests (no DOM needed)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.scalePlan = scalePlan;
  }

})(typeof window !== 'undefined' ? window : this);
