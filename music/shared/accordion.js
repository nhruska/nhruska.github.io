/* =====================================================================
 * accordion.js  -  M-SETTINGS-CLARITY (2026-07-05): the EXCLUSIVE
 * disclosure group primitive (the ACCORDION in ui-primitives.md).
 * ---------------------------------------------------------------------
 * One open section at a time: opening a section collapses the others;
 * tapping the open section's header closes it (zero-open is a valid
 * state). Per-open state only, never persisted - same contract as the
 * disclosure family in component-conventions.md "Modal / Disclosure /
 * Tabs". First consumer: the Settings sheet sections (play/index.html).
 *
 * Scope note (decision D6 still stands): the accordion is for PANEL
 * surfaces (bottom sheets, dialogs) that own a single scroller. It is
 * NOT for the Compose screen scroller - D6 flattened Compose precisely
 * to kill the nested-scroll swipe trap, and this primitive does not
 * reopen that question.
 *
 * Same "module owns state, caller owns DOM shape" split as toast.js:
 * init() takes element-LIKE section pairs (real elements in the app, tiny
 * stubs in Node tests - see test/accordion.test.js), toggles body.hidden
 * + btn aria-expanded, and never touches classes/styles beyond that. The
 * visual is the .accSec/.accBtn/.accBody family in songbook.css - the ONE
 * look for every consumer (THE ELEMENT CONSISTENCY LAW). NOTE the U24
 * precedent: body.hidden only collapses if no author display rule defeats
 * [hidden] - songbook.css ships the explicit .accBody[hidden]{display:none}
 * guard, and any NEW body class must keep that invariant.
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

  function init(sections, opts) {
    sections = sections || [];
    opts = opts || {};
    var open = (typeof opts.openIndex === 'number') ? opts.openIndex : -1;

    function paint() {
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i], on = i === open;
        if (s.body) s.body.hidden = !on;
        if (s.btn && s.btn.setAttribute) s.btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      }
    }

    sections.forEach(function (s, i) {
      if (!s.btn) return;
      s.btn.onclick = function () {
        open = (open === i) ? -1 : i; // tap the open header -> close it (zero-open allowed)
        paint();
      };
    });
    paint();

    return {
      openIndex: function () { return open; },
      open: function (i) {
        if (typeof i !== 'number' || i < 0 || i >= sections.length) return;
        open = i; paint();
      },
      closeAll: function () { open = -1; paint(); }
    };
  }

  var API = { init: init };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.Accordion = API;

})(typeof window !== 'undefined' ? window : this);
