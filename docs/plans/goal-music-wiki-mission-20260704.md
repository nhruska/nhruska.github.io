# Goal Spec: music-wiki-mission (2026-07-04)

> Build the Music app's engineering-wiki as living system documentation - theory engine,
> UX/HF philosophy, systems, workflows - sufficient to GENERATE the standard repo docs on
> demand and to orient every future agent (wiki-first MVC briefs). Second live run of the
> core-sdlc /mission pattern. Operator mode: MERGE-ALL TRUST (agent merges on green).

## Completion condition (paste into /goal)

> Mission per docs/plans/goal-music-wiki-mission-20260704.md is complete when:
> (1) music/engineering-wiki/ exists (AGENTS.md + index.md + pages across
> theory-engine/, ux-philosophy/, systems/, workflows/), every page grounded in
> code/doc anchors and wiki:lint clean; (2) the 11-doc acceptance set generates
> from the wiki and is committed (ARCHITECTURE, THEORY, UX-PHILOSOPHY, DEV-GUIDE,
> music README refresh, CONTRIBUTING, TESTING, ROADMAP, DECISIONS, plus the
> new-agent onboarding brief via wiki:brief dev); (3) two adversarial reviews are
> recorded and folded: theory-professor (codex) over theory pages AND a
> SEASONED-GUITARIST persona (P5) over theory+UX pages; (4) the operator's
> omissions are encoded: blues-scale gap + expertise-adaptive display (dots vs
> clean patterns, hand-position/fingering, muscle-memory patterns) as wiki
> content AND S-BLUES + S-DIAGRAM-PREF specs appended to the sprint backlog;
> (5) merged to main under trust mode with node suite + validators green, and
> the wiki-mission Mission Control artifact + final telegram/email delivered.

## Verification

- `node test/run-all.js` green (wiki adds no runtime code; suite must stay green).
- wiki:lint clean; every page carries source anchors (file:line or doc refs); link validator over the wiki tree.
- Doc-generation proof: each acceptance doc produced FROM wiki content (brief/export path recorded per doc), committed under music/engineering-wiki/generated/.
- Adversarial verdict files committed (professor + P5) with fold dispositions (FIXED/REFUTED/DEFERRED per finding).
- validate-no-ai-tells.py clean on generated human-facing docs.

## Personas for adversarial (this mission)

- P2 professor (returning): attacks theory pages' correctness incl. documented policies (sharp-tie, roman hybrid, FORK-4 -> #98 transition).
- **P5 Seasoned Guitarist (NEW, operator-specified):** 20+ years playing; dismisses beginner-splained docs; checks: blues/pentatonic treatment, position playing + CAGED-adjacent shape language, hand-placement/fingering guidance, muscle-memory pattern framing, whether expertise-adaptive display (no finger dots for pros; fretboard scale view as the guide) is honestly designed.

## Phases (core-sdlc, personal-fast profile, trust mode)

| # | Phase | Detail |
|---|---|---|
| 0 | Branch + corpus map | claude/music-wiki-mission off main; ingestion map of the 18-doc corpus + code modules + mission artifacts (incl. sprint-1 docs); new Mission Control artifact (wiki mission) linked from the closed one |
| 1 | IA synthesis (Fable judgment moment, D8) | Page tree + page contracts per namespace; what each page owns; dedupe/supersede plan for THEORY-ENGINE.md and friends (wiki becomes canonical; old docs get pointer stubs or retire) |
| 2 | Page drafting fan-out | wiki-doc-drafter agents per namespace (read-only, code-grounded); parent assembles + commits; blues-scale gap + expertise-adaptive display authored into theory-engine/ + ux-philosophy/ |
| 3 | Doc generation | wiki:brief/export -> the 11 acceptance docs into generated/; music/README.md refresh PR-included |
| 4 | Adversarial x2 + fold | codex professor pass + codex P5 pass; every finding folded with disposition |
| 5 | Verify + merge (trust) | lint + links + suite + no-AI-tells green -> merge to main; SW bump only if any CORE file touched (not expected) |
| 6 | Close | S-BLUES + S-DIAGRAM-PREF appended to sprint backlog; scorecard; session save; final report ping |

## Scope

- In: music/engineering-wiki/** (new), music/README.md refresh, pointer-stub edits to superseded music/docs/*.md, sprint-backlog append in docs/plans/ux-sprint-1-20260703.md.
- Out: ALL runtime code (no engine changes - S-BLUES/S-DIAGRAM-PREF are QUEUED not built), wave-2 items (#98 still gates), M3, root site.

## Guardrails

- Trust mode = merge on green, but NOTHING outside the In-scope paths; zero runtime-code edits; suite green is a hard pre-merge gate; wiki pages never contain secrets/personal data (public repo).
- Wiki is canonical after merge (wiki-source-of-truth): superseded docs must stub-point, never fork.
- Telegram per locked convention; Fable only at the phase-1 IA moment; drafters Sonnet; codex for both adversarial passes.

## Abort / surface

- Corpus contradiction the wiki can't reconcile (doc vs code) -> trust code, note drift, keep moving; if load-bearing ambiguity (theory contract), ⚠️ FAIL ping.
- codex unavailable -> in-Claude adversarial fallback, noted in verdict file.

## Budget

Phases 0-2 ~1-2h (fan-out), 3-5 ~1h, close ~15m. Heavy Sonnet fan-out, one Fable call, two codex passes.

## Per-iteration context

This spec; branch claude/music-wiki-mission; IA doc once written; trust-mode scope list; the P5 persona definition; operator omissions verbatim (blues scale / seasoned-player adversarial / diagram-preference + hand-placement + muscle-memory patterns).

---

## Operator amendments (pre-launch, 2026-07-04)

1. **Same HiTL Mission Control + telegram**: continue the existing artifact URL (docs/artifacts/ux-personas-20260703.html) as the single pane - cockpit flips to this mission; sprint-1 record stays in tabs. Telegram per locked convention.
2. **Absorb + DECOM**: superseded music/*.md and music/docs/*.md are ABSORBED into wiki pages then DECOMMISSIONED - reduced to a 2-3 line pointer stub (title + "moved to wiki" link) or deleted where nothing external links them. The IA phase emits an explicit absorb/decom disposition table per doc.
3. **S-BLUES is BUILT in-mission** (upgraded from queued): pentatonic major, pentatonic minor, and blues scale added to the SOLO-SCALE toolset (Studio scale panel + chips; Compose hand-off inherits). NOT added to the harmonization key/mode system (no diatonic-triad palette for 5/6-note scales - solo layer only). Constraints: deterministic scale tables + unit tests across 12 roots; spelling via the canonical speller (and #98's key-aware seam noted - additive SCALES table, minimal touch to circle.js/tracks.js hot lines, rebase-over-#98 accepted); professor pass covers the new scales (blue-note b5 spelling!); P5 attacks the toolset's usefulness (positions, patterns, muscle memory). S-DIAGRAM-PREF remains queued.
4. Completion condition therefore ALSO requires: scales live in Studio with tests green + both adversarial passes covering them.
