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
  var inTuneHold = 0, reading = false, lastCentsTxt = '', glitchFrames = 0, prevShown = null;
  var strobePhase = 0, wasLocked = false, prevHint = '';
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
  // Needle position (0..100%) from cents error, ZOOMED near centre: a linear
  // ±50¢ needle moves ~1px for a few cents (invisible — why you end up reading
  // the number). Here ±10¢ spans 80% of the meter (4%/cent) so each cent is a
  // big visible move, and the outer ±10..50¢ compresses into the last 10%.
  // 0¢ -> 50 (dead centre); ±3¢ (in-tune zone) -> 50±12.
  function needlePos(cents) {
    var c = Math.max(-50, Math.min(50, cents)), a = Math.abs(c), sgn = c < 0 ? -1 : 1;
    var off = a <= 10 ? (a / 10) * 40 : 40 + ((a - 10) / 40) * 10;
    return 50 + sgn * off;
  }
  // Is this frame a glitch? True when `freq` deviates more than `maxCents` from the
  // running estimate `ref` - a pluck transient or a momentary octave/harmonic blip
  // that must not yank the needle. (ref<=0 means "no estimate yet" -> never a glitch.)
  function isOutlier(freq, ref, maxCents) {
    return ref > 0 && freq > 0 && Math.abs(1200 * Math.log2(freq / ref)) > (maxCents || 70);
  }
  // Tuning advice for "always tune UP from flat" (approach pitch from below so the
  // string seats under tension). Asymmetric + biased to the way you actually land:
  //   'flat'  (≤ -3¢)      keep coming up — the good direction
  //   'near'  (-2..+1¢)    you're on it — lock (landable coming up from below)
  //   'sharp' (≥ +2¢)      overshot — drop below and re-approach (tight on sharp)
  function tuneHint(cents) {
    if (cents >= 2) return 'sharp';
    if (cents <= -3) return 'flat';
    return 'near';
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
    var nn = document.getElementById('micNote'); if (nn) { nn.textContent = '·'; nn.classList.remove('intune'); }
    var cc = document.getElementById('micCents'); if (cc) cc.textContent = 'mic stopped';
    needleEMA = 50; freqHist = []; lockedString = null; switchFrames = 0; quietFrames = 0;
    inTuneHold = 0; reading = false; lastCentsTxt = ''; glitchFrames = 0; prevShown = null;
    strobePhase = 0; wasLocked = false; prevHint = '';
    var st = document.getElementById('micStrobe'); if (st) { st.classList.remove('locked'); st.classList.remove('sharp'); }
    var nd = document.getElementById('micNeedle');
    if (nd) { nd.style.left = '50%'; nd.style.background = 'var(--bad)'; if (nd.parentNode) { nd.parentNode.classList.remove('locked'); nd.parentNode.classList.remove('sharp'); } }
  }
  function micLoop() {
    if (!micOn) return;
    micAnalyser.getFloatTimeDomainData(micBuf);
    var res = detectPitch(micBuf, micAC.sampleRate, micBand.fmin, micBand.fmax);
    var noteEl = document.getElementById('micNote'), centsEl = document.getElementById('micCents'), needle = document.getElementById('micNeedle');
    if (!noteEl || !centsEl || !needle) { micRAF = requestAnimationFrame(micLoop); return; }
    var meter = needle.parentNode, strobe = document.getElementById('micStrobe'), strobeInner = document.getElementById('micStrobeInner');
    // Clarity hysteresis: acquire a string at 0.9, then HOLD it through brief dips
    // (down to 0.72) so the note/cents don't flicker out while a string sustains.
    if (res.freq > 0 && res.clarity > (reading ? 0.72 : 0.9)) {
      reading = true; quietFrames = 0;
      // Reject a single glitch frame so it can't yank the needle; if the deviation
      // PERSISTS (~4 frames) it's a real new note, so adopt it. Otherwise the
      // longer median buffer keeps the read steady — the needle tracks the same
      // smoothed value as the cents number you trust.
      var refFreq = freqHist.length ? median(freqHist) : 0;
      if (isOutlier(res.freq, refFreq, 40)) {
        if (++glitchFrames >= 4) { freqHist = [res.freq]; glitchFrames = 0; }
      } else {
        glitchFrames = 0;
        freqHist.push(res.freq); if (freqHist.length > 8) freqHist.shift();
      }
      var freq = median(freqHist);
      var tgt = nearest(freq);
      // Note-name hysteresis: don't flip the displayed string on a transient -
      // require a few consistent frames before committing to a new string.
      if (lockedString === null) { lockedString = tgt; switchFrames = 0; }
      else if (tgt !== lockedString) { if (++switchFrames >= 3) { lockedString = tgt; switchFrames = 0; } }
      else { switchFrames = 0; }
      var shown = lockedString;
      var cents = Math.round(1200 * Math.log2(freq / shown.f)), hint = tuneHint(cents);
      // Tight, asymmetric LOCK for tuning UP from flat: latch only at ±1¢; the
      // instant it goes sharp (overshoot) drop the lock so you SEE it; a brief
      // flat-side hold rides out wobble while the string seats.
      if (hint === 'near') inTuneHold = 8; else if (hint === 'sharp') inTuneHold = 0; else if (inTuneHold > 0) inTuneHold--;
      var locked = inTuneHold > 0;
      // Zoomed needle, driven by the same smoothed value as the cents readout.
      // SNAP only when the string itself changes; otherwise glide steadily, so
      // honing the last few cents stays rock-steady (no fast/slow jumpiness).
      var target = needlePos(cents), k = (shown !== prevShown) ? 0.45 : 0.2;
      prevShown = shown;
      needleEMA += (target - needleEMA) * k; needle.style.left = needleEMA.toFixed(1) + '%';
      // Colour the workflow: green = there; amber = flat, keep coming UP (the good
      // direction); red = sharp, you overshot — drop below and re-approach.
      needle.style.background = locked ? 'var(--good)' : (hint === 'sharp' ? 'var(--bad)' : 'var(--warn)');
      noteEl.textContent = shown.n;
      noteEl.classList.toggle('intune', locked);
      if (meter) { meter.classList.toggle('locked', locked); meter.classList.toggle('sharp', !locked && hint === 'sharp'); }
      // Steady text: repaint only on change. ✓ when locked; flat -> keep coming up;
      // sharp -> you overshot, drop below and come back up.
      var txt = locked ? '✓ in tune'
        : (hint === 'sharp' ? '+' + cents + '¢  ▼ sharp - drop & come up' : cents + '¢  ▲ keep tuning up');
      if (txt !== lastCentsTxt) { centsEl.textContent = txt; lastCentsTxt = txt; }
      // STROBE: stripes drift ∝ cents (flat ← / sharp →), FREEZE when locked — the
      // classic "stands still = in tune" read that beats chasing a needle.
      if (strobe && strobeInner) {
        strobe.classList.toggle('locked', locked);
        strobe.classList.toggle('sharp', !locked && hint === 'sharp');
        if (!locked) { strobePhase = ((strobePhase + cents * 0.5) % 20 + 20) % 20; strobeInner.style.transform = 'translateX(' + (-strobePhase) + 'px)'; }
      }
      // Haptics (Android): a tick the instant you LOCK, a buzz the instant you go
      // SHARP — feedback you feel without watching the screen.
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (locked && !wasLocked) navigator.vibrate(25);
        else if (hint === 'sharp' && prevHint !== 'sharp') navigator.vibrate([12, 30, 12]);
      }
      wasLocked = locked; prevHint = hint;
    } else if (++quietFrames > 18) {
      // Sustained silence (~0.3s): release, clear history, drift gently to centre.
      reading = false; freqHist = []; lockedString = null; switchFrames = 0; inTuneHold = 0; glitchFrames = 0; prevShown = null;
      needleEMA += (50 - needleEMA) * 0.05; needle.style.left = needleEMA.toFixed(1) + '%';
      needle.style.background = 'var(--bad)';
      noteEl.classList.remove('intune'); if (meter) { meter.classList.remove('locked'); meter.classList.remove('sharp'); }
      if (strobe) { strobe.classList.remove('locked'); strobe.classList.remove('sharp'); }
      wasLocked = false; prevHint = '';
      if (lastCentsTxt !== '…') { centsEl.textContent = 'listening… play a string'; lastCentsTxt = '…'; }
    }
    // brief dropouts (quietFrames <= 18): hold the last good reading, no flicker.
    micRAF = requestAnimationFrame(micLoop);
  }
  function buildMic(box) {
    if (!box) return;
    var secure = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!secure) {
      box.innerHTML = '<div class="micMsg"><b>The live needle needs a microphone</b>, which the browser only allows over <b>https</b>. Opened as a local file the mic is blocked - use the reference tones below to tune by ear, or open this page over https (it is live on GitHub Pages) to unlock the needle.</div>';
      return;
    }
    box.innerHTML = '<div class="micNote" id="micNote">·</div><div class="micCents" id="micCents">tap Start, then play a string</div>'
      + '<div class="micMeter"><div class="scale"></div><div class="tgt"></div><div class="center"></div><div class="needle" id="micNeedle" style="left:50%;transition:background 120ms linear"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
      + '<div class="strobe" id="micStrobe"><div class="strobeInner" id="micStrobeInner"></div><div class="strobeLbl">stands still = in tune · drifts ◀ flat · sharp ▶</div></div>'
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
    module.exports.needlePos = needlePos;
    module.exports.isOutlier = isOutlier;
    module.exports.tuneHint = tuneHint;
    module.exports.median = median;
  }

})(typeof window !== 'undefined' ? window : this);
