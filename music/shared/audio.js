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
 * REAL-FEEL ENGINE (the model):
 *   A strummed chord is modelled as plucked strings (Karplus-Strong: a
 *   noise burst fed round a tuned delay line that a damping filter slowly
 *   bleeds), swept by a hand so the strings don't all speak at once or at
 *   the same volume, coloured by a wooden body and the room:
 *     - ksRender()  : the string itself (physical-model pluck), pure math
 *                     so it renders identically in Node and the browser and
 *                     needs zero audio assets (stays a lean offline PWA).
 *     - strum()     : the hand - accelerating stagger + timing jitter,
 *                     per-string micro-detune, velocity roll-off, up/down.
 *     - the master bus : the body + room - body-resonance peak, a taming
 *                     lowpass, a short generated reverb, and a safety
 *                     compressor so six summed strings never clip.
 *   tone() is deliberately a clean sustained tone (NOT a pluck): it's the
 *   tuner's pitch reference and must stay stable and uncoloured.
 * ===================================================================== */
(function (global) {
  'use strict';

  var AC = null;
  function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
  // A *running* WebAudio context claims the device's audio focus, which pauses
  // other apps' playback (Spotify etc.) on Android. So the context is created
  // lazily only when a chord actually sounds, and suspended again once idle so
  // background audio resumes (suspended releases focus).
  // Suspend only after a genuine idle gap, NOT the instant a note's envelope
  // ends: a hardware resume costs ~0.5s of lag, so releasing too eagerly makes
  // every tap during a jam re-pay it. The gap must exceed how a musician
  // actually plays - tap a chord, listen, think, tap again - so 20s keeps an
  // evaluation session warm while still releasing focus once the user has
  // genuinely moved on.
  var IDLE_RELEASE_MS = 20000;
  var idleTimer = null;

  /* ---- keep-warm mode ----------------------------------------------------
   * The 20s idle-release above is right for the BACKGROUND case (context
   * left running after the last tap, then genuinely abandoned) but wrong for
   * the moment a chord-interactive surface (Practice/Stage, Compose, the
   * backing-track Studio) first OPENS: the very first tap on that surface
   * still pays the ~0.5s resume() lag if the context happened to be
   * suspended from a prior idle gap, and that first tap is exactly the one
   * a musician judges immediacy by.
   *
   * keepWarm()/releaseWarm() suppress the idle-release entirely while such a
   * surface is on screen (so `whenRunning` above always takes its
   * SYNCHRONOUS zero-latency branch) and eagerly resume the context the
   * moment the surface opens, rather than waiting for the first note. They
   * are reference-counted so nested/overlapping surfaces (e.g. the Studio
   * overlay opened while Practice is still technically "current") don't
   * release focus until the LAST one closes.
   *
   * By design this holds audio focus (pauses background music) for the
   * ENTIRE time such a surface stays open and visible, past any idle
   * threshold - immediacy wins for as long as the user is actively on a
   * chord screen (operator-confirmed, standing behavior - not a hedge).
   * Focus is handed back ONLY on: the surface closing (after a short grace
   * so an in-flight strum still rings out) or the tab backgrounding
   * (immediately - the app isn't in the foreground to be heard anyway, so
   * there's no reason to keep another app's audio paused).
   */
  var warmCount = 0;
  // Grace after the LAST warm surface closes, before actually suspending:
  // long enough that a strum triggered right as the surface closes still
  // rings out (strum's default dur is 1.6s), short enough that it isn't the
  // full 20s background-idle window - the user just told us, by navigating
  // away, that they're done with chords for now.
  var SURFACE_CLOSE_RELEASE_MS = 1800;

  function releaseWhenIdle(secondsFromNow) {
    if (idleTimer) clearTimeout(idleTimer);
    if (warmCount > 0) return; // a surface is open: stay running, no idle-release
    idleTimer = setTimeout(function () {
      if (AC && AC.state === 'running') AC.suspend();
    }, secondsFromNow * 1000 + IDLE_RELEASE_MS);
  }

  // Call when a chord-interactive surface OPENS. Guarded so it's a harmless
  // no-op in a non-browser environment (Node tests) - only the reference
  // count itself needs to be pure/testable there.
  function keepWarm() {
    warmCount++;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      var a = ctx();
      if (a.state !== 'running') a.resume();
    }
  }
  // Call when that surface CLOSES. Once the LAST opener releases (the exact
  // 1->0 transition), re-arm a short grace-then-suspend rather than
  // immediately cutting audio focus. A redundant call while already at 0 is
  // a true no-op - it must NOT re-arm/extend the grace timer, or a stray
  // extra close call would silently push the suspend deadline out forever.
  function releaseWarm() {
    if (warmCount === 0) return;
    warmCount--;
    if (warmCount === 0) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (AC && AC.state === 'running') AC.suspend();
      }, SURFACE_CLOSE_RELEASE_MS);
    }
  }
  function isWarm() { return warmCount > 0; }
  // Eagerly starts the resume() handshake the instant a finger LANDS on a
  // chord control (pointerdown), rather than waiting for the click that
  // actually schedules the note - covers the narrow window right after a
  // surface opens (before keepWarm()'s own resume() has settled) and any tap
  // that lands before keepWarm() ran at all. Idempotent/cheap: a no-op once
  // already running.
  function primeNow() {
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      var a = ctx();
      if (a.state !== 'running') a.resume();
    }
  }
  // Backgrounding the tab hard-releases immediately and unconditionally -
  // regardless of warmCount - because the point of releasing focus is to
  // hand it back to another app the instant this one isn't in the
  // foreground to be heard, not to wait out a grace period.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        warmCount = 0;
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (AC && AC.state === 'running') AC.suspend();
      }
    });
  }

  function freqForString(openFreq, fret) { return openFreq * Math.pow(2, fret / 12); }

  // Run `play` against a running context. If it's already running (the common
  // jam case) schedule SYNCHRONOUSLY - zero added latency; only when suspended
  // (after a long idle, or the very first tap) go through resume()'s promise,
  // because scheduling against a frozen currentTime would drop the note.
  // play(wasRunning): callers use the flag to pick their scheduling pad - a
  // running context schedules reliably ~6ms out, the just-resumed path needs
  // the generous 20ms pad because its clock just unfroze.
  function whenRunning(a, play) {
    if (a.state === 'running') { play(true); return; }
    a.resume().then(function () { play(false); });
  }

  /* ---- voice cache -------------------------------------------------------
   * Re-rendering every string's KS buffer on each tap is synchronous work on
   * the UI thread, right between the finger and the sound. Taps repeat the
   * same string pitches constantly, so the render is cacheable - as long as
   * the per-tap micro-detune rides the SOURCE's playbackRate (see pluckKS)
   * rather than the render input (pitch still shimmers per tap, cache still
   * hits). Key = semitone + brightness bucket + duration bucket; LRU capped so
   * a long session can't hoard buffers (~24 x ~300KB max). Two variants per
   * key (different noise seeds) rotate for tap-to-tap life. Pure key/LRU logic
   * exported for tests. */
  var VoiceCache = {
    key: function (freq, brightness, dur) {
      var semi = Math.round(12 * Math.log(freq / 440) / Math.LN2);
      var bb = Math.round(brightness / 0.05);
      return semi + '|' + bb + '|' + Math.round(dur * 10);
    },
    create: function (cap) {
      var map = new Map();
      return {
        get: function (k) {
          if (!map.has(k)) return undefined;
          var v = map.get(k); map.delete(k); map.set(k, v); // refresh recency
          return v;
        },
        put: function (k, v) {
          if (map.has(k)) map.delete(k);
          map.set(k, v);
          while (map.size > cap) map.delete(map.keys().next().value);
        },
        size: function () { return map.size; }
      };
    }
  };

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

    // Re-tuned 2026-07-24 (UAT: "chord tail still cuts off" even after the
    // exponential-release fix below - diagnosed by RECONSTRUCTING the heard
    // signal: the string barely decayed on its own, so it was still loud
    // (~-13dB) when the release grabbed it at `dur` and yanked it to silence
    // in ~0.5s - THAT fast drop from loud is what read as a cutoff, not the
    // stop itself). Fix: make the string actually ring down to inaudible
    // over a natural, musical time so it is already quiet by the time the
    // release starts.
    //
    // Counter-intuitive but correct: `decay` (the loop's PER-CYCLE loss)
    // must RISE toward 1 as frequency RISES, even though wound (low)
    // strings still ring longer in real SECONDS than thin (high) ones. A
    // low string completes far fewer cycles per second - e.g. low E
    // (82Hz) does ~132 cycles in 1.6s where high E (659Hz) does ~1055 - so
    // to reach the same real-time ring-out, the high string's per-cycle
    // loss has to be much smaller (closer to 1) just to survive that many
    // more cycles. `1 - K*freq^-P` is a power-law fit to a solved decay
    // curve targeting ~-45..-50dB below peak by ~3-4s for the lowest
    // strings and ~1.5-2.5s for the highest (audio-dsp-coach realistic
    // range) - the "low rings longer in real time" law still holds (see
    // test 'low (wound) strings ring longer than high strings'), it's just
    // not decay-parameter direction that encodes it here. Kept < 1 so the
    // loop is always stable.
    var decay = opts.decay;
    if (decay == null) decay = 1 - 0.3 * Math.pow(freq, -0.73);
    if (decay > 0.99985) decay = 0.99985;
    if (decay < 0.94) decay = 0.94;

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

    // Warmth voicing: a body-resonance peak adds wood to fill what the tame
    // lowpass takes; the lowpass cutoff sits at 2600Hz to keep the
    // steel-sparkle band out (uke/nylon character lives ~2-3kHz), with a
    // gentle-knee Q. Partners the softer pick range in strum().
    var body = a.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 120; body.Q.value = 0.7; body.gain.value = 4.5;

    var tame = a.createBiquadFilter();
    tame.type = 'lowpass'; tame.frequency.value = 2600; tame.Q.value = 0.5;

    var comp = a.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.18;

    input.connect(body); body.connect(tame); tame.connect(comp);

    // Pick-scrape input: the tame lowpass would darken the ATTACK along with
    // the sustain, turning the onset into a felt-hammer thud. So the scrape
    // transient enters HERE - straight into the compressor, AROUND body+tame -
    // and the first ~7ms keeps true broadband pluck character while the
    // ringing string stays at the warm voicing. Attack and sustain get
    // independent knobs.
    var scrapeIn = a.createGain(); scrapeIn.gain.value = 1;
    scrapeIn.connect(comp);

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

    bus = { a: a, input: input, scrapeIn: scrapeIn };
    return bus;
  }

  /* ---------------------------------------------------------------------
   * scrapeRender - the pick SCRAPE, rendered to a Float32Array (mono).
   *
   * The moment a pick (or nail) leaves a string is a short broadband
   * friction transient - the "snap" that says PLUCKED. It is not part of
   * the resonating string, so it's rendered separately from ksRender and
   * routed around the master bus's tame lowpass (bus.scrapeIn): the string
   * keeps the warm voicing, the attack keeps its bite.
   *
   * Highpassed white noise (first difference kills the lows) under a fast
   * envelope: ~1ms ramp-in (edge-click insurance), decay to zero across the
   * rest. Pure array math - Node-testable like ksRender.
   *
   *   sampleRate  audio sample rate
   *   ms          transient length in milliseconds (default 7)
   *   opts.level  peak amplitude 0..1 (default 0.5)
   * ------------------------------------------------------------------- */
  function scrapeRender(sampleRate, ms, opts) {
    opts = opts || {};
    ms = ms == null ? 7 : ms;
    var n = Math.max(4, Math.round(sampleRate * ms / 1000));
    var lvl = opts.level == null ? 0.5 : Math.max(0, Math.min(1, opts.level));
    var out = new Float32Array(n);
    var ramp = Math.max(2, Math.round(sampleRate * 0.001)); // ~1ms ramp-in
    var prevW = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      var hp = (w - prevW) * 0.5; // first-difference highpass, kept in [-1,1]
      prevW = w;
      var env = (i < ramp ? i / ramp : 1) * Math.pow(1 - i / n, 2);
      out[i] = hp * env * lvl;
    }
    return out;
  }

  /* ---- natural release (chord-tail UAT: "cuts off abruptly instead of
   * ringing out") --------------------------------------------------------
   * pluckKS used to play its buffer at a CONSTANT gain and rely solely on
   * ksRender's own 40ms buffer-edge fade to end the note - fine for click
   * safety, but the physical KS decay hasn't reached anywhere near silence
   * by `dur` (a low string is still ~50% amplitude), so that 40ms bake reads
   * as a hard stop, not a ring-out. The fix (audio-dsp-coach: "always
   * release with an exponential ramp, never stop() cold") is a real
   * top-level release on the GAIN NODE: hold at `gain` through the
   * requested `dur`, then fall away exponentially to inaudible over
   * releaseFor(freq) seconds - longer for low/long-ringing strings, same
   * "wound strings ring longer" physics ksRender already models - and only
   * stop() once that fade has actually finished.
   * ------------------------------------------------------------------- */
  var REL_MIN = 0.3, REL_MAX = 0.6, REL_FREQ_SPAN = 400; // Hz taper span
  function releaseFor(freq) {
    var f = Math.max(0, Math.min(1, (REL_FREQ_SPAN - freq) / REL_FREQ_SPAN));
    return REL_MIN + f * (REL_MAX - REL_MIN); // 0.3s (bright/high) .. 0.6s (deep/long-ringing)
  }
  // Pure re-implementation of the exponentialRampToValueAtTime curve pluckKS
  // schedules on the GainNode (WebAudioParam math has no Node stand-in) -
  // exported so the envelope shape itself is node-testable: flat at `gain`
  // through `dur`, then an exponential decay to ~0 across releaseFor(freq).
  function releaseGain(elapsed, dur, freq, gain) {
    var rel = releaseFor(freq);
    if (elapsed <= dur) return gain;
    if (elapsed >= dur + rel) return 0.0001;
    var frac = (elapsed - dur) / rel;
    return gain * Math.pow(0.0001 / gain, frac);
  }

  function tone(freq, dur) {
    dur = dur || 1.1;
    var a = ctx();
    whenRunning(a, function () {
      var o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o2.type = 'triangle';
      o.frequency.value = freq; o2.frequency.value = freq;
      var t = a.currentTime;
      // Release lengthened toward the same natural-ring-out feel as pluckKS
      // (was a hard 0.25s window) - proportional to `dur` so a short
      // reference tone (tuner / playNote) still fits its release inside its
      // own sustain, clamped to the same 0.3-0.6s "feels like a string" band.
      var rel = Math.min(REL_MAX, Math.max(REL_MIN, dur * 0.35));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.04);
      g.gain.setValueAtTime(0.2, t + Math.max(0.04, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g); g.connect(a.destination);
      o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
      releaseWhenIdle(dur);
    });
  }

  // Play one plucked string through the voice cache: render at the CANONICAL
  // freq once (twice, for two variants); every later tap reuses the
  // AudioBuffer and applies its per-tap micro-detune via playbackRate -
  // near-zero work between tap and sound. `m` is the masterBus handle: the
  // string rides m.input (warm voicing); the pick scrape rides m.scrapeIn
  // around the tame lowpass (see scrapeRender). scrape 0 disables it.
  var voiceBufs = VoiceCache.create(24);
  function pluckKS(a, m, freq, det, t, dur, gain, brightness, scrape) {
    var k = VoiceCache.key(freq, brightness, dur);
    var entry = voiceBufs.get(k);
    if (!entry) entry = { freq: freq, bufs: [], i: 0 };
    var buf;
    if (entry.bufs.length < 2) {
      // First (and second) tap of this string: fill a variant. Later taps are
      // pure cache hits - the render cost never sits on the tap path again.
      // Rendered past `dur` by REL_MAX (the longest possible release, so a
      // cache entry shared by two near-identical taps is always long enough
      // regardless of which of them actually rendered it) - otherwise the
      // release scheduled below would run the buffer dry and get silently
      // truncated by the AudioBufferSourceNode ending, right back to the
      // abrupt-cutoff bug this fixes.
      var data = ksRender(a.sampleRate, entry.freq, dur + REL_MAX + 0.05, { brightness: brightness });
      buf = a.createBuffer(1, data.length, a.sampleRate);
      buf.getChannelData(0).set(data);
      entry.bufs.push(buf);
    } else {
      entry.i = (entry.i + 1) % entry.bufs.length;
      buf = entry.bufs[entry.i];
    }
    voiceBufs.put(k, entry);
    var src = a.createBufferSource(); src.buffer = buf;
    // Micro-detune rides playback, not the render - the cache's enabling move.
    src.playbackRate.value = (freq / entry.freq) * det;
    var g = a.createGain();
    var rel = releaseFor(freq), relStart = t + dur, relEnd = relStart + rel;
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, relStart);              // hold flat through the sustain
    g.gain.exponentialRampToValueAtTime(0.0001, relEnd); // then ring out, not cut off
    src.connect(g); g.connect(m.input);
    src.start(t);
    src.stop(relEnd + 0.05);                            // stop AFTER the fade - already silent, no click
    if (scrape && m.scrapeIn) {
      var sd = scrapeRender(a.sampleRate, 7, { level: 1 });
      var sb = a.createBuffer(1, sd.length, a.sampleRate);
      sb.getChannelData(0).set(sd);
      var ssrc = a.createBufferSource(); ssrc.buffer = sb;
      var sg = a.createGain(); sg.gain.value = gain * scrape;
      ssrc.connect(sg); sg.connect(m.scrapeIn);
      ssrc.start(t);
      ssrc.stop(t + 0.02);
    }
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
    whenRunning(a, function (wasRunning) { // sync when already running — see tone()
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
      // Scheduling pad: a running context schedules reliably ~6ms out; only the
      // just-resumed path needs the generous 20ms pad (its clock just unfroze).
      var t0 = a.currentTime + (wasRunning ? 0.006 : 0.02), t = t0, gap = base;
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
        // Scrape intensity (round 3, "keyboard in the attack"): a real pick's
        // snap scales with strum force; up-strums scrape lighter (the pick's
        // back edge). Relative to the string's own gain inside pluckKS.
        var scrape = (0.25 + vel * 0.35) * (up ? 0.7 : 1);
        pluckKS(a, m, v.freq, det, t, dur, gain, bright, scrape);
        // advance the sweep with a little timing jitter (a human isn't exact)
        gap = Math.max(0.006, gap * accel + (Math.random() - 0.5) * 0.004);
        t += gap;
      });

      // +REL_MAX: the idle-release timer must not fire while the last
      // string's natural release tail is still ringing out.
      releaseWhenIdle((t - t0) + dur + REL_MAX);
    });
  }

  global.ChordAudio = {
    tone: tone, strum: strum, freqForString: freqForString, ksRender: ksRender,
    scrapeRender: scrapeRender, VoiceCache: VoiceCache,
    keepWarm: keepWarm, releaseWarm: releaseWarm, isWarm: isWarm, primeNow: primeNow,
    releaseFor: releaseFor, releaseGain: releaseGain
  };

})(typeof window !== 'undefined' ? window : this);
