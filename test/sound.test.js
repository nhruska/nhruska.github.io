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

/* ---------------------------------------------------------------------
 * 6. playScale() + retarget() (M-EAR wave 1.5, U11) - the LIVE ticker,
 *    driven with a deterministic fake clock (mirrors test/toast.test.js's
 *    own withFakeClock pattern - see that file's header for why no async/
 *    fake-timer library is used elsewhere in this repo) plus a fake "live"
 *    AudioContext (state already 'running', so whenRunning() calls step(0)
 *    SYNCHRONOUSLY - no Promise wait needed). Verifies: the swap applies at
 *    the NEXT tick (not immediately), the index resets to 0 against the new
 *    scale, exactly one voice is scheduled per tick (no doubled voices at
 *    the boundary), then renders REAL PCM across the boundary (same
 *    evalGainEnvelope/triangleWave evaluator as test 5) and confirms
 *    non-silent audio on both sides.
 * ------------------------------------------------------------------- */
function withFakeClock(fn) {
  var nextId = 1;
  var scheduled = {};
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { delete scheduled[id]; };
  try {
    return fn({
      // fires the OLDEST pending timer (FIFO - matches the single-chain
      // step()->setTimeout->step() scheduling shape; only ever one timer
      // pending at a time in this ticker, but FIFO is the correct general
      // semantic regardless).
      fireNext: function () {
        var ids = Object.keys(scheduled);
        if (!ids.length) return false;
        var id = ids[0], s = scheduled[id];
        delete scheduled[id];
        s.cb();
        return true;
      },
      pendingCount: function () { return Object.keys(scheduled).length; }
    });
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
}
// A fake "live" AudioContext: state starts 'running' (whenRunning() plays
// synchronously - no resume() Promise to await), currentTime is test-
// advanced (the fake clock doesn't move a real wall clock, so nothing else
// would). Records the SAME { freq, start, stop, gainEvents } shape as test
// 5's makeFakeOfflineCtx, reused by the same evalGainEnvelope/triangleWave
// render pass below for genuine PCM evidence, not just event-log bookkeeping.
function makeFakeLiveContext() {
  var events = [];
  var ctx = {
    state: 'running', currentTime: 0, destination: {},
    resume: function () { ctx.state = 'running'; return Promise.resolve(); },
    suspend: function () { ctx.state = 'suspended'; },
    createOscillator: function () {
      var g = null;
      var o = {
        type: null, frequency: { value: 0 },
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
    _events: events
  };
  return ctx;
}
function renderEvents(events, sampleRate, length) {
  var data = new Float64Array(length);
  events.forEach(function (ev) {
    var s0 = Math.max(0, Math.floor(ev.start * sampleRate));
    var s1 = Math.min(length, Math.ceil(ev.stop * sampleRate));
    for (var s = s0; s < s1; s++) {
      var t = s / sampleRate;
      var gainVal = evalGainEnvelope(ev.gainEvents, t);
      var phase = 2 * Math.PI * ev.freq * (t - ev.start);
      data[s] += triangleWave(phase) * gainVal;
    }
  });
  return data;
}
function rms(data) {
  var sumSq = 0;
  for (var i = 0; i < data.length; i++) sumSq += data[i] * data[i];
  return Math.sqrt(sumSq / data.length);
}
// sound.js caches its ONE AudioContext at module scope (`var AC = null` -
// deliberate, "only one playback app-wide" per the module header) - so
// `window.AudioContext` is only ever CONSTRUCTED once across this whole
// test file, no matter how many test() cases call Sound.playScale(). Every
// test below shares this ONE fake context and asserts on DELTAS (events
// added THIS test), never absolute lengths/indices, so test order and
// accumulated history from earlier cases never leak into an assertion.
if (typeof global.window === 'undefined') global.window = global;
var liveCtx = null;
global.window.AudioContext = function () { liveCtx = makeFakeLiveContext(); return liveCtx; };
// Guarantees a clean slate before each test's OWN fake clock takes over:
// stops any handle a PRIOR test left running (e.g. one that threw before
// reaching its own handle.stop()) using REAL timers, so that handle's
// belt-and-suspenders "release audio focus" setTimeout(...,500) fires (or
// simply sits) on the REAL clock instead of getting captured - and possibly
// fired out of turn - by THIS test's fake one. Also force-resets
// liveCtx.state back to 'running': a leftover suspend-timer firing for real
// would otherwise route the next playScale() through the async
// resume().then(play) branch instead of the synchronous fast path every
// test below assumes.
function resetLiveCtx() {
  Sound.stopAll();
  if (liveCtx) liveCtx.state = 'running';
}

test('playScale + retarget(): the currently-sounding note is untouched by retarget() - no new/cancelled voice from the call itself', function () {
  resetLiveCtx();
  return withFakeClock(function (clock) {
    var base = liveCtx ? liveCtx._events.length : 0; // liveCtx doesn't exist yet the very first time this runs
    var onNoteLog = [];
    var handle = Sound.playScale([0, 4, 7], { // C major triad -> notes.length 4 (3 pcs + closing root)
      bpm: 6000, // noteDur = 0.01s - irrelevant here since the fake clock never really waits
      onNote: function (i) { onNoteLog.push(i); }
    });
    assert.deepStrictEqual(onNoteLog, [0], 'step(0) must fire synchronously - the fake context starts already running');
    assert.strictEqual(liveCtx._events.length, base + 1, 'exactly one voice scheduled for the first note');
    handle.retarget([2, 5, 9, 11]); // 4 pcs -> notes.length 5, deliberately a DIFFERENT count than the 4-note C major triad
    assert.strictEqual(liveCtx._events.length, base + 1, 'retarget() itself schedules/cancels nothing - the note already in flight is left to finish naturally (no click/gap)');
    handle.stop();
  });
});

test('playScale + retarget(): the VERY NEXT tick already reflects the swap, restarting the ascent at index 0 of the new scale (no extra old-scale note plays first)', function () {
  resetLiveCtx();
  return withFakeClock(function (clock) {
    var base = liveCtx._events.length;
    var onNoteLog = [];
    var handle = Sound.playScale([0, 4, 7], {
      bpm: 6000,
      onNote: function (i) { onNoteLog.push(i); }
    });
    handle.retarget([2, 5, 9, 11]); // queued while index 0 (the C major root) is still sounding - 4 pcs -> notes.length 5
    assert.ok(clock.fireNext(), 'expected the tick following the note already in flight');
    // The swap takes effect on THIS tick, immediately - i resets to 0 against
    // the NEW scale, never 1 (which would have been the OLD sequence's next
    // index, i.e. an extra old-scale note before the swap).
    assert.deepStrictEqual(onNoteLog, [0, 0]);
    assert.strictEqual(liveCtx._events.length, base + 2, 'exactly one NEW voice this tick - never two (no doubled voices)');
    assert.strictEqual(liveCtx._events[liveCtx._events.length - 1].freq, Sound.noteHz(2, 4), 'the new scale\'s own root (pc 2) sounds, restarting the ascent');
    // Confirm the note COUNT actually changed too (nextIndex now wraps against
    // the new, longer 5-note sequence: indices 1,2,3,4 then wrap back to 0).
    for (var k = 0; k < 3; k++) clock.fireNext();
    assert.deepStrictEqual(onNoteLog.slice(-3), [1, 2, 3]);
    clock.fireNext(); // index 4 - the last index before the new sequence wraps
    assert.strictEqual(onNoteLog[onNoteLog.length - 1], 4);
    clock.fireNext(); // wraps back to 0
    assert.strictEqual(onNoteLog[onNoteLog.length - 1], 0);
    handle.stop();
  });
});

test('playScale + retarget(): a real (hand-rolled) PCM render across the boundary is non-silent on BOTH sides, one voice per tick (no doubled voices)', function () {
  resetLiveCtx();
  return withFakeClock(function (clock) {
    var bpm = 6000, noteDur = 60 / bpm;
    var base = liveCtx._events.length;
    var startCurrentTime = liveCtx.currentTime;
    var handle = Sound.playScale([0, 4, 7], { bpm: bpm, onNote: function () {} }); // schedules the OLD scale's root synchronously, at startCurrentTime
    handle.retarget([2, 5, 9]); // queued while that root is still sounding
    // advance the fake clock's currentTime BEFORE each tick fires, mirroring
    // a real AudioContext's wall clock (noteDur seconds elapse, THEN the
    // timer fires) - otherwise every voice would schedule at the same
    // instant and the render below couldn't separate them.
    liveCtx.currentTime += noteDur; clock.fireNext(); // boundary tick - already the NEW scale's root (per the corrected U11 contract above)
    liveCtx.currentTime += noteDur; clock.fireNext(); // one more tick of the new scale
    var thisRunEvents = liveCtx._events.slice(base); // [OLD-scale root, NEW-scale root, NEW-scale 2nd note]
    assert.strictEqual(thisRunEvents.length, 3);
    var sampleRate = 8000;
    var totalDur = (liveCtx.currentTime - startCurrentTime) + noteDur;
    var length = Math.ceil((totalDur + 0.05) * sampleRate);
    // render relative to startCurrentTime so this run's audio starts at t=0
    // in the buffer regardless of how much clock time earlier tests consumed.
    var relEvents = thisRunEvents.map(function (e) { return { freq: e.freq, start: e.start - startCurrentTime, stop: e.stop - startCurrentTime, gainEvents: e.gainEvents.map(function (g) { return [g[0], g[1] - startCurrentTime, g[2]]; }) }; });
    var data = renderEvents(relEvents, sampleRate, length);
    // Sample windows anchored to each event's OWN known start (not a blind
    // thirds-of-buffer split - the +0.05s release-tail margin baked into
    // `length` would otherwise dilute a late window well past where any
    // note is still sounding). winLen sits safely inside a note's attack/
    // sustain, well before its release fades to ~0.
    var winLen = Math.floor(noteDur * 0.5 * sampleRate);
    var beforeBoundary = data.slice(0, winLen); // inside the OLD scale's root note (event 0, starts at t=0)
    var afterStart = Math.floor(2 * noteDur * sampleRate); // event 2 (NEW scale's 2nd note) starts here
    var afterBoundary = data.slice(afterStart, afterStart + winLen);
    assert.ok(rms(beforeBoundary) > 0, 'expected non-silent audio BEFORE the retarget boundary (the old scale still sounding)');
    assert.ok(rms(afterBoundary) > 0, 'expected non-silent audio AFTER the retarget boundary (the new scale sounding)');
    // no doubled voices in THIS run: every event's start time is strictly
    // increasing (sequential one-note-per-tick schedule, no overlap).
    var starts = thisRunEvents.map(function (e) { return e.start; }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1], 'expected strictly increasing, non-overlapping start times');
    handle.stop();
  });
});

test('playScale + retarget(): an empty/unresolvable target is silently ignored - playback continues on the CURRENT scale', function () {
  resetLiveCtx();
  return withFakeClock(function (clock) {
    var onNoteLog = [];
    var handle = Sound.playScale([0, 4, 7], { bpm: 6000, onNote: function (i) { onNoteLog.push(i); } });
    handle.retarget([]); // buildNoteSequence([]) -> [] -> ignored per the documented contract
    assert.ok(clock.fireNext());
    assert.deepStrictEqual(onNoteLog, [0, 1], 'unaffected - still stepping through the original C major triad sequence');
    handle.stop();
  });
});

test('playScale + retarget(): a no-op after stop() - never revives a stopped loop', function () {
  resetLiveCtx();
  return withFakeClock(function (clock) {
    var stopped = false;
    var handle = Sound.playScale([0, 4, 7], { bpm: 6000, onStop: function () { stopped = true; } });
    handle.stop();
    assert.strictEqual(stopped, true);
    // stop() itself schedules ONE belt-and-suspenders "release audio focus"
    // timer (500ms, unrelated to the note ticker) - capture the count AFTER
    // stop() so this assertion is about retarget()'s effect specifically,
    // not stop()'s own bookkeeping.
    var afterStopCount = clock.pendingCount();
    assert.doesNotThrow(function () { handle.retarget([2, 5, 9]); });
    assert.strictEqual(clock.pendingCount(), afterStopCount, 'retarget() after stop() must not add or remove any timers');
  });
});

/* ---------------------------------------------------------------------
 * 7. setTempo() (M-EAR wave 1.6, U14) - the SAME next-tick-boundary
 *    mechanics as retarget() above, applied to the tempo/noteDur instead of
 *    the pcs sequence. Mirrors the retarget test shapes 1:1 (a live tempo
 *    switch mid-audition must never click/gap the in-flight note).
 * ------------------------------------------------------------------- */
// withFakeClock only exposes fireNext()/pendingCount() (deliberately - see
// its own header). setTempo()'s effect lands in the MS argument of the timer
// step() schedules for its OWN next tick, which those two helpers don't
// expose - so this local variant also records the last-scheduled `ms` per
// pending id, read-only bookkeeping alongside the shared fake-clock pattern.
function withFakeClockMs(fn) {
  var nextId = 1;
  var scheduled = {};
  var realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = function (cb, ms) { var id = nextId++; scheduled[id] = { cb: cb, ms: ms }; return id; };
  global.clearTimeout = function (id) { delete scheduled[id]; };
  try {
    return fn({
      fireNext: function () {
        var ids = Object.keys(scheduled);
        if (!ids.length) return false;
        var id = ids[0], s = scheduled[id];
        delete scheduled[id];
        s.cb();
        return true;
      },
      pendingCount: function () { return Object.keys(scheduled).length; },
      // the ms argument of whichever timer is CURRENTLY pending (there is
      // only ever one live at a time in this ticker - see withFakeClock's
      // own header) - null when nothing is pending.
      pendingMs: function () {
        var ids = Object.keys(scheduled);
        return ids.length ? scheduled[ids[0]].ms : null;
      }
    });
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
  }
}

test('setTempo(): the currently-scheduled tick keeps its ORIGINAL interval - a tempo tap never touches the note already in flight', function () {
  resetLiveCtx();
  return withFakeClockMs(function (clock) {
    var slowBpm = 72, slowNoteDur = 60 / slowBpm;
    var handle = Sound.playScale([0, 4, 7], { bpm: slowBpm, onNote: function () {} });
    // step(0) already scheduled its OWN next tick at slowNoteDur*1000 ms before setTempo() is even called.
    assert.ok(Math.abs(clock.pendingMs() - slowNoteDur * 1000) < 1e-9, 'expected the ORIGINAL (slow) interval already queued');
    handle.setTempo(140); // queued while the slow note is still sounding
    assert.ok(Math.abs(clock.pendingMs() - slowNoteDur * 1000) < 1e-9, 'setTempo() itself must not reschedule/touch the timer already in flight');
    handle.stop();
  });
});

test('setTempo(): the VERY NEXT tick schedules its OWN following tick at the NEW (faster) interval', function () {
  resetLiveCtx();
  return withFakeClockMs(function (clock) {
    var slowBpm = 72, slowNoteDur = 60 / slowBpm;
    var fastBpm = 140, fastNoteDur = 60 / fastBpm;
    var onNoteLog = [];
    var handle = Sound.playScale([0, 4, 7], { bpm: slowBpm, onNote: function (i) { onNoteLog.push(i); } });
    handle.setTempo(fastBpm);
    assert.ok(clock.fireNext(), 'expected the tick following the note already in flight');
    assert.deepStrictEqual(onNoteLog, [0, 1], 'the swap is a tempo change only - the pcs sequence/index progression is untouched');
    // THIS tick (index 1, now sounding at the new tempo) schedules ITS OWN
    // next tick at the new, faster interval.
    assert.ok(Math.abs(clock.pendingMs() - fastNoteDur * 1000) < 1e-9, 'expected the NEW (fast) interval scheduled from this tick forward, got ' + clock.pendingMs());
    handle.stop();
  });
});

test('setTempo(): an invalid tempo (non-finite / <= 0) is silently ignored - playback continues at the CURRENT tempo', function () {
  resetLiveCtx();
  return withFakeClockMs(function (clock) {
    var bpm = 90, noteDur = 60 / bpm;
    var handle = Sound.playScale([0, 4, 7], { bpm: bpm, onNote: function () {} });
    [0, -5, NaN, Infinity, 'fast', null, undefined].forEach(function (bad) {
      assert.doesNotThrow(function () { handle.setTempo(bad); });
    });
    assert.ok(clock.fireNext());
    assert.ok(Math.abs(clock.pendingMs() - noteDur * 1000) < 1e-9, 'expected the ORIGINAL tempo unaffected by any invalid setTempo() call');
    handle.stop();
  });
});

test('setTempo(): a no-op after stop() - never revives a stopped loop or schedules a new timer', function () {
  resetLiveCtx();
  return withFakeClockMs(function (clock) {
    var handle = Sound.playScale([0, 4, 7], { bpm: 6000 });
    handle.stop();
    var afterStopCount = clock.pendingCount();
    assert.doesNotThrow(function () { handle.setTempo(140); });
    assert.strictEqual(clock.pendingCount(), afterStopCount, 'setTempo() after stop() must not add or remove any timers');
  });
});

test('_schedulePass + a real (hand-rolled) OfflineAudioContext renderer: a FASTER tempo (higher bpm) renders a SHORTER total duration for the SAME pcs (U14 tempo-control evidence)', function () {
  var pcs = [0, 4, 7]; // C major triad -> notes.length 4 (3 pcs + closing root), held constant across both renders
  var notes = Sound._buildNoteSequence(pcs, 4);
  var slowBpm = 72, slowNoteDur = 60 / slowBpm;
  var fastBpm = 140, fastNoteDur = 60 / fastBpm;
  var sampleRate = 8000;
  function renderAt(noteDur) {
    var totalDur = notes.length * noteDur;
    var length = Math.ceil((totalDur + 0.05) * sampleRate);
    var ctx = makeFakeOfflineCtx(sampleRate, length);
    var scheduled = Sound._schedulePass(ctx, notes, 0, noteDur);
    return ctx.startRendering().then(function (buffer) { return { scheduled: scheduled, duration: buffer.duration }; });
  }
  return renderAt(slowNoteDur).then(function (slow) {
    return renderAt(fastNoteDur).then(function (fast) {
      assert.ok(fast.scheduled < slow.scheduled, 'expected the fast-tempo scheduled duration to be shorter for the same note count: fast=' + fast.scheduled + ' slow=' + slow.scheduled);
      assert.ok(fast.duration < slow.duration, 'expected the fast-tempo RENDERED buffer to be shorter for the same pcs: fast=' + fast.duration + ' slow=' + slow.duration);
    });
  });
});

run();
