# Sprint-1 Feature Verification - Guided Test Steps (2026-07-04)

> All 8 sprint PRs merged and LIVE at https://nhruska.github.io/music/play/ (build music-v78).
> First open may serve the old cached build once - if anything looks stale, reload once
> (network-first SW picks up v78 and refreshes the precache). Est: 10-15 min total.
> Verify on the Pixel, one-handed, instrument in hand - that IS the test condition.

## T1 - Clear undo (the P0) - PR #100

1. Compose tab -> pick key E + Mixolydian -> tap 3-4 chords into the progression.
2. Tap **Clear** (note: it now sits at the far LEFT, away from Save).
3. EXPECT: progression empties AND a banner appears with **Undo** - no browser popup.
4. Tap Undo. EXPECT: exact progression back (same chords, same key chip).
5. Clear again -> now tap ANY chord to add it. EXPECT: banner disappears (undo invalidated by the new edit - by design).
6. Clear again -> switch to Library tab -> back to Compose. EXPECT: banner gone (session/route-local by design), progression stays empty.

## T2 - Slot removers (44px + scroll-safe) - PR #100

1. Build 3 chords. Tap a chord's little x - even slightly off-center. EXPECT: easy hit, right chord removed.
2. Put your thumb ON an x and DRAG up/down to scroll. EXPECT: page scrolls, chord is NOT removed (movement-cancel).

## T3 - Save dialog contrast + keyboard - PR #107

1. Build 2 chords -> tap **Save**.
2. EXPECT: dialog card is SOLID (no gray wash), all text crisp incl. "Add to setlist"; dialog sits near the TOP of the screen.
3. Tap the name input - keyboard opens. EXPECT: input, checkbox, AND Save/Cancel all still visible above the keyboard.
4. Type a name -> Save. EXPECT: saves normally (toast), lands in Library/Setlist per checkbox.
5. Check both themes (Settings -> theme) if you have 30 extra seconds.

## T4 - Settings panel structure - PR #106

1. Tap the gear.
2. EXPECT: "Settings" title + X pinned at top; buttons row pinned at bottom; below the buttons ONE line: build version + last backup together.
3. Scroll the middle content. EXPECT: top and bottom bars do not move.
4. Toggle theme while in there. EXPECT: still works instantly.

## T5 - First-run cue - PR #103

Needs a fresh profile: open the app in an incognito/private tab (or after clearing site data).
1. EXPECT on Library: one banner - "Tap any song to open its chords..." with the easy-song (3 chords) nudge.
2. Dismiss it (x). Navigate away and back, reload. EXPECT: never returns.
3. Normal (non-incognito) profile: EXPECT no banner (you are not first-run).

## T6 - "Why this scale works" hint - PR #104

Also once-ever per profile - test in the same incognito session as T5, AFTER dismissing T5's banner:
1. Compose -> pick a key/mode -> add a chord -> **Solo over a backing track**.
2. In the Studio, EXPECT one banner: relative/parallel "why" for your key (e.g. "C major and its relative minor share the same notes...").
3. Dismiss. Re-enter Studio. EXPECT: never returns. (Also note: only ONE hint ever shows at a time - if T5's banner is still up on another screen, this one politely waits.)

## T7 - Setlist clear guard - PR #105

1. Add a song to the Set. Setlist tab.
2. Thumb ON the header ✕ and drag to scroll. EXPECT: scrolls, no dialog.
3. Deliberate tap on ✕. EXPECT: the "Clear your setlist?" confirm appears (unchanged behavior, now scroll-safe). Cancel it.
4. Edit mode: the per-item remove x is bigger; removing still shows the undo.

## T8 - Theory canon (invisible, for the record)

Nothing to tap: 1008 conservatory-ground-truth assertions now run in every test pass (PR #101) and fail the build naming the exact key/mode/degree if any future change breaks pitch, quality, or roman labels.

## If anything fails

Reply here or telegram with the T-number + what you saw - it becomes a finding and a fix PR within the mission.
