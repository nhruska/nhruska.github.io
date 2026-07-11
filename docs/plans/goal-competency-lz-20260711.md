# Goal spec - M-COMPETENCY LZ (per-skill competency profile)

**Date:** 2026-07-11
**Branch:** `claude/m13-competency-lz`
**Operator directive (2026-07-11):** "The music app should maintain my competency
profile for each of these skills ... grow my skill set ... stored locally. enable
export ... import when first starting ... and there we have personalized adaptive
learning." The Music app becomes the first consumer of the operator's portable
`skill-competency-profile/v1` pattern (the ccp side is already merged).

## Objective (completion condition)

The app maintains a per-skill competency profile that GROWS from what the musician
actually does, stored LOCALLY, and can be EXPORTED to a file / IMPORTED from one.
This LZ ships the storage + growth + export/import + a Settings viewer. It does NOT
yet consume the profile to personalize suggestions (named next goalpost).

Done when: composing records evidence to `music.competency.v1`; the Settings ->
Skills panel renders the frameworks, level bars, per-skill Export, and a first-start
Import lead; export/import round-trips (incl. the optional `preferences` array,
absent-tolerant); node suite green; the red-first scenario proves red on main and
green with the wiring shim.

## Privacy invariant (HARD - this repo is PUBLIC)

The app ships ONLY the generic competency FRAMEWORKS (skill/competency ids, names,
descriptions, targets - all publishable). A user's LEVELS + evidence live ONLY in
localStorage on their device (`music.competency.v1`) and in files they export.
NO personal seed values or personal JSON are committed here. Import = the user loads
their own profile at runtime.

## Portable schema contract (`skill-competency-profile/v1` - ids match ccp verbatim)

```
{ schema:"skill-competency-profile/v1", skill, discipline:"music", updated:ISO,
  provenance:[{source,at}],
  competencies:[{id,name,desc,level:0-100,target,evidence_count,last_evidence}],
  preferences?:[{id,statement,evidence_count,last_evidence}] }   // additive, optional
```

Embedded frameworks (ids verbatim): stringed-instrument (fretboard-map, chord-shapes,
transitions, rhythm-keeping, tuning-ear), ukulele (uke-open-chords, uke-strum-patterns,
uke-chunking, uke-fingerpicking, uke-repertoire), guitar (gtr-open-chords, gtr-barre,
gtr-strum-dynamics, gtr-transitions, gtr-repertoire), music-composition
(comp-progressions, comp-song-form, comp-key-mode, comp-borrowing, comp-melody),
lyric-writing (lyr-prosody, lyr-imagery, lyr-rhyme, lyr-structure, lyr-rewrite).

## Storage (backup.js additive rule)

ONE new localStorage key `music.competency.v1` = a map `{ [skillId]: profile }`, under
the already-owned `music.` namespace -> backup.js snapshots/restores it with ZERO
schema bump. Defensive reader (corrupt value -> empty map). No `backup.js` change,
no `SCHEMA_VERSION` bump.

## Level-movement formula + pedagogy rationale

`level += max(1, round((target - level) * 0.06))`, capped at target, never moving once
at/above it (imported-higher levels never regress). Diminishing returns: early practice
moves fast, the last stretch to a target is earned slowly - matches the pedagogy-coach
"success within the first minute" + "spacing beats massing" principles (visible early
progress, an asymptote near mastery). Deterministic (no LLM), so it compiles to code
and is unit-testable directly (`nextLevel`).

## Evidence map (what the app can honestly observe today)

| Action (songbook.js) | Records |
|---|---|
| Assemble a song (`assembleSong`) | music-composition/comp-song-form + comp-progressions, and the active instrument's repertoire (ukulele/uke-repertoire, guitar/gtr-repertoire, else stringed-instrument/chord-shapes) |
| Add a section to the song buffer (`addSongSection`) | music-composition/comp-song-form (small) |
| Save a progression (`saveProgression`, create + update) | music-composition/comp-progressions |

No hooks for skills the app cannot yet observe (lyrics, fingerpicking, ear) - their
frameworks render with "no evidence yet". Hooks are GUARDED: a no-op until competency.js
is wired, so the engine never depends on it.

## PARENT coupled merge step (this branch deliberately does NOT do it)

Per boundaries, this branch does not touch `music/play/index.html`, `music/sw.js`, or
`music/shared/build-stamp.js`. At merge the PARENT must, in ONE commit:

1. Add `<script src="../shared/competency.js"></script>` to `play/index.html` BEFORE
   `songbook.js` (after `song-templates.js` is the proven slot).
2. Add `shared/competency.js` to the `music/sw.js` `CORE` list (offline PWA cache).
3. Bump `sw.js` `CACHE = 'music-vN'` AND refresh `shared/build-stamp.js`
   (VERSION + UPDATED_ISO) in the SAME commit (the cache-bump pair; songbook.js /
   songbook.css are CORE files and changed here).

Until (1) lands, `window.Competency` is undefined -> the evidence hooks no-op and the
Skills panel does not inject (graceful). This is the same escalation shape the M-13 g1
builder used for song-templates.js.

## Verification

- `node -c` on changed JS; `node test/run-all.js` green (46 files, 0 failed), including
  `competency.test.js` (22 cases: nextLevel diminishing/cap/hold, recordEvidence
  increment + cap, additive-key isolation, export schema, import higher-wins + sum +
  unknown-id tolerance + reject bad schema, preferences round-trip + union merge).
- Red-first USDD scenario `test/pw/scenarios/competency-profile.json`: RED without the
  script-tag shim (localStorage evidence assert fails at step 23); GREEN (35/35) with a
  temporary shim, which was REVERTED (index.html carries no competency script tag on this
  branch).

## Next goalposts (ranked)

1. **HEADLINE - the consume side (the personalized adaptive loop).** The song builder
   READS the profile + `preferences` to weight template/section suggestions, and (once
   lyrics exist) to weight lyric guidance. This is where "built in and compounded from
   previous sessions" becomes real - the operator's compound-engineering feedback loop.
   The LZ ships the storage + schema handling for `preferences`; nothing consumes it yet.
2. More evidence sources: tutor/drills, chord-diagram practice, tuner use (tuning-ear),
   per-section lyrics once lyrics exist.
3. Cockpit competency-event emission (surface skill growth on the Ops Deck).
4. A richer drill-in view (evidence history, target-reach celebration).
