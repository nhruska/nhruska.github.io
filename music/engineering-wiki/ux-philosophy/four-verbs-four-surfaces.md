# Four Verbs, Four Surfaces `[PROPOSED]`

[Wiki](../index.md) > [UX Philosophy](../index.md) > Four Verbs, Four Surfaces

> **Status: PROPOSED - for review and approval.** The surface model this app
> should be read against. Operator interview 2026-07-25/26. Point future
> sessions at this page before they add a tab, a mode, or a "view".

## Why this page exists

The operator, on the Library/Setlist pair:

> "I've been confusing these two screens as being a single source of truth."

And on Compose:

> "is the song compose view not a coherent UX?"

Both confusions have one cause: **a surface is named for where it sits in the
nav rather than for the verb it serves.** Two surfaces served one verb
(Library/Setlist = *play someone else's song*), and one surface served two
verbs (Compose = *build a progression* AND *write a song*).

The code already knew. `songbook.js:2601`:

```js
var composeMode = 'chords';        // ... rawSetMode('song') | rawSetMode('chords')
```

Two named modes under one label. `editSection()`'s own comment calls one of
them "the **Chords builder**". The split proposed below is not a redesign - it
surfaces a split the model already carries.

## The four verbs

| Verb | Surface | The user's sentence |
|---|---|---|
| **Play** what someone wrote | `Songs` (All \| Setlist) | "I want to play Let It Be tonight" |
| **Explore** chords, build a progression, jam over it | `Progressions` | "what goes after Am?" |
| **Compose** a song of my own | `Compose` | "I want to write this" |
| **Tune** the instrument | `Tune` | "am I in tune?" |

Performing is deliberately NOT a fifth surface: Stage is an overlay launched
from a song or from the setlist, because performing is something you do TO a
song, not a place you go. The same logic keeps the song detail screen a pushed
sub-surface rather than a tab.

## What each surface owns - and never carries

| Surface | Owns | Never carries |
|---|---|---|
| Songs | the collection; search, filters, `+`; the setlist as an ORDERED VIEW of it; Start | chord authoring |
| Progressions | grid, In-key\|All, suggestions, key + transpose, the strip, Solo / backing video | ANY song machinery (this is JAMFIRST-1, preserved verbatim) |
| Compose | section cards, arrangement, templates, Save song; eventually lyrics | chord EXPLORATION (it consumes progressions, it does not hunt for them) |
| Tune | the tuner | everything else |

**One currency crosses these homes: the progression strip.** Progressions
produces strips; Compose consumes them into sections. That single sentence is
the architecture - and it only reads clearly once the two surfaces have
different names. `systems/compose-jam-first.md` already stated it; the naming
is what made it invisible.

## The naming rules this implies

1. **Name a surface for its verb, not its position.** "Compose" must mean
   composing a song, because that is what the word means to the user. A tab
   named for a verb it does not serve is the defect both confusions came from.
2. **A label may not be used for two different scopes.** `Chords` was rejected
   as the tab name because `Lyrics | Chords | Both` is already a VIEW toggle
   inside a song - the same word at two scopes in one breath. `Progressions`
   has no collision, and `competency.js` already ships a skill by that exact
   name ("Progressions - assemble chord progressions that move").
3. **One collection, one surface.** Two nav entries listing the same records is
   the Library/Setlist defect. Different views of one collection are a
   segmented control (`component-conventions.md:65`).
4. **Affordances derive from what is TRUE of a record, not from where you are
   standing.** An in-setlist song shows its position and grip in the All view
   too. This is what makes one source of truth *visible* rather than merely
   claimed.

## JAMFIRST-1 is preserved, not narrowed

`decisions.md` JAMFIRST-1 rules that the jam surface carries zero ambient song
chrome, with the canvas entered by moment-of-relevance doors.

An earlier draft of the merge spec proposed promoting the canvas to a tab,
which would have contradicted that. **This model does not.** The pure jam
surface survives intact - it is simply called `Progressions` now, and the tab
formerly labelled Compose stops pretending to be two things. The ruling gets a
**rename**, not a re-ruling; its substance is unchanged.

The four moment-of-relevance doors stay. A tab is an additional entry for "I
want to write", not a replacement for "I just made something worth keeping".

## Trajectory: Compose eventually authors lyrics

Ruled 2026-07-26. Today a section is `{ label, seq }` - a name and chords, no
words - while the song sheet format is chords-over-lyrics (`[C] a [G] b`),
which every curated song uses and Stage renders. So Compose can currently
assemble a chord chart, not a song with words.

**Direction: Compose grows lyric authoring, delivered as a GUIDED workflow** -
not a free-text sheet editor. The guided shape matters: it is what keeps
Compose a composing surface rather than a text editor, and it is consistent
with how the rest of the app teaches (suggestions, in-key barriers, notables).

Not scoped here. Recorded so the next session builds toward it instead of
around it.

## Self-check before adding any surface

1. What VERB does this serve, in the user's words?
2. Is that verb already served? If yes, this is a view of that surface, not a
   new one (rule 3).
3. Does its name mean that verb to a musician - and is the name free at every
   other scope in the app (rules 1, 2)?
4. What does it never carry?
5. What currency crosses between it and its neighbours?

## Related

- [systems/songs-surface-merge.md](../systems/songs-surface-merge.md) - the change spec this model justifies
- [systems/compose-jam-first.md](../systems/compose-jam-first.md) - JAMFIRST-1, the pure jam surface (renamed, not narrowed)
- [component-conventions.md](component-conventions.md) - tabs vs segmented controls (:65)
- [decisions.md](../decisions.md) - SONGS-MERGE, PROG-RENAME, COMPOSE-LYRICS
