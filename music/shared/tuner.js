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
   * standard cure for octave errors (a low string reading an octave off would
   * otherwise land on the wrong string). Band-limiting both speeds it up
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

  /* ---------- guided-mode detection: cents from a KNOWN string ----------
   * detectPitchNear(buf, sr, fTarget) -> { freq, clarity }
   * The guided flow already knows which string is being tuned, so there is
   * nothing to identify: NSDF over lags [T/2.5 .. 1.4T] (T = sr / fTarget),
   * so the lag-0 lobe and its first negative crossing are inside the scan,
   * then pick the STRONGEST key maximum whose lag sits inside the window
   * [T*2^(-300/1200) .. T*2^(+500/1200)] - i.e. a frequency within -500..+300
   * cents of the string. Both octaves fall OUTSIDE that window by
   * construction, so no first-peak rule and no note naming are needed.
   * Why not detectPitch with a narrow band: its key-maxima scan skips
   * everything before the first negative zero-crossing, and a narrow band can
   * START inside the fundamental's own positive lobe, returning -1 on a clean
   * fundamental-heavy tone (measured in tools/tuner-lab.js E1).
   * freq -1 / clarity 0 when below the RMS floor or no peak lands in the window. */
  function detectPitchNear(buf, sr, fTarget) {
    var n = buf.length, i, lag, rms = 0;
    for (i = 0; i < n; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / n) < 0.01) return { freq: -1, clarity: 0 };   // same floor as detectPitch
    var T0 = sr / fTarget;
    var minLag = Math.max(2, Math.floor(T0 / 2.5)), maxLag = Math.min(n - 2, Math.ceil(T0 * 1.4));
    if (maxLag <= minLag) return { freq: -1, clarity: 0 };
    var loLag = T0 * Math.pow(2, -300 / 1200), hiLag = T0 * Math.pow(2, 500 / 1200);
    if (!nsdfBuf || nsdfBuf.length < maxLag + 2) nsdfBuf = new Float64Array(maxLag + 2);
    var nsdf = nsdfBuf;
    for (lag = minLag; lag <= maxLag; lag++) {
      var ac = 0, m = 0;
      for (i = 0; i < n - lag; i++) { var a = buf[i], b = buf[i + lag]; ac += a * b; m += a * a + b * b; }
      nsdf[lag] = m > 0 ? (2 * ac / m) : 0;
    }
    // key maxima: the top of every positive lobe (the lag-0 lobe included - the
    // window test below is what rejects it), strongest in-window wins
    var best = null, curMax = -1, curLag = -1, positive = false;
    for (lag = minLag; lag <= maxLag; lag++) {
      var v = nsdf[lag];
      if (!positive) { if (v > 0) { positive = true; curMax = v; curLag = lag; } }
      else {
        if (v > curMax) { curMax = v; curLag = lag; }
        if (v <= 0 || lag === maxLag) {
          if (curLag >= loLag && curLag <= hiLag && (!best || curMax > best.val)) best = { lag: curLag, val: curMax };
          positive = false; curMax = -1;
        }
      }
    }
    if (!best) return { freq: -1, clarity: 0 };
    // Sub-harmonic guard: a note well ABOVE the target (a G plucked while the
    // target is A) has a peak at TWICE its period that lands inside the window
    // and would read as a huge flat. Its true period sits near half the chosen
    // lag - if a comparable key maximum lives there, this is someone else's
    // sub-octave: report nothing (prefer no reading over a wrong reading). A
    // real target note has no comparable peak at T/2 unless the 2nd harmonic
    // alone carries the tone, which no plucked string does (measured: a
    // 0.25:1 fundamental:2nd low E keeps nsdf(T/2) near 0.5).
    // (checked at lag/2 .. lag/5 - a high E against target low E lands on 4T
    // and 5T of its own period - computed directly at those few lags, below
    // the scanned range)
    function nsdfAt(L) {
      if (L < 2 || L > n - 2) return 0;
      var ac = 0, m = 0;
      for (var q = 0; q < n - L; q++) { var a1 = buf[q], b1 = buf[q + L]; ac += a1 * b1; m += a1 * a1 + b1 * b1; }
      return m > 0 ? (2 * ac / m) : 0;
    }
    for (var d = 2; d <= 5; d++) {
      var sub = Math.round(best.lag / d), hm = 0;
      if (sub < 4) break;
      for (var o = -2; o <= 2; o++) { var v2 = (sub + o >= minLag && sub + o <= maxLag) ? nsdf[sub + o] : nsdfAt(sub + o); if (v2 > hm) hm = v2; }
      if (hm >= 0.9 * best.val) return { freq: -1, clarity: 0 };
    }
    // parabolic interpolation around the chosen lag (neighbours outside the
    // scanned range read as 0 - the scratch buffer may hold a previous frame)
    var L = best.lag, y1 = L - 1 >= minLag ? nsdf[L - 1] : 0, y2 = nsdf[L], y3 = L + 1 <= maxLag ? nsdf[L + 1] : 0;
    var den = y1 - 2 * y2 + y3;
    if (den) L = L + 0.5 * (y1 - y3) / den;
    return { freq: sr / L, clarity: Math.max(0, Math.min(1, best.val)) };
  }

  /* ---------- drone cancellation ----------
   * cancelDrone(buf, sr, f0) -> NEW Float32Array; input never mutated.
   * The reference tone plays through the speaker while the mic listens, so
   * the drone lands INSIDE the detector: the autocorrelation of two close
   * tones peaks between them, pulled toward the louder one - a flat string
   * under a loud drone reads "in tune" (measured: -8 c reads -2.8 c at 4x).
   * We GENERATE the drone (sine + triangle at f0, startDrone), so its
   * frequency and shape are exact: subtract the least-squares projection of
   * the buffer onto sin/cos at f0 and 5f0 - NOT 3f0: the string's own 3rd
   * harmonic sits there too, and removing it leaves an even-harmonics-only
   * residual that is periodic at T/2, which the sub-harmonic guard in
   * detectPitchNear then rejects as someone else's sub-octave (measured:
   * every in-tune read went to -1). The drone's 3rd (1/9 of its triangle)
   * costs under 1 c at a 4x drone; the 5th is cheap to remove and harmless.
   * The ear still hears the beats in the room; the detector hears the string. */
  function cancelDrone(buf, sr, f0) {
    var n = buf.length, out = new Float32Array(n), i, k;
    for (i = 0; i < n; i++) out[i] = buf[i];
    var HARM = [1, 5];
    for (k = 0; k < HARM.length; k++) {
      var w = 2 * Math.PI * f0 * HARM[k] / sr, ss = 0, sc = 0, cc = 0, xs = 0, xc = 0;
      for (i = 0; i < n; i++) { var s = Math.sin(w * i), c = Math.cos(w * i); ss += s * s; sc += s * c; cc += c * c; xs += out[i] * s; xc += out[i] * c; }
      var det = ss * cc - sc * sc; if (!det) continue;
      var A = (xs * cc - xc * sc) / det, B = (xc * ss - xs * sc) / det;
      for (i = 0; i < n; i++) out[i] -= A * Math.sin(w * i) + B * Math.cos(w * i);
    }
    return out;
  }

  /* ---------- mic plumbing shared by both modes (secure-context only) ---------- */
  var STRINGS = [], micOn = false, micStream = null, micAC = null, micAnalyser = null, micBuf = null, micRAF = null;
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
  // string seats under tension). Asymmetric — biased to the way you actually land:
  //   'flat'  (≤ -4¢)      keep coming up — the good direction
  //   'near'  (-3..+2¢)    you're on it — lock (the GREEN zone, aligned to the
  //                        needlePos ±3 in-tune band)
  //   'sharp' (≥ +3¢)      overshot — drop below and re-approach (tight on sharp)
  function tuneHint(cents) {
    if (cents >= 3) return 'sharp';
    if (cents <= -4) return 'flat';
    return 'near';
  }
  /* ---------- GUIDED TUNE (default mode, S-TUNER-GOAL-FLOW 2026-09-12) ----------
   * The operator's own workflow made deterministic: Start -> lowest string ->
   * approach from flat along the runway -> sustained arrival -> landed ->
   * auto-advance -> ... -> done. The decision "where are we in the loop"
   * lives in TuneFlow (tune-flow.js, pure + Node-tested); THIS block owns the
   * audio (detectPitchNear on the KNOWN target, the drone and its
   * cancellation) and the pixels. No note identification anywhere on this
   * path - the read is cents-from-THIS-string, nothing else. */
  var TONE_KEY = 'music.tuner.tone.v1';           // '0' = tone off; absent/anything else = on (default ON)
  var PARAMS_KEY = 'music.tuner.lab.v2';         // the tuning lab's four macro sliders (0..100 each), absent = defaults
  // Mic-side knobs (the flow's own knobs live in TuneFlow.DEFAULTS).
  var MIC_DEFAULTS = { clarityAcquire: 0.9, clarityHold: 0.72 };
  var mic = { clarityAcquire: 0.9, clarityHold: 0.72 };
  // The tuning lab (?tunerlab=1): FOUR plain sliders, each from "too cold" to
  // "too hot" with today's defaults at the middle, so the operator finds his
  // Goldilocks by feel and reports four numbers. Each macro drives several
  // real parameters through a cold/default/hot triple (piecewise-linear, so
  // 50 = exactly the shipped default).
  var MACROS = [
    { key: 'land', label: 'Landing', cold: 'lands easily', hot: 'lands strictly',
      params: { holdMs: [120, 450, 1200], inTuneCents: [4, 2.5, 1.5], wobbleCents: [3, 2, 0.5] } },
    { key: 'needle', label: 'Needle', cold: 'twitchy', hot: 'calm',
      params: { medianFrames: [1, 5, 9], honeK: [0.5, 0.07, 0.015], midK: [0.7, 0.16, 0.04], farK: [1, 0.35, 0.1] } },
    { key: 'ratchet', label: 'Ratchet', cold: 'follows every dip', hot: 'only climbs',
      params: { dropFrames: [0, 6, 20], dropCents: [0, 1.5, 4] } },
    { key: 'ear', label: 'Ear', cold: 'picky', hot: 'forgiving',
      params: { clarityAcquire: [0.95, 0.9, 0.6], clarityHold: [0.85, 0.72, 0.4], gapMs: [300, 700, 1500] } }
  ];
  function lerp3(tri, t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? tri[0] + (tri[1] - tri[0]) * (t * 2) : tri[1] + (tri[2] - tri[1]) * ((t - 0.5) * 2); }
  function loadMacros() { try { var j = JSON.parse(localStorage.getItem(PARAMS_KEY) || 'null'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } }
  function saveMacros(m) { try { localStorage.setItem(PARAMS_KEY, JSON.stringify(m)); } catch (e) { } }
  function macroValue(m, key) { var v = m[key]; return (v == null || !isFinite(v)) ? 50 : Math.max(0, Math.min(100, +v)); }
  function deriveParams(m) {
    var out = {};
    MACROS.forEach(function (mac) {
      var t = macroValue(m, mac.key) / 100;
      for (var k in mac.params) { var v = lerp3(mac.params[k], t); out[k] = (k === 'medianFrames' || k === 'dropFrames') ? Math.round(v) : Math.round(v * 1000) / 1000; }
    });
    return out;
  }
  function applyMacros(m) {
    var p = deriveParams(m);
    if (flow) flow.set(p);
    for (var k in MIC_DEFAULTS) if (p[k] != null) mic[k] = p[k];
    return p;
  }
  function labRequested() { try { return /[?&]tunerlab=1/.test(location.search) || localStorage.getItem('music.tuner.lab.v1') === '1'; } catch (e) { return false; } }
  function paramsLine() {
    var m = loadMacros(), parts = [];
    MACROS.forEach(function (mac) { parts.push(mac.key + '=' + macroValue(m, mac.key)); });
    var p = deriveParams(m), dp = [];
    for (var k in p) dp.push(k + '=' + p[k]);
    return parts.join(' ') + '\n' + dp.join(' ');
  }
  function renderLabReadout() { var o = el('labLine'); if (o) o.textContent = paramsLine(); }
  function fmtS(ms) { return (Math.max(0, ms) / 1000).toFixed(2) + 's'; }
  function buildLab(box) {
    var lab = document.createElement('div'); lab.className = 'tunerLab'; lab.id = 'tunerLab';
    var html = '<div class="labLive" id="labLive">-</div><div class="labTry" id="labTry">last pluck: -</div>';
    MACROS.forEach(function (mac) {
      html += '<div class="labRow"><div class="labHead"><span class="labLbl">' + mac.label + '</span><span class="labVal" id="labVal-' + mac.key + '"></span></div>'
        + '<input type="range" data-key="' + mac.key + '" min="0" max="100" step="1" aria-label="' + mac.label + '">'
        + '<div class="labEnds"><span>' + mac.cold + '</span><span>' + mac.hot + '</span></div></div>';
    });
    html += '<div class="labLine" id="labLine"></div><div class="actions micActions"><button class="btn ghost" id="labReset">Back to defaults</button></div>';
    lab.innerHTML = html;
    box.appendChild(lab);
    var m = loadMacros();
    lab.querySelectorAll('input[type=range]').forEach(function (inp) {
      var k = inp.getAttribute('data-key');
      inp.value = macroValue(m, k); var vv = el('labVal-' + k); if (vv) vv.textContent = inp.value;
      inp.oninput = function () {
        var m2 = loadMacros(); m2[k] = +inp.value; saveMacros(m2); applyMacros(m2);
        var vv2 = el('labVal-' + k); if (vv2) vv2.textContent = inp.value;
        renderLabReadout();
      };
    });
    el('labReset').onclick = function () {
      try { localStorage.removeItem(PARAMS_KEY); } catch (e) { }
      applyMacros({});
      lab.querySelectorAll('input[type=range]').forEach(function (inp) { inp.value = 50; var vv = el('labVal-' + inp.getAttribute('data-key')); if (vv) vv.textContent = '50'; });
      renderLabReadout();
    };
    renderLabReadout();
  }
  function renderLabLive(st, res) {
    var o = el('labLive'), tr = el('labTry'); if (!o) return;
    var need = flow ? flow.params().holdMs : 450;
    o.textContent = 'now: ' + (st.cents == null ? 'nothing heard' : (st.cents > 0 ? '+' : '') + st.cents.toFixed(1) + '\u00a2')
      + (res ? '  hearing ' + Math.round(res.clarity * 100) + '%' : '')
      + '  in zone ' + fmtS((st.holdProgress || 0) * need) + ' of ' + fmtS(need);
    if (tr) {
      if (st.phase === 'landed' || st.phase === 'done') tr.textContent = 'last pluck: landed';
      else if (st.lastReset) tr.textContent = 'last pluck: held ' + fmtS(st.bestHoldMs || 0) + ' of ' + fmtS(need) + ', then ' + st.lastReset + (st.resets > 1 ? ' (' + st.resets + ' tries)' : '');
      else if ((st.bestHoldMs || 0) > 0) tr.textContent = 'this pluck: held ' + fmtS(st.bestHoldMs) + ' of ' + fmtS(need) + ' so far';
      else tr.textContent = 'last pluck: -';
    }
  }
  var mode = 'guided', flow = null, simActive = false, quietFrames = 0, reading = false;
  var lastCentsTxt = '', lastNoteTxt = '', prevPhase = '';
  function toneOn() { try { return localStorage.getItem(TONE_KEY) !== '0'; } catch (e) { return true; } }
  function setToneOn(on) { try { localStorage.setItem(TONE_KEY, on ? '1' : '0'); } catch (e) { } }
  // Runway position (0..100%) from cents: the POST sits at 60%. The long flat
  // stretch (0..60%) is the designed approach path; the short right stretch
  // is overshoot. Same zoom as needlePos near the target (+/-10c fills most of
  // each side) so the last cents are visible moves.
  var POST_PCT = 60;
  function runwayPos(cents) {
    var c = Math.max(-50, Math.min(50, cents)), a = Math.abs(c);
    var off = a <= 10 ? (a / 10) * 40 : 40 + ((a - 10) / 40) * 10;   // 0..50
    var pos = c < 0 ? POST_PCT - off * (POST_PCT / 50) : POST_PCT + off * ((100 - POST_PCT) / 50);
    return Math.max(3, Math.min(97, pos));
  }
  function el(id) { return document.getElementById(id); }
  function guidedActive() { return !!flow && (micOn || simActive) && mode === 'guided'; }
  function ensureFlow() {
    if (flow) return flow;
    if (!global.TuneFlow) return null;
    flow = global.TuneFlow.create({ strings: STRINGS });
    applyMacros(loadMacros());
    flow.on('retarget', function (ev) {
      // the target's own tone drones while you tune it (cancelled out of the
      // mic path by cancelDrone) - swap it with the target
      if (toneOn() && (micOn || simActive) && !simActive) { stopDrone(); startDrone(ev.target.f, ev.index); }
      reading = false; quietFrames = 0;
    });
    flow.on('landed', function () {
      // the ONE haptic: a single pulse when a string lands (operator: the
      // off-note buzz was a liability with the phone lying on the guitar)
      if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { } }
    });
    flow.on('done', function () { finishGuided(); });
    return flow;
  }
  function renderGuided(st) {
    var noteEl = el('micNote'), centsEl = el('micCents'), rw = el('micRunway'), puck = el('micPuck'), hold = el('micHold');
    if (!noteEl || !centsEl || !rw || !puck) return;
    var t = st.target, phase = st.phase, txt, note;
    if (phase === 'idle') { note = t ? t.n : '·'; txt = 'tap Start - the tuner walks every string, low to high'; }
    else if (phase === 'done') { note = '✓'; txt = 'all ' + STRINGS.length + ' strings in tune'; }
    else if (phase === 'landed') { note = t.n; txt = '✓ ' + t.n + ' in tune' + (st.progress.every(function (d) { return d; }) ? '' : ' - next string coming up'); }
    else if (st.cents == null) { note = t.n; txt = 'play the ' + t.l; }
    else {
      note = t.n;
      var c = Math.round(st.cents);
      if (st.hint === 'sharp') txt = '+' + c + '¢  ▼ sharp - back off, then come up';
      else if (phase === 'arriving') txt = (c > 0 ? '+' : '') + c + '¢  hold it...';
      else if (st.hint === 'near') txt = (c > 0 ? '+' : '') + c + '¢  almost - ease it up';
      else txt = c + '¢  ▲ keep tuning up';
    }
    if (note !== lastNoteTxt) { noteEl.textContent = note; lastNoteTxt = note; }
    if (txt !== lastCentsTxt) { centsEl.textContent = txt; lastCentsTxt = txt; }
    noteEl.classList.toggle('intune', phase === 'landed' || phase === 'done');
    rw.classList.toggle('waiting', phase !== 'landed' && phase !== 'done' && st.cents == null);
    rw.classList.toggle('arriving', phase === 'arriving');
    rw.classList.toggle('landed', phase === 'landed' || phase === 'done');
    rw.classList.toggle('sharp', phase !== 'landed' && phase !== 'done' && st.hint === 'sharp');
    if (phase === 'landed' || phase === 'done') puck.style.left = POST_PCT + '%';
    else if (st.cents != null) puck.style.left = runwayPos(st.cents).toFixed(1) + '%';
    else if (phase === 'idle' || prevPhase !== phase) puck.style.left = '6%';
    if (hold) hold.style.width = (Math.max(0, Math.min(1, st.holdProgress || 0)) * 14).toFixed(1) + '%';
    var btns = document.querySelectorAll('#tStrings .tStr');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('done', !!st.progress[i]);
      btns[i].classList.toggle('cur', i === st.index && phase !== 'idle' && phase !== 'done');
    }
    prevPhase = phase;
  }
  function applyFrame(cents, nowMs, res) {
    if (!flow) return null;
    var st = flow.feed(cents, nowMs);
    renderGuided(st);
    renderLabLive(st, res);
    return st;
  }
  function guidedLoop() {
    if (!micOn || mode !== 'guided' || !flow) return;
    micAnalyser.getFloatTimeDomainData(micBuf);
    var st = flow.state(), f = st.target ? st.target.f : 0;
    if (f > 0 && st.phase !== 'done') {
      // the drone we play is subtracted from what we hear BEFORE detection -
      // otherwise a loud tone pulls the read toward "in tune" (measured: a
      // -8c string read -2.8c under a 4x drone; see tools/tuner-lab.js E3)
      var src = droneIdx >= 0 ? cancelDrone(micBuf, micAC.sampleRate, f) : micBuf;
      var res = detectPitchNear(src, micAC.sampleRate, f);
      // clarity hysteresis: acquire at 0.9, hold through dips to 0.72; ~0.3s of
      // nothing releases (a brief dropout is not "the string stopped")
      var voiced = res.freq > 0 && res.clarity > (reading ? mic.clarityHold : mic.clarityAcquire);
      if (voiced) { reading = true; quietFrames = 0; }
      else if (++quietFrames > 18) reading = false;
      applyFrame(voiced ? 1200 * Math.log2(res.freq / f) : null, performance.now(), res);
    }
    micRAF = requestAnimationFrame(guidedLoop);
  }
  function startGuided() {
    if (!ensureFlow()) { var c0 = el('micCents'); if (c0) c0.textContent = 'guided tuning failed to load - use the tones below'; return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (stream) {
        micStream = stream;
        micAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = micAC.createMediaStreamSource(micStream);
        micAnalyser = micAC.createAnalyser();
        micAnalyser.fftSize = 4096;          // ~93ms @44.1k: enough low-string wavelengths to lock on
        micBuf = new Float32Array(micAnalyser.fftSize);
        src.connect(micAnalyser);
        micOn = true;
        var t = el('micToggle'); if (t) t.textContent = 'Stop';
        flow.start(0);                       // fires 'retarget' -> drone + render
        renderGuided(flow.state());
        guidedLoop();
      })
      .catch(function () { var c = el('micCents'); if (c) c.textContent = 'Mic permission denied.'; });
  }
  function releaseMic() {
    micOn = false;
    if (micRAF) cancelAnimationFrame(micRAF);
    if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
    if (micAC) { micAC.close(); micAC = null; }
  }
  function finishGuided() {
    // every string landed: mic + tone off (battery, privacy); Start again restarts
    releaseMic(); stopDrone(); simActive = false;
    var t = el('micToggle'); if (t) t.textContent = 'Start again';
    if (flow) renderGuided(flow.state());
  }
  function stopGuided() {
    releaseMic(); stopDrone(); simActive = false;
    if (flow) { flow.stop(); renderGuided(flow.state()); }
    var t = el('micToggle'); if (t) t.textContent = 'Start';
  }

  /* ---------- FREE mode ("Any string" chip - the legacy auto-recognition) ----------
   * Identify whichever string is sounding, then show cents against it. Kept
   * reachable, not default (operator: never used it). Smoothing chain:
   * clarity gate -> median -> note-name hysteresis -> eased needle, holding
   * the last good value through brief dropouts. No haptics on this path. */
  var needleEMA = 50, freqHist = [], lockedString = null, switchFrames = 0, micBand = { fmin: 60, fmax: 1320 };
  var inTuneHold = 0, glitchFrames = 0, prevShown = null, freeTxt = '';
  function startFree() {
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (stream) {
        micStream = stream;
        micAC = new (window.AudioContext || window.webkitAudioContext)();
        var src = micAC.createMediaStreamSource(micStream);
        micAnalyser = micAC.createAnalyser();
        micAnalyser.fftSize = 4096;
        micBuf = new Float32Array(micAnalyser.fftSize);
        micBand = bandLimits(STRINGS);
        src.connect(micAnalyser);
        micOn = true;
        var t = el('micToggle'); if (t) t.textContent = 'Stop mic';
        freeLoop();
      })
      .catch(function () { var c = el('micCents'); if (c) c.textContent = 'Mic permission denied.'; });
  }
  function stopFree() {
    releaseMic();
    var t = el('micToggle'); if (t) t.textContent = 'Start mic';
    var nn = el('micNote'); if (nn) { nn.textContent = '·'; nn.classList.remove('intune'); }
    var cc = el('micCents'); if (cc) cc.textContent = 'mic stopped';
    needleEMA = 50; freqHist = []; lockedString = null; switchFrames = 0; quietFrames = 0;
    inTuneHold = 0; reading = false; freeTxt = ''; glitchFrames = 0; prevShown = null;
    var nd = el('micNeedle');
    if (nd) { nd.style.left = '50%'; nd.style.background = 'var(--bad)'; if (nd.parentNode) { nd.parentNode.classList.remove('locked'); nd.parentNode.classList.remove('sharp'); } }
  }
  function freeLoop() {
    if (!micOn || mode !== 'free') return;
    micAnalyser.getFloatTimeDomainData(micBuf);
    var res = detectPitch(micBuf, micAC.sampleRate, micBand.fmin, micBand.fmax);
    var noteEl = el('micNote'), centsEl = el('micCents'), needle = el('micNeedle');
    if (!noteEl || !centsEl || !needle) { micRAF = requestAnimationFrame(freeLoop); return; }
    var meter = needle.parentNode;
    if (res.freq > 0 && res.clarity > (reading ? 0.72 : 0.9)) {
      reading = true; quietFrames = 0;
      var refFreq = freqHist.length ? median(freqHist) : 0;
      if (isOutlier(res.freq, refFreq, 40)) {
        if (++glitchFrames >= 4) { freqHist = [res.freq]; glitchFrames = 0; }
      } else {
        glitchFrames = 0;
        freqHist.push(res.freq); if (freqHist.length > 8) freqHist.shift();
      }
      var freq = median(freqHist);
      var tgt = nearest(freq);
      var SWITCH_FRAMES = 5, SWITCH_MARGIN = 20;
      if (lockedString === null) { lockedString = tgt; switchFrames = 0; }
      else if (tgt !== lockedString) {
        var dNew = Math.abs(1200 * Math.log2(freq / tgt.f));
        var dOld = Math.abs(1200 * Math.log2(freq / lockedString.f));
        if (dOld - dNew > SWITCH_MARGIN) { if (++switchFrames >= SWITCH_FRAMES) { lockedString = tgt; switchFrames = 0; } }
        else { switchFrames = 0; }
      }
      else { switchFrames = 0; }
      var shown = lockedString;
      var cents = Math.round(1200 * Math.log2(freq / shown.f)), hint = tuneHint(cents);
      if (hint === 'near') inTuneHold = 8; else if (hint === 'sharp') inTuneHold = 0; else if (inTuneHold > 0) inTuneHold--;
      var locked = inTuneHold > 0;
      var target = needlePos(cents), acents = Math.abs(cents), k;
      if (shown !== prevShown) k = 0.5;
      else if (acents > 15) k = 0.35;
      else if (acents > 5) k = 0.16;
      else k = 0.07;
      prevShown = shown;
      needleEMA += (target - needleEMA) * k; needle.style.left = needleEMA.toFixed(1) + '%';
      needle.style.background = locked ? 'var(--good)' : (hint === 'sharp' ? 'var(--bad)' : 'var(--warn)');
      noteEl.textContent = shown.n;
      noteEl.classList.toggle('intune', locked);
      if (meter) { meter.classList.toggle('locked', locked); meter.classList.toggle('sharp', !locked && hint === 'sharp'); }
      var txt = locked ? '✓ in tune'
        : (hint === 'sharp' ? '+' + cents + '¢  ▼ sharp - drop & come up' : cents + '¢  ▲ keep tuning up');
      if (txt !== freeTxt) { centsEl.textContent = txt; freeTxt = txt; }
    } else if (++quietFrames > 18) {
      reading = false; freqHist = []; lockedString = null; switchFrames = 0; inTuneHold = 0; glitchFrames = 0; prevShown = null;
      needleEMA += (50 - needleEMA) * 0.05; needle.style.left = needleEMA.toFixed(1) + '%';
      needle.style.background = 'var(--bad)';
      noteEl.classList.remove('intune'); if (meter) { meter.classList.remove('locked'); meter.classList.remove('sharp'); }
      if (freeTxt !== '…') { centsEl.textContent = 'listening… play a string'; freeTxt = '…'; }
    }
    micRAF = requestAnimationFrame(freeLoop);
  }

  /* ---------- demo mode (?tunerdemo=1): feel the loop with no mic ----------
   * A scripted approach-from-flat per string, fed through Tuner._sim, so a
   * githack branch preview shows the whole guided loop animating on any
   * phone before the mic is even granted. This is how runway/feel VARIANTS
   * get compared on the device (see engineering-wiki/workflows/
   * branch-prototypes.md) - the demo drives the production flow + render
   * path, only the cents frames are synthetic. */
  var demoRAF = null, demoT0 = 0, demoSeed = 0;
  function demoFrame() {
    if (!simActive || !flow) { demoRAF = null; return; }
    var st = flow.state();
    if (st.phase === 'done') { demoRAF = null; return; }
    var now = performance.now(), el0 = (now - demoT0) / 1000;   // seconds since this string's retarget
    // 0-0.6s: silence (you reach for the peg); 0.6-3.0s: climb -38c -> 0 with a
    // peg-turn wobble; then settle inside the zone with a little hand tremor
    var cents = null;
    if (el0 > 0.6) {
      var k = Math.min(1, (el0 - 0.6) / 2.4);
      var climb = -38 * (1 - k) * (1 - k);                       // ease-out: fast at first, honing at the end
      var wobble = Math.sin(el0 * 7 + demoSeed) * 1.6 * (1 - k) + Math.sin(el0 * 13) * 0.6;
      cents = climb + wobble;
    }
    applyFrame(cents, now);
    demoRAF = requestAnimationFrame(demoFrame);
  }
  function startDemo() {
    if (!global.Tuner || !global.Tuner._sim) return;
    global.Tuner._sim.start();
    demoT0 = performance.now(); demoSeed = 0;
    flow.on('retarget', function () { demoT0 = performance.now(); demoSeed += 1.7; });
    if (!demoRAF) demoRAF = requestAnimationFrame(demoFrame);
  }
  function demoRequested() { try { return /[?&]tunerdemo=1/.test(location.search); } catch (e) { return false; } }

  /* ---------- shared controls ---------- */
  function micToggle() {
    if (mode === 'guided') {
      if (micOn) { stopGuided(); return; }
      if (flow && flow.state().phase === 'done') { /* Start again: flow.start() resets progress */ }
      startGuided();
    } else {
      if (micOn) { stopFree(); return; }
      startFree();
    }
  }
  function micStop() { if (mode === 'guided') stopGuided(); else stopFree(); }
  function setMode(next) {
    if (next === mode) return;
    micStop();
    mode = next;
    var g = el('micRunway'), m = el('micMeter'), tone = el('toneToggle'), t = el('micToggle');
    if (g) g.style.display = mode === 'guided' ? '' : 'none';
    if (m) m.style.display = mode === 'free' ? '' : 'none';
    if (tone) tone.style.display = mode === 'guided' ? '' : 'none';
    if (t) t.textContent = mode === 'guided' ? 'Start' : 'Start mic';
    var cc = el('micCents'); if (cc) cc.textContent = mode === 'guided' ? 'tap Start - the tuner walks every string, low to high' : 'tap Start mic, then play any string';
    lastCentsTxt = ''; lastNoteTxt = '';
    var nn = el('micNote'); if (nn) nn.textContent = '·';
    document.querySelectorAll('.micModes .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === mode); });
    document.querySelectorAll('#tStrings .tStr').forEach(function (b) { b.classList.remove('cur'); b.classList.remove('done'); });
  }
  function renderToneBtn() { var b = el('toneToggle'); if (b) { b.textContent = toneOn() ? 'Tone on' : 'Tone off'; b.classList.toggle('on', toneOn()); } }
  function toggleTone() {
    var on = !toneOn(); setToneOn(on); renderToneBtn();
    if (guidedActive() && flow.state().target) { if (on) { stopDrone(); startDrone(flow.state().target.f, flow.state().index); } else stopDrone(); }
  }
  function buildMic(box) {
    if (!box) return;
    var secure = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (!secure) {
      box.innerHTML = '<div class="micMsg"><b>The tuner needs a microphone</b>, which the browser only allows over <b>https</b>. Opened as a local file the mic is blocked - use the reference tones below to tune by ear, or open this page over https (it is live on GitHub Pages) to unlock it.</div>';
      return;
    }
    box.innerHTML = '<div class="chips micModes"><button class="chip on" data-mode="guided">Guided</button><button class="chip" data-mode="free">Any string</button></div>'
      + '<div class="micNote" id="micNote">·</div><div class="micCents" id="micCents">tap Start - the tuner walks every string, low to high</div>'
      // the runway: approach from the flat side toward the post at 60%
      + '<div class="runway waiting" id="micRunway"><div class="rwTrack"></div><div class="rwPost" id="micPost"></div><div class="rwHold" id="micHold"></div><div class="rwPuck" id="micPuck" style="left:6%"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
      // the legacy needle meter (free mode only)
      + '<div class="micMeter" id="micMeter" style="display:none"><div class="scale"></div><div class="tgt"></div><div class="center"></div><div class="needle" id="micNeedle" style="left:50%;transition:background 120ms linear"></div><div class="fl">♭ flat</div><div class="sh">sharp ♯</div></div>'
      // Primary CTA: .btn.red (the app's canonical accent-fill primary); the
      // tone toggle rides beside it as a ghost
      + '<div class="actions micActions"><button class="btn red" id="micToggle">Start</button><button class="btn ghost" id="toneToggle">Tone on</button></div>';
    el('micToggle').onclick = micToggle;
    el('toneToggle').onclick = toggleTone;
    renderToneBtn();
    // the lab sits right under the runway (the sliders and the puck on one
    // screen - you pluck and drag at the same time); the Tune tab scrolls while
    // it is present. A power tool, not the everyday layout.
    if (labRequested() && global.TuneFlow) {
      try { localStorage.setItem('music.tuner.lab.v1', '1'); } catch (e) { }
      var screen = document.getElementById('s-tune');
      if (screen) screen.classList.add('labOn');
      var rw = el('micRunway'), acts = box.querySelector('.micActions');
      var holder = document.createElement('div'); holder.id = 'labSlot';
      if (rw && acts) box.insertBefore(holder, acts); else box.appendChild(holder);
      buildLab(holder);
    }
  }

  /* ---------- string buttons: the progress row (guided) / reference tones (idle) ---------- */
  function buildStrings(elx) {
    if (!elx) return;
    elx.innerHTML = '';
    STRINGS.forEach(function (s, i) {
      var b = document.createElement('button'); b.className = 'tStr';
      b.innerHTML = '<span class="n">' + s.n + '</span><span class="l">' + s.l + '</span><span class="hz">' + s.f.toFixed(0) + ' Hz</span>';
      b.onclick = function () {
        // while guided tuning runs a tap RETARGETS the loop (the buttons still
        // accept your input); otherwise it is the reference tone it always was
        if (guidedActive() && flow.state().phase !== 'done') { flow.retarget(i); renderGuided(flow.state()); }
        else toggleDrone(s.f, i, b);
      };
      elx.appendChild(b);
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
      flow = null; mode = 'guided'; simActive = false;
      buildMic(opts.micBoxEl || document.getElementById('micBox'));
      buildStrings(opts.stringsEl || document.getElementById('tStrings'));
      // ?tunerdemo=1: run the scripted loop once the Tune tab is on screen
      if (demoRequested() && global.TuneFlow) {
        var kick = function (ev) { if (ev && ev.detail && ev.detail.tab !== 'tune') return; window.removeEventListener('music:tab-shown', kick); setTimeout(startDemo, 500); };
        var tuneScreen = document.getElementById('s-tune');
        if (tuneScreen && tuneScreen.offsetParent !== null) setTimeout(startDemo, 500); else window.addEventListener('music:tab-shown', kick);
      }
    },
    // silence mic + reference drones (call when leaving the Tune tab)
    stop: function () { stopDrone(); micStop(); },
    // Test hook (test/pw/scenarios/tune-guided.json): drives the SAME flow +
    // render path without a microphone - the mic only ever supplies cents
    // frames, so everything from cents to pixels under test is production code.
    _sim: {
      start: function () { if (mode !== 'guided') setMode('guided'); releaseMic(); if (!ensureFlow()) return null; simActive = true; flow.start(0); renderGuided(flow.state()); var t = el('micToggle'); if (t) t.textContent = 'Stop'; return flow.state(); },
      feed: function (cents, nowMs) { return applyFrame(cents, nowMs); },
      state: function () { return flow ? flow.state() : null; }
    }
  };

  // expose the pure DSP for Node unit tests (no DOM/mic needed)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.detectPitch = detectPitch;
    module.exports.detectPitchNear = detectPitchNear;
    module.exports.cancelDrone = cancelDrone;
    module.exports.nearestString = nearestString;
    module.exports.bandLimits = bandLimits;
    module.exports.needlePos = needlePos;
    module.exports.runwayPos = runwayPos;
    module.exports.isOutlier = isOutlier;
    module.exports.tuneHint = tuneHint;
    module.exports.median = median;
  }

})(typeof window !== 'undefined' ? window : this);
