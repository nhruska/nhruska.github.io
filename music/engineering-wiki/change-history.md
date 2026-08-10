# Change History (archived)

[Wiki](index.md) · This file holds long-form historical logs moved out of the code per the [codebase readability standard](workflows/codebase-readability.md). It is a traceability archive, not a live document - the authoritative history is **git log**, and the durable "why" of decisions is [decisions.md](decisions.md).

## Service-worker cache-bump log (pre 2026-07-20)

Archived from `music/sw.js`. As of 2026-07-20 the cache version equals the PR number (`music-v<PR#>`), so past bumps are traceable through git and PRs; this log is kept only for the earlier sequential-version era.

```
A10 (parallel-conflict resolution): W3a bumped v82->v83, W3b (merged first,
#117) bumped v82->v84 in parallel - max+1 of the two.
S-STUDIO-POLISH (2026-07-04): v85->v86 - pager touch-floor/disabled-fade fix,
per-class kx-chord/kx-blue text ink, shortened Studio link labels.
S-HARDEN (2026-07-04): v86->v87 - adds shared/esc.js (new shared module,
A5); ALSO backfills 3 pre-existing CORE gaps the new verify script
(test/sw-verify.test.js, A6) caught on its first run - shared/list-item.js,
shared/repertoire.js and shared/repertoire-form.js are all loaded by
play/index.html's script order but had never been precached, so an install
before ever having gone online would 404 on those files offline.
S-CHIPS-PLUS (2026-07-04): v88->v90 - shared/songbook.js and
shared/songbook.css changed (Mixolydian chip + degrees line in the Compose
solo preview). Bumped past v89 (known in-flight on a sibling agent's
branch, S-BACKUP-NUDGE) to avoid the identical-string collision the v83
incident (PR #117) caught - check-cache-bump.sh re-verified against
origin/main immediately before push.
S-BLUES-BOXES (2026-07-04): v90->v91 - key-explorer.js/tracks.js/tracks.css
change (named Box 1-5 positions on the Studio scale pager), rebased onto
the v90 tip above (this branch originally cut from v88, before #130/#131
landed) - no new CORE paths, but the discipline is "bump on any
shared/play diff" regardless. check-cache-bump.sh re-verified against
origin/main immediately before push.
S-DIAGRAM-PREF step 0 (2026-07-05): v91->v92 - adds shared/shape-classify.js
(new shared module, the shape classifier). Cut from the fresh origin/main
tip (e763c37) after re-pinning past the S-BACKUP-NUDGE/S-CHIPS-PLUS/
S-PROG-WRAP/S-BLUES-BOXES bumps that landed while this branch was in
flight - re-verify max+1 against origin/main immediately before push if
any further sibling CACHE bump lands first.
S-COMPOSE-POLISH2 (2026-07-04): v92->v93 - buildGrid tile geometry clamps
(UAT U5), quality-filter scroll anchor (U6), solo-CTA choice row promoted
to the composeModalBackdrop modal pattern (U7). Rebased onto the v92 tip
above (this branch originally cut from v88, before #129/#130/#131/#132/
#133/#134 landed) - no new/removed CORE paths. check-cache-bump.sh
re-verified against origin/main immediately before push.
S-EXTRACT (2026-07-05): v93->v94 - two NEW CORE paths: shared/
chord-pack-adapter.js + shared/sugg.js (buildAdapter + the chord-
suggestion map extracted out of play/index.html's inline bootstrap,
analysis-refactor-enhance-20260704 A3/A7). Rebased past #134's v92 AND
#136's v93 (two sibling collisions in a row while this branch was in
flight; same A10/#117 max+1 discipline each time) - check-cache-bump.sh
re-verified against origin/main immediately before push.
M-6 STORAGE-MIGRATE (2026-07-04): ->v95 (max+1 over main's v94) - new shared/storage-migrate.js
(versioned localStorage boot migration runner, gh #76/#77), script-tagged
in play/index.html - new CORE path. check-cache-bump.sh re-verified
against origin/main immediately before push.
S-BACKUP-INTEGRATE (2026-07-04): v95->v96 - shared/backup.js changes only
(restore() now replays StorageMigrate.run(), tri.* joins OWNED_PREFIXES,
music.schema.version stays in the envelope on purpose - M-6 follow-ups
#1/#2/#3). No new/removed CORE paths. check-cache-bump.sh re-verified
against origin/main immediately before push.
docs(storage-migrate) header-note follow-up: ->v97, no code change.
S-PROG-WRAP (2026-07-04, UAT U8): v97->v98 - shared/songbook.js and
shared/songbook.css change (progression strip degrades to the existing
compact chord token + flex-wraps past the diagram-row overflow threshold).
Rebased past #137's v94, #135's v95, #138's v96 AND #139's v97 (four
sibling collisions landed while this branch was in flight; originally cut
from #136's v93) - no new/removed CORE paths. check-cache-bump.sh
re-verified against origin/main immediately before push.
S-DIAGRAM-PREF steps 1-2 (2026-07-06): v98->v99 (max+1 over main's v98,
rebased a second time past #137/#135/#138/#139/#140/#141 which landed
while this branch was in flight) - adds shared/diagram-pref.js (new
shared module, the dots|patterns pref + label decision); diagram.js and
notables.js also changed (opts.patternLabel/notifyRendered(), the
'diagrampref' priority slot) and play/index.html changed (the notable
prompt + Settings row wiring; the adapter wiring lives in shared/
chord-pack-adapter.js post-S-EXTRACT rebase). check-cache-bump.sh
S-TOAST (2026-07-05): v98->v99 - new CORE path shared/toast.js (the
shared per-host toast timer primitive, UAT U9 fix - see songbook.js
showToast/showComposeToast). Rebased past #141's v98 (S-PROG-WRAP landed
while this branch was in flight; originally cut at v97) - max+1 discipline,
same as every prior sibling collision above. check-cache-bump.sh
re-verified against origin/main immediately before push.
S-LAYOUT-SSOT (2026-07-04): v98->v99 - songbook.css gains the chord-tile/
diagram geometry token block (:root --dg-canvas-w/--tile-min/--tile-gap/
--prog-tile-min), tracks.css gains a documentation comment (no rule
change), diagram.js gains a cross-reference comment (no metric change) -
CACHE bump per the CORE-vs-diff discipline even though no new CORE path
was added (an already-precached file's CONTENT changed). Rebased past
#141's v98 (this branch originally cut from #135's v95) - no new/removed
CORE paths. check-cache-bump.sh re-verified against origin/main
immediately before push.
S-PROG-WRAP-2 (2026-07-04, UAT U8b): v98->v99 - shared/songbook.js and
shared/songbook.css change again (the binary full/compact split becomes a
count-driven 3-stage density ladder: full <=4, fill-row 5-6, grid6 7-12).
No new/removed CORE paths.
S-NAVHIST (2026-07-04, PR #144 finding): v104->v105 - shared/songbook.js
changes only (openSoloChoiceRow/openSaveNameRow's Save/Skip/backdrop/Escape
now route through NavHistory.settleAfter() directly instead of
NavHistory.dismiss(), fixing the "Solo over it -> Skip on a never-saved
progression" double-pop bug - the Studio, and the save-name row one step
earlier, used to flash open then immediately close). No new/removed CORE
paths. check-cache-bump.sh re-verified against origin/main immediately
before push.
M-EAR wave 1 (2026-07-04): v105->v106 - new shared/sound.js (the scale/mode
audition provider, script-tagged in play/index.html right after audio.js);
shared/tracks.js, shared/songbook.js, shared/tracks.css, shared/songbook.css
all change (the play/stop toggle + bouncing .sounding marker on the Studio
scale panel and the Compose key preview). New CORE path added below.
check-cache-bump.sh re-verified against origin/main immediately before push.
M-TRACKLIB wave 1 (2026-07-04): v106->v107 - new shared/jam-queries.js (the
curated genre x feel jam-discovery query data, script-tagged in
play/index.html right after sound.js); shared/tracks.js/tracks.css change
(the Studio's "Find a jam" explore panel + prefilled add-to-library
handoff). New CORE path added below. check-cache-bump.sh re-verified
against origin/main immediately before push.
M-EAR wave 1.5 (2026-07-04): v108->v109 - shared/sound.js (playScale()
gains handle.retarget(), U11), shared/key-explorer.js (boxWrap.setSounding()
class-swap + opts.noPosCtrl + exported POS_CAP, U12/U13), shared/diagram.js
(every scale-fretboard dot gains a data-pc attribute, U12 - deliberate,
reviewed change to the tones-absent SHA-256 lock in diagram.dom.test.js),
shared/tracks.js/tracks.css change (seamless chip-switch audition,
fretboard sounding lights, Window|Full-neck view toggle). No new/removed
CORE paths. check-cache-bump.sh re-verified against origin/main
immediately before push.
M-TRACKLIB wave 2a (2026-07-05, U17): v109->v110 - new shared/yt-info.js
(keyless YouTube oEmbed lookup + title-hint parsing, script-tagged in
play/index.html right after repertoire-form.js); shared/repertoire-form.js/
repertoire-form.css change (the Video URL field's paste/blur YT-prefill
suggest row). New CORE path added below. check-cache-bump.sh re-verified
against origin/main immediately before push.
S-DIM-SHAPES (2026-07-05, U21): v110->v111 - shared/shape-classify.js
curated dim/dim7/aug templates (no new/removed CORE paths). check-cache-
bump.sh re-verified against origin/main immediately before push.
M-EAR wave 1.6 (2026-07-05, docs/plans/uat-walkthrough-20260704.md U14-U16,
U20-U21 folded in): v111->v112 (rebased past #165's v110 AND #168's v111
above - two sibling missions landed while this branch was in flight, max+1
discipline both times) - new shared/legend.js (the fretboard dot-class
Legend primitive, script-tagged in play/index.html right after diagram.js);
new CORE path added below. shared/sound.js (playScale() gains
handle.setTempo(), U14), shared/tracks.js/tracks.css/songbook.css change
(the 3-stop tempo control, the Legend replacing the old target-caption
prose, the U15 kx-sounding visibility harden - size/stroke/glow, the U20
accent-derived kx/sound palette via CSS Relative Color Syntax), and
shared/diagram.js/chord-pack-adapter.js change (the U21 chord-card
label-slot height reserve - complements #168's shape-classify.js template
curation above; a card can still be honest-null after #168 for a quality
that isn't curated, and this keeps that card's height in sync with its
row-mates regardless). check-cache-bump.sh re-verified against
origin/main immediately before this push.
M-DESIGN-ENFORCE wave 2 (2026-07-05, UAT U19): v112->v113 - shared/toast.js
gains Toast.showAction()/.wirePauseOnTouch() (TOAST+ACTION undo primitive),
shared/songbook.js/songbook.css (setlist + Compose Clear undo banners
migrated onto it; .toastAction/.toastBar rules), play/index.html
(Settings backup/restore native confirm()/alert() replaced with the
app-styled Toast/Modal primitives). No new/removed CORE paths. Rebased
past #165's v110 (M-TRACKLIB wave 2a), #168's v111 (S-DIM-SHAPES), AND
#169's v112 (M-EAR wave 1.6, landed in parallel with the SAME v111->v112
target - the exact identical-string collision A10/#117 guards against) -
three sibling collisions while this branch was in flight (originally cut
from v109) - max+1 discipline, same as every prior sibling collision;
check-cache-bump.sh re-verified against origin/main immediately before
push.
S-REL-NAMES (2026-07-05, U23): v113->v114 - shared/solo-guide.js
(framing()/card() gain an optional 3rd `root` arg + the relNames()
resolver + {relMinor}/{relMajor} template tokens on pentMajor's framing
line and shapes card), shared/tracks.js (renderGuide/select() pass
th.key), shared/songbook.js (soloChipCaption gains an optional 2nd `root`
arg, selectChip passes keyRoot). No new/removed CORE paths. check-cache-
bump.sh re-verified against origin/main immediately before push.
S-SET-INTEGRITY (2026-07-05, UAT U22): v114->v115 (max+1 over main's v114 -
rebased past #174's S-REL-NAMES v114 bump, which landed while this branch
was in flight) - shared/queue.js gains stepResolvable() (defensive
queue-nav past a dangling setlist ref); shared/songbook.js gains
pruneDanglingSetlist() (load-heal, runs at mount right after
rebuildAll()), skipNoticeText(), the delete-heal TOAST+ACTION undo banner
on deleteCustomItem (custom-song delete/fork-revert), and the queue-nav
counter's "N removed song(s) skipped" notice (Practice + Stage). No
new/removed CORE paths. check-cache-bump.sh re-verified against
origin/main immediately before push.
S-TOAST-HOST (2026-07-05, UAT U24): v115->v116 - shared/songbook.css only
(`.setUndo[hidden]{display:none;}` - the missing CSS override for the
setlist item-remove undo banner AND the Library delete-undo banner, both
of which share the `.setUndo` class; `el.hidden = true` had zero visual
effect without it, leaving a visible empty pill after every toast
lifecycle completed). No JS logic changes, no new/removed CORE paths.
check-cache-bump.sh re-verified against origin/main immediately before
push.
M-SETTINGS-CLARITY (2026-07-05, operator UAT): v116->v117 - TWO new CORE
paths: shared/build-stamp.js (the authored version+freshness stamp - its
VERSION mirrors THIS CACHE string, guard-locked by scripts/
check-cache-bump.sh + test/build-stamp.test.js: bump one, bump both) and
shared/accordion.js (the exclusive disclosure-group primitive). Also
changed: play/index.html (Settings sheet: accordion sections, Done footer
button, Backup/Restore as data rows with last-run meta, stamped meta
line), play/triad-inversions.html (footer build stamp), shared/
songbook.css (.accSec/.accBtn/.accBody family), shared/
chord-pack-adapter.js (U25: shape labels big-render-only), shared/
diagram.js (comment truth only), shared/backup.js (music.lastRestore.
joins EXCLUDE). check-cache-bump.sh re-verified against origin/main
immediately before push.
M-SOLO-VIEW-UX (2026-07-05, operator UAT F12-F22): v117->v118 - no new
CORE paths. Studio Solo view rework: shared/sound.js (playScale gains
octaves/rootDwell opts, F17 - two-octave continuous run with a dwell on
root hits; every existing caller that omits them is unaffected), shared/
tracks.js (controls row - Play 44px/Speed cycling button/Guide `?`, F12/
F13/F15; ONE notes rendering, F14; Guide card relocated below the
fretboard, F18; fretboard always 0-12 frets, no Window|Full-neck toggle,
F16; chords-in-key are name-only chips, one row, F19; the Find-a-jam
panel consolidated into the stage's video/search affordance, F21), shared/
tracks.css (controls-row/speed-button/chord-chip CSS; the S-LAYOUT-SSOT
known-gap note on .bt-st-chords is RESOLVED-BY-REMOVAL, not fixed by the
token block), shared/songbook.css (comment-only cross-ref update),
play/index.html (Settings: the case-study write-up link removed, F22).
check-cache-bump.sh re-verified against origin/main immediately before push.
v119->v120 UNION MERGE (integration): M-GUIDANCE (#193, already on main) + M-LIB-UX (below) were each cut as v118->v119; rebumped to v120 here so both ship in one cache generation.
M-GUIDANCE (2026-07-05, docs/plans/guidance-levels-spec-20260705.md):
v118->v119 - ONE new CORE path: shared/guidance-level.js (the beginner|
intermediate|advanced experience-level preference, music.guidanceLevel.v1 -
script-tagged in play/index.html right after notables.js, which it grades
claims against). Also changed: shared/notables.js (LEVELS gate on claim();
'guidanceask' + 6 new graded-tip consumerIds added to PRIORITY, relative
order of the pre-existing 5 unchanged), shared/songbook.js
(firstrunShouldRender level-threaded; new savebasicsShouldRender +
renderSaveBasicsNotable; composeTpose/applyTab dispatch music:compose-
transposed/music:tab-shown), shared/tracks.js (whynoteBanner level-
threaded; new scaletipText/scaletipBanner), play/index.html (guidanceask
ask card + Settings "Guidance level" plain-text row + tunefirst/
composeintro/transposetip JIT banners). check-cache-bump.sh re-verified
against origin/main immediately before push.
M-LIB-UX (2026-07-05, operator UAT F23-F27): v118->v119 - no new CORE paths.
Five Library/song-view/studio fixes: shared/repertoire-form.js + shared/
songbook.js (F23, user-facing "Repertoire" -> "Library" - the Repertoire
object/repertoire*.js filenames/localStorage keys are UNCHANGED, only the
strings a user reads moved; F24, the song-view fork button + its dialog
title/aria-label read "Edit" instead of "Make it mine" - fork/copy behavior
unchanged), shared/list-item.js (F25, the no-in-app-video row action is
REMOVED outright - a row with no curated video now shows no action at all,
no external YouTube-search leave-the-app link), shared/songbook.css (F26,
.li-title gains min-width:0 + overflow-wrap:break-word so a long/unspaced
title wraps inside the card instead of overflowing behind the + button),
shared/tracks.js (F27, the Studio's no-video paste-URL box is no longer
permanently visible next to the "Find a jam" trigger - it now shares that
SAME toggle, one button opens both the direct-paste and genre/feel-search
paths). check-cache-bump.sh re-verified against origin/main immediately
before push.
S-SONGTRAY-BOUND (2026-07-15): v158->v159 - shared/songbook.css only. [main #252]
S-SETROW-CONTRAST (2026-07-16): v159->v161 - play/index.html .setRow. [main #254]
S-SONG-MODE (2026-07-16): v161->v162 (max+1 over main's v161 after #252/#254
landed) - shared/songbook.js + shared/songbook.css: Compose splits into two
full-screen views behind a top-level Chords|Song toggle (docs/
SONG-MODE-DESIGN.md); the M-13 builder moves onto a Song canvas with playable
section cards, Save-song naming, the guided template loop, 3 UAT rounds
(Save-asks / clear-on-capture / dismissible cues) + save-to-setlist-#1.
No new/removed CORE paths. [that entry only - #253]
S-CHORD-COLLAPSE (2026-07-16): v162->v163 - ONE new CORE path: shared/
chord-collapse.js (advanced-level compact chord chips for the Compose
palettes) + shared/songbook.js (chip/tile fork, Shapes toggle, filmstrip
demotion) + shared/songbook.css (.ccChips/.ccMode/.ccShapes) +
play/index.html (script tag).
S-AUDIO-REALFEEL (#88, re-staggered past the 2026-07-18 morning train):
audio.js KS strum engine. v187 sits above main's v186 (#270/#271/#272).
S-AUDIO-PICK-TRANSIENT (#273, re-staggered past #275/#276): audio.js pick
scrape + (from main) voice cache/latency. v191 sits above main's v190.
M-LIB-BAKE (2026-08-06, PR #322): v321->v322 - music/backing-tracks/
tracks.json +15 curated playlist entries (39->54, yt-backed 4->19; keys
store preferred tonic names per D-KEY-STORE-PREF) + build-stamp pair. New
non-CORE: scripts/playlist-sync.js (keyless fetch/bake pipeline),
.github/workflows/playlist-sync.yml, test/tracks-catalog.test.js (catalog
schema gate); test/candidates.test.js modal-bucket filter narrowed to
url-less tracks (a yt-backed modal track needs no candidates). [#322]
M-PLAYER-FEEL (2026-08-08, PR #323): v322->v323 - shared/tracks.js
(minimizeStudio/expandStudio/dismissStudio seam, openStudio startMini,
nowPlaying/togglePlay controller, music:nowplaying event), shared/
tracks.css (.bt-player.mini bar + .bt-st-minix + landscape guard),
shared/list-item.js (glyph+equalizer pair, isPlaying/isPaused),
shared/songbook.js (npKeyFor, data-npkey, refreshNowPlaying class sweep,
repertoireAction transport/startMini), shared/songbook.css (.li-eq,
isPlaying outline, body.miniplayer space), play/index.html (controller
pass-through). No new/removed CORE paths. D-PLAYER-FEEL + D-NO-RASTER.
New scenario test/pw/scenarios/mini-player.json (mutation-proven). [#323]
M-PLAYER-FEEL v2 (2026-08-08, PR #323 UAT batch 2): v323-2->v323-3 -
the transport strip is a BOTTOM bar in the expanded Studio too
(tracks.css absolute-bottom head, panes clear it, menu opens upward);
one-transport-owner: while the video is expanded (.vidopen, setMin-
honest) the strip pp/progress hide behind a visible Hide-video CTA
(.bt-st-vidmin/data-vidmin, tracks.js headStrip + wire); the Jams
segment (All | Jams | Setlist) filters the library to playable rows
via npKeyFor (songbook.js + play/index.html segJams), practiceOrigin
remembers it. No new/removed CORE paths. New scenario
test/pw/scenarios/uat-batch2.json (36 steps, mutation-proven). [#323]
M-PLAYER-FEEL v3 (2026-08-08, PR #323 UAT batch 3): v323-3->v323-4 -
the standing player model ("same now playing element, SSOT, don't hide
tabs, don't move it"): ONE fixed bar above the tabbar in every state
(tracks.css .bt-st-head position:fixed one-slot card), the Studio is a
SHEET with a raised bottom inset (tabs stay visible + LIVE - a tab tap
collapses the sheet via NavHistory.settleAfter, songbook tabbar wiring
+ tracks.js studioExpanded/collapseStudioRaw exports), back+hamburger
move to the sheet's .bt-st-topbar, bar x settles the nav slot when
expanded. Supersedes v2's absolute bottom-bar mechanism. No new/removed
CORE paths. New scenario test/pw/scenarios/uat-batch3.json (26 steps,
don't-move rect proof mutation-proven); mini-player + uat-batch2
scenario geometry retargeted to the bar. [#323]
M-PLAYER-FEEL v4 (2026-08-08, PR #323 UAT batch 4): v323-4->v323-5 -
row body tap PLAYS playable rows (repertoireAction, now guarded on the
studio target = the npKeyFor predicate); leading .li-lead details chip
on every row (fixed width, holds the setlist .li-num nested - no row
reflow; list-item.js + songbook.css); openStudio idempotent on the
already-playing track (expand, never rebuild/restart); bar npLive
accent pop + .bt-st-bareq equalizer (composes the .li-eq primitive) +
npPaused freeze riding dispatchNowPlaying; refreshMarquee shuttle for
overflowing bar titles (.bt-st-tx). No new/removed CORE paths. New
scenario test/pw/scenarios/uat-batch4.json (28 steps, mutation-proven).
Pre-existing noted: persona-firsttimer #wNext flake fails on
origin/main identically (base-worktree verified). [#323]
M-PLAYER-FEEL v5 (2026-08-08, PR #323 UAT batch 5): v323-5->v323-6 -
opaque full-inset sheet (rows can no longer leak through the band
around the bar) with the tabbar z-raised above it while open
(body.studioopen via dispatchNowPlaying; songbook.css z-55 between
sheet 50 and perform 60); bar clearance moves to .bt-st-body + the
landscape stage. Loop marquee: leftward-only wrap-around (second title
copy .bt-st-tx2 + 48px gap, linear infinite ~22px/s), replacing the v4
shuttle. Scenario asserts upgraded to hit-tests (band resolves to the
sheet, tabbar center resolves to the tabbar) - z-raise drop
mutation-proven red. No new/removed CORE paths. [#323]
M-PLAYER-FEEL v6 (2026-08-08, PR #323 UAT batch 6): v323-6->v323-7 -
transport + queue: songbook playablePool/playNeighbor (the queue IS the
current view - All/Jams pool or the setlist order; wired via
Tracks.mount({advance})); track-end detection (onStateChange 0 +
duration fallback) with auto-advance or an honest ended-state;
prev/next bar buttons (data-npprev/npnext); shuffle toggle on the
sheet topbar (music.shuffle.v1, additive); accent-bordered 8px
progress track; bar gap 4px; sub-380 hides the time label. tracks
.test.js countdown regex updated for the split guard (same anchored
contract). New scenario test/pw/scenarios/uat-batch6.json (34 steps,
synthesized end-event auto-advance mutation-proven). [#323]
M-PLAYER-FEEL v7 (2026-08-08, PR #323 UAT batch 7): v323-7->v323-8 -
two-row bar (barrow over progrow; progrow now renders in EVERY state -
the vidopen hide broke the don't-move rect proof and the batch-3 gate
caught it); bigger transport glyphs; KEY_ORDER chromatic-from-C
(repertoire.js + repertoire.test.js contract updated - deliberate,
operator taste); honest onStateChange 1/2 sync (fixes shows-playing-
no-sound after backgrounding) + visibilitychange re-poke; Media
Session metadata/handlers/playbackState (best-effort, cross-origin
iframe honesty documented). Clearances: sheet 152px, miniplayer view
104px. New scenario test/pw/scenarios/uat-batch7.json (25 steps,
pause-sync mutation-proven). [#323]
M-PLAYLIST-FOLLOWUP (2026-08-09, PR #324): v323-8->v324 - the deferred
#322 follow-up: playlist item 17 baked (Sweet D Mixolydian, Quist,
6y75xmcKZ8g - catalog 54->55) and the 14 empty-artist playlist entries
enriched with their payload channel authors. Artist changes re-key
trackKey, so 14 old->new LEGACY_TRACKKEYS remaps ship in the same
commit (each NEW key mechanically verified equal to the enriched row's
real trackKey; old keys verified dead). Harry Hood deliberately keeps
'Phish' (payload author is the cover channel). #8 C-vs-Am veto stays
open in the PR body. No new/removed CORE paths. [#324]
wheel moves BELOW the fretboard (operator: the fretboard is the
practice surface, the wheel is between-phrase orientation; supersedes
the top-crown placement - data-cofhero + data-cofreset relocate after
the solo section, before chords-in-key; Play/Speed/? controls stay
above the fretboard leading the body). Bar transport glyphs grow:
pp 1rem->1.35rem, prev/next .9rem->1.2rem (44px boxes unchanged).
Render-proven: offsetTop order asserts + phone screenshot, zero app
pageerrors. No new/removed CORE paths. [#324]
COMMUNITY-274 (2026-08-09, PR #325 vehicle): v324-2->v274 - emre155's
constant 'Suggested Chords' label (the app's first outside PR) merged
via a conflict-resolving merge commit; cache takes the ORIGINAL PR's
number per the version=PR convention. [#274]
M-PLAYLIST-IMPORT (2026-08-09, PR #326): v274->v326 - user-facing
"import your playlist": NEW CORE path shared/playlist-import.js
(keyless iframe enumeration via the infoDelivery playlist array +
noembed titles + the import key ladder - measured 14/16 exact on the
operator's real playlist, no-key = honest skip); repertoire-form
create-mode import panel (+ MODES gains 'blues' so imported blues
jams round-trip edits - contract test updated deliberately); songbook
createCustomItems batch creator (suffix-unique ids, one persist +
rebuild) + toast split summary + studioTarget-based yt dedupe.
Scenario test/pw/scenarios/playlist-import.json (16 steps, stubbed
noembed + synthesized infoDelivery, mutation-proven red); unit
test/playlist-import.test.js. [#326]
M-PLAYLIST-IMPORT UAT (2026-08-09, live-device pass "working. It
wasn't clear where they went"): v326->v326-2 - the import LANDS the
user on its results: first imported row scroll-to-center + the
existing .justSaved pulse (B3 primitive, now batch-extended via
pendingHighlightExtra so EVERY imported row pulses), Setlist segment
escapes to All, active search/filters clear (keeps-waiting is right
for a single save, wrong after a bulk import - without the landing
the first import measured y=10442 in the scenario viewport, ten
screens under the fold). Scenario grows to 19 steps incl. an
assertInViewport gate, mutation-proven red; form-settle wait replaces
the raced fixed sleep. [#326]
M-VARIETY-FILL (2026-08-09, PR #327): v326-2->v327 - 12 curated
yt:null search-first gap tracks driven by the measured matrix (Bm,
G#m, B, Eb, Ab; A/G/D/Bb blues; tempo tails 3->6 slow 2->4 fast;
funk/jazz/pop reinforced). Catalog 55->67. Every title dogfoods the
import key ladder 12/12 exact. candidates.test.js full-coverage gate
gains the explicit 'search-first' tag carve-out (pre-researched ids
cannot be honestly authored offline; the deterministic search query
is the curation path, real ids arrive via the operator's gap playlist
+ trackKey enrichment). Residual rare keys deliberately left for the
operator's playlist. tracks.json is CORE-precached, hence the bump.
[#327]
M-PLAYLIST-2 (2026-08-09, PR #327): v327->v327-2 - the operator's
SECOND playlist (PLPn0Gj4u_mDk, 46 items) baked via the Actions
sync run: 29 auto-keyed entries, 2 title-stated curations the
parser's word-order missed (C mixolydian 'Cool Mixolydian Jam Track
in C', Eb blues 'HALF STEP DOWN Delta Blues in Eb'), 15 Phish jam
vehicles held for operator keys (titles name no key center - the
Harry Hood precedent, never invent one; veto table carries them).
FIVE of the v327 search stubs retired - their slots gained REAL
yt-backed tracks in this bake (Bm rock, G#m, Ab major, Cm, Em funk);
7 stubs remain for still-unserved slots. Catalog 67 -> 93, yt-backed
20 -> 51. [#327]
M-PHISH-KEYS (2026-08-09, PR #327): v327-2->v327-3 - the 15 Phish jam
vehicles bake with SEARCHED original keys (operator: "search for the
keys - most or all are the original key from Phish"): Chalkdust E,
Weekapaug D, Sand Am, Ghost A-dorian, Possum E-blues, DWD D, Julius
A-blues, Tweezer A-dorian, Slave A, YEM-jam G-dorian (Gm7/C7#9 vamp),
2001 C-dorian (Cm7 vamp), Reba-jam Bb (Ebmaj7-F7 = IV-V), Stash Dm,
Tube Am, Mike's F#m. Every key cited (tab sites + phish.net-adjacent
sources; citations in the PR comment); m7-funk vamps take dorian per
the Ghost citation's own precedent. Artist 'Phish' (curated identity,
the Harry Hood rule). Catalog 93 -> 108. [#327]
M-SHUF-BAR (2026-08-09, PR #328): v327-3->v328 - shuffle moves from
the sheet topbar onto the now-playing bar's transport cluster (LEADS
it: shuffle-prev-pp-next, the Spotify order - so it rides in mini AND
expanded) with the standard crossed-arrows stroke SVG replacing the
old text glyph. .bt-st-shuffle CSS retired, .bt-st-np-shuf added
(step-button grammar + .on accent fill); data-shuffle wiring +
music.shuffle.v1 persistence untouched. uat-batch6 UAT-6.3 amended
(bar placement + SVG + topbar-empty), don't-move rect gate re-proven.
No new/removed CORE paths. [#328]
M-SHUF-BAR v2 (2026-08-09, PR #328 UAT round 2 "light thin lines...
spread apart, touching the edges"): v328->v328-2 - prev/pp/next drop
their Unicode text glyphs (&#10072; is literally LIGHT VERTICAL BAR;
two separate chars left spacing to the font) for solid filled SVG
paths on the Material 24-grid: ICON_PLAY/PAUSE/PREV/NEXT module
constants in tracks.js, ONE source for the markup builder and all
four pp state-swap sites. font-size/letter-spacing rules retired
from .bt-st-np-step/.bt-st-np-pp. No new/removed CORE paths. [#328]
M-JAMS-FIRST (2026-08-09, PR #328 UAT round 3): v328-2->v328-3 - the
app lands on what you can PLAY: segment order swaps to Jams|All|Set
with Jams the boot default (songsSeg boots 'jams'); 'featured'-tagged
jams pin to row 1 (data-driven stable partition - Harry Hood carries
the tag). ICON_SHUFFLE redrawn curved-AND-crossed (S-bend crossing
paths + arrowheads). The welcome tour ends IN a jam: rawFinish sets a
one-shot music.welcomeJam.v1 intent flag; same-instrument path opens
the featured jam under the tap's gesture (autoplay allowed), the
instrument-RELOAD path re-enters via tracksCtl onReady with an
honestly-unstarted embed (a load is not a gesture). The library
callout defers to the Studio's first leave (music:nowplaying on
DOCUMENT - non-bubbling, a window listener never hears it) and the
boot callout mount skips while the flag is pending, so show-once is
never burned under the sheet. Guidance updated (library context line,
callouts primary, welcome copy, timeless Settings replay row).
welcome-tour + persona-firsttimer-journey rewritten for the
single-panel auto-jam flow (retires the 3x #wNext flake); 21
scenarios gain an explicit #segAll tap where they need chord-sheet
rows (jams excludes video-less rows); songs-surface-merge's
opens-on-All goalpost superseded. No new/removed CORE paths. [#328]
M-JAMS-FIRST v2 (2026-08-09, PR #328, scenario-caught fixes):
v328-3->v328-4 - (1) the boot callout mount also skips while
body.studioopen (the local tracks.json fetch can beat the boot rAF,
so the welcomeJam flag is already consumed and the sheet already up -
the callout drew OVER the open Studio in the scenario run); (2) the
bar pp handler gains stopPropagation, LOAD-BEARING since the v328-2
SVG glyphs: the innerHTML icon swap detaches the tapped svg
mid-bubble, closest('[data-nppp]') fails on the parentless node, and
a mini pp tap re-expanded the Studio (mini-player scenario caught
it); (3) uat-batch7 UAT-7.2 re-anchored to the SVG era (measure the
rendered svg box, not the retired font-size). [#328]
M-TOUR-FIT (2026-08-09, PR #328 UAT round 4): v328-4->v328-5 - the
tour panel FITS 412x915 with no scroll: the "each instrument keeps
its own setlists" paragraph cut, the offline line tightened, and
Cigar Box DGBD retired EVERYWHERE (manifest entry, profile file,
sw CORE, teaching copy in triad-inversions/comments, tests, wiki -
D-CIGARBOX-RETIRED; stored cigarbox devices fall back via activeId
manifest-order resolution). The tour's auto-jam now prefers a
'welcome'-tagged ORIGINAL backing track (the reggae A-major jam)
over 'featured': Content-ID-claimed material (the Phish jams) rolls
ads that gut a brand-new user's first play ("can't play video
because ads... for first play new users"); Harry Hood keeps
'featured' and row 1. welcome-tour gains the no-scroll geometry
assert + cigar-gone assert + the welcome-jam embed assert. [#328]
```
