/* =====================================================================
 * math-store.test.js  -  unit tests for math/store.js (localStorage
 * persistence for the Math app: profiles, per-fact stats, sessions, prefs).
 * Run: node test/math-store.test.js   (no deps; pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var MathStore = require('../math/store.js');

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

/* ---------- a minimal Storage-like fake (Map-backed) ---------- */
function fakeStore(seed) {
  var map = {};
  if (seed) Object.keys(seed).forEach(function (k) { map[k] = seed[k]; });
  return {
    get length() { return Object.keys(map).length; },
    key: function (i) { return Object.keys(map)[i]; },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function (k, v) { map[k] = String(v); },
    removeItem: function (k) { delete map[k]; },
    _map: map
  };
}

/* A variant whose setItem always throws (QuotaExceededError). getItem/removeItem
 * behave normally so a seeded, already-persisted profile can still be READ - only
 * the WRITE path fails, mirroring a device with a full localStorage quota. */
function throwingStore(seed) {
  var map = {};
  if (seed) Object.keys(seed).forEach(function (k) { map[k] = seed[k]; });
  return {
    get length() { return Object.keys(map).length; },
    key: function (i) { return Object.keys(map)[i]; },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem: function () { var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; },
    removeItem: function (k) { delete map[k]; }
  };
}

// race/sprint-shaped comparator: lower totalMs wins (mirrors MathEngine.isBetter
// for race/practice). Injected - store.js never imports the engine.
function isBetterRace(a, b) {
  if (!b) return true;
  return a.totalMs < b.totalMs;
}

/* ================= corrupt / wrong-shape data -> safe defaults ================= */

test('syntactically invalid JSON on every key reads as its safe default', function () {
  var store = fakeStore({
    'math.profiles.v1': 'not-json{',
    'math.facts.p1.v1': 'not-json{',
    'math.sessions.p1.v1': 'not-json{',
    'math.prefs.v1': 'not-json{'
  });
  var ms = MathStore.create(store);
  assert.deepStrictEqual(ms.getProfiles(), { active: null, list: [] });
  assert.deepStrictEqual(ms.getFacts('p1'), {});
  assert.deepStrictEqual(ms.getSessions('p1'), []);
  assert.deepStrictEqual(ms.getPrefs(), { sound: true, haptics: true });
});

test('well-formed JSON of the wrong shape also reads as the safe default (no crash)', function () {
  var store = fakeStore({
    'math.profiles.v1': '"just a string"',
    'math.facts.p1.v1': '[1,2,3]',       // array where an object is expected
    'math.sessions.p1.v1': '{"a":1}',    // object where an array is expected
    'math.prefs.v1': '[1,2,3]'
  });
  var ms = MathStore.create(store);
  assert.deepStrictEqual(ms.getProfiles(), { active: null, list: [] });
  assert.deepStrictEqual(ms.getFacts('p1'), {});
  assert.deepStrictEqual(ms.getSessions('p1'), []);
  assert.deepStrictEqual(ms.getPrefs(), { sound: true, haptics: true });
});

test('missing keys read as the safe default', function () {
  var ms = MathStore.create(fakeStore());
  assert.deepStrictEqual(ms.getProfiles(), { active: null, list: [] });
  assert.deepStrictEqual(ms.getFacts('p1'), {});
  assert.deepStrictEqual(ms.getSessions('p1'), []);
  assert.deepStrictEqual(ms.getPrefs(), { sound: true, haptics: true });
});

/* ================= profile name normalization ================= */

test('addProfile trims the name, caps it at 20 chars, and empty/whitespace becomes Player', function () {
  var ms = MathStore.create(fakeStore());
  assert.strictEqual(ms.addProfile({ name: '  Alice  ' }).name, 'Alice');
  assert.strictEqual(ms.addProfile({ name: '' }).name, 'Player');
  assert.strictEqual(ms.addProfile({ name: '   ' }).name, 'Player');
  assert.strictEqual(ms.addProfile({}).name, 'Player');
  var longName = 'ThisNameIsWayTooLongForAProfile'; // 31 chars
  var p = ms.addProfile({ name: longName });
  assert.strictEqual(p.name.length, 20);
  assert.strictEqual(p.name, longName.slice(0, 20));
});

/* ================= active-profile lifecycle ================= */

