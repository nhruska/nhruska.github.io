/* =====================================================================
 * accordion.js - the exclusive-disclosure group primitive.
 * ---------------------------------------------------------------------
 * One open section at a time: opening a section collapses the others;
 * tapping the open section's header closes it (zero-open is a valid
 * state). Per-open state only, never persisted - same contract as the
 * rest of the disclosure family (see component-conventions.md "Modal /
 * Disclosure / Tabs"). Consumer: the Settings sheet sections.
 *
 * Scope: this is for PANEL surfaces (bottom sheets, dialogs) that own a
 * single scroller - NOT for the Compose screen scroller, which is kept
 * flat on purpose to avoid the nested-scroll swipe trap.
 *
 * Same "module owns state, caller owns DOM shape" split as toast.js:
 * init() takes element-LIKE section pairs (real elements in the app, tiny
 * stubs in Node tests - see test/accordion.test.js), toggles body.hidden
 * + btn aria-expanded, and never touches classes/styles beyond that. The
 * visual is the .accSec/.accBtn/.accBody family in songbook.css - the one
 * look for every consumer. Gotcha: body.hidden only collapses if no author
 * display rule defeats [hidden], so songbook.css ships an explicit
 * .accBody[hidden]{display:none} guard - any NEW body class must keep it.
 *
 * Dependency-free by design (like esc.js).
 *
 *   Accordion.init(sections, opts) -> handle
 *     sections: [{ btn, body }] - btn needs .onclick assignable +
 *               .setAttribute; body needs a writable .hidden.
 *     opts.openIndex - optional initial open section (default -1 = all
 *               collapsed).
 *   handle.openIndex() -> the open section's index, or -1
 *   handle.open(i)     -> open section i (collapses the rest)
 *   handle.closeAll()  -> collapse everything
 * ===================================================================== */
(function (root) {
  'use strict';

  // Named-group registry so a LATE-INJECTED section (e.g. the Skills panel,
  // which self-injects after an async mount, long after the page wired its
  // group) can JOIN the page's group instead of running its own parallel
  // accordion. join() is order-proof: joining before the named init() queues
  // the section; init() drains the queue.
  var GROUPS = {};   // name -> handle
  var PENDING = {};  // name -> [section, ...] queued joins before init

  function init(sections, opts) {
    sections = sections || [];
    opts = opts || {};
    var open = (typeof opts.openIndex === 'number') ? opts.openIndex : -1;

    function paint(cause) {
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i], on = i === open;
        var was = s.body ? !s.body.hidden : false;
        if (s.body) s.body.hidden = !on;
        if (s.btn && s.btn.setAttribute) s.btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on && !was) {
          // Per-section open hook (lazy renders - the Skills panel rebuilds
          // its body on every open). Fires only on the closed->open edge.
          if (typeof s.onOpen === 'function') { try { s.onOpen(); } catch (e) { /* a hook must never break the group */ } }
          // Bring the newly-opened section into view - a below-the-fold
          // section that opens off-screen looks like nothing happened.
          // block:'nearest' = no scroll when already visible. Only on a USER
          // toggle (cause 'tap'), never on the initial paint or programmatic
          // open - deep-link openers manage their own scroll position.
          // Guarded: Node test stubs have no scrollIntoView.
          if (cause === 'tap' && s.body && typeof s.body.scrollIntoView === 'function') {
            try { s.body.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { s.body.scrollIntoView(); }
          }
        }
      }
    }

    function wire(s, i) {
      if (!s.btn) return;
      s.btn.onclick = function () {
        open = (open === i) ? -1 : i; // tap the open header -> close it (zero-open allowed)
        paint('tap');
      };
    }
    sections.forEach(wire);
    paint();

    var handle = {
      openIndex: function () { return open; },
      open: function (i) {
        if (typeof i !== 'number' || i < 0 || i >= sections.length) return;
        open = i; paint();
      },
      closeAll: function () { open = -1; paint(); },
      // Append a section to this group after init (the late-injection seam).
      // The new section renders closed; opening it collapses the others,
      // exactly like a section passed to init().
      add: function (s) {
        if (!s) return -1;
        sections.push(s);
        wire(s, sections.length - 1);
        if (s.body) s.body.hidden = true;
        if (s.btn && s.btn.setAttribute) s.btn.setAttribute('aria-expanded', 'false');
        return sections.length - 1;
      }
    };

    if (opts.name) {
      GROUPS[opts.name] = handle;
      (PENDING[opts.name] || []).forEach(function (s) { handle.add(s); });
      delete PENDING[opts.name];
    }
    return handle;
  }

  // Join a NAMED group regardless of init order: adds now if the group
  // exists, else queues until init({name}) runs. Returns true when the
  // section is (or will be) part of the group.
  function join(name, section) {
    if (!name || !section) return false;
    if (GROUPS[name]) { GROUPS[name].add(section); return true; }
    (PENDING[name] = PENDING[name] || []).push(section);
    return true;
  }

  var API = { init: init, join: join };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Accordion = API;

})(typeof window !== 'undefined' ? window : this);
