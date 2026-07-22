/* =====================================================================
 * sw.js  -  service worker for the Music app (offline + installable PWA)
 * ---------------------------------------------------------------------
 * Scope is /music/, covering both /music/play/ (the app shell) and
 * /music/shared/ (the engine, profiles, and song catalog). Paths are
 * relative to this file, so the same worker serves the live site and
 * githack preview URLs.
 *
 * Fetch strategy: network-first for same-origin GETs (you get the latest
 * whenever you have signal, falling back to the precache when offline),
 * cache-first for cross-origin assets (fonts, icons).
 *
 * Versioning: CACHE is the deploy version, set to the PR number
 * (music-v<PR#>) so the live build maps 1:1 to its PR. Bump CACHE - and the
 * paired VERSION in shared/build-stamp.js - in any commit that changes a
 * CORE-precached file; scripts/check-cache-bump.sh enforces the pair. Past
 * cache-bump history lives in git log + engineering-wiki/change-history.md.
 * ===================================================================== */
'use strict';
var CACHE = 'music-v296';
// Everything precached for offline use. Every shared/*.js that play/index.html
// or play/triad-inversions.html script-tags MUST appear here, or an offline
// install 404s on it (test/sw-verify.test.js guards this). The list order is
// cosmetic - the browser loads by the HTML script order, documented in
// engineering-wiki/systems/runtime-architecture.md.
var CORE = [
  './', './index.html',
  // Live data source for the Tracks tab (the standalone backing-tracks page was retired; its data stays).
  './backing-tracks/tracks.json',
  './play/', './play/index.html', './play/manifest.webmanifest',
  './play/icon.svg', './play/icon-maskable.svg',
  // The chord-inversions deep-dive walkthrough, linked from the Compose tab; precached so it works offline too.
  './play/triad-inversions.html',
  // The one HTML-escape util - loaded before every shared/*.js consumer in both HTML entry points.
  './shared/esc.js',
  './shared/toast.js',
  // The authored version + freshness stamp; its VERSION mirrors CACHE above.
  './shared/build-stamp.js',
  './shared/accordion.js',
  // Versioned localStorage boot-migration runner; loaded before every other shared/*.js consumer.
  './shared/storage-migrate.js',
  './shared/shape-classify.js',
  './shared/diagram-pref.js',
  './shared/nav-history.js',
  './shared/solo-guide.js',
  './shared/circle.js', './shared/key-explorer.js', './shared/queue.js', './shared/tracks-model.js', './shared/studio-theory.js', './shared/tracks.js', './shared/candidates.js',
  './shared/chord-pack-adapter.js', './shared/sugg.js',
  './shared/list-item.js', './shared/repertoire.js', './shared/song-templates.js', './shared/competency.js',
  './shared/skill-md.js', './shared/zip-store.js',
  './shared/repertoire-form.js',
  './shared/yt-info.js',
  './shared/theory.js', './shared/suggest-model.js', './shared/sheet-render.js', './shared/song-model.js', './shared/songbook.js', './shared/tuner.js', './shared/diagram.js',
  './shared/legend.js',
  './shared/notables.js',
  './shared/guidance-level.js',
  './shared/callouts.js',
  './shared/chord-collapse.js',
 './shared/theme.js', './shared/audio.js',
  './shared/sound.js',
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

// The bars-but-no-data deadline (see the same-origin handler below). 3.5s is
// generous for a healthy connection's HTML/JS answer and short enough that a
// dead one never strands the user on a spinner.
var NET_DEADLINE_MS = 3500;
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (!/^https?:/.test(req.url)) return;         // skip chrome-extension: etc. (cache.put would throw)
  if (req.headers.has('range')) return;          // let the browser handle media byte-range itself
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin) {
    // network-first WITH a cache-fallback deadline. True offline makes fetch()
    // REJECT fast and the catch-fallback below always worked - but a phone
    // that "lost internet" usually has bars-with-no-data, where fetch()
    // neither succeeds nor rejects for tens of seconds and the app hangs on
    // a spinner. When a cached copy exists, the network now gets
    // NET_DEADLINE_MS to answer; past that the cache serves IMMEDIATELY and
    // the (eventual) network response still refreshes the cache in the
    // background for next load. A cache MISS still waits for the network in
    // full - there is nothing to fall back to, and first-visit installs must
    // not be time-boxed. Fresh-when-online is preserved: a healthy network
    // answers well inside the deadline.
    e.respondWith(
      caches.match(req).then(function (cached) {
        var netP = fetch(req).then(function (res) {
          if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
          return res;
        });
        var answered = netP.catch(function () {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./play/').then(function (shell) { return shell || caches.match('./play/index.html'); });
          return Response.error();
        });
        if (!cached) return answered;
        // Keep the worker alive past the race so the background cache
        // refresh from a late network answer still lands.
        e.waitUntil(netP.catch(function () {}));
        return Promise.race([
          answered,
          new Promise(function (resolve) { setTimeout(function () { resolve(cached); }, NET_DEADLINE_MS); })
        ]);
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
