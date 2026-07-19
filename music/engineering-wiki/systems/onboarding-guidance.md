# Onboarding + Guidance Surfaces `[STABLE]`

[Wiki](../index.md) > [Systems](../index.md) > Onboarding + Guidance

> Owns: the first-run welcome tour (S-WELCOME), the calm guidance contract
> (S-GUIDANCE-CALM: no inline asks, one tip per session), and the header
> orientation (tab pill + purpose line). Shipped 2026-07-18/19, PRs #278/#279.

## The welcome tour (S-WELCOME)

3-panel scroll-snap sheet on a truly fresh device: (1) Welcome + instrument
pick, guitar-standard preselected; (2) the level ask (same storage + side
effects as the retired in-app ask - skipping leaves level unset); (3) a
four-tab map. Panel 1 carries the per-instrument-state notice ("each
instrument keeps its own setlists and progressions - the song library is
shared").

- Anchors: `play/index.html` `initWelcome()` (guards, panels, rawFinish),
  `WELCOME_KEY = 'music.welcomeDone.v1'`, `hadProfileKey` snapshot BEFORE
  boot persists `music.activeProfile.v1`.
- Lived-in guard: any prior visit (profile key or chosen level) marks the
  tour done silently. `?welcome=1` FORCES it (review/replay hook) and
  preselects the CURRENT instrument so a tap-through never switches profile.
  Settings > About carries a "Replay the intro tour" row on the same hook.
- Finishing with a different instrument persists the profile key and reloads
  via `?p=`; the level pick settles the ask exactly like the banner did
  (GuidanceLevel.set + notables `guidanceask` marker).
- Scenario: `test/pw/scenarios/welcome-tour.json` (`firstRun: true` opts out
  of the runner's welcomeDone seeding; every other scenario models a
  returning user).

## Calm guidance (S-GUIDANCE-CALM)

Operator ruling: guidance never clutters a working surface.

- The ask banners (`guidanceask`, `diagrampref`) NEVER render inline - the
  tour asks level once; Settings > Preferences owns both choices; unset
  behaves as the defaults (beginner grading, DiagramPref 'dots').
- ONE journey tip per app SESSION: `notables.js` `claim()` carries a
  sessionStorage gate (`music.notables.session.v1`) - the first granted
  consumer is the session's only tip; dismissal reveals nothing until the
  next app open; the holder may re-claim; a strictly-higher-priority
  boot-race preemption still wins and takes the record. No sessionStorage
  (Node) = gate off, so arbitration unit tests run unchanged.
- All tips share the ONE `.notableBanner` primitive (guidance tokens).
- Tests: session-gate block in `test/notables.test.js`; scenarios
  `guidance-calm-quiet.json` / `guidance-calm-session.json`.

## Header orientation (UAT r3 revival)

Tour-only orientation proved too little once lived with - the header now
carries an active-tab pill (`#tabPill`, fed by the `music:tab-shown` event)
and ONE compact per-tab purpose line (`#ctxLine`, fed by the engine's
`contexts` option - `CONTEXTS_BASE` in `play/index.html`). The appbar
flex-wraps: row 1 brand + pill + offline pill + gear, row 2 the purpose
line. This is the compact successor of the retired `.tabIntro` strip, NOT a
return of it - one line, chrome-tier, never a banner.

## Related

- [ux-philosophy/expertise-adaptive-display.md](../ux-philosophy/expertise-adaptive-display.md) - level semantics the tour's ask feeds
- [systems/compose-jam-first.md](compose-jam-first.md) - the adaptive Compose landing that reads the same level
- [decisions.md](../decisions.md) - CALM-1, TOUR-1, HDR-1
