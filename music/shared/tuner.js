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
  if (typeof window !== 'undefined' && window.addEventListener) {
    (function () { // unlock audio on first user gesture (iOS / autoplay policy)
      function unlock() {
        var a = ctx(); if (a.state === 'suspended') a.resume();
        window.removeEventListener('touchstart', unlock); window.removeEventListener('click', unlock);
      }
      window.addEventListener('touchstart', unlock); window.addEventListener('click', unlock);
    })();
  }

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

  var nsdfBuf = null; // reused NSDF scratch buffer (grown on demand) — no per-frame alloc

  /* ---------- pitch detection (band-limited NSDF / McLeod) ----------
   * Normalised square-difference autocorrelation, searched ONLY across the
   * instrument's plausible period band, picking the FIRST strong peak (the
   * fundamental) instead of the global max. That first-peak rule is the
   * standard cure for octave errors - the bug that made low strings read an
   * octave off and land on the wrong string. Band-limiting both speeds it up
   * and refuses sub-octave lock-ons. Returns { freq, clarity }, clarity 0..1
   * (1 = perfectly periodic) - the confidence the loop gates noise on. */
  function detectPitch(buf, sr, fmin, fmax) {
    var n = buf.length, i, lag, rms = 0;
    for (i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.01) return { freq: -1, clarity: 0 };       // RMS floor: ignore room tone / breath
    fmin = fmin || 60; fmax = fmax || 1320;
    var minLag = Math.max(2, Math.floor(sr / fmax));
    var maxLag = Math.min(n - 2, Math.ceil(sr / fmin));
    if (maxLag <= minLag) return { freq: -1, clarity: 0 };
    // NSDF: n'(lag) = 2·Σ x[i]·x[i+lag] / Σ (x[i]² + x[i+lag]²)
    // (reuse one scratch buffer across frames — no per-frame allocation / GC churn)
    if (!nsdfBuf || nsdfBuf.length < maxLag + 2) nsdfBuf = new Float64Array(maxLag + 2);
    var nsdf = nsdfBuf;
    for (lag = minLag; lag <= maxLag; lag++) {
      var ac = 0, m = 0;
      for (i = 0; i < n - lag; i++) { var a = buf[i], b = buf[i + lag]; ac += a * b; m += a * a + b * b; }
      nsdf[lag] = m > 0 ? (2 * ac / m) : 0;
    }
    // "key maxima": the top of each positive lobe AFTER the first negative
    // zero-crossing (skipping the lag-0 self-correlation lobe entirely).
    var peaks = [], curMax = -1, curLag = -1, positive = false, seenNeg = false;
    for (lag = minLag; lag <= maxLag; lag++) {
      var v = nsdf[lag];
      if (!seenNeg) { if (v < 0) seenNeg = true; continue; }
      if (!positive) { if (v > 0) { positive = true; curMax = v; curLag = lag; } }
      else {
        if (v > curMax) { curMax = v; curLag = lag; }
        if (v <= 0) { peaks.push({ lag: curLag, val: curMax }); positive = false; curMax = -1; }
      }
    }
    if (positive && curLag > 0) peaks.push({ lag: curLag, val: curMax });
    if (!peaks.length) return { freq: -1, clarity: 0 };
    // the fundamental = the FIRST peak clearing 0.9× the strongest peak
    var strongest = 0; for (i = 0; i < peaks.length; i++) if (peaks[i].val > strongest) strongest = peaks[i].val;
    var thresh = strongest * 0.9, chosen = null;
    for (i = 0; i < peaks.length; i++) if (peaks[i].val >= thresh) { chosen = peaks[i]; break; }
    if (!chosen) return { freq: -1, clarity: 0 };
    // Edge guard: a peak pinned to the search boundary means the true fundamental
    // likely lies OUTSIDE the band (a wildly-flat string, or a tone above fmax).
    // Report low confidence so the gate drops it and the UI says "listening"
    // instead of a confident WRONG note that sends you tuning the wrong way.
    if (chosen.lag >= maxLag - 1 || chosen.lag <= minLag) return { freq: sr / chosen.lag, clarity: Math.min(chosen.val, 0.4) };
    // parabolic interpolation around the chosen lag for sub-sample precision
    var T0 = chosen.lag, y1 = nsdf[T0 - 1] || 0, y2 = nsdf[T0], y3 = nsdf[T0 + 1] || 0, den = y1 - 2 * y2 + y3;
    if (den) T0 = T0 + 0.5 * (y1 - y3) / den;
    return { freq: sr / T0, clarity: Math.max(0, Math.min(1, chosen.val)) };
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
  var freqHist = [], lockedString = null, switchFrames = 0, quietFrames = 0, micBand = { fmin: 60, fmax: 1320 };
  function nearestString(freq, strings) {
    var best = strings[0], bd = 1e9;
    for (var i = 0; i < strings.length; i++) { var d = Math.abs(1200 * Math.log2(freq / strings[i].f)); if (d < bd) { bd = d; best = strings[i]; } }
    return best;
  }
  function nearest(freq) { return nearestString(freq, STRINGS); }
  // Search band from the instrument's own strings.
  //  fmin ×0.6  ≈ 9 semitones of FLAT headroom — a tuner's job is to catch a
  //    badly-flat string and say "very flat", not pin to the edge and read a
  //    plausible-but-wrong note that sends you tightening the wrong way.
  //  fmax floored at 1400 keeps minLag small, so the first-peak rule can't
  //    overshoot a high string's fundamental and report an octave low.
  function bandLimits(strings) {
    if (!strings || !strings.length) return { fmin: 48, fmax: 1400 };
    var lo = Infinity, hi = 0;
    strings.forEach(function (s) { if (s.f < lo) lo = s.f; if (s.f > hi) hi = s.f; });
    return { fmin: lo * 0.6, fmax: Math.max(hi * 1.8, 1400) };
  }
  function micToggle() {
    if (micOn) { micStop(); return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (stream) {
        micStream = stream;
        micAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = micAC.createMediaStreamSource(micStream);
        micAnalyser = micAC.createAnalyser();
        micAnalyser.fftSize = 4096;          // ~93ms @44.1k: enough low-string wavelengths to lock on
        micBuf = new Float32Array(micAnalyser.fftSize);
        micBand = bandLimits(STRINGS);
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
    var res = detectPitch(micBuf, micAC.sampleRate, micBand.fmin, micBand.fmax);
    var noteEl = document.getElementById('micNote'), centsEl = document.getElementById('micCents'), needle = document.getElementById('micNeedle');
    if (!noteEl || !centsEl || !needle) { micRAF = requestAnimationFrame(micLoop); return; }
    // Confidence gate: NSDF clarity is a true 0..1 periodicity score, so a single
    // firm threshold cleanly separates a real string from noise.
    if (res.freq > 0 && res.clarity > 0.9) {
      quietFrames = 0;
      freqHist.push(res.freq); if (freqHist.length > 5) freqHist.shift();
      var freq = median(freqHist); // median kills the odd single-frame spike
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
      // Adaptive easing: snap when you've jumped to a new string (big move),
      // glide when fine-tuning (small move) so the needle feels both quick and steady.
      var target = 50 + clamped, k = Math.abs(target - needleEMA) > 8 ? 0.34 : 0.16;
      needleEMA += (target - needleEMA) * k; needle.style.left = needleEMA.toFixed(1) + '%';
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
      + '<div class="micMeter"><div class="scale"></div><div class="center"></div><div class="needle" id="micNeedle" style="left:50%;transition:left 60ms linear,background 120ms linear"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
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

  // expose the pure DSP for Node unit tests (no DOM/mic needed)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.detectPitch = detectPitch;
    module.exports.nearestString = nearestString;
    module.exports.bandLimits = bandLimits;
    module.exports.median = median;
  }

})(typeof window !== 'undefined' ? window : this);
