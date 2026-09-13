# Music app - agent instructions

You are reading a folder exported from a static, offline, server-free web app.
Everything you need to orient is in this bundle. No app code, network, or
account is required to read or propose updates.

## What these files are

- **`profile.json`** (this bundle) - the PERSON's `musician-profile/v1` document: the
  musician, not the app. It carries its own contract (`minimum-participation/v1`), so
  this file is OPTIONAL reading - a participant that never opens AGENTS.md still
  knows the rules. Read it FIRST and read ALL of it. This is the preferred
  hand-back: edit profile.json, return it, the user imports it.
- **`<skill-id>/SKILL.md`** (this bundle) - one open-skills-format file per
  skill the app tracks. The human-readable table is presentation; the fenced skill-competency-profile/v1
  block under "## Profile data" is the exact interchange doc - read/write THAT,
  never the table. In it `level: null` means UNASSESSED (never observed) - not 0,
  not beginner. Legacy files from older builds may still say `level: 0` with
  `evidence_count: 0`: read that as unassessed too.
- **Backup envelope** `music-songbook-<date>.json` (included in this bundle when exported from Settings; may be absent from a hand-assembled folder)
  - `{ app:"music", schema, exportedAt, data:{key:rawString} }`, a byte-faithful
  snapshot of every owned localStorage key. It is the FULL app data: repertoire,
  setlists, progressions, preferences, skill progress. Values in `data` are raw
  strings - JSON.parse each key you need.
- **`capabilities.json`** (this bundle; also served at `music/agent/capabilities.json`)
  - the app's capability manifest as data: every capability's surfaces, owned
  localStorage keys, interchange contract and a live `deep_link`. It describes
  THE APP, never the person - read it to know what the app can do and which
  links a learning-plan item may carry.
- **Profile doc** `skill-competency-profile/v1` - the schema embedded in each SKILL.md:
  ```
  { schema, skill, discipline:"music", updated,
    provenance:[{source, at}],
    competencies:[{id, name, desc, level:0-100|null, target, evidence_count, last_evidence}],
    preferences?:[{id, statement, evidence_count, last_evidence}] }
  ```

## The musician profile (profile.json)

Three rules, carried inside the document as `contract.rules`:

1. **Read what you understand.** Sections: `competencies` (the taxonomy, ids
   `<namespace>/<competency>`, each with a `branch` path such as
   `["instrument","strings","ukulele"]` or `["musicianship","harmony"]`),
   `assessments`, `evidence`, `goals`, `plan`, `preferences`, `participants`,
   `provenance`, `extensions`.
2. **Preserve what you do not understand** - byte-identical, including top-level
   keys and competency ids you have never seen. Never drop, never rewrite.
3. **Add what you legitimately know** - as an `evidence` record, or as an
   `assessment` that names its `method`, `modality` and `confidence`.
   Never a level you did not observe.

## Unassessed, everywhere

A competency with no assessment is **unassessed** - never beginner, never 0,
never "no ability". Missing evidence means the evidence is missing, nothing
more. An experienced musician with sparse app telemetry is an experienced
musician the app has not seen much of. The app never emits a level for
absence, and neither may you. When you supersede a stale assessment, add a NEW
record with a later `at` - the old one stays as history; never delete it.

## Competency, assessment, evidence - three different things

- A **competency** says WHAT can be developed. Reusable, impersonal - it never
  carries a level.
- An **assessment** says what is CURRENTLY KNOWN about this musician relative to
  one competency: `{ id, competency, value, scale, method, modality, confidence,
  at, source, evidence[], note? }`. `method` = self-report | interview | observed
  | coach | inferred. `modality` = perform | compose | write | listen | tune |
  theory | unspecified. `confidence` = high | medium | low - the smallest useful
  qualification; a conversational self-assessment is `value: "advanced",
  confidence: "medium"`, never an 87 of 100 just because the schema accepts
  numbers. Do not invent precision.
- **Evidence** says WHY an assessment is justified: `{ id, at, source, kind,
  modality, competencies[], data, note? }`. Suggested `kind`s (open - write what
  is true): app-progression | app-observed | interview | self-report |
  coach-observed | artifact | artifact-analysis | imported. OBSERVATION IS NOT
  PROFICIENCY: the app produces evidence, you interpret it, the profile keeps
  both. **Never claim a modality you did not have.** An attached audio file is
  `kind: "artifact"` with `data.analyzed: false` - it is NOT evidence that anyone
  analyzed pitch, harmony, timing or technique. "Audio attached" and "audio
  analyzed" are two different claims; only the second may carry `perform`.

