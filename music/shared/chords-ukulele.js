/* =====================================================================
 * chords-ukulele.js  -  the UKULELE chord pack for the shared songbook
 * ---------------------------------------------------------------------
 * A "chord pack" supplies everything instrument-specific that the
 * instrument-agnostic songbook engine (songbook.js) can't know on its own:
 *   - which chords exist + their fingerings (for diagrams)
 *   - how a chord sounds (strum / pluck / single tone)
 *   - its open-string set, which it hands to the SHARED tuner (tuner.js)
 *
 * The mic auto-tuner + reference tones live in tuner.js and are maintained
 * once for every instrument; this pack only declares its strings. It
 * exposes a single global `ChordPackUkulele` whose SHAPE is the
 * cross-instrument contract documented in music/shared/README.md.
 *
 * Ukulele tuning: GCEA (re-entrant). String order in fret arrays is
 * [G, C, E, A] = [4th, 3rd, 2nd, 1st].
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- instrument data ---------- */
  // Open-string frequencies, indexed [G, C, E, A].
  var STR_OPEN = [392.00, 261.63, 329.63, 440.00];

  // Chord name -> fret per string [G, C, E, A]. 0 = open.
  var CHORDS = {
    C: [0, 0, 0, 3], D: [2, 2, 2, 0], E: [4, 4, 4, 2], F: [2, 0, 1, 0], G: [0, 2, 3, 2], A: [2, 1, 0, 0], B: [4, 3, 2, 2],
    Cm: [0, 3, 3, 3], Dm: [2, 2, 1, 0], Em: [0, 4, 3, 2], Fm: [1, 0, 1, 3], Gm: [0, 2, 3, 1], Am: [2, 0, 0, 0], Bm: [4, 2, 2, 2],
    C7: [0, 0, 0, 1], D7: [2, 2, 2, 3], E7: [1, 2, 0, 2], F7: [2, 3, 1, 3], G7: [0, 2, 1, 2], A7: [0, 1, 0, 0], B7: [2, 3, 2, 2],
    Cmaj7: [0, 0, 0, 2], Dmaj7: [2, 2, 2, 4], Emaj7: [1, 3, 0, 2], Fmaj7: [2, 4, 1, 3], Gmaj7: [0, 2, 2, 2], Amaj7: [1, 1, 0, 0], Bmaj7: [3, 3, 2, 2],
    Cm7: [3, 3, 3, 3], Dm7: [2, 2, 1, 3], Em7: [0, 2, 0, 2], Fm7: [1, 3, 1, 3], Gm7: [0, 2, 1, 1], Am7: [0, 0, 0, 0], Bm7: [2, 2, 2, 2]
  };
  // Enharmonic-tolerant shape lookup (FORK-4, pilot UAT): the app labels chords
  // canonically SHARP (A#, D#m ...) while this table names some shapes with flats
  // (Bb, Eb, Bbm ...). Try the exact name first, then the same chord with its
  // root respelled enharmonically - so 'A#' finds the Bb shape. The DISPLAY name
  // stays whatever the caller passed; only the shape lookup is tolerant.
  var ENH = { 'A#': 'Bb', 'Bb': 'A#', 'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#', 'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#' };
  function shapeFor(name) {
    if (CHORDS[name]) return CHORDS[name];
    var m = /^([A-G][#b])(.*)$/.exec(name || '');
    return (m && ENH[m[1]]) ? CHORDS[ENH[m[1]] + m[2]] : undefined;
  }

  // Open-string set handed to the shared tuner (display order top-to-bottom).
  var TUNER_STRINGS = [
    { n: "G", l: "4th string", f: 392.00 },
    { n: "C", l: "3rd string", f: 261.63 },
    { n: "E", l: "2nd string", f: 329.63 },
    { n: "A", l: "1st string", f: 440.00 }
  ];

  /* ---------- chord audio (output) ---------- */
  var AC;
  function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
  // unlock audio on first gesture (iOS / autoplay policies)
  (function () {
    function unlock() { var a = ctx(); if (a.state === 'suspended') a.resume(); window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock); }
    window.addEventListener('touchstart', unlock);
    window.addEventListener('click', unlock);
  })();

  // a single sustained tone (used for chord chips in practice)
  function playTone(freq, dur) {
    var a = ctx(); a.resume();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq;
    var t = a.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.04);
    g.gain.setValueAtTime(0.2, t + dur - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  // pluck a single string (compose strum/arpeggio)
  function freqForString(idx, fret) { return STR_OPEN[idx] * Math.pow(2, fret / 12); }
  function pluck(freq, t, dur, gscale) {
    var a = ctx();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    var peak = 0.15 * gscale;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  function strumChord(name, t, dur) {
    var f = shapeFor(name); if (!f) return;
    [0, 1, 2, 3].forEach(function (s, i) { if (f[s] < 0) return; pluck(freqForString(s, f[s]), t + i * 0.018, dur, 1 - i * 0.05); });
  }
  function strumTap(name) { var a = ctx(); a.resume(); strumChord(name, a.currentTime + 0.02, 1.3); }

  /* ---------- diagrams (SVG fingering charts) ---------- */
  // Known-chord names are a controlled vocabulary, but escape defensively so the
  // known-path innerHTML can never become a sink if a token ever slips through.
  function escName(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function bigDiagram(name) {
    var f = shapeFor(name);
    var wrap = document.createElement('div'); wrap.className = 'bigC';
    if (!f) { wrap.textContent = name; return wrap; }
    var W = 140, H = 178, padX = 20, padY = 28, cols = 3, rows = 4;
    var sx = (W - 2 * padX) / cols, sy = (H - padY - 12) / rows;
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    svg += '<rect x="' + (padX - 2) + '" y="' + (padY - 6) + '" width="' + (cols * sx + 4) + '" height="5" fill="#e8ebf0" rx="1"/>';
    for (var st = 0; st < 4; st++) { var x = padX + st * sx; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (padY + rows * sy) + '" stroke="#3a4150" stroke-width="1.5"/>'; }
    for (var r = 0; r <= rows; r++) { var y = padY + r * sy; svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (padX + cols * sx) + '" y2="' + y + '" stroke="#3a4150" stroke-width="1.5"/>'; }
    f.forEach(function (fr, s) {
      var x = padX + s * sx;
      if (fr > 0) { var y = padY + (fr - 0.5) * sy; svg += '<circle cx="' + x + '" cy="' + y + '" r="13" fill="#5eead4" stroke="#2a4f49" stroke-width="1.5"/>'; }
      else if (fr === 0) { svg += '<circle cx="' + x + '" cy="' + (padY - 16) + '" r="6" fill="none" stroke="#e8ebf0" stroke-width="2"/>'; }
    });
    svg += '</svg>';
    wrap.innerHTML = '<span class="nm">' + escName(name) + '</span>' + svg;
    return wrap;
  }
  function smallDiagram(name) {
    var f = shapeFor(name);
    var wrap = document.createElement('div'); wrap.className = 'chord';
    if (!f) { wrap.textContent = name; return wrap; }
    var W = 58, H = 72, padX = 8, padY = 12, cols = 3, rows = 4;
    var sx = (W - 2 * padX) / cols, sy = (H - padY - 6) / rows;
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    svg += '<rect x="' + (padX - 1) + '" y="' + (padY - 3) + '" width="' + (cols * sx + 2) + '" height="3" fill="#e8ebf0" rx="1"/>';
    for (var s = 0; s < 4; s++) { var x = padX + s * sx; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (padY + rows * sy) + '" stroke="#3a4150" stroke-width="1.1"/>'; }
    for (var r = 0; r <= rows; r++) { var y = padY + r * sy; svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (padX + cols * sx) + '" y2="' + y + '" stroke="#3a4150" stroke-width="1.1"/>'; }
    f.forEach(function (fr, st) {
      var x = padX + st * sx;
      if (fr > 0) { var y = padY + (fr - 0.5) * sy; svg += '<circle cx="' + x + '" cy="' + y + '" r="5.5" fill="#5eead4" stroke="#2a4f49" stroke-width="1"/>'; }
      else if (fr === 0) { svg += '<circle cx="' + x + '" cy="' + (padY - 7) + '" r="3" fill="none" stroke="#e8ebf0" stroke-width="1.2"/>'; }
    });
    svg += '</svg>';
    wrap.innerHTML = '<span class="chord-name">' + escName(name) + '</span>' + svg;
    return wrap;
  }

  /* =====================================================================
   * Chord-pack contract surface (consumed by songbook.js)
   * ===================================================================== */
  global.ChordPackUkulele = {
    meta: { instrument: 'ukulele', tuning: 'GCEA', strings: 4, stringNames: ['G', 'C', 'E', 'A'] },

    // does this chord (exact or enharmonic-respelled root) have a fingering?
    hasChord: function (name) { return !!shapeFor(name); },

    // a fingering diagram element. size: 'small' (compose grid) | 'big' (maximize)
    diagram: function (name, size) { return size === 'big' ? bigDiagram(name) : smallDiagram(name); },

    // play a full chord (strum) - used by the compose grid + progression slots
    playChord: function (name) { strumTap(name); },

    // single representative tone for a chord (used by chord chips in practice)
    playNote: function (name) { playTone(rootFreqForChord(name), 1.1); },

    // raw tone by frequency (fallback hook)
    playFreq: function (freq, dur) { playTone(freq, dur || 1.1); },

    // engine calls this when leaving the Tune tab so the shared tuner silences mic + drones
    onLeaveTuner: function () { if (global.Tuner) global.Tuner.stop(); },

    // wire up the Tune tab (delegated to the shared tuner) + quick-tune button
    init: function (engine) {
      if (global.Tuner) global.Tuner.mount({ strings: TUNER_STRINGS });
      var quick = document.getElementById('quickTune');
      if (quick) quick.onclick = function () { engine.switchTab('tune'); };
    }
  };

  // chord root frequency relative to middle C, using the engine helper when present
  function rootFreqForChord(name) {
    if (global.Songbook && typeof global.Songbook.chordRootFreq === 'function') return global.Songbook.chordRootFreq(name);
    return 261.63;
  }

})(typeof window !== 'undefined' ? window : this);
