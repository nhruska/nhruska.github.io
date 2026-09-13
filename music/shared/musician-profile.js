/* =====================================================================
 * musician-profile.js - the person-owned, lifelong `musician-profile/v1`
 * document and the MINIMUM PARTICIPATION CONTRACT any app that touches it
 * agrees to: read what you understand, preserve what you don't, add what
 * you legitimately know.
 * ---------------------------------------------------------------------
 * The profile models the MUSICIAN, not this app. competency.js stays the
 * app's own progression tracker (skill-competency-profile/v1, one doc per
 * framework); this module carries that tracking INTO the profile as
 * EVIDENCE - dated, sourced, with its modality stated - and never as a
 * proficiency claim. A competency with no assessment is UNASSESSED, and
 * absence is never rendered or exported as level 0 / "beginner".
 *
 * Sections (every one optional on read, tolerated missing):
 *   competencies[]  the taxonomy - stable ids `<framework>/<competency>`,
 *                   each with a branch path (["instrument","strings","ukulele"])
 *   assessments[]   dated claims about ONE competency: value + scale +
 *                   method (self-report|observed|coach|inferred) + modality
 *   evidence[]      what happened, sourced, with modality; assessments cite it
 *   goals[]         what the musician wants; the coach reads these first
 *   plan            the coach-stewarded practice plan (later `updated` wins)
 *   preferences[]   taste statements (competency.js shape, unchanged)
 *   participants[]  every app/agent that touched the doc + what it understands
 *   provenance[]    append-only trail
 *   extensions{} + ANY unknown top-level key: preserved byte-for-byte
 *
 * Storage is ADDITIVE (backup.js rule): ONE key `music.profile.v1` under the
 * owned `music.` prefix, so backup snapshots/restores it with no schema bump.
 * Every reader is defensive (corrupt value -> a fresh blank).
 *
 * Pure + dependency-free (competency.js discipline): no DOM; every storage
 * function takes an optional trailing Storage-LIKE object (tests pass a
 * fake, the browser falls back to localStorage). Time + ids are injectable
 * through `opts` so tests are deterministic. Exposes window.MusicianProfile
 * and is require()-able in Node. music/sw.js CORE must precache this file.
 * Spec: music/engineering-wiki/systems/musician-profile.md
 * ===================================================================== */
