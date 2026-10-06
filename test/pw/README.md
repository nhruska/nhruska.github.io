# test/pw - declarative usage-scenario suite (pw-replay JSON)

Every supported usage flow is a committed JSON scenario, executable on demand -
the compound asset behind operator UAT: what he taps by hand, the runner drives
headless with the same steps and screenshots the proof.

```
python3 test/pw/run-scenario.py test/pw/scenarios/solo-skip-mixolydian.json
python3 test/pw/run-scenario.py --all        # every scenario, SEQUENTIALLY
```

- Self-contained: spawns its own `http.server` at the repo root, fresh browser
  context per scenario (clean localStorage/SW), kills the server after.
- **One scenario per process, sequential** - the dev box OOMs on parallel suites
  (music/CLAUDE.md "Test the real box"). `--all` honors this.
- Chromium: `$PW_CHROME` > `/opt/pw-browsers/chromium-*` (Claude web container)
  > Playwright default (laptop shared install).
- Console policy: `pageerror` always fatal; `console.error` fatal unless it is
  sandbox-proxy noise (blocked external fetches - YouTube, fonts).
- Evidence: `test/pw/evidence/<scenario>/*.png` (gitignored); merge-gate proofs
  are copied to `docs/artifacts/` when they back a PR claim.
- Step vocabulary lives in the `run-scenario.py` docstring. Add verbs to the
  runner, never imperative code to scenarios - scenarios stay declarative data.
- **USDD personas**: a scenario's `"persona"` field ("beginner" | "intermediate"
  | "advanced") seeds the guidance-level state pre-load, so level-gated UI is
  assertable per simulated user - the red-first loop is the
  [usdd skill](../../.claude/skills/usdd/SKILL.md). The committed goalpost-persona
  registry currently has 7 named persona fixtures and 11 `persona-*.json`
  scenarios. Treat this as a dated inventory, not a coverage percentage: coverage
  requires a declared denominator of supported flows.

