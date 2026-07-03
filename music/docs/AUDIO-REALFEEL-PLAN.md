# Chord strumming audio - real-feel enhancement plan

Making a tapped chord sound like a *hand strumming a real instrument in a room*,
not a synth stack. Constraints that shape every choice: **no build step**, **no
audio assets** (stays a lean offline PWA), **phone CPU** (Pixel / 8GB Chromebook),
and **don't break the tuner** (its reference tone must stay clean and stable).

The engine lives in [`music/shared/audio.js`](../shared/audio.js). It is derived
purely from a profile's open-string frequencies + a fret array, so one engine
serves every instrument - no per-instrument audio code.

## Why the old engine sounded fake

Each string was two oscillators (triangle + sine at 2.001x) with a fixed
exponential decay. Clean, but: it's an oscillator not a string, every tap is
byte-identical, all strings fire on a rigid 17 ms metronome at the same volume,
and there's no body or room. Real strums differ on all four axes.

## Phase 1 - string model + the hand + the room  (SHIPPED in this PR)

- **Karplus-Strong plucked string** (`ksRender`) replaces the oscillator pluck.
  A noise-burst pick fed round a one-period delay line that a damping lowpass
  bleeds out - a physical model, so it *sounds* like a plucked string. Pure
  `Float32Array` math: renders identically in Node (unit-tested) and the browser,
  zero assets, fully offline.
- **The hand** (`strum`): strings speak in an **accelerating** sweep with timing
  jitter (not a fixed gap), each string **micro-detuned** ~+/-4 cents so the
  chord shimmers instead of phase-locking, and a **velocity roll-off** so the
  pick loses energy across the sweep. Low (wound) strings **ring longer** than
  thin high ones. `direction: 'up'` support (high->low, faster, lighter).
- **The body + room** (master bus): a body-resonance peak (~120 Hz) + a taming
  lowpass (~4.2 kHz) give wooden warmth, a short generated-IR reverb puts it in a
  room, and a compressor glues the strings + guards against clipping when six sum.
- `tone()` deliberately untouched - it's the tuner's pitch reference.
- Tests: [`test/audio.test.js`](../../test/audio.test.js) asserts the physical
  properties (finite, bounded/stable, decaying, low>high sustain, click-free
  ends, fundamental period present, brightness->HF). `node test/run-all.js` green.

**Ear test is Nik's call** - open the preview and tap chords across instruments;
the numbers can't judge "does it feel real".

## Phase 2 - pitch accuracy + expressive pick  (next)

- **Fractional-delay tuning.** Integer delay lengths make high strings up to ~8
  cents sharp. Add a one-pole allpass (or linear-interp read) so pitch is exact -
  matters in a practice app sitting next to a real tuner.
- **Pick position / two-stage excitation.** A short bright transient in front of
  the noise burst = the pick click; brightness could track fret height.
- Optional: comb-notch on the excitation to model pick position on the string.

## Phase 3 - strum *patterns*, not just single strums  (needs engine call-sites)

- Wire `direction` + `velocity` into the jam/compose rhythm so a pattern reads as
  D-D-U-U-D-U with accented downbeats and ghosted up-strums - the difference
  between "chord" and "groove". Requires the songbook/tracks tempo engine to call
  `strum` with per-beat opts (today all call sites use the default down-strum).
- Palm-mute / staccato variant (shorter `dur`, darker `brightness`).

## Phase 4 - per-instrument voice + polish  (taste)

- Small per-profile audio hints (banjo brighter + shorter, mandolin doubled
  courses, ukulele softer) via optional profile fields - default stays universal.
- Light stereo spread across strings for headphones (mono-safe fallback).
- A subtle string-buzz / fret-noise layer on hard strums.

## Test / verify bar (every phase)

- `node -c` syntax + `node test/run-all.js` green (add DSP asserts per phase).
- No-browser surface: state what couldn't be verified; hand over a githack
  preview for the ear test.
- Laptop surface: headless Playwright load of `music/play/`, **zero console
  errors**, before merge.
- **Bump `CACHE` in [`music/sw.js`](../sw.js)** in the same commit as any
  `audio.js` change (it's in `CORE`) or returning users keep the stale asset.
