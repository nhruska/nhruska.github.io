/* =====================================================================
 * song-model.js  -  song / track / setlist data model (instrument-agnostic)
 * ---------------------------------------------------------------------
 * The pure data-model layer over the catalog + the user's own items:
 * the "solo over it" key payload, Mine / has-sheet predicates, the
 * key-seed token, list affordances, catalog-shadow resolution, building a
 * sheet from a chord sequence, building a song from canvas sections,
 * merging catalog + customs into the browse list, and setlist remap /
 * prune. Pure + Node-testable. Builds on theory.js; reads the shared
 * Repertoire model at call time.
 *
 * No build step. Classic script. Exposes a single global: `SongbookModel`.
 * Loads AFTER theory.js and BEFORE songbook.js, which rebinds these names.
 * ===================================================================== */
(function (global) {
  'use strict';

  // theory primitives (theory.js, loaded first) - rebind the ones this layer uses
  var T = global.SongbookTheory || (typeof require === 'function' ? require('./theory.js') : null);
  var F2S = T.F2S;
  var tpose = T.tpose;
  var rootPc = T.rootPc;

  // Key/mode payload for the "Solo over it" Studio bridge - TRANSPOSE-AWARE on
  // both paths. An explicit record key moves with the current transpose (the
  // chords on screen are shifted, so the Studio must follow or the player
  // solos in the wrong key); an implicit one derives from the already-transposed
  // sequence the same way repertoire.js's Key facet does. Pure + Node-testable.
  function soloKeyFor(song, transposedSeq, st, Repertoire) {
    if (song && song.key && song.mode) {
      return { key: st ? tpose(song.key, st) : song.key, mode: song.mode };
    }
    var R = Repertoire || global.Repertoire;
    if (R && typeof R.deriveKey === 'function') return R.deriveKey({ seq: transposedSeq });
    return { key: null, mode: null };
  }

  // User-owned ("Mine") repertoire items: everything the user saved or added via
  // +Add / Save progression (custom flag; d:'Mine' is the same marker on records
  // persisted before the flag existed). Pure + Node-testable.
  function isMine(rec) { return !!(rec && (rec.custom || rec.d === 'Mine')); }
  // A chord-sheet item (has a chord sequence) vs a pure video-only track. Only
  // chord-sheet items can open the Practice screen or join a setlist/Stage - a
  // seq-less track would crash s.seq.map / render empty. Pure + Node-testable.
  function hasChordSheet(rec) { return !!(rec && Array.isArray(rec.seq) && rec.seq.length); }
  // The seed-chord TOKEN for a row with a known key but no chord sheet - the
  // key's tonic, canonical-sharp. `key`
  // normalizes through this module's own F2S map (same one-liner idiom rootPc()
  // uses below: "Eb" -> "D#"); 'm' is appended for every minor-family mode,
  // mirroring Repertoire.keyLabel's own minor test (min*/aeolian/dorian/phrygian/
  // locrian) WITHOUT its DISPLAY respell - tokens stay canonical-sharp per
  // music/CLAUDE.md note-spelling.md; only rendering (Repertoire.keyLabel, used
  // for the toast) respells. Pure + Node-testable.
  function keySeedToken(key, mode) {
    var root = F2S[key] || key;
    var m = String(mode || '').toLowerCase();
    var minor = m.indexOf('min') === 0 || /aeolian|dorian|phrygian|locrian/.test(m);
    return root + (minor ? 'm' : '');
  }
  // Library "+" affordance state for a repertoire row -
  // 'add' (chord sheet -> live +, joins the setlist as-is),
  // 'seed' (no sheet but Repertoire.deriveKey resolves a key -> live + that
  // SEEDS one chord instead of a ghost), or 'blocked' (neither -> ghost +
  // with a reason/toast). `hasSheet` is supplied by
  // the caller's own hasChordSheet(songById(sid)) check just above - a seq-less
  // CUSTOM track has an id too, so sid!=null alone can't decide (see
  // hasChordSheet's comment); this function only decides the fallback. Repertoire
  // is DI'd (soloKeyFor's own pattern above) so this stays Node-testable without
  // a browser global. Pure.
  function addAffordance(rec, hasSheet, Repertoire) {
    if (hasSheet) return 'add';
    var R = Repertoire || global.Repertoire;
    var k = (R && typeof R.deriveKey === 'function') ? R.deriveKey(rec || {}) : { key: null };
    return k.key ? 'seed' : 'blocked';
  }
  // Set of catalog ids shadowed by a fork: a custom item with forkOf="<catalogId>"
  // hides that catalog song (its edited copy takes its place). Pure + testable.
  function shadowedCatalogIds(customs) {
    var out = {};
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      // Only a well-formed catalog id (kN) shadows - honors the "catalog ids" contract
      // and ignores a malformed/foreign forkOf rather than hiding an arbitrary id.
      if (cs && cs.forkOf && /^k\d+$/.test(cs.forkOf)) out[cs.forkOf] = true;
    });
    return out;
  }
  // A composed custom's chord-only sheet (one "[C] [G] ..." progression line). Pure.
  // Label is "Verse", not "Progression": a saved
  // progression re-entered via Continue building must read as a STANDARD song
  // section - "Progression" isn't in the section set, so it rendered a blank
  // section dropdown and an off-vocabulary card label. A plain progression IS
  // the seed of a verse (the add-row's own default), so name it that from the
  // start. Legacy "Progression"-labeled sheets are mapped at parse time
  // (sectionsFromSheet) and self-heal on their next save.
  function buildSheetFromSeq(seq) {
    return [["Verse", (seq || []).map(function (c) { return "[" + c + "]"; }).join(" ")]];
  }
  // SONG BUILDER: assemble a section buffer (each {label, seq:[...]}) into
  // the { seq, sheet } shape a custom SONG stores. seq = first-appearance unique
  // chords across ALL sections (the song's chord set - what the Studio/solo reads);
  // sheet = one [label, "[C] [F] ..."] pair per section (the existing chord-only
  // renderer parses these bracket tags). Pure + Node-testable; mirrors
  // buildSheetFromSeq's single-line shape, one line per section.
  function buildSongFromSections(sections) {
    var seq = [], seen = {};
    var sheet = (Array.isArray(sections) ? sections : []).map(function (s) {
      var chords = (s && Array.isArray(s.seq)) ? s.seq : [];
      chords.forEach(function (c) { if (!seen[c]) { seen[c] = true; seq.push(c); } });
      return [String((s && s.label) || 'Section'), chords.map(function (c) { return "[" + c + "]"; }).join(" ")];
    });
    return { seq: seq, sheet: sheet };
  }
  // PURE core of rebuildAll: fold the catalog + customs into the merged ALLSONGS list.
  // Catalog songs get kN ids; a fork (forkOf=kN) SHADOWS its catalog original (omit it);
  // customs append with their sheet resolved (own sheet preferred -> a fork keeps the
  // catalog chords+lyrics verbatim; else a chord-only sheet from seq; else no sheet ->
  // a video-only track routes to the Studio, not a blank Practice screen). Extracted +
  // exported so the changed merge path has a real regression test (not DOM-coupled).
  function buildAllSongs(catalog, customs) {
    // A fork shadows its catalog original IN PLACE - the copy
    // takes the exact list position the original held, so the row the user is
    // looking at never teleports out from under their thumb. Non-fork customs
    // still append after the catalog block, unchanged.
    var byFork = {};
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      // Only a well-formed catalog id (kN) shadows - honors the "catalog ids"
      // contract and ignores a malformed/foreign forkOf.
      if (cs && cs.forkOf && /^k\d+$/.test(cs.forkOf)) byFork[cs.forkOf] = cs;
    });
    function resolveSheet(cs) {
      var withSheet = (cs.sheet && cs.sheet.length) ? {}
        : (cs.seq && cs.seq.length) ? { sheet: buildSheetFromSeq(cs.seq) } : {};
      return Object.assign({}, cs, withSheet);
    }
    var placed = {};
    var all = (Array.isArray(catalog) ? catalog : [])
      .map(function (s, i) { return Object.assign({}, s, { id: "k" + i }); })
      .map(function (s) {
        var f = byFork[s.id];
        if (!f) return s;
        placed[f.id] = true;
        return resolveSheet(f); // the fork sits exactly where its original sat
      });
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      if (cs && placed[cs.id]) return; // already holding its original's slot
      all.push(resolveSheet(cs));
    });
    return all;
  }
  // Match keys of the catalog songs a fork shadows - so their backing tracks get
  // suppressed too. A fork REPLACES its catalog song; without this, the generic backing
  // track that matched the original stays visible (and, once the fork is renamed, orphans
  // into a standalone row - the "fork + original track" duplicate). matchKeyFn is
  // Repertoire.matchKey (title+artist). Pure + Node-testable.
  function shadowedTrackKeys(catalog, customs, matchKeyFn) {
    var out = {};
    if (typeof matchKeyFn !== 'function') return out;
    var byId = {};
    (Array.isArray(catalog) ? catalog : []).forEach(function (s, i) { byId['k' + i] = s; });
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      if (cs && cs.forkOf && byId[cs.forkOf]) out[matchKeyFn(byId[cs.forkOf])] = true;
    });
    return out;
  }
  // Remap the setlist when a fork shadows/reverts its catalog original: replace EVERY
  // slot holding fromId with toId (fork create: kN->mN), or REMOVE every fromId slot
  // when toId is null (plain delete). Mutates in place (keeps the array ref the queue
  // holds) and returns whether anything changed. Pure + Node-testable.
  function remapSetlist(setlist, fromId, toId) {
    if (!Array.isArray(setlist)) return false;
    var changed = false;
    if (toId == null) {
      for (var i = setlist.length - 1; i >= 0; i--) {
        if (setlist[i] === fromId) { setlist.splice(i, 1); changed = true; }
      }
    } else {
      for (var j = 0; j < setlist.length; j++) {
        if (setlist[j] === fromId) { setlist[j] = toId; changed = true; }
      }
    }
    return changed;
  }
  // Load-heal: drop any setlist entry that no longer resolves to a real
  // song - e.g. a setlist persisted before the delete-heal existed, or
  // restored from an older backup taken pre-fix.
  // `resolves(id)` is the caller's lookup (mount()'s songById); kept
  // dependency-injected so this stays Node-testable without a real ALLSONGS.
  // Mutates `setlist` in place (same contract as remapSetlist above - keeps
  // the array reference the queue/STATE hold) and returns the number of
  // entries removed (0 = nothing to heal). This is a defensive READ-TIME
  // pass, not a StorageMigrate registration: a dangling ref is a data-
  // integrity gap that can in principle appear from ANY future bug or an
  // old restored backup, not a one-time shape change gated by a version
  // number - see decisions.md D-SET-INTEGRITY for the "why not a migration"
  // ruling. Pure + Node-testable.
  function pruneDanglingSetlist(setlist, resolves) {
    if (!Array.isArray(setlist) || typeof resolves !== 'function') return 0;
    var removed = 0;
    for (var i = setlist.length - 1; i >= 0; i--) {
      if (!resolves(setlist[i])) { setlist.splice(i, 1); removed++; }
    }
    return removed;
  }
  global.SongbookModel = {
    soloKeyFor: soloKeyFor,
    isMine: isMine,
    hasChordSheet: hasChordSheet,
    keySeedToken: keySeedToken,
    addAffordance: addAffordance,
    shadowedCatalogIds: shadowedCatalogIds,
    buildSheetFromSeq: buildSheetFromSeq,
    buildSongFromSections: buildSongFromSections,
    buildAllSongs: buildAllSongs,
    shadowedTrackKeys: shadowedTrackKeys,
    remapSetlist: remapSetlist,
    pruneDanglingSetlist: pruneDanglingSetlist
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SongbookModel;

})(typeof window !== 'undefined' ? window : this);
