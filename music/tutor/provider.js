/* =====================================================================
 * provider.js  -  AI Tutor prototype: pluggable response provider +
 * settings persistence. Pure logic, no DOM - Node-testable (node
 * test/tutor-provider.test.js) and browser-usable (window.TutorProvider).
 * ---------------------------------------------------------------------
 * Stub-only in this pass (see music/TUTOR-PROTOTYPE-CHECKLIST.md): the
 * canned provider below is the ONLY implementation exercised. It answers
 * from a small library of roadmap-grounded turns (music/TUTOR-ROADMAP.md)
 * so the chat UI can be driven and reacted to without spending a real
 * API call. Settings are shaped for a future OpenRouter-compatible
 * endpoint (baseUrl + apiKey + model) but are NEVER read by any fetch
 * here - wiring a real network call is an explicit follow-up decision
 * (central proxy vs bring-your-own-key), not resolved by this file.
 *
 * sendMessage(history, context) -> Promise<{text, quickReplies?}>
 *   history: [{role:'user'|'tutor', text}, ...] (chronological, latest last)
 *   context: {key, mode} - optional current key/mode, echoed into replies
 *            when relevant so the persona reads as key/mode-aware.
 * ===================================================================== */
(function (global) {
  'use strict';

  var SETTINGS_KEY = 'music.tutor.settings.v1';
  var DEFAULT_SETTINGS = { provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', model: '' };

  // ---- settings (localStorage-only; never used to make a network call here) --
  // Bare `localStorage` (not `global.localStorage`/`window.localStorage`):
  // in a Node CommonJS module the IIFE's `global` param resolves to
  // `module.exports`, not Node's real global object, so a property lookup
  // on it would never see a global set by a test. A bare identifier check
  // resolves correctly in both the browser (lexical global) and Node
  // (properties assigned on Node's `global` are visible as bare globals).
  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function loadSettings() {
    try {
      var ls = storage();
      var raw = ls && ls.getItem(SETTINGS_KEY);
      if (!raw) return clone(DEFAULT_SETTINGS);
      var parsed = JSON.parse(raw);
      return Object.assign(clone(DEFAULT_SETTINGS), parsed && typeof parsed === 'object' ? parsed : {});
    } catch (e) { return clone(DEFAULT_SETTINGS); }
  }
  function saveSettings(patch) {
    var next = Object.assign(loadSettings(), patch || {});
    try { var ls = storage(); ls && ls.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- canned response library --------------------------------------------
  // Each entry: match(lowerText) -> bool, and a response built from context.
  var LIBRARY = [
    {
      id: 'parallel-relative',
      match: function (t) { return /parallel|relative/.test(t); },
      reply: function (ctx) {
        var root = (ctx && ctx.key) || 'C';
        return {
          text: 'Two different moves, easy to mix up. **Relative** (' + root + ' major <-> ' + relativeMinorName(root) +
            ' minor): same 7 notes, different home note - that\'s why ' + relativeMinorName(root) + ' minor and ' + root +
            ' major both solo cleanly over a ' + root + ' major progression. **Parallel** (' + root + ' major <-> ' + root +
            ' minor): same home note, different notes - the chord qualities flip (I-IV-V becomes i-iv-v). Want to hear it both ways?',
          quickReplies: ['Show me I-IV-V vs i-iv-v', 'Swap the solo scale over my progression']
        };
      }
    },
    {
      id: 'i-iv-v',
      match: function (t) { return /i-?iv-?v|1-?4-?5|roman numeral/.test(t); },
      reply: function (ctx) {
        var root = (ctx && ctx.key) || 'C';
        return {
          text: 'In ' + root + ' major, I-IV-V spells out as the plain major triads on the 1st, 4th, and 5th scale degrees. ' +
            'Switch to ' + root + ' parallel minor and the same roman numerals become i-iv-v - all three chords go minor ' +
            '(harmonic minor keeps V major for a stronger pull back home). Same numbers, different color.',
          quickReplies: ['What are borrowed chords?', 'Back to parallel vs relative']
        };
      }
    },
    {
      id: 'borrowed',
      match: function (t) { return /borrow|secondary dominant|modulat/.test(t); },
      reply: function () {
        return {
          text: 'Borrowed chords and secondary dominants are the two most common ways a progression steps outside its own key on purpose: ' +
            'a borrowed chord pulls a chord from the parallel key (e.g. a minor iv in a major song for a moody lift), a secondary ' +
            'dominant treats a non-tonic chord as a temporary "I" and approaches it with its own V (like D7 -> G in the key of C). ' +
            'That\'s exactly why the chord picker keeps every chord reachable, not just the ones in-key.',
          quickReplies: ['Swap the solo scale over my progression', 'Help me build a song']
        };
      }
    },
    {
      id: 'phase4-scale-swap',
      match: function (t) { return /swap.*scale|solo scale|scale.*swap/.test(t); },
      reply: function (ctx) {
        var root = (ctx && ctx.key) || 'C';
        return {
          text: '(Phase 4 preview) Picture your Compose progression staying exactly as built. I hold the chords fixed and only change ' +
            'what YOU solo with: first pass, ' + relativeMinorName(root) + ' minor over it (relative - same notes, different feel). ' +
            'Second pass, I retune the backing to ' + root + ' minor and you solo ' + root + ' minor (parallel - genuinely different notes). ' +
            'This is a decoupled scale selector, separate from the key/mode filter that drives harmonization - not built yet, just the idea.',
          quickReplies: ['What are borrowed chords?', 'Help me build a song']
        };
      }
    },
    {
      id: 'phase5-song-form',
      match: function (t) { return /song|section|verse|chorus|bridge|aaba|form/.test(t); },
      reply: function () {
        return {
          text: '(Phase 5 preview) Once a progression feels good, the next question is "what section is this?" I\'d walk you through ' +
            'labeling it (intro / verse / chorus / bridge), then help pick a contrasting progression for the next section so the whole ' +
            'song has shape instead of one loop repeated. AABA is the classic starting form - two verses, a contrasting bridge, back to the verse.',
          quickReplies: ['Swap the solo scale over my progression', 'What are borrowed chords?']
        };
      }
    }
  ];

  var FALLBACK = {
    text: 'I can talk through parallel vs relative scales, I-IV-V vs i-iv-v, borrowed chords, swapping your solo scale over a fixed ' +
      'progression, or building a song out of sections. Which one?',
    quickReplies: ['Parallel vs relative', 'What are borrowed chords?', 'Help me build a song']
  };

  function relativeMinorName(root) {
    // Minimal spelling table, sharps-first (matches the app's Circle/Songbook convention).
    var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
    var norm = FLAT_TO_SHARP[root] || root;
    var i = ROOTS.indexOf(norm);
    if (i < 0) return 'A'; // unknown root: fall back to C major's relative
    return ROOTS[(i + 9) % 12]; // relative minor = 9 semitones up / 3 down
  }

  function pickReply(text, context) {
    var lower = String(text || '').toLowerCase();
    for (var i = 0; i < LIBRARY.length; i++) {
      if (LIBRARY[i].match(lower)) return LIBRARY[i].reply(context);
    }
    return FALLBACK;
  }

  // ---- provider interface --------------------------------------------------
  // Any future real backend implements the same shape: sendMessage(history, context) -> Promise<{text, quickReplies?}>.
  function createCannedProvider(opts) {
    var latencyMs = (opts && typeof opts.latencyMs === 'number') ? opts.latencyMs : 500;
    return {
      id: 'canned',
      sendMessage: function (history, context) {
        var last = history && history.length ? history[history.length - 1] : null;
        var reply = pickReply(last && last.text, context);
        return new Promise(function (resolve) {
          setTimeout(function () { resolve(reply); }, latencyMs);
        });
      }
    };
  }

  var TutorProvider = {
    SETTINGS_KEY: SETTINGS_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    pickReply: pickReply,
    relativeMinorName: relativeMinorName,
    createCannedProvider: createCannedProvider,
    FALLBACK: FALLBACK
  };

  global.TutorProvider = TutorProvider;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorProvider;

})(typeof window !== 'undefined' ? window : this);
