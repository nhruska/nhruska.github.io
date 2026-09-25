/* =====================================================================
 * skills.js  -  PURE skills/competency module for the Math app: an
 * ordered 12-skill path, per-skill progress + stars computed from
 * per-fact stats, earned stars that never drop, 3 bands, and a portable
 * skill-competency-profile/v1 export/import (mirrors music/shared/
 * competency.js's contract, computed instead of nudged by events).
 * ---------------------------------------------------------------------
 * No DOM, no localStorage, no Date.now()/Math.random() - every caller
 * supplies `now` (epoch ms) where time matters. UMD shape matches
 * engine.js: window.MathSkills in the browser, module.exports in Node.
 * Reads facts via MathEngine.pool/normalizeCfg (root.MathEngine ||
 * require('./engine.js')).
 *
 * Contract source: docs/plans/goal-math-app-v1-20260925.md
 * "Locked interface: MathSkills (math/skills.js)".
 *
 * Contract interpretations (spec did not fully pin these down; picked
 * the reading most consistent with the rest of the locked contract):
 *  1. factKeys' "sorted" uses the default JS string (lexicographic)
 *     sort - no numeric comparator was specified, and the per-skill key
 *     sets never mix enough magnitudes for the distinction to matter.
 *  2. progress()'s total===0 case (never reached by any of the 12
 *     shipped skills - every one of them has a non-empty fact pool)
 *     resolves to stars 0 / level 0 rather than the literal formula's
 *     vacuous "solid === total" true, so a degenerate empty skill never
 *     reads as instantly mastered.
 *  3. skillCfg() re-attaches `skill`/`label` onto the object returned by
 *     MathEngine.normalizeCfg explicitly. engine.js's normalizeCfg now
 *     retains both fields itself (its own v1.1 skill/label handling) -
 *     this re-attach is defensive, so skillCfg's skill id/name survive
 *     even if engine.js's own validation (e.g. its skill-id regex) were
 *     ever to reject them.
 *  4. updateEarned() passes through, untouched, any `earned` map entries
 *     whose id is not one of the current 12 SKILLS (forward/backward
 *     compatibility - mirrors competency.js's unknown-id preservation in
 *     mergeInto). Not spelled out by the contract table, but consistent
 *     with the codebase's additive-storage ethos (never drop data you
 *     don't understand).
 *  5. importProfile()'s "earliest masteredAt" treats a null (not yet
 *     mastered) side as "no evidence": it defers to the other side's
 *     real timestamp when only one side has one, and takes the numeric
 *     minimum when both sides do.
 *  6. importProfile()'s numeric-field validation never coerces strings
 *     (a stars/n/ok/... value must already be `typeof === 'number'`) -
 *     mirrors the codebase's general distrust of implicit coercion (see
 *     engine.js's own explicit `typeof === 'number'` guards throughout)
 *     rather than letting `Math.floor("3")` silently accept a string.
 * ===================================================================== */
