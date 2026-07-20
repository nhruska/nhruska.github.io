/* =====================================================================
 * competency.js - per-skill COMPETENCY PROFILE that grows from what the
 * musician actually does in the app, stored locally, and exported/imported
 * as a portable skill-competency-profile/v1 document.
 * ---------------------------------------------------------------------
 * PRIVACY: this repo is PUBLIC, so this file ships only the GENERIC
 * FRAMEWORKS (skill/competency ids, names, descriptions, targets). A user's
 * LEVELS + evidence live ONLY in their own localStorage (key
 * `music.competency.v1`) and in a file they export; nothing personal is
 * committed here. Import = the user loads their own profile file at runtime.
 *
 * Pure + dependency-free (same shape as backup.js / build-stamp.js): every
 * function takes an optional trailing Storage-LIKE object so tests drive a
 * tiny fake and the browser falls back to real localStorage. No DOM here -
 * presentation (the Settings Skills panel) lives in songbook.js. Exposes
 * window.Competency and require()-able in Node.
 *
 * Storage is ADDITIVE (backup.js rule): ONE key under the already-owned
 * `music.` namespace, so backup.js snapshots/restores it with no schema
 * bump. The value is a map { [skillId]: profile }.
 *
 * The portable document (schema "skill-competency-profile/v1"):
 *   { schema, skill, discipline:"music", updated:ISO,
 *     provenance:[{source, at}],
 *     competencies:[{id, name, desc, level:0-100, target, evidence_count, last_evidence}],
 *     preferences?:[{id, statement, evidence_count, last_evidence}] }  // additive, optional
 * ===================================================================== */
