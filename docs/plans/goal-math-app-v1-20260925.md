# Goal: Math app v1 (`/math/`, sibling of `/music/`)

Operator ask (2026-09-25): a math-workout app for the kids (K-2) and for Nik to keep sharp. Mechanic like the "Math Adapt / Times Table Master" screenshots (problem card + answer slot + 3x4 keypad, progress bar, clock, table-chip picker, "let the coach pick"), styled as a sibling of the Music app with the Music theme + primitives as SSOT. Landing page shows two apps.

## Completion condition

1. `https://nhruska.github.io/math/` (branch preview on githack) loads with zero app console errors at 412x915, 375x812 and 1440x900, dark and light.
2. A player can: create a profile, pick ops (+ - x / or any mix), add/sub range, times tables 2-12 with max 10/11/12, mode Race (default) / Sprint 60s / Practice, or Coach; run a workout on the keypad; see results with best-time tracking; view a per-fact progress heatmap.
3. `node test/run-all.js` green, including new `test/math-*.test.js`; `scripts/check-cache-bump.sh` green.
4. At least one committed `test/pw/scenarios/math-*.json` flow green.
5. Landing page lists Music + Math.

## Operator decisions (interview 2026-09-25)

| Question | Answer |
|---|---|
| Clock shape | **Both**: Race (fixed set, total time + penalties) is the default, plus a 60s Sprint |
| Wrong answer | **+3s, retry the same fact** until correct |
| v1 extras | **Player profiles, Adaptive coach, Progress history** (handwriting "Write-it" deferred) |
| Kids' level | **K-2**: add/sub is the kid default |

## Assumed answers (basis cited; override any in one line)

| Decision | Assumed | Basis |
|---|---|---|
| Add/sub ranges | "To 10": a+b<=10 and a-b with a<=10. "To 20": addends 1-9 (sums to 18) and the inverse subtraction facts (answers always 1-9, e.g. 11 - 2). No zero operands or zero answers. | "mostly single digit answers"; screenshot shows `11 - 2`; pedagogy-coach: zero facts are trivial in a timed drill |
| Times tables | chips x2..x12; nothing picked = all tables to max; multiplier 1..max | "by 8s or 9s ... max 10, 11, 12 control" |
| Division | (t*k) / t = k, divisor t from the picked tables, quotient 1..max | inverse of the table; always whole numbers |
| Mixed | op chips are multi-select; any 2+ ops = mixed; balanced op counts per set | "and Mixed" |
| Submit | auto-submit when typed length == answer length (no Enter key) | screenshot keypad has no Enter |
| Reveal | after 2 wrong tries the answer shows ghosted; player still types it (counts as missed) | pedagogy: produce before reveal, never stuck |
| Race length | 20 default, 10/20/30 selectable | screenshot "12 questions each" scaled for mixed sets |
| Practice | untimed, no penalty, still feeds the coach | "timed mode default" implies an untimed mode |
| Coach name | "Coach", never "AI" | it is a local Leitner heuristic, not a model; copy honesty |
| Theme | reads/writes the shared `music.theme.v1` (one site appearance); accent = the active player's colour from the Music palette | "reuse music app style, theming ... as SSOT" |
| Offline | own PWA at `/math/` (network-first SW, `math-` caches only) | kids' tablet / car use; network-first avoids stale builds |
| Storage | `math.` prefix, defensive readers, additive only | Music `backup.js` convention; `music.` prefix is swept by Music backup |
| Version | `math-v<PR#>` shown in Settings | mirrors Music's build-stamp handle |

## Deferred (named, not dropped)

- Write-it handwriting input (operator deferred).
- Math data in Music's Backup/Restore (`backup.js` sweeps `music.` only).
- Extracting `songbook.css` tokens into a lighter `tokens.css` (only if the 172 KB matters).

## Architecture

```
math/
  index.html   UI shell - links ../music/shared/{songbook.css,theme.js,esc.js,toast.js}; ALL CSS external
  math.css     math-only rules, Music tokens only (no new hues)
  app.js       UI controller (screens: setup, workout, results, progress; sheets: players, settings)
  engine.js    PURE logic: window.MathEngine + module.exports
  store.js     persistence: window.MathStore + module.exports
  version.js   MATH_VERSION = 'math-v<PR#>' (page + SW single source)
  sw.js        network-first SW, scope /math/
  manifest.webmanifest, icon.svg, CLAUDE.md
```

