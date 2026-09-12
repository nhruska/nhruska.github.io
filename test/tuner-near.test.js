/* =====================================================================
 * tuner-near.test.js  -  guided-mode DSP: cents from a KNOWN string
 * Run: node test/tuner-near.test.js
 * No microphone needed. Pins the two measured defects behind "the mic mode
 * is buggy" (docs/plans/design-tuner-goal-flow-20260912.md, 2a + 2b):
 *   1. identification is the wrong job - detectPitchNear excludes both
 *      octaves by construction, and a NARROW band on the old detectPitch
 *      returns -1 on a clean low E (the gotcha that makes it exist);
 *   2. the drone pulls the reading toward "in tune" - cancelDrone subtracts
 *      the app's own reference tone before detection.
 * Every threshold below was MEASURED first (tools/tuner-lab.js and a
 * measurement pass on this file's own synth), then asserted with margin.
 * ===================================================================== */
'use strict';
var assert = require('assert');
var T = require('../music/shared/tuner.js');

var SR = 44100, N = 4096;

// a plucked-string-ish tone: fundamental + a few decaying harmonics
// (same shape as test/tuner.test.js synth(), plus an optional phase offset)
function synth(freq, opts) {
  opts = opts || {};
  var harm = opts.harmonics || [1, 0.45, 0.25, 0.12];
  var noise = opts.noise || 0, amp = opts.amp == null ? 0.6 : opts.amp, phase = opts.phase || 0;
  var b = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    var s = 0;
    for (var h = 0; h < harm.length; h++) s += harm[h] * Math.sin(2 * Math.PI * freq * (h + 1) * i / SR + phase * (h + 1));
    if (noise) s += noise * (Math.random() * 2 - 1);
    b[i] = amp * s;
  }
  return b;
}
// the app's drone: sine + triangle at the same freq (startDrone), equal weight
// (mirrors tools/tuner-lab.js drone())
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
function cents(f, ref) { return 1200 * Math.log2(f / ref); }
function shift(f, c) { return f * Math.pow(2, c / 1200); }
function checksum(b) { var s = 0; for (var i = 0; i < b.length; i++) s += b[i] * (i + 1); return s; }
function fmt(r, ref) { return r.freq > 0 ? cents(r.freq, ref).toFixed(2) + 'c (' + r.freq.toFixed(2) + 'Hz, clarity ' + r.clarity.toFixed(2) + ')' : 'nothing'; }

