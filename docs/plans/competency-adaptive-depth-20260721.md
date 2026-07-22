# Plan: competency-driven adaptive depth (per instrument)

> Turn the app's per-instrument competency model into the driver of adaptive UI
> depth, so "how much help do we show" is measured from what the musician
> actually does - not a manual toggle or a one-time self-report. Origin: the
> Dots/Patterns Settings toggle was a manual control the user couldn't
> distinguish; the right answer is to gate diagram depth (and tip/theory density)
> on real, earned progression. Pedagogy pass: music-theory-coach + ux-coach +
> pedagogy-coach (see docs below).

Date: 2026-07-21. Status: DRAFT (approved to draft by Nik; not yet scheduled).

## The vision in one line

The instrument you're holding + what you've done on it -> a 3-band level ->
how much the UI explains. Beginner gets scaffolding; a proven player gets a
clean, fast surface. Per instrument, earned not declared.

## Current state (two disconnected halves)

| Half | File | What it is | Gap |
|---|---|---|---|
| Earned progression | [music/shared/competency.js](../../music/shared/competency.js) | Per-instrument frameworks (ukulele, guitar, shared stringed-instrument, composition, lyrics), 5 competencies each scored 0-100, grown from evidence (+6% of remaining gap to a per-competency target). Instrument-aware (`recordRepertoire` maps active profile -> framework). | No rollup to a band. Evidence is thin (only compose + play-through wired). |
| Declared depth | [music/shared/guidance-level.js](../../music/shared/guidance-level.js) | Self-reported beginner/intermediate/advanced (the one-time ask + Settings). Drives tip density + the chord-charts default. | Never reads competency. The app measures progress in one place and asks you to declare it in another. |

The machinery is ~80% built; the two halves just don't talk.

## Decisions from the pedagogy pass

### D1 - 3 user-facing bands (model stays fine-grained)

Keep the **model** granular (per-competency 0-100 micro-competencies) but the
**band that drives UI** coarse at **3** (beginner / intermediate / advanced).

- "Levels gate DEPTH, not access" - the band only controls how much help shows,
  and there are 3 legible help-densities. More bands = imperceptible UI changes
  that read as random; 3 = ~2 graduations across a journey, each a noticeable,
  motivating milestone.
- Maps to the existing 3-state emphasis ladder (primary / secondary / muted).
- 3 bands **per framework** (advanced on uke, beginner on guitar) - the
  per-instrument split is correct and motivating.
- Micro-competencies are the evidence substrate; the 3 bands are the control
  surface. Never branch UI on a raw micro-competency (too jumpy). Granular
  progress ("Barre chords 40/75") can still be *shown* in the Skills panel.

### D2 - band threshold: gated, normalized-to-target, hysteretic

Simple average is wrong (one grinder skill masks a missing core one). Rule:

1. Per competency: `pct = min(1, level / target)` (target is the model's
   "good enough" bar - normalize so a target-90 skill and a target-70 skill
   compare fairly).
2. Each framework marks a small set of **CORE** competencies (the essentials).
   Proposed cores:
   - stringed-instrument: `chord-shapes`, `transitions`
   - ukulele: `uke-open-chords`, `uke-strum-patterns`
   - guitar: `gtr-open-chords`, `gtr-transitions`
   - music-composition: `comp-progressions`, `comp-song-form`
   - lyric-writing: `lyr-structure`, `lyr-imagery`
3. Band:
   - **beginner** = cold start (insufficient evidence) OR mean pct < 0.34
   - **intermediate** = mean pct >= 0.34 AND every CORE pct >= 0.34
   - **advanced** = mean pct >= 0.67 AND every CORE pct >= 0.67
4. **Hysteresis**: promote when the higher threshold is cleared; demote only
   when ~0.05 below the boundary. The stored band is sticky; recompute lazily.
   A band that flickers is worse than none (ux-coach: perceived reliability).
5. **Self-report only raises early**: the declared level is the bootstrap;
   evidence can raise the band immediately but can only *lower* it once
   `evidence_count` across core competencies passes a confidence floor. Never
   insult a user who said "intermediate" by showing beginner help on day 1.

### D3 - evidence actions: production only, session-capped

The anti-gaming core: **cap evidence to 1 per competency per session** (turns
massing into spaced repetition automatically) and count **production** over
**recognition**. Session = a day bucket (`YYYY-MM-DD`), stored additively.

| Action (observable) | Framework -> competency | Trust | Guard |
|---|---|---|---|
| Play a song start-to-finish (perform reaches end / setlist item completes) | active-inst -> `*-repertoire`, `transitions`, `rhythm-keeping` | STRONG (production) | 1/session/song; distinct songs accrue |
| Build + SAVE a progression | `comp-progressions`, `comp-song-form` (already wired) | STRONG | 1/session/save |
| Play a BARRE-classified chord in a real song/practice | guitar -> `gtr-barre` | MEDIUM | 1/session; must classify as barre (shape-classify) |
| Bring a string in-tune (held tuner lock) | active-inst / shared -> `tuning-ear` | MEDIUM (a real correction) | 1/session/string; requires the HELD lock, not a transient |
| Transpose while building, then SAVE | `comp-key-mode` | WEAK | 1/session; only if the built song is saved (ties to production) |
| Tap a chord chip to HEAR it (`packPlayChord`) | (recognition) | WEAK | Do NOT count as competency evidence on its own; at most 1/session for DISTINCT chords, never mastery |

