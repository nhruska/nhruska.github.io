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
 *   ChordAudio.strum(frets, openFreqs, dur, opts) - strum a chord shape
 *   ChordAudio.freqForString(openFreq, fret)      - helper
 *   ChordAudio.ksRender(sampleRate, freq, dur, o) - pure DSP (node-testable)
 *
 * REAL-FEEL ENGINE (why it's built this way):
 *   The old engine plucked each string with two oscillators (triangle +
 *   sine at 2.001x) and a fixed exponential decay - clean, but obviously
 *   synthetic and identical every tap. A real strummed chord is a *plucked
 *   string* (Karplus-Strong: a noise burst fed round a tuned delay line
 *   that a damping filter slowly bleeds), swept by a hand so the strings
 *   don't all speak at once or at the same volume, coloured by a wooden
 *   body and the room. This engine models each of those:
 *     - ksRender()  : the string itself (physical-model pluck), pure math
 *                     so it renders identically in Node and the browser and
 *                     needs zero audio assets (stays a lean offline PWA).
 *     - strum()     : the hand - accelerating stagger + timing jitter,
 *                     per-string micro-detune, velocity roll-off, up/down.
 *     - the master bus : the body + room - body-resonance peak, a taming
 *                     lowpass, a short generated reverb, and a safety
 *                     compressor so six summed strings never clip.
 *   tone() is deliberately left as a clean sustained tone (NOT a pluck):
 *   it's the tuner's pitch reference and must stay stable and uncoloured.
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

  /* ---------------------------------------------------------------------
   * ksRender - a plucked string, rendered to a Float32Array (mono).
   *
   * Karplus-Strong: seed a delay line one period long with a short noise
   * burst (the pick), then repeatedly read the oldest sample out and feed
   * a lowpassed, slightly-attenuated copy back in. The lowpass is what makes
   * the highs die before the fundamental, exactly like a real string; the
   * attenuation sets how long it rings. It's a physical model, so it sounds
   * like a string rather than an oscillator - and it's just array math, so
   * it renders identically in Node (unit-testable) and the browser (no
   * samples, no assets, fully offline).
   *
   *   sampleRate  audio sample rate (a.sampleRate in the browser)
   *   freq        fundamental (Hz)
   *   dur         seconds to render
   *   opts.decay      loop gain 0..1 - higher = longer sustain (default per-freq)
   *   opts.brightness pick tone 0..1 - higher = brighter/twangier (default 0.5)
   *   opts.fadeOut    seconds of tail fade to guarantee a click-free end
   * ------------------------------------------------------------------- */
  function ksRender(sampleRate, freq, dur, opts) {
    opts = opts || {};
    freq = Math.max(20, freq);
    var period = sampleRate / freq;
    var L = Math.max(2, Math.round(period));          // integer delay line
    var n = Math.max(L + 1, Math.floor(sampleRate * dur));
    var out = new Float32Array(n);

    // Longer, wound (low) strings ring longer than thin high ones - so decay
    // rises toward 1 as frequency falls. Kept < 1 so the loop is always stable.
    var decay = opts.decay;
    if (decay == null) decay = 0.9995 - Math.min(0.008, freq * 0.0000085);
    if (decay > 0.99995) decay = 0.99995;
    if (decay < 0.985) decay = 0.985;

    var bright = opts.brightness == null ? 0.5 : opts.brightness;
    if (bright < 0.05) bright = 0.05; if (bright > 0.95) bright = 0.95;

    // Excitation: white noise through a one-pole lowpass. A brighter pick lets
    // more noise through (twangier attack); a softer pick smooths it (thumb).
    var buf = new Float32Array(L + 1);
    var prev = 0;
    for (var i = 0; i < L; i++) {
      var w = Math.random() * 2 - 1;
      prev = bright * w + (1 - bright) * prev;
      buf[i] = prev;
    }

    // The KS loop: y = decay * average(oldest two samples). The averaging is a
    // gentle one-zero lowpass - the string's frequency-dependent damping.
    var p = 0;
    for (var s = 0; s < n; s++) {
      var a0 = buf[p];
      var a1 = buf[(p + 1) % (L + 1)];
      out[s] = a0;
      buf[p] = 0.5 * (a0 + a1) * decay;
      p = (p + 1) % (L + 1);
    }

    // Bake a tiny fade-in (kill the seed click) and a tail fade (click-free end
    // even when routed straight to the destination). Cheap insurance.
    var fin = Math.min(n, Math.round(sampleRate * 0.003));
    for (var f = 0; f < fin; f++) out[f] *= f / fin;
    var foSec = opts.fadeOut == null ? 0.04 : opts.fadeOut;
    var fo = Math.min(n, Math.round(sampleRate * foSec));
    for (var g = 0; g < fo; g++) out[n - 1 - g] *= g / fo;

    return out;
  }

  /* ---- master bus: the instrument body + the room ------------------- */
  // Built once, lazily, and reused. A body-resonance peak + a taming lowpass
  // give the raw string a wooden warmth; a short generated reverb puts it in a
  // room; a gentle compressor glues the strings and guards against clipping
  // when all six sum. tone() bypasses this on purpose (see file header).
  var bus = null;
  function masterBus(a) {
    if (bus && bus.a === a) return bus;
    var input = a.createGain(); input.gain.value = 0.9;

    // Warmth voicing (ear-test 2026-07-17, "too much high end / cheap
    // strings"): body peak up 3.5 -> 4.5dB (more wood to fill what the
    // lowpass takes), tame cutoff down 4200 -> 2600Hz (steel-sparkle band
    // out; uke/nylon character lives ~2-3kHz), Q 0.6 -> 0.5 for a gentler
    // knee. Partner change: the softer pick range in strum().
    var body = a.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 120; body.Q.value = 0.7; body.gain.value = 4.5;

    var tame = a.createBiquadFilter();
    tame.type = 'lowpass'; tame.frequency.value = 2600; tame.Q.value = 0.5;

    var comp = a.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.18;

    input.connect(body); body.connect(tame); tame.connect(comp);

    // Dry path.
    comp.connect(a.destination);

    // Wet path: a short exponential-decay noise impulse = a small room. Best
    // effort - if ConvolverNode is unavailable the dry signal still plays.
    try {
      var rev = a.createConvolver();
      var len = Math.floor(a.sampleRate * 0.4);
      var ir = a.createBuffer(2, len, a.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      rev.buffer = ir;
      var wet = a.createGain(); wet.gain.value = 0.11;
      tame.connect(rev); rev.connect(wet); wet.connect(a.destination);
    } catch (e) { /* no reverb; dry is fine */ }

    bus = { a: a, input: input };
    return bus;
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

  // Play one plucked string: render a KS buffer and fire it through the bus at
  // time t with the given peak gain.
  function pluckKS(a, input, freq, t, dur, gain, brightness) {
    var data = ksRender(a.sampleRate, freq, dur, { brightness: brightness });
    var b = a.createBuffer(1, data.length, a.sampleRate);
    b.getChannelData(0).set(data);
    var src = a.createBufferSource(); src.buffer = b;
    var g = a.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(input);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // frets[]: per string (display order), -1 muted / 0 open / n fretted.
  // openFreqs[]: the same-order open-string frequencies from the profile.
  // opts.direction 'down' (default, low->high) | 'up' (high->low, lighter)
  // opts.velocity  0..1 strum force (default 0.85) - louder + brighter when hard
  function strum(frets, openFreqs, dur, opts) {
    if (!frets || !openFreqs) return;
    dur = dur || 1.6;
    opts = opts || {};
    var up = opts.direction === 'up';
    var vel = opts.velocity == null ? 0.85 : Math.max(0.2, Math.min(1, opts.velocity));
    var a = ctx();
    whenRunning(a, function () { // sync when already running — see tone()
      var m = masterBus(a);

      // Build the list of sounding strings in the order the pick meets them.
      var voices = [];
      frets.forEach(function (fr, s) {
        if (fr < 0 || openFreqs[s] == null) return;   // muted / missing string
        voices.push({ s: s, freq: freqForString(openFreqs[s], fr) });
      });
      if (!voices.length) return;
      if (up) voices.reverse();                        // up-strum hits high->low

      // The hand: strings speak in sequence, and a real strum ACCELERATES
      // slightly across the sweep rather than clicking at a fixed metronome
      // spacing. Up-strums are faster and lighter than down-strums.
      var base = up ? 0.011 : 0.018;                   // s between first strings
      var accel = 0.85;                                // each gap a touch shorter
      var t0 = a.currentTime + 0.02, t = t0, gap = base;
      voices.forEach(function (v, i) {
        // Micro-detune (+/- ~4 cents) so no two strings are phase-locked -
        // the difference between a chord and a synth stack.
        var det = 1 + (Math.random() - 0.5) * 0.0045;
        // Velocity roll-off: the pick loses energy across the sweep; harder
        // strums stay fuller. Up-strums are quieter overall.
        var roll = 1 - i * (0.05 + (1 - vel) * 0.04);
        if (roll < 0.3) roll = 0.3;
        var gain = (up ? 0.11 : 0.15) * vel * roll;
        // Pick tone (ear-test verdict 2026-07-17: "too much high end, sounds
        // like cheap strings"): the old range (0.42 + vel*0.28 ~= 0.66 at
        // default velocity) is a hard plastic pick - the noise burst carried
        // too much HF into the string. 0.30 + vel*0.22 (~0.49 default) is a
        // felt-pick/thumb range: same velocity->brightness slope, warmer
        // resting tone. Measured: -1.6dB HF (>2kHz) attack energy at default
        // velocity - the ATTACK's share of the fix; the sustained-tone cut
        // comes from the master-bus tame lowpass (masterBus), -5..-8dB across
        // 3-6kHz. If a future ear test says "still bright", this range is the
        // second knob; "too dark" -> raise the tame cutoff first.
        var bright = 0.30 + vel * 0.22 + (Math.random() - 0.5) * 0.06;
        pluckKS(a, m.input, v.freq * det, t, dur, gain, bright);
        // advance the sweep with a little timing jitter (a human isn't exact)
        gap = Math.max(0.006, gap * accel + (Math.random() - 0.5) * 0.004);
        t += gap;
      });

      releaseWhenIdle((t - t0) + dur);
    });
  }

  global.ChordAudio = { tone: tone, strum: strum, freqForString: freqForString, ksRender: ksRender };

})(typeof window !== 'undefined' ? window : this);
