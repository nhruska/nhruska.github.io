# Guided AND Free - Song Wizard, Skill Profiles, and the Critical Path (2026-07-10)

> Operator spark (verbatim core): "I went to create a song and feels like there is a wizard
> or deterministic flow that probably doesn't require AI tutor to build songs or music
> theory knowledge... I like the flexibility and freeform creativity... let's explore what
> the human in the loop, with user simulation driven development, can do using a guided
> process while still maintaining the free and flexible capabilities... can we facilitate
> [the path to] mastery while building my skill profile for me? can we reverse compound
> engineer what a successful skill profile looks like for my learning objective? or my
> business goal? ... It's just a zoom level. it's fractal."

## 1. The wizard finding (UAT, live app)

Creating a song today means freeform Compose - powerful, unbreakable, but UNGUIDED. The
expectation was a deterministic build flow: pick a genre -> get proven section templates
(verse/chorus/bridge) -> pick a key -> assemble -> play. **No LLM required at runtime**:
the machinery is already deterministic data + theory engine (proven families from
songwriting-coach/M-12 mining, `Circle.diatonicInKey` for the palette, section conventions
as rules). This is the convergence point of three queued missions: M-11 M-CONSTRUCT
(builder), M-2 P5 (song-form teaching), M-12 S-SDD-TEMPLATES (the template data).

## 2. The design law: RAILS WITH EXITS (guided and free is a false dichotomy)

The taste constraint ("I can't break anything, I can just explore") is preserved by ONE
architectural rule: **every wizard step is nothing but a pre-filled freeform state.** The
wizard writes the same progression/Compose state the free canvas edits - so at ANY step
the operator can step off the rail and the canvas is exactly what the wizard built so far.
No second data model, no locked mode, no wizard-only artifacts. Guided = a path THROUGH
the free space, never a fence around it. (Same law the tutor prototype proved: guidance
is a lens on the real surface, not a separate surface.)

## 3. Skill profile: the learner model is deterministic

The app already tracks guidance level + notable dismissals. The extension is a **skill
graph**: chords played, keys/modes used, scales practiced, forms completed - observable
events, no judgment calls. On top of it:

- **Pedagogy-coach drives "next best step" deterministically** (skill ladder + spaced
  repetition over the graph - M-0's machinery, pointed at songwriting).
- **Mastery path = a sequence of persona states.** USDD makes growth TESTABLE: "beginner
  persona completes wizard flow X -> now satisfies the intermediate persona's scenario"
  is an assertable, deterministic check. The personas stop being just test fixtures and
  become the milestones of the curriculum.

## 4. Reverse-compound-engineering a skill profile (the fractal move)

Define the TARGET profile for an objective (play 3 songs in F Mixolydian; write one song
per month; run the proposals department via cockpit). Diff target vs current profile.
**The gap IS the queue** - the same goalpost machinery as UX friction profiles, pointed
at a person instead of a product. Zoom levels of the same object:

| Zoom | Profile | Gap-queue |
|---|---|---|
| Operator-as-learner | uke/guitar skill graph | practice queue (wizard flows, drills) |
| Operator-as-writer | songwriting skill profile | SDD burst loops per draft |
| Organization | skills INVENTORY (coach bench per department) | org-cockpit department queues |

Same primitive, three altitudes. Fractal confirmed - and the zoom LIMIT from the
org-cockpit doc still holds (actuators end at the org boundary).

## 5. Time budgeting: the critical path is deterministic GIVEN the weights

"Where do we budget our time? there is an optimal path, that is probably deterministic."
Split it honestly:

- **Deterministic**: sequencing, dependency resolution, rescoring, unlock analysis - a
  critical path over the queue graph weighted by (unlock value x operator-attention cost).
  This is a scheduler, and the merged Your-turn stream is its v1 (priority model = the
  weights, hand-set).
- **NOT deterministic**: the weights themselves at taste/vision forks - that is the
  operator's irreplaceable seat.
- **Idea generation is SEMI-deterministic**: friction profiles are already a deterministic
  idea GENERATOR (mine friction -> goalposts); strategic novelty is stochastic but can be
  HARNESSED deterministically (spike rows, a fixed exploration allocation in the budget,
  deep-research during absence). Portfolio shape: mostly critical path + a standing
  exploration budget - never zero, never dominant.
- **Cockpit implication**: a "strategy lane" on the Deck - ideas/concepts/friction
  profiles in strategic domains as queue items with the same form factors. Queued to
  org-cockpit (IV-4 territory), not built today.

## 6. Where the time goes next (the budget verdict, stated)

The critical path TODAY runs through the operator's open taste inputs (song bursts, first
department) - everything autonomous is done or gated on them. The next system investment
with the highest compounding is **the wizard + skill-profile arc**: it is the first
feature where the APP becomes a CE loop for its USER - the product teaching its human,
one zoom in from the system teaching itself.

