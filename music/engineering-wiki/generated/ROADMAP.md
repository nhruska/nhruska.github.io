<!-- GENERATED from music/engineering-wiki/: workflows/roadmap-missions.md | regenerate by re-synthesizing that page | 2026-07-04 -->
<!-- Canonical source: the engineering wiki (music/engineering-wiki/). Do not hand-edit. -->

# Roadmap

The tutor curriculum, what's shipped, what's deferred, and the backlog. The live day-to-day pipeline is `docs/plans/QUEUE.md` (NOW/SHORT/MID/LONG) - this page is the mission-level record.

## Curriculum (build order = teach order)

North star: an adaptive tutor whose destination is soloing and songwriting confidence. The loop: compose -> solo over it with guidance -> understand why -> build song forms.

| Phase | Capability | Status |
|---|---|---|
| 0 | Chord-building foundation (unified songKey, transpose==key, compact key bar) | DONE |
| 1 | Adaptive chord surface (In-key leads, All one tap away) | DONE |
| 2 | Modal interchange auto (mode change always re-harmonizes) | DONE |
| 3 | Backing-track soloing + scale guidance (Compose -> finder -> Studio bridge) | DONE |
| 3.5 | Solo-scale toolset: pentatonic major/minor + blues chips in the Studio | BUILT |
| 4 | Relative/parallel scale demos over a fixed progression | PARTIAL - Studio scale chips + finder mode chips are the decoupled seed; full in-place swap still open |
| 5 | Song-form coaching (AABA, sections -> whole songs) | PLANNED |

Locked decisions behind these phases live in [DECISIONS.md](DECISIONS.md) (transpose==key, always-re-harmonize, picker-not-locked, one-screen layout).

## Mission record

| Mission | Outcome |
|---|---|
| UX persona mission + Sprint 1 | 8 PRs live: clear-undo, slot removers, theory canon, notables infrastructure, first-run cues, whynote, setlist guard, save-dialog/settings fixes. 12 adversarial plan findings folded in before code. |
| M2 wiki mission | This wiki plus the pentatonic/blues solo scales, and absorption of the legacy doc corpus into the wiki. |

## Waiting on PR #98 (key-aware spelling)

Deferred, gated on the #98 merge event: spelled chord tones, roman-style + tie-policy settings, the 12 regime-B trap cases going into the canon, and key-aware pentatonic/blues spelling (the blue note flips from sharp to a key-aware flat). Every one of these consumes ONLY the named #98 seam functions - if the seam is absent at merge, the deferred work stays blocked rather than being improvised against a guess at what #98 will look like.

## Backlog

| Item | Note |
|---|---|
| Full songs/tracks merge | Primary item for the next sprint; runs after PR #98 |
| S-DIAGRAM-PREF | The dots-vs-patterns fretboard setting; spec home: [UX-PHILOSOPHY.md](UX-PHILOSOPHY.md) |
| Unified filter bar | Folds several smaller chip/filter asks into one pass (44px floor + progressive vocabulary disclosure) |
| Inversion/slash-bass spelling coverage | Post-#98 canon addition |
| Styled setlist-clear confirm | App-styled modal + an edit-mode home, replacing the native `confirm()` |
| Sub-floor reorder buttons | Pre-existing 40x32 buttons below the 44px floor; documented, out of prior scope |
| Full HSR Lens | The complete hammer/slide/rotate visual overlay across shape families (see [DATA-MODEL.md](DATA-MODEL.md#instrument-profiles---the-pack-contract)) |
| Phase 5 | Song-form coaching |

## Related generated docs

[DECISIONS.md](DECISIONS.md) - the locked rulings behind each shipped phase. [THEORY.md](THEORY.md) - what changes once PR #98 lands.
