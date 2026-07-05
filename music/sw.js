/* =====================================================================
 * sw.js  -  service worker for the Music app (offline + installable)
 * ---------------------------------------------------------------------
 * Lives at /music/ so its scope covers BOTH /music/play/ (the app shell)
 * and /music/shared/ (the engine, profiles and song catalog). Paths are
 * RELATIVE to this file, so the same worker works on the live site and on
 * githack preview URLs.
 *
 * Strategy: network-first for same-origin GETs (you always get the latest
 * when you have signal; falls back to cache when offline), cache-first for
 * cross-origin (fonts/icons). Bump CACHE to roll out a new precache.
 * ===================================================================== */
'use strict';
// A10 (parallel-conflict resolution): W3a bumped v82->v83, W3b (merged first,
// #117) bumped v82->v84 in parallel - max+1 of the two.
// S-STUDIO-POLISH (2026-07-04): v85->v86 - pager touch-floor/disabled-fade fix,
// per-class kx-chord/kx-blue text ink, shortened Studio link labels.
// S-HARDEN (2026-07-04): v86->v87 - adds shared/esc.js (new shared module,
// A5); ALSO backfills 3 pre-existing CORE gaps the new verify script
// (test/sw-verify.test.js, A6) caught on its first run - shared/list-item.js,
// shared/repertoire.js and shared/repertoire-form.js are all loaded by
// play/index.html's script order but had never been precached, so an install
// before ever having gone online would 404 on those files offline.
// S-CHIPS-PLUS (2026-07-04): v88->v90 - shared/songbook.js and
// shared/songbook.css changed (Mixolydian chip + degrees line in the Compose
// solo preview). Bumped past v89 (known in-flight on a sibling agent's
// branch, S-BACKUP-NUDGE) to avoid the identical-string collision the v83
// incident (PR #117) caught - check-cache-bump.sh re-verified against
// origin/main immediately before push.
// S-BLUES-BOXES (2026-07-04): v90->v91 - key-explorer.js/tracks.js/tracks.css
// change (named Box 1-5 positions on the Studio scale pager), rebased onto
// the v90 tip above (this branch originally cut from v88, before #130/#131
// landed) - no new CORE paths, but the discipline is "bump on any
// shared/play diff" regardless. check-cache-bump.sh re-verified against
// origin/main immediately before push.
// S-DIAGRAM-PREF step 0 (2026-07-05): v91->v92 - adds shared/shape-classify.js
// (new shared module, the shape classifier). Cut from the fresh origin/main
// tip (e763c37) after re-pinning past the S-BACKUP-NUDGE/S-CHIPS-PLUS/
// S-PROG-WRAP/S-BLUES-BOXES bumps that landed while this branch was in
// flight - re-verify max+1 against origin/main immediately before push if
// any further sibling CACHE bump lands first.
// S-COMPOSE-POLISH2 (2026-07-04): v92->v93 - buildGrid tile geometry clamps
// (UAT U5), quality-filter scroll anchor (U6), solo-CTA choice row promoted
// to the composeModalBackdrop modal pattern (U7). Rebased onto the v92 tip
// above (this branch originally cut from v88, before #129/#130/#131/#132/
// #133/#134 landed) - no new/removed CORE paths. check-cache-bump.sh
// re-verified against origin/main immediately before push.
// S-EXTRACT (2026-07-05): v93->v94 - two NEW CORE paths: shared/
// chord-pack-adapter.js + shared/sugg.js (buildAdapter + the chord-
// suggestion map extracted out of play/index.html's inline bootstrap,
// analysis-refactor-enhance-20260704 A3/A7). Rebased past #134's v92 AND
// #136's v93 (two sibling collisions in a row while this branch was in
// flight; same A10/#117 max+1 discipline each time) - check-cache-bump.sh
// re-verified against origin/main immediately before push.
// M-6 STORAGE-MIGRATE (2026-07-04): ->v95 (max+1 over main's v94) - new shared/storage-migrate.js
// (versioned localStorage boot migration runner, gh #76/#77), script-tagged
// in play/index.html - new CORE path. check-cache-bump.sh re-verified
// against origin/main immediately before push.
// S-BACKUP-INTEGRATE (2026-07-04): v95->v96 - shared/backup.js changes only
// (restore() now replays StorageMigrate.run(), tri.* joins OWNED_PREFIXES,
// music.schema.version stays in the envelope on purpose - M-6 follow-ups
// #1/#2/#3). No new/removed CORE paths. check-cache-bump.sh re-verified
// against origin/main immediately before push.
// docs(storage-migrate) header-note follow-up: ->v97, no code change.
// S-PROG-WRAP (2026-07-04, UAT U8): v97->v98 - shared/songbook.js and
// shared/songbook.css change (progression strip degrades to the existing
// compact chord token + flex-wraps past the diagram-row overflow threshold).
// Rebased past #137's v94, #135's v95, #138's v96 AND #139's v97 (four
// sibling collisions landed while this branch was in flight; originally cut
// from #136's v93) - no new/removed CORE paths. check-cache-bump.sh
// re-verified against origin/main immediately before push.
// S-DIAGRAM-PREF steps 1-2 (2026-07-06): v98->v99 (max+1 over main's v98,
// rebased a second time past #137/#135/#138/#139/#140/#141 which landed
// while this branch was in flight) - adds shared/diagram-pref.js (new
// shared module, the dots|patterns pref + label decision); diagram.js and
// notables.js also changed (opts.patternLabel/notifyRendered(), the
// 'diagrampref' priority slot) and play/index.html changed (the notable
// prompt + Settings row wiring; the adapter wiring lives in shared/
// chord-pack-adapter.js post-S-EXTRACT rebase). check-cache-bump.sh
// S-TOAST (2026-07-05): v98->v99 - new CORE path shared/toast.js (the
// shared per-host toast timer primitive, UAT U9 fix - see songbook.js
// showToast/showComposeToast). Rebased past #141's v98 (S-PROG-WRAP landed
// while this branch was in flight; originally cut at v97) - max+1 discipline,
// same as every prior sibling collision above. check-cache-bump.sh
// re-verified against origin/main immediately before push.
// S-LAYOUT-SSOT (2026-07-04): v98->v99 - songbook.css gains the chord-tile/
// diagram geometry token block (:root --dg-canvas-w/--tile-min/--tile-gap/
// --prog-tile-min), tracks.css gains a documentation comment (no rule
// change), diagram.js gains a cross-reference comment (no metric change) -
// CACHE bump per the CORE-vs-diff discipline even though no new CORE path
// was added (an already-precached file's CONTENT changed). Rebased past
// #141's v98 (this branch originally cut from #135's v95) - no new/removed
// CORE paths. check-cache-bump.sh re-verified against origin/main
// immediately before push.
// S-PROG-WRAP-2 (2026-07-04, UAT U8b): v98->v99 - shared/songbook.js and
// shared/songbook.css change again (the binary full/compact split becomes a
// count-driven 3-stage density ladder: full <=4, fill-row 5-6, grid6 7-12).
// No new/removed CORE paths.
// S-NAVHIST (2026-07-04, PR #144 finding): v104->v105 - shared/songbook.js
// changes only (openSoloChoiceRow/openSaveNameRow's Save/Skip/backdrop/Escape
// now route through NavHistory.settleAfter() directly instead of
// NavHistory.dismiss(), fixing the "Solo over it -> Skip on a never-saved
// progression" double-pop bug - the Studio, and the save-name row one step
// earlier, used to flash open then immediately close). No new/removed CORE
// paths. check-cache-bump.sh re-verified against origin/main immediately
// before push.
// M-EAR wave 1 (2026-07-04): v105->v106 - new shared/sound.js (the scale/mode
// audition provider, script-tagged in play/index.html right after audio.js);
// shared/tracks.js, shared/songbook.js, shared/tracks.css, shared/songbook.css
// all change (the play/stop toggle + bouncing .sounding marker on the Studio
// scale panel and the Compose key preview). New CORE path added below.
// check-cache-bump.sh re-verified against origin/main immediately before push.
// M-TRACKLIB wave 1 (2026-07-04): v106->v107 - new shared/jam-queries.js (the
// curated genre x feel jam-discovery query data, script-tagged in
// play/index.html right after sound.js); shared/tracks.js/tracks.css change
// (the Studio's "Find a jam" explore panel + prefilled add-to-library
// handoff). New CORE path added below. check-cache-bump.sh re-verified
// against origin/main immediately before push.
// M-EAR wave 1.5 (2026-07-04): v108->v109 - shared/sound.js (playScale()
// gains handle.retarget(), U11), shared/key-explorer.js (boxWrap.setSounding()
// class-swap + opts.noPosCtrl + exported POS_CAP, U12/U13), shared/diagram.js
// (every scale-fretboard dot gains a data-pc attribute, U12 - deliberate,
// reviewed change to the tones-absent SHA-256 lock in diagram.dom.test.js),
// shared/tracks.js/tracks.css change (seamless chip-switch audition,
// fretboard sounding lights, Window|Full-neck view toggle). No new/removed
// CORE paths. check-cache-bump.sh re-verified against origin/main
// immediately before push.
// M-TRACKLIB wave 2a (2026-07-05, U17): v109->v110 - new shared/yt-info.js
// (keyless YouTube oEmbed lookup + title-hint parsing, script-tagged in
// play/index.html right after repertoire-form.js); shared/repertoire-form.js/
// repertoire-form.css change (the Video URL field's paste/blur YT-prefill
// suggest row). New CORE path added below. check-cache-bump.sh re-verified
// against origin/main immediately before push.
var CACHE = 'music-v110';
var CORE = [
  './', './index.html',
  // tracks.json is the live data source for the play app's Tracks tab (the standalone
  // backing-tracks page was retired; its index.html/app.js are gone, data stays).
  './backing-tracks/tracks.json',
  './play/', './play/index.html', './play/manifest.webmanifest',
  './play/icon.svg', './play/icon-maskable.svg',
  // triad-inversions.html is the deep-dive walkthrough linked from the Compose tab.
  // Precaching keeps it available offline alongside the rest of the play surface.
  './play/triad-inversions.html',
  // esc.js: the ONE HTML-escape util (S-HARDEN A5) - loaded before every
  // shared/*.js consumer in both play/index.html and play/triad-inversions.html.
  './shared/esc.js',
  // toast.js: S-TOAST (UAT U9) - shared per-host toast timer primitive,
  // script-tagged in play/index.html right after esc.js.
  './shared/toast.js',
  // storage-migrate.js: versioned localStorage boot migration runner (M-6),
  // loaded first in play/index.html (before every other shared/*.js consumer).
  './shared/storage-migrate.js',
  // shape-classify.js: S-DIAGRAM-PREF step 0 (2026-07-05) - script-tagged in
  // play/index.html before diagram.js; precached here so it's available
  // offline from install, matching the S-HARDEN A6 discipline above.
  './shared/shape-classify.js',
  // diagram-pref.js: S-DIAGRAM-PREF steps 1-2 (2026-07-06) - script-tagged in
  // play/index.html between shape-classify.js and diagram.js; precached here
  // for the same offline-from-install reason.
  './shared/diagram-pref.js',
  './shared/nav-history.js',
  // M-GUIDE W3a: solo-guide.js loads before songbook.js/tracks.js (index.html script
  // order) - both W3a's Studio and W3b's Compose solo chips call it.
  './shared/solo-guide.js',
  './shared/circle.js', './shared/key-explorer.js', './shared/queue.js', './shared/tracks.js', './shared/candidates.js',
  // chord-pack-adapter.js/sugg.js: S-EXTRACT (A3/A7) - script-tagged in
  // play/index.html right after candidates.js (see the CACHE-bump comment above).
  './shared/chord-pack-adapter.js', './shared/sugg.js',
  // list-item.js/repertoire.js/repertoire-form.js: S-HARDEN A6 backfill - all
  // 3 are script-tagged in play/index.html but were missing from CORE (see
  // the CACHE-bump comment above).
  './shared/list-item.js', './shared/repertoire.js', './shared/repertoire-form.js',
  // yt-info.js: M-TRACKLIB wave 2a (U17) - script-tagged in play/index.html
  // right after repertoire-form.js (see the CACHE-bump comment above).
  './shared/yt-info.js',
  './shared/songbook.js', './shared/tuner.js', './shared/diagram.js',
  './shared/notables.js',
 './shared/theme.js', './shared/audio.js',
  // sound.js: M-EAR wave 1 - the scale/mode audition provider, script-tagged
  // in play/index.html right after audio.js.
  './shared/sound.js',
  // jam-queries.js: M-TRACKLIB wave 1 - curated genre x feel jam-discovery
  // query data, script-tagged in play/index.html right after sound.js.
  './shared/jam-queries.js',
  './shared/backup.js',
  './shared/songbook.css', './shared/tracks.css', './shared/songs.json',
  './shared/profiles/manifest.json',
  './shared/profiles/ukulele-gcea.js', './shared/profiles/guitar-standard.js',
  './shared/profiles/cigarbox-dgbd.js', './shared/profiles/banjo-gdgbd.js',
  './shared/profiles/mandolin-gdae.js', './shared/profiles/mandola-cgda.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Answer the app's "which build am I actually running?" query. The controlling
// worker replies with its CACHE tag, so Settings can show whether the installed
// PWA has picked up the latest push or is still serving an older precache.
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'GET_VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: CACHE });
  }
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (!/^https?:/.test(req.url)) return;         // skip chrome-extension: etc. (cache.put would throw)
  if (req.headers.has('range')) return;          // let the browser handle media byte-range itself
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin) {
    // network-first: always fresh when online; cached copy only as offline fallback.
    // On a cache miss offline (e.g. a deep link with ?p=…), fall back to the app
    // shell so a navigation still renders instead of a dead network error.
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./play/').then(function (shell) { return shell || caches.match('./play/index.html'); });
          return Response.error();
        });
      })
    );
  } else {
    // cross-origin (fonts/icons): cache-first, they rarely change
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && (res.status === 200 || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
          return res;
        }).catch(function () { return cached; });
      })
    );
  }
});
