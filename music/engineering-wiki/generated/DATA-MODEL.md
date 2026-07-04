<!-- GENERATED from music/engineering-wiki/: systems/data-model.md, systems/instrument-profiles.md | regenerate by re-synthesizing those pages | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Data Model

Song/track shapes, storage namespacing, the schema-versioning discipline, and the instrument-profile contract that renders chords and scales.

## songs.json

Array of records: `{ t, a, y, d, seq[], sheet[[section,line]...], jam? }`.

| Field | Rules |
|---|---|
| `t` / `a` | title / artist (pair effectively unique) |
| `y` / `d` | year + decade chip - MUST agree (`"y":1970` -> `"d":"70s"`) |
| `seq` | chord tokens in order; every token matches `^[A-G][#b]?...` and reflects the real key |
| `sheet` | `[section, line]` tuples; inline chords as `[C]lyric`; every bracketed token must split cleanly and transpose |
| `jam` | `true` = Play-now jam starter; absent -> fewest-chord songs back-fill |

Edit discipline: surgical diffs, 2-space formatting preserved; validate `JSON.parse` + token split after every edit.

## tracks.json + trackKey identity

Track records: `{ title, artist, genre, key (canonical sharp), mode, bpm?, capo?, yt?|null, tags? }`. When `yt` is null, a deterministic YouTube search query substitutes.

`trackKey` is the stable identity for the curated-URL overlay: `[title, artist, key, mode].join('|').toLowerCase().trim()` - cosmetic case/whitespace changes cannot orphan a curated video. A `LEGACY_TRACKKEYS` migration map remaps keys stored under old mode-coarsening rules.

## Merged repertoire

The library is ONE list: songs merged with matching tracks. Match on normalized title+artist; key as tiebreak among multiple candidates; consumed tracks marked `_used`; unmatched tracks become standalone items. Merged records keep the song shape and gain track fields (genre/bpm/yt) so the Studio can open them.

## localStorage namespaces

| Prefix | Contents |
|---|---|
| `songbook.` | engine defaults (legacy) |
| `roadcase-<profileId>` | per-instrument `setlist.v1` + `custom.v1` |
| `bt.` | backing-tracks custom + curation |
| `music.` | global: theme, accent, active profile, track URLs, notables, last backup |

Every reader is defensive (try/catch -> safe default). `backup.js`'s `OWNED_PREFIXES` governs what backup/restore captures.

## SCHEMA_VERSION - the additive-vs-breaking law

Current `SCHEMA_VERSION = 1`; `MIGRATIONS = {}`.

- **ADDITIVE** (new optional field, whole new key): no bump, no migration. Old readers ignore it; defensive reads handle absence.
- **BREAKING** (rename/remove a field a reader depends on, retype, change a value's meaning, reshape the container): bump `SCHEMA_VERSION` AND add the matching `MIGRATIONS[n]` step in the SAME commit.

Why this matters: it's an offline PWA, so an old cached build can read data a newer build wrote. Additive is safe both directions; breaking is only safe forward. The `.vN` key-name suffix guards nothing by itself - the migration runner is the actual seam.

## Backup / restore

Settings-driven whole-songbook snapshot:

| Function | Behavior |
|---|---|
| `snapshot(store, nowIso)` | collect owned keys -> `{ app:'music', schema, exportedAt, data }` |
| `validate(payload)` | shape check + refuses a NEWER schema (downgrade guard) |
| `restore(store, payload)` | run pending migrations, write ATOMICALLY (all-or-nothing rollback on quota/throw) |

Keep `test/backup.test.js` green on any storage-touching change.

## Instrument profiles - the pack contract

Each `music/shared/profiles/<id>.js` self-registers into `window.MusicProfiles`:

```
{ id, label, instrument, tuning, strings: [{n, l, f}...], chords: { "C": [-1,3,2,0,1,0], ... } }
```

Fret arrays are per-string (low->high display order): `-1` muted, `0` open, `N` fretted. `profiles/manifest.json` lists active profiles in load order. 8 profiles ship today: guitar standard/drop-D/open-G, ukulele GCEA, banjo gDGBD, mandolin GDAE, mandola CGDA, cigar box DGBD.

**Consuming surfaces:** `Diagram.render(frets, opts)` (the chord SVG - a base-fret digit renders instead of the nut bar when a shape sits above fret 4; a reserved label pad keeps canvas size constant across open and offset shapes); `pack.playChord`/`playNote` (Web Audio); `pack.scaleDiagram(...)` with `supportsStart` (the fretboard scale map, position-walk capable).

**Enharmonic shape lookup:** canonical-sharp names come in (FORK-4), but a profile may key voicings under flats (a hand-curated "Bb" fingering). Lookup order: exact name -> enharmonic twin -> movable-template fallback. The displayed name never changes, only the fingering source.

**HGT/HSR shape families:** ukulele GCEA's lower three strings (G C E) carry the same interval geometry as guitar's D G B set (P4 + M3) - movable-shape muscle memory transfers across instruments. Shape families (C-family, F-family, A-family) name the movable barre forms; Hammer/Slide/Rotate describes moving between I-IV-V shapes up the neck. The triad-inversions page (`music/play/triad-inversions.html?p=<profile>&key=<root>&mode=<mode>`) teaches this cycle; a full live HSR overlay is backlog.

## Related generated docs

[ARCHITECTURE.md](ARCHITECTURE.md) - where these stores fit in the boot sequence and the service worker's CORE list. [THEORY.md](THEORY.md) - the spelling contract instrument profiles must respect.
