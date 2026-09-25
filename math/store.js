/* =====================================================================
 * store.js  -  localStorage persistence for the Math app: player profiles,
 * per-fact stats, session history, prefs, and schema migration.
 * ---------------------------------------------------------------------
 * Persistence only - no engine.js import, no DOM. Every method is bound to
 * a Storage-LIKE object (real localStorage, or a fake in tests) passed to
 * create(storage), so nothing here is global (same dependency-injection
 * shape the contract asks for; distinct from the shared/*.js convention of
 * reaching for a bare `localStorage` global - Math profiles need to be
 * testable end-to-end in Node with zero DOM).
 *
 * Every READ is wrapped in try/catch and degrades to a safe default -
 * corrupt JSON, a missing key, or a value of the wrong shape all read as
 * "nothing here yet", never throw. Every WRITE is wrapped in try/catch and
 * returns false on failure (quota exceeded, storage blocked) rather than
 * throwing - callers can surface "couldn't save" without a crash.
 *
 * Keys are namespaced under `math.` (mirrors Music's `music.` prefix), so
 * shared/backup.js's OWNED_PREFIXES sweep intentionally does NOT capture
 * them yet (see docs/plans/goal-math-app-v1-20260925.md "Deferred" - Math
 * data joining Music's Backup/Restore is future work). All changes here are
 * additive-only per that plan; a future breaking change bumps
 * SCHEMA_VERSION and adds the matching MIGRATIONS[n] step, same pattern as
 * shared/backup.js and shared/storage-migrate.js.
 *
 * UMD shape like music/shared/theme.js: window.MathStore in the browser,
 * module.exports in Node.
 * ===================================================================== */
