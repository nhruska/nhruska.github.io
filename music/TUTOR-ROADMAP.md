# Music app - AI tutor roadmap

> The north star and the build order. The Compose key-subsystem work was the foundation; this is the curriculum the app teaches and the order we build it in.

## Vision

An adaptive AI music tutor whose destination is **soloing and songwriting confidence**. The loop: Compose a progression -> jam/solo over it with scale guidance -> understand why it works -> build it into a song form. Key is the spine; theory is taught in context, on demand, never as a wall.

## The curriculum (also the build order)

| Phase | Capability | Status |
|---|---|---|
| 0 | **Chord building foundation** - unified song key, compact key bar, transpose==key sync, all-chords sharps/flats, suggestions+common-progressions merge | DONE (PR #50/#52/#56) |
| 1 | **Adaptive chord surface** - one picker that LEADS with the in-key diatonic chords (tracks key + mode) and keeps "+ all chords" one tap away for borrowed/secondary/blues | THIS PR |
| 2 | **Modal interchange** - an explicit "convert my progression to this mode" action (e.g. C major I-IV-V -> C minor i-iv-v: same roots, qualities flipped). Distinct from transpose (which shifts roots, keeps qualities) | NEXT |
| 3 | **Backing-track soloing + scale guidance** - launch a backing track for the current progression; show the scale to solo over, on the fretboard | PLANNED |
| 4 | **Relative / parallel scale demos** - over the same backing, swap compliant scales and explain why: A minor over a C major progression (relative - same notes), then switch the backing to C minor and solo C minor (parallel - different notes) | PLANNED |
| 5 | **Song-form coaching** - AABA, intro/verse/chorus/bridge; guide building a coherent whole song from sections | PLANNED |

## Locked design decisions

- **Chord picker = adaptive** (Phase 1): in-key chords lead and visibly change with key AND mode; "+ all chords" expander preserves access to out-of-key chords. Guided by default, unrestricted on demand. Decided 2026-06-29 via use-case/human-factors/theory review.
- **Transpose == song key** (Phase 0): one unified `songKey`; transposing moves the key, picking a key transposes the progression (by tonic delta), the readout shows root + mode. No drift.
- **Mode toggle = scale-context-only**: changing mode updates the solo scale + the in-key palette offered, but does NOT re-qualify already-built chords (deliberate). Re-qualifying is the explicit Phase 2 modal-interchange action, never a side effect.
- **Why the picker is NOT locked to the key**: blues (C7-F7-G7 - dominants, non-diatonic), borrowed chords / modal interchange, secondary dominants (D7->G in C), and modulation all require out-of-key chords. Locking would block whole genres. Hence: lead in-key, keep all reachable.

## Theory primitives the tutor teaches

- **Parallel vs relative.** Parallel (C major <-> C minor): same home note, different notes, chord qualities flip (I-IV-V -> i-iv-v). Relative (C major <-> A minor): same 7 notes, different home - why A-minor and C-major scales both solo over a C-major progression.
- **I-IV-V vs i-iv-v.** Major: C F G. Parallel minor (natural): Cm Fm Gm (harmonic minor keeps V major for a stronger pull).
- **Borrowed chords, secondary dominants, modulation** - the out-of-key moves the adaptive picker keeps reachable.

## Surfaces (current, for reference)

- **Build grid** ("all chords"): chromatic, key-independent. Becomes the "+ all chords" expander in Phase 1.
- **"Chords in this key"** (in key & scale): diatonic to key + mode. Becomes the in-key lead in Phase 1.
- **Solo scale + HSR I-IV-V chain + "Walk the full cycle" inversions link** (key & scale): teaching content; carries `?key=`/`?mode=` to the inversions page. Stays; feeds Phases 3-4.

## Open follow-ups

- Inversions page respects `?mode=` for a minor-cycle variant (deferred from #56).
- "Borrow chords from another key without re-keying" preview mode (since picking a key now re-keys).
