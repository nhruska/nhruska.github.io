/* =====================================================================
 * circle.js  -  circle-of-fifths theory engine + wheel renderer (shared)
 * ---------------------------------------------------------------------
 * The "spine" of the Backing Tracks surface (see backing-tracks/DESIGN.md):
 * keys are positions on the circle, chords are derived from it, neighbors
 * are adjacent. Pure music theory here (unit-tested in Node); the SVG wheel
 * renderer is added alongside.
 *
 * Sharp spelling throughout (matches Songbook.ROOTS). Flats are normalized
 * on input. No build step. Exposes window.Circle, and require()-able in Node.
 *   Circle.diatonic('C','major') -> [{roman:'I', chord:'C', root:'C', quality:''}, ...]
 * ===================================================================== */
(function (global) {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var F2S = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  // 12 roots clockwise by fifths (+7 semitones each step) from C
  var ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

  function norm(root) { return F2S[root] || root; }
  function pcOf(root) { return ROOTS.indexOf(norm(root)); }      // -1 if unknown
  function spell(pc) { return ROOTS[((pc % 12) + 12) % 12]; }
  function shift(root, semis) { var p = pcOf(root); return p < 0 ? null : spell(p + semis); }

  // diatonic triad recipes: scale-degree semitone offsets + chord qualities + roman
  var MODES = {
    major: { steps: [0, 2, 4, 5, 7, 9, 11], qual: ['', 'm', 'm', '', '', 'm', 'dim'], roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] },
    minor: { steps: [0, 2, 3, 5, 7, 8, 10], qual: ['m', 'dim', '', 'm', 'm', '', ''], roman: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] }
  };

  function position(root) { return ORDER.indexOf(norm(root)); }
  function atPosition(n) { return ORDER[((n % 12) + 12) % 12]; }

  function diatonic(root, mode) {
    var pc = pcOf(root), m = MODES[mode] || MODES.major;
    if (pc < 0) return [];
    return m.steps.map(function (st, i) {
      var r = spell(pc + st);
      return { roman: m.roman[i], chord: r + m.qual[i], root: r, quality: m.qual[i] };
    });
  }

  /* ---- SVG wheel renderer (browser only; node -c'd, eyeballed) ---- */
  var NS = 'http://www.w3.org/2000/svg';
  function polar(c, r, deg) { var a = (deg - 90) * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; }
  // annular sector (a wedge of a ring) from inner r1 to outer r2, angles a1..a2 (deg)
  function sector(c, r1, r2, a1, a2) {
    var o1 = polar(c, r2, a1), o2 = polar(c, r2, a2), i2 = polar(c, r1, a2), i1 = polar(c, r1, a1);
    return 'M' + o1[0] + ' ' + o1[1] + ' A' + r2 + ' ' + r2 + ' 0 0 1 ' + o2[0] + ' ' + o2[1] +
      ' L' + i2[0] + ' ' + i2[1] + ' A' + r1 + ' ' + r1 + ' 0 0 0 ' + i1[0] + ' ' + i1[1] + ' Z';
  }
  function renderWheel(opts) {
    opts = opts || {};
    var sel = opts.selected || {}, onPick = opts.onPick || function () {};
    var selRoot = sel.root ? norm(sel.root) : null, selMode = sel.mode || 'major';
    var size = 240, c = size / 2;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('class', 'cofWheel');
    var rings = [{ mode: 'major', r1: 74, r2: c - 5, lr: (74 + c - 5) / 2, suffix: '' },
                 { mode: 'minor', r1: 38, r2: 74, lr: (38 + 74) / 2, suffix: 'm' }];
    ORDER.forEach(function (root, i) {
      var a1 = i * 30 - 15, a2 = i * 30 + 15, lp;
      rings.forEach(function (ring) {
        var on = selRoot === root && selMode === ring.mode;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', sector(c, ring.r1, ring.r2, a1, a2));
        path.setAttribute('class', 'cofWedge' + (on ? ' on' : ''));
        path.addEventListener('click', function () { onPick(root, ring.mode); });
        svg.appendChild(path);
        lp = polar(c, ring.lr, i * 30);
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('x', lp[0].toFixed(1)); t.setAttribute('y', lp[1].toFixed(1));
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
        t.setAttribute('class', 'cofLabel' + (on ? ' on' : ''));
        t.style.pointerEvents = 'none';
        t.textContent = root + ring.suffix;
        svg.appendChild(t);
      });
    });
    var wrap = document.createElement('div'); wrap.className = 'cofWrap'; wrap.appendChild(svg);
    return wrap;
  }

  var Circle = {
    ORDER: ORDER,
    position: position,
    atPosition: atPosition,
    dominant: function (root) { return shift(root, 7); },     // a fifth up
    subdominant: function (root) { return shift(root, 5); },  // a fifth down
    relativeMinor: function (root) { return shift(root, -3); },
    relativeMajor: function (root) { return shift(root, 3); },
    // The keys worth exploring next, MODE-AWARE: a fifth up, a fifth down, and the
    // relative key — labelled in the right case for the current mode. Returns an
    // ordered array of { root, mode, why } so the panel renders them directly.
    neighbors: function (root, mode) {
      if (mode === 'minor') return [
        { root: shift(root, 7), mode: 'minor', why: 'a fifth up (the v)' },
        { root: shift(root, 5), mode: 'minor', why: 'a fifth down (the iv)' },
        { root: shift(root, 3), mode: 'major', why: 'its relative major' }
      ];
      return [
        { root: shift(root, 7), mode: 'major', why: 'a fifth up (the V)' },
        { root: shift(root, 5), mode: 'major', why: 'a fifth down (the IV)' },
        { root: shift(root, -3), mode: 'minor', why: 'its relative minor' }
      ];
    },
    diatonic: diatonic,
    renderWheel: renderWheel
  };

  global.Circle = Circle;
  if (typeof module !== 'undefined' && module.exports) module.exports = Circle;

})(typeof window !== 'undefined' ? window : this);
