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
 *   Diagram.render(frets, { size:'small'|'big', name:'C', patternLabel:'', reserveLabelSlot:false })
 *     -> HTMLElement
 *   opts.patternLabel (optional, S-DIAGRAM-PREF step 2): a pre-computed
 *   string drawn as a small caption below the diagram - e.g. the shape-
 *   classify.js label ("E-shape barre, root on 6, root position"). Absent/
 *   falsy renders byte-identical to the pre-existing output; this module
 *   never reads the dots/patterns preference or calls ShapeClassify itself
 *   (see shared/diagram-pref.js, the caller-side decision layer).
 *   opts.reserveLabelSlot (M-EAR wave 1.6, U21 - docs/plans/
 *   uat-walkthrough-20260704.md): when true, the label slot renders even if
 *   patternLabel is '' (an honest-null classifier result, e.g. shape-
 *   classify.js's uncurated dim/aug quality) - so a caller that KNOWS it is
 *   in "patterns" display mode (diagram-pref.js) can keep every card in a
 *   row the SAME height whatever the classifier returns, without diagram.js
 *   knowing anything about the dots/patterns preference itself (same
 *   agnostic-of-the-decision contract as patternLabel). Absent/false (every
 *   pre-existing caller, and every 'dots'-mode call) is BYTE-IDENTICAL to
 *   the pre-U21 behavior (SHA-256 locked in diagram.dom.test.js) - the empty
 *   reserved div only ever appears when a caller explicitly opts in.
 *   U25 (M-SETTINGS-CLARITY, 2026-07-05): chord-pack-adapter.js - the one
 *   caller that computes these opts - now passes both ONLY for 'big'
 *   renders (small picker/strip cards never label). This module stays
 *   agnostic either way: it draws whatever it is handed, or nothing.
 * ===================================================================== */
(function (global) {
  'use strict';

  // S-LAYOUT-SSOT cross-reference (music/engineering-wiki/systems/layout-tokens.md):
  // sx/padX (below) plus the labelPad computed in render() determine the rendered
  // SVG canvas width (canvasW = padX*2 + cols*sx + labelPad) - the quantity
  // music/shared/songbook.css's --dg-canvas-w token documents for the WIDEST
  // 'small' case (a 6-string guitar, cols=5: 12*2 + 5*9.6 + 14 = 86px), which
  // --tile-min (.chordGrid's grid-template-columns) is tuned to comfortably fit.
  // This object is DELIBERATELY NOT tokenized into that CSS var - canvasW is
  // computed per string-count at render time (a 4-string ukulele produces a
  // narrower canvas from this SAME object), not a single fixed pixel value a
  // CSS custom property could hold, and this file emits a plain SVG string so
  // it cannot read a CSS var even if it wanted to. If sx/padX/labelPad ever
  // change for 'small', re-derive --dg-canvas-w by hand in songbook.css and
  // re-run scripts/layout-check.py (the live render-verify regression suite)
  // to confirm --tile-min still comfortably fits the new canvas width.
  var SIZES = {
    // baseFont sized to render readable digit on phone screens. Was 7.5 (small)
    // - the "5" / "10" digits were technically present in the SVG but crammed
    // against "fr" at a sub-pixel width on high-DPI mobile. Dropping "fr" frees
    // ~16px of horizontal labelPad that was eating into the diagram width.
    small: { wrapClass: 'chord', nameClass: 'chord-name', sx: 9.6, padX: 12, padY: 13, bottomPad: 6, rows: 4, dotR: 4.6, markR: 3, sw: 1.1, nutPad: 1, nutH: 3, basePad: 4, baseFont: 10, markY: 7, markSw: 1.2, H: 74 },
    big: { wrapClass: 'bigC', nameClass: 'nm', sx: 22, padX: 22, padY: 30, bottomPad: 12, rows: 4, dotR: 11, markR: 6, sw: 1.5, nutPad: 2, nutH: 5, basePad: 6, baseFont: 14, markY: 16, markSw: 2, H: 184 }
  };

  // S-HARDEN (analysis-refactor-enhance-20260704 A5): delegates to the shared
  // esc.js (loaded before this file everywhere it's consumed) - was one of
  // ~8 divergent local copies (this one was the only quote-unescaped variant
  // besides play/index.html's; both now get the strict &<>"' superset).
  function esc(s) { return global.Esc.esc(s); }

  // S-DIAGRAM-PREF step 1 trigger hook: fires a lightweight signal every time
  // an ACTUAL chord diagram draws (never the name-only "no chord" fallback
  // below), so play/index.html can mount the one-time dots/patterns
  // preference prompt at "the first chord-diagram surface" without this
  // generic, instrument-agnostic renderer knowing anything about Notables,
  // localStorage, or which screen/tab is active. Guarded: the Node test
  // harness (test/diagram.dom.test.js) stubs only `document`, never
  // `window.dispatchEvent`/`CustomEvent`, so this is a safe no-op there.
  function notifyRendered() {
    if (typeof global.dispatchEvent !== 'function' || typeof global.CustomEvent !== 'function') return;
    try { global.dispatchEvent(new global.CustomEvent('music:diagram-rendered')); } catch (e) { /* ignore */ }
  }

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
    notifyRendered();

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
      svg += '<rect x="' + (padX - o.nutPad) + '" y="' + (padY - o.nutPad - 1) + '" width="' + (cols * sx + 2 * o.nutPad) + '" height="' + o.nutH + '" fill="#e8ebf0" style="fill:var(--dg-nut)" rx="1"/>';
    } else {
      svg += '<text x="' + (padX - o.basePad) + '" y="' + (padY + sy * 0.55) + '" fill="#9aa3b2" style="fill:var(--dg-base)" font-size="' + o.baseFont + '" font-family="monospace" text-anchor="end">' + base + '</text>';
    }
    // string verticals
    for (var st = 0; st < n; st++) { var x = padX + st * sx; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (padY + rows * sy) + '" stroke="#3a4150" style="stroke:var(--dg-grid)" stroke-width="' + o.sw + '"/>'; }
    // fret horizontals
    for (var r = 0; r <= rows; r++) { var y = padY + r * sy; svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (padX + cols * sx) + '" y2="' + y + '" stroke="#3a4150" style="stroke:var(--dg-grid)" stroke-width="' + o.sw + '"/>'; }
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
        svg += '<circle cx="' + x + '" cy="' + (padY - o.markY) + '" r="' + o.markR + '" fill="none" stroke="#e8ebf0" style="stroke:var(--dg-nut)" stroke-width="' + o.markSw + '"/>';
      } else { // muted
        var mY = padY - o.markY, d = o.markR;
        svg += '<line x1="' + (x - d) + '" y1="' + (mY - d) + '" x2="' + (x + d) + '" y2="' + (mY + d) + '" stroke="#7a8294" style="stroke:var(--dg-mute)" stroke-width="' + o.markSw + '"/>';
        svg += '<line x1="' + (x - d) + '" y1="' + (mY + d) + '" x2="' + (x + d) + '" y2="' + (mY - d) + '" stroke="#7a8294" style="stroke:var(--dg-mute)" stroke-width="' + o.markSw + '"/>';
      }
    });
    svg += '</svg>';
    // S-DIAGRAM-PREF step 2 ('patterns' render): opts.patternLabel is an
    // EXTEND-not-overlay addition - same contract as scale()'s opts.tones
    // below. Absent/falsy WITHOUT opts.reserveLabelSlot (every existing
    // caller, and every 'dots'-pref call) renders BYTE-IDENTICAL to the
    // pre-existing output (regression-locked in diagram.dom.test.js). This
    // renderer stays agnostic of the dots/patterns preference and of
    // ShapeClassify entirely - it just draws whatever text string it's
    // handed, or nothing; see diagram-pref.js for who decides WHETHER to
    // pass one and what it says.
    //
    // U21 (M-EAR wave 1.6, docs/plans/uat-walkthrough-20260704.md): a
    // 'patterns'-mode caller whose voicing shape-classify.js can't classify
    // (honest null - e.g. an uncurated dim/aug quality) still needs a
    // reserved vertical slot close to what a REAL label commonly wraps to
    // in a card row, not just one line. (U25 narrowed WHO reserves: chord-
    // pack-adapter.js now opts in for 'big' renders only - the maximize
    // overlay - since small cards never label. The em-based sizing below,
    // measured on the original small-card consumer, still holds: it ties to
    // this div's own font-size, which is size-independent.)
    // shape-classify.js's label() always
    // follows the same template shape ("<family> shape[ barre], root on
    // <string>, <inversion>" - see that file's own label() function), which
    // measured 3 lines at the 'small' card's ~86px canvas width in the
    // shipping PR's live-Playwright verification (component-conventions.md/
    // decisions.md D-EAR-1.6 cite the exact px). min-height is in `em`
    // (ties to THIS div's own font-size) so the 3-line reservation stays
    // proportional to whatever font-size the rule above declares, rather
    // than a separate px figure to keep in sync by hand.
    var showLabelSlot = !!opts.patternLabel || !!opts.reserveLabelSlot;
    var labelHtml = showLabelSlot
      ? '<div class="dg-shapeLabel" style="max-width:100%;word-break:break-word;white-space:normal;'
        + 'font-size:.62rem;line-height:1.25;min-height:3.75em;text-align:center;font-family:monospace;'
        + 'color:var(--ink-faint,#9aa3b2);margin-top:2px;">' + (opts.patternLabel ? esc(opts.patternLabel) : '') + '</div>'
      : '';
    wrap.innerHTML = nameSpan + svg + labelHtml;
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
    // Ghost notes (M-GUIDE W3a, P5 seasoned-player fold): the SAME per-string
    // fret math as notesOn() above, but for pcs OUTSIDE the scale - a target
    // chord's tone the current scale doesn't contain (e.g. C# over A7 in A
    // blues). wantedPcs is a CALL-TIME set (which chord is targeted can change
    // without rebuilding the whole plan), unlike scalePcs which is fixed here.
    function ghostsOn(s, wantedPcs) {
      var openPc = openPcs[s], out = [];
      var wanted = {}; (wantedPcs || []).forEach(function (p) { wanted[((p % 12) + 12) % 12] = true; });
      if (showOpen) {
        var opc = ((openPc % 12) + 12) % 12;
        if (wanted[opc]) out.push({ fret: 0, pc: opc });
      }
      trueFrets.forEach(function (fn) {
        var pc = ((openPc + fn) % 12 + 12) % 12;
        if (wanted[pc]) out.push({ fret: fn, pc: pc });
      });
      return out;
    }
    return {
      showOpen: showOpen, frets: F, startFret: startFret, trueFrets: trueFrets,
      start: trueFrets.length ? trueFrets[0] : startFret, end: trueFrets.length ? trueFrets[trueFrets.length - 1] : startFret,
      markers: markers, notesOn: notesOn, ghostsOn: ghostsOn
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
    // Fret-number labels get their OWN band below the board. The bottom string's
    // dots (r 9.2 around cy = boardBot) used to reach into the label row - and the
    // labels painted BEFORE the dots, so the numbers hid behind them. The band
    // reserves clearance and the labels now paint last (see below).
    var labelBand = plan.markers.length ? 10 : 0;
    var nutX = showOpen ? (padX + openColW) : padX;
    var boardBot = padY + (n - 1) * strSpace; // last string line - board ends here, band follows
    var W = nutX + F * fretW + padX, H = boardBot + padY + labelBand;
    function yOf(s) { return padY + (n - 1 - s) * strSpace; } // low string (index 0) at the bottom
    // column index: 0 = the open-string column (only when showOpen), 1..F = trueFrets[0..F-1]
    function xOf(col) { return col === 0 ? (padX + openColW / 2) : (nutX + (col - 0.5) * fretW); }
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var f = 0; f <= F; f++) { var x = nutX + f * fretW; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + boardBot + '" stroke="#3a4150" style="stroke:var(--dg-grid)" stroke-width="' + (showOpen && f === 0 ? 3 : 1) + '"/>'; }
    for (var s = 0; s < n; s++) { var y = yOf(s); svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (nutX + F * fretW) + '" y2="' + y + '" stroke="#3a4150" style="stroke:var(--dg-grid)" stroke-width="1"/>'; }
    // M-GUIDE W3a (section 2, chord-tone targeting): opts.tones = { byPc: {pc:
    // class}, rubPc } is an EXTEND-not-overlay addition. Absent/falsy -> every
    // dot below renders byte-identical to the pre-targeting default (regression-
    // locked in diagram.dom.test.js) - the tones-aware branch below only ever
    // runs when a caller explicitly opts in.
    var tones = opts.tones || null;
    for (var s2 = 0; s2 < n; s2++) {
      var y2 = yOf(s2);
      plan.notesOn(s2).forEach(function (note) {
        var col = (note.fret === 0 && showOpen) ? 0 : (trueFrets.indexOf(note.fret) + 1);
        var cx = xOf(col), isRoot = note.isRoot;
        var fill = isRoot ? '#5eead4' : '#2a3340', stroke = isRoot ? '#2a4f49' : '#4b5563', tf = isRoot ? '#06201c' : '#cbd5e1';
        var st = isRoot ? ' style="fill:var(--accent);stroke:var(--accent-dim)"' : ' style="fill:var(--dg-dot);stroke:var(--dg-dot-line)"';
        // Targeting overlay: precedence root > chord > blue > scale (D-TARGET).
        // 'root'/'scale' classes keep the existing fill/stroke untouched; only
        // 'chord'/'blue' swap in their own theme-safe CSS vars. The rub modifier
        // (dashed ring) never changes fill/stroke, only adds stroke-dasharray.
        var classAttr = '', dash = '';
        if (tones) {
          var cls = (tones.byPc && tones.byPc[note.pc]) || (isRoot ? 'root' : 'scale');
          var isRub = tones.rubPc === note.pc;
          classAttr = ' class="kxDot kx-' + cls + (isRub ? ' kx-rub' : '') + '"';
          if (cls === 'chord') st = ' style="fill:var(--kx-chord);stroke:var(--kx-chord)"';
          else if (cls === 'blue') st = ' style="fill:var(--kx-blue);stroke:var(--kx-blue)"';
          if (isRub) dash = ' stroke-dasharray="3 2"';
        } else {
          // M-EAR wave 1.5 (U12): tones-absent dots still need the kxDot class
          // (below, data-pc is added either way) so key-explorer.js's
          // boxWrap.setSounding(pc) has a consistent `.kxDot[data-pc]` shape to
          // query regardless of whether a chord target is active. Deliberate,
          // reviewed change to the tones-absent baseline - the SHA-256 lock in
          // diagram.dom.test.js was re-verified and updated for this change
          // (see that test's own re-verify-deliberately comment).
          classAttr = ' class="kxDot"';
        }
        // data-pc (M-EAR wave 1.5, U12): the ONE per-dot marker the sounding-
        // note fretboard highlight is built on - every octave/string of the
        // currently-sounding pitch class shares this attribute, so a plain
        // querySelectorAll('[data-pc="N"]') lights all of them at once. Added
        // unconditionally (tones present or absent) - the kx-sounding CLASS
        // itself is never baked in here; it's added later via JS classList
        // (key-explorer.js), so THAT stays byte-identical either way.
        var pcAttr = ' data-pc="' + note.pc + '"';
        svg += '<circle cx="' + cx + '" cy="' + y2 + '" r="' + dotR + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"' + st + classAttr + pcAttr + dash + '/>';
        // Prefer the caller's spelling (opts.names[pc] - canonical sharp post-FORK-4,
        // e.g. A# in F major) so the fretboard matches the "Solo over it" note list;
        // fall back to the sharp table.
        var noteName = (opts.names && opts.names[note.pc]) || NOTE_NAMES[note.pc];
        // Root note text sits on the bright --accent fill -> dark --on-accent ink.
        // U3 (operator UAT 2026-07-04): kx-chord/kx-blue used to share that SAME
        // --on-accent ink on the assumption their fills were equally bright - true
        // in dark theme, but tracks.css deliberately DARKENS --kx-chord/--kx-blue
        // in light theme for contrast against the page bg, so dark-on-dark was
        // unreadable there. Each class now gets its own theme-safe ink var (tracks.css
        // picks the readable value per theme); 'scale'/no-tones text keeps --dg-note.
        var textFillVar = isRoot ? '--on-accent' : (cls === 'chord' ? '--kx-chord-ink' : (cls === 'blue' ? '--kx-blue-ink' : null));
        svg += '<text x="' + cx + '" y="' + (y2 + 3.5) + '" fill="' + tf + '" font-size="10" font-family="monospace" font-weight="700" text-anchor="middle"' + (textFillVar ? ' style="fill:var(' + textFillVar + ')"' : ' style="fill:var(--dg-note)"') + '>' + noteName + '</text>';
      });
    }
    // GHOST DOTS (M-GUIDE W3a, P5 seasoned-player fold): a target chord's tones
    // that fall OUTSIDE the current scale render as hollow (fill:none) outline
    // dots at their correct fret position - same per-string fret math as the
    // in-scale dots above (plan.ghostsOn mirrors plan.notesOn), just for pcs the
    // scale doesn't contain. Zero ghosts when no target is active (tones.ghostPcs
    // absent/empty) - this block never runs in that case, preserving the
    // opts.tones-absent byte-identical render.
    if (tones && tones.ghostPcs && tones.ghostPcs.length) {
      for (var sG = 0; sG < n; sG++) {
        var yG = yOf(sG);
        plan.ghostsOn(sG, tones.ghostPcs).forEach(function (gnote) {
          var colG = (gnote.fret === 0 && showOpen) ? 0 : (trueFrets.indexOf(gnote.fret) + 1);
          var cxG = xOf(colG);
          svg += '<circle cx="' + cxG + '" cy="' + yG + '" r="' + dotR + '" fill="none" stroke="#94a3b8" stroke-width="1.2" style="stroke:var(--kx-ghost)" class="kxDot kx-ghost"/>';
          var ghostName = (opts.names && opts.names[gnote.pc]) || NOTE_NAMES[gnote.pc];
          svg += '<text x="' + cxG + '" y="' + (yG + 3.5) + '" fill="#94a3b8" font-size="10" font-family="monospace" font-weight="700" text-anchor="middle" style="fill:var(--kx-ghost)">' + esc(ghostName) + '</text>';
        });
      }
    }
    // fret-number labels: font-size 10 is the phone-DPI floor for SVG text (CLAUDE.md) -
    // these are TRUE fret numbers even in a shifted window (plan.markers already reflects
    // that). Drawn LAST (SVG paints in document order) and inside the reserved labelBand,
    // so the numbers can never hide behind the note dots again.
    plan.markers.forEach(function (fn) {
      var col = trueFrets.indexOf(fn) + 1;
      svg += '<text x="' + xOf(col) + '" y="' + (H - 1) + '" fill="#6b7280" style="fill:var(--dg-fret-lbl)" font-size="10" font-family="monospace" text-anchor="middle">' + fn + '</text>';
    });
    svg += '</svg>';
    wrap.innerHTML = svg;
    return wrap;
  }

  global.Diagram = { render: render, baseFret: baseFret, scale: scale, scalePlan: scalePlan };

  // expose the pure fret-window math for Node unit tests (no DOM needed), plus
  // scale() for the stub-document render tests (label band + paint order), plus
  // render() (S-DIAGRAM-PREF step 2: opts.patternLabel + notifyRendered() dots/
  // patterns regression coverage - test/diagram.dom.test.js).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.scalePlan = scalePlan;
    module.exports.scale = scale;
    module.exports.render = render;
  }

})(typeof window !== 'undefined' ? window : this);
