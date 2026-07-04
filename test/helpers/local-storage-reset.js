/* =====================================================================
 * local-storage-reset.js  -  shared test helper: reset the app's
 * namespaced localStorage keys between test cases, or hand a test a
 * disposable Storage-like fake instead of touching real localStorage.
 * ---------------------------------------------------------------------
 * Dependency-free (no requires, no globals touched at load time): pure
 * functions over any Storage-LIKE object exposing length/key()/getItem()/
 * setItem()/removeItem() - real localStorage, a jsdom shim, or the
 * fakeStore() below (same shape as the local fakeStore() already used in
 * test/backup.test.js).
 *
 * "Namespaced" mirrors music/shared/backup.js's OWNED_PREFIXES verbatim
 * (kept as a literal copy, not a require, so this helper stays usable in
 * any test file on its own). Update both lists together if the app adds
 * a new storage prefix.
 *
 * Usage:
 *   var lsReset = require('./helpers/local-storage-reset.js');
 *   var store = lsReset.fakeStore();       // disposable Storage-like fake
 *   store.setItem('music.accent.v1', 'teal');
 *   lsReset.clear(store);                  // removes every app-namespaced key
 *   lsReset.clear(store, ['bt.']);         // or just a specific prefix
 * ===================================================================== */
'use strict';

// Mirrors music/shared/backup.js OWNED_PREFIXES.
var DEFAULT_PREFIXES = ['songbook.', 'roadcase-', 'bt.', 'music.'];

function isNamespaced(key, prefixes) {
  if (typeof key !== 'string') return false;
  var list = prefixes || DEFAULT_PREFIXES;
  for (var i = 0; i < list.length; i++) {
    if (key.indexOf(list[i]) === 0) return true;
  }
  return false;
}

// Remove every key in `store` matching `prefixes` (default: every app
// namespace). Returns the count removed. Safe on an empty store; safe to
// call repeatedly (e.g. once per test, between cases).
function clear(store, prefixes) {
  var doomed = [];
  for (var i = 0; i < store.length; i++) {
    var k = store.key(i);
    if (isNamespaced(k, prefixes)) doomed.push(k);
  }
  doomed.forEach(function (k) { store.removeItem(k); });
  return doomed.length;
}

// A minimal Storage-like fake (same shape as test/backup.test.js's local
// fakeStore()) for tests that need a disposable localStorage without a
// DOM. Optionally seeded with a { key: value } map.
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

var API = { DEFAULT_PREFIXES: DEFAULT_PREFIXES, isNamespaced: isNamespaced, clear: clear, fakeStore: fakeStore };
module.exports = API;
if (typeof window !== 'undefined') window.LocalStorageReset = API;
