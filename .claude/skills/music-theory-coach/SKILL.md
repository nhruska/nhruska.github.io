---
name: music-theory-coach
description: Music-theory decision coach for the Music app - given a key + mode + context, pick the theory-BEST default (scale, mode, chord option), rank the alternatives, and flag what's incompatible. Use whenever the app or the agent must PRE-SELECT or ORDER a theory choice (the Studio's solo-scale picker, a default mode, a suggested-chord order, "which option should be highlighted"). Pairs with ux-coach: ux-coach decides how a choice LOOKS (the emphasis ladder), music-theory-coach decides which choice is RIGHT.
---

# Music theory coach

Decide the theory-correct default so the app never highlights a beginner-hostile
choice. Given a key + mode + context, answer three questions in order:

1. **Which option is BEST?** (the one to pre-select / fill as primary)
2. **Which are compatible alternatives?** (outline, secondary - real but not the default)
3. **Which are INCOMPATIBLE?** (disable or remove - actively wrong here)

Then hand the ranking to the visual-language emphasis ladder: best = filled primary,
compatible = outline, incompatible = disabled/removed. **ux-coach owns the look; this
skill owns the correctness.**

## Grounding: never re-derive, read the SSOT

The app already computes the theory. Pull from it, don't hand-roll:
- `Circle.soloScale(root, scaleId)` / `Circle.spellScale(root, mode)` - the note sets.
- `Circle.diatonicKeyAware` / the MODES table - the in-key chords.
- Canonical contracts: [theory-engine/note-spelling.md](../../../music/engineering-wiki/theory-engine/note-spelling.md), [theory-engine/harmonization.md](../../../music/engineering-wiki/theory-engine/harmonization.md), [systems/compose-key-system.md](../../../music/engineering-wiki/systems/compose-key-system.md).
A theory default must agree with what these produce - a picker that highlights a scale the engine spells with a clashing note is a trust break (design-principles.md "theory-authority trust chain").

## The core decision: best solo scale over a key + mode

The default is the **safest home base a player of ANY level can't sound wrong over**, not the most colorful option. Color scales are compatible alternatives, never the default.

| Incoming key + mode | BEST default | Compatible (outline) | Incompatible (disable) | Why |
|---|---|---|---|---|
| Major / Ionian | **Major pentatonic** | Ionian (full major), Blues, minor pent (the "blues rub") | - | Major pent has no avoid notes over a major progression - can't sound wrong. Ionian adds the 4th/7th (more color, small risk). Minor-pent/blues are the deliberate blues rub - color, not the beginner home. |
| Minor / Aeolian | **Minor pentatonic** | Natural minor (Aeolian), Blues | Major pentatonic (b3 vs the key's natural 3 clashes on sustain) | Minor pent is the universal minor home. Blues adds the b5. Major pent fights a minor tonic. |
| Dominant / bluesy | **Minor pentatonic** or **Blues** | Mixolydian, major pent | - | The blues palette is the point; Mixolydian is the "correct" dominant scale for a cleaner read. |
| Mixolydian | **Mixolydian** | Major pent, Blues | - | Use the mode's own scale; major pent is the safe subset. |
| Dorian | **Dorian** | Minor pent, Blues | Major pent | The mode's own scale; minor pent is the safe subset. |

**Rule of thumb:** pentatonic of the tonic's quality (major-key -> major pent, minor-key -> minor pent) is the default every time - it is the choice that is never wrong. The full mode and the blues/rub scales are compatible color, ranked after. An option whose characteristic tone clashes with the key's tonic triad (major pent over minor, and vice-versa) is incompatible - disable it rather than let a beginner pick a clash.

## Progression-aware default: read the actual chords, not just the key

The key + mode is the floor; the **progression's chords** are the better signal. A default that reads the incoming `seq` and matches the mode the progression IMPLIES beats a blanket key-quality pentatonic. Read the degrees with `Circle.romanFor(chord, tonicChord)` (the SSOT for degree analysis - never eyeball intervals) and key off the characteristic borrowed chord:

| Signal in the progression | Over key | Best default becomes | Why |
|---|---|---|---|
| A **bVII major** (uppercase, e.g. Bb in C) | major | **Mixolydian** | The bVII is Mixolydian's tell - the b7 rock/backdoor color the major pentatonic can't voice. |
| A **major IV** (uppercase, e.g. D over Am) | minor | **Dorian** | The raised-6 major IV is Dorian's tell - the "hopeful minor" brightening. |
| All-diatonic (no borrowed tell) | either | pentatonic of the key quality | Nothing implies a mode; the safe home wins (the base rule below). |
| Blues key (I7/IV7/V7) | - | keep the key's own blues scale | Its mode chip IS the blues scale. |

The safe pentatonic remains the FALLBACK when no modal tell is present - progression-awareness only UPGRADES the default when the chords earn it, it never picks something a beginner can sound wrong over. Reference implementation: `Tracks.inferSoloDefault(key, mode, seq)` (unit-tested in `test/tracks.test.js`). Only surface a mode as a selectable chip when its `SoloGuide.card` already exists (mixolydian/dorian do) - a chip with a blank Guide box is a half-ship.

## Ordering the alternatives (when several are compatible)

Rank by **safety-then-color**: fewest avoid-notes first (pentatonic), then the full diatonic mode, then the color/rub scales (Blues, borrowed). This is also the teaching order - a beginner starts on the pentatonic and adds color as they grow (design-principles.md "soul: growth means the why").

## Other theory-default calls this skill covers

- **Default mode after Compose -> Studio:** carry the Compose `songKey.mode` (major/minor/mixolydian/dorian) - the Studio must not silently switch the tonic quality the user just built in.
- **Suggested-chord order:** diatonic chords in scale-degree order (I ii iii IV V vi), dim degrees last or dropped (they're rarely strummed) - already how `diatonicChords` orders; a picker should not re-sort them by anything but degree.
- **Chord/scale compatibility badges:** a chord tone that is in the selected scale = in-key (filled); out-of-scale but playable = ghost/outline; never-fits = omit. Mirror the existing ghost-dot convention, don't invent a new one.

## Self-check before emitting a theory default

1. Did I read the answer from `Circle`, or guess it? (Guessing is a trust break.)
2. Is the pre-selected option the one a player of ANY level can't sound wrong over?
3. Are incompatible options disabled/removed, not just de-emphasized?
4. Does the visual treatment match the ranking (best filled, rest outline) - handed to ux-coach / visual-language.md?

## Related

- [ux-coach](../ux-coach/SKILL.md) - the look of the choice (emphasis ladder); this skill sets which choice is right
- [music/engineering-wiki/ux-philosophy/visual-language.md](../../../music/engineering-wiki/ux-philosophy/visual-language.md) - the emphasis ladder the ranking feeds
- [music/engineering-wiki/theory-engine/](../../../music/engineering-wiki/theory-engine/note-spelling.md) - the theory SSOT to read from
- [music/engineering-wiki/systems/compose-key-system.md](../../../music/engineering-wiki/systems/compose-key-system.md) - key/mode state that feeds the default
