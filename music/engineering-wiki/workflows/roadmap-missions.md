# Roadmap & Missions

[Wiki](../index.md) > workflows > Roadmap & Missions

## Purpose

The tutor curriculum (phases 0-5), the mission/sprint delivery record, wave-2 deferrals, and the backlog register. The live pipeline is [docs/plans/QUEUE.md](../../../docs/plans/QUEUE.md) (NOW/SHORT/MID/LONG).

## Curriculum (build order = teach order) [ROADMAP reviewed 2026-07-04]

North star: an adaptive tutor whose destination is soloing and songwriting confidence. Loop: compose -> solo over it with guidance -> understand why -> build song forms.

| Phase | Capability | Status |
|---|---|---|
| 0 | Chord-building foundation (unified songKey, transpose==key, compact key bar) | DONE |
| 1 | Adaptive chord surface (In-key leads, All one tap away) | DONE |
| 2 | Modal interchange auto (mode change ALWAYS re-harmonizes) | DONE |
| 3 | Backing-track soloing + scale guidance (Compose -> finder -> Studio bridge) | DONE |
| 3.5 | Solo-scale toolset: pentatonic major/minor + blues chips in the Studio (S-BLUES, this mission) | BUILT |
| 4 | Relative/parallel scale demos over a FIXED progression (decoupled solo selector) | PARTIAL - the Studio scale chips + finder mode chips are the decoupled seed; full in-place swap open |
| 5 | Song-form coaching (AABA, sections -> whole songs) | PLANNED |

Locked decisions live in [decisions.md](../decisions.md) (D1 transpose==key, D3 re-harmonize-always, D5 picker-not-locked, D6 one-screen).

## Mission record

| Mission | Outcome |
|---|---|
| UX persona mission + Sprint 1 (2026-07-03/04) | 8 PRs live (v78): Clear undo (P0), slot removers, theory canon, notables infra, first-run cues, whynote, setlist guard, save-dialog + settings UAT fixes. 12 adversarial plan findings folded pre-code. Record: [docs/plans/ux-sprint-1-20260703.md](../../../docs/plans/ux-sprint-1-20260703.md) |
| M2 wiki mission (2026-07-04) | This wiki + S-BLUES scales + absorb/decom of the legacy doc corpus. IA: [docs/plans/wiki-ia-20260704.md](../../../docs/plans/wiki-ia-20260704.md) |

## Wave-2 deferrals (gated on PR #98 key-aware spelling) [TRACKS-#98]

S-TONES (spelled chord tones), S-ROMAN + S-KEYPOLICY (roman-style setting + tie-policy note), S-GOLDEN-B (12 regime-B traps into canon), S-BLUES-B (key-aware pentatonic/blues spelling - blue note flips D# -> Eb). All consume ONLY the named seam (spellKeyAware/spellScaleKeyAware/keyLabel); if the seam is absent at merge, BLOCKED-not-improvised (A8).

## Backlog register

| Item | Note |
|---|---|
| M3 songs/tracks full merge | Sprint-2 PRIMARY; fresh session; post-#98; finder-rehome RESOLVED: 5A (operator 2026-07-04) - dissolve finder, curation to +Add/per-item edit, circle panel into Studio |
| S-DIAGRAM-PREF | Expertise-adaptive display setting; spec home: [ux-philosophy/expertise-adaptive-display.md](../ux-philosophy/expertise-adaptive-display.md) |
| S-CHIPS + S-EASYFILTER | fold into M3's unified filter bar (44px floor + progressive vocabulary disclosure) |
| S-INVERSIONS | golden coverage for inversion/slash-bass spelling, post-#98 |
| SETX phase 2 | app-styled confirm + edit-mode home for setlist clear |
| li-up/dn 40x32 | pre-existing sub-floor reorder buttons (documented, out of prior scope) |
| HSR Lens | full hammer/slide/rotate overlay ([instrument-profiles](../systems/instrument-profiles.md)) |
| Phase 5 | song-form coaching |

---

**Anchors verified:** music/TUTOR-ROADMAP.md (absorbed; stub remains), docs/plans/ux-sprint-1-20260703.md (close block + backlog), docs/plans/QUEUE.md, docs/plans/wiki-ia-20260704.md
