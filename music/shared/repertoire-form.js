/* =====================================================================
 * repertoire-form.js  -  M2 unified Add/Edit form for custom repertoire items
 * ---------------------------------------------------------------------
 * ONE form, two entry modes (create / edit), for user-owned ("Mine") songs
 * and standalone backing tracks. Curated catalog (non-custom) items stay
 * read-only - this form never touches songs.json / tracks.json.
 *
 * Mountable, instrument-agnostic, no build step (flat <script>, matches the
 * rest of music/shared/). Pure field-parsing helpers are exported for tests.
 *
 *   RepertoireForm.mount({ container? })  -> { open(opts), close() }
 *     opts = {
 *       mode: 'create' | 'edit',
 *       item: {...} (edit mode: the existing custom song/track to prefill),
 *       onSave: function(fields) -> saved item or null (host persists),
 *       onDelete: function() (edit mode only; optional)
 *     }
 * ===================================================================== */
(function (global) {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Parse a freeform chords/seq textarea (space or comma separated tokens) into
  // a clean chord-token array. Empty input -> [] (a standalone track, no sheet).
  function parseSeq(raw) {
    return String(raw || '').split(/[\s,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function seqToText(seq) { return (Array.isArray(seq) ? seq : []).join(' '); }
  // The 4-mode vocabulary the Compose flow saves (locked interface). The form
  // must round-trip ALL of them - a select limited to major/minor silently
  // rewrote dorian/mixolydian songs to major on every edit.
  var MODES = ['major', 'minor', 'dorian', 'mixolydian'];
  function normFormMode(v) {
    var m = String(v == null ? '' : v).trim().toLowerCase();
    return MODES.indexOf(m) >= 0 ? m : 'major';
  }
  // Read the form's current field state into the { title, artist, key, mode,
  // genre, seq, yt } shape songbook.js's create/updateCustomItem expect.
  function readFields(form, parseYouTubeId) {
    var title = form.querySelector('[data-title]').value.trim();
    var artist = form.querySelector('[data-artist]').value.trim();
    var keyRaw = form.querySelector('[data-key]').value.trim();
    var mode = normFormMode(form.querySelector('[data-mode]').value);
    var genre = form.querySelector('[data-genre]').value.trim();
    var seq = parseSeq(form.querySelector('[data-seq]').value);
    var urlRaw = form.querySelector('[data-url]').value.trim();
    var yt = urlRaw ? (parseYouTubeId ? parseYouTubeId(urlRaw) : null) : null;
    return {
      title: title, artist: artist, key: keyRaw || null, mode: mode,
      genre: genre, seq: seq, yt: yt, _urlRaw: urlRaw, _urlInvalid: !!(urlRaw && !yt)
    };
  }

  function mount(opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'rf-ov';
    document.body.appendChild(el);
    var current = null; // { mode, item, onSave, onDelete }

    function close() { el.classList.remove('on'); el.innerHTML = ''; current = null; }

    function render() {
      var editing = current.mode === 'edit';
      var it = current.item || {};
      // Prefill from the item in BOTH modes: edit fills from the existing custom
      // item; create fills from a passed-in seed (e.g. a Studio track whose video
      // the user wants to curate). Create with no item -> it is {} -> all blank.
      var title = it.t || it.title || '';
      var artist = it.a || it.artist || '';
      var key = it.key || '';
      var mode = normFormMode(it.mode);
      var genre = it.genre || '';
      var seqText = seqToText(it.seq);
      var urlText = it.yt ? ('https://youtu.be/' + it.yt) : '';
      var rootOpts = ROOTS.map(function (r) { return '<option value="' + esc(r) + '"' + (r === key ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('');
      el.innerHTML =
        '<div class="rf-box" role="dialog" aria-label="' + (editing ? 'Edit repertoire item' : 'Add a song or track') + '">'
        + '<div class="rf-head"><span class="rf-t">' + (editing ? 'Edit' : 'Add a song or track') + '</span>'
        + '<button class="rf-x" type="button" data-close>close</button></div>'
        + '<div class="rf-body">'
        + '<label class="rf-lbl">Title</label><input data-title class="bt-in" value="' + esc(title) + '" placeholder="Song or track title" autocomplete="off">'
        + '<label class="rf-lbl">Artist</label><input data-artist class="bt-in" value="' + esc(artist) + '" placeholder="Artist (optional)" autocomplete="off">'
        + '<div class="rf-grid">'
        + '<div><label class="rf-lbl">Key</label><select data-key class="bt-in"><option value="">-</option>' + rootOpts + '</select></div>'
        + '<div><label class="rf-lbl">Mode</label><select data-mode class="bt-in">'
        + MODES.map(function (m) { return '<option value="' + m + '"' + (mode === m ? ' selected' : '') + '>' + m + '</option>'; }).join('')
        + '</select></div></div>'
        + '<label class="rf-lbl">Genre</label><input data-genre class="bt-in" value="' + esc(genre) + '" placeholder="Genre (optional)" autocomplete="off">'
        + '<label class="rf-lbl">Chords <span class="rf-opt">(optional - leave blank for a video-only track)</span></label>'
        + '<textarea data-seq class="bt-in rf-seq" placeholder="e.g. G D Em C" rows="2">' + esc(seqText) + '</textarea>'
        + '<label class="rf-lbl">Video URL <span class="rf-opt">(optional)</span></label>'
        + '<input data-url class="bt-in" value="' + esc(urlText) + '" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">'
        + '<div class="rf-actions">'
        + '<button class="btn red" data-save type="button">' + (editing ? 'Save changes' : 'Create') + '</button>'
        + (editing && current.onDelete ? '<button class="btn ghost" data-delete type="button">Delete</button>' : '')
        + '</div></div></div>';
      el.classList.add('on');
      el.querySelector('[data-close]').onclick = close;
      el.onclick = function (e) { if (e.target === el) close(); };
      var urlIn = el.querySelector('[data-url]');
      urlIn.oninput = function () { urlIn.classList.remove('bad'); };
      var titleIn = el.querySelector('[data-title]');
      titleIn.oninput = function () { titleIn.classList.remove('bad'); };
      el.querySelector('[data-save]').onclick = function () {
        var f = readFields(el, (global.Tracks && global.Tracks.parseYouTubeId) || null);
        if (!f.title) { titleIn.classList.add('bad'); try { titleIn.focus({ preventScroll: true }); } catch (e2) { titleIn.focus(); } return; }
        if (f._urlInvalid) { urlIn.classList.add('bad'); try { urlIn.focus({ preventScroll: true }); } catch (e2) { urlIn.focus(); } return; }
        delete f._urlRaw; delete f._urlInvalid;
        var saved = current.onSave && current.onSave(f);
        if (saved !== false) close();
      };
      if (current.onDelete) {
        var delBtn = el.querySelector('[data-delete]');
        if (delBtn) delBtn.onclick = function () {
          if (confirm('Delete this ' + (it.seq && it.seq.length ? 'song' : 'track') + '?')) { current.onDelete(); close(); }
        };
      }
    }

    function open(o) {
      current = { mode: o.mode === 'edit' ? 'edit' : 'create', item: o.item || null, onSave: o.onSave || null, onDelete: o.onDelete || null };
      render();
    }

    return { open: open, close: close };
  }

  var RepertoireForm = { mount: mount, parseSeq: parseSeq, seqToText: seqToText, readFields: readFields, normFormMode: normFormMode, MODES: MODES };
  global.RepertoireForm = RepertoireForm;
  if (typeof module !== 'undefined' && module.exports) module.exports = RepertoireForm;

})(typeof window !== 'undefined' ? window : this);
