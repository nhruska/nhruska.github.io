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
   *     diagram  - REQUIRED fn(chordName, size) -> tile element (caller's pack diagram)
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

  /* renderScale(container, pack, rootPc, pcs, opts)
   *   pack    - the instrument adapter (needs pack.scaleDiagram)
   *   rootPc  - pitch-class index of the tonic
   *   pcs     - scale pitch classes
   *   opts: label (optional 'Solo over it ...'), frets (default 7)
   * No-ops (returns null) when the pack can't render a scale or pcs is empty. */
  function renderScale(container, pack, rootPc, pcs, opts) {
    opts = opts || {};
    if (!(pack && typeof pack.scaleDiagram === 'function' && pcs && pcs.length)) return null;
    if (opts.label) {
      var sLbl = document.createElement('div'); sLbl.className = 'keySubLbl';
      sLbl.textContent = opts.label; container.appendChild(sLbl);
    }
    var box = pack.scaleDiagram(rootPc, pcs, opts.frets || 7);
    container.appendChild(box);
    return box;
  }

  var KeyExplorer = { renderChords: renderChords, renderScale: renderScale };
  global.KeyExplorer = KeyExplorer;
  if (typeof module !== 'undefined' && module.exports) module.exports = KeyExplorer;

})(typeof window !== 'undefined' ? window : this);
