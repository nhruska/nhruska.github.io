# M-GUIDE Adversarial Fold Record (2026-07-04)

> Four adversarial rounds, ten substantive catches, all dispositioned. The two-lens design (theory professor x seasoned player) caught errors the OTHER lens passed - including each correcting the other's corrections. Deterministic canon stayed green throughout; every catch lived in seams or judgment the tests could not see.

| Round | Adversary | Catches | Disposition |
|---|---|---|---|
| 1. Design review (pre-code) | Professor (codex, xhigh) | (a) Blues->Major conversion rule contradicted its own example - user-added A7 would degrade to Am; (b) dorian card aimed the color note at the wrong chord; (c) blues resolve advice too broad | ALL FIXED on paper (IA section 8, PR #111) before W2 spawned - zero rework cost |
| 2. Implementation review (PR #115 diff) | Professor | (a) convertProgressionQualities skipped canonMode on targetMode - lowercase 'blues' silently no-opped; (b) mode-carrying starters leaked into non-Blues auto-completions; (c) trackKey collapsed blues into major identity | ALL FIXED same PR + named tests (531 green); merged v82 |
| 3. Player UAT (W3 surfaces) | P5 seasoned player (codex) | (a) intersection-only targeting KILLED - the I7's major 3rd is "the money note"; ghost dots shipped; (b) card copy rewritten to home-chord vs current-chord discipline; (c) FACTUAL: "relative pent two frets down" is wrong - it is THREE (professor had passed it); (d) "one movable box" = box-prison advice; (e) pentMinor bend advice duplicated | (a)-(e) FOLDED same PR (#118); enhancement asks queued as S9 chips-plus |
| 4. Professor micro-pass (on P5's rewrites) | Professor | (a) "m6 shade" for the dorian 6th reads as a minor-6 interval - it is the natural/major 6; (b) P5's blues rub line violated P5's OWN current-chord discipline (C over D7 is that chord's b7, not a rub) | BOTH FIXED parent-side, 2 lines; tests updated to the professor-final copy |

**Also caught in-mission (non-adversary):** the fold-gate geometry check found "G# Blues" clipping the chooser chip (fixed 88px, W2); the identical-string CACHE bump (two branches both at v83) auto-merged with NO conflict, silently defeating the max+1 law - caught parent-side, assertion queued into go-harden.

**Ships as:** PRs #110-#113, #115, #117-#120; CACHE v80 -> v85. Wiki updated in-mission (no drift): solo-scales, harmonization, compose-key-system, practice-studio, expertise-adaptive-display, data-model, theory-verification, decisions registry.
