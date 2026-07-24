/* =====================================================================
 * audio.test.js  -  the Karplus-Strong plucked-string DSP (ChordAudio.ksRender)
 *                    PLUS the keep-warm audio-focus state machine (tap
 *                    immediacy, PR "perf(audio): keep context warm...").
 * Run: node test/audio.test.js
 *
 * Two tiers of evidence:
 *   1. ksRender/scrapeRender/VoiceCache are pure math (Float32Array in/out,
 *      or plain key/LRU logic) - no WebAudio needed.
 *   2. The keep-warm state machine (keepWarm/releaseWarm/primeNow/
 *      visibilitychange) genuinely calls into a WebAudioContext-shaped
 *      object (ctx()/resume()/suspend()), so this file hand-rolls a MINIMAL
 *      fake AudioContext (state + counters, no real DSP) and a fake
 *      setTimeout/clearTimeout clock so the 20s idle-release / 1.8s
 *      close-grace windows can be proven WITHOUT a real 20-second test.
 *      Real-device latency itself stays a live/manual check (no audio
 *      device in Node) - what's proven here is the DECISION logic that
 *      makes taps immediate: which branch whenRunning takes, and exactly
 *      when the context is allowed to suspend.
 * ===================================================================== */
'use strict';
var assert = require('assert');

/* ---- fake WebAudio (state + call-counters only, no real DSP) ---------- */
function fakeAudioParam() {
  return {
    value: 0,
    setValueAtTime: function () { return this; },
    linearRampToValueAtTime: function () { return this; },
    exponentialRampToValueAtTime: function () { return this; }
  };
}
function fakeNode() {
  var target = {
    connect: function () { return target; },
    disconnect: function () {},
    start: function () {},
    stop: function () {},
    type: '',
    buffer: null,
    normalize: true,
    onended: null
  };
  // AudioParam-shaped fields (gain/frequency/Q/threshold/knee/ratio/attack/
  // release/playbackRate/...) auto-vivify as {value:...} on first touch -
  // avoids hand-listing every param name masterBus()/tone()/pluckKS() sets.
  return new Proxy(target, {
    get: function (t, prop) {
      if (prop in t) return t[prop];
      var p = fakeAudioParam();
      t[prop] = p;
      return p;
    },
    set: function (t, prop, v) { t[prop] = v; return true; }
  });
}
function makeFakeAudioContext() {
  var self = {
    state: 'suspended',
    sampleRate: 44100,
    currentTime: 0,
    destination: fakeNode(),
    resumeCalls: 0,
    suspendCalls: 0,
    bufferSourcesCreated: 0,
    oscillatorsCreated: 0,
    createOscillator: function () { self.oscillatorsCreated++; return fakeNode(); },
    createGain: function () { return fakeNode(); },
    createBiquadFilter: function () { return fakeNode(); },
    createDynamicsCompressor: function () { return fakeNode(); },
    createConvolver: function () { return fakeNode(); },
    createBufferSource: function () { self.bufferSourcesCreated++; return fakeNode(); },
    createBuffer: function (channels, length, sampleRate) {
      var chans = [];
      for (var i = 0; i < channels; i++) chans.push(new Float32Array(length));
      return { numberOfChannels: channels, length: length, sampleRate: sampleRate, getChannelData: function (ch) { return chans[ch]; } };
    },
    // Resolves SYNCHRONOUSLY inside the Promise executor - by spec the
    // executor runs synchronously at construction, so `state` flips to
    // 'running' before resume() even returns, but any `.then(cb)` attached
    // to the returned promise is still deferred to a microtask (never runs
    // synchronously) - exactly the real AudioContext.resume() contract this
    // needs to stand in for.
    resume: function () {
      self.resumeCalls++;
      return new Promise(function (resolve) { self.state = 'running'; resolve(); });
    },
    suspend: function () {
      self.suspendCalls++;
      self.state = 'suspended';
      return Promise.resolve();
    }
  };
  return self;
}
var fakeCtx = makeFakeAudioContext();
var visibilityHandler = null;
var fakeDocument = {
  hidden: false,
  addEventListener: function (type, fn) { if (type === 'visibilitychange') visibilityHandler = fn; }
};
global.window = { AudioContext: function () { return fakeCtx; } };
global.document = fakeDocument;

// audio.js attaches to `(typeof window !== 'undefined' ? window : this)` -
// now that a fake `window` is defined above (needed for ctx()/AudioContext),
// the module lands ChordAudio on window.ChordAudio, not on module.exports.
require('../music/shared/audio.js');
var ChordAudio = global.window.ChordAudio;

