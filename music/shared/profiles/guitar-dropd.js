/* Tuning profile: Guitar, Drop D (DADGBE). Pure data; self-registers.
 * Drop D drops ONLY the 6th string a whole step (E2 -> D2); strings 5-1 are
 * standard EADGBE. So for every chord, strings 5-1 keep their standard shape;
 * only the 6th-string fret changes:
 *   - standard muted (-1)  -> stays muted (-1)
 *   - standard open  (E)   -> fret 2 to keep the E note (Drop-D open 6th = D)
 *   - standard fret n      -> fret n+2 to keep the same note (string is 2 semis lower)
 * The Drop-D wins: D / Dm / D7 take a ringing low open D on the 6th string. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["guitar-dropd"] = {
    id: "guitar-dropd",
    label: "Guitar - Drop D",
    instrument: "guitar",
    tuning: "DADGBE",
    // display order = fret-array order, low D (6th) -> high E (1st), left -> right
    strings: [
      { n: "D", l: "6th string (low D)", f: 73.42 },
      { n: "A", l: "5th string", f: 110.00 },
      { n: "D", l: "4th string", f: 146.83 },
      { n: "G", l: "3rd string", f: 196.00 },
      { n: "B", l: "2nd string", f: 246.94 },
      { n: "E", l: "1st string (high E)", f: 329.63 }
    ],
    // chord name -> fret per string [D, A, D, G, B, E]; -1 = muted, 0 = open.
    // 6th-string frets corrected for Drop D per the rule in the header comment.
    chords: {
      // --- the open/core triads ---
      // D/Dm/D7 exploit the low open D (Drop-D signature); 6th open = root.
      C: [-1, 3, 2, 0, 1, 0], D: [0, 0, 0, 2, 3, 2], E: [2, 2, 2, 1, 0, 0],
      F: [3, 3, 3, 2, 1, 1], G: [5, 2, 0, 0, 3, 3], A: [-1, 0, 2, 2, 2, 0], B: [-1, 2, 4, 4, 4, 2],
      Cm: [-1, 3, 5, 5, 4, 3], Dm: [0, 0, 0, 2, 3, 1], Em: [2, 2, 2, 0, 0, 0],
      Fm: [3, 3, 3, 1, 1, 1], Gm: [5, 5, 5, 3, 3, 3], Am: [-1, 0, 2, 2, 1, 0], Bm: [-1, 2, 4, 4, 3, 2],
      // --- dominant 7ths ---
      C7: [-1, 3, 2, 3, 1, 0], D7: [0, 0, 0, 2, 1, 2], E7: [2, 2, 0, 1, 0, 0],
      F7: [3, 3, 1, 2, 1, 1], G7: [5, 2, 0, 0, 0, 1], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
      // --- major 7ths ---
      Cmaj7: [-1, 3, 2, 0, 0, 0], Dmaj7: [0, 0, 0, 2, 2, 2], Emaj7: [2, 2, 1, 1, 0, 0],
      Fmaj7: [3, -1, 2, 2, 1, 0], Gmaj7: [5, 2, 0, 0, 0, 2], Amaj7: [-1, 0, 2, 1, 2, 0], Bmaj7: [-1, 2, 4, 3, 4, 2],
      // --- minor 7ths ---
      Cm7: [-1, 3, 5, 3, 4, 3], Dm7: [0, 0, 0, 2, 1, 1], Em7: [2, 2, 0, 0, 0, 0],
      Fm7: [3, 3, 1, 1, 1, 1], Gm7: [5, 5, 3, 3, 3, 3], Am7: [-1, 0, 2, 0, 1, 0], Bm7: [-1, 2, 0, 2, 0, 2],
      // --- sharps/flats + the rest of the catalog set ---
      Bb: [-1, 1, 3, 3, 3, 1], "C#m": [-1, 4, 6, 6, 5, 4], "F#": [4, 4, 4, 3, 2, 2], "F#m": [4, 4, 4, 2, 2, 2],
      Ab: [6, 6, 6, 5, 4, 4], Bbm: [-1, 1, 3, 3, 2, 1], Db: [-1, 4, 6, 6, 6, 4], Eb: [-1, 6, 8, 8, 8, 6],
      "F#7": [4, 4, 2, 3, 2, 2], "G#m": [6, 6, 6, 4, 4, 4]
    }
  };
})(typeof window !== 'undefined' ? window : this);
