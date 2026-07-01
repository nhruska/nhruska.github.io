# Atomic Plan: PR #62 UAT Follow-up (Music app)

**Generated:** 2026-07-01 (web session - elaboration/planning only, no execution here)
**Source:** Nik's UAT feedback on [PR #62](https://github.com/nhruska/nhruska.github.io/pull/62) (M3 - Repertoire merge), resolved via interview
**For:** `/swarm` execution on laptop (worktree isolation + cheap-model-routing + codex-review)
**Total tasks:** 4 dev tasks + 1 gate
**Estimated effort:** ~4-6 hrs of agent time total; Tasks 1-4 parallelizable (~1-2 hrs wall clock via swarm)

---

## Gate 0 (blocking, not a dev task): merge PR #62 first

**Do not start the swarm until this is true.**

Nik decided (interview, round 1): PR #62 merges to `main` as-is first (it already has clean V&V - 12/12 live E2E, 0 console errors). This follow-up work branches fresh off `main` **after** that merge, as **one new PR** covering everything below - not stacked on PR62's branch.

Laptop-session pre-flight:
```bash
gh pr view 62 --json state,mergedAt,headRefOid  # or mcp__github__pull_request_read method=get
# state must be MERGED before proceeding
git fetch origin main && git checkout -b claude/music-uat-pr62-followup origin/main
```

If PR62 is still open when you start: stop and wait, or ping Nik. Do not branch off the unmerged `claude/music-m3-repertoire-merge`.

---

## Dependency Graph

```
Gate 0 (PR62 merged) ──┬──► [Task 1] Song/Practice screen consolidation ─┐
                        │                                                 ├─ locked interface (see below)
                        ├──► [Task 2] Video model + M2 Add/Edit + Studio ┘
                        ├──► [Task 3] Library screen cleanup (independent)
                        └──► [Task 4] Fullscreen scroll-button removal (independent)

All 4 tasks parallelizable (worktree-isolated). Tasks 1+2 share ONE seam (documented
below) - lock it identically in both spawn prompts per agent-spawn-mvc.md. Tasks 3+4
touch neither Task 1 nor Task 2's code and can run fully independently.
```

**Why this grouping (not 7 tasks for the 7 feedback items):** items 3 (hero), 4 (mode switcher), 5 (scroll btn), 6 (header layout), 7 (setlist button CSS) were originally 5 separate feedback items, but 4 and 6 both rewrite the SAME function (`renderPractice()` in `songbook.js`) - splitting them into separate parallel worktree agents would produce a guaranteed merge conflict on the same lines. They're bundled into Task 1. Item 5 (hero) + item 7 (setlist CSS) are genuinely independent of everything and of each other, but both small - bundled into Task 3 to cut agent count without adding conflict risk. Item 8 (fullscreen scroll button) touches a *different* overlay (`#perform`, not `#s-library` practice screen) - stays its own task (Task 4). Items 1 (video-persistence bug) and 2 (M2 form) got merged into Task 2 because they share the same underlying data model change (custom songs/tracks need `key`/`mode`/`yt` fields) and the same file (`tracks.js` + the custom-song storage in `songbook.js`).

---

## Locked interface (seam contract) - Task 1 <-> Task 2

