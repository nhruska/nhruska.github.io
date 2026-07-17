# Theory Verification

[Wiki](../index.md) > theory-engine > Theory Verification

## Purpose

The 1008-check canon, the professor adversarial verdict, and how to extend the canon when adding scales or modes.

## The deterministic canon [STABLE]

Core suite: test/theory-canon.test.js. Node-side, dependency-free. Asserts pitch-class correctness, chord quality, and roman degree/case for 12 roots x 4 studio modes x (7 scale tones + 7 chords + 7 romans) = 1008 checks, grouped into per-context cases so a failure names the exact root+mode+degree. [STABLE]

| Dimension | Checks | Never checks |
|---|---|---|
| Pitch class | Scale pc sequence + chord pc per mode | Spelling in the CORE 1008 checks (display policy); the S-BLUES block DOES assert regime-A spelling literals deliberately, as the change-detector for the regime flip |
| Quality | Triad quality from stacked thirds | - |
| Roman degree + case | Position in mode; casing by chord quality | Letter names (F# vs Gb is a regime choice) |

Ground-truth encoder: letter-sequential spelling (seven letters, once each; fewest accidentals; sharp-tie policy documented). It matches conservatory practice, so its spellings deliberately differ from regime-A app output - both are correct under their respective regimes; only pc/quality/degree are asserted as facts. [STABLE]

## Professor adversarial verdict [STABLE]

Independent adversarial review (GPT-5.5 senior-professor persona, instructed to refute; 56K tokens; full 48-context app dump + both regimes):

| Section | Verdict |
|---|---|
| Theory bugs | NONE FOUND - pitch class, degree order, triad quality, roman case/symbol all preserved |
| Ground-truth encoding | One finding: sharp-tie is product policy, not standard practice - documented, not a bug |
| Roman convention | Both conventions legitimate; Roman-style SETTING recommended (S-ROMAN, wave 2) |
| Regime B | 12 golden trap cases delivered (see [note-spelling.md](note-spelling.md)) |

Theory credibility bar: MET, twice independently (deterministic canon + adversarial professor). Source: docs/plans/theory-professor-review-20260703.md. [STABLE]

## What a red canon test means [STABLE]

A canon failure names root+mode+degree and the kind (scale-pitch / chord-pitch / chord-quality / roman-degree / roman-case). It means a THEORY REGRESSION - someone changed MODE_STEPS, quality tables, or a labeling path. Do not loosen the test; find the change. The canon proved it can fail: it was corruption-tested at creation (deliberate quality-table break -> exact-context failure -> reverted). [STABLE]

## Extending the canon (new scale or mode) [STABLE]

1. Add the interval entry at the SSOT (Circle.MODE_STEPS for 7-note modes; Circle.SOLO_SCALES for solo scales).
2. Add canon entries: pitch-class + degree expectations across all 12 roots.
3. For pentatonics: hand-verify + test the subset proofs (5-note set contained in its claimed modes).
4. For anything spelling-sensitive: check the professor trap cases; blue-note-class decisions get a REGIME comment.
5. Update the Studio UI + this wiki's [solo-scales.md](solo-scales.md) if user-visible.

Rule: no hand-coded scale/chord table anywhere else in the codebase. Everything derives from the SSOT. [STABLE]

## S-BLUES canon additions [STABLE]

test/solo-scales.test.js carries the pentatonic/blues fixtures (12 roots x 3 scales) and the subset proofs; theory-canon carries the regime-A literals (incl. `A blues = A C D D# E G`) with the REGIME-A comment marking the deliberate change point for S-BLUES-B.

## BLUES_KEY_CANON (M-GUIDE W2) [STABLE]

A SEPARATE canon block in theory-canon.test.js, distinct from the S-BLUES solo-scale literals above: 12 roots x hand-computed `'C7 F7 G7'`-style literal chord strings (NOT read from `circle.js`'s own ROOTS array, so a regression to both the app and a copy-pasted expectation in lockstep can't slip through), asserted against `Circle.bluesKey(root).map(c => c.chord).join(' ')`, plus a roman lock (`['I7','IV7','V7']`, every root) and a matrix-size lock (12). This is the harmonizing-key-model canon (I7/IV7/V7 palette), not the 6-note solo-scale canon - the two are independently verified so a regression in either representation is caught without the other masking it. The palette table itself was professor-verified (all 12 cells) as part of the m-guide-ia-20260704.md section 8 design-review fold before implementation.

---

**Anchors verified:** test/theory-canon.test.js (encoder + cases + corruption-test lineage, BLUES_KEY_CANON block), test/solo-scales.test.js, docs/plans/theory-professor-review-20260703.md, circle.js MODE_STEPS/SOLO_SCALES/BLUES_KEY, m-guide-ia-20260704.md section 1 (palette table) + section 8 (professor fold verdict)
