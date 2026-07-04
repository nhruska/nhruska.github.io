# SHORT-Queue Specs (drafted at M2 close, 2026-07-04)

> Two launch-ready-on-gate specs per the plan-ahead pipeline. Each needs one operator keyword ("go S-DIAGRAM-PREF" / "go S-BLUES-BOXES") - they were adversarially shaped already (P5 fold).

## S-DIAGRAM-PREF - expertise-adaptive chord diagrams

- Spec home (canonical): music/engineering-wiki/ux-philosophy/expertise-adaptive-display.md (P5-folded).
- Step 0 (prerequisite, P5-mandated): SHAPE CLASSIFIER - curated per-profile metadata table voicing -> { family, rootString, inversion, barreFret }; movable-template aware; node-tested.
- Step 1: one-time Notables prompt (never first-run; priority after roman) -> music.diagram.pref.v1 = dots|patterns (additive key).
- Step 2: 'patterns' render: KEEP X/O + base fret + root/degree tinting; strip instruction numbering; add classifier label ("E-shape barre, root on 6, 1st inversion") + curated fingering as text.
- V&V: classifier table tests; both-pref render screenshots (412x915, both themes); zero harmonization/theory impact; SW bump.
- Est: M (classifier is the work).

## S-BLUES-BOXES - named box positions on the Studio scale view

- What: Box 1-5 labels for pentatonic/blues (root-string anchor + start fret + "next box" move hint), riding the existing posWindow pager (key-explorer.js).
- Contract: pure position math from (rootPc, scaleId, tuning) -> box list; node-tested per instrument profile; UI = small label chip on the scale panel + optional next/prev snapping to box starts.
- Caption unlock: once shipped, captions/docs may speak "box" language again (P5 fold #2).
- V&V: 12 roots x guitar+uke box tables tested; live screenshot; no theory-surface changes; SW bump.
- Est: S/M.