**MUST appear verbatim in both Task 1's and Task 2's spawn prompts** (per [agent-spawn-mvc.md](https://github.com/nhruska/claude-config/blob/main/rules/agent-spawn-mvc.md)).

**(a) Data contract** - the object Task 1's new "Solo over it" button passes into the existing `openStudioCb` callback (the same callback `tracks.js` already registers - see `music/play/index.html` `Studio.openStudio` wiring and `songbook.js`'s `openStudioCb` var):

```js
{
  id: song.id,        // the saved custom song's stable id (from saveProgression's cs.id, e.g. 'm1234567890')
  title: song.t,       // song title
  artist: song.a,      // song artist ('My progression' or whatever was entered)
  key: song.key,       // root note, e.g. 'C', 'F#' - MUST be present (Task 2 derives + stores this at save time)
  mode: song.mode,      // 'major' | 'minor' - MUST be present (Task 2 derives + stores this at save time)
  custom: true          // signals "this is a user's saved song, not a catalog seed track"
}
```

**(b) CLI/function signature** - Task 1 calls exactly: `openStudioCb(soloObj)` where `openStudioCb` is the existing module-level var in `songbook.js` already wired to `tracksCtl.openStudio`. No new function name, no new callback - reuse the existing wiring path that the Compose "Solo over a backing track" button already uses today.

**(c) Return/exit shape** - `openStudioCb` returns nothing (void); it mutates the DOM directly (opens the `#bt-studio` overlay in `elPlayer`). No return value to check.

**(d) Error contract** - if `song.key`/`song.mode` are missing (a pre-M3-plan legacy custom song saved before this change shipped), `tracks.js`'s `studioTheory()` returns `null` and `openStudio()` falls back to `openPlayer(t)` (bare video player, no solo-scale HUD) per its existing `if (!th || !pack) { openPlayer(t); return; }` guard - this is ALREADY the correct degrade-gracefully behavior, no new error handling needed. Task 2 must ensure every NEWLY saved custom song gets `key`/`mode` populated so this fallback is rare, not the common path.

**Also locked: where the video lives on a custom song.** Task 2 must NOT try to route a custom song's curated video through `tracks.js`'s `state.urls` overlay mechanism (that's built for catalog seed tracks matched by `trackKey()` on title/artist/key/mode - fragile for user-entered data). Instead: **the video id lives directly on the custom song object as `cs.yt`**, persisted via the existing `saveCustom()` function in `songbook.js` (the same storage `saveProgression()` already uses). When Task 1's "Solo over it" button opens the Studio, `tracks.js`'s `openStudio(t)` reads `t.yt` directly off the passed-in object (already the existing code path - `t.yt ? <iframe> : <search card>`) - no overlay lookup needed for custom songs.

---

## Task 1: Song/Practice screen consolidation

**Files:** `music/shared/songbook.js` (`renderPractice()` ~line 542-705, `setMode()`, `shiftKey()`), `music/shared/songbook.css` (`.modeSwitch` ~line 172-201, `.tempoBar` ~185-192, `.campfireSheet` ~198-201, `.actions` ~213, `.detailHead`)

**Depends on:** Gate 0. Shares the locked interface above with Task 2 (parallel-safe).

### Context

The song/practice screen (`renderPractice()` in `songbook.js`) currently renders a 3-way `Studio / Campfire / Stage` mode switcher, a Campfire-only tempo-tap feature, a standalone key/transpose pill, and a bottom `.actions` row with "← Library" and "+ Add to setlist" / "✓ In setlist" buttons below the fold. All of this is **pre-existing behavior, not touched by PR #62's diff** (confirmed via `git diff origin/main..origin/claude/music-m3-repertoire-merge` - the hunks affecting `songbook.js` only touch the Library and Compose sections, lines ~239-700 and ~1486-1627, never this song-view render path above line ~542... note: verify current line numbers against `main` post-PR62-merge, not the pre-merge numbers cited here, since Gate 0 means you're branching AFTER main absorbs PR62's diff).

Nik's UAT surfaced that "Studio" here collides in name with `tracks.js`'s separate "Practice Studio" video overlay (opened by Task 2's work) - a real source of his confusion.

### Objective

Collapse the 3-way mode switcher to 2 (merged practice view + Stage), remove tempo/tap entirely, compact the transpose control into the mode-switcher row, move the back/setlist controls above the fold, and add the new "Solo over it" entry point for custom songs (wired per the locked interface above).

### Requirements

1. **Collapse Studio+Campfire -> one merged practice view.** Single view shows chords + lyrics together by default (matching today's Studio default - `s.custom ? 'chords' : 'lyrics'` view logic stays), with a compact inline toggle to switch to chords-only (matching today's Campfire `'chords'` view). Rename this mode away from "Studio" (naming collision with `tracks.js`'s Practice Studio) - pick a name that doesn't collide (e.g. "Practice" or "Learn") - your call, this is locked as a naming/taste decision, do not re-derive product intent.
   - `setMode()`'s `stage` branch (fullscreen `startPerform()`) is UNCHANGED - Stage stays a separate one-shot fullscreen action, never a persisted default-open mode.
   - `STATE.songMode`/`loadSongMode()`/`saveSongMode()` localStorage persistence: simplify since there's no longer a studio/campfire choice to remember (or keep the mechanism if you add the chords-only/lyrics toggle as a persisted preference - your call).
2. **Remove tempo/tap entirely.** Delete `TEMPO` var, `tapTempo()`, `startBeat()`, `stopBeat()`, the `tempoBar` HTML block, `#beatToggle`/`#tapBtn`/`#beatDot`/`#bpmVal` wiring, and the `.tempoBar` CSS block. Check `music/shared/` for a `tempo.js` module - if nothing else references it after this removal, delete it and its `<script>` tag in `music/play/index.html`; if something else still uses it, leave the module, just stop wiring it into the practice screen.
3. **Compact the transpose control.** Replace the standalone `keyPill` block (`#tDown`/`#tUp`, the `.pill` CSS pattern) with a compact control in the SAME row as the new mode toggle - match the visual density of the Compose tab's key/mode chip (`#keyPickerCompact`, wired by `buildKeyPicker()` elsewhere in this file) rather than the current large standalone pill.
4. **Move back + setlist controls above the fold.** Currently both live in the bottom `.actions` row (`#backLib` "← Library", `#setToggle` "+ Add to setlist"/"✓ In setlist"), below the chord sheet. Move "← Library" (or an icon-only back arrow) to the top-left of the header, near the existing `.detailHead` title. Turn "In setlist" into a compact checkmark-style toggle floated top-right of the header (alongside the existing maximize `#maxOpenBtn` (⤢) icon when `pack` is present - both are icon-sized, should sit together cleanly). This is a visual/taste call - use good judgment on exact arrangement; Nik reviews via the PR preview, don't ask further mid-task.
5. **Add "Solo over it" entry point for custom songs.** When `STATE.current.custom === true` (a saved user progression), show a button (placement: near the other song-screen actions, your call) that calls `openStudioCb(...)` with the exact object shape from the Locked Interface section above, using `STATE.current.id/t/a/key/mode`. Guard: only render this button when `openStudioCb` is present AND `STATE.current.key`/`STATE.current.mode` are set (Task 2 guarantees these on new saves; older custom songs pre-dating this change may lack them - hide the button rather than calling with `undefined` key/mode).

### Success Criteria

- [ ] Song screen shows exactly 2 modes (merged practice view + "Stage ▶"), no 3-way switcher, no "Studio" label anywhere in the song-view template
- [ ] Tempo/tap UI and all its wiring is gone; `grep -rn "tapTempo\|beatToggle\|tempoBar" music/shared/songbook.js music/shared/songbook.css` returns nothing
- [ ] Transpose control renders in the same row as the mode toggle, visually compact (not the old large `.pill`)
- [ ] Back button and setlist-status control are visible without scrolling on a 375x812 viewport, for a song with a full-length chord sheet
- [ ] For a `custom:true` song with `key`/`mode` set, a "Solo over it" button is present and calls `openStudioCb` with the locked-interface object shape (verify via a manual click -> Studio overlay opens, no console error)
- [ ] For a `custom:true` song WITHOUT `key`/`mode` (simulate by clearing those fields), the button is hidden, not shown with broken behavior
- [ ] Existing node test suite (`test/songbook.test.js` and siblings) still passes
- [ ] Playwright screenshots at 375x812 (mobile) AND 1440x900 (desktop) of: the merged practice view, Stage fullscreen, and a custom song's "Solo over it" button - zero console errors across all three

### Implementation Hints

- `STATE.screenMode`/`STATE.songMode` currently hold `'studio'|'campfire'`; simplify to a boolean or drop entirely if collapsing removes the need for a persisted choice.
- The existing `.modeSwitch` CSS pattern (`display:flex; gap:4px; background:var(--bg-2); border-radius:11px; padding:4px`) is a reasonable base to adapt for the 2-way toggle + compact transpose row - reuse the visual language, don't invent a new one.
- `#maxOpenBtn` (maximize icon) already lives in `.detailHead` next to the title when `pack` exists - the new back-arrow and setlist-checkmark should join that same header region, not create a third separate row.

---

## Task 2: Curated-video model + M2 Add/Edit form + Studio simplification

**Files:** `music/shared/tracks.js` (`openStudio()` ~line 250-360, `setTrackUrl()`, `trackKey()`), `music/shared/songbook.js` (`saveProgression()` ~line 1527, custom-song storage `saveCustom()`, new Add/Edit form UI - likely a new function + template, wired from the Library "Mine" filter and from a new "+Add" entry point), possibly a new file if the Add/Edit form is large enough to warrant extraction (your call - this codebase is otherwise flat `<script>` files, match that convention unless the form is genuinely large).

**Depends on:** Gate 0. Shares the locked interface above with Task 1 (parallel-safe).

### Context

Root-caused bug: the Compose "Solo over a backing track" button currently calls `openStudioCb({title:'Solo practice', artist:'', key, mode})` - a fresh object with no stable identity, created new on every click. When a user pastes + saves a YouTube URL in the resulting Studio overlay, `tracks.js`'s save handler (`setTrackUrl(t, id)` -> `trackKey(t)` -> writes to `state.urls[k]` in localStorage) computes a key from that throwaway object, then tries to re-find "the updated track" via `state.tracks.filter(x => trackKey(x) === trackKey(t))[0]` - `state.tracks` is built only from `tracks.json` seed + custom tracks, so a synthetic `{title:'Solo practice',...}` object never matches anything in it. The lookup falls back to the original (video-less) `t`, and the Studio re-renders showing "Watch on YouTube" as if the paste never happened. This reproduces exactly what Nik reported.

Nik decided (interview): gate video-attach behind a **saved** progression, keyed to that saved song's stable id - not the ephemeral pre-save session. He also surfaced that PR62's own description already deferred exactly this class of work as "M2: per-item edit / +Add curation surface" (the retired Tracks-finder's add-track UI) - fold that in now rather than leaving a second UAT round-trip, per his explicit answer.

### Objective

1. Fix the video-persistence bug per the locked-interface contract (video lives on `cs.yt`, not in `tracks.js`'s catalog-track overlay).
2. Build ONE unified Add/Edit form covering: create a new standalone custom track/video (not tied to any chord progression - e.g. a backing track found on YouTube that doesn't match any existing song title), and edit an EXISTING "Mine" custom song's chords/title/artist/video.
3. Simplify the Studio overlay's video-URL UI now that the Add/Edit form is the canonical place to attach a video.

### Requirements

1. **`saveProgression()` gains key/mode.** Currently `cs = {id, t, a, y, d, seq, custom:true}` has no `key`/`mode`. Derive them from `progression[0]` (the first chord) the same way `repertoire.js`'s `deriveKey()` does (regex `^([A-G][#b]?)(m(?!aj)|min)?` against the first chord string) - reuse that logic (either by exposing/importing it, or by duplicating the small regex inline with a comment noting the shared convention; your call on DRY vs the existing flat-file structure) - and store `key`/`mode` on the saved `cs` object.
2. **Video lives on the custom song object.** Add a `yt` field to the custom-song shape (`cs.yt`). No new localStorage key needed - it rides along in the existing custom-songs array persisted by `saveCustom()`.
3. **Unified Add/Edit form.** One form, two entry modes:
   - **Create:** fields = title, artist, key (root note picker), mode (major/minor), genre (free text or reuse the existing genre chip list), chords/seq (OPTIONAL - textarea or chord-token input; omit for a pure backing-track-only entry with no chord sheet), video URL (optional, parsed with the existing `parseYouTubeId` pattern from `tracks.js` - reuse it, don't reimplement). On submit with no `seq`, the created item is a standalone custom TRACK (no chord sheet, `playability().studio` true per `repertoire.js`'s existing logic) rather than a custom SONG - this is the exact fix for Nik's "found a video that doesn't match any existing title" scenario.
   - **Edit:** same form, pre-filled from an existing `custom:true` item (song or track). Reachable from the song screen where "Delete progression" already lives (extend that same surface, don't build a separate entry point) AND from a new small "+ Add" affordance in the Library header (visible only when the "Mine"/custom filter context makes sense - your call on exact placement, verify visually).
   - Curated catalog (non-custom) songs/tracks stay READ-ONLY - no edit path into `songs.json`/`tracks.json` shipped data this round.
4. **Simplify the Studio's inline video UI.** Remove (or drastically shrink) the current `urlEditor` paste-box block in `tracks.js`'s `openStudio()` for `custom` items - a custom song's video is now set via the Add/Edit form, not inline in the Studio. The Studio should just READ `t.yt`: iframe if set, "Watch on YouTube" search fallback + a plain link/button "Edit this track to add a video" (which opens the Add/Edit form from Requirement 3) if not. Catalog (non-custom) seed tracks can keep their existing overlay-based inline editor as today (out of scope to change that path) - the simplification is specifically for the `t.custom` case.

### Success Criteria

- [ ] A saved custom progression has `key`/`mode` populated correctly for a representative set of chord progressions (test at least a major-key and a minor-key progression)
- [ ] Opening the Studio via Task 1's "Solo over it" button for a saved custom song, then using the Add/Edit form to attach a video, then closing and reopening the Studio (fresh page load, not just re-render) shows the SAME video - i.e. it survived a full reload, not just an in-memory re-render. This is the actual regression test for the bug.
- [ ] Add/Edit form creates a standalone custom track with no chord sheet, no title/artist match to anything existing, and it's reachable/playable from the Library (opens the Studio directly per `repertoire.js`'s existing `playability()`/`openRepertoireItem()` routing - no changes needed there, just confirm it still works with the new custom-track shape)
- [ ] Add/Edit form edits an existing custom song's chords and the change is reflected immediately in the song screen (chord chips, sheet) after save
- [ ] Catalog (non-custom) songs show NO edit affordance anywhere
- [ ] `test/tracks.test.js` and `test/repertoire.test.js` (and any new test file for the Add/Edit form logic) pass
- [ ] Playwright screenshots (375x812 + 1440x900) of: the Add/Edit form (create mode, empty), the Add/Edit form (edit mode, pre-filled), and the Studio overlay for a custom song WITH a video attached (iframe visible, no leftover paste-box) - zero console errors

### Implementation Hints

- `parseYouTubeId()` in `tracks.js` is already reasonably robust (handles `youtu.be/`, `?v=`, `/embed/`, `/shorts/`, and bare 11-char ids) - reuse it verbatim for the Add/Edit form's video-URL field, don't rewrite.
- `repertoire.js`'s `deriveKey()`/`keyLabel()` are pure functions already node-tested (`test/repertoire.test.js`) - the safest reuse path is exposing them (they're already on the `Repertoire` global/module export) rather than duplicating the regex.
- Match this codebase's existing form/modal visual patterns (e.g. the Studio overlay's `role="dialog"` structure, or the `#maxOv` maximize overlay) rather than inventing a new modal chrome.

---

## Task 3: Library screen cleanup (hero removal + Edit Setlist width fix)

**Files:** `music/shared/songbook.js` (`renderHero()` ~line 425-490 and its call sites in `applyLibType()`/`renderTypeToggle()`), `music/play/index.html` (`#libHero` element, `#setEdit` button), `music/shared/songbook.css` (hero-related classes: `.jamNow`, `.heroCont`, `.heroCard`, `.heroRow`, `.heroLbl`, `.hcKick`/`.hcTitle`/`.hcSub`/`.hcArtist`/`.hcChords`; `.setHead`/`.btn` for the width fix)

**Depends on:** Gate 0. Fully independent of Task 1 and Task 2 - different functions, no shared seam.

### Context

Nik decided (interview): the "Jam now / Continue / quick-pick" hero on the Library screen - which intentionally hides whenever Search, Genre, or Key filters are active and reappears when cleared (confirmed in PR62's own guided-test-plan description) - should be removed entirely. The new Genre/Key filter bar (from PR62) supersedes its "get me to a song fast" purpose.

Separately: the "Edit Setlist" button (`#setEdit`) stretches nearly the full width of its header row. Root cause confirmed: the generic `.btn{flex:1}` CSS rule has nothing else in the `.setHead` flex row (`display:flex; justify-content:space-between`) to absorb the free space, since the sibling `.ti` title block doesn't grow and `#setClear` is a fixed-size `.iconBtn`.

### Objective

Delete the hero feature cleanly (not just hide it), and fix the Edit Setlist button's width.

### Requirements

1. **Remove `renderHero()` entirely** - the function, its call sites (`applyLibType()` calls it when switching to the repertoire sub-view; `renderSongs()` also calls it), the `#libHero` element and its `style.display` toggling, and every hero-related CSS class listed above. Do not leave a `hidden`/`display:none` no-op - delete the dead code.
2. **Fix `#setEdit` width.** Give it a fixed/auto width instead of the inherited `flex:1` - e.g. a scoped `.setHead .btn{flex:0 0 auto}` override with sensible padding, sized consistently with the adjacent `.iconBtn` (`#setClear`) it sits next to. Confirm visually it no longer dominates the row.

### Success Criteria

- [ ] `grep -n "renderHero\|libHero\|heroCont\|heroCard\|jamNow\b" music/shared/songbook.js music/shared/songbook.css music/play/index.html` returns nothing
- [ ] Library screen (repertoire sub-view) renders directly into the filter bar + song list on open, no hero section, regardless of filter state
- [ ] `#setEdit` renders at a width proportional to its "Edit"/"Done" text content, not stretched across the row
- [ ] Existing node test suite passes (check for any test asserting hero presence - update/remove it, don't leave a failing assertion)
- [ ] Playwright screenshot (375x812) of the Library screen on open and of the Set tab header - zero console errors

---

## Task 4: Fullscreen (Stage) auto-scroll button removal

**Files:** `music/play/index.html` (`#pScroll` button in `.pNav`), `music/shared/songbook.js` (`startScroll()`, `stopScroll()`, `#pScroll` wiring ~line 890-915)

**Depends on:** Gate 0. Fully independent - different overlay (`#perform`) than Tasks 1-3.

### Context

Nik reported the fullscreen "play" icon button "doesn't work and is not needed." Code trace shows it's actually wired correctly - `el.pScroll.onclick` toggles `STATE.scrolling` (auto-scroll of the fullscreen chord/lyric sheet, a teleprompter feature), not audio playback. It's not broken; it's just subtle, because Stage sheets are currently short representative snippets (per the existing `.note` text: "Sheet shows a short representative snippet"), so the scroll effect is barely visible. Nik decided to remove it rather than fix its discoverability, given today's short sheets don't make auto-scroll very useful - can revisit if/when full lyrics ship and sheets get longer.

### Objective

Remove the auto-scroll button and its logic; leave the rest of the Stage/perform overlay untouched.

### Requirements

1. Remove `#pScroll` from `music/play/index.html`'s `.pNav` row.
2. Remove `startScroll()`, `stopScroll()`, and the `el.pScroll` wiring/references in `songbook.js`. Check `stopScroll()`'s call sites first (`el.pClose.onclick`, `el.pPrev.onclick`, `el.pNext.onclick`, `pSheet.onclick` all call `stopScroll()` as a safety stop when leaving/navigating) - those calls become no-ops to remove too, not dangling references to a deleted function.
3. Leave `pPrev`/`pNext`/`pClose`/`pUp`/`pDown`/`pDimBtn` and the rest of the perform overlay untouched.

### Success Criteria

- [ ] `grep -n "pScroll\|startScroll\|stopScroll" music/shared/songbook.js music/play/index.html` returns nothing
- [ ] `.pNav` renders with just Prev/Next (2 buttons, not 3)
- [ ] Fullscreen Stage mode still opens, navigates prev/next, closes, and dims correctly (regression-check the rest of the overlay)
- [ ] Existing node test suite passes
- [ ] Playwright screenshot (375x812) of Stage/fullscreen mode - zero console errors

---

## Swarm dispatch notes (for the laptop session)

- All 4 tasks: `isolation: "worktree"`, base-pinned to `origin/main` (post-PR62-merge, per Gate 0) - **not** `origin/claude/music-m3-repertoire-merge`.
- Route implementation to `worktree-implementer` (mid tier) per this repo's size/routine-ness; reserve `codex-review` (adversarial tier) for the post-swarm PR review pass, not per-task drafting.
- PR/commit-message drafting: cheap-model-routing (Haiku) per the usual convention - the reasoning here is already done in this doc.
- After all 4 land: ONE PR off `main` titled something like "Music: PR62 UAT follow-up - video persistence, M2 add/edit, practice-screen cleanup" covering all 4 tasks' commits, run `/model-router:codex-review` before merge per this session's stated intent, and render-verify the FULL set of changes together (not just per-task) with Playwright at 375x812 + 1440x900, since Tasks 1 and 2 touch adjacent UI that should be visually reviewed as a whole (the "Solo over it" button from Task 1 opening into Task 2's simplified Studio).
- Guided manual test plan for Nik's phone sign-off (mirror this into the PR body): (1) open a saved "Mine" progression, confirm back/setlist controls are above the fold and the mode toggle shows 2 options not 3; (2) tap "Solo over it," paste a video URL via the Add/Edit form, reload the page, reopen - video persists; (3) create a brand-new standalone track via "+Add" with just a video URL and no chords - confirm it's playable from the Library; (4) confirm the Library hero is gone and Stage fullscreen has no scroll button; (5) known-good adjacent: Compose tab, Tune tab, catalog (non-custom) song editing is absent.
