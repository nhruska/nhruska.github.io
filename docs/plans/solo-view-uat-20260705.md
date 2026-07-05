# Studio Solo View UAT Findings - F12-F22 (2026-07-05)

> Operator UAT pass on the Practice Studio's Solo view (reached via a song's
> "Solo over it" button, or Compose's "Solo over a backing track" CTA).
> Continues the F-numbering from [ux-findings-20260703.md](ux-findings-20260703.md)
> (F1-F11). Findings F12-F20 were the original spec; F21-F22 were added
> mid-touchpoint by the operator on the same pass. Method: live Playwright at
> Pixel-10 viewport (412x915), driven against `music/shared/tracks.js`'s
> `openStudio()` - the ONE render/wiring function every finding below maps
> back to. Screenshots: [docs/artifacts/solo-view-ux/](../artifacts/solo-view-ux/).

## Findings -> code mapping -> resolution

### F12 - the play button is too small and when you scroll it gets lost
- **Code:** `.iconBtn.soundToggle` (songbook.css) is overridden to 32x32 by
  `.soundToggle{width:32px;height:32px}` - below the app's 44px GRIP floor.
  Shared with Compose's compact inline key-preview toggle.
- **Fix:** Play is now the PRIMARY control in a new controls row
  (`.bt-st-ctrlrow`, tracks.js), Studio-scoped override
  `.bt-studio .bt-st-ctrlrow .soundToggle{width:44px;height:44px}` (tracks.css)
  restores the 44px floor WITHOUT touching Compose's own 32px toggle. The
  "gets lost on scroll" half is resolved by F20 (no-scroll default state) -
  nothing to lose track of when nothing scrolls.

### F13 - the speed toggle takes up too much real estate
- **Code:** a 3-button `.viewToggle` segmented control (Slow/Med/Fast,
  `data-tempo`) sat between the notes/degrees lines and the scale chips.
- **Decision (OR-choice: buttons vs slider):** ONE compact cycling button
  (`.bt-st-speedbtn`, in the controls row) - tap advances slow -> med -> fast
  -> slow (wrap), same `TEMPO_BPM` model, just a different control shape.
  **Why not a slider:** a drag-based control is harder to hit precisely
  one-handed while holding an instrument (interaction-safety.md's grip-model
  bias toward deterministic taps over drag), and a slider would need new
  component/test surface for zero functional gain over the existing 3-value
  enum. The cycling button is a 1-line CSS + ~10-line JS diff vs the old
  3-button row, reclaiming ~2/3 of that row's width.

### F14 - redundant list of notes right under "Solo over it"
- **Code:** `.bt-st-notes` (note names, inline in the label) plus a SEPARATE
  `.bt-st-degrees` line (scale-degree numbers: "1 2 b3 4 5 b6 b7") directly
  underneath - two short token rows that read as a duplicate at a glance.
- **Fix:** the degrees line + its `renderDegreeTokens()` function are
  removed entirely. Exactly ONE notes rendering remains
  (`data-solonotes`/`renderNoteTokens`). The scale-audition sounding marker
  (M-EAR) now bounces across that one line only (`clearSoundMarks`/
  `markSoundingNote` simplified from a 2-element array to a single element).

### F15 - the Guide button is in the way
- **Code:** `<button class="bt-st-why-toggle">Guide</button>` sat between
  the scale chips/framing caption and the fretboard, a full-width text link.
- **Fix:** a compact `?` icon button (`.bt-st-guidebtn`, `.iconBtn` base,
  44x44) in the new controls row, alongside Play and Speed. `.on` state
  reuses the accent-fill convention (D-SELECTED-ACCENT).

### F16 - the fretboard view toggle can go away, always show 0-12
- **Code:** `.viewToggle[data-fretview]` (Window/Full-neck, U13) drove
  `scaleRenderOpts()` between `defaultFrets(pack)` (7 or 12 frets, windowed
  + pager) and `frets: KeyExplorer.POS_CAP` (14, no pager).
