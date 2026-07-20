# Codebase Readability Standard

[Wiki](../index.md) > workflows > Codebase Readability Standard

## Goal

An experienced engineer - skeptical, and also a musician who uses this app - should be able to open any file, understand the **standard pattern** it follows, orient quickly, and make a feature PR without cringing. Comments explain **what the code does and the pattern it follows**, not the history of how it got here.

This is a legibility standard, not a behavior standard: applying it never changes what the app does.

## The rule: comments describe the code, not its history

| Write this | Not this |
|---|---|
| What the code does now, and the pattern it follows | Which mission/PR/UAT round changed it |
| A load-bearing "don't do X, because Y breaks" warning, phrased plainly | "byte-identical to the pre-existing output" / "re-staggered past #275" |
| The contract at an integration seam (inputs, outputs, invariants) | A changelog of every version bump |
| A pointer to the decision record when the rationale is deep | The rationale retold inline as a war-story |

**Historical rationale still matters - it just lives in one place, not scattered inline.** When a comment needs to cite *why* a non-obvious choice was made, point to the decision record instead of retelling it:

```js
// Minor keys realize against their relative major so every chord lands in
// the key's pitch set (see decisions.md: HOME-KEY).
```

not

```js
// HOME-KEY (operator UAT 2026-07-20, "suggested are incompatible key"): the
// S-DIAGRAM... A10 max+1 ... realizeRoman major-math produced F#m ...
```

## Where history lives (so it can leave the code)

- **Git history** - every change, its diff, and its commit message. The authoritative "when + what".
- **[decisions.md](../decisions.md)** - the durable "why" for choices a future engineer might otherwise undo. Comments cite these by their `D-…` / short-name key.
- **[change-history.md](../change-history.md)** - archived long-form changelogs (e.g. the old `sw.js` cache-bump log) kept for traceability, out of the code.

A mission codename (`S-DIAGRAM-PREF`, `M-EAR wave 1.6`), a UAT round (`U8b`), a PR number, or a version-bump note (`v82->v83`) does not belong in a code comment. If the fact is load-bearing, restate it plainly; if it is only provenance, git and the docs above already hold it.

## Module header format

Every shared module opens with a short header that answers, in this order:

1. **What it is** - one line: the module's job.
2. **The pattern** - how it works at a glance (the mental model an engineer needs before reading the body).
3. **Public API / contract** - the exported surface and any integration-seam invariants callers depend on.
4. **Gotchas** - the few genuine "don't do X" warnings, each with its plain reason.

[nav-history.js](../../../shared/nav-history.js) is the reference example - purpose, the back-stack pattern, the locked API, and the wiring contract, with no historical banter.

## Cache versioning (the current pattern)

The service worker's `CACHE` string is the deploy version. It is set to the **PR number** (`music-v<PR#>`), so the live build maps 1:1 to its PR. Bump `CACHE` (and the paired `build-stamp.js` `VERSION`) in any commit that changes a `CORE`-precached file. `scripts/check-cache-bump.sh` enforces the pair. History of past bumps: git log + [change-history.md](../change-history.md).

## Self-check before committing a comment

- Does it explain what the code does / the pattern, or only how it came to be? Keep the former.
- Does it name a mission / PR / UAT round / version bump? Remove the name; keep the fact only if it's load-bearing, phrased plainly.
- Is the rationale deep enough to need the full story? Point to decisions.md instead of retelling it.
