/* Dump the app's full theory surface for adversarial review (mission tool).
 * All 48 root x mode contexts: scale spelling, diatonic chords, roman labels.
 * Run: node music/dev/theory-dossier.js > /tmp/dossier.txt */
'use strict';
var S = require('../shared/songbook.js');
var C = require('../shared/circle.js');
var ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var MODES = ['Major', 'Minor', 'Mixolydian', 'Dorian'];
ROOTS.forEach(function (r) {
  MODES.forEach(function (m) {
    var scale = C.spellScale(r, m.toLowerCase());
    var chords = S.chordsFromDegrees(r, m, [0, 1, 2, 3, 4, 5, 6]);
    var romans = chords.map(function (c) { return S.romanInKey(c, r, m); });
    console.log(r + ' ' + m + ' | scale: ' + scale.join(' ') + ' | chords: ' + chords.join(' ') + ' | romans: ' + romans.join(' '));
  });
});
// the two roman conventions in one probe: D major chord against E-major vs E-mixolydian
console.log('CONVENTION PROBE | D in E Major (borrowed): ' + S.romanInKey('D', 'E', 'Major') + ' | D in E Mixolydian (diatonic): ' + S.romanInKey('D', 'E', 'Mixolydian'));
console.log('CONVENTION PROBE | Am in G Major: ' + S.romanInKey('Am', 'G', 'Major') + ' | F in G Major (borrowed bVII): ' + S.romanInKey('F', 'G', 'Major'));
