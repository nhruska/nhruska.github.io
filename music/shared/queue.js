/* =====================================================================
 * queue.js  -  shared running-order queue (instrument-agnostic)
 * ---------------------------------------------------------------------
 * A tiny cursor over an ordered list of song ids. The SAME queue drives
 * prev/next in every mode — Studio, Campfire and Stage all read one
 * cursor, so "next song" means the same thing everywhere.
 *
 * Finite running order: next/prev CLAMP at the ends (a setlist isn't a
 * loop). remove() keeps the cursor pointing at a sensible song so
 * deleting a song mid-set doesn't jump you somewhere random.
 *
 * No build step. Exposes window.Queue = { createQueue }, and is also
 * require()-able in Node for unit tests (module.exports).
 *   var q = Queue.createQueue(); q.set(['s1','s2'], 0); q.next();
 * ===================================================================== */
(function (global) {
  'use strict';

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  function createQueue() {
    var list = [], cur = -1;

    function current() { return cur >= 0 && cur < list.length ? list[cur] : null; }

    var api = {
      set: function (ids, startIdx) {
        list = (ids || []).slice();
        cur = list.length ? clamp(startIdx || 0, 0, list.length - 1) : -1;
        return current();
      },
      ids: function () { return list.slice(); },
      size: function () { return list.length; },
      index: function () { return cur; },
      current: current,
      // a "real" queue worth showing prev/next for is more than one song
      isActive: function () { return list.length > 1; },
      atStart: function () { return cur <= 0; },
      atEnd: function () { return cur >= list.length - 1; },
      next: function () { if (cur >= 0 && cur < list.length - 1) cur++; return current(); },
      prev: function () { if (cur > 0) cur--; return current(); },
      goto: function (i) { if (list.length) cur = clamp(i, 0, list.length - 1); return current(); },
      has: function (id) { return list.indexOf(id) >= 0; },
      remove: function (id) {
        var idx = list.indexOf(id);
        if (idx < 0) return false;
        list.splice(idx, 1);
        if (!list.length) { cur = -1; return true; }
        if (idx < cur) cur--;            // current song shifted left — follow it
        cur = clamp(cur, 0, list.length - 1); // removing the current/last clamps into range
        return true;
      },
      // Step forward/backward, skipping any member `resolves(id)` reports
      // falsy for (a dangling reference - e.g. a setlist song whose library
      // item was deleted elsewhere and slipped past the delete/load-time heal).
      // dir: +1 Next, -1 Prev. Same clamp-not-wrap contract as next()/prev()
      // - stops at the end/start rather than looping, and is hard-bounded by
      // list.length iterations so a pathological caller state can never spin
      // forever. Returns { id, skipped }: id is the first resolvable member
      // found, or null if every remaining member in that direction is
      // unresolvable too (treat exactly like an empty queue - never render
      // the unresolved id). skipped counts how many dangling members were
      // passed over (0 = a normal single-step move, matching plain next()/
      // prev() behavior for a caller that doesn't care about the distinction).
      stepResolvable: function (dir, resolves) {
        if (typeof resolves !== 'function') resolves = function () { return true; };
        var skipped = 0;
        for (var i = 0; i < list.length; i++) {
          var moved = dir > 0 ? api.next() : api.prev();
          if (resolves(moved)) return { id: moved, skipped: skipped };
          skipped++;
          if (dir > 0 ? api.atEnd() : api.atStart()) break; // no further movement possible
        }
        return { id: null, skipped: skipped };
      }
    };
    return api;
  }

  var api = { createQueue: createQueue };
  global.Queue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