/* ---- fake clock (controls setTimeout/clearTimeout) --------------------
 * Installed globally for this whole file (never restored - the process
 * exits at the end of run()) so no real 20s/1.8s waits are ever needed,
 * and every timer audio.js schedules is 100% inspectable/advanceable. */
var __timers = [], __timerId = 1, __now = 0;
global.setTimeout = function (cb, ms) {
  var id = __timerId++;
  __timers.push({ id: id, at: __now + (ms || 0), cb: cb });
  return id;
};
global.clearTimeout = function (id) { __timers = __timers.filter(function (t) { return t.id !== id; }); };
function advanceClock(ms) {
  __now += ms;
  var due = __timers.filter(function (t) { return t.at <= __now; });
  __timers = __timers.filter(function (t) { return t.at > __now; });
  due.sort(function (a, b) { return a.at - b.at; });
  due.forEach(function (t) { t.cb(); });
}
function pendingTimerCount() { return __timers.length; }
// A real setImmediate flush (independent of the fake setTimeout above) - lets
// an async test wait for the microtask queue (resume().then(...)) to drain.
function flushMicrotasks() { return new Promise(function (resolve) { setImmediate(resolve); }); }
// Every stateful test starts from the SAME known-clean baseline, regardless
// of what a previous test left pending - this is what makes each test
// order-independent (no hidden inter-test coupling).
function resetFakeAudioForTest() {
  advanceClock(999999);                                  // fire any timer a prior test left pending
  while (ChordAudio.isWarm()) ChordAudio.releaseWarm();   // in case a prior test left it warm
  advanceClock(999999);                                  // fire the close-grace timer that loop may have just armed
  fakeCtx.state = 'suspended';
  fakeCtx.resumeCalls = 0;
  fakeCtx.suspendCalls = 0;
  fakeCtx.bufferSourcesCreated = 0;
  fakeCtx.oscillatorsCreated = 0;
  fakeDocument.hidden = false;
}

var SR = 44100;
var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
// run() supports a case fn that RETURNS A PROMISE (the async-resume-path
// test), alongside every plain synchronous case - same PASS/FAIL-line-per-
// case convention test/sound.test.js already established for this pattern.
function run() {
  var i = 0;
  function next() {
    if (i >= cases.length) {
      console.log('\n' + passed + ' passed, ' + failed + ' failed');
      process.exit(failed ? 1 : 0);
      return;
    }
    var c = cases[i++];
    try {
      var r = c[1]();
      if (r && typeof r.then === 'function') {
        r.then(function () { passed++; console.log('  ✓ ' + c[0]); next(); },
          function (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); next(); });
        return;
      }
      passed++; console.log('  ✓ ' + c[0]);
    } catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
    next();
  }
  next();
}

function energy(buf, a, b) { var e = 0; for (var i = a; i < b; i++) e += buf[i] * buf[i]; return e; }

