# Data Curation

[Wiki](../index.md) > workflows > Data Curation

## Purpose

The /song flow, songs.json edit discipline, track/video curation, and the phone->laptop merge loop.

## /song command [STABLE]

.claude/commands/song.md - add/curate songbook songs with validation: JSON.parse green + every seq/sheet chord token splits cleanly (`^[A-G][#b]?...`, real key). Surgical diffs only - write back with the same 2-space formatting so git shows just the intended lines (music/CLAUDE.md:24,28).

## songs.json rules [STABLE]

See [systems/data-model.md](../systems/data-model.md) for the record shape. Curation-side constraints: t+a unique; y and d agree; jam:true marks Play-now starters; chord tokens reflect the REAL key (no fantasy enharmonics).

## Track/video curation loop [STABLE]

Tracks without a curated video show the Studio search card; pasting a URL stores it in the music.trackUrls overlay keyed by trackKey ([data-model](../systems/data-model.md)). candidates.js seeds pre-researched YouTube suggestions into the curation queue. Genre-optional search queries are deterministic (searchQuery) so uncurated tracks still open something sensible.

## Phone -> laptop merge [STABLE]

1. Phone: open music/dev/export-data.html -> dump localStorage curation + custom songs to JSON -> send to laptop.
2. Laptop: node music/dev/merge-localstorage.js <phone-json> - folds it back into songs.json/tracks.json.
3. Dedup: match title+artist (normalized); key as tiebreak; song fields (chords) + track fields (video/genre/bpm) merge per side.
4. Review the diff, commit (+ SW bump - songs.json is CORE).

Reference: music/dev/README.md (kept code-adjacent by design).

---

**Anchors verified:** .claude/commands/song.md, music/dev/README.md + export-data.html + merge-localstorage.js, candidates.js, music/CLAUDE.md:24,28,31
