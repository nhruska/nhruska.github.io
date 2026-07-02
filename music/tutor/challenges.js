/* =====================================================================
 * challenges.js  -  AI Tutor prototype, wave 2: scripted microlearning
 * scenarios that drive music/tutor/mini-compose.js. Pure logic, no DOM -
 * Node-testable (test/challenges.test.js) and browser-usable
 * (window.TutorChallenges).
 *
 * A challenge is: intro text -> a sequence of demo actions the AI performs
 * on the widget (paced, not instant) -> a "your turn" prompt -> the human
 * drives the SAME widget -> a pure checker(state) -> {pass, message}.
 *
 * Depth over breadth (per TUTOR-PROTOTYPE-CHECKLIST.md's carried-forward
 * priority): 2 challenges, not a library.
 * ===================================================================== */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('../shared/circle.js'), require('./mini-compose.js'));
  } else {
    global.TutorChallenges = factory(global.Circle, global.MiniCompose);
  }
})(typeof window !== 'undefined' ? window : this, function (Circle, MiniCompose) {
  'use strict';

  // Compare the roman-numeral shape of the built progression against a target
  // (e.g. ['I','IV','V']), case-sensitive (case encodes major/minor quality).
  function checkRomanShape(state, targetRomans) {
    if (state.progression.length !== targetRomans.length) {
      return { pass: false, message: 'That\'s ' + state.progression.length + ' chord' + (state.progression.length === 1 ? '' : 's') + ' - I\'m looking for ' + targetRomans.length + ' (' + targetRomans.join('-') + ').' };
    }
    var romans = MiniCompose.romanNumerals(state);
    var matches = romans.every(function (r, i) { return r === targetRomans[i]; });
    if (matches) return { pass: true, message: 'That\'s it - ' + romans.join('-') + ' in ' + state.key + ' ' + state.mode + '. Nice.' };
    return { pass: false, message: 'Close, but that reads as ' + romans.join('-') + ' - I\'m looking for ' + targetRomans.join('-') + '.' };
  }

  var CHALLENGES = [
    {
      id: 'i-iv-v',
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

  function byId(id) {
    for (var i = 0; i < CHALLENGES.length; i++) { if (CHALLENGES[i].id === id) return CHALLENGES[i]; }
    return null;
  }

  return {
    CHALLENGES: CHALLENGES,
    byId: byId,
    checkRomanShape: checkRomanShape
  };
});
