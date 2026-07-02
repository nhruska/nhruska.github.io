# AI Tutor prototype, wave 2 - AI-controlled challenges

> Completion proxy for an autonomous build. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Nik).
>
> **What this is:** wave 2 of the `music/tutor/` sandbox (wave 1: [TUTOR-PROTOTYPE-CHECKLIST.md](TUTOR-PROTOTYPE-CHECKLIST.md)). Interviewed 2026-07-02: the AI now genuinely *acts* on a practice widget (set key/mode, build a progression, transpose, pick a mock track) to run scripted microlearning "challenges" - demo the move, hand control to you, check your answer, give feedback.
>
> **What this is NOT:** still not the real Compose/Tracks. Per this interview, the widget is a **tutor-owned mini clone** (own state, own small chord picker seeded from `Circle.diatonic`) - `songbook.js`/`tracks.js` are untouched, no new public API on the real app, no iframe embed of `music/play/`. Still scripted, not a live LLM (same as wave 1 - the OpenRouter-proxy-vs-BYOK question stays open).

## Completion condition
> `music/TUTOR-CHALLENGES-CHECKLIST.md` has every box checked, `node test/run-all.js` exits 0, `music/tutor/index.html` renders with zero real console errors at desktop (1440x900) and phone (375x812) via Playwright while driving one full challenge end to end (demo -> your-turn -> check -> feedback), and the PR is updated with a preview link + detailed comment.

## Scope
- **In:** `music/tutor/mini-compose.js` (pure state + action reducers: `setKey`, `buildProgression`, `addChord`, `removeLast`, `clearProgression`, `transpose`, `selectTrack` - reuses `Circle.js` for diatonic chords/transpose/roman numerals, same theory engine the real app uses). `music/tutor/challenges.js` (challenge definitions: intro text, demo actions with pacing, a "your turn" prompt, a pure checker fn). A practice-widget panel in `music/tutor/index.html` (key/mode chip, progression chips, a small in-key chord picker for the user's turn, a mock track pill, a "Check my answer" button) that both AI demo-actions and user taps drive through the same reducer. A "Try a challenge" entry point from the existing quick-replies.
- **Out:** `songbook.js`, `tracks.js`, any change to the real Compose/Tracks/Practice surfaces, real audio/YouTube track data (the track pill is a mock label, not a real search), a live LLM call, more than 2 challenges this pass (depth over breadth, per wave 1's priorities - carried forward).

## Guardrails (unchanged from wave 1, still apply)
- No secrets, no real LLM/network call, no push to `main`, no merge, no nav link, no edits to `songbook.js`/`tracks.js`/real Compose/Tracks.

## Checklist

### Mini Compose clone (pure logic, Node-testable)
- [x] `music/tutor/mini-compose.js` - state shape `{key, mode, progression[], track}`, reducers listed above, `module.exports` + `window.MiniCompose` (same dual-export pattern as `circle.js`)
- [x] Reuses `Circle.js` for diatonic chords / transpose / roman numerals (no re-derived theory)
- [x] `test/mini-compose.test.js` covering every reducer + at least one transpose + one diatonic-chords case

### Challenge engine (pure logic, Node-testable)
- [x] `music/tutor/challenges.js` - 2 challenges: (1) build I-IV-V in a given key by tapping the in-key chords yourself after the AI demos it, (2) a second progression (e.g. ii-V-I) in the same or a new key
- [x] Each challenge: intro text, demo action sequence, "your turn" prompt, pure checker `(state) -> {pass, message}`
- [x] `test/challenges.test.js` covering both checkers pass/fail paths

### Widget UI
- [x] Practice-widget panel in `music/tutor/index.html`: key/mode chip, progression chip row, in-key chord picker (7 diatonic chords, tap to add), Check-my-answer button, mock track pill
- [x] "Try a challenge" quick-reply enters challenge mode; AI demo actions visibly animate the widget with pacing (not instant) before handing control to the user
- [x] After Check my answer: pass -> feedback + "Next challenge"/"Back to chat"; fail -> feedback naming what's off, "Try again"

### Quality gates
- [x] `node test/run-all.js` green (wave 1's 16 suites + this wave's new ones)
- [x] Playwright render-verify desktop + phone, driving one full challenge (demo -> your-turn -> check -> feedback), zero real console errors, screenshots
- [x] `music/TUTOR-ROADMAP.md` prototype section updated with a short wave-2 pointer
- [x] PR updated: commit pushed, detailed PR comment posted, CI watched green
