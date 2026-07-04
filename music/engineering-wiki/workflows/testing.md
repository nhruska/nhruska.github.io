# Testing

[Wiki](../index.md) > workflows > Testing

## Purpose

The suite map, the canon authority, and what green means.

## Discovery + run [STABLE]

`node test/run-all.js` discovers every test/*.test.js (helpers/ subdirectory is invisible to the glob by design), spawns one process per file, aggregates. Exit 0 = green. Dependency-free (pure node assert). CI runs it on every PR (tests.yml).

## Suite map [STABLE]

| Suite | Covers |
|---|---|
| circle.test.js | circle-of-fifths engine: MODE_STEPS, spelling, romans, qualities |
| theory-canon.test.js | the 1008-check conservatory canon + scales-canon literals ([theory-verification](../theory-engine/theory-verification.md)) |
| solo-scales.test.js | pentatonic/blues tables: pcs, spell()-names, degrees, subset proofs |
| songbook.test.js | engine theory helpers: chordsFromDegrees, chordInKey, romanInKey, suggestion merge, clear-undo snapshot fns, wireTapCancel |
| songbook-firstrun.test.js | first-run notable consumer logic |
| notables.test.js | claim/dismiss/priority arbitration, corrupt-storage tolerance |
| tracks.test.js | studioTheory, soloBundle, whynote templates, trackKey/migrations |
| backup.test.js | SCHEMA_VERSION seam: snapshot/validate/restore, atomicity, downgrade guard |
| repertoire.test.js / repertoire-form.test.js | merge model + add/edit form |
| diagram.test.js / diagram.dom.test.js | SVG chord + scale rendering (incl. DOM-stub harness) |
| key-explorer.test.js / key-explorer.dom.test.js | posWindow math + render contracts |
| list-item.test.js | unified row rendering + wireTap movement-cancel |
| tuner.test.js | autocorrelation smoothing chain |
| queue.test.js / tempo.test.js / candidates.test.js / chord-pack-xss.test.js / live-adapter.test.js | supporting modules |

## Patterns [STABLE]

- **localStorage isolation:** test/helpers/local-storage-reset.js ({clear(store, prefixes?), fakeStore()}); consumers shim a callable resetLocalStorage(seed) where convenient. Reset per test case; namespaced prefixes mirror backup.js OWNED_PREFIXES.
- **DOM stubs:** minimal createElement fakes for node-side render tests (see notables.test.js, diagram.dom.test.js) - no jsdom dependency.
- **Corruption self-test:** a new canon-grade suite proves it CAN fail before its pass is trusted (break a table deliberately, watch the named failure, revert).

## Green gates [STABLE]

run-all exit 0; canon green (a red canon = theory regression - fix the change, never the test); storage-touching changes keep backup.test.js green; laptop surface adds the zero-console-error render check ([dev-verify-ship](dev-verify-ship.md)).

---

**Anchors verified:** test/run-all.js, test/* (current suites), test/helpers/local-storage-reset.js, backup.js OWNED_PREFIXES
