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
      A: [2, 2, 4, 0],
      B: [4, 1, 2, 2],
      "Bb": [3, 0, 1, 1],
      C: [0, 2, 3, 0],
      D: [2, 0, 0, 2],
      E: [1, 2, 2, 0],
      F: [2, 3, 3, 1],
      "F#": [3, 4, 4, 2],
      G: [0, 0, 2, 3],
      Am: [2, 2, 3, 0],
      Bm: [4, 0, 2, 2],
      "C#m": [1, 2, 4, 0],
      Cm: [0, 1, 3, 3],
      Dm: [2, 0, 0, 1],
      Em: [0, 2, 2, 0],
      "F#m": [2, 4, 4, 2],
      Fm: [1, 3, 3, 1],
      Gm: [0, 0, 1, 3],
      A7: [2, 2, 4, 3],
      B7: [4, 1, 0, 2],
      C7: [3, 2, 3, 3],
      D7: [2, 0, 3, 2],
      E7: [1, 0, 2, 0],
      F7: [2, 1, 3, 1],
      G7: [0, 0, 2, 1],
      Amaj7: [2, 2, 4, 4],
      Bmaj7: [4, 1, 1, 2],
      Cmaj7: [4, 2, 3, 3],
      Dmaj7: [2, 0, 4, 2],
      Emaj7: [1, 1, 2, 0],
      Fmaj7: [2, 3, 3, 0],
      Gmaj7: [0, 0, 2, 2],
      Am7: [2, 2, 3, 3],
      Bm7: [4, 0, 0, 2],
      Cm7: [3, 1, 3, 3],
      Dm7: [2, 0, 3, 1],
      Em7: [0, 0, 2, 0],
      Fm7: [1, 1, 3, 1],
      Gm7: [0, 0, 1, 1],
      // Diminished (vii°). Dim7 voicings on GDAE all-fifths tuning - the shape
      // moves up 1 fret per semitone and repeats every 3 frets (dim7 is symmetric
      // in minor thirds). F1=[2,1,3,2] (C/Eb/F#/A), F2=[3,2,4,3] (C#/E/G/Bb),
      // F3=[4,3,5,4] (D/F/G#/B).
      Cdim: [2, 1, 3, 2], "D#dim": [2, 1, 3, 2], Ebdim: [2, 1, 3, 2], "F#dim": [2, 1, 3, 2], Gbdim: [2, 1, 3, 2], Adim: [2, 1, 3, 2],
      "C#dim": [3, 2, 4, 3], Dbdim: [3, 2, 4, 3], Edim: [3, 2, 4, 3], Gdim: [3, 2, 4, 3], "A#dim": [3, 2, 4, 3], Bbdim: [3, 2, 4, 3],
      Ddim: [4, 3, 5, 4], Fdim: [4, 3, 5, 4], "G#dim": [4, 3, 5, 4], Abdim: [4, 3, 5, 4], Bdim: [4, 3, 5, 4]
    }
  };
})(typeof window !== 'undefined' ? window : this);
