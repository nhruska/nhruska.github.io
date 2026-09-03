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
  var BACKUP_APP = 'music';
  var FENCE_TAG = '```'; // deliberately untagged - see header note

  function text() {
    var L = [];
    L.push('# Music app - agent instructions');
    L.push('');
    L.push('You are reading a folder exported from a static, offline, server-free web app.');
    L.push('Everything you need to orient is in this bundle. No app code, network, or');
    L.push('account is required to read or propose updates.');
    L.push('');
    L.push('## What these files are');
    L.push('');
    L.push('- **`<skill-id>/SKILL.md`** (this bundle) - one open-skills-format file per');
    L.push('  skill. The human-readable table is presentation; the fenced ' + COMPETENCY_SCHEMA);
    L.push('  block under "## Profile data" is the exact interchange doc - read/write THAT,');
    L.push('  never the table.');
    L.push('- **Backup envelope** `music-songbook-<date>.json` (included in this bundle when exported from Settings; may be absent from a hand-assembled folder)');
    L.push('  - `{ app:"' + BACKUP_APP + '", schema, exportedAt, data:{key:rawString} }`, a byte-faithful');
    L.push('  snapshot of every owned localStorage key. It is the FULL profile: repertoire,');
    L.push('  setlists, progressions, preferences, skill progress. Values in `data` are raw');
    L.push('  strings - JSON.parse each key you need.');
    L.push('- **`capabilities.json`** (this bundle; also served at `music/agent/capabilities.json`)');
    L.push('  - the app\'s capability manifest as data: every capability\'s surfaces, owned');
    L.push('  localStorage keys, and interchange contract. Read it to know what the app can');
    L.push('  do without reading app code or touching the network.');
    L.push('- **Profile doc** `' + COMPETENCY_SCHEMA + '` - the schema embedded in each SKILL.md:');
    L.push('  ' + FENCE_TAG);
    L.push('  { schema, skill, discipline:"music", updated,');
    L.push('    provenance:[{source, at}],');
    L.push('    competencies:[{id, name, desc, level, target, evidence_count, last_evidence}],');
    L.push('    preferences?:[{id, statement, evidence_count, last_evidence}] }');
    L.push('  ' + FENCE_TAG);
    L.push('');
    L.push('## What you MAY do');
    L.push('');
    L.push('- Read everything: grade competency levels vs targets, note evidence staleness,');
    L.push('  read repertoire/progressions/preferences, and coach from what the levels say');
    L.push('  the user can already do.');
    L.push('- Propose profile updates by editing/authoring a ' + COMPETENCY_SCHEMA + ' doc (see');
    L.push('  rules below), saved as `<skill-id>/SKILL.md` for the user to import.');
    L.push('- Emit a one-tap jam setup as a deep link: `music/play/?jam=<chords>&key=<tonic>');
    L.push('  &yt=<videoId>&name=<label>`. `jam` is comma-separated canonical-sharp chord');
    L.push('  tokens (e.g. `jam=Am,F,C,G`) - percent-encode every `#` (`F#m` -> `F%23m`;');
    L.push('  a raw # truncates the URL and can load a VALID but WRONG jam - decode your');
    L.push('  final URL and confirm every chord survived); `key` is a tonic name plus optional `m` for');
    L.push('  minor (e.g. `key=Am`); `yt` is an 11-char YouTube video id or a watch/');
    L.push('  youtu.be URL; `name` labels the Save form. All four are optional. The link');
    L.push('  opens an EPHEMERAL jam - nothing is written until the user taps Save.');
    L.push('');
    L.push('## What you MUST NOT do');
    L.push('');
    L.push('- Never fabricate or hand back a modified backup envelope for restore - restore');
    L.push('  is byte-faithful and would bypass validation entirely.');
    L.push('- Never rewrite or delete an existing `provenance` entry - append only.');
    L.push('- Never bump a competency `level` without an evidence delta (`evidence_count`');
    L.push('  incremented, `last_evidence` set to a short human-readable reason).');
    L.push('- Never invent a YouTube id/key for a suggested track - state the key or omit');
    L.push('  the track; the app never invents one either.');
    L.push('- Never pre-respell chord names - chord tokens stay canonical-sharp; display');
    L.push('  respelling is the app\'s job.');
    L.push('');
    L.push('## Rules for a proposed profile doc');
    L.push('');
    L.push('1. Append a provenance entry: `{ source: "agent:<your-tool-name>", at: "<ISO>" }`.');
    L.push('2. Any level change carries evidence: bump `evidence_count`, set `last_evidence`.');
    L.push('3. Unknown competency ids may ride along (additive-tolerant); the app only');
    L.push('   grades ids its shipped frameworks know.');
    L.push('4. `preferences[]` is the additive slot for taste statements you learn.');
    L.push('5. You are one evidence SOURCE, not an override channel - the app\'s own merge');
    L.push('   (`Competency.importProfile` / `mergeInto`) decides what actually lands.');
    L.push('');
    L.push('## Hand-back procedure');
    L.push('');
    L.push('Save your proposed doc as `<skill-id>/SKILL.md` (render it in the same shape as');
    L.push('the file you read - frontmatter + table + the fenced JSON block) and tell the');
    L.push('user: import it from Settings -> Skills in the app, on any device, offline.');
    L.push('');
    L.push('The SAME hand-back covers all three update cases - there is no separate');
    L.push('procedure for any of them:');
    L.push('');
    L.push('1. **One competency moved.** A practice session raised (or lowered) a level.');
    L.push('   Change that entry\'s `level`, bump its `evidence_count`, set `last_evidence`.');
    L.push('   Leave every other entry byte-identical.');
    L.push('2. **Porting an outside profile in.** The user already tracks skills elsewhere.');
    L.push('   Map them onto the competency ids you find in the file; anything with no');
    L.push('   equivalent is dropped rather than invented. Keep the schema exactly.');
    L.push('3. **Correcting a fresh install.** The profile is at defaults and a conversation');
    L.push('   established the real levels. Set them, and record where they came from in');
    L.push('   `provenance` so the next agent knows they were self-reported, not measured.');
    L.push('');
    L.push('In every case the import MERGES - it adds and overwrites, never deletes - so a');
    L.push('partial doc is safe. Do not pad a file with entries you did not actually assess.');
    L.push('');
    L.push('## Privacy');
    L.push('');
    L.push('This app\'s repo is public and ships frameworks only - no personal data. The');
    L.push('files in front of you ARE the user\'s personal data; keep them on-device/local');
    L.push('and never publish, upload, or commit them anywhere.');
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
    L.push('- `AGENTS.md` - how to read these files and what to hand back');
    L.push('- `capabilities.json` - what the app can do, as data');
    L.push('- `<skill-id>/SKILL.md` - one file per skill. The fenced ' + COMPETENCY_SCHEMA);
    L.push('  block under "## Profile data" is the interchange doc - read and write THAT,');
    L.push('  never the human-readable table above it.');
    L.push('- `music-songbook-<date>.json` - the user\'s full app data (repertoire, setlists,');
    L.push('  progressions, preferences, skill progress). Present when exported from');
    L.push('  Settings; absent from a hand-assembled folder.');
    L.push('');
    L.push('## What to hand back');
    L.push('');
    L.push('An updated `<skill-id>/SKILL.md` in the same shape you received. The user imports');
    L.push('it from the app\'s Settings, offline, on any device. See "Hand-back procedure" in');
    L.push('`AGENTS.md` for the three cases this covers.');
    L.push('');
    L.push('## Privacy');
    L.push('');
    L.push('These files ARE the user\'s personal data. Keep them local - never publish,');
    L.push('upload, or commit them anywhere.');
    return L.join('\n');
  }

  var API = {
    COMPETENCY_SCHEMA: COMPETENCY_SCHEMA,
    BACKUP_APP: BACKUP_APP,
    text: text,
    readme: readme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.AgentReadme = API;

})(typeof window !== 'undefined' ? window : this);
