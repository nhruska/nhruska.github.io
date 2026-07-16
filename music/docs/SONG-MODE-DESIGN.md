# Song Mode - design for the composition ladder

> Operator vision (2026-07-15): song composition is the immediate goal of most
> users regardless of skill level - play chords -> play songs -> write my own
> songs -> elaborate (melodies, hooks, lyrics, changes between sections). The
> M-13 song builder "stumbled into" this; this design gives it a real home.

## The usability situation being reconciled

Compose does two jobs in one viewport. The screen splits into `.composeTop`
(FIXED, never scrolls: controls + progression strip + the M-13 tray) and
`.composeChords` (the ONLY scroll area: the chord picker). The M-13 section
buffer lives in the fixed region with unbounded growth, so every added section
starves the picker - at two sections the user is stuck ("can't finish my song",
operator report 2026-07-14, hotfixed by the 22vh cap in the tray-scroll PR).

Deeper than the layout bug: the builder's *thinking surface* was a strip of
`Verse · 3` chips - no chords visible, nothing playable, no way back into a
section. Arrangement is a real creative altitude and it had no room.

## The model: three altitudes, one screen at a time

| Altitude | Surface | The user's question |
|---|---|---|
| **Chord** | picker + strum audio | "what does this shape sound like?" |
| **Progression** | the strip + picker (Chords mode) | "does this loop feel right?" |
| **Song** | the arrangement canvas (Song mode) | "how do these parts become a song?" |

Design law: **one altitude on screen at a time, with cheap movement between
altitudes.** Both jobs stopped fighting for the fold the moment each got the
whole viewport.

## The surface (S-SONG-MODE)

A screen-level toggle at the top of Compose - **`Chords | Song`** (copy-coach:
"Progression" is intermediate vocabulary; a screen-level control is read by
every level, so it uses the beginner budget). The Song segment carries a count
badge (`Song · 2`) so parked work stays visible from Chords mode -
recognition over recall, numbers beat adverbs.

**Chords mode** = today's progression editor, full screen, plus ONE tray row
when a progression exists: `[Verse ▾] [Add to song]` - the capture moment.
Capture is additive (progression stays, Clear-undo stays) because the chorus is
usually the verse, edited.

**Song mode** = the arrangement canvas, full screen, scrolling:
- **Section cards** (not chips): label + chord names (respelled in the song's
  key) + **play** (hear the section - chords strum in sequence) + reorder
  (drag + up/dn) + remove (armed-red grammar). Recognition over recall: you can
  SEE and HEAR what's in a section without assembling.
- **Proven templates** (the M-13 suggestion engine, now with room): label
  switcher + up to 4 realized progressions with provenance. Tapping one drops
  into Chords mode with the progression loaded to tweak ("guided loop") - the
  next `Add to song` returns to the canvas automatically.
- **`Build the chords`** - same loop, empty-handed.
- **`Save song`** (was "Assemble" - jargon) - names the song via the existing
  inline name row (default `Song in <key>`), setlist opt-in, then opens it in
  the song view. The payoff moment: your song, playable.
- **Empty state** is a starter, not an apology: one teaching line ("A song is
  chords arranged in sections") + the template chips, which SOUND when tapped -
  pedagogy-coach's first-minute rule.

Mode persists per device (`music.composeMode.v1`, additive key). Manual toggle
taps clear the guided-loop return flag - the user taking the wheel wins.

## Why not a 5th tab?

The builder NEEDS the progression editor - a separate tab either duplicates the
picker or bounces the user between tabs mid-thought. Docking Song mode inside
Compose keeps one editor, one home for creation. The canvas is deliberately
built as a full-screen surface, so if song-writing becomes the app's center of
gravity it can graduate to a bottom-nav tab with zero rework. Revisit after
pilot feedback.

## Phases

- **A (this PR):** the toggle + full-screen canvas (cards with visible chords,
  play, reorder, remove), capture row, guided template loop, Save song with
  naming, empty-state starters, mode persistence + badge.
- **B:** round-trip section editing (card "Edit" -> Chords mode loaded with that
  section -> Done writes BACK to the section, with the unsaved-progression
  guard); full-song play-through (sections in sequence, tempo-aware).
- **C - the "elaborate" rung:** per-section lyric lines (the saved sheet format
  already supports lines per section), hook/riff notes on cards, "jam a melody
  over the draft" via the existing Solo path. Cards are built as vertical
  stacks so these slots attach without a redesign.
- **Later:** graduate Song mode to its own tab if usage says so.

## Verification bar

Node: `node test/run-all.js` green; mode/capture/save flows driven through the
mount harness (stub DOM - no `closest()`, so wiring falls back to
`parentNode`). Browser render-verify is a laptop-surface follow-up (this was
built on the no-browser surface); the preview link is the eyeball path.
`sw.js` CACHE + build-stamp bump in the same commit (CORE files changed).
