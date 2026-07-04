<!-- GENERATED from music/engineering-wiki/: workflows/dev-verify-ship.md, ux-philosophy/design-principles.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Contributing

What to keep in mind before you touch this app, and how a change gets from your editor to the live site.

## The constraints that shape every change

**One screen, above the fold.** The app never forces a scroll to reach the primary action on a phone (412x915 viewport). Before adding UI, ask "does this push the primary action below the fold?" - if yes, reclaim space first, don't just make the screen taller.

**Instrument-in-hands grip model.** Assume the user is holding an instrument with one free thumb. 44px minimum hit targets. The bottom third of the screen is easy reach; the top third is a stretch - never put a destructive control there. The right-edge scroll rail is the single most dangerous place for an always-hot action (it fires on scroll-grab); movement-cancel it.

**Consequence intolerance.** A mis-tap must never delete or edit anything. Every destructive control needs a guard (confirm modal, edit-mode gating, persistent undo, or movement-cancelled tapping) - see the full taxonomy in [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md).

**Theory-authority trust chain.** This is a theory authority. One wrong chord spelling or scale note and a skilled player is gone for good. If your change touches spelling, chords, or scales, read [THEORY.md](THEORY.md) first - the credibility bar is the app's identity.

**No bloat.** One surface, one view toggle, never a dashboard. If a feature idea doesn't serve the harmony-teacher soul, it's the wrong feature for this app, regardless of how good the idea is on its own.

**Functional naming.** Name controls by what they do and what happens when you tap them, not by brand ("Video" vs "Search", not a made-up feature name).

## Before you write code

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) if you're touching runtime, storage, or the service worker.
2. Read [THEORY.md](THEORY.md) if you're touching spelling, scales, chords, or romans - this is the highest-stakes surface in the app.
3. Check [DECISIONS.md](DECISIONS.md) before you second-guess an existing behavior - if it has a decision ID, it was ruled deliberately; propose a change explicitly instead of drifting from it in code.

## Making the change

- Branch as `claude/<slug>` (or your own convention) - never commit straight to `main`.
- Keep diffs surgical, especially on `songs.json`/`tracks.json` - write back with the same formatting so a diff shows only the intended lines.
- If you touch anything the service worker precaches (any shared runtime file, a profile, `songs.json`, `tracks.json`), bump the `CACHE` version in the SAME commit. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full CORE list and why this matters.
- If you touch a storage shape a reader depends on, check whether it's additive (safe, no bump needed) or breaking (bump `SCHEMA_VERSION`, add a migration) - see [DATA-MODEL.md](DATA-MODEL.md).

## Verifying before you open a PR

Run `node test/run-all.js` - every suite must be green. If you have Playwright + a shared venv available, render-verify the changed surface at phone (412x915) and desktop widths with zero console errors. Full verification bar (what's expected per surface, and what green gates a merge): [DEV-GUIDE.md](DEV-GUIDE.md).

## Opening the PR

Push your branch, open a **draft** PR, and post a githack preview link (branch-form by default, so it tracks every subsequent push). The human operator merges - this app's contribution flow does not self-merge. CI runs the unit suite and posts the preview comment automatically; nothing else gates the merge.

## Related generated docs

[DEV-GUIDE.md](DEV-GUIDE.md) - the full verification bar and test suite map. [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) - the personas and guard taxonomy behind these constraints. [DECISIONS.md](DECISIONS.md) - what's already been ruled.
