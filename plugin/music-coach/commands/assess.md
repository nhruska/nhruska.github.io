---
description: Read a user's Music-app export folder and produce a competency assessment - gap read vs targets, evidence staleness, repertoire summary
argument-hint: <path to the export folder or file(s)>
---

Read the export(s) at: $ARGUMENTS

Apply the `music-interchange` skill's "Reading an export" rules before doing
anything else - it defines the file shapes and where the real data lives (the
fenced JSON block, not the presentation table).

If `profile.json` is present, lead with it: list `goals`, then per competency
the LATEST assessment (value, scale, method, modality, source, at) or
**unassessed** - never a number for absence - and the evidence that backs it.
Note the modality of every record: the app's own `app-progression` evidence is
`compose`, so it says nothing about performing.

Then, per skill found in the SKILL.md / envelope docs:

1. **Gap table** - each competency: `level`, `target`, gap (`target - level`),
   `evidence_count`, `last_evidence`. Sort worst-gap first.
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
