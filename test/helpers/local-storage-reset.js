/* =====================================================================
 * local-storage-reset.js  -  a minimal Storage-like fake + a reset helper
 * for per-test localStorage isolation.
 * ---------------------------------------------------------------------
 * Mirrors backup.test.js's inline fakeStore() shape (length/key/getItem/
 * setItem/removeItem) so any Node test that stubs the process-global
 * `localStorage` for a module under test (notables.js today; more as they
 * land - S-FIRSTRUN/S-WHYNOTE/S-ROMAN are expected to reuse this) shares
 * ONE definition instead of re-inventing it per test file.
 *
 * Usage:
 *   var resetLocalStorage = require('./helpers/local-storage-reset.js');
 *   test('...', function () {
 *     resetLocalStorage();                 // fresh, empty store this case
 *     ...
 *   });
 *   resetLocalStorage({'music.notables.v1': '{}'});  // pre-seeded
 * ===================================================================== */
'use strict';

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

// Reassigns the process-global `localStorage` to a brand-new fake store
// (optionally pre-seeded with raw string values), so bare `localStorage.
// getItem(...)` calls inside the module under test see a clean, isolated
// namespace for this test case. Node exposes `global` properties as bare
// identifiers process-wide (same relationship as `window` in a browser),
// so this is visible to the required module without passing it explicitly.
function resetLocalStorage(seed) {
  global.localStorage = fakeStore(seed);
  return global.localStorage;
}

module.exports = resetLocalStorage;
module.exports.fakeStore = fakeStore;
module.exports.resetLocalStorage = resetLocalStorage;
