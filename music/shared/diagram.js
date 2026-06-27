/* =====================================================================
 * diagram.js  -  generic N-string fretboard SVG renderer (shared)
 * ---------------------------------------------------------------------
 * One renderer for every instrument. Takes a FRET ARRAY (one entry per
 * string, in display order low->high / left->right) and draws an SVG
 * chord diagram. Handles any string count, plus:
 *   -1 = muted (x above the nut),  0 = open (o above the nut),  n = fretted.
 * High-position shapes (lowest fretted note > 4) render in a 4-fret window
 * with a "Nfr" base-fret label instead of the nut bar.
 *
 * Replaces the per-instrument renderers that used to live in each chord
 * pack. A profile supplies only the fret arrays (data); this draws them.
 *
 *   Diagram.render(frets, { size:'small'|'big', name:'C' }) -> HTMLElement
 * ===================================================================== */
(function (global) {
  'use strict';

  var SIZES = {
    small: { wrapClass: 'chord', nameClass: 'chord-name', sx: 9.6, padX: 12, padY: 13, bottomPad: 6, rows: 4, dotR: 4.6, markR: 3, sw: 1.1, nutPad: 1, nutH: 3, basePad: 3, baseFont: 7.5, markY: 7, markSw: 1.2, H: 74 },
    big: { wrapClass: 'bigC', nameClass: 'nm', sx: 22, padX: 22, padY: 30, bottomPad: 12, rows: 4, dotR: 11, markR: 6, sw: 1.5, nutPad: 2, nutH: 5, basePad: 6, baseFont: 13, markY: 16, markSw: 2, H: 184 }
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

    // High-position shapes render the "Nfr" label to the LEFT of the diagram.
    // The label is right-anchored at x = padX - basePad and grows leftward; for
    // multi-char labels ("5fr", "10fr") the digits end up at negative x and get
    // clipped off the original (0, W) viewBox - leaving just the trailing "fr"
    // visible, which is what the small chord cards on the Compose tab showed.
    // Extend the canvas + viewBox leftward by labelPad when base > 1 so the
    // digits have room. Low-position shapes (nut bar) are unchanged.
    var labelPad = (base > 1) ? (opts.size === 'big' ? 28 : 16) : 0;
    var canvasW = W + labelPad;
    var svg = '<svg width="' + canvasW + '" height="' + H + '" viewBox="' + (-labelPad) + ' 0 ' + canvasW + ' ' + H + '">';
    // nut bar (window starts at fret 1) or base-fret label (high shape)
    if (base === 1) {
      svg += '<rect x="' + (padX - o.nutPad) + '" y="' + (padY - o.nutPad - 1) + '" width="' + (cols * sx + 2 * o.nutPad) + '" height="' + o.nutH + '" fill="#e8ebf0" rx="1"/>';
    } else {
      svg += '<text x="' + (padX - o.basePad) + '" y="' + (padY + sy * 0.55) + '" fill="#9aa3b2" font-size="' + o.baseFont + '" font-family="monospace" text-anchor="end">' + base + 'fr</text>';
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

  // ----- scale map: a horizontal neck showing every scale tone in low position -----
  // opts: { openPcs:[pc per string, low->high], scalePcs:[pc,...], rootPc, frets }
  // Root tones glow in the live --accent; other tones are dim. Note letters labelled.
  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function scale(opts) {
    opts = opts || {};
    var openPcs = opts.openPcs || [], scalePcs = opts.scalePcs || [], rootPc = opts.rootPc;
    var F = opts.frets || 7, n = openPcs.length;
    var wrap = document.createElement('div'); wrap.className = 'scaleBox';
    if (!n || !scalePcs.length) return wrap;
    var inScale = {}; scalePcs.forEach(function (p) { inScale[((p % 12) + 12) % 12] = true; });
    var padX = 15, padY = 13, openColW = 19, fretW = 25, strSpace = 19, dotR = 8.2;
    var nutX = padX + openColW, W = nutX + F * fretW + padX, H = padY * 2 + (n - 1) * strSpace;
    function yOf(s) { return padY + (n - 1 - s) * strSpace; } // low string (index 0) at the bottom
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var f = 0; f <= F; f++) { var x = nutX + f * fretW; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (H - padY) + '" stroke="#3a4150" stroke-width="' + (f === 0 ? 3 : 1) + '"/>'; }
    for (var s = 0; s < n; s++) { var y = yOf(s); svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (nutX + F * fretW) + '" y2="' + y + '" stroke="#3a4150" stroke-width="1"/>'; }
    [3, 5, 7, 9, 12].forEach(function (fn) { if (fn <= F) { svg += '<text x="' + (nutX + (fn - 0.5) * fretW) + '" y="' + (H - 1) + '" fill="#6b7280" font-size="8" font-family="monospace" text-anchor="middle">' + fn + '</text>'; } });
    for (var s2 = 0; s2 < n; s2++) {
      var y2 = yOf(s2);
      for (var f2 = 0; f2 <= F; f2++) {
        var pc = ((openPcs[s2] + f2) % 12 + 12) % 12;
        if (!inScale[pc]) continue;
        var cx = f2 === 0 ? (padX + openColW / 2) : (nutX + (f2 - 0.5) * fretW);
        var isRoot = pc === rootPc;
        var fill = isRoot ? '#5eead4' : '#2a3340', stroke = isRoot ? '#2a4f49' : '#4b5563', tf = isRoot ? '#06201c' : '#cbd5e1';
        var st = isRoot ? ' style="fill:var(--accent);stroke:var(--accent-dim)"' : '';
        svg += '<circle cx="' + cx + '" cy="' + y2 + '" r="' + dotR + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"' + st + '/>';
        svg += '<text x="' + cx + '" y="' + (y2 + 3) + '" fill="' + tf + '" font-size="8.5" font-family="monospace" font-weight="700" text-anchor="middle"' + (isRoot ? ' style="fill:#06201c"' : '') + '>' + NOTE_NAMES[pc] + '</text>';
      }
    }
    svg += '</svg>';
    wrap.innerHTML = svg;
    return wrap;
  }

  global.Diagram = { render: render, baseFret: baseFret, scale: scale };

})(typeof window !== 'undefined' ? window : this);