test('module loads and exposes the real-feel engine surface', function () {
  assert.strictEqual(typeof ChordAudio, 'object', 'ChordAudio not exported');
  ['tone', 'strum', 'freqForString', 'ksRender', 'keepWarm', 'releaseWarm', 'isWarm', 'primeNow',
    'releaseFor', 'releaseGain'].forEach(function (k) {
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

/* ---- natural release envelope (UAT: "chord tail cuts off abruptly instead
 * of ringing out") -----------------------------------------------------
 * pluckKS used to play its buffer at a CONSTANT gain and rely only on
 * ksRender's own 40ms buffer-edge fade to end the note - well before the
 * physical KS decay had reached anywhere near silence, so it read as a hard
 * stop. The fix schedules a real exponential release on the top-level
 * GainNode (releaseFor/releaseGain, mirrored here as pure math since
 * WebAudioParam automation has no Node stand-in) and only stop()s once that
 * release has actually finished. These pin the envelope SHAPE - continuous
 * at the hold->release boundary, monotonically decreasing, inaudible by the
 * time playback is cut - i.e. prove there is no hard cutoff, quantitatively. */
test('releaseFor: longer for low/long-ringing strings, always within the natural-feel band', function () {
  var low = ChordAudio.releaseFor(82.41);   // low E
  var high = ChordAudio.releaseFor(659.25); // high E, two octaves up
  assert.ok(low > high, 'a low string should get a longer release than a high string (got ' + low + ' vs ' + high + ')');
  [82.41, 196, 440, 659.25, 1200].forEach(function (f) {
    var r = ChordAudio.releaseFor(f);
    assert.ok(r >= 0.3 && r <= 0.6, f + 'Hz release ' + r + 's outside the 0.3-0.6s natural-feel band');
  });
});

test('releaseGain: continuous at the hold->release boundary (no jump at the old cutoff instant)', function () {
  // A vanishingly small epsilon isolates CONTINUITY (the limit as elapsed ->
  // dur from either side must equal `gain`) from the release's normal decay
  // rate, which is legitimately fast in absolute-ms terms over a <=0.6s window.
  var dur = 1.6, freq = 196, gain = 0.15, eps = 1e-6;
  var justBefore = ChordAudio.releaseGain(dur - eps, dur, freq, gain);
  var atBoundary = ChordAudio.releaseGain(dur, dur, freq, gain);
  var justAfter = ChordAudio.releaseGain(dur + eps, dur, freq, gain);
  assert.strictEqual(atBoundary, gain, 'still at full gain exactly at the old hard-stop instant - the string keeps ringing, not cut');
  [justBefore, justAfter].forEach(function (v) {
    assert.ok(Math.abs(v - gain) / gain < 0.001, 'no jump at the sustain/release boundary (got ' + v + ' vs held gain ' + gain + ')');
  });
});

test('releaseGain: monotonically decreasing and inaudible by the moment stop() actually fires', function () {
  var dur = 1.6, freq = 196, gain = 0.15;
  var rel = ChordAudio.releaseFor(freq);
  var prev = ChordAudio.releaseGain(dur, dur, freq, gain);
  var steps = 40;
  for (var i = 1; i <= steps; i++) {
    var elapsed = dur + (rel * i / steps);
    var v = ChordAudio.releaseGain(elapsed, dur, freq, gain);
    assert.ok(v <= prev + 1e-9, 'release must never get LOUDER (step ' + i + ': ' + v + ' > ' + prev + ')');
    // Smooth, not steppy: no single increment should slam most of the way to
    // silence at once (a real cutoff is exactly a huge single-step drop).
    assert.ok(prev - v < gain * 0.35, 'release step ' + i + ' dropped too far at once (' + (prev - v).toFixed(4) + ') - reads as a cutoff, not a fade');
    prev = v;
  }
  // By the time pluckKS's stop() fires (relEnd + 0.05, i.e. AT relEnd here),
  // the gain has already reached the WebAudio-floor value - inaudible, so the
  // hard truncation lands on silence rather than on a still-ringing string.
  var atStop = ChordAudio.releaseGain(dur + rel, dur, freq, gain);
  assert.ok(atStop <= 0.0001 + 1e-9, 'gain at stop() time must already be at the near-silent floor, got ' + atStop);
});

test('the heard signal (ksRender x releaseGain) is far quieter at the new stop point than at the OLD hard-cutoff instant', function () {
  // Reconstructs what pluckKS actually plays: the same extended-length
  // ksRender buffer it renders, scaled sample-by-sample by the same top-level
  // envelope it schedules on the GainNode. Regression guard for the reported
  // defect: previously, amplitude at `dur` (the old stop point) was still a
  // large fraction of the raw string - now it should be, by design (release
  // hasn't started yet); the new stop point (dur+rel) must instead be the
  // quiet one.
  var dur = 1.5, freq = 196, gain = 0.15;
  var rel = ChordAudio.releaseFor(freq);
  var raw = ChordAudio.ksRender(SR, freq, dur + rel + 0.05, { brightness: 0.4 });
  function heardAt(seconds) {
    var i = Math.min(raw.length - 1, Math.round(seconds * SR));
    return raw[i] * ChordAudio.releaseGain(seconds, dur, freq, gain);
  }
  var atOldCutoff = Math.abs(heardAt(dur));
  var atNewStop = Math.abs(heardAt(dur + rel));
  assert.ok(atNewStop < atOldCutoff * 0.05 || atNewStop < 0.0001,
    'new stop point (' + atNewStop.toFixed(5) + ') should be far quieter than the old abrupt-cutoff instant (' + atOldCutoff.toFixed(5) + ')');
  // And a window right AT the new stop point should be near-silent throughout
  // (not just at one lucky sample) - prove the tail, not a single point.
  var win = Math.floor(SR * 0.01), peak = 0;
  for (var s = Math.round((dur + rel) * SR) - win; s < raw.length; s++) {
    if (s < 0) continue;
    var v = Math.abs(raw[s] * ChordAudio.releaseGain(s / SR, dur, freq, gain));
    peak = Math.max(peak, v);
  }
  assert.ok(peak < 0.001, 'the 10ms window around the actual stop point must be near-silent, peaked at ' + peak.toFixed(5));
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

/* =======================================================================
 * KEEP-WARM INVARIANTS (tap immediacy, PR "keep context warm...")
 * Operator-locked bar: "so we don't ever talk about it again." Each of
 * these is a SEPARATE test so a regression names exactly which guarantee
 * broke, not just "something in audio.js changed."
 * ===================================================================== */

test('keep-warm state machine: reference-counted, never goes negative', function () {
  resetFakeAudioForTest();
  assert.strictEqual(ChordAudio.isWarm(), false, 'starts cold');
  ChordAudio.keepWarm();
  assert.strictEqual(ChordAudio.isWarm(), true, 'warm after the first surface opens');
  ChordAudio.keepWarm(); // a second surface opens on top (e.g. the Studio overlay while Practice is still current)
  ChordAudio.releaseWarm();
  assert.strictEqual(ChordAudio.isWarm(), true, 'still warm - one opener remains open');
  ChordAudio.releaseWarm();
  assert.strictEqual(ChordAudio.isWarm(), false, 'cold once the LAST opener closes');
  ChordAudio.releaseWarm(); // a stray close on an already-closed surface
  assert.strictEqual(ChordAudio.isWarm(), false, 'a redundant releaseWarm() must never underflow past 0');
});

test('INVARIANT 1: while a chord surface is open, the context stays running PAST the idle-release threshold - it never suspends during active use', function () {
  resetFakeAudioForTest();
  ChordAudio.keepWarm();
  assert.strictEqual(fakeCtx.state, 'running', 'keepWarm() must eagerly resume the context, synchronously');
  ChordAudio.strum([0], [110], 1.0); // a note plays - this is what would normally re-arm the 20s idle-release timer
  assert.strictEqual(pendingTimerCount(), 0, 'no idle-release timer may be armed at all while a surface is warm');
  advanceClock(120000); // 2 minutes - far past IDLE_RELEASE_MS (20s) and the SURFACE_CLOSE_RELEASE_MS grace (1.8s)
  assert.strictEqual(fakeCtx.suspendCalls, 0, 'suspend() must NEVER fire while the surface is still open, no matter how long the clock runs');
  assert.strictEqual(fakeCtx.state, 'running', 'the context must still be running long after the idle window has passed');
  ChordAudio.releaseWarm();
});

test('INVARIANT 2: whenRunning takes the SYNCHRONOUS play(true) path while running - never calls resume()', function () {
  resetFakeAudioForTest();
  fakeCtx.state = 'running';
  ChordAudio.strum([0], [110], 1.0);
  assert.ok(fakeCtx.bufferSourcesCreated > 0, 'a running context must schedule its voice SYNCHRONOUSLY, within the same call - that IS the zero-latency path');
  assert.strictEqual(fakeCtx.resumeCalls, 0, 'a running context must never call resume() - resume() is the async-only branch');
});

test('CONTROL: whenRunning falls back to the ASYNC resume().then() path when suspended - proves the two branches are genuinely different', function () {
  resetFakeAudioForTest();
  fakeCtx.state = 'suspended';
  ChordAudio.strum([0], [110], 1.0);
  assert.strictEqual(fakeCtx.bufferSourcesCreated, 0, 'a suspended context must NOT schedule synchronously - it has to wait for resume() to settle first');
  return flushMicrotasks().then(function () {
    assert.strictEqual(fakeCtx.resumeCalls, 1, 'a suspended context must call resume() exactly once');
    assert.ok(fakeCtx.bufferSourcesCreated > 0, 'once resume() settles, the deferred note must have played');
  });
});

test('INVARIANT 3a: releaseWarm() suspends after the close grace once the LAST warm surface closes (nested opens hold focus)', function () {
  resetFakeAudioForTest();
  ChordAudio.keepWarm(); // surface 1 opens (e.g. Practice)
  ChordAudio.keepWarm(); // surface 2 opens on top (e.g. the Studio overlay)
  ChordAudio.releaseWarm(); // surface 2 closes
  advanceClock(60000);
  assert.strictEqual(fakeCtx.suspendCalls, 0, 'must stay held while surface 1 is still open');
  ChordAudio.releaseWarm(); // the LAST surface closes
  advanceClock(1799);
  assert.strictEqual(fakeCtx.suspendCalls, 0, 'must not suspend before the 1.8s close-grace window elapses (an in-flight strum must still ring out)');
  advanceClock(1);
  assert.strictEqual(fakeCtx.suspendCalls, 1, 'must suspend exactly once the close-grace window elapses');
  assert.strictEqual(fakeCtx.state, 'suspended', 'focus must actually be released, not just the timer firing');
});

test('INVARIANT 3b: visibilitychange -> hidden hard-releases IMMEDIATELY, regardless of warmCount, with zero grace', function () {
  resetFakeAudioForTest();
  ChordAudio.keepWarm();
  ChordAudio.keepWarm(); // two nested openers - hiding the tab must still release right away
  assert.strictEqual(fakeCtx.state, 'running');
  assert.ok(typeof visibilityHandler === 'function', 'audio.js must register a visibilitychange handler at load time');
  fakeDocument.hidden = true;
  visibilityHandler();
  assert.strictEqual(fakeCtx.suspendCalls, 1, 'hiding the tab must suspend immediately - no clock advance, no grace window');
  assert.strictEqual(fakeCtx.state, 'suspended');
  assert.strictEqual(ChordAudio.isWarm(), false, 'warm state must be cleared - a later foreground tap must not think it is still warm');
});

test('INVARIANT 4: primeNow() (the pointerdown eager-resume) resumes a suspended context, is a no-op once already running', function () {
  resetFakeAudioForTest();
  fakeCtx.state = 'suspended';
  ChordAudio.primeNow();
  assert.strictEqual(fakeCtx.resumeCalls, 1, 'primeNow() must call resume() when the context is suspended');
  ChordAudio.primeNow(); // already running now - the fake resume() flips state synchronously
  assert.strictEqual(fakeCtx.resumeCalls, 1, 'primeNow() must NOT re-call resume() once the context is already running');
});

// Strip comments before any wiring-lint regex match below. Without this, an
// explanatory comment that happens to mention "pointerdown" and "primeNow"
// (or "ChordAudio.keepWarm()") near each other - exactly what a comment
// EXPLAINING the wiring looks like - satisfies a proximity regex with the
// code it documents deleted. Verified failure mode, not theoretical: this
// test passed GREEN against the wiring literally removed until this strip
// was added (rules/evidence-integrity.md rule 4 - assert against code, not
// comments).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('INVARIANT 4b (wiring): every chord-interactive surface primes on pointerdown and keeps warm on open/close', function () {
  var fs = require('fs'), path = require('path');
  var songbookSrc = stripComments(fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'songbook.js'), 'utf8'));
  var tracksSrc = stripComments(fs.readFileSync(path.join(__dirname, '..', 'music', 'shared', 'tracks.js'), 'utf8'));
  // Exact call shape, not just "the two words appear somewhere nearby" -
  // a real addEventListener('pointerdown', ...) whose body calls primeNow().
  var POINTERDOWN_PRIME = /addEventListener\(\s*['"]pointerdown['"]\s*,\s*function\s*\(\s*\)\s*\{\s*window\.ChordAudio\.primeNow\(\);?\s*\}/;
  assert.ok(POINTERDOWN_PRIME.test(songbookSrc),
    'songbook.js (Practice/Stage + Compose) must wire a real addEventListener(pointerdown) that calls ChordAudio.primeNow() - not only mention it in a comment');
  assert.ok(POINTERDOWN_PRIME.test(tracksSrc),
    'tracks.js (the backing-track Studio) must wire a real addEventListener(pointerdown) that calls ChordAudio.primeNow() - not only mention it in a comment');
  assert.ok(/ChordAudio\.keepWarm\(\)/.test(songbookSrc), 'songbook.js must call ChordAudio.keepWarm() when a chord-interactive screen opens (code, not just a comment)');
  assert.ok(/ChordAudio\.releaseWarm\(\)/.test(songbookSrc), 'songbook.js must call ChordAudio.releaseWarm() when that screen closes (code, not just a comment)');
  assert.ok(/ChordAudio\.keepWarm\(\)/.test(tracksSrc), 'tracks.js must call ChordAudio.keepWarm() when the Studio opens (code, not just a comment)');
  assert.ok(/ChordAudio\.releaseWarm\(\)/.test(tracksSrc), 'tracks.js must call ChordAudio.releaseWarm() when the Studio closes (code, not just a comment)');
});

run();
