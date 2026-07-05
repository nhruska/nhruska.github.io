# Vision Capture: Ear-First Player Growth (operator /goal-interview seed, 2026-07-04)

> Captured verbatim-essence; interview PENDING (operator time-boxed - async questions below). This is the north-star doc for the next feature arc.

## Operator verbatim-essence

- "Trying to see where the next features are that move me ahead as a UKULELE player. My ukulele playing has advanced significantly - a whole new outlook and approach to playing guitar. Any strides on ukulele directly translate to guitar. It doesn't matter which one I'm using." (instrument-agnostic growth - the app's profile-agnostic theory core is the right substrate)
- "Next growth areas: more detail about keys and modes and scales; how to BUILD AND CONSTRUCT SONGS coherently, TRANSITION BETWEEN SECTIONS; how to PHRASE solos and notes and where to stick around notes like the 5th."
- **"It's nice to be able to see a scale but we are working with music which is HEARD not seen."**
- "HEARING the difference between scales/modes would help me hum my way through a scale WITHOUT touching an instrument. I teach others by moving my hands on the neck but mostly by HUMMING a major or minor key. I can hum a Mixo and minor pentatonic for sure. That would immediately put me in that jam space and orient me."
- "Well-known songs using it would help with MEMORY. Plus we could hyperlink the suggested backing tracks from YouTube and continue to build our library."

## Decomposition (candidate missions)

| Candidate | What | Connects to |
|---|---|---|
| **M-EAR (the headline)** | Scale/mode AUDITION: tap any scale/mode -> HEAR it (synthesized, hummable tempo/register); A/B mode comparison (major vs mixo vs dorian from the same root); "hum-along" mode (slow, looped, degree-called?) | Strum engine draft PR #88 (Karplus-Strong synthesis = the sound source); audio.js + tuner machinery; the Studio scale surfaces |
| **M-SONG-ANCHORS** | Curated "known songs in this mode/scale" per mode+scale (recognition memory anchors), surfaced beside the scale views + Guide cards; YouTube-linked | songs.json/tracks.json curation pipeline; solo-guide cards; D-HERO-REMOVED constraints (static surfaces only) |
| **M-CONSTRUCT** | Song construction coaching: section building (verse/chorus/bridge), coherent transitions between sections, key/mode moves between sections | Tutor Phase 5 (song-form coaching, ALREADY in MID as M-2) - this vision MERGES with it and sharpens it |
| **M-PHRASE** | Solo phrasing depth: where to hang (the 5th etc.), phrase shapes, tension/release over changes | Extends the shipped mentor layer (targeting/ghost dots/cards); could become dynamic phrase hints; A9 discipline applies hard |
| **Library growth** | Continue building the backing-track library; YT hyperlinks on suggestions | tracks.json + candidates queue (existing machinery) |

## Strategic note

The ear layer makes STRUM-ENGINE REVIVAL (#88, MID M-3) a FOUNDATION item, not a nice-to-have: one synthesis engine serves strum feel AND scale audition. Sequence candidate: revive #88 core -> M-EAR rides it.

## Async interview (answer in shorthand, anytime - one line each)

1. **Sound source bar:** synthesized plucks are enough to orient your ear (fast, offline, free) - or do you want real-instrument samples? (synth = ships this month; samples = asset pipeline)
2. **Hum-along shape:** loop the scale slowly with a visual bouncing degree marker? call the degrees aloud (speech)? or just clean audio loop?
3. **Song anchors:** you name the known-songs per mode (your teaching repertoire = best anchors), or agents draft candidates for your veto?
4. **Where does audition live:** Studio only, or also the Compose key chooser preview (tap = hear the scale you are previewing)?
5. **M-CONSTRUCT merge:** fold song-construction into Tutor Phase 5's sitting item, or its own mission?

## Interview answers (operator, 2026-07-04)

| Q | Answer |
|---|---|
| 1 Sound source | **Synth for now** - lightweight, workflow-first, per-step improvement later. TECH RULING: zero-dependency Web Audio (no Tone.js - 200KB for unneeded capability); `shared/sound.js` provider with a documented SWAP SEAM (Karplus-Strong #88 or samples later swap the provider, consumers untouched) - same seam pattern as spell()/S-BLUES-B |
| 2 Hum-along | **Slow loop + bouncing degree marker** (visual marker tracks the sounding note on the existing notes/degrees line) |
| 3 Song anchors | **Agents draft, operator vetoes** (drafter launched; disputed modal attributions flagged, never asserted) |
| 4 Where | **BOTH Studio and Compose preview** - "we need to hear along with the visuals for cognitive capture" |
| 5 M-CONSTRUCT merge | **OWN MISSION** (not folded into Tutor P5) **with an INTEL component**: research possible future song-construction features (pedagogy scan, comparable-tool scan) feeding its kickoff interview |

## M-EAR wave 1 spec (BINDING)

- **shared/sound.js**: `Sound.noteHz(pc, octave)` (A440 equal temperament), `Sound.playScale(pcs, {rootOctave=4, bpm=~72, loop=true, onNote(i), onStop()})` - one AudioContext (lazy, user-gesture start per autoplay policy), simple envelope oscillator (triangle + decay - hummable, not harsh), loop until stop, octave-folded ascent root->root. THE SWAP SEAM: all timbre inside one internal `voice(freq, t, dur)`; provider swap = future wave.
- **Studio**: a play/stop toggle on the scale panel; while playing, the notes line + degrees line get a moving `.sounding` highlight (the bouncing marker) via onNote(i). Chip switch stops playback. No persistence.
- **Compose key preview**: same toggle on the preview block (W3b region); marker on its notes/degrees lines. Decoupled invariant holds (audio never touches progression state).
- **Verification bar**: pure tests for noteHz (A4=440, C4~261.63, pc wrap) + scheduling math; OfflineAudioContext render test - render a short scale, assert non-silent buffer (RMS > 0) with expected duration (REAL audio evidence, not a mock); live Playwright: toggle -> AudioContext running + marker advances + zero console errors (headless audio = state + marker assertions).
- CACHE bump; consistency lint untouched surfaces; wave 2 candidates (NOT now): A/B mode compare, degree speech, tempo control.
