/* =====================================================================
 * songbook.js  -  instrument-agnostic songbook engine
 * ---------------------------------------------------------------------
 * Lifted out of the original ukulele app so any instrument tool (guitar,
 * mandolin, ...) can reuse the exact same songbook with zero duplication.
 *
 * The engine knows NOTHING about an instrument. It renders chord NAMES
 * (C, G, Am, F#m7, ...) which are identical across instruments. When an
 * OPTIONAL "chord pack" is supplied it delegates instrument-specific work
 * (fingering diagrams, audio, the Tune tab) to that pack. With no pack the
 * songbook still fully works  -  it just shows chord names with no diagrams
 * and no sound.
 *
 * Public API (see music/shared/README.md for the full contract):
 *   Songbook.mount(opts) -> controller
 *
 * No build step. Classic script. Exposes a single global: `Songbook`.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- music theory (instrument-agnostic) ---------- */
  var ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var F2S = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

  function splitChord(ch) {
    var m = ch.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return null;
    var r = m[1];
    if (F2S[r]) r = F2S[r];
    return { root: r, qual: m[2] || "" };
  }
  // Pitch class (0-11) of ANY note spelling: a letter plus any run of accidentals,
  // including the enharmonics our 12-name ROOTS table can't hold — E#, B#, Cb, Fb,
  // double sharps/flats. Lookup tables miss these and fall back to C (a wrong tone
  // on exotic diatonic chords like the vii° of F# major, E#dim). Returns null on junk.
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToPc(name) {
    var m = /^([A-Ga-g])([#bx]*)$/.exec((name || '').trim());
    if (!m) return null;
    var pc = LETTER_PC[m[1].toUpperCase()];
    for (var i = 0; i < m[2].length; i++) {
      var c = m[2][i];
      pc += (c === '#') ? 1 : (c === 'x') ? 2 : -1; // x = double sharp
    }
    return ((pc % 12) + 12) % 12;
  }
  function tpose(ch, st) {
    var p = splitChord(ch);
    if (!p) return ch;
    var i = ROOTS.indexOf(p.root);
    if (i < 0) return ch;
    return ROOTS[((i + st) % 12 + 12) % 12] + p.qual;
  }
  function tposeLine(raw, st) {
    return raw.replace(/\[([^\]]+)\]/g, function (_, c) { return "[" + tpose(c, st) + "]"; });
  }
  // root frequency of a chord, relative to middle C (used for the chord-chip tap tone).
  // Parse the root pitch class generically so exotic spellings (E#, B#, Cb, Fb) sound
  // the right note instead of falling back to C.
  function chordRootFreq(ch) {
    var m = /^([A-G][#bx]*)/.exec((ch || '').trim());
    var pc = m ? noteToPc(m[1]) : null;
    if (pc == null) return 261.63;
    return 261.63 * Math.pow(2, pc / 12);
  }

  /* ---------- keys / modes (the jam set) ----------
   * The scale INTERVALS (steps) are owned by circle.js (Circle.MODE_STEPS) so there's
   * one source of truth for them; we map our jam-mode names to circle's mode keys and
   * pull the steps from there. We keep, locally, the jam-specific presentation circle
   * doesn't model: the curated 4-mode SET, the display labels, and `quals` with the
   * diminished degree dropped from the strummable palette (kept in the solo scale).
   * If circle is somehow absent, the inline steps are an identical fallback. */
  var CIRCLE_MODE = { Major: "ionian", Minor: "aeolian", Mixolydian: "mixolydian", Dorian: "dorian" };
  var MODES = {
    Major:      { label: "Major",      steps: [0, 2, 4, 5, 7, 9, 11], quals: ["", "m", "m", "", "", "m", "dim"] },
    Minor:      { label: "Minor",      steps: [0, 2, 3, 5, 7, 8, 10], quals: ["m", "dim", "", "m", "m", "", ""] },
    Mixolydian: { label: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], quals: ["", "m", "dim", "", "m", "m", ""] },
    Dorian:     { label: "Dorian",     steps: [0, 2, 3, 5, 7, 9, 10], quals: ["m", "m", "", "", "m", "dim", ""] }
  };
  (function syncStepsFromCircle() {
    var C = global.Circle;
    if (!C || !C.MODE_STEPS) return; // keep the inline fallback
    Object.keys(CIRCLE_MODE).forEach(function (name) {
      var s = C.MODE_STEPS[CIRCLE_MODE[name]];
      if (s && s.length === 7) MODES[name].steps = s.slice();
    });
  })();
  var MODE_HINT = {
    Major: "bright, resolved", Minor: "dark, moody",
    Mixolydian: "bluesy jam (Dead/Phish)", Dorian: "minor jam, hopeful"
  };
  function rootPc(root) { var i = ROOTS.indexOf(F2S[root] || root); return i < 0 ? null : i; }
  // diatonic chords in scale-degree order, diminished degrees dropped (rarely strummed
  // in these styles, and the chord pack can't voice them) — leaves the usable jam palette.
  function diatonicChords(root, modeKey) {
    var rp = rootPc(root), m = MODES[modeKey]; if (rp == null || !m) return [];
    var out = [];
    m.steps.forEach(function (s, i) {
      if (m.quals[i] === "dim") return;
      out.push(ROOTS[(rp + s) % 12] + m.quals[i]);
    });
    return out;
  }
  // build a concrete chord list from 0-indexed scale degrees in a key (transposable).
  // Unlike diatonicChords this keeps EVERY degree (incl. the diminished vii°), so a
  // named progression maps degree->chord exactly: I-V-vi-IV in G -> G D Em C.
  function chordsFromDegrees(root, modeKey, degrees) {
    var rp = rootPc(root), m = MODES[modeKey]; if (rp == null || !m) return [];
    return degrees.map(function (deg) {
      var i = ((deg % 7) + 7) % 7;
      return ROOTS[(rp + m.steps[i]) % 12] + m.quals[i];
    });
  }
  // The canon — famous progressions, by 0-indexed major-scale degree. All diatonic
  // to MAJOR so they fill cleanly from any major key; modal/borrowed ones (Andalusian,
  // i-bVII-bVI) need a different derivation and are a deliberate follow-up.
  var PROGRESSIONS = [
    { name: "4-chord song",     degrees: [0, 4, 5, 3] }, // I  V  vi IV
    { name: "50s / doo-wop",    degrees: [0, 5, 3, 4] }, // I  vi IV V
    { name: "Pop / Axis",       degrees: [5, 3, 0, 4] }, // vi IV I  V
    { name: "Three-chord rock", degrees: [0, 3, 4] },    // I  IV V
    { name: "Jazz turnaround",  degrees: [1, 4, 0] },    // ii V  I
    { name: "Pachelbel",        degrees: [0, 4, 5, 2, 3, 0, 3, 4] } // I V vi iii IV I IV V
  ];
  // 0-indexed MAJOR-scale degree of a chord in a key (-1 if its root isn't a scale
  // tone). Used to recognize a progression-in-progress against the canon.
  var MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  function degreeOf(chord, tonic) {
    var cm = /^([A-G][#bx]*)/.exec((chord || '').trim());
    var cp = cm ? noteToPc(cm[1]) : null, tp = rootPc(tonic);
    if (cp == null || tp == null) return -1;
    var iv = ((cp - tp) % 12 + 12) % 12;
    return MAJOR_STEPS.indexOf(iv); // -1 if chromatic (borrowed) chord
  }
  // Recognize the progression-so-far as the START of one or more canon progressions,
  // and return what each one's NEXT chord would be — the "completing" suggestion.
  // Returns [{ name, chord, degree }], the canon entries this progression is a strict
  // diatonic prefix of (longest-context first). Empty if no canon matches.
  function completions(progression, tonic, keyMode) {
    if (!progression.length || !tonic) return [];
    var degs = progression.map(function (c) { return degreeOf(c, tonic); });
    if (degs.indexOf(-1) >= 0) return []; // a borrowed chord -> not a clean canon match
    var out = [];
    PROGRESSIONS.forEach(function (p) {
      if (p.degrees.length <= degs.length) return;        // nothing left to add
      var isPrefix = degs.every(function (d, i) { return d === p.degrees[i]; });
      if (!isPrefix) return;
      var nextDeg = p.degrees[degs.length];
      out.push({ name: p.name, degree: nextDeg, chord: chordsFromDegrees(tonic, keyMode || "Major", [nextDeg])[0] });
    });
    return out;
  }
  // AUTO-INFER a song key from the chords themselves (Compose sets it once 2+ chords
  // exist and the user never explicitly picked one). Pure: seq -> {root, mode} | null.
  // Every root x Major/Minor candidate is scored by how many of the progression's BASE
  // triads are diatonic to it (7th extensions stripped: Cmaj7/C7 count as C, Am7 as Am -
  // matching convertToMode's extension classes). Ties break toward the first chord's
  // root as tonic (the app's existing first-chord derivation), then Major, then the
  // first candidate in chromatic order (determinism). Needs at least 2 base triads to
  // fit or nothing is inferred - one matching chord is not a key.
  function baseTriad(ch) {
    var p = splitChord(ch);
    if (!p) return null;
    var q = p.qual;
    if (/maj7$/.test(q)) q = q.slice(0, -4);
    else if (/m7$/.test(q)) q = q.slice(0, -1);
    else if (/7$/.test(q)) q = q.slice(0, -1);
    return p.root + q;
  }
  function inferKey(seq) {
    if (!seq || seq.length < 2) return null;
    // Evidence is DISTINCT triads, not repetitions: ['C','C'] (or a I-I vamp)
    // is one chord, and one matching chord is not a key. A real I-V-I-V still
    // has two distinct triads and infers fine.
    var seen = {}, bases = [];
    seq.map(baseTriad).forEach(function (b) { if (b != null && !seen[b]) { seen[b] = true; bases.push(b); } });
    if (bases.length < 2) return null;
    var firstRoot = (splitChord(seq[0]) || {}).root || null;
    function tieRank(c) { return (c.root === firstRoot ? 2 : 0) + (c.mode === 'Major' ? 1 : 0); }
    var best = null;
    ROOTS.forEach(function (r) {
      ['Major', 'Minor'].forEach(function (mk) {
        var pal = {};
        chordsFromDegrees(r, mk, [0, 1, 2, 3, 4, 5, 6]).forEach(function (c) { pal[c] = true; });
        var score = 0;
        bases.forEach(function (b) { if (pal[b]) score++; });
        var cand = { root: r, mode: mk, score: score };
        if (!best || score > best.score || (score === best.score && tieRank(cand) > tieRank(best))) best = cand;
      });
    });
    return (best && best.score >= 2) ? { root: best.root, mode: best.mode } : null;
  }

  /* ---------- sheet rendering (chord-over-lyric, instrument-agnostic) ---------- */
  // Escape EVERYTHING interpolated into sheet/chip innerHTML: custom songs and
  // the localStorage import path accept freeform tokens, so chord names and
  // section labels are user-controlled strings, not trusted vocabulary. The
  // quote entity makes the same helper safe inside attribute values.
  function escHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function renderLyricLine(raw) {
    var chordRow = "", lyricRow = "", last = 0, m;
    var re = /\[([^\]]+)\]/g;
    while ((m = re.exec(raw))) {
      var before = raw.slice(last, m.index);
      lyricRow += before;
      chordRow += " ".repeat(before.length);
      chordRow += m[1];
      lyricRow += " ".repeat(m[1].length);
      last = re.lastIndex;
    }
    lyricRow += raw.slice(last);
    return '<div class="lyrLine"><span class="crd">' + escHTML(chordRow) + '</span>\n' + escHTML(lyricRow) + '</div>';
  }
  function renderChordOnly(sheet, st) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var re = /\[([^\]]+)\]/g, m, cs = [];
      while ((m = re.exec(line))) cs.push(tpose(m[1], st));
      if (cs.length) out.push('<div class="chordOnly">' + cs.map(function (c) { return '<span class="bar">' + escHTML(c) + '</span>'; }).join(' ') + '</div>');
    });
    return out.join('');
  }
  // Lyrics with the [chord] tokens stripped - the sing-along view. Lines that
  // were pure chord calls (all tokens, no words) vanish rather than leaving
  // blank rows.
  function renderLyricsOnly(sheet) {
    var out = [], last = null;
    sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { out.push('<div class="sect">' + escHTML(sect) + '</div>'); last = sect; }
      var lyr = line.replace(/\[([^\]]+)\]/g, '').replace(/[ ]{2,}/g, ' ');
      if (lyr.trim().length) out.push('<div class="lyrLine">' + escHTML(lyr) + '</div>');
    });
    return out.join('');
  }
  // view: 'chords' = chord bars only; 'lyrics' = lyrics only (no chord row);
  // 'both' (default) = chords positioned over lyrics.
  function renderSheet(song, st, view) {
    if (view === 'chords') return renderChordOnly(song.sheet, st);
    if (view === 'lyrics') return renderLyricsOnly(song.sheet);
    var html = '', last = null;
    song.sheet.forEach(function (pair) {
      var sect = pair[0], line = pair[1];
      if (sect && sect !== last) { html += '<div class="sect">' + escHTML(sect) + '</div>'; last = sect; }
      html += renderLyricLine(tposeLine(line, st));
    });
    return html;
  }
  // Stage/Perform auto-fit scale: shrinks the sheet until it fits BOTH the
  // available height AND width, or grows a short song up to a cap. Lyric lines
  // render with white-space:pre (no wrapping), so a height-only fit lets a
  // short song scale up past its own width and clip words off-screen - width
  // must always be allowed to win. Pure + Node-testable; DOM callers pass real
  // measurements (see applyPerfFont).
  function fitScale(availH, needH, availW, needW) {
    var heightScale = needH > 0 ? availH / needH : Infinity;
    var widthScale = needW > 0 ? availW / needW : Infinity;
    var scale = Math.min(heightScale, widthScale);
    if (!isFinite(scale)) scale = 1;
    return Math.max(0.5, Math.min(2.2, scale));
  }

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
  function buildSheetFromSeq(seq) {
    return [["Progression", (seq || []).map(function (c) { return "[" + c + "]"; }).join(" ")]];
  }
  // PURE core of rebuildAll: fold the catalog + customs into the merged ALLSONGS list.
  // Catalog songs get kN ids; a fork (forkOf=kN) SHADOWS its catalog original (omit it);
  // customs append with their sheet resolved (own sheet preferred -> a fork keeps the
  // catalog chords+lyrics verbatim; else a chord-only sheet from seq; else no sheet ->
  // a video-only track routes to the Studio, not a blank Practice screen). Extracted +
  // exported so the changed merge path has a real regression test (not DOM-coupled).
  function buildAllSongs(catalog, customs) {
    var shadowed = shadowedCatalogIds(customs);
    var all = (Array.isArray(catalog) ? catalog : [])
      .map(function (s, i) { return Object.assign({}, s, { id: "k" + i }); })
      .filter(function (s) { return !shadowed[s.id]; });
    (Array.isArray(customs) ? customs : []).forEach(function (cs) {
      var withSheet = (cs.sheet && cs.sheet.length) ? {}
        : (cs.seq && cs.seq.length) ? { sheet: buildSheetFromSeq(cs.seq) } : {};
      all.push(Object.assign({}, cs, withSheet));
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
  // Which record the Studio (video + solo HUD) should open for a Repertoire row.
  // A custom item (incl. a FORK) owns its OWN video + id, so it opens as ITSELF -
  // never as a merged backing SEED track (rec._track), which would drop the user's
  // curated video / fork id. BUT custom SONGS store the name as t/a while the Studio
  // (Tracks.openStudio) reads title/artist - so normalize to the Studio shape (t->title,
  // a->artist) or the fork opens with a blank title. Mirrors the explicit descriptors
  // the other openStudioCb call sites build. A non-custom merged song opens the seed
  // track (its curated key/video is the intent there). Pure + Node-testable.
  function studioTarget(rec) {
    if (!rec) return rec;
    if (rec.custom) {
      // Preserve ALL of the custom/fork's fields (yt AND video, key, mode, id...) and
      // only ADD the title/artist the Studio reads (custom songs store them as t/a).
      // Hand-picking fields dropped rec.video, which the playability gate accepts.
      return Object.assign({}, rec, {
        title: rec.t != null ? rec.t : rec.title,
        artist: rec.a != null ? rec.a : rec.artist
      });
    }
    return rec._track || rec;
  }
  // Library filter = Repertoire.filter + the ownership ("Mine") facet. Ownership
  // is a SEPARATE flag (sel.mine), never a genre value, so a user/catalog genre
  // literally named "mine" filters as a genre and does NOT hijack the ownership
  // facet (matches isMine's "a genre named mine is not ownership" contract). Rep
  // is dependency-injected (same pattern as soloKeyFor) so Node tests pass the
  // real module.
  function libraryFilter(Rep, list, sel) {
    sel = sel || {};
    var mine = !!sel.mine;
    var base = Rep.filter(list, { q: sel.q, genre: sel.genre, key: sel.key });
    return mine ? base.filter(isMine) : base;
  }
  // Zero-results empty state for the Library list. When a key facet is active it
  // NAMES the key - the key chips can sit scrolled out of view, so "why is my
  // list empty" must be readable from the message itself - and clearKey tells
  // the DOM layer to offer the one-tap Any-key clearing link. Pure + Node-testable.
  function libraryEmptyState(sel) {
    var key = sel && sel.key && sel.key !== 'all' ? sel.key : null;
    return {
      message: key ? 'Nothing in your repertoire matches in ' + key + '.' : 'Nothing in your repertoire matches.',
      clearKey: !!key
    };
  }

  // Transpose stepping WRAPS at the range ends instead of stopping (UAT item 9):
  // from +6 another + lands on -5 and keeps cycling, so repeated taps walk all
  // 12 keys forever. Values normalize into (-6, +6] (a value only matters mod 12
  // - tpose and the key readout are pitch-class based). Tries up to the 11 other
  // pitch classes in tap direction, skipping unplayable ones; null when nothing
  // else is playable (caller no-ops, matching the old stuck-at-end behavior).
  // Pure + Node-testable; `playable` is the caller's seqPlayable predicate.
  function nextTranspose(cur, dir, playable) {
    for (var n = 1; n <= 11; n++) {
      var cand = cur + dir * n;
      while (cand > 6) cand -= 12;
      while (cand <= -6) cand += 12;
      if (playable(cand)) return cand;
    }
    return null;
  }

  // YouTube search URL for a repertoire/song record - the query the ytSearch
  // action opens. Pure + Node-testable; shared by the list-item action ladder
  // and the song-view "Hear it on YouTube" link.
  function ytSearchURL(s) {
    var q = [s.t || s.title, s.a || s.artist, s.key ? s.key + ' key' : '']
      .filter(Boolean).join(' ');
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  /* =====================================================================
   * Songbook.mount(opts)
   *
   * opts = {
   *   songs:        Array  -- the catalog (songs.json shape). Required.
   *   chordPack:    Object|null -- optional instrument pack (see README). Default null.
   *   storagePrefix: String -- localStorage namespace. Default "songbook".
   *   decades:      Array  -- decade filter chips. Default ["All","70s",...,"10s"].
   *   composeCats:  Object -- chord categories for the compose grid.
   *                          Default a chromatic Major/Minor/7th/Maj7/Min7 map.
   *   suggestions:  Object -- chord-progression suggestion map (chord -> [next...]).
   *   el: {  -- DOM element references (any subset; missing ones disable that feature)
   *     // library
   *     songsList, genreChips, keyChips, search, searchClear, libCount, addBtn,
   *     // practice
   *     practiceEmpty, practiceBody,
   *     // setlist
   *     setBody, setBar, setCount, setClear, performBtn,
   *     // perform
   *     perform, pSheet, pPos, pTitle, pArtist, pKeyLine,
   *     pPrev, pNext, pClose, pUp, pDown, pDimBtn,
   *     pSpeed, pCtrls,
   *     pFontDown, pFontAuto, pFontUp, pViewLyrics, pViewChords, pViewBoth,
   *     // compose (optional; needs a chord pack for diagrams/audio)
   *     prog, suggest, catChips, buildGrid, cClear, cSave, cMax, cTup, cTdown, keyChipSlot,
   *     // maximize overlay (chord pack diagrams)
   *     maxOv, maxGrid, maxClose,
   *     // context line (optional)
   *     ctxLine
   *   },
   *   contexts:     Object -- map tab name -> context line text (optional)
   * }
   *
   * Returns a controller: { switchTab, openSong, getState, getSongs, rebuild }
   * ===================================================================== */
  function mount(opts) {
    opts = opts || {};
    var el = opts.el || {};
    var pack = opts.chordPack || null;
    var prefix = opts.storagePrefix || "songbook";
    var PROFILE_ID = opts.profileId || null; // instrument profile id, carried onto the inversions deep-link
    // P3: seed the backing-track finder with the built key+mode (no-op if not wired).
    var seedBackingKey = opts.seedBackingKey || function () {};
    // M3: the repertoire merges songs.json with the backing-track catalog. getTracks()
    // supplies the (seed + URL overlay + custom) track list; openStudioCb(track) opens
    // the Practice Studio (solo scale + chords + circle) for a track or a composed key.
    var getTracks = opts.getTracks || function () { return []; };
    var openStudioCb = opts.openStudio || null;
    // M2: the unified Add/Edit form (repertoire-form.js) - one mounted overlay reused
    // for create + edit of custom ("Mine") songs/tracks. Absent (no-op guarded below)
    // if the script didn't load, so the rest of the app still works.
    var repForm = (global.RepertoireForm && global.RepertoireForm.mount) ? global.RepertoireForm.mount() : null;
    // ONE shared running-order queue — Studio, Campfire and Stage all read it,
    // so prev/next means the same song everywhere (Phase B: "queue works everywhere").
    var QUEUE = global.Queue.createQueue();
    var CONTEXTS = opts.contexts || {};
    // The all-chords build palette covers ALL 12 chromatic roots (the old default only
    // had the 7 naturals - no sharps/flats). For each category we map every ROOTS entry
    // to its chord, then make each one renderable: if a chord pack is present and lacks
    // the sharp shape, fall back to the enharmonic flat spelling, and omit only if
    // neither spelling is voiceable (no crash). With no pack, names always render so all
    // 12 stay. ROOTS uses sharp spelling (C# D# F# G# A#); S2F is the flat fallback.
    var S2F = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
    var CATS = opts.composeCats || (function () {
      var packHas = function (name) { return opts.chordPack && typeof opts.chordPack.hasChord === 'function' ? opts.chordPack.hasChord(name) : false; };
      var havePack = !!opts.chordPack;
      // pick a spelling the pack can voice: prefer the sharp ROOTS spelling, fall back to
      // the enharmonic flat, return null if neither is voiceable (then the chord is omitted).
      function spell(root, suffix) {
        var sharp = root + suffix;
        if (!havePack) return sharp;          // no pack -> names always render
        if (packHas(sharp)) return sharp;
        var flat = S2F[root] ? (S2F[root] + suffix) : null;
        if (flat && packHas(flat)) return flat;
        return null;                          // neither spelling voiceable -> omit
      }
      function cat(suffix) {
        var out = [];
        ROOTS.forEach(function (root) { var s = spell(root, suffix); if (s) out.push(s); });
        return out;
      }
      return { "Major": cat(""), "Minor": cat("m"), "7th": cat("7"), "Maj7": cat("maj7"), "Min7": cat("m7") };
    })();
    var SUGG = opts.suggestions || {};

    var CATALOG = (opts.songs || []).slice();

    /* ---- chord-pack capability helpers (graceful no-op if absent) ---- */
    function packHasChord(name) { return pack && typeof pack.hasChord === 'function' ? pack.hasChord(name) : false; }
    function packPlayChord(name) { if (pack && typeof pack.playChord === 'function') pack.playChord(name); }
    function packPlayNote(name) {
      if (pack && typeof pack.playNote === 'function') { pack.playNote(name); return; }
      if (pack && typeof pack.playFreq === 'function') { pack.playFreq(chordRootFreq(name), 1.1); }
    }
    // A transposition is "playable" if there is no chord pack (names always render),
    // OR the chord pack knows every chord at that transposition.
    function seqPlayable(seq, st) {
      if (!pack) return true;
      return (seq || []).every(function (c) { return packHasChord(tpose(c, st)); });
    }

    /* ---------- custom (composed) progressions ---------- */
    var CUSTOM_KEY = prefix + ".custom.v1";
    function loadCustom() { try { var r = localStorage.getItem(CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveCustom() { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customSongs)); } catch (e) { } }
    var customSongs = loadCustom();
    // Fork-to-custom SHADOW + composed-custom append: the pure fold lives in the
    // module-scope buildAllSongs(catalog, customs) (exported + unit-tested). Deleting
    // a fork drops it from customs, so its catalog original reappears (revert).
    function rebuildAll() { ALLSONGS = buildAllSongs(CATALOG, customSongs); }
    var ALLSONGS = [];

    /* ---------- state + persistence ---------- */
    var STORE_KEY = prefix + ".setlist.v1";
    function loadSet() { try { var r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    function saveSet() { try { localStorage.setItem(STORE_KEY, JSON.stringify(STATE.setlist)); } catch (e) { } }
    // last-opened song, so the app can greet you already holding a song to play.
    var LAST_KEY = prefix + ".last.v1";
    function loadLast() { try { return localStorage.getItem(LAST_KEY) || null; } catch (e) { return null; } }
    function saveLast(id) { try { localStorage.setItem(LAST_KEY, id); } catch (e) { } }
    // perform-screen prefs (scroll speed + view), remembered per device. Font
    // size is NOT persisted - Stage force-opens auto every time (UAT r3).
    // v2: view is the tri-state 'lyrics'|'chords'|'both'. v1's 'lyrics' rendered
    // chords-over-lyrics, which is now called 'both' - migrate it as such.
    var PERF_KEY = prefix + ".perfprefs.v2";
    var PERF_KEY_V1 = prefix + ".perfprefs.v1";
    function loadPerfPrefs() {
      try {
        var r = localStorage.getItem(PERF_KEY);
        if (r) return JSON.parse(r);
        var v1 = localStorage.getItem(PERF_KEY_V1);
        if (v1) { var p = JSON.parse(v1); if (p.view === 'lyrics') p.view = 'both'; return p; }
        return {};
      } catch (e) { return {}; }
    }
    // stageDefaultView = the PERSISTED Stage view preference. STATE.performView is
    // the CURRENT view, which a per-launch seed (song-view Stage) may transiently
    // override without changing the saved default - only an in-Stage view tap
    // (setPerformView) updates the default. Persisting STATE.performView instead
    // would let staging one custom song (forced 'chords') leak into every later
    // setlist Perform. (Assigned just after STATE is built, below.)
    var stageDefaultView;
    // NOTE: font size is intentionally NOT persisted - Stage force-defaults to
    // auto on every open (UAT r3), so a cross-reload size would be dead. Manual
    // A-/A+ still holds in STATE within a Stage session (across prev/next).
    function savePerfPrefs() { try { localStorage.setItem(PERF_KEY, JSON.stringify({ speed: STATE.scrollSpeed, view: stageDefaultView })); } catch (e) { } }
    var _pp = loadPerfPrefs();
    var STATE = {
      search: "", genre: "all", mineOnly: false, key: "all", current: null, transpose: 0, view: "lyrics",
      setEditMode: false, lastRemoved: null, // set-edit mode gates reorder/remove; lastRemoved enables undo
      setlist: [], performDim: false, performTpose: 0,
      performView: (_pp.view === 'chords' || _pp.view === 'lyrics' || _pp.view === 'both') ? _pp.view : 'both',
      fontMode: 'auto', // Stage always opens auto-fit (size not persisted; see savePerfPrefs)
      fontScale: 1, ctrlsOpen: false,
      scrolling: false, scrollSpeed: (typeof _pp.speed === 'number' ? _pp.speed : 28), scrollRAF: null, wakeLock: null
    };
    STATE.setlist = loadSet();
    stageDefaultView = STATE.performView; // persisted Stage-view default (see savePerfPrefs above)
    function songById(id) { for (var i = 0; i < ALLSONGS.length; i++) if (ALLSONGS[i].id === id) return ALLSONGS[i]; return null; }

    /* ===================== LIBRARY (unified Repertoire; Set lives on the Jam tab) =====
     * The old Songs|Tracks split is dissolved: a song and its curated backing track
     * are ONE item in a single Repertoire (repertoire.js merges + dedups). The old
     * Repertoire|Set top toggle (#typeToggle) is retired too - the Set / Perform
     * surface is its own main tab now ("Jam", #s-jam), so the Library screen is
     * ALWAYS the repertoire: search + the Genre/Key facet chips over the merged
     * list. The finder tab is retired; its Practice Studio (solo scale + chords +
     * circle) stays reachable by tapping a playable item (openStudioCb), and
     * curation moves to +Add / per-item edit (M2). */

    /* ---- merged repertoire (songs.json + backing tracks, deduped) ---- */
    var REPERTOIRE = [];
    // getTracks() (from tracks.js) already applies the URL overlay + custom tracks.
    function buildRepertoire() {
      // Suppress the backing tracks of any catalog song a fork shadows, so a fork
      // REPLACES its original completely (no leftover generic track, and no orphaned
      // standalone track row once the fork is renamed).
      var suppress = shadowedTrackKeys(CATALOG, customSongs, global.Repertoire.matchKey);
      var tracks = getTracks();
      if (Object.keys(suppress).length) {
        // Suppress only the SEED/catalog backing track a fork shadows - NEVER a user's
        // own custom track that happens to share the title (that's their data, keep it).
        tracks = tracks.filter(function (t) { return t.custom || !suppress[global.Repertoire.matchKey(t)]; });
      }
      REPERTOIRE = global.Repertoire.build(ALLSONGS, tracks);
      return REPERTOIRE;
    }
    function chipBtn(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : '');
      b.textContent = label;
      b.onclick = fn;
      return b;
    }
    // Unified facet bar: Genre + Key chips derived from the current repertoire.
    // (Search is the text input; these replace the old decade chips.)
    function renderFilterChips() {
      buildRepertoire();
      // Heal a dead-end facet: deleting the last custom item while filtered to
      // Mine would drop the chip but leave the (now-invisible) filter active,
      // showing an empty Library with nothing selected.
      if (STATE.mineOnly && !REPERTOIRE.some(isMine)) STATE.mineOnly = false;
      if (el.genreChips) {
        el.genreChips.innerHTML = '';
        el.genreChips.appendChild(chipBtn('All genres', STATE.genre === 'all' && !STATE.mineOnly,
          function () { STATE.genre = 'all'; STATE.mineOnly = false; renderFilterChips(); renderSongs(); }));
        // Mine: the user's own saved/added items. An ownership facet pinned ahead
        // of the data-derived genres; shown only when a custom item exists (facet
        // chips reflect what is actually in the repertoire).
        if (REPERTOIRE.some(isMine)) {
          el.genreChips.appendChild(chipBtn('Mine', STATE.mineOnly,
            function () { STATE.mineOnly = true; STATE.genre = 'all'; renderFilterChips(); renderSongs(); }));
        }
        global.Repertoire.genres(REPERTOIRE).forEach(function (g) {
          el.genreChips.appendChild(chipBtn(g, STATE.genre === g && !STATE.mineOnly,
            function () { STATE.genre = g; STATE.mineOnly = false; renderFilterChips(); renderSongs(); }));
        });
      }
      if (el.keyChips) {
        el.keyChips.innerHTML = '';
        el.keyChips.appendChild(chipBtn('Any key', STATE.key === 'all',
          function () { STATE.key = 'all'; renderFilterChips(); renderSongs(); }));
        global.Repertoire.keys(REPERTOIRE).forEach(function (k) {
          el.keyChips.appendChild(chipBtn(k, STATE.key === k,
            function () { STATE.key = k; renderFilterChips(); renderSongs(); }));
        });
      }
    }
    // Action-ladder fallback for an item with no curated video: find one on YouTube.
    function ytSearch(s) {
      window.open(ytSearchURL(s), '_blank', 'noopener');
    }
    // Where a repertoire tap lands (approach A): a chord sheet opens the song screen
    // (openPractice); a pure backing track opens the Practice Studio (solo scale +
    // chords + circle); otherwise a YouTube search.
    function openRepertoireItem(rec) {
      var p = global.Repertoire.playability(rec);
      if (p.sheet && rec.id != null && songById(rec.id)) { openPractice(rec.id); return; }
      if (openStudioCb && (p.studio || rec._track)) { openStudioCb(studioTarget(rec)); return; }
      ytSearch(rec);
    }
    // The ▶/↗ action button: a curated video opens the Studio (video + solo HUD);
    // otherwise it's a YouTube search for a backing track.
    function repertoireAction(rec) {
      if ((rec.yt || rec.video) && openStudioCb) { openStudioCb(studioTarget(rec)); return; }
      ytSearch(rec);
    }
    function renderSongs() {
      if (!el.songsList) return;
      buildRepertoire();
      var filtered = libraryFilter(global.Repertoire, REPERTOIRE, { q: STATE.search, genre: STATE.genre, key: STATE.key, mine: STATE.mineOnly });
      if (filtered.length === 0) {
        var es = libraryEmptyState({ key: STATE.key });
        var box = document.createElement('div');
        box.className = 'empty';
        box.appendChild(document.createTextNode(es.message));
        if (es.clearKey) {
          var clr = document.createElement('button');
          clr.type = 'button';
          clr.className = 'emptyClear';
          clr.textContent = 'Search Any key';
          clr.onclick = function () { STATE.key = 'all'; renderFilterChips(); renderSongs(); };
          box.appendChild(clr);
        }
        el.songsList.innerHTML = '';
        el.songsList.appendChild(box);
        if (el.libCount) el.libCount.textContent = '';
        return;
      }
      el.songsList.innerHTML = '';
      filtered.forEach(function (rec) {
        var sid = rec.id;
        // only chord-sheet items can join a setlist; a pure/video-only track (no
        // seq) can't - it would later crash s.seq.map in Perform. songById alone
        // is insufficient: a seq-less custom track has an id too.
        var canAdd = sid != null && hasChordSheet(songById(sid));
        var inSet = canAdd && STATE.setlist.indexOf(sid) >= 0;
        // SSOT: one shared renderer for every Repertoire / Set item (shared/list-item.js).
        el.songsList.appendChild(global.ListItem.render(rec, {
          segment: 'library',
          inSet: inSet,
          onActivate: function () { openRepertoireItem(rec); },
          onAdd: canAdd ? function () { toggleSet(sid); } : null,
          onAction: function () { repertoireAction(rec); }
        }));
      });
      if (el.libCount) el.libCount.textContent = filtered.length + ' of ' + REPERTOIRE.length + ' in repertoire';
    }
    function syncSearchClear() { if (el.searchClear) el.searchClear.hidden = !el.search.value.length; }
    if (el.search) el.search.oninput = function () { STATE.search = el.search.value; syncSearchClear(); renderSongs(); };
    if (el.searchClear) el.searchClear.onclick = function () {
      el.search.value = ''; STATE.search = ''; syncSearchClear(); renderSongs(); el.search.focus();
    };

    /* ===================== SONG (views: Lyrics / Chords / Both + Stage) ===================== */
    // A song opens in one of three sheet views - Lyrics (sing-along), Chords
    // (campfire bars) or Both (chords over lyrics, the default) - picked via the
    // segmented control. Stage is a one-shot action - it launches the fullscreen
    // perform overlay over whichever view you're on, but is never persisted as the
    // default-open mode (otherwise every song-tap would trap you in fullscreen with
    // no way back to the chords).
    var SONGVIEW_KEY = prefix + ".songview.v1";
    var CHORDVIEW_KEY = prefix + ".chordsonly.v1"; // legacy 2-way toggle - migration source only
    function loadSongView() {
      try {
        var v = localStorage.getItem(SONGVIEW_KEY);
        if (v === 'lyrics' || v === 'chords' || v === 'both') return v;
        // legacy: chords-only '1' maps to Chords; the old Practice view was chords-over-lyrics = Both
        return localStorage.getItem(CHORDVIEW_KEY) === '1' ? 'chords' : 'both';
      } catch (e) { return 'both'; }
    }
    function saveSongView(v) { try { localStorage.setItem(SONGVIEW_KEY, v); } catch (e) { } }
    STATE.songView = loadSongView();

    // open a song in the song screen. queueIds (optional) sets the running order:
    // opening from the Setlist passes the whole set so prev/next walks it; opening
    // a lone song from the Library passes nothing → a one-song (inactive) queue.
    function openPractice(id, queueIds) {
      if (queueIds && queueIds.length > 1 && queueIds.indexOf(id) >= 0) QUEUE.set(queueIds, queueIds.indexOf(id));
      else QUEUE.set([id]);
      openCurrent();
    }
    // render whatever the queue cursor points at
    function openCurrent() {
      var id = QUEUE.current();
      STATE.current = id ? songById(id) : null;
      STATE.transpose = 0;
      if (!STATE.current) return;
      saveLast(STATE.current.id);
      switchTab('practice');
      renderPractice();
    }
    // After the setlist is edited (reorder/remove) keep the live queue tracking it,
    // so the queue is the running order rather than a snapshot taken at open time.
    // Only when an active queue is the setlist (the open song is still in the set).
    function syncQueueToSetlist() {
      if (!QUEUE.isActive() || !STATE.current) return;
      var at = STATE.setlist.indexOf(STATE.current.id);
      if (at < 0) return;
      QUEUE.set(STATE.setlist, at);
      renderPractice(); // refresh the queue-nav position (n / N) for the new order
    }
    function setMode(m) {
      // Stage performs the live queue from the current position (one-shot; not sticky).
      // Seed the overlay with the song view's transpose AND its Lyrics/Chords/Both
      // selection so Stage opens in the key AND view you were just practicing in,
      // not the original / a stale stage pref (UAT item 8 + the "over whichever
      // view you're on" contract above).
      // Seed the EFFECTIVE view: a chord-only custom is forced to chords, so seed
      // 'chords' rather than a raw Lyrics/Both songView that would (a) mislabel
      // this Stage and (b) persist the wrong performView for a later non-custom
      // Stage / setlist Perform. A FORK keeps the original's lyrics, so it is NOT
      // forced - it seeds the practiced Lyrics/Chords/Both view like a catalog song.
      if (m === 'stage') {
        if (!STATE.current) return;
        var seedView = (STATE.current.custom && !STATE.current.forkOf) ? 'chords' : STATE.songView;
        startPerform(QUEUE.isActive() ? QUEUE.ids() : [STATE.current.id], QUEUE.isActive() ? QUEUE.index() : 0, STATE.transpose, seedView);
        return;
      }
    }

    function renderPractice() {
      if (!el.practiceBody) return;
      if (!STATE.current) {
        if (el.practiceEmpty) el.practiceEmpty.style.display = 'block';
        el.practiceBody.style.display = 'none';
        return;
      }
      var s = STATE.current;
      // A chord-less item (a pure custom track, or a song whose chords were cleared
      // via the Add/Edit form) is not a song-screen item - show the empty state
      // rather than throwing on s.seq.map.
      if (!s.seq || !s.seq.length) {
        if (el.practiceEmpty) el.practiceEmpty.style.display = 'block';
        el.practiceBody.style.display = 'none';
        return;
      }
      if (el.practiceEmpty) el.practiceEmpty.style.display = 'none';
      el.practiceBody.style.display = 'block';
      var seq = s.seq.map(function (c) { return tpose(c, STATE.transpose); });
      var inSet = STATE.setlist.indexOf(s.id) >= 0;
      // Composed customs are chord calls with no lyric text - Lyrics/Both would
      // render empty, so the view is pinned to Chords. A FORK of a catalog song
      // DOES carry lyrics (preserved sheet), so it respects the view choice like
      // a catalog song.
      var forcedChords = s.custom && !s.forkOf;
      var view = forcedChords ? 'chords' : STATE.songView;
      var maxBtn = pack ? '<button class="iconBtn" id="maxOpenBtn" title="Maximize chords">⤢</button>' : '';
      // header: icon-only back arrow (top-left, beside the title) + a compact
      // setlist checkmark toggle (top-right, alongside the maximize icon when
      // present) — both above the fold, no separate row.
      var head = '<div class="detailHead">'
        + '<button class="iconBtn" id="backLib" title="Back to Library">←</button>'
        + '<div class="ti"><h2>' + escHTML(s.t) + '</h2><p>' + escHTML(s.a) + ' · ' + escHTML(s.y) + '</p></div>'
        + '<div class="headActions">'
        + '<button class="iconBtn setBtn' + (inSet ? ' on' : '') + '" id="setToggle" title="' + (inSet ? 'Remove from setlist' : 'Add to setlist') + '">' + (inSet ? '✓' : '+') + '</button>'
        + maxBtn
        + '</div></div>';
      // view row: Lyrics / Chords / Both segmented + compact transpose chip +
      // a compact Stage (fullscreen) icon button, all on ONE row (UAT round 2
      // locked decision - replaces the full-width Stage CTA).
      function segBtn(v, lbl) {
        var dis = forcedChords && v !== 'chords';
        return '<button data-v="' + v + '" class="' + (view === v ? 'on' : '') + '"'
          + (dis ? ' disabled' : '') + ' aria-pressed="' + (view === v ? 'true' : 'false') + '">' + lbl + '</button>';
      }
      var switcher = '<div class="practiceRow">'
        + '<div class="modeSwitch">' + segBtn('lyrics', 'Lyrics') + segBtn('chords', 'Chords') + segBtn('both', 'Both') + '</div>'
        + '<div class="transposeChip"><button id="tDown" title="Transpose down">−</button><span class="v" id="keyV">' + escHTML(seq[0]) + '</span><button id="tUp" title="Transpose up">+</button></div>'
        + '<button class="iconBtn stageGo" id="stageBtn" title="Stage: perform fullscreen" aria-label="Stage: perform fullscreen"><span aria-hidden="true">⛶</span></button>'
        + '</div>';
      // queue nav — only when a real running order (the setlist) is loaded
      var queueNav = QUEUE.isActive() ? '<div class="queueNav">'
        + '<button id="qPrev" ' + (QUEUE.atStart() ? 'disabled' : '') + '>‹ Prev</button>'
        + '<span class="qPos">' + (QUEUE.index() + 1) + ' / ' + QUEUE.size() + '</span>'
        + '<button id="qNext" ' + (QUEUE.atEnd() ? 'disabled' : '') + '>Next ›</button></div>' : '';
      var chips = '<div class="chordChips">' + seq.map(function (c) { return '<span class="c" data-c="' + escHTML(c) + '">' + escHTML(c) + '</span>'; }).join('') + '</div>';
      // "Solo over it" used to require s.custom (only progressions built in Compose
      // carried a key/mode). Any song can bridge to the Studio if we can determine a
      // key. Prefer the MERGED repertoire record: Repertoire.build copies a matched
      // backing track's authoritative key/mode onto it, which beats re-deriving from
      // the first chord (a non-tonic opener would mislabel). Fall back to the raw
      // record; soloKeyFor still derives from the TRANSPOSED seq when neither has
      // an explicit key, so soloing always matches what's on screen.
      var mergedRec = null;
      for (var ri = 0; ri < REPERTOIRE.length; ri++) { if (REPERTOIRE[ri].id === s.id) { mergedRec = REPERTOIRE[ri]; break; } }
      var soloKey = soloKeyFor((mergedRec && mergedRec.key && mergedRec.mode) ? mergedRec : s, seq, STATE.transpose);
      var canSolo = typeof openStudioCb === 'function' && !!(soloKey.key && soloKey.mode);
      var soloBtn = canSolo ? '<button class="btn" id="soloOverBtn">Solo over it</button>' : '';
      var actions = '<div class="actions">' + soloBtn + '</div>';
      // Hear the real recording: same YouTube search the list-item action ladder
      // uses (item 5, UAT round 2) - present in BOTH views (it's about the ear,
      // not the sheet). The MERGED record feeds the query so track-derived
      // fields (key etc.) match what the ladder builds from.
      var ytLink = '<a class="lyricsLink" href="' + ytSearchURL(mergedRec || s) + '" target="_blank" rel="noopener">Hear it on YouTube ↗</a>';
      var body;
      if (view === 'chords') {
        body = chips
          + '<div class="sheet campfireSheet" id="sheetBox">' + renderSheet(s, STATE.transpose, 'chords') + '</div>'
          + actions
          + ytLink;
      } else {
        var lyricsURL = "https://genius.com/search?q=" + encodeURIComponent(s.t + " " + s.a);
        body = chips
          + '<div class="sheet" id="sheetBox">' + renderSheet(s, STATE.transpose, view) + '</div>'
          + actions
          + ytLink
          + '<a class="lyricsLink" href="' + lyricsURL + '" target="_blank" rel="noopener">Full lyrics on Genius ↗</a>'
          + '<p class="note">Sheet shows a short representative snippet. Full lyrics open on a licensed site.</p>';
      }
      el.practiceBody.innerHTML = '<div class="detail">' + head + switcher + queueNav + body + '</div>';
      var qPrev = el.practiceBody.querySelector('#qPrev'); if (qPrev) qPrev.onclick = function () { QUEUE.prev(); openCurrent(); };
      var qNext = el.practiceBody.querySelector('#qNext'); if (qNext) qNext.onclick = function () { QUEUE.next(); openCurrent(); };
      el.practiceBody.querySelectorAll('.modeSwitch button').forEach(function (b) {
        b.onclick = function () { if (b.disabled) return; STATE.songView = b.dataset.v; saveSongView(STATE.songView); renderPractice(); };
      });
      var stageBtn = el.practiceBody.querySelector('#stageBtn'); if (stageBtn) stageBtn.onclick = function () { setMode('stage'); };
      el.practiceBody.querySelector('#tDown').onclick = function () { shiftKey(-1); };
      el.practiceBody.querySelector('#tUp').onclick = function () { shiftKey(1); };
      el.practiceBody.querySelectorAll('.chordChips .c').forEach(function (elc) { elc.onclick = function () { packPlayChord(elc.dataset.c); }; });
      el.practiceBody.querySelector('#setToggle').onclick = function () { toggleSet(s.id); renderPractice(); renderSongs(); renderSetlist(); };
      el.practiceBody.querySelector('#backLib').onclick = function () { switchTab('library'); };
      var maxOpen = el.practiceBody.querySelector('#maxOpenBtn');
      if (maxOpen) maxOpen.onclick = function () { openMaxWith(seq); };
      var soloOver = el.practiceBody.querySelector('#soloOverBtn');
      if (soloOver) soloOver.onclick = function () {
        var csv = customById(s.id);
        // Re-resolve the merged record at CLICK time: the tracks catalog loads
        // async, so the merged key/mode (and its curated video) may not have
        // existed when this view rendered - a fast Solo tap must not be stuck
        // with the render-time snapshot.
        var mr = null;
        for (var mi = 0; mi < REPERTOIRE.length; mi++) { if (REPERTOIRE[mi].id === s.id) { mr = REPERTOIRE[mi]; break; } }
        var sk = soloKeyFor((mr && mr.key && mr.mode) ? mr : s, seq, STATE.transpose);
        // Locked interface: no `custom:true` for a catalog song (it isn't a saved
        // custom item, so there's nothing for the Studio's "Edit this track" link
        // to look up). Custom songs keep the exact payload shape they always had.
        // Deliberately NO merged-record yt here: openStudio rehydrates url-less
        // payloads by trackKey and sets ytSource alongside yt - passing mr.yt
        // directly would skip that and lose the overlay Clear button.
        var payload = { id: s.id, title: s.t, artist: s.a, key: sk.key, mode: sk.mode, yt: (csv && csv.yt) || s.yt || null };
        if (s.custom) payload.custom = true;
        openStudioCb(payload);
      };
      var act = el.practiceBody.querySelector('.actions');
      if (act && s.custom) {
        var isFork = !!s.forkOf;
        var eb = document.createElement('button');
        eb.className = 'btn'; eb.textContent = 'Edit';
        eb.onclick = function () { openEditForm(s.id); };
        act.appendChild(eb);
        var db = document.createElement('button');
        db.className = 'btn ghost';
        // A fork shadows a catalog song, so removing it REVERTS to the original
        // rather than deleting a user creation - label + confirm say so.
        db.textContent = isFork ? 'Revert to original' : 'Delete progression'; db.style.flexBasis = '100%';
        db.onclick = function () {
          var msg = isFork ? 'Revert to the original song? Your edits and video will be removed.' : 'Delete this progression?';
          if (confirm(msg)) { deleteCustomItem(s.id); switchTab('library'); }
        };
        act.appendChild(db);
      } else if (act && !s.custom) {
        // Catalog song: fork it into an editable, user-owned copy that SHADOWS
        // the original (add a video, rename, re-key). Chords + lyrics preserved.
        var mb = document.createElement('button');
        mb.className = 'btn'; mb.textContent = 'Make it mine';
        // Fork from the MERGED record so a matched backing track's authoritative
        // video/key/mode carry onto the fork (mirrors soloKeyFor/ytSearchURL above);
        // the raw s (from ALLSONGS) lacks those merged fields. mergeRec never copies
        // _track into a saved custom, so forkOf/sheet/seq preservation is unaffected.
        mb.onclick = function () { openForkForm(mergedRec || s); };
        act.appendChild(mb);
      }
    }
    function shiftKey(dir) {
      var cand = nextTranspose(STATE.transpose, dir, function (st) { return seqPlayable(STATE.current.seq, st); });
      if (cand !== null) { STATE.transpose = cand; renderPractice(); }
    }

    /* ===================== MAXIMIZE (chord pack diagrams) ===================== */
    function openMaxWith(chords) {
      if (!el.maxOv || !el.maxGrid || !pack) return;
      el.maxGrid.innerHTML = '';
      chords.forEach(function (c) {
        var bd = pack.diagram ? pack.diagram(c, 'big') : (function () { var d = document.createElement('div'); d.className = 'bigC'; d.textContent = c; return d; })();
        bd.onclick = function () { packPlayChord(c); };
        el.maxGrid.appendChild(bd);
      });
      el.maxOv.classList.add('on');
    }
    if (el.maxClose) el.maxClose.onclick = function () { el.maxOv.classList.remove('on'); };

    /* ===================== SETLIST ===================== */
    function toggleSet(id) {
      var pos = STATE.setlist.indexOf(id);
      if (pos >= 0) STATE.setlist.splice(pos, 1); else STATE.setlist.push(id);
      saveSet(); renderSongs(); renderSetlist();
      if (STATE.current && STATE.current.id === id) renderPractice();
    }
    function renderSetlist() {
      if (!el.setBody) return;
      var body = el.setBody, bar = el.setBar, count = el.setCount;
      // The Edit toggle reveals reorder/remove (codex: keep the resting set row clean +
      // destructive controls off the scroll rail until the user opts into editing).
      if (el.setEdit) {
        el.setEdit.style.display = STATE.setlist.length ? '' : 'none';
        el.setEdit.textContent = STATE.setEditMode ? 'Done' : 'Edit';
        el.setEdit.classList.toggle('on', STATE.setEditMode);
      }
      // Clear (✕) hides on an empty setlist too - a destructive control with
      // nothing to destroy is dead weight in the header (pilot polish audit).
      if (el.setClear) el.setClear.style.display = STATE.setlist.length ? '' : 'none';
      if (STATE.setlist.length === 0) {
        body.innerHTML = '<div class="setEmpty">Your setlist is empty.<br>Add songs from the Library with the + button.</div>';
        if (bar) bar.style.display = 'none';
        if (count) count.textContent = 'No songs yet';
        STATE.setEditMode = false; STATE.lastRemoved = null;
        return;
      }
      if (count) count.textContent = STATE.setlist.length + ' song' + (STATE.setlist.length > 1 ? 's' : '')
        + (STATE.setEditMode ? ' · editing' : ' · ready to play');
      body.innerHTML = '';
      // Persistent undo for the last removal (codex: not a short toast). Stays until used or Done.
      if (STATE.lastRemoved) {
        var u = document.createElement('div'); u.className = 'setUndo';
        var rs = songById(STATE.lastRemoved.sid);
        u.innerHTML = '<span>Removed ' + escHTML(rs ? rs.t : 'song') + '</span><button class="btn ghost" type="button">Undo</button>';
        u.querySelector('button').onclick = function () {
          var lr = STATE.lastRemoved; if (!lr) return;
          var at = Math.min(lr.index, STATE.setlist.length);
          STATE.setlist.splice(at, 0, lr.sid); STATE.lastRemoved = null;
          saveSet(); syncQueueToSetlist(); renderSetlist(); renderSongs();
        };
        body.appendChild(u);
      }
      STATE.setlist.forEach(function (sid, i) {
        var s = songById(sid); if (!s) return;
        // SSOT: same renderer as Songs/Tracks, in 'set' mode. Reorder/remove only when setEdit.
        body.appendChild(global.ListItem.render(s, {
          segment: 'set',
          position: i + 1,
          first: i === 0,
          last: i === STATE.setlist.length - 1,
          setEdit: STATE.setEditMode,
          onActivate: function () { openPractice(sid, STATE.setlist); }, // open into the setlist queue
          onUp: function () { if (i > 0) { var a = STATE.setlist[i - 1]; STATE.setlist[i - 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); syncQueueToSetlist(); renderSetlist(); } },
          onDn: function () { if (i < STATE.setlist.length - 1) { var a = STATE.setlist[i + 1]; STATE.setlist[i + 1] = STATE.setlist[i]; STATE.setlist[i] = a; saveSet(); syncQueueToSetlist(); renderSetlist(); } },
          onRemove: function () {
            var wasOpen = STATE.current && STATE.current.id === sid;
            STATE.lastRemoved = { sid: sid, index: i }; // enable undo
            STATE.setlist.splice(i, 1); QUEUE.remove(sid); saveSet();
            // keep the live queue + the (maybe hidden) song screen in step with the edit
            if (wasOpen) { var nid = QUEUE.current(); STATE.current = nid ? songById(nid) : null; STATE.transpose = 0; renderPractice(); }
            else syncQueueToSetlist();
            renderSetlist(); renderSongs();
          },
          onAction: function () { ytSearch(s); }
        }));
      });
      if (bar) bar.style.display = 'flex';
    }
    if (el.setEdit) el.setEdit.onclick = function () {
      STATE.setEditMode = !STATE.setEditMode;
      if (!STATE.setEditMode) STATE.lastRemoved = null; // leaving edit mode dismisses the undo affordance
      renderSetlist();
    };
    if (el.setClear) el.setClear.onclick = function () {
      if (STATE.setlist.length === 0) return;
      if (confirm('Clear your setlist?')) { STATE.setlist = []; STATE.lastRemoved = null; STATE.setEditMode = false; saveSet(); renderSetlist(); renderSongs(); }
    };

    /* ===================== PERFORM ===================== */
    var performEl = el.perform, pSheet = el.pSheet;
    function reqWake() { try { if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').then(function (w) { STATE.wakeLock = w; }, function () { }); } } catch (e) { } }
    function relWake() { try { if (STATE.wakeLock) { STATE.wakeLock.release(); STATE.wakeLock = null; } } catch (e) { } }
    // Launch fullscreen perform mode for any list of song ids (the setlist, or a
    // single song straight from Practice / the "Play now" hero). seedTpose carries
    // the song view's transpose into the opening song (absent = original key);
    // prev/next still reset to 0 per song, as before.
    function startPerform(ids, startIdx, seedTpose, seedView) {
      if (!ids || !ids.length) return;
      QUEUE.set(ids, startIdx || 0);
      // Seed the CURRENT view for this launch only - never persisted here (that
      // would leak a custom song's forced 'chords' into later performances). The
      // setlist Perform button seeds stageDefaultView so it always opens in the
      // saved preference regardless of a prior song-view Stage seed.
      if (seedView === 'lyrics' || seedView === 'chords' || seedView === 'both') {
        STATE.performView = seedView;
      }
      // Default to auto-fit font on every Stage open (UAT r3) - a manual A-/A+
      // size set in one song shouldn't carry into the next open. Reset the stale
      // scale too, so the first A-/A+ after opening steps from the neutral base
      // (auto re-measures immediately, so the 1 is only the manual-step anchor).
      STATE.fontMode = 'auto'; STATE.fontScale = 1;
      STATE.performDim = false; STATE.performTpose = seedTpose || 0;
      // show the overlay BEFORE rendering so auto-fit can measure a real height
      if (performEl) { performEl.classList.remove('dim'); performEl.classList.add('on'); }
      STATE.ctrlsOpen = false; if (el.pSpeed) el.pSpeed.classList.remove('on');
      if (el.pSpeedR) { el.pSpeedR.value = STATE.scrollSpeed; if (el.pSpeedV) el.pSpeedV.textContent = STATE.scrollSpeed; }
      showPerform();
      reqWake();
    }
    if (el.performBtn) el.performBtn.onclick = function () { startPerform(STATE.setlist, 0, 0, stageDefaultView); };
    if (el.pClose) el.pClose.onclick = function () { relWake(); if (performEl) performEl.classList.remove('on'); };
    if (el.pPrev) el.pPrev.onclick = function () { if (!QUEUE.atStart()) { QUEUE.prev(); STATE.performTpose = 0; showPerform(); } };
    if (el.pNext) el.pNext.onclick = function () {
      if (!QUEUE.atEnd()) { QUEUE.next(); STATE.performTpose = 0; showPerform(); }
      else { relWake(); if (performEl) performEl.classList.remove('on'); }
    };
    if (el.pDown) el.pDown.onclick = function () { perfShift(-1); };
    if (el.pUp) el.pUp.onclick = function () { perfShift(1); };
    if (el.pDimBtn) el.pDimBtn.onclick = function () { STATE.performDim = !STATE.performDim; if (performEl) performEl.classList.toggle('dim', STATE.performDim); };
    // stage controls panel (font size + lyrics/chords/both view; no scroll-speed slider in the current markup)
    if (el.pCtrls) el.pCtrls.onclick = function () { STATE.ctrlsOpen = !STATE.ctrlsOpen; if (el.pSpeed) el.pSpeed.classList.toggle('on', STATE.ctrlsOpen || STATE.scrolling); };
    if (el.pViewLyrics) el.pViewLyrics.onclick = function () { setPerformView('lyrics'); };
    if (el.pViewChords) el.pViewChords.onclick = function () { setPerformView('chords'); };
    if (el.pViewBoth) el.pViewBoth.onclick = function () { setPerformView('both'); };
    if (el.pFontDown) el.pFontDown.onclick = function () { stepFont(-0.1); };
    if (el.pFontUp) el.pFontUp.onclick = function () { stepFont(0.1); };
    if (el.pFontAuto) el.pFontAuto.onclick = function () { STATE.fontMode = 'auto'; applyPerfFont(); updateStageBtns(); savePerfPrefs(); };
    function setPerformView(v) { STATE.performView = v; stageDefaultView = v; showPerform(); savePerfPrefs(); }
    function stepFont(d) {
      // Leaving auto-fit: seed the manual scale from the CURRENT on-screen auto size
      // (the last --pscale applyPerfFont computed), not the neutral 1. Otherwise the
      // first A+ jumps DOWN to 1.1 from a ~1.5 auto-fit (looks like a decrease) and
      // the first A- drops a big step. Continuing from what's visible = no jump.
      if (STATE.fontMode === 'auto' && pSheet) {
        var curScale = parseFloat(pSheet.style.getPropertyValue('--pscale'));
        if (curScale > 0) STATE.fontScale = curScale;
      }
      STATE.fontMode = 'manual';
      STATE.fontScale = Math.max(0.8, Math.min(2.2, +(STATE.fontScale + d).toFixed(2)));
      applyPerfFont(); updateStageBtns(); savePerfPrefs();
    }
    // auto-fit: scale the sheet so a short song fills the screen and a long one
    // shrinks toward fitting; manual mode pins an explicit scale instead.
    function applyPerfFont() {
      if (!pSheet) return;
      if (STATE.fontMode === 'manual') { pSheet.style.setProperty('--pscale', STATE.fontScale); return; }
      var inner = pSheet.firstElementChild;
      if (!inner) { pSheet.style.setProperty('--pscale', 1); return; }
      pSheet.style.setProperty('--pscale', 1);            // measure at base size
      var availH = Math.max(80, pSheet.clientHeight - 112); // leave room for the nav bar
      var needH = inner.scrollHeight;
      var availW = pSheet.clientWidth;
      var needW = inner.scrollWidth; // white-space:pre lyric lines never wrap - width must win
      var scale = fitScale(availH, needH, availW, needW);
      pSheet.style.setProperty('--pscale', scale.toFixed(3));
    }
    function updateStageBtns() {
      if (el.pFontAuto) el.pFontAuto.classList.toggle('on', STATE.fontMode === 'auto');
      // Custom sheets force the chords renderer (showPerform); the segmented
      // control must SAY so - highlight Chords and disable the other views
      // instead of showing a Lyrics/Both highlight over a chords-only sheet.
      var cur = songById(QUEUE.current());
      var forced = !!(cur && cur.custom && !cur.forkOf); // a fork carries lyrics -> not forced
      var v = forced ? 'chords' : STATE.performView;
      if (el.pViewLyrics) { el.pViewLyrics.classList.toggle('on', v === 'lyrics'); el.pViewLyrics.disabled = forced; }
      if (el.pViewChords) el.pViewChords.classList.toggle('on', v === 'chords');
      if (el.pViewBoth) { el.pViewBoth.classList.toggle('on', v === 'both'); el.pViewBoth.disabled = forced; }
    }
    function perfShift(dir) {
      var s = songById(QUEUE.current());
      // A seq-less item (placeholder-rendered in showPerform for a stale setlist)
      // has nothing to transpose - no-op rather than crash in seqPlayable(s.seq).
      if (!hasChordSheet(s)) return;
      var cand = nextTranspose(STATE.performTpose, dir, function (st) { return seqPlayable(s.seq, st); });
      if (cand !== null) { STATE.performTpose = cand; showPerform(); }
    }
    function showPerform() {
      var s = songById(QUEUE.current());
      if (!s) return;
      if (el.pPos) el.pPos.textContent = (QUEUE.index() + 1) + ' / ' + QUEUE.size();
      if (el.pTitle) el.pTitle.textContent = s.t;
      if (el.pArtist) el.pArtist.textContent = s.a + ' · ' + s.y;
      // Defensive: canAdd blocks seq-less tracks from the setlist, but a setlist
      // persisted before that guard could still hold one - render a gentle
      // placeholder instead of crashing on s.seq.map.
      if (!hasChordSheet(s)) {
        if (el.pKeyLine) el.pKeyLine.textContent = '';
        if (pSheet) pSheet.innerHTML = '<div class="pInner"><div class="sect">No chord chart for this track</div></div>';
        updateStageBtns();
        if (el.pNext) el.pNext.textContent = QUEUE.atEnd() ? '✓' : '→';
        return;
      }
      var seq = s.seq.map(function (c) { return tpose(c, STATE.performTpose); });
      if (el.pKeyLine) el.pKeyLine.textContent = (STATE.performTpose !== 0 ? 'Key ' + seq[0] + '  ·  ' : '') + seq.join('  ');
      if (pSheet) {
        var view = (s.custom && !s.forkOf) ? 'chords' : STATE.performView;
        pSheet.innerHTML = '<div class="pInner">' + renderSheet(s, STATE.performTpose, view) + '</div>';
        pSheet.scrollTop = 0;
        applyPerfFont();
      }
      updateStageBtns();
      if (el.pNext) el.pNext.textContent = QUEUE.atEnd() ? '✓' : '→';
    }
    /* auto-scroll */
    if (el.pSpeedR) el.pSpeedR.oninput = function () { STATE.scrollSpeed = +el.pSpeedR.value; if (el.pSpeedV) el.pSpeedV.textContent = el.pSpeedR.value; savePerfPrefs(); };

    /* ===================== COMPOSE (needs chord pack for diagrams/audio) ===================== */
    var progression = [], cTpose = 0; // cTpose = net semitones shifted from where you started (interval-learning readout)
    // The saved custom-song id the current Compose buffer is linked to (null = an
    // unsaved/fresh progression). Set on save; re-save UPDATES that song in place
    // (no duplicate); "Solo over" opens its Studio directly (no re-prompt). Detached
    // on Clear or when a starter pattern replaces the buffer wholesale.
    var savedComposeId = null;
    function packDiagram(name, size) {
      if (pack && typeof pack.diagram === 'function') return pack.diagram(name, size);
      var wrap = document.createElement('div');
      wrap.className = (size === 'big') ? 'bigC' : 'chord';
      // name is a freeform custom-song token here (no real pack to resolve it),
      // so escape before innerHTML - same XSS class as the sheet renderer.
      wrap.innerHTML = '<span class="' + (size === 'big' ? 'nm' : 'chord-name') + '">' + escHTML(name) + '</span>';
      return wrap;
    }
    // What tonic do we measure intervals against? The chosen key when one is set
    // (so an Axis progression starting on vi still reads vi-IV-I-V, not I-…), else
    // the first chord as a sensible default for free-built progressions.
    // ONE source of truth for "the key": songKey. `root` is the key center (null
    // until the user explicitly picks, then it stays explicit through transposes);
    // until then we fall back to progression[0] so a free-built progression still
    // reads sensible intervals. `mode` is always set (Major default). See the
    // unified-key refactor (PLAN-key-subsystem-redesign.md): the picker and the
    // transposer used to be two independent key notions and drifted; now a transpose
    // moves songKey.root so the readout, palette and solo scale all follow.
    function labelTonic() { return songKey.root || progression[0]; }
    var lastProgSig = null;
    function renderProg() {
      if (!el.prog) return;
      // Gray out the choosers once the 8-chord cap (addChord) is reached. The .maxed class
      // sits on .composeWrap so it covers BOTH regions: the fixed top (starters + toggle)
      // AND the scrolling chord list (in-key cells + all-chords tiles).
      var maxed = progression.length >= 8;
      var wrap = document.querySelector('.composeWrap');
      if (wrap) wrap.classList.toggle('maxed', maxed);
      if (el.maxNote) el.maxNote.hidden = !maxed;
      var tonic = labelTonic();
      // Only repaint the strip when something VISIBLE changed - the chords, their
      // key-relative romans (via tonic), or the maxed cap. A mode toggle re-calls
      // renderProg but changes none of these (romans are root-relative), so a rebuild
      // would just flash the strip with identical content. Suggestions still refresh
      // below (completions are mode-aware).
      var sig = progression.join(',') + '|' + tonic + '|' + maxed;
      if (sig !== lastProgSig) {
        lastProgSig = sig;
        el.prog.innerHTML = '';
        progression.forEach(function (c, i) {
          var slot = document.createElement('div'); slot.className = 'slot';
          var d = packDiagram(c, 'small'); d.onclick = function () { packPlayChord(c); };
          slot.appendChild(d);
          // interval relative to the key — think I IV V, not shapes
          if (global.Circle && global.Circle.romanFor) {
            var rn = global.Circle.romanFor(c, tonic);
            if (rn) { var lbl = document.createElement('span'); lbl.className = 'rn'; lbl.textContent = rn; slot.appendChild(lbl); }
          }
          var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×';
          rm.onclick = function (e) {
            e.stopPropagation(); progression.splice(i, 1);
            var kc = reinferKey();
            renderProg(); renderSuggest(); renderKey();
            if (kc && el.keyRoots) { renderKeyView(); buildGrid(); }
          };
          slot.appendChild(rm);
          el.prog.appendChild(slot);
        });
      }
      renderSuggest();
    }
    function addChord(c) {
      if (progression.length >= 8) return;
      forceStarters = false;
      progression.push(c);
      // AUTO-INFER the key once 2+ chords exist and the user never explicitly picked
      // one, so the key chip + in-key palette light up without a key-panel trip. The
      // inferred key stays NON-explicit: it keeps tracking further adds until the user
      // pins a key themselves (root pick / mode pick / named pattern all set explicit).
      var prevRoot = songKey.root, prevMode = songKey.mode;
      // Re-infer through the SAME helper the remove/Clear paths use, so a later
      // chord that makes inference fail CLEARS a stale non-explicit key instead
      // of leaving the old chip/palette (the inline infer only ever set a key,
      // never cleared one - the asymmetry codex flagged).
      reinferKey();
      renderProg(); renderKey();
      // Key changed under an auto-infer: refresh the fly-out content + the chord list
      // (renderKey/buildKeyPicker already refreshed the chip + roots). Skipped when
      // nothing moved so a plain add never rebuilds the grid mid-tap.
      if ((songKey.root !== prevRoot || songKey.mode !== prevMode) && el.keyRoots) {
        renderKeyView(); buildGrid();
      }
    }
    // Symmetric UN-infer for the remove/Clear paths: an auto-inferred
    // (non-explicit) key must keep tracking the progression the same way
    // addChord's infer does - re-infer at 2+ chords, clear entirely below 2.
    // Otherwise a deleted progression leaves a stale key chip + palette.
    // Returns true when the key actually changed (caller refreshes the
    // fly-out + grid, mirroring addChord's conditional rebuild).
    function reinferKey() {
      if (songKey.explicit) return false;
      var prevRoot = songKey.root, prevMode = songKey.mode;
      if (progression.length >= 2) {
        var ik = inferKey(progression);
        if (ik) { songKey.root = ik.root; songKey.mode = ik.mode; }
        else { songKey.root = null; }
      } else {
        songKey.root = null;
      }
      return songKey.root !== prevRoot || songKey.mode !== prevMode;
    }
    // Fill the progression from a named pattern, in the user's key (default C Major).
    // These patterns are major-diatonic, so we anchor to a Major key: keep the picked
    // root if there is one, force the mode to Major, and sync the key picker so the
    // chord palette + solo scale below match what just got filled in.
    function loadProgression(degrees) {
      var root = songKey.root || "C";
      forceStarters = false; // a progression is loaded now - leave the starters view
      // a named pattern sets an explicit Major key (patterns are major-diatonic)
      songKey.root = root; songKey.mode = "Major"; songKey.explicit = true;
      keyPopoverOpen = false; // a key is set now - the root popover stays closed
      progression = chordsFromDegrees(root, songKey.mode, degrees);
      cTpose = 0;
      savedComposeId = null; // a starter is a NEW progression - detach from any saved song
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
    }
    function renderProgPicks() {
      // Common progressions now live inside renderSuggest's empty state (the "Next chord"
      // disclosure). The standalone "Common progressions" disclosure (#discPatterns / #progPicks)
      // was removed from the HTML, so el.progPicks is absent. Kept as a guarded no-op.
      if (!el.progPicks) return;
      el.progPicks.innerHTML = '';
    }
    // Short mode labels for the narrow ctrlBar readout (prevents Save button overflow).
    // Full labels are used everywhere else (key picker chip, key-view title).
    var MODE_SHORT = { Major: 'Maj', Minor: 'Min', Mixolydian: 'Mixo', Dorian: 'Dor' };
    // transpose the whole progression together — the shape moves, the intervals stay (that's the lesson)
    function renderKey() {
      // The song key/mode is now shown by the button-bar chip (#keyPickerCompact), which
      // both displays the current key (root + abbreviated mode - it tracks songKey, which
      // moves on every transpose, so it doubles as the transpose readout) and opens the
      // key/mode fly-out. buildKeyPicker() is the single source of truth for the chip's
      // text + 'shifted' state, so renderKey just refreshes it. (Light: buildKeyPicker is
      // idempotent and already runs on every key/mode/transpose action.)
      buildKeyPicker();
      // P3: the "Solo over a backing track" CTA appears once a key + progression
      // are established (the roadmap precondition for backing-track soloing).
      if (el.soloBackingBtn) el.soloBackingBtn.hidden = !(songKey.root && progression.length);
    }
    function composeTpose(st) {
      if (!progression.length) return;
      progression = progression.map(function (c) { return tpose(c, st); });
      cTpose += st;
      // Move the song key with the chords so the readout, diatonic palette and solo
      // scale never drift from what's actually sounding. If a key center exists
      // (explicit pick, or one derived earlier) shift its root by the same delta;
      // otherwise derive it fresh from the now-transposed first chord.
      if (songKey.root) {
        songKey.root = tpose(songKey.root, st);
      } else {
        var p0 = splitChord(progression[0]);
        if (p0) songKey.root = p0.root;
      }
      renderProg(); renderKey();
      if (el.keyRoots) { buildKeyPicker(); renderKeyView(); buildGrid(); }
    }
    // MODAL INTERCHANGE (Phase 2). Re-harmonize the whole built progression to a
    // PARALLEL mode: same tonic, same chord ROOTS, but each chord re-QUALIFIED to the
    // target mode's degree quality. C Major I-IV-V (C F G) -> C Minor i-iv-v (Cm Fm Gm).
    // Distinct from transpose (composeTpose): transpose moves roots and keeps qualities;
    // this keeps roots and flips qualities. Called by the one key/mode filter (#keyModes)
    // whenever the mode changes with a progression present - so the filter always keeps
    // the built chords in sync with the chosen mode (no separate re-harmonize button).
    // Best-effort by the user's decision: a chord whose root is NOT a scale degree of the
    // target mode (a chromatic/borrowed root) is left UNCHANGED rather than guessed at.
    // A preserved 7th-type extension is re-based onto the new triad quality where the
    // base triad maps to "" (major) or "m" (minor); on a "dim" degree we keep the bare
    // dim triad. Round-trip is not perfect for chromatic chords (acceptable).
    function convertToMode(targetMode) {
      if (!progression.length || !MODES[targetMode]) return;
      // Parallel = same tonic. Use the explicit/derived song key root; else the first
      // chord's root. rootPc handles flat spellings; if it can't resolve, bail safely.
      var tonicRoot = songKey.root || (splitChord(progression[0]) || {}).root || null;
      var tonicPc = tonicRoot != null ? rootPc(tonicRoot) : null;
      if (tonicPc == null) return;
      var steps = MODES[targetMode].steps, quals = MODES[targetMode].quals;
      progression = progression.map(function (c) {
        var p = splitChord(c);
        if (!p) return c;
        var rpc = rootPc(p.root);
        if (rpc == null) return c;
        var offset = ((rpc - tonicPc) % 12 + 12) % 12;
        var i = steps.indexOf(offset);
        if (i < 0) return c; // chromatic root with no degree at this offset -> leave it
        var baseQual = quals[i]; // "" major triad, "m" minor, "dim" diminished
        // Detect a trailing 7th-type extension on the ORIGINAL chord ("7","maj7","m7").
        // Re-base it onto the target triad quality: major degree -> maj7 keeps its own
        // maj7-ness only if it was maj7; a dominant 7 stays a dominant 7; a minor 7
        // becomes minor on a minor degree, etc. Simpler+correct rule: rebuild from the
        // base triad and re-attach the extension class that survives a quality flip.
        var ext = "";
        if (/maj7$/.test(p.qual)) ext = "maj7-like";
        else if (/m7$/.test(p.qual)) ext = "min7-like";
        else if (/7$/.test(p.qual)) ext = "dom7-like";
        var suffix;
        if (ext === "") {
          suffix = baseQual; // plain triad -> target triad quality
        } else if (baseQual === "dim") {
          suffix = "dim"; // keep the bare diminished triad on a dim degree
        } else if (baseQual === "m") {
          // minor degree: a 7th becomes a minor 7th (m7); a maj7 over a minor degree is
          // uncommon - normalize to m7 to keep the chord diatonic-feeling.
          suffix = "m7";
        } else { // baseQual === "" -> major degree
          // major degree: a maj7 stays maj7; a dominant/minor 7 becomes a dominant 7
          // (the usual major-degree 7th in these jam styles).
          suffix = (ext === "maj7-like") ? "maj7" : "7";
        }
        return p.root + suffix;
      });
      // Parallel interchange keeps the tonic fixed; only the mode changes. Roots do not
      // move, so cTpose (the transpose-from-origin readout) is intentionally untouched.
      songKey.root = tonicRoot;
      songKey.mode = targetMode;
      songKey.explicit = true;
      keyPopoverOpen = false;
      renderProg(); renderKey(); buildKeyPicker(); renderKeyView(); buildGrid(); renderSuggest();
    }
    // ADAPTIVE chord surface (Phase 1, consolidated). ONE chord list with an "In key | All"
    // segmented toggle at the top that swaps the list's CONTENT (not two stacked sections):
    //   - "In key": the diatonic chords for the current song key (root + mode), labeled
    //     with Roman numerals. Default when a key is set.
    //   - "All": the full chromatic grid plus the chord-TYPE tabs (Major/Minor/7th/Maj7/
    //     Min7) as a sub-filter. Default when no key is set (and the In-key segment then
    //     prompts to pick a key).
    // The in-key palette lives ONLY here now (renderKeyView is title + the
    // Triads & Inversions link only - the solo scale + HSR chain moved to the
    // Studio), so the diatonic chords are never duplicated.
    // 'chordView' is the segmented-toggle state ('inkey' | 'all'); null = "follow the key"
    // (auto: in-key when a key is set, all otherwise). An explicit user tap pins it.
    var chordView = null;
    // 'allChordsActiveCat' persists which chromatic category tab (Major/Minor/7th/...)
    // is selected across re-renders, so switching tab doesn't reset to the first category.
    var allChordsActiveCat = Object.keys(CATS)[0] || "Major";
    // Resolve the effective view: an explicit pin wins; otherwise follow the key.
    function effectiveChordView() {
      if (chordView === 'inkey' || chordView === 'all') return chordView;
      return songKey.root ? 'inkey' : 'all';
    }
    function buildGrid() {
      if (!el.catChips || !el.buildGrid) return;
      var chips = el.catChips, grid = el.buildGrid;
      // FLATTENED layout split:
      //   #catChips  = the FIXED In-key|All toggle (stays in .composeTop, never scrolls).
      //   the scroll area (#composeChords) holds the LIST content: in-key lead, the
      //   All-chords type-tab row, and #buildGrid tiles - so only the list scrolls.
      // Redundant headers ("Chords in <key>", "All chords") are dropped: the key/mode chip
      // already shows the key, and the toggle already says which list you're in.
      chips.className = 'chips';
      chips.innerHTML = ''; grid.innerHTML = '';
      // Remove any list-content nodes a prior render appended to the scroll area,
      // keeping #buildGrid (the tiles container) and #suggest (the suggestion surface -
      // renderSuggest owns its content; it leads the scroll area per the UAT fold-in)
      // in place.
      var scroller = el.composeChords;
      if (scroller) {
        Array.prototype.slice.call(scroller.children).forEach(function (n) {
          if (n !== grid && n !== el.suggest) scroller.removeChild(n);
        });
      }
      var view = effectiveChordView();
      // tap handler shared by every chord tile: add to the progression + play, with a
      // brief selected flash for feedback.
      function wireTap(d, c) {
        d.onclick = function () { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); };
        return d;
      }
      // Segmented control: In key | All. One tap pins the view (chordView), then re-render.
      // Stays in the FIXED #catChips.
      var seg = document.createElement('div'); seg.className = 'chordSeg';
      [['inkey', 'In key'], ['all', 'All']].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chordSegBtn' + (view === pair[0] ? ' on' : '');
        b.textContent = pair[1];
        b.setAttribute('aria-pressed', view === pair[0] ? 'true' : 'false');
        b.onclick = function () { chordView = pair[0]; buildGrid(); };
        seg.appendChild(b);
      });
      chips.appendChild(seg);

      if (view === 'inkey') {
        if (!songKey.root) {
          // In-key view with no key set: a PROMINENT pick-a-key CTA (replaces the old
          // hint prose) - one tap opens the key panel right above. A short secondary
          // line keeps the All escape hatch discoverable.
          var cta = document.createElement('button');
          cta.type = 'button';
          cta.className = 'btn red pickKeyCta';
          cta.textContent = 'Pick a key';
          cta.onclick = function () { keyPopoverOpen = true; buildKeyPicker(); };
          var hint = document.createElement('p');
          hint.className = 'keyHint chordsHint';
          hint.textContent = 'Its chords will lead this list - or switch to All to browse every chord.';
          if (scroller) { scroller.insertBefore(cta, grid); scroller.insertBefore(hint, grid); }
          return;
        }
        var keyRoot = songKey.root, keyMode = songKey.mode;
        var leadWrap = document.createElement('div'); leadWrap.className = 'inKeyLead';
        if (global.KeyExplorer) {
          var keItems = diatonicChords(keyRoot, keyMode).map(function (c) {
            return { chord: c, roman: (global.Circle && global.Circle.romanFor) ? global.Circle.romanFor(c, keyRoot) : '' };
          });
          // No 'label' opt: the key/mode chip already names the key, so no list header.
          global.KeyExplorer.renderChords(leadWrap, keItems, {
            diagram: packDiagram,
            onTap: function (c, d) { addChord(c); packPlayChord(c); d.classList.add('sel'); setTimeout(function () { d.classList.remove('sel'); }, 220); }
          });
        }
        if (scroller) scroller.insertBefore(leadWrap, grid);
        return;
      }

      // "All" view: the scrollable chord-TYPE tab row (the sub-filter), then the matching
      // chromatic chord tiles in #buildGrid. No "All chords" header (redundant w/ toggle).
      var tabRow = document.createElement('div'); tabRow.className = 'catTabRow';
      Object.keys(CATS).forEach(function (cat) {
        var b = document.createElement('button');
        b.className = 'chip' + (cat === allChordsActiveCat ? ' on' : '');
        b.textContent = cat;
        b.onclick = function () { allChordsActiveCat = cat; buildGrid(); };
        tabRow.appendChild(b);
      });
      if (scroller) scroller.insertBefore(tabRow, grid);
      (CATS[allChordsActiveCat] || []).forEach(function (c) {
        grid.appendChild(wireTap(packDiagram(c, 'small'), c));
      });
    }

    /* ---- Key: pick a key -> its diatonic chord palette (the solo scale/HSR
     * moved to the Studio; the fly-out links out via Triads & Inversions) ----
     * Persistent compact key bar (replaces the old collapse): the current-key chip and
     * the maj/min mode toggle are ALWAYS visible - one tap changes major<->minor, never
     * hidden. The 12-root grid is an on-demand popover, opened by tapping the key chip
     * and closed on selection; tapping the already-selected mode re-confirms and
     * closes it (a no-op re-harmonize guard, not a toggle). */
    var songKey = { root: null, mode: "Major", explicit: false };
    var keyPopoverOpen = false; // the 12-root grid popover - opens on chip tap, closes on pick
    function buildKeyPicker() {
      if (!el.keyRoots || !el.keyModes) return;
      // Fixed-width key/mode chip: injected once into the button bar (#keyChipSlot). It
      // does double duty - shows the current key (root + abbreviated mode, so it reads as
      // the transpose readout: songKey.root moves with every transpose) AND toggles the
      // fly-out (#keyFlyout: the 12 roots + the mode toggle + the Triads & Inversions link).
      // Abbreviated mode (Maj/Min/Mixo/Dor) keeps it short for the fixed width; the fixed
      // width (.keyPickerCompact in CSS) means "C Maj" and "G# Mixo" render the same size,
      // so the button bar never jumps as the key name changes.
      var chip = document.getElementById('keyPickerCompact');
      if (!chip) {
        var anchor = el.keyChipSlot;
        if (anchor) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.id = 'keyPickerCompact';
          chip.className = 'keyPickerCompact';
          anchor.appendChild(chip);
        }
      }
      if (chip) {
        chip.hidden = false;
        chip.setAttribute('aria-expanded', keyPopoverOpen ? 'true' : 'false');
        chip.setAttribute('aria-controls', 'keyFlyout');
        chip.setAttribute('aria-haspopup', 'true');
        chip.title = 'Key / mode - tap to change';
        // 'shifted' lights the chip when you've transposed off the key you built in
        // (net shift mod an octave), mirroring the old #cKey readout indicator.
        var chipShift = (((cTpose % 12) + 12) % 12) !== 0;
        chip.classList.toggle('shifted', chipShift);
        // Guarded lookup: a bad persisted/imported mode must degrade to the
        // raw string, never hard-crash the key picker on `.label` of undefined.
        var chipMode = MODE_SHORT[songKey.mode] || (MODES[songKey.mode] && MODES[songKey.mode].label) || escHTML(String(songKey.mode || ''));
        // Placeholder is short ("Key") so it fits the fixed-width chip without clipping;
        // the title attr carries the full "Key / mode - tap to change" affordance.
        chip.innerHTML = songKey.root
          ? (songKey.root + ' <span class="kpcMode">' + chipMode + '</span> <span class="kpcCaret" aria-hidden="true">▾</span>')
          : ('Key <span class="kpcCaret" aria-hidden="true">▾</span>');
        chip.onclick = function () { keyPopoverOpen = !keyPopoverOpen; buildKeyPicker(); };
      }
      // The fly-out (roots + mode toggle + Triads & Inversions link) opens/closes with the chip.
      if (el.keyFlyout) el.keyFlyout.hidden = !keyPopoverOpen;
      // Picking a key and picking chords are mutually exclusive - hide the chord
      // picker (In-key/All toggle + chord list + solo-backing CTA) while the
      // key/mode fly-out is open, so the fly-out uses that freed height and the
      // Compose tab fits with no vertical scroll.
      var cwrap = el.keyFlyout && el.keyFlyout.closest ? el.keyFlyout.closest('.composeWrap') : null;
      if (cwrap) cwrap.classList.toggle('keyOpen', keyPopoverOpen);
      // Root grid is always visible INSIDE the fly-out now (no separate popover).
      el.keyRoots.hidden = false;
      el.keyRoots.innerHTML = '';
      ROOTS.forEach(function (r) {
        var b = document.createElement('button');
        b.className = 'chip rootChip' + (r === songKey.root ? ' on' : '');
        b.textContent = r;
        b.setAttribute('aria-pressed', r === songKey.root ? 'true' : 'false');
        b.onclick = function () {
          // Picking a root sets the explicit key and KEEPS the panel open so the mode
          // can be chosen in the same visit (root -> mode is one gesture; the old
          // close-on-root-pick forced a reopen to get minor). A mode tap - or re-tapping
          // the current mode as a "confirm" - closes it. Tapping the currently-selected
          // root clears the key (and stays open for a fresh pick).
          if (songKey.root === r) {
            // Clear the key (context only) - NEVER transpose on clear; the chords stay put.
            songKey.root = null; songKey.explicit = false;
            keyPopoverOpen = true;
          } else {
            // Pick a NEW root. If a progression exists, transpose it by the semitone
            // delta between the OLD song-key tonic and the new root. The old tonic is the
            // explicit song key if one was picked; otherwise (a freely-built progression
            // with no key yet) derive it from the first chord's root so picking a key
            // TRANSPOSES the chords into that key instead of just relabeling them. Take
            // the shorter direction around the circle so the shapes move minimally.
            var oldRoot = songKey.root ||
              (progression.length ? ((splitChord(progression[0]) || {}).root || null) : null);
            if (progression.length && oldRoot) {
              var op = rootPc(oldRoot), np = rootPc(r);
              if (op != null && np != null) {
                var delta = ((np - op) % 12 + 12) % 12;
                if (delta > 6) delta -= 12; // shift the short way
                if (delta !== 0) {
                  progression = progression.map(function (c) { return tpose(c, delta); });
                  cTpose += delta; // keep the transpose readout's net-shift accounting consistent
                }
              }
            }
            songKey.root = r; songKey.explicit = true;
            // stays open (keyPopoverOpen untouched) - the mode tap completes the gesture
          }
          // Picking/clearing a key resets the chord-list view to "follow the key": a set
          // key -> In key, a cleared key -> All. (An explicit segment tap re-pins it.)
          chordView = null;
          renderProg(); renderKey(); buildKeyPicker(); renderKeyView(); buildGrid();
        };
        el.keyRoots.appendChild(b);
      });
      // maj/min (and the wider mode set) toggle - ALWAYS visible, one tap.
      el.keyModes.hidden = false;
      el.keyModes.innerHTML = '';
      Object.keys(MODES).forEach(function (mk) {
        var b = document.createElement('button');
        b.className = 'chip' + (mk === songKey.mode ? ' on' : '');
        b.textContent = MODES[mk].label;
        b.setAttribute('aria-pressed', mk === songKey.mode ? 'true' : 'false');
        b.onclick = function () {
          // Re-tapping the CURRENT mode is a no-op confirm: change nothing, just close
          // the panel (when a root is set - the gesture is complete). The old
          // unconditional convertToMode call re-derived a key from the first chord and
          // could swap the chord list underneath the user on a same-mode tap.
          if (mk === songKey.mode) {
            if (songKey.root) { keyPopoverOpen = false; buildKeyPicker(); }
            return;
          }
          // A real mode change re-harmonizes the built progression (solo-practice
          // scope): the one key/mode filter keeps the chords in sync - a root change
          // transposes, a mode change re-qualifies. convertToMode sets songKey.mode,
          // closes the panel + re-renders. If the progression is empty there's nothing
          // to harmonize, so just set the mode, close (root + mode both chosen = the
          // gesture is done; with no root yet, stay open for the root pick) and
          // re-render the palette.
          if (progression.length) {
            convertToMode(mk);
          } else {
            songKey.mode = mk;
            if (songKey.root) keyPopoverOpen = false;
            renderKey(); buildKeyPicker(); renderKeyView(); renderProg(); buildGrid();
          }
        };
        el.keyModes.appendChild(b);
      });
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
    }
    function renderKeyView() {
      if (!el.keyView) return;
      el.keyView.innerHTML = '';
      if (el.keyClear) el.keyClear.hidden = !songKey.root;
      // #keyView lives INSIDE the key/mode fly-out (below the roots + mode toggle).
      // The fly-out is a pure key/mode PICKER now (locked decision: the Studio owns
      // the fretboard/scale teaching) - the in-flyout solo-scale box and the I-IV-V
      // HSR chain moved out entirely. What remains: the key readout line and a
      // "Triads & Inversions" deep-dive link that opens in the current instrument +
      // key context.
      if (!songKey.root) return; // the 12-root grid above IS the empty-state CTA
      var keyRoot = songKey.root, keyMode = songKey.mode; // local aliases for this render
      var title = document.createElement('div'); title.className = 'keyTitle';
      title.innerHTML = '<strong>' + keyRoot + ' ' + ((MODES[keyMode] && MODES[keyMode].label) || escHTML(keyMode)) + '</strong> <span>' + (MODE_HINT[keyMode] || '') + '</span>';
      el.keyView.appendChild(title);
      // Carry the current instrument AND key so the inversions page opens in context -
      // same instrument profile, pre-selected to this key. mode rides along too so a
      // future minor-cycle variant can read it; the page ignores params it doesn't use.
      var more = document.createElement('a');
      more.className = 'hsrMore';
      var invParams = [];
      if (PROFILE_ID) invParams.push('p=' + encodeURIComponent(PROFILE_ID));
      invParams.push('key=' + encodeURIComponent(keyRoot));
      invParams.push('mode=' + encodeURIComponent(keyMode));
      more.href = 'triad-inversions.html?' + invParams.join('&');
      more.textContent = 'Triads & Inversions →';
      el.keyView.appendChild(more);
    }

    function suggestFor(ch) {
      // Probe the exact name, then the quality-stripped base, each slid across all
      // 12 roots. SUGG only lists natural keys, so a transposed (sharp/flat) chord
      // would otherwise miss and fall back to the C/G/Am/F default — wrong key.
      // Because SUGG relationships are interval-based, we slide ch up to a known
      // root and shift its suggestions back by the same interval, keeping them in
      // the transposed key.
      var variants = [ch, ch.replace(/(maj7|m7|7)$/, '')];
      for (var v = 0; v < variants.length; v++) {
        for (var st = 0; st < 12; st++) {
          var probe = tpose(variants[v], st);
          if (SUGG[probe]) {
            return st === 0 ? SUGG[probe].slice()
              : SUGG[probe].map(function (c) { return tpose(c, -st); });
          }
        }
      }
      return ["C", "G", "Am", "F"];
    }
    function suggestNext(seq) {
      if (!seq.length) return [];
      var last = seq[seq.length - 1], score = {};
      suggestFor(last).forEach(function (c, i) { score[c] = (score[c] || 0) + (10 - i); });
      seq.forEach(function (ch) { suggestFor(ch).forEach(function (c, i) { score[c] = (score[c] || 0) + (4 - Math.min(i, 3)); }); });
      return Object.keys(score).filter(function (c) {
        // only suggest chords the pack can render; if no pack, allow all named chords
        return (pack ? packHasChord(c) : true) && c !== last;
      }).sort(function (a, b) { return score[b] - score[a]; }).slice(0, 5);
    }
    // a COMPACT tappable suggestion chip: chord name + its interval (Roman) label, no
    // fretboard diagram - so "Next chord" stays a few short rows instead of eating the
    // viewport. (The full shapes live in "All chords" / the key palette.) `completes`
    // accent-highlights the chip that finishes a famous progression. The progression
    // NAME itself is deliberately not rendered - the caption blew the chip width and
    // wrapped the row; the glow alone carries the nudge.
    function suggChip(c, tonic, completes) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggChip' + (completes ? ' complete' : '');
      var rn = (global.Circle && global.Circle.romanFor) ? global.Circle.romanFor(c, tonic) : '';
      var html = '<span class="scName">' + escHTML(c) + '</span>';
      if (rn) html += '<span class="scRn">' + escHTML(rn) + '</span>';
      chip.innerHTML = html;
      chip.onclick = function () { addChord(c); packPlayChord(c); };
      return chip;
    }
    // The "?" help button can FORCE the starter list to show even when a progression
    // exists (so the starters stay reachable after you've begun). Cleared as soon as a
    // chord is added/loaded so the box returns to its normal built-chord + next-chord view.
    var forceStarters = false;
    function renderSuggest() {
      if (!el.suggest) return;
      el.suggest.innerHTML = '';
      if (progression.length === 0 || forceStarters) {
        // Empty state (or "?" pressed): show common progressions so the user has
        // actionable one-tap starters. #suggest leads the SCROLLING chord list (folded
        // in with the In key / All content) so the fixed top region stays short.
        var lbl = document.createElement('div'); lbl.className = 'suggLbl';
        lbl.textContent = 'Start with a common progression';
        el.suggest.appendChild(lbl);
        var row = document.createElement('div'); row.className = 'progPickRow';
        PROGRESSIONS.forEach(function (p) {
          var b = document.createElement('button'); b.className = 'progPick'; b.type = 'button';
          var roman = chordsFromDegrees('C', 'Major', p.degrees)
            .map(function (c) { return global.Circle && global.Circle.romanFor ? global.Circle.romanFor(c, 'C') : c; })
            .join(' ');
          b.innerHTML = '<span class="ppRoman">' + roman + '</span><span class="ppName">' + p.name + '</span>';
          b.onclick = function () { loadProgression(p.degrees); };
          row.appendChild(b);
        });
        el.suggest.appendChild(row);
        return;
      }
      var tonic = labelTonic();
      // PROGRESSION-AWARE highlight: a chord that COMPLETES a famous progression is
      // flagged right inside the normal "add a chord" list with an accent glow -
      // no separate rows, no forced vertical, no caption. De-duped per chord.
      var comps = completions(progression, tonic, songKey.root ? songKey.mode : "Major");
      var completeBy = {};
      comps.forEach(function (cmp) {
        (completeBy[cmp.chord] = completeBy[cmp.chord] || []).push(cmp.name);
      });

      var picks = suggestNext(progression);
      // make sure any completing chord is actually in the list (the Markov ranker might
      // not surface it), and float completions to the front so the highlight reads first.
      Object.keys(completeBy).forEach(function (chord) {
        var i = picks.indexOf(chord);
        if (i >= 0) picks.splice(i, 1);
      });
      picks = Object.keys(completeBy).concat(picks).slice(0, 5);
      if (!picks.length) {
        var hint = document.createElement('p');
        hint.className = 'keyHint suggEmpty';
        hint.textContent = 'No suggestions for this progression yet.';
        el.suggest.appendChild(hint);
        return;
      }
      var n = progression.length;
      // Helpful "Add a Nth chord" guidance only for the first few; past that the panel's own
      // "Next chord" summary already says it (avoid the duplicate header the user flagged).
      if (n <= 3) {
        var lbl = document.createElement('div'); lbl.className = 'suggLbl';
        lbl.textContent = n === 1 ? "Add a 2nd chord:" : n === 2 ? "Add a 3rd chord:" : "Add a 4th chord:";
        el.suggest.appendChild(lbl);
      }
      var row = document.createElement('div'); row.className = 'suggRow';
      // Interval label shows the ROLE (V, vi…); a completing chord gets the accent
      // glow (no name caption - see suggChip).
      picks.forEach(function (c) {
        row.appendChild(suggChip(c, tonic, !!completeBy[c]));
      });
      el.suggest.appendChild(row);
    }
    /* ---- inline save UI (replaces native prompt()/alert()/confirm() in the
     * save + solo-backing flows). Built on demand, above the progression box,
     * so it costs zero vertical space until it's actually used (per the "one
     * screen, above the fold" rule) - and torn down again the moment it's
     * dismissed, rather than reserving a permanent row. ---- */
    var composeRow = null, composeToast = null, toastTimer = null;
    function ensureComposeUI() {
      if (!el.prog || !el.prog.parentNode) return false;
      if (!composeRow) {
        composeRow = document.createElement('div');
        composeRow.className = 'composeRow';
        composeRow.hidden = true;
        el.prog.parentNode.insertBefore(composeRow, el.prog);
      }
      if (!composeToast) {
        composeToast = document.createElement('div');
        composeToast.className = 'composeToast';
        composeToast.hidden = true;
        el.prog.parentNode.insertBefore(composeToast, el.prog);
      }
      return true;
    }
    function hideComposeRow() { if (composeRow) { composeRow.hidden = true; composeRow.innerHTML = ''; } }
    // Small non-blocking confirmation/error line (replaces alert()). Auto-hides
    // itself after ~3s so it never permanently claims screen space.
    function showComposeToast(msg, isErr) {
      if (!ensureComposeUI()) return;
      clearTimeout(toastTimer);
      composeToast.textContent = msg;
      composeToast.className = 'composeToast' + (isErr ? ' err' : '');
      composeToast.hidden = false;
      toastTimer = setTimeout(function () { composeToast.hidden = true; }, 3000);
    }
    // Inline name-entry row (replaces prompt()). done(name|null) fires once -
    // the trimmed name on Save/Enter, or null on Cancel/Escape (same contract
    // prompt() had: null == the user backed out).
    function openSaveNameRow(defaultName, done) {
      if (!ensureComposeUI()) { done(defaultName); return; }
      hideComposeRow();
      composeRow.hidden = false;
      var input = document.createElement('input');
      input.type = 'text'; input.className = 'composeRowInput';
      input.placeholder = defaultName; input.value = defaultName;
      input.setAttribute('aria-label', 'Progression name');
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button'; saveBtn.className = 'btn red ctrlBtn'; saveBtn.textContent = 'Save';
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost ctrlBtn'; cancelBtn.textContent = 'Cancel';
      var settled = false;
      function finish(name) { if (settled) return; settled = true; hideComposeRow(); done(name); }
      saveBtn.onclick = function () { finish(input.value.trim() || defaultName); };
      cancelBtn.onclick = function () { finish(null); };
      input.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim() || defaultName); }
        else if (e.key === 'Escape') { finish(null); }
      };
      composeRow.appendChild(input); composeRow.appendChild(saveBtn); composeRow.appendChild(cancelBtn);
      input.focus();
    }
    // Inline two-choice row (replaces confirm()). onPick('save'|'skip') fires once.
    function openSoloChoiceRow(onPick) {
      if (!ensureComposeUI()) { onPick('skip'); return; }
      hideComposeRow();
      composeRow.hidden = false;
      var msg = document.createElement('p');
      msg.className = 'composeRowMsg';
      msg.textContent = 'Save this progression so a video you attach in the Studio sticks?';
      var saveBtn = document.createElement('button');
      saveBtn.type = 'button'; saveBtn.className = 'btn red ctrlBtn'; saveBtn.textContent = 'Save & open Studio';
      var skipBtn = document.createElement('button');
      skipBtn.type = 'button'; skipBtn.className = 'btn ghost ctrlBtn'; skipBtn.textContent = 'Skip';
      var settled = false;
      function finish(choice) { if (settled) return; settled = true; hideComposeRow(); onPick(choice); }
      saveBtn.onclick = function () { finish('save'); };
      skipBtn.onclick = function () { finish('skip'); };
      var btnRow = document.createElement('div');
      btnRow.className = 'composeRowBtns';
      btnRow.appendChild(saveBtn); btnRow.appendChild(skipBtn);
      composeRow.appendChild(msg); composeRow.appendChild(btnRow);
    }
    // Derive key/mode for a saved progression the same way repertoire.js's
    // deriveKey() does (first-chord regex) - reuse it directly (pure, node-tested)
    // rather than duplicating the regex. Falls back to the explicit songKey when
    // one was picked in Compose (more reliable than re-parsing chord #1, e.g. a
    // vi-IV-I-V progression built from a picked key starts on the relative chord).
    function deriveProgressionKey(seq) {
      // songKey.mode is one of the 4 Compose mode names (Major/Minor/Mixolydian/
      // Dorian); lowercase is the exact locked-interface vocabulary. The old
      // `=== 'Minor' ? 'minor' : 'major'` ternary silently relabeled Dorian (a
      // minor-family mode) as major and discarded Mixolydian entirely - a
      // progression built in Dorian would solo over the wrong scale.
      if (songKey.root) return { key: songKey.root, mode: songKey.mode.toLowerCase() };
      var d = global.Repertoire && global.Repertoire.deriveKey ? global.Repertoire.deriveKey({ seq: seq }) : { key: null, mode: null };
      return { key: d.key, mode: d.mode || 'major' };
    }
    // Save the in-progress Compose progression as a stable custom song (cs.id).
    // Populates key/mode (Task 2 requirement 1, locked-interface contract) so the
    // saved song is immediately eligible for "Solo over it" + the Studio.
    //
    // Async by necessity: the inline name row (openSaveNameRow) needs a user tap
    // before a name is known, so this can no longer return synchronously the way
    // the old prompt()-based version did. done(record|null) fires once - the
    // saved record on Save, or null if there was nothing to save / the user
    // cancelled the name row. `done` is optional (the plain Save button doesn't
    // need the result - the inline toast already gives feedback).
    function saveProgression(done) {
      done = done || function () {};
      if (progression.length === 0) { showComposeToast('Build a progression first.', true); done(null); return; }
      // Snapshot seq AND key/mode NOW: the name row waits on a user tap while
      // the progression and key panel stay live behind it. What gets saved is
      // what the user asked to save - not whatever the session mutated into
      // (or cleared to) while the row was open.
      var snapSeq = progression.slice();
      var km = deriveProgressionKey(snapSeq);
      // Editing a progression already saved this session -> UPDATE that same song in
      // place (no new copy, no name prompt), per the operator's "update the same
      // saved song" choice. The chord edits + any re-key flow straight onto cs.
      if (savedComposeId && customById(savedComposeId)) {
        var upd = updateCustomItem(savedComposeId, { seq: snapSeq, key: km.key, mode: km.mode });
        if (upd) { showComposeToast('Updated ' + upd.t); done(upd); return; }
        savedComposeId = null; // the saved song vanished - fall through to a fresh save
      }
      openSaveNameRow('My progression', function (name) {
        if (name === null) { done(null); return; } // cancelled
        var cs = {
          id: 'm' + Date.now(), t: name, a: 'My progression', y: new Date().getFullYear(), d: 'Mine',
          seq: snapSeq, custom: true, key: km.key, mode: km.mode, yt: null
        };
        customSongs.push(cs); saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
        savedComposeId = cs.id; // link the buffer to the saved song for re-save / re-solo
        showComposeToast('Saved to your Repertoire');
        done(cs);
      });
    }
    // Create a brand-new custom item from the Add/Edit form (Requirement 3, Task 2).
    // No seq -> a standalone custom TRACK (no chord sheet; playable straight from
    // the Studio per repertoire.js's existing playability() logic). A seq -> a
    // custom SONG (same shape saveProgression() produces).
    function createCustomItem(f) {
      var cs = {
        id: 'm' + Date.now(), t: f.title || 'Untitled', a: f.artist || '', y: new Date().getFullYear(),
        d: 'Mine', genre: f.genre || '', custom: true, key: f.key || null, mode: f.mode || 'major', yt: f.yt || null
      };
      if (f.seq && f.seq.length) cs.seq = f.seq.slice();
      // Fork of a catalog song: record which song it shadows + preserve the
      // original chords+lyrics sheet verbatim (rebuildAll keeps cs.sheet over a
      // chord-only rebuild). The year carries over so the shadow reads identically.
      if (f.forkOf) cs.forkOf = f.forkOf;
      // Clone the preserved sheet so the fork OWNS its rows - a shared reference to the
      // catalog song's sheet array could be mutated in place from either side.
      if (f.sheet && f.sheet.length) cs.sheet = f.sheet.map(function (r) { return Array.isArray(r) ? r.slice() : r; });
      if (f.y != null) cs.y = f.y;
      // Forking a SETLISTED catalog song: rebuildAll shadows the catalog kN id, so
      // the setlist slot pointing at it would go dangling (the song vanishes from
      // the set). Remap kN -> the new fork id so the entry is REPLACED, not lost.
      if (cs.forkOf && remapSetlist(STATE.setlist, cs.forkOf, cs.id)) saveSet();
      customSongs.push(cs); saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
      return cs;
    }
    // Apply an edit (title/artist/genre/key/mode/seq/yt) to an EXISTING custom item.
    function updateCustomItem(id, f) {
      var cs = null;
      for (var i = 0; i < customSongs.length; i++) if (customSongs[i].id === id) { cs = customSongs[i]; break; }
      if (!cs) return null;
      cs.t = f.title || cs.t; cs.a = f.artist != null ? f.artist : cs.a; cs.genre = f.genre != null ? f.genre : cs.genre;
      cs.key = f.key != null ? f.key : cs.key; cs.mode = f.mode || cs.mode; cs.yt = f.yt != null ? f.yt : cs.yt;
      if (f.seq && f.seq.length) cs.seq = f.seq.slice(); else if (f.seq) delete cs.seq;
      saveCustom(); rebuildAll(); renderFilterChips(); renderSongs();
      if (STATE.current && STATE.current.id === id) {
        if (!cs.seq || !cs.seq.length) switchTab('library'); else renderPractice();
      }
      return cs;
    }
    function deleteCustomItem(id) {
      var victim = customById(id);
      customSongs = customSongs.filter(function (cs) { return cs.id !== id; });
      saveCustom();
      // Reverting a FORK: rebuildAll un-shadows the catalog original, so restore the
      // catalog id into every slot that held the fork (keep the song setlisted). A
      // plain custom delete has no original to fall back to, so drop those slots (null).
      if (remapSetlist(STATE.setlist, id, (victim && victim.forkOf) ? victim.forkOf : null)) saveSet();
      rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist();
    }
    function customById(id) { for (var i = 0; i < customSongs.length; i++) if (customSongs[i].id === id) return customSongs[i]; return null; }
    // ---- M2 Add/Edit form entry points ----
    function openAddForm() {
      if (!repForm) return;
      repForm.open({
        mode: 'create',
        onSave: function (f) { createCustomItem(f); }
      });
    }
    function openEditForm(id) {
      if (!repForm) return;
      var cs = customById(id);
      if (!cs) return;
      repForm.open({
        // A fork edits in FORK mode too (chords hidden, its sheet preserved) -
        // the generic form would expose Chords, but rebuildAll keeps the fork's
        // sheet, so a chord edit would be silently ignored. Chord/lyric editing
        // is slice 2. Its destructive action is "Revert to original".
        mode: 'edit', item: cs, fork: !!cs.forkOf,
        onSave: function (f) {
          var updated = updateCustomItem(id, f);
          // Reopening the Studio here is the actual regression test for the
          // video-persistence bug (Task 2 success criteria): the video now lives
          // on the SAVED item (cs.yt), so a fresh openStudioCb call for the same
          // id shows the same video without any in-memory re-render trick.
          if (updated && updated.yt && openStudioCb) {
            openStudioCb({ id: updated.id, title: updated.t, artist: updated.a, key: updated.key, mode: updated.mode, custom: true, yt: updated.yt });
          }
        },
        onDelete: function () { deleteCustomItem(id); switchTab('library'); }
      });
    }
    // Studio "Edit this track to add a video" entry point. If the studio item maps
    // to a saved custom song/track, edit it; otherwise (an ephemeral or unmatched
    // item) open a prefilled CREATE form so the user can save + curate it. Never a
    // silent close.
    function openEditOrAdd(t) {
      if (!repForm) return;
      var cs = (t && t.id != null) ? customById(t.id) : null;
      if (cs) { openEditForm(cs.id); return; }
      repForm.open({
        mode: 'create',
        item: {
          t: (t && (t.title || t.t)) || '', a: (t && (t.artist || t.a)) || '',
          key: (t && t.key) || '', mode: (t && t.mode) || 'major', yt: (t && t.yt) || null
        },
        onSave: function (f) { createCustomItem(f); }
      });
    }
    // Fork a CATALOG song into an editable, user-owned copy that SHADOWS the
    // original (add a video / rename / re-key). Chords + lyrics are preserved
    // verbatim (passed through as sheet + seq); the form hides the Chords field
    // in fork mode. On save, open the new copy so the user lands on their version.
    function openForkForm(song) {
      if (!repForm || !song) return;
      var sk = soloKeyFor(song, (song.seq || []), 0); // derive a key if the record lacks one
      repForm.open({
        mode: 'create', fork: true,
        item: {
          // fall back to title/artist so the form prefills regardless of record shape
          // (a merged/track-shaped record carries title/artist, a song carries t/a)
          t: song.t != null ? song.t : song.title, a: song.a != null ? song.a : song.artist,
          key: song.key || (sk && sk.key) || '', mode: song.mode || (sk && sk.mode) || 'major',
          genre: song.genre || '', yt: song.yt || null
        },
        onSave: function (f) {
          f.forkOf = song.id;                       // shadow this catalog id
          if (song.sheet && song.sheet.length) f.sheet = song.sheet; // preserve chords+lyrics
          if (song.seq && song.seq.length) f.seq = song.seq.slice(); // preserve chord chips / solo key
          if (song.y != null) f.y = song.y;
          var cs = createCustomItem(f);
          if (cs) { STATE.transpose = 0; openPractice(cs.id); }
        }
      });
    }
    if (el.addBtn) el.addBtn.onclick = openAddForm;
    if (el.cClear) el.cClear.onclick = function () {
      progression = []; cTpose = 0;
      savedComposeId = null;   // fresh canvas - detach from any saved song
      hideComposeRow();        // dismiss an open save/solo dialog (don't strand it over an empty canvas)
      var kc = reinferKey();
      renderProg(); renderKey();
      if (kc && el.keyRoots) { renderKeyView(); buildGrid(); }
    };
    if (el.cSave) el.cSave.onclick = function () { saveProgression(); }; // no callback needed - the inline toast is the feedback
    if (el.cMax) el.cMax.onclick = function () { if (progression.length) openMaxWith(progression.slice()); };
    // "?" help: re-show the starter progressions inside the progression box. Toggles off
    // if already forced (and there's a progression to fall back to).
    if (el.cHelp) el.cHelp.onclick = function () {
      forceStarters = (progression.length === 0) ? true : !forceStarters;
      renderSuggest();
    };
    if (el.cTup) el.cTup.onclick = function () { composeTpose(1); };
    if (el.cTdown) el.cTdown.onclick = function () { composeTpose(-1); };
    // P3 (M3): "Solo over a backing track" opens the Practice Studio directly for the
    // composed key+mode - solo scale + chords + circle, plus a curated video or a
    // YouTube search for one. The finder tab is retired, so this goes straight to the
    // studio instead of seeding a finder view. seedBackingKey stays wired as a no-op
    // fallback when no studio callback is present.
    //
    // Bug fix (video-persistence): the ephemeral path passes a THROWAWAY object
    // ({title:'Solo practice', ...}) with no stable id, so any video pasted into
    // that Studio session has nothing to attach to and vanishes on close. Gate
    // video curation behind a SAVED progression via the inline choice row
    // (replaces the old confirm()/prompt()/alert() chain - no native dialogs):
    // "Save & open Studio" saves first (cs.id is what a video attaches to, via
    // the Add/Edit form's updateCustomItem) then opens the Studio for that saved
    // song, matching the locked-interface shape exactly (id/title/artist/key/
    // mode/custom); "Skip" opens the ephemeral Studio unchanged.
    if (el.soloBackingBtn) el.soloBackingBtn.onclick = function () {
      if (!songKey.root || !progression.length) return;
      if (openStudioCb) {
        // Already saved this session: no re-prompt. Save-in-place (updates the linked
        // song if the chords changed, no-op-ish if not) then open its Studio directly
        // - with the Edit button, since it's a real saved song. No duplicate.
        if (savedComposeId && customById(savedComposeId)) {
          saveProgression(function (saved) {
            if (saved) openStudioCb({ id: saved.id, title: saved.t, artist: saved.a, key: saved.key, mode: saved.mode, custom: true });
          });
          return;
        }
        // Never saved -> the save/skip choice (Save & open Studio links it going forward).
        openSoloChoiceRow(function (choice) {
          if (choice === 'save') {
            saveProgression(function (saved) {
              if (!saved) return; // user cancelled the inline name row
              openStudioCb({ id: saved.id, title: saved.t, artist: saved.a, key: saved.key, mode: saved.mode, custom: true });
            });
            return;
          }
          // Skip: open the ephemeral Studio without saving (locked vocabulary is
          // lowercase - songKey.mode is one of the capitalized Compose names).
          openStudioCb({ title: 'Solo practice', artist: '', key: songKey.root, mode: songKey.mode.toLowerCase() });
        });
      } else {
        switchTab('library');
        seedBackingKey(songKey.root, songKey.mode);
      }
    };
    // The key/mode chip (#keyPickerCompact) is injected + wired by buildKeyPicker; it
    // opens the fly-out on tap (the old #cKey "snap back to key" readout is retired -
    // the chip is the unified key surface now).
    if (el.keyClear) el.keyClear.onclick = function () { songKey.root = null; songKey.explicit = false; keyPopoverOpen = false; buildKeyPicker(); renderKeyView(); renderProg(); renderKey(); buildGrid(); };

    /* ===================== TABS ===================== */
    var ACTIVE_TAB_KEY = prefix + ".activeTab.v1";
    function switchTab(name) {
      // Legacy tab names resolve to the new surfaces: setlist/set -> the Jam tab
      // (the Set / Perform surface), tracks/repertoire -> the unified Library, so
      // old internal callers + deep links still land in the right place.
      if (name === 'setlist' || name === 'set') name = 'jam';
      else if (name === 'tracks' || name === 'repertoire') name = 'library';
      try { localStorage.setItem(ACTIVE_TAB_KEY, name); } catch (e) {} // reopen where you left off
      document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
      document.querySelectorAll('.screen').forEach(function (p) { p.classList.toggle('on', p.id === 's-' + name); });
      if (name === 'practice') renderPractice();
      if (name === 'library') { renderFilterChips(); renderSongs(); }
      if (name === 'jam') renderSetlist();
      // leaving the Tune tab: let the chord pack stop any tuner audio
      if (name !== 'tune' && pack && typeof pack.onLeaveTuner === 'function') pack.onLeaveTuner();
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.scrollTop = 0;
      if (el.ctxLine && CONTEXTS[name] != null) el.ctxLine.textContent = CONTEXTS[name];
      if (pack && typeof pack.onSwitchTab === 'function') pack.onSwitchTab(name);
    }
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });

    /* ===================== INIT ===================== */
    rebuildAll();
    renderFilterChips();
    renderSongs();
    renderSetlist();
    // Library is the default-shown screen; set its context line (the tab-restore
    // below overwrites it when a saved non-library tab is reopened).
    if (el.ctxLine && CONTEXTS['library'] != null) el.ctxLine.textContent = CONTEXTS['library'];
    buildGrid();
    buildKeyPicker();
    renderKeyView();
    renderProgPicks();
    renderProg();

    // Give the chord pack a chance to wire its own UI (e.g. the Tune tab).
    if (pack && typeof pack.init === 'function') {
      pack.init({
        switchTab: switchTab,
        chordRootFreq: chordRootFreq,
        tpose: tpose
      });
    }

    // Reopen where you left off: restore the last active tab (Library is the default-shown,
    // so only switch when the saved tab is something else and its button actually exists).
    try {
      var savedTab = localStorage.getItem(ACTIVE_TAB_KEY), tabExists = false;
      // Normalize a legacy saved tab through the SAME mapping switchTab applies,
      // so an old activeTab.v1 written before the Jam rename ('setlist'/'set' ->
      // Jam, 'tracks'/'repertoire' -> Library) restores to the right modern tab
      // instead of failing the tabExists check and falling back to Library.
      if (savedTab === 'setlist' || savedTab === 'set') savedTab = 'jam';
      else if (savedTab === 'tracks' || savedTab === 'repertoire') savedTab = 'library';
      // Pre-Jam versions kept Set/Perform as a Library SUBVIEW under libType.v1
      // (never written by this version). Consume it ONCE: migrate to Jam and
      // REMOVE the legacy key - otherwise a migrated user who later chooses
      // Library would be forced back to Jam on every reload (the sticky-marker
      // bug), since libType.v1 would keep overriding the real saved tab.
      if (localStorage.getItem(prefix + '.libType.v1') === 'set') {
        try { localStorage.removeItem(prefix + '.libType.v1'); } catch (e) {}
        if (!savedTab || savedTab === 'library') savedTab = 'jam';
      }
      // match by iterating buttons (not a built selector) so a malformed stored value can't
      // throw a selector SyntaxError and abort the restore.
      document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.tab === savedTab) tabExists = true; });
      if (savedTab && savedTab !== 'library' && tabExists) {
        switchTab(savedTab);
      }
    } catch (e) {}

    /* ---- controller ---- */
    return {
      switchTab: switchTab,
      openSong: openPractice,
      getState: function () { return STATE; },
      getSongs: function () { return ALLSONGS.slice(); },
      rebuild: function () { rebuildAll(); renderFilterChips(); renderSongs(); renderSetlist(); },
      // M2: opens the Add/Edit form for an existing custom item by id. Exposed on
      // the controller so tracks.js's Studio "Edit this track" link (wired via
      // Tracks.mount's onEditRequest) can reach it without a circular require.
      openEditForm: openEditForm,
      openEditOrAdd: openEditOrAdd
    };
  }

  /* ---------- public surface ---------- */
  global.Songbook = {
    mount: mount,
    // pure helpers exposed for chord packs / tests
    tpose: tpose,
    tposeLine: tposeLine,
    splitChord: splitChord,
    noteToPc: noteToPc,
    chordRootFreq: chordRootFreq,
    renderSheet: renderSheet,
    fitScale: fitScale,
    soloKeyFor: soloKeyFor,
    isMine: isMine,
    hasChordSheet: hasChordSheet,
    shadowedCatalogIds: shadowedCatalogIds,
    buildAllSongs: buildAllSongs,
    buildSheetFromSeq: buildSheetFromSeq,
    shadowedTrackKeys: shadowedTrackKeys,
    remapSetlist: remapSetlist,
    studioTarget: studioTarget,
    libraryFilter: libraryFilter,
    libraryEmptyState: libraryEmptyState,
    ytSearchURL: ytSearchURL,
    nextTranspose: nextTranspose,
    chordsFromDegrees: chordsFromDegrees,
    PROGRESSIONS: PROGRESSIONS,
    degreeOf: degreeOf,
    completions: completions,
    inferKey: inferKey,
    ROOTS: ROOTS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Songbook;

})(typeof window !== 'undefined' ? window : this);
