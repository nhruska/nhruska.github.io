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
var CACHE = 'music-v2';
var CORE = [
  './play/', './play/index.html', './play/manifest.webmanifest',
  './play/icon.svg', './play/icon-maskable.svg',
  './shared/songbook.js', './shared/tuner.js', './shared/diagram.js', './shared/audio.js',
  './shared/songbook.css', './shared/songs.json',
  './shared/profiles/manifest.json',
  './shared/profiles/ukulele-gcea.js', './shared/profiles/guitar-standard.js',
  './shared/profiles/guitar-dropd.js', './shared/profiles/guitar-openg.js',
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

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin) {
    // network-first: always fresh when online; cached copy only as offline fallback
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return caches.match(req); })
    );
  } else {
    // cross-origin (fonts/icons): cache-first, they rarely change
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && (res.status === 200 || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
          return res;
        }).catch(function () { return cached; });
      })
    );
  }
});
