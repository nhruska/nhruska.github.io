/* =====================================================================
 * key-explorer.js  -  shared "key explorer" render primitives
 * ---------------------------------------------------------------------
 * The chords-in-key palette + solo-scale box, rendered identically in
 * both the Compose tab (interactive: tap a chord = add to progression)
 * and the Tracks player (read-only: tap = hear).
 *
 * Pattern: the caller pre-computes the THEORY and passes it in - the two
 * mounts use different vocabularies (Compose drops the diminished vii and
 * uses its own mode names, Tracks keeps vii and uses circle.js's), so a
 * shared computer here would silently change one side's palette. This
 * module only paints pixels + wires the supplied tap behaviour. It imports
 * NO context state (no addChord/progression/STATE) - everything
 * context-specific arrives via opts callbacks, so a Compose mount and a
 * Tracks mount never share mutable state.
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
   *                different from read-only hear-tiles (so the same UI never implies a
   *                different consequence) WITHOUT changing DOM for callers that omit it.
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

  // Default fret-window depth per instrument. 4-string necks (uke/mandolin/
  // mandola/cigar box) get a taller 12-fret window - a 7-fret open window
  // covers less musical value per fret on 4 strings than on 6+. Banjo(5) and
  // guitars keep the classic 7-fret window. Exported for direct testing.
  function defaultFrets(pack) {
    return (pack && pack.meta && pack.meta.strings <= 4) ? 12 : 7;
  }

  // Position-shift step/cap for the "walk the scale up the neck" control. STEP mirrors
  // how far a hand naturally slides in one move; CAP is the practical top-of-neck fret
  // this app already uses elsewhere (play/index.html's chainFitsFretboard caps chord
  // voicings the same way) - past it there's nothing meaningful left to solo into.
  var POS_STEP = 5, POS_CAP = 14;

  /* ---------------------------------------------------------------------
   * Named box positions (Box 1-5) for the pentatonic/blues scale-chip
   * selections, riding this same posWindow pager. Pure pitch-class math -
   * no DOM, node-testable - so the position-control wiring below can offer
   * a "snap to box start" walk instead of the fixed 0/5/10 step whenever
   * the active solo scale is pentMajor/pentMinor/blues.
   *
   * The 5 boxes are the classic CAGED-derived teaching windows: each box's
   * START FRET is the natural fret (on the LOWEST string, index 0 of the
   * caller's openPcs - "lowest" per this codebase's existing string-index
   * convention, not necessarily lowest acoustic pitch on a re-entrant neck
   * like ukulele) where the NEXT pentatonic-minor scale degree occurs, above
   * the previous box's fret. blues rides the SAME 5 windows as pentMinor
   * (blues = pentMinor + the b5 passing tone - a 6th note that never earns
   * its own box). pentMajor is "the same shapes" as its relative minor: box
   * windows derive from the relative-minor root (rootPc - 3), then each
   * box's labeled root-string anchor is re-solved for the ACTUAL major
   * rootPc the caller asked for, so the highlighted tonic always matches the
   * query, not the shape's internal reference root.
   * ------------------------------------------------------------------- */
  var PENT_MINOR_OFFSETS = [0, 3, 5, 7, 10]; // root, b3, 4, 5, b7 - one per box

  function mod12(n) { return ((n % 12) + 12) % 12; }

  // pentMajor's box SHAPES are its relative minor's (a minor 3rd, 3
  // semitones, below); every other scaleId (pentMinor, blues) uses its own
  // rootPc directly as the shape's reference root.
  function boxShapeRoot(rootPc, scaleId) {
    return scaleId === 'pentMajor' ? mod12(rootPc - 3) : mod12(rootPc);
  }

  // The fret >= floor on a string whose open pitch class is openPc where pc
  // occurs (walking up in octaves as needed to clear floor).
  function fretOf(pc, openPc, floor) {
    var f = mod12(pc - openPc);
    while (f < floor) f += 12;
    return f;
  }

  // Across every string (any reasonable octave), the (string, fret) pair
  // closest to targetFret where pc occurs - ties broken by lowest string
  // index, then lowest fret. Always resolves to something (a pc recurs
  // every 12 frets on any single string), satisfying the "anchor to the
  // lowest string containing the root pc in that window" fallback for
  // small (4-string) necks without any special-casing.
  function nearestAnchor(pc, openPcs, targetFret) {
    var wanted = mod12(pc), best = null;
    openPcs.forEach(function (openPc, s) {
      var base = mod12(wanted - openPc);
      [base, base + 12, base + 24].forEach(function (f) {
        if (f < 0) return;
        var d = Math.abs(f - targetFret);
        if (!best || d < best.d || (d === best.d && s < best.string) ||
          (d === best.d && s === best.string && f < best.fret)) {
          best = { string: s, fret: f, d: d };
        }
      });
    });
    return best ? { string: best.string, fret: best.fret } : { string: 0, fret: targetFret };
  }

  // English ordinal suffix (6 -> '6th', 1 -> '1st') for the box label text.
  function ordinal(n) {
    var v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    switch (n % 10) {
      case 1: return n + 'st';
      case 2: return n + 'nd';
      case 3: return n + 'rd';
      default: return n + 'th';
    }
  }

  /* boxes(rootPc, scaleId, openPcs) -> [{ n, startFret, rootString, label,
   * moveHint }, ...] (n: 1-5, in scale-degree order - NOT necessarily
   * ascending by startFret; a wrapped box can sit below an earlier one, the
   * classic "Box 5 sits just below Box 1" teaching shape).
   *   rootPc  - the scale's actual tonic pitch class (0-11); for pentMajor
   *             this is the MAJOR root, even though the shape itself is
   *             computed from the relative minor (see boxShapeRoot above).
   *   scaleId - 'pentMajor' | 'pentMinor' | 'blues'
   *   openPcs - open pitch class per string, in the SAME declared order as
   *             the instrument profile's `strings` array (index 0 = the
   *             array's first entry - this codebase's "lowest string"
   *             convention; see profiles/*.js `l` labels).
   * moveHint is template-generated (no curated per-box prose): the fret
   * delta to the NEXT box walking up the neck (by startFret, not by box
   * number - a player slides to whichever box comes next physically), or a
   * loop-back note for the box at the top of the mapped (0-14) range.
   * Safe/empty: returns [] when rootPc or openPcs is missing. */
  function boxes(rootPc, scaleId, openPcs) {
    if (rootPc == null || !openPcs || !openPcs.length) return [];
    var shapeRoot = boxShapeRoot(rootPc, scaleId);
    var anchorOpenPc = mod12(openPcs[0]);
    var raw = [];
    PENT_MINOR_OFFSETS.forEach(function (offset, i) {
      var pc = mod12(shapeRoot + offset);
      var floor = i === 0 ? 0 : raw[i - 1] + 1;
      raw.push(fretOf(pc, anchorOpenPc, floor));
    });
    // Fold anything past the pager cap back down an octave, never below
    // fret 0: subtract 12 when a start would exceed the pager cap of 14,
    // keeping startFret >= 0.
    var frets = raw.map(function (f) {
      while (f > POS_CAP && (f - 12) >= 0) f -= 12;
      return f;
    });
    var list = frets.map(function (startFret, i) {
      var n = i + 1;
      var anchor = nearestAnchor(rootPc, openPcs, startFret);
      var stringNumber = openPcs.length - anchor.string; // this codebase's display convention (see profiles/*.js)
      return {
        n: n,
        startFret: startFret,
        rootString: anchor.string,
        label: 'Box ' + n + ' - root on ' + ordinal(stringNumber) + ' string, fret ' + anchor.fret,
        moveHint: ''
      };
    });
    // moveHint walks the NECK order (ascending startFret), not the n order -
    // sort a shallow copy (same object refs) so mutating box.moveHint here
    // is reflected in `list`, which stays in n:1..5 order for the caller.
    var neckOrder = list.slice().sort(function (a, b) { return a.startFret - b.startFret; });
    neckOrder.forEach(function (box, i) {
      if (i < neckOrder.length - 1) {
        var next = neckOrder[i + 1], delta = next.startFret - box.startFret;
        box.moveHint = 'slide up ' + delta + ' fret' + (delta === 1 ? '' : 's') + ' to Box ' + next.n;
      } else {
        box.moveHint = 'top of the mapped range - the pattern repeats an octave up from Box ' + neckOrder[0].n;
      }
    });
    return list;
  }

  // Natural-letter pitch classes (no octave) - the profiles' `strings[].n`
  // field is always a bare natural letter today, but '#'/'b' suffixes are
  // handled too so a future accidental-tuned profile degrades safely
  // instead of returning null.
  var NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pcOfNoteName(name) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return null;
    var base = NATURAL_PC[s.charAt(0).toUpperCase()];
    if (base == null) return null;
    var pc = base;
    for (var i = 1; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '#') pc += 1; else if (c.toLowerCase() === 'b') pc -= 1;
    }
    return mod12(pc);
  }

  // The Studio-wiring convenience: derive boxes()'s openPcs arg straight
  // from the pack's own adapter metadata (play/index.html's
  // adapter.meta.stringNames), so callers never touch note-name parsing.
  // null (not []) when the pack can't supply string names - callers treat
  // that as "box mode unavailable", same as an unresolvable rootPc.
  function openPcsFromPack(pack) {
    var names = pack && pack.meta && pack.meta.stringNames;
    if (!names || !names.length) return null;
    var pcs = names.map(pcOfNoteName);
    return pcs.every(function (p) { return p != null; }) ? pcs : null;
  }

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
   *   opts: label (optional 'Solo over it ...'), frets (default 7), tones
   *         (optional chord-tone targeting - see diagram.js's Diagram.scale()
   *         opts.tones contract), boxScaleId (optional - see below)
   * No-ops (returns null) when the pack can't render a scale or pcs is empty.
   * When the pack exposes pack.scaleDiagram.supportsStart, also renders a compact
   * back/forward position control beneath the diagram so the player can walk the
   * scale up the neck. Packs that don't set the flag keep the classic 3-arg
   * scaleDiagram call and get no control; they do share the boxWrap/diagBox
   * wrapper structure (needed so flex-row hosts lay out identically).
   *
   * Box-snapping: when opts.boxScaleId is 'pentMajor'/'pentMinor'/'blues'
   * (the caller's currently-active solo scale-chip) AND the pack supports
   * position-start, the back/forward buttons SNAP to box() start frets
   * (physical neck order, ascending) instead of the fixed 0/5/10 walk, and a
   * '.scaleBoxChip' element (sibling of the ctrl row) shows the current
   * box's label whenever startFret lands exactly on one - hidden otherwise.
   * Any other scaleId (mode scales - the 7-note modes) keeps the classic
   * walk untouched. Silently degrades to the classic walk if the pack can't
   * supply openPcsFromPack() (e.g. no meta.stringNames) - never throws.
   *
   * The returned boxWrap ALSO carries setTones(tones): re-renders ONLY diagBox
   * with new opts.tones, preserving startFret - use this instead of a full
   * renderScale() re-call when just toggling a chord target on/off, so the
   * player's position-walk isn't reset by the re-mark.
   *
   * Two more boxWrap seams:
   *   opts.noPosCtrl (full-neck view) - suppresses the back/forward
   *     position-control UI (and any box-chip) even when the pack
   *     supportsStart - the pack's full 6-arg scaleDiagram call still fires
   *     (names/tones still forward), there's just nothing to walk when the
   *     caller already requested the whole mapped range in one span. Callers
   *     pair this with frets:POS_CAP (see the exported POS_CAP below) for the
   *     "0-14, no pager" full-neck window; posWindow(0, POS_CAP, ...) then
   *     shows the whole thing at startFret 0 with no need for the buttons.
   *   boxWrap.setSounding(pc) - a class-swap pass over ALREADY-RENDERED dots
   *     (never a re-render, mirroring setTones' position-preserving behavior):
   *     lights every dot whose data-pc matches pc with kx-sounding, clearing
   *     whichever dots were lit before. Re-applies itself automatically after
   *     every renderBox() (a position walk or setTones call) so the sounding
   *     mark survives a fret window change instead of silently vanishing.
   *     setSounding(null) clears with no new highlight - the Studio's
   *     stop/chip-switch/view-toggle paths all route through this for the
   *     "nothing sounding" state. */
  function renderScale(container, pack, rootPc, pcs, opts) {
    opts = opts || {};
    if (!(pack && typeof pack.scaleDiagram === 'function' && pcs && pcs.length)) return null;
    if (opts.label) {
      var sLbl = document.createElement('div'); sLbl.className = 'keySubLbl';
      sLbl.textContent = opts.label; container.appendChild(sLbl);
    }
    var F = opts.frets || defaultFrets(pack);
    var supportsStart = !!pack.scaleDiagram.supportsStart;
    // The pack-contract call shape (names/tones passthrough) stays keyed to
    // supportsStart alone; ONLY the position-control UI is additionally gated
    // on !opts.noPosCtrl, so full-neck mode still gets a proper 6-arg render,
    // just without walk buttons that would have nothing useful to do.
    var showPosCtrl = supportsStart && !opts.noPosCtrl;
    var startFret = 0;
    var curTones = opts.tones || null;
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
    // Sounding-note highlight state, applied/re-applied by renderBox() so it
    // survives every re-render path (position walk, setTones, and its own
    // setSounding() calls) without ever forcing an EXTRA re-render itself.
    var curSoundingPc = null, soundingEls = [];
    function clearSounding() {
      soundingEls.forEach(function (el) { el.classList.remove('kx-sounding'); });
      soundingEls = [];
    }
    function applySounding() {
      clearSounding();
      if (curSoundingPc == null || !diagBox.querySelectorAll) return; // never throws on a DOM stub without the method
      var matches = diagBox.querySelectorAll('[data-pc="' + curSoundingPc + '"]');
      Array.prototype.forEach.call(matches, function (el) { el.classList.add('kx-sounding'); soundingEls.push(el); });
    }
    function renderBox() {
      diagBox.innerHTML = '';
      // Packs without the supportsStart flag get the classic 3-arg call - no
      // startFret/tones leak into a signature that never declared them.
      diagBox.appendChild(supportsStart
        ? pack.scaleDiagram(rootPc, pcs, shownFrets(), startFret, opts.names, curTones)
        : pack.scaleDiagram(rootPc, pcs, F));
      soundingEls = []; // the old dots are gone with the innerHTML wipe above
      applySounding();
    }
    renderBox();
    if (showPosCtrl) {
      // box() list for the active scale-chip, in NECK order (ascending
      // startFret) - empty unless opts.boxScaleId is one of the 3
      // box-eligible ids AND the pack can supply openPcsFromPack(). Kept
      // read-only/local to this renderScale() call (a chip switch always
      // calls renderScale() fresh, so no stale box list can leak across
      // scale-chip selections).
      var boxScaleId = opts.boxScaleId || null;
      var neckOrder = [];
      if (boxScaleId) {
        var tuningPcs = openPcsFromPack(pack);
        if (tuningPcs) {
          try { neckOrder = boxes(rootPc, boxScaleId, tuningPcs).slice().sort(function (a, b) { return a.startFret - b.startFret; }); }
          catch (e) { neckOrder = []; }
        }
      }
      function currentBox() {
        for (var i = 0; i < neckOrder.length; i++) if (neckOrder[i].startFret === startFret) return neckOrder[i];
        return null;
      }
      // dir: +1 forward (next HIGHER box start), -1 back (next LOWER box
      // start). null when there is none in that direction.
      function nextBoxFret(dir) {
        var pick = null;
        neckOrder.forEach(function (b) {
          if (dir > 0 ? b.startFret > startFret : b.startFret < startFret) {
            if (pick == null || (dir > 0 ? b.startFret < pick : b.startFret > pick)) pick = b.startFret;
          }
        });
        return pick;
      }
      var ctrl = document.createElement('div'); ctrl.className = 'scalePosCtrl';
      var back = document.createElement('button');
      back.type = 'button'; back.className = 'scalePosBtn'; back.textContent = String.fromCharCode(0x25C0);
      back.setAttribute('aria-label', 'Shift the scale down the neck');
      var lbl = document.createElement('span'); lbl.className = 'scalePosLbl';
      var fwd = document.createElement('button');
      fwd.type = 'button'; fwd.className = 'scalePosBtn'; fwd.textContent = String.fromCharCode(0x25B6);
      fwd.setAttribute('aria-label', 'Shift the scale up the neck');
      // Box-name chip: only allocated when a box list actually resolved, so
      // every non-box (mode-scale) render stays byte-identical to before.
      var chipEl = null;
      if (neckOrder.length) { chipEl = document.createElement('div'); chipEl.className = 'scaleBoxChip'; chipEl.hidden = true; }
      function refresh() {
        var w = posWindow(startFret, F, POS_STEP, POS_CAP);
        lbl.textContent = 'frets ' + startFret + '-' + w.end;
        if (neckOrder.length) {
          back.disabled = nextBoxFret(-1) == null;
          fwd.disabled = nextBoxFret(1) == null;
          if (chipEl) {
            var cur = currentBox();
            chipEl.hidden = !cur;
            chipEl.textContent = cur ? cur.label : '';
          }
        } else {
          back.disabled = !w.canBack;
          fwd.disabled = !w.canFwd;
        }
      }
      back.onclick = function () {
        if (neckOrder.length) {
          if (back.disabled) return;
          var pf = nextBoxFret(-1);
          if (pf != null) startFret = pf;
        } else {
          startFret = Math.max(0, startFret - POS_STEP);
        }
        renderBox(); refresh();
      };
      fwd.onclick = function () {
        if (neckOrder.length) {
          if (fwd.disabled) return;
          var nf = nextBoxFret(1);
          if (nf != null) startFret = nf;
        } else {
          if (fwd.disabled) return;
          startFret += POS_STEP;
        }
        renderBox(); refresh();
      };
      refresh();
      ctrl.appendChild(back); ctrl.appendChild(lbl); ctrl.appendChild(fwd);
      boxWrap.appendChild(ctrl);
      if (chipEl) boxWrap.appendChild(chipEl);
    }
    // Re-render just diagBox with new tones - startFret (closure var above) is
    // untouched, so a target toggle never resets the position walk.
    boxWrap.setTones = function (tones) { curTones = tones || null; renderBox(); };
    // pc==null (or omitted) clears with no new highlight - callers use this for
    // "nothing sounding" (stop / chip-switch-while-stopped / Studio close). A
    // class-swap only - never triggers renderBox() itself.
    boxWrap.setSounding = function (pc) { curSoundingPc = (pc == null ? null : pc); applySounding(); };
    return boxWrap;
  }

  var KeyExplorer = {
    renderChords: renderChords, renderScale: renderScale, posWindow: posWindow, defaultFrets: defaultFrets,
    // Pure box-position math + its pack-metadata helper, exported for direct
    // Node tests independent of the renderScale DOM wiring.
    boxes: boxes, openPcsFromPack: openPcsFromPack,
    // The same top-of-neck fret cap the position-pager already enforces
    // internally - exported so callers (tracks.js) can request the full-neck
    // span (frets: POS_CAP) without duplicating the constant.
    POS_CAP: POS_CAP
  };
  global.KeyExplorer = KeyExplorer;
  if (typeof module !== 'undefined' && module.exports) module.exports = KeyExplorer;

})(typeof window !== 'undefined' ? window : this);
