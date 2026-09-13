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
| `profile.json` (the bundle) | `musician-profile/v1` - the PERSON's document: `competencies` (taxonomy, ids `<framework>/<competency>`, `branch` paths), `assessments` (dated claims naming `method` + `modality`), `evidence` (sourced, with modality), `goals`, `plan` (coach-stewarded), `preferences`, `participants`, `provenance`, `extensions` + unknown keys. Carries its own `contract` (`minimum-participation/v1`) | The musician's state across every app that touched the document. **Read `goals` first.** A competency with NO assessment is UNASSESSED - never beginner, never 0. The app's own `kind: "app-progression"` evidence is `modality: "compose"` (it watched composing, never playing) - evidence of doing, not a level |
| `music-songbook-<date>.json` (backup envelope) | `{ app:"music", schema, exportedAt, data:{key:rawString} }` | The FULL profile - repertoire, setlists, progressions, preferences, skill progress. `data` values are raw strings - `JSON.parse` each key you need. Owned key prefixes: `songbook.` `roadcase-` `bt.` `music.` `tri.` |
| `<skill-id>/SKILL.md` (skills bundle) | Open-skills-format file; the fenced ```` ```json ```` block under "## Profile data" is the exact `skill-competency-profile/v1` doc - the table above it is presentation only | One skill's competency + preferences |
| `skill-competency-profile/v1` (embedded doc) | `{ schema, skill, discipline:"music", updated, provenance:[{source,at}], competencies:[{id,name,desc,level,target,evidence_count,last_evidence}], preferences?:[{id,statement,evidence_count,last_evidence}] }` | Levels vs targets (gaps), evidence recency (staleness), taste statements |

Evaluate gaps as `target - level` per competency. Staleness is computed
against the envelope's own `exportedAt` (the only clock the export carries):
`last_evidence` null = never evidenced; within 7 days of `exportedAt` = fresh;
within 30 = aging; older = stale. Repertoire size per instrument lives at
`roadcase-<id>.setlist.v1`.

When the envelope and a skills-bundle SKILL.md both carry the same skill's
doc, the one with the newer `updated` wins; on a tie, the envelope wins (it
is the byte-faithful whole-app snapshot).

## The participation contract (profile.json)

Three rules, carried inside the document: **read what you understand, preserve
what you don't (byte-identical, keys you have never seen included), add what
you legitimately know** - as evidence, or an assessment naming its `method`
(self-report | observed | coach | inferred) and `modality` (perform | compose |
write | listen | tune | theory | unspecified). Never a level you did not observe.

**You are the steward** of `plan` and of the assessments you author, with
`goals` in mind. Propose an assessment only with evidence you can cite; when
meaning is ambiguous or the change is important (a level going down, a new goal,
a branch change) ask the human in the conversation BEFORE writing it. Every
record you add carries your own `id` (`as:<tool>:...`, `ev:<tool>:...`),
`source: "agent:<your-tool-name>"` and `at`; append a `participants` entry and a
`provenance` entry. Import is a union by id - a later `at`/`updated` replaces
its older self, another participant's record is never rewritten; on a tie the
newer document wins, so set the top-level `updated` when you finish. The app's
own `app-progression` records are read-only to you - the app never re-ingests
its counters from a profile, so editing those numbers changes nothing; write an
assessment instead. Never turn the app's compose-modality counters into a
proficiency number on your own.

**Preferred hand-back:** `profile.json` with your records added and nothing
removed. The user imports it from Settings -> Skills (same picker as SKILL.md).

## Proposing a per-skill update (the legacy write seam, still accepted)

Never write localStorage, never hand back a modified backup envelope (restore
is byte-faithful and would bypass validation). For a single skill, edit or
author a `skill-competency-profile/v1` doc:

1. Append a provenance entry `{ source: "agent:<your-tool-name>", at: "<ISO>" }`
   - never rewrite or delete an existing entry.
2. Any level change carries evidence: bump `evidence_count` and set
   `last_evidence` to the ISO 8601 time of the evidence - the app writes
   ONLY timestamps there (competency.js `recordEvidence`), never prose.
   Human-readable reasons go in `preferences[]` statements or your
   accompanying report, not in `last_evidence`.
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
| `jam` | comma-separated chord tokens (`jam=Am,F,C,G`) | CANONICAL-SHARP only - never pre-respell. One invalid token drops the whole param. **`#` MUST be percent-encoded** (`F#m` -> `F%23m`): a raw `#` truncates the URL as a fragment, and the surviving prefix can be a VALID but WRONG jam (`jam=A,F#m,D,E` loads a two-chord A-F jam with no key). Encode every param value; before emitting, decode your final URL and confirm every chord survived. |
| `key` | tonic name + optional `m` (`key=Am`) | Not re-spelled here either. |
| `yt` | 11-char YouTube video id, or a watch/youtu.be/embed URL | KEYLESS forever - no API key, ever. Can't state the key for a track? Omit it; never invent one. |
| `name` | URL-encoded label for the Save form | - |

Unknown/malformed params are ignored by the app (defensive-reader law) - a
stale cached build degrades to opening normally, never an error.

## MUST-NOTs

Never: fabricate or hand back a modified backup envelope for restore; rewrite
or delete an existing `provenance` entry (append only); bump a competency
`level` without an evidence delta; emit an assessment for a competency you did
not observe; delete or rewrite another participant's records or keys in
profile.json; invent a YouTube id/key for a suggested track; pre-respell chord
tokens (display respelling is the app's job); or publish/upload/commit a user's
exported files anywhere - they are personal data, keep them on-device/local.

## Self-check before acting

1. Reading the fenced JSON block, or guessing from the presentation table?
   For profile.json: did you read `goals` first, and treat absence as unassessed?
2. Does the proposed doc append provenance and evidence, never rewrite either?
   Does every assessment you added name its method AND modality, with evidence cited?
3. Does the jam link use canonical-sharp tokens and a keyless `yt` value?
4. Is there a stated source for every level change and every suggested key?

## Related

- `music/agent/AGENTS.md`, `music/agent/capabilities.json` (app repo) - the full contract this skill compresses
- [music-theory-coach](../music-theory-coach/SKILL.md), [pedagogy-coach](../pedagogy-coach/SKILL.md), [songwriting-coach](../songwriting-coach/SKILL.md) - the coaching judgment this contract feeds
