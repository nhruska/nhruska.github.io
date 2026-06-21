# Backing Tracks - Phase 1 plan (finder + Stage view)

> Scope: the daily-habit hook. Genre x key -> curated shortlist, theory key
> expansion, smart-search fallback, save-to-curate, and a strip-down Stage view.
> No circle of fifths, no nudge engine (those are Phases 2-3). Design context:
> [DESIGN.md](DESIGN.md).

Static, no build, vanilla JS, reuse `music/shared/`. Verification bar (repo
CLAUDE.md): `node -c` changed JS, `JSON.parse` the catalog, unit-test logic in
Node. No headless browser - eyeball the githack preview the PR posts.

## Seed data (done)

[tracks.json](tracks.json) - 8 entries drawn from the Phish / Bob Marley /
Beatles songs already in `music/shared/songs.json`. Each has `yt: null`, so it
uses the smart-search fallback until a real backing-track id is curated. BPMs are
estimates; correct as needed. Schema is the [DESIGN.md](DESIGN.md) sketch plus an
`artist` field.

## Atomic tasks (ordered by dependency)

Tasks T1-T2 are the spine; T3-T7 each hang off T2 and are individually
shippable. They all touch the one new `index.html`, so do them sequentially on
this branch (bundle, do not swarm - reviewer-fatigue + shared-file conflicts).

### T1 - App shell + wiring
- Create `music/backing-tracks/index.html` - app shell loading
  `../shared/songbook.css` (theme) + the new page script via classic `<script>`.
- Add a card to the `PROJECTS` array in `music/index.html`
  (`path: "backing-tracks/"`), text colour set explicitly (the `<button>`
  colour-inheritance gotcha from the repo CLAUDE.md).
- Add the new paths to the PWA precache list in `music/sw.js`.
- Accept: page loads over https, dark theme applied, reachable from the Music
  launcher. Verify: `node -c` any inline-extracted JS; eyeball preview.

### T2 - Finder (genre x key -> results)
- Fetch + `JSON.parse` `tracks.json`. Render a genre picker (distinct `genre`
  values) and a key picker (12 roots; reuse `Songbook.ROOTS`).
- Filter to matching entries; render result cards (title, artist, key, bpm).
- Accept: picking genre + key shows the right subset; empty state is graceful.
- Verify: Node unit test of the filter function over the seed; eyeball preview.

### T3 - Theory key expansion
- Helper: given a selected key, also match its relative + parallel keys (reuse
  `Songbook` transpose/root math). A `C major` track surfaces for `A minor`.
- Surface expanded matches as a secondary group ("also works in your key").
- Accept: selecting A minor includes the C-major seed entries, labelled.
- Verify: Node unit test of the expansion map (A minor -> {A, C, ...}).

### T4 - Smart-search fallback (the degrade path)
- Pure function: build a deterministic YouTube search URL from an entry or the
  current genre+key (`"<artist> <title> backing track"`, or
  `"<genre> backing track in <key> <bpm>bpm"`).
- For `yt: null` entries and a standing "search more" button, open that URL.
- Accept: every seed entry opens a sensible YouTube search in one tap, offline-safe.
- Verify: Node unit test asserting URL shape for a few inputs.

### T5 - YouTube playback (online only)
- For entries with a real `yt` id, embed the IFrame Player API inline; play in
  place. Offline or `yt: null` -> fall back to T4.
- Accept: a test entry with a real id plays in-app; offline shows the fallback.
- Verify: eyeball preview online; confirm offline path with `yt: null` seeds.

### T6 - Save-to-curate (the compounding loop)
- "Add track" form: paste a YouTube URL -> extract the id; best-effort parse
  key/genre/bpm from the title (regex heuristics) -> append to a localStorage
  overlay merged over `tracks.json` on load.
- Accept: a saved track appears in results next session; overlay survives reload.
- Verify: Node unit test of the URL-id + title-parse heuristics.

### T7 - Stage view (strip-down)
- A toggle that strips the finder to: favorites + recently-played, huge tap
  targets, two taps to play. Reuse the Perform-mode pattern (stage-dim). No
  teaching, no network in the critical path beyond the explicit play tap.
- Accept: from Stage view, key -> track -> play is two taps; nothing to read.
- Verify: eyeball preview at phone width (375px).

## Guardrail checks before the Phase-1 PR is ready

- Stage view: no blocking network on the path to a curated entry.
- Bundle stays one surface + one toggle (no dashboard creep).
- `JSON.parse(tracks.json)` clean; every `key` matches `^[A-G][#b]?$`.
- AI-tells validator clean on any new human-facing copy.

## Out of scope (later phases)

- Circle of fifths / key explorer (Phase 2 - the soul).
- Gentle nudge engine (Phase 3).
- Record-over (cut; optional sync-free discovery memo only if it earns its place).
