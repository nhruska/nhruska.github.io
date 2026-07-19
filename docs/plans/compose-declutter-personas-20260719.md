# Compose Declutter + Persona Expansion (S-COMPOSE-CALM)

> Operator friction 2026-07-19: "song building has cluttered the app with
> controls, taken away real estate, introduced cognitive friction... I
> personally create a progression quickly from chords I'm jamming on. I don't
> need to see song building tools - songs are built and refined over sessions."
> Mission: declutter Compose by composing EXISTING primitives (panels, flyout,
> accordion, toggle, chips), map journeys per persona (USDD-deterministic),
> and gate guidance with proper pedagogy. Status: DESIGN - interview pending.

## Diagnosis (ux-coach lenses)

Compose serves TWO JOBS with one ambient surface:

| Job | Moment of use | Cadence | Tools it needs |
|---|---|---|---|
| **JAM** (the landing job) | instrument in hand, seconds matter | every session | chord grid, suggestions, progression strip, transpose/key, solo |
| **BUILD** (the project job) | deliberate authoring | returns over sessions | sections, song canvas, song map, lyrics, save-as-song |

The clutter is job 2's tools ambient on job 1's surface (landing effect: the
tab must land as JAM). Principle: the second job earns ONE intentional step of
distance (gulf of execution stays short), never zero.

## Proposal (composes existing primitives only)

1. **Jam-first landing.** Compose default = ctrlBar + progression strip +
   suggestions + chord grid. Zero song machinery visible.
2. **Song canvas behind one gesture** - reuse the welcome-tour slide-panel
   primitive (`.wPanels` scroll-snap; "the slides are smooth AF"): Panel A =
   Jam, Panel B = Song canvas (sections, map chips, lyric lines). A 2-dot /
   segmented `Jam | Song` header is the same primitive family as the
   viewToggle. Hardware Back pops Song -> Jam (NavHistory).
3. **The progression is the shared currency.** From Jam: "add these chords to
   a section" pushes the current progression into the Song panel (reuse of
   chord selection; no re-entry). From Song: tapping a section loads its
   chords back into the Jam strip for audition.
