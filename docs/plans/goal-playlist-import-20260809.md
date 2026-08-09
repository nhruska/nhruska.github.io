# Goal Spec: playlist-import + variety-fill

> Operator directive (2026-08-09, verbatim): "fill song list with variety of keys, across
> several genres, and tempo. new direction: need to pull from YouTube playlist(s). either
> ondemand, or public only...or?? if we could pull from one of my playlists (I think we have
> pipeline already).... could we have a user facing feature to pull from their playlist?
> it's the backing tracks that make this really fun - now it behaves like a music player
> with all my fav jam backing tracks and I'm better at soloing after less than an hour
> of playing."

## Interview answers (operator taps, 2026-08-09)

| Question | Answer |
|---|---|
| Pull scope | **BOTH** - ship a user-facing "import your playlist" feature (client-side, lands in the user's local library) AND keep baking Nik's playlists into the shipped catalog via the existing Actions pipeline |
| Import metadata UX | **Auto-parse, edit later** - parseHints reads key/mode/genre from titles at import; wrong/missing guesses fixed via the existing edit form; tracks playable immediately |
| Variety fill sources | **Curated search queries** (yt:null deterministic-search tracks per gap) AND **operator curates a gap-filling YT playlist** the pipeline syncs + bakes |
| First ship | **Import feature PR first** (after #324 merges); variety fill rides behind |

## Completion condition (paste into /goal)

> A draft PR is open in which a user can paste a YouTube playlist URL or ID into the app
> and its tracks land in their local library with auto-parsed key/mode/genre, rows appear
> in the Library/Jams and play in the Studio; `node test/run-all.js` exits 0, a committed
> pw scenario proves the import flow end-to-end with a synthesized player message (no
> egress), and the newest asset commit carries the cache pair for the PR number.

## Verification

- `node test/run-all.js` exit 0 (unit coverage for the id-extraction + parseHints mapping + storage write)
- `python3 test/pw/run-scenario.py test/pw/scenarios/playlist-import.json` green - the flow driven
  by a SYNTHESIZED postMessage playlist payload (the proven batches-6/7 pattern; the container
  blocks youtube.com, and the scenario must not depend on egress)
- `bash scripts/check-cache-bump.sh` exit 0 on the tip
- Manual (operator, device): paste a real playlist on the branch preview, watch tracks land

## Technical shape (detected, not assumed)

- **Keyless client-side enumeration**: the YT IFrame player accepts
  `?listType=playlist&list=<id>&enablejsapi=1` and exposes the playlist's video ids via the
  postMessage API (`getPlaylist`) - the app already speaks this protocol (`onYtMessage`,
  tracks.js). No API key, no backend, CORS-clean. Titles arrive per-video from the player's
  `videoData` as items cue (and from noembed.com when online as a best-effort batch).
- **Metadata**: `YtInfo.parseHints(title)` (shared, already node-tested) -> key/mode/genre/bpm;
  key stored as preferred tonic name via `Circle.preferredTonicName` (KEY-STORE-PREF canon).
- **Storage**: ADDITIVE - user-imported tracks go to the existing custom-track store
  (`bt.custom.v1`) or a new namespaced key; per backup.js rules additive needs no
  SCHEMA_VERSION bump. If any existing field's meaning changes, bump + migration in the
  same commit.
- **Edit-later**: the existing repertoire edit form already covers custom tracks - no new
  editor surface.

## Scope

- **In**: import UI entry point (Library, near +Add), playlist-id extraction, iframe
  enumeration, parseHints mapping, local persistence, imported rows in Library/Jams/Studio,
  pw scenario + unit tests, wiki pages (data-model + practice-studio) in the same PR.
- **Out**: variety-fill data (its own follow-up work per answers above), OAuth/private
  playlists (public/unlisted only - the iframe path cannot see private lists), YouTube
  thumbnails (D-NO-RASTER stands), any API-key path (guardrail below).

## Guardrails (never do unattended)

- Never merge - draft PR, Nik merges (standing).
- NO YouTube Data API key - keyless is the ruled architecture (PLAYLIST-KEYLESS decision).
- No raster imagery (D-NO-RASTER).
- Additive storage only, or SCHEMA_VERSION + migration same-commit (backup.js law).
- Cache pair per asset commit (S-SW-PER-COMMIT).
- One pw scenario per process (box OOMs).
- All CSS external; no inline styles.

## Abort / surface to human when

- 3 failed attempts to get playlist enumeration working through the iframe postMessage
  seam headless (synthesized) - surface with evidence, propose the noembed-only fallback.
- The playlist API turns out to require a user gesture the import flow can't own - surface
  with the observed behavior before building a workaround.
- Anything forces a non-additive storage change - stop and confirm the migration.

## Priorities

- Zero-friction import (auto-parse, playable immediately) over metadata perfection.
- Honest degradation offline: import needs the network once; imported tracks then work
  offline like any custom track.

## Budget

- One PR arc (build + scenario + wiki), typical UAT-batch cadence after.

## Per-iteration context

- Re-read this spec + music/CLAUDE.md conventions (cache pair, storage law, CSS-external).
- The sync pipeline (scripts/playlist-sync.js) is PRIOR ART for id/title/hints handling -
  reuse its parsing decisions, do not re-derive.

## Variety-fill companion (behind the feature PR)

1. Compute the gap matrix (keys x genre x tempo) from the live catalog mechanically.
2. Author yt:null curated-search-query tracks per gap (existing mechanism, no ids to rot).
3. Operator curates a gap-filling YT playlist at leisure; the pipeline syncs + bakes it
   (real ids, his taste) - the same flow that shipped #322/#324.
