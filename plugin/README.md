# music-coach (Claude Code plugin)

Package the Music app's coach bench and its agent-interaction contract as an
installable Claude Code plugin. Any Claude Code (or Cowork) session with this
plugin installed becomes a personal music coach for
[nhruska.github.io/music/play/](https://nhruska.github.io/music/play/) -
grading a user's exported skill/backup files, proposing evidence-mediated
profile updates, and emitting one-tap jam links - all through the same
read-export / propose-doc / emit-link contract the app itself defines. No app
code, no network, no server.

## Install

This plugin lives inside the `nhruska.github.io` repo at
`plugin/music-coach/`. Two ways to use it:

1. **Copy the directory.** Copy `plugin/music-coach/` into your own
   `~/.claude/plugins/` (or a project's `.claude/plugins/`) directory. Claude
   Code picks up its commands, skills, and agents automatically.
2. **Add this repo as a marketplace source** once a marketplace manifest
   exists at the repo root (not shipped yet - see "Not yet built" below), then
   install `music-coach` by name.

No build step, no dependencies - it is markdown + JSON, same as the app it
coaches for.

## What's inside

| Piece | Purpose |
|---|---|
| `skills/music-interchange/SKILL.md` | The operating manual for the contract - how to read an export, how to propose a profile update, how to emit a jam link. Every other piece here composes with it rather than restating its rules. |
| `skills/music-theory-coach/SKILL.md` | Theory-correct defaults (scale/mode/chord choices) - copied from the app's own coach bench. |
| `skills/pedagogy-coach/SKILL.md` | Learning-design rules (one-thing-at-a-time, spacing, recall-first) - copied from the app's own coach bench. |
| `skills/songwriting-coach/SKILL.md` | Proven progression families per genre/section, lyric-craft rules - copied byte-for-byte from the app's own coach bench (no links needed adjusting). |
| `commands/assess.md` | `/music-coach:assess <export>` - competency gap read, evidence staleness, repertoire summary. |
| `commands/practice-plan.md` | `/music-coach:practice-plan <export>` - an evidence-based, pedagogy-sequenced plan. |
| `commands/jam.md` | `/music-coach:jam <goal>` - a proven progression + a one-tap jam deep link. |
| `agents/music-coach.md` | The assess+plan persona - reads exports, proposes profile docs, never writes app storage. |
| `agents/jam-dj.md` | A narrow agent that only composes progressions and emits jam deep links. |

The three copied coach skills are byte-faithful to their source at
`.claude/skills/<name>/SKILL.md` in this repo, except for markdown links that
would resolve outside this plugin (a sibling skill not bundled here, or a
wiki page under `music/engineering-wiki/`) - those were repointed to their
`https://github.com/...` source location so they still resolve when this
plugin is installed standalone. `test/plugin-sync.test.js` (repo root)
enforces this: it fails if a bundled skill's body drifts from its source for
any reason other than a documented link swap.

## Demo script

Export your Music app profile (Settings -> Skills -> Export, and optionally
Settings -> Backup -> Export) to a local folder. Point a Claude Code session
with this plugin installed at that folder and say:

> "Here's my Music app export - give me a practice plan for ukulele, and jam
> me something folk in G to warm up on."

The session reads your competency levels and preferences (never guessing),
names a proven folk progression with why it fits, hands you a tap-to-play jam
link, and - if it proposes any level changes - writes them as a `SKILL.md`
file with cited evidence for you to import back into the app yourself. Your
data never leaves your machine; the app's own merge logic decides what
actually lands.

## Not yet built

- A marketplace manifest at the repo root for one-command install by name
  (today: copy the directory).
- `L1`/`L3` transports from the interchange contract (live folder watch,
  share-target) - this plugin only uses the always-available `L0` file
  interchange.
