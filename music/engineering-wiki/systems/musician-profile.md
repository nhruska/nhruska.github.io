# Musician Profile (the person-owned, lifelong document) [STABLE]

[Wiki](../index.md) > Systems > Musician Profile

## Purpose

The profile models the **musician, not the app**. `musician-profile/v1` is one
document the person carries; any app or coach that touches it agrees to a
three-rule **minimum participation contract** - not a new standard, a floor:

1. **Read what you understand.**
2. **Preserve what you do not understand** - byte-identical, including keys and
   competency ids you have never seen.
3. **Add what you legitimately know** - as evidence, or as an assessment that
   names its method and modality. Never a level you did not observe.

The contract travels INSIDE the document (`contract.rules`), so `AGENTS.md` is
optional reading for a participant. Source of truth for the rules as code:
`music/shared/musician-profile.js` (`CONTRACT`, `merge`). Origin: goal spec
[docs/plans/goal-musician-profile-20260913.md](../../../docs/plans/goal-musician-profile-20260913.md).

## Two documents, one seam

| Document | Owner | Role | Module |
|---|---|---|---|
| `skill-competency-profile/v1` (one per framework) | the app | The app's own progression tracker: level 0-100 grown from evidence toward a target, `evidence_count`, `last_evidence`. Per-skill `SKILL.md` hand-back still accepted | `competency.js`, `skill-md.js` |
| `musician-profile/v1` (`profile.json`) | the person | The lifelong document: taxonomy, assessments, evidence, goals, plan, participants, provenance, extensions | `musician-profile.js` |

The seam: at export, `MusicianProfile.compose()` writes what the app
LEGITIMATELY knows into the profile. The app's counters ride as **evidence**
(`kind: "app-progression"`, one record per framework with any evidence,
`modality: "compose"`), never as an assessment. On import the app does **not**
re-ingest those counters from the profile: `kind` and `source` are plain
strings any participant can write, so absorbing the numbers would let an
edited hand-back move the Skills bars for competencies nothing observed - the
exact seam this document guards. `progressionDocs()` is a read-only view for
readers and tests; device-to-device transfer of the counters is the backup
envelope's job (byte-faithful restore). `competency.js` keeps
`importProfile(doc, store, { counters: 'max' })` for a caller that knowingly
merges its own counters (a pure API, no app path uses it).

## Competencies vs assessments - unassessed is explicit

`competencies[]` is the taxonomy (what exists). `assessments[]` are dated,
sourced claims about ONE competency. `MusicianProfile.status(doc, id)` returns
the latest assessment or `{ status: 'unassessed' }`. The export never writes a
`value: 0` for absence, and the Skills panel reads **"not yet observed"** for a
competency with no evidence instead of `0 / 80`. Absence is never beginner.

The ONE assessment the app holds is the self-reported guidance level
(`guidance-level.js`): `competency: "stringed-instrument"` (a branch-level
claim), `scale: "band-3"`, `method: "self-report"`, `modality: "unspecified"`,
deterministic id `as:app:music:self-report` (re-export updates, never
duplicates). Nothing is derived from counters.

## Modality - do not overclaim

Every assessment and evidence record names WHAT KIND OF DOING it covers:
`perform | compose | write | listen | tune | theory | unspecified`. The app
observes composing (assembling a song, saving a progression) - it has never
heard the musician play. So even the `*-repertoire` counters (recorded by
`recordRepertoire()` in `songbook.js` when a song is assembled) are `compose`
evidence in the profile. A coach that only read chord charts must not claim
`perform` either. `method` names how the claim was made:
`self-report | observed | coach | inferred`.

## Schema (`musician-profile/v1`)

| Key | Shape | Merge rule (`MusicianProfile.merge`) |
|---|---|---|
| `schema` | `"musician-profile/v1"` | fixed |
| `contract` | `{ id: "minimum-participation/v1", rules[3], unassessed }` | fixed, self-describing |
| `id` | `mp_<uuid>`, minted once per device | local wins; a device with no stored profile ADOPTS the imported id; a mismatch is recorded in provenance, never rejected |
| `updated` | ISO 8601 (parsed with `Date.parse`, never string-compared - offsets and second precision order correctly) | later wins; a tie goes to the incoming document |
| `participants[]` | `{ id, name, version, url, capabilities_url, understands[], last_seen }` | union by id, later `last_seen` |
| `provenance[]` | `{ source, at, action }` | concat, append-only for other participants, exact duplicates dropped; the app keeps ONE `export` and ONE `import` stamp with the latest `at` |
| `competencies[]` | `{ id: "<framework>/<competency>", name, desc, branch[], source }` | union by id; a known id keeps the LOCAL name/desc/branch; unknown ids preserved verbatim |
| `assessments[]` | `{ id, competency, value, scale, target?, method, modality, at, source, evidence[], note? }` | union by id; same id -> later `at` wins |
| `evidence[]` | `{ id, at, source, kind, modality, competencies[], data, note? }` | union by id; same id -> later `at` wins |
| `goals[]` | `{ id, statement, competencies[], status: active\|met\|parked, created, updated, source }` | union by id, later `updated` |
| `plan` | `{ updated, steward, items[{ id, statement, competencies[], goal?, status: todo\|doing\|done, updated }] }` | the later `updated` wins WHOLE (the steward owns it) |
| `preferences[]` | competency.js shape | union by id, sum evidence, later statement |
| `extensions{}` + any unknown top-level key | anything | preserved; both sides carry the same unknown key -> the newer document wins, ties to the incoming one |

