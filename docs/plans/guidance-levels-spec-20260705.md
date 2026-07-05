# M-GUIDANCE: Graded First-Time Guidance (operator spec, 2026-07-05)

> Operator verbatim: "include guidance that can be dismissed for good by the user at
> appropriate points within the app as they move through first-time usage. Grade the
> guidance beginner / intermediate / advanced so we can ask brand new users on the first
> time the app opens what level they think they're at and filter the guidance
> appropriately. Add the level in the settings. Font within settings that is not a
> heading, no bold."

## Design (rides existing infra)

1. **Level store:** `music.guidanceLevel.v1` = beginner | intermediate | advanced (additive key, defensive read).
2. **First-open ask (operator-ruled exception to JIT-only):** on the very first app open, a plain-language one-time card (Notables-style, highest priority): "How far along are you?" -> "Just starting out" / "I know some chords" / "I know my way around the neck". Dismiss-without-choice = beginner (safe default). Zero jargon (P3 rule).
3. **Level-tagged guidance registry:** every guidance notable declares its audience levels; `Notables.claim` filters by the stored level. Dismiss-forever semantics unchanged (dismissed stays dismissed across level changes).
   - beginner: tap-a-song-to-open, tune-first cue, easy-3-chords nudge, save/setlist basics
   - intermediate: compose key/mode intro, transpose==key, solo-over-a-track bridge
   - advanced: scale chips (pent/blues), box positions, guide-card depth
   - Existing consumers (firstrun, whynote) get level tags; firstrun copy = beginner-tier.
4. **Settings row:** "Guidance level" with the three options, tappable to change; changing level surfaces not-yet-dismissed guidance of the new level only. **Row typography: plain body text - NOT a heading, NO bold** (operator explicit).
5. **Placement map ("appropriate points"):** implementer enumerates the first-time journey (Library -> Tune -> first song -> Compose -> Studio) and attaches each tagged tip at its point of need - JIT within the graded frame.

## Constraints

Notables arbitration semantics preserved (single slot, priority); A9 static copy; no theory-surface changes; backup.js additive-key rules; SW bump; tests: level filtering, first-open ask once-ever, level-change resurfacing, dismissed-stays-dismissed.

## Sequencing

Runs AFTER claude/solo-view-ux merges (shared surfaces: index.html Settings + sw bump). QUEUE: NOW-next.
