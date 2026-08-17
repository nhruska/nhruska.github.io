/* =====================================================================
 * setup-doc.js  -  S17 (agent-interaction spec section 4b): parse a
 * `music-setup/v1` BATCH setup document - the fallback/batch transport for
 * jam-link.js's `?jam=` deep link, for payloads too big or too many for a
 * URL. An agent bundles setup proposals (progressions / track links) as one
 * JSON doc next to the SKILL.md files; the user imports it via the existing
 * Skills file picker (songbook.js).
 *
 * Pure, dependency-free except for jam-link.js (same discipline as
 * competency.js / skill-md.js): no DOM, no storage, never throws. Exposes
 * window.SetupDoc and require()-able in Node (test/setup-doc.test.js).
 * music/sw.js CORE must precache this file (owned by the sibling agent
 * wiring the SW cache bump - not touched here, see PR notes).
 * ---------------------------------------------------------------------
 * Contract (LOCKED - docs/plans/goal-agent-interaction-20260817.md 4b):
 *   { "schema": "music-setup/v1", "created": ISO, "source": "agent:<tool>",
 *     "entries": [
 *       { "type": "jam", "name": str?, "chords": ["Am","F"...], "key": str?, "yt": str? }
 *     | { "type": "track", "name": str?, "yt": str, "key": str?, "mode": str? }
 *     ] }
 *
 * Validation is DELEGATED to jam-link.js's parse() rather than a second copy
 * of its chord-token/key/yt grammar - jam-link exports only the coarse
 * `parse(searchString)` entry point (no fine-grained helpers), so each entry
 * is round-tripped through a synthetic URLSearchParams string and handed to
 * JamLink.parse(). This keeps exactly ONE token/key/yt validator in the repo:
 *   - "jam" entries map 1:1 onto the `?jam=&key=&yt=&name=` grammar (this doc
 *     format IS the batch form of that link) - chords canonical-sharp, key
 *     tonic left un-respelled, yt keyless id/URL.
 *   - "track" entries reuse the SAME yt/tonic grammar, but carry key + mode
 *     as SEPARATE fields (matching the app's own repertoire-item shape,
 *     songbook.js openEditOrAdd) rather than jam-link's combined "Gm" form -
 *     mode is folded into a synthetic trailing "m" only for the parse() call,
 *     then unfolded back into a plain mode string on the way out.
 *
 * Rules:
 * - Unknown entry `type`, or an entry that fails validation (e.g. a "track"
 *   with no/invalid yt, a "jam" whose chords all drop), is SKIPPED and
 *   counted - never fatal. Partial success beats an all-or-nothing reject.
 * - Zero valid entries after skips -> { ok:false } (nothing to apply).
 * - Applying an entry (prefilling the add/progression form) is the CALLER's
 *   job (songbook.js's Skills import branch) - this module only produces the
 *   validated, normalized entry list. It never writes storage.
 * ===================================================================== */
