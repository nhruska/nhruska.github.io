# Fork-to-custom (SHADOW) - catalog song curation + editing

> UAT r3 solo-HUD asks: curate a found YouTube video onto a catalog song, and edit a catalog song's name/key/chords/lyrics. Both resolve to ONE pattern: fork a catalog song into an editable user-owned copy that SHADOWS the original (operator decision 2026-07-02: shadow, not duplicate).

## Data model
- A custom item gains `forkOf: "<catalogId>"` (the `kN` id of the shadowed catalog song) and carries the original `sheet` verbatim.
- `rebuildAll`: build catalog (kN ids); collect the set of `forkOf` ids across customs; **omit** those catalog entries (the fork shadows them); append customs. Deleting the fork -> catalog reappears (revert).
- `rebuildAll` sheet rule: **prefer `cs.sheet`** when present (a fork preserves the original chords+lyrics); else build a chord-only sheet from `cs.seq` (existing behavior for composed customs).

## Slice 1 (this PR) - foundation + metadata/video, lyrics PRESERVED
- forkOf + shadow + sheet-preserve in rebuildAll (the pure `shadowedCatalogIds` predicate is unit-tested; the full rebuildAll shadow/delete-restore/sheet-preserve chain is verified LIVE - a mount-DOM unit harness is the tracked follow-up).
- Entry: "Make it mine" on a CATALOG song (practice view) -> Add/Edit form in **fork mode**: edit title / artist / key / mode / genre / **video URL**. Chords + lyrics come from the original and are preserved untouched (the seq/sheet field is hidden in fork mode with a "chords & lyrics editing coming next" note - avoids the chord-only rebuild clobbering the catalog lyrics).
- Revert: a forked item's delete is labelled **"Revert to original"**; deleting restores the catalog song.
- Video curation solved: fork -> paste video -> shadows the catalog song with your video (persisted). The row tap / ▶ action opens the fork's OWN video in the Studio via `studioTarget` (unit-tested), never the merged backing seed track.
- Setlist-safe: forking a **setlisted** song remaps the setlist slot from the catalog id to the fork id (the song stays in the set as your fork, doesn't vanish when the catalog id is shadowed); reverting restores the catalog id to that slot.
- Fork is NOT chord-forced: it keeps the original's lyrics, so Practice + Stage seed the Lyrics/Chords/Both view like a catalog song (only chord-only composed customs force chords).

## Slice 2 (next PR) - full sheet editor
- A [chord]lyric sheet editor in the Add/Edit form so a fork (or any custom) can edit chords AND lyrics without losing the lyric lines. Unlocks the seq/sheet field in fork mode.

## Verification
- Unit: `shadowedCatalogIds` predicate (which catalog ids a fork set shadows) + `studioTarget` (a fork/custom opens its own video, not the merged seed track) + `readFields` fork-mode (no Chords field -> seq undefined, sheet not clobbered). The full `rebuildAll` shadow/delete-restore/sheet-preserve chain is verified LIVE (below), not by a mount-level unit test - a committed mount-DOM harness is the tracked follow-up.
- Live (Playwright, real app, inspected): Make-it-mine on a catalog song -> fork form (Chords hidden) -> edit name + paste video -> list shows ONE entry (fork shadows the original); lyrics intact; persisted fork carries forkOf + preserved sheet + video; Solo/Studio shows the curated video; Revert -> original returns; a setlisted song forked stays in the setlist as the fork (and returns to the catalog original on revert).
