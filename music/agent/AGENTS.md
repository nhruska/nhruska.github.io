# Music app - agent instructions

You are reading a folder exported from a static, offline, server-free web app.
Everything you need to orient is in this bundle. No app code, network, or
account is required to read or propose updates.

## What these files are

- **`profile.json`** (this bundle) - the PERSON's `musician-profile/v1` document: the
  musician, not the app. It carries its own contract (`minimum-participation/v1`), so
  this file is OPTIONAL reading - a participant that never opens AGENTS.md still
  knows the rules. See "The musician profile" below. This is the preferred
  hand-back: edit profile.json, return it, the user imports it.
- **`<skill-id>/SKILL.md`** (this bundle) - one open-skills-format file per
  skill. The human-readable table is presentation; the fenced skill-competency-profile/v1
  block under "## Profile data" is the exact interchange doc - read/write THAT,
  never the table.
- **Backup envelope** `music-songbook-<date>.json` (included in this bundle when exported from Settings; may be absent from a hand-assembled folder)
  - `{ app:"music", schema, exportedAt, data:{key:rawString} }`, a byte-faithful
  snapshot of every owned localStorage key. It is the FULL profile: repertoire,
  setlists, progressions, preferences, skill progress. Values in `data` are raw
  strings - JSON.parse each key you need.
- **`capabilities.json`** (this bundle; also served at `music/agent/capabilities.json`)
  - the app's capability manifest as data: every capability's surfaces, owned
  localStorage keys, and interchange contract. Read it to know what the app can
  do without reading app code or touching the network.
- **Profile doc** `skill-competency-profile/v1` - the schema embedded in each SKILL.md:
  ```
  { schema, skill, discipline:"music", updated,
    provenance:[{source, at}],
    competencies:[{id, name, desc, level, target, evidence_count, last_evidence}],
    preferences?:[{id, statement, evidence_count, last_evidence}] }
  ```

## The musician profile (profile.json)

Three rules, carried inside the document as `contract.rules`:

1. **Read what you understand.** Sections: `competencies` (the taxonomy, ids
   `<framework>/<competency>`, each with a `branch` path such as
   `["instrument","strings","ukulele"]`), `assessments`, `evidence`, `goals`,
   `plan`, `preferences`, `participants`, `provenance`, `extensions`.
2. **Preserve what you do not understand** - byte-identical, including top-level
   keys and competency ids you have never seen. Never drop, never rewrite.
3. **Add what you legitimately know** - as an `evidence` record, or as an
   `assessment` that names its `method` (self-report | observed | coach |
   inferred) and its `modality` (perform | compose | write | listen | tune |
   theory | unspecified). Never a level you did not observe.

Competencies are SEPARATE from assessments. A competency with no assessment is
**unassessed** - never beginner, never 0. The app never emits a level for
absence, and neither may you.

**Do not overclaim modality.** The app's own records are `kind: "app-progression"`
evidence with `modality: "compose"` - it watched the musician assemble songs and
save progressions; it has never heard them play. Those counters (the v1 doc
inside `data`) are evidence of doing, not a proficiency number. Do not convert
them into an assessment without the human confirming what they mean.

**You are the steward.** Read `goals` first. You own `plan` (later `updated`
wins whole) and the assessments you author. Propose an assessment only with
evidence you can cite (`evidence` ids, or the conversation - then add an
evidence record for it). When meaning is ambiguous, or the change is important
(a level going down, a new goal, a branch change), ASK THE HUMAN in the
conversation before writing it. Every record you add carries your own `id`
(`as:<tool>:...`, `ev:<tool>:...`), `source: "agent:<your-tool-name>"` and `at`.
Merge on import is a UNION by id - the same id with a later `at`/`updated`
replaces its older self; another participant's record is never rewritten.
Append your participant entry (`id`, `name`, `understands`, `last_seen`) and a
provenance entry, and set the top-level `updated` to when you finished (ISO 8601,
UTC `Z` preferred - stamps are parsed, so an offset also works). Unknown top-level
keys and `extensions["x-<you>"]` are yours to add and are preserved by every
participant; on a tie the newer document wins. The app's own `app-progression`
records are READ-ONLY to you: the app never re-ingests its counters from a
profile, so editing those numbers changes nothing - write an assessment instead.