(function (root) {
  'use strict';

  var SCHEMA = 'skill-competency-profile/v1';
  var STORAGE_KEY = 'music.competency.v1';
  var EXPORT_SOURCE = 'app:music';

  // ---- FRAMEWORKS: the generic, publishable competency maps. ids are the
  // portable contract - keep them verbatim; names + descs are UI-facing and
  // may be shortened without breaking portability.
  var FRAMEWORKS = [
    {
      id: 'stringed-instrument', name: 'Stringed instrument',
      desc: 'Instrument-agnostic fundamentals shared by any fretted string instrument.',
      competencies: [
        { id: 'fretboard-map',  name: 'Fretboard map',   desc: 'Know where the notes live across the neck.', target: 80 },
        { id: 'chord-shapes',   name: 'Chord shapes',     desc: 'Fret common shapes cleanly, from memory.',   target: 85 },
        { id: 'transitions',    name: 'Chord changes',    desc: 'Move between shapes without stalling.',       target: 85 },
        { id: 'rhythm-keeping', name: 'Keeping time',     desc: 'Hold a steady strum through a change.',       target: 80 },
        { id: 'tuning-ear',     name: 'Tuning by ear',    desc: 'Hear and correct a string that has drifted.', target: 75 }
      ]
    },
    {
      id: 'ukulele', name: 'Ukulele',
      desc: 'Ukulele-specific technique and repertoire.',
      competencies: [
        { id: 'uke-open-chords',   name: 'Open chords',    desc: 'The core open shapes under the fingers.',   target: 90 },
        { id: 'uke-strum-patterns',name: 'Strum patterns', desc: 'Common down/up patterns at tempo.',          target: 85 },
        { id: 'uke-chunking',      name: 'Chunking',       desc: 'The muted percussive chunk on the offbeat.', target: 75 },
        { id: 'uke-fingerpicking', name: 'Fingerpicking',  desc: 'Pick out a pattern instead of strumming.',   target: 70 },
        { id: 'uke-repertoire',    name: 'Repertoire',     desc: 'Songs you can play start to finish.',        target: 80 }
      ]
    },
    {
      id: 'guitar', name: 'Guitar',
      desc: 'Guitar-specific technique and repertoire.',
      competencies: [
        { id: 'gtr-open-chords',    name: 'Open chords',      desc: 'The core open-position shapes.',             target: 85 },
        { id: 'gtr-barre',          name: 'Barre chords',     desc: 'Movable barre shapes up the neck.',          target: 75 },
        { id: 'gtr-strum-dynamics', name: 'Strum dynamics',   desc: 'Vary attack and accent within a strum.',     target: 80 },
        { id: 'gtr-transitions',    name: 'Chord changes',    desc: 'Clean, quick changes under a rhythm.',        target: 85 },
        { id: 'gtr-repertoire',     name: 'Repertoire',       desc: 'Songs you can play start to finish.',        target: 75 }
      ]
    },
    {
      id: 'music-composition', name: 'Composition',
      desc: 'Building songs from chords, form, and key.',
      competencies: [
        { id: 'comp-progressions', name: 'Progressions', desc: 'Assemble chord progressions that move.',       target: 80 },
        { id: 'comp-song-form',    name: 'Song form',    desc: 'Arrange sections into a whole song.',           target: 80 },
        { id: 'comp-key-mode',     name: 'Key and mode', desc: 'Choose a key and mode that fit the feel.',      target: 75 },
        { id: 'comp-borrowing',    name: 'Borrowing',    desc: 'Reach outside the key for colour.',             target: 70 },
        { id: 'comp-melody',       name: 'Melody',       desc: 'Write a line that sits over the changes.',      target: 70 }
      ]
    },
    {
      id: 'lyric-writing', name: 'Lyrics',
      desc: 'Writing words that sing.',
      competencies: [
        { id: 'lyr-prosody',   name: 'Prosody',    desc: 'Match stress and phrasing to the melody.',       target: 75 },
        { id: 'lyr-imagery',   name: 'Imagery',    desc: 'Show a scene instead of stating it.',            target: 80 },
        { id: 'lyr-rhyme',     name: 'Rhyme',      desc: 'Use rhyme without forcing the line.',            target: 75 },
        { id: 'lyr-structure', name: 'Structure',  desc: 'Shape verses and a chorus that lands.',          target: 75 },
        { id: 'lyr-rewrite',   name: 'Rewriting',  desc: 'Sharpen a draft on the second pass.',            target: 70 }
      ]
    }
  ];

  // id -> framework, id -> {framework, competency} lookups (built once).
  var FRAMEWORK_BY_ID = {};
  FRAMEWORKS.forEach(function (fw) { FRAMEWORK_BY_ID[fw.id] = fw; });

  function nowIso() { return new Date().toISOString(); }

  // Real localStorage in the browser; a null-ish store elsewhere so a Node
  // caller that forgets to pass a store fails soft (never throws) instead of
  // touching a global. Tests always pass their own fake store.
  function defaultStore() {
    try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch (e) {}
    return null;
  }

  // A fresh profile for a KNOWN skill, seeded from its framework at level 0.
  // Returns null for an unknown skill id (caller decides how to signal).
  function blankProfile(skillId) {
    var fw = FRAMEWORK_BY_ID[skillId];
    if (!fw) return null;
    return {
      schema: SCHEMA, skill: skillId, discipline: 'music', updated: nowIso(),
      provenance: [],
      competencies: fw.competencies.map(function (c) {
        return { id: c.id, name: c.name, desc: c.desc, level: 0, target: c.target, evidence_count: 0, last_evidence: null };
      }),
      preferences: []
    };
  }

  // Read the whole working-copy map { [skillId]: profile }. Defensive: any
  // parse/storage failure yields {} (the app runs, the panel shows "no data").
  function load(store) {
    store = store || defaultStore();
    if (!store) return {};
    try {
      var raw = store.getItem(STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) { return {}; }
  }

  function save(store, map) {
    store = store || defaultStore();
    if (!store) return false;
    try { store.setItem(STORAGE_KEY, JSON.stringify(map)); return true; }
    catch (e) { return false; }
  }

  // True when the user has any local competency data (drives the panel's
  // first-start "import to personalize" lead vs the populated view).
  function hasData(store) {
    var map = load(store);
    return Object.keys(map).length > 0;
  }

  // The working profile for a skill (stored, else a fresh blank) - what the
  // Skills panel renders. Never persists (read-only view helper).
  function getProfile(skillId, store) {
    var map = load(store);
    return map[skillId] || blankProfile(skillId);
  }

  // ---- level movement: deterministic, diminishing returns, capped at target.
  // Each piece of evidence nudges the level a fraction of the remaining gap
  // (6%, min 1), so early practice moves fast and the last stretch to a target
  // is earned slowly - never overshoots the target, never moves once at it.
  function nextLevel(level, target) {
    level = clampInt(level, 0, 100); target = clampInt(target, 0, 100);
    if (level >= target) return level;              // at/above target: evidence still counts, level holds
    var step = Math.max(1, Math.round((target - level) * 0.06));
    var nl = level + step;
    return nl > target ? target : nl;
  }

  function clampInt(n, lo, hi) {
    n = (typeof n === 'number' && !isNaN(n)) ? n : 0;
    if (n < lo) n = lo; if (n > hi) n = hi;
    return Math.round(n);
  }

  function findComp(profile, competencyId) {
    if (!profile || !Array.isArray(profile.competencies)) return null;
    for (var i = 0; i < profile.competencies.length; i++) {
      if (profile.competencies[i].id === competencyId) return profile.competencies[i];
    }
    return null;
  }

  // Record one piece of evidence against a competency: increment the count,
  // stamp last_evidence, move the level (diminishing, capped). Additive write
  // to the ONE key. Returns {ok, ...} or {ok:false, reason}. `note` is
  // reserved for a future evidence log (unused today - kept in the signature
  // so call sites and the portable contract stay stable).
  function recordEvidence(skillId, competencyId, note, store) {
    var map = load(store);
    var p = map[skillId] || blankProfile(skillId);
    if (!p) return { ok: false, reason: 'unknown skill' };
    var comp = findComp(p, competencyId);
    if (!comp) return { ok: false, reason: 'unknown competency' };
    comp.evidence_count = (comp.evidence_count || 0) + 1;
    comp.last_evidence = nowIso();
    comp.level = nextLevel(comp.level, comp.target);
    p.updated = nowIso();
    map[skillId] = p;
    save(store, map);
    return { ok: true, skill: skillId, competency: competencyId, level: comp.level, evidence_count: comp.evidence_count };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // The portable export document for one skill. Appends an export-event
  // provenance stamp; carries preferences only when present (absent-tolerant).
  function exportProfile(skillId, store) {
    var p = getProfile(skillId, store);
    if (!p) return null;
    var out = clone(p);
    out.schema = SCHEMA; out.discipline = 'music'; out.skill = skillId;
    out.updated = nowIso();
    out.provenance = (Array.isArray(out.provenance) ? out.provenance : []).concat([{ source: EXPORT_SOURCE, at: nowIso() }]);
    if (out.preferences && !out.preferences.length) delete out.preferences; // omit an empty prefs array (clean doc)
    return JSON.stringify(out, null, 2);
  }

  // Later of two ISO strings (either may be null); null when both are.
  function laterIso(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    return (String(a) >= String(b)) ? a : b;
  }

  // Merge an imported profile INTO a local one: per competency, take the
  // HIGHER level and SUM the evidence counts; keep name/desc/target from the
  // local (framework) copy. Imported competency ids the framework doesn't know
  // are preserved untouched (additive tolerance - a newer profile version can
  // carry competencies this build hasn't shipped yet). Preferences union by id
  // (sum evidence, keep the latest statement). Provenance concatenates.
  function mergeInto(local, imported) {
    var merged = clone(local);
    var byId = {};
    merged.competencies.forEach(function (c) { byId[c.id] = c; });
    (Array.isArray(imported.competencies) ? imported.competencies : []).forEach(function (ic) {
      var lc = byId[ic.id];
      if (lc) {
        lc.level = Math.max(clampInt(lc.level, 0, 100), clampInt(ic.level, 0, 100));
        lc.evidence_count = (lc.evidence_count || 0) + (typeof ic.evidence_count === 'number' && ic.evidence_count > 0 ? ic.evidence_count : 0);
        lc.last_evidence = laterIso(lc.last_evidence, ic.last_evidence);
      } else {
        // Unknown id: preserve it untouched so a round-trip never drops data.
        merged.competencies.push(clone(ic));
        byId[ic.id] = merged.competencies[merged.competencies.length - 1];
      }
    });
    // Preferences (additive, optional): union by id, sum evidence, keep the
    // statement carrying the later last_evidence.
    var prefById = {};
    (Array.isArray(merged.preferences) ? merged.preferences : []).forEach(function (p) { prefById[p.id] = p; });
    merged.preferences = merged.preferences && merged.preferences.length ? merged.preferences : [];
    (Array.isArray(imported.preferences) ? imported.preferences : []).forEach(function (ip) {
      var lp = prefById[ip.id];
      if (lp) {
        var newer = laterIso(lp.last_evidence, ip.last_evidence);
        if (newer === ip.last_evidence && ip.last_evidence) lp.statement = ip.statement;
        lp.evidence_count = (lp.evidence_count || 0) + (typeof ip.evidence_count === 'number' && ip.evidence_count > 0 ? ip.evidence_count : 0);
        lp.last_evidence = newer;
      } else {
        merged.preferences.push(clone(ip));
        prefById[ip.id] = merged.preferences[merged.preferences.length - 1];
      }
    });
    if (!merged.preferences.length) merged.preferences = [];
    merged.provenance = (Array.isArray(merged.provenance) ? merged.provenance : [])
      .concat(Array.isArray(imported.provenance) ? imported.provenance : []);
    merged.updated = nowIso();
    return merged;
  }

  // Resolve an imported document's `skill` to a shipped framework id.
  // The portable contract is the framework id, but a `skill` that differs
  // only in case/whitespace, or that carries a framework's display NAME
  // instead of its id ("Ukulele" for 'ukulele'), still resolves. Anything
  // that resolves to no shipped framework returns null (DENIED): competencies
  // merge INTO a known framework's profile, so there is nothing sensible to
  // attach an unknown skill to. Unknown COMPETENCY ids inside a known skill
  // stay additive-tolerated (see mergeInto).
  function resolveSkillId(raw) {
    if (FRAMEWORK_BY_ID[raw]) return raw;
    var norm = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!norm) return null;
    if (FRAMEWORK_BY_ID[norm]) return norm;
    for (var i = 0; i < FRAMEWORKS.length; i++) {
      if (String(FRAMEWORKS[i].name).trim().toLowerCase() === norm) return FRAMEWORKS[i].id;
    }
    return null;
  }

  function importProfile(json, store) {
    var parsed;
    if (typeof json === 'string') {
      try { parsed = JSON.parse(json); } catch (e) { return { ok: false, reason: 'not valid JSON' }; }
    } else { parsed = json; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'not a profile' };
    if (parsed.schema !== SCHEMA) return { ok: false, reason: 'unrecognized profile format' };
    var skillId = resolveSkillId(parsed.skill);
    if (!skillId) {
      return { ok: false, reason: 'unknown skill: ' + String(parsed.skill) + ' (known: ' + FRAMEWORKS.map(function (f) { return f.id; }).join(', ') + ')' };
    }
    if (!Array.isArray(parsed.competencies)) return { ok: false, reason: 'no competencies in profile' };
    var map = load(store);
    var local = map[skillId] || blankProfile(skillId);
    map[skillId] = mergeInto(local, parsed);
    save(store, map);
    return { ok: true, skill: skillId };
  }

  var API = {
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    FRAMEWORKS: FRAMEWORKS,
    // pure helpers (unit-testable without a store)
    nextLevel: nextLevel,
    blankProfile: blankProfile,
    mergeInto: mergeInto,
    resolveSkillId: resolveSkillId, // flexible id/name resolution

    // storage-backed API (optional trailing store; browser falls back to localStorage)
    load: load,
    hasData: hasData,
    getProfile: getProfile,
    recordEvidence: recordEvidence,
    exportProfile: exportProfile,
    importProfile: importProfile
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Competency = API;

})(typeof window !== 'undefined' ? window : this);
