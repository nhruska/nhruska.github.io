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
    var nameSpan = '<span class="' + o.nameClass + '">' + name + '</span>';
    if (!frets || !frets.length) { wrap.innerHTML = nameSpan; return wrap; }

    var n = frets.length, cols = n - 1, rows = o.rows;
    var sx = o.sx, padX = o.padX, padY = o.padY;
    var W = padX * 2 + cols * sx;
    var H = o.H;
    var sy = (H - padY - o.bottomPad) / rows;
    var base = baseFret(frets);

    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
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
        svg += '<circle cx="' + x + '" cy="' + y + '" r="' + o.dotR + '" fill="#5eead4" stroke="#2a4f49" stroke-width="1.3"/>';
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

  global.Diagram = { render: render, baseFret: baseFret };

})(typeof window !== 'undefined' ? window : this);