| Scenario | Proves |
|---|---|
| smoke-boot | app boots, tab bar renders, zero JS errors |
| compose-default-c | D-DEFAULT-C: keyed to C, In-key view, palette populated |
| compose-clear-inkey | S-CLEAR-INKEY: Clear resets a pinned All view to In-key |
| compose-all-f-major-b | NH-2: keyed to F, the All/Major palette reads B (not Cb) and Bb |
| solo-cancel | S-POSTPROG-FLOW: Solo modal cancellable, progression kept |
| solo-skip-mixolydian | progression-aware picker: C-F-A# (bVII) -> Mixolydian default + mode chips + key-aware Bb in notes |
| studio-scale-tap-dorian | Studio chip switch re-renders scale (Dorian b3 = D#) |
| prog-fit-6 | S-PROG-FIT-6: 6 chords keep the toggle row above the fold at 412x915 |
| prog-delete-handles | S-DELHANDLE-OVERFLOW: delete badges sit on their cards |
| persona-beginner-studio | USDD: beginner sees NO theory prose in the Studio (whynote level-gate) |
| persona-advanced-studio | USDD: advanced DOES see the whynote banner - same taps, opposite assert |
| library-calluses | stored operator-authored song renders in the Library (catalog integrity after a songs.json append) |
| filter-chips-quiet | G3 S-TYPEFILTER-QUIET: selected library FILTER chips are outline-quiet, accent fill reserved for primary/mode (computed-style + pixels) |
| ops-deck-panel | Cockpit (formerly Ops Deck) glass: live feed + filters, swarm lanes, merged Your-turn stream, 4 operator queues, QUEUE.md board, PR-tab fallback, public Wins timeline (412x915, zero JS errors) |
| triads-key-spelling | S-TRIADS-SPELLING: Triads & Inversions spells by function in the stated key - F major's IV reads Bb, never A# (shape assert: no A# anywhere in an F-major cycle) |
| keypicker-preferred-names | S-KEYPICKER-PREFERRED: every key selector shows preferred key names from ONE provider (root grid Db/Eb/Ab/Bb, picked Bb reads Bb on the chip AND the key readout - no more "C# selected, Db displays") |
| prog-reorder | S-PROG-REORDER prototype: drag a progression chord to reorder (mouse lift-on-move path; touch long-press is the operator feel pass), order changes, nothing deleted/strummed |
| prog-delete-undo | S-DELETE-UNDO: progression remover arms on first tap (no delete), deletes on second, remove-undo toast restores the chord |
| cockpit-remix | THE PICK: composite cockpit.html - C queue-first actionable surface + B tempo rail, contract held at 412x915 |
| cockpit-instruments | Cockpit v2 Angle A: signal bar above the fold, needs-me count real, project tile -> mission drill within the tap budget (friction-profile contract C1-C5,C7) |
| cockpit-tempo | Cockpit v2 Angle B: mobile vertical time rail replaces the desktop board, rail entry drills to mission detail |
| cockpit-signal | Cockpit v2 Angle C: queue cards carry inline actions (same-environment tenet), dept -> project -> mission descends one altitude per tap |
| setlist-gestures | S-SETLIST-GESTURES: a set row's resting look carries no grip and no always-on x; a row-body drag reorders (press-and-hold on touch); a >=25% horizontal swipe either direction deletes through the same removeFromSet+undo path, and a <25% swipe springs back |
| setlist-a11y-fallback | SUPERSEDES setlist-remove-arm. The swipe + press-and-hold are pointer-only, so WCAG 2.5.1 needs a non-gesture equivalent: proves the up/down/remove buttons stay in the DOM, are quiet at rest, reveal to a real target on keyboard focus, keep the two-tap arm grammar for remove, and actually reorder/remove by keyboard |
| setlist-scroll | S-SETLIST-SCROLL: a 25-song setlist keeps every row at its content height, no row clips itself, and #setBody overflows and actually scrolls - the squashed-hairlines defect (#setBody is both the flex column and the scroller, and .swipeable's overflow:hidden lets rows shrink to 0 before anything overflows) |
| detail-solo-consistency | UAT batch 3 items 4+6: the song view's back and the Studio's are ONE primitive (.iconBtn.backArrowBtn - same fill/ink/radius/box/glyph, same leading slot in their own header row, compared header-relative so the gate does not encode either surface's padding), and the large sheet chord chips are real playable buttons carrying the canonical token, above the 44px floor, at the sheet's own type scale |
| solo-topbar-overflow | UAT batch 3 item 4, video half: the Studio's fly-out trigger is the song view's overflow primitive (.iconBtn.moreBtn, three-dot) instead of a hamburger in the app-Settings slot, the topbar carries exactly two controls, and Collapse leads the fly-out as a named row that minimizes without unmounting the iframe |
| settings-accordion-affordance | UAT batch 4: Settings sections are individually distinct cards with real gaps (was flush hairline rows - the grammar of a list), the expand handle is a drawn stroke chevron rather than a filled U+25BE select glyph, header rows clear 52px, an inner .setLbl is strictly smaller/dimmer/micro-capped against its heading (compared as MEASURED values, so a type-scale change cannot flatten the hierarchy and still pass), the Theme description is gone, and its removal did not collapse the gap above the next label |
| settings-action-rows | UAT batch 5: every "do a thing" row in a settings panel is the ONE .setAction primitive - uniform box (each row compared against the FIRST measured row, not a pinned height), one nowrap line that does not clip, no per-row description, ONE caption per section instead of two paragraphs plus a three-line raw URL, external rows distinguishable by ink + leave-app glyph rather than a sentence, and .saMeta carrying live state only |
| settings-skills-merged | UAT batch 6: Settings has NO separate AI Agent accordion - the block is adopted into the Skills pane on every render (an adoption done once at mount is wiped by the pane clear, which is the bug this catches), exactly ONE export row in the whole sheet named 'Export for my AI', the copy-a-prompt step gone rather than relocated, and the agent docs demoted to a closed disclosure that still reveals everything when opened. Seeds real evidence via Competency.recordEvidence so the export row (gated on hasData) is actually reachable |
| musician-profile-import | M-MUSICIAN-PROFILE: a never-observed competency reads 'not yet observed' (unassessed explicit, never '0 / 80'); a coach's profile.json imports through the REAL file picker (uploadText verb, schema dispatch); goal + plan render as quiet read-only lines; the coach's records + an unknown top-level key survive in `music.profile.v1`; the fresh device adopts the musician id; the next export carries the coach's records beside the app's compose-modality evidence with no level for what it never observed. RED on main at the first behavioral assert |
| musician-profile-baseline | M-MUSICIAN-PROFILE-VNEXT acceptance fixture (the REAL baseline case): Settings > Musician profile reads 'Musicianship: not yet assessed' before any coach (never beginner/0); the shared fixture `test/fixtures/musician-profile-baseline-handback.json` uploads through the REAL picker (`uploadText` + `textFile`); afterwards advanced musicianship (11 of 11) coexists with unassessed ukulele mechanics, bass/piano/kalimba render from the profile, mandolin stays unassessed, focus + plan render with app-origin deep links as tappable rows, the evidence disclosure shows 'attached, not analyzed' + the superseded self-report as history, the next export carries everything back out. RED on main (the section is still 'Skills'), GREEN on the branch |
| song-builder | M-13 SONG BUILDER LZ: Compose section buffer -> multi-section custom song - add a progression as Verse, add another as Chorus (progression NOT cleared = A3), arm-guard a buffer-chip remove, Assemble opens the song view with BOTH section headers + chord bars |
| song-builder-templates | M-13 g1 TEMPLATE-SUGGESTED SECTIONS: wrote a Verse then cleared the canvas -> the SONG tray offers proven-progression chips for the next section, realized in the song's key (SongTemplates.forSection); switch to Chorus, tap a chip to fill through the chord-add path (A3 clear-undo invalidates), Add as Chorus, Assemble shows Verse + Chorus. NOTE: needs song-templates.js wired into play/index.html + sw.js CORE (a coupled parent merge step) for the chips to populate |
| song-builder-drag-reorder | M-13 g4: DRAG a buffer section chip to reorder, reusing the S-PROG-REORDER grammar (mouse lift-on-move path; touch long-press is the operator feel pass) - order changes on-screen AND in the persisted *.builderBuffer.v1 key, nothing deleted/strummed, and the up/dn handles (the a11y/keyboard fallback) still work after a drag |
| triads-audible | S-TRIADS-AUDIBLE + S-RN-STYLE: inversion cards are tap-to-hear buttons (exact voicing from the active profile's open-string freqs, shared ChordAudio engine, keyboard-reachable) and I/IV/V numerals carry .rn styling in prose |
| competency-profile | M-COMPETENCY LZ: composing a song records evidence to the local per-skill competency profile (music.competency.v1); Settings -> Skills shows the 5 generic frameworks, level bars, and per-skill Export. NOTE: needs competency.js wired into play/index.html + sw.js CORE (a coupled PARENT merge step) for the panel to inject - prove green with a temporary script-tag shim, reverted |
| musician-profile-hostile-keys | Review of #351: a stored profile whose ids are Object.prototype names (constructor, toString, hasOwnProperty, __proto__, valueOf) still renders the real Musician profile headline - one line per hostile-named instrument, all five musicianship assessments counted - instead of summary() throwing into the silent legacy fallback, and nothing pollutes Object.prototype |
| tune-landscape-miniplayer | Landscape phone (812x375, 915x412) with the mini-player bar up: the Tune tab's bottom string row scrolls fully clear of the bar and every bottom-row button hit-tests to itself (centre + corners); the tuner card is not crushed to a sliver; portrait 375x812 still fits one screen with the strings above the bar |
| tune-landscape-two-pane | Landscape phone (915x340, 844x340, 740x320) with the mini-player bar up, for guitar (6), ukulele (4), banjo (5) and mandolin (4 courses): the Tune tab is TWO-PANE - tuner card and strings side by side, no view or tuner-pane scroll, Start/Tone/mode chips/runway/note/cents line and every string fully on screen, inside the view and clear of the chrome (the gear + left rail in the landscape rail shell, header + tab bar elsewhere) and the mini bar, hit-testing to themselves, controls >=44px, strings in the pane grid at every size; portrait 412x800 and desktop 1280x800 keep the stacked 540px column (structural no-regression) |
| persona-intermediate-landscape-songs-list | Landscape rail shell (Direction A): at 915x340, 844x340 and 740x320 with the mini bar up, the Songs list keeps >=180px (three rows) above the one-row bar in Jams, All and Setlist, the scroller ends above the bar, the view switcher shares one row with Search & filter + Add (or Clear + Start), and the first two rows hit-test to themselves; 412x800 portrait keeps the stacked chrome, bottom tab bar and two-row bar |
| persona-intermediate-landscape-rail-nav | Landscape rail shell: the tab bar is a 76px left rail (same buttons, order and labels, >=56px tall, live), the gear sits at the rail top, the header is gone and the view fills the screen; rail taps switch screens without moving the rail; focus order gear -> Songs -> Compose -> Tune; Enter on the gear opens Settings, Escape closes it; 412x800 and 1280x800 keep the bottom tab bar, header and 540px column |
| landscape-video-layers | Landscape rail shell, video: the theater is sized by height (>=180px tall), clear of the bar and rail, the bar transport hit-tests to itself above the scrim (Pause pauses without docking), handles >=44px; docked, the PIP sits INSIDE the bar's leading slot and covers nothing on Songs, Setlist or the two-pane Tune, and still expands to the theater |
