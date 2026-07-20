/* =====================================================================
 * repertoire.js  -  merged-repertoire model (songs + tracks -> ONE list).
 *
 * A song and its curated backing track are the SAME item: chords/sheet come
 * from the song, genre/bpm/key/video from the track. This module is the pure,
 * Node-testable core: build() dedups + merges, and the filter/facet helpers
 * drive the unified Search + Genre + Key bar. Presentation stays in
 * list-item.js; routing (open chord sheet vs open studio) stays in songbook.js.
 *
 * A merged record keeps the SONG shape (t/a/y/d/seq/sheet/id) so existing
 * song code paths (openPractice by id) keep working, and adds the TRACK fields
 * (genre/bpm/capo/key/mode/yt/tags) so ListItem shows the union and the studio
 * can solo over it. All functions are pure and exported for tests.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Canonical-sharp identity map - a record's raw key/chord root may be spelled
  // with a flat (Bb, Eb, ...); every key-aware lookup (Circle.preferredTonicName,
  // the keyRank ordering below) needs the canonical-sharp form first. Reused in
  // both directions: normalizing a stored key INTO canonical-sharp (keyLabel),
  // and canonicalizing a DISPLAYED flat label back to sharp for chip ordering
  // (keyRank) - same 5-entry map, sharp keys/flat values either way.
  var F2S = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

  // Circle source: window.Circle in the browser (classic scripts). Under Node
  // the IIFE's `global` is this module's own exports object, so a test can
  // never inject Circle there - fall back to a guarded require so the real
  // preferredTonicName kernel is what the tests exercise.
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }

  // Match on a normalized title+artist. Lowercase, strip punctuation, drop a
  // leading article ("the "), collapse spaces - so "Three Little Birds" /
  // "three little birds" / "The Beatles" vs "Beatles" all coalesce.
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/^\s*(the|a|an)\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function recTitle(r) { return r.title != null ? r.title : (r.t || ''); }
  function recArtist(r) { return r.artist != null ? r.artist : (r.a || ''); }
  function matchKey(r) { return norm(recTitle(r)) + '' + norm(recArtist(r)); }

  // Derive a key/mode from the first chord when a record carries none - matches
  // the app's labelTonic convention (a song's first chord is its working tonic).
  function deriveKey(rec) {
    var key = rec.key || null, mode = rec.mode || null;
    if (key) return { key: key, mode: mode };
    var raw = rec.seq || rec.chords || null;
    var chords = Array.isArray(raw) ? raw : (raw ? [raw] : null);
    if (chords && chords.length) {
      var km = /^([A-G][#b]?)(m(?!aj)|min)?/.exec(String(chords[0]));
      if (km) return { key: km[1], mode: km[2] ? 'minor' : 'major' };
    }
    return { key: null, mode: null };
  }
  // Short key label for the Key filter facet + chip: "Am", "Bb", or null.
  // The root displays via Circle.preferredTonicName - key-aware, so A# major
  // reads "Bb" (never A#) while G# minor stays "G#" (per note-spelling.md).
  // Falls back to the canonical-sharp identity (F2S) when Circle is
  // unavailable. Both the facet SET (keys(), below) and each item's facet TAG
  // (filter(), below) call this SAME function, so a respelled label still
  // matches its own facet chip - don't inline a different spelling in either.
  function keyLabel(rec) {
    var k = deriveKey(rec);
    if (!k.key) return null;
    var sharpRoot = F2S[k.key] || k.key; // canonical-sharp identity: lookup key + fallback
    var minor = String(k.mode || '').toLowerCase().indexOf('min') === 0
      || /aeolian|dorian|phrygian|locrian/.test(String(k.mode || '').toLowerCase());
    var C = circleRef();
    var root = (C && C.preferredTonicName)
      ? C.preferredTonicName(sharpRoot, k.mode || (minor ? 'minor' : 'major'))
      : sharpRoot;
    return root + (minor ? 'm' : '');
  }

  // Merge a song record + its matched track record into one unified item.
  // Song fields win for chords/sheet/year; track fields fill genre/bpm/capo/
  // video and supply key/mode when the song has none. tags are unioned.
  function mergeRec(song, track) {
    var out = {};
    var k;
    for (k in song) if (Object.prototype.hasOwnProperty.call(song, k)) out[k] = song[k];
    // track fields the song doesn't own
    if (track.genre != null && out.genre == null) out.genre = track.genre;
    if (track.bpm != null && out.bpm == null) out.bpm = track.bpm;
    if (track.capo != null && out.capo == null) out.capo = track.capo;
    if (track.yt != null && out.yt == null) out.yt = track.yt;
    if ((track.key != null) && (out.key == null)) out.key = track.key;
    if ((track.mode != null) && (out.mode == null)) out.mode = track.mode;
    // union tags
    var tags = [];
    (Array.isArray(song.tags) ? song.tags : []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
    (Array.isArray(track.tags) ? track.tags : []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
    if (tags.length) out.tags = tags;
    out.sources = ['song', 'track'];
    out._track = track; // retained so the studio can solo over the curated track
    return out;
  }

  /* build(songs, tracks) -> unified repertoire list.
   * - songs always appear (merged with a track when title+artist match).
   * - when several tracks share a title+artist, the one whose key matches the
   *   song's (derived) key wins; else the first. key is the tiebreak, not the
   *   primary match, so a keyless song still merges.
   * - unmatched tracks become standalone items (id 'tk<i>', no chord sheet).
   */
  function build(songs, tracks) {
    songs = Array.isArray(songs) ? songs : [];
    tracks = Array.isArray(tracks) ? tracks : [];
    // index tracks by match key -> array (title+artist can repeat across keys)
    var byMatch = {};
    tracks.forEach(function (t) {
      var mk = matchKey(t);
      (byMatch[mk] || (byMatch[mk] = [])).push(t);
    });
    var consumed = [];
    var out = songs.map(function (s) {
      var mk = matchKey(s);
      var cands = byMatch[mk];
      if (cands && cands.length) {
        var sk = keyLabel(s);
        var idx = 0;
        if (sk) {
          for (var i = 0; i < cands.length; i++) {
            if (!cands[i]._used && keyLabel(cands[i]) === sk) { idx = i; break; }
          }
        }
        // skip already-used candidates
        while (idx < cands.length && cands[idx]._used) idx++;
        var pick = cands[idx < cands.length ? idx : 0];
        if (pick && !pick._used) {
          pick._used = true;
          var merged = mergeRec(s, pick);
          // Don't reorder the list. A CUSTOM song that consumes a track (a
          // user save matching a backing track) emits at the TRACK's own slot
          // - the track row is the identity the user has been looking at, so
          // it must not teleport to the custom's position. Catalog songs keep
          // merging at the song's slot (the song row was always the visible
          // identity there).
          if (s.custom) { pick._mergedRec = merged; return null; }
          return merged;
        }
      }
      var only = {};
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) only[k] = s[k];
      only.sources = ['song'];
      return only;
    }).filter(function (r) { return r !== null; });
    // tracks in their own original order: a custom-consumed track emits its
    // merged rec HERE (holding the track's slot); a catalog-consumed track is
    // skipped (its merge lives at the song's slot); the rest are standalone.
    var stIdx = 0;
    tracks.forEach(function (t) {
      if (t._mergedRec) { var m = t._mergedRec; delete t._mergedRec; delete t._used; out.push(m); return; }
      if (t._used) { delete t._used; return; }
      var only = {};
      for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) only[k] = t[k];
      if (only.id == null) only.id = 'tk' + (stIdx++);
      only.sources = ['track'];
      only._track = t;
      out.push(only);
    });
    return out;
  }

  // Where does a tap land? A chord sheet is primary (openPractice); a pure track
  // with a key opens the backing-track Studio; otherwise it's a YouTube search.
  function playability(rec) {
    var raw = rec.seq || rec.chords || null;
    var hasSheet = !!(rec.sheet || (Array.isArray(raw) ? raw.length : raw));
    var k = deriveKey(rec);
    return {
      sheet: hasSheet,
      studio: !hasSheet && !!(k.key && k.mode),
      video: !!(rec.yt || rec.video)
    };
  }

  // Facet lists for the filter bar. genres(): unique genres present.
  // keys(): unique key labels, musically ordered (circle-ish: C G D ... then minors).
  // Custom items carry hand-typed genres ('Jam', 'Rock') alongside the
  // catalog's lowercase set, so genre identity is CASE-INSENSITIVE (else 'Jam'
  // and 'jam' render as duplicate chips). The chip displays the canonical
  // Title-case form; filter() matches case-insensitively the same way.
  function genres(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (r) {
      if (!r.genre) return;
      var key = String(r.genre).toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push(key.charAt(0).toUpperCase() + key.slice(1));
    });
    out.sort();
    return out;
  }
  var KEY_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  function keyRank(label) {
    var minor = /m$/.test(label);
    var root = minor ? label.slice(0, -1) : label;
    // keyLabel() may display either enharmonic spelling; canonicalize a flat
    // root back to its sharp identity (F2S) so the circle-of-fifths chip order
    // is unaffected by which name is shown ("Bb" ranks where "A#" would).
    root = F2S[root] || root;
    var i = KEY_ORDER.indexOf(root);
    return (minor ? 100 : 0) + (i < 0 ? 50 : i);
  }
  function keys(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (r) { var kl = keyLabel(r); if (kl && !seen[kl]) { seen[kl] = 1; out.push(kl); } });
    out.sort(function (a, b) { return keyRank(a) - keyRank(b); });
    return out;
  }

  // Pure filter for the merged list. sel = { q, genre, key } - 'all'/'' = no filter.
  function filter(list, sel) {
    sel = sel || {};
    var q = String(sel.q == null ? '' : sel.q).trim().toLowerCase();
    var g = sel.genre && sel.genre !== 'all' ? sel.genre : null;
    var k = sel.key && sel.key !== 'all' ? sel.key : null;
    return (list || []).filter(function (r) {
      if (g && String(r.genre || '').toLowerCase() !== String(g).toLowerCase()) return false; // genre identity is case-insensitive
      if (k && keyLabel(r) !== k) return false;
      if (q) {
        var hay = (recTitle(r) + ' ' + recArtist(r)).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  var Repertoire = {
    norm: norm, matchKey: matchKey, deriveKey: deriveKey, keyLabel: keyLabel,
    mergeRec: mergeRec, build: build, playability: playability,
    genres: genres, keys: keys, filter: filter, KEY_ORDER: KEY_ORDER
  };
  global.Repertoire = Repertoire;
  if (typeof module !== 'undefined' && module.exports) module.exports = Repertoire;

})(typeof window !== 'undefined' ? window : this);
