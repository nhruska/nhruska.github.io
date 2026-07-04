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

## localStorage key inventory [STABLE] (M-6 STORAGE-MIGRATE, gh #76/#77, D-STORAGE-LS-MIGRATE)

THE canonical registry of every key this app persists. Verified against `music/shared/*.js` + `music/play/*.html` source (grep-swept, not hand-recalled) - if a key exists in the shipped code and isn't in this table, that's a doc bug: fix the table in the same change you find it.

**Columns:** *User data?* = would a reset of this key cost the user real content (songs, tracks, setlists) vs just a preference/derived value. *Backed up?* = captured by `backup.js`'s `OWNED_PREFIXES` sweep (`snapshot`/`restore`), independent of whether `StorageMigrate` (below) also tracks it.

| Key | Owner (file:line) | Shape | User data? | Backed up? | Notes |
|---|---|---|---|---|---|
| `roadcase-<profileId>.custom.v1` | songbook.js:945 | array of composed/custom song records | **Yes - highest value** | Yes | Per-instrument namespace (`storagePrefix: 'roadcase-' + profile.id`, wired in play/index.html:698); `songbook.` is the engine's own default prefix, never used at runtime |
| `roadcase-<profileId>.setlist.v1` | songbook.js:956 | array of song ids | Yes | Yes | The Jam set list |
| `roadcase-<profileId>.last.v1` | songbook.js:960-965 | string (song id) | No - pref | Yes | Last-opened song; passive write (`safeSet`, D-SAVE-TRUTH) |
| `roadcase-<profileId>.perfprefs.v2` | songbook.js:970-980 | `{speed, view}` | No - pref | Yes | `view` is tri-state `'lyrics'\|'chords'\|'both'` |
| `roadcase-<profileId>.perfprefs.v1` | songbook.js:971 (read-only) | `{speed, view}`, `view` 2-state | No - pref | Yes (if still present) | **Migration SOURCE only** - `loadPerfPrefs()` falls back v2->v1 with a value transform (`view:'lyrics'`->`'both'`); ad-hoc, hand-rolled, the pattern `StorageMigrate` generalizes |
| `roadcase-<profileId>.songview.v1` | songbook.js:1210 | string | No - pref | Yes | Supersedes legacy `chordsonly.v1` |
| `roadcase-<profileId>.chordsonly.v1` | songbook.js:1211 (read-only) | `'1'` / absent | No - pref | Yes (if still present) | **Migration SOURCE only** - legacy 2-way toggle, read as a fallback when `songview.v1` is absent |
| `roadcase-<profileId>.activeTab.v1` | songbook.js:2923-2934 | string (tab name) | No - pref | Yes | Reopen-where-you-left-off; legacy tab names (`'setlist'/'set'`, `'tracks'/'repertoire'`) normalized inline at read (songbook.js:3004-3009) |
| `roadcase-<profileId>.libType.v1` | songbook.js:3015-3016 (read-only) | `'set'` / absent | No - pref | Yes (if still present) | **Legacy, consume-once-and-removed** - pre-Jam Set/Perform subview marker; read once then `removeItem`'d so it can never re-apply |
| `bt.custom.v1` | tracks.js:423 | array of custom track records | **Yes** | Yes | User-added backing tracks |
| `music.trackUrls.v1` | tracks.js:424 | `{ [trackKey]: videoId }` | No - curated overlay | Yes | `migrateUrls()` (tracks.js:429-449) re-keys `LEGACY_TRACKKEYS` inline on every load - another hand-rolled ad-hoc migration |
| `music.activeProfile.v1` | play/index.html:601 (write) + tracks.js:605 (read) | string (profile id) | No - pref | Yes | Active instrument |
| `music.accent.v1` | play/index.html:20 (pre-paint read), 784-816 (Settings) | string (hex color) | No - pref | Yes | Accent theme; the pre-paint read at :20 runs BEFORE any script-tagged module (FOUC prevention) |
| `music.theme.v1` | play/index.html:15 (pre-paint read), 785-821 (Settings) | `'auto'\|'light'\|'dark'` | No - pref | Yes | Same pre-paint-read pattern as accent |
| `music.lastBackup.v1` | play/index.html:786 | ISO date string | No - device-local stamp | **No** - excluded (backup.js EXCLUDE) | Carrying an old stamp into a restore would mislead |
| `music.notables.v1` | notables.js:57 | `{ consumerId: dismissedEpochMs }` | No - dismissal state | Yes | One-shot dismissible tip bookkeeping |
| `music.devlog.v1` | backup.js:38 (EXCLUDE list only) | n/a | n/a | **No** - excluded | **Reserved, currently unused** - no code writes it; the prefix is pre-excluded for future dev-scratch use |
| `music.schema.v1` | backup.js:26-27 (`SCHEMA_KEY`) | integer string | No - device-local stamp | **No** - excluded (is its own marker) | backup.js's OWN schema/migration engine (data-map transforms, backup/restore scope) - see the section below for how it differs from `StorageMigrate` |
| `music.schema.version` | storage-migrate.js (`VERSION_KEY`) | integer string | No - device-local stamp | **Yes - deliberately** | `StorageMigrate`'s marker (see below). Falls under the `music.` prefix, same as `music.schema.v1` (backup.js's OWN marker) but - unlike that one - is NOT excluded. S-BACKUP-INTEGRATE (M-6 follow-up #1) made this explicit: the version travels WITH the data on purpose (paired with restore replaying `StorageMigrate.run()` - see below), superseding storage-migrate.js's own header note that had suggested excluding it |
| `music.diagram.pref.v1` | **not implemented** - spec only ([ux-philosophy/expertise-adaptive-display.md](../ux-philosophy/expertise-adaptive-display.md):39) | `'dots'\|'patterns'` | No - pref | n/a (unwritten) | **Reserved for S-DIAGRAM-PREF** (queued, decisions.md). Spec already calls it "additive key; defensive read; default 'dots'" - ships safely under the existing additive-vs-breaking law with no migration needed |
| `tri.activeKey.v1` | play/triad-inversions.html:565, 584-664 | string (note letter) | No - pref | **Yes** (S-BACKUP-INTEGRATE) | Joined `OWNED_PREFIXES` via M-6 follow-up #3 - was a pre-existing gap this inventory surfaced, not introduced by it |
| `tri.dismissed.v1` | play/triad-inversions.html:566, 588-798 | array | No - dismissal state | **Yes** (S-BACKUP-INTEGRATE) | Same fix as above |
| `tri.firstVisitSeen.v1` | play/triad-inversions.html:567, 589-778 | `'1'` / absent | No - pref | **Yes** (S-BACKUP-INTEGRATE) | Same fix as above |

Every reader in this app is defensive (try/catch -> safe default). `backup.js`'s `OWNED_PREFIXES` (`songbook.`, `roadcase-`, `bt.`, `music.`, `tri.`) governs what backup/restore captures - `tri.` (the `triad-inversions.html` prefix) joined this wave (S-BACKUP-INTEGRATE, M-6 follow-up #3); it was a pre-existing gap this inventory surfaced, not introduced by it.

## SCHEMA_VERSION discipline (the additive-vs-breaking law) [STABLE]

Current SCHEMA_VERSION = 1; MIGRATIONS = {} (backup.js header).

- **ADDITIVE** (new optional field, whole new key): NO bump, NO migration. Old readers ignore it; defensive reads handle absence. (Example: music.notables.v1.)
- **BREAKING** (rename/remove a field a reader depends on, retype, change a value's MEANING, reshape the container): bump SCHEMA_VERSION AND add the matching MIGRATIONS[n] step in the SAME commit.

Why: offline PWA - an old cached build can read data a newer build wrote. Additive is safe both directions; breaking is only safe forward. The .vN suffix on key names guards nothing by itself - the migration runner is the seam.

## Versioned boot migration runner: StorageMigrate [STABLE] (M-6 STORAGE-MIGRATE)

`music/shared/storage-migrate.js` (`window.StorageMigrate`) generalizes the ad-hoc migration pattern already used twice in this app (`songbook.js`'s `loadPerfPrefs()` v1->v2 fallback, `tracks.js`'s `migrateUrls()` `LEGACY_TRACKKEYS` remap - both listed in the inventory above) into ONE registrable seam, so the NEXT breaking storage change is a `register()` call instead of another hand-rolled defensive read.

| Fn | Behavior |
|---|---|
| `register(fromVersion, fn)` | `fn(storageLike)` mutates the LIVE store directly (get/set/removeItem), must be idempotent; registers the migration that brings a device from `fromVersion` to `fromVersion + 1` |
| `run(storageLike)` | Applies every pending migration in order, then stamps `CURRENT`. Returns `{from, to, ran}`. Never throws - fails soft on quota/blocked storage (same discipline as every other reader in this app) |

**Not a replacement for backup.js's SCHEMA_VERSION engine** (previous section) - that engine transforms a `{key:value}` DATA MAP for the whole-snapshot backup/restore path and is scoped to `OWNED_PREFIXES`. `StorageMigrate` is lower-level and broader: its migrations touch the live store directly and are not restricted to any prefix list. They compose - `backup.js`'s `restore()` now routes through `StorageMigrate.run()` too, see [Backup / Restore](#backup--restore-stable) below - they do not compete.

**Fresh install vs pre-runner install.** When `music.schema.version` is absent, `StorageMigrate` distinguishes: no known-prefix key present anywhere -> fresh install, stamp `CURRENT` directly, run nothing. ANY known-prefix key present -> pre-runner install (predates this file), treat as version 0 and run every registered migration up to `CURRENT`. `KNOWN_PREFIXES` is deliberately a superset of `backup.js`'s `OWNED_PREFIXES` (it also includes `tri.`) so a device with only `triad-inversions.html` prefs isn't misclassified as fresh.

**Wired at boot**: ONE `<script src="../shared/storage-migrate.js">` tag in play/index.html, placed first (before `theme.js`'s pre-paint read and every other shared/*.js consumer). The file self-runs `StorageMigrate.run(window.localStorage)` at script-load time in the browser only (guarded, never in Node/tests) - this IS the boot wiring; no inline call was added to index.html.

**Shipped state this wave**: `CURRENT = 1`, zero registered migrations - a behavior-preserving no-op baseline. No existing key changes shape. The value delivered is the rail, not a migration.

**Composition gaps - RESOLVED this wave (S-BACKUP-INTEGRATE, M-6 follow-ups #1/#2/#3):**

1. ~~`music.schema.version` is not yet in backup.js's `EXCLUDE` list~~ - RESOLVED, but not the way this note originally suggested. It stays OUT of `EXCLUDE` deliberately: see "Version-in-envelope: why `music.schema.version` is never excluded" below.
2. ~~`backup.js`'s `restore()` does not call `StorageMigrate.run()` after writing a payload~~ - RESOLVED. `restore()` now replays `StorageMigrate.run(store)` immediately after a successful atomic write (guarded - see below).
3. ~~`tri.*` keys (triad-inversions.html) are outside `backup.js`'s `OWNED_PREFIXES` entirely~~ - RESOLVED. `tri.` joined `OWNED_PREFIXES`; see the inventory table above.

Keep `test/storage-migrate.test.js` green on any change that touches this file or adds a migration.

## Backup / Restore [STABLE]

Settings-driven whole-songbook snapshot (backup.js):

| Fn | Behavior |
|---|---|
| snapshot(store, nowIso) | collect owned keys -> { app:'music', schema, exportedAt, data } |
| validate(payload) | shape check + NEWER-schema refusal (downgrade guard) |
| restore(store, payload) | run pending migrations, write ATOMICALLY (all-or-nothing rollback on quota/throw), then replay `StorageMigrate.run()` |

Keep test/backup.test.js green on any storage-touching change.

### Version-in-envelope: why `music.schema.version` is never excluded [S-BACKUP-INTEGRATE]

`music.schema.version` (`StorageMigrate.VERSION_KEY`) falls under the `music.` prefix like everything else in `OWNED_PREFIXES` and is deliberately left OUT of `EXCLUDE` - the opposite of what storage-migrate.js's own header note (M-6, before this mission) had suggested. The ruling: **version-in-envelope + restore-replays-the-runner is the correct pair**, not two independent fixes to pick from.

Why: a backup must carry the SOURCE device's true `StorageMigrate` version alongside its data, not just the data. If the marker were excluded, restoring an old backup onto a fresh (or different) device would leave THAT device's own pre-existing marker - or none at all - sitting over data that is only as new as the backup's actual schema. `StorageMigrate.run()` would see "already current" (or "fresh install") and silently skip any migration the just-restored data still needs. Keeping the marker in the envelope means restore() writes the TRUE version alongside the data in the same atomic apply, and then `restore()` immediately calls `StorageMigrate.run(store)` so any migration registered since the backup was taken applies right away - rather than waiting for the next full page load (which is when `StorageMigrate`'s own auto-run normally fires). `StorageMigrate.run()` fails soft on its own (quota/blocked storage) and the replay call is additionally guarded (`typeof StorageMigrate !== 'undefined'`), so a migration hiccup can never undo an already-successful restore.

This only matters where `storage-migrate.js` is actually wired: today that is `play/index.html` only. `play/triad-inversions.html` never loads `backup.js` at all, so `restore()` is unreachable there regardless - the guard is defensive, not load-bearing.

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

**Anchors verified:** backup.js:20-45 + snapshot/validate/restore, music/CLAUDE.md:24,30, tracks.js ~150 (trackKey) + ~305 (LEGACY_TRACKKEYS), repertoire.js (matchKey, mergeRec, build), notables.js storage key, songbook.js safeSet + saveCustom/saveSet/saveLast/savePerfPrefs/saveSongView + saveProgression (S-SAVE-TRUTH, this mission), backup.js songCount/backupNudgeState + notables.js PRIORITY + play/index.html renderBackupNudge (S-BACKUP-NUDGE, this mission), songbook.js:945-3016 (every roadcase- key), tracks.js:423-449 (bt./trackUrls + migrateUrls/LEGACY_TRACKKEYS), play/index.html:15-20,601,784-786 (pre-paint reads + PROFILE_KEY/ACCENT_KEY/THEME_KEY/LAST_BACKUP_KEY), play/triad-inversions.html:564-572 (tri.* keys), storage-migrate.js (whole file, M-6 STORAGE-MIGRATE), backup.js OWNED_PREFIXES/EXCLUDE/restore() (S-BACKUP-INTEGRATE, this mission - tri. prefix add, music.schema.version deliberately-not-excluded comment, post-restore StorageMigrate.run() replay), test/backup.test.js + test/storage-migrate.test.js (tri.* + version-in-envelope + migration-replay cases, this mission)
