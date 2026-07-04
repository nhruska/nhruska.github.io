<!-- GENERATED from music/engineering-wiki/: workflows/testing.md, theory-engine/theory-verification.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Testing

The suite map, the theory canon's special authority, and how to extend either one.

## Running the suite

```
node test/run-all.js
```

Discovers every `test/*.test.js` (the `helpers/` subdirectory is invisible to the glob by design), spawns one process per file, aggregates the results. Exit 0 = green. Dependency-free - pure Node `assert`, no npm install required. CI runs this on every PR.

## Suite map

| Suite | Covers |
|---|---|
| `circle.test.js` | circle-of-fifths engine: MODE_STEPS, spelling, romans, qualities |
| `theory-canon.test.js` | the 1008-check conservatory canon + scales-canon literals |
| `solo-scales.test.js` | pentatonic/blues tables: pitch classes, spelled names, degrees, subset proofs |
| `songbook.test.js` | engine theory helpers (`chordsFromDegrees`, `chordInKey`, `romanInKey`), suggestion merge, clear-undo snapshot fns, `wireTapCancel` |
| `songbook-firstrun.test.js` | first-run notable consumer logic |
| `notables.test.js` | claim/dismiss/priority arbitration, corrupt-storage tolerance |
| `tracks.test.js` | studioTheory, soloBundle, whynote templates, trackKey/migrations |
| `backup.test.js` | SCHEMA_VERSION seam: snapshot/validate/restore, atomicity, downgrade guard |
| `repertoire.test.js` / `repertoire-form.test.js` | merge model + add/edit form |
| `diagram.test.js` / `diagram.dom.test.js` | SVG chord + scale rendering, incl. a DOM-stub harness |
| `key-explorer.test.js` / `key-explorer.dom.test.js` | posWindow math + render contracts |
| `list-item.test.js` | unified row rendering + wireTap movement-cancel |
| `tuner.test.js` | autocorrelation smoothing chain |
| `queue.test.js` / `tempo.test.js` / `candidates.test.js` / `chord-pack-xss.test.js` / `live-adapter.test.js` | supporting modules |

## Patterns worth knowing

- **localStorage isolation:** `test/helpers/local-storage-reset.js` exposes `{ clear(store, prefixes?), fakeStore() }`; consumers shim a callable `resetLocalStorage(seed)` where convenient. Namespaced prefixes mirror `backup.js`'s `OWNED_PREFIXES`.
- **DOM stubs, no jsdom:** minimal `createElement` fakes cover node-side render tests (`notables.test.js`, `diagram.dom.test.js`).
- **Corruption self-test:** the theory canon proved it CAN fail before its pass was trusted - a table was deliberately broken, the failure named the exact context, then it was reverted.

## The theory canon's special authority

`test/theory-canon.test.js` asserts pitch-class correctness, chord quality, and roman degree/case for 12 roots x 4 studio modes x (7 scale tones + 7 chords + 7 romans) = **1008 checks**, grouped so a failure names the exact root+mode+degree.

| Dimension | Checks | Never checks |
|---|---|---|
| Pitch class | Scale pc sequence + chord pc per mode | Spelling (a display policy, not a correctness fact) |
| Quality | Triad quality from stacked thirds | - |
| Roman degree + case | Position in mode; casing by chord quality | Letter names (F# vs Gb is a regime choice, see [THEORY.md](THEORY.md)) |

The ground-truth encoder uses letter-sequential spelling (matching conservatory practice) - its output deliberately differs from the app's regime-A output; only pitch class, quality, and degree are asserted as facts, never the letter name itself.

**A red canon test means a theory regression** - MODE_STEPS, a quality table, or a labeling path changed. Never loosen the test to make it pass; find and fix the change that broke it.

An independent adversarial review (a GPT-5.5 senior-professor persona instructed to refute the theory) found no theory bugs across pitch class, degree order, triad quality, or roman case/symbol - full detail and the 12 golden-trap cases live in [THEORY.md](THEORY.md).

## Extending the canon (new scale or mode)

1. Add the interval entry at the single source of truth (`Circle.MODE_STEPS` for 7-note modes; `Circle.SOLO_SCALES` for solo scales).
2. Add canon entries: pitch-class and degree expectations across all 12 roots.
3. For pentatonics: hand-verify and test the subset proofs (the 5-note set really is contained in its claimed parent modes).
4. For anything spelling-sensitive: check the golden-trap cases; comment any blue-note-class decision with which spelling regime it assumes.
5. Update the Studio UI and [THEORY.md](THEORY.md) if the change is user-visible.

No hand-coded scale/chord table should exist anywhere else in the codebase - everything derives from the SSOT.

## What green means before you ship

`run-all` exits 0; the canon is green (a red canon is a regression to fix, never a test to loosen); any storage-touching change keeps `backup.test.js` green; on a laptop with Playwright available, add the zero-console-error render check (see [DEV-GUIDE.md](DEV-GUIDE.md)).

## Related generated docs

[DEV-GUIDE.md](DEV-GUIDE.md) - where this fits into the full verify-and-ship bar. [THEORY.md](THEORY.md) - the spelling/harmonization contract the canon defends.
