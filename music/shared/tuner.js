/* =====================================================================
 * tuner.js  -  shared mic auto-tuner + reference-tone strings
 * ---------------------------------------------------------------------
 * Instrument-agnostic. A chord pack calls:
 *
 *     Tuner.mount({ strings: [{ n, l, f }, ...] })
 *
 * and everything else - pitch detection (autocorrelation), the live
 * needle UI, the Start/Stop mic plumbing, and the reference-tone drones -
 * lives HERE, maintained once for every instrument. The only thing a pack
 * supplies is its open-string set (note name, label, frequency in Hz).
 *
 * Renders into #micBox (the live needle) and #tStrings (reference tones).
 * Call Tuner.stop() when leaving the Tune tab to silence mic + drones.
 * ===================================================================== */
(function (global) {
  'use strict';

  var AC = null;
  function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
  (function () { // unlock audio on first user gesture (iOS / autoplay policy)
    function unlock() {
      var a = ctx(); if (a.state === 'suspended') a.resume();
      window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock);
    }
    window.addEventListener('touchstart', unlock); window.addEventListener('click', unlock);
  })();

  /* ---------- reference tones (steady drone per string) ---------- */
  var droneNodes = null, droneIdx = -1;
  function stopDrone() {
    if (droneNodes) { try { droneNodes.forEach(function (n) { n.stop && n.stop(); }); } catch (e) { } droneNodes = null; }
    droneIdx = -1;
    document.querySelectorAll('.tStr').forEach(function (b) { b.classList.remove('droning'); });
  }
  function startDrone(freq, idx) {
    var a = ctx(); a.resume();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime); g.gain.linearRampToValueAtTime(0.2, a.currentTime + 0.05);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(); o2.start();
    droneNodes = [o, o2]; droneIdx = idx;
  }
  function toggleDrone(freq, idx, btn) {
    if (droneIdx === idx) { stopDrone(); return; }
    stopDrone(); startDrone(freq, idx); if (btn) btn.classList.add('droning');
  }

  /* ---------- pitch detection (autocorrelation + clarity) ----------
   * Returns { freq, clarity }. `clarity` is the normalised height of the
   * winning autocorrelation peak (0..1) - a confidence score the loop uses
   * to ignore noisy / breath / room-tone frames instead of chasing them. */
  function autoCorr(buf, sr) {
    var SIZE = buf.length, rms = 0;
    for (var i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return { freq: -1, clarity: 0 };
    var r1 = 0, r2 = SIZE - 1, th = 0.2;
    for (var i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < th) { r1 = i; break; } }
    for (var i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < th) { r2 = SIZE - i; break; } }
    var b = buf.slice(r1, r2), n = b.length, c = new Array(n).fill(0);
    for (var lag = 0; lag < n; lag++) for (var i = 0; i < n - lag; i++) c[lag] += b[i] * b[i + lag];
    var d = 0; while (d < n - 1 && c[d] > c[d + 1]) d++;
    var mx = -1, pos = -1;
    for (var i = d; i < n; i++) { if (c[i] > mx) { mx = c[i]; pos = i; } }
    if (pos <= 0) return { freq: -1, clarity: 0 };
    var T0 = pos;
    var x1 = c[T0 - 1] || 0, x2 = c[T0] || 0, x3 = c[T0 + 1] || 0, a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    if (a) T0 = T0 - bb / (2 * a);
    return { freq: sr / T0, clarity: c[0] > 0 ? mx / c[0] : 0 };
  }
  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* ---------- mic auto-tuner (secure-context only) ----------
   * Smoothing chain that turns the raw per-frame estimate into a steady
   * read: clarity gate -> median of recent frames -> note-name hysteresis
   * -> eased needle, holding the last good value through brief dropouts. */
  var STRINGS = [], micOn = false, micStream = null, micAC = null, micAnalyser = null, micBuf = null, micRAF = null, needleEMA = 50;
  var freqHist = [], lockedString = null, switchFrames = 0, quietFrames = 0;
  function nearest(freq) {
    var best = 0, bd = 1e9;
    STRINGS.forEach(function (s, i) { var d = Math.abs(1200 * Math.log2(freq / s.f)); if (d < bd) { bd = d; best = i; } });
    return STRINGS[best];
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
    needleEMA = 50; freqHist = []; lockedString = null; switchFrames = 0; quietFrames = 0;
    var nd = document.getElementById('micNeedle'); if (nd) nd.style.left = '50%';
  }
  function micLoop() {
    if (!micOn) return;
    micAnalyser.getFloatTimeDomainData(micBuf);
    var res = autoCorr(micBuf, micAC.sampleRate);
    var noteEl = document.getElementById('micNote'), centsEl = document.getElementById('micCents'), needle = document.getElementById('micNeedle');
    if (!noteEl || !centsEl || !needle) { micRAF = requestAnimationFrame(micLoop); return; }
    // Confidence gate: only a clear, in-range pitch counts as a real reading.
    if (res.freq > 55 && res.freq < 1500 && res.clarity > 0.92) {
      quietFrames = 0;
      freqHist.push(res.freq); if (freqHist.length > 6) freqHist.shift();
      var freq = median(freqHist); // median kills single-frame spikes + octave jumps
      var tgt = nearest(freq);
      // Note-name hysteresis: don't flip the displayed string on a transient -
      // require a few consistent frames before committing to a new string.
      if (lockedString === null) { lockedString = tgt; switchFrames = 0; }
      else if (tgt !== lockedString) { if (++switchFrames >= 3) { lockedString = tgt; switchFrames = 0; } }
      else { switchFrames = 0; }
      var shown = lockedString;
      var cents = Math.round(1200 * Math.log2(freq / shown.f));
      noteEl.textContent = shown.n;
      var clamped = Math.max(-50, Math.min(50, cents));
      var target = 50 + clamped; needleEMA += (target - needleEMA) * 0.18; needle.style.left = needleEMA.toFixed(1) + '%';
      var inT = Math.abs(cents) <= 4;
      noteEl.classList.toggle('intune', inT);
      needle.style.background = inT ? 'var(--good)' : (Math.abs(cents) < 15 ? 'var(--warn)' : 'var(--bad)');
      centsEl.textContent = inT ? '✓ in tune' : ((cents > 0 ? '+' : '') + cents + ' cents ' + (cents > 0 ? '(too sharp — loosen)' : '(too flat — tighten)'));
    } else if (++quietFrames > 18) {
      // Sustained silence (~0.3s): clear history and drift gently back to centre.
      freqHist = []; lockedString = null; switchFrames = 0;
      needleEMA += (50 - needleEMA) * 0.05; needle.style.left = needleEMA.toFixed(1) + '%';
      noteEl.classList.remove('intune');
      centsEl.textContent = 'listening… play a string';
    }
    // brief dropouts (quietFrames <= 18): hold the last good reading, no flicker.
    micRAF = requestAnimationFrame(micLoop);
  }
  function buildMic(box) {
    if (!box) return;
    var secure = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!secure) {
      box.innerHTML = '<div class="micMsg"><b>The live needle needs a microphone</b>, which the browser only allows over <b>https</b>. Opened as a local file the mic is blocked — use the reference tones below to tune by ear, or open this page over https (it is live on GitHub Pages) to unlock the needle.</div>';
      return;
    }
    box.innerHTML = '<div class="micNote" id="micNote">—</div><div class="micCents" id="micCents">tap Start, then play a string</div>'
      + '<div class="micMeter"><div class="scale"></div><div class="center"></div><div class="needle" id="micNeedle" style="left:50%"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
      + '<div class="actions"><button class="btn" id="micToggle">Start mic</button></div>';
    document.getElementById('micToggle').onclick = micToggle;
  }

  /* ---------- reference-tone string buttons ---------- */
  function buildStrings(el) {
    if (!el) return;
    el.innerHTML = '';
    STRINGS.forEach(function (s, i) {
      var b = document.createElement('button'); b.className = 'tStr';
      b.innerHTML = '<span class="n">' + s.n + '</span><span class="l">' + s.l + '</span><span class="hz">' + s.f.toFixed(0) + ' Hz</span>';
      b.onclick = function () { toggleDrone(s.f, i, b); };
      el.appendChild(b);
    });
  }

  /* =====================================================================
   * Public API
   * ===================================================================== */
  global.Tuner = {
    // strings: [{ n: 'G', l: '4th string', f: 392.00 }, ...]
    mount: function (opts) {
      opts = opts || {};
      STRINGS = opts.strings || [];
      buildMic(opts.micBoxEl || document.getElementById('micBox'));
      buildStrings(opts.stringsEl || document.getElementById('tStrings'));
    },
    // silence mic + reference drones (call when leaving the Tune tab)
    stop: function () { stopDrone(); micStop(); }
  };

})(typeof window !== 'undefined' ? window : this);