Music-side changes (small, deliberate): `Theme.PALETTE` extracted into `music/shared/theme.js` (play/index.html consumes it), `music/sw.js` activate deletes only `music-` caches (it used to delete every other cache on the origin, which would wipe Math's), Music cache/build-stamp pair bump.

## Locked interfaces (seam contracts) - verbatim in every spawn

### MathEngine (`math/engine.js`) - pure, no DOM, no storage

UMD shape like `music/shared/theme.js`: `(function(root){ ... root.MathEngine = api; module.exports = api; })(typeof window !== 'undefined' ? window : this)`.

Types:

```
Op      = '+' | '-' | 'x' | '/'
Fact    = { op, a, b, answer, key, text }
          '+': a + b          key '+:<min(a,b)>:<max(a,b)>'   text '5 + 3'
          '-': a - b          key '-:<a>:<b>'                  text '11 − 2'
          'x': a x b          key 'x:<min>:<max>'              text '7 × 8'
          '/': a / b          key '/:<a>:<b>' (a=dividend)     text '56 ÷ 8'
          text uses GLYPH, single spaces around the glyph.
Config  = { ops: Op[] (non-empty, order-insensitive), addRange: 10|20, tables: int[] (subset of 2..12; [] = all 2..max),
            max: 10|11|12, order: 'random'|'ordered', coach: boolean, mode: 'race'|'sprint'|'practice', length: 10|20|30 }
FactStat = { n, miss, box, ms, last }   n asked, miss asked-with->=1-wrong, box 0..4 Leitner, ms EWMA correct ms, last epoch ms
Stats    = { [key]: FactStat }
Result   = { fact, ms, wrongs }
Run      = plain object (see createRun)
Session  = { ts, mode, cfgKey, label, n, correct, misses, elapsedMs, penaltyMs, totalMs }
```

Constants: `GLYPH {'+':'+','-':'−','x':'×','/':'÷'}`, `OPS ['+','-','x','/']`, `TABLES [2..12]`, `MAXES [10,11,12]`, `LENGTHS [10,20,30]`, `PENALTY_MS 3000`, `SPRINT_MS 60000`, `REVEAL_AFTER 2`, `NEW_CAP 3`, `COACH_MIN_SEEN 5`, `DEFAULT_CFG {ops:['+','-'],addRange:10,tables:[],max:10,order:'random',coach:false,mode:'race',length:20}`, `PRESETS {addsub: DEFAULT_CFG, tables: {...DEFAULT_CFG, ops:['x']}}`.

Functions (all pure; `rng` = `() => float in [0,1)`, `now` = epoch ms):

| Function | Contract |
|---|---|
| `normalizeCfg(cfg) -> Config` | fills defaults, drops invalid values; never throws; `ops` empty -> DEFAULT ops; tables filtered to 2..12, sorted, deduped |
| `makeFact(op, a, b) -> Fact` | builds key/text/answer per the table above |
| `pool(op, cfg) -> Fact[]` | every candidate fact for ONE op. '+' To10: 1<=a,b, a+b<=10; To20: a,b in 1..9. '-' To10: 1<=b<a<=10; To20: a=x+y, b=y, x,y in 1..9. 'x': t in (coach or tables empty ? 2..max : tables), k in 1..max, fact makeFact('x', k, t). '/': makeFact('/', t*k, t). Distinct by (a,b) - '+' and 'x' keep both display orders as separate facts sharing one key. |
| `rng(seed) -> rng` | deterministic mulberry32 |
| `buildSet(cfg, stats, rng, count?, now?) -> Fact[]` | `now` feeds coach due-ness (omitted = every seen fact due; amended 2026-09-25, the engine takes no clock). count defaults to cfg.length (sprint callers pass 200). Ops balanced (counts differ by <=1, shuffled). Within an op: random = shuffle-bag without replacement, refilled when exhausted; ordered AND single table AND ops is ['x'] or ['/'] = k ascending 1..max, cycling. Coach = weighted draw by `coachWeight`, at most NEW_CAP unseen keys per set once that op has COACH_MIN_SEEN (5) seen facts; below that unseen facts fill in (amended 2026-09-25 after review: with 1 seen fact the cap produced a 17-in-a-row repeat). Never the same key twice in a row unless the op pool has one key. |
| `coachWeight(fact, stats, now) -> number` | unseen 3; seen: `[8,4,2,1,0.5][box]` x (due ? 1 : 0.25), due when days since last >= `[0,0,1,3,7][box]` |
| `coachFocus(cfg, stats, now, n=3) -> Fact[]` | top-n SEEN facts by coachWeight across cfg.ops pools (distinct keys) - the "Coach is working on" line |
| `fastMs(stats, op) -> number` | <5 seen facts of that op: 4000; else clamp(1.25 x median(ms of that op's seen facts), 1200, 4000) |
| `recordAnswer(stats, result, now) -> Stats` | returns a NEW stats object. n+1; miss+1 if wrongs>0; ms = first ? ms : round(0.7*old + 0.3*ms); box: wrongs>0 -> 0; else ms<=fastMs(stats before, op) -> min(4, box+1); else unchanged; last = now |
| `createRun(cfg, facts, now) -> Run` | `{cfg, facts, idx:0, input:'', wrongs:0, reveal:false, results:[], penaltyMs:0, startedAt:now, pausedAt:null, pausedTotal:0, qStart:0, done:false}` |
| `elapsed(run, now) -> ms` | active ms: (pausedAt ?? now) - startedAt - pausedTotal |
| `current(run) -> Fact` | `run.facts[run.idx]` |
| `press(run, key, now) -> {run, event}` | returns a NEW run. key `'0'..'9'` / `'back'` / `'clear'`. Ignored (event null) when done or paused. Digit appends while input shorter than answer length; at full length: correct -> push Result {fact, ms: elapsed-qStart, wrongs}, idx+1, input '', wrongs 0, reveal false, qStart = elapsed, event 'correct' (or 'done', setting done=true, when idx reaches facts.length); wrong -> wrongs+1, input '', penaltyMs += PENALTY_MS unless mode 'practice', reveal = wrongs >= REVEAL_AFTER, event 'wrong' |
| `tick(run, now) -> {run, event}` | sprint only: when `remaining(run, now) <= 0` -> done, event 'done'; else event null |
| `remaining(run, now) -> ms` | sprint: max(0, SPRINT_MS - elapsed - penaltyMs); other modes: null |
| `pause(run, now)` / `resume(run, now)` | new run; pause sets pausedAt; resume adds (now - pausedAt) to pausedTotal and clears it |
| `summarize(run, now) -> Summary` | `{mode, n: results.length, correct: count wrongs==0, misses: count wrongs>0, missed: Fact[] (distinct keys, first-seen order), slowest: up to 3 Results with wrongs==0 sorted by ms desc, elapsedMs, penaltyMs, totalMs: elapsed+penalty}` |
| `toSession(cfg, summary, now) -> Session` | fills cfgKey/label/ts |
| `cfgKey(cfg) -> string` | stable grouping key: mode, sorted ops, addRange only if +/- present (plus coach when there is no x or /), (coach ? 'coach' : sorted tables or 'all') + max only if x or / present, length only for race/practice, plus `ord` for an in-order single table (easier than random). A coach set never shares a best with a hand-picked one. |
| `cfgLabel(cfg) -> string` | one group per op family, each next to its own range, joined by `, `: `+ − to 10`, `× 7 8 to 12`, `× ÷ coach to 10`, `+ − to 20, × ÷ 6 7 8 to 12`. ASCII-safe except the op glyphs; no em dash (amended 2026-09-25: the flat run-on read ambiguously in the Progress list) |
| `isBetter(a, b) -> bool` | a better than b (b may be null -> true). race/practice: lower totalMs; sprint: more answered (`n`), tie -> fewer misses (amended 2026-09-25: every sprint answer ends correct and a miss already costs 3s, so answered is the honest score) |
| `gridFor(op, cfg) -> {rows:int[], cols:int[], cells: (string|null)[][]}` | heatmap layout. '+': rows=cols=1..9, cell key for a+b (null when To10 and a+b>10). '-': rows b 1..9, cols answer x 1..9, key '-:(x+b):b' (null when To10 and x+b>10). 'x': rows tables 2..12, cols k 1..max. '/': rows divisor t 2..12, cols quotient k 1..max |
| `mastery(stat) -> 'new'|'weak'|'learning'|'strong'` | none -> new; box 0 -> weak; 1-2 -> learning; 3-4 -> strong |

### MathStore (`math/store.js`) - persistence only, no engine import

Same UMD shape; `window.MathStore` + `module.exports`.

```
MathStore.SCHEMA_VERSION = 1
MathStore.KEYS = { profiles:'math.profiles.v1', prefs:'math.prefs.v1', schema:'math.schema.v1',
                   facts: id => 'math.facts.'+id+'.v1', sessions: id => 'math.sessions.'+id+'.v1' }
MathStore.MAX_SESSIONS = 300
MathStore.create(storage) -> store   // storage = localStorage-like (getItem/setItem/removeItem); every read try/catch -> safe default; every write try/catch -> returns false on quota/throw
Profile = { id, name, color, cfg, created }   // name trimmed, <=20 chars, '' -> 'Player'; color = hex string; cfg stored as given (engine normalizes)
```

| Method | Contract |
|---|---|
| `getProfiles() -> {active, list}` | corrupt/missing -> `{active:null, list:[]}`; active not in list -> first id or null |
| `addProfile({name, color, cfg}) -> Profile` | id `'p' + base36 time + base36 random`; becomes active when it is the first |
| `updateProfile(id, patch) -> Profile|null` | shallow merge of name/color/cfg |
| `setActive(id) -> bool` / `getActive() -> Profile|null` | |
| `removeProfile(id) -> snapshot|null` | snapshot `{profile, index, facts, sessions, wasActive}` for undo; deletes facts+sessions keys |
| `restoreProfile(snapshot) -> bool` | re-inserts at index, restores keys, re-activates if wasActive; refuses (false, nothing written) when the id is already present, so a double-tapped Undo cannot duplicate a player |
| `getFacts(id) -> Stats` / `saveFacts(id, stats) -> bool` | |
| `getSessions(id) -> Session[]` (oldest first) | |
| `addSession(id, session, isBetter) -> {isBest, prevBest}` | computes prevBest BEFORE insert among sessions with same cfgKey+mode; practice never best; caps to MAX_SESSIONS dropping oldest |
| `best(id, cfgKey, mode, isBetter) -> Session|null` | |
| `resetProgress(id) -> snapshot` / `restoreProgress(id, snapshot) -> bool` | clears/restores facts+sessions |
| `getPrefs() -> {sound, haptics}` (defaults true, true) / `setPrefs(patch) -> prefs` | |
| `migrate() -> number` | reads schema key (missing = current), runs `MIGRATIONS[n]` steps up to SCHEMA_VERSION (empty map in v1), writes it, returns version |

### Version + SW

- `math/version.js`: `(function(root){ root.MATH_VERSION = 'math-v<PR#>'; if (typeof module!=='undefined'&&module.exports) module.exports = root.MATH_VERSION; })(typeof self!=='undefined'?self:this);`
- `math/sw.js`: `importScripts('version.js')`; `CACHE = self.MATH_VERSION`; network-first with a 3.5 s deadline + cache fallback (`ignoreSearch`) for same-origin GET; cache-first for cross-origin (fonts); install precaches CORE + `skipWaiting`; activate deletes only keys that start with `math-` and differ from CACHE, then `clients.claim()`; replies `{type:'VERSION', version: CACHE}` to a `GET_VERSION` message on `e.ports[0]`.
- Lookups go through the worker's OWN cache only (`caches.open(CACHE).then(c => c.match(...))`), never the origin-wide `caches.match` - Math and Music both cache `music/shared/*` and either could answer with the other's stale copy (amended 2026-09-25 after review).
- CORE: `./`, `index.html`, `app.js`, `engine.js`, `store.js`, `math.css`, `version.js`, `manifest.webmanifest`, `icon.svg`, `../music/shared/songbook.css`, `../music/shared/theme.js`, `../music/shared/esc.js`, `../music/shared/toast.js`.
- Page registers `navigator.serviceWorker.register('sw.js', {scope: './'})`.

### Theme palette

`music/shared/theme.js` exports `PALETTE` (the exact 8 `{n,a,d,p}` swatches, Teal first) alongside `effectiveTheme` / `accentVars`; `music/play/index.html` uses `Theme.PALETTE`. Math reads the same array for player colours.

## v1.1 - Skills path + competency (operator UAT 2026-09-25)

Operator feedback on the preview: "needs haptic feedback and color highlights on my input when answering questions" and "implement skills and competency based approach like music app". Interview answers:

| Question | Answer |
|---|---|
| Where skills live | **Skill path is home**: opens on the path, "Up next" one tap from a Race; today's setup becomes the Custom tab |
| Gating | **All open, path suggests** (Music's rule: levels gate depth, never access) |
| Mastery | **Accuracy only**: every fact in the skill right first try, no speed gate (speed shown, never required) |
| Rewards | **Stars per skill + level-up moment + badge shelf** |

Assumed answers (basis cited):

| Decision | Assumed | Basis |
|---|---|---|
| "Right first try" robustness | a fact counts as solid at 2 first-try-correct answers in a row (`ok >= 2`), **at most one step per fact per workout**; a miss resets it | a 1-digit guess is right 10% of the time; pedagogy-coach "only mastery earns silence" + spaced retrieval: "Practice misses" repeats a fact right after the answer was shown, which is short-term recall, not mastery (review #4 on 2aa2dc0) |
| Stars | 1 = half the facts right first try, 2 = every fact right first try once, 3 (mastered) = every fact solid. Earned stars never go down; the bar shows today's level | kids: losing a star after one slip is demotivating; the Coach still drills the slip |
| Competency model | Music's `skill-competency-profile/v1` shape (framework of competencies, level 0-100, target, evidence count), computed from per-fact stats instead of nudged by events | "like music app"; the per-fact tracker already is the evidence |
| Bands | beginner (0-3 mastered) / intermediate (4-8) / advanced (9+), shown on the path; they grade depth, never access | Music competency-adaptive-depth D1 (3 bands) |
| Skill workouts | the skill's facts, Coach-weighted toward misses, Race by default (Practice beside it) | timed default; coach already exists |
| Export / import | Settings exports the portable profile (with the raw fact stats so a device move keeps progress) and imports one back (merge, never overwrite down) | Music's Skills panel export/import; closes most of M-MATH-BACKUP |
| Input feedback | every key: light haptic tick + key flash; right answer: your digits turn green for ~0.25s with the clock paused; wrong: red digits + shake + buzz | the operator's words, and the clock pause keeps the feedback free |

### Locked interface: MathSkills (`math/skills.js`)

UMD like engine.js (`root.MathSkills`, `module.exports`); reads facts via `MathEngine.pool` (`root.MathEngine || require('./engine.js')`). Pure: no DOM, no storage, time only via a `now` param.

```
FRAMEWORK = { id: 'arithmetic-facts', name: 'Math facts', discipline: 'math', skills: SKILLS }
Skill     = { id, name, short, desc, cfg }          // cfg = partial engine Config
Progress  = { total, seen, right, solid, level, stars, mastered, medianMs }
Earned    = { [skillId]: { stars: 0-3, masteredAt: epochMs|null } }
```

SKILLS (ordered path, ids are the portable contract - verbatim):

| # | id | name | short | cfg |
|---|---|---|---|---|
| 1 | add-10 | Addition to 10 | +10 | ops ['+'], addRange 10 |
| 2 | sub-10 | Subtraction from 10 | −10 | ops ['-'], addRange 10 |
| 3 | add-20 | Addition to 20 | +20 | ops ['+'], addRange 20 |
| 4 | sub-20 | Subtraction to 20 | −20 | ops ['-'], addRange 20 |
| 5 | x-2-5-10 | Times 2, 5 and 10 | ×2 5 10 | ops ['x'], tables [2,5,10], max 10 |
| 6 | x-3-4 | Times 3 and 4 | ×3 4 | ops ['x'], tables [3,4], max 10 |
| 7 | x-6-7 | Times 6 and 7 | ×6 7 | ops ['x'], tables [6,7], max 10 |
| 8 | x-8-9 | Times 8 and 9 | ×8 9 | ops ['x'], tables [8,9], max 10 |
| 9 | div-2-5-10 | Divide by 2, 5 and 10 | ÷2 5 10 | ops ['/'], tables [2,5,10], max 10 |
| 10 | div-3-9 | Divide by 3 to 9 | ÷3 to 9 | ops ['/'], tables [3,4,6,7,8,9], max 10 |
| 11 | x-11-12 | Times 11 and 12 | ×11 12 | ops ['x'], tables [11,12], max 12 |
| 12 | x-all-12 | All times tables to 12 | ×all | ops ['x'], tables [], max 12 |

| Function | Contract |
|---|---|
| `skillById(id) -> Skill\|null` | |
| `factKeys(skill) -> string[]` | distinct keys over `MathEngine.pool(op, normalizeCfg(skill.cfg))` for each op, sorted |
| `progress(skill, stats) -> Progress` | total = factKeys length; seen = keys with n >= 1; right = keys with ok >= 1; solid = keys with ok >= 2; level = round(100 * sum(min(ok, 2)) / (2 * total)); stars = 3 if solid == total, else 2 if right == total, else 1 if 2 * right >= total, else 0; mastered = stars == 3; medianMs = median ms over seen keys with ms > 0, else null. `ok` read defensively (missing/garbage = 0) |
| `path(stats, earned) -> {skills, upNext, masteredCount, band}` | skills = SKILLS in order as `{skill, progress, stars: max(earned stars, progress.stars), masteredAt}`; upNext = id of the first skill whose stars < 3, else null; masteredCount = count with stars 3; band = beginner (0-3) / intermediate (4-8) / advanced (9+) |
| `updateEarned(earned, stats, now) -> {earned, gains, mastered}` | NEW earned object; stars only ever rise to progress.stars; masteredAt stamped (= now) the first time stars reach 3 and never cleared; gains = `[{id, from, to}]` for every rise; mastered = ids that reached 3 this call |
| `skillCfg(skill, base) -> Config` | `normalizeCfg` of base mode/length + the skill's ops/addRange/tables/max, `coach: true`, `skill: id`, `label: name`, `order: 'random'` |
| `exportProfile(name, stats, earned, now) -> doc` | `{schema: 'skill-competency-profile/v1', skill: 'arithmetic-facts', discipline: 'math', updated: ISO(now), provenance: [{source: 'app:math', at: ISO(now)}], player: name, competencies: [{id, name, desc, level, target: 100, stars, evidence_count: sum of n over the skill's keys, last_evidence: ISO of max last or null}], facts: stats, earned}` |
| `importProfile(json, stats, earned) -> {ok, stats, earned, error}` | accepts a doc object or JSON string; rejects wrong schema/skill (`ok:false`, human-readable error, inputs unchanged). Merges facts per key keeping the entry with the larger `n` (tie: later `last`); earned keeps the max stars and the earliest masteredAt. Never mutates inputs |

Engine amendments (same PR): FactStat gains `ok` (first-try-correct streak: `wrongs > 0 ? 0 : ok + 1`, except that `recordAnswer(stats, result, now, runStart)` leaves `ok` unchanged on a right answer when the fact's `last >= runStart`, so a streak moves at most once per workout, and a fifth argument `noStep` (a "Practice misses" drill) never moves it); `normalizeCfg` keeps `skill` (`/^[a-z0-9-]{1,32}$/`) and `label` (string, <= 40 chars); `pool` scopes x and / to the picked tables even when coach is on (Custom's Coach clears the picks to mean "all"); `cfgKey` leads with `sk:<id>` for a skill set and keeps the tables for a coach set that has them (a coach set with no tables keeps v1's `coach` slot, so Custom coach bests survive); `cfgLabel` returns `label` when present.
