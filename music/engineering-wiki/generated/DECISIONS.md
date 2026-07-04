<!-- GENERATED from music/engineering-wiki/: decisions.md | regenerate by re-synthesizing that page | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Decisions

Load-bearing decisions, their rationale, and where each is implemented. If a decision has an ID, it was ruled - propose a change explicitly rather than drifting away from it in code.

## Core decisions

| ID | Decision | Ruling | Where it lives |
|---|---|---|---|
| FORK-4 | Canonical-sharp spelling app-wide | One sharp table; flat input normalizes; flats never render. Flips at PR #98. | [THEORY.md](THEORY.md) |
| SHARP-TIE | Enharmonic ties render sharp | A deliberate product policy (professor-classified "policy, not a bug"), not conservatory practice | [THEORY.md](THEORY.md) |
| ROMAN-HYBRID | Mode-local numerals in-key; chromatic labels for borrowed chords | The same chord relabels bVII <-> VII on a mode toggle by design; harmonic-minor V is cased by the chord itself | [THEORY.md](THEORY.md) |
| D1 | Transpose == song key | One `songKey`; transposing moves the key; picking a key transposes the progression | [ARCHITECTURE.md](ARCHITECTURE.md) |
| D3 | Mode toggle always re-harmonizes | Solo-practice scope: pick key+mode -> harmonized progression -> solo; no freeze-chords nuance | [ARCHITECTURE.md](ARCHITECTURE.md) |
| D5 | Chord picker is NOT key-locked | An In-key / All adaptive list - blues, borrowed chords, and secondary dominants need the escape hatch | [ARCHITECTURE.md](ARCHITECTURE.md) |
| D6 | Compose is a flattened one-screen layout | Fixed top region + one scroller; no accordions (avoids a nested-scroll swipe trap) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| S2/FORK-3 | The Studio wheel is read-only | A teaching aid, not a second key-selection surface - no false affordance | [ARCHITECTURE.md](ARCHITECTURE.md) |
| GRIP | One-hand instrument-in-hands model | 44px hit-target floor, thumb-zone awareness, consequence intolerance | [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| RAIL | Scroll-rail actions are movement-cancelled / mode-gated | The hot right edge fires on scroll-grab, not intent | [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| JIT | One-shot dismissible notables for guidance | Show once, persist the dismissal, single-slot priority arbitration | [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| SOLO-BOUNDARY | 5/6-note scales never harmonize | Pentatonics and blues are solo-layer only - no triad palette | [THEORY.md](THEORY.md) |
| BLUE-NOTE-A | Regime-A blue note spells sharp (`A blues = A C D D# E G`) | FORK-4 one-table consistency beats notation convention until PR #98; flips to Eb via the one-provider seam | [THEORY.md](THEORY.md) |

## Sprint-1 amendments (all folded and shipped)

| ID | Amendment |
|---|---|
| A1 | Stacked-PR protocol: stacked items target the base branch; retarget + rebase after the base merges; never delete a stacked base early |
| A2 | File-ownership map drawn up before parallel spawns; overlapping regions re-sequence |
| A3 | Clear-undo contract: full-state snapshot; ANY mutation invalidates it; route-local, session-only banner |
| A4 | Notables: one versioned key `music.notables.v1`; claim/dismiss API; priority firstrun > whynote > roman |
| A5 | Double-fire prevented by single-slot arbitration + simultaneous-claim tests |
| A6 | Undo persistence stays explicit: session-only (resolved by A3) |
| A7 | Fold gate: Compose's fixed-top bottom edge stays within +-2px at 412x915, verified before/after every merge into that region |
| A8 | Wave-2 #98 seam named: `spellKeyAware`/`spellScaleKeyAware`/`keyLabel` only - absent at merge means blocked, not improvised |
| A9 | Just-in-time copy is a static template interpolating already-rendered labels - zero new theory derivation in prose |
| A10 | Service-worker CACHE bump lands in the same commit as any CORE change; parallel-PR conflicts resolve to max+1 |
| A11 | localStorage test isolation goes through the shared reset helper |
| A12 | Stacked PRs re-run CI after their base updates |

## Mission decisions (operator-ruled)

| ID | Ruling |
|---|---|
| M3-CHOICE-A | Zero songs/tracks-merge slices in sprint 1; that work is the next sprint's primary item, after PR #98 |
| WAVE-2-DEFER | Spelled tones, roman-style setting, and the regime-B canon additions are deferred with reason on PR #98, resuming on that merge event |
| S-BLUES | Pentatonic major/minor + blues built this mission, solo layer only |
| S-BLUES-B | Key-aware pentatonic/blues spelling queued on PR #98 (a provider swap only) |
| S-DIAGRAM-PREF | Queued; spec home is [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| DECOM | Legacy standalone docs were absorbed into this wiki, then stubbed or deleted per a grep-before-delete check |

## Related generated docs

[THEORY.md](THEORY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) - the pages implementing these rulings. [ROADMAP.md](ROADMAP.md) - what these decisions unblocked or deferred.
