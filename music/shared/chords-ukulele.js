/* =====================================================================
 * chords-ukulele.js  -  the UKULELE chord pack for the shared songbook
 * ---------------------------------------------------------------------
 * A "chord pack" supplies everything instrument-specific that the
 * instrument-agnostic songbook engine (songbook.js) can't know on its own:
 *   - which chords exist + their fingerings (for diagrams)
 *   - how a chord sounds (strum / pluck / single tone)
 *   - the Tune tab (open-string drones, beat method, relative guide, mic
 *     auto-tuner)
 *
 * It exposes a single global `ChordPackUkulele` whose SHAPE is the
 * cross-instrument contract documented in music/shared/README.md. To build
 * a guitar tool, copy this file to chords-guitar.js and swap the data +
 * tuning  -  the songbook engine consumes the same interface unchanged.
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

  // Tuner string definitions (display order top-to-bottom in the grid).
  var UKE = [
    { n: "G", l: "4th string", f: 392.00, idx: 0 },
    { n: "C", l: "3rd string", f: 261.63, idx: 1 },
    { n: "E", l: "2nd string", f: 329.63, idx: 2 },
    { n: "A", l: "1st string", f: 440.00, idx: 3 }
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
    var peak = 0.15 * gscale;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }
  function strumChord(name, t, dur) {
    var f = CHORDS[name]; if (!f) return;
    [0, 1, 2, 3].forEach(function (s, i) { if (f[s] < 0) return; pluck(freqForString(s, f[s]), t + i * 0.018, dur, 1 - i * 0.05); });
  }
  function strumTap(name) { var a = ctx(); a.resume(); strumChord(name, a.currentTime + 0.02, 1.3); }

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

  /* ---------- diagrams (SVG fingering charts) ---------- */
  function bigDiagram(name) {
    var f = CHORDS[name];
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
    wrap.innerHTML = '<span class="nm">' + name + '</span>' + svg;
    return wrap;
  }
  function smallDiagram(name) {
    var f = CHORDS[name];
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
    wrap.innerHTML = '<span class="chord-name">' + name + '</span>' + svg;
    return wrap;
  }

  /* ---------- mic auto-tuner (secure-context only) ---------- */
  var micOn = false, micStream = null, micAC = null, micAnalyser = null, micBuf = null, micRAF = null;
  function nearestUke(freq) {
    var best = 0, bd = 1e9;
    UKE.forEach(function (s, i) { var d = Math.abs(1200 * Math.log2(freq / s.f)); if (d < bd) { bd = d; best = i; } });
    return UKE[best];
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
    if (freq > 50 && freq < 2000) {
      var tgt = nearestUke(freq);
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
      UKE.forEach(function (s) {
        var b = document.createElement('button'); b.className = 'tStr';
        b.innerHTML = '<span class="n">' + s.n + '</span><span class="l">' + s.l + '</span><span class="hz">' + s.f.toFixed(0) + ' Hz</span>';
        b.onclick = function () { toggleDrone(s.f, s.idx, b); };
        wrap.appendChild(b);
      });
    }
    var bIn = document.getElementById('beatIn'); if (bIn) bIn.onclick = function () { playBeats(329.63, 0, 2.6); };
    var bOff = document.getElementById('beatOff'); if (bOff) bOff.onclick = function () { playBeats(329.63, 18, 2.6); };
    var rel = [
      { t: 'Tune your <b>C string</b> (3rd) to a reference C, or trust it if close.', play: 261.63, lbl: 'C' },
      { t: 'Press <b>C string at fret 4</b> → that’s E. Match your open <b>E string</b> (2nd).', play: 329.63, lbl: 'E' },
      { t: 'Press <b>E string at fret 3</b> → that’s G. Match your open <b>G string</b> (4th).', play: 392.00, lbl: 'G' },
      { t: 'Press <b>E string at fret 5</b> → that’s A. Match your open <b>A string</b> (1st).', play: 440.00, lbl: 'A' }
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
  global.ChordPackUkulele = {
    meta: { instrument: 'ukulele', tuning: 'GCEA', strings: 4, stringNames: ['G', 'C', 'E', 'A'] },

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
