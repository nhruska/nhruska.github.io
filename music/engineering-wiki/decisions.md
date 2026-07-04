# Decisions Registry

[Wiki](index.md) > Decisions

## Purpose

One registry of load-bearing decisions, their rationale, and owning pages. If a decision has an entry here, it was RULED - propose changes explicitly instead of drifting.

## Core decisions

| ID | Decision | Ruling (one line) | Owning page |
|---|---|---|---|
| FORK-4 | Canonical-sharp spelling app-wide `[TRACKS-#98]` | ONE sharp table; flat input normalizes; flats never render | [theory-engine/note-spelling.md](theory-engine/note-spelling.md) |
| SHARP-TIE | Enharmonic ties render sharp | Deterministic PRODUCT POLICY (professor-classified policy-not-bug), not conservatory practice | note-spelling |
| ROMAN-HYBRID | Mode-local numerals in-key; chromatic labels for borrowed | Same chord relabels bVII <-> VII on mode toggle, by design; harmonic-minor V cased by the chord | [theory-engine/harmonization.md](theory-engine/harmonization.md) |
| D1 | Transpose == song key | One songKey; transposing moves the key; picking a key transposes the progression | [systems/compose-key-system.md](systems/compose-key-system.md) |
| D3 | Mode toggle ALWAYS re-harmonizes | Solo-practice scope: pick key+mode -> harmonized progression -> solo; no freeze-chords nuance | compose-key-system |
| D5 | Chord picker NOT key-locked | In-key \| All adaptive list; blues/borrowed/secondary need the escape hatch | compose-key-system |
| D6 | Compose = flattened one-screen | Fixed top region + one scroller; no accordions (nested-scroll trap) | compose-key-system |
| S2/FORK-3 | Studio wheel is read-only | Teaching aid, not a second key-selection surface - no false affordance | [systems/practice-studio.md](systems/practice-studio.md) |
| GRIP | One-hand instrument-in-hands model | 44px floor, thumb-zone awareness, consequence intolerance | [ux-philosophy/design-principles.md](ux-philosophy/design-principles.md) |
| RAIL | Scroll-rail actions movement-cancelled/mode-gated | The hot right edge fires on scroll-grab | [ux-philosophy/interaction-safety.md](ux-philosophy/interaction-safety.md) |
| JIT | One-shot dismissible notables for guidance | Show once, persist dismissal, single-slot priority arbitration | interaction-safety |
| SOLO-BOUNDARY | 5/6-note scales never harmonize | Pentatonics/blues are solo-layer only; no triad palette | [theory-engine/solo-scales.md](theory-engine/solo-scales.md) |
| BLUE-NOTE-A | Regime-A blue note spells sharp (`A blues = A C D D# E G`) `[TRACKS-#98]` | FORK-4 one-table consistency beats notation convention until #98; flips to Eb at S-BLUES-B via the one-provider seam | solo-scales |
| D-KEYLESS | Keyless progressions stay keyless through mode change AND transpose | Supersedes codex #90 V1's first-chord-fallback per operator input I4; a mode change while keyless re-qualifies via the shared pure fn but never resurrects a root, and the fly-out stays open; also fixes the F12 dead-mode-chip (re-tapping the current mode with no root re-renders instead of no-op-ing) | [systems/compose-key-system.md](systems/compose-key-system.md) |
| D-FRETS-4STR | 4-string necks default to a 12-fret Studio window, not 7 | `pack.meta.strings <= 4` (uke/mandolin/mandola/cigar box) - a 7-fret window covers less musical value per fret at 4 strings; banjo(5) and guitars keep 7 | [systems/practice-studio.md](systems/practice-studio.md) |

## Sprint-1 amendments (adversarial-review v2, all folded + shipped in v78)

| ID | Amendment (one line) |
|---|---|
| A1 | Stacked-PR protocol: stacked items target the base branch; retarget+rebase after base merges; never delete a stacked base early; record tested base SHA |
| A2 | File-ownership map before parallel spawns; overlapping regions re-sequence |
| A3 | Clear-undo contract: full-state snapshot; ANY mutation invalidates; route-local session-only banner |
| A4 | Notables: one versioned key music.notables.v1; claim/dismiss API; priority firstrun > whynote > roman |
| A5 | Double-fire prevented by single-slot arbitration + simultaneous-claim tests |
| A6 | Undo persistence explicit: session-only (resolved by A3) |
| A7 | Fold gate: Compose fixed-top bottom edge +-2px at 412x915, verified before/after combined merges |
| A8 | Wave-2 #98 seam named: spellKeyAware/spellScaleKeyAware/keyLabel ONLY; absent -> BLOCKED-not-improvised `[TRACKS-#98]` |
| A9 | JIT copy = static templates interpolating already-rendered labels; zero new theory derivation |
| A10 | SW CACHE bump in the same commit as any CORE change; parallel conflicts resolve max+1 |
| A11 | localStorage test isolation via the shared reset helper |
| A12 | Stacked PRs re-run CI after final base update |

Source: [docs/plans/ux-sprint-1-20260703.md](../../docs/plans/ux-sprint-1-20260703.md) v2 resolution.

## Mission decisions (operator-ruled)

| ID | Ruling |
|---|---|
| M3-CHOICE-A | Zero M3 slices in sprint 1 (council-unanimous, operator-approved); M3 = sprint-2 primary, fresh session, post-#98, 5A/5B pre-answered |
| WAVE-2-DEFER | S-TONES / S-ROMAN+S-KEYPOLICY / S-GOLDEN-B deferred-with-reason on #98; resume on merge event `[TRACKS-#98]` |
| S-BLUES | Pentatonic major/minor + blues BUILT this mission (I1), solo layer only, per the [IA seam contract](../../docs/plans/wiki-ia-20260704.md) |
| S-BLUES-B | Key-aware pentatonic/blues spelling QUEUED on #98 (provider swap only) `[TRACKS-#98]` |
| S-DIAGRAM-PREF | Queued; spec home [ux-philosophy/expertise-adaptive-display.md](ux-philosophy/expertise-adaptive-display.md) |
| DECOM | Legacy docs absorbed into this wiki then stubbed/deleted per the IA disposition table (grep-before-DELETE) |

## Related

- [index.md](index.md) - routing table
- [AGENTS.md](AGENTS.md) - markers + read order
- [workflows/roadmap-missions.md](workflows/roadmap-missions.md) - phases + backlog
