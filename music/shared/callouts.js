/* =====================================================================
 * callouts.js  -  first-run per-tab orientation callouts
 * ---------------------------------------------------------------------
 * On the FIRST visit to each tab, a non-blocking coach-mark points at the
 * one thing to do first (a bright pulsing ring + label on the primary
 * input) plus one or two muted labels on the secondary inputs. It never
 * dims the screen or blocks a tap - the user can act immediately, and the
 * first tap (or a scroll, or an 8s timeout) dismisses it. Show-once per
 * tab (additive localStorage, per backup.js's merge rule); a '?' in the
 * appbar replays the current tab's callout on demand.
 *
 * Pedagogy (pedagogy-coach): teach ONE thing at the moment of relevance,
 * in the target level's vocabulary, never a wall of text on a screen the
 * user came to use. UX (ux-coach): collapse the gulf to the first job -
 * name the first action, get out of the way.
 *
 * The CONFIG (per-tab targets + copy) and the show-once store are pure and
 * unit-tested; mount() is the browser-only positioning glue.
 *
 * No build step. Classic script. Exposes a single global: `Callouts`.
 * ===================================================================== */
(function (global) {
  'use strict';

  var STORE = 'music.calloutsShown.v1'; // { [tab]: 1 } - additive, never a bare array

  // Per-tab orientation. `sel` is the element the callout attaches to; `text`
  // is ONE short line in beginner vocabulary (no "dominant", no "mode"). The
  // primary is the first expected input; secondaries are the next one or two
  // the eye should find, shown muted so the primary still leads.
  var CONFIG = {
    library: {
      primary: { sel: '#songsList', text: 'Tap any song to hear it play' },
      secondary: [
        { sel: '#addBtn', text: 'Add saves a song to your setlist' },
        { sel: '#search', text: 'Search by song or artist' }
      ]
    },
    jam: {
      // First visit = empty setlist, so Start + Edit are hidden; point at the
      // always-present count line and let the (skipped-when-hidden) secondaries
      // light up once songs exist and the user replays with '?'.
      primary: { sel: '#setCount', text: 'Save songs from Library - they line up here to perform' },
      secondary: [
        { sel: '#performBtn', text: 'Start plays your setlist hands-free' },
        { sel: '#setEdit', text: 'Edit to reorder or remove' }
      ]
    },
    compose: {
      // The build grid is empty on first open (0 height); the suggested chords
      // are the one-tap way in - that's the first job.
      primary: { sel: '#suggest', text: 'Tap a suggested chord to start your progression' },
      secondary: [
        { sel: '#keyChipSlot', text: 'Set a key to filter the chords' },
        { sel: '#cSave', text: 'Save keeps what sounds good' }
      ]
    },
    tune: {
      primary: { sel: '#micBox', text: 'Pluck a string - the needle shows sharp or flat' },
      secondary: [
        { sel: '#tStrings', text: 'Or tap a letter for a reference tone' }
      ]
    }
  };

  var TABS = ['library', 'jam', 'compose', 'tune'];

  /* ---------- pure: show-once store (additive) ----------
   * Bare `localStorage` (guarded) so this runs unmodified in the browser AND
   * in Node tests - the IIFE's `global` is `window` in the browser but the
   * module's own exports object under Node, so `global.localStorage` would
   * miss the real store. Same pattern as guidance-level.js. */
  function ls() { return (typeof localStorage !== 'undefined' && localStorage) ? localStorage : null; }
  function readShown() {
    try {
      var s = ls(); if (!s) return {};
      var o = JSON.parse(s.getItem(STORE) || '{}');
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function shownFor(tab) { return !!readShown()[tab]; }
  function markShown(tab) {
    if (!tab) return;
    try {
      var s = ls(); if (!s) return;
      var o = readShown();
      o[tab] = 1; // additive: only ever sets keys, never clears others
      s.setItem(STORE, JSON.stringify(o));
    } catch (e) {}
  }
  // Replay affordance: clear the whole map so every tab re-cues once more.
  function reset() {
    try { var s = ls(); if (s) s.removeItem(STORE); } catch (e) {}
  }
  function configFor(tab) { return CONFIG[tab] || null; }

  /* ---------- browser-only: positioning glue ---------- */
  // Resolve the element a callout attaches to. For a list container, point at
  // its first real child so the ring hugs a row, not the whole scroll area.
  function resolveTarget(doc, sel) {
    var el = doc.querySelector(sel);
    if (!el) return null;
    if (el.id === 'songsList' && el.firstElementChild) return el.firstElementChild;
    return el;
  }

  function visible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < (global.innerHeight || 9999);
  }

  // Build one ring+label pair over `el`. `primary` sizes/brightens it.
  function placeMark(doc, layer, el, text, primary) {
    var r = el.getBoundingClientRect();
    var ring = doc.createElement('div');
    ring.className = 'coRing' + (primary ? ' coPrimary' : ' coMuted');
    var pad = primary ? 6 : 3;
    ring.style.left = (r.left - pad) + 'px';
    ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';
    layer.appendChild(ring);

    var lab = doc.createElement('div');
    lab.className = 'coLabel' + (primary ? ' coPrimary' : ' coMuted');
    lab.textContent = text;
    layer.appendChild(lab);
    // Prefer below the target; flip above if it would run off the bottom.
    var vh = global.innerHeight || 800;
    var belowTop = r.bottom + pad + 8;
    lab.style.left = Math.max(8, Math.min(r.left, (global.innerWidth || 400) - 220)) + 'px';
    if (belowTop + 44 > vh) {
      lab.style.top = Math.max(8, r.top - pad - 40) + 'px';
    } else {
      lab.style.top = belowTop + 'px';
    }
    return ring;
  }

  // Draw the layer for `tab` around an already-resolved, visible primary `pEl`.
  function draw(doc, tab, cfg, pEl, opts) {
    // One layer per invocation; pointer-events:none so every tap falls through
    // to the real control underneath (the coach-mark never intercepts a tap).
    var layer = doc.createElement('div');
    layer.className = 'coLayer';
    layer.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(layer);

    placeMark(doc, layer, pEl, cfg.primary.text, true);
    (cfg.secondary || []).forEach(function (s) {
      var el = resolveTarget(doc, s.sel);
      if (visible(el)) placeMark(doc, layer, el, s.text, false);
    });

    markShown(tab); // once drawn, it has served its first-run turn

    var killed = false, timer = null;
    function kill() {
      if (killed) return; killed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      doc.removeEventListener('pointerdown', onTap, true);
      var view = doc.getElementById('view');
      if (view) view.removeEventListener('scroll', kill);
      global.removeEventListener('resize', kill);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      if (typeof opts.onDone === 'function') opts.onDone();
    }
    // The user's first real interaction (a tap anywhere, or scrolling the
    // content) retires the callout - it has oriented, now get out of the way.
    function onTap() { kill(); }
    doc.addEventListener('pointerdown', onTap, true);
    var view = doc.getElementById('view');
    if (view) view.addEventListener('scroll', kill, { passive: true });
    global.addEventListener('resize', kill);
    timer = global.setTimeout(kill, 8000); // hard ceiling - never lingers
  }

  // Show the callout for `tab`. Non-blocking, self-dismissing. Returns true if
  // it drew or ARMED a watch for the target; false if the tab has no config /
  // already shown. `opts.force` bypasses the show-once guard (the '?' replay).
  //
  // The primary target can render asynchronously - Library songs paint after
  // the profile reload a fresh device does on "Start playing", which can be well
  // over a second later. So rather than poll a fixed window and give up, we draw
  // immediately if the target is ready, else watch the DOM (MutationObserver)
  // and draw the moment it appears - capped, and abandoned if the user navigates
  // to another tab meanwhile.
  function mount(tab, opts) {
    opts = opts || {};
    var doc = global.document;
    if (!doc) return false;
    var cfg = CONFIG[tab];
    if (!cfg) return false;
    if (!opts.force && shownFor(tab)) return false;

    var done = false, obs = null, deadline = null;
    function stillOnTab() {
      var a = doc.querySelector('.tabbar button.on');
      return !a || (a.dataset && a.dataset.tab === tab); // no tabbar (tests) -> don't block
    }
    function cleanup() {
      if (obs) { obs.disconnect(); obs = null; }
      if (deadline) { global.clearTimeout(deadline); deadline = null; }
    }
    function tryDraw() {
      if (done) return true;
      if (!opts.force && !stillOnTab()) { done = true; cleanup(); return true; } // moved on
      var pEl = resolveTarget(doc, cfg.primary.sel);
      if (!visible(pEl)) return false; // not ready yet - keep watching
      done = true; cleanup();
      draw(doc, tab, cfg, pEl, opts);
      return true;
    }
    if (tryDraw()) return true; // target already on-screen - the common tab-switch case
    // Target not painted yet (async render): watch until it is, then draw.
    if (global.MutationObserver && doc.body) {
      obs = new global.MutationObserver(function () { tryDraw(); });
      obs.observe(doc.body, { childList: true, subtree: true });
    }
    // Give up quietly if the target never paints (never marks unshown, so the
    // next visit re-tries with content already loaded). Generous, because a
    // cold-cache profile reload can take several seconds to render the song list.
    deadline = global.setTimeout(cleanup, 10000);
    return true;
  }

  global.Callouts = {
    STORE: STORE, CONFIG: CONFIG, TABS: TABS,
    shownFor: shownFor, markShown: markShown, reset: reset, configFor: configFor,
    mount: mount
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Callouts;

})(typeof window !== 'undefined' ? window : this);
