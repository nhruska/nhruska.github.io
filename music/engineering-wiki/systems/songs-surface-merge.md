# Songs Merge + Progressions/Compose Split `[PROPOSED]`

[Wiki](../index.md) > [Systems](../index.md) > Songs Merge + Progressions/Compose Split

> **Status: PROPOSED - not built.** Operator interview 2026-07-25/26 settled
> the shape; this is the spec to approve before code moves. It rests on
> [ux-philosophy/four-verbs-four-surfaces.md](../ux-philosophy/four-verbs-four-surfaces.md),
> which is the model - read that first. **Ships in two phases** (below); phase
> 1 is self-contained and conflicts with nothing.

## The two confusions this fixes

| Operator | Cause |
|---|---|
| "I've been confusing these two screens as being a single source of truth" | Library + Setlist: **two surfaces, one verb** |
| "is the song compose view not a coherent UX?" | Compose: **one surface, two verbs** (`composeMode = 'chords' \| 'song'`, songbook.js:2601) |

## Target nav

```
NOW                       PROPOSED
LIBRARY                   SONGS         (All | Setlist)
SETLIST                   PROGRESSIONS  <- today's Compose, renamed to its verb
COMPOSE  -> canvas mode   COMPOSE       <- the canvas, now the whole tab
TUNE                      TUNE
```

Same tab COUNT. Nothing is added to the nav - one entry is freed by the merge
and immediately spent making Compose honest.

## Phase 1 - the Songs merge (self-contained, no decision conflict)

