/* Tuning profile: Mandolin, standard GDAE (tuned in fifths, like a violin). Pure data; self-registers. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["mandolin-gdae"] = {
    id: "mandolin-gdae",
    label: "Mandolin",
    instrument: "mandolin",
    tuning: "GDAE",
    // display order = fret-array order (left -> right on the diagram), low -> high
    strings: [
      { n: "G", l: "4th string (low G)", f: 196.00 },
      { n: "D", l: "3rd string", f: 293.66 },
      { n: "A", l: "2nd string", f: 440.00 },
      { n: "E", l: "1st string (high E)", f: 659.25 }
    ],
    // chord name -> fret per string [G, D, A, E]; -1 = muted, 0 = open, n = fret.
    // GDAE is all-fifths tuning, so shapes differ from guitar/ukulele.
    // Every voicing below was verified to contain exactly the chord tones.
    chords: {
      // --- major triads ---
      A: [2, 2, 4, 5], B: [4, 4, 6, 7], Bb: [3, 3, 5, 6], C: [0, 2, 3, 3],
      D: [2, 0, 0, 2], E: [1, 2, 2, 4], F: [5, 3, 0, 1], "F#": [6, 4, 1, 2], G: [0, 0, 2, 3],
      // --- minor triads ---
      Am: [2, 2, 3, 5], Bm: [4, 4, 5, 7], "C#m": [6, 6, 7, 9], Cm: [5, 5, 6, 8],
      Dm: [2, 0, 0, 1], Em: [0, 2, 2, 0], "F#m": [2, 4, 4, 2], Fm: [1, 3, 3, 1], Gm: [0, 0, 1, 3],
      // --- dominant 7 ---
      A7: [2, 2, 4, 3], B7: [4, 4, 6, 5], C7: [5, 2, 1, 3], D7: [2, 0, 3, 2],
      E7: [1, 0, 2, 0], F7: [2, 1, 3, 1], G7: [0, 0, 2, 1],
      // --- major 7 ---
      Amaj7: [2, 2, 4, 4], Bmaj7: [4, 4, 6, 6], Cmaj7: [5, 2, 2, 3], Dmaj7: [7, 4, 4, 5],
      Emaj7: [1, 1, 2, 0], Fmaj7: [2, 3, 3, 0], Gmaj7: [0, 0, 2, 2],
      // --- minor 7 ---
      Am7: [2, 2, 3, 3], Bm7: [4, 4, 5, 5], Cm7: [5, 5, 6, 6], Dm7: [2, 0, 3, 1],
      Em7: [0, 0, 2, 0], Fm7: [1, 1, 3, 1], Gm7: [0, 0, 1, 1]
    }
  };
})(typeof window !== 'undefined' ? window : this);
