/* =====================================================================
 * sw.js  -  service worker for the Music app (offline + installable)
 * ---------------------------------------------------------------------
 * Lives at /music/ so its scope covers BOTH /music/play/ (the app shell)
 * and /music/shared/ (the engine, profiles and song catalog). Paths are
 * RELATIVE to this file, so the same worker works on the live site and on
 * githack preview URLs.
 *
 * Strategy: stale-while-revalidate for same-origin GETs (instant + offline,
 * refreshes in the background), cache-first for cross-origin (fonts). Bump
 * CACHE to roll out a new precache.
 * ===================================================================== */
'use strict';
var CACHE = 'music-v3';
var CORE = [
  './backing-tracks/', './backing-tracks/index.html', './backing-tracks/tracks.json', './backing-tracks/app.js',
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
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        // refresh the cache in the background (fonts included via opaque/cors)
        var network = fetch(req).then(function (res) {
          if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(function () { return cached; });
        // serve cache instantly when we have it; otherwise wait for the network
        return cached || network;
      });
    })
  );
});
