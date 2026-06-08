/* Tuning profile: Mandola, standard CGDA (fifths). Pure data; self-registers.
   Mandola is tuned a perfect fifth below the mandolin (GDAE), so its strings
   are all perfect fifths apart - C3 G3 D4 A4 low->high. Chord shapes mirror
   mandolin shapes shifted for the fifth-lower tuning (viola vs violin). */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["mandola-cgda"] = {
    id: "mandola-cgda",
    label: "Mandola",
    instrument: "mandola",
    tuning: "CGDA",
    // display order = fret-array order (left -> right on the diagram, low string first)
    strings: [
      { n: "C", l: "4th string (low C)", f: 130.81 },
      { n: "G", l: "3rd string", f: 196.00 },
      { n: "D", l: "2nd string", f: 293.66 },
      { n: "A", l: "1st string (high A)", f: 440.00 }
    ],
    // chord name -> fret per string [C, G, D, A]; -1 = muted, 0 = open, n = fret.
    // All voicings ring on all four strings, verified to contain exactly the
    // chord tones (dominant-7th shapes may omit the 5th - standard practice).
    chords: {
      // --- majors ---
      A:  [1, 2, 2, 0], B:  [3, 4, 4, 2], Bb: [2, 3, 3, 1], C:  [0, 0, 2, 3],
      "C#": [1, 1, 3, 4], D:  [2, 2, 4, 0], E:  [4, 1, 2, 2], F:  [0, 2, 3, 0],
      "F#": [1, 3, 4, 1], G:  [2, 0, 0, 2],
      // --- minors ---
      Am: [0, 2, 2, 0], Bm: [2, 4, 4, 2], Bbm: [1, 3, 3, 1], Cm: [0, 0, 1, 3],
      "C#m": [1, 1, 2, 4], Dm: [2, 2, 3, 0], Em: [4, 0, 2, 2], Fm: [0, 1, 3, 3],
      "F#m": [1, 2, 4, 0], Gm: [2, 0, 0, 1],
      // --- dominant 7ths (some omit the 5th, standard) ---
      A7: [1, 0, 2, 0], B7: [3, 2, 1, 2], C7: [0, 0, 2, 1], D7: [2, 2, 4, 3],
      E7: [2, 1, 2, 2], F7: [3, 2, 3, 3], G7: [2, 0, 3, 2],
      // --- major 7ths ---
      Cmaj7: [0, 0, 2, 2], Dmaj7: [2, 2, 4, 4], Emaj7: [3, 1, 2, 2],
      Fmaj7: [4, 2, 3, 3], Gmaj7: [2, 0, 4, 2], Amaj7: [1, 1, 2, 0],
      Bmaj7: [3, 3, 1, 2],
      // --- minor 7ths (some omit the 5th, standard) ---
      Am7: [0, 0, 2, 0], Bm7: [2, 2, 0, 2], Cm7: [0, 0, 1, 1], Dm7: [2, 2, 3, 3],
      Em7: [2, 0, 2, 2], Fm7: [3, 1, 3, 3], Gm7: [2, 0, 3, 1]
    }
  };
})(typeof window !== 'undefined' ? window : this);