(function (root) {
  'use strict';

  var SCHEMA = 'music-setup/v1';

  // jam-link.js is the ONE token/key/yt validator (see header) - resolve it
  // the same way songbook.js resolves theory.js: window global in the
  // browser, require() in Node. Absent -> every parse() call fails soft.
  function getJamLink() {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./jam-link.js'); } catch (e) { return null; }
    }
    return (root && root.JamLink) || null;
  }

  // "jam" entry -> jam-link's own setup shape (chords[], key:{tonic,minor}|null,
  // yt, name) - literally the same object shape as the `?jam=` deep link's
  // parsed setup, since a jam entry IS that link's batch form.
  function normalizeJamEntry(raw, JL) {
    var chords = Array.isArray(raw.chords) ? raw.chords.filter(function (c) { return typeof c === 'string' && c; }) : [];
    if (!chords.length) return null; // nothing to jam on - not worth applying
    var qp = new URLSearchParams();
    qp.set('jam', chords.join(','));
    if (raw.key != null) qp.set('key', String(raw.key));
    if (raw.yt != null) qp.set('yt', String(raw.yt));
    if (raw.name != null) qp.set('name', String(raw.name));
    var parsed = JL.parse(qp.toString());
    // The whole-jam-drops-on-any-bad-token rule (jam-link.js) means a bad
    // token here surfaces as chords:[] on an otherwise-ok parse - reject the
    // ENTRY in that case (its point is the progression), not just the token.
    if (!parsed.ok || !parsed.setup.chords.length) return null;
    return { type: 'jam', chords: parsed.setup.chords, key: parsed.setup.key, yt: parsed.setup.yt, name: parsed.setup.name };
  }

  // "track" entry -> { type, yt, name, key: tonic|null, mode: 'major'|'minor' }
  // - the shape songbook.js's repertoire-item prefill (item.key/item.mode)
  // already expects, so the caller needs no further translation.
  function normalizeTrackEntry(raw, JL) {
    if (!raw.yt) return null; // yt is required for a track entry (locked contract)
    var qp = new URLSearchParams();
    qp.set('yt', String(raw.yt));
    if (raw.name != null) qp.set('name', String(raw.name));
    // Fold key+mode into jam-link's combined "<tonic><m?>" grammar for
    // validation only; unfolded again below. mode values other than the
    // literal 'minor' collapse to major, matching the app's own default
    // (songbook.js openEditOrAdd: `mode: (t && t.mode) || 'major'`).
    if (raw.key != null) qp.set('key', String(raw.key) + (raw.mode === 'minor' ? 'm' : ''));
    var parsed = JL.parse(qp.toString());
    if (!parsed.ok || !parsed.setup.yt) return null; // yt absent/malformed after validation
    return {
      type: 'track', yt: parsed.setup.yt, name: parsed.setup.name,
      key: parsed.setup.key ? parsed.setup.key.tonic : null,
      mode: parsed.setup.key ? (parsed.setup.key.minor ? 'minor' : 'major') : 'major'
    };
  }

  function normalizeEntry(raw, JL) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.type === 'jam') return normalizeJamEntry(raw, JL);
    if (raw.type === 'track') return normalizeTrackEntry(raw, JL);
    return null; // unknown type - skipped, never fatal
  }

  // parse(jsonOrString) -> { ok:true, doc:{schema,created,source,entries[]},
  //                          skipped:N, total:M }
  //                       | { ok:false, reason }
  // Never throws - any unexpected input degrades to { ok:false, reason }.
  function parse(jsonOrString) {
    try {
      var doc;
      if (typeof jsonOrString === 'string') {
        try { doc = JSON.parse(jsonOrString); } catch (e) { return { ok: false, reason: 'not valid JSON' }; }
      } else { doc = jsonOrString; }
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, reason: 'not a setup doc' };
      if (doc.schema !== SCHEMA) return { ok: false, reason: 'unrecognized setup-doc format' };
      if (!Array.isArray(doc.entries) || !doc.entries.length) return { ok: false, reason: 'no entries in setup doc' };
      var JL = getJamLink();
      if (!JL || typeof JL.parse !== 'function') return { ok: false, reason: 'setup-doc parser unavailable on this build' };
      var entries = [], skipped = 0, total = doc.entries.length;
      doc.entries.forEach(function (raw) {
        var n = normalizeEntry(raw, JL);
        if (n) entries.push(n); else skipped++;
      });
      if (!entries.length) return { ok: false, reason: 'no valid entries (skipped ' + skipped + ' of ' + total + ')' };
      return {
        ok: true,
        doc: { schema: SCHEMA, created: doc.created || null, source: doc.source || null, entries: entries },
        skipped: skipped, total: total
      };
    } catch (e) {
      return { ok: false, reason: 'could not read setup doc' };
    }
  }

  var API = { SCHEMA: SCHEMA, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SetupDoc = API;

})(typeof window !== 'undefined' ? window : this);
