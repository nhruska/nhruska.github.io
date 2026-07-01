# music/dev

Developer tools for the music app (not linked from the app UI).

## Keeping the shipped songbook current from your own curation

The app saves your composed songs, saved backing tracks, and curated YouTube URLs
in the browser's localStorage - per device. To fold that curation back into the
shipped data (`music/shared/songs.json` + `music/backing-tracks/tracks.json`) so new
installs get it, use this two-step, re-runnable workflow.

### 1. Export (on the device that holds your curation)

Open [export-data.html](export-data.html) on that browser (same origin as the app -
`.../music/dev/export-data.html`). It reads three stores and downloads one bundle:

| localStorage key | Exported as | Shipped to |
|---|---|---|
| `roadcase-<profile>.custom.v1` | `customSongs` | songs.json |
| `bt.custom.v1` | `customTracks` | tracks.json |
| `music.trackUrls.v1` | `trackUrls` | fills `yt` on existing tracks |

Device prefs (setlist, last-opened, perform prefs) are deliberately NOT exported.
Export from each device you curated on - the merge accepts several bundles at once.

### 2. Merge (on your machine, in the repo)

```
node music/dev/merge-localstorage.js <downloaded-bundle>.json [<more>.json ...]
```

- Dedups: songs on normalized title+artist (`repertoire.matchKey`), tracks on
  `tracks.trackKey`. A curated URL fills `yt` only on a track that has none.
- Idempotent: re-running with the same bundle changes nothing.
- Preserves the files' 2-space formatting, so `git diff` shows only real additions.

Review the diff, then commit. New installs now ship with your additions.
