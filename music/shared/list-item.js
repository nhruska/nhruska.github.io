/* =====================================================================
 * list-item.js  -  SSOT renderer for a Library item (song / track / set row).
 *
 * One element, one CSS class (.listItem), used by all 3 Library segments so
 * they look and behave like the same thing. It normalizes a song record
 * (t/a/y/seq) or a track record (title/artist/key/mode/genre/bpm/capo/yt) to a
 * common shape, shows the UNION of details we know, and differentiates by the
 * available action (Play > YouTube > Search). Presentation only: every action
 * is a callback the caller wires (open studio, add to set, reorder, edit, ...).
 *
 * Pure functions are exported for Node tests; render() builds the DOM.
 * ===================================================================== */
(function (global) {
  'use strict';

  // HTML-escape, delegating to the shared esc.js (loaded before this file
  // everywhere it's consumed) so escaping stays identical across modules.
  function esc(s) { return global.Esc.esc(s); }

  // Resolve the Circle theory kernel. In the browser it's window.Circle. Under
  // Node the IIFE's `global` is this module's own exports object, so Circle
  // can't be injected there - fall back to a guarded require of circle.js so
  // tests exercise the real preferredTonicName. Same pattern as tracks.js and
  // repertoire.js.
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }

  // Module-scope arm state for the inline remove handle: one armed handle at a
  // time, auto-disarmed after RM_ARM_MS. Re-renders rebuild the nodes, so a
  // stale armed ref simply fails the identity check and the next tap arms
  // fresh; the pending timer no-ops on the detached node.
  var RM_ARM_MS = 1600;
  var armedRmBtn = null, armedRmTimer = null;
  function disarmRmBtn() {
    if (armedRmTimer) { clearTimeout(armedRmTimer); armedRmTimer = null; }
    if (armedRmBtn) { try { armedRmBtn.classList.remove('armed'); } catch (e) { } armedRmBtn = null; }
  }
  function armRmBtn(btn) {
    disarmRmBtn();
    armedRmBtn = btn;
    try { btn.classList.add('armed'); } catch (e) { }
    armedRmTimer = setTimeout(disarmRmBtn, RM_ARM_MS);
  }

  // Normalize a song OR track record to ONE item shape. Songs use t/a/y/seq;
  // tracks use title/artist/key/mode/genre/bpm/capo/yt. Either is accepted, and
  // missing fields are null so the renderer can omit them.
  function normalize(rec) {
    rec = rec || {};
    var raw = rec.seq || rec.chords || null;
    var chords = Array.isArray(raw) ? raw : (raw ? [raw] : null);
    // Derive the key from the first chord when none is given - matches the app's
    // labelTonic convention (a song's first chord is its working tonic). This
    // turns "Key?" into a real key for chord-sheet songs that carry no key
    // field, and lets key-based filtering span songs + tracks.
    var key = rec.key || null, mode = rec.mode || null;
    if (!key && chords && chords.length) {
      var km = /^([A-G][#b]?)(m(?!aj)|min)?/.exec(String(chords[0]));
      if (km) { key = km[1]; mode = km[2] ? 'minor' : 'major'; }
    }
    return {
      title: rec.title != null ? rec.title : (rec.t || ''),
      artist: rec.artist != null ? rec.artist : (rec.a || ''),
      year: rec.y != null ? rec.y : (rec.year != null ? rec.year : null),
      key: key,
      mode: mode,
      chords: chords,
      genre: rec.genre || null,
      bpm: rec.bpm || null,
      capo: rec.capo || null,
      video: rec.yt || rec.video || null,
      tags: Array.isArray(rec.tags) ? rec.tags : (rec.tags ? [rec.tags] : null),
      custom: !!rec.custom,
      raw: rec
    };
  }

  // The row's single action, labelled by consequence (not brand): a curated
  // video plays IN-APP ("Video", the play glyph) and is the only action a row
  // ever advertises. Distinct glyph + (in CSS) weight/colour so it doesn't rely
  // on colour alone. A row with no in-app video advertises no action at all -
  // returns null, and render() below skips the .li-act element entirely.
  // Deliberately no leave-the-app fallback (e.g. an external YouTube search),
  // which would pull a first-screen user out of the app.
  function action(item) {
    return item.video
      ? { kind: 'play', label: 'Video', glyph: '▶', external: false }     // ▶ in-app
      : null;                                                             // no video -> no action shown
  }

  // The key label, mode spelled out: "Bb major" / "A minor". Named church modes
  // stay mode-honest ("G mixolydian") rather than collapsing to major/minor -
  // real modal tracks exist (tracks.json has mixolydian), and asserting
  // "G major" for a mixolydian key would be wrong. The mode is always spelled
  // so a bare letter never reads as an incomplete label. The root respells
  // key-aware via Circle.preferredTonicName (a stored "A#" root badges as
  // "Bb major", never the canonical-sharp token), falling back to the raw
  // item.key when Circle is unavailable. Display-only (the badge); no logic
  // consumer keys off this string.
  function keyLabel(item) {
    if (!item.key) return null;
    var mode = String(item.mode || '').toLowerCase();
    var C = circleRef();
    var root = (C && C.preferredTonicName) ? C.preferredTonicName(item.key, item.mode || 'major') : item.key;
    if (mode.indexOf('min') === 0 || mode === 'aeolian') return root + ' minor';
    if (mode === '' || mode.indexOf('maj') === 0 || mode === 'ionian') return root + ' major';
    return root + ' ' + mode; // dorian/phrygian/lydian/mixolydian/locrian - mode-honest
  }

  // Pre-commit difficulty signal so a player sees the risk before grabbing a
  // song (a bare chord count wouldn't). At most one short hazard tag:
  // accidental-root chords (F#m, Bb...) win, else extended chords
  // (7/maj7/dim/aug/sus/9/add).
  function hazards(item) {
    if (!item.chords || !item.chords.length) return [];
    if (item.chords.some(function (c) { return /^[A-G][#b]/.test(c); })) return ['sharps/flats'];
    if (item.chords.some(function (c) { return /(maj7|m7|7|dim|aug|sus|9|add|6)/.test(c); })) return ['7ths'];
    return [];
  }

  // At-rest meta cells (dotted), universal priority order, each shown only if known.
  // The chord SEQUENCE is NOT here (it lives in the chord sheet / studio one tap away);
  // key + capo are badges, "mine" is a row marker - so the row stays a calm single line.
  function metaCells(item) {
    var cells = [];
    if (item.chords && item.chords.length) cells.push(item.chords.length + ' chords');
    hazards(item).forEach(function (h) { cells.push(h); });
    if (item.bpm) cells.push(item.bpm + ' bpm');
    if (item.genre) cells.push(item.genre);
    return cells;
  }

  function btn(cls, html, act, attrs) {
    return '<button class="' + cls + '" type="button" data-act="' + act + '"'
      + (attrs || '') + '>' + html + '</button>';
  }

  // Movement-cancelled tap: fire fn only if the touch did NOT move (a tap, not a
  // scroll-grab). Critical on the right rail, where the thumb scrolls while
  // gripping the propped phone - a big always-hot button there would otherwise
  // fire on a scroll-grab. Mouse clicks (no touch) are unaffected, so desktop
  // still works. Shared entry point - songbook.js delegates here. fn receives
  // the triggering click event; call sites that don't need it just ignore it.
  function wireTap(el, fn) {
    if (!el || !fn) return;
    var sx = 0, sy = 0, moved = false;
    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) moved = true;
    }, { passive: true });
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (moved) return;
      fn(e);
    });
  }

  /* render(rec, opts) -> HTMLElement (.listItem)
   * opts:
   *   segment   'library' | 'set'        (default 'library')
   *   position  1-based number           (set only -> shows .li-num)
   *   inSet     bool                      (library -> add btn shows ✓ vs +)
   *   first/last bool                     (set -> disable up/down)
   *   onActivate(rec)  tap the body       (open studio / details)
   *   onAction(rec)    tap Play/Search
   *   onAdd(rec)       + add to set       (library)
   *   addBlockedReason string             (library, no onAdd -> renders a GHOST +
   *                                        so the missing affordance reads as a
   *                                        stated limitation, never a broken row)
   *   onAddBlocked(rec) tap the ghost +   (explain why - e.g. a toast)
   *   onUp/onDn/onRemove(rec)             (set controls)
   *   onEdit(rec)      edit details       (optional; renders a pencil if provided)
   */
  function render(rec, opts) {
    opts = opts || {};
    var item = normalize(rec);
    var seg = opts.segment || 'library';
    var act = action(item);
    var kl = keyLabel(item);
    var cells = metaCells(item);

    var root = (global.document).createElement('div');
    root.className = 'listItem' + (opts.inSet ? ' inSet' : '') + (item.custom ? ' isMine' : '');

    // Right tag is KEY-FIRST and never silently a year: the accent key-slot is
    // where a player's eye reads "the key". Unknown -> a quiet "Key?" badge
    // (empty would read as a render bug). Year, if known, rides the artist line.
    var tagHtml = kl
      ? '<span class="li-tag isKey">' + esc(kl) + '</span>'
      : '<span class="li-tag isKeyUnknown">Key?</span>';
    // Capo is a hands-on setup fact, not metadata: an explicit badge beside the key.
    var capoHtml = item.capo ? '<span class="li-capo">Capo ' + esc(item.capo) + '</span>' : '';

    var sub = esc(item.artist || '');
    if (item.year != null) sub += ' · ' + esc(item.year);

    var num = (seg === 'set' && opts.position != null)
      ? '<div class="li-num">' + esc(opts.position) + '</div>' : '';

    var metaHtml = '';
    cells.forEach(function (c, i) {
      metaHtml += (i ? '<span class="dot"></span>' : '') + '<span>' + esc(c) + '</span>';
    });
    // Action: a real tappable target (CSS gives it >=44px + a box), glyph + label
    // so it isn't colour-only, movement-cancelled so a scroll-grab can't fire it.
    // act is null for a no-video row - skip the element entirely rather than
    // render an empty/dangling action span.
    if (act) {
      metaHtml += '<span class="li-act li-act-' + act.kind + '" role="button" tabindex="0"'
        + (act.external ? ' title="Opens YouTube"' : '') + '>'
        + esc(act.glyph) + ' ' + esc(act.label) + '</span>';
    }

    // Trailing affordances. Set reorder/remove appear ONLY in edit-set mode - a
    // destructive x next to reorder on the scroll rail is a one-thumb minefield,
    // so hide them until the user opts into editing the set.
    var ctrl = '';
    if (seg === 'set' && opts.setEdit) {
      ctrl = '<div class="li-ctrl">'
        + btn('li-up', '&#9650;', 'up', opts.first ? ' disabled' : '')
        + btn('li-dn', '&#9660;', 'dn', opts.last ? ' disabled' : '')
        + '</div>' + btn('li-rm', '&#215;', 'rm', ' title="Remove from set"');
    } else if (seg !== 'set' && opts.onAdd) {
      ctrl = btn('li-add', opts.inSet ? '&#10003;' : '+', 'add', opts.inSet ? ' title="In set"' : ' title="Add to set"');
    } else if (seg !== 'set' && opts.addBlockedReason) {
      // Rows that can't join the set render a ghost + rather than nothing in the
      // add slot - a blank slot reads as a broken row. The ghost + states the
      // limitation (title/aria) and teaches on tap, so the add slot always
      // communicates (Element Consistency, at the primitive).
      ctrl = btn('li-add ghost', '+', 'addblocked',
        ' title="' + esc(opts.addBlockedReason) + '" aria-label="' + esc(opts.addBlockedReason) + '"');
    }
    var editBtn = opts.onEdit ? btn('li-edit', '&#9998;', 'edit', ' title="Edit details"') : '';

    root.innerHTML = num
      + '<div class="li-body">'
      + '<div class="li-row1"><span class="li-title">' + esc(item.title) + '</span>'
      + '<span class="li-tags">' + capoHtml + tagHtml + '</span>'
      + '</div>'
      + (sub ? '<div class="li-artist">' + sub + '</div>' : '')
      + (opts.note ? '<div class="li-note">' + esc(opts.note) + '</div>' : '')
      + '<div class="li-meta">' + metaHtml + '</div>'
      + '</div>'
      + editBtn + ctrl;

    // Movement-cancelled taps everywhere (scroll-grab safety). Buttons live outside
    // .li-body so they don't bubble to the body activate.
    var body = root.querySelector('.li-body');
    if (body && opts.onActivate) wireTap(body, function () { opts.onActivate(rec); });
    root.querySelectorAll('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      wireTap(b, function () {
        if (a === 'add' && opts.onAdd) opts.onAdd(rec);
        else if (a === 'addblocked' && opts.onAddBlocked) opts.onAddBlocked(rec);
        else if (a === 'up' && opts.onUp) opts.onUp(rec);
        else if (a === 'dn' && opts.onDn) opts.onDn(rec);
        else if (a === 'rm' && opts.onRemove) {
          // The inline remove handle is arm-to-delete: first tap ARMS (red,
          // RM_ARM_MS auto-disarm), second tap on the SAME armed handle removes.
          // Gate lives here at the primitive so every li-rm consumer inherits it.
          if (armedRmBtn !== b) { armRmBtn(b); return; }
          disarmRmBtn();
          opts.onRemove(rec);
        }
        else if (a === 'edit' && opts.onEdit) opts.onEdit(rec);
      });
    });
    var actEl = root.querySelector('.li-act');
    if (actEl && opts.onAction) wireTap(actEl, function () { opts.onAction(rec); });

    return root;
  }

  var ListItem = {
    normalize: normalize, action: action, keyLabel: keyLabel,
    hazards: hazards, metaCells: metaCells, render: render, wireTap: wireTap
  };
  global.ListItem = ListItem;
  if (typeof module !== 'undefined' && module.exports) module.exports = ListItem;

})(typeof window !== 'undefined' ? window : this);
