/* =====================================================================
 * tempo.js  -  Campfire tempo / tap-tempo engine (instrument-agnostic)
 * ---------------------------------------------------------------------
 * Songs carry no BPM, so the player sets the feel: tap the beat a few
 * times (or drag a slider) and Campfire pulses to it. Pure logic — the
 * BPM math, tap-tempo averaging and a beat clock — so it's unit-tested
 * in Node; the UI just reads bpm()/interval()/beatInBar().
 *
 * No build step. Exposes window.Tempo = { createTempo }, and is also
 * require()-able in Node for tests (module.exports).
 * ===================================================================== */
(function (global) {
  'use strict';

  var MIN_BPM = 40, MAX_BPM = 240;
  var RESET_GAP = 2000; // ms between taps beyond which we assume a NEW tempo
  var MAX_TAPS = 5;     // rolling window → average the last few intervals

  function clampBpm(n) { return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n))); }

  function createTempo(opts) {
    opts = opts || {};
    var bpm = clampBpm(opts.bpm || 100);
    var perBar = opts.beatsPerBar || 4;
    var taps = [];

    function interval() { return 60000 / bpm; }

    return {
      bpm: function () { return bpm; },
      beatsPerBar: function () { return perBar; },
      setBpm: function (n) { bpm = clampBpm(n); return bpm; },
      interval: interval,
      // register a tap; returns the new bpm estimate, or null until we have
      // at least two taps (one interval). A long gap restarts the sequence.
      tap: function (now) {
        if (taps.length && now - taps[taps.length - 1] > RESET_GAP) taps = [];
        taps.push(now);
        if (taps.length > MAX_TAPS) taps = taps.slice(taps.length - MAX_TAPS);
        if (taps.length < 2) return null;
        var sum = 0;
        for (var i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
        var avg = sum / (taps.length - 1);
        bpm = clampBpm(60000 / avg);
        return bpm;
      },
      reset: function () { taps = []; },
      // whole beats elapsed since startMs (clamped at 0)
      beatIndex: function (startMs, nowMs) {
        if (nowMs <= startMs) return 0;
        return Math.floor((nowMs - startMs) / interval());
      },
      // beat position within the bar (0 = downbeat)
      beatInBar: function (startMs, nowMs) {
        return ((this.beatIndex(startMs, nowMs) % perBar) + perBar) % perBar;
      }
    };
  }

  var api = { createTempo: createTempo };
  global.Tempo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
