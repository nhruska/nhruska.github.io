# M-AGENT Demo Script - "Skills Absorb the LMS"

> The showable walkthrough of the agent-interaction arc ([arc record](m-agent-arc-20260817.md)).
> Thesis in one line: **one musician's data, one contract, seven delivery shapes**
> ([pattern menu](agent-capability-patterns-20260817.md)) - a learning app whose content,
> coaching, and competency records are portable skill artifacts, with the app as the
> deterministic practice surface and any agent as the adaptive layer. No server anywhere.

## Audience framings

| Audience | Lead with |
|---|---|
| Developers / agent builders | Act 2 (the loop) + Act 3 (the plugin) - "the export carries its own AGENTS.md, so ANY agent is already integrated" |
| Learning/L&D people | Act 2 + the closer - "content library, coach, and gradebook as files the learner owns; standards bridge (xAPI) is a shape, not a rewrite" |
| Skeptics of AI apps | Act 1 - the app is fully deterministic and works in airplane mode; agents only ever propose through one validator |

## Act 1 - The app stands alone (2 min)

1. Open [the live app](https://nhruska.github.io/music/play/) on a phone. Point out: static
   GitHub Pages, installable PWA, works offline, no account, no backend.
2. Play a jam from the library. Open Settings - the build stamp maps the deployed build
   to its PR (audit trail).
3. The line: "Everything you're about to see agents do composes over THIS - and if every
   agent disappears tomorrow, the app loses nothing."

## Act 2 - A URL is a remote control, a file is an API (5 min)

1. From any chat surface, tap a jam deep link -
   [Reggae Jam in A](https://nhruska.github.io/music/play/?p=ukulele-gcea&jam=A,D,E&key=A&yt=ifOUmWAQups&name=Reggae%20Jam%20in%20A) -
   the Studio stands up the progression + backing video, ephemeral until Save.
   "Any agent that can emit a URL can now set up my practice session."
2. The share case: open the same link in an incognito tab - after the 10-second welcome,
   the SHARED jam opens. "Send a riff to a friend who has never installed anything."
3. Settings -> Skills -> Export -> share sheet. Open the zip: one SKILL.md per skill
   (human-readable table + lossless embedded JSON) AND a bundled `AGENTS.md` - **the
   instructions travel WITH the data**.
4. Hand the files to plain claude.ai chat: "You're my music coach - follow the bundled
   AGENTS.md, assess me, give me a jam link for my weakest area." The agent reads real
   levels, coaches, and replies with a tappable link straight back into the app.
5. The closer for this act: "That round trip needed zero setup, zero API, zero server -
   the export is self-describing, and the app's importer is the only writer."

## Act 3 - The plugin: the coach as a staff (5 min, laptop or Cowork)

1. Install by name: add this repo as a marketplace, install `music-coach`
   (see [plugin/README.md](../../plugin/README.md)). What ships: the interchange
   operating manual, three coach skills, `/music-coach:assess` / `practice-plan` /
   `jam` / `report`, and two agent personas (`music-coach`, `jam-dj`).
2. Point the session at an export folder, run `/music-coach:assess` then
   `/music-coach:report` - it renders a [single-file analytics page](https://nhruska.github.io/docs/artifacts/music-report-sample-20260817.html)
   (zero external requests, opens from file://, phone-ready).
3. The governance beat: agents PROPOSE profile docs (provenance-stamped,
   evidence-mediated); the app's one validator decides what lands. Show the sync gate +
   round-trip tests if the audience is technical.

## The closer (1 min)

- Delivery shapes ladder: offline PWA -> deep link -> single-file artifact -> agent-local
  server -> hosted static -> chat transport -> (only when someone pays for it) a hosted
  service like an xAPI/LRS bridge. Each degrades into the one below.
- "The LMS functions - content, coach, gradebook - became files the learner owns and any
  agent can serve. The moat isn't the files: it's the maintained contract, the
  credentials, and the integration expertise."

## Prep checklist (before demoing)

- [ ] Phone has the app installed + some real practice data (or import the sample)
- [ ] Build stamp current on the device (Settings)
- [ ] Incognito tab ready for the share case
- [ ] claude.ai app signed in (Act 2), CC/Cowork session with plugin (Act 3)
- [ ] Offline moment: airplane mode mid-Act-1 still plays the app

## Known rough edges (say them before they're found)

- YT embeds need network (progression-only jam offline - by design).
- Plugin commands need a Claude Code / Cowork session; claude.ai chat covers Act 2 only.
- `music-setup/v1` batch import prefills one entry at a time (carousel deferred).