Principle: only production events are trustworthy; recognition is throttled to
near-zero. The session cap + distinct-item tracking are the whole anti-gaming
story - deterministic, no heuristics to tune.

## Architecture: one seam makes the app adaptive

Everything that already reads `guidance-level.get()` (tip density, chord-charts
default, theory prose) becomes competency-driven by changing ONE resolution:

```
GuidanceLevel.effective()  ->  the band that drives depth, resolved as:
  1. active instrument's competency band, IF confident (enough evidence)   [earned]
  2. else the self-reported guidance level                                  [declared / bootstrap]
  3. else the one-time ask (unchanged)                                      [cold]
```

- `effective()` is instrument-aware (reads the active profile -> framework).
- Existing consumers switch from `get()` to `effective()` - a small, auditable
  set of call sites.
- Composition/lyrics depth keys off the `music-composition` / `lyric-writing`
  band; instrument-surface depth keys off the active instrument band.
- Bootstrap transfer (phase 2+): a uke-advanced player picking up guitar should
  keep the SHARED fundamentals band (tuning, timing) while guitar-specific
  skills (barre) reset - so they get help on the new thing, not the old.

## Depth consumers the band should drive

| Surface | Beginner | Advanced | Today |
|---|---|---|---|
| Fretboard diagram | shape name shown on the card (later: finger numbers) | clean grid | manual Dots/Patterns toggle (being collapsed) |
| Chord charts | full charts | compact chips | already level-driven (default) - just point at `effective()` |
| Tips / notables | fire at moment of relevance | mostly silent | already level-driven - point at `effective()` |
| Theory prose | plain words | real terms (modes, degrees) | partly level-driven |
| First-run callouts (PR #294) | show | can dampen | show-once regardless |

## Phases (each independently shippable, verifiable)

- **P0 (now, decoupled - ships on #295):** collapse the Dots/Patterns Settings
  toggle + delete the false "finger-position numbers" copy. Leaves DiagramPref
  module + its default; removes only the broken user-facing control. Chord
  charts (Charts/Compact) stays - it works and is already level-driven.
- **P1:** `Competency.bandFor(frameworkId, store)` -> `'beginner'|'intermediate'
  |'advanced'` implementing D2 (cores + thresholds + confidence floor). Pure,
  unit-tested, no UI change. Add CORE flags to the frameworks.
- **P2:** thicken evidence per D3 (wire the strong actions + the session-cap +
  distinct-item guard, additive `music.competencyEvidence.v1` day-bucket keys).
  Unit-test the cap + guard.
- **P3:** the seam - `GuidanceLevel.effective()` (instrument-aware, hysteretic,
  bootstrap rules from D2.5). Point the existing depth consumers at it. Verify
  no behavior change for a cold user (falls through to the ask).
- **P4:** diagram depth keys off `effective()` (replaces the collapsed toggle):
  beginner -> shape name on the card, advanced -> clean. Verify tips/charts
  already follow.
- **P5 (separate feature, future):** real finger numbers - curated per-chord
  fingering data (guitar+uke) + a barre-span render primitive. music-theory-coach:
  fingerings are NOT derivable from fret arrays and a wrong finger teaches a bad
  habit; barre chords can't be a per-dot number. So this is authored data, its
  own branch, not part of this arc.

## Risks / guardrails

- **Trust > accuracy.** A flickering or demoting band erodes trust worse than a
  slightly-stale one. Hysteresis + self-report-only-raises are non-negotiable.
- **Never gate ACCESS.** The band changes explanation density only; every
  feature stays reachable at every band (pedagogy: levels gate depth).
- **Additive storage only.** All new keys under `music.` (backup.js OWNED_PREFIXES,
  no SCHEMA bump). Every reader defensive -> safe default.
- **Deterministic.** No LLM in the loop; band + evidence are pure functions,
  unit-tested (loop-verification: verifiable-first).
- **Public repo.** competency.js already ships only generic frameworks; a user's
  levels/evidence live in their own localStorage. Keep it that way.

## V&V bar per phase

- Pure functions (`bandFor`, evidence cap): Node unit tests, boundary + hysteresis
  + gaming cases.
- The seam + consumers: headless render-verify that a cold user is unchanged, and
  that a seeded advanced-uke localStorage produces the clean surface live.

## References

- [music/shared/competency.js](../../music/shared/competency.js), [music/shared/guidance-level.js](../../music/shared/guidance-level.js)
- Coaches: [.claude/skills/pedagogy-coach](../../.claude/skills/pedagogy-coach/SKILL.md), [.claude/skills/ux-coach](../../.claude/skills/ux-coach/SKILL.md), [.claude/skills/music-theory-coach](../../.claude/skills/music-theory-coach/SKILL.md)
- [docs/plans/vision-tutor-deterministic-20260705.md](vision-tutor-deterministic-20260705.md) - the deterministic-tutor vision this serves
