# Musician Profile (the person-owned, lifelong document) [STABLE]

[Wiki](../index.md) > Systems > Musician Profile

## Purpose

The profile models the **musician, not the app**. `musician-profile/v1` is one
document the person carries for life; the app is ONE evidence-producing
learning environment and ONE consumer of it. Any app or coach that touches the
document agrees to a three-rule **minimum participation contract** - a floor,
not a new standard:

1. **Read what you understand.**
2. **Preserve what you do not understand** - byte-identical, including keys and
   competency ids you have never seen.
3. **Add what you legitimately know** - as evidence, or as an assessment that
   names its method, modality and confidence. Never a level you did not observe.

The contract travels INSIDE the document (`contract.rules`), so `AGENTS.md` is
optional reading for a participant. Source of truth for the rules as code:
`music/shared/musician-profile.js` (`CONTRACT`, `merge`, `compose`). Origin:
goal specs [goal-musician-profile-20260913.md](../../../docs/plans/goal-musician-profile-20260913.md)
(the document + floor) and
[goal-musician-profile-vnext-20260913.md](../../../docs/plans/goal-musician-profile-vnext-20260913.md)
(the semantic model + coach contract, after a real coaching session exposed
where the first cut still read an experienced musician as a beginner).

## The conceptual model

Three things that are never the same thing:

| Thing | Says | Shape | Personal? |
|---|---|---|---|
| **Competency** | WHAT can be developed | `{ id, name, desc, branch[], source }` in `competencies[]` | No - reusable, never carries a level |
| **Assessment** | What is CURRENTLY KNOWN about this musician for one competency | `{ id, competency, value, scale, method, modality, confidence?, at, source, evidence[], note? }` in `assessments[]` | Yes |
| **Evidence** | WHY an assessment is justified - what happened | `{ id, at, source, kind, modality, competencies[], data, note?, device? }` in `evidence[]` | Yes |

