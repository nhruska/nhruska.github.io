# Goal Spec: m-guide-mission (2026-07-04)

> Scale mentorship + Blues-as-a-key + chooser fixes + fretboard density. Third mission in the pipeline;
> trust mode carried (merge on green); theory changes gate on the adversarial pair, not on the operator.
> Inputs: [mission-inputs-guide-20260704.md](mission-inputs-guide-20260704.md) (operator, post-M2 UAT).

## Completion condition (paste into /goal)

> Mission per docs/plans/goal-m-guide-mission-20260704.md is complete when, merged to main
> with suite + validators green and live-verified: (1) F12 fixed - clearing the key leaves mode
> chips live and re-pickable, and keyless progressions stay keyless on transpose (keyless-until-
> explicit-pick semantics, canon-tested where pure); (2) BLUES is pickable in the Compose key
> chooser as a harmonizing mode: dominant palette I7-IV7-V7 with correct roman labels, 12-bar
> starters, solo default = blues scale, mode-change mappings defined, all professor-passed and
> canon-extended across 12 roots; (3) the solo scale chips (mode/pent-major/pent-minor/blues)
> appear in Compose as the decoupled solo layer (progression untouched, isolation-tested);
> (4) chord-tone targeting ships in the Studio - tapping a progression/key chord highlights that
> chord's tones inside the current solo scale (root/chord-tone/scale-tone/blue-note classes),
> deterministic from pcs, zero new LLM-ish content; (5) per-scale guidance cards ship (curated
> static P5-voiced content: choose-when, resolve-to/hang-on, start-end advice, shapes-in-solo),
> tells-clean and P5-passed; (6) fretboard density: >=10 frets on 4-string instruments in the
> same vertical budget, a landscape Studio layout, and a chrome-trim pass - each render-verified
> at 412x915 + landscape; (7) wiki pages updated in the same mission (solo-scales, compose-key-
> system, practice-studio + decisions registry entries) and the adversarial fold recorded;
> (8) Mission Control pane + QUEUE updated; final report delivered. Zero merges without green.

## Waves (file-ownership sequenced - songbook.js is hot again)

| W | Items | Files (owner) | Notes |
|---|---|---|---|
| 1 | F12 + clear-key semantics; chrome-trim; taller window on <=4-string | songbook.js key-picker region (W1 owns); tracks.css + key-explorer.js window math | Fast, independent; fold gate A7 applies |
| 2 | BLUES harmonizing mode (the theory core); canon extension; professor pass | circle.js additive BLUES_KEY model + songbook.js chooser/mode list + starters (sequenced AFTER W1 in songbook) | Dominant-quality palette I7-IV7-V7; convertToMode mappings (Major I->I7 etc.) defined in IA; professor MUST pass before merge |
| 3 | Solo chips in Compose; chord-tone targeting (Studio); guidance cards; landscape layout | songbook.js compose solo row (after W2); tracks.js targeting + cards; tracks.css/layout | Targeting = pure pc intersection + class map; cards = curated static content |

## Adversarial (mandatory pre-merge)

- Professor (codex): the Blues key model (is I7-IV7-V7 with plain I7/IV7/V7 romans pedagogically standard - yes, 12-bar canon; verify per-root chord sets 12x; blue-note + b3-over-dominant rub statements in cards; targeting class correctness).
- P5 (codex): cards' mentorship voice (no beginner-splaining; resolve-to advice a player nods at); targeting usefulness; chooser honesty.
- Fold with dispositions; wiki updated in-mission (no doc drift).

## Guardrails

Trust mode scope: music/** + docs/plans + pane + QUEUE only. Suite + canon green at every integration; SW CACHE bump per CORE change (v80 -> up); A7 fold gate on Compose; A9 static-content discipline for all guidance text; solo-boundary holds for PENTATONICS (they still never harmonize - only Blues gets a palette, and that is a KEY model, not a pentatonic palette); no persistence changes beyond documented additive keys.

## Budget / routing

Fable: IA only (blues-model design + ownership map). Sonnet implementers per wave; codex x2 adversarial; deterministic checks first-class. Est: W1 ~30m, W2 ~1-1.5h, W3 ~1.5-2h wall with parallelism.
