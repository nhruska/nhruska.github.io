# Goal Spec: Playlist Extraction + Player-Feel (2026-08-06)

> Mission record for the launch-directive arc on branch `claude/nh-pages-music-extraction-pzn1rg`.

## Operator directive (verbatim)

> "lets extract my playlist music and add to the library. My playlist has the touch of human curation. lets make our app's library have that same feel and value. Go"

Mid-flight additions (same turn):

> "our app almost looks like this. we don't need the images AT ALL. it needs to feel more like real a music player"
> "look at the wiki to understand purpose and sit awareness"

## Completion condition

1. The 15 baked playlist entries (17 items minus the lesson video minus any operator veto) live in `music/backing-tracks/tracks.json` on merged main, each with its yt id, key, mode, genre, bpm, capo, tags.
2. The keyless sync pipeline (`scripts/playlist-sync.js` + `.github/workflows/playlist-sync.yml`) is committed so "sync playlist" is a repeatable one-command act.
3. `node test/run-all.js` green including the new `test/tracks-catalog.test.js` schema gate.
4. PR-B (player-feel: global mini-player + now-playing row state + play-from-row) open with evidence, or merged.

## Verification commands

```
node -c scripts/playlist-sync.js
node scripts/playlist-sync.js --bake --from docs/plans/playlist-sync-latest.json --dry
node test/tracks-catalog.test.js
node test/candidates.test.js
node test/run-all.js
git fetch origin main && bash scripts/check-cache-bump.sh
```

## Scope

**In:** the bake (15 entries), the sync pipeline, the schema gate, wiki sync (data-model, practice-studio, decisions, change-history), the PR-B player-feel pass.

**Out:** W2b user-connected in-app playlists (demoted 2026-07-05, still parked); a "lessons" shelf for non-backing-track videos (the lesson entry is skipped, not shelved); the 17th playlist item IF branch dispatch 404s (post-merge sync picks it up); artist/channel enrichment beyond what the payload carries (follow-up PR with LEGACY_TRACKKEYS remaps).

## Guardrails (never-do)

- Draft PRs only; the operator is the only merger.
- Never mutate an existing tracks.json row; never fill a yt id onto a track that has one.
- No API key anywhere in the playlist pipeline (keyless is the ruling).
- SW cache pair-bump (`CACHE` + build-stamp VERSION/UPDATED_ISO) in the SAME commit as any asset change; version = `music-v<PR#>`, `-2`/`-3` on later asset commits.
- No raster imagery in the app - no YouTube thumbnails in rows or player chrome (operator: "we don't need the images AT ALL").
- One Playwright scenario per process (the box OOMs on suites).

## Assumed answers (interview dismissed - proceed per interview-queue contract)

| Question | Assumed answer | Basis |
|---|---|---|
| Bake gate | Bake now; veto table in the PR body; merge = red-pen | Launch directive reopened the month-parked gate; merge stays the operator's keystroke |
| #8 C/Am | C major | The July draft's call; veto note offers A minor; post-merge flip = LEGACY_TRACKKEYS remap |
| #15 Harry Hood key/mode | D mixolydian, flagged UNCONFIRMED in the veto table | music-theory-coach default (the Hood jam's D center); fills the matrix's mixolydian gap; null would forfeit the Studio HUD |
| Genre vocabulary | Add pop/funk/jazz | Already app vocabulary (yt-info GENRE_KEYWORDS, jam-queries); genre chips derive automatically |
| Player-feel scope | Mini-player bar + now-playing row + play-from-row, as PR-B | "feel more like a real music player"; anti-vision constraints held (finite queue, YouTube behind explicit tap, single accent) |
| Lesson video (#2) | Skip, no shelf | Shelf is new scope; the skip is reversible |

## Abort conditions

- Any guardrail would have to break to proceed (e.g. force-push to main, non-draft PR).
- 3 failed attempts on any gate -> stop, surface to operator with evidence.
- The operator vetoes the bake in PR review -> drop vetoed rows, re-bake, keep the pipeline.
