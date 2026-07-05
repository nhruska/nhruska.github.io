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
 *       fork: boolean (optional; forking a catalog song - hides the Chords field
 *             since chords+lyrics are preserved from the original, and relabels
 *             the dialog "Edit" (F24, was "Make it mine") / delete -> "Revert
 *             to original"),
 *       item: {...} (edit mode: the existing custom song/track to prefill; also
 *             the fork seed in fork+create mode),
 *       onSave: function(fields) (host persists; may navigate). A VALID save always
 *             closes the form (via NavHistory.settleAfter) - the return value is no
 *             longer a close-veto. Invalid input (empty title / bad URL) is caught
 *             BEFORE onSave and keeps the form open.
 *       onDelete: function() (edit mode only; optional)
 *     }
 * ===================================================================== */
(function (global) {
  'use strict';

  var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // S-HARDEN (analysis-refactor-enhance-20260704 A5): delegates to the shared
  // esc.js (loaded before this file everywhere it's consumed) - was one of
  // ~8 divergent local copies.
  function esc(s) { return global.Esc.esc(s); }
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
    var seqEl = form.querySelector('[data-seq]'); // absent in fork mode (chords preserved)
    var seq = seqEl ? parseSeq(seqEl.value) : undefined;
    var urlRaw = form.querySelector('[data-url]').value.trim();
    var yt = urlRaw ? (parseYouTubeId ? parseYouTubeId(urlRaw) : null) : null;
    return {
      title: title, artist: artist, key: keyRaw || null, mode: mode,
      genre: genre, seq: seq, yt: yt, _urlRaw: urlRaw, _urlInvalid: !!(urlRaw && !yt)
    };
  }

  // U17 (M-TRACKLIB w2a) - given parsed YtInfo hints + the form's CURRENT
  // string values, decide which fields are eligible for the suggestion -
  // apply-to-empty-only, so a suggestion never overwrites something the
  // operator already typed. Pure (no DOM) so the "empty only" contract is
  // directly unit-testable (see test/repertoire-form.test.js). The Mode
  // field has no true "empty" state (Key does - value ''), so its untouched
  // sentinel is the rendered default 'major' - a deliberate, named scope
  // note (see the shipping PR body), not a restructuring of the form.
  function applicableYtHints(hints, cur) {
    hints = hints || {}; cur = cur || {};
    var out = {};
    if (hints.t && !String(cur.title || '').trim()) out.title = hints.t;
    if (hints.a && !String(cur.artist || '').trim()) out.artist = hints.a;
    if (hints.key && !cur.key) out.key = hints.key;
    if (hints.mode && cur.mode === 'major') out.mode = hints.mode;
    if (hints.genre && !String(cur.genre || '').trim()) out.genre = hints.genre;
    return out;
  }

  // U17 (M-TRACKLIB w2a) - YT-prefill: wires the Video URL field's paste/blur
  // hook to shared/yt-info.js and renders a one-tap SUGGEST row. Entirely
  // additive to the existing form: no new persisted fields, applies ONLY to
  // the 5 fields the form already has (title/artist/key/mode/genre) - the
  // module's bpm hint has no field to land in yet, so it's surfaced as a
  // caption-only note. Fails silent (hidden row, zero errors) whenever
  // YtInfo is missing, the URL doesn't resolve to a video, or the network
  // lookup comes back empty - never blocks Save.
  function wireYtSuggest(el) {
    var urlIn = el.querySelector('[data-url]');
    var row = el.querySelector('[data-yt-suggest]');
    if (!urlIn || !row) return; // fork mode / unexpected DOM shape - no-op
    var lastUrl = null, pendingToken = 0;

    function fieldEls() {
      return {
        title: el.querySelector('[data-title]'),
        artist: el.querySelector('[data-artist]'),
        key: el.querySelector('[data-key]'),
        mode: el.querySelector('[data-mode]'),
        genre: el.querySelector('[data-genre]')
      };
    }
    function hideRow() { row.hidden = true; row.innerHTML = ''; }
    function showPending() {
      row.hidden = false;
      row.innerHTML = '<span class="rf-yt-pending">Looking up video info...</span>';
    }
    function applicableHints(hints) {
      var f = fieldEls();
      return applicableYtHints(hints, { title: f.title.value, artist: f.artist.value, key: f.key.value, mode: f.mode.value, genre: f.genre.value });
    }
    // bpm has no form field to land in (named scope note above) - it's folded
    // into the summary text as a parenthetical when there's an applicable
    // field to attach it to, or stands alone when it's the ONLY thing found
    // (e.g. a title with no key/genre/artist info but a "120 bpm" token).
    function summaryText(hints, applicable) {
      var bits = [];
      if (applicable.title) bits.push('"' + hints.t + '"');
      if (applicable.artist) bits.push('by ' + hints.a);
      if (applicable.key || applicable.mode) bits.push([applicable.key, applicable.mode].filter(Boolean).join(' '));
      if (applicable.genre) bits.push(hints.genre);
      var main = bits.join(', ');
      var bpmNote = hints.bpm ? ('~' + hints.bpm + ' bpm') : '';
      if (main && bpmNote) return main + ' (' + bpmNote + ')';
      return main || bpmNote;
    }
    function applyHints(applicable) {
      var f = fieldEls();
      if (applicable.title) f.title.value = applicable.title;
      if (applicable.artist) f.artist.value = applicable.artist;
      if (applicable.key) f.key.value = applicable.key;
      if (applicable.mode) f.mode.value = applicable.mode;
      if (applicable.genre) f.genre.value = applicable.genre;
      f.title.classList.remove('bad');
    }
    function showReady(hints, applicable) {
      // A bpm-only find (no field to apply it to) has nothing an Apply button
      // would do - show it as an info line with only a Dismiss, not a dead
      // Apply. Every other case has >=1 field an Apply genuinely fills.
      var hasApplicable = !!Object.keys(applicable).length;
      row.hidden = false;
      row.innerHTML = '<span class="rf-yt-txt">' + (hasApplicable ? 'Use: ' : '') + esc(summaryText(hints, applicable)) + '</span>'
        + '<div class="rf-yt-actions">'
        + (hasApplicable ? '<button type="button" class="rf-yt-apply" data-yt-apply>Apply</button>' : '')
        + '<button type="button" class="rf-yt-dismiss" data-yt-dismiss>Dismiss</button>'
        + '</div>';
      if (hasApplicable) row.querySelector('[data-yt-apply]').onclick = function () { applyHints(applicable); hideRow(); };
      row.querySelector('[data-yt-dismiss]').onclick = function () { hideRow(); };
    }
    function maybeSuggest(url) {
      if (!url) { hideRow(); lastUrl = null; return; }
      if (url === lastUrl) return; // no change since the last check
      lastUrl = url;
      if (!global.YtInfo) { hideRow(); return; } // module unavailable - fail soft
      var id = global.YtInfo.videoId(url);
      if (!id) { hideRow(); return; }
      var token = ++pendingToken;
      showPending();
      global.YtInfo.fetchInfo(url).then(function (info) {
        if (token !== pendingToken) return; // stale - the field changed again mid-flight
        if (!info) { hideRow(); return; }
        var hints = global.YtInfo.parseHints(info.title, info.author);
        var applicable = applicableHints(hints);
        if (!Object.keys(applicable).length && !hints.bpm) { hideRow(); return; }
        showReady(hints, applicable);
      }, function () { if (token === pendingToken) hideRow(); });
    }
    urlIn.addEventListener('blur', function () { maybeSuggest(urlIn.value.trim()); });
    urlIn.addEventListener('paste', function () { setTimeout(function () { maybeSuggest(urlIn.value.trim()); }, 0); });
  }

  function mount(opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'rf-ov';
    document.body.appendChild(el);
    var current = null; // { mode, item, onSave, onDelete }

    function close() { el.classList.remove('on'); el.innerHTML = ''; current = null; }
    // User-initiated close: route through NavHistory.dismiss() so the pushed
    // history entry pops in step with the DOM close (single close path via
    // popstate -> close). Falls back to the raw close() if no layer is open.
    function dismissForm() {
      if (global.NavHistory && global.NavHistory.depth()) global.NavHistory.dismiss();
      else close();
    }

    function render() {
      var editing = current.mode === 'edit';
      var fork = !!current.fork; // forking a catalog song: chords+lyrics come from
                                 // the original (preserved), so hide the Chords field
                                 // in this slice (full sheet editing is the next one).
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
        // F24 (operator UAT 2026-07-05): fork's dialog title/aria-label read
        // "Edit" (was "Make it mine") - the user doesn't need to know a
        // fork/copy happens under the hood. F23: "repertoire" -> "Library".
        '<div class="rf-box" role="dialog" aria-label="' + (fork ? 'Edit' : editing ? 'Edit library item' : 'Add a song or track') + '">'
        + '<div class="rf-head"><span class="rf-t">' + (fork ? 'Edit' : editing ? 'Edit' : 'Add a song or track') + '</span>'
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
        // Fork mode preserves the catalog song's chords + lyrics, so the Chords
        // field is hidden (a chord-only edit here would drop the lyric lines).
        + (fork
          ? '<div class="rf-note">Chords and lyrics stay from the original song. Editing them is coming next.</div>'
          : '<label class="rf-lbl">Chords <span class="rf-opt">(optional - leave blank for a video-only track)</span></label>'
            + '<textarea data-seq class="bt-in rf-seq" placeholder="e.g. G D Em C" rows="2">' + esc(seqText) + '</textarea>')
        + '<label class="rf-lbl">Video URL <span class="rf-opt">(optional)</span></label>'
        + '<input data-url class="bt-in" value="' + esc(urlText) + '" placeholder="Paste a YouTube URL" autocomplete="off" inputmode="url">'
        // U17 (M-TRACKLIB w2a): YT-prefill suggestion row - populated/shown by
        // wireYtSuggest() below, hidden until a valid video URL resolves info.
        + '<div class="rf-yt-suggest" data-yt-suggest hidden></div>'
        // F33 (UAT): Delete/Revert renders FIRST (left, away from the one-hand
        // thumb zone) and Save renders SECOND (the thumb-easy right slot) - the
        // operator flagged the old order ("delete seems to be in a risky place...
        // bottom right should be save") plus the wrong color ("delete buttons
        // should be red" - .btn.red is actually the accent fill, a misnomer; see
        // .btn.danger in songbook.css). The REAL Delete is genuinely destructive
        // (.btn.danger); the fork "Revert to original" is NOT a delete (no data
        // is destroyed, a slot is replaced in place) so it stays .btn.ghost.
        + '<div class="rf-actions">'
        + (editing && current.onDelete ? '<button class="btn ' + (fork ? 'ghost' : 'danger') + '" data-delete type="button">' + (fork ? 'Revert to original' : 'Delete') + '</button>' : '')
        + '<button class="btn red" data-save type="button">' + (fork && !editing ? 'Save to my Library' : editing ? 'Save changes' : 'Create') + '</button>'
        + '</div></div></div>';
      el.classList.add('on');
      el.querySelector('[data-close]').onclick = dismissForm;
      el.onclick = function (e) { if (e.target === el) dismissForm(); };
      var urlIn = el.querySelector('[data-url]');
      urlIn.oninput = function () { urlIn.classList.remove('bad'); };
      var titleIn = el.querySelector('[data-title]');
      titleIn.oninput = function () { titleIn.classList.remove('bad'); };
      el.querySelector('[data-save]').onclick = function () {
        var f = readFields(el, (global.Tracks && global.Tracks.parseYouTubeId) || null);
        if (!f.title) { titleIn.classList.add('bad'); try { titleIn.focus({ preventScroll: true }); } catch (e2) { titleIn.focus(); } return; }
        if (f._urlInvalid) { urlIn.classList.add('bad'); try { urlIn.focus({ preventScroll: true }); } catch (e2) { urlIn.focus(); } return; }
        delete f._urlRaw; delete f._urlInvalid;
        // Save may navigate (fork -> Practice, edit-with-video -> Studio) or not (plain
        // add). settleAfter runs onSave FIRST then closes the form, so onSave's new layer
        // takes the form's history slot (no async back/push race) and a save error stays
        // visible with the form open; a no-nav save collapses the slot. Falls back to the
        // raw save+close when NavHistory is absent.
        // Capture the callback into a local (defensive: keeps this robust even if
        // settleAfter's close ordering changes so `current` is nulled before onSave runs).
        var onSave = current.onSave;
        var doSave = function () { if (onSave) onSave(f); };
        if (global.NavHistory) global.NavHistory.settleAfter(close, doSave);
        else { doSave(); close(); }
      };
      if (current.onDelete) {
        var delBtn = el.querySelector('[data-delete]');
        if (delBtn) delBtn.onclick = function () {
          var msg = fork ? 'Revert to the original song? Your edits and video will be removed.'
            : 'Delete this ' + (it.seq && it.seq.length ? 'song' : 'track') + '?';
          if (confirm(msg)) {
            // Delete navigates (switchTab('library')): same transition hand-off as save.
            // Capture onDelete FIRST (close() nulls current before runNext runs).
            var onDelete = current.onDelete;
            var doDelete = function () { if (onDelete) onDelete(); };
            if (global.NavHistory) global.NavHistory.settleAfter(close, doDelete);
            else { doDelete(); close(); }
          }
        };
      }
      wireYtSuggest(el);
    }

    function open(o) {
      current = { mode: o.mode === 'edit' ? 'edit' : 'create', fork: !!o.fork, item: o.item || null, onSave: o.onSave || null, onDelete: o.onDelete || null };
      render();
      if (global.NavHistory) global.NavHistory.open('form', close);
    }

    return { open: open, close: close };
  }

  var RepertoireForm = { mount: mount, parseSeq: parseSeq, seqToText: seqToText, readFields: readFields, normFormMode: normFormMode, MODES: MODES, applicableYtHints: applicableYtHints };
  global.RepertoireForm = RepertoireForm;
  if (typeof module !== 'undefined' && module.exports) module.exports = RepertoireForm;

})(typeof window !== 'undefined' ? window : this);
