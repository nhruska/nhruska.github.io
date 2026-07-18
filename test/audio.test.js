/* =====================================================================
 * audio.test.js  -  the Karplus-Strong plucked-string DSP (ChordAudio.ksRender)
 * Run: node test/audio.test.js
 * No WebAudio needed: ksRender is pure math (Float32Array in/out), so we can
 * assert the physical-model properties that make it sound like a real string:
 * right length, finite, decaying, click-free ends, and the fundamental period
 * actually present in the waveform.
 * ===================================================================== */
'use strict';
var assert = require('assert');
var ChordAudio = require('../music/shared/audio.js').ChordAudio;

var SR = 44100;
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

function energy(buf, a, b) { var e = 0; for (var i = a; i < b; i++) e += buf[i] * buf[i]; return e; }

test('module loads and exposes the real-feel engine surface', function () {
  assert.strictEqual(typeof ChordAudio, 'object', 'ChordAudio not exported');
  ['tone', 'strum', 'freqForString', 'ksRender'].forEach(function (k) {
    assert.strictEqual(typeof ChordAudio[k], 'function', 'missing ChordAudio.' + k);
  });
});

test('renders the requested length as a Float32Array', function () {
  var b = ChordAudio.ksRender(SR, 220, 1.0);
  assert.ok(b instanceof Float32Array, 'not a Float32Array');
  // >= requested; ksRender floors to whole samples but never returns short.
  assert.ok(b.length >= Math.floor(SR * 1.0) - 1 && b.length <= SR * 1.0 + 2,
    'length ' + b.length + ' (expected ~' + SR + ')');
});

test('every sample is finite (no NaN / Inf from an unstable loop)', function () {
  var b = ChordAudio.ksRender(SR, 82.41, 1.6);   // low E, longest ring
  for (var i = 0; i < b.length; i++) assert.ok(Number.isFinite(b[i]), 'non-finite at ' + i);
});

test('output stays bounded (loop gain < 1, provably stable)', function () {
  [82.41, 146.83, 329.63, 659.25].forEach(function (f) {
    var b = ChordAudio.ksRender(SR, f, 2.0);
    var peak = 0; for (var i = 0; i < b.length; i++) peak = Math.max(peak, Math.abs(b[i]));
    assert.ok(peak <= 1.001, f + 'Hz peaked at ' + peak.toFixed(3) + ' (loop should not grow)');
  });
});

test('the string decays - the tail is far quieter than the attack', function () {
  var b = ChordAudio.ksRender(SR, 196, 1.5);
  var head = energy(b, 0, Math.floor(SR * 0.1));
  var tail = energy(b, b.length - Math.floor(SR * 0.1), b.length);
  assert.ok(tail < head * 0.5, 'tail energy ' + tail.toFixed(2) + ' not << head ' + head.toFixed(2));
});

test('low (wound) strings ring longer than high strings', function () {
  function sustain(f) {
    var b = ChordAudio.ksRender(SR, f, 2.0);
    var head = energy(b, 0, Math.floor(SR * 0.05)) || 1e-9;
    var late = energy(b, Math.floor(SR * 1.0), Math.floor(SR * 1.05));
    return late / head;                       // fraction of energy still ringing at 1s
  }
  assert.ok(sustain(82.41) > sustain(659.25),
    'low E should out-sustain high E (got ' + sustain(82.41).toExponential(2) + ' vs ' + sustain(659.25).toExponential(2) + ')');
});

test('both ends are click-free (faded to near zero)', function () {
  var b = ChordAudio.ksRender(SR, 220, 1.0);
  assert.ok(Math.abs(b[0]) < 0.02, 'start not faded: ' + b[0]);
  assert.ok(Math.abs(b[b.length - 1]) < 0.02, 'end not faded: ' + b[b.length - 1]);
});

test('the fundamental period is present (it plays the right pitch)', function () {
  // Autocorrelation at the true period should beat detuned lags by a clear
  // margin - i.e. the waveform actually repeats once per 1/freq, which is what
  // makes it a pitched string and not noise.
  var freq = 220, b = ChordAudio.ksRender(SR, freq, 0.5);
  var period = Math.round(SR / freq);
  function ac(lag) {
    var s = 0, N = Math.floor(SR * 0.2), off = Math.floor(SR * 0.05); // steady segment
    for (var i = 0; i < N; i++) s += b[off + i] * b[off + i + lag];
    return s;
  }
  var atP = ac(period);
  assert.ok(atP > ac(period + 7) && atP > ac(period - 7) && atP > 0,
    'no periodicity at the fundamental lag (' + period + ')');
});

test('brightness changes the attack spectrum (brighter = more HF energy)', function () {
  function hf(bri) {
    var b = ChordAudio.ksRender(SR, 196, 0.3, { brightness: bri });
    // crude HF measure: mean |first difference| over the attack
    var s = 0, N = Math.floor(SR * 0.02);
    for (var i = 1; i < N; i++) s += Math.abs(b[i] - b[i - 1]);
    return s / N;
  }
  assert.ok(hf(0.9) > hf(0.15), 'a brighter pick should have more high-frequency attack energy');
});

test('freqForString: 12 frets up is one octave', function () {
  assert.ok(Math.abs(ChordAudio.freqForString(110, 12) - 220) < 1e-9, 'octave math wrong');
});

/* ---- pick-scrape transient (ear-test round 3: "keyboard in the attack") ----
 * Round 2's static cabinet lowpass (2600Hz) darkens the ATTACK along with the
 * sustain - the onset reads felt-hammer, not pluck. The fix decouples them:
 * scrapeRender() is a short broadband transient rendered separately and
 * routed AROUND the tame filter (bus scrape input), so attack character and
 * sustain warmth get independent knobs. These pin the transient's physics. */