**Stable ids.** Competency ids reuse the existing framework + competency ids
verbatim (the portable contract since M-COMPETENCY), namespaced
`<framework>/<competency>`. A bare framework id as an assessment subject is a
branch-level claim. Record ids are opaque; the app's recurring records use
deterministic ids (`ev:app:music:progression:<framework>`,
`as:app:music:self-report`) so a re-export updates rather than duplicates.

**Instrument branches** (`BRANCHES` in the module): `stringed-instrument` is
`["instrument","strings"]`; `ukulele` / `guitar` are children
`["instrument","strings",<id>]`; `music-composition` / `lyric-writing` are
`["craft",<id>]`; an unknown framework is `["craft",<id>]`. A reader that knows
only "strings" still places a ukulele claim.

## The coach as steward

The coach (any agent handed the bundle) owns `plan` and the assessments it
authors, with `goals` read first. It proposes an assessment only with evidence
it can cite; it asks the human in the conversation when meaning is ambiguous or
the change is important (a level going down, a new goal, a branch change); it
never rewrites another participant's records and never turns the app's
compose-modality counters into a proficiency number on its own. Contract prose:
`music/agent/AGENTS.md` ("The musician profile") and the plugin's
`music-interchange` skill. The app preserves and SHOWS goals + open plan items
as quiet read-only lines in Settings -> Skills (`#skillsGoals`); it never edits
them.

## Storage, bundle, import

| Surface | Detail |
|---|---|
| Storage | `music.profile.v1` - additive under the owned `music.` prefix, so `backup.js` snapshots/restores it with no `SCHEMA_VERSION` bump. Defensive reader (corrupt -> fresh blank). Registered in [data-model.md](data-model.md) |
| Export | `downloadBundle()` (songbook.js) writes `profile.json` at the zip root via `MusicianProfile.exportJson(store, { frameworks, progression, selfReport, version })` beside README.md, AGENTS.md, capabilities.json, `<skill>/SKILL.md` and the backup envelope. Export also persists the composed profile |
| Import | The Skills picker parses once (`peekJson`) and dispatches on `.schema` (never file name): `musician-profile/v1` -> `MusicianProfile.importJson` (no counter re-ingest, see above); `music-setup/v1` -> setup doc; `.md` -> `SkillMd.parse` -> `Competency.importProfile`. Export (`Export for my AI`) is available when the app has counters OR a stored profile - an imported document is never trapped on a device |
| Capabilities | Stay app-side in `capabilities.js` / `music/agent/capabilities.json`, each with an https `deep_link` into the live app (the app has no `#tab` routing - `location.hash` selects the instrument - so links stay honest: the app plus the real `?p=` / `?jam=` grammars). The profile's participant entry points at `capabilities_url` |
| AGENTS.md | Optional for a participant. Bundled and served; documents the profile section, the steward role and the modality rule (`agent-readme.js`, byte-gated) |

## Gates

- `test/musician-profile.test.js` - document, ids, branches, unassessed,
  self-report, evidence-not-proficiency, MAX counters, merge rules, storage.
- `test/profile-roundtrip.test.js` - a hypothetical songwriting app
  ("LyricLab") implemented against the contract only: Music -> LyricLab ->
  Music -> LyricLab loses nothing on either side and overclaims nothing; a lossy
  participant cannot delete the app's records.
- `test/agent-manifest.test.js` - deep links on every capability, the
  `musician-profile` capability pinned to the module's constants, `profile.json`
  in the bundle, AGENTS.md carries the contract text.
- `test/pw/scenarios/musician-profile-import.json` - "not yet observed" in the
  panel, a coach hand-back through the REAL file picker, goal + plan lines,
  unknown key preserved, id adopted, the next export honest.

## What this deliberately does not do

- Consume the profile to personalize the app (the adaptive-depth plan,
  [docs/plans/competency-adaptive-depth-20260721.md](../../../docs/plans/competency-adaptive-depth-20260721.md),
  should read `assessments`, not counters, when it lands).
- Author goals in-app, or queue a coach's proposed assessment for in-app
  confirmation - the human-in-the-loop step lives in the coach conversation.
- Convert counters into bands or levels.

## Future direction [ROADMAP reviewed 2026-09-13]

Music proves a person-owned, lifelong learner model: one document the person
carries, that any app can read, preserve and add to under a three-rule floor. A
future canonical store (the person's own repo, a synced folder, a service)
could hold `profile.json` as the SSOT with apps as participants - possible, not
built here. Next in-app steps, in order: the consume side (adaptive depth from
assessments), then an in-app review surface where a coach's proposed
assessment waits for the human's confirmation.

## Related

- [data-model.md](data-model.md) - key rows `music.competency.v1`, `music.profile.v1`
- [decisions.md](../decisions.md) - `D-MUSICIAN-PROFILE`
- `music/agent/AGENTS.md`, `plugin/music-coach/skills/music-interchange/SKILL.md` - the contract as read by agents
