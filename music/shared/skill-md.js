/* =====================================================================
 * skill-md.js  -  render a skill-competency-profile/v1 document as an
 * open-skills-format SKILL.md file, and parse one back. The JSON document
 * (competency.js) stays the
 * INTERNAL machine SSOT (localStorage `music.competency.v1`); SKILL.md is
 * the INTERCHANGE render - human/agent-readable, one per skill, bundled
 * as `<skill-id>/SKILL.md` inside the zip export (zip-store.js).
 * ---------------------------------------------------------------------
 * Round-trip contract (the "flexible import" answer): the rendered file
 * embeds the EXACT v1 JSON document in a fenced ```json block under
 * "## Profile data". parse() extracts that block, so import is LOSSLESS
 * and never depends on re-parsing the human-facing table. The frontmatter
 * + table are presentation; the fenced block is the data.
 *
 * Frontmatter shape (open skills format): `name` + `description`, the two
 * fields every SKILL.md consumer expects. The skill id travels inside the
 * JSON document (`skill`), not the frontmatter - filenames and folder
 * names are hints, never the contract.
 *
 * Pure + dependency-free (competency.js discipline): no DOM, no storage.
 * Exposes window.SkillMd and require()-able in Node (test/skill-md.test.js).
 * music/sw.js CORE must precache this file.
 * ===================================================================== */
(function (root) {
  'use strict';

  var FENCE_OPEN = '```json';
  var FENCE_CLOSE = '```';

  // Render a v1 profile document (object or its JSON string) as SKILL.md
  // text. Returns null on anything that is not a plausible v1 doc - the
  // caller (songbook.js's export path) treats null as "nothing to export".
  function render(doc) {
    if (typeof doc === 'string') {
      try { doc = JSON.parse(doc); } catch (e) { return null; }
    }
    if (!doc || typeof doc !== 'object' || !doc.skill) return null;
    var name = String(doc.name || doc.skill);
    var comps = Array.isArray(doc.competencies) ? doc.competencies : [];
    var lines = [];
    lines.push('---');
    lines.push('name: ' + name);
    lines.push('description: ' + String(doc.desc || ('Portable ' + name + ' competency profile (skill-competency-profile/v1) exported from the Music app.')));
    lines.push('---');
    lines.push('');
    lines.push('# ' + name + ' - competency profile');
    lines.push('');
    lines.push('Schema: `' + String(doc.schema || '') + '` | Discipline: ' + String(doc.discipline || '') + ' | Updated: ' + String(doc.updated || ''));
    lines.push('');
    lines.push('| Competency | Level | Target | Evidence | Last evidence |');
    lines.push('|---|---|---|---|---|');
    comps.forEach(function (c) {
      lines.push('| ' + mdCell(c.name || c.id) + ' | ' + num(c.level) + ' | ' + num(c.target)
        + ' | ' + num(c.evidence_count) + ' | ' + mdCell(c.last_evidence || '-') + ' |');
    });
    if (Array.isArray(doc.preferences) && doc.preferences.length) {
      lines.push('');
      lines.push('## Preferences');
      lines.push('');
      doc.preferences.forEach(function (p) {
        lines.push('- ' + mdCell(p.statement || p.id) + (p.evidence_count ? ' (' + num(p.evidence_count) + 'x)' : ''));
      });
    }
    lines.push('');
    lines.push('## Profile data');
    lines.push('');
    lines.push('The block below is the exact portable document - import reads THIS, not the table above.');
    lines.push('');
    lines.push(FENCE_OPEN);
    lines.push(JSON.stringify(doc, null, 2));
    lines.push(FENCE_CLOSE);
    lines.push('');
    return lines.join('\n');
  }

  // Extract the embedded v1 JSON document from a SKILL.md text.
  // -> { ok:true, doc } | { ok:false, reason }. Validation beyond "is the
  // embedded block valid JSON" stays in competency.js's importProfile -
  // ONE validator, never two drifting copies.
  function parse(md) {
    if (typeof md !== 'string' || !md.length) return { ok: false, reason: 'empty file' };
    var open = md.indexOf(FENCE_OPEN);
    if (open < 0) return { ok: false, reason: 'no embedded profile data block (```json) found' };
    var start = open + FENCE_OPEN.length;
    var close = md.indexOf(FENCE_CLOSE, start);
    if (close < 0) return { ok: false, reason: 'profile data block never closes' };
    var body = md.slice(start, close);
    try { return { ok: true, doc: JSON.parse(body) }; }
    catch (e) { return { ok: false, reason: 'embedded profile data is not valid JSON' }; }
  }

  // `<skill-id>/SKILL.md` - the bundle path for one skill (open skills
  // folder convention). Slashes/backslashes in an id are flattened
  // defensively; framework ids are kebab-case so this is a no-op today.
  function bundlePath(skillId) {
    return String(skillId).replace(/[\\/]+/g, '-') + '/SKILL.md';
  }

  function mdCell(v) { return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }
  function num(v) { return String(typeof v === 'number' ? v : (v || 0)); }

  var API = { render: render, parse: parse, bundlePath: bundlePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SkillMd = API;

})(typeof window !== 'undefined' ? window : this);
