/* =====================================================================
 * chord-pack-adapter.js  -  buildAdapter(profile): the app's ONLY
 * instrument-specific seam, wrapping a pure-data tuning profile (string
 * frequencies + hand-curated chord fingerings) into the chord-pack contract
 * Songbook.mount() consumes everywhere (hasChord/diagram/diagramChain/
 * playChord/scaleDiagram/init - see engineering-wiki/systems/
 * runtime-architecture.md "Chord-pack adapter - the ONLY instrument-specific
 * seam").
 * ---------------------------------------------------------------------
 * S-EXTRACT (analysis-refactor-enhance-20260704 A3): moved verbatim out of
 * music/play/index.html's inline bootstrap script, where it was previously
 * untestable except via a regex-extraction + `new Function()` sandbox
 * (test/live-adapter.test.js's old approach) covering only the enharmonic
 * profileVoicing() path. Now a real require()-able module - test/
 * live-adapter.test.js requires it directly and exercises the movable-
 * template math, the I-IV-V chain + backoff, and the off-fretboard
 * Position-2 fallback against real guitar-standard/ukulele-gcea profile
 * fixtures, none of which the old extraction could reach.
 *
 * No logic changed by the move - every function body is byte-identical to
 * the inline version, with ONE necessary substitution: the page-local `el()`
 * DOM helper (`document.getElementById`) used once inside adapter.init() is
 * inlined directly, since `el` lives in play/index.html's own closure and
 * can't cross the module boundary - functionally identical, just no longer
 * indirected through the page's private helper name.
 *
 * S-DIAGRAM-PREF steps 1-2 (2026-07-06, post-S-EXTRACT rebase): diagram/
 * diagramClosed/diagramChain now also compute an optional patternLabel via
 * window.DiagramPref.labelFor(profile.id, name, frets) and pass it through
 * to Diagram.render() - '' whenever the pref is 'dots' or the voicing isn't
 * classifiable. See shared/diagram-pref.js and shared/diagram.js.
 * U25 (M-SETTINGS-CLARITY, 2026-07-05): the label is additionally keyed on
 * render SIZE - only 'big' (detail/maximize) renders label; 'small' card
 * rows never do, in either pref mode. See labelFor()/reserveLabelSlot()
 * below for the full rationale.
 *
 * window.Diagram / window.ChordAudio / window.Tuner / window.Songbook /
 * window.DiagramPref stay lazy global lookups (unchanged) - callers keep
 * supplying them via script order in play/index.html and play/
 * triad-inversions.html; a Node test stubs window.Diagram/window.ChordAudio
 * to inspect the fret math without a DOM.
 *
 * Load AFTER circle.js (so window.Songbook.noteToPc/chordRootFreq, if
 * mounted, are available - both optional, a no-Songbook context falls back
 * to the CHORD_PC table / a 261.63 Hz reference tone) and BEFORE the play/
 * index.html inline bootstrap that calls ChordPackAdapter.buildAdapter(profile).
 * music/sw.js CORE must precache this file (test/sw-verify.test.js A6 guard).
 * ===================================================================== */
