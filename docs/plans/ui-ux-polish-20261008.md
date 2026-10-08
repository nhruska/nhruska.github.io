# UI/UX Polish Mission - 2026-10-08

> Goal spec for the nh-pages UI/UX polish pass launched by Nik on 2026-10-08. PR [#372](https://github.com/nhruska/nhruska.github.io/pull/372). Base: main at v371.

## Completion condition

Every LAUNCH unit below is merged into PR #372 as its own commit with its own cache-bump pair, `node test/run-all.js` is green, `scripts/check-cache-bump.sh` passes, `scripts/a11y-check.py` passes, and each unit carries a 412x915 render proof under `docs/artifacts/ui-polish-20261008/`. GATED units ship only after Nik picks a direction.

## How the candidates were found

- Session-start sweep + a read-only inventory of QUEUE.md, docs/plans/*uat*|*polish*|*friction*, the engineering-wiki findings register, and the app CSS/JS (most old rows had already shipped - see "Dropped" below).
- Measured capture with `.claude/skills/ux-coach/scripts/web-ux-capture.js` at 412x915 on Songs / Compose / Tune / Settings, light and dark: 0 sub-44px targets on those screens, worst text contrast 4.58:1 light and 5.5:1 dark (the 1.63:1 and 2.94:1 dark-Compose rows are disabled controls at 0.4 alpha). The floors that fail live on overlays the capture did not open (units U1).

## LAUNCH units (no taste call needed - conventions already decide them)

| Unit | What | Files | Verify | Size |
|---|---|---|---|---|
| U1 touch-floor sweep | `#maxClose` gets `type=button`, `aria-label`, 44x44. `.invModal-x` 38 -> 44. `.searchClear` 26 -> 44 halo (house pattern: invisible 44px halo over the visual). `.li-up`/`.li-dn` 40x32 -> 44 min height + `--r-btn-sm` radius token (register row "li-up/dn below 44px floor"). | music/play/index.html, music/shared/songbook.css | a11y-check.py, consistency-lint, geometry probe on each control at 412 | S |
| U2 icon glyph -> SVG | Bar menu, mini x, sound toggle, banner x, `.songCanvasClose`, `.welcomeCard .x` migrate from text glyphs to inline SVG at the icon-density standard (22-28px ink in 44-56px boxes). Tab bar glyphs stay (GATED G1). | songbook.js, tracks.js, index.html, songbook.css | ui-icon-density scenario, unit suite, screenshot per surface | M |
| U3 tune copy dedupe | The Tune card h3 subNote repeats the header purpose line word for word. Drop the card subNote (the purpose line is the system-wide carrier). | music/play/index.html | screenshot 412, grep no second copy | S |
| U4 chord-chip primitive | `.bt-st-chordchip` (40px, Studio) and `.chordChips .c` (44px, song view) carry one meaning with two looks. Compose the Studio chip from the song-view primitive (Element Consistency Law: fix at the primitive). Confine edits to tracks.css / tracks.js so it can run beside U2. | music/shared/tracks.css, tracks.js | Studio scenarios (cockpit-*, studio-*), 44px probe, both themes | M |
| U5 lyric clip hint | `.sheet` lines clip at the right edge with no scroll sign. Render-check first at 412 with a long-lyric song. Only if it reproduces: opt the sheet into scroll-hint.js. | songbook.css (+ sheet-render.js if needed) | screenshot before/after | S |
| U6 docs reconcile | test/pw/README persona coverage line (measured 25 of 133 scenarios carry a persona, not "2 of 8"). Wiki findings register `.helpIcon` row (applied at tracks.js). QUEUE.md: mark S3/S4/S5/S8/S9, S-TYPEFILTER-ACCENT, S-OVERLAY-HITTEST-SWEEP (#352), the two video scenarios (#344) as shipped. | test/pw/README.md, music/engineering-wiki/ux-philosophy/component-conventions.md, docs/plans/QUEUE.md | link check, no app files touched (no bump) | S |

Order: U6 runs in parallel with U1+U3 (no shared files). U2 and U4 run in parallel after U1 lands (U4 confined to tracks.*). U5 last.

## GATED units (Nik picks - one AskUserQuestion at the rest point)

| Id | Decision | Options |
|---|---|---|
| G1 tab bar icons | Migrate the ♪ ✎ ◴ text glyphs to SVG per the icon-density standard? It is the primary nav look. | keep glyphs / migrate |
| G2 tuner idle state | The idle card shows a middle-dot placeholder and ~500px of reserved space before Start. #348's guided flow is still awaiting device UAT - polish now, or after that UAT? | after UAT / now |
| G3 S-TONES | Chord detail shows correctly spelled tones (E#dim = E# G# B). Small, unblocked since #199, theory-coach consult required. | ship in this PR / later |
| G4 S-GUIDE-CONTEXT, S-POSTPROG-FLOW, S-AUDITION-CAPTURE, M-13 tutor polish, M-PERFORM, desktop layout | Vision items from QUEUE - each needs its own interview. | interview next / park |

## Dropped (already shipped - the QUEUE rows were stale)

S3/S4/S5/S8/S9, S-TYPEFILTER-ACCENT (songbook.css `.catTabRow .chip.on`), S-OVERLAY-HITTEST-SWEEP (#352), video scenarios (#344), ux-findings F1-F11, every pr65 item, S-COMPOSE-CALM, setlist gestures. The scroll-hint chevron overlapping the 4th progression chip is the designed fade + chevron affordance, not a defect.

## Verify commands

```
node test/run-all.js
bash scripts/check-cache-bump.sh
python3 scripts/a11y-check.py
python3 test/pw/run-scenario.py test/pw/scenarios/ui-icon-density.json
NODE_PATH=/opt/node-tools/node_modules node .claude/skills/ux-coach/scripts/web-ux-capture.js --root . --path "/music/play/index.html?p=ukulele-gcea" --out <dir>
```

## Never-do / abort

Never merge (Nik merges). Never change tuner flow semantics (G2). Never bump the cache in a worker branch - the orchestrator bumps at integration, one version per integrated commit (`music-v372`, `-2`, `-3` ...). The bump is a TRIPLE plus one: `music/sw.js` CACHE, `shared/build-stamp.js` VERSION + UPDATED_ISO, `python3 scripts/stamp-asset-versions.py` (53 asset URLs in play/index.html + 5 in triad-inversions.html), and `math/version.js` MATH_VERSION whenever songbook.css / theme.js / esc.js / toast.js change (Math precaches them). `scripts/check-cache-bump.sh` judges all four. Abort a unit after 3 failed gate attempts and record the evidence here.

## Tooling fixed on the way

- `scripts/a11y-check.py` and `scripts/layout-check.py` now resolve Chromium like `test/pw/run-scenario.py` ($PW_CHROME > /opt/pw-browsers > Playwright default), so both run directly in a Claude web container. a11y gate proven: `PASS a11y gate: 0 total, 0 baselined, 0 new` (A2/A3/A4 examined zero elements - the script's own WARN, pre-existing).
- `scripts/layout-check.py` seeds the welcome tour + callouts done (the `#welcomeOv` overlay intercepted every click).
- DEFERRED (scope stated, not fixed here): `layout-check.py`'s Compose key-picker flow is stale against the app - a Playwright mouse click on `#keyRoots .rootChip` never selects a root (probe: no `.on` root, flyout stays open), so `wait_for_function(keyFlyout.hidden)` times out at the first width. The script predates the current flyout. It is manual and not in CI. Re-author its picker steps as a pw scenario verb instead.
- U5 probe (scratchpad u5-sheet-clip.py): at Pixel 5 width the practice sheet is 742px wide in a 329px box on Mr. Jones (723 Refugee, 704 Roxanne), `overflow-x:auto`, no affordance. The Stage already wraps at a measured budget (CW-1, `perfWrapMaxChars`) - the song view never passes one. U5 = pass the budget in the song view too.

## Ledger

| Unit | State | Commit | Version |
|---|---|---|---|
| U1 | integrated | squash of claude/polish-u1 @ b9228a0 | music-v372 |
| U2 | integrated | squash of claude/polish-u2 @ 247dae4 | music-v372-3 |
| U3 | integrated | with U1 | music-v372 |
| U4 | integrated | squash of claude/polish-u4 @ 9502714 | music-v372-2 |
| U5 | queued | | |
| U6 | integrated | squash of claude/polish-u6 @ be8c890 | n/a |
