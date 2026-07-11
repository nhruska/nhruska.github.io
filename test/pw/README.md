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
| setlist-remove-arm | S-SETRM-ARM: setlist edit-mode remove handle rests QUIET (computed-color probe vs --bad), first tap ARMS red (1.6s auto-disarm proven), second tap removes + undo banner - the ONE inline-remove grammar |
| triads-audible | S-TRIADS-AUDIBLE + S-RN-STYLE: inversion cards are tap-to-hear buttons (exact voicing from the active profile's open-string freqs, shared ChordAudio engine, keyboard-reachable) and I/IV/V numerals carry .rn styling in prose |
