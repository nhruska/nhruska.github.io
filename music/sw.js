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
// S-BACKUP-NUDGE (2026-07-04): v88->v89 - backup-staleness nudge; no new CORE
// files (backup.js/notables.js were already precached), just content changes
// to shared/backup.js, shared/notables.js, and play/index.html.
var CACHE = 'music-v89';
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
  './shared/nav-history.js',
  // M-GUIDE W3a: solo-guide.js loads before songbook.js/tracks.js (index.html script
  // order) - both W3a's Studio and W3b's Compose solo chips call it.
  './shared/solo-guide.js',
  './shared/circle.js', './shared/key-explorer.js', './shared/queue.js', './shared/tracks.js', './shared/candidates.js',
  // list-item.js/repertoire.js/repertoire-form.js: S-HARDEN A6 backfill - all
  // 3 are script-tagged in play/index.html but were missing from CORE (see
  // the CACHE-bump comment above).
  './shared/list-item.js', './shared/repertoire.js', './shared/repertoire-form.js',
  './shared/songbook.js', './shared/tuner.js', './shared/diagram.js',
  './shared/notables.js',
 './shared/theme.js', './shared/audio.js', './shared/backup.js',
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
