# Compose Jam-First (B+ shape) `[STABLE]`

[Wiki](../index.md) > [Systems](../index.md) > Compose Jam-First

> Owns: the S-COMPOSE-CALM architecture (PR #279, 2026-07-19). Compose lands
> as a PURE JAM surface; the Song canvas is the ONE song editor, entered at
> moments of relevance. Design record + persona registry:
> docs/plans/compose-declutter-personas-20260719.md (repo root).

## The shape

| Home | Carries | Never carries |
|---|---|---|
| Compose surface (always) | grid, In-key\|All, suggestions, strip, transpose, key chip, Clear/Save, Solo | ANY song machinery |
| Key flyout (on demand) | roots, modes, triads link | - |
| Song canvas (on demand) | section cards, templates, Save song, its own X | ambient presence |
| Practice Studio | solo practice | - |

The progression STRIP is the one currency crossing homes.

## Canvas doors (all moment-of-relevance)

1. Save > "Grow it into a song" (fresh strip; `openSaveIntentRow`).
2. Save > "Add to your song (N sections)" (draft in flight;
   `openSaveChoiceRow` - progression-first: "Save progression" is ALWAYS the
   primary; the SONG's own save lives on the canvas only).
3. Save with ONLY a draft (empty strip) - opens the editor, never a surprise
   name row.
4. Library > Continue building (`continueBuilding`, Phase B).

Exit: the canvas X (`#songCanvasClose`) or hardware Back. `setComposeMode`
registers a `songCanvas` NavHistory layer on entry; a PROGRAMMATIC exit
(post-save flows) raw-switches and leaves the entry - popping it is unsafe
both ways (a synchronous dismiss can be swallowed by NavHistory's in-flight
guard; a deferred one popped the practice screen a save had just opened).
Cost: one visually-empty Back press after such flows; the closeFn is
idempotent. Anchors: `songbook.js` `setComposeMode`/`rawSetMode`.

## Contracts

- **Compose ALWAYS lands in Chords.** The persisted
  `<prefix>.composeMode.v1` key is abandoned (defensive readers, no schema
  bump). Draft survives reloads (`builderBuffer.v1`); the view does not.
- **Capture clears the strip on EVERY path** (plain add, choice-sheet add,
  canvas-hop add) - one contract; the undo banner is the recovery.
- **The tray (capture row + song map) is TRANSACTION chrome**: visible only
  while a canvas-initiated edit is in flight (`returnToSong` hop or
  `editingSectionIdx != null`). The #262 no-tab-round-trip goalpost lives
  inside the edit loop (`renderSongTray` `inFlight` gate).
- **Level-adaptive landing**: advanced skips the empty-state starter cards
  (`renderSuggest` guidance-level gate); beginner/intermediate keep them.
  Level gates EMPHASIS, not access.

## Slice 2 - the canvas round-trip (2026-07-19)

- **Transpose-on-pull**: a fresh add whose strip key differs from the draft's
  own inferred key ASKS (`openTransposeAskRow`): shift the pulled copy into
  the song's key, keep it as a departure, or cancel. Keys compare by
  RELATIVE-MAJOR root (a vi-IV part "in A minor" under a C-major draft is the
  same pitch set - never asked). The strip's own key comes from
  `inferKey(pulled)` - NOT `songKey.root`, which the canvas hop pins to the
  song's key.
- **Duplicate-section** (`.songSectDup`): one-tap chorus reuse, copy inserted
  after its source.
- **pulljam cue**: intermediate-gated one-shot notable on the canvas -
  teaches once that a saved progression can become a section (fires when a
  progression-only custom exists; session-gated like every tip).
- Per-section proven-family starters were already shipped (S-PROG-GUIDANCE
  canvas templates) - slice 2 verified, no change.
- Goalpost: `persona-songwriter-roundtrip.json` (red-first).

## Slice 3 + UAT r5 (2026-07-19)

- **Persona goalposts complete**: P1/P4/P7 scenarios + the runner's `seed`
  fixture map land the full 7-persona registry -
  [ux-philosophy/personas.md](../ux-philosophy/personas.md) "Goalpost personas".
- **Key-follow**: the builder key follows the song being worked on
  (D-KEY-FOLLOW amendment in [compose-key-system.md](compose-key-system.md)) -
  continue-building, the next-section hop, and template fills all pin into the
  song's key; the untouched C default re-infers from the music.
- **Chord-chart visibility is a Settings choice** (`music.chordCharts.v1`,
  global): the Compose-surface Shapes toggle is retired; Settings > Preferences
  "Chord charts" (Charts | Compact) follows the guidance level until picked.
  Distinct from Fretboard diagrams (Dots|Patterns - styles what renders).
- **Section cards**: duplicate ⧉ wears the shared 36px halo primitive; card
  controls tightened to a 38px pitch (44px hit boxes overlap via -3px margins)
  so the longest label (Pre-Chorus) renders whole.
- **Stage (fullscreen)**: transpose relocated into the gear sheet's Key row;
  remaining icons 46px; LANDSCAPE gets a right-edge nav column with the sheet
  padded clear of it (goalpost: `stage-landscape-fit`).
- **Action toast**: "Added to setlist" carries a Go-to-setlist button and the
  5200ms action-toast hold (goalpost: `setlist-add-toast`).
- **composeRow generation guard (F8, "add to song button doesn't work")**:
  every composeRow modal shares ONE container, and `settleAfter` closes the
  old layer AFTER the new one renders - so the choice row's rawClose was
  WIPING the transpose ask it had just chained into (the slice-2 goalpost
  only walked the ask from the tray, no modal dismiss in flight). Fix at the
  primitive: `composeRowGen` counter - each populator bumps it, a rawClose
  from a superseded render no-ops. The per-site 'prog'/'save' carve-outs were
  this problem solved manually per chain. Goalpost:
  `save-choice-transpose-ask`. Companion: the continue-building caution toast
  now carries an "Open your draft" door (the guard must never dead-end).

## UAT r6 - the draft chip (2026-07-19)

- **#draftChip** (operator: "if there's active song being edited, show name
  linked to open"): a parked draft announces itself on the CHORDS surface -
  "Editing <name>" (continue-building drafts carry the source song's title)
  or "Editing your song · N sections", one tap to the canvas. STATUS + LINK
  only - the one deliberate, operator-directed exception to the B+
  zero-ambient-chrome contract. Hidden on the canvas, during transaction
  hops (the tray owns that context), and with no sections. Dashed border =
  the draft grammar. Gotcha encoded in CSS: `display:block` defeats the
  `[hidden]` UA style - `.draftChip[hidden]{display:none}` restates it.
- Goalposts: `draft-chip` (lifecycle incl. UI-driven emptying - the runner
  seed re-applies on every navigation, so reloads can't model an emptied
  draft) + the named-chip tail on `compose-key-follow`.

## Verification

USDD goalposts (red-first): `persona-jammer-compose` (P3, the operator's
flow + save-sheet no-horizontal-overflow guard), `persona-strummer-compose`
(P2), `persona-theorist-compose` (P6 adaptive), `persona-songwriter-compose`
(P5 grow door). 11 legacy builder/canvas scenarios ride the new entry
(Save-sheet grow, buffer-key truth). Unit contract: `test/songbook.test.js`
S-COMPOSE-CALM cases.

## Related

- [compose-key-system.md](compose-key-system.md) - key/transpose semantics on the jam surface (D1/D3/D5/D6 unchanged)
- [onboarding-guidance.md](onboarding-guidance.md) - the calm-guidance contract the jam surface obeys
- [decisions.md](../decisions.md) - JAMFIRST-1, SAVE-PF, TRAYTX
