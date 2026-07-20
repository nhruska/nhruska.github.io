/* =====================================================================
 * legend.js - the fretboard dot-class LEGEND primitive.
 *
 * ONE component, reused wherever a dot-class caption is needed, so a
 * caption never gets hand-rolled as prose (Element Consistency Law, see
 * music/CLAUDE.md). It captions the fixed vocabulary of 6 dot classes a
 * fretboard render (diagram.js / key-explorer.js) can show: root, chord
 * (targeted chord tone), blue (blue note), ghost (a target chord's tone
 * OUTSIDE the scale), rub (the dominant-quality tension note), sounding
 * (the class key-explorer.js swaps in while a scale audition plays).
 *
 * Pattern: each swatch is a REAL tiny inline SVG dot using the SAME kx-*
 * class + CSS-var styling diagram.js applies to the actual fretboard dots -
 * never an approximated/hardcoded hex. A theme or accent change that
 * re-derives --kx-chord, --kx-blue, --kx-ghost, --sound-..., --accent,
 * --dg-dot propagates to the legend for free, same as the real fretboard.
 *
 *   Legend.render(classes) -> HTMLElement | null
 *     classes: an array drawn from LEGEND_ORDER (below). The CALLER decides
 *     which classes are CURRENTLY VISIBLE on the on-screen fretboard
 *     (tracks.js's legendClassesFor()), so the legend never carries a dead
 *     row for a class nothing on-screen is using. Unknown keys are silently
 *     skipped. Rows always render in the fixed LEGEND_ORDER regardless of
 *     the caller's array order or duplicates. Returns null when classes is
 *     empty/falsy - nothing to render.
 *
 * No esc() calls: every label/markup string here is a fixed internal
 * literal (LEGEND_ORDER's 6 keys), never user-controlled data, so there is
 * nothing to escape.
 *
 * Exposes window.Legend; require()-able in Node (no jsdom dependency).
 * ===================================================================== */
(function (global) {
  'use strict';

  // Small swatch geometry - a compact "icon", not a playable fretboard dot.
  // r/stroke-width are scaled down proportionally from diagram.js's 'small'
  // dotR (9.2) so the swatch reads as the same shape language at a smaller
  // size, not an unrelated icon design.
  var BOX = 18, CX = 9, CY = 9, DOT_R = 7, DOT_SW = 1.4;
  // rub's dashed ring, scaled from diagram.js's "3 2" by the same DOT_R/9.2
  // ratio (~.76) so the dash rhythm reads consistently at the smaller size.
  var RUB_DASH = '2 1.5';

  function dotSvg(classAttr, styleAttr, dash) {
    return '<svg class="legendDot" width="' + BOX + '" height="' + BOX + '" viewBox="0 0 ' + BOX + ' ' + BOX + '" aria-hidden="true" focusable="false">'
      + '<circle cx="' + CX + '" cy="' + CY + '" r="' + DOT_R + '" stroke-width="' + DOT_SW + '"'
      + (styleAttr ? ' style="' + styleAttr + '"' : '') + ' class="' + classAttr + '"'
      + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>';
  }

  // Fixed app-wide legend order: root leads (the one dot every scale render
  // always has), then the same root > chord > blue > ghost targeting
  // precedence diagram.js/tracks.js use, then rub + sounding last (both are
  // MODIFIERS layered on a base dot, not base fills of their own).
  var LEGEND_ORDER = ['root', 'chord', 'blue', 'ghost', 'rub', 'sounding'];

  var DEFS = {
    // Matches diagram.js's isRoot fill/stroke.
    root: {
      label: 'Root - the scale\'s home note',
      swatch: function () { return dotSvg('kxDot kx-root', 'fill:var(--accent);stroke:var(--accent-dim)'); }
    },
    // Matches diagram.js's 'chord' class fill/stroke.
    chord: {
      label: 'Chord tone - inside the targeted chord',
      swatch: function () { return dotSvg('kxDot kx-chord', 'fill:var(--kx-chord);stroke:var(--kx-chord)'); }
    },
    // Matches diagram.js's 'blue' class fill/stroke.
    blue: {
      label: 'Blue note - the blues scale\'s tension tone',
      swatch: function () { return dotSvg('kxDot kx-blue', 'fill:var(--kx-blue);stroke:var(--kx-blue)'); }
    },
    // A target chord's tone OUTSIDE the scale: hollow ring, fill:none,
    // matching diagram.js's ghost-dot markup.
    ghost: {
      label: 'Outside - a chord tone beyond the scale',
      swatch: function () { return dotSvg('kxDot kx-ghost', 'fill:none;stroke:var(--kx-ghost)'); }
    },
    // rub renders on a PLAIN scale-toned dot: the rub pitch class always
    // resolves to the 'scale' class (never root/chord/blue), so the swatch
    // matches that base fill/stroke plus the dashed-ring modifier, not a
    // color of its own.
    rub: {
      label: 'Rub - a tension note that resolves into the chord',
      swatch: function () { return dotSvg('kxDot kx-scale kx-rub', 'fill:var(--dg-dot);stroke:var(--dg-dot-line)', RUB_DASH); }
    },
    // setSounding() adds ONLY this class post-render, and its !important
    // tracks.css rule wins over whatever base fill/stroke the dot already
    // had, so the swatch needs no inline style of its own.
    sounding: {
      label: 'Sounding - playing right now',
      swatch: function () { return dotSvg('kxDot kx-sounding', null); }
    }
  };

  function render(classes) {
    var wanted = (classes || []).filter(function (k) { return Object.prototype.hasOwnProperty.call(DEFS, k); });
    if (!wanted.length) return null;
    var ordered = LEGEND_ORDER.filter(function (k) { return wanted.indexOf(k) >= 0; });
    var wrap = document.createElement('div');
    wrap.className = 'legend';
    wrap.innerHTML = ordered.map(function (k) {
      var d = DEFS[k];
      return '<div class="legendRow"><span class="legendSwatch">' + d.swatch() + '</span>'
        + '<span class="legendLbl">' + d.label + '</span></div>';
    }).join('');
    return wrap;
  }

  global.Legend = { render: render, LEGEND_ORDER: LEGEND_ORDER.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Legend;

})(typeof window !== 'undefined' ? window : this);
