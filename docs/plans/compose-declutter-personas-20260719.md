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

## Open forks (operator decides - interview)

1. Split shape: swipe panels Jam|Song vs overlay-on-demand vs accordion.
2. Save default: progression-first?
3. Persona set: adopt all 7 or cut?
4. Level-adaptive Compose defaults (auto-emphasis by level): in or out of
   first slice?

## Slicing (after interview)

- Slice 1: Jam-first landing + Song panel split + shared progression currency
  (red-first P2/P3 scenarios; no data-model change).
- Slice 2: Save-intent default flip + "pull jam into section" cue.
- Slice 3: persona fixtures + the 7 goalpost scenarios; wiki page for the
  persona registry.