- **Fix:** the toggle is removed. `scaleRenderOpts()` now always returns
  `{ frets: 12, noPosCtrl: true }` regardless of instrument - one fixed 0-12
  span, no pager UI, for every profile (guitar's prior default was a 7-fret
  window; ukulele's was already 12). Verified geometry: `diagram.js`'s width
  formula (`W = nutX + F*fretW + padX`) gives 349px for F=12 independent of
  string count - comfortably inside 412px (vs 399px for the old F=14 full
  mode), confirmed live via `layout-check.py` (all 8 viewport/font-scale
  configs green, zero horizontal spill).
- **What this removed (as pre-authorized by the spec):** the pager (`.scalePosCtrl`)
  is what drove the S-BLUES-BOXES named box-position label (`.scaleBoxChip`)
  - `KeyExplorer.renderScale` only ever allocates that chip when its OWN
  `showPosCtrl` is true (`supportsStart && !opts.noPosCtrl`). With
  `noPosCtrl:true` always set now, the box label never renders in the
  Studio. `boxScaleIdFor()` (tracks.js) stays defined/exported/tested as
  pure pitch-class math - it is shared/tested library-level infrastructure
  (`key-explorer.js`'s pager+box feature, still fully tested by
  `test/key-explorer.dom.test.js`/`test/key-explorer-boxes.test.js`
  independent of any caller) - only the Studio's render call site stopped
  wiring it in. No CSS for `.scalePosBtn`/`.scaleBoxChip` was touched (it is
  shared, tested infrastructure, out of this task's boundaries).

### F17 - continue through two octaves with a pause on the root notes
- **Code:** `sound.js`'s `Sound.playScale()` played ONE octave ascent then
  looped back to the start root (a down-an-octave jump on loop restart).
- **Fix:** `playScale(pcs, opts)` gains two new, purely additive options:
  - `opts.octaves` (default 1) - `buildNoteSequence()` repeats the ascent
    that many times, continuing to climb from wherever the previous pass
    left off, before appending the closing root. The Studio passes
    `SOLO_OCTAVES = 2`.
  - `opts.rootDwell` (default 1, i.e. no-op) - a duration MULTIPLIER (not a
    rest/silence) applied only to notes sharing the sequence's root pitch
    class (the start, every subsequent octave-up root, and the closing
    root). The Studio passes `ROOT_DWELL = 2.2` - long enough to read as a
    deliberate "landing" without stuttering.
  - Every EXISTING caller (Compose's own key-preview toggle, songbook.js)
    omits both options and is provably unaffected (unit tests + `octaves`/
    `rootDwell` default-omitted assertions in `test/sound.test.js`).
  - `onNote(i)`'s existing `i % pcs.length` contract needed NO consumer
    change - a 2-octave sequence's `i` still wraps onto the same
    note/degree token index every octave.
- **Live evidence:** a MutationObserver-instrumented Playwright run recorded
  the `.sounding` marker visiting 0,1,2,3,4,5,6,0 (C major, mode chip) -
  continuing PAST the first octave (index 6 -> 0, no stop/reset) with the
  root hit (index 0) held measurably longer (1284.9ms) than the settled
  non-root holds (624-723ms once headless timing warmed up) at the default
  Med tempo (104bpm, noteDur 577ms, dwelt 577*2.2=1269ms - matches the
  1284.9ms observation within one timer tick). A separate run confirmed a
  MID-PLAY scale-chip switch (retarget, now also 2-octave) plays cleanly for
  7+ seconds with zero console errors. The precise 2.2x multiplier itself is
  proven exactly (not approximately) by the deterministic fake-clock unit
  tests in `test/sound.test.js` (headless wall-clock timing has natural
  jitter; the fake-clock tests are the authority on the exact math, the live
  run is the "it actually fires in a real browser" confirmation).

### F18 - move the text descriptions below the fretboard, dismissed/collapsed
- **Code:** the Guide card (`SoloGuide`, 5 labeled rows) rendered ABOVE the
  fretboard, right after the scale chips + framing caption.
- **Decision (OR-choice: collapse-behind-`?` vs one-shot Notable dismiss):**
  collapse behind the `?` icon (F15), NOT a permanent Notables-style
  dismiss. **Why:** the Guide card's content is scale-dependent and
  re-derives on every chip switch (mode/pentMajor/pentMinor/blues each show
  different advice) - a Notables "dismiss forever" would permanently hide a
  genuinely reusable re-orientation aid the player needs again the next time
  they switch scales. The `?` button is already a cheap, always-visible
  re-open affordance, so a one-shot dismiss buys nothing the collapse
  doesn't already give for free.
- **Verified DOM order** (live, not just markup order):
  `bt-st-ctrlrow -> bt-st-lbl (notes) -> bt-st-scalechips -> bt-st-scaleframe
  -> bt-st-scale (fretboard) -> [legend] -> bt-st-why (guide box, LAST)`.

### F19 - chords drop the chart, note-only, fit all 7 in 1 row
- **Code:** `KeyExplorer.renderChords()` rendered a 4-column CSS grid of
  SVG chord diagrams + roman numerals (`.bt-st-chordcell`/`.bt-st-chip`).
- **Fix:** a hand-rolled chip row (`renderChordChips()`, tracks.js) - name
  only (no diagram, no roman numeral), `.bt-st-chords{display:flex;
  flex-wrap:nowrap}` + `.bt-st-chordchip{flex:1 1 0}` so a fixed 7-chip row
  always divides the available width evenly instead of wrapping. Tap still
  plays the chord (`pack.playChord`) AND toggles the fretboard chord-tone
  target (`toggleTarget`) - only the visual weight changed, not the
  interaction. `KeyExplorer.renderChords` itself is untouched (Compose's own
  use of it is a separate call site).
- **Verified live:** 7 chips (C Dm Em F G Am Bdim, the C-major diatonic
  palette), one row (`distinctRowTops === 1`), all >=40px tap height.
- **Retired-known-gap housekeeping:** the S-LAYOUT-SSOT "known gap" comment
  block (tracks.css, songbook.css, `layout-check.py`) that documented the
  old 4-col diagram grid's missing SVG-clamp is now marked
  RESOLVED-BY-REMOVAL (there is no SVG diagram canvas left in this row to
  squeeze) - `test/layout-token-lint.test.js`'s substring assertions
  (`S-LAYOUT-SSOT KNOWN GAP`, `--dg-canvas-w`) still pass against the
  updated wording.

### F20 - no-scroll mobile experience
- **Hard acceptance, verified live:** at 412x915, default Studio state
  (no-video song, nothing expanded): `.bt-st-body` `scrollHeight === clientHeight`
  (604 === 604, exact match, well inside the +2px tolerance) AND the
  document itself never exceeds the viewport (`documentElement.scrollHeight
  === clientHeight`, 915 === 915) - the WHOLE page fits, not just the solo
  content area below the stage. This held for both the no-video (search)
  stage and the has-video (iframe) stage.
- Expanding Guide or the jam-discovery panel DOES introduce scroll (expected
  and correct - F20's acceptance is scoped to the default state; disclosure
  content is opt-in, matching how Guide/jam already worked pre-existing).

### F21 - the Find-a-jam link is redundant with the existing YT button, consolidate
- **Operator's words:** "the find a jam link can be moved - it's redundant
  with existing yt button - but with more user options."
- **Code:** the old standalone `Find a jam` disclosure (`data-jamtoggle`,
  tracks.js ~1071 pre-change) sat in the solo section, duplicating intent
  with the stage's own "Watch on YouTube" search link (no-video state).
- **Consolidation (which control survived + where):** the STAGE is the
  surviving location. Both video states now trigger the SAME `renderJamPanel()`
  content (genre chips, feel chips, generated query, "Search YouTube ↗",
  optional "Add to library") from ONE `data-jamfindtoggle` element, styled by
  video state:
  - **No curated video:** the OLD blind "Watch on YouTube" link (a single
    fixed title/artist query) becomes THIS toggle, same stage position and
    `.bt-st-ytlink` prominence, labeled "Find a jam ↗" - now opening the
    richer genre+feel panel instead of firing a single fixed search
    immediately.
  - **Curated video present:** a smaller secondary "Find another jam"
    trigger (`.bt-st-editlink`, the same convention as "Edit"/"Or edit song
    details") sits directly under the iframe - discovery is still one tap
    away without a second big control competing with the video.
  - The controls row (F15) ends lean: Play, Speed, `?` - no jam-related
    control lives there anymore.
- **Verified live (both variants):** no-video default screenshot shows ONE
  "Find a jam ↗" trigger in the stage, expanding to the full genre/feel
  panel; a real curated-video attach (via the existing paste-URL flow)
  re-rendered the Studio with the iframe AND the trigger correctly switched
  to the smaller "Find another jam" (`.bt-st-editlink`) variant, still
  opening the identical panel. `document.querySelectorAll('.bt-st-body
  [data-jamtoggle]')` confirmed zero remnants of the old solo-section
  control.

### F22 - remove the case-study link in Settings
- **Operator's words:** "remove link in settings for case study."
- **Code:** `music/play/index.html`'s `.aboutLink` anchor to
  `case-study-music-app.html` in the About accordion section.
- **Fix:** the anchor removed (no wrapper element to clean up - it was a
  standalone sibling `<a>`). Settings region otherwise untouched, per scope.
- **Verified:** `grep -n case-study music/play/index.html` returns zero
  matches (exit 1) - confirmed no other reference to that link exists
  anywhere else in the repo.

## Decisions summary (the two explicit OR-choices)

| Finding | Choice | One-line why |
|---|---|---|
| F13 | Cycling speed button (not a slider) | Deterministic one-hand tap beats drag precision; zero new component/data-model surface over the existing 3-tier enum |
| F18 | Collapse behind `?` (not a one-shot Notable dismiss) | Guide content is scale-dependent and re-derives per chip switch - a permanent dismiss would hide a reusable re-orientation aid the player needs again on the next scale switch |

## Constraints honored

- **Solo-layer only:** `sound.js`'s new `octaves`/`rootDwell` options are
  additive and opt-in; Compose's own key-preview call site is untouched and
  provably unaffected (unit tests assert the omitted-option default matches
  pre-change behavior exactly). Chord/scale THEORY computation
  (`studioTheory`, `Circle.diatonic`, `soloBundle`) was not touched anywhere
  - only rendering/interaction code changed. `harmonization-isolation` tests
  (test/tracks.test.js) still pass unchanged.
- **44px one-hand floor:** Play (44x44), Guide `?` (44x44), Speed (44 tall,
  64+ wide) all verified live via `getBoundingClientRect()`.
- **A9 static copy:** all new/changed strings ("Find a jam", "Find another
  jam", the search-state hint) are static templates, no new theory-derived
  prose.
- **SW cache bump:** `music/sw.js` CACHE `music-v117 -> music-v118` in the
  same commit as the shared/play diff, `music/shared/build-stamp.js`
  VERSION/UPDATED_ISO moved with it (guard-locked pair, `scripts/
  check-cache-bump.sh`).
- **Test coverage:** no coverage deleted - `renderDegreeTokens`'s removal
  has no direct test (it was never exported/tested standalone); every
  behavior test whose target changed (sound.js's playScale/buildNoteSequence
  contract) was extended with new cases proving BOTH the new option's effect
  AND the omitted-option backward-compatible default, not just the new path.

## V&V summary

- `node test/run-all.js`: **42 test files, 0 failed** (sound.test.js grew
  23 -> 29 cases; every other suite unchanged pass count).
- `node --check` on both changed `.js` files: clean.
- Live Playwright (412x915, headless Chromium) against the real app,
  driven through the actual "Solo over it" UI flow (not a synthetic
  bypass): zero console errors across every scenario, including 7+ seconds
  of continuous audio playback with a mid-play scale-chip switch.
- `scripts/layout-check.py --profile guitar-standard`: **ALL GREEN, 8
  configs** (360/412/768/1440px x 1.0/1.3x font scale) - zero tile overlap,
  zero SVG spill, zero page horizontal overflow with the new frets=12
  fretboard and the new chord-chip row.
- Screenshots: [docs/artifacts/solo-view-ux/](../artifacts/solo-view-ux/)
  (01: no-video default, 02: Guide open, 03: jam panel open, 04: mid-play
  with sounding highlights, 05: has-video default, 06: has-video jam panel).

## Known environmental artifact (not a regression)

Screenshot 05 shows "Video unavailable" inside the YouTube iframe after
attaching a test video ID via the existing paste-URL flow - this is
YouTube's own embed-player response in this sandboxed/offline test
environment (no real network egress to YouTube), unrelated to this change
(the iframe wiring itself - `embedUrl()`, the `<iframe>` markup - was not
touched). The STRUCTURE around it (the new "Find another jam" trigger, the
controls row, the fretboard, the chip rows) is exactly what this task
changed and is verified correct.