(function (root) {
  'use strict';

  var SCHEMA = 'musician-profile/v1';
  var CONTRACT_ID = 'minimum-participation/v1';
  var STORAGE_KEY = 'music.profile.v1';
  var APP_ID = 'app:music';
  var APP_URL = 'https://nhruska.github.io/music/play/';
  var CAPABILITIES_URL = 'https://nhruska.github.io/music/agent/capabilities.json';

  // The contract travels INSIDE the document so a participant that never
  // reads AGENTS.md (optional by design) still knows the three rules.
  var CONTRACT = {
    id: CONTRACT_ID,
    rules: [
      'Read what you understand.',
      'Preserve what you do not understand - byte-identical, including keys you have never seen.',
      'Add what you legitimately know - as evidence, or as an assessment that names its method and modality; never a level you did not observe.'
    ],
    unassessed: 'A competency with no assessment is unassessed. Absence is never beginner. No participant emits a level it did not observe.'
  };

  // The sections THIS app reads (declared on its participant entry).
  var UNDERSTANDS = ['competencies', 'assessments', 'evidence', 'goals', 'plan', 'preferences'];
  var METHODS = ['self-report', 'observed', 'coach', 'inferred'];
  var MODALITIES = ['perform', 'compose', 'write', 'listen', 'tune', 'theory', 'unspecified'];
  // Top-level keys this module knows how to merge; everything else is
  // "unknown" and preserved by the contract's second rule.
  var KNOWN_KEYS = ['schema', 'contract', 'id', 'updated', 'participants', 'provenance',
    'competencies', 'assessments', 'evidence', 'goals', 'plan', 'preferences', 'extensions'];

  // Instrument branches: a ukulele claim is placed under strings by a reader
  // that only knows "strings". Frameworks not listed are crafts.
  var BRANCHES = {
    'stringed-instrument': ['instrument', 'strings'],
    'ukulele': ['instrument', 'strings', 'ukulele'],
    'guitar': ['instrument', 'strings', 'guitar'],
    'music-composition': ['craft', 'music-composition'],
    'lyric-writing': ['craft', 'lyric-writing']
  };

  function nowIso() { return new Date().toISOString(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  // "Is stamp a at-or-after stamp b?" ISO stamps are PARSED, never compared
  // as strings: a participant may write a UTC offset (`+02:00`) or a
  // second-precision `Z` stamp, and a lexical compare orders both wrongly
  // against the app's millisecond `Z` stamps. Unparseable stamps fall back
  // to string order so a garbage stamp still merges deterministically.
  function later(a, b) {
    var ta = Date.parse(String(a || '')), tb = Date.parse(String(b || ''));
    if (!isNaN(ta) && !isNaN(tb)) return ta >= tb;
    if (isNaN(ta) && !isNaN(tb)) return false;   // a missing/garbage stamp never beats a real one
    if (!isNaN(ta) && isNaN(tb)) return true;
    return String(a || '') >= String(b || '');
  }

  function uuid() {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (e) {}
    var s = '', h = '0123456789abcdef';
    for (var i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-a' + s.slice(17, 20) + '-' + s.slice(20);
  }
  function newId(prefix) { return prefix + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 8); }

  function defaultStore() {
    try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch (e) {}
    return null;
  }

  function competencyId(frameworkId, compId) { return String(frameworkId) + '/' + String(compId); }
  function branchFor(frameworkId) { return BRANCHES[frameworkId] ? BRANCHES[frameworkId].slice() : ['craft', String(frameworkId)]; }

  // A fresh, empty profile. `opts.id` pins the musician id (tests); `opts.now` the clock.
  function blank(opts) {
    opts = opts || {};
    return {
      schema: SCHEMA,
      contract: clone(CONTRACT),
      id: opts.id || ('mp_' + uuid()),
      updated: opts.now || nowIso(),
      participants: [],
      provenance: [],
      competencies: [],
      assessments: [],
      evidence: [],
      goals: [],
      plan: null,
      preferences: [],
      extensions: {}
    };
  }

  // Shape check for anything handed to import/merge. Sections may be
  // missing (tolerated as empty) but when present must be the right type.
  function validate(obj) {
    if (!isObj(obj)) return { ok: false, reason: 'not a profile' };
    if (obj.schema !== SCHEMA) return { ok: false, reason: 'unrecognized profile format' };
    var lists = ['participants', 'provenance', 'competencies', 'assessments', 'evidence', 'goals', 'preferences'];
    for (var i = 0; i < lists.length; i++) {
      if (obj[lists[i]] != null && !Array.isArray(obj[lists[i]])) return { ok: false, reason: lists[i] + ' must be a list' };
    }
    if (obj.plan != null && !isObj(obj.plan)) return { ok: false, reason: 'plan must be an object' };
    if (obj.extensions != null && !isObj(obj.extensions)) return { ok: false, reason: 'extensions must be an object' };
    return { ok: true };
  }

  // Fill missing sections so every reader can index without guards. Unknown
  // keys are left exactly where they are.
  function normalize(doc) {
    var d = clone(doc);
    d.schema = SCHEMA;
    if (!isObj(d.contract)) d.contract = clone(CONTRACT);
    ['participants', 'provenance', 'competencies', 'assessments', 'evidence', 'goals', 'preferences'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (!isObj(d.plan)) d.plan = null;
    if (!isObj(d.extensions)) d.extensions = {};
    if (!d.id) d.id = 'mp_' + uuid();
    return d;
  }

  // ---- storage ----
  function loadStored(store) {
    store = store || defaultStore();
    if (!store) return null;
    try {
      var raw = store.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return validate(obj).ok ? normalize(obj) : null;
    } catch (e) { return null; }
  }
  // The working profile: stored, else a fresh blank (never persisted here).
  function load(store, opts) { return loadStored(store) || blank(opts); }
  function save(store, doc) {
    store = store || defaultStore();
    if (!store) return false;
    try { store.setItem(STORAGE_KEY, JSON.stringify(doc)); return true; }
    catch (e) { return false; }
  }
  function hasData(store) { return !!loadStored(store); }

  // ---- reads ----
  function latestAssessment(doc, competency) {
    var best = null;
    arr(doc && doc.assessments).forEach(function (a) {
      if (!a || a.competency !== competency) return;
      if (!best || later(a.at, best.at)) best = a;
    });
    return best;
  }
  // The explicit answer to "how good is X?": an assessment, or UNASSESSED.
  // Never a number for absence.
  function status(doc, competency) {
    var a = latestAssessment(doc, competency);
    return a ? { status: 'assessed', assessment: a } : { status: 'unassessed' };
  }

  // ---- upsert helpers (by id; same id -> later stamp wins) ----
  function upsertById(list, item, stampKey) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === item.id) {
        if (later(item[stampKey], list[i][stampKey])) list[i] = item;
        return list;
      }
    }
    list.push(item);
    return list;
  }
  // Provenance is append-only for OTHER participants' rows. The app's own
  // routine stamps (`export` / `import`) are kept as ONE row per action with
  // the latest `at` - a musician who exports after every session would
  // otherwise carry hundreds of identical rows in every profile.json.
  var ROUTINE_ACTIONS = { 'export': true, 'import': true };
  function provenanceKey(e) { return JSON.stringify([e && e.source, e && e.at, e && e.action, e && e.note]); }
  // The app is the AUTHORITY on its own records (its progression evidence,
  // its self-report): on export they are replaced outright, never
  // stamp-compared - a hand-back that edited one of them (or carried a
  // future `at`) must not survive the next export.
  function replaceById(list, item) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === item.id) { list[i] = item; return list; }
    }
    list.push(item);
    return list;
  }
  function pushProvenance(doc, entry, index) {
    if (!entry) return;
    if (entry.source === APP_ID && ROUTINE_ACTIONS[entry.action]) {
      for (var j = 0; j < doc.provenance.length; j++) {
        var p = doc.provenance[j];
        if (p && p.source === APP_ID && p.action === entry.action && !p.note) {
          if (later(entry.at, p.at)) p.at = entry.at;
          return;
        }
      }
    }
    var key = provenanceKey(entry);
    if (index) {
      if (index[key]) return;
      index[key] = true;
    } else {
      for (var i = 0; i < doc.provenance.length; i++) if (provenanceKey(doc.provenance[i]) === key) return;
    }
    doc.provenance.push(entry);
  }

  // ---- merge: the interoperability floor, executable ----
  // local + incoming -> merged. Known sections merge by id; unknown keys are
  // preserved (incoming's copy taken only when incoming is the newer doc).
  function merge(local, incoming) {
    var L = normalize(local), I = normalize(incoming);
    // Ties go to the INCOMING document - the same rule same-id records use
    // (upsertById's >=), so a coach's second-round edit to its own extension
    // is never dropped for leaving `updated` untouched.
    var incomingNewer = later(I.updated, L.updated);
    var M = clone(L);

    // Musician-id adoption is the STORAGE seam's job (importJson: a device
    // with no stored profile adopts the imported id). By the time two docs
    // reach merge() both carry an id, so a mismatch is only ever recorded.
    if (L.id !== I.id) {
      pushProvenance(M, { source: APP_ID, at: I.updated || L.updated, action: 'merge', note: 'imported profile id ' + I.id + ' merged into ' + L.id });
    }

    I.participants.forEach(function (p) { if (p && p.id) upsertById(M.participants, clone(p), 'last_seen'); });
    var provIndex = {};
    M.provenance.forEach(function (p) { provIndex[provenanceKey(p)] = true; });
    I.provenance.forEach(function (p) { if (p) pushProvenance(M, clone(p), provIndex); });

    var compById = {};
    M.competencies.forEach(function (c) { if (c && c.id) compById[c.id] = c; });
    I.competencies.forEach(function (c) {
      if (!c || !c.id) return;
      if (!compById[c.id]) { M.competencies.push(clone(c)); compById[c.id] = c; } // unknown id: preserved verbatim
    });

    I.assessments.forEach(function (a) { if (a && a.id) upsertById(M.assessments, clone(a), 'at'); });
    I.evidence.forEach(function (e) { if (e && e.id) upsertById(M.evidence, clone(e), 'at'); });
    I.goals.forEach(function (g) { if (g && g.id) upsertById(M.goals, clone(g), 'updated'); });

    if (I.plan && (!M.plan || later(I.plan.updated, M.plan.updated))) M.plan = clone(I.plan);

    // preferences: competency.js's rule - union by id, sum evidence, later statement.
    var prefById = {};
    M.preferences.forEach(function (p) { if (p && p.id) prefById[p.id] = p; });
    I.preferences.forEach(function (ip) {
      if (!ip || !ip.id) return;
      var lp = prefById[ip.id];
      if (!lp) { M.preferences.push(clone(ip)); prefById[ip.id] = ip; return; }
      if (later(ip.last_evidence, lp.last_evidence) && ip.last_evidence) lp.statement = ip.statement;
      lp.evidence_count = (lp.evidence_count || 0) + (typeof ip.evidence_count === 'number' && ip.evidence_count > 0 ? ip.evidence_count : 0);
      lp.last_evidence = later(ip.last_evidence, lp.last_evidence) ? (ip.last_evidence || lp.last_evidence) : (lp.last_evidence || ip.last_evidence);
    });

    // extensions + unknown top-level keys: preserve. Both sides carry the
    // same unknown key -> the newer document wins (we cannot judge content).
    Object.keys(I.extensions).forEach(function (k) {
      if (!(k in M.extensions) || incomingNewer) M.extensions[k] = clone(I.extensions[k]);
    });
    Object.keys(I).forEach(function (k) {
      if (KNOWN_KEYS.indexOf(k) >= 0) return;
      if (!(k in M) || incomingNewer) M[k] = clone(I[k]);
    });

    M.updated = later(I.updated, L.updated) ? I.updated : L.updated;
    return M;
  }

  // ---- what the Music app LEGITIMATELY knows, written into a profile ----
  // inputs: { frameworks: Competency.FRAMEWORKS, progression: Competency.load(store),
  //           selfReport: GuidanceLevel.get() | null, version: build stamp, now }
  // - participants: this app, with the sections it understands + deep links
  // - competencies: the taxonomy, namespaced + branched, source app:music
  // - evidence: ONE app-progression record per framework that has any
  //   evidence, modality COMPOSE (the app observes composing; it has never
  //   heard the musician play - even the "*-repertoire" counters are compose
  //   evidence). Deterministic ids so a re-export UPDATES its own record.
  // - assessments: the ONE self-report the app holds (guidance level),
  //   branch-level, band-3, modality unspecified. Nothing derived from counters.
  function compose(doc, inputs) {
    inputs = inputs || {};
    var now = inputs.now || nowIso();
    var d = normalize(doc || blank({ now: now }));
    var frameworks = arr(inputs.frameworks);
    var progression = isObj(inputs.progression) ? inputs.progression : {};

    upsertById(d.participants, {
      id: APP_ID, name: 'Music app', version: inputs.version || null,
      url: APP_URL, capabilities_url: CAPABILITIES_URL,
      understands: UNDERSTANDS.slice(), last_seen: now
    }, 'last_seen');

    var compById = {};
    d.competencies.forEach(function (c) { if (c && c.id) compById[c.id] = true; });
    frameworks.forEach(function (fw) {
      arr(fw.competencies).forEach(function (c) {
        var id = competencyId(fw.id, c.id);
        if (compById[id]) return;
        d.competencies.push({ id: id, name: c.name, desc: c.desc, branch: branchFor(fw.id), source: APP_ID });
        compById[id] = true;
      });
    });

    Object.keys(progression).forEach(function (fwId) {
      var p = progression[fwId];
      if (!p || !Array.isArray(p.competencies)) return;
      var counters = p.competencies.filter(function (c) { return c && (c.evidence_count || 0) > 0; });
      if (!counters.length) return; // nothing observed -> no record (absence stays absent)
      replaceById(d.evidence, {
        id: 'ev:' + APP_ID + ':progression:' + fwId,
        at: p.updated || now,
        source: APP_ID,
        kind: 'app-progression',
        modality: 'compose',
        competencies: counters.map(function (c) { return competencyId(fwId, c.id); }),
        data: {
          schema: p.schema || 'skill-competency-profile/v1', skill: fwId, updated: p.updated || now,
          competencies: counters.map(function (c) {
            return { id: c.id, level: c.level, target: c.target, evidence_count: c.evidence_count, last_evidence: c.last_evidence || null };
          })
        },
        note: 'The app\'s own progression ladder (level 0-100 toward a per-competency target), grown from composing in the app. Evidence of doing, not a proficiency claim.'
      });
    });

    if (inputs.selfReport) {
      var existing = null;
      d.assessments.forEach(function (a) { if (a && a.id === 'as:' + APP_ID + ':self-report') existing = a; });
      if (!existing || existing.value !== inputs.selfReport) {
        replaceById(d.assessments, {
          id: 'as:' + APP_ID + ':self-report', competency: 'stringed-instrument',
          value: inputs.selfReport, scale: 'band-3', method: 'self-report', modality: 'unspecified',
          at: now, source: APP_ID, evidence: [],
          note: 'The musician\'s own answer to the app\'s one-time experience-level ask (beginner | intermediate | advanced).'
        });
      }
    }

    pushProvenance(d, { source: APP_ID, at: now, action: 'export' });
    d.updated = now;
    return d;
  }

  // Export: compose what we know into the stored profile, persist, return
  // pretty JSON (the zip's profile.json). Null only when storage AND inputs
  // are both absent (nothing to say).
  function exportJson(store, inputs) {
    var d = compose(load(store, inputs && inputs.now ? { now: inputs.now } : undefined), inputs);
    save(store, d);
    return JSON.stringify(d, null, 2);
  }

  // Import: validate, merge into the stored profile, persist. Returns what
  // landed so the UI can say something truthful.
  function importJson(json, store, opts) {
    var parsed;
    if (typeof json === 'string') {
      try { parsed = JSON.parse(json); } catch (e) { return { ok: false, reason: 'not valid JSON' }; }
    } else { parsed = json; }
    var v = validate(parsed);
    if (!v.ok) return v;
    // A device with no stored profile ADOPTS the imported musician id (it is
    // the same person's document arriving); only a stored profile keeps its own.
    var local = loadStored(store) || blank({ id: parsed.id, now: opts && opts.now });
    var before = { assessments: local.assessments.length, evidence: local.evidence.length, goals: local.goals.length };
    var merged = merge(local, parsed);
    pushProvenance(merged, { source: APP_ID, at: (opts && opts.now) || nowIso(), action: 'import' });
    if (!save(store, merged)) return { ok: false, reason: 'could not save (storage full or blocked)' };
    return {
      ok: true,
      added: {
        assessments: merged.assessments.length - before.assessments,
        evidence: merged.evidence.length - before.evidence,
        goals: merged.goals.length - before.goals
      },
      plan: !!merged.plan,
      profile: merged
    };
  }

  // The app's OWN progression counters as carried in a profile, re-shaped as
  // skill-competency-profile/v1 docs - a READ-ONLY view for readers and tests.
  // The app never re-ingests these on import: `kind` and `source` are plain
  // strings any participant can write, so absorbing the numbers would let an
  // edited hand-back raise the Skills bars for competencies nothing observed -
  // the exact seam this document exists to guard. Device-to-device transfer
  // of the counters is the backup envelope's job (byte-faithful restore).
  function progressionDocs(doc) {
    var out = [];
    arr(doc && doc.evidence).forEach(function (e) {
      if (!e || e.kind !== 'app-progression' || e.source !== APP_ID || !isObj(e.data)) return;
      if (!e.data.skill || !Array.isArray(e.data.competencies)) return;
      out.push({
        schema: e.data.schema || 'skill-competency-profile/v1', skill: e.data.skill, discipline: 'music',
        updated: e.data.updated || e.at, provenance: [],
        competencies: e.data.competencies.map(function (c) { return clone(c); })
      });
    });
    return out;
  }

  var API = {
    SCHEMA: SCHEMA, CONTRACT_ID: CONTRACT_ID, STORAGE_KEY: STORAGE_KEY, APP_ID: APP_ID,
    APP_URL: APP_URL, CAPABILITIES_URL: CAPABILITIES_URL,
    CONTRACT: CONTRACT, UNDERSTANDS: UNDERSTANDS, METHODS: METHODS, MODALITIES: MODALITIES, BRANCHES: BRANCHES,
    // pure
    competencyId: competencyId, branchFor: branchFor, blank: blank, validate: validate, normalize: normalize,
    merge: merge, compose: compose, status: status, latestAssessment: latestAssessment, progressionDocs: progressionDocs,
    newId: newId,
    // storage-backed
    load: load, loadStored: loadStored, save: save, hasData: hasData,
    exportJson: exportJson, importJson: importJson
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MusicianProfile = API;

})(typeof window !== 'undefined' ? window : this);
