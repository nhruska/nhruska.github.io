---
name: copy-coach
description: Microcopy coach for the Music app - button labels, modal text, empty states, tips, and error messages, level-appropriate and jargon-honest. Use BEFORE writing or changing ANY user-visible string (the S-PERSONA-COPY goalpost owns the Solo-modal rewrite). Summoned per the SME dynamic-summoning rule.
---

# Copy coach

Every string is UI. The app's copy failures found in UAT were vocabulary
failures ("Save to add a video backing track or skip to practice" - a beginner
knows none of those nouns), not grammar failures.

## Rules

- **Vocabulary budget by level.** Beginner copy uses only: chord, song, key,
  play, practice, tune. Intermediate adds: progression, scale, transpose, solo.
  Advanced adds: mode, degree, pentatonic, diatonic. A string shown to ALL
  levels uses the BEGINNER budget - or becomes level-conditional (LEVELS gate).
- **Verb-first buttons, outcome-named.** "Save & open Studio" fails twice: Save
  is the mechanism, Studio is internal jargon. Name the OUTCOME: "Keep it +
  practice over a track" / "Just practice" / "Keep building". Buttons say what
  HAPPENS, not where you go in our architecture.
- **Empty states are starters, never apologies.** "No curated video yet - pick
  a genre and feel below" describes our gap. A starter offers the next TAP:
  one concrete action button. If an empty state has no button, it is a dead end.
- **Questions only when the user must choose.** Never rhetorical questions in
  chrome ("Ready to jam?"). The one sanctioned ask-shape is a choice card
  (the guidance ask) - options are answers, not links.
- **Numbers beat adverbs.** "so close to fitting" energy: say "6 chords",
  "5 taps", "2 more" - never "a few", "almost".
- **App-internal names never leak** (Studio, Notable, pack, KeyExplorer, seq)
  unless the surface teaches that name deliberately.
- **ASCII in code, typography in UI.** UI strings may use real punctuation, but
  match the app's existing style (hyphens, straight quotes); accidentals use
  the app's glyph conventions (♭/# per surface precedent).

## The rewrite loop (USDD-shaped)

1. Identify the audience level(s) of the surface.
2. Rewrite inside that vocabulary budget; outcome-named verbs.
3. Encode as a persona scenario assertion (the copy IS testable text).
4. Read it aloud as the persona: would Sam-the-beginner know every noun?

## Self-check

1. Which level reads this, and is every noun inside their budget?
2. Does the primary button name an outcome the user wants?
3. Does any empty state lack a next-tap button?
4. Did an internal architecture name leak?

## Related

- [pedagogy-coach](../pedagogy-coach/SKILL.md) - when to say anything at all
- [ux-coach](../ux-coach/SKILL.md) - visual emphasis of what the copy labels
- ux-friction-profiles G1 (S-PERSONA-COPY) - the first build this skill drives
