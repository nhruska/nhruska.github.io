# SDD Pilot - "the friction song" (working title) - 2026-07-10

> The first song through the loop. Operator answered IV-3 (Q6 + parts of Q1/Q2):
> **key F and/or Dm, Mixolydian; topic = abstract allusions to compound engineering,
> focused on FRICTION** - working through problems, naming weak points (the agent's or
> the system's), and surrendering to the flow (Phish-adjacent idea, DIFFERENT language
> and imagery). Operator: "see how we're already building my lyric writing skill."

## Theory grounding (from the app's own engine - not vibes)

`Circle.scaleInKey('F','mixolydian')` -> F G A Bb C D Eb.
`Circle.diatonicInKey('F','mixolydian')` -> F(I) Gm(ii) Adim(iii°) Bb(IV) Cm(v) **Dm(vi)** **Eb(bVII)**.

So "F and/or Dm, Mixo" is one coherent palette: **Dm is the vi of F Mixolydian.** Bonus
color: relative to D, this note set is D Phrygian (Eb = the b2 of D) - the darkest
available move, saved for the bridge. The verse can also lean D NATURAL minor (swap Eb
for C) - the section-to-section modal shift is a feature: verse in the minor's shade,
chorus opens the Mixolydian door and Eb is the arrival color.

## Song skeleton v0.1 (proven families only, per songwriting-coach)

| Section | Progression | Family / why |
|---|---|---|
| Verse (scene, Dm shade) | Dm - Bb - F - C | minor-pop i-bVI-bIII-bVII on D - tonic-anchored, room for words |
| Pre-chorus (build) | Bb - Eb | IV -> bVII lift - Eb ENTERS here, the door opening |
| Chorus (meaning, title lands) | F - Eb - Bb - F | the classic-rock I-bVII-IV - the proven Mixo chorus |
| Bridge (ONE departure) | Dm - Eb - Dm - Eb ... Bb - C | the Phrygian b2 lean (i-bII on D) - maximum friction before the last chorus resolves |

Alternates to taste: verse B = Dm - Bb - Eb - F (stays pure-Mixo all song, no C anywhere);
chorus B = F - Eb - Bb - Dm (lands on the vi - bittersweet instead of triumphant).

## Lyric seed bank (friction -> compounding, concrete over abstract)

The central image candidates (pick ONE, per craft rule 1):

1. **Calluses** - friction that becomes capability. Blistered fingertips -> hardened ->
   the note rings clean. The most music-native CE metaphor there is.
2. **Stones set into the stair** - every stone that broke your stride gets SET INTO the
   staircase; each loop of the spiral is higher. (Friction encoded as a primitive.)
3. **The whetstone** - the blade only sharpens against resistance (ties to the operator's
   "Quality Sword").
4. Surrender-without-Phish-words: "quit steering, read the current", "let the river hold
   the oar", "the map redraws itself as I walk it".

## Draft v0.1 (for taste reaction, not polish - central image: calluses + stairs)

    VERSE 1 (Dm - Bb - F - C)
    Kitchen light, a low string buzzing
    like it doesn't want to learn
    fingertips gone paper-thin
    from working every turn
    I used to curse the catching places,
    every fret that fought my hand
    now I write them in a ledger
    only morning understands

    PRE-CHORUS (Bb - Eb)
    every ache is information
    every rattle is a map

    CHORUS (F - Eb - Bb - F)
    every stone that broke my stride
    I set into the stair
    quit fighting with the current,
    let it carry me from there
    the wheel turns a little smoother
    every time it comes around
    worn smooth, worn smooth -
    the grinding is the ground

    BRIDGE (Dm - Eb, twice, then Bb - C)
    and when it seizes - when it sticks -
    I don't reach for something new
    I read the mark the sticking made
    and the mark says: this is how you move

- Title candidates: **Worn Smooth** / Set Into the Stair / Calluses.
- Craft self-check: one central image (friction->smoothness, stones->stairs carry it),
  verse=scene (kitchen, buzzing string), chorus=meaning (title lands, strongest cadence),
  bridge=one departure (the b2 lean under "when it seizes" - the music does the friction).
  Prosody: stressed syllables land on downbeats when sung over the loops at ~88 bpm.
- The "ledger only morning understands" = the friction log; "wheel turns smoother every
  time it comes around" = the compounding loop; deliberately allusive, never named.

## The loop from here (burst-driven)

1. Operator reacts in bursts (uat:-style: "chorus B", "kill verse line 3", "more water
   less stone") - each burst is a queue row, batched, new draft per batch.
2. Each accepted/rejected choice gets ENCODED into songwriting-coach as a preference row
   (that is the skill-building he named).
3. When a draft settles: store to songs.json (`sheet` sections + canonical-sharp `seq`),
   playable in the app over the very progressions it was written on.
4. S-SDD-TEMPLATES (M-12) mines the catalog in parallel so draft 2 starts from proven
   templates, not from me.

## Interview state

IV-3 Q6 ANSWERED (this doc). Q1 partially (his taste-canon + proven families), Q2
implicitly (rock/folk space). Q3/Q4/Q5 remain assumed per [sdd-vision](sdd-vision-20260710.md).
