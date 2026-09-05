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
  [usdd skill](../../.claude/skills/usdd/SKILL.md). Persona coverage: 2 of 8
  flows have persona variants (grow this - CE2).

| Scenario | Proves |
|---|---|
| smoke-boot | app boots, tab bar renders, zero JS errors |
| compose-default-c | D-DEFAULT-C: keyed to C, In-key view, palette populated |
| compose-clear-inkey | S-CLEAR-INKEY: Clear resets a pinned All view to In-key |
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
| detail-solo-consistency | UAT batch 3 items 4+6: the song view's back and the Studio's are ONE primitive (.iconBtn.backArrowBtn - same fill/ink/radius/box/glyph, same leading slot in their own header row, compared header-relative so the gate does not encode either surface's padding), and the large sheet chord chips are real playable buttons carrying the canonical token, above the 44px floor, at the sheet's own type scale |
| solo-topbar-overflow | UAT batch 3 item 4, video half: the Studio's fly-out trigger is the song view's overflow primitive (.iconBtn.moreBtn, three-dot) instead of a hamburger in the app-Settings slot, the topbar carries exactly two controls, and Collapse leads the fly-out as a named row that minimizes without unmounting the iframe |
| settings-accordion-affordance | UAT batch 4: Settings sections are individually distinct cards with real gaps (was flush hairline rows - the grammar of a list), the expand handle is a drawn stroke chevron rather than a filled U+25BE select glyph, header rows clear 52px, an inner .setLbl is strictly smaller/dimmer/micro-capped against its heading (compared as MEASURED values, so a type-scale change cannot flatten the hierarchy and still pass), the Theme description is gone, and its removal did not collapse the gap above the next label |
| settings-action-rows | UAT batch 5: every "do a thing" row in a settings panel is the ONE .setAction primitive - uniform box (each row compared against the FIRST measured row, not a pinned height), one nowrap line that does not clip, no per-row description, ONE caption per section instead of two paragraphs plus a three-line raw URL, external rows distinguishable by ink + leave-app glyph rather than a sentence, and .saMeta carrying live state only |
| settings-skills-merged | UAT batch 6: Settings has NO separate AI Agent accordion - the block is adopted into the Skills pane on every render (an adoption done once at mount is wiped by the pane clear, which is the bug this catches), exactly ONE export row in the whole sheet named 'Export for my AI', the copy-a-prompt step gone rather than relocated, and the agent docs demoted to a closed disclosure that still reveals everything when opened. Seeds real evidence via Competency.recordEvidence so the export row (gated on hasData) is actually reachable |
| song-builder | M-13 SONG BUILDER LZ: Compose section buffer -> multi-section custom song - add a progression as Verse, add another as Chorus (progression NOT cleared = A3), arm-guard a buffer-chip remove, Assemble opens the song view with BOTH section headers + chord bars |
| song-builder-templates | M-13 g1 TEMPLATE-SUGGESTED SECTIONS: wrote a Verse then cleared the canvas -> the SONG tray offers proven-progression chips for the next section, realized in the song's key (SongTemplates.forSection); switch to Chorus, tap a chip to fill through the chord-add path (A3 clear-undo invalidates), Add as Chorus, Assemble shows Verse + Chorus. NOTE: needs song-templates.js wired into play/index.html + sw.js CORE (a coupled parent merge step) for the chips to populate |
| song-builder-drag-reorder | M-13 g4: DRAG a buffer section chip to reorder, reusing the S-PROG-REORDER grammar (mouse lift-on-move path; touch long-press is the operator feel pass) - order changes on-screen AND in the persisted *.builderBuffer.v1 key, nothing deleted/strummed, and the up/dn handles (the a11y/keyboard fallback) still work after a drag |
| triads-audible | S-TRIADS-AUDIBLE + S-RN-STYLE: inversion cards are tap-to-hear buttons (exact voicing from the active profile's open-string freqs, shared ChordAudio engine, keyboard-reachable) and I/IV/V numerals carry .rn styling in prose |
| competency-profile | M-COMPETENCY LZ: composing a song records evidence to the local per-skill competency profile (music.competency.v1); Settings -> Skills shows the 5 generic frameworks, level bars, and per-skill Export. NOTE: needs competency.js wired into play/index.html + sw.js CORE (a coupled PARENT merge step) for the panel to inject - prove green with a temporary script-tag shim, reverted |