(function (global) {
  'use strict';

  function rootFreq(name) {
    if (window.Songbook && typeof window.Songbook.chordRootFreq === 'function') return window.Songbook.chordRootFreq(name);
    return 261.63;
  }

  // ---- movable-shape fallback (instrument-agnostic) --------------------------
  // Profiles list explicit fingerings only for common chords. Transpose/compose
  // can land on any of the 12 roots, so for a chord the profile doesn't list we
  // slide a CLOSED template (no open strings, so it moves) of the same quality up
  // to the requested root - keeping the lowest valid window. Result: every key
  // both draws a real shape and strums on every instrument.
  var CHORD_PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freqPc(f) { return ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12; }
  // Parse the root pitch class generically (handles E#, B#, Cb, Fb, double accidentals
  // that the CHORD_PC table can't) via the shared helper; table is the no-Songbook fallback.
  function chordRootPc(name) {
    if (window.Songbook && typeof window.Songbook.noteToPc === 'function') {
      var m0 = /^([A-G][#bx]*)/.exec(name); if (m0) { var pc = window.Songbook.noteToPc(m0[1]); if (pc != null) return pc; }
    }
    var m = /^([A-G][#b]?)/.exec(name); return m ? (CHORD_PC[m[1]] != null ? CHORD_PC[m[1]] : null) : null;
  }
  function chordQual(name) { var m = /^[A-G][#b]?(.*)$/.exec(name); return m ? m[1] : ''; }
  function buildTemplates(chords) {
    var t = {}; if (!chords) return t;
    Object.keys(chords).forEach(function (nm) {
      var fr = chords[nm]; if (fr.indexOf(0) >= 0) return;        // open string -> can't slide
      var q = chordQual(nm), rp = chordRootPc(nm); if (rp == null) return;
      (t[q] = t[q] || []).push({ frets: fr, rootPc: rp });
    });
    return t;
  }
  // If a profile lists no CLOSED shape for a quality (e.g. Open-G has no movable
  // maj7/m7 barre), slide a closely-related quality to the same root rather than
  // drawing a blank name-only slot - a real, strummable shape beats nothing.
  var QUAL_FALLBACK = { 'maj7': ['', '7'], 'm7': ['m'], '7': [''], '6': [''], 'sus4': [''], 'sus2': [''] };
  function movableVoicing(templates, name) {
    var q = chordQual(name), rp = chordRootPc(name); if (rp == null) return null;
    var tries = [q].concat(QUAL_FALLBACK[q] || []);
    for (var i = 0; i < tries.length; i++) {
      var tpls = templates[tries[i]]; if (!tpls || !tpls.length) continue;
      var best = null;
      tpls.forEach(function (tp) {
        var base = ((rp - tp.rootPc) % 12 + 12) % 12;             // slide up to the root,
        [base, base - 12].forEach(function (d) {                  // or down an octave - lowest wins
          var ok = true, f = tp.frets.map(function (x) { if (x < 0) return -1; var v = x + d; if (v < 1) ok = false; return v; });
          if (!ok) return; var max = Math.max.apply(null, f); if (max > 14) return;
          if (!best || max < best.max) best = { f: f, max: max };
        });
      });
      if (best) return best.f;
    }
    return null;
  }

  // Build the chord-pack interface the songbook engine expects, from a pure-data
  // profile + the shared Diagram / ChordAudio / Tuner modules.
  // For instruments whose top three played strings (strings 4-3-2 in display
  // order, A muted) form a [P4, M3] interval pattern, the artifact's three-
  // string triad-inversion shapes apply: a C-shape index bar at fret N + the
  // F-shape barre (bar at N, ring at N+2 string 4, middle at N+1 string 2) +
  // A-shape (ring on string 4 etc.). The base profile only lists open-position
  // four-string voicings, so movable fallback would otherwise reach for E/B
  // templates that produce high-fret 4-string barres. Injecting the artifact's
  // two barre shapes as additional movable major-quality templates makes the
  // fallback pick the LOWEST-fret artifact voicing - which fixes both the
  // palette (F# shows F-shape barre at fret 1, not E-shape at fret 6) and the
  // I-IV-V chain (uses C-shape I and F-shape IV/V the artifact teaches).
  // Restricted to ukulele - cigar box and banjo have their own intentional
  // 4-string ring-bar profile (HSR-by-design) that we don't want to override.
  function augmentTriadShapes(profile, templates) {
    if (!profile || profile.instrument !== 'ukulele') return false;
    var strs = profile.strings; if (!strs || strs.length !== 4) return false;
    var pc0 = freqPc(strs[0].f), pc1 = freqPc(strs[1].f), pc2 = freqPc(strs[2].f);
    if ((pc1 - pc0 + 12) % 12 !== 5) return false;     // strings 4->3 must be P4
    if ((pc2 - pc1 + 12) % 12 !== 4) return false;     // strings 3->2 must be M3
    templates[''] = templates[''] || [];
    // unshift order matters: movableVoicing iterates templates in order and
    // strict-less-than tiebreak means FIRST entry wins ties. So the artifact
    // shapes go to the front - a profile-derived 4-string voicing only wins
    // when its max fret is strictly lower. Result: F# resolves to the F-shape
    // barre at fret 1 not the E-shape barre at fret 6, and natural-key chord
    // voicings used in the I-IV-V chain pick the artifact's 3-string mute-A
    // shapes over the open 4-string strums (matches the artifact's pedagogy).
    // F-shape barre at fret 1: bar at 1, ring at 3 on string 4, middle at 2 on
    // string 2. Triad root sits on string 2, so rootPc = (string-2 open + 2) % 12.
    templates[''].unshift({ frets: [3, 1, 2, -1], rootPc: (pc2 + 2) % 12 });
    // C-shape index-bar at fret 1: bar across strings 4-3-2 at fret 1, string 1
    // muted. Triad root sits on string 3, so rootPc = (string-3 open + 1) % 12.
    templates[''].unshift({ frets: [1, 1, 1, -1], rootPc: (pc1 + 1) % 12 });
    // Em-shape closed barre [4, 4, 3, 2] - lowest movable minor barre on uke.
    // Without this, the only closed minor template is Bm [4,3,2,2] (rp=11) so
    // G#m, A#m etc end up high (rp=8 -> [13,11,11,11] max=13). With Em-shape
    // (rp=4) injected, G#m lands at [8,8,7,6] max=8 - playable on a uke neck.
    templates['m'] = templates['m'] || [];
    // Notes for [4,4,3,2]: G+4=B, C+4=E, E+3=G, A+2=B - sounds Em (E G B). The
    // root (E) sits on string 3, so rootPc = (string-3 open + 4) % 12.
    templates['m'].unshift({ frets: [4, 4, 3, 2], rootPc: (pc1 + 4) % 12 });
    return true;
  }

  function buildAdapter(profile) {
    var openFreqs = profile.strings.map(function (s) { return s.f; });
    var templates = buildTemplates(profile.chords);
    var triadStyle = augmentTriadShapes(profile, templates);
    // Enharmonic-tolerant profile lookup (FORK-4): the app requests canonical
    // SHARP names (A#, D#m) while some profiles' hand-curated voicings are keyed
    // with flats (mandolin's Bb). Try the exact name, then the root respelled,
    // so the curated open shape wins over a movable approximation either way.
    // The DISPLAY name stays whatever the caller passed.
    var ENH = { 'A#': 'Bb', 'Bb': 'A#', 'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#', 'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#' };
    function profileVoicing(name) {
      if (!profile.chords) return null;
      if (profile.chords[name]) return profile.chords[name];
      var m = /^([A-G][#b])(.*)$/.exec(name || '');
      return (m && ENH[m[1]]) ? (profile.chords[ENH[m[1]] + m[2]] || null) : null;
    }
    // explicit profile voicing first; else a movable shape; else null (name-only)
    function voicingFor(name) {
      return profileVoicing(name) || movableVoicing(templates, name) || null;
    }
    // HSR Chain wants the CLOSED (movable) shape so I/IV/V show the same hand
    // shape slid up the neck. If the profile only has an open shape (no closed
    // template), fall back so the chord still renders.
    function closedVoicingFor(name) {
      return movableVoicing(templates, name) || profileVoicing(name) || null;
    }
    // I-IV-V chain voicings.
    // On artifact-supported instruments (uke with the augmented C-shape/F-shape
    // barre templates), the closed-voicing pool already prefers the artifact's
    // adjacent-inversion shapes for every chord. Route both naturals and
    // sharps/flats through closedVoicingFor so the chain shows the artifact's
    // C-shape I + F-shape IV + F-shape+2 V even when the profile has an open
    // 4-string voicing. The teaching point of the chain is the artifact's
    // mechanic, not the everyday open strum.
    // On other instruments (cigar box, banjo, guitar) the artifact templates
    // are NOT injected, so chainVoicings keeps the original behavior: I uses
    // the profile's preferred voicing (often open), IV/V use closed/movable.
    function chainVoicings(names) {
      if (!names || !names.length) return [];
      if (triadStyle) return triadChainVoicings(names);
      var I = voicingFor(names[0]);                   // home shape (open if profile has one)
      var IV = closedVoicingFor(names[1]);            // closed/movable family for IV
      if (!IV) return [I, voicingFor(names[1]), voicingFor(names[2])];
      // V is IV slid up 2 frets - chord tones stay aligned because IV->V is a
      // whole step in every supported mode. Muted strings stay muted.
      var V = IV.map(function (f) { return f < 0 ? -1 : f + 2; });
      var maxV = Math.max.apply(null, V.filter(function (f) { return f >= 0; }));
      if (maxV > 14) {
        // Slid V is off the fingerboard - try a lower IV family so the slide fits.
        var alt = chainVoicingsBackoff(names);
        if (alt) return alt;
      }
      return [I, IV, V];
    }
    // Artifact-style chain for uke: deterministic shape construction so EVERY
    // key shows the same teaching mechanic (C-shape I + F-shape IV + F-shape
    // slid+2 V). The math derives directly from the open-string pitch classes,
    // so chord tones are guaranteed correct for any key:
    //   C-shape index bar at fret N  -> sounds the chord rooted at (C_open + N)
    //   F-shape barre at fret N      -> sounds the chord rooted at (E_open + N + 1) = IV when N matches I
    //   F-shape barre at fret N + 2  -> V (a whole step up from IV)
    // C major (rp=0) is the one exception: bar-at-fret-0 is impossible, so the
    // artifact uses open-position partials at fret 0. Hard-coded.
    // For high-rooted keys (B, sometimes A#) Position 1 runs off the 14-fret
    // floor, so fall back to Position 2 (A-shape I + ring-bar IV + ring-bar+2 V)
    // which sits lower on the neck.
    function triadChainVoicings(names) {
      if (names[0] === 'C' && names[1] === 'F' && names[2] === 'G') {
        return [[0, 0, 0, -1], [2, 0, 1, -1], [4, 2, 3, -1]];
      }
      var rpI = chordRootPc(names[0]);
      if (rpI == null) return [voicingFor(names[0]), voicingFor(names[1]), voicingFor(names[2])];
      var f = rpI < 1 ? rpI + 12 : rpI;  // C-shape index bar at fret f
      var p1 = [
        [f, f, f, -1],
        [f + 2, f, f + 1, -1],
        [f + 4, f + 2, f + 3, -1]
      ];
      if (chainFitsFretboard(p1)) return p1;
      // Position 2 fallback: A-shape I where X = ring fret on string 4 = the
      // fret that puts the key root on string 4 = (rpI - G_open_pc + 12) % 12.
      // Then middle on string 3 at X-1, index on string 2 at X-2. IV is the
      // ring-bar AT the same fret X (sounds the IV chord because rotating
      // hand keeps fret 4 but bars 4-3-2 at X). V is ring-bar at X+2.
      // Lands B major at frets 2-6 instead of running off at fret 15.
      var X = ((rpI - 7) % 12 + 12) % 12;
      if (X < 2) X += 12;
      var p2 = [
        [X, X - 1, X - 2, -1],
        [X, X, X, -1],
        [X + 2, X + 2, X + 2, -1]
      ];
      if (chainFitsFretboard(p2)) return p2;
      // Last resort: fall through to the per-chord closed-voicing logic.
      var I = closedVoicingFor(names[0]);
      var IV = closedVoicingFor(names[1]);
      if (!I || !IV) return [voicingFor(names[0]), voicingFor(names[1]), voicingFor(names[2])];
      var V = IV.map(function (fr) { return fr < 0 ? -1 : fr + 2; });
      return [I, IV, V];
    }
    function chainFitsFretboard(chain) {
      for (var i = 0; i < chain.length; i++) {
        for (var j = 0; j < chain[i].length; j++) {
          if (chain[i][j] > 14) return false;
        }
      }
      return true;
    }
    // Backoff when the default V slid-up-2 falls off the fingerboard: try every
    // major-quality template, pick one whose IV+2 voicing fits (max fret <= 14).
    // Same-shape adjacency wins over absolute lowest position.
    function chainVoicingsBackoff(names) {
      var q = chordQual(names[1]); var tpls = templates[q];
      if (!tpls || !tpls.length) return null;
      var rpIV = chordRootPc(names[1]); if (rpIV == null) return null;
      var best = null;
      tpls.forEach(function (tp) {
        var base = ((rpIV - tp.rootPc) % 12 + 12) % 12;
        [base, base - 12].forEach(function (d) {
          var ok = true, IV = tp.frets.map(function (x) { if (x < 0) return -1; var v = x + d; if (v < 1) ok = false; return v; });
          if (!ok) return; var maxIV = Math.max.apply(null, IV); if (maxIV > 12) return;  // leave room to slide
          var V = IV.map(function (f) { return f < 0 ? -1 : f + 2; });
          var maxV = Math.max.apply(null, V.filter(function (f) { return f >= 0; }));
          if (maxV > 14) return;
          if (!best || maxV < best.max) best = { max: maxV, IV: IV, V: V };
        });
      });
      return best ? [voicingFor(names[0]), best.IV, best.V] : null;
    }
    // S-DIAGRAM-PREF steps 1-2: this is the ONE choke point every chord
    // diagram in the app renders through (mirrors the scaleDiagram comment
    // below), so it's where the 'patterns' label gets computed and handed to
    // the generic, pref-agnostic Diagram.render(). '' (falsy) whenever the
    // pref is 'dots' or the voicing isn't classifiable - diagram.js then
    // renders byte-identical to the pre-existing output. See shared/
    // diagram-pref.js for the decision; window.DiagramPref is an optional
    // lookup (undefined in a test/DOM stub that doesn't load it) so this
    // degrades to no label rather than throwing.
    //
    // U25 (M-SETTINGS-CLARITY, operator UAT 2026-07-05): shape labels are
    // DETAIL-view content, keyed on render size at this one choke point -
    // only 'big' renders (the maximize/inversions overlay, where one glance
    // studies one voicing) ever label. 'small' card rows - the Compose
    // picker grids (In key + All), the progression filmstrip, the Studio
    // chord row - NEVER label, in either pref mode: at card size the
    // 3-line classification text ("D-shape barre, root on 3, root
    // position") is noise the eye has to skate around while picking, not
    // information (the operator's finding). This supersedes the U21
    // small-card reservation below for small sizes; a size the app doesn't
    // use defaults to unlabeled (only an explicit 'big' opts in).
    function labelFor(name, frets, size) {
      if (size !== 'big') return '';
      return window.DiagramPref ? window.DiagramPref.labelFor(profile.id, name, frets) : '';
    }
    // U21 (M-EAR wave 1.6, docs/plans/uat-walkthrough-20260704.md), narrowed
    // by U25 above: a 'patterns'-mode BIG-size caller reserves the label
    // slot on EVERY card in a row (Diagram.render's opts.reserveLabelSlot),
    // even one shape-classify.js can't classify (an honest-null quality) -
    // so unclassified cards keep the SAME height as their classified
    // row-mates instead of rendering visibly shorter. 'dots' mode and ALL
    // small-card rows never reserve (small cards never label, per U25).
    // Reads the SAME pref labelFor() already reads, one place, no new
    // storage key.
    function reserveLabelSlot(size) {
      if (size !== 'big') return false;
      return !!(window.DiagramPref && typeof window.DiagramPref.get === 'function' && window.DiagramPref.get() === 'patterns');
    }
    var adapter = {
      meta: { instrument: profile.instrument, tuning: profile.tuning, strings: profile.strings.length, stringNames: profile.strings.map(function (s) { return s.n; }) },
      hasChord: function (name) { return !!voicingFor(name); },
      diagram: function (name, size) { var frets = voicingFor(name); return window.Diagram.render(frets, { size: size, name: name, patternLabel: labelFor(name, frets, size), reserveLabelSlot: reserveLabelSlot(size) }); },
      diagramClosed: function (name, size) { var frets = closedVoicingFor(name); return window.Diagram.render(frets, { size: size, name: name, patternLabel: labelFor(name, frets, size), reserveLabelSlot: reserveLabelSlot(size) }); },
      diagramChain: function (names, size) {
        var voicings = chainVoicings(names);
        return voicings.map(function (frets, i) { return window.Diagram.render(frets, { size: size, name: names[i], patternLabel: labelFor(names[i], frets, size), reserveLabelSlot: reserveLabelSlot(size) }); });
      },
      // scale map for the active instrument: open-string pitch classes + the scale's
      // pitch classes -> a low-position neck diagram (root tones in the accent colour).
      // startFret (optional) slides the window up the neck - see scaleDiagram.supportsStart
      // below, which is how KeyExplorer.renderScale feature-detects this before offering
      // the position-shift control. tones (optional, M-GUIDE W3a) forwards straight
      // through to Diagram.scale's own opts.tones contract - this is the ONE choke
      // point every instrument profile's scale map renders through, so the pass-
      // through lives here rather than per-profile.
      scaleDiagram: function (rootPc, scalePcs, frets, startFret, names, tones) {
        var openPcs = profile.strings.map(function (s) { return freqPc(s.f); });
        return window.Diagram.scale({ openPcs: openPcs, scalePcs: scalePcs, rootPc: rootPc, frets: frets || 7, startFret: startFret || 0, names: names, tones: tones });
      },
      playChord: function (name) { var fr = voicingFor(name); if (fr) window.ChordAudio.strum(fr, openFreqs); else window.ChordAudio.tone(rootFreq(name)); },
      playNote: function (name) { window.ChordAudio.tone(rootFreq(name), 1.1); },
      playFreq: function (freq, dur) { window.ChordAudio.tone(freq, dur || 1.1); },
      onLeaveTuner: function () { if (window.Tuner) window.Tuner.stop(); },
      init: function (engine) {
        if (window.Tuner) window.Tuner.mount({ strings: profile.strings });
        // el('quickTune') inlined - see header comment: el() is play/index.html's
        // own page-local helper and can't be reached across the module boundary.
        var q = document.getElementById('quickTune'); if (q) q.onclick = function () { engine.switchTab('tune'); };
      }
    };
    // Feature flag KeyExplorer.renderScale checks before offering the position-shift
    // control - a pack that doesn't set this (none exist today, but future ones might)
    // degrades cleanly: renderScale still renders the frets-0-7 diagram, just without
    // the up/down buttons.
    adapter.scaleDiagram.supportsStart = true;
    return adapter;
  }

  var ChordPackAdapter = { buildAdapter: buildAdapter };
  global.ChordPackAdapter = ChordPackAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = ChordPackAdapter;

})(typeof window !== 'undefined' ? window : this);
