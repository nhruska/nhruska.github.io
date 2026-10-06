# Goal spec - M-MUSICIAN-PROFILE-VNEXT (competency model + coaching contract refinement)

**Date:** 2026-09-13
**Branch:** `claude/musician-profile-interop-qdt7lh` (extends PR #351 - the harness pins
this branch for the session, so VNext ships as a second commit set on the SAME
review-only PR, clearly labeled; it is not a redesign of #351)
**Source directive:** a real AI coaching session exposed a semantic gap in the
model shipped by M-MUSICIAN-PROFILE - an experienced multi-instrument musician
read as beginner-like because missing evidence rendered as level 0, instrument
mechanics stood in for musicianship, advanced improvisational competencies had no
vocabulary, and the legacy SKILL.md still said `level: 0` where the profile means
"unassessed". This PR finishes the semantic model. Review-only. Do not merge.

## Objective (completion condition)

The profile models the musician, not the app - and now SAYS so end to end:

1. Absence reads as **unassessed** in every representation: profile.json,
   SKILL.md (`level: null` + "unassessed" in the table), the Settings panel, the
   AI guidance, the wiki. No surface emits level 0 / beginner for absence.
2. **Global musicianship** is modelled apart from instrument proficiency: a
   `musicianship/*` namespace (ear, harmony, improvisation, rhythm, transfer) and
   four transferable `stringed-instrument/*` competencies ship as a FLOOR; the
   coach may add any competency id and it survives every round trip.
3. **Competency / assessment / evidence** stay separate; an assessment may carry
   `confidence: high | medium | low`; a superseded assessment stays as history.
4. **Evidence provenance** names its kind (`app-observed | interview | self-report
   | coach-observed | artifact | artifact-analysis | imported`, open vocabulary)
   and its modality; "artifact attached" is never "artifact analyzed".
5. The exported **AI coach contract** reproduces the successful coaching session:
   read the whole profile, separate musicianship from instrument, run an adaptive
   guided interview when baseline confidence is poor, coach music-making first,
   manage assessments/plan continuously, explain changes in plain language.
6. The **learning plan** is distinct from assessment: `focus`, items with a
   `kind` (focus | activity | edge), competencies, goal, status, and an optional
   app `deep_link` the panel renders only when it points at this app.
7. **Settings > Musician profile** answers "what kind of musician am I, what am
   I developing, what should I do next" with progressive disclosure, on the
   existing mobile primitives.
8. The real baseline case (28 years of bass, guitar since 9, piano, kalimba,
   new to ukulele, advanced self-reported improvisational musicianship) round
   trips and is NEVER characterized as a beginner; ukulele mechanics stay
   unassessed/developing beside advanced transferable musicianship.

Done when: `node test/run-all.js` green (new `profile-baseline-case.test.js`,
extended `musician-profile` / `skill-md` / `competency` / `profile-roundtrip` /
`agent-manifest` tests); scenario `musician-profile-baseline.json` RED on main,
GREEN here; the three existing profile/skills scenarios still pass; the cache
pair is `music-v351-4`; the wiki page is the spec.

## Current architecture (inspected on `402af25`, PR #351 head)

| Piece | State | Verdict |
|---|---|---|
| `musician-profile.js` - `musician-profile/v1`, contract inside the doc, merge floor, per-device app evidence, self-report assessment | Shipped in #351 | KEEP; EXTEND (taxonomy floor, confidence, kinds, plan shape, history helpers, summary helpers) |
| `competency.js` - `skill-competency-profile/v1` counters, `blankProfile` seeds `level: 0` | Shipped (M-COMPETENCY) | KEEP counters; `exportProfile` emits `level: null` for never-observed rows (the doc is the interchange; 0 was the lie) |
| `skill-md.js` - SKILL.md render/parse | Shipped | KEEP; table renders "unassessed" for null-level rows |
| `guidance-level.js` - self-report, null = unset | Shipped | KEEP. Verified: no dismiss path writes `beginner` any more (only the welcome tour choice and the Settings segment call `set`), so the exported self-report is always the musician's own tap |
| Settings > Skills panel (`songbook.js` `mountSkillsPanel`) | Shipped; lists 5 framework rows, "not yet observed", goal/plan lines | RESHAPE into Musician profile: headline + Musicianship group + instruments/crafts + other instruments the profile knows + goals/focus/plan + evidence disclosure. Same ids (`accSecSkills`, `accBtnSkills`, `accBodySkills`, `skillsImportFile`, `skillsGoals`) so every existing scenario keeps its hooks |
| `agent-readme.js` (AGENTS.md + README.md), `capabilities.js` | Shipped, byte-gated | REWRITE the guidance: coach contract, interview, plan, provenance; capabilities add `triad-inversions` (a real deep link the plan can use) |
| Plugin `music-coach` | Shipped | ALIGN with the contract (interview, confidence, plan shape) |
| Wiki `systems/musician-profile.md` | Shipped | REWRITE around the conceptual model the directive lists |

## Conflicts with the VNext requirements (what the bundle on the branch preview shows)

The operator's real export (`music-agent-bundle_5.zip`, build v351-3) was the evidence:

| # | Requirement | Observed conflict |
|---|---|---|
| 1 | Unassessed everywhere | `ukulele/SKILL.md` table + JSON say `Level 0` for four never-observed rows; AGENTS.md still tells the coach to "grade competency levels vs targets ... coach from what the levels say" |
| 2 | Global vs instrument | Taxonomy is 25 instrument/craft mechanics; nothing names tonal orientation, functional harmony, phrase development... The one branch-level assessment (`stringed-instrument` self-report) is the only place "musician" exists |
| 3 | Open vocabulary | Merge preserves unknown ids (proven), but the panel cannot SHOW an instrument the app does not ship (bass, piano, kalimba) - the musician's 28 years are invisible |
| 4 | Assessment qualification | No `confidence`; `scale`/`value` open but undocumented for bands; history of a superseded assessment only survives when ids differ (documented now) |
| 5 | Provenance | Three `export` rows in `provenance` (the collapse folded only the first match; two rows from earlier builds survived); two device-less `ev:app:music:progression:*` records from v351/v351-2 sit beside the per-device ones - the app's own stale duplicates |
| 6 | Coach contract | No interview behaviour, no music-first coaching stance, no continuous-management loop in the exported guidance |
| 7 | Learning plan | `plan.items` has no `kind`, no `focus`, no deep link |
| 8 | UX | Section is "Skills": a list of counters. It cannot answer "what kind of musician am I" |

## Smallest coherent change set

**`musician-profile.js`** (pure module, additive):
- `CORE_TAXONOMY` - the profile-native floor: 11 `musicianship/*` + 4 transferable
  `stringed-instrument/*` competencies, each with `branch` (`["musicianship","ear"]`
  etc.). `compose()` writes them beside the framework taxonomy. The app observes
  NONE of them - they exist so a coach and the panel have shared names.
- `CONFIDENCE = ['high','medium','low']`, `EVIDENCE_KINDS` (suggested, open),
  `METHODS` gains `interview`. `validate` tolerates all of it (open contract).
- `history(doc, competency)` (all assessments, latest first); `status()` unchanged.
- Plan shape: `plan.focus?`, `items[].kind? (focus|activity|edge)`,
  `items[].deep_link?`. `appLink(url)` -> the URL only when it starts with this
  app's origin + path, else null (the panel never renders a foreign link).
- `compose()`: retires the app's OWN legacy device-less progression records
  (`ev:app:music:progression:<fw>`, source app:music, no `device`) - they are this
  app's records, superseded by the per-device form; the counters they carried are
  re-emitted by the exporting device. `collapseRoutine()` folds ALL routine app
  stamps (export/import) to one each - fixing the observed triple.
- `summary(doc, frameworks, progression)` - the panel's headline data: per group
  (musicianship / instruments / crafts / other) the assessed vs unassessed split and
  a plain-English status per competency (`describe()`: "advanced - self-reported,
  high confidence, Sep 13" / "not yet assessed" / "9 observations in the app").

**`competency.js` / `skill-md.js`**: `exportProfile` maps never-observed rows to
`level: null`; `mergeInto` already clamps null to 0 on the LOCAL side, so a null
never lowers a counter; SKILL.md table prints "unassessed".

**`songbook.js`**: section label "Musician profile"; headline block; Musicianship
group row; framework rows show the latest profile assessment next to the app's
counter; "Other instruments" rows for profile competencies under `instrument/*`
the app does not ship; goals + focus + plan (deep link as a tappable `.setAction`
only for app-origin URLs); an "Evidence and history" `<details>` disclosure (the
existing agentDisclose primitive). No new primitives.

**AI guidance**: AGENTS.md rewritten around the coach contract; README, plugin
skill/agent/commands aligned; `capabilities.json` gains `triad-inversions`.

**Wiki**: `systems/musician-profile.md` rewritten to the conceptual model; rows
in data-model (shape notes), decisions (`D-MUSICIAN-PROFILE-VNEXT`), index
routing, roadmap; QUEUE row.

## Migration / backward compatibility

| Concern | Handling |
|---|---|
| Stored `music.profile.v1` from v351-3 | Additive: new fields are optional; old docs normalize. The next export retires the app's legacy device-less records and collapses duplicate routine stamps - the counters are re-emitted, nothing of another participant is touched |
| `music.competency.v1` | Untouched. `level: null` appears ONLY in the exported v1 doc; storage keeps 0 (the ladder's internal floor) |
| SKILL.md hand-backs from older exports (level 0 rows) | Still import: `mergeInto` takes max(level) and sums evidence - a 0 changes nothing |
| Older coach hand-backs without `confidence`/`kind` | Valid; rendered as "confidence not stated" |
| No `SCHEMA_VERSION` bump | No stored shape changed |
| Scenarios pinning "Skills" | `settings-skills-merged` accepts the new label; `competency-profile` counts frameworks + the Musicianship group; `musician-profile-import` taxonomy count includes `CORE_TAXONOMY` |

## Assumed answers (operator absent - basis cited)

| Question | Assumed | Basis |
|---|---|---|
| Same PR or a new one? | Same PR (#351), second labeled commit set | The harness pins this branch; the directive says "refinement, not redesign"; one review surface |
| Where does the musicianship floor live - competency.js or the profile? | The profile module (`CORE_TAXONOMY`) | competency.js counters are for what the app OBSERVES; musicianship is not app-observable, and a `musicianship/SKILL.md` full of nulls would be noise |
| Confidence vocabulary | `high | medium | low` only | Directive: "smallest useful representation... do not invent false precision" |
| Should the panel render coach deep links? | Yes, app-origin only | Directive section 7 + interaction-safety: never a foreign tappable link from a hand-back |
| Rename "Skills" to "Musician profile"? | Yes, ids unchanged | Directive section 8; Element Consistency Law keeps the primitives |
| Legacy device-less app records | Retired on the next export | They are the app's own records (`replaceById` doctrine from volley 1); another participant's records are never touched |

## Verification

- `node test/run-all.js` - all files green.
- `python3 test/pw/run-scenario.py test/pw/scenarios/musician-profile-baseline.json` -
  RED on an `origin/main` worktree, GREEN here (real file picker, 412x915).
- `competency-profile`, `settings-skills-merged`, `settings-agent`,
  `settings-skills-uat`, `settings-action-rows`, `musician-profile-import` still PASS.
- `bash scripts/check-cache-bump.sh origin/main` OK at `music-v351-4`.

## Future direction (documented, not implemented)

A person-owned lifelong learning profile: the same document shape could hold
other domains (engineer, leader, parent) as sibling branches with a canonical
store the person controls and apps operating on working slices. Nothing here
prevents it: ids are namespaced, branches are paths, unknown keys survive, the
contract is three rules. See the wiki page "Future direction".
