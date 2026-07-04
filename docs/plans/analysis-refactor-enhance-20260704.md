# Refactor + Enhancement Analysis (wiki-grounded, 2026-07-04)

> Sonnet analysis agent over all 21 wiki pages + hot code, excluding already-queued work. Every claim code-anchored. Feeds the QUEUE refresh of the same date. Verdict: fix silent-fail saves FIRST.

## A. Refactor / fragility (ranked risk x change-frequency)

| # | Finding | Evidence | Blast radius | Fix shape | Effort | Horizon |
|---|---|---|---|---|---|---|
| A1 | **Silent-fail localStorage saves** - saveCustom/saveSet/saveLast/savePerfPrefs/saveSongView wrap setItem in bare try/catch; saveProgression then shows "Saved to your Repertoire" UNCONDITIONALLY | songbook.js:736,747,751,777,1005; toast at 2393 | Quota/blocked storage = saved song vanishes after user was told it saved - P1's named fatal dismissal trigger ("ANY lost set/song data") | Apply backup.js applyAtomic's proven pattern (quota detect + rollback + real message) to routine save paths | M | **SHORT (top pick)** |
| A2 | **Songbook.mount() god-function** ~2100 lines, ~90 nested closures, all tabs + Studio hand-off in one closure scope | songbook.js:667-2762 | Every edit risks the whole file; each mission adds closures | Incremental extraction alongside M3 (which already reworks this file) - never big-bang | L | MID (fold into M3) |
| A3 | **buildAdapter inline in HTML** - the app's ONLY instrument seam incl. hardest geometry (movableVoicing, chain/backoff); test coverage is regex-extract + new Function, enharmonic path only | play/index.html:407-570; test/live-adapter.test.js | Untestable geometry; blocks instrument additions + HSR Lens | Extract to shared/chord-pack-adapter.js (UMD pattern), direct-require tests | M | MID (before next profile) |
| A4 | **wireTap movement-cancel x4 copies** - wiki itself flags "keep logic in sync" | list-item.js:105; songbook.js:590,1473,1747 | Threshold fix in one copy silently misses three (scroll-rail = "MOST dangerous" hazard class) | Dedup to list-item.js canonical | S | SHORT |
| A5 | **escHTML x7-8 divergent copies**; XSS regression already happened once (PR #67 v6, chord-pack sink) | songbook.js:330; tracks.js:190; list-item.js:16; notables.js:133; repertoire-form.js:31; diagram.js:28; play/index.html:716; triad-inversions.html:270 | Proven recurring risk class | One shared util (quote-escaping variant as canonical) | S | SHORT |
| A6 | **SW CACHE/CORE has zero automated verification** - "the law" is manual diligence; M-GUIDE has 4 agents bumping CACHE independently | sw.js:14-34; offline-pwa.md | Missing CORE file or unbumped CACHE = stale/broken offline app | ~30-line node script: CORE files exist + CACHE bumped when shared/ diff touched; wire into test run | S | SHORT |
| A7 | **SUGG Markov table inline HTML, untested, manual FORK-4 sync** | play/index.html:288-304 | Suggestion quality drift (not correctness) | Move to shared module + spelling-agreement test | S/M | MID |

## B. Enhancements

| # | Finding | Evidence | Why a musician cares | Effort | Horizon |
|---|---|---|---|---|---|
| B1 | ~~Orphaned tap-tempo engine~~ RESOLVED 2026-07-04: REMOVED as dead code (operator: never used; git history preserves) | D-TEMPO-REMOVED | - | - | done |
| B2 | **Backup-staleness nudge** via free Notables priority slot + existing backup.describe() | notables.js PRIORITY; play/index.html:768,876 | Proactively mitigates A1's user-facing risk; A9-compliant one-shot | S | SHORT |
| B3 | ~~jam field~~ ANALYSIS PREMISE STALE: the entry point EXISTED and was deliberately removed 2026-07-01 (8cf0647, operator interview - unregistered at analysis time). Closed won't-do; D-HERO-REMOVED registered; static-affordance fork -> Tier-2 | agent-stop archaeology | - | closed |
| B4 | **3 chip components redeclare base styles** (.chip / .bt-st-scalechip / .bt-st-chip); W3b about to add a 4th | songbook.css:109-111; tracks.css:157-160,181-185 | Visual drift a returning user feels | S - **FOLDED INTO M-GUIDE W3 spawn prompts** (timing) | NOW |
| B5 | **Two "selected" visual languages** - chips = accent fill; modeSwitch = surface+ring | songbook.css:111,219; tracks.css:158 | Inconsistent selection grammar across screens; pick one (taste call - batch interview) | S | MID |

## C. Verdict

Fix A1 first as its own narrow mission: genuine data-loss bug matching the app's #1 stated fear, proven fix pattern in backup.js, and the save paths live inside mount() - so doing it well is also the first honest slice of the A2 extraction.

## Drift registered

data-model.md jam-field section describes unimplemented behavior -> annotate page now; B3 implements or the annotation stays.
