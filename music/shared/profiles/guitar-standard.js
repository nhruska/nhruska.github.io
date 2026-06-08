/* Tuning profile: Guitar, standard EADGBE. Pure data; self-registers. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["guitar-standard"] = {
    id: "guitar-standard",
    label: "Guitar - Standard",
    instrument: "guitar",
    tuning: "EADGBE",
    // display order = fret-array order, low E (6th) -> high E (1st), left -> right
    strings: [
      { n: "E", l: "6th string (low E)", f: 82.41 },
      { n: "A", l: "5th string", f: 110.00 },
      { n: "D", l: "4th string", f: 146.83 },
      { n: "G", l: "3rd string", f: 196.00 },
      { n: "B", l: "2nd string", f: 246.94 },
      { n: "E", l: "1st string (high E)", f: 329.63 }
    ],
    // chord name -> fret per string [E, A, D, G, B, E]; -1 = muted, 0 = open
    chords: {
      C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0],
      F: [1, 3, 3, 2, 1, 1], G: [3, 2, 0, 0, 3, 3], A: [-1, 0, 2, 2, 2, 0], B: [-1, 2, 4, 4, 4, 2],
      Cm: [-1, 3, 5, 5, 4, 3], Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0],
      Fm: [1, 3, 3, 1, 1, 1], Gm: [3, 5, 5, 3, 3, 3], Am: [-1, 0, 2, 2, 1, 0], Bm: [-1, 2, 4, 4, 3, 2],
      C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], E7: [0, 2, 0, 1, 0, 0],
      F7: [1, 3, 1, 2, 1, 1], G7: [3, 2, 0, 0, 0, 1], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
      Cmaj7: [-1, 3, 2, 0, 0, 0], Dmaj7: [-1, -1, 0, 2, 2, 2], Emaj7: [0, 2, 1, 1, 0, 0],
      Fmaj7: [1, -1, 2, 2, 1, 0], Gmaj7: [3, 2, 0, 0, 0, 2], Amaj7: [-1, 0, 2, 1, 2, 0], Bmaj7: [-1, 2, 4, 3, 4, 2],
      Cm7: [-1, 3, 5, 3, 4, 3], Dm7: [-1, -1, 0, 2, 1, 1], Em7: [0, 2, 0, 0, 0, 0],
      Fm7: [1, 3, 1, 1, 1, 1], Gm7: [3, 5, 3, 3, 3, 3], Am7: [-1, 0, 2, 0, 1, 0], Bm7: [-1, 2, 0, 2, 0, 2],
      Bb: [-1, 1, 3, 3, 3, 1], "C#m": [-1, 4, 6, 6, 5, 4], "F#": [2, 4, 4, 3, 2, 2], "F#m": [2, 4, 4, 2, 2, 2],
      Ab: [4, 6, 6, 5, 4, 4], Bbm: [-1, 1, 3, 3, 2, 1], Db: [-1, 4, 6, 6, 6, 4], Eb: [-1, 6, 8, 8, 8, 6],
      "F#7": [2, 4, 2, 3, 2, 2], "G#m": [4, 6, 6, 4, 4, 4]
    }
  };
})(typeof window !== 'undefined' ? window : this);
