# AI Tutor prototype, wave 3 - soloing challenges

> Completion proxy for an autonomous build. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Nik).
>
> **What this is:** wave 3 of the `music/tutor/` sandbox (wave 1: [TUTOR-PROTOTYPE-CHECKLIST.md](TUTOR-PROTOTYPE-CHECKLIST.md), wave 2: [TUTOR-CHALLENGES-CHECKLIST.md](TUTOR-CHALLENGES-CHECKLIST.md)). Directed 2026-07-02: wave 2's two challenges were "beginner/onboarding for HOW to use Compose" (build a progression). Wave 3 graduates to USING what you built - solo over it, transpose and solo again, solo over a (mocked) backing track, then swap the lens to the relative minor and solo again. Each challenge ends with a shared reflection check-in ("how did that feel").
>
> **What this is NOT:** still not the real Compose/Tracks (same tutor-owned mini-clone boundary as waves 1-2). Still no real YouTube embed - the backing-track challenge uses a relabeled mock track pill, confirmed explicitly this session. Still scripted, no live LLM.

## Interview outcome (2026-07-02, recorded here per this session's two calls)
- **"Check my answer" for a solo exercise = identify the scale** via multiple-choice chat quick-replies (reuses existing UI, no new fretboard/mic widget) - PLUS a shared reflection step after every pass asking how it felt / what clicked / what's still fuzzy.
- **YouTube stays mocked** - no real network/embed this wave, guardrails from waves 1-2 hold.

## Checklist

### mini-compose.js
- [x] New `reinterpretKey(state, root, mode)` reducer - same fields as `setKey` but does NOT clear the progression (the "same chords, new lens" move `setKey`'s fresh-start semantics can't express)
- [x] `test/mini-compose.test.js` covers reinterpretKey (changes key, keeps progression, no mutation)

### challenges.js
- [x] Challenge shape extended with a `kind` field: `'build'` (wave 2, unchanged) or `'identify'` (new: `question`, `options(state)`, `correct(state)`, `check(state, chosenId)`)
- [x] 4 new `'identify'` challenges: solo-over-it, transpose-and-solo, solo-over-track (mocked), relative-swap-solo (uses `reinterpretKey`)
- [x] Shared `REFLECTION_OPTIONS` / `REFLECTION_RESPONSES` / `REFLECTION_PROMPT` - authored once, run generically after any challenge's pass (not per-challenge)
- [x] `test/challenges.test.js` covers all 6 challenges, both kinds, pass/fail paths, and the reflection data

### Widget + chat UI (music/tutor/index.html)
- [x] `applyDemoAction` extended for `reinterpretKey`, `selectTrack`, and a visual-only `highlight` no-op beat
- [x] New `appendChoiceReplies(items, onPick)` - buttons with their own direct click handler, for anything that controls challenge-flow state (scale answers, "Next challenge", reflection picks). Replaces wave 2's fragile capture-phase-listener workaround for label collisions.
- [x] `startChallengeFlow` branches by `challenge.kind`: `'build'` -> existing widget picker; `'identify'` -> demo, then `askIdentifyQuestion` (question + scale-option quick-replies)
- [x] Restarting from challenge 1 resets `widgetState` to the original key/mode (guards against replay inheriting a later challenge's key reinterpretation)
- [x] **Bug found + fixed during this wave's own verification** (not from a DOM assertion - from watching the actual replay break): quick-reply rows are chat history and never get removed, so with 6 challenges multiple identically-labeled "Next challenge" rows are simultaneously live in the DOM. Fixed by disabling every button in a `.quickReplies` group once any one of them is used (`disableGroup`), so stale rows stay visible as history but are no longer actionable.

### Quality gates
- [x] `node test/run-all.js` green (18 suites: wave 1/2's 16 + updated `mini-compose.test.js`/`challenges.test.js`)
- [x] Playwright render-verify desktop + phone, driving the FULL 6-challenge arc end to end (both build challenges, all 4 identify challenges, every reflection step), zero real console errors, screenshots
- [x] Wrong-answer path verified for an `'identify'` challenge (not just `'build'`): specific feedback, question re-presented with fresh enabled options, correct retry advances normally
- [x] `music/TUTOR-ROADMAP.md` updated with a wave-3 pointer + a new "what Phase 5 would need" discovery section (song-structure/section-transitions), per this session's ask to scope that direction without building it yet
- [x] PR updated: commit pushed, detailed PR comment posted, CI watched green
