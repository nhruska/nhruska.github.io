# Method: instrumented UX / human-factors capture of a running screen

This is the repeatable procedure `../scripts/web-ux-capture.js` automates. It
exists so a ux-coach critique is backed by measured evidence (WCAG contrast
math, tap-target geometry, real screenshots at a phone viewport) instead of
eyeballing.

Origin: ported from a Cowork-session handoff (2026-07-23) that produced the
first real critique run against Library/Setlist/Compose/Tune/Perform/Settings.
That critique is not reproduced here - it was a one-time review artifact, not
part of the skill. Any finding worth keeping belongs as a `test/pw` scenario
(the regression) or a queue/backlog entry (the fix), not a stale copy of a
markdown report.

## Environment gotchas

1. Deployed URLs (github.io, any public host) may be blocked by a sandbox
   egress proxy in a cloud/Cowork container. Do not fight it - clone the app
   locally with `--root` or serve it and pass `--url http://localhost:PORT/...`.
   On the laptop this rarely applies; `--root .` against a working checkout is
   normal.

2. Chromium ignores Playwright's proxy `bypass` for localhost. When a
   containerized run needs a proxy for anything else, disable it at the
   browser-arg level and unset proxy env vars for the node process - the
   script's launch args already carry `--no-proxy-server
   --proxy-bypass-list=*`; also run with:

       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy -u ALL_PROXY \
         node .claude/skills/ux-coach/scripts/web-ux-capture.js --root . --path /music/play/index.html

3. Chromium resolution is automatic and matches
   [test/pw/run-scenario.py](../../../../test/pw/run-scenario.py)'s own
   convention: `$PW_CHROME` env var override, else the newest
   `/opt/pw-browsers/chromium-*/chrome-linux*/chrome` (Claude web/Cowork
   container), else the newest
   `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome` (laptop shared
   install per [shared-toolchain.md](https://github.com/nhruska/claude-config/blob/main/rules/shared-toolchain.md)),
   else Playwright's own bundled default. Never run `playwright install` -
   the browser is already on disk in every environment this repo runs in.

4. A background `python -m http.server &` can get killed when a sandboxed
   shell returns. The script embeds its own tiny Node static server instead -
   nothing to background, nothing to remember to kill.

## Procedure

1. Point `--root` at a checkout of this repo (or pass `--url` for an already
   -reachable deployment) and `--path` at the screen's URL (query params like
   `?p=ukulele-gcea` carry app state the same way a real link would).
2. Identify the screens under review and how to reach each (bottom-nav
   selectors, routes, or query params). List them in the script's `SCREENS`
   array - this is the one thing every caller edits per review.
3. Run at the target device viewport (default 412x915 @2x, phone, touch).
   Repeat with `--dark` for dark theme.
4. Dismiss first-run onboarding deterministically before measuring, or every
   screen captures the modal instead of the content. Visit each tab once to
   burn its first-run callout, then re-run clean.
5. For each screen the script measures straight off the rendered DOM:
   - **tap targets**: bounding box of every button/link/input/label, flags
     min dimension under 44px (WCAG 2.5.5 / 2.5.8); note which sit in the
     hard-to-reach top band.
   - **contrast**: computed foreground color over the nearest non-transparent
     ancestor background, WCAG relative-luminance ratio, flag < 4.5 normal /
     < 3.0 large-bold text.
   - headings + type scale, scroll height vs viewport (overflow detection).
6. Capture deep states too, not just top-level tabs: a built progression, an
   empty state, an error state, the Perform/play view mid-song.

## What this script does NOT cover

Enforced heuristic scoring (Nielsen 10, ISO 9241), a full WCAG 2.2 AA audit
via axe-core (focus order, keyboard, ARIA, reflow at 400%, reduced-motion,
screen-reader traversal), Fitts-law motor modeling, persona-scripted cognitive
walkthroughs, and audio/haptic latency (headless has no audio device). This
script is the MEASUREMENT step of a ux-coach pass, not the whole critique -
apply [SKILL.md](../SKILL.md)'s method (situation of use, first job, named
principles) on top of what it measures. For anything already covered by a
committed persona flow, prefer running
[test/pw](../../../../test/pw/README.md) instead of a fresh capture.

## Relationship to the a11y-coach floors

The tap-target and contrast numbers this script measures are the same floors
[a11y-coach](../../a11y-coach/SKILL.md) enforces (44px, 4.5:1 / 3:1, "verify
under every accent theme"). Run a11y-coach's self-check against the same
screenshots when a finding is accessibility-flavored, not just aesthetic.
