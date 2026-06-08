/* Tuning profile: Ukulele, standard GCEA (re-entrant). Pure data; self-registers. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["ukulele-gcea"] = {
    id: "ukulele-gcea",
    label: "Ukulele",
    instrument: "ukulele",
    tuning: "GCEA",
    // display order = fret-array order (left -> right on the diagram)
    strings: [
      { n: "G", l: "4th string", f: 392.00 },
      { n: "C", l: "3rd string", f: 261.63 },
      { n: "E", l: "2nd string", f: 329.63 },
      { n: "A", l: "1st string", f: 440.00 }
    ],
    // chord name -> fret per string [G, C, E, A]; 0 = open
    chords: {
      C: [0, 0, 0, 3], D: [2, 2, 2, 0], E: [4, 4, 4, 2], F: [2, 0, 1, 0], G: [0, 2, 3, 2], A: [2, 1, 0, 0], B: [4, 3, 2, 2],
      Cm: [0, 3, 3, 3], Dm: [2, 2, 1, 0], Em: [0, 4, 3, 2], Fm: [1, 0, 1, 3], Gm: [0, 2, 3, 1], Am: [2, 0, 0, 0], Bm: [4, 2, 2, 2],
      C7: [0, 0, 0, 1], D7: [2, 2, 2, 3], E7: [1, 2, 0, 2], F7: [2, 3, 1, 3], G7: [0, 2, 1, 2], A7: [0, 1, 0, 0], B7: [2, 3, 2, 2],
      Cmaj7: [0, 0, 0, 2], Dmaj7: [2, 2, 2, 4], Emaj7: [1, 3, 0, 2], Fmaj7: [2, 4, 1, 3], Gmaj7: [0, 2, 2, 2], Amaj7: [1, 1, 0, 0], Bmaj7: [3, 3, 2, 2],
      Cm7: [3, 3, 3, 3], Dm7: [2, 2, 1, 3], Em7: [0, 2, 0, 2], Fm7: [1, 3, 1, 3], Gm7: [0, 2, 1, 1], Am7: [0, 0, 0, 0], Bm7: [2, 2, 2, 2]
    }
  };
})(typeof window !== 'undefined' ? window : this);
