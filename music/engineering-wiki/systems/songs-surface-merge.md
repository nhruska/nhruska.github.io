# Songs Surface Merge + Song Tab `[PROPOSED]`

[Wiki](../index.md) > [Systems](../index.md) > Songs Surface Merge

> **Status: PROPOSED - not built.** Operator interview 2026-07-25 settled the
> shape; this page is the spec to approve before any code moves. It CHANGES a
> ruled decision (JAMFIRST-1) - see "What this costs" below. Nothing here is
> implemented.

## The problem, in the operator's words

> "I've been confusing these two screens as being a single source of truth."

Library and Setlist are two bottom-nav tabs that both list songs. Nothing tells
you which one is the truth about a song, because both are - they are one
collection seen two ways.

The row renderer is ALREADY one SSOT (`shared/list-item.js`,
`ListItem.render(rec, { segment: 'library' | 'set' })`, whose own header says
the segments should "look and behave like the same thing"). The divergence is
at the SURFACE, measured at 412x915 on `3d7d4a3`:

| | Library | Setlist |
|---|---|---|
| Chrome | search, +add, 5 genre chips, 14 key chips, Curate videos | Clear, Start |
| Rows | 173, each with a `+` | 3, each with position, grip, remove |
| Order | filtered / sorted | hand-ordered, meaningful |

## The convention this rests on

`ux-philosophy/component-conventions.md:65`:

> **Tabs:** bottom nav = top-level surfaces ONLY; segmented controls = view
> switches within a surface.

Two tabs assert two top-level things. One collection viewed two ways is a
segmented control by our own rule. The merge is not a new opinion - it is
applying the rule we already wrote.

## Rulings (operator interview, 2026-07-25)

| # | Ruling |
|---|---|
| 1 | **One surface, segmented.** Library + Setlist merge into `Songs` with an `All \| Setlist` segmented switch. |
| 2 | **The freed slot goes to Song/Write.** The song canvas is promoted out of Compose to its own top-level tab. |
| 3 | **Song and Compose are peers.** Song = sections, arrangement, save. Compose = build/explore a progression in a key. A progression moves into a song section explicitly. |
| 4 | **Songs opens on All, always.** The Setlist segment carries a count badge; no state-dependent landing. |
| 5 | **Start stays in the Setlist segment header**, beside Clear, exactly where it is today. |

## What this costs: JAMFIRST-1 must be re-ruled

`decisions.md` **JAMFIRST-1** (PR #279, 2026-07-19) rules:

> Compose lands as a pure jam surface (B+ shape) - zero ambient song chrome;
> canvas = the one song editor with moment-of-relevance doors.

Ruling 2 contradicts it directly. A tab IS ambient presence: it is a
permanently visible door, which is the thing that decision deliberately
removed. The four existing canvas doors are all moment-of-relevance
(`systems/compose-jam-first.md` "Canvas doors"); a tab adds a fifth that is
always on screen.

The registry's own rule is "propose changes explicitly instead of drifting",
so this is the explicit proposal:

- **JAMFIRST-1 narrows** to Compose only: *Compose* carries zero song chrome
  (unchanged - the jam surface stays pure). It no longer implies the canvas
  has no home of its own.
- **The four moment-of-relevance doors stay.** They are how you get from a
  progression to a song without a tab round-trip; the tab is an ADDITIONAL
  entry for "I want to write", not a replacement.
- What the operator gets that the ruling denied: writing a song is a
  destination you can aim at, instead of a mode you have to discover from
  inside another surface.

**If that trade is wrong, ruling 2 is the one to drop** - the merge (rulings
1, 4, 5) stands on its own and needs no change to JAMFIRST-1.

## Target shape

```
NOW                          PROPOSED
LIBRARY   SETLIST            SONGS (All | Setlist)
COMPOSE  -> canvas nested    SONG     <- the canvas, promoted
TUNE                         COMPOSE  <- pure jam surface (unchanged)
                             TUNE
```

### Songs surface

| Element | All view | Setlist view |
|---|---|---|
| Search + `+add` | yes | no - the setlist is hand-ordered, not searched |
| Genre / key chips | yes | no |
| Count line | `173 songs` | `3 songs - ready to play` |
| Header actions | - | Clear, Start |
| Row order | filtered / sorted | setlist order |

### Row behaviour - derived from membership, not from which view you are in

This is the part that removes the confusion: a row looks the way it does
because of what is TRUE about the song, not because of where you are standing.

| Song state | Row shows |
|---|---|
| Not in setlist | `+` (or the seed/ghost variant per S-SETADD-EVIDENT) |
| In setlist | position number, grip, remove `x` |

In the All view an in-setlist song therefore already shows its position and
grip. That is the point: the answer to "is this in my set, and where?" is
visible without switching views.

## Migration - and the trap the last one hit

`<prefix>.activeTab.v1` can hold `jam`. It must map to `library` + the Setlist
segment, and the mapping must NOT become sticky.

`songbook.js` already carries the scar: the `libType.v1` migration had to be
consumed ONCE and removed, or a migrated user who later chose Library was
forced back to Jam on every reload. Same shape here.

- `activeTab.v1 === 'jam'` (or legacy `setlist` / `set`) -> tab `library`,
  segment `setlist`, then **rewrite the key** to the modern value so the
  migration cannot re-fire.
- Segment choice is NOT persisted (ruling 4: always opens on All).

## Blast radius

| Surface | Change |
|---|---|
| `play/index.html` | `#s-jam` section folds into `#s-library`; tabbar drops `jam`, gains `song` |
| `songbook.js` | `switchTab` tab set + legacy remap; `renderSongs`/`renderSetlist` become one render with a segment arg; `ACTIVE_TAB_KEY` migration |
| `callouts.js` | `CONFIG` is keyed per tab (`library`, `jam`, `compose`, `tune`) - `jam`'s coach mark must move to the Setlist segment or retire; a new `song` entry is needed |
| `list-item.js` | no change - it already renders both segments |
| Song canvas | `setComposeMode`/`rawSetMode` + the `songCanvas` NavHistory layer become a tab, not a pushed layer. **This is the riskiest edit** - the existing comment warns that popping that layer is "unsafe both ways" |
| `test/pw/scenarios/` | **13 scenarios** reference `[data-tab="jam"]` |
| `music/CLAUDE.md`, wiki | tab taxonomy, `compose-jam-first.md`, `decisions.md` (JAMFIRST-1 + a new row) |

## Goalposts (red-first, before any of it is called done)

1. A song in the setlist shows position + grip in the **All** view - proves
   the row is driven by membership, not by view.
2. Switching segments does not re-order or re-filter the other view's state.
3. `activeTab.v1 = 'jam'` restores to Songs/Setlist **once**, and choosing All
   then reloading lands on All - the sticky-marker regression.
4. Start performs the setlist from the Setlist segment header.
5. The Song tab opens the canvas with its sections intact from
   `builderBuffer.v1`, and the four moment-of-relevance doors still work.
6. Every control on both views clears the 44px floor at 412 and 360 (the
   `tap-target-floor` gate already covers this; it must stay green with the
   new segment).

## Open questions for the operator

1. **Naming:** `Songs` or keep `Library`? The tab currently says Library and
   the header says "Music / Library".
2. **Song tab when empty:** first-run with no draft - does it show an empty
   canvas, or a "start a song" prompt?
3. **Does Compose keep its Save->canvas doors** once Song is a tab, or does
   Save simply move the strip and let you switch tabs yourself?
