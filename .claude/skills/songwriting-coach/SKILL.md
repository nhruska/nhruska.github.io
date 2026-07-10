---
name: songwriting-coach
description: Songwriting decision coach - proven progression families per genre and song section, section-level conventions (verse/pre/chorus/bridge energy and cadence), and lyric-craft rules (prosody, imagery, rhyme discipline). Use when assembling progressions into song skeletons, ranking template choices for a genre/section, drafting or critiquing lyrics, or mining songs.json for proven patterns. Pairs with music-theory-coach (correctness of a single choice) - this skill owns STRUCTURE ACROSS TIME: which changes belong in which section and why the song works as a whole.
---

# Songwriting coach

Given a genre + section (+ key), recommend the proven pattern first, alternatives
outlined, and say WHY in one line. Given lyrics, critique against the craft rules.
Never invent "theory-true but song-false" material - proven means it shipped in real
songs (our catalog or the canon).

## Proven progression families (roman - key-independent; render key-aware per repo rules)

| Family | Pattern | Home | Proven by |
|---|---|---|---|
| Axis | I-V-vi-IV (rot: vi-IV-I-V) | pop/rock chorus | the most-recorded 4-chord loop in the canon |
| 50s / doo-wop | I-vi-IV-V | ballad verse+chorus | Stand By Me shape |
| 12-bar blues | I I I I / IV IV I I / V IV I (V) | blues everything | the form IS the song |
| Folk cadence | I-IV-V(-I) | folk/country verse | three-chord canon |
| Mixolydian rock | I-bVII-IV | rock chorus/riff | classic-rock staple (bVII = the tell `inferSoloDefault` already reads) |
| Minor pop | i-bVI-bIII-bVII | minor-key chorus | modern minor axis |
| Andalusian | i-bVII-bVI-V | flamenco/rock descent | the lament bass |
| Jazz turnaround | ii-V-I | jazz/soul cadences | the cadence of the idiom |
| Pre-chorus lift | IV-V or ii-V held | pre-chorus | dominant tension begs the chorus |

## Section conventions (energy + function)

- **Verse**: tonic-anchored, lower energy, room for words - scene-setting. Longer loops OK.
- **Pre-chorus**: departure + build - end on V (or IV-V) so the chorus lands as arrival.
- **Chorus**: the hook + the strongest cadence + the title. Simplest, most proven loop wins.
- **Bridge**: ONE genuine departure - vi or IV as new anchor, a borrowed iv, or the bVII
  door. Never two novelties at once.
- **Intro/outro**: quote the chorus loop thin, or the verse loop bare.
- Form defaults: verse-chorus (pop/rock), AABA (standards/folk), 12-bar (blues).

## Lyric craft (the critique checklist)

1. **Concrete beats abstract** - a named street outperforms "my pain". One central image
   per song; verses develop it, the chorus states what it MEANS.
2. **Prosody**: stressed syllables on strong beats - sing the line, never count letters.
   A great line that fights the meter is a bad lyric.
3. **Verse = scene, chorus = meaning.** New verse, new angle on the same image - never a
   new topic.
4. **Rhyme discipline**: perfect rhyme at the cadence, slant rhyme inside lines. Abandoning
   a scheme mid-song reads as error, not freedom.
5. **Title placement**: first or last line of the chorus. If the title never lands, the
   song has no address.

## Mining the catalog (proven = data)

`songs.json` holds real songs: `seq` (the changes) + `sheet[[section, line]]` (the form).
Pattern-mine with `Circle.romanFor(key, chord)` to get key-independent templates - that
extraction (genre x section -> ranked roman patterns with song citations) is the
S-SDD-TEMPLATES mission. Until it ships, the families table above is the proven set.

## Repo invariants (do not violate while composing)

- Chord TOKENS stay canonical-sharp in storage/`seq`; only DISPLAY respells key-aware
  (music/CLAUDE.md note-spelling regime B).
- App stays static/no-LLM: lyric GENERATION happens in session with this skill; the app
  stores results (`sheet` lines) and never calls a model.

## Self-check before recommending

- Did I name the proven family (not invent a progression) and cite why it fits the
  section's job?
- Verse/chorus/bridge each doing their ONE job (scene / meaning / departure)?
- Would music-theory-coach accept every spelling and degree label I used?
- For lyrics: does the stressed-syllable map survive being sung on the target loop?