test('the first profile added becomes active automatically; later ones do not', function () {
  var ms = MathStore.create(fakeStore());
  var p1 = ms.addProfile({ name: 'A' });
  assert.strictEqual(ms.getProfiles().active, p1.id);
  ms.addProfile({ name: 'B' });
  assert.strictEqual(ms.getProfiles().active, p1.id); // still p1
});

test('setActive switches the active profile; getActive returns it; an unknown id fails without changing state', function () {
  var ms = MathStore.create(fakeStore());
  // color/cfg given explicitly (not left undefined) so the in-memory addProfile()
  // result compares equal to what getActive() reads back through a JSON round-trip
  // (JSON.stringify drops undefined-valued keys, which is correct/expected here).
  var p1 = ms.addProfile({ name: 'A', color: '#111', cfg: {} });
  var p2 = ms.addProfile({ name: 'B', color: '#222', cfg: {} });
  assert.strictEqual(ms.setActive(p2.id), true);
  assert.deepStrictEqual(ms.getActive(), p2);
  assert.strictEqual(ms.setActive('nope'), false);
  assert.deepStrictEqual(ms.getActive(), p2); // unchanged
  assert.strictEqual(p1.id !== p2.id, true);
});

test('getActive returns null when there is no active profile', function () {
  var ms = MathStore.create(fakeStore());
  assert.strictEqual(ms.getActive(), null);
});

test('an active id pointing at a profile no longer in the list falls back to the first remaining profile, or null when the list is empty', function () {
  var withProfiles = fakeStore({ 'math.profiles.v1': JSON.stringify({ active: 'pXXX', list: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] }) });
  assert.strictEqual(MathStore.create(withProfiles).getProfiles().active, 'p1');

  var empty = fakeStore({ 'math.profiles.v1': JSON.stringify({ active: 'pXXX', list: [] }) });
  assert.strictEqual(MathStore.create(empty).getProfiles().active, null);
});

/* ================= updateProfile ================= */

test('updateProfile shallow-merges name/color/cfg only; id/created are immutable; unknown id returns null', function () {
  var ms = MathStore.create(fakeStore());
  var p = ms.addProfile({ name: 'A', color: '#111', cfg: { ops: ['+'] } });

  var updated = ms.updateProfile(p.id, { color: '#222' });
  assert.strictEqual(updated.id, p.id);
  assert.strictEqual(updated.created, p.created);
  assert.strictEqual(updated.name, 'A');                 // untouched
  assert.strictEqual(updated.color, '#222');              // merged
  assert.deepStrictEqual(updated.cfg, { ops: ['+'] });    // untouched

  var updated2 = ms.updateProfile(p.id, { name: '  Bob  ', cfg: { ops: ['x'] } });
  assert.strictEqual(updated2.name, 'Bob');                // normalized like addProfile
  assert.deepStrictEqual(updated2.cfg, { ops: ['x'] });

  assert.strictEqual(ms.updateProfile('nope', { name: 'X' }), null);
});

/* ================= removeProfile / restoreProfile ================= */

test('removeProfile snapshots profile+index+facts+sessions+wasActive, deletes the keys, and falls back active; restoreProfile puts it all back at the same index', function () {
  var ms = MathStore.create(fakeStore());
  var p1 = ms.addProfile({ name: 'A' });
  var p2 = ms.addProfile({ name: 'B' });
  ms.addProfile({ name: 'C' });
  ms.setActive(p2.id);

  var facts = { 'x:2:3': { n: 1, miss: 0, box: 1, ms: 900, last: 123 } };
  ms.saveFacts(p2.id, facts);
  var session = { ts: 1, mode: 'race', cfgKey: 'raceA', totalMs: 5000 };
  ms.addSession(p2.id, session, isBetterRace);

  var snap = ms.removeProfile(p2.id);
  assert.ok(snap);
  assert.strictEqual(snap.index, 1);
  assert.strictEqual(snap.wasActive, true);
  assert.strictEqual(snap.profile.id, p2.id);
  assert.deepStrictEqual(snap.facts, facts);
  assert.strictEqual(snap.sessions.length, 1);

  // profile + its keys are gone; active fell back to the first remaining
  assert.strictEqual(ms.getProfiles().list.length, 2);
  assert.deepStrictEqual(ms.getFacts(p2.id), {});
  assert.deepStrictEqual(ms.getSessions(p2.id), []);
  assert.strictEqual(ms.getProfiles().active, p1.id);

  assert.strictEqual(ms.restoreProfile(snap), true);
  var restored = ms.getProfiles();
  assert.strictEqual(restored.list.length, 3);
  assert.strictEqual(restored.list[1].id, p2.id);   // back at its original index
  assert.strictEqual(restored.active, p2.id);        // re-activated
  assert.deepStrictEqual(ms.getFacts(p2.id), facts);
  assert.strictEqual(ms.getSessions(p2.id).length, 1);

  assert.strictEqual(ms.removeProfile('nope'), null);
  assert.strictEqual(ms.restoreProfile(null), false);
});

