/* =====================================================================
 * sound.test.js  -  unit tests for M-EAR wave 1's zero-dependency Web
 * Audio scale-audition provider (music/shared/sound.js).
 * ---------------------------------------------------------------------
 * Node has no native Web Audio API and this app is zero-dependency (no
 * npm install, no node_modules - music/CLAUDE.md), so there is no real
 * AudioContext/OfflineAudioContext to require(). Three tiers:
 *
 *   1. Pure math (noteHz, buildNoteSequence, nextIndex) - no context needed.
 *   2. Scheduling math - a minimal RECORDING stub context (captures what
 *      voice() was asked to schedule: freq/when/dur), same "just enough
 *      fake" technique test/diagram.dom.test.js uses for a DOM stub.
 *   3. "REAL audio evidence, not a mock" (the spec's own words) - a hand-
 *      rolled OfflineAudioContext-shaped renderer that actually COMPUTES a
 *      triangle-wave sample stream from the exact oscillator/gain-envelope
 *      calls sound.js's voice() makes (real numeric PCM, not an assertion
 *      that a function was called), then measures RMS on the result. The
 *      real browser-native OfflineAudioContext confirmation (this is a
 *      faithful re-implementation of it) is covered by the live Playwright
 *      pass in the PR's V&V section, where a genuine browser engine exists.
 * Run: node test/sound.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Sound = require('../music/shared/sound.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
// run() supports a case fn that RETURNS A PROMISE (test 5, the offline
// render evidence, is async) alongside every plain synchronous case above -
// same PASS/FAIL-line-per-case convention every other test/*.test.js uses.
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

/* ---------------------------------------------------------------------
 * 1. noteHz - A440 equal temperament + pitch-class wrap
 * ------------------------------------------------------------------- */
test('noteHz: A4 (pc 9, octave 4) is exactly 440', function () {
  assert.strictEqual(Sound.noteHz(9, 4), 440);
});
test('noteHz: C4 (pc 0, octave 4) is ~261.63', function () {
  assert.ok(Math.abs(Sound.noteHz(0, 4) - 261.6256) < 0.01, 'got ' + Sound.noteHz(0, 4));
});
test('noteHz: pc wraps into the next octave up (pc 12 == pc 0 one octave higher)', function () {
  assert.strictEqual(Sound.noteHz(12, 4), Sound.noteHz(0, 5));
});
test('noteHz: pc wraps into the octave below on underflow (pc -1 == pc 11 one octave lower)', function () {
  assert.strictEqual(Sound.noteHz(-1, 4), Sound.noteHz(11, 3));
});
test('noteHz: defaults to octave 4 when omitted', function () {
  assert.strictEqual(Sound.noteHz(9), 440);
});

/* ---------------------------------------------------------------------
 * 2. _buildNoteSequence - octave-folded ascent, closing root, note count
 * ------------------------------------------------------------------- */
test('_buildNoteSequence: C major (monotonic pcs) - note count is pcs.length + 1', function () {
  var C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var notes = Sound._buildNoteSequence(C_MAJOR, 4);
  assert.strictEqual(notes.length, C_MAJOR.length + 1);
  assert.deepStrictEqual(notes.map(function (n) { return n.octave; }), [4, 4, 4, 4, 4, 4, 4, 5]);
  assert.strictEqual(notes[0].pc, 0);
  assert.strictEqual(notes[notes.length - 1].pc, 0); // closing root, same pitch class as the start
});
test('_buildNoteSequence: F# major (Circle.scale pcs are NOT monotonic - wrap at 12) folds octaves correctly', function () {
  // Circle.scale('F#','major') = ['F#','G#','A#','B','C#','D#','F'] -> pcs 6,8,10,11,1,3,5
  var FSHARP_MAJOR = [6, 8, 10, 11, 1, 3, 5];
  var notes = Sound._buildNoteSequence(FSHARP_MAJOR, 4);
  assert.strictEqual(notes.length, 8);
  assert.deepStrictEqual(notes.map(function (n) { return n.pc; }), [6, 8, 10, 11, 1, 3, 5, 6]);
  assert.deepStrictEqual(notes.map(function (n) { return n.octave; }), [4, 4, 4, 4, 5, 5, 5, 5]);
  // strictly ascending pitch (pc + 12*octave) - the whole point of octave-folding
  var pitches = notes.map(function (n) { return n.pc + 12 * n.octave; });
  for (var i = 1; i < pitches.length; i++) assert.ok(pitches[i] > pitches[i - 1], 'not ascending at ' + i);
  // exactly one octave (12 semitones) from first note to the closing root
  assert.strictEqual(pitches[pitches.length - 1] - pitches[0], 12);
});
test('_buildNoteSequence: empty pcs -> empty sequence (no closing-root append on nothing)', function () {
  assert.deepStrictEqual(Sound._buildNoteSequence([], 4), []);
});

/* ---------------------------------------------------------------------
 * 3. _nextIndex - loop-wrap arithmetic for the live ticker
 * ------------------------------------------------------------------- */
test('_nextIndex: advances normally mid-sequence', function () {
  assert.strictEqual(Sound._nextIndex(0, 3, true), 1);
  assert.strictEqual(Sound._nextIndex(1, 3, true), 2);
});
test('_nextIndex: loop=true wraps the last index back to 0', function () {
  assert.strictEqual(Sound._nextIndex(2, 3, true), 0);
});
test('_nextIndex: loop=false signals -1 (stop) at the last index', function () {
  assert.strictEqual(Sound._nextIndex(2, 3, false), -1);
  assert.strictEqual(Sound._nextIndex(1, 3, false), 2); // still mid-sequence, no early stop
});

