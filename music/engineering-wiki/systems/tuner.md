# Tuner - Guided Tune loop + the trust chain

> The Tune tab is a tuner-first utility: fast, easy, accurate. It runs a
> deterministic GUIDED loop by default (Start -> lowest string -> approach
> from flat -> sustained arrival -> landed -> auto-advance -> done) and keeps
> the old free auto-recognition behind a non-default chip. Origin + measured
> root cause: [design-tuner-goal-flow-20260912](../../../docs/plans/design-tuner-goal-flow-20260912.md).

[Index](../index.md) > systems > tuner

## Modules

| File | Owns |
|---|---|
| `music/shared/tuner.js` | DSP (`detectPitch` free-band NSDF, `detectPitchNear` known-target NSDF, `cancelDrone`), the mic plumbing, the reference-tone drones, the Tune-tab UI (runway, progress row, mode chips) |
| `music/shared/tune-flow.js` | `TuneFlow` - the pure, DOM-free guided state machine (median + EMA smoothing, arrival hold, celebration, advance order). All time comes from the caller's `nowMs`; testable without a mic |
| `tools/tuner-lab.js` | Offline experiments against the real detector (synth strings + the app's own drone). Re-run before quoting any tuner number |

## The two detectors

| | `detectPitch(buf, sr, fmin, fmax)` | `detectPitchNear(buf, sr, fTarget)` |
|---|---|---|
| Job | identify which string is sounding (free mode) | measure cents from ONE known string (guided mode) |
| Search | whole instrument band, first strong NSDF peak (octave-error cure) | lags T/2.5 .. 1.4T, strongest key maximum inside -500..+300 cents of the target |
| Octave errors | possible in principle; guarded by the first-peak rule | impossible by construction - both octaves fall outside the window |
| Gotcha | feeding it a NARROW band returns -1 on a fundamental-heavy tone (its first-negative-crossing gate can start inside the fundamental's own lobe). Pinned in `test/tuner-near.test.js` | none known |

`cancelDrone(buf, sr, f0)` subtracts the least-squares projection at f0 and
5f0 (the drone is sine + triangle; 3f0 is deliberately left alone - the string's own 3rd lives there, and stripping it leaves an even-only residual the sub-harmonic guard rejects) and returns a new buffer. Why it exists:
the speaker drone enters the mic and pulls the autocorrelation toward
itself - at 4x the string a -8 c string read -2.8 c (GREEN). With
cancellation it reads -6.3 c. Beats stay audible to the ear; the detector
hears the string.

## The guided loop (TuneFlow)

```
idle -start-> approach -(|cents| <= 2 c)-> arriving -(held 600 ms, voiced)-> landed
landed -(700 ms)-> approach on the next undone string ... -> done (last string)
```

- **Approach from flat is the designed path** (operator model: nobody tunes
  down - slack settles flat). Hints: `flat` <= -4 c, `sharp` >= +3 c, else
  `near`. Sharp is overshoot: normal, never an advance.
- **Arrival ACCUMULATES.** Voiced in-zone time (|cents| <= 2.5 c) adds up to
  `holdMs` (450) across brief dips - a pluck decaying, a flat-side wobble
  of < 2 c outside the zone pauses the hold; only a pause longer than
  `gapMs` (700), a sharp read, or a real departure resets it. `holdProgress`
  (0..1) drives the bar under the post. (UAT batch 1: the first cut reset on
  every 150 ms clarity dip and a real pluck could never land.)
- **The ratchet - the peg is the controller.** A read moving UP shows at
  once; a flatter read must persist `dropFrames` (6) frames by `dropCents`
  (1.5) before the needle drops. Flat side only: from overshoot, a drop is
  the way home and shows immediately.
- **Smoothing lives in the flow, not the UI**: 5-frame median, distance-keyed
  EMA (0.35 / 0.16 / 0.07), 40 c glitch rejection adopted after 4 agreeing
  frames. Retarget resets it (first voiced frame snaps).
- **Retarget** from any phase but done: string-button tap, or the flow's own
  advance. Advance goes to the next NOT-yet-landed string, wrapping.
- **Done** stops the mic and the drone (battery, privacy).

## UI contract (tuner.js guided mode)

| Element | Role |
|---|---|
| `#micNote` / `#micCents` | target note + one-line status (cents + direction, or the landing check) |
| `#micRunway` (`.runway`) | the instrument: `.rwPuck` travels toward `.rwPost` at 60 %; classes `waiting` / `arriving` / `landed` / `sharp` |
| `#micHold` | hold-progress bar under the post |
| `#tStrings .tStr` | the PROGRESS row: `.cur` = current target (lit, droning), `.done` = landed (green check). Tap = retarget while guided; tap = toggle a reference tone while idle |
| `#micToggle` | Start / Stop (Start again after done) |
| `#toneToggle` | drone on/off, remembered in `music.tuner.tone.v1` (default ON) |
| `.micModes` chips | Guided (default) / Any string (the legacy free-recognition mode, needle + meter) |
| `Tuner._sim` | `{ start(), feed(cents|null, nowMs), state() }` - test hook that drives the SAME flow + render path without a mic (`test/pw/scenarios/tune-guided.json`) |
| `?tunerlab=1` | URL flag (sticky via `music.tuner.lab.v1`): a "Tuning lab" disclosure below the string row with a slider per feel knob (`TuneFlow.DEFAULTS` + the mic clarity thresholds), live phase/raw/shown/hold/clarity readout, and a one-line `key=value` report string. Values persist in `music.tuner.params.v1` and apply live via `flow.set()`; Reset clears them. The operator tunes the feel on the instrument and reports the line |
| `?tunerdemo=1` | URL flag: a scripted approach-from-flat per string fed through `Tuner._sim`, so a branch preview animates the whole loop on any phone with no mic - the demo handle for [branch prototypes](../workflows/branch-prototypes.md) |

Fixed contracts: status colours stay red/amber/green (never accent-themed);
prefer no reading over a wrong reading; haptics = ONE 30 ms pulse on landed,
nothing else (a phone lying on the instrument couples any buzz into the top).

## Testing

| Gate | Proves |
|---|---|
| `test/tuner.test.js` | free-band detector: every string, no octave errors |
| `test/tuner-near.test.js` | known-target detector within 2 c, the narrow-band gotcha, the drone pull and its cancellation |
| `test/tune-flow.test.js` | hold requirement, sharp/gap resets, celebration, advance order, retarget, done |
| `test/pw/scenarios/tune-guided.json` | the rendered loop end to end via `Tuner._sim` at 412x915 |
| Recorded-instrument fixtures | NOT YET - every constant above was tuned on synthetic tones; the operator's recordings are the next regression (design doc U6) |