/* ================= facts ================= */

test('saveFacts/getFacts round-trip', function () {
  var ms = MathStore.create(fakeStore());
  var stats = { '+:1:2': { n: 3, miss: 1, box: 2, ms: 1200, last: 555 } };
  assert.strictEqual(ms.saveFacts('p1', stats), true);
  assert.deepStrictEqual(ms.getFacts('p1'), stats);
  assert.deepStrictEqual(ms.getFacts('unknown'), {});
});

/* ================= sessions / addSession / best ================= */

test('addSession computes isBest/prevBest BEFORE insert, scoped to cfgKey+mode, using the injected comparator; practice never best', function () {
  var ms = MathStore.create(fakeStore());
  function mkSession(totalMs, mode, cfgKey) {
    return { ts: totalMs, mode: mode || 'race', cfgKey: cfgKey || 'raceA', totalMs: totalMs };
  }

  var r1 = ms.addSession('p1', mkSession(5000), isBetterRace);
  assert.strictEqual(r1.isBest, true);   // first session in a fresh group is always best
  assert.strictEqual(r1.prevBest, null);

  var r2 = ms.addSession('p1', mkSession(6000), isBetterRace); // slower than 5000
  assert.strictEqual(r2.isBest, false);
  assert.strictEqual(r2.prevBest.totalMs, 5000);

  var r3 = ms.addSession('p1', mkSession(4000), isBetterRace); // faster - new best
  assert.strictEqual(r3.isBest, true);
  assert.strictEqual(r3.prevBest.totalMs, 5000);

  // a different cfgKey+mode group tracks its own best, independent of the first
  var r4 = ms.addSession('p1', mkSession(100, 'sprint', 'sprintA'), isBetterRace);
  assert.strictEqual(r4.isBest, true);
  assert.strictEqual(r4.prevBest, null);

  // a practice run never counts as (or against) a best, in ANY group
  var r5 = ms.addSession('p1', mkSession(1, 'practice', 'raceA'), isBetterRace);
  assert.strictEqual(r5.isBest, false);
  assert.strictEqual(r5.prevBest, null);
  // and a later race session in that same group is unaffected by the practice run
  var r6 = ms.addSession('p1', mkSession(3000), isBetterRace);
  assert.strictEqual(r6.isBest, true);
  assert.strictEqual(r6.prevBest.totalMs, 4000);

  assert.strictEqual(ms.getSessions('p1').length, 6); // every session (incl. practice) is still stored
});

test('addSession caps stored sessions at MAX_SESSIONS, dropping the oldest first (oldest-first order preserved)', function () {
  var ms = MathStore.create(fakeStore());
  var total = MathStore.MAX_SESSIONS + 5;
  for (var i = 0; i < total; i++) {
    ms.addSession('p1', { ts: i, mode: 'race', cfgKey: 'raceA', totalMs: 1000 + i }, isBetterRace);
  }
  var sessions = ms.getSessions('p1');
  assert.strictEqual(sessions.length, MathStore.MAX_SESSIONS);
  assert.strictEqual(sessions[0].ts, 5);                     // the 5 oldest were dropped
  assert.strictEqual(sessions[sessions.length - 1].ts, total - 1); // newest kept, oldest-first order intact
});

