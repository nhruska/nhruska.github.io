/* =====================================================================
 * song-templates.js  -  M-12 S-SDD-TEMPLATES: a deterministic, runtime
 * song-template library mined from the song catalog (songs.json), plus a
 * canonical proven-families table. Feeds the upcoming song wizard (M-13).
 *
 * Pure functions only - no DOM, no fetch. Callers pass the songs array in
 * (same "pure core, presentation stays out" shape as repertoire.js/tracks.js).
 * No build step. Exposes window.SongTemplates, and require()-able in Node.
 *
 * Key inference reuses Repertoire.deriveKey (the app's ONE key-inference path -
 * "a song's first chord is its working tonic", per repertoire.js/list-item.js)
 * so a mined pattern's roman analysis always agrees with what the Library
 * badge and the Studio already call "the key". Roman analysis reuses
 * Circle.romanFor (the app's ONE degree-analysis path, per tracks.js
 * inferSoloDefault) - never a second theory implementation.
 * ===================================================================== */
(function (global) {
  'use strict';

  // Guarded-reference pattern (matches tracks.js circleRef()/notablesRef()):
  // window.Circle/window.Repertoire in the browser (classic scripts, loaded
  // before this file), a require() fallback in Node so tests drive the SAME
  // modules the app uses. No-op in the browser (global.Circle already set).
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }
  function repertoireRef() {
    if (global.Repertoire) return global.Repertoire;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./repertoire.js'); } catch (e) {}
    }
    return null;
  }

  // ---- FAMILIES: canonical proven progression families (roman, key-
  // independent) - songwriting-coach's proven-families table, home = the
  // section they conventionally belong to ('verse'|'chorus'|'any'). Every
  // roman token here is a bare degree (no quality markers) - families don't
  // assert 7ths/dim/aug, only the degree shape.
  var FAMILIES = [
    {
      id: 'axis', name: 'Axis (I-V-vi-IV)', roman: ['I', 'V', 'vi', 'IV'], home: 'chorus',
      note: 'The most-recorded 4-chord pop/rock loop - safe and anthemic, the default chorus home base.'
    },
    {
      id: 'doowop', name: '50s / doo-wop (I-vi-IV-V)', roman: ['I', 'vi', 'IV', 'V'], home: 'any',
      note: 'The classic ballad turn (the Stand By Me shape) - warm and familiar as verse or chorus.'
    },
    {
      id: 'blues12', name: '12-bar blues', roman: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I'], home: 'any',
      note: 'The blues form itself - one chord per bar across 12 bars; the progression IS the song.'
    },
    {
      id: 'folk', name: 'Folk cadence (I-IV-V)', roman: ['I', 'IV', 'V'], home: 'verse',
      note: 'The three-chord folk/country home base - simple, singable, room for the words to lead.'
    },
    {
      id: 'mixolydian', name: 'Mixolydian rock (I-bVII-IV)', roman: ['I', 'bVII', 'IV'], home: 'chorus',
      note: 'The classic-rock riff move - the flattened-7th door back to IV gives a chorus its lift.'
    },
    {
      id: 'minorPop', name: 'Minor pop (i-bVI-bIII-bVII)', roman: ['i', 'bVI', 'bIII', 'bVII'], home: 'chorus',
      note: "The modern minor-key anthem loop - dramatic without ever leaving the tonic's orbit."
    },
    {
      id: 'andalusian', name: 'Andalusian cadence (i-bVII-bVI-V)', roman: ['i', 'bVII', 'bVI', 'V'], home: 'verse',
      note: 'The descending lament-bass - dramatic, a flamenco/rock verse or intro device.'
    },
    {
      id: 'jazzTurnaround', name: 'Jazz turnaround (ii-V-I)', roman: ['ii', 'V', 'I'], home: 'any',
      note: 'The cadence of the jazz/soul idiom - the sound of resolution, usable wherever a phrase lands.'
    }
  ];

  // Normalize a section label into a grouping key: lowercase, letters only, so
  // "Pre-Chorus" / "Prechorus" / "pre chorus" all collapse to one bucket. The
  // FIRST-seen raw label (song data's own casing) is kept as the bucket's
  // display name - never a made-up canonical spelling.
  function normSectionKey(label) {
    return String(label == null ? '' : label).toLowerCase().replace(/[^a-z]/g, '');
  }

  // Split a song's sheet ([[section, line], ...]) into per-section line
  // groups. A '' (continuation) label attaches to the PRECEDING section. A
  // section label seen again later in the same song (non-adjacent repeat,
  // e.g. Verse 1 / Verse 2) folds into the SAME bucket for that song - the
  // chords a section uses are what's being mined, not its position count.
  function splitSections(sheet) {
    var order = [], buckets = {};
    var cur = null;
    (sheet || []).forEach(function (pair) {
      var label = pair && pair[0], line = (pair && pair[1]) || '';
      var key = normSectionKey(label);
      if (key) {
        if (!buckets[key]) {
          buckets[key] = { label: label, lines: [] };
          order.push(key);
        }
        cur = buckets[key];
      }
      if (cur) cur.lines.push(line);
    });
    return order.map(function (key) { return buckets[key]; });
  }

  // Extract every [Chord] tag from a lyric line, in order.
  var TAG_RE = /\[([^\]]+)\]/g;
  function extractTags(line) {
    var out = [], m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(String(line || '')))) out.push(m[1]);
    return out;
  }

  // Collapse ADJACENT duplicate tokens only (A,A,D -> A,D). Does not reduce a
  // repeated multi-chord loop to one cycle - mine() reports what a section's
  // sheet lines actually spell out, per spec.
  function dedupeConsecutive(arr) {
    var out = [];
    arr.forEach(function (x) {
      if (!out.length || out[out.length - 1] !== x) out.push(x);
    });
    return out;
  }

  // The app's ONE key-inference path (Repertoire.deriveKey: "a song's first
  // chord is its working tonic"), reused rather than re-derived. Returns
  // {key, mode} or null when the song has nothing to infer from.
  function deriveSongKey(song) {
    var R = repertoireRef();
    if (!R || typeof R.deriveKey !== 'function') return null;
    var kd = R.deriveKey(song || {});
    return kd && kd.key ? kd : null;
  }

  // mine(songs) -> { bySection: { Verse: [{roman, count, citations}], ... } }
  // For each song: infer its key, split its sheet into sections, extract each
  // section's chord sequence (deduped consecutively), roman-analyze every
  // chord against the song's tonic, and tally identical roman sequences
  // ("patterns") across the whole catalog. Patterns rank by count desc.
  function mine(songs) {
    var Circ = circleRef();
    var bySection = {}; // normKey -> { label, patterns: { signature -> entry } }
    (Array.isArray(songs) ? songs : []).forEach(function (song) {
      if (!Circ || typeof Circ.romanFor !== 'function') return;
      var kd = deriveSongKey(song);
      if (!kd) return;
      var tonicChord = kd.key + (kd.mode === 'minor' ? 'm' : '');
      var title = (song && (song.t != null ? song.t : song.title)) || '(untitled)';
      splitSections(song && song.sheet).forEach(function (sec) {
        var tags = [];
        sec.lines.forEach(function (line) { tags = tags.concat(extractTags(line)); });
        tags = dedupeConsecutive(tags);
        if (!tags.length) return;
        // Stop-condition: a chord Circle can't resolve records as null and we
        // keep going - never invent a theory for it, never drop the position.
        var roman = tags.map(function (tok) { return Circ.romanFor(tok, tonicChord) || null; });
        if (!roman.some(function (r) { return r; })) return; // nothing resolvable -> skip
        var key = normSectionKey(sec.label);
        if (!bySection[key]) bySection[key] = { label: sec.label, patterns: {} };
        var sig = roman.map(function (r) { return r == null ? '?' : r; }).join(',');
        var entry = bySection[key].patterns[sig];
        if (!entry) {
          entry = { roman: roman.slice(), count: 0, citations: [] };
          bySection[key].patterns[sig] = entry;
        }
        entry.count++;
        if (entry.citations.indexOf(title) < 0) entry.citations.push(title);
      });
    });
    var out = {};
    Object.keys(bySection).forEach(function (key) {
      var bucket = bySection[key];
      var list = Object.keys(bucket.patterns).map(function (sig) { return bucket.patterns[sig]; });
      list.sort(function (a, b) { return b.count - a.count; });
      out[bucket.label] = list;
    });
    return { bySection: out };
  }

  // forSection(section, songs) -> ranked suggestions for one section: mined
  // patterns first (count desc, already sorted by mine()), then canonical
  // FAMILIES whose home matches ('any' always matches), deduped by roman
  // signature so a family already covered by a mined pattern isn't repeated.
  function forSection(section, songs) {
    var normKey = normSectionKey(section);
    var mined = mine(songs).bySection;
    var minedList = [];
    Object.keys(mined).forEach(function (label) {
      if (normSectionKey(label) === normKey) minedList = mined[label];
    });
    var seen = {}, out = [];
    minedList.forEach(function (p) {
      var sig = p.roman.join(',');
      if (seen[sig]) return;
      seen[sig] = true;
      out.push({ source: 'mined', roman: p.roman.slice(), count: p.count, citations: p.citations.slice() });
    });
    FAMILIES.forEach(function (f) {
      if (f.home !== 'any' && normSectionKey(f.home) !== normKey) return;
      var sig = f.roman.join(',');
      if (seen[sig]) return;
      seen[sig] = true;
      out.push({ source: 'family', id: f.id, name: f.name, roman: f.roman.slice(), note: f.note });
    });
    return out;
  }

  var SongTemplates = {
    FAMILIES: FAMILIES,
    mine: mine,
    forSection: forSection
  };

  global.SongTemplates = SongTemplates;
  if (typeof module !== 'undefined' && module.exports) module.exports = SongTemplates;

})(typeof window !== 'undefined' ? window : this);
