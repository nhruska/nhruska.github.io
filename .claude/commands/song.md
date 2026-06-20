---
description: Add or curate songs in the songbook, with validation
argument-hint: <song title(s) or curation request>
---

Add or curate songs in `music/shared/songs.json` for: $ARGUMENTS

Rules:
- Per-song shape:
  `{ "t","a","y","d","seq":[…],"sheet":[["Section","[C]lyric…"],…], "jam"?:true }`.
- `d` is a decade chip (`60s`…`10s`) matching the year `y`.
- `seq` chords and `[..]` chord tags must match `^[A-G][#b]?…` and reflect how
  the song is actually played (correct key). Keep lyric snippets short and
  representative — full lyrics live behind the Genius link.
- Set `"jam": true` only for genuinely jammable crowd-pleasers (Play-now
  starters lean Grateful Dead / Phish / classic rock).
- Keep the diff **surgical** — only the songs you touch should change. If you
  script the edit, write back with the same 2-space formatting and a trailing
  newline.

Then **validate in Node**: `JSON.parse` the file, confirm the song count, and
check that every `seq` chord token splits cleanly (root C…B with optional #/b,
optional quality). Report the result. If asked to ship, hand off to `/ship`.