test('best() returns the best session for a cfgKey+mode, null when none exist, null when mode is practice', function () {
  var ms = MathStore.create(fakeStore());
  assert.strictEqual(ms.best('p1', 'raceA', 'race', isBetterRace), null);
  ms.addSession('p1', { ts: 1, mode: 'race', cfgKey: 'raceA', totalMs: 5000 }, isBetterRace);
  ms.addSession('p1', { ts: 2, mode: 'race', cfgKey: 'raceA', totalMs: 3000 }, isBetterRace);
  ms.addSession('p1', { ts: 3, mode: 'race', cfgKey: 'raceA', totalMs: 4000 }, isBetterRace);
  var b = ms.best('p1', 'raceA', 'race', isBetterRace);
  assert.strictEqual(b.totalMs, 3000);
  assert.strictEqual(ms.best('p1', 'raceA', 'practice', isBetterRace), null); // practice never best
});

/* ================= resetProgress / restoreProgress ================= */

test('restoreProfile is idempotent: a second restore of the same snapshot adds no duplicate (double-tap Undo)', function () {
  // Review finding #3: a double-tapped Undo restored the player twice under one
  // id; deleting either copy later wiped the survivor's facts + sessions.
  var ms = MathStore.create(fakeStore());
  ms.addProfile({ name: 'A' });
  var b = ms.addProfile({ name: 'B' });
  ms.saveFacts(b.id, { 'x:2:3': { n: 1, miss: 0, box: 1, ms: 900, last: 1 } });
  var snap = ms.removeProfile(b.id);
  assert.strictEqual(ms.restoreProfile(snap), true);
  assert.strictEqual(ms.restoreProfile(snap), false, 'second restore must refuse');
  var ids = ms.getProfiles().list.map(function (p) { return p.id; });
  assert.deepStrictEqual(ids.filter(function (id) { return id === b.id; }).length, 1);
  assert.ok(ms.getFacts(b.id)['x:2:3'], 'facts intact');
});

test('v1.1 earned stars/badges: saved per player, part of delete+undo and reset+undo', function () {
  var ms = MathStore.create(fakeStore());
  var a = ms.addProfile({ name: 'A' });
  var b = ms.addProfile({ name: 'B' });
  assert.deepStrictEqual(ms.getEarned(a.id), {}, 'no earned yet');
  var earned = { 'add-10': { stars: 3, masteredAt: 1000 }, 'sub-10': { stars: 1, masteredAt: null } };
  assert.strictEqual(ms.saveEarned(a.id, earned), true);
  assert.deepStrictEqual(ms.getEarned(a.id), earned);
  assert.deepStrictEqual(ms.getEarned(b.id), {}, 'per player');
  assert.strictEqual(MathStore.KEYS.earned(a.id), 'math.skills.' + a.id + '.v1');
  // reset + undo
  var snap = ms.resetProgress(a.id);
  assert.deepStrictEqual(ms.getEarned(a.id), {}, 'reset clears badges too');
  ms.restoreProgress(a.id, snap);
  assert.deepStrictEqual(ms.getEarned(a.id), earned, 'undo brings them back');
  // delete + undo
  var del = ms.removeProfile(a.id);
  assert.deepStrictEqual(ms.getEarned(a.id), {}, 'deleting a player removes their badges key');
  ms.restoreProfile(del);
  assert.deepStrictEqual(ms.getEarned(a.id), earned);
});

test('v1.1 profile start skill: kept by addProfile and survives later updates', function () {
  var ms = MathStore.create(fakeStore());
  var p = ms.addProfile({ name: 'Nik', start: 'x-2-5-10' });
  assert.strictEqual(p.start, 'x-2-5-10');
  var u = ms.updateProfile(p.id, { name: 'Nikolaus' });
  assert.strictEqual(u.start, 'x-2-5-10', 'an unrelated update must not drop start');
  assert.strictEqual(ms.getActive().start, 'x-2-5-10');
  assert.strictEqual(ms.updateProfile(p.id, { start: 'add-10' }).start, 'add-10');
  assert.strictEqual(ms.addProfile({ name: 'X', start: 'bad id!' }).start, undefined, 'junk start ignored');
});

test('v1.1 getEarned is defensive: corrupt / wrong-shape values read as {}', function () {
  var fs = fakeStore();
  var ms = MathStore.create(fs);
  var a = ms.addProfile({ name: 'A' });
  fs.setItem('math.skills.' + a.id + '.v1', '{not json');
  assert.deepStrictEqual(ms.getEarned(a.id), {});
  fs.setItem('math.skills.' + a.id + '.v1', '[1,2]');
  assert.deepStrictEqual(ms.getEarned(a.id), {});
});

