/* =====================================================================
 * playlist-import.js  -  user-facing "import your YouTube playlist"
 * ---------------------------------------------------------------------
 * Keyless, client-side, no backend: the YouTube IFrame embed will cue a
 * public/unlisted playlist (embed/videoseries?list=...) and, once the
 * postMessage 'listening' handshake is up, its infoDelivery messages carry
 * the playlist's VIDEO IDS (info.playlist). Titles + channel names come
 * from noembed.com per id (CORS-enabled oEmbed proxy - youtube.com/oembed
 * itself sends no CORS headers). Key/mode/genre/bpm are auto-parsed from
 * each title (YtInfo.parseHints + the import ladder below); the user fixes
 * misses in the existing edit form (auto-parse, edit-later - the ruled UX).
 *
 * PRIVATE playlists cannot be read this way (the embed refuses them) -
 * public or unlisted only. That is the price of keyless, by design
 * (PLAYLIST-KEYLESS decision: no API key ever ships in a static app).
 *
 * Import KEY LADDER (import policy - deliberately NOT folded into yt-info's
 * parseKeyMode, whose contract other consumers pin):
 *   1. YtInfo.parseHints key (word/shorthand shapes: "in A Major", "[Fm]",
 *      "Bb blues", "Cm") - mode falls back to 'blues' when the title's
 *      genre is blues, else 'major'.
 *   2. Bare-root fallback: "in A" / "Key of E" with NO scale word - real
 *      backing-track titles use it constantly ("Slow Blues Jam in A").
 *      Case-sensitive root so "in a sentimental mood" never matches.
 *      Mode: trailing shorthand m -> minor; blues genre -> blues; else major.
 *   3. No key found -> the track is SKIPPED and reported, never imported
 *      with an invented key center (a wrong home note teaches wrong notes -
 *      the app is a harmony teacher first).
 * Stored keys use the PREFERRED tonic name (Eb not D#) via
 * Circle.preferredTonicName, matching the catalog (KEY-STORE-PREF).
 *
 * Pure helpers (playlistId, resolveKey, entriesFromInfo) are exported for
 * node tests; the iframe/fetch driver is browser-only. No build step.
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---- pure: playlist-id extraction --------------------------------------
  // URL forms: any youtube/music.youtube/youtu.be URL carrying ?list= (watch,
  // playlist, embed) - or a BARE id pasted alone (PL/UU/FL/OL/RD prefixes,
  // 10+ tail chars). Returns the id or null.
  function playlistId(input) {
    var s = String(input || '').trim();
    if (!s) return null;
    var m = /[?&]list=([A-Za-z0-9_-]{10,})/.exec(s);
    if (m) return m[1];
    if (/^(PL|UU|FL|OL|RD)[A-Za-z0-9_-]{10,}$/.test(s)) return s;
    return null;
  }

  // ---- pure: the key ladder ----------------------------------------------
  // 2a BARE_ROOT: "in A", "In C", "in C#", "in Am", "key of E" - no scale
  //    word. The connective is case-tolerant (Title Case "In C" is common);
  //    the ROOT letter stays case-sensitive (titles capitalize real keys;
  //    prose "in a" stays lowercase). (?![a-zA-Z]) blocks "in Dallas".
  // 2b ACC_ROOT: an accidental-bearing root standing anywhere ("... - Eb
  //    120bpm", "F# Groove") - no English word is spelled Eb/F#/Db, so the
  //    accidental itself is the disambiguator. (?![a-zA-Z]) still blocks
  //    "Abba" (Ab followed by a letter).
  // 2c NAT_BPM: a bare natural root glued to a tempo figure ("A 120bpm") -
  //    the number is what makes a lone capital letter safe to read as a key.
  var BARE_ROOT = /\b(?:[Ii]n|[Kk]ey(?:\s+of)?)\s+([A-G])([#b])?(m)?(?![a-zA-Z])/;
  var ACC_ROOT = /(?:^|[\s\-(\[])([A-G])([#b])(m)?(?![a-zA-Z])/;
  var NAT_BPM = /\b([A-G])\s+\d{2,3}\s*bpm\b/i;
  function resolveKey(title, hints) {
    var genre = hints && hints.genre;
    function modeFor(minorFlag) {
      if (minorFlag) return 'minor';
      return genre === 'blues' ? 'blues' : 'major';
    }
    if (hints && hints.key) {
      return {
        key: hints.key,
        mode: hints.mode || (genre === 'blues' ? 'blues' : 'major')
      };
    }
    var s = String(title || '');
    var m = BARE_ROOT.exec(s);
    if (m) return { key: m[1] + (m[2] || ''), mode: modeFor(m[3]) };
    m = ACC_ROOT.exec(s);
    if (m) return { key: m[1] + m[2], mode: modeFor(m[3]) };
    m = NAT_BPM.exec(s);
    if (m) return { key: m[1].toUpperCase(), mode: modeFor(false) };
    return null;
  }

  // ---- pure: items -> importable entries ---------------------------------
  // items: [{ id, title, author }] (title/author null when noembed failed).
  // existingYt: array/Set-like of yt ids already in the library (catalog +
  // customs) - duplicates are skipped, never re-imported.
  // Cir: dependency-injected Circle (defaults to global.Circle; node tests
  // pass circle.js directly) for preferred-name key spelling.
  // YI: dependency-injected YtInfo (same pattern).
  // Returns { entries: [{title, artist, key, mode, genre, yt}], skipped:
  // [{id, title, reason: 'duplicate'|'no-title'|'no-key'}] }.
  function entriesFromInfo(items, existingYt, Cir, YI) {
    if (Cir === undefined) Cir = global.Circle || null;
    if (YI === undefined) YI = global.YtInfo || null;
    var have = {};
    (existingYt && existingYt.forEach ? existingYt : []).forEach(function (id) { have[id] = 1; });
    if (existingYt && !existingYt.forEach) Object.keys(existingYt).forEach(function (id) { have[id] = 1; });
    var entries = [], skipped = [];
    (items || []).forEach(function (it) {
      if (!it || !it.id) return;
      if (have[it.id]) { skipped.push({ id: it.id, title: it.title || '', reason: 'duplicate' }); return; }
      have[it.id] = 1; // an id listed twice in one playlist imports once
      if (!it.title) { skipped.push({ id: it.id, title: '', reason: 'no-title' }); return; }
      var hints = YI ? YI.parseHints(it.title, it.author) : { key: null, mode: null, genre: null };
      var km = resolveKey(it.title, hints);
      if (!km) { skipped.push({ id: it.id, title: it.title, reason: 'no-key' }); return; }
      var key = (Cir && Cir.preferredTonicName) ? Cir.preferredTonicName(km.key, km.mode) : km.key;
      entries.push({
        // Raw title verbatim (splitArtistTitle's "Artist - Title" heuristic
        // mangles hyphenated track names like "... Track - Eb 120bpm");
        // artist = the channel, matching the baked catalog's convention.
        title: it.title,
        artist: it.author || '',
        key: key, mode: km.mode,
        genre: hints.genre || '',
        yt: it.id
      });
    });
    return { entries: entries, skipped: skipped };
  }

  // ---- browser driver: enumerate ids via the embed -----------------------
  // Cues the playlist in a hidden muted iframe and reads info.playlist from
  // the widget's infoDelivery stream (the same protocol tracks.js already
  // speaks for transport state). One-shot: resolves on the first message
  // carrying a non-empty playlist array, then tears everything down.
  // Synthesized-message friendly: filters on the parsed DATA shape (+ our
  // handshake id when present), never on e.source - the committed scenario
  // proves the chain by dispatching the same message shape (the proven
  // batches-6/7 pattern; real YT messages carry the id we register with).
  var HANDSHAKE_ID = 'plimport';
  function enumerate(listId, done) {
    var frame = document.createElement('iframe');
    frame.className = 'pli-frame';
    frame.setAttribute('title', 'playlist import');
    frame.setAttribute('aria-hidden', 'true');
    frame.src = 'https://www.youtube.com/embed/videoseries?list='
      + encodeURIComponent(listId) + '&enablejsapi=1&mute=1';
    var finished = false, pokeTimer = null, deadline = null;
    function cleanup() {
      global.removeEventListener('message', onMsg);
      if (pokeTimer) clearInterval(pokeTimer);
      if (deadline) clearTimeout(deadline);
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    }
    function finish(err, ids) {
      if (finished) return;
      finished = true; cleanup(); done(err, ids || []);
    }
    function onMsg(e) {
      if (!e || typeof e.data !== 'string') return;
      var d; try { d = JSON.parse(e.data); } catch (x) { return; }
      if (!d || (d.id !== undefined && d.id !== HANDSHAKE_ID)) return;
      var pl = d.info && d.info.playlist;
      if (Array.isArray(pl) && pl.length) {
        finish(null, pl.filter(function (v) { return /^[A-Za-z0-9_-]{11}$/.test(String(v)); }));
      }
    }
    global.addEventListener('message', onMsg);
    function poke() {
      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: HANDSHAKE_ID }), '*');
        }
      } catch (x) {}
    }
    frame.onload = poke;
    pokeTimer = setInterval(poke, 700);
    deadline = setTimeout(function () {
      finish('Could not read that playlist. Check the link - and note private playlists cannot be imported, only public or unlisted ones.');
    }, 15000);
    document.body.appendChild(frame);
  }

  // ---- browser driver: titles via noembed (CORS-enabled oEmbed) ----------
  // Best-effort per id, 4 in flight; a failed lookup yields nulls and the
  // track lands in the skipped list with an honest reason (never a fake
  // title, never a stalled import).
  function fetchTitles(ids, done) {
    var out = new Array(ids.length), next = 0, active = 0;
    function pump() {
      while (active < 4 && next < ids.length) {
        (function (i) {
          var id = ids[i];
          next++; active++;
          var settled = false;
          function settle(title, author) {
            if (settled) return;
            settled = true; active--;
            out[i] = { id: id, title: title, author: author };
            if (next >= ids.length && active === 0) done(out);
            else pump();
          }
          var timer = setTimeout(function () { settle(null, null); }, 8000);
          global.fetch('https://noembed.com/embed?url='
            + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
            .then(function (r) { return r.json(); })
            .then(function (j) {
              clearTimeout(timer);
              settle((j && j.title) ? String(j.title) : null,
                (j && j.author_name) ? String(j.author_name) : null);
            })
            .catch(function () { clearTimeout(timer); settle(null, null); });
        })(next);
      }
    }
    if (!ids.length) { done([]); return; }
    pump();
  }

  // ---- orchestration ------------------------------------------------------
  // importPlaylist(input, { existingYt, onStatus, onDone, onError })
  //   existingYt: array of yt ids already in the library (dedupe set)
  //   onStatus(text): progress line updates
  //   onDone({ entries, skipped, total }): entries ready for the host to save
  //   onError(text): terminal failure (bad link / unreadable playlist)
  function importPlaylist(input, opts) {
    opts = opts || {};
    var status = opts.onStatus || function () {};
    var fail = opts.onError || function () {};
    var id = playlistId(input);
    if (!id) { fail('That does not look like a playlist link. Paste a YouTube playlist URL (it has list= in it).'); return; }
    status('Reading the playlist...');
    enumerate(id, function (err, ids) {
      if (err) { fail(err); return; }
      status('Found ' + ids.length + ' videos - reading titles...');
      fetchTitles(ids, function (items) {
        var r = entriesFromInfo(items, opts.existingYt || []);
        if (opts.onDone) opts.onDone({ entries: r.entries, skipped: r.skipped, total: ids.length });
      });
    });
  }

  var PlaylistImport = {
    playlistId: playlistId,
    resolveKey: resolveKey,
    entriesFromInfo: entriesFromInfo,
    enumerate: enumerate,
    fetchTitles: fetchTitles,
    importPlaylist: importPlaylist,
    HANDSHAKE_ID: HANDSHAKE_ID
  };
  global.PlaylistImport = PlaylistImport;
  if (typeof module !== 'undefined' && module.exports) module.exports = PlaylistImport;
})(typeof window !== 'undefined' ? window : this);
