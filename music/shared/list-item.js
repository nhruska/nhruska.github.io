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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Normalize a song OR track record to ONE item shape. Songs use t/a/y/seq;
  // tracks use title/artist/key/mode/genre/bpm/capo/yt. Either is accepted, and
  // missing fields are null so the renderer can omit them.
  function normalize(rec) {
    rec = rec || {};
    var chords = rec.seq || rec.chords || null;
    return {
      title: rec.title != null ? rec.title : (rec.t || ''),
      artist: rec.artist != null ? rec.artist : (rec.a || ''),
      year: rec.y != null ? rec.y : (rec.year != null ? rec.year : null),
      key: rec.key || null,
      mode: rec.mode || null,
      chords: Array.isArray(chords) ? chords : (chords ? [chords] : null),
      genre: rec.genre || null,
      bpm: rec.bpm || null,
      capo: rec.capo || null,
      video: rec.yt || rec.video || null,
      tags: Array.isArray(rec.tags) ? rec.tags : (rec.tags ? [rec.tags] : null),
      custom: !!rec.custom,
      raw: rec
    };
  }

  // The action ladder: a curated video -> Play (in-app); otherwise -> find one
  // on YouTube (Search). Returns { kind, label } the renderer shows; the tap is
  // routed through opts.onAction so the caller decides what Play/Search do.
  function action(item) {
    return item.video
      ? { kind: 'play', label: 'Play' }
      : { kind: 'search', label: 'YouTube' };
  }

  // The short key label: "Am" for A minor, "C" for C major, null if no key.
  function keyLabel(item) {
    if (!item.key) return null;
    var minor = String(item.mode || '').toLowerCase().indexOf('min') === 0
      || /aeolian|dorian|phrygian|locrian/.test(String(item.mode || '').toLowerCase());
    return item.key + (minor ? 'm' : '');
  }

  // Collective meta cells (dotted), in a stable order. Each is shown only if known.
  function metaCells(item) {
    var cells = [];
    if (item.chords && item.chords.length) {
      item.chords.forEach(function (c) { cells.push(c); });
      cells.push(item.chords.length + ' chords');
    }
    if (item.genre) cells.push(item.genre);
    if (item.bpm) cells.push(item.bpm + ' bpm');
    if (item.capo) cells.push('capo ' + item.capo);
    if (item.custom) cells.push('mine');
    return cells;
  }

  function btn(cls, html, act, attrs) {
    return '<button class="' + cls + '" type="button" data-act="' + act + '"'
      + (attrs || '') + '>' + html + '</button>';
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
    root.className = 'listItem' + (opts.inSet ? ' inSet' : '');

    // right-side tag: key (accent) if known, else year. Both feel like the
    // same "what is this in" chip; key wins when we know it.
    var tag = kl ? kl : (item.year != null ? ('’' + String(item.year).slice(-2)) : '');

    // artist line: artist + "· year" when a key already claimed the tag slot.
    var sub = esc(item.artist || '');
    if (kl && item.year != null) sub += ' · ' + esc(item.year);

    var num = (seg === 'set' && opts.position != null)
      ? '<div class="li-num">' + esc(opts.position) + '</div>' : '';

    var metaHtml = '';
    cells.forEach(function (c, i) {
      metaHtml += (i ? '<span class="dot"></span>' : '') + '<span>' + esc(c) + '</span>';
    });
    // the action lives at the end of the meta row, pushed right.
    metaHtml += '<span class="li-act li-act-' + act.kind + '">' + esc(act.label) + ' &#8599;</span>';

    var ctrl = '';
    if (seg === 'set') {
      ctrl = '<div class="li-ctrl">'
        + btn('li-up', '&#9650;', 'up', opts.first ? ' disabled' : '')
        + btn('li-dn', '&#9660;', 'dn', opts.last ? ' disabled' : '')
        + '</div>' + btn('li-rm', '&#215;', 'rm');
    } else if (opts.onAdd) {
      // library: add-to-set affordance (only when the caller supports it)
      ctrl = btn('li-add', opts.inSet ? '&#10003;' : '+', 'add');
    }
    var editBtn = opts.onEdit ? btn('li-edit', '&#9998;', 'edit', ' title="Edit details"') : '';

    root.innerHTML = num
      + '<div class="li-body">'
      + '<div class="li-row1"><span class="li-title">' + esc(item.title) + '</span>'
      + (tag ? '<span class="li-tag' + (kl ? ' isKey' : '') + '">' + esc(tag) + '</span>' : '')
      + '</div>'
      + (sub ? '<div class="li-artist">' + sub + '</div>' : '')
      + (opts.note ? '<div class="li-note">' + esc(opts.note) + '</div>' : '')
      + '<div class="li-meta">' + metaHtml + '</div>'
      + '</div>'
      + editBtn + ctrl;

    // wire taps. body -> activate; data-act buttons -> their callbacks.
    var body = root.querySelector('.li-body');
    if (body && opts.onActivate) body.onclick = function () { opts.onActivate(rec); };
    root.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var a = b.getAttribute('data-act');
        if (a === 'add' && opts.onAdd) opts.onAdd(rec);
        else if (a === 'up' && opts.onUp) opts.onUp(rec);
        else if (a === 'dn' && opts.onDn) opts.onDn(rec);
        else if (a === 'rm' && opts.onRemove) opts.onRemove(rec);
        else if (a === 'edit' && opts.onEdit) opts.onEdit(rec);
      };
    });
    // the action cell (Play/Search) is in the meta row, not a button.
    var actEl = root.querySelector('.li-act');
    if (actEl && opts.onAction) actEl.onclick = function (e) { e.stopPropagation(); opts.onAction(rec); };

    return root;
  }

  var ListItem = {
    normalize: normalize, action: action, keyLabel: keyLabel, metaCells: metaCells, render: render
  };
  global.ListItem = ListItem;
  if (typeof module !== 'undefined' && module.exports) module.exports = ListItem;

})(typeof window !== 'undefined' ? window : this);
