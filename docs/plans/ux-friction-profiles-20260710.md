# UX Friction Profiles x Skill Levels -> Scored Goalposts (2026-07-10)

> Operator tasking: "based on the scenarios and user skill levels, identify friction
> profiles. identify top X enhancement opportunities for UX as goal posts. score. set new
> goal posts by looking for CE opportunities from user POV." Grounded in: the 10 committed
> PW scenarios (8 flows + 2 persona runs), the notables LEVELS gate (what each level sees
> today), and this session's live UAT record. Personas are DETERMINISTIC app states - see
> [.claude/skills/usdd](../../.claude/skills/usdd/SKILL.md).

## Friction profiles (persona x observed friction)

### Sam - beginner ("Just starting out")
Strengths today: default-C compose, suggestion ladder (START WITH A COMMON PROGRESSION ->
NEXT CHORD -> ADD A 3RD CHORD), beginner tips (firstrun/tunefirst/savebasics).

| # | Friction | Evidence |
|---|---|---|
| B1 | Solo modal copy assumes vocabulary ("Save to add a video backing track or skip to practice" - what is a Studio? what is soloing over a track?) | operator UAT: "not clear of my expected workflow as new user"; copy is level-blind |
| B2 | Studio gives a beginner NO orientation - whynote correctly hidden (LEVELS), but nothing beginner-grade replaces it; first sight is a bare fretboard + jargon chips | persona-beginner-studio.json run (screenshot: no guidance content at all) |
| B3 | "Find a jam" empty state is a dead end ("pick a genre and feel below" - below is a finder, not a starter) | scenario screenshots, every Studio open on fresh state |

### Riley - intermediate ("I know some chords")
| # | Friction | Evidence |
|---|---|---|
| I1 | Post-progression flow ambiguity - after building, Solo/Save both surface with no "what should I do next" guidance | S-POSTPROG-FLOW (operator UAT, the remaining vision half) |
| I2 | All-view type-filter selected chip reads as a shouting CTA | S-TYPEFILTER-ACCENT (operator UAT, decision open) |
| I3 | Studio whynote banner keys to the KEY, ignores the selected scale chip | S-WHYNOTE-SCALE (queued from #198 review) |

### Jo - advanced ("I know my way around the neck")
| # | Friction | Evidence |
|---|---|---|
| A1 | Key picker still offers sharp-only key names (Bb keys picked as A#) | S-KEYPICKER-FLATNAMES (FORK-4 wave-2 residue) |
| A2 | Solo-scale choice is not remembered per song/track - resets to the inferred default every Studio open | code trace: curId derived fresh in wireScaleChips, no persistence |
| A3 | No named box positions on the scale view yet | S-BLUES-BOXES (S3, spec drafted) |

## Top goalposts, scored (Impact x Reach x Ease, 1-5 each; product)

| G | Goalpost (as a USDD red scenario) | I | R | E | Score | Feeds |
|---|---|---|---|---|---|---|
| G1 | **Persona-conditional Solo modal copy + a beginner Studio orientation tip** - beginner persona scenario asserts plain-language modal text and one orientation notable in the Studio | 5 | 4 | 4 | **80** | B1+B2, NEW: S-PERSONA-COPY |
| G2 | **Post-progression guided next step** - after Save/Skip, a single unobtrusive "next move" cue keyed to persona (beginner: "try soloing over it"; advanced: none) | 5 | 5 | 3 | **75** | I1 / S-POSTPROG-FLOW - flow DESIGN proposed below, taste-reviewable |
| G3 | **Type-filter quiet selected state** - filter chips get an outline-selected treatment; D-SELECTED-ACCENT stays app-wide (decision + justification below) | 3 | 4 | 5 | **60** | I2 / S-TYPEFILTER-ACCENT |
| G4 | **Jam empty state -> one-tap starter** - "Find a jam" empty state offers a single curated genre chip for the current key instead of prose | 4 | 3 | 4 | **48** | B3, NEW: S-JAM-STARTER |
| G5 | **whynote re-derives per selected scale** | 3 | 4 | 4 | **48** | I3 / S-WHYNOTE-SCALE |
| G6 | **Remember solo-scale choice per track** (localStorage, additive) | 3 | 2 | 4 | **24** | A2, NEW: S-SCALE-MEMORY |

Decisions made under the no-bottleneck amendment (justified, taste-reviewable in PR):
- **G3 decision:** filter-specific quieter treatment, NOT an app-wide D-SELECTED-ACCENT
  reversal - the operator already deferred the app-wide reversal once (2026-07-10 "2");
  a scoped fix honors that while killing the shout.
- **G2 proposal:** a one-line dismissible cue in the emphasis-ladder's chrome tier, never
  a modal - preserves "one primary per screen." Beginner-only by default (LEVELS gate),
  so advanced flow stays untouched. If this diverges from your vision, it is one small
  PR to revert - the persona scenarios document exactly what it does.

## CE goalposts from the USER'S POV (compounding, not one-off)

| CE | Goalpost | Mechanism |
|---|---|---|
| CE1 | Every user-facing PR ships with its persona scenario FIRST (red->green) | [usdd skill](../../.claude/skills/usdd/SKILL.md) - now the standing loop |
| CE2 | Persona coverage ratio tracked in test/pw/README (persona variants / flows; today 2/8) | grows toward every flow having beginner+advanced variants |
| CE3 | **First-session-success north star**: a beginner cold start reaches a strummable chord + hears it within 5 taps - encoded as the canonical regression scenario | NEW: S-FIRSTSESSION-SCENARIO (USDD red scenario to write) |

## Disposition

G1-G5 -> QUEUE SHORT (rows added this PR). G6 + CE3 -> Newly-queued findings. G2 flagged
as taste-reviewable post-build per the amendment. This doc is the scoring record; QUEUE
carries the live state.
