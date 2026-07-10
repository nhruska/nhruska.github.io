# Note Spelling

[Wiki](../index.md) > theory-engine > Note Spelling

## Purpose

The KEY-AWARE spelling regime (regime B, ACTIVE since 2026-07-10 - the FORK-4 removal), the token-vs-display split that made it safe, and the retired canonical-sharp policy kept for the keyless contexts where it still governs.

## Regime B - key-aware spelling (ACTIVE) [STABLE]

Inside a stated key, note and chord NAMES spell by FUNCTION - conservatory letter-per-degree (seven letters, each used once, accidentals chosen to hit each pitch), from the key's PREFERRED enharmonic tonic name. The bVII of C reads Bb (never A#); C blues is C Eb F Gb G Bb; A#-major contexts render as Bb major. The name always AGREES with the roman-numeral/degree label beside it. [STABLE]

Kernel (circle.js, unit-tested in test/key-spelling.test.js incl. the 12 professor traps):

| Function | Role |
|---|---|
| `preferredTonicName(root, mode)` | The enharmonic NAME a key is written in - fewest total accidentals in its own key-aware scale, tie -> sharp. A# major -> Bb; G# minor stays G#; F# major stays F# (6/6 tie). |
| `scaleInKey(root, mode)` | Key-aware scale note names (letter-per-degree from the preferred tonic) |
| `diatonicInKey(root, mode)` | Diatonic triads with key-aware letters (F major IV = Bb) |
| `soloScaleInKey(root, scaleId, keyMode)` | SOLO_SCALES (pents/blues/modes) spelled by DEGREE number |
| `noteInKey(keyRoot, keyMode, noteRoot)` | Single chord-root display name by chromatic-degree function |

## The token-vs-display split (what made the flip safe) [STABLE]

**Chord TOKENS stay canonical-sharp everywhere data flows**: storage (`seq`), voicing-pack lookup, audio, suggestion/degree engines, targeting - all unchanged. Only DISPLAY surfaces respell, at the render seams:

| Seam | Where |
|---|---|
| Scale note lists + fretboard names | `studioTheory`/`soloBundle` (tracks.js), `soloChipScale` (songbook.js) - the `notes` arrays are display strings; pcs derive from the same names (`noteToPc` reads flats natively) |
| Chords-in-key chips (Studio) | `dispChord()` label; `data-chord` keeps the token |
| Compose In-key tiles / progression slots / suggestion chips | `dispChordName()` + `packDiagram(token, size, displayName)` - the pack resolves by token, the label is relabeled after render |
| Key chip + key prose (whynote/scaletip/keyLabel) | `dispKeyRoot()` / `preferredTonicName` |

**Keyless/chromatic contexts stay canonical-sharp** (music-theory-coach verdict: sharp is acceptable where no key function is asserted): the tuner, the All-browse palette (its A# tile stays A# until it lands in a keyed progression), pack data, and every stored token. Flat INPUT still normalizes for identity (norm(), circle.js F2S). [STABLE]

## Retired: canonical-sharp-everywhere (FORK-4, regime A) [STABLE]

Until 2026-07-10 ONE sharp spelling per pitch class rendered everywhere (the FORK-4 pilot decision). Its costs (letters repeating in scale listings, A# where charts say Bb, numeral/name self-contradiction - "bVII" labeled over "A#") were accepted to avoid the old two-spellings-on-one-screen bug. Regime B removes those costs while KEEPING the single-identity guarantee via the token/display split. The legacy `spell()`/`spellScale()`/`soloScale()` remain in circle.js for the keyless contexts and identity math. [STABLE]

Sharp-tie policy survives inside `preferredTonicName`: equal-accidental keys (F#/Gb) render SHARP - same deterministic tie rule as before, now scoped to key NAMING. [STABLE]

## The 12 golden trap cases (professor adversarial - regime-B acceptance, NOW ENFORCED) [STABLE]

All encoded as permanent regression tests in test/key-spelling.test.js ("professor traps" block): F major/Bb, C#-major-as-Db, F# major with E#dim vii (display never leaks the internal Fdim token), C# mixolydian, D# minor kept sharp, A#-minor-as-Bbm, G# minor kept, Eb dorian, no leaked sharps in flat contexts, D#-major-auto-Eb. Trap 11 (Cb major) is N/A by design: Cb is not an accepted input; unknown roots fail safe to []. Source: theory-professor-review-20260703.md. [STABLE]

---

**Anchors verified:** circle.js (ROOTS/norm/F2S; spellScaleKeyAware/spellRootInKey; preferredTonicName/scaleInKey/diatonicInKey/soloScaleInKey/noteInKey), tracks.js (studioTheory/soloBundle notes, dispChord/dispKeyRoot, chip + panel seams), songbook.js (dispChordName, packDiagram displayName, soloChipScale, key chip), test/key-spelling.test.js (kernel + professor traps), test/pw/scenarios/solo-skip-mixolydian.json (pixel gate: Bb in the Studio notes line)
