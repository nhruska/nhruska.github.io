# Playlist Bake Draft - "Backing tracks" (operator playlist, first live run of the U18 pipeline, 2026-07-05)

> Source: the operator's public playlist PLeqWgsYsf6p7gpIKkoHKCmfHNJ1_Lr7XW - read KEYLESS agent-side (RSS + page parse + per-video oEmbed; NO API key needed for the operator pipeline, ever). 16 entries found (RSS windowed to 15; the 16th recovered via page-parse + oEmbed - the agent-side reader is complete). **VETO TABLE - operator red-pens, survivors bake into tracks.json (the shipped catalog).** Parsed fields are title-derived hints (FORK-4 sharp-normalized); confidence flags where parsing is uncertain.

| # | Title (yt id) | Key | Mode | Genre | BPM | Note |
|---|---|---|---|---|---|---|
| 1 | Time Jam - Pink Floyd Style (y9jm5L6g3ng) | F# | minor | rock ballad | - | Floyd feel; solo-friendly |
| 2 | A SIMPLE Practice Method To Memorize Major Scales (yTr-RFBekuY) | - | - | LESSON | - | **not a backing track - SKIP? or a future "lessons" shelf** |
| 3 | Guitar backing track in C Major - Pop style (4q7h2SwIyLg) | C | major | pop | - | |
| 4 | Guitar backing track in G Major - Pop style (LJeCVSiteNU) | G | major | pop | - | |
| 5 | Rock Pop Backing Track G Major 70 BPM (3stpZKNF_jQ) | G | major | rock-pop | 70 | |
| 6 | Funky Jam Backing Track [Fm] (MJIMlr8tI2s) | F | minor | funk | - | dorian candidate for solos |
| 7 | Pop Rock Acoustic Ballad in G 66bpm (FWbdZSBW9Vo) | G | major | acoustic ballad | 66 | |
| 8 | Slow Rock Ballad in C/Am 64bpm (nbtHwKTRUcg) | C | major | rock ballad | 64 | title says C/Am (relative pair) - drafted C major; veto to A minor if that is how you jam it |
| 9 | Peaceful Mellow in E Minor (go2NlmO5pzM) | E | minor | mellow | - | |
| 10 | Funky Blues in C - John Mayer style (4cs1NwbZp2w) | C | blues | funky blues | - | Blues KEY candidate (I7-IV7-V7) |
| 11 | Blues in F (jazz) (YzuMzRhRTPE) | F | blues | jazz blues | - | |
| 12 | Rock Pop Backing Track F Major 70 BPM (wKbg6iDSXJQ) | F | major | rock-pop | 70 | |
| 13 | II-V-I Jazz Play-along - F Major (gfx5wHi_4cE) | F | major | jazz | - | ii-V-I; dorian/mixo teaching gold |
| 14 | Jazz Blues Backing Track - Eb 120bpm (XsDru5g676M) | D# | blues | jazz blues | 120 | Eb -> D# per FORK-4 |
| 15 | Harry Hood (Jam) - Phish (WJ63FZfCzM8) | - | - | jam band | - | Phish jam; mixolydian candidate - operator to confirm key/mode |
| 16 | Blues in E 90bpm (36X3wecT2z8) | E | blues | blues | 90 | the RSS-windowed 16th, recovered |

## Pipeline decisions (this run establishes them)

- **Operator pipeline = agent-side, keyless, repeatable:** say "sync playlist" anytime -> agent re-reads (RSS + page + oEmbed), diffs vs tracks.json, drafts the delta as a veto table. NO API key, ever, for this path.
- **W2b (in-app user-connected playlists) DEMOTED to later user-facing capability** - the only path that would need a key; parked.
- Matrix coverage check (vs the mode x genre matrix): current set covers major/minor/blues keys + funk/jazz/pop/rock feels; GAPS: dorian-explicit, mixolydian-explicit (Harry Hood may cover), pent-focused tracks - candidates for the operator's next curation pass using Find-a-jam.
- After veto: survivors bake into music/shared/songs.json-adjacent tracks catalog (tracks.json) with yt ids -> every user ships with the library.
