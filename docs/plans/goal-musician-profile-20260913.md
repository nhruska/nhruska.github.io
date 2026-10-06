# Goal spec - M-MUSICIAN-PROFILE (portable, lifelong musician profile interop)

**Date:** 2026-09-13
**Branch:** `claude/musician-profile-interop-qdt7lh`
**Source directive (ChatGPT design session, relayed 2026-09-13):** implement the
portable, lifelong Musician Profile interoperability model. Product principle:
**the profile models the musician, not the app.** Define a minimum participation
contract, not a new standard. One atomic review-only PR. Do not merge.

## Objective (completion condition)

The app exports and imports a person-owned `musician-profile/v1` document under a
stated minimum participation contract (read what you understand, preserve what
you don't, add what you legitimately know). Competencies are separate from
assessments; a competency with no assessment is explicitly unassessed, never
"beginner". The app's existing progression tracking rides along as EVIDENCE with
its modality stated, never flattened into a proficiency claim. Instrument
branches, stable ids, evidence provenance, goals and a coach-stewarded plan are
first-class. A hypothetical songwriting app round-trips the document without
losing either side's data. The wiki is the spec and is updated in this PR.

Done when: `node test/run-all.js` is green including the new
`musician-profile.test.js` + `profile-roundtrip.test.js`; the export bundle
carries `profile.json`; `Settings -> Skills -> Import` accepts a `profile.json`
(scenario `musician-profile-import.json` RED on main, GREEN here); the
cache-bump pair is set to the PR number; the wiki page + data-model rows exist.

## What exists (read before designing - wiki AGENTS.md, index.md, decisions.md, then code)

| Piece | File | Verdict |
|---|---|---|
| Per-skill competency tracker, `skill-competency-profile/v1` | `music/shared/competency.js` | **KEEP as the app's progression tracker.** 5 frameworks x 5 competencies, level 0-100 grown from evidence, `evidence_count`, `last_evidence`, `provenance[]`, `preferences[]`. Stored `music.competency.v1`. Its `level` is the APP's ladder, not a proficiency claim. Its blank profile emits `level: 0` for never-evidenced competencies - the "unassessed reads as beginner" defect the directive names |
| Self-reported experience level | `music/shared/guidance-level.js` | KEEP. Already models "unset is explicit, not beginner" (null = ask pending, never a silent default) - the one self-report assessment the app legitimately holds |
| SKILL.md render/parse | `music/shared/skill-md.js` | KEEP unchanged. Per-skill interchange, lossless embedded JSON |
| Agent surface: AGENTS.md + README.md text, capabilities manifest | `music/shared/agent-readme.js`, `music/shared/capabilities.js`, `music/agent/*` | KEEP; EXTEND. Bundled (not fetched), byte-gated by `test/agent-manifest.test.js`. Capabilities are app-side already - they gain a deep link each |
| Zip export + import dispatch | `music/shared/songbook.js` `downloadBundle` / `fileInput.onchange` | KEEP; EXTEND. Zip = README + AGENTS.md + capabilities.json + `<skill>/SKILL.md` + backup envelope. Import dispatches on `.schema` (profile v1 / setup doc / SKILL.md) |
| Evidence hooks | `songbook.js` `recordComp` / `recordRepertoire` | KEEP the counters. **Modality overclaim found:** assembling a song in Compose records `uke-repertoire` ("songs you can play start to finish"). The app never heard anyone play - that evidence is COMPOSE modality. Fixed at the interop seam (evidence tagged `modality: compose`), counters untouched |
| Adaptive-depth plan (bands, cores, session caps) | `docs/plans/competency-adaptive-depth-20260721.md` | DRAFT, not built. Out of scope here; the profile doc leaves room (`scale: band-3` assessments) so it lands additively later |
| Skills+agent merge spec | `docs/plans/design-skills-agent-merge-20260903.md` | Mostly shipped (S-SKILLS-MERGED #342). Its two unbuilt items - `profile.json` in the zip and a stated round-trip contract - are exactly what this mission ships |
| Plugin coach | `plugin/music-coach/` | KEEP; EXTEND. `music-interchange` skill mirrors the contract - it learns `profile.json`, the steward role and the modality rule |
| Wiki coverage | `music/engineering-wiki/` | **GAP.** No page owns competency / skills / agent surface; `systems/data-model.md` does not list `music.competency.v1`. Fixed in this PR (new `systems/musician-profile.md`, key rows, index routing, decision row) |

## What to keep vs change (the smallest coherent change)

Keep every existing format and key. Add ONE person-owned document beside them:

- **New pure module** `music/shared/musician-profile.js` (`window.MusicianProfile`,
  require()-able, dependency-free, optional trailing store - the competency.js
  discipline). Owns the `musician-profile/v1` document, the contract text, ids,
  merge, export/import, and the "what the Music app legitimately knows" render.
- **New key** `music.profile.v1` - additive under the owned `music.` prefix, so
  backup.js snapshots it with NO schema bump. Defensive reader.
- **Zip gains `profile.json`** at the root. Everything else in the zip is unchanged
  (SKILL.md per skill stays - the v1 hand-back path keeps working).
- **Import accepts `profile.json`** by schema peek (`musician-profile/v1`), same
  picker, same dispatch pattern as the setup doc.
- **Skills panel:** never-evidenced competencies read "not yet observed" instead of
  "0 / 80"; goals + plan items render as quiet read-only lines when present
  (the same `.skillPref` look as preferences). No new controls.
- **Capabilities** gain `deep_link` (absolute URL) per capability and a
  `musician-profile` capability. AGENTS.md / README.md gain the profile section,
  the contract, the steward role and the modality rule. AGENTS.md stays OPTIONAL:
  `profile.json` carries its own `contract` block so a participant that never
  reads AGENTS.md still knows the three rules.
- **Plugin** `music-interchange` skill + `music-coach` agent + `assess` /
  `practice-plan` commands learn `profile.json` and the steward role.
- **Wiki** page + rows + decision + future direction, same PR.

NOT in scope (named so it is a decision, not an omission): consuming the profile
to personalize the app (the adaptive-depth plan), a canonical server-side store,
a UI to author goals in-app, converting the app's counters into bands.

## File schema - `musician-profile/v1`

```
{
  "schema": "musician-profile/v1",
  "contract": {                                  // self-describing; AGENTS.md is optional
    "id": "minimum-participation/v1",
    "rules": [ "Read what you understand.", "Preserve what you don't - byte-identical, including keys you have never seen.", "Add what you legitimately know - as evidence or an assessment that names its method and modality, never as a level you did not observe." ],
    "unassessed": "A competency with no assessment is unassessed. Absence is never beginner. No participant emits a level it did not observe."
  },
  "id": "mp_<uuid>",                             // stable musician id, minted once on device
  "updated": ISO,
  "participants": [ { "id":"app:music", "name", "version", "url", "capabilities_url", "understands":[section names], "last_seen":ISO } ],
  "provenance": [ { "source", "at", "action" } ],  // append-only
  "competencies": [ { "id":"ukulele/uke-open-chords", "name", "desc", "branch":["instrument","strings","ukulele"], "source" } ],
  "assessments": [ { "id", "competency", "value", "scale":"0-100"|"band-3", "target"?, "method":"self-report"|"observed"|"coach"|"inferred", "modality":"perform"|"compose"|"write"|"listen"|"tune"|"theory"|"unspecified", "at", "source", "evidence":[ids], "note"? } ],
  "evidence": [ { "id", "at", "source", "kind", "modality", "competencies":[ids], "data":{...} } ],
  "goals": [ { "id", "statement", "competencies":[ids], "status":"active"|"met"|"parked", "created", "updated", "source" } ],
  "plan": { "updated", "steward", "items":[ { "id", "statement", "competencies":[ids], "goal"?, "status":"todo"|"doing"|"done", "updated" } ] },
  "preferences": [ { "id", "statement", "evidence_count", "last_evidence" } ],
  "extensions": { "x-<participant>": {...} }     // + any unknown top-level key, preserved as-is
}
```

**Stable ids.** Competency id = `<framework>/<competency>` - the existing
framework and competency ids verbatim (they are the portable contract already),
namespaced so two branches can share a short name. A bare framework id
(`stringed-instrument`) as an assessment subject is a branch-level claim.
Assessment / evidence ids are opaque strings; the app mints deterministic ids
for its own recurring records (`ev:app:music:progression:<framework>`,
`as:app:music:self-report`) so a re-export UPDATES rather than duplicates.

**Instrument branches.** `branch` is a path: `ukulele` and `guitar` are
`["instrument","strings",<id>]`, children of `stringed-instrument`
(`["instrument","strings"]`); `music-composition` / `lyric-writing` are
`["craft",<id>]`. A reader that knows only "strings" still places a ukulele claim.

**Modality (don't overclaim).** Every assessment and evidence record says WHAT
KIND OF DOING it covers. The Music app today observes `compose` (assembling a
song, saving a progression) and holds one `self-report` of `unspecified` modality
(the guidance level). It never claims `perform` - it has never heard the musician
play. A participant that only reads chord charts must not claim `perform` either.

**Competencies vs assessments.** `competencies[]` is the taxonomy (what exists,
per branch). `assessments[]` are dated, sourced claims about a competency.
`status(profile, id)` -> the latest assessment or `unassessed`. The export never
writes a `value: 0` for a competency nothing assessed.

**Progression as evidence, not proficiency.** The app's per-framework counters
(the v1 doc: level, evidence_count, last_evidence) ride in `evidence[]` as one
`kind: "app-progression"` record per framework, modality `compose`, `data` = the
counters. No assessment is derived from them by the app. A coach may cite that
evidence when it proposes an assessment, with the human confirming meaning.

## Merge semantics (the interoperability floor, executable in `MusicianProfile.merge`)

| Section | Rule |
|---|---|
| `id` | local wins; adopt incoming when local has none; a mismatch is recorded in provenance, never a rejection (the person chose to import) |
| `participants` | union by id, later `last_seen` wins |
| `provenance` | concat, append-only, exact duplicates dropped |
| `competencies` | union by id; a known id keeps the local name/desc/branch; unknown ids preserved verbatim |
| `assessments`, `evidence` | union by id; same id -> later `at` wins (a re-exported counter snapshot replaces its older self, a stranger's record is never rewritten) |
| `goals` | union by id, later `updated` wins |
| `plan` | the later `updated` wins whole (the steward owns it) |
| `preferences` | existing competency.js rule (sum evidence, later statement) |
| `extensions` + unknown top-level keys | preserved; when both sides carry the same unknown key the later `updated` document wins |

## Coach as steward (contract prose, in AGENTS.md + the plugin)

The coach owns `plan` and its own assessments; reads `goals` first; proposes an
assessment only with evidence it can cite (`evidence[]` ids or the conversation);
states `method` and `modality` honestly; asks the human when meaning is ambiguous
or the change is important (a level regression, a new goal, a branch change) -
in the conversation, before writing; never rewrites another participant's
records; never turns app counters into a proficiency number without the human.

## Wiki impact (same PR)

- NEW `music/engineering-wiki/systems/musician-profile.md` - the model, contract,
  schema, storage, merge rules, modality table, what the app legitimately knows,
  future direction. `[STABLE]` contract + `[ROADMAP]` future section.
- `systems/data-model.md` - key rows for `music.competency.v1` (missing today)
  and `music.profile.v1`.
- `index.md` - systems row + routing rows ("skills / profile / agent bundle").
- `decisions.md` - `D-MUSICIAN-PROFILE` (profile models the musician; unassessed
  explicit; progression is evidence; modality never overclaimed).
- `workflows/roadmap-missions.md` - backlog rows: consume side, canonical store.
- `generated/DATA-MODEL.md` is rendered from the wiki - not hand-edited; its
  header records the source pages, regenerate at the next synthesis pass.

## Migration risk

- **Storage:** additive only - one new `music.` key, no reader changes shape, no
  `SCHEMA_VERSION` bump, no `StorageMigrate` step. An older cached build ignores
  the key; backup/restore carries it byte-faithfully.
- **Interchange:** `skill-competency-profile/v1` unchanged - every existing
  SKILL.md hand-back still imports. `profile.json` is a NEW accepted shape.
- **Bundle:** one added file at the zip root; existing readers unaffected
  (the plugin's `music-interchange` is updated in the same PR).
- **SW:** one new CORE file + the cache-bump pair (`music-v<PR#>`), stamped onto
  asset URLs by `scripts/stamp-asset-versions.py`.
- **Behavior:** the only visible app change is Skills-panel copy ("not yet
  observed" for never-evidenced rows, quiet goal/plan lines). No control moves.

## Assumed answers (operator absent - answered from recorded preferences, basis cited)

| Question | Assumed answer | Basis |
|---|---|---|
| Replace `skill-competency-profile/v1` or add beside it? | Add beside it; v1 stays the app's tracker + hand-back path | Directive: "keep existing progression tracking as evidence"; backup.js additive law; every plugin/AGENTS.md reader speaks v1 |
| Should the app's counters seed an assessment? | No. Evidence only, modality `compose` | Directive: "don't flatten it into proficiency"; "don't overclaim modality" |
| Where does the human-confirmation step live? | In the coach conversation (contract prose), not a new in-app queue | Smallest coherent change; the app is a static PWA with no inbox; QUEUE row names the in-app review surface as a future item |
| Show goals/plan in the app? | Read-only quiet lines in Skills, no authoring UI | "One screen above the fold"; action-row law (no new prose/controls); the steward writes the plan, the app preserves and shows it |
| Deep-link base URL for capabilities | `https://nhruska.github.io/music/play/` | The deployed app (CLAUDE.md); relative `surfaces` kept beside it |
| Musician id | UUID minted once per device, adopted from an import when local has none | Directive: stable ids; local-first; no account |
| Round-trip partner for the test | A hypothetical songwriting app "LyricLab" implemented in the test as a minimal participant following only the contract | Directive names a hypothetical songwriting app |

## Verification

- `node -c` on every changed JS; `node test/run-all.js` green (all files).
- Red-first scenario `test/pw/scenarios/musician-profile-import.json`: RED on
  main (no import branch, no goal line), GREEN here. Existing `competency-profile`
  + `settings-skills-merged` scenarios still green at 412x915.
- `bash scripts/check-cache-bump.sh origin/main` exit 0 after the bump.
- `python3 scripts/stamp-asset-versions.py --check` exit 0.

## Future direction (documented, not implemented)

Music proves a person-owned, lifelong learner model: one document the person
carries, that any app can read, preserve and add to under a three-rule floor. A
future canonical store (a person's own repo, a synced folder, a service) could
hold `profile.json` as the SSOT with apps as participants - possible, not built
here. The next in-app step is the consume side (the adaptive-depth plan reading
assessments, not counters), then an in-app review surface where a coach's
proposed assessment waits for the human's confirmation.
