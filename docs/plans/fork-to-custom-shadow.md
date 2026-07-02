# Fork-to-custom (SHADOW) - catalog song curation + editing

> UAT r3 solo-HUD asks: curate a found YouTube video onto a catalog song, and edit a catalog song's name/key/chords/lyrics. Both resolve to ONE pattern: fork a catalog song into an editable user-owned copy that SHADOWS the original (operator decision 2026-07-02: shadow, not duplicate).

## Data model
- A custom item gains `forkOf: "<catalogId>"` (the `kN` id of the shadowed catalog song) and carries the original `sheet` AND `seq` verbatim (both are needed: `sheet` renders Practice/Stage, `seq` drives chord chips + the solo-key inference).
- `rebuildAll`: build catalog (kN ids); collect the set of `forkOf` ids across customs; **omit** those catalog entries (the fork shadows them); append customs. Deleting the fork -> catalog reappears (revert).
- `rebuildAll` sheet rule: **prefer `cs.sheet`** when present (a fork preserves the original chords+lyrics); else build a chord-only sheet from `cs.seq` (existing behavior for composed customs).

## Slice 1 (this PR) - foundation + metadata/video, lyrics PRESERVED
- forkOf + shadow + sheet-preserve in rebuildAll (the pure `shadowedCatalogIds` predicate is unit-tested; the full rebuildAll shadow/delete-restore/sheet-preserve chain is verified LIVE - a mount-DOM unit harness is the tracked follow-up).
- Entry: "Make it mine" on a CATALOG song (practice view) -> Add/Edit form in **fork mode**: edit title / artist / key / mode / genre / **video URL**. Chords + lyrics come from the original and are preserved untouched (the seq/sheet field is hidden in fork mode with a "chords & lyrics editing coming next" note - avoids the chord-only rebuild clobbering the catalog lyrics).
- Revert: a forked item's delete is labelled **"Revert to original"**; deleting restores the catalog song.
- Video curation solved: fork -> paste video -> shadows the catalog song with your video (persisted). A sheet-bearing fork's row tap opens Practice (like any catalog song); the play/action button opens the fork's OWN video in the Studio via `studioTarget` (unit-tested), never the merged backing seed track.
- Fork seeds from the MERGED repertoire record, so a catalog song that matched a backing track carries that track's authoritative video/key/mode onto the fork (not just the raw catalog fields).
- Setlist-safe: forking a **setlisted** song remaps the setlist slot from the catalog id to the fork id (the song stays in the set as your fork, doesn't vanish when the catalog id is shadowed); reverting restores the catalog id to that slot.
- Fork is NOT chord-forced: it keeps the original's lyrics, so Practice + Stage seed the Lyrics/Chords/Both view like a catalog song (only chord-only composed customs force chords).

## Slice 2 (next PR) - full sheet editor
- A [chord]lyric sheet editor in the Add/Edit form so a fork (or any custom) can edit chords AND lyrics without losing the lyric lines. Unlocks the seq/sheet field in fork mode.

## Verification
- Unit: the pure cores are extracted + unit-tested - `buildAllSongs(catalog, customs)` drives the REAL rebuildAll merge path (kN ids, fork shadows-its-original, own-sheet-preferred, seq->chord-only, video-only->no-sheet, delete-restore, no source mutation); `remapSetlist` drives the setlist kN<->mN slot chain (replace-all on fork, restore/drop on revert); plus `shadowedCatalogIds`, `studioTarget` (own video + Studio title/artist shape + rec.video preserved), `readFields` fork-mode. A mount-level DOM harness (wiring rebuildAll into a live DOM) is still a nice-to-have follow-up, but the merge + setlist logic now ship RED on regression, not green.
- Live (Playwright, real app, inspected): Make-it-mine on a catalog song -> fork form (Chords hidden) -> edit name + paste video -> list shows ONE entry (fork shadows the original); lyrics intact; persisted fork carries forkOf + preserved sheet + video; Solo/Studio shows the curated video; Revert -> original returns; a setlisted song forked stays in the setlist as the fork (and returns to the catalog original on revert).