var GUITAR = [
  { n: 'E', l: '6th', f: 82.41 }, { n: 'A', l: '5th', f: 110.00 }, { n: 'D', l: '4th', f: 146.83 },
  { n: 'G', l: '3rd', f: 196.00 }, { n: 'B', l: '2nd', f: 246.94 }, { n: 'E', l: '1st', f: 329.63 }
];

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  PASS ' + c[0]); }
    catch (e) { failed++; console.log('  FAIL ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

// ---- 1. every open string, known target, no octave error (measured |err| < 0.01c) ----
GUITAR.forEach(function (s) {
  test('detectPitchNear: ' + s.n + ' (' + s.l + ', ' + s.f + 'Hz) at 0c reads within 2c, no octave error', function () {
    var r = T.detectPitchNear(synth(s.f), SR, s.f);
    assert.ok(r.freq > 0, 'no pitch found');
    assert.ok(Math.abs(cents(r.freq, s.f)) < 2, 'read ' + fmt(r, s.f));
    assert.ok(r.clarity > 0.9 && r.clarity <= 1, 'clarity ' + r.clarity);
  });
});

// ---- 2. detuned A: the read IS the detuning (measured |err| < 0.01c) ----
[-30, -15, -8, -4, 3].forEach(function (c) {
  test('detectPitchNear: A string at ' + c + 'c reads within 2c of ' + c + 'c', function () {
    var r = T.detectPitchNear(synth(shift(110, c)), SR, 110);
    assert.ok(r.freq > 0, 'no pitch found');
    assert.ok(Math.abs(cents(r.freq, 110) - c) < 2, 'read ' + fmt(r, 110));
  });
});

// ---- 3. dominant 2nd harmonic: the octave-up peak at T/2 is outside the window ----
test('detectPitchNear: low E with a DOMINANT 2nd harmonic reads the fundamental within 3c (measured -0.002c)', function () {
  var r = T.detectPitchNear(synth(82.41, { harmonics: [0.25, 1.0, 0.5, 0.3, 0.15] }), SR, 82.41);
  assert.ok(r.freq > 0, 'no pitch found');
  assert.ok(Math.abs(cents(r.freq, 82.41)) < 3, 'read ' + fmt(r, 82.41) + ' - octave-jumped?');
});

// ---- 4. the narrow-band gotcha: WHY detectPitchNear exists ----
// detectPitch's key-maxima scan skips everything before the first negative
// zero-crossing; a band narrowed to -500..+300c around low E STARTS inside
// the fundamental's own positive lobe, so it finds no peak at all and
// returns -1 on a clean fundamental-heavy tone (lab E1, row 1:0.45).
test('narrow-band gotcha: OLD detectPitch banded -500..+300c around low E returns -1 on a clean low E', function () {
  var e = synth(82.41);
  var old = T.detectPitch(e, SR, shift(82.41, -500), shift(82.41, 300));
  assert.strictEqual(old.freq, -1, 'old detectPitch read ' + fmt(old, 82.41) + ' - the gotcha no longer reproduces; re-measure before trusting this pin');
  assert.strictEqual(old.clarity, 0);
});
test('narrow-band gotcha: detectPitchNear reads the SAME low E buffer within 2c', function () {
  var r = T.detectPitchNear(synth(82.41), SR, 82.41);
  assert.ok(r.freq > 0 && Math.abs(cents(r.freq, 82.41)) < 2, 'read ' + fmt(r, 82.41));
});

// ---- 5. out of window: a different string is NOT this string ----
test('out-of-window: a D string (+500c) fed with target A returns -1', function () {
  var r = T.detectPitchNear(synth(146.83), SR, 110);
  assert.strictEqual(r.freq, -1, 'read ' + fmt(r, 110) + ' - should have been out of window');
  assert.strictEqual(r.clarity, 0);
});
// Sub-harmonic guard: a G string (+998c from A) is far outside the window, but
// TWO of its periods (~450 samples) land inside A's lag window, so without a
// guard the detector reads G's sub-octave (~98Hz, -200c) - a wrong-string
// pluck would show as a huge flat. The guard sees the comparable peak near
// half that lag and reports nothing instead.
test('out-of-window: a G string fed with target A returns -1 (sub-harmonic guard, not a -200c read)', function () {
  var r = T.detectPitchNear(synth(196.00), SR, 110);
  assert.strictEqual(r.freq, -1, 'read ' + fmt(r, 110) + ' - the sub-octave alias leaked through');
});
test('sub-harmonic guard: a high E (4-5 periods per low-E period) fed with target low E returns -1', function () {
  var r = T.detectPitchNear(synth(329.63), SR, 82.41);
  assert.strictEqual(r.freq, -1, 'read ' + fmt(r, 82.41) + ' - a wrong-string octave leaked through');
});
test('sub-harmonic guard does not eat a real target note with a dominant 2nd harmonic', function () {
  var r = T.detectPitchNear(synth(82.41, { harmonics: [0.25, 1.0, 0.5, 0.3, 0.15] }), SR, 82.41);
  assert.ok(r.freq > 0 && Math.abs(cents(r.freq, 82.41)) < 3, 'read ' + fmt(r, 82.41));
});


// ---- 6. silence and near-silence: prefer no reading over a wrong one ----
test('silence (all zeros) returns freq -1, clarity 0', function () {
  var r = T.detectPitchNear(new Float32Array(N), SR, 110);
  assert.strictEqual(r.freq, -1); assert.strictEqual(r.clarity, 0);
});
test('near-silence (0.001 noise, below the 0.01 RMS floor) returns freq -1, clarity 0', function () {
  var b = new Float32Array(N); for (var i = 0; i < N; i++) b[i] = 0.001 * (Math.random() * 2 - 1);
  var r = T.detectPitchNear(b, SR, 110);
  assert.strictEqual(r.freq, -1); assert.strictEqual(r.clarity, 0);
});

// ---- 7. drone pull - the operator's bug, and its cure ----
// A flat A string under the app's drone at 4x its amplitude: the plain read
// is pulled toward the louder drone (lab: -8c reads -2.8c and shows GREEN;
// measured here -2.9c). After cancelDrone the read comes back (lab -6.3c,
// measured here -6.9c; -30c: lab plain -10.1c / cancelled -27.4c, measured
// here -10.2c / -28.0c).
function dronePull(c) {
  var s = synth(shift(110, c), { harmonics: [1, 0.5, 0.3, 0.15], amp: 0.4, phase: 0.3 });
  var m = mix(s, drone(110, 1.6));
  return { plain: T.detectPitchNear(m, SR, 110), cancelled: T.detectPitchNear(T.cancelDrone(m, SR, 110), SR, 110) };
}
test('drone pull: -8c A string under a 4x drone - PLAIN read lies (closer to 0 than -4c)', function () {
  var r = dronePull(-8).plain;
  assert.ok(r.freq > 0, 'no pitch found');
  assert.ok(cents(r.freq, 110) > -4, 'plain read ' + fmt(r, 110) + ' - the pull no longer reproduces; re-measure');
});
test('drone pull: -8c A string under a 4x drone - after cancelDrone reads within 2.5c of -8c', function () {
  var r = dronePull(-8).cancelled;
  assert.ok(r.freq > 0, 'no pitch found');
  assert.ok(Math.abs(cents(r.freq, 110) - (-8)) < 2.5, 'cancelled read ' + fmt(r, 110));
});
test('drone pull: -30c A string under a 4x drone - PLAIN read lies (closer to 0 than -20c)', function () {
  var r = dronePull(-30).plain;
  assert.ok(r.freq > 0, 'no pitch found');
  assert.ok(cents(r.freq, 110) > -20, 'plain read ' + fmt(r, 110) + ' - the pull no longer reproduces; re-measure');
});
test('drone pull: -30c A string under a 4x drone - after cancelDrone reads within 3.5c of -30c', function () {
  var r = dronePull(-30).cancelled;
  assert.ok(r.freq > 0, 'no pitch found');
  assert.ok(Math.abs(cents(r.freq, 110) - (-30)) < 3.5, 'cancelled read ' + fmt(r, 110));
});

// ---- 8. cancelDrone returns a NEW buffer and never mutates its input ----
test('cancelDrone returns a different Float32Array instance and leaves the input byte-identical', function () {
  var b = synth(110), before = checksum(b);
  var o = T.cancelDrone(b, SR, 110);
  assert.ok(o instanceof Float32Array, 'not a Float32Array');
  assert.notStrictEqual(o, b, 'returned the input instance');
  assert.strictEqual(o.length, b.length);
  assert.strictEqual(checksum(b), before, 'input buffer was mutated');
});

// ---- 9. cancelDrone must not damage a clean signal (measured delta < 0.08c) ----
test('cancelDrone on a string with NO drone changes the read by less than 1c (every open string)', function () {
  GUITAR.forEach(function (s) {
    var b = synth(s.f);
    var a = T.detectPitchNear(b, SR, s.f), c = T.detectPitchNear(T.cancelDrone(b, SR, s.f), SR, s.f);
    assert.ok(a.freq > 0 && c.freq > 0, s.n + ': lost the pitch');
    var d = Math.abs(cents(c.freq, s.f) - cents(a.freq, s.f));
    assert.ok(d < 1, s.n + ' (' + s.l + '): cancelDrone moved the read by ' + d.toFixed(3) + 'c');
  });
});
test('cancelDrone on a -8c A string with NO drone changes the read by less than 1c (measured 0.08c)', function () {
  var b = synth(shift(110, -8));
  var a = T.detectPitchNear(b, SR, 110), c = T.detectPitchNear(T.cancelDrone(b, SR, 110), SR, 110);
  var d = Math.abs(cents(c.freq, 110) - cents(a.freq, 110));
  assert.ok(d < 1, 'cancelDrone moved the read by ' + d.toFixed(3) + 'c');
});

run();
