/* =====================================================================
 * audio.js  -  generic chord audio (shared).  Global: ChordAudio
 * ---------------------------------------------------------------------
 * One audio engine for every instrument. Everything is derived from the
 * profile's open-string frequencies + a fret array, so no per-instrument
 * audio code is needed.
 *   (NB: named ChordAudio, NOT Audio - window.Audio is the built-in
 *    HTMLAudioElement constructor and must not be shadowed.)
 *
 *   ChordAudio.tone(freq, durSeconds)             - one sustained tone
 *   ChordAudio.strum(frets, openFreqs, dur)       - strum a chord shape
 *   ChordAudio.freqForString(openFreq, fret)      - helper
 * ===================================================================== */
(function (global) {
  'use strict';

  var AC = null;
  function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
  // Be a polite audio citizen: a *running* WebAudio context claims the device's
  // audio focus, which pauses other apps' playback (Spotify etc.) on Android.
  // So we DON'T warm the context up on page load / first tap — it's created
  // lazily only when a chord actually sounds, and suspended again shortly after
  // the sound ends so background audio resumes. (Suspended releases focus.)
  // Be a polite audio citizen WITHOUT killing tap latency. We suspend only after
  // a genuine idle gap (well past the longest note + a comfortable margin), so a
  // run of taps during a jam keeps the context warm and notes fire instantly.
  // Suspending the instant a note's envelope ended made every tap re-pay the
  // hardware resume cost (the ~0.5s lag) — that's the regression this fixes.
  var IDLE_RELEASE_MS = 4000;
  var idleTimer = null;
  function releaseWhenIdle(secondsFromNow) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (AC && AC.state === 'running') AC.suspend();
    }, secondsFromNow * 1000 + IDLE_RELEASE_MS);
  }

  function freqForString(openFreq, fret) { return openFreq * Math.pow(2, fret / 12); }

  // Run `play` against a running context. If the context is already running
  // (the common jam case) we schedule SYNCHRONOUSLY — zero added latency. Only
  // when it's been suspended (after a long idle, or on the very first tap) do we
  // go through resume()'s promise, because scheduling against a frozen
  // currentTime would drop the note.
  function whenRunning(a, play) {
    if (a.state === 'running') { play(); return; }
    a.resume().then(play);
  }

  function tone(freq, dur) {
    dur = dur || 1.1;
    var a = ctx();
    whenRunning(a, function () {
      var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o2.type = 'triangle';
      o.frequency.value = freq; o2.frequency.value = freq;
      var t = a.currentTime;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.04);
      g.gain.setValueAtTime(0.2, t + dur - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g); g.connect(a.destination);
      o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
      releaseWhenIdle(dur);
    });
  }

  function pluck(freq, t, dur, gscale) {
    var a = ctx();
    var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    var peak = 0.14 * gscale;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }

  // frets[]: per string (display order), -1 muted / 0 open / n fretted.
  // openFreqs[]: the same-order open-string frequencies from the profile.
  function strum(frets, openFreqs, dur) {
    if (!frets || !openFreqs) return;
    dur = dur || 1.4;
    var a = ctx();
    whenRunning(a, function () { // sync when already running — see tone()
      var t0 = a.currentTime + 0.02, i = 0;
      frets.forEach(function (fr, s) {
        if (fr < 0 || openFreqs[s] == null) return; // muted / missing string
        pluck(freqForString(openFreqs[s], fr), t0 + i * 0.017, dur, 1 - i * 0.045);
        i++;
      });
      releaseWhenIdle(0.02 + Math.max(0, i - 1) * 0.017 + dur);
    });
  }

  global.ChordAudio = { tone: tone, strum: strum, freqForString: freqForString };

})(typeof window !== 'undefined' ? window : this);
