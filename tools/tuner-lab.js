/* =====================================================================
 * tools/tuner-lab.js  -  offline experiments against the REAL detector
 * Run: node tools/tuner-lab.js
 * Reproduces the three tuner complaints with synthesized signals and
 * measures candidate fixes. No mic needed. Evidence for
 * docs/plans/design-tuner-goal-flow-20260912.md - re-run before trusting
 * any number quoted there.
 * ===================================================================== */
'use strict';
var T = require('../music/shared/tuner.js');
var SR = 44100, N = 4096;
var GUITAR = [
  { n: 'E', l: '6th', f: 82.41 }, { n: 'A', l: '5th', f: 110.00 }, { n: 'D', l: '4th', f: 146.83 },
  { n: 'G', l: '3rd', f: 196.00 }, { n: 'B', l: '2nd', f: 246.94 }, { n: 'E', l: '1st', f: 329.63 }
];
var FREE = T.bandLimits(GUITAR);
function cents(f, ref) { return 1200 * Math.log2(f / ref); }
function shift(f, c) { return f * Math.pow(2, c / 1200); }
// string tone: fundamental + harmonics (amplitudes), optional inharmonicity B
function string(freq, harm, amp, B, phase) {
  var b = new Float32Array(N); B = B || 0; phase = phase || 0;
  for (var i = 0; i < N; i++) {
    var s = 0, t = i / SR;
    for (var h = 0; h < harm.length; h++) { var k = h + 1, fk = freq * k * Math.sqrt(1 + B * k * k); s += harm[h] * Math.sin(2 * Math.PI * fk * t + phase * k); }
    b[i] = amp * s;
  }
  return b;
}
// the app's drone: sine + triangle at the same freq (startDrone), equal weight
function drone(freq, amp) {
  var b = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    var t = i / SR, ph = (freq * t) % 1;
    var tri = 4 * Math.abs(ph - 0.5) - 1;
    b[i] = amp * (Math.sin(2 * Math.PI * freq * t) + tri) / 2;
  }
  return b;
}
function mix(a, b) { var o = new Float32Array(N); for (var i = 0; i < N; i++) o[i] = a[i] + b[i]; return o; }
// targeted band: the guided flow knows the string, so search only around it
function targetBand(f) { return { fmin: shift(f, -500), fmax: shift(f, 300) }; }
// candidate fix: subtract the KNOWN drone by least-squares projection onto
// sin/cos at f0 and its triangle odd harmonics (3f0, 5f0)
function cancelDrone(buf, f0) {
  var out = Float32Array.from(buf);
  [1, 3, 5].forEach(function (k) {
    var w = 2 * Math.PI * f0 * k / SR, ss = 0, sc = 0, cs = 0, cc = 0, xs = 0, xc = 0, i;
    for (i = 0; i < N; i++) { var s = Math.sin(w * i), c = Math.cos(w * i); ss += s * s; sc += s * c; cc += c * c; xs += out[i] * s; xc += out[i] * c; }
    var det = ss * cc - sc * sc; if (!det) return;
    var A = (xs * cc - xc * sc) / det, Bc = (xc * ss - xs * sc) / det;
    for (i = 0; i < N; i++) out[i] -= A * Math.sin(w * i) + Bc * Math.cos(w * i);
  });
  return out;
}

// PROPOSED guided-mode detector: NSDF over lags [T/2.5 .. 1.4T] (so the lag-0
// lobe and its first negative crossing are inside the search), then pick the
// STRONGEST key maximum whose lag sits inside the target window
// [T*2^(-300/1200) .. T*2^(+500/1200)] (i.e. freq within -500..+300 cents of
// the string). Both octaves fall OUTSIDE that window by construction, so no
// first-peak rule and no note identification are needed - the read is
// "cents from THIS string", nothing else. Seed for tuner.js detectPitchNear().
function detectPitchNear(buf, sr, fT) {
  var n = buf.length, i, lag, rms = 0;
  for (i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < 0.01) return { freq: -1, clarity: 0 };
  var T0 = sr / fT, minLag = Math.max(2, Math.floor(T0 / 2.5)), maxLag = Math.min(n - 2, Math.ceil(T0 * 1.4));
  var loLag = T0 * Math.pow(2, -300 / 1200), hiLag = T0 * Math.pow(2, 500 / 1200);
  var nsdf = new Float64Array(maxLag + 2);
  for (lag = minLag; lag <= maxLag; lag++) {
    var ac = 0, m = 0;
    for (i = 0; i < n - lag; i++) { var a = buf[i], b = buf[i + lag]; ac += a * b; m += a * a + b * b; }
    nsdf[lag] = m > 0 ? (2 * ac / m) : 0;
  }
  var best = null, curMax = -1, curLag = -1, positive = false;
  for (lag = minLag; lag <= maxLag; lag++) {
    var v = nsdf[lag];
    if (!positive) { if (v > 0) { positive = true; curMax = v; curLag = lag; } }
    else {
      if (v > curMax) { curMax = v; curLag = lag; }
      if (v <= 0 || lag === maxLag) { if (curLag >= loLag && curLag <= hiLag && (!best || curMax > best.val)) best = { lag: curLag, val: curMax }; positive = false; curMax = -1; }
    }
  }
  if (!best) return { freq: -1, clarity: 0 };
  var L = best.lag, y1 = nsdf[L - 1] || 0, y2 = nsdf[L], y3 = nsdf[L + 1] || 0, den = y1 - 2 * y2 + y3;
  if (den) L = L + 0.5 * (y1 - y3) / den;
  return { freq: sr / L, clarity: Math.max(0, Math.min(1, best.val)) };
}
function det(buf, band) { return T.detectPitch(buf, SR, band.fmin, band.fmax); }
function fmt(x, d) { return (x == null || !isFinite(x)) ? '-' : x.toFixed(d == null ? 1 : d); }
function row() { console.log('| ' + Array.prototype.slice.call(arguments).join(' | ') + ' |'); }

