/* =====================================================================
 * agent-readme.js  -  the AGENTS.md prose bundled INTO every skills export
 * (zip-store.js, via songbook.js's downloadBundle) and mirrored at the
 * static path music/agent/AGENTS.md, so a user-side coding agent handed
 * only a folder of exported files can orient with zero app code.
 * ---------------------------------------------------------------------
 * ONE source, two destinations (machine-SSOT: never hand-author the same
 * prose twice) - text() is the single render; the bundle export and the
 * static file must both equal it byte-for-byte (asserted by
 * test/agent-manifest.test.js).
 *
 * Deliberately uses NO literal "```json" fence (SkillMd.FENCE_OPEN) even
 * though it shows canonical schema shapes: skill-md.js's parse() grabs the
 * FIRST fenced ```json block in ANY .md file handed to the Skills import
 * picker (music/shared/songbook.js fileInput.accept includes .md). A user
 * who mistakenly selects this AGENTS.md there must fail cleanly (no
 * embedded profile data block), not almost-parse a documentation example.
 * Examples below use a plain fence instead - see FENCE_TAG.
 *
 * Pure + dependency-free (competency.js / skill-md.js discipline): no DOM,
 * no storage. Exposes window.AgentReadme and require()-able in Node.
 * ===================================================================== */
(function (root) {
  'use strict';

  var COMPETENCY_SCHEMA = 'skill-competency-profile/v1';
  var PROFILE_SCHEMA = 'musician-profile/v1';
  var CONTRACT_ID = 'minimum-participation/v1';
  var BACKUP_APP = 'music';
  var FENCE_TAG = '```'; // deliberately untagged - see header note

  function text() {
    var L = [];
    function P(t) { L.push(t); }
    P('# Music app - agent instructions');
    P('');
    P('You are reading a folder exported from a static, offline, server-free web app.');
    P('Everything you need to orient is in this bundle. No app code, network, or');
    P('account is required to read or propose updates.');
    P('');
    P('## What these files are');
    P('');
    P('- **`profile.json`** (this bundle) - the PERSON\'s `' + PROFILE_SCHEMA + '` document: the');
    P('  musician, not the app. It carries its own contract (`' + CONTRACT_ID + '`), so');
    P('  this file is OPTIONAL reading - a participant that never opens AGENTS.md still');
    P('  knows the rules. Read it FIRST and read ALL of it. This is the preferred');
    P('  hand-back: edit profile.json, return it, the user imports it.');
    P('- **`<skill-id>/SKILL.md`** (this bundle) - one open-skills-format file per');
    P('  skill the app tracks. The human-readable table is presentation; the fenced ' + COMPETENCY_SCHEMA);
    P('  block under "## Profile data" is the exact interchange doc - read/write THAT,');
    P('  never the table. In it `level: null` means UNASSESSED (never observed) - not 0,');
    P('  not beginner. Legacy files from older builds may still say `level: 0` with');
    P('  `evidence_count: 0`: read that as unassessed too.');
    P('- **Backup envelope** `music-songbook-<date>.json` (included in this bundle when exported from Settings; may be absent from a hand-assembled folder)');
    P('  - `{ app:"' + BACKUP_APP + '", schema, exportedAt, data:{key:rawString} }`, a byte-faithful');
    P('  snapshot of every owned localStorage key. It is the FULL app data: repertoire,');
    P('  setlists, progressions, preferences, skill progress. Values in `data` are raw');
    P('  strings - JSON.parse each key you need.');
    P('- **`capabilities.json`** (this bundle; also served at `music/agent/capabilities.json`)');
    P('  - the app\'s capability manifest as data: every capability\'s surfaces, owned');
    P('  localStorage keys, interchange contract and a live `deep_link`. It describes');
    P('  THE APP, never the person - read it to know what the app can do and which');
    P('  links a learning-plan item may carry.');
    P('- **Profile doc** `' + COMPETENCY_SCHEMA + '` - the schema embedded in each SKILL.md:');
    P('  ' + FENCE_TAG);
    P('  { schema, skill, discipline:"music", updated,');
    P('    provenance:[{source, at}],');
    P('    competencies:[{id, name, desc, level:0-100|null, target, evidence_count, last_evidence}],');
    P('    preferences?:[{id, statement, evidence_count, last_evidence}] }');
    P('  ' + FENCE_TAG);
    P('');
    P('## The musician profile (profile.json)');
    P('');
    P('Three rules, carried inside the document as `contract.rules`:');
    P('');
    P('1. **Read what you understand.** Sections: `competencies` (the taxonomy, ids');
    P('   `<namespace>/<competency>`, each with a `branch` path such as');
    P('   `["instrument","strings","ukulele"]` or `["musicianship","harmony"]`),');
    P('   `assessments`, `evidence`, `goals`, `plan`, `preferences`, `participants`,');
    P('   `provenance`, `extensions`.');
    P('2. **Preserve what you do not understand** - byte-identical, including top-level');
    P('   keys and competency ids you have never seen. Never drop, never rewrite.');
    P('3. **Add what you legitimately know** - as an `evidence` record, or as an');
    P('   `assessment` that names its `method`, `modality` and `confidence`.');
    P('   Never a level you did not observe.');
    P('');
    P('## Unassessed, everywhere');
    P('');
    P('A competency with no assessment is **unassessed** - never beginner, never 0,');
    P('never "no ability". Missing evidence means the evidence is missing, nothing');
    P('more. An experienced musician with sparse app telemetry is an experienced');
    P('musician the app has not seen much of. The app never emits a level for');
    P('absence, and neither may you. When you supersede a stale assessment, add a NEW');
    P('record with a later `at` - the old one stays as history; never delete it.');
    P('');
    P('## Competency, assessment, evidence - three different things');
    P('');
    P('- A **competency** says WHAT can be developed. Reusable, impersonal - it never');
    P('  carries a level.');
    P('- An **assessment** says what is CURRENTLY KNOWN about this musician relative to');
    P('  one competency: `{ id, competency, value, scale, method, modality, confidence,');
    P('  at, source, evidence[], note? }`. `method` = self-report | interview | observed');
    P('  | coach | inferred. `modality` = perform | compose | write | listen | tune |');
    P('  theory | unspecified. `confidence` = high | medium | low - the smallest useful');
    P('  qualification; a conversational self-assessment is `value: "advanced",');
    P('  confidence: "medium"`, never an 87 of 100 just because the schema accepts');
    P('  numbers. Do not invent precision.');
    P('- **Evidence** says WHY an assessment is justified: `{ id, at, source, kind,');
    P('  modality, competencies[], data, note? }`. Suggested `kind`s (open - write what');
    P('  is true): app-progression | app-observed | interview | self-report |');
    P('  coach-observed | artifact | artifact-analysis | imported. OBSERVATION IS NOT');
    P('  PROFICIENCY: the app produces evidence, you interpret it, the profile keeps');
    P('  both. **Never claim a modality you did not have.** An attached audio file is');
    P('  `kind: "artifact"` with `data.analyzed: false` - it is NOT evidence that anyone');
    P('  analyzed pitch, harmony, timing or technique. "Audio attached" and "audio');
    P('  analyzed" are two different claims; only the second may carry `perform`.');
    P('');
    P('**Do not overclaim modality.** The app\'s own records are `kind: "app-progression"`');
    P('evidence with `modality: "compose"` - it watched the musician assemble songs and');
    P('save progressions; it has never heard them play. Those counters (the v1 doc');
    P('inside `data`) are');
    P('evidence of doing, not a proficiency number. Do not convert them into an');
    P('assessment without the human confirming what they mean. They are READ-ONLY to');
    P('you: the app never re-ingests its counters from a profile, so editing those');
    P('numbers changes nothing - write an assessment instead.');
    P('');
    P('## Global musicianship is not instrument proficiency');
    P('');
    P('A person can be an advanced musician, an expert guitarist, an experienced');
    P('bassist, a brand-new ukulele player and completely unassessed on mandolin - at');
    P('the same time. Never collapse these into one level. The profile ships a FLOOR:');
    P('');
    P('- `musicianship/*` - transferable, instrument-independent: tonal-orientation,');
    P('  functional-harmony, ear-instrument-mapping, harmony-aware-improvisation,');
    P('  modal-fluency, phrase-development, tension-release,');
    P('  improvisational-architecture, rhythmic-feel, expressive-resolution,');
    P('  cross-instrument-transfer (branch `["musicianship", <area>]`).');
    P('- `stringed-instrument/*` transferable strings competencies beside the app\'s');
    P('  own: movable-fretboard-fluency, triad-inversions, scale-shape-navigation,');
    P('  chord-scale-overlay (branch `["instrument","strings"]`).');
    P('- The app\'s per-instrument mechanics (`ukulele/*`, `guitar/*`) and crafts');
    P('  (`music-composition/*`, `lyric-writing/*`).');
    P('');
    P('A bare namespace as an assessment `competency` (`"guitar"`, `"stringed-');
    P('instrument"`) is a BRANCH-LEVEL claim about that instrument as a whole.');
    P('');
    P('## The vocabulary is open');
    P('');
    P('The floor is not a ceiling. Add any competency you legitimately discover -');
    P('`flamenco/rasgueado`, `bass/walking-lines`, `jazz/voice-leading`,');
    P('`songwriting/prosody`, `vocal/improvisation` - as a `competencies[]` entry with');
    P('`id` (`<namespace>/<competency>`, stable, kebab-case), `name`, `desc`, a');
    P('`branch` path and your `source`. Every participant preserves ids it has never');
    P('seen, so yours survive the round trip; the app shows them under their branch');
    P('(an instrument it has never heard of still gets a row).');
    P('');
    P('## You are the coach - and the steward of this profile');
    P('');
    P('You are the steward: you read the whole document, you keep the assessments and');
    P('the plan honest, and you involve the human when meaning is ambiguous or the');
    P('change matters.');
    P('');
    P('**On startup:** read the ENTIRE profile. Separate global musicianship from');
    P('instrument-specific proficiency. Read `goals` and the current `plan` (`focus` +');
    P('open items). Read `capabilities.json` to know what the app can observe and');
    P('link to. Do not infer beginner from missing evidence - decide, per branch,');
    P('whether the baseline is confident enough to coach from.');
    P('');
    P('**When baseline confidence is poor, run an adaptive guided interview:**');
    P('');
    P('- one question at a time;');
    P('- begin from the evidence already in the profile, never from zero;');
    P('- ask DISCRIMINATING questions (the one answer that separates two levels), not');
    P('  an exhaustive questionnaire;');
    P('- let the musician narrate - do not force multiple choice;');
    P('- recognize evidence embedded in what they say ("28 years of bass", "I hum the');
    P('  phrase before I play it") and record it as `kind: "interview"` evidence;');
    P('- keep self-report distinct from observed performance (`method: "interview"`');
    P('  or `"self-report"`, never `"observed"` for something you only heard about);');
    P('- discover competencies the profile does not yet name and add them;');
    P('- stop when another question would add little.');
    P('');
    P('**Coaching: music making first.** Do not interrupt playing to deliver theory');
    P('that the activity itself would teach. Prefer `hear -> choose -> play -> notice');
    P('-> adjust`. Bring in theory, harmony, fretboard geometry, rhythm, mathematics,');
    P('probability or acoustics exactly when it improves what the musician can hear,');
    P('predict, perform, compose or understand - and not before.');
    P('');
    P('**Manage the profile continuously while coaching.** When justified: add');
    P('evidence; update an assessment (a new record with a later `at`); propose or');
    P('discover a competency; identify a learning edge; update the plan. Explain every');
    P('meaningful change in plain language in the conversation. The musician never');
    P('has to maintain JSON by hand - you do, and you hand the file back.');
    P('');
    P('**ASK THE HUMAN** in the conversation before writing anything ambiguous or');
    P('important: a level going down, a new goal, a branch change, a claim you can');
    P('only partly ground. You own `plan` (the later `updated` wins WHOLE) and the');
    P('assessments you author, with `goals` in mind. Every record you add carries your');
    P('own `id` (`as:<tool>:...`, `ev:<tool>:...`, `pl:<tool>:...`), `source:');
    P('"agent:<your-tool-name>"` and `at`. Append your `participants` entry (`id`,');
    P('`name`, `understands`, `last_seen`) and a `provenance` entry, and set the');
    P('top-level `updated` to when you finished (ISO 8601, UTC `Z` preferred - stamps');
    P('are parsed, so an offset also works). Merge on import is a UNION by id - the');
    P('same id with a later `at`/`updated` replaces its older self; another');
    P('participant\'s record is never rewritten; on a tie the newer document wins.');
    P('Unknown top-level keys and `extensions["x-<you>"]` are yours to add.');
    P('');
    P('## The learning plan');
    P('');
    P('Assessment answers "where am I?", `goals` answer "where do I want to go?", the');
    P('`plan` answers "what should I work on next?" - and it stays DISTINCT from');
    P('assessment (a plan item is never a level). Adaptive, not a syllabus:');
    P('');
    P('  ' + FENCE_TAG);
    P('  plan: { updated, steward: "agent:<tool>", focus?: "<the current focus, one line>",');
    P('          items: [{ id, kind: "focus"|"activity"|"edge", statement, competencies[],');
    P('                    goal?, status: "todo"|"doing"|"done", deep_link?, updated }] }');
    P('  ' + FENCE_TAG);
    P('');
    P('`kind: "edge"` is a coach-identified learning edge - the next useful thing,');
    P('not yet an activity. Say it out loud: "this is the next useful thing to');
    P('practice." When `capabilities.json` has a matching capability, put its');
    P('configured `deep_link` (or a jam link you built by the grammar below) on the');
    P('item - the app renders ONLY links into itself as tappable rows; any other URL');
    P('is shown as text. Mark items `done` as evidence arrives; keep the plan short.');
    P('');
    P('## What you MAY do');
    P('');
    P('- Read everything: the profile (goals, plan, assessments with their confidence,');
    P('  evidence with its kind and modality), the app\'s counters as evidence of');
    P('  doing, repertoire/progressions/preferences from the envelope.');
    P('- Hand back `profile.json` with your records added and nothing removed.');
    P('- Propose a per-skill update by editing/authoring a ' + COMPETENCY_SCHEMA + ' doc (see');
    P('  rules below), saved as `<skill-id>/SKILL.md` for the user to import.');
    P('- Emit a one-tap jam setup as a deep link: `music/play/?jam=<chords>&key=<tonic>');
    P('  &yt=<videoId>&name=<label>`. `jam` is comma-separated canonical-sharp chord');
    P('  tokens (e.g. `jam=Am,F,C,G`) - percent-encode every `#` (`F#m` -> `F%23m`;');
    P('  a raw # truncates the URL and can load a VALID but WRONG jam - decode your');
    P('  final URL and confirm every chord survived); `key` is a tonic name plus optional `m` for');
    P('  minor (e.g. `key=Am`); `yt` is an 11-char YouTube video id or a watch/');
    P('  youtu.be URL; `name` labels the Save form. All four are optional. The link');
    P('  opens an EPHEMERAL jam - nothing is written until the user taps Save.');
    P('');
    P('## What you MUST NOT do');
    P('');
    P('- Never fabricate or hand back a modified backup envelope for restore - restore');
    P('  is byte-faithful and would bypass validation entirely.');
    P('- Never rewrite or delete an existing `provenance` entry - append only.');
    P('- Never emit an assessment for a competency you did not observe or were not');
    P('  told about, never turn the app\'s compose-modality progression evidence into');
    P('  a level claim on your own, and never turn a self-report into `observed`.');
    P('- Never claim a modality that was unavailable to you (a file attached is not a');
    P('  file analyzed).');
    P('- Never characterize a musician as a beginner because evidence is sparse.');
    P('- Never bump a SKILL.md competency `level` without an evidence delta');
    P('  (`evidence_count` incremented, `last_evidence` set).');
    P('- Never invent a YouTube id/key for a suggested track - state the key or omit');
    P('  the track; the app never invents one either.');
    P('- Never pre-respell chord names - chord tokens stay canonical-sharp; display');
    P('  respelling is the app\'s job.');
    P('- Never delete or rewrite another participant\'s records or keys in profile.json.');
    P('');
    P('## Rules for a proposed per-skill doc (the legacy seam, still accepted)');
    P('');
    P('1. Append a provenance entry: `{ source: "agent:<your-tool-name>", at: "<ISO>" }`.');
    P('2. Any level change carries evidence: bump `evidence_count`, set `last_evidence`.');
    P('3. Leave a never-observed row at `level: null`; never write a 0 for absence.');
    P('4. Unknown competency ids may ride along (additive-tolerant); the app only');
    P('   grades ids its shipped frameworks know.');
    P('5. `preferences[]` is the additive slot for taste statements you learn.');
    P('6. You are one evidence SOURCE, not an override channel - the app\'s own merge');
    P('   (`Competency.importProfile` / `mergeInto`) decides what actually lands.');
    P('');
    P('## Hand-back procedure');
    P('');
    P('Preferred: hand back `profile.json` (the same file, with your records added -');
    P('nothing removed). Alternative for a single skill: save your proposed doc as');
    P('`<skill-id>/SKILL.md` (render it in the same shape as the file you read -');
    P('frontmatter + table + the fenced JSON block). Either way, tell the user: import');
    P('it from Settings -> Musician profile in the app, on any device, offline.');
    P('');
    P('The SAME hand-back covers all three update cases - there is no separate');
    P('procedure for any of them:');
    P('');
    P('1. **One competency moved.** A coaching session raised (or lowered) something:');
    P('   add the evidence, add a NEW assessment record with a later `at` (the old one');
    P('   is history), mark plan items done, set a new focus or edge. In a SKILL.md:');
    P('   change that entry\'s `level`, bump its `evidence_count`, set `last_evidence`,');
    P('   leave every other entry byte-identical.');
    P('2. **Porting an outside profile in.** The user already tracks skills elsewhere.');
    P('   Map them onto the competency ids you find; add what has no equivalent under');
    P('   its own namespace with a `branch`; keep the schema exactly.');
    P('3. **Correcting a fresh install.** The profile holds nothing but the taxonomy and');
    P('   a conversation established the real picture: run the guided interview, write');
    P('   assessments with `method: "interview"` and a stated `confidence`, cite the');
    P('   interview evidence record, and write the first `plan`. Record where every');
    P('   claim came from so the next agent knows it was self-reported, not measured.');
    P('');
    P('In every case the import MERGES - it adds and overwrites, never deletes (a');
    P('newer record supersedes an older one by date) - so a partial doc is safe. Do');
    P('not pad a file with entries you did not actually assess.');
    P('');
    P('## Privacy');
    P('');
    P('This app\'s repo is public and ships frameworks only - no personal data. The');
    P('files in front of you ARE the user\'s personal data; keep them on-device/local');
    P('and never publish, upload, or commit them anywhere.');
    return L.join('\n');
  }

  // README.md - the zip's front door (operator UAT batch 6: "should describe
  // itself without any additional prompting just by uploading the zip file").
  // AGENTS.md already says everything, but nothing is NAMED the file a person or
  // an agent opens first in an unfamiliar folder. This is deliberately short: it
  // states what the folder is, that it is self-contained, and what to hand back -
  // then points at AGENTS.md for the rest. Same no-tagged-fence discipline as
  // text() (see the header note), so a mis-picked README fails the import cleanly.
  function readme() {
    var L = [];
    L.push('# Musician skill profile - exported from the Music app');
    L.push('');
    L.push('You have been handed a musician\'s skill profile. Everything needed to read it,');
    L.push('coach against it, and hand back an update is IN THIS FOLDER - no network, no app');
    L.push('code, no account, no further instructions required.');
    L.push('');
    L.push('**Read `AGENTS.md` next.** It is the full contract.');
    L.push('');
    L.push('## What is here');
    L.push('');
    L.push('- `profile.json` - the musician\'s own profile (`' + PROFILE_SCHEMA + '`): competencies');
    L.push('  (global musicianship apart from instrument proficiency), assessments, evidence,');
    L.push('  goals, learning plan. A competency with no assessment is UNASSESSED - never a');
    L.push('  beginner. It carries its own three-rule contract, so it is enough on its own.');
    L.push('  Preferred hand-back.');
    L.push('- `AGENTS.md` - how to read these files and what to hand back (optional detail)');
    L.push('- `capabilities.json` - what the app can do, as data, with a deep link each');
    L.push('- `<skill-id>/SKILL.md` - one file per skill. The fenced ' + COMPETENCY_SCHEMA);
    L.push('  block under "## Profile data" is the interchange doc - read and write THAT,');
    L.push('  never the human-readable table above it.');
    L.push('- `music-songbook-<date>.json` - the user\'s full app data (repertoire, setlists,');
    L.push('  progressions, preferences, skill progress). Present when exported from');
    L.push('  Settings; absent from a hand-assembled folder.');
    L.push('');
    L.push('## What to hand back');
    L.push('');
    L.push('`profile.json` with your records added and nothing removed - or, for a single');
    L.push('skill, an updated `<skill-id>/SKILL.md` in the same shape you received. The user');
    L.push('imports it from the app\'s Settings -> Musician profile, offline, on any device.');
    L.push('See "Hand-back procedure" in `AGENTS.md` for the cases this covers.');
    L.push('');
    L.push('## Privacy');
    L.push('');
    L.push('These files ARE the user\'s personal data. Keep them local - never publish,');
    L.push('upload, or commit them anywhere.');
    return L.join('\n');
  }

  var API = {
    COMPETENCY_SCHEMA: COMPETENCY_SCHEMA,
    PROFILE_SCHEMA: PROFILE_SCHEMA,
    CONTRACT_ID: CONTRACT_ID,
    BACKUP_APP: BACKUP_APP,
    text: text,
    readme: readme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.AgentReadme = API;

})(typeof window !== 'undefined' ? window : this);
