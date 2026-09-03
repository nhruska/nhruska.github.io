# Skills + AI Agent: one self-describing package

> Operator directive, UAT batch 6 (2026-09-03). Design spec, awaiting build.
> Status: **SPEC'D - not built.** Queue row `S-SKILLS-STANDALONE`.

## What the operator said

> "can't we merge skills and agent accordion? A skilled export includes
> everything. there is no separate dump of skill, data, application, backup, and
> details the agent needs... the skills export needs to act as standalone zip
> file. users shouldn't have to copy prompts, paste them back and forward. you
> shouldn't need to read agent instructions, copy, paste them, or to think about
> too hard from my user's perspective."
>
> "The Standalone skills package should describe itself without any additional
> prompting just by uploading the zip file to my AI agent."
>
> "bundling all of the agent skill information into the zip file and not
> expecting internet access to go out and find the instructions and prompts for
> coaching is preferred."

## The diagnosis

Today the Settings sheet has **two** accordions for one job, and the job leaks
across both:

| Surface | Holds | What the user must do |
|---|---|---|
| Skills | per-skill competency rows, Import a profile, Export all skills | export a zip |
| AI Agent | Export agent bundle, Open AGENTS.md, Open capabilities.json, Copy doc links, Copy starter prompt | copy a prompt, paste it, maybe open a doc and read it |

That is **two exports, two mental models, and a copy/paste step** for what the
user experiences as one act: *hand my musician profile to my AI and get coached*.
The `Copy starter prompt` button is the tell - a bundle that needed a prompt
pasted beside it was not self-describing.

And the docs are fetched from public URLs, so a bundle handed to an agent with no
network (or an agent that will not fetch) is inert.

## The target

**One accordion. One export. One import. Zero prompt characters typed.**

The zip IS the interface. Drop it on any agent and it explains itself.

### Zip contract (v1)

```
music-skills-<instrument>-<yyyymmdd>.zip
  README.md              <- the FIRST thing an agent reads; states what this is,
                            what it wants back, and the update contract. Written
                            for an agent AND readable by a human.
  AGENTS.md              <- bundled, not fetched. The coaching instructions.
  capabilities.json      <- bundled. What the app can do, as data.
  profile.json           <- the user's competencies + evidence (the payload)
  skills/<skill-id>/SKILL.md   <- one per skill, the portable unit
  data/                  <- setlists, progressions, custom tracks, preferences
                            (what "a skilled export includes everything" means)
  UPDATE.md              <- the round-trip contract, below
```

`README.md` opens with a plain statement of intent so no prompt is needed:

> This is a musician's skill profile exported from the Music app. Read AGENTS.md
> for how to coach against it. To return an update, edit profile.json per
> UPDATE.md and hand back a zip of the same shape.

### Round-trip: three cases, one format

The operator named all three. The format must serve each without a different
procedure:

1. **One competency moves one point** after a practice session.
2. **Someone ports their own existing skills** into this format.
3. **A fresh install** whose owner had a coaching session and wants their real
   level reflected.

All three are the same operation: *hand back a zip of the same shape with
profile.json changed*. The app's import already dispatches on a JSON schema
string, so `UPDATE.md` states the schema, the merge semantics (add/overwrite,
never delete - matching Restore), and a worked one-point example.

### Transparency without obligation

> "For those interested, the agent interactions and instructions and prompts
> should be visible and viewable so they know what we're doing with their system
> if they should choose."

The instructions stay viewable in-app - but as a **disclosure, not a step**. One
row ("What the agent is told") opening the bundled AGENTS.md content inline. The
default path never sends the user to read it.

## Tap budget (the acceptance test)

| Flow | Today | Target |
|---|---|---|
| Export to an agent | open Settings, open Skills OR AI Agent, choose which export, download, **copy starter prompt**, paste into agent, upload zip | open Settings, one accordion, **Export**, upload zip |
| Import an update | open Settings, Skills, Import a profile, pick file | unchanged (already one tap + pick) |
| Read what the agent is told | Open AGENTS.md (leaves the app) | one row, inline, optional |

**Zero prompt characters typed** is the hard acceptance criterion - if the flow
still needs a pasted prompt, it has not met the directive.

## Open questions for the operator

1. **Accordion name.** "Skills" (keeps the user's word) or "AI Coach" (states the
   purpose)? Leaning **Skills** - it is what the thing IS; the coaching is what it
   is FOR, and the caption can carry that.
2. **Does `data/` (setlists, progressions, tracks) belong in the skills zip, or
   stay in Backup?** The directive says "a skilled export includes everything",
   which reads as yes - but that makes the skills zip a superset of a backup, and
   two things that both restore the app is a footgun. Proposal: skills zip
   CONTAINS it, and Backup/Restore stays as the plain-data path, with the import
   dispatching on which shape it was handed.

## Related

- Current: `renderSkillsPanel()` in `music/shared/songbook.js`, the AI Agent
  section in `music/play/index.html`, `music/shared/skill-md.js`,
  `music/shared/zip-store.js`, `music/shared/agent-readme.js`,
  `music/shared/capabilities.js`.
- The action-row standard this surface must compose:
  `music/engineering-wiki/ux-philosophy/component-conventions.md` ("Action rows").