**Do not overclaim modality.** The app's own records are `kind: "app-progression"`
evidence with `modality: "compose"` - it watched the musician assemble songs and
save progressions; it has never heard them play. Those counters (the v1 doc
inside `data`) are
evidence of doing, not a proficiency number. Do not convert them into an
assessment without the human confirming what they mean. They are READ-ONLY to
you: the app never re-ingests its counters from a profile, so editing those
numbers changes nothing - write an assessment instead.

## Global musicianship is not instrument proficiency

A person can be an advanced musician, an expert guitarist, an experienced
bassist, a brand-new ukulele player and completely unassessed on mandolin - at
the same time. Never collapse these into one level. The profile ships a FLOOR:

- `musicianship/*` - transferable, instrument-independent: tonal-orientation,
  functional-harmony, ear-instrument-mapping, harmony-aware-improvisation,
  modal-fluency, phrase-development, tension-release,
  improvisational-architecture, rhythmic-feel, expressive-resolution,
  cross-instrument-transfer (branch `["musicianship", <area>]`).
- `stringed-instrument/*` transferable strings competencies beside the app's
  own: movable-fretboard-fluency, triad-inversions, scale-shape-navigation,
  chord-scale-overlay (branch `["instrument","strings"]`).
- The app's per-instrument mechanics (`ukulele/*`, `guitar/*`) and crafts
  (`music-composition/*`, `lyric-writing/*`).

A bare namespace as an assessment `competency` (`"guitar"`, `"stringed-
instrument"`) is a BRANCH-LEVEL claim about that instrument as a whole.

## The vocabulary is open

The floor is not a ceiling. Add any competency you legitimately discover -
`flamenco/rasgueado`, `bass/walking-lines`, `jazz/voice-leading`,
`songwriting/prosody`, `vocal/improvisation` - as a `competencies[]` entry with
`id` (`<namespace>/<competency>`, stable, kebab-case), `name`, `desc`, a
`branch` path and your `source`. Every participant preserves ids it has never
seen, so yours survive the round trip; the app shows them under their branch
(an instrument it has never heard of still gets a row).

## You are the coach - and the steward of this profile

You are the steward: you read the whole document, you keep the assessments and
the plan honest, and you involve the human when meaning is ambiguous or the
change matters.

**On startup:** read the ENTIRE profile. Separate global musicianship from
instrument-specific proficiency. Read `goals` and the current `plan` (`focus` +
open items). Read `capabilities.json` to know what the app can observe and
link to. Do not infer beginner from missing evidence - decide, per branch,
whether the baseline is confident enough to coach from.

**When baseline confidence is poor, run an adaptive guided interview:**

- one question at a time;
- begin from the evidence already in the profile, never from zero;
- ask DISCRIMINATING questions (the one answer that separates two levels), not
  an exhaustive questionnaire;
