/* =====================================================================
 * challenges.js  -  AI Tutor prototype: scripted microlearning scenarios
 * that drive music/tutor/mini-compose.js. Pure logic, no DOM - Node-testable
 * (test/challenges.test.js) and browser-usable (window.TutorChallenges).
 *
 * Two challenge kinds:
 *   'build'    - wave 2: the AI demos building a progression, then the human
 *                builds the same shape by tapping in-key chords; checked
 *                against the roman-numeral shape.
 *   'identify' - wave 3: the AI acts on the widget (demo a progression,
 *                transpose it, drop a mock backing track, reinterpret the
 *                key), then asks a multiple-choice "which scale solos over
 *                this?" question, answered via chat quick-replies (reuses
 *                the existing quick-reply UI - no new widget needed).
 *
 * Every challenge ends with the SAME shared reflection prompt (see
 * REFLECTION_OPTIONS/REFLECTION_RESPONSES) - "how did that feel" - run
 * generically by the UI after any challenge's check passes, not authored
 * per-challenge, so it stays consistent and DRY.
 *
 * Curriculum order (per this session's direction): wave 2's two challenges
 * are chord-building onboarding ("how to use Compose"); wave 3 graduates to
 * USING what you built - solo over it, transpose and solo again, solo over
 * a (mocked) backing track, then swap the lens to the relative minor and
 * solo again. Depth still matters, but breadth is the explicit ask this
 * wave - 6 challenges, not 2.
 * ===================================================================== */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../shared/circle.js'), require('./mini-compose.js'));
  } else {
    global.TutorChallenges = factory(global.Circle, global.MiniCompose);
  }
})(typeof window !== 'undefined' ? window : this, function (Circle, MiniCompose) {
  'use strict';

  function scaleLabel(root, mode) { return root + ' ' + mode; }
  function scaleOptionId(root, mode) { return root + '-' + mode; }
  function scaleOption(root, mode) { return { id: scaleOptionId(root, mode), root: root, mode: mode, label: scaleLabel(root, mode) }; }

  // ---- 'build' checker (wave 2, unchanged) ---------------------------------
  function checkRomanShape(state, targetRomans) {
    if (state.progression.length !== targetRomans.length) {
      return { pass: false, message: 'That\'s ' + state.progression.length + ' chord' + (state.progression.length === 1 ? '' : 's') + ' - I\'m looking for ' + targetRomans.length + ' (' + targetRomans.join('-') + ').' };
    }
    var romans = MiniCompose.romanNumerals(state);
    var matches = romans.every(function (r, i) { return r === targetRomans[i]; });
    if (matches) return { pass: true, message: 'That\'s it - ' + romans.join('-') + ' in ' + state.key + ' ' + state.mode + '. Nice.' };
    return { pass: false, message: 'Close, but that reads as ' + romans.join('-') + ' - I\'m looking for ' + targetRomans.join('-') + '.' };
  }

  // ---- 'identify' checker (wave 3): compare a chosen option id -----------
  function checkScaleChoice(chosenId, correctRoot, correctMode) {
    var correctId = scaleOptionId(correctRoot, correctMode);
    var notes = Circle.scale(correctRoot, correctMode).join(' ');
    if (chosenId === correctId) {
      return { pass: true, message: 'Yes - ' + scaleLabel(correctRoot, correctMode) + ' (' + notes + ') covers every chord there. That\'s your solo scale.' };
    }
    return { pass: false, message: 'Not quite - the scale that fits every chord here is ' + scaleLabel(correctRoot, correctMode) + ' (' + notes + ').' };
  }

  // ---- shared reflection step (run generically after any pass) -----------
  var REFLECTION_OPTIONS = [
    { id: 'clicked', label: 'That clicked!' },
    { id: 'shape-not-why', label: 'I see the shape, not sure why yet' },
    { id: 'fuzzy', label: 'Still fuzzy' }
  ];
  var REFLECTION_RESPONSES = {
    'clicked': 'Love that - when it clicks, it tends to stay clicked. It\'s the same pattern everywhere, just moved to a new spot.',
    'shape-not-why': 'Totally normal - the "why" usually shows up a few reps later. Keep the pattern in your hands and the theory catches up.',
    'fuzzy': 'Fair - nothing wrong with that. Want to replay the demo before the next one, or push on and let it settle?'
  };
  var REFLECTION_PROMPT = 'Quick check-in before the next one - how did that feel?';

  // ---- wave 2: build-a-progression challenges (unchanged) -----------------
  var buildChallenges = [
    {
      id: 'i-iv-v',
      kind: 'build',
      title: 'Build I-IV-V',
      intro: function (state) {
        return 'Let\'s build the most common progression there is: I-IV-V. Watch - in ' + state.key + ' ' + state.mode + ', that\'s the 1st, 4th, and 5th diatonic chords.';
      },
      demoActions: function (state) {
        var d = MiniCompose.diatonicChoices(state);
        return [
          { type: 'clearProgression' },
          { type: 'addChord', chord: d[0].chord },
          { type: 'addChord', chord: d[3].chord },
          { type: 'addChord', chord: d[4].chord }
        ];
      },
      prompt: 'Your turn - clear it and tap the same three chords yourself, in order, using the chips below.',
      setup: function (state) { return MiniCompose.clearProgression(state); },
      check: function (state) { return checkRomanShape(state, ['I', 'IV', 'V']); }
    },
    {
      id: 'ii-v-i',
      kind: 'build',
      title: 'Build ii-V-I',
      intro: function (state) {
        return 'Now a jazzier move: ii-V-I - the backbone of a huge chunk of jazz and pop turnarounds. Still in ' + state.key + ' ' + state.mode + '.';
      },
      demoActions: function (state) {
        var d = MiniCompose.diatonicChoices(state);
        return [
          { type: 'clearProgression' },
          { type: 'addChord', chord: d[1].chord },
          { type: 'addChord', chord: d[4].chord },
          { type: 'addChord', chord: d[0].chord }
        ];
      },
      prompt: 'Your turn - clear it and build ii-V-I yourself.',
      setup: function (state) { return MiniCompose.clearProgression(state); },
      check: function (state) { return checkRomanShape(state, ['ii', 'V', 'I']); }
    }
  ];

  // ---- wave 3: identify-the-scale challenges (soloing) --------------------
  var identifyChallenges = [
    {
      id: 'solo-over-it',
      kind: 'identify',
      title: 'Solo over your progression',
      intro: function (state) {
        return 'Now let\'s use what you built. To solo over ' + MiniCompose.romanNumerals(state).join('-') + ' in ' + state.key + ' ' + state.mode + ', you need the ONE scale that fits every chord in it.';
      },
      // no state change - just a beat before the question, so the widget's
      // existing progression reads as "the thing we're about to solo over"
      demoActions: function () { return [{ type: 'highlight' }]; },
      question: 'Which scale solos over this?',
      options: function (state) {
        var neighbors = Circle.neighbors(state.key, state.mode);
        var wrong1 = neighbors[0]; // a fifth up - close but not it
        var wrong2 = neighbors[2]; // the relative - plausible-sounding distractor
        return [
          scaleOption(state.key, state.mode),
          scaleOption(wrong1.root, wrong1.mode),
          scaleOption(wrong2.root, wrong2.mode)
        ];
      },
      correct: function (state) { return { root: state.key, mode: state.mode }; },
      check: function (state, chosenId) {
        var c = this.correct(state);
        return checkScaleChoice(chosenId, c.root, c.mode);
      }
    },
    {
      id: 'transpose-and-solo',
      kind: 'identify',
      title: 'Transpose and solo again',
      intro: function (state) {
        return 'Progressions move. Let\'s transpose this up a whole step and see what happens to the solo scale.';
      },
      demoActions: function () { return [{ type: 'transpose', semitones: 2 }]; },
      question: function (state) { return 'It moved to ' + state.key + ' ' + state.mode + '. Which scale solos over it now?'; },
      options: function (state) {
        var neighbors = Circle.neighbors(state.key, state.mode);
        return [
          scaleOption(state.key, state.mode),
          scaleOption(neighbors[1].root, neighbors[1].mode), // a fifth down
          scaleOption(neighbors[2].root, neighbors[2].mode)  // the relative
        ];
      },
      correct: function (state) { return { root: state.key, mode: state.mode }; },
      check: function (state, chosenId) {
        var c = this.correct(state);
        return checkScaleChoice(chosenId, c.root, c.mode);
      }
    },
    {
      id: 'solo-over-track',
      kind: 'identify',
      title: 'Solo over a backing track',
      intro: function () {
        return 'Now let\'s drop a backing track under it - less visual scaffolding to lean on, same question.';
      },
      demoActions: function (state) { return [{ type: 'selectTrack', track: 'YouTube (mock): jam in ' + state.key + ' ' + state.mode }]; },
      question: function (state) { return 'Track\'s rolling in ' + state.key + ' ' + state.mode + ' - which scale do you solo with?'; },
      options: function (state) {
        var neighbors = Circle.neighbors(state.key, state.mode);
        return [
          scaleOption(state.key, state.mode),
          scaleOption(neighbors[0].root, neighbors[0].mode),
          scaleOption(neighbors[1].root, neighbors[1].mode)
        ];
      },
      correct: function (state) { return { root: state.key, mode: state.mode }; },
      check: function (state, chosenId) {
        var c = this.correct(state);
        return checkScaleChoice(chosenId, c.root, c.mode);
      }
    },
    {
      id: 'relative-swap-solo',
      kind: 'identify',
      title: 'Swap to the relative minor and solo again',
      intro: function (state) {
        var rel = Circle.relativeMinor(state.key);
        return 'Here\'s the wild part: same chords, but if I call this key ' + rel + ' minor instead of ' + state.key + ' ' + state.mode + ', the SAME notes still fit - because ' + rel + ' minor is ' + state.key + '\'s relative minor. Watch: the chords don\'t move.';
      },
      demoActions: function (state) { return [{ type: 'reinterpretKey', root: Circle.relativeMinor(state.key), mode: 'minor' }]; },
      question: function (state) { return 'Which scale ALSO solos over these same chords, using the exact same notes as before?'; },
      options: function (state) {
        // state.key is now the relative minor (reinterpretKey already ran by
        // the time options() is called - see runner ordering). The correct
        // answer IS the current key; the major key we started from ("its
        // relative major") is the natural, non-throwaway distractor.
        var relMajor = Circle.relativeMajor(state.key);
        var aFifthUp = Circle.neighbors(state.key, 'minor')[0];
        return [
          scaleOption(state.key, state.mode),
          scaleOption(relMajor, 'major'),
          scaleOption(aFifthUp.root, aFifthUp.mode)
        ];
      },
      correct: function (state) { return { root: state.key, mode: state.mode }; },
      check: function (state, chosenId) {
        var c = this.correct(state);
        return checkScaleChoice(chosenId, c.root, c.mode);
      }
    }
  ];

  var CHALLENGES = buildChallenges.concat(identifyChallenges);

  function byId(id) {
    for (var i = 0; i < CHALLENGES.length; i++) { if (CHALLENGES[i].id === id) return CHALLENGES[i]; }
    return null;
  }

  return {
    CHALLENGES: CHALLENGES,
    byId: byId,
    checkRomanShape: checkRomanShape,
    checkScaleChoice: checkScaleChoice,
    scaleLabel: scaleLabel,
    scaleOptionId: scaleOptionId,
    REFLECTION_OPTIONS: REFLECTION_OPTIONS,
    REFLECTION_RESPONSES: REFLECTION_RESPONSES,
    REFLECTION_PROMPT: REFLECTION_PROMPT
  };
});