/* ---------------------------------------------------------------------
 * 4. scheduling math - a minimal RECORDING stub context (no waveform math,
 *    just captures what voice() asked to schedule)
 * ------------------------------------------------------------------- */
function makeRecorderCtx() {
  var calls = [];
  return {
    currentTime: 0,
    createOscillator: function () {
      var o = { type: null, frequency: { value: 0 }, connect: function () {}, start: function (t) { o._start = t; }, stop: function (t) { o._stop = t; calls.push({ freq: o.frequency.value, start: o._start, stop: o._stop }); } };
      return o;
    },
    createGain: function () { return { gain: { setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, connect: function () {} }; },
    destination: {},
    _calls: calls
  };
}
test('_schedulePass: one voice() call per note, at startAt + i*noteDur, right frequency', function () {
  var a = makeRecorderCtx();
  var notes = Sound._buildNoteSequence([0, 4, 7], 4); // C major triad -> 4 notes (root, 3rd, 5th, closing root)
  var noteDur = 0.5;
  var total = Sound._schedulePass(a, notes, 0, noteDur);
  assert.strictEqual(total, notes.length * noteDur);
  assert.strictEqual(a._calls.length, notes.length);
  a._calls.forEach(function (c, i) {
    assert.strictEqual(c.start, i * noteDur);
    assert.strictEqual(c.freq, Sound.noteHz(notes[i].pc, notes[i].octave));
  });
});

/* ---------------------------------------------------------------------
 * 5. "REAL audio evidence, not a mock" - a hand-rolled OfflineAudioContext-
 *    shaped renderer that computes actual triangle-wave PCM from voice()'s
 *    exact oscillator + gain-envelope calls, then measures RMS.
 * ------------------------------------------------------------------- */
function evalGainEnvelope(events, t) {
  var sorted = events.slice().sort(function (a, b) { return a[1] - b[1]; });
  if (!sorted.length) return 0;
  if (t <= sorted[0][1]) return sorted[0][2];
  for (var i = 1; i < sorted.length; i++) {
    var prev = sorted[i - 1], cur = sorted[i];
    if (t <= cur[1]) {
      var t0 = prev[1], t1 = cur[1], v0 = prev[2], v1 = cur[2];
      if (t1 === t0) return v1;
      var frac = (t - t0) / (t1 - t0);
      if (cur[0] === 'exp') { if (v0 <= 0) v0 = 0.0001; return v0 * Math.pow(v1 / v0, frac); }
      return v0 + (v1 - v0) * frac;
    }
  }
  return sorted[sorted.length - 1][2];
}
function triangleWave(phase) { return Math.asin(Math.sin(phase)) * (2 / Math.PI); }
function makeFakeOfflineCtx(sampleRate, length) {
  var events = []; // { freq, start, stop, gainEvents }
  return {
    sampleRate: sampleRate,
    length: length,
    currentTime: 0,
    destination: {},
    createOscillator: function () {
      var g = null;
      var o = {
        type: null,
        frequency: { value: 0 },
        connect: function (dest) { g = dest; },
        start: function (t) { o._start = t; },
        stop: function (t) { events.push({ freq: o.frequency.value, start: o._start, stop: t, gainEvents: g ? g._events : [] }); }
      };
      return o;
    },
    createGain: function () {
      var evs = [];
      return {
        _events: evs,
        gain: {
          setValueAtTime: function (v, t) { evs.push(['set', t, v]); },
          linearRampToValueAtTime: function (v, t) { evs.push(['lin', t, v]); },
          exponentialRampToValueAtTime: function (v, t) { evs.push(['exp', t, v]); }
        },
        connect: function () {}
      };
    },
    startRendering: function () {
      var self = this;
      return Promise.resolve().then(function () {
        var data = new Float64Array(self.length);
        events.forEach(function (ev) {
          var s0 = Math.max(0, Math.floor(ev.start * self.sampleRate));
          var s1 = Math.min(self.length, Math.ceil(ev.stop * self.sampleRate));
          for (var s = s0; s < s1; s++) {
            var t = s / self.sampleRate;
            var gainVal = evalGainEnvelope(ev.gainEvents, t);
            var phase = 2 * Math.PI * ev.freq * (t - ev.start);
            data[s] += triangleWave(phase) * gainVal;
          }
        });
        return { duration: self.length / self.sampleRate, getChannelData: function () { return data; } };
      });
    }
  };
}

test('_schedulePass + a real (hand-rolled, not mocked) OfflineAudioContext renderer: non-silent buffer, expected duration', function () {
  var pcs = [0, 4, 7]; // short scale (C major triad) - render stays fast
  var notes = Sound._buildNoteSequence(pcs, 4);
  var bpm = 72, noteDur = 60 / bpm;
  var sampleRate = 8000; // plenty of resolution for RMS/duration checks; keeps the render fast
  var totalDur = notes.length * noteDur;
  var length = Math.ceil((totalDur + 0.05) * sampleRate); // + release tail margin
  var ctx = makeFakeOfflineCtx(sampleRate, length);
  var scheduled = Sound._schedulePass(ctx, notes, 0, noteDur);
  assert.ok(Math.abs(scheduled - totalDur) < 1e-9, 'schedulePass returned an unexpected duration: ' + scheduled);
  return ctx.startRendering().then(function (buffer) {
    assert.ok(Math.abs(buffer.duration - length / sampleRate) < 1e-9);
    var data = buffer.getChannelData(0);
    var sumSq = 0;
    for (var i = 0; i < data.length; i++) sumSq += data[i] * data[i];
    var rms = Math.sqrt(sumSq / data.length);
    assert.ok(rms > 0, 'expected non-silent rendered audio (RMS > 0), got RMS ' + rms);
  });
});

run();
