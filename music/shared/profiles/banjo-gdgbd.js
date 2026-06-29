/* Tuning profile: 5-string Banjo, open-G gDGBD (g4 drone + D3 G3 B3 D4). Pure data; self-registers.
 *
 * Standard 5-string banjo open-G tuning. The 5th string is a short high-G
 * drone (g4 = 392 Hz), conventionally fretted from fret 5 upward but most
 * often played open as a ringing pedal tone.
 *
 * Display ordering: strings are listed in PHYSICAL-LAYOUT order to match
 * printed banjo tab - the 5th-string drone is on the LEFT of the chord
 * diagram, then 4th (low D), 3rd (G), 2nd (B), 1st (high D). This breaks
 * the engine's "low -> high pitch" convention but matches how every banjo
 * player reads chord shapes.
 *
 * Top 4 strings (D G B D) match the Open-G guitar top 4 / Cigar Box DGBD,
 * so the chord shapes for those 4 are identical (just shifted by one index
 * since the drone takes column 0). The drone rings open when the chord
 * contains a G (it's the chord tone) and is muted otherwise.
 *
 * HSR-by-design (DO NOT "fix" to open position):
 * Majors are a single barre across the top 4 strings at the root's fret
 * (G@0, A@2, Bb@3, B@4, C@5, D@7, E@9, F@10, F#@11). Minors are the same
 * barre with the B-string flatted one fret. Dominant 7ths share the same
 * shape too. This is intentional - the shapes teach Horizontal Shape
 * Relationships (HSR): one moveable shape, root-fret = chord. A future
 * Claude looking at these and wanting to swap to "idiomatic open-position"
 * voicings: don't. The HSR teaching value beats the open-position
 * familiarity for this profile. */
(function (g) {
  g.MusicProfiles = g.MusicProfiles || {};
  g.MusicProfiles["banjo-gdgbd"] = {
    id: "banjo-gdgbd",
    label: "Banjo - gDGBD",
    instrument: "banjo",
    tuning: "gDGBD",
    // display order = fret-array order, drone -> 4th -> 1st, left -> right (physical layout)
    strings: [
      { n: "G", l: "5th string (drone g)", f: 392.00 },
      { n: "D", l: "4th string (low D)",   f: 146.83 },
      { n: "G", l: "3rd string",           f: 196.00 },
      { n: "B", l: "2nd string",           f: 246.94 },
      { n: "D", l: "1st string (high D)",  f: 293.66 }
    ],
    // chord name -> fret per string [g, D, G, B, D]; -1 = muted, 0 = open.
    // Drone (5th) rings open (0) when G is a chord tone, else muted (-1).
    chords: {
      // --- majors ---
      G: [0, 0, 0, 0, 0],         // signature open-G banjo: all 5 strings ring
      A: [-1, 2, 2, 2, 2],
      Bb: [-1, 3, 3, 3, 3],
      B: [-1, 4, 4, 4, 4],
      C: [0, 5, 5, 5, 5],         // G is the 5th of C
      D: [-1, 7, 7, 7, 7],
      E: [-1, 9, 9, 9, 9],
      F: [-1, 10, 10, 10, 10],
      "F#": [-1, 11, 11, 11, 11],

      // --- minors ---
      Em: [0, 2, 0, 0, 2],        // G is the minor 3rd of Em
      "F#m": [-1, 4, 2, 2, 4],
      Gm: [0, 5, 3, 3, 5],        // G is the root
      Am: [-1, 2, 2, 1, 2],
      Bbm: [-1, 3, 3, 2, 3],
      Bm: [-1, 4, 4, 3, 4],
      "C#m": [-1, 6, 6, 5, 6],
      Dm: [-1, 7, 7, 6, 7],
      Cm: [-1, -1, 5, 4, 5],
      Fm: [-1, 3, 1, 1, 3],

      // --- dominant 7ths ---
      G7: [0, 0, 0, 0, 3],        // signature open-G banjo 7
      C7: [0, -1, 5, 5, 8],       // G is the 5th of C7
      D7: [-1, 4, 2, 1, 0],
      A7: [-1, 7, 6, 5, 5],
      E7: [-1, 2, 1, 0, 0],
      B7: [-1, 4, 4, 4, 7],
      F7: [-1, 3, 2, 1, 1],

      // Diminished (vii°). Dim7 voicings - the top 4 strings share the cigarbox
      // pattern; the G drone (5th) rings open only when G is a chord tone
      // (family 2: C#/E/G/Bb). 3-fret-symmetric so 4 roots share each shape.
      Cdim: [-1, 1, 2, 1, 4], "D#dim": [-1, 1, 2, 1, 4], Ebdim: [-1, 1, 2, 1, 4], "F#dim": [-1, 1, 2, 1, 4], Gbdim: [-1, 1, 2, 1, 4], Adim: [-1, 1, 2, 1, 4],
      "C#dim": [0, 2, 3, 2, 5], Dbdim: [0, 2, 3, 2, 5], Edim: [0, 2, 3, 2, 5], Gdim: [0, 2, 3, 2, 5], "A#dim": [0, 2, 3, 2, 5], Bbdim: [0, 2, 3, 2, 5],
      Ddim: [-1, 3, 4, 3, 6], Fdim: [-1, 3, 4, 3, 6], "G#dim": [-1, 3, 4, 3, 6], Abdim: [-1, 3, 4, 3, 6], Bdim: [-1, 3, 4, 3, 6]
    }
  };
})(typeof window !== 'undefined' ? window : this);
