/* =====================================================================
 * tuner.test.js  -  pitch-detection accuracy for the mic tuner
 * Run: node test/tuner.test.js
 * No microphone needed: we synthesize string tones (pure, with harmonics,
 * detuned, noisy) and assert the detector lands on the right pitch with NO
 * octave errors — the bug that made it "not recognize the strings".
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tuner.js');

var SR = 44100, N = 4096;

// a plucked-string-ish tone: fundamental + a few decaying harmonics
function synth(freq, opts) {
  opts = opts || {};
  var harm = opts.harmonics || [1, 0.45, 0.25, 0.12];
  var noise = opts.noise || 0, amp = opts.amp == null ? 0.6 : opts.amp;
  var b = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    var s = 0;
    for (var h = 0; h < harm.length; h++) s += harm[h] * Math.sin(2 * Math.PI * freq * (h + 1) * i / SR);
    if (noise) s += noise * (Math.random() * 2 - 1);
    b[i] = amp * s;
  }
  return b;
}
function cents(f, ref) { return 1200 * Math.log2(f / ref); }

var GUITAR = [
  { n: 'E', l: '6th', f: 82.41 }, { n: 'A', l: '5th', f: 110.00 }, { n: 'D', l: '4th', f: 146.83 },
  { n: 'G', l: '3rd', f: 196.00 }, { n: 'B', l: '2nd', f: 246.94 }, { n: 'E', l: '1st', f: 329.63 }
];
var BAND = T.bandLimits(GUITAR), FMIN = BAND.fmin, FMAX = BAND.fmax; // the real guitar search band

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

// every open string, with realistic harmonics, detected within 8 cents and NO octave error
GUITAR.forEach(function (s) {
  test('detects ' + s.n + ' (' + s.l + ', ' + s.f + 'Hz) within 8 cents, no octave error', function () {
    var r = T.detectPitch(synth(s.f), SR, FMIN, FMAX);
    assert.ok(r.freq > 0, 'no pitch found');
    var err = Math.abs(cents(r.freq, s.f));
    assert.ok(err < 8, 'off by ' + err.toFixed(1) + ' cents (got ' + r.freq.toFixed(2) + 'Hz)');
  });
});

test('octave trap: a 2nd-harmonic-heavy low E stays at 82Hz (not 164)', function () {
  var r = T.detectPitch(synth(82.41, { harmonics: [0.6, 1.0, 0.3] }), SR, FMIN, FMAX);
  assert.ok(Math.abs(cents(r.freq, 82.41)) < 12, 'octave-jumped to ' + r.freq.toFixed(1) + 'Hz');
});

test('detuned A (+30 cents) reads ~ +30 cents off the A string', function () {
  var detuned = 110 * Math.pow(2, 30 / 1200);
  var r = T.detectPitch(synth(detuned), SR, FMIN, FMAX);
  assert.ok(Math.abs(cents(r.freq, 110) - 30) < 6, 'read ' + cents(r.freq, 110).toFixed(1) + ' cents');
});

test('nearestString maps a detected freq to the right open string', function () {
  assert.strictEqual(T.nearestString(245, GUITAR).n, 'B');
  assert.strictEqual(T.nearestString(85, GUITAR).l, '6th');     // low E, not octave-confused
  assert.strictEqual(T.nearestString(200, GUITAR).n, 'G');
});

test('silence / room tone returns no pitch (clarity gate)', function () {
  var quiet = synth(110, { amp: 0.002, noise: 0.004 });   // below RMS floor
  assert.strictEqual(T.detectPitch(quiet, SR, FMIN, FMAX).freq, -1);
});

test('noisy but real pluck still detects the fundamental', function () {
  var r = T.detectPitch(synth(146.83, { noise: 0.08 }), SR, FMIN, FMAX);
  assert.ok(r.freq > 0 && Math.abs(cents(r.freq, 146.83)) < 12, 'got ' + (r.freq > 0 ? r.freq.toFixed(1) + 'Hz' : 'nothing'));
});

test('clarity is high for a clean tone, returned 0..1', function () {
  var r = T.detectPitch(synth(196), SR, FMIN, FMAX);
  assert.ok(r.clarity > 0.8 && r.clarity <= 1.0001, 'clarity ' + r.clarity);
});

// ---- band-edge fixes (the two review findings) ----
test('bandLimits gives ~9 semitones of FLAT headroom below the lowest string', function () {
  var b = T.bandLimits(GUITAR);
  assert.ok(b.fmin <= 82.41 * Math.pow(2, -6 / 12), 'fmin ' + b.fmin.toFixed(1) + ' — not enough flat headroom');
});
test('a badly-flat low E (-3 semitones) reads ~that pitch, not pinned to the edge', function () {
  var f = 82.41 * Math.pow(2, -3 / 12); // ~69.3 Hz
  var r = T.detectPitch(synth(f), SR, FMIN, FMAX);
  assert.ok(r.freq > 0 && r.clarity > 0.9 && Math.abs(cents(r.freq, f)) < 12,
    'read ' + (r.freq > 0 ? r.freq.toFixed(1) + 'Hz @ clarity ' + r.clarity.toFixed(2) : 'nothing'));
});
test('high tone (500Hz) reads 500, not an octave low (high-edge first-peak fix)', function () {
  var r = T.detectPitch(synth(500), SR, FMIN, FMAX);
  assert.ok(Math.abs(cents(r.freq, 500)) < 15, 'read ' + r.freq.toFixed(1) + 'Hz (octave-low cliff?)');
});
test('out-of-band rumble (40Hz, below the band) fails safe — gated, not a confident wrong note', function () {
  var r = T.detectPitch(synth(40, { harmonics: [1] }), SR, FMIN, FMAX);
  assert.ok(r.clarity < 0.9, 'clarity ' + r.clarity.toFixed(3) + ' would pass the gate and mislead');
});

// ---- zoomed needle mapping (the "blind near zero" fix) ----
test('needlePos: 0¢ dead centre, full-scale at ±50¢, clamped beyond', function () {
  assert.strictEqual(T.needlePos(0), 50);
  assert.strictEqual(T.needlePos(50), 100);
  assert.strictEqual(T.needlePos(-50), 0);
  assert.strictEqual(T.needlePos(120), 100);
  assert.strictEqual(T.needlePos(-120), 0);
});
test('needlePos: the in-tune zone (±3¢) maps to centre ±12%', function () {
  assert.ok(Math.abs(T.needlePos(3) - 62) < 0.01, 'got ' + T.needlePos(3));
  assert.ok(Math.abs(T.needlePos(-3) - 38) < 0.01, 'got ' + T.needlePos(-3));
});
test('needlePos: a few cents is a BIG visible move (not a pixel)', function () {
  // the whole point: ±5¢ should swing the needle clearly off centre (>15%),
  // where the old linear ±50¢ map moved it only ~5%
  assert.ok(Math.abs(T.needlePos(5) - 50) >= 15, '5¢ only moved to ' + T.needlePos(5));
  // monotonic + symmetric near centre
  assert.ok(T.needlePos(2) > T.needlePos(1) && T.needlePos(1) > T.needlePos(0));
  assert.ok(Math.abs((T.needlePos(7) - 50) + (T.needlePos(-7) - 50)) < 1e-9);
});

// ---- outlier rejection (the "needle jumps away while honing in" fix) ----
test('isOutlier: an octave/harmonic blip is rejected, a few-cents wobble is kept', function () {
  assert.strictEqual(T.isOutlier(220, 110, 70), true);   // octave up — glitch
  assert.strictEqual(T.isOutlier(55, 110, 70), true);    // octave down — glitch
  assert.strictEqual(T.isOutlier(111, 110, 70), false);  // ~16¢ wobble — real, keep
  assert.strictEqual(T.isOutlier(110.3, 110, 70), false);// dead on — keep
});
test('isOutlier: no running estimate yet means nothing is a glitch', function () {
  assert.strictEqual(T.isOutlier(440, 0, 70), false);
  assert.strictEqual(T.isOutlier(440, -1, 70), false);
});

run();
