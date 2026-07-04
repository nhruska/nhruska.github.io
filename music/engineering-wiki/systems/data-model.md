# Data Model

[Wiki](../index.md) > systems > Data Model

## Purpose

Song/track data shapes, localStorage namespaces, backup/restore versioning, and the SCHEMA_VERSION discipline.

## songs.json [STABLE]

Array of records: `{ t, a, y, d, seq[], sheet[[section,line]...], jam? }`.

| Field | Rules |
|---|---|
| t / a | title / artist (pair effectively unique) |
| y / d | year + decade chip - MUST agree ("y":1970 -> "d":"70s") |
| seq | chord tokens in order; every token matches `^[A-G][#b]?...` and reflects the real key |
| sheet | [section, line] tuples; inline chords as `[C]lyric`; every bracketed token must split cleanly (Songbook.splitChord) and transpose (tpose) |
| jam | true = Play-now jam starter; absent -> fewest-chord songs back-fill |

Edit discipline: surgical diffs, 2-space formatting preserved; validate JSON.parse + token split after every edit (music/CLAUDE.md:24,28).

## tracks.json + trackKey identity [STABLE]

Track records: `{ title, artist, genre, key (canonical sharp), mode, bpm?, capo?, yt?|null, tags? }`. When yt is null, a deterministic YouTube search query substitutes.

**trackKey** (tracks.js ~150): `[title, artist, key, mode].join('|').toLowerCase().trim()` - the stable identity for the curated-URL overlay; cosmetic case/whitespace changes cannot orphan a curated video. **LEGACY_TRACKKEYS** (tracks.js ~305-315): migration map remapping keys stored under old mode-coarsening rules (modal seeds once filed under 'major').

## Merged repertoire [STABLE]

Library = ONE list: songs merged with matching tracks (repertoire.js). Match on normalized title+artist; key as tiebreak among multiple candidates; consumed tracks marked _used; unmatched tracks become standalone items. Merged records keep the song shape + gain track fields (genre/bpm/yt/_track) so the Studio can open them.

## localStorage namespaces [STABLE]

| Prefix | Contents |
|---|---|
| songbook. | engine defaults (legacy) |
| roadcase-<profileId> | per-instrument setlist.v1 + custom.v1 |
| bt. | backing-tracks custom + curation |
| music. | global: theme, accent, activeProfile, trackUrls, notables, lastBackup |

Every reader is defensive (try/catch -> safe default). backup.js OWNED_PREFIXES governs what backup/restore captures.

## SCHEMA_VERSION discipline (the additive-vs-breaking law) [STABLE]

Current SCHEMA_VERSION = 1; MIGRATIONS = {} (backup.js header).

- **ADDITIVE** (new optional field, whole new key): NO bump, NO migration. Old readers ignore it; defensive reads handle absence. (Example: music.notables.v1.)
- **BREAKING** (rename/remove a field a reader depends on, retype, change a value's MEANING, reshape the container): bump SCHEMA_VERSION AND add the matching MIGRATIONS[n] step in the SAME commit.

Why: offline PWA - an old cached build can read data a newer build wrote. Additive is safe both directions; breaking is only safe forward. The .vN suffix on key names guards nothing by itself - the migration runner is the seam.

## Backup / Restore [STABLE]

Settings-driven whole-songbook snapshot (backup.js):

| Fn | Behavior |
|---|---|
| snapshot(store, nowIso) | collect owned keys -> { app:'music', schema, exportedAt, data } |
| validate(payload) | shape check + NEWER-schema refusal (downgrade guard) |
| restore(store, payload) | run pending migrations, write ATOMICALLY (all-or-nothing rollback on quota/throw) |

Keep test/backup.test.js green on any storage-touching change.

---

**Anchors verified:** backup.js:20-45 + snapshot/validate/restore, music/CLAUDE.md:24,30, tracks.js ~150 (trackKey) + ~305 (LEGACY_TRACKKEYS), repertoire.js (matchKey, mergeRec, build), notables.js storage key
