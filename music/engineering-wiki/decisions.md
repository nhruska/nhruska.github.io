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
| SOLO-BOUNDARY | 5/6-note SOLO scales never harmonize (amended by D-BLUES-KEY, W2) | Pentatonics are solo-layer only, no triad palette, unconditionally; the blues SOLO scale (6-note, fretboard/degrees) stays solo-layer too - Blues' harmonizing counterpart is the SEPARATE 3-degree BLUES_KEY model, deliberately kept apart from this scale | [theory-engine/solo-scales.md](theory-engine/solo-scales.md) |
| BLUE-NOTE-A | Regime-A blue note spells sharp (`A blues = A C D D# E G`) `[TRACKS-#98]` | FORK-4 one-table consistency beats notation convention until #98; flips to Eb at S-BLUES-B via the one-provider seam | solo-scales |
| D-KEYLESS | Keyless progressions stay keyless through mode change AND transpose | Supersedes codex #90 V1's first-chord-fallback per operator input I4; a mode change while keyless re-qualifies via the shared pure fn but never resurrects a root, and the fly-out stays open; also fixes the F12 dead-mode-chip (re-tapping the current mode with no root re-renders instead of no-op-ing) | [systems/compose-key-system.md](systems/compose-key-system.md) |
| D-FRETS-4STR | 4-string necks default to a 12-fret Studio window, not 7 | `pack.meta.strings <= 4` (uke/mandolin/mandola/cigar box) - a 7-fret window covers less musical value per fret at 4 strings; banjo(5) and guitars keep 7 | [systems/practice-studio.md](systems/practice-studio.md) |
| D-BLUES-KEY | Blues is a separate 3-degree harmonizing key model (I7/IV7/V7), not a diatonic mode | `songbook.js MODES.Blues` (steps [0,5,7], quals all `'7'`) + `Circle.BLUES_KEY`/`bluesKey(root)`; palette-minimalism in-key rule (plain triad or dominant 7th only, no ii/dim/maj7/subs); never auto-inferred; `completions()` top-guarded to `[]`; convertProgressionQualities' Blues<->diatonic directions gated on the professor-fold amendment (dom-7-strip applies only to a root ON the blues palette, offsets {0,5,7} from the SOURCE tonic - not any target-mode degree, so a non-palette root like a user-added A7 survives unchanged) | [theory-engine/harmonization.md](theory-engine/harmonization.md) |
| D-CAP12 | Compose progression cap raised 8 -> 12 (`COMPOSE_MAX`) | Fits the two 12-bar Blues starters; one shared const replaces both `addChord`/`renderProg` gates so it can't drift; operator-visible via the updated `maxNote` copy | [systems/compose-key-system.md](systems/compose-key-system.md) |
| D-TARGET | Chord-tone targeting: in-scale tones filled, out-of-scale tones GHOSTED (amended) | ORIGINALLY intersection-only (a chord tone outside the current scale was a deliberate deferral, no ghost dot). P5 seasoned-player adversarial fold (2026-07-05) KILLED that deferral: for A7 over A blues, C# (the major 3rd) is the money note - hiding it taught the habit the feature exists to break. Now EVERY chord tone renders: in-scale as filled `kx-chord`/`kx-root`, out-of-scale as a hollow `kx-ghost` dot at its correct fret (same per-string fret math, `Diagram.scale`'s `plan.ghostsOn`); `targetTones()`'s `ghostPcs` carries the out-of-scale set. Caption legend gained "hollow = chord tone outside the scale" | [systems/practice-studio.md](systems/practice-studio.md) |
| D-CARDS-STATIC | Per-scale mentor cards (SoloGuide) are curated static prose, not derived | NEW `music/shared/solo-guide.js` (`window.SoloGuide`), loaded before songbook.js AND tracks.js; `framing()` moved verbatim from tracks.js; `card(scaleKey, notes)` interpolates `{i}` degree-index placeholders only - zero theory computed in the module itself (A9) | practice-studio |
| D-LANDSCAPE-FLEX | Landscape two-pane split refined, not restructured | Existing coarse-pointer media-query flex split (grid-areas rejected): stage 48% -> 44%, body padding `12px 12px 18px` -> `10px 12px`, gap `12px` -> `10px` - room for the Guide card + target caption in the same short-height pane | practice-studio |
| D-SAVE-TRUTH | USER-initiated saves get truthful feedback; passive persistence fails soft | safeSet() is the single write seam for saveCustom/saveSet/saveLast/savePerfPrefs/saveSongView (A1 fix, analysis-refactor-enhance-20260704); saveProgression branches its toast on the real write result instead of claiming success unconditionally; passive writes (last-opened, perform prefs, song view) console.warn once per key and stay silent in the UI - no per-keystroke nagging | [systems/data-model.md](systems/data-model.md) |
| D-HARDEN | Four mechanical hardening seams, one PR, all behavior-preserving except one bug fix (analysis-refactor-enhance-20260704 A4/A5/A6) | (1) `ListItem.wireTap` is now the SSOT movement-cancel tap guard - `Songbook.wireTapCancel`/`composeWireTap` delegate to it (3 copies -> 1); (2) `music/shared/esc.js` is now the SSOT HTML-escaper (strict `&<>"'` superset of every prior variant) - list-item/tracks/notables(removed, was dead)/repertoire-form/diagram/songbook all delegate (~8 copies -> 1); (3) `test/sw-verify.test.js` asserts every CORE path exists on disk AND every shared/*.js `<script src>` in play/index.html is CORE-precached - caught + fixed 3 pre-existing gaps (list-item.js/repertoire.js/repertoire-form.js were script-tagged but never cached), `scripts/check-cache-bump.sh` separately guards the CACHE-vs-diff invariant (needs git history, not unit-testable); (4) `toggleSet`'s "Added to setlist" toast now branches on `saveSet()`'s real result (same D-SAVE-TRUTH bug shape, PR #116 follow-up) - the ONLY behavior change in this mission | [systems/runtime-architecture.md](systems/runtime-architecture.md), [systems/data-model.md](systems/data-model.md) |

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
| P5-FOLD | P5 seasoned-player adversarial pass on PR #118 (2026-07-05), folded pre-merge into the same PR | Two changes: (1) ghost dots for out-of-scale chord tones - see D-TARGET amendment; (2) rewrote most SoloGuide card blocks toward chord-relative ("target the CURRENT chord") advice + fixed the pentMajor relative-minor-pent distance (three frets, not two) - supersedes section-8B wherever both touched the same block (dorian.hangOn, pentMinor.startEnd, blues.resolveTo) |
| M3-5A | Finder rehome on songs/tracks merge: DISSOLVE (5A) - curation to +Add/per-item edit, circle panel into the Studio; option 5B (playable-filter mode) rejected | operator 2026-07-04 | [uat + queue](../../docs/plans/QUEUE.md) |
| D-TEMPO-REMOVED | tempo.js + test deleted as dead code (zero consumers since inception; operator: never used it). Git history preserves; re-roll a beat clock only if the tutor roadmap earns it | operator 2026-07-04 | analysis B1 disposition |

## Related

- [index.md](index.md) - routing table
- [AGENTS.md](AGENTS.md) - markers + read order
- [workflows/roadmap-missions.md](workflows/roadmap-missions.md) - phases + backlog
