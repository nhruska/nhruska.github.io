# Offline PWA

[Wiki](../index.md) > systems > Offline PWA

## Purpose

Service-worker caching strategy, the CACHE-bump discipline, and offline degradation.

## Worker + lifecycle [STABLE]

music/sw.js lives at /music/ so its scope covers play/ + shared/ + backing-tracks/. Install: `caches.open(CACHE).addAll(CORE)` + skipWaiting (a failed CORE fetch fails the whole install). Activate: delete every cache except the current CACHE name + clients.claim.

## CORE precache [STABLE]

The CORE list (sw.js:15-34): app shells + manifest + icons + triad-inversions.html + ALL shared runtime js/css + songs.json + backing-tracks/tracks.json + every profile + notables.js. Anything listed here is precached at install and served from cache when offline.

## Fetch strategy [STABLE]

- **Same-origin: network-first.** Fresh when online (200s re-cached in the background); cache fallback offline; offline navigation cache-misses fall back to the app shell (./play/). Why: songs.json/tracks.json are mutable - online users must see the latest.
- **Cross-origin: cache-first** (fonts/icons rarely change), network fallback, opaque responses cached.
- Skips non-GET, non-http(s), and range requests (media byte-ranges go straight to the browser).

## CACHE-bump discipline (the law) [STABLE]

**Touch ANY CORE-listed file -> bump `CACHE = 'music-vN'` in the SAME commit** (music/CLAUDE.md:31). Skipping the bump means returning users keep serving the old precache until they manually clear it - invisible until it isn't. Current: music-v78 (post sprint 1). Parallel-PR coordination: each PR bumps; merge conflicts resolve max+1 (sprint amendment A10).

## Version introspection [STABLE]

The worker answers `{type:'GET_VERSION'}` messages with its CACHE tag (sw.js message handler); Settings' bottom meta line shows it - the user-visible proof of which build is actually installed.

## Offline degradation [STABLE]

Fully functional offline: library/sheets/compose/tuner/diagrams are local; the precached catalogs serve. Only online dependency: YouTube playback (explicit tap; search fallback). Known symptom: the "must be served over http(s)" boot banner also fires on a dead preview link (manifest fetch failure) - suspect an expired commit-pinned githack link before suspecting the serving scheme (music/CLAUDE.md:51).

---

**Anchors verified:** sw.js:11-92 (CACHE, CORE, install/activate/message/fetch), music/CLAUDE.md:31,51, docs/plans/ux-sprint-1-20260703.md A10