Around them: `goals[]` (where the musician wants to go), `plan` (what to work
on next - the coach's), `preferences[]`, `participants[]`, `provenance[]`,
`extensions{}` and any unknown top-level key (preserved).

**Observation is not proficiency.** The app produces evidence; a coach
interprets it; the profile preserves both. The app's own progression counters
(`skill-competency-profile/v1`, one doc per framework, `music.competency.v1`)
ride into the profile as `kind: "app-progression"` evidence with
`modality: "compose"` - the app watched the musician assemble songs and save
progressions; it has never heard them play. They are never flattened into a
level. On import the app does **not** re-ingest those counters (`kind` and
`source` are plain strings anyone can write); device-to-device transfer is the
backup envelope's job. On export the app REPLACES its own records outright
(`replaceById`) and retires its own pre-per-device legacy records
(`ev:app:music:progression:<fw>` with no `device`).

## Unassessed is explicit - everywhere

A competency with no assessment is **unassessed**. It is never beginner, never
level 0, never "no ability". `MusicianProfile.status(doc, id)` returns
`{ status: 'unassessed' }`; `describe(doc, id)` returns `"not yet assessed"`.
The rule is enforced at every representation:

| Surface | Absence reads as |
|---|---|
| profile.json | no assessment record (the export never writes a `value: 0`) |
| SKILL.md / the embedded `skill-competency-profile/v1` doc | `level: null` for a never-observed row (`Competency.exportProfile`); the table prints `unassessed` (`SkillMd.render`). Storage keeps the ladder's internal 0; a null round-trips through `mergeInto` without moving a counter. Legacy files with `level: 0, evidence_count: 0` are read as unassessed |
| Settings > Musician profile | "not yet assessed" (a profile row) / "not yet observed" (an app counter row); the headline says "Musicianship: not yet assessed"; no bar renders for a row with no counter |
| AGENTS.md + the plugin | "never infer beginner from missing evidence" is a startup rule and a MUST NOT |

A superseded assessment is **history, not deleted**: `status()` answers "now"
(latest `at`), `history(doc, id)` answers "how we got here". A participant
replacing its OWN record by id is that participant's choice; another
participant's record is never rewritten by anyone.

## Global musicianship vs instrument proficiency

A person can be an advanced musician, an expert guitarist, a 28-year bassist, a
brand-new ukulele player and completely unassessed on mandolin - at once. The
model never collapses these:

- `musicianship/*` - transferable, instrument-independent, branch
  `["musicianship", <area>]` with areas ear / harmony / improvisation / rhythm /
  transfer: tonal-orientation, ear-instrument-mapping, functional-harmony,
  modal-fluency, harmony-aware-improvisation, phrase-development,
  tension-release, improvisational-architecture, expressive-resolution,
  rhythmic-feel, cross-instrument-transfer.
- `stringed-instrument/*` transferable strings competencies beside the app's own
  five: movable-fretboard-fluency, triad-inversions, scale-shape-navigation,
  chord-scale-overlay (branch `["instrument","strings"]`).
- The app's per-instrument mechanics (`ukulele/*`, `guitar/*`) and crafts
  (`music-composition/*`, `lyric-writing/*`), from `competency.js` FRAMEWORKS.

The first two groups are `CORE_TAXONOMY` in `musician-profile.js` - competencies
the app **knows by name and never observes** (no counters, no SKILL.md). They
live in the profile module, not in competency.js, because competency.js is the
ladder for what the app can see. A bare namespace as an assessment subject
(`"guitar"`, `"stringed-instrument"`) is a **branch-level claim** about the
instrument as a whole; it never trickles down into the mechanics beneath it.

## The vocabulary is open

The floor is not a ceiling. Any participant may add a competency under any
namespace (`bass/walking-lines`, `flamenco/rasgueado`, `songwriting/prosody`)
with `id` (`<namespace>/<competency>`, kebab-case, stable), `name`, `desc`,
`branch` and `source`. `merge` unions competencies by id and keeps the LOCAL
definition for an id it already has; `compose` never overwrites a definition
another participant wrote. `summary()` places every competency by its
`branch[0]` (musicianship / instrument / craft) and groups it by its id
NAMESPACE - never by a deeper branch element, which a coach may use for
anything (a real hand-back wrote `["instrument","strings","transferable"]` for
a `stringed-instrument/*` id) - so an instrument the app never shipped still
gets exactly one row in the panel, under its own name. Proven
by `test/profile-roundtrip.test.js` (a hypothetical songwriting app,
"LyricLab") and `test/profile-baseline-case.test.js` (bass, piano, kalimba,
mandolin from a coach).

## Evidence provenance and modality

`evidence[].kind` is an open vocabulary; the suggested values
(`EVIDENCE_KINDS`) are `app-progression`, `app-observed`, `interview`,
`self-report`, `coach-observed`, `artifact`, `artifact-analysis`, `imported`.
`modality` is `perform | compose | write | listen | tune | theory | unspecified`
and names WHAT KIND OF DOING a record covers. **Never claim a modality that was
unavailable:** an attached audio file is `kind: "artifact"` with
`data.analyzed: false` - "audio attached" and "audio analyzed" are two claims,
and only the second may carry `perform`. Assessment `method` is
`self-report | interview | observed | coach | inferred`; a self-report is never
promoted to observed. Assessment `confidence` is `high | medium | low` - the
smallest useful qualification; a conversational self-assessment is
`"advanced", confidence "medium"`, never an 87/100 the schema would accept.

The ONE assessment the app itself holds is the self-reported guidance level
(`guidance-level.js`): `competency: "stringed-instrument"` (branch-level),
`scale: "band-3"`, `method: "self-report"`, `modality: "unspecified"`,
deterministic id `as:app:music:self-report`, `at` = **when the musician
tapped** (`music.guidanceLevel.at.v1`, written by `GuidanceLevel.set`), not
when it was exported - so a coach's later, better-grounded claim on the same
branch correctly supersedes it. Verified: no dismiss path writes a default
level; only an explicit tap reaches `set()`, so this record is always the
musician's own word.

## The coach as steward (the exported contract)

The exported guidance (`AGENTS.md`, rendered from `agent-readme.js`; mirrored in
the plugin's `music-interchange` skill, agent and commands) makes another
capable AI reproduce the coaching behaviour that worked:

| Phase | Contract |
|---|---|
| Startup | Read the ENTIRE profile; separate musicianship from instrument proficiency; read `goals`, `plan`, `capabilities.json`; never infer beginner from missing evidence; decide per branch whether the baseline is confident enough |
| Poor baseline | Run an **adaptive guided interview**: one question at a time, from existing evidence, discriminating questions not questionnaires, narrative allowed, evidence recognised in conversation (recorded as `kind: "interview"`), self-report kept distinct from observed, new competencies discovered, stop at diminishing value |
| Coaching | **Music making first** - `hear -> choose -> play -> notice -> adjust`; theory, harmony, geometry, rhythm, maths, acoustics only when they improve what the musician can hear, predict, perform, compose or understand |
| Continuous management | Add evidence; supersede an assessment with a NEW dated record; propose/discover a competency; identify a learning edge; update the plan; explain every meaningful change in plain language - the musician never edits JSON |
| Human in the loop | ASK THE HUMAN before a level going down, a new goal, a branch change, or any claim only partly grounded |

The coach owns `plan` (later `updated` wins whole) and the assessments it
authors; every record carries its own `id`, `source: "agent:<tool>"` and `at`.

## The learning plan

Assessment answers "where am I?", `goals` answer "where do I want to go?", the
plan answers "what should I work on next?" - and stays distinct from
assessment (a plan item is never a level):

```
plan: { updated, steward, focus?: string | [string | { intent | statement, ... }],
        items: [{ id, kind: focus|activity|edge, statement, competencies[],
                  goal?, status: todo|doing|done, deep_link?, updated }] }
```

`focus` is read leniently (a string, or a list of strings / objects carrying
`intent` or `statement` - the shape a real coach wrote before the item form
existed); whatever the app does not understand in `plan` is preserved
byte-identical and the whole object still wins by `updated`.

`kind: "edge"` is a coach-identified learning edge - the next useful thing,
not yet an activity. `deep_link` is an app URL the coach copied from
`capabilities.json` (which describes THE APP, never the person - every
capability carries one; `triad-inversions` links the standalone practice
page). The panel renders a plan item as a tappable action row ONLY when
`MusicianProfile.appLink(url)` accepts it (the URL starts with this app's
origin + path); any other URL is shown as text - a hand-back is a file anyone
could have written, and a foreign tappable link from it is what
[interaction-safety](../ux-philosophy/interaction-safety.md) forbids.

## Schema (`musician-profile/v1`)

| Key | Shape | Merge rule (`MusicianProfile.merge`) |
|---|---|---|
| `schema` | `"musician-profile/v1"` | fixed |
| `contract` | `{ id: "minimum-participation/v1", rules[3], unassessed }` | fixed, self-describing |
| `id` | `mp_<uuid>`, minted once per device | local wins; a device with no stored profile ADOPTS the imported id; a hand-back with NO id is addressed to the local profile; a mismatch is recorded in provenance, never rejected |
| `updated` | ISO 8601 (parsed with `Date.parse`, never string-compared) | later wins; a tie goes to the incoming document |
| `participants[]` | `{ id, name, version, url, capabilities_url, understands[], last_seen }` | union by id, later `last_seen` |
| `provenance[]` | `{ source, at, action, note? }` | concat, append-only for other participants, exact duplicates dropped; the app keeps ONE `export` and ONE `import` stamp with the latest `at` (`collapseRoutine` folds every duplicate, including ones older builds left) |
| `competencies[]` | `{ id, name, desc, branch[], source }` | union by id; a known id keeps the LOCAL definition; unknown ids preserved verbatim |
| `assessments[]` | `{ id, competency, value, scale, method, modality, confidence?, at, source, evidence[], note? }` | union by id; same id -> later `at` wins; different ids on one competency are its history |
| `evidence[]` | `{ id, at, source, kind, modality, competencies[], data, note?, device? }` | union by id; same id -> later `at` wins |
| `goals[]` | `{ id, statement, competencies[], status: active\|met\|parked, created, updated, source }` | union by id, later `updated` |
| `plan` | see above | the later `updated` wins WHOLE (the steward owns it) |
| `preferences[]` | competency.js shape | union by id, sum evidence, later statement |
| `extensions{}` + any unknown top-level key | anything | preserved; both sides carry the same key -> the newer document wins, ties to the incoming one |

**Stable ids.** Framework competency ids are reused verbatim, namespaced
`<framework>/<competency>`. Record ids are opaque; the app's recurring records
use deterministic ids so a re-export updates rather than duplicates:
`ev:app:music:<device>:progression:<framework>` (per device - `music.device.v1`,
minted once, excluded from backup - so two devices' records coexist and each
replaces only its own) and `as:app:music:self-report`.

**Instrument branches** (`BRANCHES`): `stringed-instrument` is
`["instrument","strings"]`; `ukulele` / `guitar` are children; crafts are
`["craft", <id>]`; an unknown framework is a craft. A coach names its own
branches (`["instrument","strings","bass"]`, `["instrument","keys","piano"]`).

## Settings > Musician profile (the panel)

`songbook.js` `mountSkillsPanel` / `renderSkillsPanel` (ids `accSecSkills`,
`accBtnSkills`, `accBodySkills`, `skillsImportFile`, `skillsGoals` kept from
the Skills era so every scenario keeps its hooks). The panel renders FROM the
profile: an in-memory `compose()` of the stored document (or a blank) plus the
taxonomy the app contributes - never persisted here; export is the only
writer. Progressive disclosure, top to bottom, answering the three questions:

| Block | Answers | Source |
|---|---|---|
| Headline (`#profileHeadline`, `.profileLine`) | What kind of musician am I? | `MusicianProfile.headline(summary)`: "Musicianship: advanced - 11 of 11 assessed" / "Ukulele: beginner - 1 observed in the app" / "Mandolin: not yet assessed". A band for musicianship is the value most assessments agree on (strings only). An instrument line (`groupLine`, shared with the row meta so the two never disagree): the band its assessed mechanics agree on (the more SPECIFIC claims lead), qualified by the split when only some are assessed, with a coarser branch-level claim that disagrees still shown ("advanced - 4 of 9 assessed - self-reported beginner"); a branch claim alone when nothing beneath is assessed; else "not yet assessed"; app observations appended |
| Goals / Focus / Next (`#skillsGoals`, `#skillsFocus`) | What am I developing, what should I do next? | goals, `plan.focus`, open plan items - an item with an app deep link is a `.setAction.planLink` row (44px floor), an edge reads "Next edge:", others are quiet `.skillPref` lines |
| Musicianship row | the transferable competencies by area (`.compArea` subheads) | `summary().musicianship` - status text per row, no bars (nothing to score) |
| Instrument rows | the app's frameworks (bars + counters + Export) first, then every instrument only the profile knows (bass, piano, kalimba...) | `summary().instruments`; a row's meta is its branch claim, else "N of M assessed", else "N observed", else "not yet assessed" |
| Craft rows | Composition, Lyrics | `summary().crafts` |
| Evidence and history (`#profileHistory`) | the detail view, closed by default | every evidence record (date, kind, modality, source, "attached, not analyzed" when `data.analyzed === false`) and every superseded assessment - the disclosure primitive the agent docs already use |
| Export for my AI / Import a profile | the seam | unchanged rows; import leads on an empty device |

Mobile/one-handed standards are unchanged: the existing primitives only
(`.setAction`, `.skillRow`, `.compRow`, `.agentDisclose`), two new type-only
classes (`.profileLine`, `.compArea`), no horizontal overflow at 412.

## Storage, bundle, import

| Surface | Detail |
|---|---|
| Storage | `music.profile.v1` - additive under the owned `music.` prefix (backup.js snapshots/restores it, no `SCHEMA_VERSION` bump); defensive reader. `music.guidanceLevel.at.v1` - when the level was tapped. Registered in [data-model.md](data-model.md) |
| Export | `downloadBundle()` writes `profile.json` at the zip root via `MusicianProfile.exportJson(store, { frameworks, progression, selfReport, selfReportAt, version })` beside README.md, AGENTS.md, capabilities.json, `<skill>/SKILL.md` (never-observed rows `level: null`) and the backup envelope. Export persists the composed profile - EXCEPT when the document would carry nothing of the person's (`isEmpty`): then `exportJson` returns null and the bundle reports "Nothing to export yet" |
| Import | The picker parses once (`peekJson`) and dispatches on `.schema`: `musician-profile/v1` -> `MusicianProfile.importJson` (no counter re-ingest); `music-setup/v1` -> setup doc; `.md` -> `SkillMd.parse` -> `Competency.importProfile`. Export is available when the app has counters OR a stored profile |
| Capabilities | Stay app-side in `capabilities.js` / `music/agent/capabilities.json`, each with an https `deep_link`; `triad-inversions` links the practice page. The profile's participant entry points at `capabilities_url` |
| AGENTS.md | Optional for a participant. Bundled and served; carries the coach contract above (`agent-readme.js`, byte-gated by `test/agent-manifest.test.js`) |

## Interoperability floor - the round trip

A completely independent app that understands only its own competencies must
be able to read the profile, preserve everything else, add its own
competencies/evidence/assessments, return the document, and round-trip through
this app without loss. Proven twice:

- `test/profile-roundtrip.test.js` - "LyricLab" (songwriting) implemented
  against the contract only: Music -> LyricLab -> Music -> LyricLab loses
  nothing on either side and overclaims nothing; a lossy participant cannot
  delete the app's records; a tampered hand-back moves nothing in the app.
- `test/profile-baseline-case.test.js` + `test/pw/scenarios/musician-profile-baseline.json`
  (the shared fixture `test/fixtures/musician-profile-baseline-handback.json`,
  uploaded through the REAL file picker) - the real baseline case below.

## The acceptance fixture (the real baseline case)

Piano from ~7, guitar from ~9, ~28 years of bass, ~15 years in a band, recently
started ukulele, a 17-key C-major kalimba; sustains improvisation over
unfamiliar tracks, orients tonally by ear, thinks in I/IV/V/vi, modal fluency,
targets chord tones, moves across positions, triad inversions, sings phrases
internally, develops motifs, builds arcs, tension/release, resolves outside
notes, transfers mental models across instruments - MOST of it self-reported
through a guided interview. Expected and proven: **advanced transferable
musicianship coexists with unassessed ukulele mechanics**; the headline reads
"Musicianship: advanced - 11 of 11 assessed", "Bass: advanced", "Ukulele:
beginner - 1 observed in the app" (the one honest beginner claim - new to the
instrument, the musician's own word), "Mandolin: not yet assessed"; the app's
earlier beginner tap on `stringed-instrument` is superseded by the interview
claim and kept as history; nothing self-reported is promoted to observed;
the attached clip stays "attached, not analyzed"; the next export carries
everything back out.

## Gates

- `test/musician-profile.test.js` - document, ids, branches, unassessed,
  self-report, evidence-not-proficiency, merge rules, storage, the taxonomy
  floor, confidence, history, plan/deep links, summary grouping, legacy
  record retirement, provenance collapse, open vocabulary.
- `test/profile-baseline-case.test.js` - the acceptance fixture (above).
- `test/profile-roundtrip.test.js` - the LyricLab round trip.
- `test/competency.test.js`, `test/skill-md.test.js` - `level: null` /
  "unassessed" in the legacy interchange doc.
- `test/agent-manifest.test.js` - deep links, the musician-profile +
  triad-inversions capabilities, AGENTS.md carries the contract and the coach
  contract text.
- `test/pw/scenarios/musician-profile-baseline.json`,
  `musician-profile-import.json`, `competency-profile.json`,
  `settings-skills-merged.json` - the panel, live, 412x915, real picker.

## What this deliberately does not do

- Consume the profile to personalize the app (the adaptive-depth plan,
  [docs/plans/competency-adaptive-depth-20260721.md](../../../docs/plans/competency-adaptive-depth-20260721.md),
  should read `assessments` - method, modality and confidence aware - not
  counters, when it lands).
- Author goals or run the interview in-app - the human-in-the-loop step lives
  in the coach conversation; the app shows and preserves.
- Convert counters into bands or levels.
- Introduce any LMS/LRS/server: static, local-first, one additive key.

## Future direction [ROADMAP reviewed 2026-09-13]

Music is the proving ground for a **person-owned lifelong learning profile**.
The same shape - namespaced competency ids, branch paths, assessment /
evidence / plan kept apart, a three-rule floor, unknown keys preserved - could
compose across roles a person defines (software engineer, business owner,
leader, parent, researcher) as sibling branches of one document, with a
private git repository or another user-controlled store holding the canonical
profile and each application operating on a domain-specific working slice.
Nothing built here prevents it and none of it is built here. Next in-app
steps, in order: the consume side (adaptive depth from assessments), then an
in-app review surface where a coach's proposed assessment waits for the
human's confirmation.

## Related

- [data-model.md](data-model.md) - key rows `music.competency.v1`, `music.profile.v1`, `music.device.v1`, `music.guidanceLevel.at.v1`
- [decisions.md](../decisions.md) - `D-MUSICIAN-PROFILE`, `D-MUSICIAN-PROFILE-VNEXT`
- `music/agent/AGENTS.md`, `plugin/music-coach/skills/music-interchange/SKILL.md` - the contract as read by agents
- [ux-philosophy/interaction-safety.md](../ux-philosophy/interaction-safety.md) - why only app-origin deep links render as taps
