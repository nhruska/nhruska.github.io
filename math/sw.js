/* =====================================================================
 * sw.js  -  service worker for the Math app (offline + installable PWA)
 * ---------------------------------------------------------------------
 * Scope is /math/. Paths are relative to this file, so the same worker
 * serves the live site and githack preview URLs. Also precaches the small
 * set of music/shared/ primitives Math links directly (theme.js, esc.js,
 * toast.js, songbook.css) so an offline install has them too.
 *
 * Fetch strategy: same as music/sw.js - network-first for same-origin GETs
 * (fresh whenever online, falling back to the precache past a deadline),
 * cache-first for cross-origin assets (fonts).
 *
 * Versioning: CACHE mirrors MATH_VERSION (math/version.js), set to the PR
 * number (math-v<PR#>) so the live build maps 1:1 to its PR. Bump
 * MATH_VERSION in any commit that changes a CORE-precached file.
 * ===================================================================== */
'use strict';
importScripts('version.js');
var CACHE = self.MATH_VERSION;
// Everything precached for offline use. Every math/*.js the app loads, plus
// the music/shared/ primitives math/index.html script-tags, must appear here
// or an offline install 404s on it.
var CORE = [
  './', './index.html', './app.js', './engine.js', './store.js', './math.css',
  './version.js', './manifest.webmanifest', './icon.svg',
  '../music/shared/songbook.css', '../music/shared/theme.js',
  '../music/shared/esc.js', '../music/shared/toast.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // Only ever touch OUR OWN caches (the 'math-' family) - the origin also
      // hosts the Music app's 'music-' caches, and wiping those on Math's
      // activate would silently evict Music's offline install.
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('math-') === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Answer the app's "which build am I actually running?" query.
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'GET_VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ type: 'VERSION', version: CACHE });
  }
});

// Same deadline as music/sw.js: generous for a healthy connection, short
// enough that a dead one never strands the user on a spinner.
var NET_DEADLINE_MS = 3500;
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (!/^https?:/.test(req.url)) return;         // skip chrome-extension: etc. (cache.put would throw)
  if (req.headers.has('range')) return;          // let the browser handle media byte-range itself
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin) {
    e.respondWith(
      // ignoreSearch: a future `?v=<VERSION>` cache-buster on a local asset is
      // not part of the resource identity - CORE precaches the bare paths.
      caches.match(req, { ignoreSearch: true }).then(function (cached) {
        var netP = fetch(req).then(function (res) {
          if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
          return res;
        });
        var answered = netP.catch(function () {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./').then(function (shell) { return shell || caches.match('./index.html'); });
          return Response.error();
        });
        if (!cached) return answered;
        e.waitUntil(netP.catch(function () {}));
        return Promise.race([
          answered,
          new Promise(function (resolve) { setTimeout(function () { resolve(cached); }, NET_DEADLINE_MS); })
        ]);
      })
    );
  } else {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        var netP = fetch(req).then(function (res) {
          if (res && (res.status === 200 || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
          return res;
        }).catch(function () { return Response.error(); });
        e.waitUntil(netP.catch(function () {}));
        return Promise.race([
          netP,
          new Promise(function (resolve) { setTimeout(function () { resolve(Response.error()); }, NET_DEADLINE_MS); })
        ]);
      })
    );
  }
});
