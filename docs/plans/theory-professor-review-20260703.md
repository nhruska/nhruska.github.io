# Adversarial Theory Review - Music-Theory-Professor Persona (2026-07-03)

> Phase-2a+ artifact of the [ux-persona mission](goal-ux-persona-mission-20260703.md).
> Reviewer: codex/GPT-5.5, senior-professor persona (conservatory + pop pedagogy),
> instructed to refute. Inputs: the full 48-context app dump (scales, triads, romans),
> the deterministic audit's ground-truth rules, and both spelling regimes
> (main's canonical-sharp + PR #98's in-flight key-aware). 56K tokens.

## Verdicts (verbatim summary)

| Section | Verdict |
|---|---|
| Theory bugs (app output) | **NONE FOUND** - "the 48 rows preserve pitch class, degree order, triad quality, and Roman case/symbol" |
| Ground-truth encoding | **One finding:** "tie -> sharps is not standard practice; it is a deterministic product policy" (F#/Gb, D#/Eb minor are legitimate equal-accidental spellings). Triad tables verified correct by stacked thirds; Db-over-C#, Eb-over-D#, Bb-minor-over-A#-minor, Eb-Mixolydian-over-D#-Mixolydian all confirmed. |
| Roman convention | **Recommend a `Roman Numeral Style` setting:** Classical Mode-Local (current hybrid; i ii° III iv v VI VII - conservatory-correct) vs Lead-Sheet Major-Relative (bIII bVI bVII; E Mixolydian's D reads bVII) |
| Regime B (key-aware) | 12 concrete golden trap cases delivered (below) |

## Disposition (mission fold-in)

| Finding | Action | Owner |
|---|---|---|
| 0 theory bugs | Theory credibility bar MET: deterministic audit (1008 checks) + independent adversarial professor agree. Record in living artifact. | done |
| Sharp-tie = policy not practice | Keep the deterministic policy (operator requires determinism); DOCUMENT it as product policy in audit + any user-facing key naming ("C# displays as Db; F#/Gb ties render sharp by policy"). | audit comment updated this commit; user-facing doc -> sprint candidate |
| Roman-style setting | Sprint candidate S-ROMAN: setting + one-time prompt (Classical Mode-Local default vs Lead-Sheet), per operator's settings-with-prompt pattern (D3). Council weighs priority. | council |
| Chord tones with spelling (prof top-5 #3) | Sprint candidate S-TONES: show `E#dim = E# G# B` in chord detail surfaces. | council |
| Golden tests all roots/modes (prof top-5 #5) | Sprint candidate S-GOLDEN: promote mission audit + the 12 traps into test/ as permanent suite. | council |
| 12 Regime-B traps | Posted to PR #98 as verification fixture (cross-session contribution). | done this session |

## The 12 golden trap cases (Regime B / PR #98 verification)

1. F Major -> scale F G A Bb C D E; chords F Gm Am Bb C Dm Edim
2. C# Major -> render as Db Major; scale Db Eb F Gb Ab Bb C; chords Db Ebm Fm Gb Ab Bbm Cdim
3. F# Major -> scale F# G# A# B C# D# E#; chords F# G#m A#m B C# D#m E#dim
4. C# Mixolydian -> scale C# D# E# F# G# A# B; chords C# D#m E#dim F# G#m A#m B
5. D# Minor -> scale D# E# F# G# A# B C#; chords D#m E#dim F# G#m A#m B C#
6. A# Minor -> render as Bb Minor; scale Bb C Db Eb F Gb Ab; chords Bbm Cdim Db Ebm Fm Gb Ab
7. G# Minor -> KEEP G# Minor (not Ab Minor); scale G# A# B C# D# E F#
8. Eb Dorian -> scale Eb F Gb Ab Bb C Db; chords Ebm Fm Gb Ab Bbm Cdim Db
9. Bb Major shape lookup -> display Bb, Eb; no leaked A#, D#
10. Theoretical D# Major if allowed -> D# E# F## G# A# B# C##; otherwise auto-render Eb Major
11. Theoretical Cb Major if allowed -> Cb Db Eb Fb Gb Ab Bb; otherwise auto-render B Major
12. F# Major vii -> symbol E#dim, tones E# G# B; shape may reuse Fdim internally, display must not leak it

## Professor's Top 5 (ranked credibility moves)

1. Ship Regime B (key-aware spelling); letter-sequential as hard invariant
2. Roman Numeral Style setting (Classical Mode-Local vs Lead-Sheet Major-Relative)
3. Chord tones WITH spelling (E#dim = E# G# B), not just pitch-class labels
4. Document key-renaming policy plainly (C# displays as Db; ties are policy)
5. Golden tests for all roots/modes: spelling, symbols, romans, relative minors, enharmonic shape lookup

## Full review

Raw codex output preserved at the mission scratchpad and reproduced in the sections above; methodology + prompt in [music/dev/theory-dossier.js](../../music/dev/theory-dossier.js) + mission spec.
