/* =====================================================================
 * chords-guitar.js  -  the GUITAR chord pack for the shared songbook
 * ---------------------------------------------------------------------
 * A "chord pack" supplies everything instrument-specific that the
 * instrument-agnostic songbook engine (songbook.js) can't know on its own:
 *   - which chords exist + their fingerings (for diagrams)
 *   - how a chord sounds (strum / pluck / single tone)
 *   - the Tune tab (open-string drones, beat method, relative guide, mic
 *     auto-tuner)
 *
 * It exposes a single global `ChordPackGuitar` whose SHAPE is the
 * cross-instrument contract documented in music/shared/README.md. It mirrors
 * chords-ukulele.js exactly  -  same exported interface, the songbook engine
 * consumes it unchanged. The only differences are the instrument data
 * (6-string standard tuning, guitar fingerings) and the diagram renderer,
 * which adds muted-string markers and a base-fret indicator for barre chords.
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

  // Tuner string definitions (display order top-to-bottom in the grid).
  // Guitar convention shows low-E (6th) at the top.
  var GTR = [
    { n: "E", l: "6th string (low E)", f: 82.41, idx: 0 },
    { n: "A", l: "5th string", f: 110.00, idx: 1 },
    { n: "D", l: "4th string", f: 146.83, idx: 2 },
    { n: "G", l: "3rd string", f: 196.00, idx: 3 },
    { n: "B", l: "2nd string", f: 246.94, idx: 4 },
    { n: "E", l: "1st string (high E)", f: 329.63, idx: 5 }
  ];

  /* ---------- audio (output) ---------- */
  var AC, analyser, viz = null;
  function ctx() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      analyser = AC.createAnalyser();
      analyser.fftSize = 2048;
      analyser.connect(AC.destination);
    }
    return AC;
  }
  // unlock audio on first gesture (iOS / autoplay policies)
  (function () {
    function unlock() {
      var a = ctx();
      if (a.state === 'suspended') a.resume();
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    }
    window.addEventListener('touchstart', unlock);
    window.addEventListener('click', unlock);
  })();

  var droneNodes = null, droneStr = -1, beatActive = false;
  function stopDrone() {
    if (droneNodes) { try { droneNodes.forEach(function (n) { n.stop && n.stop(); }); } catch (e) { } droneNodes = null; }
    droneStr = -1;
    document.querySelectorAll('.tStr').forEach(function (b) { b.classList.remove('droning'); });
    if (!beatActive) stopViz();
  }
  function startDrone(freq, idx) {
    var a = ctx(); a.resume();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime); g.gain.linearRampToValueAtTime(0.2, a.currentTime + 0.05);
    o.connect(g); o2.connect(g); g.connect(analyser);
    o.start(); o2.start();
    droneNodes = [o, o2]; droneStr = idx; startViz();
  }
  function toggleDrone(freq, idx, btn) {
    if (droneStr === idx) { stopDrone(); return; }
    stopDrone(); startDrone(freq, idx); btn.classList.add('droning');
  }
  function playBeats(freq, cents, dur) {
    stopDrone();
    var a = ctx(); a.resume();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * Math.pow(2, cents / 1200);
    var t = a.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.04);
    g.gain.setValueAtTime(0.18, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(analyser);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
    beatActive = true; startViz();
    setTimeout(function () { beatActive = false; if (!droneNodes) stopViz(); }, dur * 1000 + 60);
  }
  function playTone(freq, dur) {
    var a = ctx(); a.resume();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq;
    var t = a.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.04);
    g.gain.setValueAtTime(0.2, t + dur - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(analyser);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
    beatActive = true; startViz();
    setTimeout(function () { beatActive = false; if (!droneNodes) stopViz(); }, dur * 1000 + 60);
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
    var f = CHORDS[name]; if (!f) return;
    // strum low-to-high; skip muted strings; slight stagger between strings.
    var i = 0;
    [0, 1, 2, 3, 4, 5].forEach(function (s) {
      if (f[s] < 0) return; // muted string makes no sound
      pluck(freqForString(s, f[s]), t + i * 0.016, dur, 1 - i * 0.04);
      i++;
    });
  }
  function strumTap(name) { var a = ctx(); a.resume(); strumChord(name, a.currentTime + 0.02, 1.5); }

  /* viz (reference-wave canvas on the Tune tab) */
  var tCanvas, tctx;
  function startViz() {
    if (viz) return;
    tCanvas = tCanvas || document.getElementById('tCanvas');
    if (!tCanvas) return;
    if (!tctx) tctx = tCanvas.getContext('2d');
    var buf = new Uint8Array(analyser.fftSize);
    function draw() {
      viz = requestAnimationFrame(draw);
      var w = tCanvas.width = tCanvas.clientWidth * (window.devicePixelRatio || 1);
      var h = tCanvas.height = tCanvas.clientHeight * (window.devicePixelRatio || 1);
      analyser.getByteTimeDomainData(buf);
      tctx.clearRect(0, 0, w, h);
      tctx.lineWidth = 2.5 * (window.devicePixelRatio || 1);
      tctx.strokeStyle = '#5eead4';
      tctx.beginPath();
      var slice = w / buf.length, x = 0;
      for (var i = 0; i < buf.length; i++) {
        var v = buf[i] / 128.0, y = v * h / 2;
        if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y);
        x += slice;
      }
      tctx.stroke();
    }
    draw();
  }
  function stopViz() {
    if (viz) { cancelAnimationFrame(viz); viz = null; }
    if (tctx && tCanvas) { tctx.clearRect(0, 0, tCanvas.width, tCanvas.height); }
  }

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
  function drawDiagram(name, opts) {
    var f = CHORDS[name];
    var wrap = document.createElement('div'); wrap.className = opts.wrapClass;
    var nameSpan = '<span class="' + opts.nameClass + '">' + name + '</span>';
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

  /* ---------- mic auto-tuner (secure-context only) ---------- */
  var micOn = false, micStream = null, micAC = null, micAnalyser = null, micBuf = null, micRAF = null;
  function nearestGtr(freq) {
    var best = 0, bd = 1e9;
    GTR.forEach(function (s, i) { var d = Math.abs(1200 * Math.log2(freq / s.f)); if (d < bd) { bd = d; best = i; } });
    return GTR[best];
  }
  function autoCorr(buf, sr) {
    var SIZE = buf.length, rms = 0;
    for (var i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;
    var r1 = 0, r2 = SIZE - 1, th = 0.2;
    for (var i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < th) { r1 = i; break; } }
    for (var i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < th) { r2 = SIZE - i; break; } }
    var b = buf.slice(r1, r2), n = b.length, c = new Array(n).fill(0);
    for (var lag = 0; lag < n; lag++) for (var i = 0; i < n - lag; i++) c[lag] += b[i] * b[i + lag];
    var d = 0; while (c[d] > c[d + 1]) d++;
    var mx = -1, pos = -1;
    for (var i = d; i < n; i++) { if (c[i] > mx) { mx = c[i]; pos = i; } }
    var T0 = pos;
    var x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0, a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    if (a) T0 = T0 - bb / (2 * a);
    return sr / T0;
  }
  function micToggle() {
    if (micOn) { micStop(); return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (stream) {
        micStream = stream;
        micAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = micAC.createMediaStreamSource(micStream);
        micAnalyser = micAC.createAnalyser();
        micAnalyser.fftSize = 2048;
        micBuf = new Float32Array(micAnalyser.fftSize);
        src.connect(micAnalyser);
        micOn = true;
        var t = document.getElementById('micToggle'); if (t) t.textContent = 'Stop mic';
        micLoop();
      })
      .catch(function () { var c = document.getElementById('micCents'); if (c) c.textContent = 'Mic permission denied.'; });
  }
  function micStop() {
    micOn = false;
    if (micRAF) cancelAnimationFrame(micRAF);
    if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
    if (micAC) { micAC.close(); micAC = null; }
    var t = document.getElementById('micToggle'); if (t) t.textContent = 'Start mic';
    var nn = document.getElementById('micNote'); if (nn) { nn.textContent = '—'; nn.classList.remove('intune'); }
    var cc = document.getElementById('micCents'); if (cc) cc.textContent = 'mic stopped';
    var nd = document.getElementById('micNeedle'); if (nd) nd.style.left = '50%';
  }
  function micLoop() {
    if (!micOn) return;
    micAnalyser.getFloatTimeDomainData(micBuf);
    var freq = autoCorr(micBuf, micAC.sampleRate);
    var noteEl = document.getElementById('micNote'), centsEl = document.getElementById('micCents'), needle = document.getElementById('micNeedle');
    // guitar low-E is ~82 Hz; widen the accepted range to catch it.
    if (freq > 60 && freq < 1400) {
      var tgt = nearestGtr(freq);
      var cents = Math.round(1200 * Math.log2(freq / tgt.f));
      noteEl.textContent = tgt.n;
      var clamped = Math.max(-50, Math.min(50, cents));
      needle.style.left = (50 + clamped) + '%';
      var inT = Math.abs(cents) <= 5;
      noteEl.classList.toggle('intune', inT);
      needle.style.background = inT ? 'var(--good)' : (Math.abs(cents) < 15 ? 'var(--warn)' : 'var(--bad)');
      centsEl.textContent = inT ? '✓ in tune' : ((cents > 0 ? '+' : '') + cents + ' cents ' + (cents > 0 ? '(too sharp — loosen)' : '(too flat — tighten)'));
    } else {
      centsEl.textContent = 'listening… play a string';
      noteEl.classList.remove('intune');
    }
    micRAF = requestAnimationFrame(micLoop);
  }
  function buildMic() {
    var box = document.getElementById('micBox');
    if (!box) return;
    var secure = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!secure) {
      box.innerHTML = '<div class="micMsg"><b>The needle needs a microphone</b>, which the browser only allows over <b>https</b>. Opened from your Downloads (a local file), the mic is blocked — so use the steady tones and beat method above to tune by ear.<br><br>To unlock the live needle, host this file free on <b>GitHub Pages</b> or drop it on <b>netlify.com/drop</b>, then open that https link.</div>';
      return;
    }
    box.innerHTML = '<div class="micNote" id="micNote">—</div><div class="micCents" id="micCents">tap Start, then play a string</div>'
      + '<div class="micMeter"><div class="scale"></div><div class="center"></div><div class="needle" id="micNeedle" style="left:50%"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
      + '<div class="actions"><button class="btn" id="micToggle">Start mic</button></div>';
    document.getElementById('micToggle').onclick = micToggle;
  }

  /* ---------- the Tune tab (drones, beat method, relative guide, mic) ---------- */
  function buildTuner() {
    var wrap = document.getElementById('tStrings');
    if (wrap) {
      wrap.innerHTML = '';
      GTR.forEach(function (s) {
        var b = document.createElement('button'); b.className = 'tStr';
        b.innerHTML = '<span class="n">' + s.n + '</span><span class="l">' + s.l + '</span><span class="hz">' + s.f.toFixed(0) + ' Hz</span>';
        b.onclick = function () { toggleDrone(s.f, s.idx, b); };
        wrap.appendChild(b);
      });
    }
    // beat demo uses the A string (110 Hz) as the reference pitch.
    var bIn = document.getElementById('beatIn'); if (bIn) bIn.onclick = function () { playBeats(110.00, 0, 2.6); };
    var bOff = document.getElementById('beatOff'); if (bOff) bOff.onclick = function () { playBeats(110.00, 18, 2.6); };
    // The 5th-fret method for standard tuning. Note: the B string is the
    // exception - it's fretted at the 4th fret of G (not the 5th).
    var rel = [
      { t: 'Tune your <b>low E (6th)</b> to a reference E, or trust it if close.', play: 82.41, lbl: 'E' },
      { t: 'Press <b>low E at fret 5</b> → that\'s A. Match your open <b>A string</b> (5th).', play: 110.00, lbl: 'A' },
      { t: 'Press <b>A at fret 5</b> → that\'s D. Match your open <b>D string</b> (4th).', play: 146.83, lbl: 'D' },
      { t: 'Press <b>D at fret 5</b> → that\'s G. Match your open <b>G string</b> (3rd).', play: 196.00, lbl: 'G' },
      { t: 'Press <b>G at fret 4</b> (the exception!) → that\'s B. Match your open <b>B string</b> (2nd).', play: 246.94, lbl: 'B' },
      { t: 'Press <b>B at fret 5</b> → that\'s high E. Match your open <b>high E string</b> (1st).', play: 329.63, lbl: 'E' }
    ];
    var g = document.getElementById('relGuide');
    if (g) {
      g.innerHTML = '';
      rel.forEach(function (step, i) {
        var d = document.createElement('div'); d.className = 'relStep';
        d.innerHTML = '<div class="rn">' + (i + 1) + '</div><div class="rt">' + step.t + '</div><button class="rp">' + step.lbl + '</button>';
        d.querySelector('.rp').onclick = function () { playTone(step.play, 1.6); };
        g.appendChild(d);
      });
    }
    buildMic();
  }

  /* =====================================================================
   * Chord-pack contract surface (consumed by songbook.js)
   * ===================================================================== */
  global.ChordPackGuitar = {
    meta: { instrument: 'guitar', tuning: 'EADGBE', strings: 6, stringNames: ['E', 'A', 'D', 'G', 'B', 'E'] },

    // does this exact chord name have a fingering?
    hasChord: function (name) { return !!CHORDS[name]; },

    // a fingering diagram element. size: 'small' (compose grid) | 'big' (maximize)
    diagram: function (name, size) { return size === 'big' ? bigDiagram(name) : smallDiagram(name); },

    // play a full chord (strum) - used by the compose grid + progression slots
    playChord: function (name) { strumTap(name); },

    // single representative tone for a chord (used by chord chips in practice)
    playNote: function (name) { playTone(rootFreqForChord(name), 1.1); },

    // raw tone by frequency (fallback hook)
    playFreq: function (freq, dur) { playTone(freq, dur || 1.1); },

    // engine calls this when leaving the Tune tab so we can silence drones
    onLeaveTuner: function () { stopDrone(); },

    // wire up the Tune tab and quick-tune button after the engine mounts
    init: function (engine) {
      buildTuner();
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
