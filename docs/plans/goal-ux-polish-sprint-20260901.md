# Goal Spec + Atomic Sprint Plan - UX/UI/Human-Factors Polish (2026-09-01)

> Mission: close the remaining OPEN goalposts from the SDD friction-profile record
> ([ux-friction-profiles-20260710](ux-friction-profiles-20260710.md)) plus the registered
> feedback-consistency debt, as one autonomous atomic sprint with parallel worktree
> execution, cheap-model-routable task cards, and pixel verification.

## Objective + completion condition

**Objective:** every remaining friction-profile goalpost that is spec-complete and NOT
operator-gated is shipped red-first (USDD) on branch `claude/music-app-ux-ui-polish-47k2rc`,
integrated, verified (node suite green + PW render-verify at 412x915), and presented as one
draft PR with V&V evidence.

**Done when:** (1) G4 jam-starter, S-ENFORCE-2B (both native confirm() sites), and
S-SUGG-DIFFERENTIATE are live on the branch; (2) CE3 first-session scenario exists and its
red/green state is reported honestly; (3) S-PROG-FIT-6 is MEASURED at 412x915 with a
verdict; (4) `node test/run-all.js` green; (5) SW cache bumped per asset-changing commit
(`music-v<PR#>` series) with build-stamp pair; (6) draft PR open with V&V + preview links.

## Friction-profile scoring (SDD basis for this sprint's picks)

Rescored per the I x R x E model of the source doc; only OPEN items included.

| Task | Feeds (profile) | I | R | E | Score | State |
|---|---|---|---|---|---|---|
| T1 jam-starter chip | B3 (Sam/beginner dead-end empty state) - G4 | 4 | 3 | 4 | 48 | spec unchanged, open |
| T2a songbook confirm() -> app grammar | all personas (feedback-consistency law) - S-ENFORCE-2B | 3 | 5 | 4 | 60 | lint-pinned debt |
| T2b suggested-chord differentiation | Riley (browse vs recommend ambiguity) - S-SUGG-DIFFERENTIATE | 3 | 4 | 4 | 48 | open, UAT-sourced |
| T3 repertoire-form confirm() | all personas - S-ENFORCE-2B | 3 | 4 | 4 | 48 | lint-pinned debt |
| T4 first-session scenario | CE3 north star (Sam) | 5 | 4 | 3 | 60 | scenario to write |
| P1 prog-fit-6 measure | Riley (4-6 chords above the fold) | 3 | 4 | 5 | 60 | needs 412x915 confirm |

Deliberately EXCLUDED (operator-gated, not swarmable): S3 blues boxes (gate on drafted
spec), S12 guide-context (direction pick), S10 local-jam (operator records audio), S5/S6/S8
(data-integrity arc, separate mission shape).

## Scope

**In:** `music/shared/tracks.{js,css}`, `music/shared/songbook.{js,css}`,
`music/shared/repertoire-form.{js,css}`, `test/*.test.js`, `test/pw/scenarios/*`,
`test/no-native-dialog-lint.test.js` (integration only), `music/sw.js` +
`music/shared/build-stamp.js` (cache pair, integration only), QUEUE.md, this doc.

**Out:** stored-data shape (no SCHEMA_VERSION change anywhere in this sprint), tuner
colours, theory engine, any operator-gated item above, songs.json content.

**Guardrails (never-do):** no native dialogs added; no inline styles (external-CSS law);
no new hue for emphasis (emphasis ladder only); tuner status colours untouched; no
SCHEMA_VERSION bump; no push except `claude/music-app-ux-ui-polish-47k2rc`; no merge
(operator owns); agents never touch a sibling's files or the lint/QUEUE/README seams.
If a command is refused/denied - STOP and report; never re-route through another
transport, tool, or wrapper.

**Abort conditions:** baseline suite red before integration of a wave -> stop that wave;
3 failed attempts on any gate -> stop, surface with evidence; OOM signals (exit 137) ->
one PW scenario at a time, never relaunch a fan-out.

## Assumed Answers (operator absent - basis cited)

| Question | Assumed answer | Basis |
|---|---|---|
| Include G4 despite the 2026-07-10 mid-swarm cancel? | Yes | QUEUE row: "goalpost stays open, spec unchanged" - explicit standing state |
| Destructive-action grammar for the confirm() swaps? | Arm-to-delete (first tap arms red, 1.6s disarm, second tap acts) + undo where restorable; modal only where arm cannot fit | S-DELETE-UNDO + S-SETRM-ARM shipped this exact grammar as "the ONE inline-remove grammar" |
| Suggested-chord differentiation mechanism? | Emphasis + order only (recommended marker/tint within accent vars), never a new hue | QUEUE row spells it: "EMPHASIS + ORDER... never a new hue" |
| Jam-starter shape? | One curated genre chip for the current key inside the no-video empty state, replacing prose-only hint; tap = load that backing track | G4 spec line + F27 disclosure conventions in tracks.js |
| Cache version | `music-v<PR#>`, `-2`, `-3` per asset-changing commit | S-SW-PER-COMMIT standing directive |

## Execution shape (parallel waves, cheap-model routing)

