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
