# Goal - Coding-Agent Interaction Spec for the Music App

> Mission (2026-08-17): define how external coding agents (Claude Code, Cowork, or any
> agent with plain file-system access) read the app's instruction set, evaluate a user's
> profile, and USE/UPDATE the user's skill-competency data - while the app stays static,
> on-device, offline-capable, and server-free. Features degrade, they never require a server.

## Goal spec

| Field | Value |
|---|---|
| Objective | Ship the agent-interaction CONTRACT (this doc) + the artifacts it names, so any agent pointed at a user's exported files can orient, evaluate, and propose updates without app code, network, or a server |
| Completion condition | Contract sections below each map to a shipped artifact or an explicitly deferred mission row; round-trip (export -> agent edit -> import) covered by node tests; QUEUE carries the implementation missions |
| Verification | `node test/run-all.js` green (backup, competency, skill-md suites); a simulated agent-edit round-trip test proves the write path; validator rejects malformed agent output |
| Scope IN | Interchange contracts, bundled instruction surface, capability manifest, degradation ladder, provenance rules |
| Scope OUT | Any server or account system; live in-page agent runtime; LLM calls from the app itself (M-0 deterministic-tutor law stands) |
| Guardrails | Public repo - frameworks only, never personal data; backup.js schema rules (additive-first, bump+migration in same commit); ONE validator (competency.js), never a second drifting copy; agents propose, the app's merge decides |
| Abort conditions | Any design that requires a server for a CORE flow; any second validator; any personal data committed to the repo |

### Assumed answers (operator absent - basis cited)

| Question | Assumed answer | Basis |
|---|---|---|
| Do agents set competency levels directly? | No - agents submit evidence-annotated profile docs; `Competency.importProfile` -> `mergeInto` mediates what lands | pedagogy-coach: mastery data is additive, the app's deterministic machinery owns graduation; "one validator, never two drifting copies" (skill-md.js header) |
| Where do agent instructions live? | Bundled INSIDE the export (self-describing), mirrored at a static site path | Offline/no-server law: instructions must travel with the data |
| New storage schema? | None - reuse `skill-competency-profile/v1`, backup envelope v1, SKILL.md interchange | All three exist and are tested; additive beats new |
| Is this a new app mode? | No - it is a contract on the EXISTING export/import seams | "Change is cheap given a strong spec-driven SSOT"; smallest diff that ships the capability |
| Can agents stand up app state (jam setups)? | Yes, as ephemeral proposals via deep link / setup doc; Save is a user act through existing forms | Operator burst 2026-08-17 ("progression to jam over, yt video immediately w option to save"); safety: no writer on load |
| YT in agent setups? | Video ids/URLs + embed only - keyless forever | PLAYLIST-KEYLESS decision; playlist-import.js precedent |

---

## 1. The two agent audiences (do not conflate)

| Audience | Reads | Governed by |
|---|---|---|
| **Repo agents** - CC building the app itself | repo CLAUDE.md, music/CLAUDE.md, [engineering-wiki/AGENTS.md](../../music/engineering-wiki/AGENTS.md) | Existing working agreement - out of this spec's scope |
| **User-side agents** - CC/Cowork with file-system access to a USER'S exported files (no repo, maybe no network) | The export artifacts themselves + the instruction surface this spec adds | THIS contract |

The user-side agent is the new citizen. Its whole world is a folder of files the user
exported from the app. Everything it needs - orientation, schemas, permissions, the
hand-back procedure - must be IN that folder.

## 2. The three artifacts (all exist today)

