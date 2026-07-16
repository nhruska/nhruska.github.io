# Goal Spec: chord-collapse-advanced

> Friction origin (operator, 2026-07-16, verbatim-essence): chord charts are too
> big and cause scroll off page when at ADVANCED guidance level - expected them
> to collapse to chord letter + roman numeral. Interviewed via /goal-interview;
> three taste calls resolved below.

## Interview decisions (operator, 2026-07-16)

| Question | Decision |
|---|---|
| Collapse UX | Collapsed chips + TAP TO EXPAND one chord's full diagram (tap again re-collapses) |
| Scope | EVERYWHERE chord grids render (play page chord chain/grid, songbook grid, Studio chords-in-key row) |
| Intermediate level | Same as beginner - full diagrams. ONLY 'advanced' collapses |

## Completion condition (paste into /goal)

> At guidance level 'advanced', every chord-grid surface renders collapsed chips
> (chord letter + roman numeral where key context exists) with tap-to-expand a
> single diagram; beginner/intermediate/unset render byte-identical to today;
> `node --test test/` exits 0 with new unit tests covering the collapse decision
> layer; `scripts/check-cache-bump.sh` passes; and a headless Playwright run at
> 412x915 shows the play-page chord area causing no vertical page scroll at
> advanced level, with zero console errors, screenshots saved as evidence.

## Verification

- `node --test test/` exits 0 (existing suite + new tests).
- `bash scripts/check-cache-bump.sh` exits 0 (SW CACHE + build-stamp bumped -
  music/shared and music/play WILL change).
- Playwright (shared venv `~/.claude/.venv`, browsers `~/.cache/ms-playwright`),
  412x915: with `music.guidanceLevel.v1 = 'advanced'` seeded in localStorage,
  load `music/play/`, measure `document.documentElement.scrollHeight <=
  window.innerHeight` for the chord-chart region fitting (assert the chord grid
  bottom edge is inside the viewport, per mobile-ui-lessons: geometry vs
  viewport, not a class check), screenshot both themes.
- Inverse checks: 'beginner', 'intermediate', and UNSET levels render the
  chord surfaces byte-identical to origin/main (extend the SHA-256-lock
  pattern in test/diagram.dom.test.js or DOM-compare at the adapter layer).
- Tap-to-expand live-verified: tap a chip -> full diagram for that chord only;
  tap again -> re-collapse. Zero console errors.

## Design constraints (detected, binding)

- **One choke point:** all chord diagrams render via
  `music/shared/chord-pack-adapter.js` -> `Diagram.render()` (3 call sites:
  diagram/diagramClosed/diagramChain). The collapse decision belongs at the
  adapter/caller layer, NOT inside diagram.js (same agnostic contract as
  patternLabel/reserveLabelSlot - diagram.js never reads prefs).
- **Guidance level reader:** `music/shared/guidance-level.js`
  (`GuidanceLevel.get()` -> 'beginner'|'intermediate'|'advanced'|null). null
  (unset) MUST behave as non-advanced (full diagrams) - never guess.
- **Roman numeral needs key context.** Where the surface has a key (Studio
  chords-in-key, keyed play contexts), render letter + roman. Where no key
  context exists, render the letter alone - honest omission, never a guessed
  roman (matches shape-classify.js honest-null philosophy).
- **Composes with, never replaces, S-DIAGRAM-PREF:** the dots/patterns pref
  (`music.diagram.pref.v1`) governs the EXPANDED diagram's style. Collapse is
  a third, orthogonal layer keyed on guidance level.
- **Card-height parity:** collapsed chips in one row must be uniform height
  (U21 lesson - no misaligned row-mates).
- **Never changes:** WHICH chords show, any theory output, the solo scale view.

## Scope

- In: `music/shared/chord-pack-adapter.js`, chord-grid render paths in
  `music/shared/songbook.js` / `music/shared/tracks.js` / key-explorer
  chords-in-key row, minimal CSS for chips, `music/sw.js` CACHE bump +
  `music/shared/build-stamp.js` mirror, new/extended tests in `test/`.
- Out: guidance-level.js semantics (read-only consumer), diagram.js internals
  beyond what an additive opt requires, Notables/ask flows, theory modules
  (circle.js), solo scale view, songs.json shape.

## Guardrails (never do unattended)

- Never commit to or push `main` - feature branch + PR only (main is protected).
- Never merge the PR - operator decision.
- No new storage keys unless additive under the `music.` prefix with defensive
  reads (backup.js OWNED_PREFIXES rule); no SCHEMA_VERSION bump for additive.
- No deletion/rewrite of existing tests to make the suite pass.
- Read `music/CLAUDE.md` before touching anything under `music/` (SW-cache +
  note-spelling + preview-link conventions).

## Abort & surface to human when

- 3 failed attempts at any single gate (test suite, layout check, cache-bump).
- The byte-identical inverse check cannot be satisfied without restructuring a
  surface (scope fork - operator call).
- Roman-numeral derivation would require new theory plumbing beyond existing
  key context (scope fork - ship letter-only there and note it, or ask).

## Priorities

- Correct-and-verified over fast. Ship all three surfaces in one PR if the
  adapter choke point makes that natural; split only if the diff becomes
  unreviewable.
- Acceptable partial state: play page collapsed + verified, other surfaces
  behind the same code path but with a named follow-up for any surface that
  resisted - stated honestly in the PR body.

## Budget

- Single autonomous run, roughly one evening-shift arc (comparable to an
  S-tier queue item). If the run exceeds ~2h of iteration without a green
  suite, abort-and-surface.

## Per-iteration context

- Re-read this spec + `music/CLAUDE.md` conventions each turn.
- The completion condition's inverse checks (non-advanced byte-identical) are
  as load-bearing as the collapse itself - regressions for beginners are the
  failure mode.
- Evidence per evidence-integrity: gate on exit codes unpiped, inspect real
  screenshots, never claim a level's behavior without seeding that level and
  looking.
