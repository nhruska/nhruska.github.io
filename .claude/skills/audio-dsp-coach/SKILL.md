---
name: audio-dsp-coach
description: Audio/DSP decision coach for the Music app - tuner signal chain (autocorrelation, clarity gates, smoothing), WebAudio synthesis (strum voicing, envelopes, scheduling), and latency/UX trade-offs. Use BEFORE changing tuner.js or audio.js behavior, tuning thresholds, or adding any sound - never guess a DSP constant. Summoned per the SME dynamic-summoning rule.
---

# Audio/DSP coach

Decide audio behavior from signal principles, not vibes. The app's two audio
surfaces have OPPOSITE priorities: the tuner optimizes TRUST (stable, honest
pitch feedback), playback optimizes FEEL (musical, immediate).

## Tuner chain (tuner.js) - the trust ladder

Signal -> clarity gate -> autocorrelation -> median filter -> note-name
hysteresis -> dropout hold. Rules:

- **Never trade stability for responsiveness silently.** Every smoothing
  constant is a UX decision: more smoothing = calmer needle but laggier
  feel. Change one stage at a time; A/B with a real instrument recording,
  not synthetic sine (real strings have inharmonicity + decay).
- **Clarity gate before pitch.** A pitch shown from a noisy frame is a LIE the
  user tunes to. Prefer "no reading" over a wrong reading - that is why the
  dropout hold exists (brief silence keeps the last trusted value, long
  silence clears it).
- **Hysteresis is per NOTE NAME, not per cent.** The needle may move freely;
  the LABEL must not flap between E and F on a boundary pitch.
- **Status colors are FIXED** (red/amber/green never re-themed) - pitch
  feedback must stay unambiguous (music/CLAUDE.md).
- Low strings need longer analysis windows (low E ~82Hz needs >2 periods in
  the window); if low-string tuning feels wrong, suspect window size before
  algorithm.

## Playback (audio.js) - the feel ladder

- **Strum = per-string delayed starts** (10-25ms stagger reads as a strum;
  >40ms reads as an arpeggio). Down vs up = stagger direction.
- **Envelopes over gain cuts**: clicks come from non-zero-crossing stops -
  always release with a short exponential ramp (>=15ms), never `stop()` cold.
- **Schedule on the AudioContext clock**, never setTimeout, for anything
  rhythmic (backing-track loops, countdowns) - JS timers drift audibly.
- **One AudioContext, resumed on first user gesture** (autoplay policy);
  every play path must tolerate a suspended context (resume-then-play).
- Voice budget: cap simultaneous sources (~12) - mobile WebAudio degrades
  ungracefully; steal the oldest voice instead of stacking.

## Self-check before any audio change

1. Which surface am I on - trust (tuner) or feel (playback)? Their defaults oppose.
2. Did I change one stage/constant at a time, with a before/after listen or
   a recorded-input test?
3. Does the failure mode LIE to the user (wrong pitch, phantom note)? If a
   state can lie, prefer showing nothing.
4. Is anything scheduled off the AudioContext clock that the ear will notice?

## Related

- [music-theory-coach](../music-theory-coach/SKILL.md) - what note it SHOULD be; this skill owns whether the signal path reports it honestly
- music/CLAUDE.md "Tuner trust" convention - the fixed-color contract
