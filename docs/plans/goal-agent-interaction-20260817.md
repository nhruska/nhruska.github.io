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

A1+A2+A4 are one clean PR; A3+A5 a second. No SW `CORE` file changes in A1/A3/A4/A5
(no cache bump); A2 touches sw.js so it carries the `music-v<PR#>` bump per convention.

## 9. What this deliberately is NOT

- Not an in-app LLM: the app stays deterministic (M-0 law). Agents live OUTSIDE, on files.
- Not a sync service, account system, or API server - ever, at any ladder level.
- Not a second competency store: Cowork/CC-side skill files are RENDERS of the app's
  SSOT, produced and consumed through the one validator.
