/* candidates.js - P3 seed of suggested YouTube videos for url-less tracks.
 * Loaded after tracks.js in play/index.html. Maps Tracks.trackKey(t) -> [{id,label,note}].
 * Sourced via web search (real watch URLs, verified format, not fabricated); the user
 * taps a suggestion in the curation queue to load it, then Saves to confirm. SUGGESTIONS
 * ONLY - nothing is applied automatically. */
(function (global) {
  'use strict';
  if (!global.Tracks) return;
  global.Tracks.CANDIDATES = {
  "rock backing track in c major|search|C|major": [
    {
      "id": "vQJEPT6Awvc",
      "label": "Rock Backing Track C Major | 100 BPM | C G Am F",
      "note": "exact key+bpm"
    },
    {
      "id": "uBDlCDFwln0",
      "label": "Rock Backing Track C Major 100 Bpm (C G Am F)",
      "note": "exact"
    },
    {
      "id": "gduuLsDhyhU",
      "label": "Backing Track for Guitar - Rock in C - 100 BPM",
      "note": "exact"
    }
  ],
  "mellow jam track in c major|search|C|major": [
    {
      "id": "50--bSFSee4",
      "label": "C Major Backing Track - 90 BPM | Scale & Jam",
      "note": "exact key+bpm"
    },
    {
      "id": "RSmu_ID0eJU",
      "label": "C Major Backing Track | Pop Rock | 90 Bpm",
      "note": "exact"
    },
    {
      "id": "ub3lwb64K7A",
      "label": "Acoustic Pop Rock - C major - 90 BPM",
      "note": "mellow, exact"
    }
  ],
  "country rock backing track in g major|search|G|major": [
    {
      "id": "tkjAKLyXA4U",
      "label": "G Major Backing Track | Pop Rock | 105 Bpm",
      "note": "exact key+bpm"
    },
    {
      "id": "3kbkkRMlV8c",
      "label": "Melodic Country-Rock Backing Track in G Major",
      "note": "country-rock match"
    },
    {
      "id": "5ynsiaZquCw",
      "label": "Bogey Blues Backing Track G Major 105 BPM",
      "note": "exact bpm"
    }
  ],
  "acoustic folk backing track in g major|search|G|major": [
    {
      "id": "2A6xdwfj5Bo",
      "label": "Acoustic Guitar Backing Track | G Major (80 bpm)",
      "note": "exact key+bpm"
    },
    {
      "id": "iMJT3F5FUng",
      "label": "Acoustic Guitar Country Folk Backing Track G Major",
      "note": "folk match"
    },
    {
      "id": "4vhuMvPjX3I",
      "label": "Backing Track - Country in G - 80 BPM",
      "note": "exact bpm"
    }
  ],
  "grateful dead style mixolydian jam in g|search|G|major": [
    {
      "id": "L3bgwghr0pM",
      "label": "Grateful Dead China Cat Sunflower - G Mixolydian",
      "note": "GD-style, G mixo"
    },
    {
      "id": "gYOvf-ArgpA",
      "label": "Jamband Funky Jam in G Mixolydian",
      "note": "G mixo"
    },
    {
      "id": "2LTs_Yy2W1A",
      "label": "Guitar Backing Track G Mixolydian",
      "note": "G mixo"
    }
  ],
  "rock backing track in e major|search|E|major": [
    {
      "id": "MZMTa3B-hsM",
      "label": "Backing Track in E Major | Pop Rock | 110 Bpm",
      "note": "exact key+bpm"
    },
    {
      "id": "eyvS_3TGtG4",
      "label": "E Major Rock'N'Roll Backing Track 110 Bpm",
      "note": "exact"
    },
    {
      "id": "GBVx4mX1i-I",
      "label": "Melodic Punchy Rock Backing track in E 110 bpm",
      "note": "exact"
    }
  ],
  "12 bar blues shuffle in e|search|E|major": [
    {
      "id": "ctQ9uixkfTk",
      "label": "95 BPM - E Blues 12 Bar - Jam",
      "note": "exact key+bpm"
    },
    {
      "id": "Pim-YgW8ATA",
      "label": "12 Bar Blues Backing Track - Shuffle In E",
      "note": "E shuffle"
    },
    {
      "id": "SP7b9qqcT4M",
      "label": "Shuffle 12 Bar Blues in E | Backing Track",
      "note": "E shuffle"
    }
  ],
  "southern rock mixolydian jam in e|search|E|major": [
    {
      "id": "W-bdSPy8bts",
      "label": "Catchy Southern Rock in E | 85 bpm",
      "note": "E mixo/blues, southern"
    },
    {
      "id": "z3DCGvqnUyE",
      "label": "Super E Mixolydian Rock backing track",
      "note": "E mixo"
    },
    {
      "id": "2QEQwYYbtfA",
      "label": "Southern Rock Backing Track in E (Mixolydian) | 80 BPM",
      "note": "E mixo southern"
    }
  ],
  "folk backing track in f major|search|F|major": [
    {
      "id": "YPuF-XdMdls",
      "label": "BACKING TRACK F Major | 80 Bpm | Pop Rock",
      "note": "F major, near bpm"
    },
    {
      "id": "MHBkK3KteNY",
      "label": "Pop/Rock Backing Track in F Major | 70 bpm",
      "note": "F major"
    },
    {
      "id": "wKbg6iDSXJQ",
      "label": "Rock Pop Backing Track F Major | 70 BPM",
      "note": "F major"
    }
  ],
  "soul groove backing track in f major|search|F|major": [
    {
      "id": "wUUuF4zYCyE",
      "label": "RnB Soul Groove | Key of F major",
      "note": "F major soul groove"
    },
    {
      "id": "SzTwAC5Z9Qc",
      "label": "Soul/RnB Backing Track in F Major, 90 BPM",
      "note": "F major soul, near bpm"
    }
  ],
  "slow blues backing track in bb|search|A#|major": [
    {
      "id": "LZ8we4IMR2Y",
      "label": "Bb - Slow Jazz Blues Backing Track (65bpm)",
      "note": "exact key+bpm"
    },
    {
      "id": "6FL65Fbnvww",
      "label": "Blues Backing Track Shuffle 65 Bpm",
      "note": "slow blues 65bpm"
    }
  ],
  "jazz blues swing in bb|search|A#|major": [
    {
      "id": "5s_TP_bD-kU",
      "label": "Bb Blues (Jazz/Swing feel) 130 bpm",
      "note": "exact key+bpm"
    },
    {
      "id": "GpPgUBZXKkg",
      "label": "Jazz Blues in Bb | Backing Track | 130 Bpm",
      "note": "exact"
    },
    {
      "id": "GyJZ5sjDHFo",
      "label": "Bb7 130 bpm (Jazz/Swing feel)",
      "note": "exact"
    }
  ],
  "acoustic strum backing track in d major|search|D|major": [
    {
      "id": "bboVHCF98E4",
      "label": "Southern Rock Backing Track in D Major | 90 BPM",
      "note": "D major, near bpm"
    },
    {
      "id": "PDbIpfWEc7Y",
      "label": "G Em Am D Acoustic Strumming Backing Track",
      "note": "acoustic strum"
    }
  ],
  "sweet mixolydian jam in d|search|D|major": [
    {
      "id": "6y75xmcKZ8g",
      "label": "Sweet D Mixolydian Guitar Backing Track",
      "note": "D mixo, name match"
    },
    {
      "id": "nEgMkOSyzjY",
      "label": "Cool Mixolydian Jam Track in D",
      "note": "D mixo"
    },
    {
      "id": "jAjQkIjVhUQ",
      "label": "Melodic Mixolydian Rock - Backing Track in D",
      "note": "D mixo"
    }
  ],
  "uptempo reggae backing in a|search|A|major": [
    {
      "id": "h8UgrEAG9h8",
      "label": "Ska/Reggae Backing Track in A Major [95 BPM]",
      "note": "A major reggae 95bpm"
    }
  ],
  "rock backing track in d minor|search|D|minor": [
    {
      "id": "byjaDVpSFHY",
      "label": "Atmospheric 80s Rock Backing Track in D Minor (100 BPM)",
      "note": "exact key+bpm"
    },
    {
      "id": "XYc3_6B12Zg",
      "label": "D Minor | Epic Emotional Melodic | 100 BPM",
      "note": "exact"
    },
    {
      "id": "M7r4g5jL9H8",
      "label": "D Minor Classic Heavy Metal | 100 BPM",
      "note": "exact bpm"
    }
  ],
  "cinematic melodic backing in d minor|search|D|minor": [
    {
      "id": "c8ORi-Ma2JA",
      "label": "D Minor Backing Track | 78 Bpm",
      "note": "exact key+bpm"
    },
    {
      "id": "leL8_F-9T8I",
      "label": "D Minor Cinematic Rock Backing Track | 80 BPM",
      "note": "cinematic, near bpm"
    },
    {
      "id": "9ovD28hVrwk",
      "label": "Cinematic Blue Rain Rock Ballad in D Minor | 75 BPM",
      "note": "cinematic"
    }
  ],
  "rock backing track in e minor|search|E|minor": [
    {
      "id": "zxhxRcPlxwE",
      "label": "Classic Rock Backing Track in E minor, 110 bpm",
      "note": "exact key+bpm"
    },
    {
      "id": "kHfKnMc-Bv0",
      "label": "Backing Track in E Minor - Em Am D G - 110 bpm",
      "note": "exact"
    },
    {
      "id": "bWSktf_7PBw",
      "label": "Pop-Rock Ballad Backing Track Em (110 BPM)",
      "note": "exact"
    }
  ],
  "santana dorian jam in e minor|search|E|major": [
    {
      "id": "EVQvTcpwgRk",
      "label": "Latin Rock E Dorian Minor Santana Style",
      "note": "E dorian santana"
    },
    {
      "id": "gfajwiZtaH8",
      "label": "E minor Backing Track Dorian Santana",
      "note": "E dorian santana"
    }
  ],
  "rock backing track in g minor|search|G|minor": [
    {
      "id": "oKKItzTsQyE",
      "label": "EPIC FUNK Jam | Backing Track in G Minor (102 BPM)",
      "note": "exact key+bpm"
    },
    {
      "id": "G6dL-LlPmY4",
      "label": "Rock Guitar Backing Track in G minor",
      "note": "G minor rock"
    },
    {
      "id": "Hnhp1C9XMcw",
      "label": "Massive Classic Rock Jam (G Minor)",
      "note": "G minor rock"
    }
  ],
  "minor blues backing track in g|search|G|minor": [
    {
      "id": "7dWnm5bfY4c",
      "label": "Laid Back Blues Backing Track in G - 80 BPM",
      "note": "G blues 80bpm"
    },
    {
      "id": "JPoDmrWGXWQ",
      "label": "80's Blues Rock Backing Track | G minor",
      "note": "G minor blues"
    }
  ],
  "hard rock backing in f# minor|search|F#|minor": [
    {
      "id": "c4nEaSLq1h8",
      "label": "Tasty Hard Rock Jam in F# Minor",
      "note": "F#m hard rock"
    },
    {
      "id": "zAhd_j0s61U",
      "label": "Rock Pop Backing Track F# Minor | 110 BPM",
      "note": "F#m, near bpm"
    }
  ],
  "80s rock backing in c# minor|search|C#|minor": [
    {
      "id": "qgLRGVZn8xQ",
      "label": "C# minor Rock Ballad Guitar Jam | 118 BPM",
      "note": "exact key+bpm"
    },
    {
      "id": "mg-jmBRBhtk",
      "label": "C# Minor Backing Track Rock 80s, 90 BPM",
      "note": "80s C#m"
    },
    {
      "id": "js0cf1b1Xno",
      "label": "C# Minor Guitar Backing Track 80s Rock Ballad",
      "note": "80s C#m"
    }
  ],
  "hendrix style jam in a minor|search|A|minor": [
    {
      "id": "7YFmRxRsEVw",
      "label": "Funky Jimi Hendrix Jam | A Minor",
      "note": "A minor hendrix"
    },
    {
      "id": "Hp6O4QmLPHI",
      "label": "Hendrix Style Blues Jungle Jam In A Minor",
      "note": "A minor hendrix"
    },
    {
      "id": "44_M53hvdPM",
      "label": "Laid-Back Hendrix Blues Rock Jam (A Minor)",
      "note": "A minor hendrix"
    }
  ],
  "carlos style dorian jam in a|search|A|major": [
    {
      "id": "v4XF3aZnPtA",
      "label": "A Dorian Backing Track: Carlos Santana Style",
      "note": "A dorian santana"
    },
    {
      "id": "eliK_J95FZY",
      "label": "Latin/Santana Style in A Dorian",
      "note": "A dorian santana"
    },
    {
      "id": "ydwmmC5jLwk",
      "label": "Santana Style Backing Track in A Dorian",
      "note": "A dorian santana"
    }
  ],
  "modal jam track in d dorian|search|D|major": [
    {
      "id": "_lSZ8uRFvoI",
      "label": "Funky D Dorian Guitar Jam Track 95 BPM",
      "note": "exact mode+bpm"
    },
    {
      "id": "OfvCw3IcbSs",
      "label": "D Dorian Backing Track (Modal Mastery)",
      "note": "D dorian"
    },
    {
      "id": "ldIlMNRSUok",
      "label": "D Dorian Mode/Scale | Groove Backing Jam",
      "note": "D dorian"
    }
  ],
  "three little birds|bob marley|A|major": [
    {
      "id": "ywvraIjOgcs",
      "label": "Reggae Backing Track in A | 74 BPM | Three Little Birds - Bob Marley",
      "note": "exact key, near bpm (74 vs 76)"
    },
    {
      "id": "7ACL5efssTw",
      "label": "Three Little Birds Backing Track | Bob Marley | Reggae Jam in A",
      "note": "exact key, bpm unstated"
    },
    {
      "id": "FLtuwnJWdN0",
      "label": "Bob Marley - Three Little Birds (guitar backing track)",
      "note": "original song key (A), bpm unstated"
    }
  ],
  "let it be|the beatles|C|major": [
    {
      "id": "Jp94V3yVcQQ",
      "label": "Let It Be Chords: The Best Darn Major Pentatonic Classic Rock Backing Track [C Major - 66 bpm]",
      "note": "exact key, near bpm (66 vs 73)"
    },
    {
      "id": "uwXLUfUMPlI",
      "label": "The Beatles - Let It Be GUITAR BACKING TRACK",
      "note": "original song key (C), bpm unstated"
    },
    {
      "id": "JC8fj1-0TbQ",
      "label": "Let it be (The Beatles) - INSTRUMENTAL BACKING TRACK",
      "note": "original song key (C), bpm unstated"
    }
  ],
  "bouncing around the room|phish|D|major": [
    {
      "id": "xOKEdZS_fRE",
      "label": "Phish - Bouncing Around The Room (drums backing track)",
      "note": "drums-only backing track, confirmed D major, ~107 bpm (catalog says 112)"
    },
    {
      "id": "VHQfg59Kp5Q",
      "label": "Phish | 12.28.11 | Bouncing Around the Room",
      "note": "live full-band performance, not an isolated backing track - use as a play-along reference"
    }
  ],
  "sample in a jar|phish|A|major": [
    {
      "id": "X8hqMBcr368",
      "label": "Phish - Sample in a Jar (The Spectrum '97) - Guitar Backing Track",
      "note": "exact key - catalog corrected to A major (was mislabeled G)"
    },
    {
      "id": "Ao5iDef-duA",
      "label": "Sample In A Jar Jam Phish Style Guitar Backing Track (A Minor)",
      "note": "A minor jam-style variant (relative feel, works over A)"
    },
    {
      "id": "x6dRu6ijGj4",
      "label": "Phish - Sample In A Jar (karaoke)",
      "note": "karaoke/full track in A major"
    }
  ],
  "waste|phish|D|major": [
    {
      "id": "hPfeMRIYTo8",
      "label": "Phish - Waste KARAOKE",
      "note": "karaoke/instrumental, song commonly played in D (matches catalog)"
    },
    {
      "id": "KacdcBRy70w",
      "label": "Free (Phish) 10-minute backing track (D to Bb jam)",
      "note": "generic D-to-Bb jam progression matching Waste's key, not song-specific"
    },
    {
      "id": "Doq2smEImK8",
      "label": "Phish Waste Guitar Lesson (Acoustic Version For Beginners)",
      "note": "guitar lesson, not an isolated backing track - useful as a reference"
    }
  ],
  "hey jude|the beatles|F|major": [
    {
      "id": "PRH0Zl2FmMs",
      "label": "Hey Jude » Backing Track » The Beatles",
      "note": "song's key is F major per chord references; bpm unstated"
    },
    {
      "id": "X-ER_J4LSlc",
      "label": "Guitar Backing Track | Hey Jude - The Beatles",
      "note": "original song key (F), bpm unstated"
    },
    {
      "id": "LP0Ecfu6Ot8",
      "label": "Hey Jude The Beatles Guitar Lesson Tutorial [Guitar Play Along for Beginners]",
      "note": "play-along tutorial, not a pure backing track - original key (F)"
    }
  ],
  "twist and shout|the beatles|D|major": [
    {
      "id": "KkECudC28u4",
      "label": "The Beatles - 'Twist And Shout' - Full Backing Track",
      "note": "original song key (D), bpm unstated"
    },
    {
      "id": "tYu5UZ5LG_o",
      "label": "Twist And Shout - The Beatles Guitar Backing Track with chords and lyrics",
      "note": "original song key (D), bpm unstated"
    },
    {
      "id": "dKSZ8JvyzX8",
      "label": "Twist And Shout - The Beatles | Backing Track | Guitar Tab",
      "note": "original song key (D), bpm unstated"
    }
  ],
  "ob-la-di, ob-la-da|the beatles|A|major": [
    {
      "id": "POHQX1iJJGI",
      "label": "The Beatles - Ob La Di Ob La da GUITAR BACKING TRACK",
      "note": "song is Bb capo 1, sounds in A - matches catalog key"
    },
    {
      "id": "DPnSqAFibK4",
      "label": "The Beatles - Ob-La-Di, Ob-La-Da (Instrumental & Backing Vocals)",
      "note": "instrumental + backing vocals, sounds in A per capo-1 convention"
    }
  ],
  "dark rock backing in c minor|search|C|minor": [
    {
      "id": "DZ3zxrltUpc",
      "label": "Dark Blues Rock Guitar Backing Track Jam in C Minor",
      "note": "exact key, bpm unstated"
    },
    {
      "id": "-Rht_M5oXSc",
      "label": "Dark Dreamy Melodic Rock Backing Track in C Minor",
      "note": "exact key, bpm unstated"
    },
    {
      "id": "9MejXhz393c",
      "label": "Dark Country Rock Guitar Backing Track Jam in C Minor",
      "note": "exact key, bpm unstated"
    }
  ]
};
})(typeof window !== 'undefined' ? window : this);
