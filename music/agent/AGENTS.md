# Music app - agent instructions

You are reading a folder exported from a static, offline, server-free web app.
Everything you need to orient is in this bundle. No app code, network, or
account is required to read or propose updates.

## What these files are

- **`<skill-id>/SKILL.md`** (this bundle) - one open-skills-format file per
  skill. The human-readable table is presentation; the fenced skill-competency-profile/v1
  block under "## Profile data" is the exact interchange doc - read/write THAT,
  never the table.
- **Backup envelope** `music-songbook-<date>.json` (if the user also shared one)
  - `{ app:"music", schema, exportedAt, data:{key:rawString} }`, a byte-faithful
  snapshot of every owned localStorage key. It is the FULL profile: repertoire,
  setlists, progressions, preferences, skill progress. Values in `data` are raw
  strings - JSON.parse each key you need.
- **Profile doc** `skill-competency-profile/v1` - the schema embedded in each SKILL.md:
  ```
  { schema, skill, discipline:"music", updated,
    provenance:[{source, at}],
    competencies:[{id, name, desc, level, target, evidence_count, last_evidence}],
    preferences?:[{id, statement, evidence_count, last_evidence}] }
  ```

## What you MAY do

- Read everything: grade competency levels vs targets, note evidence staleness,
  read repertoire/progressions/preferences, and coach from what the levels say
  the user can already do.
- Propose profile updates by editing/authoring a skill-competency-profile/v1 doc (see
  rules below), saved as `<skill-id>/SKILL.md` for the user to import.
- Emit a one-tap jam setup as a deep link: `music/play/?jam=<chords>&key=<tonic>
  &yt=<videoId>&name=<label>`. `jam` is comma-separated canonical-sharp chord
  tokens (e.g. `jam=Am,F,C,G`); `key` is a tonic name plus optional `m` for
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

## Rules for a proposed profile doc

1. Append a provenance entry: `{ source: "agent:<your-tool-name>", at: "<ISO>" }`.
2. Any level change carries evidence: bump `evidence_count`, set `last_evidence`.
3. Unknown competency ids may ride along (additive-tolerant); the app only
   grades ids its shipped frameworks know.
4. `preferences[]` is the additive slot for taste statements you learn.
5. You are one evidence SOURCE, not an override channel - the app's own merge
   (`Competency.importProfile` / `mergeInto`) decides what actually lands.

## Hand-back procedure

Save your proposed doc as `<skill-id>/SKILL.md` (render it in the same shape as
the file you read - frontmatter + table + the fenced JSON block) and tell the
user: import it from Settings -> Skills in the app, on any device, offline.

## Privacy

This app's repo is public and ships frameworks only - no personal data. The
files in front of you ARE the user's personal data; keep them on-device/local
and never publish, upload, or commit them anywhere.