## Product thesis + deliverable ladder (operator, 2026-07-10 - the refining burst)

Verbatim core: "the next compounding move is enabling the human in the loop to do things
they never thought possible. and it's not some AI trick. It's meeting someone at the
point of need regardless of their expertise... I would be most interested in the
deliverables, which are learning notes, then chords and building progressions, then
composing to coherent songs using guidance from music theory and proven hits from the
library... I like SONG as an entity and a deliverable. I like my skill profile being
grown between the gap of an expert model and where I am currently."

Locked into M-13/M-14:

- **The deliverable ladder IS the wizard's curriculum**: notes -> chords -> progressions
  -> coherent songs (theory-guided + proven-hit-guided). Each rung is a deliverable the
  user OWNS, not a lesson completed. Song = the terminal entity (already integrates with
  setlist + YouTube jams - the existing surfaces are the ladder's top rung).
- **Skill profile = the GAP against an expert model.** Not a score - a diff. The expert
  model (target profile per objective) minus the current skill graph = the practice
  queue; "meet me at the point of need" means next-best-step always selects FROM THE GAP
  at the user's current rung. (This answers IV-5 Q3's framing half: the profile's job is
  gap-selection; visibility remains open.)
- **Not an AI trick**: the ladder, the gap, and the guidance are deterministic (templates,
  theory engine, skill graph) - the LLM only ever coaches at the edges (lyric craft, taste
  encoding), never gates the runtime.

## Interview set (IV-5 on the Deck - answer ANY subset)

1. Wizard entry: its own "New song" flow from the launcher, or a "Guide me" toggle inside
   Compose?
2. First rail: genre -> sections -> key (template-first) or key -> feel -> sections
   (palette-first)?
3. Skill graph visibility: silent (drives defaults only) vs a visible profile page
   ("your keys, your chords, your streak")?
4. Does the wizard TEACH while building (inline why-cards per step, tutor-style) or stay
   silent-fast with teaching behind taps?
5. Scope check: wizard v1 ships without lyrics (progressions + form only), lyrics stay in
   the SDD session loop?

## Interview state update (2026-07-10, operator peel)

**Q1 ANSWERED**: wizard enters through the SAME flow as adding a song today (the +Add /
new-song affordance) - not a separate app - with a **dismissible guide** (tutor/coach/
mentor voice, rails-with-exits) **plus nudges from Compose** (notables-machinery cues
pointing into the guided path). Operator: "we're composers now... a way to grow our own
collection of songs. we could take the bubble of experience and facilitate songwriting."
With Q1 answered and Q2-Q5 assumed (cited below), **M-13 is spec-complete** - remaining
gate is M-12 (the template data), which is itself launch-ready.

## Assumed answers (until any arrives)

| Q | Assumed | Basis |
|---|---|---|
| 2 | Genre-first (template-first) | his original song-builder prompt shape: "ask for a key And a genre" - genre carried the meaning |
| 3 | Silent first, visible page later | one-screen-above-the-fold law; profile page is its own mission |
| 4 | Teaching behind taps | notables one-tip-at-a-time law + "silent-fast" matches the no-AI-needed insight |
| 5 | Yes - no lyrics in wizard v1 | app stays static; SDD owns lyrics |
| 1 | Unanswered - genuinely operator's (entry placement = taste) | queued |

## Related

- [sdd-vision-20260710](sdd-vision-20260710.md) + [sdd-pilot-friction-20260710](sdd-pilot-friction-20260710.md) - the template data + the writing loop
- [org-cockpit-vision-20260710](org-cockpit-vision-20260710.md) - the org zoom of the same fractal + the actuator boundary
- QUEUE.md M-11 / M-2 / M-0 / M-12 - the missions this converges
- [ux-friction-profiles-20260710](ux-friction-profiles-20260710.md) - the goalpost machinery reverse-CE reuses
