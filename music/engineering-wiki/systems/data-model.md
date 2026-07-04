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
| jam | **[DRIFT]** `true` on 19 curated songs.json records, but there is NO consuming code today - no Play-now jam picker reads this flag, and there is no fewest-chord back-fill either. The field is curated data waiting on its selection logic + entry point (analysis B3, queued [M-7](../../../docs/plans/QUEUE.md)). Treat "jam" as reserved/future, not implemented, until M-7 ships this annotation. |

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

## Backup-staleness nudge [D-BACKUP-NUDGE, STABLE]

A one-shot Notables consumer (`'backup'`, the free LOWEST priority slot -
`firstrun` > `whynote` > `roman` > `backup`) proactively surfaces Backup when
an established user is carrying real risk: `Backup.songCount(data)` sums
setlist entries across every instrument; `Backup.backupNudgeState(count,
lastBackupIso, nowMs)` is the pure eligibility/message decision - eligible
once `count >= NUDGE_MIN_SONGS` (3) AND (never backed up OR
`>= NUDGE_STALE_DAYS` (30) since `music.lastBackup.v1`). Both live in
backup.js so they're storage-free and unit-testable (test/backup.test.js).

The DOM wiring (claim the slot, render into `#backupNudgeSlot` - outside every
`.screen` so it shows above whichever tab is active, not just Library - tap
opens Settings) lives entirely in play/index.html's Settings script; it never
touches songbook.js. It auto-RELEASES (not dismiss) the instant
`markBackedUp()` runs, so the banner cannot linger showing stale advice right
after the user acted - only the x button persists a permanent dismissal.

## Routine-save write-truthfulness [D-SAVE-TRUTH, STABLE]

songbook.js's routine saves (setlist, composed/custom songs, last-opened song, perform
prefs, song view) are a SEPARATE write path from Backup/Restore above - one key at a
time, not the whole-snapshot atomic apply. They share ONE write seam, `safeSet(key,
value)`, which mirrors backup.js's `applyAtomic` quota-detection (same
`/quota|exceed/i` test against `e.name`+`e.message`) but without its multi-key
rollback - a single-key write has nothing to roll back, it just returns `false`.

| Path | User-initiated? | On write failure |
|---|---|---|
| `saveProgression` (Compose "Save to Repertoire", both the create AND update-in-place branches) | Yes | Truthful toast: `"Couldn't save - storage is full or blocked. Export a backup from Settings."` (err-styled) instead of the success message |
| `saveCustom` / `saveSet` / `saveLast` / `savePerfPrefs` / `saveSongView` | No (passive persistence) | `console.warn` once per key (never repeats for that key this mount) - no UI nag |

Why the split: the app's #1 named fatal-dismissal trigger (docs/plans/analysis-refactor-enhance-20260704.md A1) is a save the user was TOLD succeeded silently vanishing - that only applies where the UI made a claim. Passive writes (a perform-speed slider, the last-opened-song stamp) never claimed success, so failing soft with a console signal (not a toast per keystroke) is the correct- and cheaper-fidelity fix; see D-SAVE-TRUTH in [decisions.md](../decisions.md).

Known gap: `toggleSet`'s "Added to setlist" toast (songbook.js ~1248, outside this fix's
line-region grant) has the SAME unconditional-success shape as saveProgression did -
queued as a follow-up, same fix pattern.

---

**Anchors verified:** backup.js:20-45 + snapshot/validate/restore, music/CLAUDE.md:24,30, tracks.js ~150 (trackKey) + ~305 (LEGACY_TRACKKEYS), repertoire.js (matchKey, mergeRec, build), notables.js storage key, songbook.js safeSet + saveCustom/saveSet/saveLast/savePerfPrefs/saveSongView + saveProgression (S-SAVE-TRUTH, this mission), backup.js songCount/backupNudgeState + notables.js PRIORITY + play/index.html renderBackupNudge (S-BACKUP-NUDGE, this mission)
