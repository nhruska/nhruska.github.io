/* =====================================================================
 * chords-guitar.js  -  the GUITAR chord pack for the shared songbook
 * ---------------------------------------------------------------------
 * A "chord pack" supplies everything instrument-specific that the
 * instrument-agnostic songbook engine (songbook.js) can't know on its own:
 *   - which chords exist + their fingerings (for diagrams)
 *   - how a chord sounds (strum / pluck / single tone)
 *   - its open-string set, which it hands to the SHARED tuner (tuner.js)
 *
 * The mic auto-tuner + reference tones live in tuner.js and are maintained
 * once for every instrument; this pack only declares its strings. It mirrors
 * chords-ukulele.js exactly - same exported interface - and differs only in
 * the instrument data (6-string standard tuning, guitar fingerings) and the
 * diagram renderer, which adds muted-string markers and a base-fret indicator
 * for barre chords.
 *
 * Guitar tuning: EADGBE (standard). String order in fret arrays is
 * [E, A, D, G, B, E] = [6th(low) ... 1st(high)]. In a fret array:
 *   -1 = muted (not played),  0 = open,  n = fretted at fret n.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- instrument data ---------- */
  // Open-string frequencies, indexed [E2, A2, D3, G3, B3, E4] (low -> high).
  var STR_OPEN = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

  // Chord name -> fret per string [E, A, D, G, B, E]. -1 = muted, 0 = open.
  // Voicings are standard open or barre shapes, verified for chord tones.
  var CHORDS = {
    // --- majors ---
    C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0],
    F: [1, 3, 3, 2, 1, 1], G: [3, 2, 0, 0, 3, 3], A: [-1, 0, 2, 2, 2, 0], B: [-1, 2, 4, 4, 4, 2],
    // --- minors ---
    Cm: [-1, 3, 5, 5, 4, 3], Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0],
    Fm: [1, 3, 3, 1, 1, 1], Gm: [3, 5, 5, 3, 3, 3], Am: [-1, 0, 2, 2, 1, 0], Bm: [-1, 2, 4, 4, 3, 2],
    // --- dominant 7ths ---
    C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], E7: [0, 2, 0, 1, 0, 0],
    F7: [1, 3, 1, 2, 1, 1], G7: [3, 2, 0, 0, 0, 1], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
    // --- major 7ths ---
    Cmaj7: [-1, 3, 2, 0, 0, 0], Dmaj7: [-1, -1, 0, 2, 2, 2], Emaj7: [0, 2, 1, 1, 0, 0],
    Fmaj7: [1, -1, 2, 2, 1, 0], Gmaj7: [3, 2, 0, 0, 0, 2], Amaj7: [-1, 0, 2, 1, 2, 0], Bmaj7: [-1, 2, 4, 3, 4, 2],
    // --- minor 7ths ---
    Cm7: [-1, 3, 5, 3, 4, 3], Dm7: [-1, -1, 0, 2, 1, 1], Em7: [0, 2, 0, 0, 0, 0],
    Fm7: [1, 3, 1, 1, 1, 1], Gm7: [3, 5, 3, 3, 3, 3], Am7: [-1, 0, 2, 0, 1, 0], Bm7: [-1, 2, 0, 2, 0, 2],
    // --- extras used in the song catalog / suggestion map ---
    Bb: [-1, 1, 3, 3, 3, 1], 'C#m': [-1, 4, 6, 6, 5, 4], 'F#': [2, 4, 4, 3, 2, 2], 'F#m': [2, 4, 4, 2, 2, 2],
    Ab: [4, 6, 6, 5, 4, 4], Bbm: [-1, 1, 3, 3, 2, 1], Db: [-1, 4, 6, 6, 6, 4], Eb: [-1, 6, 8, 8, 8, 6],
    'F#7': [2, 4, 2, 3, 2, 2], 'G#m': [4, 6, 6, 4, 4, 4]
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

  // Open-string set handed to the shared tuner (low-E / 6th at top, guitar convention).
  var TUNER_STRINGS = [
    { n: "E", l: "6th string (low E)", f: 82.41 },
    { n: "A", l: "5th string", f: 110.00 },
    { n: "D", l: "4th string", f: 146.83 },
    { n: "G", l: "3rd string", f: 196.00 },
    { n: "B", l: "2nd string", f: 246.94 },
    { n: "E", l: "1st string (high E)", f: 329.63 }
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
    var peak = 0.13 * gscale;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  function strumChord(name, t, dur) {
    var f = shapeFor(name); if (!f) return;
    // strum low-to-high; skip muted strings; slight stagger between strings.
    var i = 0;
    [0, 1, 2, 3, 4, 5].forEach(function (s) {
      if (f[s] < 0) return; // muted string makes no sound
      pluck(freqForString(s, f[s]), t + i * 0.016, dur, 1 - i * 0.04);
      i++;
    });
  }
  function strumTap(name) { var a = ctx(); a.resume(); strumChord(name, a.currentTime + 0.02, 1.5); }

  /* ---------- diagrams (SVG fingering charts) ----------
   * Guitar adds two things the ukulele diagram didn't need:
   *  - muted-string markers (x above the nut) for strings fretted -1
   *  - a base-fret indicator ("Nfr") for barre chords whose lowest fretted
   *    note is above fret 1, so high-position shapes render in a 4-fret window.
   * 6 strings -> 5 string-gap columns. */
  function baseFret(f) {
    var fretted = f.filter(function (x) { return x > 0; });
    if (!fretted.length) return 1;
    var hi = Math.max.apply(null, fretted), lo = Math.min.apply(null, fretted);
    return hi <= 4 ? 1 : lo; // window starts at the nut unless the shape sits high
  }
  function escName(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function drawDiagram(name, opts) {
    var f = shapeFor(name);
    var wrap = document.createElement('div'); wrap.className = opts.wrapClass;
    // name is user-controlled for custom songs (freeform seq tokens reach this
    // via the Maximize diagram path), so escape before it enters innerHTML - the
    // unknown-chord branch below injects nameSpan directly.
    var nameSpan = '<span class="' + opts.nameClass + '">' + escName(name) + '</span>';
    if (!f) { wrap.innerHTML = nameSpan; return wrap; }

    var base = baseFret(f);
    var W = opts.W, H = opts.H, padX = opts.padX, padY = opts.padY;
    var cols = 5, rows = 4; // 6 strings => 5 columns; 4 fret rows
    var sx = (W - 2 * padX) / cols, sy = (H - padY - opts.bottomPad) / rows;
    var dotR = opts.dotR, markR = opts.markR, sw = opts.sw;
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';

    // nut bar only when the window starts at fret 1; otherwise show base label.
    if (base === 1) {
      svg += '<rect x="' + (padX - opts.nutPad) + '" y="' + (padY - opts.nutPad - 1) + '" width="' + (cols * sx + 2 * opts.nutPad) + '" height="' + opts.nutH + '" fill="#e8ebf0" rx="1"/>';
    } else {
      svg += '<text x="' + (padX - opts.basePad) + '" y="' + (padY + sy * 0.55) + '" fill="#9aa3b2" font-size="' + opts.baseFont + '" font-family="monospace" text-anchor="end">' + base + 'fr</text>';
    }
    // string verticals
    for (var st = 0; st < 6; st++) { var x = padX + st * sx; svg += '<line x1="' + x + '" y1="' + padY + '" x2="' + x + '" y2="' + (padY + rows * sy) + '" stroke="#3a4150" stroke-width="' + sw + '"/>'; }
    // fret horizontals
    for (var r = 0; r <= rows; r++) { var y = padY + r * sy; svg += '<line x1="' + padX + '" y1="' + y + '" x2="' + (padX + cols * sx) + '" y2="' + y + '" stroke="#3a4150" stroke-width="' + sw + '"/>'; }
    // markers per string
    f.forEach(function (fr, s) {
      var x = padX + s * sx;
      if (fr > 0) {
        var rel = fr - (base - 1);            // position within the 4-fret window
        var y = padY + (rel - 0.5) * sy;
        svg += '<circle cx="' + x + '" cy="' + y + '" r="' + dotR + '" fill="#5eead4" stroke="#2a4f49" stroke-width="1.3"/>';
      } else if (fr === 0) {
        svg += '<circle cx="' + x + '" cy="' + (padY - opts.markY) + '" r="' + markR + '" fill="none" stroke="#e8ebf0" stroke-width="' + opts.markSw + '"/>';
      } else { // muted
        var mY = padY - opts.markY, d = markR;
        svg += '<line x1="' + (x - d) + '" y1="' + (mY - d) + '" x2="' + (x + d) + '" y2="' + (mY + d) + '" stroke="#7a8294" stroke-width="' + opts.markSw + '"/>';
        svg += '<line x1="' + (x - d) + '" y1="' + (mY + d) + '" x2="' + (x + d) + '" y2="' + (mY - d) + '" stroke="#7a8294" stroke-width="' + opts.markSw + '"/>';
      }
    });
    svg += '</svg>';
    wrap.innerHTML = nameSpan + svg;
    return wrap;
  }
  function bigDiagram(name) {
    return drawDiagram(name, {
      wrapClass: 'bigC', nameClass: 'nm',
      W: 168, H: 184, padX: 30, padY: 32, bottomPad: 12, dotR: 11, markR: 6, sw: 1.5,
      nutPad: 2, nutH: 5, basePad: 6, baseFont: 13, markY: 16, markSw: 2
    });
  }
  function smallDiagram(name) {
    return drawDiagram(name, {
      wrapClass: 'chord', nameClass: 'chord-name',
      W: 70, H: 74, padX: 12, padY: 13, bottomPad: 6, dotR: 4.6, markR: 3, sw: 1.1,
      nutPad: 1, nutH: 3, basePad: 3, baseFont: 7.5, markY: 7, markSw: 1.2
    });
  }

  /* =====================================================================
   * Chord-pack contract surface (consumed by songbook.js)
   * ===================================================================== */
  global.ChordPackGuitar = {
    meta: { instrument: 'guitar', tuning: 'EADGBE', strings: 6, stringNames: ['E', 'A', 'D', 'G', 'B', 'E'] },

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
