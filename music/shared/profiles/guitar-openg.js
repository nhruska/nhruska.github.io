/* Tuning profile: Guitar, Open G (DGDGBD). Pure data; self-registers.
   The open strings sound a G major chord (D G D G B D), so G is all-open and
   every major chord is a single barre across all six strings at the root fret.
   This is the classic slide / Keith-Richards tuning. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["guitar-openg"] = {
    id: "guitar-openg",
    label: "Guitar - Open G",
    instrument: "guitar",
    tuning: "DGDGBD",
    // display order = fret-array order, low D (6th) -> high D (1st), left -> right
    strings: [
      { n: "D", l: "6th string (low D)", f: 73.42 },
      { n: "G", l: "5th string", f: 98.00 },
      { n: "D", l: "4th string", f: 146.83 },
      { n: "G", l: "3rd string", f: 196.00 },
      { n: "B", l: "2nd string", f: 246.94 },
      { n: "D", l: "1st string (high D)", f: 293.66 }
    ],
    // chord name -> fret per string [D, G, D, G, B, D]; -1 = muted, 0 = open.
    // Majors: open strings already = G, so a major chord is a full barre at the
    //   root's fret (G@0, A@2, Bb@3, B@4, C@5, D@7, E@9, F@10, F#@11).
    // Minors: the major 3rd sits on the B (2nd) string for the barre, so a minor
    //   is the same barre with that string pulled back one fret to flat the 3rd.
    chords: {
      // --- majors (full barre across all 6 strings) ---
      G: [0, 0, 0, 0, 0, 0],            // D G D G B D  (the open tuning itself)
      A: [2, 2, 2, 2, 2, 2],            // E A E A C# E
      Bb: [3, 3, 3, 3, 3, 3],           // F A# F A# D F
      B: [4, 4, 4, 4, 4, 4],            // F# B F# B D# F#
      C: [5, 5, 5, 5, 5, 5],            // G C G C E G
      D: [7, 7, 7, 7, 7, 7],            // A D A D F# A
      E: [9, 9, 9, 9, 9, 9],            // B E B E G# B
      F: [10, 10, 10, 10, 10, 10],      // C F C F A C
      "F#": [11, 11, 11, 11, 11, 11],   // C# F# C# F# A# C#

      // --- minors (root-fret barre with the B-string 3rd flatted one fret) ---
      Am: [-1, 2, 2, 2, 1, 2],          // A E A C E   (mute low D so root is in bass)
      Bbm: [-1, 3, 3, 3, 2, 3],         // A# F A# C# F
      Bm: [-1, 4, 4, 4, 3, 4],          // B F# B D F#
      "C#m": [-1, 6, 6, 6, 5, 6],       // C# G# C# E G#
      Dm: [-1, 7, 7, 7, 6, 7],          // D A D F A
      Em: [2, 0, 2, 0, 0, 2],           // E G E G B E  (open-friendly voicing)
      "F#m": [4, 2, 4, 2, 2, 4],        // F# A F# A C# F#

      // --- dominant 7ths (bonus; not in the catalog except E7, but natural here) ---
      G7: [0, 0, 0, 0, 0, 3],           // D G D G B F   (the signature Open-G 7)
      A7: [-1, 2, 2, 0, 2, 2],          // A E G C# E
      C7: [-1, 5, 2, 3, 5, 5],          // C E A# E G
      D7: [0, 2, 4, 2, 1, 0],           // D A F# A C D
      E7: [2, 1, 0, 1, 0, 0]            // E G# D G# B D
    }
  };
})(typeof window !== 'undefined' ? window : this);
