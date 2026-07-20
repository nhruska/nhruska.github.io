/* =====================================================================
 * yt-info.js - given a YouTube URL, fetch its public video info (keyless,
 * no API key) and derive best-effort field hints (title/artist split,
 * key/mode/genre/bpm) from the title text.
 * ---------------------------------------------------------------------
 * Two independent halves, both usable standalone:
 *
 *   YtInfo.fetchInfo(url, opts?) -> Promise<{title, author} | null>
 *     Network lookup. NEVER rejects - any failure (bad id, no fetch, CORS
 *     block, timeout, malformed response) resolves null so a form hook can
 *     treat "no info" as a plain no-op, not an error to surface.
 *
 *   YtInfo.parseHints(title, author) -> { t, a, key, mode, genre, bpm }
 *     Pure, no network. Best-effort parse of a video title (+ channel name
 *     as a disambiguation aid) into repertoire-form field hints. Any field
 *     the parse can't find is null - callers apply only the non-null ones.
 *
 * Network strategy (both keyless, no API key anywhere in this module):
 *   A. YouTube's own oEmbed endpoint (www.youtube.com/oembed) - the
 *      primary keyless lookup.
 *   B. noembed.com/embed - a CORS-friendly third-party wrapper over the
 *      same oEmbed data. Used ONLY as a fallback if A fails, and is itself
 *      feature-detected/timed-out so a flaky third party can never wedge
 *      the primary UI flow.
 *
 * Depends on nothing at load time - Tracks.parseYouTubeId and
 * Circle.spellRoot are used WHEN REACHABLE (both resolved at CALL time via
 * `global.*`, not at module-definition time), so this file's position in
 * play/index.html's script order relative to tracks.js/circle.js does not
 * matter. Falls back to a local copy of each when the other module isn't
 * loaded (e.g. under node in tests, or if load order changes).
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---- video id extraction -----------------------------------------------
  function videoId(url) {
    if (global.Tracks && typeof global.Tracks.parseYouTubeId === 'function') {
      return global.Tracks.parseYouTubeId(url);
    }
    url = String(url || '').trim();
    var m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    return null;
  }

  // ---- network: oEmbed (keyless) with a CORS-friendly fallback ----------
  var TIMEOUT_MS = 5000;
  var ENDPOINTS = [
    function (watchUrl) { return 'https://www.youtube.com/oembed?url=' + encodeURIComponent(watchUrl) + '&format=json'; },
    function (watchUrl) { return 'https://noembed.com/embed?url=' + encodeURIComponent(watchUrl); }
  ];

  function fetchWithTimeout(fetchImpl, url, ms) {
    if (typeof AbortController === 'function') {
      var ac = new AbortController();
      var timer = setTimeout(function () { ac.abort(); }, ms);
      return fetchImpl(url, { signal: ac.signal }).then(
        function (r) { clearTimeout(timer); return r; },
        function (e) { clearTimeout(timer); throw e; }
      );
    }
    return fetchImpl(url);
  }

  // fetchInfo(url, opts?) -> Promise<{title, author} | null>. opts.fetch
  // overrides the fetch implementation (test seam) - pass explicit `null` to
  // force the no-fetch-available path (distinct from omitting the key, which
  // falls back to global.fetch); opts.timeoutMs overrides the per-endpoint
  // timeout (default 5000ms).
  function fetchInfo(url, opts) {
    opts = opts || {};
    var id = videoId(url);
    if (!id) return Promise.resolve(null);
    var fetchImpl = 'fetch' in opts ? opts.fetch : (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
    if (!fetchImpl) return Promise.resolve(null); // no fetch available - fail soft, never throw
    var ms = opts.timeoutMs || TIMEOUT_MS;
    var canonicalUrl = 'https://www.youtube.com/watch?v=' + id;

    function tryEndpoint(i) {
      if (i >= ENDPOINTS.length) return Promise.resolve(null);
      var endpointUrl = ENDPOINTS[i](canonicalUrl);
      return fetchWithTimeout(fetchImpl, endpointUrl, ms).then(function (res) {
        if (!res || !res.ok) return tryEndpoint(i + 1);
        return res.json().then(function (data) {
          if (!data || !data.title) return tryEndpoint(i + 1);
          return { title: String(data.title), author: String(data.author_name || '') };
        }, function () { return tryEndpoint(i + 1); });
      }, function () { return tryEndpoint(i + 1); });
    }
    return tryEndpoint(0);
  }

  // ---- title/author -> field hints (pure, no network) --------------------
  // Genre keyword scan order IS the tie-break when a title mentions more than
  // one (e.g. a title that says both "blues" and "funky") - first list match
  // wins. Order chosen to match jam-queries.js's most-common-first framing.
  var GENRE_KEYWORDS = ['blues', 'funk', 'rock', 'jazz', 'reggae', 'country', 'folk', 'metal', 'pop', 'soul', 'bluegrass', 'gospel'];
  // The app's actual mode SELECT vocabulary (repertoire-form.js MODES) - a
  // parsed qualifier outside this set (e.g. "blues", "lydian") still yields
  // a genre/key hint but leaves .mode null rather than forcing an unsupported
  // value into the 4-option select.
  var SUPPORTED_MODES = ['major', 'minor', 'dorian', 'mixolydian'];
  // Key display in this app is sharp-canonical. Delegate to Circle.spellRoot
  // when reachable so a title like "Bb blues" hints key:'A#', matching every
  // other key label; local F2S fallback only if circle.js isn't loaded (this
  // module must not hard-require it - see the header note on call-time
  // resolution).
  var F2S = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  function normRoot(r) {
    if (global.Circle && typeof global.Circle.spellRoot === 'function') {
      var spelled = global.Circle.spellRoot(r);
      if (spelled) return spelled;
    }
    return F2S[r] || r;
  }
  // "A minor", "Bb blues", "G mixolydian", "Cm" (chord-shorthand minor, very
  // common in real backing-track titles) - root + optional accidental, then
  // either a scale-word or the bare 'm' shorthand, word-boundaried both ends
  // so "Amanda"/"Gigi"/"Ambient" never false-match.
  var WORD_RE = /\b([A-G])([#b]?)\s*(major|minor|dorian|mixolydian|lydian|phrygian|locrian|blues)\b/i;
  var SHORTHAND_RE = /\b([A-G])([#b]?)m\b/;
  function parseKeyMode(text) {
    var m = WORD_RE.exec(text);
    if (m) {
      var root = m[1].toUpperCase() + (m[2] === '#' ? '#' : m[2] === 'b' ? 'b' : '');
      var word = m[3].toLowerCase();
      return { key: normRoot(root), mode: SUPPORTED_MODES.indexOf(word) >= 0 ? word : null };
    }
    var sh = SHORTHAND_RE.exec(text);
    if (sh) {
      var shRoot = sh[1].toUpperCase() + (sh[2] === '#' ? '#' : sh[2] === 'b' ? 'b' : '');
      return { key: normRoot(shRoot), mode: 'minor' };
    }
    return { key: null, mode: null };
  }
  function parseGenre(text) {
    var lower = String(text || '').toLowerCase();
    for (var i = 0; i < GENRE_KEYWORDS.length; i++) {
      if (lower.indexOf(GENRE_KEYWORDS[i]) >= 0) return GENRE_KEYWORDS[i];
    }
    return null;
  }
  function parseBpm(text) {
    var m = /(\d{2,3})\s*bpm/i.exec(String(text || ''));
    return m ? parseInt(m[1], 10) : null;
  }
  // Split "Artist - Title" (or the just-as-common reversed "Title - Artist"
  // real-world convention) on a dash/pipe separator. When a channel name
  // (oEmbed author_name) is known, prefer whichever half it matches so the
  // reversed convention doesn't silently swap fields; falls back to the
  // "first half = artist" convention when neither half matches or no
  // channel name is available. No separator -> whole string is the title,
  // channel name (if any) becomes the artist guess; never invent one.
  function splitArtistTitle(title, author) {
    var raw = String(title || '');
    var m = /^\s*(.+?)\s*[-–—|]\s*(.+?)\s*$/.exec(raw);
    var chan = String(author || '').trim().toLowerCase();
    if (!m) return { a: chan ? String(author).trim() : null, t: raw.trim() };
    var left = m[1], right = m[2];
    if (chan) {
      var leftIsChan = left.toLowerCase().indexOf(chan) >= 0 || chan.indexOf(left.toLowerCase()) >= 0;
      var rightIsChan = right.toLowerCase().indexOf(chan) >= 0 || chan.indexOf(right.toLowerCase()) >= 0;
      if (rightIsChan && !leftIsChan) return { a: right, t: left };
    }
    return { a: left, t: right };
  }
  function parseHints(title, author) {
    var split = splitArtistTitle(title, author);
    var km = parseKeyMode(String(title || ''));
    return {
      t: split.t || null,
      a: split.a || null,
      key: km.key,
      mode: km.mode,
      genre: parseGenre(title),
      bpm: parseBpm(title)
    };
  }

  var YtInfo = {
    videoId: videoId,
    fetchInfo: fetchInfo,
    parseHints: parseHints,
    // exported for direct unit testing of the sub-steps
    splitArtistTitle: splitArtistTitle,
    parseKeyMode: parseKeyMode,
    parseGenre: parseGenre,
    parseBpm: parseBpm,
    SUPPORTED_MODES: SUPPORTED_MODES
  };
  global.YtInfo = YtInfo;
  if (typeof module !== 'undefined' && module.exports) module.exports = YtInfo;

})(typeof window !== 'undefined' ? window : this);
