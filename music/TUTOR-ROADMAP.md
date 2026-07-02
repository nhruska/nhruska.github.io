# Music app - AI tutor roadmap

> The north star and the build order. The Compose key-subsystem work was the foundation; this is the curriculum the app teaches and the order we build it in.

## Vision

An adaptive AI music tutor whose destination is **soloing and songwriting confidence**. The loop: Compose a progression -> jam/solo over it with scale guidance -> understand why it works -> build it into a song form. Key is the spine; theory is taught in context, on demand, never as a wall.

**Scope (this app): solo-practice accountability.** Pick a key + mode -> get a harmonized progression in that key/mode -> solo over it. The one key/mode filter drives the progression directly (root change transposes, mode change re-harmonizes), so the chords always match the chosen key/mode without an extra step. Composer-grade nuance (odd keys, hand-tuned borrowed-chord voicing, freezing chords against a mode change) is deliberately out of scope here - if it's wanted, it belongs in a separate composing-focused app, not this practice loop.

## The curriculum (also the build order)

| Phase | Capability | Status |
|---|---|---|
| 0 | **Chord building foundation** - unified song key, compact key bar, transpose==key sync, all-chords sharps/flats, suggestions+common-progressions merge | DONE (PR #50/#52/#56) |
| 1 | **Adaptive chord surface** - one picker that LEADS with the in-key diatonic chords (tracks key + mode) and keeps "+ all chords" one tap away for borrowed/secondary/blues | DONE (PR #57) |
| 2 | **Modal interchange (auto)** - the key/mode filter ALWAYS re-harmonizes the built progression to the chosen mode (e.g. C major I-IV-V -> C minor i-iv-v: same roots, qualities flipped). No separate button - changing the mode re-harmonizes the chords. Distinct from transpose (which shifts roots, keeps qualities). Best-effort: a chord whose root is not a degree of the target mode is left unchanged | DONE (PR #58) |
| 3 | **Backing-track soloing + scale guidance** - once key + mode + progression are established, search YouTube for a matching backing track (optional genre, or no-genre for different grooves to solo over); show the scale to solo over, on the fretboard | DONE - a "Solo over a backing track" CTA in Compose carries the built key+mode into the Tracks finder (matched tracks + solo-scale panel + per-track fretboard studio). The finder + studio already existed; Phase 3 is the bridge. |
| 4 | **Relative / parallel scale demos** - over the same backing, swap compliant scales and explain why: A minor over a C major progression (relative - same notes), then switch the backing to C minor and solo C minor (parallel - different notes). NOTE: since the mode toggle now re-harmonizes the chords, "solo a different scale over a FIXED progression" likely needs a SEPARATE scale selector (decoupled from the key/mode filter that drives harmonization) | PARTIAL (teaser) - the finder's mode chips already act as a decoupled solo-scale selector + it teaches relative minor. Full Phase 4 (swap the solo scale over the FIXED Compose progression, in place) is still open. |
| 5 | **Song-form coaching** - AABA, intro/verse/chorus/bridge; guide building a coherent whole song from sections | PLANNED |

## Locked design decisions

- **Compose = FLATTENED one-screen layout** (revised 2026-06-29, device-test feedback - replaces the accordion form below): no `<details>` accordions. A FIXED top region (does NOT scroll) holds, top to bottom: the button bar (transpose + Clear/Save + a "?" help button), the progression box (empty -> tappable starter progressions inside it; non-empty -> the built chords + next-chord suggestions; "?" re-shows the starters at any time), a compact "C Major v" key/mode chip, and the In-key|All filter toggle. Tapping the chip opens a fly-out with the 12 roots + the maj/min/mixo/dor mode toggle + the solo scale (scale + HSR I-IV-V chain + inversions link); it collapses back to the chip on a pick. The ONLY scroll area is the chord list below the fixed region. Redundant labels ("Chords in <key>", section headers) were dropped - the chip already names the key. This also fixes the lingering in-key swipe bug: a single flat scroll container (no nested accordion scroller) lets vertical swipes scroll the in-key cells cleanly.
- **Chord picker = adaptive, ONE list** (Phase 1): a single chord list with the In-key|All toggle - In key leads with the diatonic chords (change with key AND mode), All preserves out-of-key access via the chromatic grid + type tabs. Guided by default, unrestricted on demand. Decided 2026-06-29 via use-case/human-factors/theory review; flattened one-screen form via device-test feedback.
- **Transpose == song key** (Phase 0): one unified `songKey`; transposing moves the key, picking a key transposes the progression (by tonic delta), the readout shows root + mode. No drift.
- **Mode toggle ALWAYS re-harmonizes the progression** (revised 2026-06-29, device-test feedback - reverses the earlier "scale-context-only" decision for this app's solo-practice scope): the one key/mode filter is a single control that drives the built chords. A root change transposes, a mode change re-qualifies (modal interchange), so the chords stay in the chosen key/mode automatically. The separate "Re-harmonize to <mode>" button was removed. Rationale: this app is solo-practice, not composing - the user wants pick-key-and-mode -> harmonized progression -> solo, not the ability to freeze chords against a mode change. (If freezing is ever needed, that's a separate composing app.) When the progression is empty there is nothing to harmonize, so the mode change just updates the palette/solo scale.
- **Why the picker is NOT locked to the key**: blues (C7-F7-G7 - dominants, non-diatonic), borrowed chords / modal interchange, secondary dominants (D7->G in C), and modulation all require out-of-key chords. Locking would block whole genres. Hence: lead in-key, keep all reachable.

## AI Tutor prototype (conceptual UI/UX exploration, unlinked)

A standalone, unlinked sandbox at `music/tutor/` explores what a persona/chat-style AI Tutor layer could look and feel like, ahead of committing to a specific roadmap phase or backend. Not part of the shipped app - not linked from `music/index.html` nav, not wired into Compose/Tracks. Built via [music/TUTOR-PROTOTYPE-CHECKLIST.md](TUTOR-PROTOTYPE-CHECKLIST.md).

- Chat UI (message thread, typing indicator, tappable quick-replies) answers from a small canned/scripted library grounded in this roadmap's theory primitives (parallel vs relative, I-IV-V vs i-iv-v, borrowed chords, a Phase 4 scale-swap teaser, a Phase 5 song-form teaser) - no live model call is made.
- A pluggable provider interface (`music/tutor/provider.js`, `sendMessage(history, context) -> {text, quickReplies}`) so a real backend can be swapped in later without touching the UI.
- **Open architecture question (unresolved, explicit follow-up):** the real backend for a live tutor could be a central proxy (e.g. hosted, OpenRouter-backed, so users don't need their own key) or bring-your-own-key (direct client-side calls to a user-supplied key). This prototype ships a settings-panel stub shaped for an OpenRouter-compatible endpoint (base URL / model / API key, localStorage-only) but does not implement either path - that's a real infra/cost decision for later, not resolved here.

**Wave 2 (`music/TUTOR-CHALLENGES-CHECKLIST.md`):** the tutor now genuinely *acts*, not just talks - `mini-compose.js` (a tutor-owned practice-widget state machine, reusing `Circle.diatonic`/`Songbook.tpose` so the theory matches the real app exactly) exposes reducers (`setKey`, `buildProgression`, `addChord`, `transpose`, `selectTrack`) that both a scripted AI demo and the human's taps drive through the same code path. `challenges.js` scripts 2 microlearning scenarios (build I-IV-V, then ii-V-I) - the AI demos the move on the widget, hands control to you, checks your answer against the roman-numeral shape (order-sensitive, key-agnostic), and gives pass/fail feedback. Still a tutor-owned mini clone, not the real Compose/Tracks (interviewed 2026-07-02: real-app control would need a new public API on `songbook.js`/`tracks.js`, deliberately deferred) and still scripted, no live LLM.

**Wave 3 (`music/TUTOR-SOLOING-CHALLENGES-CHECKLIST.md`):** graduates from "how to build a progression" to "using what you built." Adds a `reinterpretKey` reducer (same-progression, new key/mode lens - unlike `setKey`'s fresh-start clear) and 4 `'identify'`-kind challenges answered via multiple-choice quick-replies: solo over your progression, transpose and solo again, solo over a (mocked) backing track, swap to the relative minor and solo again. Every challenge now ends with a shared reflection check-in ("how did that feel - clicked, shape-not-why, or still fuzzy"). Still mocked backing tracks (no real YouTube/network), still scripted.

## Theory primitives the tutor teaches

- **Parallel vs relative.** Parallel (C major <-> C minor): same home note, different notes, chord qualities flip (I-IV-V -> i-iv-v). Relative (C major <-> A minor): same 7 notes, different home - why A-minor and C-major scales both solo over a C-major progression.
- **I-IV-V vs i-iv-v.** Major: C F G. Parallel minor (natural): Cm Fm Gm (harmonic minor keeps V major for a stronger pull).
- **Borrowed chords, secondary dominants, modulation** - the out-of-key moves the adaptive picker keeps reachable.

## Surfaces (current, for reference)

- **Build grid** ("all chords"): chromatic, key-independent. The All segment of the In-key|All toggle; renders in the scrolling chord list (Phase 1).
- **In-key chord list**: diatonic to key + mode. The In-key segment of the toggle; renders in the scrolling chord list (Phase 1).
- **Solo scale + HSR I-IV-V chain + "Walk the full cycle" inversions link**: teaching content, now inside the key/mode chip's fly-out (below the roots + mode toggle); carries `?key=`/`?mode=` to the inversions page. Feeds Phases 3-4.

## What Phase 5 (song-form coaching) would need - discovery notes, 2026-07-02

Not built - scoping only, per this session's direction: lock the soloing curriculum first (wave 3), then move this way. Captured now so the shape is grounded when we do.

**The feature, concretely:** a song = an ordered list of **sections** (intro/verse/chorus/bridge/outro/...), each with its own progression (today's single-progression model, repeated per section). The new problem Phase 5 actually introduces isn't "more progressions" - it's **judging whether the transition from one section's last chord to the next section's first chord is pleasing** (a smooth pivot) or jarring, and helping pick a next-section key/progression that reads as intentional rather than random.

**Data model:** `Song = { sections: [{ label, key, mode, progression, bars? }] }`. Whether `bars`/timing is needed depends on whether Phase 5 cares about section LENGTH (probably eventually, not necessarily for a v1 that's purely chord-transition coaching).

**Transition-quality heuristic - the actual new theory needed, buildable from what's already in `Circle.js`:**
- **Circle-of-fifths distance** between section A's key and section B's key (`Circle.position` gives each key a 0-11 slot on the wheel already) - a small distance reads as a smooth modulation, a large one as a jump. Cheap, reuses existing code, no new theory to author.
- **Common-tone / pivot-chord check** - intersect `Circle.diatonic(keyA, modeA)` and `Circle.diatonic(keyB, modeB)`'s chord sets; a shared chord is a valid pivot (classic common-chord modulation) and names an actual "use THIS chord to bridge" suggestion, not just a smooth/jarring verdict.
- **Direct relationship check** - is B's key the dominant, subdominant, or relative of A's key? `Circle.neighbors(keyA, modeA)` already returns exactly this list with human-readable "why" strings - directly reusable as the explanation text for a "why this transition works" callout.

**UI shape (sketch, not committed):** a vertical list of section cards, each rendering through the SAME mini-compose widget wave 2/3 already built (one widget instance per section, not a new component) - with a transition indicator between adjacent cards (color-coded by the heuristic above, or naming a suggested pivot chord).

**Reuse inventory (why this is a smaller lift than it sounds):** `Circle.js` (distance/pivot/neighbors - no new theory functions needed, just new callers), `mini-compose.js` (becomes an array of per-section states instead of one), `challenges.js`'s pattern (a "pick a pleasing next-section key" challenge is a natural `'identify'`-kind extension once the heuristic exists).

**Where this lands:** if it graduates past this sandbox, it's a genuinely new feature on the real Compose (multi-section song builder), which is exactly what Phase 5 already names as PLANNED on the curriculum table above - this discovery pass is effectively becoming that phase's spec.

## Open follow-ups

- Inversions page respects `?mode=` for a minor-cycle variant (deferred from #56).
- "Borrow chords from another key without re-keying" preview mode (since picking a key now re-keys).