| Artifact | Producer | Contract |
|---|---|---|
| **Backup envelope** `music-songbook-<date>.json` | `shared/backup.js` `snapshot()` (download/share wiring in play/index.html) | `{ app:'music', schema:N, exportedAt, data:{key:rawString} }` - byte-faithful snapshot of every owned localStorage key (`songbook.` `roadcase-` `bt.` `music.` `tri.`). The competency map travels inside it (`music.competency.v1`). Versioned + migrated on restore. **This is the full profile: repertoire, setlists, progressions, preferences, skill progress.** |
| **Skills bundle** `<skill-id>/SKILL.md` (zip) | `shared/skill-md.js` + `zip-store.js` via the Settings Skills panel | Open-skills-format SKILL.md per skill; human/agent-readable table is presentation, the fenced ```json block under "## Profile data" is the EXACT `skill-competency-profile/v1` doc - import parses THAT, so round-trip is lossless |
| **Profile doc** `skill-competency-profile/v1` | `shared/competency.js` `exportProfile()` | `{ schema, skill, discipline, updated, provenance:[{source,at}], competencies:[{id,name,desc,level,target,evidence_count,last_evidence}], preferences?[] }` |

The backup already "provides everything" - correct presumption. The skills bundle is the
purpose-built interchange for carrying a skill to another AI tool and back (backup.js
comment, line ~271). This spec formalizes what an agent may DO with them.

## 3. Read path - agent evaluates the profile

An agent handed a backup and/or skills bundle can, with zero app code:

1. Parse the envelope; verify `app === 'music'` and `schema <= ` the version named in the
   bundled instructions. Values in `data` are raw strings - JSON.parse each key it needs.
2. Evaluate: competency levels vs targets (gaps), evidence recency (staleness), repertoire
   size per instrument (`roadcase-<id>.setlist.v1`), saved progressions, preferences.
3. Coach: generate practice plans, pick next songs, critique progressions - using the
   levels as ground truth for what the user can already do ("expose capabilities users
   already have").

The bundled AGENTS.md (section 5) tells the agent exactly which keys mean what, so this
requires no reverse engineering.

## 4. Write path - agent proposes, the app disposes

Agents NEVER write localStorage and NEVER hand back a modified backup envelope for
restore (restore is byte-faithful and would bypass validation). The single write seam:

1. Agent edits (or authors) a `skill-competency-profile/v1` doc - inside a SKILL.md fenced
   block or as bare JSON. Rules:
   - Append a provenance entry: `{ source: 'agent:<tool-name>', at: ISO }`. Never rewrite
     existing provenance.
   - Level changes carry evidence: bump `evidence_count`, set `last_evidence` to a short
     human-readable reason ("assessed from practice log 2026-08-17"). A level change with
     no evidence delta is a smell the import UI may flag.
   - Unknown competency ids / skills are allowed in the DOC (portable format) but the app
     imports only ids its FRAMEWORKS know - additions ride along harmlessly.
   - `preferences[]` is the additive slot for taste statements agents learn ("prefers
     fingerpicking arrangements").
2. User imports via the existing Settings Skills panel (file picker - works offline).
3. `Competency.importProfile` validates (schema string, known skill, competencies array)
   and `mergeInto` decides what lands. The app is the ONLY validator and the ONLY writer.

Why evidence-mediated (pedagogy-coach ruling): the app's teaching machinery is
deterministic and owns graduation; agent assessments are one more evidence SOURCE, not a
override channel. The merge stays authoritative so a hallucinated level cannot silently
rewrite mastery state.

## 4b. Agent-actionable setups - suggest AND stand it up (operator burst 2026-08-17)

Reading and grading is half the value. The other half: an agent's suggestion should be
one tap from BEING the app state - "here is a ii-V-I in G to jam over, with this backing
video" arrives as something that opens ready to play, with an option to save.

Two transports, same offline law:

| Transport | Shape | For |
|---|---|---|
| **Deep link** (primary - "immediately") | `music/play/?jam=<progression>&key=<tonic>&yt=<videoId>` - extends the existing `?p=` URL-param seam (play/index.html ~576). App parses, stands up the jam on load, offers Save | One-tap setups: a progression, a key, one optional backing video |
| **Setup doc** `music-setup/v1` (fallback + batch) | Additive portable JSON (schema string + typed payload: progression / track link / practice plan), imported via the same file-picker pattern | Payloads too big or too many for a URL; agent bundles them next to the SKILL.md files |

Contract rules (both transports):
- Chord tokens are CANONICAL-SHARP (storage regime); key names use the preferred tonic
  (KEY-STORE-PREF). Display respelling stays the app's job - agents never pre-respell.
- YT stays KEYLESS (PLAYLIST-KEYLESS decision): video ids/URLs only, embed playback, no
  API key ever. No key found for a suggested track -> the agent must state the key or
  omit the track - the app never invents a key (playlist-import ladder rule 3).
- **Setup is a PROPOSAL rendered live, saved only by the user.** The deep link stands up
  ephemeral state; Save routes through the existing repertoire/progression forms and
  their validators. Nothing writes storage on load.
- Unknown params / unknown doc types are IGNORED by older builds (defensive-reader law) -
  a stale cached PWA degrades to opening the app, never to an error.
- Offline: the link itself is local and server-free; the YT embed needs network and
  degrades to progression-only jam over the app's own audio engine.

## 4c. The coach bench, instantiated - plugin packaging

The repo already ships the coaching expertise as public skills
(`.claude/skills/`: music-theory-coach, pedagogy-coach, songwriting-coach, ux/audio/
a11y/copy coaches). Packaging them WITH this contract makes any Claude Code / Cowork
session a personal music coach - "it could all be a plugin":

- **Plugin = coach skills + the interchange AGENTS.md + capabilities.json + commands**
  (e.g. `/music:assess` - read exports, grade vs targets; `/music:practice-plan` -
  evidence-based plan from the profile; `/music:jam` - emit a section-4b deep link).
- The plugin's agents operate ONLY through this contract: read exports, propose profile
  docs, emit deep links / setup docs. No new writers, no server - the plugin is static
  files in a public repo, installable from git.
- This is the demo shape: **learning apps using skills for content (songs, frameworks),
  coaching (the bench), and competency records (profile docs) - portable skill artifacts
  absorbing what an LMS would otherwise own** (content library, coach, gradebook), with
  the app as the deterministic practice surface and the agent as the adaptive layer.

Adjacent (SEPARATE session, operator-flagged): the personal-skills second-brain skill
(knowledge map for skills) likely joins this graph - the music profiles becoming nodes in
a cross-discipline competency map. Noted here as a pointer only; not this mission.

## 5. The instruction surface (new work - the heart of this mission)

**A. Self-describing exports.** The skills zip (and, later, the backup download) gains a
bundled `AGENTS.md` at the zip root: what these files are, the schemas (with the fenced
canonical JSON of section 2's contracts), what an agent MAY do (read anything, propose
profile docs per section 4), what it MUST NOT do (edit the backup envelope for restore,
invent provenance, strip evidence), and the hand-back procedure ("save as
`<skill-id>/SKILL.md`, tell the user to import in Settings -> Skills"). Instructions
travel WITH the data - this is what keeps the whole loop offline and server-free.

**B. Static capability manifest.** New `music/agent/` on the site (and precached by the
SW, so it is readable offline once installed):
- `music/agent/AGENTS.md` - the same contract, at a stable URL agents can fetch when
  they DO have network.
- `music/agent/capabilities.json` - machine-readable, versioned, additive:
  `{ schema:'music-app-capabilities/v1', app, version:<build-stamp>, capabilities:[{id,
  name, desc, surfaces, data_keys, interchange}] }` enumerating what the app can do
  (tuner, jam, compose, repertoire, competency tracking, backup/restore, playlist
  import) and which stored keys each owns. Generated from a checked-in source, not
  hand-drifted (machine-SSOT rule: it ships with a node test asserting every listed
  `data_key` appears in backup.js OWNED_PREFIXES coverage and every interchange schema
  string matches its module constant).

**C. Wiki page.** `engineering-wiki/systems/agent-interchange.md` - the system page
anchoring this contract to source (backup.js, competency.js, skill-md.js, zip-store.js),
per the wiki-first law.

## 6. Degradation ladder (offline/no-server law)

| Level | Transport | Requires | Degrades to |
|---|---|---|---|
| **L0 - file interchange (BASELINE, always works)** | User exports zip/backup -> agent reads folder -> agent writes SKILL.md -> user imports via file picker | Nothing but a file system. Fully offline, any browser, no server | Nothing - this IS the floor, and it ships the whole capability |
| L1 - live folder | User keeps exports in a synced/watched folder (Drive, Syncthing, plain dir); agent re-reads on change; File System Access API could let the APP re-read granted files | Chromium FS-Access for the in-app half; any sync tool for the agent half | L0 (manual export/import) |
| L2 - local bridge | The existing operator bridge/phone-remote family relays exports to an agent session on the LAN | LAN + bridge running | L0 |
| L3 - share target | PWA share-target / Web Share hands the export straight to another app | Android install + share-target manifest work | L0 |

Every level above L0 is a convenience on the SAME artifacts and the SAME validator - no
level introduces a new schema, a new writer, or a server. If a level's requirement is
absent, the feature quietly is not offered (defensive-reader rule), never broken.

## 7. Trust and privacy invariants

- Public repo ships FRAMEWORKS only; levels + evidence exist only in the user's
  localStorage and the user's exported files (competency.js header - standing law).
- Agent output is untrusted input: the import path validates shape, resolves skills
  against known frameworks, and merges - it never eval()s, never writes arbitrary keys.
- Backup-before-import stays the recommended flow (existing Settings nudge covers it).
- Provenance is append-only history: every agent touch is attributable in the doc.
- Restore of a whole backup envelope remains a USER action on the app's own export -
  agents are told (bundled AGENTS.md) not to fabricate envelopes.

## 8. Implementation missions (atomic, swarmable after operator gate)

| # | Mission | Size | Notes |
|---|---|---|---|
| A1 | Bundled `AGENTS.md` in the skills zip export (zip-store.js gains one static text entry; content authored from section 5A) | S | Pure additive; node test asserts the zip contains it and its schema strings match module constants |
| A2 | `music/agent/capabilities.json` + `music/agent/AGENTS.md` + SW precache + the manifest-consistency node test | S-M | Machine-SSOT gate ships in the same PR |
| A3 | Wiki page `systems/agent-interchange.md` | S | Anchors this contract; wiki-sync rule |
| A4 | Agent round-trip node test: author a profile doc as an agent would (provenance append, evidence bump), run importProfile, assert merge semantics + rejection of malformed docs | S | The executable form of section 4 |
| A5 | Settings copy: import result surfaces provenance ("includes updates from agent:claude-code") | S | copy-coach pass |
| A6 (later) | L1 File System Access re-read; L3 share-target | M | Only after L0 proves out in use |
| A7 | `?jam=` deep-link contract (section 4b): parse -> ephemeral jam setup -> Save via existing forms; node tests for the parser, PW scenario for the flow | M | Touches play shell + sw CORE -> cache bump; canonical-sharp + keyless laws enforced in tests |
| A8 | `music-setup/v1` setup-doc import (batch fallback for A7 payloads) | S-M | Same one-validator discipline; additive schema |
| A9 | Plugin packaging (section 4c): coach skills + AGENTS.md + capabilities.json + `/music:assess` `/music:practice-plan` `/music:jam` commands as an installable plugin | M | Depends on A1+A2 (the artifacts it bundles) + A7 (the setup transport it emits) |

A1+A2+A4 are one clean PR; A3+A5 a second; A7 its own PR (app-shell change, PW scenario,
cache bump); A8+A9 follow once A7's transport exists. No SW `CORE` file changes in
A1/A3/A4/A5 (no cache bump); A2 and A7 touch sw.js/CORE so each carries the
`music-v<PR#>` bump per convention.

## 9. What this deliberately is NOT

- Not an in-app LLM: the app stays deterministic (M-0 law). Agents live OUTSIDE, on files.
- Not a sync service, account system, or API server - ever, at any ladder level.
- Not a second competency store: Cowork/CC-side skill files are RENDERS of the app's
  SSOT, produced and consumed through the one validator.