test('resetProgress snapshots + clears facts and sessions; restoreProgress puts them back', function () {
  var ms = MathStore.create(fakeStore());
  var facts = { 'x:1:2': { n: 2, miss: 0, box: 1, ms: 800, last: 1 } };
  ms.saveFacts('p1', facts);
  ms.addSession('p1', { ts: 1, mode: 'race', cfgKey: 'raceA', totalMs: 5000 }, isBetterRace);

  var snap = ms.resetProgress('p1');
  assert.deepStrictEqual(snap.facts, facts);
  assert.strictEqual(snap.sessions.length, 1);
  assert.deepStrictEqual(ms.getFacts('p1'), {});
  assert.deepStrictEqual(ms.getSessions('p1'), []);

  assert.strictEqual(ms.restoreProgress('p1', snap), true);
  assert.deepStrictEqual(ms.getFacts('p1'), facts);
  assert.strictEqual(ms.getSessions('p1').length, 1);

  assert.strictEqual(ms.restoreProgress('p1', null), false);
});

/* ================= prefs ================= */

test('getPrefs defaults sound/haptics to true; setPrefs shallow-merges and persists', function () {
  var ms = MathStore.create(fakeStore());
  assert.deepStrictEqual(ms.getPrefs(), { sound: true, haptics: true });
  assert.deepStrictEqual(ms.setPrefs({ sound: false }), { sound: false, haptics: true });
  assert.deepStrictEqual(ms.getPrefs(), { sound: false, haptics: true }); // persisted
  assert.deepStrictEqual(ms.setPrefs({ haptics: false }), { sound: false, haptics: false });
  assert.deepStrictEqual(ms.getPrefs(), { sound: false, haptics: false });
});

/* ================= quota / storage-blocked: writes fail soft, never throw ================= */

test('every write returns false (never throws) when storage.setItem throws (quota exceeded)', function () {
  var seedProfiles = { active: 'p1', list: [{ id: 'p1', name: 'A', color: '#111', cfg: {}, created: 1 }] };
  var store = throwingStore({ 'math.profiles.v1': JSON.stringify(seedProfiles) });
  var ms = MathStore.create(store);

  assert.strictEqual(ms.setActive('p1'), false);              // found, but the write throws -> false
  assert.strictEqual(ms.saveFacts('p1', { a: 1 }), false);
  assert.strictEqual(ms.restoreProgress('p1', { facts: {}, sessions: [] }), false);
  assert.strictEqual(
    ms.restoreProfile({ profile: { id: 'x', name: 'X', created: 1 }, index: 0, facts: {}, sessions: [], wasActive: false }),
    false
  );

  // methods with no bool contract still return their computed value, and never throw,
  // even though persistence silently failed underneath them
  var added;
  assert.doesNotThrow(function () { added = ms.addProfile({ name: 'B' }); });
  assert.ok(added && added.id);

  var updated;
  assert.doesNotThrow(function () { updated = ms.updateProfile('p1', { name: 'Z' }); });
  assert.strictEqual(updated.name, 'Z');

  var prefs;
  assert.doesNotThrow(function () { prefs = ms.setPrefs({ sound: false }); });
  assert.strictEqual(prefs.sound, false);

  assert.doesNotThrow(function () { ms.addSession('p1', { ts: 1, mode: 'race', cfgKey: 'x', totalMs: 100 }, isBetterRace); });
  assert.doesNotThrow(function () { ms.resetProgress('p1'); });

  var removed;
  assert.doesNotThrow(function () { removed = ms.removeProfile('p1'); });
  assert.ok(removed); // snapshot still returned even though the underlying writes/removes failed

  var v;
  assert.doesNotThrow(function () { v = ms.migrate(); });
  assert.strictEqual(v, 1); // fail-soft: still reports SCHEMA_VERSION even though the stamp write failed
});

/* ================= migrate ================= */

test('migrate() writes the schema key and returns SCHEMA_VERSION (1)', function () {
  var store = fakeStore();
  var ms = MathStore.create(store);
  assert.strictEqual(ms.migrate(), 1);
  assert.strictEqual(store.getItem('math.schema.v1'), '1');

  var already = fakeStore({ 'math.schema.v1': '1' });
  assert.strictEqual(MathStore.create(already).migrate(), 1); // already current, still returns 1
});

run();