(function (root) {
  'use strict';

  var ME = (root && root.MathEngine) || require('./engine.js');

  var SCHEMA = 'skill-competency-profile/v1';
  var EXPORT_SOURCE = 'app:math';

  // importProfile() hardening (review finding #7 on PR #355). Fact keys are
  // the literal op char (+, -, x, /) from engine.js's makeFact(), never the
  // display GLYPH - verified against every SKILLS.factKeys() output.
  var FACT_KEY_RE = /^[-+x/]:\d+:\d+$/;
  var FACT_NUMERIC_FIELDS = ['n', 'miss', 'box', 'ms', 'last', 'ok'];
  var MAX_IMPORTED_FACT_KEYS = 5000; // so a 50k-key file can't bloat storage
  var MAX_UNKNOWN_EARNED_IDS = 50; // forward-compat ids (interpretation 4), bounded
  var MAX_PLAYER_LEN = 40; // mirrors engine.js normalizeCfg's label cap

  /* ---------------------------------------------------------------- *
   * SKILLS - the ordered path. ids are the portable contract, verbatim.
   * ---------------------------------------------------------------- */

  var SKILLS = [
    { id: 'add-10', name: 'Addition to 10', short: '+10',
      desc: 'Add two numbers that make 10 or less.',
      cfg: { ops: ['+'], addRange: 10 } },
    { id: 'sub-10', name: 'Subtraction from 10', short: '−10',
      desc: 'Subtract to find what is left, staying under 10.',
      cfg: { ops: ['-'], addRange: 10 } },
    { id: 'add-20', name: 'Addition to 20', short: '+20',
      desc: 'Add two numbers that make up to 20.',
      cfg: { ops: ['+'], addRange: 20 } },
    { id: 'sub-20', name: 'Subtraction to 20', short: '−20',
      desc: 'Subtract numbers up to 20.',
      cfg: { ops: ['-'], addRange: 20 } },
    { id: 'x-2-5-10', name: 'Times 2, 5 and 10', short: '×2 5 10',
      desc: 'Multiply by 2, 5 and 10.',
      cfg: { ops: ['x'], tables: [2, 5, 10], max: 10 } },
    { id: 'x-3-4', name: 'Times 3 and 4', short: '×3 4',
      desc: 'Multiply by 3 and 4.',
      cfg: { ops: ['x'], tables: [3, 4], max: 10 } },
    { id: 'x-6-7', name: 'Times 6 and 7', short: '×6 7',
      desc: 'Multiply by 6 and 7.',
      cfg: { ops: ['x'], tables: [6, 7], max: 10 } },
    { id: 'x-8-9', name: 'Times 8 and 9', short: '×8 9',
      desc: 'Multiply by 8 and 9.',
      cfg: { ops: ['x'], tables: [8, 9], max: 10 } },
    { id: 'div-2-5-10', name: 'Divide by 2, 5 and 10', short: '÷2 5 10',
      desc: 'Divide by 2, 5 and 10.',
      cfg: { ops: ['/'], tables: [2, 5, 10], max: 10 } },
    { id: 'div-3-9', name: 'Divide by 3 to 9', short: '÷3 to 9',
      desc: 'Divide by 3 through 9.',
      cfg: { ops: ['/'], tables: [3, 4, 6, 7, 8, 9], max: 10 } },
    { id: 'x-11-12', name: 'Times 11 and 12', short: '×11 12',
      desc: 'Multiply by 11 and 12.',
      cfg: { ops: ['x'], tables: [11, 12], max: 12 } },
    { id: 'x-all-12', name: 'All times tables to 12', short: '×all',
      desc: 'Multiply any two numbers up to 12.',
      cfg: { ops: ['x'], tables: [], max: 12 } }
  ];

  var SKILLS_BY_ID = {};
  SKILLS.forEach(function (sk) { SKILLS_BY_ID[sk.id] = sk; });

  var FRAMEWORK = { id: 'arithmetic-facts', name: 'Math facts', discipline: 'math', skills: SKILLS };

  /* ---------------------------------------------------------------- *
   * Small generic helpers
   * ---------------------------------------------------------------- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function isPlainObject(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

  function numOr(v, dflt) { return (typeof v === 'number' && !isNaN(v)) ? v : dflt; }

  function medianOf(list) {
    if (!list || !list.length) return null;
    var arr = list.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(arr.length / 2);
    return (arr.length % 2 !== 0) ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function toIso(ms) { return new Date(ms).toISOString(); }

  /* ---------------------------------------------------------------- *
   * skillById / factKeys
   * ---------------------------------------------------------------- */

  function skillById(id) {
    return SKILLS_BY_ID.hasOwnProperty(id) ? SKILLS_BY_ID[id] : null;
  }

  function factKeys(skill) {
    if (!skill) return [];
    var cfg = ME.normalizeCfg(skill.cfg);
    var seen = {}, out = [];
    cfg.ops.forEach(function (op) {
      ME.pool(op, cfg).forEach(function (f) {
        if (!seen[f.key]) { seen[f.key] = true; out.push(f.key); }
      });
    });
    out.sort();
    return out;
  }

  /* ---------------------------------------------------------------- *
   * progress
   * ---------------------------------------------------------------- */

  function progress(skill, stats) {
    stats = isPlainObject(stats) ? stats : {};
    var keys = factKeys(skill);
    var total = keys.length;
    var seen = 0, right = 0, solid = 0, sumMinOk2 = 0;
    var msList = [];

    keys.forEach(function (k) {
      var s = stats[k];
      var n = numOr(s && s.n, 0);
      var ok = numOr(s && s.ok, 0);
      if (ok < 0) ok = 0; // garbage/negative ok reads as 0
      if (n >= 1) seen++;
      if (ok >= 1) right++;
      if (ok >= 2) solid++;
      sumMinOk2 += Math.min(ok, 2);
      if (n >= 1 && typeof s.ms === 'number' && s.ms > 0) msList.push(s.ms);
    });

    var level = total > 0 ? Math.round(100 * sumMinOk2 / (2 * total)) : 0;

    var stars;
    if (total === 0) stars = 0;
    else if (solid === total) stars = 3;
    else if (right === total) stars = 2;
    else if (2 * right >= total) stars = 1;
    else stars = 0;

    return {
      total: total, seen: seen, right: right, solid: solid,
      level: level, stars: stars, mastered: stars === 3,
      medianMs: medianOf(msList)
    };
  }

  /* ---------------------------------------------------------------- *
   * path
   * ---------------------------------------------------------------- */

  function path(stats, earned) {
    stats = isPlainObject(stats) ? stats : {};
    earned = isPlainObject(earned) ? earned : {};

    var masteredCount = 0;
    var upNext = null;

    var skillsOut = SKILLS.map(function (sk) {
      var pr = progress(sk, stats);
      var e = earned[sk.id];
      var earnedStars = (e && typeof e.stars === 'number' && !isNaN(e.stars)) ? e.stars : 0;
      var stars = Math.max(earnedStars, pr.stars);
      var masteredAt = (e && e.masteredAt != null) ? e.masteredAt : null;

      if (stars === 3) masteredCount++;
      if (upNext === null && stars < 3) upNext = sk.id;

      return { skill: sk, progress: pr, stars: stars, masteredAt: masteredAt };
    });

    var band = masteredCount <= 3 ? 'beginner' : (masteredCount <= 8 ? 'intermediate' : 'advanced');

    return { skills: skillsOut, upNext: upNext, masteredCount: masteredCount, band: band };
  }

  /* ---------------------------------------------------------------- *
   * updateEarned
   * ---------------------------------------------------------------- */

  function updateEarned(earned, stats, now) {
    earned = isPlainObject(earned) ? earned : {};
    stats = isPlainObject(stats) ? stats : {};

    var newEarned = {};
    var gains = [];
    var mastered = [];

    SKILLS.forEach(function (sk) {
      var old = earned[sk.id];
      var oldStars = (old && typeof old.stars === 'number' && !isNaN(old.stars)) ? old.stars : 0;
      var oldMasteredAt = (old && old.masteredAt != null) ? old.masteredAt : null;

      var pr = progress(sk, stats);
      var newStars = Math.max(oldStars, pr.stars);
      var newMasteredAt = oldMasteredAt;
      if (newStars === 3 && oldMasteredAt == null) newMasteredAt = now;

      if (newStars > oldStars) gains.push({ id: sk.id, from: oldStars, to: newStars });
      if (newStars === 3 && oldStars < 3) mastered.push(sk.id);

      newEarned[sk.id] = { stars: newStars, masteredAt: newMasteredAt };
    });

    // Forward/backward compat: preserve any entry for a skill id this build
    // doesn't ship, untouched (see interpretation 4 above).
    Object.keys(earned).forEach(function (id) {
      if (newEarned.hasOwnProperty(id)) return;
      var e = earned[id];
      newEarned[id] = {
        stars: (e && typeof e.stars === 'number' && !isNaN(e.stars)) ? e.stars : 0,
        masteredAt: (e && e.masteredAt != null) ? e.masteredAt : null
      };
    });

    return { earned: newEarned, gains: gains, mastered: mastered };
  }

  /* ---------------------------------------------------------------- *
   * skillCfg
   * ---------------------------------------------------------------- */

  function skillCfg(skill, base) {
    var baseCfg = ME.normalizeCfg(base);
    var skCfg = ME.normalizeCfg(skill && skill.cfg);

    var merged = {
      ops: skCfg.ops, addRange: skCfg.addRange, tables: skCfg.tables, max: skCfg.max,
      order: 'random', coach: true,
      mode: baseCfg.mode, length: baseCfg.length,
      skill: skill && skill.id, label: skill && skill.name
    };

    var out = ME.normalizeCfg(merged);
    // Re-attach explicitly - see interpretation 3 above.
    out.skill = skill && skill.id;
    out.label = skill && skill.name;
    return out;
  }

  /* ---------------------------------------------------------------- *
   * exportProfile / importProfile
   * ---------------------------------------------------------------- */

  function exportProfile(name, stats, earned, now) {
    stats = isPlainObject(stats) ? stats : {};
    earned = isPlainObject(earned) ? earned : {};
    var nowIso = toIso(now);

    var competencies = SKILLS.map(function (sk) {
      var keys = factKeys(sk);
      var pr = progress(sk, stats);
      var e = earned[sk.id];
      var earnedStars = (e && typeof e.stars === 'number' && !isNaN(e.stars)) ? e.stars : 0;
      var stars = Math.max(earnedStars, pr.stars);

      var evidenceCount = 0, maxLast = null;
      keys.forEach(function (k) {
        var s = stats[k];
        if (s && typeof s.n === 'number' && !isNaN(s.n)) evidenceCount += s.n;
        if (s && typeof s.last === 'number' && !isNaN(s.last)) {
          if (maxLast === null || s.last > maxLast) maxLast = s.last;
        }
      });

      return {
        id: sk.id, name: sk.name, desc: sk.desc, level: pr.level, target: 100,
        stars: stars, evidence_count: evidenceCount,
        last_evidence: maxLast === null ? null : toIso(maxLast)
      };
    });

    return {
      schema: SCHEMA, skill: FRAMEWORK.id, discipline: 'math', updated: nowIso,
      provenance: [{ source: EXPORT_SOURCE, at: nowIso }],
      player: name,
      competencies: competencies,
      facts: clone(stats),
      earned: clone(earned)
    };
  }

  function earliestOf(a, b) {
    if (a == null) return (b == null) ? null : b;
    if (b == null) return a;
    return Math.min(a, b);
  }

  // Whole-number stars, 0-3. A non-number (including a numeric string, per
  // interpretation 6 above) or a non-finite value reads as 0 - never coerced.
  function clampStars(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 0;
    var n = Math.floor(v);
    if (n < 0) return 0;
    if (n > 3) return 3;
    return n;
  }

  // A mastery timestamp is evidence, never invented: only a genuine positive
  // finite epoch-ms number counts. Anything else (string, negative, 0,
  // Infinity, missing) reads as "no evidence" (null), same as unmastered.
  function normalizeMasteredAt(v) {
    return (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
  }

  // A fact entry's optional numeric fields, when PRESENT, must already be a
  // finite non-negative number - a string like n:"5" (which would otherwise
  // silently concatenate into "51" on a future recordAnswer) drops the whole
  // entry rather than being coerced.
  function isValidFactEntry(entry) {
    for (var i = 0; i < FACT_NUMERIC_FIELDS.length; i++) {
      var v = entry[FACT_NUMERIC_FIELDS[i]];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !isFinite(v) || v < 0) return false;
    }
    return true;
  }

  // player: parsed.player when it is a string, CR/LF collapsed to spaces,
  // trimmed, capped at MAX_PLAYER_LEN - mirrors engine.js normalizeCfg's
  // label sanitization. null when absent, non-string, or empty after trim.
  function sanitizePlayer(v) {
    if (typeof v !== 'string') return null;
    var cleaned = v.replace(/[\r\n]/g, ' ').trim().slice(0, MAX_PLAYER_LEN);
    return cleaned.length > 0 ? cleaned : null;
  }

  function importProfile(json, stats, earned) {
    stats = isPlainObject(stats) ? stats : {};
    earned = isPlainObject(earned) ? earned : {};

    var parsed;
    if (typeof json === 'string') {
      try { parsed = JSON.parse(json); }
      catch (e) { return { ok: false, stats: stats, earned: earned, error: 'not valid JSON', player: null }; }
    } else {
      parsed = json;
    }

    if (!isPlainObject(parsed)) {
      return { ok: false, stats: stats, earned: earned, error: 'not a profile', player: null };
    }
    if (parsed.schema !== SCHEMA) {
      return { ok: false, stats: stats, earned: earned, error: 'unrecognized profile format', player: null };
    }
    if (parsed.skill !== FRAMEWORK.id) {
      return { ok: false, stats: stats, earned: earned, error: 'unknown skill: ' + String(parsed.skill) + ' (expected ' + FRAMEWORK.id + ')', player: null };
    }

    var mergedStats = clone(stats);
    var importedFacts = isPlainObject(parsed.facts) ? parsed.facts : {};
    var acceptedFactKeys = 0;
    Object.keys(importedFacts).forEach(function (k) {
      // Shape-invalid keys never count toward the cap - only real fact-key-
      // shaped entries can consume it.
      if (!FACT_KEY_RE.test(k)) return;
      if (acceptedFactKeys >= MAX_IMPORTED_FACT_KEYS) return;
      acceptedFactKeys++;

      var incoming = importedFacts[k];
      if (!isPlainObject(incoming)) return;
      if (!isValidFactEntry(incoming)) return;

      var existing = mergedStats[k];
      if (!existing) { mergedStats[k] = clone(incoming); return; }
      var existN = numOr(existing.n, 0);
      var incN = numOr(incoming.n, 0);
      if (incN > existN) {
        mergedStats[k] = clone(incoming);
      } else if (incN === existN) {
        var existLast = numOr(existing.last, -Infinity);
        var incLast = numOr(incoming.last, -Infinity);
        if (incLast > existLast) mergedStats[k] = clone(incoming);
      }
      // incN < existN: keep existing (already in mergedStats)
    });

    var mergedEarned = clone(earned);
    var importedEarned = isPlainObject(parsed.earned) ? parsed.earned : {};
    var acceptedUnknownEarned = 0;
    Object.keys(importedEarned).forEach(function (id) {
      var incoming = importedEarned[id];
      if (!isPlainObject(incoming)) return;

      // Known skill ids are always processed (bounded by the fixed 12-skill
      // path); an unknown id is kept for forward compat (interpretation 4)
      // but capped so a hostile/corrupt file can't grow earned unbounded.
      if (!skillById(id)) {
        if (acceptedUnknownEarned >= MAX_UNKNOWN_EARNED_IDS) return;
        acceptedUnknownEarned++;
      }

      var incStars = clampStars(incoming.stars);
      var incMasteredAt = normalizeMasteredAt(incoming.masteredAt);

      var existing = mergedEarned[id];
      if (!existing) {
        mergedEarned[id] = { stars: incStars, masteredAt: incMasteredAt };
        return;
      }
      var existStars = clampStars(existing.stars);
      var existMasteredAt = normalizeMasteredAt(existing.masteredAt);

      mergedEarned[id] = {
        stars: Math.max(existStars, incStars),
        masteredAt: earliestOf(existMasteredAt, incMasteredAt)
      };
    });

    return { ok: true, stats: mergedStats, earned: mergedEarned, error: null, player: sanitizePlayer(parsed.player) };
  }

  /* ---------------------------------------------------------------- *
   * API export
   * ---------------------------------------------------------------- */

  var api = {
    SCHEMA: SCHEMA,
    FRAMEWORK: FRAMEWORK,
    SKILLS: SKILLS,

    skillById: skillById,
    factKeys: factKeys,
    progress: progress,
    path: path,
    updateEarned: updateEarned,
    skillCfg: skillCfg,
    exportProfile: exportProfile,
    importProfile: importProfile
  };

  if (root) root.MathSkills = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
