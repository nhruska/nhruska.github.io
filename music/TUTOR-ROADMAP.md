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
| 3 | **Backing-track soloing + scale guidance** - once key + mode + progression are established, search YouTube for a matching backing track (optional genre, or no-genre for different grooves to solo over); show the scale to solo over, on the fretboard | PLANNED |
| 4 | **Relative / parallel scale demos** - over the same backing, swap compliant scales and explain why: A minor over a C major progression (relative - same notes), then switch the backing to C minor and solo C minor (parallel - different notes). NOTE: since the mode toggle now re-harmonizes the chords, "solo a different scale over a FIXED progression" likely needs a SEPARATE scale selector (decoupled from the key/mode filter that drives harmonization) | PLANNED |
| 5 | **Song-form coaching** - AABA, intro/verse/chorus/bridge; guide building a coherent whole song from sections | PLANNED |

## Locked design decisions

- **Compose = FLATTENED one-screen layout** (revised 2026-06-29, device-test feedback - replaces the accordion form below): no `<details>` accordions. A FIXED top region (does NOT scroll) holds, top to bottom: the button bar (transpose + Clear/Save + a "?" help button), the progression box (empty -> tappable starter progressions inside it; non-empty -> the built chords + next-chord suggestions; "?" re-shows the starters at any time), a compact "C Major v" key/mode chip, and the In-key|All filter toggle. Tapping the chip opens a fly-out with the 12 roots + the maj/min/mixo/dor mode toggle + the solo scale (scale + HSR I-IV-V chain + inversions link); it collapses back to the chip on a pick. The ONLY scroll area is the chord list below the fixed region. Redundant labels ("Chords in <key>", section headers) were dropped - the chip already names the key. This also fixes the lingering in-key swipe bug: a single flat scroll container (no nested accordion scroller) lets vertical swipes scroll the in-key cells cleanly.
- **Chord picker = adaptive, ONE list** (Phase 1): a single chord list with the In-key|All toggle - In key leads with the diatonic chords (change with key AND mode), All preserves out-of-key access via the chromatic grid + type tabs. Guided by default, unrestricted on demand. Decided 2026-06-29 via use-case/human-factors/theory review; flattened one-screen form via device-test feedback.
- **Transpose == song key** (Phase 0): one unified `songKey`; transposing moves the key, picking a key transposes the progression (by tonic delta), the readout shows root + mode. No drift.
- **Mode toggle ALWAYS re-harmonizes the progression** (revised 2026-06-29, device-test feedback - reverses the earlier "scale-context-only" decision for this app's solo-practice scope): the one key/mode filter is a single control that drives the built chords. A root change transposes, a mode change re-qualifies (modal interchange), so the chords stay in the chosen key/mode automatically. The separate "Re-harmonize to <mode>" button was removed. Rationale: this app is solo-practice, not composing - the user wants pick-key-and-mode -> harmonized progression -> solo, not the ability to freeze chords against a mode change. (If freezing is ever needed, that's a separate composing app.) When the progression is empty there is nothing to harmonize, so the mode change just updates the palette/solo scale.
- **Why the picker is NOT locked to the key**: blues (C7-F7-G7 - dominants, non-diatonic), borrowed chords / modal interchange, secondary dominants (D7->G in C), and modulation all require out-of-key chords. Locking would block whole genres. Hence: lead in-key, keep all reachable.

## Theory primitives the tutor teaches

- **Parallel vs relative.** Parallel (C major <-> C minor): same home note, different notes, chord qualities flip (I-IV-V -> i-iv-v). Relative (C major <-> A minor): same 7 notes, different home - why A-minor and C-major scales both solo over a C-major progression.
- **I-IV-V vs i-iv-v.** Major: C F G. Parallel minor (natural): Cm Fm Gm (harmonic minor keeps V major for a stronger pull).
- **Borrowed chords, secondary dominants, modulation** - the out-of-key moves the adaptive picker keeps reachable.

## Surfaces (current, for reference)

- **Build grid** ("all chords"): chromatic, key-independent. The All segment of the In-key|All toggle; renders in the scrolling chord list (Phase 1).
- **In-key chord list**: diatonic to key + mode. The In-key segment of the toggle; renders in the scrolling chord list (Phase 1).
- **Solo scale + HSR I-IV-V chain + "Walk the full cycle" inversions link**: teaching content, now inside the key/mode chip's fly-out (below the roots + mode toggle); carries `?key=`/`?mode=` to the inversions page. Feeds Phases 3-4.

## Open follow-ups

- Inversions page respects `?mode=` for a minor-cycle variant (deferred from #56).
- "Borrow chords from another key without re-keying" preview mode (since picking a key now re-keys).
