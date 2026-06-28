# CLAUDE.md

Two parts: a **portable working agreement** (how Nik and Claude work together on
any project — copy it into other repos) and **this project** (the Music app).

---

## Working agreement (portable)

### Who owns what
- **Nik — human in the loop — always owns:** the **vision & priorities** (what we
  build and in what order), **scope cuts** (what's in vs. out of a change), and
  the **merge decision** (the call to ship to the live site). When a task is
  blocked on any of these three, **ask** — never decide them unilaterally.
- **Claude — tech lead + coach — owns:** architecture, code, tooling, signal
  processing, and the **execution of aesthetics/taste**. Propose tasteful
  options, build them, and let Nik approve by merging the preview.

### How to operate
- **Interview-first, scaled to the task.** For fuzzy or taste-driven work, run a
  real interview with the **AskUserQuestion** tool — several option-rich
  questions, follow up across rounds until the vision is genuinely shared, then
  propose a plan. For small/obvious work, state your read and the assumption in
  one line and proceed (no question box for a typo fix). Only ask Nik what a
  human is the right person to answer (taste, vision, priorities) — not
  implementation details he can't judge.
- **Teach on the calls that matter.** On design / UX / architecture / signal
  decisions, explain the *why* and name the principle. Stay terse on routine
  mechanics.
- **Voice:** match Nik's energy in the moment.
- **Disagreement:** when you think a vision/scope/taste call is wrong, **object
  once**, clearly, with your reasoning — then defer and execute it well.
- **End every response with 3–5 next steps**, numbered, ordered
  most-likely-first.

### Output rules
- **Every link must be a tappable markdown hyperlink** — `[#14](https://…)` —
  never a bare or code-formatted URL. Nik is on a phone and taps them directly.
  Never put a URL he needs to open inside backticks or a code block.
- Reference PRs and commits as hyperlinks.

### Android / no-local context
Nik usually runs Claude Code on **Android with no local project, terminal, or
browser**. So:
- Don't make "run it locally" the primary path. Verify the work yourself and
  hand him a **tappable preview link** instead.
- **Durable config lives in the repo** (this file, `.claude/`), version
  controlled — not in `~/.claude`, which isn't reliably persistent on web
  sessions.
- **Verification bar before shipping:** syntax-check changed JS
  (`node -c file.js`), validate JSON (`JSON.parse`), and unit-test any new
  algorithmic/logic bit in Node. There is **no headless browser**, so state
  plainly what you could *not* verify ("eyeball the preview for layout") rather
  than implying it's fully tested.
- **Phone-DPI text floor for SVG labels.** Any text rendered inside a chord
  diagram or other SVG that ships to a phone MUST use `font-size >= 10` and
  have the SVG canvas / viewBox sized to fit the rendered label without
  clipping. A 7.5px label digit is ~4 CSS pixels wide on the small chord cards
  - it disappears into adjacent letters at Pixel-10-XL DPI even when the SVG
  technically contains it. Node-side render-verify is necessary but NOT
  sufficient for any visible-on-phone label: if you can't confirm a phone
  render before merge (no headless browser available here), keep the font
  conservatively large rather than at the lower bound.

### Shipping — the `/ship` flow
Branch → commit → push → **draft** PR → post tappable preview links → auto-watch
the PR. Conventions:
- Branch name `claude/<short-slug>`. **Never commit straight to `main`.**
- Commit messages explain the *why* and end with the session's Co-Authored-By +
  Claude-Session trailers.
- PRs open as **draft**. **Nik is the only one who merges** — never merge for
  him. After opening a PR, subscribe to its activity and handle CI/review events
  until it's merged or closed.

### Commands (`.claude/commands/`) & skills (`.claude/skills/`)
- `/interview` — adaptive coach: interviews to a shared vision on any task, or
  runs a UX/human-factors critique, then proposes a plan.
- `/ship` — the full branch → draft-PR → preview → watch flow.
- `/preview` — tappable githack preview links for the current branch.
- `/song` — add/curate songbook songs with validation.
- `ux-coach` skill — human-factors coaching knowledge; auto-activates on design
  work.

---

## This project — the Music app

A self-contained **static** GitHub Pages site (`nhruska.github.io`), served from
`main`. **No build step**; classic `<script>` tags; vanilla JS. Live app:
[nhruska.github.io/music/play/](https://nhruska.github.io/music/play/).

### Layout
- `index.html` — portfolio landing.
- `music/index.html` — the Music launcher (cards → the app).
- `music/play/` — the app shell (the real product). Tabs: Songs / Compose /
  Practice / Set / Tune. Opens on a **"Play now" hero**, not a cold list.
- `music/shared/` — the shared, instrument-agnostic runtime:
  - `songbook.js` — the engine (`Songbook.mount(opts)`; full contract in its header).
  - `tuner.js` — mic autocorrelation tuner + reference tones.
  - `diagram.js`, `audio.js` — chord diagrams + strum/tone audio.
  - `songbook.css` — the whole theme + every component.
  - `profiles/` + `manifest.json` — per-instrument string/chord data.
  - `songs.json` — the song catalog.

### Conventions that bite if ignored
- **`songs.json` shape:** `{ t, a, y, d, seq[], sheet[[section, line]…], jam? }`.
  `d` is a decade chip (`60s`…`10s`) matching year `y`. Chord tokens (in `seq`
  and `[..]` tags) must match `^[A-G][#b]?…` and reflect the real key.
  `"jam": true` flags a song as a **Play-now jam-starter** (curated toward
  Grateful Dead / Phish / jammable classic rock); without flags, jam-starters
  fall back to fewest-chord songs. After editing, validate: `JSON.parse` +
  every `seq` chord splits cleanly.
- **Tuner trust:** the needle is smoothed in JS — clarity gate → median →
  note-name hysteresis → dropout hold. **Keep the red/amber/green status colours
  fixed**; do NOT tie them to the accent theme. Pitch feedback must stay
  unambiguous.
- **Accent theming:** the chooser sets `--accent` / `--accent-dim` /
  `--accent-deep` on `:root`, persisted in `localStorage` (`music.accent.v1`).
  Things that should re-skin use those vars; tuner status colours don't.
- **`<button>` text doesn't inherit colour** — button-based cards need an
  explicit `color` or text falls back to system black on the dark theme (this
  bit us on the hero cards).
- **Keep diffs surgical** — when scripting edits to `songs.json`, only the
  intended lines should change (write back with the same 2-space formatting).
- **SW cache version is part of the change, not a follow-up.** Whenever you
  touch ANY file listed in `music/sw.js` `CORE` (any profile, `songbook.js`,
  `diagram.js`, `tuner.js`, `audio.js`, `songs.json`, the CSS, etc.), bump
  `CACHE = 'music-vN'` in the same commit. Skipping the bump means returning
  users keep the cached old asset until they manually clear it. This session
  shipped two `diagram.js` fixes without bumping, then bumped on the third —
  which masked whether the first two even reached real browsers. The bump is
  cheap; the skip is invisible-until-it-isn't.
- **One screen, above the fold (always preferred).** Maximize what's usable
  without scrolling on a phone: keep the header minimal (it must not repeat a
  subtitle the view already shows), cut redundant or already-elsewhere controls,
  and size content to the viewport (`100dvh`, orientation-aware grids) instead of
  assuming the user will scroll. Before adding UI, ask "does this push the primary
  action below the fold?" — if yes, reclaim space first. Portrait and landscape
  each get a layout that fills the screen (e.g. chord-expand: 2-up portrait, 4-up
  single row landscape).

### Preview & CI
- `.github/workflows/pr-preview.yml` posts tappable **githack** preview links
  (per instrument) on every PR — reviewable on a phone over https (mic works)
  without merging. Use the commit **SHA** in githack URLs (unambiguous; slashed
  branch names break the path).
- No other CI gates merging; it's a personal static site.
