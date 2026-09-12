# Design: Guided Tune - the tuner as a goal flow (2026-09-12)

> Brainstorm partner output for the Tune tab. Operator friction (verbatim
> summary below) + root cause measured against the real detector + a design
> the operator can approve in one digit + the atomic build plan. Numbers
> quoted here come from `node tools/tuner-lab.js` - re-run it before trusting
> them. Status: **DESIGN, awaiting operator answers** (interview queue at the
> bottom, every question carries an assumed answer so the build can start).

[Queue row](QUEUE.md) | [tuner.js](../../music/shared/tuner.js) | [lab](../../tools/tuner-lab.js)

## 1. The friction (operator, 2026-09-12)

| # | What the operator said | Category |
|---|---|---|
| F1 | The mic auto-recognition "jumps around", never eases from flat up into tune. Unused. | late-failure (shipped feature unusable in real use) |
| F2 | People tune UP from flat (tuning down leaves slack; the string goes flat again as it settles). The tuner should expect and reward the approach from flat. | decision-ambiguity (no stated model of the user's motion) |
| F3 | The cents number has always been decent. | keep |
| F4 | Haptics buzz when off the note. Phone flat on the guitar body (dobro-style) makes vibration a liability. "Don't need it at all - possibly when the goal is hit." | late-failure |
| F5 | Real workflow: the string buttons, low to high, tuning by ear to the beats. Tone + mic together worked at low volume; turned up, the tuner "pegged to tuned" while the string was still flat. Wants both together. | late-failure |
| F6 | Tuner-first utility: fast, easy, accurate. "Cool is not the spec." Beat a Snark or scrap the needle. | vision |
| F7 | One Start button, begins on the lowest string, no note identification, auto-advance to the next string when the goal post is hit, buttons still accept manual input. | vision (the spec seed) |

CE lesson (process, not product): every tuner constant was tuned against
SYNTHETIC tones (`test/tuner.test.js`). The audio-dsp-coach already says
"A/B with a real instrument recording, not synthetic sine". Nothing in the
repo holds a recording, so F1/F5 were unreachable by any test we run. Fix in
this arc: a recorded-fixture harness (item U6 below).

## 2. Root cause, measured

Three separate defects hide behind "the mic mode is buggy".

### 2a. Identification is the wrong job (F1, F7)

`micLoop` runs `detectPitch` over the WHOLE instrument band every frame,
then `nearestString` guesses which string you meant, then note-name
hysteresis (5 frames, 20 cents margin) fights the guess. Every one of those
stages exists only because the tuner does not know which string you are on.
The operator's workflow (F7) already knows: low to high, one at a time.

Measured: with a target string KNOWN, the search window can exclude both
octaves by construction, so there is nothing to identify and nothing to
flip. `detectPitchNear` (prototype in the lab) reads the low E within
1.4-1.8 cents across every harmonic balance tried, 0/60 frames off-target
through a simulated pluck decay.

Honest caveat: the synthetic low E did NOT flip in free mode either (0/60
frames wrong string). The jumpiness the operator sees on the phone is not
reproduced by clean synthetic tones - which is the CE lesson above, and the
reason the fix is structural (remove identification from the guided path)
rather than another threshold tweak. A recorded fixture is what makes the
free mode's real failure visible.

Implementation gotcha found: feeding `detectPitch` a NARROW band around the
target returns `-1` for a fundamental-heavy tone. Its key-maxima scan
skips everything before the first negative zero-crossing, and a narrow band
can start inside the fundamental's own positive lobe. The guided detector
must scan from about T/2.5 and then window the accepted peak. The lab table
E1 column "NARROW-band detectPitch (gotcha)" is the regression test for this.

### 2b. The drone pulls the reading toward "in tune" (F5)

Playing the reference tone through the speaker while the mic listens puts
the drone INTO the detector. The autocorrelation of two close tones peaks
between them, pulled toward the louder. Measured (A string, drone at the
app's sine+triangle mix):

| String is | Drone/string amplitude 0.25 | 1 | 4 |
|---|---|---|---|
| -30 c flat | reads -28.6 c | -24.4 c | **-10.1 c** |
| -15 c | -13.9 c | -11.6 c | **-5.3 c** |
| -8 c | -7.1 c | -5.9 c | **-2.8 c (shows GREEN)** |

That is exactly the operator's observation: quiet drone fine, loud drone
"pegs to tuned". Fix measured: subtract the KNOWN drone (least-squares
projection at f0, 3f0, 5f0 - we generate it, so its frequency and shape are
exact) before detection. With cancellation, drone at 4x the string reads
-27.4 / -12.6 / -6.3 c for the three rows above, and within 1 c at equal
level. The beats the operator likes hearing are untouched - the ear hears
the mix, the detector hears the string.

Sign of the beat is not recoverable from the ear alone, but the flow makes
it unambiguous: you approach from flat, so slowing beats mean "keep coming".

### 2c. Haptics fire on the wrong event (F4)

Today: 25 ms tick on lock, a triple buzz whenever the read crosses into
sharp. On a phone lying on the instrument the buzz couples into the top and
the mic. The sharp buzz also fires on every overshoot wobble. Remove both
event triggers; keep at most ONE pulse on goal-hit (interview Q2).

### 2d. Why it never "eases in" (F1, F2)

The needle chain is honest but built for a stationary read, not a motion:
93 ms window + 8-frame median (~130 ms) + a 0.07 EMA near centre (~240 ms
time constant) is roughly 400+ ms behind a peg being turned. Then the lock
latches after only 8 frames (~130 ms) inside a +/-3 c zone and drops the
instant it reads sharp, so the moment of arrival flickers. The colour
semantics (amber flat, red sharp) are already right for tune-up-from-flat;
the MOTION is not.

## 3. What a Snark does right, and where we beat it

| Snark | Us today | Guided Tune |
|---|---|---|
| Piezo pickup: hears only the instrument | Phone mic hears the room and our own drone | Known-string window + drone cancellation - the software version of "hears only the string" |
| Big needle, sub-second read, no menu | Needle, but identification lag + hysteresis | Cents-from-THIS-string, no identification stage, faster median |
| Hard visual lock (green) | Lock latches in 130 ms, drops on wobble | Lock = sustained arrival, then a landing you can feel |
| One note at a time, you pick by ear | Auto-ID guesses | Deterministic string order + auto-advance; buttons still take input |
| No reference tone | Drone, but it corrupts the needle | Drone + needle together, beats audible |
| Needs a battery and a clip | - | Already on the phone, offline PWA |

Verdict: we cannot match a piezo's isolation, but a KNOWN target plus
cancellation removes the two failure classes a mic has and a clip-on does
not. The auto-advance loop is something a Snark cannot do at all.

## 4. The design: Guided Tune

Situation of use (ux-coach): phone propped or lying on the lap, one hand on
a peg, eyes half on the screen, ~20 seconds per string, six times. First
job: get string 1 in tune with zero taps after Start.

### The loop

```
Start  ->  target = lowest string (drone on, mic on)
       ->  APPROACH: read cents vs target only; needle/runway shows distance
       ->  ARRIVE: within +/-2 c for ~600 ms of voiced frames  ->  LANDED
       ->  celebrate (~700 ms: post lights, ring, check)  ->  advance
       ->  next string ... last string  ->  DONE (mic + drone off, Restart)
```

- **No identification.** The detector answers one question: how many cents
  from the target. Off-window energy (wrong string, noise) shows as "waiting
  for <target>", never as a switch.
- **Approach-from-flat mechanics (F2).** The runway reads left (flat) to
  the goal post. Marker travels toward the post as you tighten. Arriving
  from the flat side is the designed path: amber -> green. Overshoot puts
  the marker PAST the post in red with "back off, then come up" - the
  string comes back through the post from the correct side. Zoom near the
  post as today (4 %/cent inside +/-10 c) so the last few cents are visible.
- **Motion tuned for a moving peg.** Median 5 (not 8) in guided mode, EMA
  keyed to velocity, and lock requires ARRIVAL (sustained), not a
  130 ms blip. Lock then holds through a small wobble. Deterministic numbers
  live in the state machine, testable in Node.
- **Drone on by default in guided mode** at a moderate fixed gain, with
  cancellation in the detector. One toggle ("Tone") remembers the choice.
  Beats audible; the needle keeps telling the truth.
- **Buttons stay.** The string row becomes the progress row: done strings
  ticked, current string lit. Tapping any string retargets immediately
  (accepts input, F7). Retarget also swaps the drone.
- **Haptic**: one 30 ms pulse on LANDED, if the operator wants it at all
  (Q2). No off-note buzz, ever.
- **Free mode** ("any string", today's auto-ID) becomes a secondary chip or
  is retired (Q4). It is not the default.
- **Fast.** One tap. Mic permission asked once. No modal, no setup. Done
  state stops the mic (battery, privacy).

### Fixed contracts (do not relitigate)

- Status colours stay fixed red/amber/green (music/CLAUDE.md "Tuner trust").
- Prefer no reading over a wrong reading (audio-dsp-coach).
- One screen above the fold: the runway + target + progress row must fit
  412x915 without scrolling; the strobe strip is the first candidate to cut.
- SW cache bump + build stamp per asset-changing commit; version = PR number.
- All CSS external.

## 5. Interview queue (async - answer any subset; unanswered rows build on the assumed answer)

| # | Question | Assumed answer | Basis |
|---|---|---|---|
| Q1 | Drone ON by default in guided mode? | Yes, moderate level, "Tone" toggle remembered | F5: he tunes to the beats |
| Q2 | Haptic: single pulse on goal-hit, or none at all? | Goal-hit only, one 30 ms pulse | F4 verbatim: "possibly when the goal is hit" |
| Q3 | Visual: evolve the needle into a runway-to-goal-post and DROP the strobe strip, or keep both? | Runway, strobe cut | F6 "make the needle feel right"; one-screen rule; he never mentioned the strobe |
| Q4 | Keep free auto-ID as a secondary "any string" chip, or retire it? | Keep as a non-default chip this round; retire next round if unused | Cheap to keep; F1 says he never uses it, so it must not be the default |
| Q5 | Landing feel: hold ~600 ms to lock, ~700 ms celebrate, then advance - or snappier? | 600 / 700 | Deterministic, testable; tune by feel in UAT |
| Q6 | String order: always the profile's low-to-high, including drop tunings? | Yes | F7 "begins on lowest string" |

## 6. Atomic build plan (parallel-safe)

| Unit | Scope | Files | Gate | Parallel with |
|---|---|---|---|---|
| U1 DSP | `detectPitchNear(buf, sr, fTarget)` + `cancelDrone(buf, sr, f0)` in tuner.js DSP block, exported for Node | tuner.js (DSP section only), test/tuner-near.test.js | Lab tables E1/E3 as assertions incl. the narrow-band gotcha; `node test/run-all.js` green | U2, U6 |
| U2 Flow | `TuneFlow` pure state machine: states idle/approach/arriving/landed/done, inputs = per-frame {cents, voiced}, outputs = events (retarget, landed, advance, done) + the smoothed needle value | music/shared/tune-flow.js (new), test/tune-flow.test.js | Node tests: arrival requires 600 ms sustained, overshoot never advances, retarget mid-flow, done stops | U1, U6 |
| U3 UI | Guided mode in tuner.js: Start wires TuneFlow + detectPitchNear + drone with cancellation; runway/goal-post markup + CSS; string row as progress; haptic on landed only; free mode behind a chip | tuner.js (mic/UI block), songbook.css, index.html copy | Render-verify 412x915 + desktop, zero app console errors; SW bump + stamp | after U1+U2 (locked seams below) |
| U4 Scenario | PW scenario `tune-guided.json` driving a test hook `Tuner._feed(cents, voiced)` so the flow is provable without a mic; red first | test/pw/scenarios, runner verb if needed | Scenario RED on main, GREEN on branch | after U3 |
| U5 Spec | engineering-wiki page `systems/tuner.md` (none exists today), QUEUE reconcile, decisions.md entry | wiki, docs/plans | validate links; wiki-sync line in PR | U1-U3 |
| U6 Fixtures | recorded-instrument harness: `test/fixtures/audio/*.wav` (operator records 6 strings, flat -> in tune, plus one with the drone on) + a Node decoder feeding `detectPitchNear`; first real-input regression | tools/, test/ | Assert cents track within 3 c of a hand-labelled reference | U1, U2 (needs operator recordings) |

Locked seams (verbatim in every spawn): `detectPitchNear(buf:Float32Array, sr:number, fTarget:number) -> {freq:number, clarity:number}` (freq -1 when nothing voiced in window); `cancelDrone(buf, sr, f0) -> Float32Array` (new buffer, input untouched); `TuneFlow.create({strings, holdMs, celebrateMs}) -> {feed(cents|null, nowMs), retarget(i), state(), on(event, fn)}`, events `retarget|landed|advance|done`, cents `null` = unvoiced frame.

## 7. Verification plan

- Node: every threshold in U1/U2 has a test that fails without it (proven
  red once, per evidence-integrity).
- Live: render-verify at 412x915 (Pixel-class) and 1440 in both themes;
  zero app console errors; tap targets >= 44 px on the progress row.
- Device UAT (operator, guitar on lap): Start -> six strings with no taps;
  drone on; phone flat on the body; read the build stamp first.
- Recorded fixtures (U6) become the standing regression for the mic path.

## 8. Not doing (this round)

- Beat-rate display from the envelope. The cancelled-drone needle already
  gives sign and magnitude; a beat counter is slower (a 2 c error on low E
  is one beat every 10 s) and duplicates the needle.
- Alternate temperaments / A4 != 440. Out of scope, no ask.
- Polyphonic (strum all six) tuning. Different problem, different detector.