(function (root) {
  'use strict';

  // Bump ONLY for a stored-shape change old readers can't absorb, and add
  // the matching MIGRATIONS[n] step in the same change. Empty at v1 - the
  // seam exists for the next breaking change, not used yet.
  var SCHEMA_VERSION = 1;

  var KEYS = {
    profiles: 'math.profiles.v1',
    prefs: 'math.prefs.v1',
    schema: 'math.schema.v1',
    facts: function (id) { return 'math.facts.' + id + '.v1'; },
    sessions: function (id) { return 'math.sessions.' + id + '.v1'; }
  };

  var MAX_SESSIONS = 300;

  // Ordered migrations. MIGRATIONS[n] upgrades the live storage FROM (n-1)
  // TO n (mutates `storage` directly, like storage-migrate.js's registry -
  // there is no separate data-map copy here). Empty today.
  var MIGRATIONS = {};

  // id = 'p' + base36 timestamp + base36 random tail - short, sortable-ish,
  // collision-safe enough for a handful of local player profiles.
  function genId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Profile.name is always trimmed, capped at 20 chars, and never empty.
  function normalizeName(name) {
    var trimmed = (typeof name === 'string' ? name : '').trim();
    if (!trimmed) return 'Player';
    return trimmed.length > 20 ? trimmed.slice(0, 20) : trimmed;
  }

  function indexOfProfile(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return i;
    }
    return -1;
  }

  function create(storage) {

    function readJSON(key, fallback) {
      try {
        var raw = storage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    }

    function writeJSON(key, value) {
      try { storage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }

    function removeItemSafe(key) {
      try { storage.removeItem(key); } catch (e) { /* best effort */ }
    }

    // { active, list } - corrupt/missing data -> { active: null, list: [] };
    // an active id no longer present in list self-heals to the first
    // profile (or null when the list is empty).
    function getProfiles() {
      var raw = readJSON(KEYS.profiles, null);
      var list = (raw && Array.isArray(raw.list)) ? raw.list : [];
      var active = (raw && typeof raw.active === 'string') ? raw.active : null;
      if (indexOfProfile(list, active) === -1) active = list.length ? list[0].id : null;
      return { active: active, list: list };
    }

    function saveProfiles(state) { return writeJSON(KEYS.profiles, state); }

    function addProfile(opts) {
      opts = opts || {};
      var state = getProfiles();
      var profile = {
        id: genId(),
        name: normalizeName(opts.name),
        color: opts.color,
        cfg: opts.cfg,
        created: Date.now()
      };
      state.list.push(profile);
      if (state.list.length === 1) state.active = profile.id; // first profile becomes active
      saveProfiles(state);
      return profile;
    }

    // Shallow merge of name/color/cfg only - id and created are immutable.
    function updateProfile(id, patch) {
      var state = getProfiles();
      var idx = indexOfProfile(state.list, id);
      if (idx === -1) return null;
      var profile = state.list[idx];
      var next = { id: profile.id, name: profile.name, color: profile.color, cfg: profile.cfg, created: profile.created };
      if (patch && typeof patch === 'object') {
        if (Object.prototype.hasOwnProperty.call(patch, 'name')) next.name = normalizeName(patch.name);
        if (Object.prototype.hasOwnProperty.call(patch, 'color')) next.color = patch.color;
        if (Object.prototype.hasOwnProperty.call(patch, 'cfg')) next.cfg = patch.cfg;
      }
      state.list[idx] = next;
      saveProfiles(state);
      return next;
    }

    function setActive(id) {
      var state = getProfiles();
      if (indexOfProfile(state.list, id) === -1) return false;
      state.active = id;
      return saveProfiles(state);
    }

    function getActive() {
      var state = getProfiles();
      var idx = indexOfProfile(state.list, state.active);
      return idx === -1 ? null : state.list[idx];
    }

    // Snapshot the profile + its facts/sessions for undo, then delete it.
    // If it was the active profile, activation falls back the same way
    // getProfiles() self-heals (first remaining profile, or null).
    function removeProfile(id) {
      var state = getProfiles();
      var idx = indexOfProfile(state.list, id);
      if (idx === -1) return null;
      var profile = state.list[idx];
      var wasActive = state.active === id;
      var snapshot = { profile: profile, index: idx, facts: getFacts(id), sessions: getSessions(id), wasActive: wasActive };
      state.list.splice(idx, 1);
      if (wasActive) state.active = state.list.length ? state.list[0].id : null;
      saveProfiles(state);
      removeItemSafe(KEYS.facts(id));
      removeItemSafe(KEYS.sessions(id));
      return snapshot; // returned regardless of write success - the caller needs it for undo either way
    }

    // Re-insert a removeProfile() snapshot at its original index, restore
    // its facts/sessions keys, and re-activate it if it was active before.
    function restoreProfile(snapshot) {
      if (!snapshot || !snapshot.profile) return false;
      var state = getProfiles();
      // Idempotent: a second restore (double-tapped Undo) must not add a
      // duplicate id - deleting either copy later would wipe the other's data.
      for (var d = 0; d < state.list.length; d++) if (state.list[d].id === snapshot.profile.id) return false;
      var idx = Math.max(0, Math.min(snapshot.index, state.list.length));
      state.list.splice(idx, 0, snapshot.profile);
      if (snapshot.wasActive) state.active = snapshot.profile.id;
      var ok1 = saveProfiles(state);
      var ok2 = saveFacts(snapshot.profile.id, snapshot.facts || {});
      var ok3 = writeJSON(KEYS.sessions(snapshot.profile.id), snapshot.sessions || []);
      return !!(ok1 && ok2 && ok3);
    }

    function getFacts(id) {
      var v = readJSON(KEYS.facts(id), null);
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    }

    function saveFacts(id, stats) { return writeJSON(KEYS.facts(id), stats || {}); }

    // Oldest first - addSession() always appends, so storage order IS
    // chronological order; nothing to sort here.
    function getSessions(id) {
      var v = readJSON(KEYS.sessions(id), null);
      return Array.isArray(v) ? v : [];
    }

    // prevBest is computed BEFORE the new session is inserted, scoped to
    // sessions sharing both cfgKey AND mode. A practice-mode session never
    // counts as (or against) a best - it's untimed with no penalty, so
    // "best" is meaningless for it.
    function addSession(id, session, isBetterFn) {
      var sessions = getSessions(id);
      var isPractice = !!(session && session.mode === 'practice');
      var prevBest = null;
      if (!isPractice) {
        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i];
          if (!s || s.cfgKey !== session.cfgKey || s.mode !== session.mode) continue;
          if (!prevBest || isBetterFn(s, prevBest)) prevBest = s;
        }
      }
      var isBest = !isPractice && !!isBetterFn(session, prevBest);
      sessions.push(session);
      if (sessions.length > MAX_SESSIONS) sessions = sessions.slice(sessions.length - MAX_SESSIONS); // drop oldest
      writeJSON(KEYS.sessions(id), sessions);
      return { isBest: isBest, prevBest: prevBest };
    }

    // Practice never has a best (see addSession).
    function best(id, cfgKey, mode, isBetterFn) {
      if (mode === 'practice') return null;
      var sessions = getSessions(id);
      var result = null;
      for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        if (!s || s.cfgKey !== cfgKey || s.mode !== mode) continue;
        if (!result || isBetterFn(s, result)) result = s;
      }
      return result;
    }

    function resetProgress(id) {
      var snapshot = { facts: getFacts(id), sessions: getSessions(id) };
      saveFacts(id, {});
      writeJSON(KEYS.sessions(id), []);
      return snapshot;
    }

    function restoreProgress(id, snapshot) {
      if (!snapshot) return false;
      var ok1 = saveFacts(id, snapshot.facts || {});
      var ok2 = writeJSON(KEYS.sessions(id), snapshot.sessions || []);
      return !!(ok1 && ok2);
    }

    function getPrefs() {
      var v = readJSON(KEYS.prefs, null);
      return {
        sound: (v && typeof v.sound === 'boolean') ? v.sound : true,
        haptics: (v && typeof v.haptics === 'boolean') ? v.haptics : true
      };
    }

    function setPrefs(patch) {
      var next = getPrefs();
      if (patch && typeof patch === 'object') {
        if (Object.prototype.hasOwnProperty.call(patch, 'sound')) next.sound = !!patch.sound;
        if (Object.prototype.hasOwnProperty.call(patch, 'haptics')) next.haptics = !!patch.haptics;
      }
      writeJSON(KEYS.prefs, next);
      return next;
    }

    // Reads the schema marker (missing -> already-current, nothing to run),
    // applies any pending MIGRATIONS[n] steps up to SCHEMA_VERSION (none
    // registered yet), stamps the marker, and returns the version landed on.
    // Never throws - a blocked/quota-full write just leaves the stamp stale
    // for the next call to retry, same fail-soft contract as
    // shared/storage-migrate.js's run().
    function migrate() {
      var from = SCHEMA_VERSION;
      try {
        var raw = storage.getItem(KEYS.schema);
        if (raw != null) {
          var n = parseInt(raw, 10);
          if (!isNaN(n) && n >= 0) from = n;
        }
      } catch (e) { /* defensive read - treat as already current */ }
      var v = from;
      while (v < SCHEMA_VERSION) {
        v++;
        var step = MIGRATIONS[v];
        if (typeof step === 'function') {
          try { step(storage); } catch (e2) { /* best effort - next call retries */ }
        }
      }
      try { storage.setItem(KEYS.schema, String(SCHEMA_VERSION)); } catch (e3) { /* quota - best effort */ }
      return SCHEMA_VERSION;
    }

    return {
      getProfiles: getProfiles,
      addProfile: addProfile,
      updateProfile: updateProfile,
      setActive: setActive,
      getActive: getActive,
      removeProfile: removeProfile,
      restoreProfile: restoreProfile,
      getFacts: getFacts,
      saveFacts: saveFacts,
      getSessions: getSessions,
      addSession: addSession,
      best: best,
      resetProgress: resetProgress,
      restoreProgress: restoreProgress,
      getPrefs: getPrefs,
      setPrefs: setPrefs,
      migrate: migrate
    };
  }

  var api = { SCHEMA_VERSION: SCHEMA_VERSION, KEYS: KEYS, MAX_SESSIONS: MAX_SESSIONS, create: create };
  if (root) root.MathStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
