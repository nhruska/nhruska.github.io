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
// S-DIM-SHAPES (2026-07-05, U21): v110->v111 - shared/shape-classify.js
// curated dim/dim7/aug templates (no new/removed CORE paths). check-cache-
// bump.sh re-verified against origin/main immediately before push.
// M-EAR wave 1.6 (2026-07-05, docs/plans/uat-walkthrough-20260704.md U14-U16,
// U20-U21 folded in): v111->v112 (rebased past #165's v110 AND #168's v111
// above - two sibling missions landed while this branch was in flight, max+1
// discipline both times) - new shared/legend.js (the fretboard dot-class
// Legend primitive, script-tagged in play/index.html right after diagram.js);
// new CORE path added below. shared/sound.js (playScale() gains
// handle.setTempo(), U14), shared/tracks.js/tracks.css/songbook.css change
// (the 3-stop tempo control, the Legend replacing the old target-caption
// prose, the U15 kx-sounding visibility harden - size/stroke/glow, the U20
// accent-derived kx/sound palette via CSS Relative Color Syntax), and
// shared/diagram.js/chord-pack-adapter.js change (the U21 chord-card
// label-slot height reserve - complements #168's shape-classify.js template
// curation above; a card can still be honest-null after #168 for a quality
// that isn't curated, and this keeps that card's height in sync with its
// row-mates regardless). check-cache-bump.sh re-verified against
// origin/main immediately before this push.
// M-DESIGN-ENFORCE wave 2 (2026-07-05, UAT U19): v112->v113 - shared/toast.js
// gains Toast.showAction()/.wirePauseOnTouch() (TOAST+ACTION undo primitive),
// shared/songbook.js/songbook.css (setlist + Compose Clear undo banners
// migrated onto it; .toastAction/.toastBar rules), play/index.html
// (Settings backup/restore native confirm()/alert() replaced with the
// app-styled Toast/Modal primitives). No new/removed CORE paths. Rebased
// past #165's v110 (M-TRACKLIB wave 2a), #168's v111 (S-DIM-SHAPES), AND
// #169's v112 (M-EAR wave 1.6, landed in parallel with the SAME v111->v112
// target - the exact identical-string collision A10/#117 guards against) -
// three sibling collisions while this branch was in flight (originally cut
// from v109) - max+1 discipline, same as every prior sibling collision;
// check-cache-bump.sh re-verified against origin/main immediately before
// push.
// S-REL-NAMES (2026-07-05, U23): v113->v114 - shared/solo-guide.js
// (framing()/card() gain an optional 3rd `root` arg + the relNames()
// resolver + {relMinor}/{relMajor} template tokens on pentMajor's framing
// line and shapes card), shared/tracks.js (renderGuide/select() pass
// th.key), shared/songbook.js (soloChipCaption gains an optional 2nd `root`
// arg, selectChip passes keyRoot). No new/removed CORE paths. check-cache-
// bump.sh re-verified against origin/main immediately before push.
// S-SET-INTEGRITY (2026-07-05, UAT U22): v114->v115 (max+1 over main's v114 -
// rebased past #174's S-REL-NAMES v114 bump, which landed while this branch
// was in flight) - shared/queue.js gains stepResolvable() (defensive
// queue-nav past a dangling setlist ref); shared/songbook.js gains
// pruneDanglingSetlist() (load-heal, runs at mount right after
// rebuildAll()), skipNoticeText(), the delete-heal TOAST+ACTION undo banner
// on deleteCustomItem (custom-song delete/fork-revert), and the queue-nav
// counter's "N removed song(s) skipped" notice (Practice + Stage). No
// new/removed CORE paths. check-cache-bump.sh re-verified against
// origin/main immediately before push.
// S-TOAST-HOST (2026-07-05, UAT U24): v115->v116 - shared/songbook.css only
// (`.setUndo[hidden]{display:none;}` - the missing CSS override for the
// setlist item-remove undo banner AND the Library delete-undo banner, both
// of which share the `.setUndo` class; `el.hidden = true` had zero visual
// effect without it, leaving a visible empty pill after every toast
// lifecycle completed). No JS logic changes, no new/removed CORE paths.
// check-cache-bump.sh re-verified against origin/main immediately before
// push.
// M-SETTINGS-CLARITY (2026-07-05, operator UAT): v116->v117 - TWO new CORE
// paths: shared/build-stamp.js (the authored version+freshness stamp - its
// VERSION mirrors THIS CACHE string, guard-locked by scripts/
// check-cache-bump.sh + test/build-stamp.test.js: bump one, bump both) and
// shared/accordion.js (the exclusive disclosure-group primitive). Also
// changed: play/index.html (Settings sheet: accordion sections, Done footer
// button, Backup/Restore as data rows with last-run meta, stamped meta
// line), play/triad-inversions.html (footer build stamp), shared/
// songbook.css (.accSec/.accBtn/.accBody family), shared/
// chord-pack-adapter.js (U25: shape labels big-render-only), shared/
// diagram.js (comment truth only), shared/backup.js (music.lastRestore.
// joins EXCLUDE). check-cache-bump.sh re-verified against origin/main
// immediately before push.
// M-SOLO-VIEW-UX (2026-07-05, operator UAT F12-F22): v117->v118 - no new
// CORE paths. Studio Solo view rework: shared/sound.js (playScale gains
// octaves/rootDwell opts, F17 - two-octave continuous run with a dwell on
// root hits; every existing caller that omits them is unaffected), shared/
// tracks.js (controls row - Play 44px/Speed cycling button/Guide `?`, F12/
// F13/F15; ONE notes rendering, F14; Guide card relocated below the
// fretboard, F18; fretboard always 0-12 frets, no Window|Full-neck toggle,
// F16; chords-in-key are name-only chips, one row, F19; the Find-a-jam
// panel consolidated into the stage's video/search affordance, F21), shared/
// tracks.css (controls-row/speed-button/chord-chip CSS; the S-LAYOUT-SSOT
// known-gap note on .bt-st-chords is RESOLVED-BY-REMOVAL, not fixed by the
// token block), shared/songbook.css (comment-only cross-ref update),
// play/index.html (Settings: the case-study write-up link removed, F22).
// check-cache-bump.sh re-verified against origin/main immediately before push.
// v119->v120 UNION MERGE (integration): M-GUIDANCE (#193, already on main) + M-LIB-UX (below) were each cut as v118->v119; rebumped to v120 here so both ship in one cache generation.
// M-GUIDANCE (2026-07-05, docs/plans/guidance-levels-spec-20260705.md):
// v118->v119 - ONE new CORE path: shared/guidance-level.js (the beginner|
// intermediate|advanced experience-level preference, music.guidanceLevel.v1 -
// script-tagged in play/index.html right after notables.js, which it grades
// claims against). Also changed: shared/notables.js (LEVELS gate on claim();
// 'guidanceask' + 6 new graded-tip consumerIds added to PRIORITY, relative
// order of the pre-existing 5 unchanged), shared/songbook.js
// (firstrunShouldRender level-threaded; new savebasicsShouldRender +
// renderSaveBasicsNotable; composeTpose/applyTab dispatch music:compose-
// transposed/music:tab-shown), shared/tracks.js (whynoteBanner level-
// threaded; new scaletipText/scaletipBanner), play/index.html (guidanceask
// ask card + Settings "Guidance level" plain-text row + tunefirst/
// composeintro/transposetip JIT banners). check-cache-bump.sh re-verified
// against origin/main immediately before push.
// M-LIB-UX (2026-07-05, operator UAT F23-F27): v118->v119 - no new CORE paths.
// Five Library/song-view/studio fixes: shared/repertoire-form.js + shared/
// songbook.js (F23, user-facing "Repertoire" -> "Library" - the Repertoire
// object/repertoire*.js filenames/localStorage keys are UNCHANGED, only the
// strings a user reads moved; F24, the song-view fork button + its dialog
// title/aria-label read "Edit" instead of "Make it mine" - fork/copy behavior
// unchanged), shared/list-item.js (F25, the no-in-app-video row action is
// REMOVED outright - a row with no curated video now shows no action at all,
// no external YouTube-search leave-the-app link), shared/songbook.css (F26,
// .li-title gains min-width:0 + overflow-wrap:break-word so a long/unspaced
// title wraps inside the card instead of overflowing behind the + button),
// shared/tracks.js (F27, the Studio's no-video paste-URL box is no longer
// permanently visible next to the "Find a jam" trigger - it now shares that
// SAME toggle, one button opens both the direct-paste and genre/feel-search
// paths). check-cache-bump.sh re-verified against origin/main immediately
// before push.
// S-SONGTRAY-BOUND (2026-07-15): v158->v159 - shared/songbook.css only. [main #252]
// S-SETROW-CONTRAST (2026-07-16): v159->v161 - play/index.html .setRow. [main #254]
// S-SONG-MODE (2026-07-16): v161->v162 (max+1 over main's v161 after #252/#254
// landed) - shared/songbook.js + shared/songbook.css: Compose splits into two
// full-screen views behind a top-level Chords|Song toggle (docs/
// SONG-MODE-DESIGN.md); the M-13 builder moves onto a Song canvas with playable
// section cards, Save-song naming, the guided template loop, 3 UAT rounds
// (Save-asks / clear-on-capture / dismissible cues) + save-to-setlist-#1.
// No new/removed CORE paths.
var CACHE = 'music-v167';
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
  // build-stamp.js: M-SETTINGS-CLARITY - the authored version + freshness
  // stamp; script-tagged in play/index.html (after toast.js) AND in
  // play/triad-inversions.html. Its VERSION mirrors CACHE above.
  './shared/build-stamp.js',
  // accordion.js: M-SETTINGS-CLARITY - the exclusive disclosure-group
  // primitive; script-tagged in play/index.html right after build-stamp.js.
  './shared/accordion.js',
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
  './shared/list-item.js', './shared/repertoire.js', './shared/song-templates.js', './shared/competency.js', './shared/repertoire-form.js',
  // yt-info.js: M-TRACKLIB wave 2a (U17) - script-tagged in play/index.html
  // right after repertoire-form.js (see the CACHE-bump comment above).
  './shared/yt-info.js',
  './shared/songbook.js', './shared/tuner.js', './shared/diagram.js',
  // legend.js: M-EAR wave 1.6 (U16) - the fretboard dot-class Legend
  // primitive, script-tagged in play/index.html right after diagram.js.
  './shared/legend.js',
  './shared/notables.js',
  // guidance-level.js: M-GUIDANCE (2026-07-05) - script-tagged in
  // play/index.html right after notables.js, which it grades claims against.
  './shared/guidance-level.js',
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
