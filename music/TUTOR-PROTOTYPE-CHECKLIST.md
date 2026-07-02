# AI Tutor prototype checklist - conceptual UI/UX exploration

> Completion proxy for an autonomous build. Done = every box `[x]` + tests green + clean preview + PR open. Merge is HITL (Nik), not part of this checklist.
>
> **What this is:** not an implementation of one TUTOR-ROADMAP.md phase - a standalone, unlinked prototype page exploring what a persona-driven / chat-like AI Tutor layer could look and feel like, for Nik to react to before committing to a real architecture or a specific roadmap phase.
>
> **What this is NOT:** it does not touch Compose, Tracks/Practice, or the flattened one-screen layout locked in on 2026-06-29. It does not make a real LLM network call or spend API credits. It is not linked from `music/index.html` nav.

## Completion condition (paste into `/goal`)
> `music/TUTOR-PROTOTYPE-CHECKLIST.md` has every box checked, `node test/run-all.js` exits 0, `music/tutor/index.html` renders with zero console errors at desktop (1440x900) and phone (375x812) via Playwright, and a PR is open against `main` with a curl-verified githack preview link.

## Verification
- `node test/run-all.js` - full dependency-free unit suite, must stay green (currently 15 suites)
- Any new pure-JS logic (provider abstraction, canned-response selection) gets its own `test/*.test.js` self-runner, added to the count above
- Playwright headless render at desktop (1440x900) + phone (375x812): load `music/tutor/index.html`, drive one full sample conversation, screenshot, confirm zero console errors
- `node -c` / `JSON.parse` syntax checks on any new JS/JSON

## Scope
- **In:** a new standalone page at `music/tutor/` (own `index.html`, JS, CSS - can borrow `songbook.css` tokens/vars for visual consistency but is not wired into `Songbook.mount`). A pluggable AI-provider abstraction (e.g. `music/tutor/provider.js`) with one concrete implementation: a canned/scripted provider that answers from a small library of roadmap-grounded responses (parallel vs relative scales, I-IV-V vs i-iv-v, borrowed chords/secondary dominants, a Phase 4 "swap the solo scale over this fixed progression" demo turn, a Phase 5 "let's build a song section by section" demo turn). A settings panel with API key / base URL / model fields shaped for an OpenRouter-compatible endpoint - persists to `localStorage` only, never sent anywhere, never used to make a real fetch in this pass. Update `music/TUTOR-ROADMAP.md` with a short note pointing at this prototype and naming the open architecture question (central OpenRouter-backed proxy vs BYOK) as an explicit follow-up decision, not a resolved one.
- **Out:** Compose/Tracks/Practice/triad-inversions surfaces, `songs.json`/`tracks.json` data, any real outbound LLM API call, any serverless proxy or cloud infra provisioning, adding the prototype to `music/index.html`'s nav, anything that spends API credits.

## Guardrails (never do unattended)
- Never commit a real API key or secret to the repo (settings panel fields stay empty by default; if a placeholder is needed use an obvious dummy like `sk-or-...`)
- Never make an outbound network call to any LLM provider during the build - the canned provider is the only one exercised by tests/Playwright
- Never push to `main` directly - stay on `claude/ai-tutor-prototype-kz5ix1`, open a PR
- Never merge - Nik merges
- Never add the prototype link to `music/index.html` nav without explicit go-ahead

## Abort & surface to human when
- 3 failed attempts at the same verification step (test suite, Playwright render, syntax check)
- The provider-abstraction shape genuinely can't stay stub-only and still feel like a real conversation (i.e. hits a design wall that needs Nik's call on the OpenRouter-proxy-vs-BYOK question to proceed meaningfully) - stop and ask rather than guessing the architecture
- Any ambiguity about whether a UI idea belongs in this prototype vs a later roadmap phase

## Priorities
- Depth over breadth: one polished, believable chat flow demonstrating 2-3 roadmap concepts beats a shallow pass touching all 5 phases
- This is what Nik reacts to next, so the interaction feel (typing indicator, message pacing, tappable quick-replies, etc.) matters as much as the theory content
- Visual language should feel like a plausible extension of the existing songbook theme (reuse CSS custom properties / accent theming), not a disconnected mockup

## Budget
- Prototype-scale: a handful of PR iterations, not a multi-day arc

## Per-iteration context
- Re-read `music/TUTOR-ROADMAP.md` (vision + phase table + locked design decisions) and this checklist every turn
- Treat this checklist as the durable memory of what's done vs left - update boxes as you go, don't re-derive state from scratch
- Follow the project's `CLAUDE.md` surface-aware verification bar (render-verify with real Playwright pixels on the laptop surface) and the `/ship` flow (branch already correct, draft PR, tappable githack preview links, subscribe to PR activity)

## Checklist

### Standalone page
- [x] `music/tutor/index.html` - persona-driven chat-style layout (message list + input), reuses `songbook.css` accent theming
- [x] Not linked from `music/index.html` nav (sandbox only)
- [x] Mobile-first layout, one-screen where reasonable, phone-DPI-safe text per CLAUDE.md floor

### Provider abstraction
- [x] `music/tutor/provider.js` (or equivalent) - defines a small interface (e.g. `sendMessage(history, context) -> response`) so a real backend can be swapped in later without touching the UI
- [x] Canned/scripted provider implementation covering at least: parallel vs relative scales, I-IV-V vs i-iv-v, one Phase 4 "swap solo scale over fixed progression" demo turn, one Phase 5 "build a song section by section" demo turn
- [x] Settings panel: API key / base URL / model fields (OpenRouter-compatible shape), persists to `localStorage`, explicitly labeled experimental/not-yet-wired, no fetch call wired to it in this pass

### Roadmap note
- [x] `music/TUTOR-ROADMAP.md` updated with a short pointer to this prototype + the open architecture question (central OpenRouter proxy vs BYOK) named as an unresolved follow-up

### Quality gates
- [x] New unit tests added for any new pure-JS logic, `node test/run-all.js` green
- [x] `music/tutor/index.html` loads with zero console errors at desktop (1440x900) + phone (375x812) via Playwright; one sample conversation driven end-to-end; screenshots captured
- [x] PR opened from `claude/ai-tutor-prototype-kz5ix1` with V&V block + a curl-verified githack preview link
