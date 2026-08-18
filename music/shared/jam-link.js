/* =====================================================================
 * jam-link.js  -  S14 (agent-interaction spec section 4b): parse the
 * `?jam=` deep-link contract into an EPHEMERAL jam setup. Pure, dependency
 * -free (competency.js / skill-md.js discipline): no DOM, no storage,
 * never throws. Exposes window.JamLink and require()-able in Node.
 *
 * Contract (LOCKED - docs/plans/goal-agent-interaction-20260817.md 4b):
 *   music/play/?jam=<progression>&key=<tonic>&yt=<videoId>&name=<label>
 *   - jam: comma-separated canonical-sharp chord tokens, URL-encoded
 *          (jam=Am,F,C,G ; jam=A%23m,E). A flat root NORMALIZES to its
 *          canonical-sharp spelling for identity (KEY-STORE-PREF note-
 *          spelling regime); the chord QUALITY suffix passes through
 *          untouched. Any single invalid token drops the WHOLE jam
 *          param (no partial jam) - never a silently truncated groove.
 *   - key:  preferred tonic name + optional minor marker "m"
 *           (key=G, key=Am). Optional. The tonic is NOT re-spelled here
 *           (display respelling is the app's job, per DISP-CHORD-NAME).
 *   - yt:   an 11-char YouTube video id, OR a watch/youtu.be/embed URL
 *           (id extracted client-side). Optional. Keyless embed only -
 *           PLAYLIST-KEYLESS: never an API key, never a lookup call.
 *   - name: URL-encoded label for the Save form. Optional.
 * Unknown/malformed params are IGNORED (defensive-reader law) - a stale
 * cached build degrades to opening the app normally, never an error.
 * ===================================================================== */
(function (root) {
  'use strict';

  // The app's own token convention (music/CLAUDE.md: "Chord tokens ...
  // must match ^[A-G][#b]?..."). Deliberately permissive on the quality
  // suffix (m, 7, maj7, sus4, m7b5, add9, ...) - that vocabulary is open-
  // ended and enumerating it here would just re-derive theory.js's job.
  var TOKEN_RE = /^[A-G][#b]?[^\s,]*$/;
  var ROOT_RE = /^([A-G])(#|b)?(.*)$/;
  var KEY_RE = /^([A-G])(#|b)?(m)?$/;
  var YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var YT_URL_RE = /(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/;

  // KEY-STORE-PREF: canonical-sharp storage identity. Only the 5 flat
  // roots that actually occur as typed/agent-emitted chord roots are
  // mapped - the rare enharmonic spellings (Cb, Fb, E#, B#) pass through
  // unchanged rather than guessing a re-spelling nobody asked for.
  var FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

  function normalizeToken(tok) {
    var m = ROOT_RE.exec(tok);
    if (!m) return tok; // caller already validated with TOKEN_RE; defensive only
    var root = m[1] + (m[2] || '');
    var sharp = FLAT_TO_SHARP[root];
    return (sharp || root) + m[3];
  }

  // jam=<comma-separated tokens> -> [] on absent/empty/any-invalid-token
  // (the "drop the whole jam param" rule), else the canonical-sharp array.
  function parseChords(raw) {
    if (!raw) return [];
    var parts = String(raw).split(',').map(function (s) { return s.trim(); });
    if (!parts.length || parts.some(function (s) { return !s || !TOKEN_RE.test(s); })) return [];
    return parts.map(normalizeToken);
  }

  // key=<tonic><m?> -> { tonic, minor } | null. Malformed -> null (never
  // rejects the rest of the link).
  function parseKey(raw) {
    if (!raw) return null;
    var m = KEY_RE.exec(String(raw).trim());
    if (!m) return null;
    return { tonic: m[1] + (m[2] || ''), minor: !!m[3] };
  }

  // yt=<11-char id> | <watch/youtu.be/embed URL> -> id string | null.
  function parseYt(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    if (YT_ID_RE.test(s)) return s;
    var m = YT_URL_RE.exec(s);
    return m ? m[1] : null;
  }

  function parseName(raw) {
    var s = (raw == null) ? '' : String(raw).trim();
    return s || null;
  }

  // parse(searchString) -> { ok:true, setup:{chords,key,yt,name} } | { ok:false }
  // searchString is typically location.search ('?jam=...&key=...'); a
  // leading '?' is optional (URLSearchParams tolerates either). Never
  // throws - any unexpected input degrades to { ok:false }.
  function parse(searchString) {
    try {
      var qp = new URLSearchParams(searchString || '');
      var chords = parseChords(qp.get('jam'));
      var key = parseKey(qp.get('key'));
      var yt = parseYt(qp.get('yt'));
      var name = parseName(qp.get('name'));
      if (!chords.length && !key && !yt && !name) return { ok: false };
      return { ok: true, setup: { chords: chords, key: key, yt: yt, name: name } };
    } catch (e) {
      return { ok: false };
    }
  }

  var API = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.JamLink = API;

})(typeof window !== 'undefined' ? window : this);
