# Song-Driven Development (SDD) - Vision Capture (2026-07-10)

> Operator spark (verbatim): "I'm looking for tasteful examples using proven success from
> song driven development, or 'sdd' proven, that I could piece together. And I guess I'd
> slowly be building a skill that I could apply compound engineering to for lyric writing
> and composition... then develop and grow skills for building successful songs, composing
> those into albums or other optimal streaming strategies. cadence and optimization of
> those in iterative deterministic loops."
>
> Provenance: the operator's FIRST-EVER LLM prompt (early ChatGPT) was a song builder -
> ask for a key + genre, get progressions per song section, then artist style + topic for
> lyrics. The system he has built since can now BE that song builder, with deterministic
> loops where the original had one-shot generation. Full circle, on purpose.

## Vision (one paragraph)

Songwriting becomes a compound-engineering domain. "Proven" is data, not vibes: progression
templates mined from real successful songs (our own catalog first - songs.json already
stores per-song `seq` + sectioned `sheet`), organized by genre and song section, offered as
tasteful starting material the operator pieces together. Each session of writing grows a
SKILL (songwriting-coach and its descendants) the way the theory/ux/pedagogy coaches grew:
friction -> encoding -> better defaults next time. The recursion horizons (songs -> albums
-> release cadence/streaming strategy) are the same loop applied at larger scope.

## The crystallized principle (innovation crystallization, operator 2026-07-10)

**Expertise in any domain is a compound-engineering loop. Capability is bounded by loop
quality, not by domain.** A domain is "learnable by the system" when its work can be run as:
proven examples in -> attempt -> deterministic-as-possible verification -> friction encoded
into a coach/skill -> better attempt. Songwriting, music theory, UX, pentesting, patents -
same machinery, different verifiers. The meta-move is always: create a better loop.
(Cross-project encoding: claude-config compound-engineering-philosophy addendum.)

## What exists already (compose, do not duplicate)

| Asset | Relevance |
|---|---|
| `songs.json` (`seq` + `sheet[[section, line]]`) | The proven-progression corpus IS already in the repo - real songs, real sections, real changes |
| `Circle.romanFor` (key-aware roman analysis) | The mining tool: seq -> roman pattern -> genre/section template, key-independent |
| M-11 M-CONSTRUCT (queued) | Song construction + section transitions - SDD's proven-template library is its INPUT |
| M-2 Tutor Phase 5 (queued) | Song-form coaching (AABA, sections) - teaching-side sibling |
| Compose + suggestions + jam starters | The assembly surface SDD templates plug into |
| songwriting-coach skill (NEW, this PR) | The bench seat: proven progression families, section conventions, lyric craft |

## Horizons

| Horizon | Work | Verifier |
|---|---|---|
| NOW (this PR) | Vision captured, songwriting-coach scaffolded, interview set queued on the Deck | this doc + skill + queues.json |
| SHORT (post-interview) | S-SDD-TEMPLATES: mine songs.json -> roman-pattern template library (genre x section), unit-tested; canonical patterns (12-bar, axis, doo-wop) added with citations | deterministic: template extraction tests + professor-trap-style golden patterns |
| MID | SDD assembly UX inside M-CONSTRUCT: pick genre/section -> proven templates in the key, piece together a song skeleton | USDD persona scenarios (red-first) |
| MID | Lyric-writing loop as a SESSION skill (app stays static/no-LLM): topic + style -> drafts against songwriting-coach craft rules, results stored to `sheet` | prosody/craft checklist in the coach + operator taste |
| LONG | Album composition: sequencing, key/tempo/energy arcs across a set | interview needed |
| LONG | Release cadence / streaming-strategy optimization loops | interview needed; external data source question |

## Interview queue (async - answer ANY subset, rest become assumed answers)

Queued as IV-3 on the Ops Deck (ops/queues.json). The set:

1. **Proven = whose success?** Songs YOU love playing (catalog-mined), canonical genre
   patterns (12-bar, axis, doo-wop), chart/streaming-proven external corpora, or all three?
2. **First genres?** Catalog skews folk/rock/blues - start there, or name targets?
3. **Surface:** SDD assembly inside Compose (extend the progression builder with sections)
   vs the M-CONSTRUCT builder as its own flow?
4. **Lyrics in v1?** Session-side skill only (app static), or also an app surface for
   storing/editing verses against sections?
5. **Recursion parking OK?** Albums + streaming stay LONG until songs-level SDD proves out?
6. **Your first SDD target:** an actual song you want to write (key/genre/topic) - the
   pilot that makes the loop real?

### Assumed answers (until any interview answer arrives - basis cited)

| Q | Assumed | Basis |
|---|---|---|
| 1 | Catalog-mined + canonical patterns; external streaming corpora deferred | data in hand, zero new deps; external-data question is a spike |
| 2 | Folk/rock/blues first | songs.json composition; operator plays uke/guitar |
| 3 | Composes with M-CONSTRUCT (operator Q5 2026-07-04 already made construction its own mission) | QUEUE.md M-11 |
| 4 | Session-side only in v1 | app is static/no-LLM by architecture; `sheet` already stores lines |
| 5 | Yes - LONG | operator phrasing "slowly be building a skill" |
| 6 | Unknown - genuinely his; sits in the interview queue | taste seat is non-simulable |

## Related

- [ops-deck-vision-20260710](ops-deck-vision-20260710.md) - the glass this mission emits to
- [vision-ear-first-20260704](vision-ear-first-20260704.md) - M-CONSTRUCT origin
- QUEUE.md M-11 / M-2 - the construction + coaching missions SDD composes with
- `.claude/skills/songwriting-coach/SKILL.md` - the new bench seat
