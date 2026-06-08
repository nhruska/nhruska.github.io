/* Tuning profile: Guitar, DADGAD (modal D). Pure data; self-registers.
   DADGAD = D A D G A D (low->high). The open strings are NOT a triad, so its
   chord shapes are entirely different from standard EADGBE - they lean on the
   D/A/D drones where they fit and fall back to fretted voicings where they
   don't. Every shape below is a full triad (root+third+fifth) with the root in
   the bass; E7 adds the b7 (D). See the README for the schema contract. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["guitar-dadgad"] = {
    id: "guitar-dadgad",
    label: "Guitar - DADGAD",
    instrument: "guitar",
    tuning: "DADGAD",
    // display order = fret-array order, low D (6th) -> high D (1st), left -> right
    strings: [
      { n: "D", l: "6th string (low D)", f: 73.42 },
      { n: "A", l: "5th string", f: 110.00 },
      { n: "D", l: "4th string", f: 146.83 },
      { n: "G", l: "3rd string", f: 196.00 },
      { n: "A", l: "2nd string", f: 220.00 },
      { n: "D", l: "1st string (high D)", f: 293.66 }
    ],
    // chord name -> fret per string [D, A, D, G, A, D]; -1 = muted, 0 = open.
    // All shapes verified to contain the full triad with the root in the bass.
    chords: {
      // --- D family: the DADGAD home turf, drone-rich open shapes ---
      D:   [0, 0, 4, 2, 0, 0],   // D A F# A A D  (full D major; F# on the 4th string)
      Dm:  [0, 0, 0, 2, 0, 3],   // D A D A A F   (open drones + F on top)
      // --- E family ---
      E:   [2, 2, 2, 1, 2, 2],   // E B E G# B E
      Em:  [2, 2, 2, 0, 2, 2],   // E B E G  B E  (open G string is the minor 3rd)
      E7:  [2, 2, 0, 1, 2, 0],   // E B D G# B D  (open D strings supply the b7)
      // --- G: open drones ---
      G:   [5, 2, 0, 0, 2, 0],   // G B D G  B D  (open D/G drones)
      // --- A family: root doesn't sit on a drone, so fretted ---
      A:   [7, 0, 7, 6, 7, 7],   // A A A C# E A
      Am:  [7, 0, 7, 5, 7, 7],   // A A A C  E A
      // --- B family ---
      B:   [9, 9, 9, 8, 9, 9],   // B F# B D# F# B
      Bm:  [9, 9, 0, 7, 9, 0],   // B F# D D F# D  (open D drones give the minor 3rd)
      Bb:  [8, 8, 0, 7, 8, 0],   // A# F D D F D
      // --- C ---
      C:   [10, 10, 10, 9, 10, 10], // C G C E G C
      "C#m": [11, 11, 11, 9, 11, 11], // C# G# C# E G# C#
      // --- F family ---
      F:   [3, 0, 3, 5, 0, 3],   // F A F C A F
      "F#":  [4, 4, 4, 3, 4, 4],   // F# C# F# A# C# F#
      "F#m": [4, 0, 4, 6, 0, 4]    // F# A F# C# A F#  (open A drones = minor 3rd)
    }
  };
})(typeof window !== 'undefined' ? window : this);