4. **Save defaults to progression** (quick capture, zero friction);
   "grow into a song" is the explicit second intent (extends the S-SAVE-INTENT
   flow already shipped in #271).
5. **Level gates DEPTH, not access** (pedagogy): every persona can reach both
   panels; what varies is guidance density + default emphasis (beginner:
   starter progressions prominent; advanced: collapsed chips - already shipped
   via chord-collapse).

## Persona set v2 (each = seedable deterministic state, USDD)

Axis 1 = guidance level (exists). Axis 2 = GOAL, expressed as fixture state
(library/setlist/progression contents), seeded in the runner's persona block.

| # | Persona | Seed sketch | Compose journey (goalpost) |
|---|---|---|---|
| P1 | First-Timer | fresh device | tour -> Library -> hears a song; Compose shows starters, 5 taps to sound |
| P2 | Campfire Strummer | beginner + tiny setlist | 3-chord jam from starters; save-as-progression; never sees Song panel unless they swipe |
| P3 | Jammer (operator's own flow) | intermediate + saved progressions | grid -> strip -> transpose -> Solo; save-progression is 2 taps; Song panel never interrupts |
| P4 | Performer | any level + setlist-heavy | Setlist -> Perform; Compose only for quick key checks |
| P5 | Songwriter / Lyricist | intermediate + songs w/ sheets | Song panel: sections + lyrics refined over sessions; pulls jam progressions into sections |
| P6 | Composer / Theorist | advanced + key-explorer usage | key flyout, modes, inversions, correct spelling; dense chips |
| P7 | Multi-Instrument Maestro | advanced + 2+ profiles used | switches profiles mid-thought; per-profile voicings; (future) exports/teaches |

Every persona gets a `persona-<name>-compose.json` goalpost scenario
(red-first); the P2/P3 pair is the canonical "song tools absent from the jam
surface" assertion pair, mirroring the beginner/advanced whynote pair.

## Pedagogy mapping (deterministic, one-per-session slot unchanged)

| Persona | First-minute win | Tip ladder (one new thing each) |
|---|---|---|
| P1/P2 | heard chord < 5 taps | firstrun -> postprog (Solo exists) -> savebasics |
| P3 | strip + Solo immediately | transposetip -> composeintro |
| P5 | section from saved progression | "pull your jam into a section" cue (NEW, fires on first Song-panel visit with a saved progression) |
| P6 | dense grid, no prose | scaletip only |
| P7 | profile switch persists | none - silence is the reward |

## Decisions (operator interview 2026-07-19)

2. Save default: PROGRESSION-FIRST - decided.
3. Persona set: ALL 7 - decided.
4. Level-adaptive Compose defaults: IN SLICE 1 - decided.
1. Split shape: prototyped (docs/artifacts/proto/compose-proto.html);
   operator leans B ("A is not much diff than what we have now... C is not
   intuitive"). Coach synthesis below; pending final word on B+.

## Split-shape synthesis (coaches, 2026-07-19)

**Songwriting-coach on B:** capture-first / structure-later IS how songs are
written - progressions get captured in the moment, form comes later, over
sessions. The canvas round-trip must give the craft workflow: (a) Add-section
carries the proven-family starters PER SECTION JOB (chorus = Axis loop,
pre-chorus = IV-V lift, bridge = one departure); (b) section -> strip
round-trip, because sections are auditioned by PLAYING them; (c) key
consistency - sections share the song key, a pull from a differently-keyed jam
offers transpose-on-pull; (d) chorus reuse - duplicate-section is one tap.

**UX-coach on B:** the landing is the dominant job and the Song surface
appears at the exact moment of relevance (you just made something worth
keeping) - the same principle as teach-at-the-moment. Mental model is clean:
Compose = workbench, Library = shelf, Song canvas = the document. The one
risk is the in-flight draft: a P5 mid-song must never wonder "where did my
song go" - so the Save sheet shows a "Continue: <draft>" chip whenever a
draft song exists.

**Tech-lead take: B+ (B with the workbench handoff), recommended.** A's only
honest advantage is two-way visibility, but it keeps Song AMBIENT (a
permanent segment header = still paying chrome for the minority job) - the
operator read that correctly. B+ makes the Song canvas ONE primitive with
THREE moment-of-relevance entries: Save > "grow into a song" (new), Library >
open saved song (existing - Phase B already ships this), Save sheet >
"Continue: <draft>" (in-flight). Element Consistency Law satisfied: one
canvas, no parallel ambient surface.

**Other concepts considered and cut:** 5th tab "Write" (cleanest separation
but taxes global nav for a minority job; P2/P3 never use it), drag-strip-to-
shelf (undiscoverable gesture), floating +Song FAB (ambient chrome - the
exact thing being removed).

## Control x workflow matrix (which controls travel together)

| Workflow | Persona | Controls needed |
|---|---|---|
| W1 Jam / audition | P2 P3 | grid, In-key\|All, suggestions, strip, transpose, key chip, maximize, Clear, Solo |
| W2 Quick capture | P3 | strip + Save (progression-first, 2 taps) |
| W3 Grow a NEW song | P5 | Save sheet -> canvas: pull-strip, sections, add-section (family starters) |
| W4 Refine a song | P5 | canvas via Library: sections <-> strip, lyrics, map chips, save |
| W5 Solo practice | P3 | Solo -> Studio (unchanged, already its own surface) |
| W6 Theory explore | P6 | key flyout (roots, modes, triads link), dense grid |

| Home (under B+) | Carries |
|---|---|
| Compose surface (always) | W1 + W2 set - nothing else, ever |
| Key flyout (on demand) | W6 |
| Song canvas overlay | W3 + W4 |
| Practice Studio | W5 |

No control lives in two homes; the progression STRIP is the one shared
currency that crosses them (pull into section, load section to jam).

## Open fork (operator)

Confirm B+ (B + Continue-draft chip + section round-trip) -> slice 1 builds.

## Slicing (B+ shape)

- Slice 1: Compose = pure jam (song machinery out of the ambient surface);
  Save sheet progression-first + "grow into a song" + Continue-draft chip;
  canvas overlay = the one song editor (Save-grow, Library-open, Continue);
  level-adaptive emphasis (beginner starters / advanced dense). Red-first
  P2/P3 scenarios.
- Slice 2: section <-> strip round-trip (pull with transpose-on-pull,
  jam-on-section), duplicate-section, per-section family starters
  (songwriting-coach table), "pull your jam into a section" cue for P5.
- Slice 3: persona fixtures + the 7 goalpost scenarios; wiki page for the
  persona registry.