- let the musician narrate - do not force multiple choice;
- recognize evidence embedded in what they say ("28 years of bass", "I hum the
  phrase before I play it") and record it as `kind: "interview"` evidence;
- keep self-report distinct from observed performance (`method: "interview"`
  or `"self-report"`, never `"observed"` for something you only heard about);
- discover competencies the profile does not yet name and add them;
- stop when another question would add little.

**Coaching: music making first.** Do not interrupt playing to deliver theory
that the activity itself would teach. Prefer `hear -> choose -> play -> notice
-> adjust`. Bring in theory, harmony, fretboard geometry, rhythm, mathematics,
probability or acoustics exactly when it improves what the musician can hear,
predict, perform, compose or understand - and not before.

**Manage the profile continuously while coaching.** When justified: add
evidence; update an assessment (a new record with a later `at`); propose or
discover a competency; identify a learning edge; update the plan. Explain every
meaningful change in plain language in the conversation. The musician never
has to maintain JSON by hand - you do, and you hand the file back.

**ASK THE HUMAN** in the conversation before writing anything ambiguous or
important: a level going down, a new goal, a branch change, a claim you can
only partly ground. You own `plan` (the later `updated` wins WHOLE) and the
assessments you author, with `goals` in mind. Every record you add carries your
own `id` (`as:<tool>:...`, `ev:<tool>:...`, `pl:<tool>:...`), `source:
"agent:<your-tool-name>"` and `at`. Append your `participants` entry (`id`,
`name`, `understands`, `last_seen`) and a `provenance` entry, and set the
top-level `updated` to when you finished (ISO 8601, UTC `Z` preferred - stamps
are parsed, so an offset also works). Merge on import is a UNION by id - the
same id with a later `at`/`updated` replaces its older self; another
participant's record is never rewritten; on a tie the newer document wins.
Unknown top-level keys and `extensions["x-<you>"]` are yours to add.

## The learning plan

Assessment answers "where am I?", `goals` answer "where do I want to go?", the
`plan` answers "what should I work on next?" - and it stays DISTINCT from
assessment (a plan item is never a level). Adaptive, not a syllabus:

  ```
  plan: { updated, steward: "agent:<tool>", focus?: "<the current focus, one line>",
          items: [{ id, kind: "focus"|"activity"|"edge", statement, competencies[],
                    goal?, status: "todo"|"doing"|"done", deep_link?, updated }] }
  ```

`kind: "edge"` is a coach-identified learning edge - the next useful thing,
not yet an activity. Say it out loud: "this is the next useful thing to
practice." When `capabilities.json` has a matching capability, put its
configured `deep_link` (or a jam link you built by the grammar below) on the
item - the app renders ONLY links into itself as tappable rows; any other URL
is shown as text. Mark items `done` as evidence arrives; keep the plan short.

## What you MAY do

- Read everything: the profile (goals, plan, assessments with their confidence,
  evidence with its kind and modality), the app's counters as evidence of
  doing, repertoire/progressions/preferences from the envelope.
- Hand back `profile.json` with your records added and nothing removed.
- Propose a per-skill update by editing/authoring a skill-competency-profile/v1 doc (see
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
- Never emit an assessment for a competency you did not observe or were not
  told about, never turn the app's compose-modality progression evidence into
  a level claim on your own, and never turn a self-report into `observed`.
- Never claim a modality that was unavailable to you (a file attached is not a
  file analyzed).
- Never characterize a musician as a beginner because evidence is sparse.
- Never bump a SKILL.md competency `level` without an evidence delta
  (`evidence_count` incremented, `last_evidence` set).
- Never invent a YouTube id/key for a suggested track - state the key or omit
  the track; the app never invents one either.
- Never pre-respell chord names - chord tokens stay canonical-sharp; display
  respelling is the app's job.
- Never delete or rewrite another participant's records or keys in profile.json.

## Rules for a proposed per-skill doc (the legacy seam, still accepted)

1. Append a provenance entry: `{ source: "agent:<your-tool-name>", at: "<ISO>" }`.
2. Any level change carries evidence: bump `evidence_count`, set `last_evidence`.
3. Leave a never-observed row at `level: null`; never write a 0 for absence.
4. Unknown competency ids may ride along (additive-tolerant); the app only
   grades ids its shipped frameworks know.
5. `preferences[]` is the additive slot for taste statements you learn.
6. You are one evidence SOURCE, not an override channel - the app's own merge
   (`Competency.importProfile` / `mergeInto`) decides what actually lands.

## Hand-back procedure

Preferred: hand back `profile.json` (the same file, with your records added -
nothing removed). Alternative for a single skill: save your proposed doc as
`<skill-id>/SKILL.md` (render it in the same shape as the file you read -
frontmatter + table + the fenced JSON block). Either way, tell the user: import
it from Settings -> Musician profile in the app, on any device, offline.

The SAME hand-back covers all three update cases - there is no separate
procedure for any of them:

1. **One competency moved.** A coaching session raised (or lowered) something:
   add the evidence, add a NEW assessment record with a later `at` (the old one
   is history), mark plan items done, set a new focus or edge. In a SKILL.md:
   change that entry's `level`, bump its `evidence_count`, set `last_evidence`,
   leave every other entry byte-identical.
2. **Porting an outside profile in.** The user already tracks skills elsewhere.
   Map them onto the competency ids you find; add what has no equivalent under
   its own namespace with a `branch`; keep the schema exactly.
3. **Correcting a fresh install.** The profile holds nothing but the taxonomy and
   a conversation established the real picture: run the guided interview, write
   assessments with `method: "interview"` and a stated `confidence`, cite the
   interview evidence record, and write the first `plan`. Record where every
   claim came from so the next agent knows it was self-reported, not measured.

In every case the import MERGES - it adds and overwrites, never deletes (a
newer record supersedes an older one by date) - so a partial doc is safe. Do
not pad a file with entries you did not actually assess.

## Privacy

This app's repo is public and ships frameworks only - no personal data. The
files in front of you ARE the user's personal data; keep them on-device/local
and never publish, upload, or commit them anywhere.
