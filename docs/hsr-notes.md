# Ukulele HSR Shape System and Chaining Notes

> Captured from Nik's design notes on 2026-06-27. Preserves the mental model for the music app's future HSR Lens feature so future sessions don't lose the theory.

## Purpose

A guitarist-centered harmonic navigation system for standard GCEA ukulele tuning. Not beginner ukulele instruction. Built from familiar movable chord fragments, three-string triads, partial shapes, muting, hammer-ons, slides, and functional harmony.

## Musician context

Experienced player (40+ years guitar, 30+ years bass, classical nylon currently, piano theory from age 6). Background includes 4-string cigar box (DGBD), 5-string banjo (mute the drone, transfer DGBD shapes), and a 17-key kalimba. Thinks in intervals, triads, voice leading, chord families, functional harmony, fretboard geometry. Wants to transfer existing muscle memory to ukulele, not learn from scratch.

## Core tuning insight

Ukulele tuning: G C E A. When the A string is muted/ignored, the top three strings (G C E) preserve the same interval geometry as the guitar D G B string group:

| Strings | Interval 1 | Interval 2 |
|---|---|---|
| Guitar D G B | perfect 4th (D->G) | major 3rd (G->B) |
| Ukulele G C E | perfect 4th (G->C) | major 3rd (C->E) |

So the lower three ukulele strings function like guitar D G B. **Main transfer bridge.**

## Why muting A matters

The A string is optional, not required. Muting it preserves familiar three-string guitar triad logic; allowing it adds: another chord tone, doubled note, color tone, 6th, maj7, suspension, or unwanted non-chord tone depending on shape. **The A string becomes a color decision, not part of the shape.**

Same principle Nik used on banjo: mute the high drone first, establish familiar chord geometry, add the extra string later when musically useful.

## Parent theory: Harmonic Geometry Transfer (HGT)

Instead of learning every instrument as a new system, identify invariant structures: interval relationships, movable shapes, triad geometry, chord functions, voice leading, shape families, root movement, compact harmonic fragments. Transfer those structures to the new tuning.

For ukulele: G C E preserves the guitar D G B interval layout, so guitar triad fragments transfer directly.

## HSR definition

**H**ammer / **S**lide / **R**otate. A ukulele chord-navigation loop. Goal: generate I-IV-V relationships **anywhere on the fretboard** using movable shape families rather than memorizing isolated ukulele chord diagrams.

HSR is not just a chord progression. It's a **movement vocabulary**:

- Start with a home shape as I.
- **Hammer** or transform into the IV shape.
- **Slide** that IV shape up two frets to get V.
- **Rotate** into the next nearby shape family to recover I at a new neck position.
- Repeat up or down the neck.

## High-level HSR loop

```
I shape (home)
  -> Hammer/transform to IV
  -> Slide IV up 2 frets to V
  -> Rotate to a different shape family to land on I again
  -> Repeat
```

Example (C major):

```
C-family I  -> hammer to F-family IV  -> slide up 2 to V (G)
  -> rotate to A-family I  -> hammer to next C-family IV
  -> slide up 2 to V  -> rotate to next family  -> ...
```

This creates a chain moving up the fretboard. Reverse logic moves down.

## Shape families

Treated as transferable guitar-derived triad families, not isolated ukulele chord shapes. Named by guitar/ukulele visual or functional relationship, not by absolute chord name at every fret. **Relative function and movement.**

Primary families: **C-family**, **F-family**, **A-family**.

### A-shape clarification

Sometimes a barre chord using index as bar. Sometimes a custom A-type shape without the full index barre, especially when only playing strings 4-3-2 and muting string 1. Based on guitar muscle memory from D G B (or related partial fragments).

**Important:** not whether the shape exactly matches a textbook ukulele A chord. **It functions as a movable triad family in the chain.**

### C-shape clarification

C-shape chord idea, but often only playing strings 4-3-2 - the G C E strings, muting A. C shape becomes a three-string movable triad rather than a full four-string chord. Treated like a guitar triad on D G B.

### F-shape clarification

F-shape logic for bar chords and transformations. F is part of IV from a C-family home. Can also become the starting point for another chain (F as I -> next A-family rotation -> hammer/slide chain continues).

## Functional summary

Instead of asking "Where is the G chord?", ask **"What operation gives me V from here?"** Instead of memorizing C/F/G, D/G/A, E/A/B, think **I -> Hammer to IV -> Slide +2 to V -> Rotate to next I -> repeat**.

Closer to how experienced guitarists navigate with CAGED, triads, and partial voicings.

## Why this feels natural

Reuses: guitar D G B triad shapes, partial chord muscle memory, CAGED thinking, bass interval thinking, piano functional harmony, cigar box DGBD experience, banjo DGBD transfer, classical guitar economy of motion. Ukulele as another compact harmonic interface.

## Open chords vs movable inversions

Traditional ukulele charts show open-position chords. This system focuses on:

- closed or movable shapes
- three-string triads
- inversions
- voice-leading
- chaining through I-IV-V
- open chords as local versions of deeper shape families

**Open chords are entry points. Movable triad shapes are the real navigation system. Inversions are not advanced extras - they're the main mechanism that makes the HSR chain work smoothly.**

## What needs validation

The HSR system works physically and musically in the hands but needs theoretical mapping. For each chain segment:

| Field | Captures |
|---|---|
| Shape name | C-family / F-family / A-family, etc. |
| Function | I / IV / V (relative to current key) |
| Frets on G C E A | actual fret-array |
| Muted strings | which strings are damped |
| Notes | concrete pitch classes |
| Chord | the chord name at that fret position |
| Inversion | root / 1st / 2nd inversion |
| Operation used to arrive | start / hammer / slide / rotate |
| Next operation | what's next in the chain |

Key validation question: **Is each IV and V a complete triad?** If yes, what inversion? If no, partial chord / implied harmony / color voicing?

## Suggested app feature: HSR Lens

**Optional, not default. Not blocking performance workflow.**

Lens functions:
- show current shape family
- show I/IV/V functions
- highlight hammer movement (I -> IV)
- highlight slide +2 frets (IV -> V)
- highlight rotate target (V -> next I)
- show actual chord tones
- show inversion labels
- compare open chord to movable inversion
- show whether A string should be muted or included

## Product constraint

**Do not turn the app into a forced learning product.** Primary purpose: mobile-first musician workflow tool replacing tuner / chord chart / songbook / progression notebook / transpose helper / setlist / performance tool. HSR and HGT are optional knowledge layers.

## Near-term implementation guidance

- Preserve these notes in docs (this file).
- Build storage architecture first.
- Later add a Lens architecture that could support HSR.
- Eventually add a fretboard or pattern explorer for scales, triads, HSR, and inversions.

**Near-term goal**: avoid losing the theory; design future architecture so HSR can be added without rework. NOT build all of HSR now.

## What this app currently has (the partial step toward HSR)

The I-IV-V chain in Compose tab renders:
- **I** in the profile's home shape (often open)
- **IV** in a closed movable shape
- **V** as IV shifted up 2 frets (same hand shape, slid)

This shows the **Slide** part of HSR. **Hammer** (I -> IV transform) and **Rotate** (V -> next I in new family) are NOT yet shown. The Lens architecture would add visual hints for those transitions.

## One-sentence summary

The ukulele HSR system treats G-C-E as the functional equivalent of guitar D-G-B, uses muted-A three-string triads and familiar guitar-derived C, F, and A shape families, then chains I-IV-V movements through Hammer, Slide +2 frets, and Rotate operations to navigate the fretboard by function rather than memorized ukulele chord charts.