console.log('# tuner-lab results (' + new Date().toISOString().slice(0, 10) + ')\n');

/* ---- E1: free-mode identification on a real-ish low E ----
 * Acoustic low E: the fundamental is WEAK on a small-bodied guitar / phone mic
 * (body resonance sits ~100-200Hz); the 2nd harmonic dominates early in the
 * pluck. Sweep the fundamental:2nd ratio and see what the FREE detector names. */
console.log('## E1 - free-mode note identification, low E 82.41 Hz, varying 2nd-harmonic dominance\n');
row('fund:2nd', 'free freq', 'free clarity', 'names string', 'NARROW-band detectPitch (gotcha)', 'detectPitchNear cents err');
[[1, 0.45], [1, 0.8], [1, 1.0], [0.8, 1.0], [0.6, 1.0], [0.4, 1.0], [0.25, 1.0]].forEach(function (r) {
  var harm = [r[0], r[1], 0.5, 0.3, 0.15];
  var s = string(82.41, harm, 0.5, 0.0002);
  var free = det(s, FREE), tgt = det(s, targetBand(82.41)), near = detectPitchNear(s, SR, 82.41);
  var name = free.freq > 0 ? T.nearestString(free.freq, GUITAR) : null;
  row(r[0] + ':' + r[1], fmt(free.freq), fmt(free.clarity, 2), name ? name.n + ' (' + name.l + ')' : '-', fmt(tgt.freq), fmt(cents(near.freq, 82.41), 2));
});

/* ---- E1b: a decaying pluck as a frame sequence ----
 * Attack = harmonics hot; decay = highs die faster. Count frames the FREE
 * detector would send to the smoothing chain with the WRONG string name. */
console.log('\n## E1b - 60-frame pluck decay, low E (harmonics decay faster than the fundamental)\n');
(function () {
  var wrongFree = 0, wrongTgt = 0, errs = [];
  for (var fr = 0; fr < 60; fr++) {
    var t = fr / 60, hi = Math.exp(-3.5 * t), lo = Math.exp(-1.2 * t);
    var harm = [0.55 * lo, 1.0 * hi, 0.7 * hi, 0.4 * hi, 0.2 * hi];
    var s = string(82.41, harm, 0.5, 0.0002, fr * 0.7);
    var free = det(s, FREE), tgt = detectPitchNear(s, SR, 82.41);
    if (free.freq > 0 && free.clarity > 0.72 && T.nearestString(free.freq, GUITAR).f !== 82.41) wrongFree++;
    if (tgt.freq > 0 && Math.abs(cents(tgt.freq, 82.41)) > 5) wrongTgt++;
    if (tgt.freq > 0) errs.push(Math.abs(cents(tgt.freq, 82.41)));
  }
  errs.sort(function (a, b) { return a - b; });
  row('mode', 'frames naming the WRONG string / 60', 'median abs cents err');
  row('free (identify)', wrongFree, '-');
  row('targeted (known string)', wrongTgt + ' (>5c)', fmt(errs[errs.length >> 1], 2));
})();

/* ---- E3: drone + string through the mic ----
 * The user reports: quiet drone = beats audible + needle ok; loud drone =
 * needle reads "in tune" while the string is flat. Measure it. */
console.log('\n## E3 - drone (sine+tri at A 110 Hz) mixed with a FLAT A string, detector error in cents\n');
row('string cents', 'drone/string amp', 'free-band reads', 'detectPitchNear reads', 'detectPitchNear + cancelDrone reads');
[-30, -15, -8, -4, -2, 0, 3].forEach(function (c) {
  [0.25, 1, 4].forEach(function (ratio) {
    var s = string(shift(110, c), [1, 0.5, 0.3, 0.15], 0.4, 0.0001, 0.3);
    var d = drone(110, 0.4 * ratio);
    var m = mix(s, d);
    var free = det(m, FREE), tgt = detectPitchNear(m, SR, 110), can = detectPitchNear(cancelDrone(m, 110), SR, 110);
    row(c, ratio, fmt(cents(free.freq, 110)) + 'c', fmt(cents(tgt.freq, 110)) + 'c', fmt(cents(can.freq, 110)) + 'c (clar ' + fmt(can.clarity, 2) + ')');
  });
});

/* ---- E4: beat rate from the envelope - the thing the user HEARS ----
 * |f_string - f_drone| Hz. 1 beat/s at A110 = 15.7 cents. */
console.log('\n## E4 - beat period math (what the ear tracks), for reference\n');
row('string', 'cents flat', 'beats per second');
GUITAR.forEach(function (s) { [10, 5, 2, 1].forEach(function (c) { row(s.n + ' ' + s.f, -c, fmt(s.f - shift(s.f, -c), 2)); }); });

module.exports = { detectPitchNear: detectPitchNear, cancelDrone: cancelDrone };
