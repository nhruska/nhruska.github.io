/* =====================================================================
 * key-explorer.js  -  shared "key explorer" render primitives
 * ---------------------------------------------------------------------
 * The chords-in-key palette + solo-scale box, rendered identically in
 * BOTH the Compose tab (interactive: tap a chord = add to progression)
 * and the Tracks player (read-only: tap = hear). To stay context-neutral
 * the THEORY is pre-computed by the caller and passed in - Compose drops
 * the diminished vii deg and uses its own mode vocabulary, Tracks keeps
 * vii and uses circle.js's; a shared computer would silently change one
 * side's palette. This module only paints pixels + wires the supplied
 * tap behaviour. It imports NO context state (no addChord/progression/
 * STATE) - everything context-specific arrives via opts callbacks, so a
 * Compose mount and a Tracks mount never share mutable state.
 *
 * Exposes window.KeyExplorer, and require()-able in Node.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* renderChords(container, items, opts)
   *   items: [{ chord: 'C', roman: 'I' }]  - caller pre-derives (vocabulary stays caller's)
   *   opts:
   *     label    - optional 'Chords in this key' sub-label
   *     diagram  - REQUIRED when items is non-empty: fn(chordName, size) -> tile element,
   *                or null to skip that chord (e.g. the pack can't render it)
   *     onTap    - optional fn(chordName, tileEl); when set, makes the tile interactive.
   *                Compose passes add-to-progression+play; Tracks passes play-only.
   *     tapClass - optional class added to each tile (opt-in). Lets add-tiles LOOK
   *                different from read-only hear-tiles (prevents the "same UI, different
   *                consequence" mis-train) WITHOUT changing DOM for callers that omit it.
   *     gridClass - optional override (default 'chordGrid keyPalette') */
  function renderChords(container, items, opts) {
    opts = opts || {};
    if (opts.label) {
      var lbl = document.createElement('div'); lbl.className = 'keySubLbl';
      lbl.textContent = opts.label; container.appendChild(lbl);
    }
    // wrap=true (default): build a grid wrapper around the tiles (Compose). wrap=false:
    // append cells straight into `container` (the Tracks studio already owns its box+label).
    var wrap = (opts.wrap != null) ? opts.wrap : true;
    var parent = wrap ? document.createElement('div') : container;
    if (wrap) parent.className = opts.gridClass || 'chordGrid keyPalette';
    var cellClass = opts.cellClass || 'chordCell';
    items.forEach(function (it) {
      var d = opts.diagram(it.chord, 'small');
      if (!d) return;  // a diagram that can't render (returns null) is skipped, not crashed on
      if (opts.tapClass && d && d.classList) d.classList.add(opts.tapClass);
      if (opts.onTap) {
        (function (chord, el) { el.onclick = function () { opts.onTap(chord, el); }; })(it.chord, d);
      }
      if (it.roman) {
        var cell = document.createElement('div'); cell.className = cellClass;
        cell.appendChild(d);
        var rn = document.createElement('span'); rn.className = 'rn'; rn.textContent = it.roman;
        cell.appendChild(rn);
        parent.appendChild(cell);
      } else {
        parent.appendChild(d);
      }
    });
    if (wrap) container.appendChild(parent);
    return parent;
  }

  // Position-shift step/cap for the "walk the scale up the neck" control. STEP mirrors
  // how far a hand naturally slides in one move; CAP is the practical top-of-neck fret
  // this app already uses elsewhere (play/index.html's chainFitsFretboard caps chord
  // voicings the same way) - past it there's nothing meaningful left to solo into.
  var POS_STEP = 5, POS_CAP = 14;

  // Pure window math for the position control - exported so the cap/step
  // behavior is regression-testable without a DOM. startFret 0 is the open
  // window (F frets + the open column); a shifted window truncates at the cap.
  function posWindow(startFret, F, step, cap) {
    var shown = startFret === 0 ? F : Math.min(F, cap - startFret + 1);
    return {
      shown: shown,
      end: startFret === 0 ? shown : (startFret + shown - 1),
      canBack: startFret > 0,
      // Forward stops once the NEXT window would start past the cap's last
      // useful position (the 10-14 window); same 0/5/10 stops as before.
      canFwd: (startFret + step) <= (cap - step + 1)
    };
  }

  /* renderScale(container, pack, rootPc, pcs, opts)
   *   pack    - the instrument adapter (needs pack.scaleDiagram)
   *   rootPc  - pitch-class index of the tonic
   *   pcs     - scale pitch classes
   *   opts: label (optional 'Solo over it ...'), frets (default 7)
   * No-ops (returns null) when the pack can't render a scale or pcs is empty.
   * When the pack exposes pack.scaleDiagram.supportsStart, also renders a compact
   * back/forward position control beneath the diagram so the player can walk the
   * scale up the neck. Packs that don't set the flag keep the classic 3-arg
   * scaleDiagram call and get no control; they do share the boxWrap/diagBox
   * wrapper structure (needed so flex-row hosts lay out identically). */
  function renderScale(container, pack, rootPc, pcs, opts) {
    opts = opts || {};
    if (!(pack && typeof pack.scaleDiagram === 'function' && pcs && pcs.length)) return null;
    if (opts.label) {
      var sLbl = document.createElement('div'); sLbl.className = 'keySubLbl';
      sLbl.textContent = opts.label; container.appendChild(sLbl);
    }
    var F = opts.frets || 7;
    var supportsStart = !!pack.scaleDiagram.supportsStart;
    var startFret = 0;
    // boxWrap is a COLUMN holding the diagram + (optionally) the position control,
    // so the control always sits BENEATH the fretboard regardless of the host
    // container's layout - the Studio's .bt-st-scale is a flex row, which would
    // otherwise place a sibling control beside the diagram.
    var boxWrap = document.createElement('div'); boxWrap.className = 'scaleBoxWrap';
    container.appendChild(boxWrap);
    var diagBox = document.createElement('div'); diagBox.className = 'scaleDiagBox';
    boxWrap.appendChild(diagBox);
    // Clamp the WINDOW to POS_CAP, not just the start fret: a shifted window shows
    // min(F, POS_CAP - startFret + 1) frets, so the last position renders 10-14
    // and never draws frets past the top-of-neck cap the comments promise.
    function shownFrets() { return posWindow(startFret, F, POS_STEP, POS_CAP).shown; }
    function renderBox() {
      diagBox.innerHTML = '';
      // Packs without the supportsStart flag get the classic 3-arg call - no
      // startFret leaks into a signature that never declared it.
      diagBox.appendChild(supportsStart
        ? pack.scaleDiagram(rootPc, pcs, shownFrets(), startFret, opts.names)
        : pack.scaleDiagram(rootPc, pcs, F));
    }
    renderBox();
    if (supportsStart) {
      var ctrl = document.createElement('div'); ctrl.className = 'scalePosCtrl';
      var back = document.createElement('button');
      back.type = 'button'; back.className = 'scalePosBtn'; back.textContent = String.fromCharCode(0x25C0);
      back.setAttribute('aria-label', 'Shift the scale down the neck');
      var lbl = document.createElement('span'); lbl.className = 'scalePosLbl';
      var fwd = document.createElement('button');
      fwd.type = 'button'; fwd.className = 'scalePosBtn'; fwd.textContent = String.fromCharCode(0x25B6);
      fwd.setAttribute('aria-label', 'Shift the scale up the neck');
      function refresh() {
        var w = posWindow(startFret, F, POS_STEP, POS_CAP);
        lbl.textContent = 'frets ' + startFret + '-' + w.end;
        back.disabled = !w.canBack;
        fwd.disabled = !w.canFwd;
      }
      back.onclick = function () { startFret = Math.max(0, startFret - POS_STEP); renderBox(); refresh(); };
      fwd.onclick = function () { if (fwd.disabled) return; startFret += POS_STEP; renderBox(); refresh(); };
      refresh();
      ctrl.appendChild(back); ctrl.appendChild(lbl); ctrl.appendChild(fwd);
      boxWrap.appendChild(ctrl);
    }
    return boxWrap;
  }

  var KeyExplorer = { renderChords: renderChords, renderScale: renderScale, posWindow: posWindow };
  global.KeyExplorer = KeyExplorer;
  if (typeof module !== 'undefined' && module.exports) module.exports = KeyExplorer;

})(typeof window !== 'undefined' ? window : this);