## What you MAY do

- Read everything: grade competency levels vs targets, note evidence staleness,
  read repertoire/progressions/preferences, and coach from what the levels say
  the user can already do.
- Propose profile updates by editing/authoring a skill-competency-profile/v1 doc (see
  rules below), saved as `<skill-id>/SKILL.md` for the user to import.
- Emit a one-tap jam setup as a deep link: `music/play/?jam=<chords>&key=<tonic>
  &yt=<videoId>&name=<label>`. `jam` is comma-separated canonical-sharp chord
  tokens (e.g. `jam=Am,F,C,G`) - percent-encode every `#` (`F#m` -> `F%23m`;
  a raw # truncates the URL and can load a VALID but WRONG jam - decode your
  final URL and confirm every chord survived); `key` is a tonic name plus optional `m` for
  minor (e.g. `key=Am`); `yt` is an 11-char YouTube video id or a watch/
  youtu.be URL; `name` labels the Save form. All four are optional. The link
  opens an EPHEMERAL jam - nothing is written until the user taps Save.

## What you MUST NOT do

- Never fabricate or hand back a modified backup envelope for restore - restore
  is byte-faithful and would bypass validation entirely.
- Never rewrite or delete an existing `provenance` entry - append only.
- Never bump a competency `level` without an evidence delta (`evidence_count`
  incremented, `last_evidence` set to a short human-readable reason).
- Never invent a YouTube id/key for a suggested track - state the key or omit
  the track; the app never invents one either.
- Never pre-respell chord names - chord tokens stay canonical-sharp; display
  respelling is the app's job.
- Never emit an assessment for a competency you did not observe, and never turn
  the app's compose-modality progression evidence into a level claim on your own.
- Never delete or rewrite another participant's records or keys in profile.json.

## Rules for a proposed profile doc

1. Append a provenance entry: `{ source: "agent:<your-tool-name>", at: "<ISO>" }`.
2. Any level change carries evidence: bump `evidence_count`, set `last_evidence`.
3. Unknown competency ids may ride along (additive-tolerant); the app only
   grades ids its shipped frameworks know.
4. `preferences[]` is the additive slot for taste statements you learn.
5. You are one evidence SOURCE, not an override channel - the app's own merge
   (`Competency.importProfile` / `mergeInto`) decides what actually lands.

## Hand-back procedure

Preferred: hand back `profile.json` (the same file, with your records added -
nothing removed). Alternative for a single skill: save your proposed doc as
`<skill-id>/SKILL.md` (render it in the same shape as the file you read -
frontmatter + table + the fenced JSON block). Either way, tell the user: import
it from Settings -> Skills in the app, on any device, offline.

The SAME hand-back covers all three update cases - there is no separate
procedure for any of them:

1. **One competency moved.** A practice session raised (or lowered) a level.
   Change that entry's `level`, bump its `evidence_count`, set `last_evidence`.
   Leave every other entry byte-identical.
2. **Porting an outside profile in.** The user already tracks skills elsewhere.
   Map them onto the competency ids you find in the file; anything with no
   equivalent is dropped rather than invented. Keep the schema exactly.
3. **Correcting a fresh install.** The profile is at defaults and a conversation
   established the real levels. Set them, and record where they came from in
   `provenance` so the next agent knows they were self-reported, not measured.

In every case the import MERGES - it adds and overwrites, never deletes - so a
partial doc is safe. Do not pad a file with entries you did not actually assess.

## Privacy

This app's repo is public and ships frameworks only - no personal data. The
files in front of you ARE the user's personal data; keep them on-device/local
and never publish, upload, or commit them anywhere.
