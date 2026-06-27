/* Tuning profile: 5-string Banjo, open-G gDGBD (D3 G3 B3 D4 + g4 drone). Pure data; self-registers.
 *
 * Standard 5-string banjo open-G tuning. The 5th string is a short high-G
 * drone (g4 = 392 Hz), conventionally fretted from fret 5 upward but most
 * often played open as a ringing pedal tone.
 *
 * Display ordering note: strings here are listed by PITCH (low -> high), so
 * the 5th-string drone shows on the RIGHT side of the chord diagram. Most
 * printed banjo tab puts the drone on the left (player's-eye view of the
 * physical layout). The engine convention is "fret-array order = left ->
 * right on diagram = low -> high pitch," so I've kept the consistent
 * pitch-order ordering here. If the drone-on-right reading is awkward in
 * preview we can flip it; it's a display-only change.
 *
 * Top 4 strings (D G B D) match the Open-G guitar top 4 / Cigar Box DGBD,
 * so the chord shapes for those 4 are identical. The drone (5th) rings open
 * when the chord contains a G (it's the chord tone) and is muted otherwise. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["banjo-gdgbd"] = {
    id: "banjo-gdgbd",
    label: "Banjo - gDGBD",
    instrument: "banjo",
    tuning: "gDGBD",
    // display order = fret-array order, low D (4th) -> high D (1st) -> g drone (5th), left -> right
    strings: [
      { n: "D", l: "4th string (low D)", f: 146.83 },
      { n: "G", l: "3rd string",         f: 196.00 },
      { n: "B", l: "2nd string",         f: 246.94 },
      { n: "D", l: "1st string (high D)", f: 293.66 },
      { n: "G", l: "5th string (drone g)", f: 392.00 }
    ],
    // chord name -> fret per string [D, G, B, D, g]; -1 = muted, 0 = open.
    // Drone (5th) rings open (0) when G is a chord tone, else muted (-1).
    chords: {
      // --- majors ---
      G: [0, 0, 0, 0, 0],         // signature open-G banjo: all 5 strings ring
      A: [2, 2, 2, 2, -1],
      Bb: [3, 3, 3, 3, -1],
      B: [4, 4, 4, 4, -1],
      C: [5, 5, 5, 5, 0],         // G is the 5th of C
      D: [7, 7, 7, 7, -1],
      E: [9, 9, 9, 9, -1],
      F: [10, 10, 10, 10, -1],
      "F#": [11, 11, 11, 11, -1],

      // --- minors ---
      Em: [2, 0, 0, 2, 0],        // G is the minor 3rd of Em
      "F#m": [4, 2, 2, 4, -1],
      Gm: [5, 3, 3, 5, 0],        // G is the root
      Am: [2, 2, 1, 2, -1],
      Bbm: [3, 3, 2, 3, -1],
      Bm: [4, 4, 3, 4, -1],
      "C#m": [6, 6, 5, 6, -1],
      Dm: [7, 7, 6, 7, -1],
      Cm: [-1, 5, 4, 5, -1],
      Fm: [3, 1, 1, 3, -1],

      // --- dominant 7ths ---
      G7: [0, 0, 0, 3, 0],        // signature open-G banjo 7
      C7: [-1, 5, 5, 8, 0],       // G is the 5th of C7
      D7: [4, 2, 1, 0, -1],
      A7: [7, 6, 5, 5, -1],
      E7: [2, 1, 0, 0, -1],
      B7: [4, 4, 4, 7, -1],
      F7: [3, 2, 1, 1, -1]
    }
  };
})(typeof window !== 'undefined' ? window : this);
