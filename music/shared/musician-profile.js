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
 *                   method (self-report|interview|observed|coach|inferred) +
 *                   modality + optional confidence (high|medium|low)
 *   evidence[]      what happened, sourced, with modality; assessments cite it
 *   goals[]         what the musician wants; the coach reads these first
 *   plan            the coach-stewarded learning plan: focus + items (kind
 *                   focus|activity|edge, optional app deep_link); later
 *                   `updated` wins whole
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
  // Per-DEVICE id, minted once, excluded from backup (device-local stamp, same
  // class as music.lastBackup.v1): the app's progression evidence is scoped by
  // device so two devices' exports coexist in the lifelong document instead of
  // the last exporter silently destroying the other's record.
  var DEVICE_KEY = 'music.device.v1';
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
  // How a claim was made. `interview` = a guided baseline interview (the
  // coach asked, the musician answered - still the musician's word).
  var METHODS = ['self-report', 'interview', 'observed', 'coach', 'inferred'];
  var MODALITIES = ['perform', 'compose', 'write', 'listen', 'tune', 'theory', 'unspecified'];
  // Qualification of an assessment - the smallest useful representation. A
  // conversational self-assessment is `value: "advanced", confidence: "medium"`,
  // never an 87/100 the schema would happily accept.
  var CONFIDENCE = ['high', 'medium', 'low'];
  // SUGGESTED evidence kinds (open vocabulary - a participant may write any
  // string). OBSERVATION != PROFICIENCY: every kind is a fact about what
  // happened, the coach interprets it. `artifact` = a file was attached;
  // `artifact-analysis` = a participant actually analyzed it - two claims.
  var EVIDENCE_KINDS = ['app-progression', 'app-observed', 'interview', 'self-report',
    'coach-observed', 'artifact', 'artifact-analysis', 'imported'];
  // What a plan item IS: the current focus, a concrete activity, or a
  // coach-identified learning edge (the next useful thing, not yet an activity).
  var PLAN_KINDS = ['focus', 'activity', 'edge'];
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

  // ---- the profile-native taxonomy FLOOR ----
  // Global musicianship is modelled APART from instrument proficiency: a
  // person can be an advanced musician, an experienced bassist and a brand-new
  // ukulele player at once, and a reader must never collapse those into one
  // level. These competencies are what the app KNOWS BY NAME so a coach and the
  // panel share ids - the app observes NONE of them (no counters, no SKILL.md;
  // they live only here). A floor, not a ceiling: any participant may add
  // competencies under any namespace (`flamenco/rasgueado`, `songwriting/
  // prosody`) and the contract's second rule carries them through every
  // participant that has never heard of them.
  var CORE_TAXONOMY = [
    { id: 'musicianship/tonal-orientation', name: 'Tonal orientation', desc: 'Find and orient to a tonal center in unfamiliar music in real time.', branch: ['musicianship', 'ear'] },
    { id: 'musicianship/ear-instrument-mapping', name: 'Ear-to-instrument mapping', desc: 'Translate internally heard or sung musical ideas onto an instrument.', branch: ['musicianship', 'ear'] },
    { id: 'musicianship/functional-harmony', name: 'Functional harmony', desc: 'Understand, hear and use harmonic function such as I, IV, V, vi.', branch: ['musicianship', 'harmony'] },
    { id: 'musicianship/modal-fluency', name: 'Modal fluency', desc: 'Perform and improvise appropriately within modal contexts.', branch: ['musicianship', 'harmony'] },
    { id: 'musicianship/harmony-aware-improvisation', name: 'Harmony-aware improvisation', desc: 'Respond to harmonic movement and target relevant tones while improvising.', branch: ['musicianship', 'improvisation'] },
    { id: 'musicianship/phrase-development', name: 'Phrase development', desc: 'Repeat, vary, transform and develop motifs.', branch: ['musicianship', 'improvisation'] },
    { id: 'musicianship/tension-release', name: 'Tension and release', desc: 'Create and resolve melodic and harmonic tension intentionally.', branch: ['musicianship', 'improvisation'] },
    { id: 'musicianship/improvisational-architecture', name: 'Improvisational architecture', desc: 'Develop a coherent improvisational arc over short and long durations.', branch: ['musicianship', 'improvisation'] },
    { id: 'musicianship/expressive-resolution', name: 'Expressive resolution', desc: 'Resolve outside notes intentionally through movement, bends, slides and the like.', branch: ['musicianship', 'improvisation'] },
    { id: 'musicianship/rhythmic-feel', name: 'Rhythmic feel', desc: 'Maintain pulse and intentionally manipulate rhythmic placement and feel.', branch: ['musicianship', 'rhythm'] },
    { id: 'musicianship/cross-instrument-transfer', name: 'Cross-instrument transfer', desc: 'Transfer musical mental models among instruments.', branch: ['musicianship', 'transfer'] },
    { id: 'stringed-instrument/movable-fretboard-fluency', name: 'Movable fretboard fluency', desc: 'Move freely across fretboard positions.', branch: ['instrument', 'strings'] },
    { id: 'stringed-instrument/triad-inversions', name: 'Triad inversions', desc: 'Use root, first and second inversion shapes up the neck.', branch: ['instrument', 'strings'] },
    { id: 'stringed-instrument/scale-shape-navigation', name: 'Scale shape navigation', desc: 'Navigate scale shapes and connect them across positions.', branch: ['instrument', 'strings'] },
    { id: 'stringed-instrument/chord-scale-overlay', name: 'Chord-scale overlay', desc: 'Map chord and triad shapes onto soloing shapes.', branch: ['instrument', 'strings'] }
  ];
  // Plain-English names for the branch areas the panel groups by.
  var AREA_NAMES = { ear: 'Ear', harmony: 'Harmony', improvisation: 'Improvisation', rhythm: 'Rhythm and feel', transfer: 'Transfer', composition: 'Composition' };

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

  // The stable id of THIS device (minted on first use; tests pass `opts.device`).
  function deviceId(store, opts) {
    if (opts && opts.device) return String(opts.device);
    store = store || defaultStore();
    if (!store) return 'anon';
    try {
      var v = store.getItem(DEVICE_KEY);
      if (v) return v;
      v = 'dv_' + uuid().slice(0, 8);
      store.setItem(DEVICE_KEY, v);
      return v;
    } catch (e) { return 'anon'; }
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
    if (obj.id != null && typeof obj.id !== 'string') return { ok: false, reason: 'id must be a string' };
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

  // Every assessment ever made about ONE competency, latest first. A superseded
  // assessment is HISTORY, never deleted: status() answers "now", history()
  // answers "how did we get here". (A participant replacing its own record by
  // id is that participant's choice; another participant's record is never
  // rewritten by anyone.)
  function history(doc, competency) {
    return arr(doc && doc.assessments).filter(function (a) { return a && a.competency === competency; })
      .sort(function (a, b) { return later(a.at, b.at) ? -1 : 1; });
  }
  function shortDate(iso) {
    var t = Date.parse(String(iso || ''));
    if (isNaN(t)) return '';
    var d = new Date(t), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return M[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }
  var METHOD_WORDS = { 'self-report': 'self-reported', 'interview': 'from a guided interview', 'observed': 'observed', 'coach': 'coach-assessed', 'inferred': 'inferred' };
  // One plain-English line for a competency's CURRENT state - what the panel
  // and a coach say out loud. Never a number for absence.
  //   "advanced - self-reported, high confidence, Sep 13"
  //   "40 of 100 - coach-assessed, Sep 13"
  //   "not yet assessed"
  function describe(doc, competency) {
    var a = latestAssessment(doc, competency);
    if (!a) return 'not yet assessed';
    var v = (a.value === null || a.value === undefined) ? '' : String(a.value);
    if (typeof a.value === 'number' && a.scale && /^0-(\d+)$/.test(String(a.scale))) v = a.value + ' of ' + String(a.scale).slice(2);
    var bits = [];
    if (METHOD_WORDS[a.method]) bits.push(METHOD_WORDS[a.method]); else if (a.method) bits.push(String(a.method));
    if (a.confidence) bits.push(String(a.confidence) + ' confidence');
    var when = shortDate(a.at); if (when) bits.push(when);
    return (v || 'assessed') + (bits.length ? ' - ' + bits.join(', ') : '');
  }
  // A deep link is rendered by the panel ONLY when it points into this app -
  // a hand-back is a file anyone could have written, and a foreign tappable
  // link from it is exactly what interaction-safety forbids.
  function appLink(url) {
    if (typeof url !== 'string') return null;
    return url.indexOf(APP_URL.replace(/play\/$/, '')) === 0 ? url : null;
  }

  // ---- the panel's data: the taxonomy grouped the way a musician thinks ----
  // musicianship (by area) / instruments (by framework or branch) / crafts /
  // other (anything with a branch this app cannot place). Every competency the
  // document names lands in exactly one group - including ids the app has never
  // shipped (a coach's `bass/groove-pocket` shows under "Bass"), so a musician's
  // 28 years on an instrument the app does not model are visible, not lost.
  // `progression` (Competency.load()) lets instrument rows also say what the
  // app itself has observed. Pure: no DOM, no storage.
  function summary(doc, frameworks, progression) {
    var d = normalize(doc || blank());
    frameworks = arr(frameworks); progression = isObj(progression) ? progression : {};
    var fwById = {}; frameworks.forEach(function (fw) { fwById[fw.id] = fw; });
    var counters = {};
    Object.keys(progression).forEach(function (fwId) {
      arr(progression[fwId] && progression[fwId].competencies).forEach(function (c) {
        if (c && c.id) counters[competencyId(fwId, c.id)] = c;
      });
    });
    var groups = { musicianship: {}, instruments: {}, crafts: {}, other: {} };
    function titleCase(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '); }
    function put(bucket, key, label, entry) {
      if (!groups[bucket][key]) groups[bucket][key] = { id: key, name: label, competencies: [], assessed: 0, unassessed: 0, observed: 0 };
      var g = groups[bucket][key];
      g.competencies.push(entry);
      if (entry.assessment) g.assessed++; else g.unassessed++;
      if (entry.counter && (entry.counter.evidence_count || 0) > 0) g.observed++;
    }
    d.competencies.forEach(function (c) {
      if (!c || !c.id) return;
      var a = latestAssessment(d, c.id);
      var ns = String(c.id).split('/')[0];
      var br = arr(c.branch);
      var entry = { id: c.id, name: c.name || c.id, desc: c.desc || '', branch: br.slice(),
        assessment: a || null, status: describe(d, c.id), counter: counters[c.id] || null };
      if (br[0] === 'musicianship' || ns === 'musicianship') {
        var area = br[1] || 'general';
        put('musicianship', area, AREA_NAMES[area] || titleCase(area), entry);
      } else if (br[0] === 'instrument') {
        var key = br[2] || ns;
        var fw = fwById[key];
        put('instruments', key, fw ? fw.name : (key === 'strings' ? 'Stringed instrument' : titleCase(key)), entry);
      } else if (br[0] === 'craft') {
        var ck = br[1] || ns, cfw = fwById[ck];
        put('crafts', ck, cfw ? cfw.name : titleCase(ck), entry);
      } else {
        put('other', ns, (fwById[ns] && fwById[ns].name) || titleCase(ns), entry);
      }
    });
    // Branch-level claims (an assessment whose subject is a framework/branch id,
    // e.g. the app's own `stringed-instrument` self-report) attach to the group.
    Object.keys(groups.instruments).forEach(function (k) {
      var g = groups.instruments[k];
      var lvl = latestAssessment(d, k) || (k === 'strings' ? latestAssessment(d, 'stringed-instrument') : null);
      if (lvl) { g.assessment = lvl; g.status = describe(d, lvl.competency); }
    });
    function list(o) { return Object.keys(o).map(function (k) { return o[k]; }); }
    // Instruments: the app's own frameworks first (in FRAMEWORKS order, the
    // strings fundamentals ahead of the instruments under them), then every
    // instrument only the profile knows, in the order the document names them.
    var fwOrder = {}; frameworks.forEach(function (fw, i) { fwOrder[fw.id] = i; });
    var instruments = list(groups.instruments).sort(function (a, b) {
      var ia = a.id in fwOrder ? fwOrder[a.id] : 1e9, ib = b.id in fwOrder ? fwOrder[b.id] : 1e9;
      return ia - ib;
    });
    var ms = list(groups.musicianship), msAssessed = ms.reduce(function (n, g) { return n + g.assessed; }, 0);
    var focus = (d.plan && typeof d.plan.focus === 'string') ? d.plan.focus : '';
    var open = arr(d.plan && d.plan.items).filter(function (i) { return i && i.statement && i.status !== 'done'; });
    return {
      musicianship: ms, instruments: instruments, crafts: list(groups.crafts), other: list(groups.other),
      musicianshipAssessed: msAssessed,
      goals: d.goals.filter(function (g) { return g && g.statement; }),
      focus: focus, planItems: open,
      evidence: d.evidence.slice()
    };
  }

  // The panel's headline - "what kind of musician am I?" in a few short
  // lines, from summary(). A band answer for musicianship is the value most
  // of its assessments agree on (strings only - a coach's 0-100 numbers are
  // never averaged into a word); an instrument line is its branch-level claim
  // when one exists, else its assessed/unassessed split, plus what the app
  // itself has observed. Absence stays "not yet assessed" everywhere.
  function headline(sm) {
    var lines = [];
    var msTotal = sm.musicianship.reduce(function (n, g) { return n + g.competencies.length; }, 0);
    if (sm.musicianshipAssessed > 0) {
      var votes = {};
      sm.musicianship.forEach(function (g) { g.competencies.forEach(function (c) {
        if (c.assessment && typeof c.assessment.value === 'string') votes[c.assessment.value] = (votes[c.assessment.value] || 0) + 1;
      }); });
      var best = Object.keys(votes).sort(function (a, b) { return votes[b] - votes[a]; })[0];
      lines.push('Musicianship: ' + (best ? best + ' - ' : '') + sm.musicianshipAssessed + ' of ' + msTotal + ' assessed');
    } else {
      lines.push('Musicianship: not yet assessed');
    }
    sm.instruments.forEach(function (g) {
      var s;
      if (g.assessment) s = String(g.assessment.value);
      else if (g.assessed) {
        // No branch-level claim: the band its assessed competencies agree on
        // (string values only), qualified when only some are assessed.
        var v = {}; g.competencies.forEach(function (c) { if (c.assessment && typeof c.assessment.value === 'string') v[c.assessment.value] = (v[c.assessment.value] || 0) + 1; });
        var top = Object.keys(v).sort(function (a, b) { return v[b] - v[a]; })[0];
        var split = g.assessed + ' of ' + g.competencies.length + ' assessed';
        s = top ? (g.assessed === g.competencies.length ? top : top + ' - ' + split) : split;
      } else s = 'not yet assessed';
      if (g.observed) s += ' - ' + g.observed + ' observed in the app';
      lines.push(g.name + ': ' + s);
    });
    return lines;
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
  // Fold every note-less routine app stamp of one action into ONE row with the
  // latest `at`. Earlier builds appended a row per export; the first collapse
  // only ever folded into the first match, so a lifelong document could carry
  // three `export` rows (observed on the operator's own export). Idempotent.
  function collapseRoutine(doc) {
    var keep = [], seen = {};
    arr(doc.provenance).forEach(function (p) {
      if (!p) return;
      if (p.source === APP_ID && ROUTINE_ACTIONS[p.action] && !p.note) {
        if (seen[p.action]) { if (later(p.at, seen[p.action].at)) seen[p.action].at = p.at; return; }
        seen[p.action] = p;
      }
      keep.push(p);
    });
    doc.provenance = keep;
    return doc;
  }
  function pushProvenance(doc, entry, index) {
    if (!entry) return;
    if (entry.source === APP_ID && ROUTINE_ACTIONS[entry.action] && !entry.note) {
      collapseRoutine(doc);
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
  //           selfReport: GuidanceLevel.get() | null, selfReportAt: GuidanceLevel.at() | null,
  //           version: build stamp, now, device }
  // - participants: this app, with the sections it understands + deep links
  // - competencies: the taxonomy, namespaced + branched, source app:music
  // - evidence: ONE app-progression record per framework that has any
  //   evidence, modality COMPOSE (the app observes composing; it has never
  //   heard the musician play - even the "*-repertoire" counters are compose
  //   evidence). Deterministic PER-DEVICE ids (`ev:app:music:<device>:
  //   progression:<framework>`, `at` = export time) so a re-export from THIS
  //   device replaces its own record and another device's record survives.
  // - assessments: the ONE self-report the app holds (guidance level),
  //   branch-level, band-3, modality unspecified. Nothing derived from counters.
  function compose(doc, inputs) {
    inputs = inputs || {};
    var now = inputs.now || nowIso();
    var d = normalize(doc || blank({ now: now }));
    var frameworks = arr(inputs.frameworks);
    var progression = isObj(inputs.progression) ? inputs.progression : {};
    var device = inputs.device ? String(inputs.device) : 'anon';

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
    // The profile-native floor (global musicianship + transferable strings
    // competencies): names the app knows, never observes. An id another
    // participant already wrote keeps THEIR record (rule 2).
    CORE_TAXONOMY.forEach(function (c) {
      if (compById[c.id]) return;
      d.competencies.push({ id: c.id, name: c.name, desc: c.desc, branch: c.branch.slice(), source: APP_ID });
      compById[c.id] = true;
    });

    // Retire this app's OWN legacy records: builds before the per-device ids
    // wrote `ev:app:music:progression:<fw>` with no `device`. They are the
    // app's records (it is the authority on them - replaceById doctrine), the
    // exporting device re-emits the same counters below, and leaving them
    // would show one ladder twice. Nothing another participant wrote is touched.
    d.evidence = d.evidence.filter(function (e) {
      return !(e && e.source === APP_ID && e.kind === 'app-progression' && !e.device
        && /^ev:app:music:progression:/.test(String(e.id || '')));
    });

    Object.keys(progression).forEach(function (fwId) {
      var p = progression[fwId];
      if (!p || !Array.isArray(p.competencies)) return;
      var counters = p.competencies.filter(function (c) { return c && (c.evidence_count || 0) > 0; });
      if (!counters.length) return; // nothing observed -> no record (absence stays absent)
      replaceById(d.evidence, {
        id: 'ev:' + APP_ID + ':' + device + ':progression:' + fwId,
        at: now,
        source: APP_ID,
        device: device,
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
          // `at` = when the musician TAPPED (GuidanceLevel.at()), not when this
          // export ran - a claim is dated by when it was made, so a coach's later
          // interview claim on the same branch correctly supersedes it.
          at: inputs.selfReportAt || now, source: APP_ID, evidence: [],
          note: 'The musician\'s own answer to the app\'s one-time experience-level ask (beginner | intermediate | advanced).'
        });
      }
    }

    pushProvenance(d, { source: APP_ID, at: now, action: 'export' });
    d.updated = now;
    return d;
  }
  // The taxonomy the app itself contributes on export (frameworks + the floor).
  function taxonomySize(frameworks) {
    return arr(frameworks).reduce(function (n, fw) { return n + arr(fw.competencies).length; }, 0) + CORE_TAXONOMY.length;
  }

  // "Nothing of the PERSON's in here": only the app's own participant entry
  // and the taxonomy. Such a document is never exported or persisted - an
  // empty device must not ship a bundle or flip the panel's first-start lead.
  function isEmpty(doc) {
    var d = normalize(doc);
    if (d.assessments.length || d.evidence.length || d.goals.length || d.preferences.length || d.plan) return false;
    if (d.participants.some(function (p) { return p && p.id !== APP_ID; })) return false;
    if (Object.keys(d.extensions).length) return false;
    return !Object.keys(d).some(function (k) { return KNOWN_KEYS.indexOf(k) < 0; });
  }

  // Export: compose what we know into the stored profile, persist, return
  // pretty JSON (the zip's profile.json). Null - and nothing persisted - when
  // the document would carry nothing of the person's (see isEmpty).
  function exportJson(store, inputs) {
    inputs = inputs || {};
    if (!inputs.device) inputs.device = deviceId(store, inputs);
    var d = compose(load(store, inputs.now ? { now: inputs.now } : undefined), inputs);
    if (isEmpty(d)) return null;
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
    // A hand-back with NO id is addressed to the local profile - it takes the
    // local id rather than having a random one minted for it (which would leave
    // a fabricated "merged into" provenance row on every such import).
    var local = loadStored(store) || blank({ id: parsed.id, now: opts && opts.now });
    if (!parsed.id) { parsed = clone(parsed); parsed.id = local.id; }
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

  // NOTE: the app never re-ingests its own progression counters from a
  // profile - `kind` and `source` are plain strings any participant can write,
  // so absorbing the numbers would let an edited hand-back raise the Skills
  // bars for competencies nothing observed (the exact seam this document
  // guards). Device-to-device transfer of the counters is the backup
  // envelope's job (byte-faithful restore).

  var API = {
    SCHEMA: SCHEMA, CONTRACT_ID: CONTRACT_ID, STORAGE_KEY: STORAGE_KEY, DEVICE_KEY: DEVICE_KEY, APP_ID: APP_ID,
    APP_URL: APP_URL, CAPABILITIES_URL: CAPABILITIES_URL,
    CONTRACT: CONTRACT, UNDERSTANDS: UNDERSTANDS, METHODS: METHODS, MODALITIES: MODALITIES, BRANCHES: BRANCHES,
    CONFIDENCE: CONFIDENCE, EVIDENCE_KINDS: EVIDENCE_KINDS, PLAN_KINDS: PLAN_KINDS,
    CORE_TAXONOMY: CORE_TAXONOMY, AREA_NAMES: AREA_NAMES,
    // pure
    competencyId: competencyId, branchFor: branchFor, blank: blank, validate: validate, normalize: normalize,
    merge: merge, compose: compose, status: status, latestAssessment: latestAssessment, isEmpty: isEmpty,
    history: history, describe: describe, summary: summary, headline: headline, appLink: appLink, taxonomySize: taxonomySize,
    collapseRoutine: collapseRoutine, newId: newId, deviceId: deviceId,
    // storage-backed
    load: load, loadStored: loadStored, save: save, hasData: hasData,
    exportJson: exportJson, importJson: importJson
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MusicianProfile = API;

})(typeof window !== 'undefined' ? window : this);
