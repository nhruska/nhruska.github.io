<!-- GENERATED from music/engineering-wiki/: AGENTS.md, index.md (dev-audience brief over the wiki's read order) | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Onboarding Brief

A new agent (or developer) landing on the Music app: read this first, in this order, before touching code.

## Read order

1. This brief - the six contracts below are the ones that bite hardest if skipped.
2. [music/CLAUDE.md](../../CLAUDE.md) - the app's working agreement (layout, conventions, preview/CI).
3. The wiki namespace matching your task - use the routing table below, or the full [index.md](../index.md).
4. [decisions.md](../decisions.md) - before you second-guess ANY existing behavior. If it has an ID, it was ruled deliberately.

If your task touches spelling, chords, romans, or scales, [THEORY.md](THEORY.md) is mandatory reading before you write a line - it's the app's #1 credibility contract, and the wiki's `theory-engine/` pages carry the anchors.

## The six contracts that bite if skipped

1. **Canonical-sharp spelling (FORK-4).** One sharp table, everywhere. Flat input normalizes on load; flats never render. All three name-emitting surfaces (scale spelling, diatonic chords, suggestion seeds) must agree. This is mid-flip: PR #98 will introduce a key-aware regime B - anything marked `[TRACKS-#98]` in the source wiki changes when that PR merges. Full contract: [THEORY.md](THEORY.md).
2. **Service-worker CACHE bump.** Touch ANY file the service worker precaches (shared runtime JS/CSS, a profile, `songs.json`, `tracks.json`) and you MUST bump `CACHE = 'music-vN'` in the SAME commit. Skip it and returning users silently keep serving stale assets. Full list: [ARCHITECTURE.md](ARCHITECTURE.md#offline-service-worker-and-cache-discipline).
3. **The SCHEMA_VERSION / backup seam.** A storage-shape change is either additive (safe, no bump) or breaking (bump `SCHEMA_VERSION`, add a `MIGRATIONS[n]` step, same commit). This is an offline PWA - an old cached build can read data a newer build wrote. Full contract: [DATA-MODEL.md](DATA-MODEL.md).
4. **One screen, above the fold.** Every phone layout (412x915 baseline) must reach its primary action without scrolling. Before adding UI, ask if it pushes the primary action below the fold - if yes, reclaim space first. Full context: [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md).
5. **The destructive-guard taxonomy.** Anything that deletes or mutates user work needs a guard: confirm modal, edit-mode gating, a persistent (never timed) undo banner, and/or movement-cancelled tapping. The scroll rail is the single most dangerous place for an always-hot control. Full taxonomy: [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md#guarding-destructive-actions).
6. **The theory canon is authoritative.** `test/theory-canon.test.js` runs 1008 pitch-class/quality/roman checks. A red canon means a real regression - never loosen the test, find the change that broke it. Full detail: [TESTING.md](TESTING.md).

## Routing table - "which page owns X"

| Question | Read |
|---|---|
| Why does F major show A#? | [THEORY.md](THEORY.md) |
| Adding or modifying a scale | [THEORY.md](THEORY.md), then [TESTING.md](TESTING.md) for the canon |
| A roman numeral looks wrong | [THEORY.md](THEORY.md) |
| A destructive control needs a guard | [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| A one-shot hint or banner | [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| Chord diagram / fretboard rendering | [DATA-MODEL.md](DATA-MODEL.md) |
| Studio / solo panel / backing tracks | [ARCHITECTURE.md](ARCHITECTURE.md), [THEORY.md](THEORY.md) |
| Key picker / transpose behavior | [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md) |
| localStorage / backup / migration | [DATA-MODEL.md](DATA-MODEL.md) |
| Service-worker cache / offline | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How to verify before shipping | [DEV-GUIDE.md](DEV-GUIDE.md) |
| What's planned or deferred | [ROADMAP.md](ROADMAP.md) |
| Has this already been decided? | [DECISIONS.md](DECISIONS.md) |

## Spawning sub-agents on this app

Point a sub-agent at 1-3 specific wiki pages as required reading, with a one-line "pull if..." decision hook - never the whole wiki. Example:

```
Required: theory-engine/note-spelling.md - pull if the task touches spelling,
key labels, or the #98 seam functions.
Optional: systems/practice-studio.md - pull if the change surfaces in the Studio.
```

The source pages carry file:line anchors; the generated docs (this one included) are the synthesized, standalone read - point orientation-only sub-agents here, and point implementation sub-agents at the specific source wiki pages they need to edit or cite.

## Related generated docs

[THEORY.md](THEORY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATA-MODEL.md](DATA-MODEL.md), [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md), [DEV-GUIDE.md](DEV-GUIDE.md), [TESTING.md](TESTING.md), [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md), [CONTRIBUTING.md](CONTRIBUTING.md) - the full generated set this brief indexes.
