/* Tuning profile: 4-string Cigar Box, open-G DGBD (D3 G3 B3 D4). Pure data; self-registers.
 *
 * Same intervals as the top 4 strings of an Open-G guitar (DGBD), so every
 * major chord is a single barre across all 4 strings at the root's fret
 * (G@0, A@2, Bb@3, B@4, C@5, D@7, E@9, F@10, F#@11). Minors flat the third
 * on the B (2nd) string by one fret. Voicings here were verified to contain
 * the chord tones; partial voicings (no root in the 4 strings) were omitted
 * in favor of name-only fallback for clarity. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["cigarbox-dgbd"] = {
    id: "cigarbox-dgbd",
    label: "Cigar Box - DGBD",
    instrument: "cigarbox",
    tuning: "DGBD",
    // display order = fret-array order, low D (4th) -> high D (1st), left -> right
    strings: [
      { n: "D", l: "4th string (low D)", f: 146.83 },
      { n: "G", l: "3rd string",         f: 196.00 },
      { n: "B", l: "2nd string",         f: 246.94 },
      { n: "D", l: "1st string (high D)", f: 293.66 }
    ],
    // chord name -> fret per string [D, G, B, D]; -1 = muted, 0 = open.
    chords: {
      // --- majors (full barre across all 4 strings at root's fret) ---
      G: [0, 0, 0, 0],         // D G B D (open) = G major
      A: [2, 2, 2, 2],         // E A C# E
      Bb: [3, 3, 3, 3],
      B: [4, 4, 4, 4],
      C: [5, 5, 5, 5],
      D: [7, 7, 7, 7],
      E: [9, 9, 9, 9],
      F: [10, 10, 10, 10],
      "F#": [11, 11, 11, 11],

      // --- minors (root-fret barre with the B-string 3rd flatted one fret) ---
      Em: [2, 0, 0, 2],        // E G B E (open-position minor)
      "F#m": [4, 2, 2, 4],
      Gm: [5, 3, 3, 5],
      Am: [2, 2, 1, 2],
      Bbm: [3, 3, 2, 3],
      Bm: [4, 4, 3, 4],
      "C#m": [6, 6, 5, 6],
      Dm: [7, 7, 6, 7],
      Cm: [-1, 5, 4, 5],       // low string muted; C Eb G
      Fm: [3, 1, 1, 3],        // F Ab C F

      // --- dominant 7ths (verified to contain root, 3rd, b7) ---
      G7: [0, 0, 0, 3],        // D G B F = open-G signature 7
      D7: [4, 2, 1, 0],        // F# A C D
      A7: [7, 6, 5, 5],        // A C# E G
      E7: [2, 1, 0, 0],        // E G# B D
      C7: [-1, 5, 5, 8],       // C E Bb (no 5th; partial)
      B7: [4, 4, 4, 7],        // F# B D# A
      F7: [3, 2, 1, 1]         // F A C Eb
    }
  };
})(typeof window !== 'undefined' ? window : this);
