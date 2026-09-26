---
description: Read a user's Music-app export folder and produce a competency assessment - gap read vs targets, evidence staleness, repertoire summary
argument-hint: <path to the export folder or file(s)>
---

Read the export(s) at: $ARGUMENTS

Apply the `music-interchange` skill's "Reading an export" rules before doing
anything else - it defines the file shapes and where the real data lives (the
fenced JSON block, not the presentation table).

If `profile.json` is present, lead with it and read ALL of it. Report in this
order:

1. **Musicianship** (`musicianship/*` - transferable, instrument-independent):
   per competency the LATEST assessment (value, method, modality, confidence,
   source, at) or **unassessed** - never a number for absence, never beginner.
2. **Instruments**, each on its own line, branch-level claim first, then the
   mechanics beneath it. Advanced musicianship and a brand-new instrument
   coexist - say both; never collapse them into one level.
3. **Goals**, the plan's `focus` and its open items (what is next, and which
   items carry an app deep link).
4. **Baseline confidence:** for each branch, is the evidence enough to coach
   from? If not, say so and offer the guided interview (one question at a
   time) rather than filling gaps with guesses.

Note the modality and kind of every record: the app's own `app-progression`
evidence is `compose`, so it says nothing about performing; an `artifact` with
`analyzed: false` says nothing about anything yet.

Then, per skill found in the SKILL.md / envelope docs:

1. **Gap table** - each OBSERVED competency (a real `level`): `level`,
   `target`, gap (`target - level`), `evidence_count`, `last_evidence`. Sort
   worst-gap first. Rows with `level: null` (or a legacy `0` with no evidence)
   are listed separately as **unassessed** - they have no gap, they have no data.
2. **Staleness flags** - any competency whose `last_evidence` looks old
   relative to the user's most recent activity in the export (or is missing).
3. **Repertoire summary** - per-instrument setlist size and any songs marked
   for practice, read from the backup envelope if one was provided.
4. **Preferences** - list any `preferences[]` entries found, as taste ground
   truth for later coaching (do not re-derive these from guesswork).

If no backup envelope was provided, note that repertoire/preferences are
unavailable and assess from the skills bundle(s) alone. Never invent data
that is not in the export. End with 2-3 next steps (most likely first) -
typically `/music-coach:practice-plan` on the weakest-gap skill, or
`/music-coach:jam` if the assessment surfaces an obvious next song to try.
