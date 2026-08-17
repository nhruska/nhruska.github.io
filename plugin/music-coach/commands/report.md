---
description: Render a self-contained single-file HTML analytics page from a Music-app export - competency levels vs targets, evidence recency, repertoire summary
argument-hint: <path to the export folder or file(s)>
---

Read the export(s) at: $ARGUMENTS

Apply the `music-interchange` skill's "Reading an export" rules, then the
`music-report` skill's rendering rules, to build the report - it is the same
data `/music-coach:assess` reads, rendered as a page instead of an in-chat
table.

Save the output next to the export you read, named
`music-report-<date>.html` (`<date>` = the export's date, or today's date if
none is stated). Tell the user it opens directly in any browser, offline, no
import needed - it is a read-only view (the write-back seam is still the
`skill-competency-profile/v1` doc, unchanged by this report).

If no backup envelope was provided, render the competency sections from the
skills bundle(s) alone and mark repertoire "no backup provided" - never
invent data. End with 2-3 next steps (most likely first) - typically
`/music-coach:practice-plan` on the weakest-gap skill shown in the report.
