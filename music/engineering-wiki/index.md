# Music App Engineering Wiki - Index

> Canonical system documentation. Contract + read order: [AGENTS.md](AGENTS.md). Decision registry: [decisions.md](decisions.md). Rendered handoff docs: [generated/](generated/).

## theory-engine/ - the credibility core

| Page | Owns |
|---|---|
| [architecture.md](theory-engine/architecture.md) | Pitch-class core vs spelling-as-display; the 3 name-emitting surfaces; interval SSOT (`Circle.MODE_STEPS`) |
| [note-spelling.md](theory-engine/note-spelling.md) | FORK-4 canonical-sharp policy; the #98 key-aware regime seam; professor golden traps `[TRACKS-#98]` |
| [harmonization.md](theory-engine/harmonization.md) | Diatonic triads; roman-numeral hybrid convention; suggestion engine; `chordInKey` |
| [solo-scales.md](theory-engine/solo-scales.md) | The SOLO layer: mode scales + pentatonic major/minor + blues; blue-note spelling under both regimes; the solo-vs-harmonization boundary |
| [theory-verification.md](theory-engine/theory-verification.md) | The 1008-check canon, audit lineage, professor verdict, scales-canon additions |

## ux-philosophy/ - why the app feels the way it does

| Page | Owns |
|---|---|
| [design-principles.md](ux-philosophy/design-principles.md) | One-screen-above-the-fold; instrument-in-hands grip model; theory-authority trust chain; soul + anti-vision |
| [personas.md](ux-philosophy/personas.md) | P1-P5 (incl. the Seasoned Guitarist), JTBD, dismissal triggers, journey matrix |
| [interaction-safety.md](ux-philosophy/interaction-safety.md) | Destructive-guard taxonomy; scroll-rail rule; wireTap; undo contract; notables one-shot pattern |
| [expertise-adaptive-display.md](ux-philosophy/expertise-adaptive-display.md) | Dots vs clean patterns; hand-position/fingering guidance; muscle-memory framing; S-DIAGRAM-PREF spec home |
| [ui-primitives.md](ux-philosophy/ui-primitives.md) | TOAST vs NOTABLE vs MODAL vs CHIP/TOKEN taxonomy; toast.js primitive (S-TOAST/U9 fix); candidate toast placements |

## systems/ - how it runs

| Page | Owns |
|---|---|
| [runtime-architecture.md](systems/runtime-architecture.md) | Static no-build PWA; module map; classic-script load order; browser/Node duality |
| [data-model.md](systems/data-model.md) | songs.json / tracks.json shapes; localStorage namespaces; SCHEMA_VERSION seam |
| [offline-pwa.md](systems/offline-pwa.md) | SW CORE precache; CACHE-bump discipline; offline degrades |
| [instrument-profiles.md](systems/instrument-profiles.md) | Pack contract; enharmonic shape lookup; HGT/HSR shape families; triad-inversions deep link |
| [practice-studio.md](systems/practice-studio.md) | The Studio overlay: solo panel, position walk, buildWhy circle, curation loop, Compose bridge |
| [compose-key-system.md](systems/compose-key-system.md) | songKey SSOT; transpose==key; mode-change re-harmonizes; In-key/All picker |

## workflows/ - how we work on it

| Page | Owns |
|---|---|
| [dev-verify-ship.md](workflows/dev-verify-ship.md) | Surface-aware verification bar; /ship; githack preview policy; CI map |
| [testing.md](workflows/testing.md) | Suite map; run-all; canon; localStorage reset helper; what green gates |
| [data-curation.md](workflows/data-curation.md) | /song flow; songs.json editing rules; track curation; phone->laptop merge |
| [roadmap-missions.md](workflows/roadmap-missions.md) | Tutor phases; mission/sprint record; wave-2 deferrals; backlog register |

## Routing table - "which page owns X"

| X | Page |
|---|---|
| Why does F major show A#? | theory-engine/note-spelling.md |
| Add/modify a scale | theory-engine/solo-scales.md (+ theory-verification for canon) |
| Roman numeral looks wrong | theory-engine/harmonization.md |
| A destructive control / undo | ux-philosophy/interaction-safety.md |
| One-shot hint/banner | ux-philosophy/interaction-safety.md (notables) |
| A toast / transient feedback / which UI primitive to use | ux-philosophy/ui-primitives.md |
| Chord diagram / fretboard rendering | systems/instrument-profiles.md |
| Studio / solo panel / backing tracks | systems/practice-studio.md |
| Key picker / transpose behavior | systems/compose-key-system.md |
| localStorage / backup / migration | systems/data-model.md |
| SW cache / offline | systems/offline-pwa.md |
| How to verify before shipping | workflows/dev-verify-ship.md |
| What is planned / deferred | workflows/roadmap-missions.md |
