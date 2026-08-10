/* =====================================================================
 * list-item.js  -  SSOT renderer for a Library item (song / track / set row).
 *
 * One element, one CSS class (.listItem), used by all 3 Library segments so
 * they look and behave like the same thing. It normalizes a song record
 * (t/a/y/seq) or a track record (title/artist/key/mode/genre/bpm/capo/yt) to a
 * common shape and shows the UNION of details we know. Presentation only: every action
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

  // Playability predicate (pure, tested): a curated video plays IN-APP,
  // anything else has no play action. Since round 5 (2026-08-09) nothing
  // RENDERS from this - the body tap is the play control and the leading
  // chip carries the playing indicator - but callers still key body-tap
  // behavior off the same video-or-not distinction this names.
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
   *   onActivate(rec)  tap the body       (callers: PLAY for playable rows,
   *                                        details otherwise - batch 4)
   *   onLead(rec)      tap the leading chip (song details - the details door
   *                                        now that a body tap plays)
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
    var kl = keyLabel(item);
    var cells = metaCells(item);

    var root = (global.document).createElement('div');
    root.className = 'listItem' + (opts.inSet ? ' inSet' : '') + (item.custom ? ' isMine' : '')
      // PLAYER-FEEL initial state; live updates arrive as a class sweep from the
      // caller's music:nowplaying listener (songbook.js refreshNowPlaying).
      + (opts.nowPlaying ? ' isPlaying' : '') + (opts.nowPlaying && opts.nowPaused ? ' isPaused' : '');

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

    // UAT 2026-08-08 (batch 4): the row's LEADING element is a fixed-width tap
    // target - the "song details" door, now that a body tap PLAYS (see the
    // callers). It holds the setlist position when the row has one (position is
    // a fact about MEMBERSHIP - SONGS-MERGE phase 1) and an info glyph when it
    // doesn't, so joining/leaving the set swaps the chip's CONTENT, never the
    // row's layout ("show setlist # within to prevent row UI reflow").
    // .li-num stays the number's class (nested) so its look and every existing
    // check keep working.
    // The chip also HOSTS the now-playing equalizer (UAT 2026-08-09 round 5):
    // .isPlaying on the row swaps the number/info glyph for the animated bars
    // (CSS - a class sweep, no re-render), the Spotify-grammar "this row is
    // the one in the player". Fixed-width chip, so the swap never reflows.
    var num = '<button class="li-lead" type="button" data-act="lead" aria-label="Song details" title="Song details">'
      + ((opts.position != null)
        ? '<span class="li-num">' + esc(opts.position) + '</span>'
        : '<span class="li-lead-gl" aria-hidden="true">&#9432;</span>')
      + '<span class="li-eq" aria-hidden="true"><i></i><i></i><i></i></span>'
      + '</button>';

    var metaHtml = '';
    cells.forEach(function (c, i) {
      metaHtml += (i ? '<span class="dot"></span>' : '') + '<span>' + esc(c) + '</span>';
    });
    // NO per-row play button (UAT 2026-08-09 round 5, "tapping the row
    // anywhere will already play"): the body tap IS the play control (batch
    // 4), so a dedicated ▶ duplicated the same action at a 44px-slot cost -
    // on a 412px phone that slot was exactly the width squeezing long titles
    // into a one-word-per-line column. The playing indicator (equalizer)
    // lives in the leading chip now; `act` still names whether the row is
    // playable (the callers key body-tap behavior off the same predicate).

    // Trailing affordances. A set row is ALWAYS reorderable + removable now
    // (operator UAT: no Edit round-trip, drag anytime). Reorder is a dedicated
    // grip (drag from the grip; a body tap still plays - the grip carries no tap
    // action, so it never opens the song). Remove is the arm-to-delete handle -
    // its red-arm IS the mis-tap guard, so both can live on the resting rail
    // without the old one-thumb-minefield risk. The up/dn arrows retired: drag
    // replaces them. Round 5: the grip STACKS UNDER the position chip in a
    // narrow left rail (operator: "reorg the drag icon below the track
    // number") so the horizontal budget goes to the title; only the arm-red x
    // stays trailing.
    var ctrl = '';
    if (seg === 'set') {
      ctrl = btn('li-rm', '&#215;', 'rm', ' title="Remove from set"');
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

    // Set rows lead with a RAIL (position chip stacked over the drag grip -
    // one narrow column); library rows keep the bare chip. The grip is
    // drag-only, full rail width, and grows with the row (flex-fill in CSS).
    var lead = (seg === 'set')
      ? '<div class="li-rail">' + num
        + '<button class="li-grip" type="button" aria-label="Drag to reorder" title="Drag to reorder">&#8942;&#8942;</button>'
        + '</div>'
      : num;

    root.innerHTML = lead
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
        if (a === 'lead' && opts.onLead) opts.onLead(rec);
        else if (a === 'add' && opts.onAdd) opts.onAdd(rec);
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
    return root;
  }

  var ListItem = {
    normalize: normalize, action: action, keyLabel: keyLabel,
    hazards: hazards, metaCells: metaCells, render: render, wireTap: wireTap
  };
  global.ListItem = ListItem;
  if (typeof module !== 'undefined' && module.exports) module.exports = ListItem;

})(typeof window !== 'undefined' ? window : this);
