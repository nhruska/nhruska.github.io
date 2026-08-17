---
name: music-interchange
description: Operating manual for the Music app's agent-interaction contract - how to read a user's exported backup/skills files, how to propose a profile-doc update the app will actually accept, and how to emit a jam deep link. Use BEFORE reading any exported file or writing any SKILL.md/profile doc for the Music app; every other skill/command in this plugin composes with this one rather than restating its rules.
---

# Music interchange

The Music app (nhruska.github.io/music/play/) is static, offline, server-free.
Reach it only through files a user exported or a URL you emit - never app
code, a network call, or a server. Full contract: `music/agent/AGENTS.md`
(bundled in every skills export; same stable path live when you have network).

## Reading an export

| File | Shape | Read it for |
|---|---|---|
| `music-songbook-<date>.json` (backup envelope) | `{ app:"music", schema, exportedAt, data:{key:rawString} }` | The FULL profile - repertoire, setlists, progressions, preferences, skill progress. `data` values are raw strings - `JSON.parse` each key you need. Owned key prefixes: `songbook.` `roadcase-` `bt.` `music.` `tri.` |
| `<skill-id>/SKILL.md` (skills bundle) | Open-skills-format file; the fenced ```` ```json ```` block under "## Profile data" is the exact `skill-competency-profile/v1` doc - the table above it is presentation only | One skill's competency + preferences |
| `skill-competency-profile/v1` (embedded doc) | `{ schema, skill, discipline:"music", updated, provenance:[{source,at}], competencies:[{id,name,desc,level,target,evidence_count,last_evidence}], preferences?:[{id,statement,evidence_count,last_evidence}] }` | Levels vs targets (gaps), evidence recency (staleness), taste statements |

Evaluate gaps as `target - level` per competency; flag any competency whose
`last_evidence` predates the user's most recent practice session as stale.
Repertoire size per instrument lives at `roadcase-<id>.setlist.v1`.

## Proposing a profile update (the ONLY write seam)

Never write localStorage, never hand back a modified backup envelope (restore
is byte-faithful and would bypass validation). Edit or author a
`skill-competency-profile/v1` doc instead:

1. Append a provenance entry `{ source: "agent:<your-tool-name>", at: "<ISO>" }`
   - never rewrite or delete an existing entry.
2. Any level change carries evidence: bump `evidence_count`, set
   `last_evidence` to a short human-readable reason.
3. Unknown competency ids may ride along (additive-tolerant); the app grades
   only ids its shipped frameworks know.
4. `preferences[]` is the additive slot for taste statements you learn.
5. You are one evidence SOURCE, not an override channel - the app's own merge
   (`Competency.importProfile` / `mergeInto`) decides what actually lands.

Save the proposed doc as `<skill-id>/SKILL.md` in the same shape as the file
you read (frontmatter + table + the fenced JSON block); tell the user to
import it from Settings -> Skills in the app, on any device, offline.

## Emitting a jam deep link

`music/play/?jam=<chords>&key=<tonic>&yt=<videoId>&name=<label>` - all four
params optional, stands up an EPHEMERAL jam on load, nothing writes storage
until the user taps Save.

| Param | Value | Rule |
|---|---|---|
| `jam` | comma-separated chord tokens (`jam=Am,F,C,G`) | CANONICAL-SHARP only - never pre-respell. One invalid token drops the whole param. |
| `key` | tonic name + optional `m` (`key=Am`) | Not re-spelled here either. |
| `yt` | 11-char YouTube video id, or a watch/youtu.be/embed URL | KEYLESS forever - no API key, ever. Can't state the key for a track? Omit it; never invent one. |
| `name` | URL-encoded label for the Save form | - |

Unknown/malformed params are ignored by the app (defensive-reader law) - a
stale cached build degrades to opening normally, never an error.

## MUST-NOTs

Never: fabricate or hand back a modified backup envelope for restore; rewrite
or delete an existing `provenance` entry (append only); bump a competency
`level` without an evidence delta; invent a YouTube id/key for a suggested
track; pre-respell chord tokens (display respelling is the app's job); or
publish/upload/commit a user's exported files anywhere - they are personal
data, keep them on-device/local.

## Self-check before acting

1. Reading the fenced JSON block, or guessing from the presentation table?
2. Does the proposed doc append provenance and evidence, never rewrite either?
3. Does the jam link use canonical-sharp tokens and a keyless `yt` value?
4. Is there a stated source for every level change and every suggested key?

## Related

- `music/agent/AGENTS.md`, `music/agent/capabilities.json` (app repo) - the full contract this skill compresses
- [music-theory-coach](../music-theory-coach/SKILL.md), [pedagogy-coach](../pedagogy-coach/SKILL.md), [songwriting-coach](../songwriting-coach/SKILL.md) - the coaching judgment this contract feeds
