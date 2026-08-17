---
name: music-report
description: Render a self-contained single-file HTML analytics page from a user's Music-app export - competency levels vs targets, evidence recency, and repertoire summary. Use AFTER `/music-coach:assess` when the user wants a visual, shareable artifact rather than an in-chat table; every rule here composes with `music-interchange` for reading the export.
---

# Music report

Turn an assessed export into ONE self-contained HTML file the user can open on
any device, offline, with nothing installed. No server call, no external
request, no charting library - inline SVG/CSS only.

## Hard rules

1. **Single file, zero external requests.** No `<link>`/`<script src>` to a
   CDN, no web font, no remote image, no analytics beacon. Every asset (CSS,
   bar charts) lives inline in the one HTML file. No `<script>` tag at all -
   this is a presentation-only artifact, not a live app.
2. **Works from `file://` and any phone browser.** No build step, no server
   assumed - open the file directly.
3. **Never invent data.** A key absent from the export means you write an
   honest, plain-language "no data yet" sentence into that slot - never
   fabricate a level, a count, or a date.
4. **Dark-friendly by default** - `template.html`'s CSS already covers both
   themes via `prefers-color-scheme`; do not hardcode a color that only reads
   in one theme.
5. **Labels stay >=10px** in every SVG (the phone-DPI floor this app already
   holds itself to - see `music/CLAUDE.md`).

## Reading the export

Apply `music-interchange`'s "Reading an export" table first. This report
needs the **backup envelope** (not just a skills bundle) to compute
repertoire; if only skill bundle(s) were provided, render the competency
sections and mark repertoire "no backup provided".

| Data key | Source | What to compute |
|---|---|---|
| `music.competency.v1` | backup envelope `data` | Per skill: level, target, gap = target - level; evidence_count; last_evidence |
| `roadcase-<id>.setlist.v1` | backup envelope `data`, one key per instrument prefix | Setlist length = repertoire count for that instrument |

Recency buckets (compare each competency's `last_evidence` to "now", i.e. the
export's `exportedAt`): **fresh** < 7 days, **aging** < 30 days, **stale** >=
30 days or `last_evidence` is `null`.

## Filling `template.html`

Copy `template.html`, then string-replace each slot comment - leave the
surrounding CSS and structure untouched:

| Slot | Fill with |
|---|---|
| `<!--SLOT:profile-name-->` | the skill/discipline label(s) found, or "Music profile" if none named |
| `<!--SLOT:report-date-->` | the export's `exportedAt`, human-formatted |
| `<!--SLOT:source-note-->` | which files were read (backup envelope / skills bundle / both) |
| `<!--SLOT:competency-rows-->` | one `<div class="skill-block">` per skill found, each holding one bar row per competency (below) |
| `<!--SLOT:recency-strip-->` | the proportional `<div class="recency">` segment bar (`seg fresh` / `aging` / `stale` classes) followed by a `<div class="recency-legend">` whose spans carry the counts (`<span class="legend-fresh">9 fresh</span>` ...). OMIT zero-count segments entirely, and put NO text inside any segment narrower than ~15% - tiny segments clip their own labels into overlap (caught on the first live render); the legend is the always-legible copy of the numbers. Or the honest no-data sentence |
| `<!--SLOT:repertoire-rows-->` | one table row per instrument found (name + setlist length), or "no backup provided" |
| `<!--SLOT:generating-agent-->` | your tool name + the generation timestamp |

### One competency bar row

```html
<div class="comp-row">
  <div class="comp-label">Chord shapes</div>
  <svg class="comp-bar" viewBox="0 0 360 22" role="img" aria-label="Chord shapes: level 62 of target 85">
    <rect class="track" x="0" y="6" width="300" height="10" rx="5"/>
    <rect class="fill"  x="0" y="6" width="186" height="10" rx="5"/>
    <line class="target" x1="255" y1="2" x2="255" y2="20"/>
    <text class="val" x="304" y="15">62/85</text>
  </svg>
</div>
```

`fill` width = `round(level/100*300)`. `target` line `x1`/`x2` =
`round(target/100*300)` (both 0-300 since level/target are 0-100). The
viewBox is 360 wide on purpose: the bar spans 0-300 and the `x="304"` value
label lives in the remaining 56 units - a 300-wide viewBox CLIPS the label
invisible (caught on the first live render). Keep the
`<text>` element as-is - its size comes from the stylesheet's `.val` rule
(already >=10px); don't add a `font-size` attribute that could undercut it.

## MUST-NOTs (in addition to `music-interchange`'s)

Never fetch a remote font, image, or script; never add a `<script>` tag;
never claim a competency is "on track" or "stale" without the evidence
backing it; never write the rendered report anywhere but where the user
asked (their own machine) - it carries their personal data like every other
export.

## Self-check before saving

1. Does the file have zero `http://`/`https://` in any `src=`/`href=`, and no
   `<script>` tag?
2. Did I fill every slot `template.html` names, with real data or an honest
   no-data sentence - never a fabricated number?
3. Are all SVG text labels >=10px?
4. Did I invent anything the export didn't contain?

## Related

- [music-interchange](../music-interchange/SKILL.md) - the export-reading
  contract this skill composes with
- [../../commands/report.md](../../commands/report.md) - the
  `/music-coach:report` command that invokes this skill
- `template.html` (this directory) - the file to copy and fill