test('scrapeRender: a short, HF-dominant, decaying, click-free transient', function () {
  var ms = 7, b = ChordAudio.scrapeRender(SR, ms);
  assert.strictEqual(b.length, Math.round(SR * ms / 1000), 'length must match the requested ms');
  // HF-dominant: the first-difference energy ratio of a highpassed burst sits
  // WELL above the string's lowpassed excitation (~0.7 at strum brightness).
  var d = 0, e = 0;
  for (var i = 1; i < b.length; i++) { var df = b[i] - b[i - 1]; d += df * df; e += b[i] * b[i]; }
  assert.ok(e > 0 && d / e > 1.5, 'scrape must be HF-dominant (first-diff ratio > 1.5, got ' + (e ? (d / e).toFixed(2) : 'silent') + ')');
  // Decaying: the first third carries several times the energy of the last third.
  var third = Math.floor(b.length / 3), e1 = 0, e3 = 0;
  for (var j = 0; j < third; j++) { e1 += b[j] * b[j]; e3 += b[b.length - 1 - j] * b[b.length - 1 - j]; }
  assert.ok(e1 > e3 * 4, 'scrape must decay (first-third energy > 4x last-third)');
  // Click-free, bounded.
  assert.ok(Math.abs(b[0]) < 0.02 && Math.abs(b[b.length - 1]) < 0.02, 'scrape must ramp in and out (no edge clicks)');
  for (var k = 0; k < b.length; k++) assert.ok(b[k] >= -1 && b[k] <= 1 && isFinite(b[k]), 'scrape must stay bounded/finite');
});

test('scrape wiring: pluckKS fires the scrape through the bus scrape input (bypasses the tame lowpass)', function () {
  // Static wiring lint (WebAudio topology is unreachable from Node): the bus
  // must expose a scrapeIn that connects to the compressor NOT through `tame`,
  // and the pluck path must route a scrapeRender buffer into it.
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'audio.js'), 'utf8');
  assert.ok(/scrapeIn\.connect\(comp\)/.test(src), 'bus scrapeIn must connect straight to the compressor (around the tame filter)');
  assert.ok(/scrapeRender\(/.test(src.split('function pluckKS')[1] || ''), 'pluckKS must render + fire the scrape transient');
});

/* ---- tap-to-strum latency (UAT regression, live v187) --------------------
 * The KS engine re-rendered every string on every tap (synchronous, on the
 * UI thread) and kept a 20ms scheduling pad - a musician evaluating strums
 * feels the gap. The fix: an LRU voice cache keyed by SEMITONE + brightness
 * bucket, with per-tap micro-detune moved to playbackRate so nearby-detuned
 * taps HIT the cache instead of forcing a fresh render. These pin the pure
 * cache-key/LRU logic + the wiring. */
test('VoiceCache: nearby detunes share a key; different notes/brightness do not', function () {
  var VC = ChordAudio.VoiceCache;
  assert.strictEqual(typeof VC.key, 'function', 'VoiceCache.key missing');
  // +/-0.45% micro-detune (the strum jitter) must land on the SAME semitone key
  assert.strictEqual(VC.key(220, 0.49, 1.6), VC.key(220 * 1.0045, 0.49, 1.6), 'micro-detuned tap must hit the same key');
  assert.strictEqual(VC.key(220, 0.49, 1.6), VC.key(220 * 0.9955, 0.49, 1.6), 'micro-detuned tap must hit the same key (down)');
  // a semitone away is a different string pitch - different key
  assert.notStrictEqual(VC.key(220, 0.49, 1.6), VC.key(233.08, 0.49, 1.6), 'A vs A# must not collide');
  // brightness buckets: within a bucket same key, across buckets different
  assert.strictEqual(VC.key(220, 0.49, 1.6), VC.key(220, 0.51, 1.6), 'same 0.05 brightness bucket must share a key');
  assert.notStrictEqual(VC.key(220, 0.30, 1.6), VC.key(220, 0.60, 1.6), 'far-apart brightness must not collide');
});

test('VoiceCache: LRU stays bounded and evicts oldest', function () {
  var VC = ChordAudio.VoiceCache;
  var c = VC.create(3);
  c.put('a', 1); c.put('b', 2); c.put('c', 3);
  assert.strictEqual(c.get('a'), 1, 'hit refreshes recency');
  c.put('d', 4); // evicts b (a was refreshed)
  assert.strictEqual(c.get('b'), undefined, 'oldest entry must be evicted at the cap');
  assert.strictEqual(c.get('a'), 1); assert.strictEqual(c.get('c'), 3); assert.strictEqual(c.get('d'), 4);
  assert.ok(c.size() <= 3, 'cache must never exceed its cap');
});

test('latency wiring: detune rides playbackRate, the running-context pad is tight, idle release is evaluation-friendly', function () {
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'music', 'shared', 'audio.js'), 'utf8');
  assert.ok(/playbackRate\.value\s*=/.test(src), 'per-tap detune must apply via playbackRate (so the cache can hit), not by re-rendering at a detuned freq');
  assert.ok(/IDLE_RELEASE_MS\s*=\s*20000/.test(src), 'idle release must be 20s - a musician evaluating strums taps sparsely; 4s made every listen re-pay the context resume');
  assert.ok(/wasRunning \? 0\.006 : 0\.02/.test(src), 'the already-running scheduling pad must be 6ms (20ms was audible); the just-resumed path keeps the generous pad');
});

run();