Library + Setlist become one `Songs` surface with an `All | Setlist` segmented
switch, per `component-conventions.md:65` ("bottom nav = top-level surfaces
ONLY; segmented controls = view switches within a surface").

The row renderer is **already one SSOT** - `list-item.js`, whose header says
the segments should "look and behave like the same thing". Only the surface
diverges. Measured at 412x915 on `3d7d4a3`:

| | Library | Setlist |
|---|---|---|
| Chrome | search, +add, 5 genre chips, 14 key chips, Curate videos | Clear, Start |
| Rows | 173, each with `+` | 3, each with position, grip, remove |
| Order | filtered / sorted | hand-ordered, meaningful |

### Surface spec

| Element | All view | Setlist view |
|---|---|---|
| Search + `+add` | yes | no - a setlist is hand-ordered, not searched |
| Genre / key chips | yes | no |
| Count line | `173 songs` | `3 songs - ready to play` |
| Header actions | - | Clear, **Start** (unchanged position) |
| Row order | filtered / sorted | setlist order |

### The rule that removes the confusion

Row affordances derive from **setlist membership**, not from the active view:

| Song state | Row shows |
|---|---|
| Not in setlist | `+` (or the seed/ghost variant per S-SETADD-EVIDENT) |
| In setlist | position number, grip, remove `x` |

So an in-setlist song shows its position and grip **in the All view too**. "Is
this in my set, and where?" becomes answerable without switching. One source of
truth made *visible*, not merely claimed.

### Landing

`Songs` always opens on **All** (operator ruling). The Setlist segment carries
a count badge. The segment choice is NOT persisted - no state-dependent landing.

## Phase 2 - Progressions / Compose split

Today's Compose surface is renamed **Progressions**; the song canvas stops
being a mode inside it and becomes the **Compose** tab.

| Surface | Owns | Never carries |
|---|---|---|
| Progressions | grid, In-key\|All, suggestions, key + transpose, the strip, Solo / backing video | ANY song machinery |
| Compose | section cards, arrangement, templates, Save song; **eventually lyrics** | chord exploration |

**One currency crosses them: the progression strip.** Progressions produces
strips; Compose consumes them into sections. `compose-jam-first.md` already
said this; the shared name is what made it invisible.

### Why "Progressions" and not "Chords"

`Lyrics | Chords | Both` is already a VIEW toggle inside a song - the same word
at two scopes in one breath. `Progressions` has no collision, and
`competency.js` already ships a skill by that exact name ("Progressions -
assemble chord progressions that move").

### JAMFIRST-1 is preserved by the rename

An earlier draft of this spec proposed promoting the canvas to a "Song" tab,
which contradicted JAMFIRST-1 ("zero ambient song chrome"). **This shape does
not.** The pure jam surface survives intact - it is simply called
`Progressions`. The ruling gets a **rename, not a re-ruling**; its substance is
unchanged, and the four moment-of-relevance doors stay (the tab is an extra
entry for "I want to write", not a replacement for "I just made something worth
keeping").

### Lyrics trajectory (ruled 2026-07-26, not scoped here)

A section is `{ label, seq }` today - no words - while the sheet format is
chords-over-lyrics (`[C] a [G] b`). **Compose grows lyric authoring as a GUIDED
workflow**, not a free-text sheet editor. Recorded so the next session builds
toward it rather than around it. See the model page.

## Migration - and the trap the last one hit

`<prefix>.activeTab.v1` can hold `jam` (setlist) and will need `compose` ->
`progressions`. Both must be consumed ONCE and rewritten.

`songbook.js` carries the scar: the `libType.v1` migration forced a migrated
user back to a tab they had left, on every reload, until it was
consumed-and-removed. Same shape here, so it gets its own goalpost.

- `activeTab.v1` `jam` / legacy `setlist` / `set` -> tab `library`, segment
  `setlist`, **then rewrite the key**.
- Phase 2: `compose` -> `progressions`, same consume-once discipline.

## Blast radius

| Surface | Phase | Change |
|---|---|---|
| `play/index.html` | 1 | `#s-jam` folds into `#s-library`; tabbar drops `jam` |
| `play/index.html` | 2 | tabbar `compose` -> `progressions`, new `compose` entry; canvas markup moves out of `#s-compose` |
| `songbook.js` | 1 | `switchTab` set + remap; `renderSongs`/`renderSetlist` merge behind a segment arg; `ACTIVE_TAB_KEY` migration |
| `songbook.js` | 2 | `setComposeMode`/`rawSetMode` + the `songCanvas` NavHistory layer become tab navigation. **Riskiest edit in the change** - the existing comment warns popping that layer is "unsafe both ways" |
| `callouts.js` | 1+2 | `CONFIG` is keyed per tab (`library`/`jam`/`compose`/`tune`); `jam`'s coach mark moves to the segment or retires, and the compose entry splits |
| `list-item.js` | - | **no change** - it already renders both segments |
| `test/pw/scenarios/` | 1 | **13 scenarios** reference `[data-tab="jam"]` |
| `test/pw/scenarios/` | 2 | every `[data-tab="compose"]` reference |
| wiki + `music/CLAUDE.md` | 1+2 | tab taxonomy, `compose-jam-first.md`, `decisions.md` |

## Goalposts (red-first)

**Phase 1**

1. A song in the setlist shows position + grip in the **All** view - proves the
   row is driven by membership, not by view.
2. Switching segments does not re-order or re-filter the other view's state.
3. `activeTab.v1 = 'jam'` restores to Songs/Setlist **once**; choosing All then
   reloading lands on All (the sticky-marker regression).
4. Start performs the setlist from the Setlist segment header.
5. Every control on both views clears the 44px floor at 412 and 360 - the
   existing `tap-target-floor` gate must stay green with the new segment.

**Phase 2**

6. Progressions carries zero song chrome (JAMFIRST-1, asserted against the
   renamed surface).
7. Compose opens the canvas with sections intact from `builderBuffer.v1`.
8. All four moment-of-relevance doors still reach the canvas.
9. `activeTab.v1 = 'compose'` restores to Progressions once, then stays where
   the user puts it.

## Naming: `Songs`, not `Library` (ruled 2026-07-26)

| Reason | |
|---|---|
| **A library does not have a setlist.** | Under `Songs`, the segments read "my songs -> the ones I am playing tonight". Under `Library`, a Setlist segment inside a *library* is a category error - the very incoherence the merge exists to remove. |
| **Parallel with Progressions.** | The nav becomes two MATERIALS (Songs, Progressions) plus two ACTIONS (Compose, Tune). `Library` is a PLACE - a third kind of noun that makes the bar read as three unrelated ideas. |
| **It makes the pipeline legible.** | Progressions are raw material; Compose turns them into songs; Songs is where they land and get played. `Library` hides that arc behind a filing metaphor. |
| **Ownership.** | Once Compose is a first-class surface the collection is substantially the user's OWN work. "Library" quietly says your songs live in someone else's building. |

### Copy that changes - and what was already owed

The rename touches ~9 user-visible strings (`TAB_LABELS`, the tab pill, the tab
button, the practice empty state, the practice back label, the setlist empty
state, the `progsection` notable, the "Open Library" toast action, and
repertoire-form's "Save to my Library").

**Several were already going to change**, because they describe travelling
between two places that stop being two places:

- "Add songs from the Library with the + button" -> the setlist is a SEGMENT
  now; there is nowhere to travel to.
- "Open Library" (toast) -> "Show all songs" - a segment switch, not a trip.
- "Choose a song from the Library to open it" -> "Choose a song to open it".

So part of the rename cost is a debt the merge incurs regardless of the name.

## Tab ORDER: unchanged (frequency, not narrative)

The pipeline reads Progressions -> Compose -> Songs, which tempts a nav
ordered that way. **Do not.** A bottom nav is hit dozens of times a session and
should be ordered by what the thumb reaches for, not by the story the product
wants to tell: opening the app to PLAY is far more common than opening it to
write. `Songs` stays first, matching today's Library-first default, and the
rename does not also move things under the user.