| Wave | Tasks | Isolation | Model tier | Why this tier |
|---|---|---|---|---|
| 0 | this doc + draft PR | parent | high (parent) | planning/judgment |
| 1 | T1, T2, T3, T4 in PARALLEL | one worktree each, file-disjoint | `sonnet` (worktree-implementer shape) | routine scoped implementation; reasoning done here in the cards |
| 2 | integrate + lint counts + QUEUE + cache pair + render-verify + PR comment | parent | high (parent) | merge-combination review is the parent's non-delegable job |

Seam locks: `test/no-native-dialog-lint.test.js`, `test/pw/README.md`, `docs/plans/QUEUE.md`,
`music/sw.js`, `music/shared/build-stamp.js` are PARENT-ONLY (integration). T2 and T3 both
retire confirm() sites but never touch the shared lint - the parent drops both pinned
counts to zero in one integration commit. Agents commit locally in their worktree and do
NOT push.

## Atomic task cards (min-context, cheap-model-executable)

### T1 - G4 jam-starter + tracks helpIcon
- **Objective:** the "Find a jam" no-video empty state offers ONE tappable curated starter
  chip for the current key (beginner-reachable, no finder navigation), and tracks.js help
  toggles adopt the `.helpIcon` convention (`songbook.css:1705`).
- **Anchors:** empty-state hint `music/shared/tracks.js:943` (noVideoHint/F27 block);
  curated catalog access + key context live in tracks.js jam/finder code; chip primitives
  in `tracks.css`.
- **Acceptance:** fresh no-video Studio state renders exactly one starter chip labeled with
  genre + key; tap loads that jam (same path the finder uses); chip absent when a video
  exists; red-first scenario `test/pw/scenarios/jam-starter.json` written BEFORE the fix
  and green after; `node test/run-all.js` green; no inline styles; 44px tap target.
- **Files:** tracks.js, tracks.css, test/pw/scenarios/jam-starter.json, test/tracks.test.js.

### T2 - songbook confirm() retirement + suggested-chord differentiation
- **Objective:** (a) `songbook.js:1555` delete-custom-item confirm() replaced with the
  arm-to-delete grammar (or the app Modal if arming cannot fit the call site) + existing
  undo/toast pattern where restorable; (b) NEXT CHORD suggestion chips visually
  distinguished from the browse palette by emphasis + order (a recommended marker/tint via
  `--accent`/`--accent-dim`, suggestions ranked first), never a new hue.
- **Anchors:** confirm at `songbook.js:1555`; arm grammar reference: the S-DELETE-UNDO
  block near `songbook.js:5238`; suggestion chips render via `suggChip` (`songbook.js`
  ~2852, `#suggest` container); emphasis ladder in `songbook.css`.
- **Acceptance:** zero real `confirm(` call sites remain in songbook.js (verify with the
  lint's own regex, but DO NOT edit the lint file); unit test locks "first tap must not
  delete" for the new site; suggestion chips carry a distinguishing class asserted in a
  unit test; suite green.
- **Files:** songbook.js, songbook.css, test/songbook.test.js (+ a sugg assert in
  test/sugg.test.js if cleaner).

### T3 - repertoire-form confirm() retirement
- **Objective:** `repertoire-form.js:325` delete confirm() replaced with the same
  arm-to-delete grammar (red armed state, 1.6s auto-disarm, second tap deletes).
- **Acceptance:** zero real `confirm(` sites in repertoire-form.js; first-tap-arms locked
  by a unit test in test/repertoire-form.test.js; suite green; lint file untouched.
- **Files:** repertoire-form.js, repertoire-form.css, test/repertoire-form.test.js.

### T4 - CE3 first-session canonical scenario
- **Objective:** `test/pw/scenarios/first-session.json` - beginner cold start (cleared
  storage) reaches a strummable chord AND hears it (audio fired) within <= 5 taps. Written
  red-first; if the app cannot satisfy it, the scenario stays committed RED and the tap-path
  audit (each tap enumerated) is reported as the finding - do not weaken the assert to
  force green.
- **Anchors:** runner `test/pw/run-scenario.py` + verbs in test/pw/ (read README for the
  step schema; add a new verb to the runner ONLY if no existing verb can express "audio
  fired" - prefer asserting the app's own played/strum state class).
- **Files:** test/pw/scenarios/first-session.json (+ run-scenario.py verb if unavoidable).

### P1 (parent, wave 2) - S-PROG-FIT-6 measure
Serve locally, 412x915, build 4/5/6-chord progressions, measure `.prog` region vs
viewport: verdict = fits / scrolls, with screenshot. Fix only if a pure-CSS tightening
that respects the phone-DPI diagram floor exists; otherwise report the measured gap.

## Verification commands (per wave + integration)

```
node test/run-all.js                                   # must end: 0 failed
node -c <changed .js>                                  # every changed file
python3 -m http.server 8123 --bind 127.0.0.1 &         # serve (no egress needed)
python3 test/pw/run-scenario.py test/pw/scenarios/<name>.json
bash scripts/check-cache-bump.sh                       # after the cache pair commit
```

## Trace

QUEUE rows: G4/S-JAM-STARTER, S-ENFORCE-2B, S-SUGG-DIFFERENTIATE, S-FIRSTSESSION-SCENARIO,
S-PROG-FIT-6. Scoring source: [ux-friction-profiles-20260710](ux-friction-profiles-20260710.md).
