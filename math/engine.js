/* =====================================================================
 * engine.js  -  PURE arithmetic-workout logic for the Math app.
 * ---------------------------------------------------------------------
 * No DOM, no localStorage, no Date.now()/Math.random() inside logic -
 * every caller supplies `now` (epoch ms) and `rng` (a () => float in
 * [0,1) generator, see rng(seed) below) so this module stays fully
 * deterministic and unit-testable. UMD shape matches
 * music/shared/theme.js: window.MathEngine in the browser,
 * module.exports in Node.
 *
 * Contract source: docs/plans/goal-math-app-v1-20260925.md
 * "Locked interfaces (seam contracts) -> MathEngine".
 *
 * Contract interpretations (spec did not fully pin these down; picked
 * the reading most consistent with the rest of the locked contract):
 *  1. buildSet's coach branch needs a `now` to compute due-ness
 *     (coachWeight takes `now`), but the locked signature is
 *     `buildSet(cfg, stats, rng, count?)` with no `now`. Every other
 *     stateful function in this file takes `now` explicitly (the
 *     boundary forbids an internal Date.now()), so `now` is appended
 *     here as a 5th, trailing, OPTIONAL param:
 *     `buildSet(cfg, stats, rng, count, now)`. When omitted, coach
 *     weighting treats every seen fact as "due" (no recency gate)
 *     rather than reaching for the clock - callers that use coach mode
 *     should pass `now`.
 *  2. "ordered" fact selection is only defined for the narrow case in
 *     the contract text (single table, ops === ['x'] or ['/']); any
 *     other order:'ordered' combination (mixed ops, multiple/absent
 *     tables, or addsub) falls back to the same shuffle-bag as
 *     'random', since no ordering is meaningful there.
 *  3. "at most NEW_CAP unseen keys per set when that op has any seen
 *     fact" is applied PER OP (not globally across the whole set):
 *     each op's own slice of the drawn set is capped to NEW_CAP
 *     never-seen keys once THAT op has at least one seen key; an op
 *     with zero history draws unseen facts freely (so a brand-new
 *     table isn't starved down to 3 facts).
 *  4. Coach replaces the table list in both cfgKey and cfgLabel (coach
 *     draws from every table); for add/sub-only configs, which have no
 *     table slot, coach is appended after the range so a coach set never
 *     shares a best time with a hand-picked one.
 *  5. "sorted ops" (cfgKey, cfgLabel) sorts by the CANONICAL OPS array
 *     order (+, -, x, /), not string/char-code order (x before /).
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- *
   * Constants
   * ---------------------------------------------------------------- */

  var GLYPH = { '+': '+', '-': '−', 'x': '×', '/': '÷' };
  var OPS = ['+', '-', 'x', '/'];
  var TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var MAXES = [10, 11, 12];
  var LENGTHS = [10, 20, 30];
  var PENALTY_MS = 3000;
  var SPRINT_MS = 60000;
  var REVEAL_AFTER = 2;
  var NEW_CAP = 3;
  var COACH_MIN_SEEN = 5;
  var DAY_MS = 86400000;
  var BOX_WEIGHT = [8, 4, 2, 1, 0.5];
  var BOX_DUE_DAYS = [0, 0, 1, 3, 7];

  var DEFAULT_CFG = {
    ops: ['+', '-'], addRange: 10, tables: [], max: 10,
    order: 'random', coach: false, mode: 'race', length: 20
  };

  /* ---------------------------------------------------------------- *
   * Small generic helpers
   * ---------------------------------------------------------------- */

  function rangeTo(lo, hi) {
    var out = [];
    for (var i = lo; i <= hi; i++) out.push(i);
    return out;
  }

  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) {
      var k = String(v);
      if (!seen[k]) { seen[k] = true; out.push(v); }
    });
    return out;
  }

  function clampInt(n, lo, hi, dflt) {
    n = (typeof n === 'number' && !isNaN(n)) ? Math.floor(n) : dflt;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    return n;
  }

  function keyOp(key) {
    var i = String(key).indexOf(':');
    return i === -1 ? String(key) : String(key).slice(0, i);
  }

  function sortOps(ops) {
    return ops.slice().sort(function (a, b) { return OPS.indexOf(a) - OPS.indexOf(b); });
  }

  function cloneCfgLiteral(o) {
    return {
      ops: o.ops.slice(), addRange: o.addRange, tables: o.tables.slice(),
      max: o.max, order: o.order, coach: o.coach, mode: o.mode, length: o.length
    };
  }

  function shallowCopyRun(run) {
    var out = {};
    Object.keys(run).forEach(function (k) { out[k] = run[k]; });
    return out;
  }

  function shuffleArr(arr, rngFn) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rngFn() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function distinctKeyCount(poolArr) {
    var seen = {}, c = 0;
    poolArr.forEach(function (f) { if (!seen[f.key]) { seen[f.key] = true; c++; } });
    return c;
  }

  function weightedIndex(weights, rngFn) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    if (total <= 0) return Math.floor(rngFn() * weights.length);
    var r = rngFn() * total, cum = 0;
    for (var j = 0; j < weights.length; j++) {
      cum += weights[j];
      if (r < cum) return j;
    }
    return weights.length - 1;
  }

  /* ---------------------------------------------------------------- *
   * normalizeCfg / makeFact / pool
   * ---------------------------------------------------------------- */

  function normalizeCfg(cfg) {
    cfg = (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? cfg : {};

    var ops = Array.isArray(cfg.ops) ? cfg.ops.filter(function (o) { return OPS.indexOf(o) !== -1; }) : [];
    ops = uniq(ops);
    if (ops.length === 0) ops = DEFAULT_CFG.ops.slice();

    var addRange = (cfg.addRange === 20) ? 20 : 10;

    var tables = Array.isArray(cfg.tables)
      ? cfg.tables.filter(function (t) { return typeof t === 'number' && !isNaN(t) && t >= 2 && t <= 12 && Math.floor(t) === t; })
      : [];
    tables = uniq(tables).sort(function (a, b) { return a - b; });

    var max = MAXES.indexOf(cfg.max) !== -1 ? cfg.max : DEFAULT_CFG.max;
    var order = (cfg.order === 'ordered') ? 'ordered' : 'random';
    var coach = !!cfg.coach;
    var mode = (cfg.mode === 'sprint' || cfg.mode === 'practice') ? cfg.mode : 'race';
    var length = LENGTHS.indexOf(cfg.length) !== -1 ? cfg.length : DEFAULT_CFG.length;

    var out = { ops: ops, addRange: addRange, tables: tables, max: max, order: order, coach: coach, mode: mode, length: length };
    // v1.1: a skill workout carries its skill id (bests key) and display label.
    if (typeof cfg.skill === 'string' && /^[a-z0-9-]{1,32}$/.test(cfg.skill)) out.skill = cfg.skill;
    if (typeof cfg.label === 'string' && cfg.label.replace(/[\r\n]/g, '').trim()) out.label = cfg.label.replace(/[\r\n]/g, ' ').trim().slice(0, 40);
    return out;
  }

  function makeFact(op, a, b) {
    var answer, key;
    if (op === '+') { answer = a + b; key = '+:' + Math.min(a, b) + ':' + Math.max(a, b); }
    else if (op === '-') { answer = a - b; key = '-:' + a + ':' + b; }
    else if (op === 'x') { answer = a * b; key = 'x:' + Math.min(a, b) + ':' + Math.max(a, b); }
    else if (op === '/') { answer = a / b; key = '/:' + a + ':' + b; }
    else { answer = NaN; key = op + ':' + a + ':' + b; }
    var text = a + ' ' + (GLYPH[op] || op) + ' ' + b;
    return { op: op, a: a, b: b, answer: answer, key: key, text: text };
  }

  function pool(op, cfg) {
    cfg = normalizeCfg(cfg);
    var facts = [], i, j, kk;

    if (op === '+') {
      if (cfg.addRange === 20) {
        for (i = 1; i <= 9; i++) for (j = 1; j <= 9; j++) facts.push(makeFact('+', i, j));
      } else {
        for (i = 1; i <= 9; i++) for (j = 1; j <= 9; j++) if (i + j <= 10) facts.push(makeFact('+', i, j));
      }
    } else if (op === '-') {
      if (cfg.addRange === 20) {
        for (i = 1; i <= 9; i++) for (j = 1; j <= 9; j++) facts.push(makeFact('-', i + j, j));
      } else {
        for (i = 2; i <= 10; i++) for (j = 1; j < i; j++) facts.push(makeFact('-', i, j));
      }
    } else if (op === 'x') {
      // Tables are the SCOPE, coach is only the weighting (v1.1): a skill set is
      // coach-weighted inside its own tables. No picks = every table to max.
      var tabsX = cfg.tables.length === 0 ? rangeTo(2, cfg.max) : cfg.tables;
      tabsX.forEach(function (t) {
        for (kk = 1; kk <= cfg.max; kk++) facts.push(makeFact('x', kk, t));
      });
    } else if (op === '/') {
      var tabsD = cfg.tables.length === 0 ? rangeTo(2, cfg.max) : cfg.tables;
      tabsD.forEach(function (t) {
        for (kk = 1; kk <= cfg.max; kk++) facts.push(makeFact('/', t * kk, t));
      });
    }
    return facts;
  }

  /* ---------------------------------------------------------------- *
   * rng - deterministic mulberry32
   * ---------------------------------------------------------------- */

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- *
   * buildSet + its per-op supply strategies
   * ---------------------------------------------------------------- */

  function bagSupply(poolArr, n, rngFn) {
    var out = [], bag = [], lastKey = null;
    var multiKey = distinctKeyCount(poolArr) > 1;
    function refill() { bag = shuffleArr(poolArr, rngFn); }
    refill();
    for (var i = 0; i < n; i++) {
      if (bag.length === 0) refill();
      if (multiKey && bag[0].key === lastKey) {
        for (var j = 1; j < bag.length; j++) {
          if (bag[j].key !== lastKey) { var tmp = bag[0]; bag[0] = bag[j]; bag[j] = tmp; break; }
        }
      }
      var fact = bag.shift();
      out.push(fact);
      lastKey = fact.key;
    }
    return out;
  }

  function orderedSupply(poolArr, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(poolArr[i % poolArr.length]);
    return out;
  }

  function coachSupply(poolArr, statsObj, rngFn, n, now) {
    var out = [], lastKey = null;
    var poolKeys = uniq(poolArr.map(function (f) { return f.key; }));
    var seenCount = poolKeys.filter(function (k) { return !!statsObj[k]; }).length;
    var multiKey = distinctKeyCount(poolArr) > 1;
    // One new thing at a time - but only once there is enough history to
    // drill. Below COACH_MIN_SEEN seen facts the cap would leave the coach
    // cycling one or two facts (a 17-in-a-row streak was measured), so unseen
    // facts fill in, weighted normally.
    var hasSeenAny = seenCount >= COACH_MIN_SEEN;
    var newCapRemaining = hasSeenAny ? NEW_CAP : Infinity;

    for (var i = 0; i < n; i++) {
      var candidates = poolArr.filter(function (f) {
        var seen = !!statsObj[f.key];
        if (!seen && hasSeenAny && newCapRemaining <= 0) return false;
        return true;
      });
      if (candidates.length === 0) candidates = poolArr.slice();

      var avoidRepeat = candidates.filter(function (f) { return f.key !== lastKey; });
      // Contract: never the same key twice in a row unless the pool has one key.
      if (multiKey && avoidRepeat.length === 0) avoidRepeat = poolArr.filter(function (f) { return f.key !== lastKey; });
      var pickFrom = (multiKey && avoidRepeat.length > 0) ? avoidRepeat : candidates;

      var weights = pickFrom.map(function (f) { return coachWeight(f, statsObj, now); });
      var idx = weightedIndex(weights, rngFn);
      var fact = pickFrom[idx];

      var wasUnseen = !statsObj[fact.key];
      if (wasUnseen && hasSeenAny) newCapRemaining--;

      out.push(fact);
      lastKey = fact.key;
    }
    return out;
  }

  function buildSet(cfg, stats, rngFn, count, now) {
    cfg = normalizeCfg(cfg);
    stats = stats || {};
    rngFn = (typeof rngFn === 'function') ? rngFn : rng(1);
    count = (typeof count === 'number' && !isNaN(count) && count >= 0) ? Math.floor(count) : cfg.length;

    var ops = cfg.ops.slice();
    var nOps = ops.length;
    var base = Math.floor(count / nOps);
    var rem = count - base * nOps;
    var counts = {};
    ops.forEach(function (op) { counts[op] = base; });
    var shuffledOps = shuffleArr(ops, rngFn);
    for (var i = 0; i < rem; i++) counts[shuffledOps[i % shuffledOps.length]]++;

    var supplies = {};
    ops.forEach(function (op) {
      var n = counts[op];
      if (n === 0) { supplies[op] = []; return; }
      var poolArr = pool(op, cfg);
      if (poolArr.length === 0) { supplies[op] = []; return; }
      if (cfg.coach) {
        supplies[op] = coachSupply(poolArr, stats, rngFn, n, now);
      } else if (cfg.order === 'ordered' && cfg.tables.length === 1 && ops.length === 1 && (op === 'x' || op === '/')) {
        supplies[op] = orderedSupply(poolArr, n);
      } else {
        supplies[op] = bagSupply(poolArr, n, rngFn);
      }
    });

    var opSequence = [];
    ops.forEach(function (op) { for (var k = 0; k < counts[op]; k++) opSequence.push(op); });
    opSequence = shuffleArr(opSequence, rngFn);

    var idxByOp = {};
    ops.forEach(function (op) { idxByOp[op] = 0; });
    return opSequence.map(function (op) { return supplies[op][idxByOp[op]++]; });
  }

  /* ---------------------------------------------------------------- *
   * coach weighting / focus / pace
   * ---------------------------------------------------------------- */

  function coachWeight(fact, stats, now) {
    var s = stats && stats[fact.key];
    if (!s) return 3;
    var box = clampInt(s.box, 0, 4, 0);
    var due;
    if (now == null) {
      due = true;
    } else {
      var days = (now - (typeof s.last === 'number' ? s.last : 0)) / DAY_MS;
      due = days >= BOX_DUE_DAYS[box];
    }
    return BOX_WEIGHT[box] * (due ? 1 : 0.25);
  }

  function coachFocus(cfg, stats, now, n) {
    cfg = normalizeCfg(cfg);
    stats = stats || {};
    n = (typeof n === 'number' && !isNaN(n) && n >= 0) ? Math.floor(n) : 3;

    var seenByKey = {}, order = [];
    cfg.ops.forEach(function (op) {
      pool(op, cfg).forEach(function (f) {
        if (stats[f.key] && !seenByKey[f.key]) {
          seenByKey[f.key] = f;
          order.push(f.key);
        }
      });
    });
    var facts = order.map(function (k) { return seenByKey[k]; });
    facts.sort(function (a, b) { return coachWeight(b, stats, now) - coachWeight(a, stats, now); });
    return facts.slice(0, n);
  }

  function fastMs(stats, op) {
    stats = stats || {};
    var msList = [];
    Object.keys(stats).forEach(function (k) {
      if (keyOp(k) === op) {
        var s = stats[k];
        if (s && typeof s.ms === 'number' && s.n > 0) msList.push(s.ms);
      }
    });
    if (msList.length < 5) return 4000;
    msList.sort(function (a, b) { return a - b; });
    var mid = Math.floor(msList.length / 2);
    var med = (msList.length % 2 !== 0) ? msList[mid] : (msList[mid - 1] + msList[mid]) / 2;
    var v = 1.25 * med;
    if (v < 1200) v = 1200;
    if (v > 4000) v = 4000;
    return v;
  }

  function recordAnswer(stats, result, now) {
    stats = stats || {};
    var fact = result.fact;
    var key = fact.key;
    var op = keyOp(key);
    var prev = stats[key];
    var isFirst = !prev;
    var n = (prev ? prev.n : 0) + 1;
    var miss = (prev ? prev.miss : 0) + (result.wrongs > 0 ? 1 : 0);
    var ms = isFirst ? result.ms : Math.round(0.7 * prev.ms + 0.3 * result.ms);
    var thresholdMs = fastMs(stats, op);
    var box;
    if (result.wrongs > 0) {
      box = 0;
    } else if (result.ms <= thresholdMs) {
      box = Math.min(4, (prev && typeof prev.box === 'number' ? prev.box : 0) + 1);
    } else {
      box = (prev && typeof prev.box === 'number') ? prev.box : 0;
    }

    var out = {};
    Object.keys(stats).forEach(function (k) { out[k] = stats[k]; });
    // ok = first-try-correct answers in a row (accuracy-only skill mastery, v1.1);
    // additive field - a stat written before v1.1 just starts its streak here.
    var prevOk = (prev && typeof prev.ok === 'number' && prev.ok >= 0) ? Math.floor(prev.ok) : 0;
    var ok = result.wrongs > 0 ? 0 : prevOk + 1;
    out[key] = { n: n, miss: miss, box: box, ms: ms, last: now, ok: ok };
    return out;
  }

  /* ---------------------------------------------------------------- *
   * Run state machine
   * ---------------------------------------------------------------- */

  function createRun(cfg, facts, now) {
    return {
      cfg: cfg, facts: facts, idx: 0, input: '', wrongs: 0, reveal: false,
      results: [], penaltyMs: 0, startedAt: now, pausedAt: null,
      pausedTotal: 0, qStart: 0, done: false
    };
  }

  function elapsed(run, now) {
    var end = (run.pausedAt != null) ? run.pausedAt : now;
    return end - run.startedAt - run.pausedTotal;
  }

  function current(run) {
    return run.facts[run.idx];
  }

  function press(run, key, now) {
    if (run.done || run.pausedAt != null) return { run: run, event: null };

    if (key === 'back') {
      var nrBack = shallowCopyRun(run);
      nrBack.input = run.input.length > 0 ? run.input.slice(0, -1) : run.input;
      return { run: nrBack, event: null };
    }
    if (key === 'clear') {
      var nrClear = shallowCopyRun(run);
      nrClear.input = '';
      return { run: nrClear, event: null };
    }
    if (!/^[0-9]$/.test(String(key))) return { run: run, event: null };

    var fact = current(run);
    var answerLen = String(fact.answer).length;
    if (run.input.length >= answerLen) return { run: run, event: null };

    var newInput = run.input + key;
    if (newInput.length < answerLen) {
      var nrDigit = shallowCopyRun(run);
      nrDigit.input = newInput;
      return { run: nrDigit, event: null };
    }

    var el = elapsed(run, now);
    var isCorrect = Number(newInput) === fact.answer;

    if (isCorrect) {
      var result = { fact: fact, ms: el - run.qStart, wrongs: run.wrongs };
      var nrOk = shallowCopyRun(run);
      nrOk.results = run.results.concat([result]);
      nrOk.idx = run.idx + 1;
      nrOk.input = '';
      nrOk.wrongs = 0;
      nrOk.reveal = false;
      nrOk.qStart = el;
      if (nrOk.idx >= run.facts.length) {
        nrOk.done = true;
        return { run: nrOk, event: 'done' };
      }
      return { run: nrOk, event: 'correct' };
    }

    var nrWrong = shallowCopyRun(run);
    nrWrong.wrongs = run.wrongs + 1;
    nrWrong.input = '';
    if (run.cfg.mode !== 'practice') nrWrong.penaltyMs = run.penaltyMs + PENALTY_MS;
    nrWrong.reveal = nrWrong.wrongs >= REVEAL_AFTER;
    return { run: nrWrong, event: 'wrong' };
  }

  function remaining(run, now) {
    if (run.cfg.mode !== 'sprint') return null;
    var el = elapsed(run, now);
    var rem = SPRINT_MS - el - run.penaltyMs;
    return rem < 0 ? 0 : rem;
  }

  function tick(run, now) {
    if (run.cfg.mode !== 'sprint' || run.done) return { run: run, event: null };
    var rem = remaining(run, now);
    if (rem != null && rem <= 0) {
      var nr = shallowCopyRun(run);
      nr.done = true;
      return { run: nr, event: 'done' };
    }
    return { run: run, event: null };
  }

  function pause(run, now) {
    if (run.pausedAt != null || run.done) return shallowCopyRun(run);
    var nr = shallowCopyRun(run);
    nr.pausedAt = now;
    return nr;
  }

  function resume(run, now) {
    if (run.pausedAt == null) return shallowCopyRun(run);
    var nr = shallowCopyRun(run);
    nr.pausedTotal = run.pausedTotal + (now - run.pausedAt);
    nr.pausedAt = null;
    return nr;
  }

  function summarize(run, now) {
    var results = run.results;
    var correct = 0, misses = 0, missed = [], seenMissedKeys = {};
    results.forEach(function (r) {
      if (r.wrongs === 0) correct++;
      else {
        misses++;
        if (!seenMissedKeys[r.fact.key]) { seenMissedKeys[r.fact.key] = true; missed.push(r.fact); }
      }
    });
    var slowest = results.filter(function (r) { return r.wrongs === 0; })
      .slice()
      .sort(function (a, b) { return b.ms - a.ms; })
      .slice(0, 3);
    var elapsedMs = elapsed(run, now);
    var penaltyMs = run.penaltyMs;
    return {
      mode: run.cfg.mode, n: results.length, correct: correct, misses: misses,
      missed: missed, slowest: slowest, elapsedMs: elapsedMs, penaltyMs: penaltyMs,
      totalMs: elapsedMs + penaltyMs
    };
  }

  function toSession(cfg, summary, now) {
    return {
      ts: now, mode: summary.mode, cfgKey: cfgKey(cfg), label: cfgLabel(cfg),
      n: summary.n, correct: summary.correct, misses: summary.misses,
      elapsedMs: summary.elapsedMs, penaltyMs: summary.penaltyMs, totalMs: summary.totalMs
    };
  }

  /* ---------------------------------------------------------------- *
   * cfgKey / cfgLabel / isBetter
   * ---------------------------------------------------------------- */

  function cfgKey(cfg) {
    cfg = normalizeCfg(cfg);
    var ops = sortOps(cfg.ops);
    var hasAddSub = ops.indexOf('+') !== -1 || ops.indexOf('-') !== -1;
    var hasMulDiv = ops.indexOf('x') !== -1 || ops.indexOf('/') !== -1;
    var parts = [cfg.mode, ops.join('')];
    if (cfg.skill) parts.unshift('sk:' + cfg.skill);
    if (hasAddSub) parts.push('r' + cfg.addRange + (cfg.coach && !hasMulDiv ? '|coach' : ''));
    if (hasMulDiv) {
      parts.push((cfg.tables.length ? cfg.tables.join(',') : 'all') + (cfg.coach ? '|coach' : ''));
      parts.push('m' + cfg.max);
      // An in-order single table (1x7, 2x7, ...) is easier than random x7, so
      // it keeps its own best. Mirrors the condition buildSet orders under.
      if (!cfg.coach && cfg.order === 'ordered' && cfg.tables.length === 1 && ops.length === 1) parts.push('ord');
    }
    if (cfg.mode === 'race' || cfg.mode === 'practice') parts.push('l' + cfg.length);
    return parts.join('|');
  }

  function cfgLabel(cfg) {
    cfg = normalizeCfg(cfg);
    if (cfg.label) return cfg.label;
    var ops = sortOps(cfg.ops);
    var hasAddSub = ops.indexOf('+') !== -1 || ops.indexOf('-') !== -1;
    var hasMulDiv = ops.indexOf('x') !== -1 || ops.indexOf('/') !== -1;
    // Each op group sits next to its OWN range ('+ \u2212 to 20, \u00d7 \u00f7 6 7 8 to 12');
    // a flat run-on ('... to 20 6, 7, 8 to 12') was ambiguous in the Progress list.
    // Coach picks from every table, so it replaces the table list.
    var groups = [];
    if (hasAddSub) {
      groups.push(ops.filter(function (o) { return o === '+' || o === '-'; }).map(function (o) { return GLYPH[o]; }).join(' ') +
        ' to ' + cfg.addRange + (cfg.coach && !hasMulDiv ? ' coach' : ''));
    }
    if (hasMulDiv) {
      var which = cfg.coach ? 'coach' : (cfg.tables.length ? cfg.tables.slice().sort(function (a, b) { return a - b; }).join(' ') : 'all');
      groups.push(ops.filter(function (o) { return o === 'x' || o === '/'; }).map(function (o) { return GLYPH[o]; }).join(' ') +
        ' ' + which + ' to ' + cfg.max);
    }
    return groups.join(', ');
  }

  function isBetter(a, b) {
    if (b == null) return true;
    if (a == null) return false;
    if (a.mode === 'sprint') {
      // Sprint score = questions answered in 60s. Every answer is eventually
      // right (retry-same-fact) and a miss already cost 3s, so n is the score.
      if (a.n !== b.n) return a.n > b.n;
      return a.misses < b.misses;
    }
    return a.totalMs < b.totalMs;
  }

  /* ---------------------------------------------------------------- *
   * gridFor / mastery
   * ---------------------------------------------------------------- */

  function gridFor(op, cfg) {
    cfg = normalizeCfg(cfg);
    var rows, cols, cells;
    if (op === '+') {
      rows = rangeTo(1, 9); cols = rangeTo(1, 9);
      cells = rows.map(function (a) {
        return cols.map(function (b) {
          if (cfg.addRange === 10 && (a + b) > 10) return null;
          return makeFact('+', a, b).key;
        });
      });
    } else if (op === '-') {
      rows = rangeTo(1, 9); cols = rangeTo(1, 9);
      cells = rows.map(function (b) {
        return cols.map(function (x) {
          if (cfg.addRange === 10 && (x + b) > 10) return null;
          return makeFact('-', x + b, b).key;
        });
      });
    } else if (op === 'x') {
      rows = rangeTo(2, 12); cols = rangeTo(1, cfg.max);
      cells = rows.map(function (t) {
        return cols.map(function (k) { return makeFact('x', k, t).key; });
      });
    } else if (op === '/') {
      rows = rangeTo(2, 12); cols = rangeTo(1, cfg.max);
      cells = rows.map(function (t) {
        return cols.map(function (k) { return makeFact('/', t * k, t).key; });
      });
    } else {
      rows = []; cols = []; cells = [];
    }
    return { rows: rows, cols: cols, cells: cells };
  }

  function mastery(stat) {
    if (!stat) return 'new';
    var box = clampInt(stat.box, 0, 4, 0);
    if (box <= 0) return 'weak';
    if (box <= 2) return 'learning';
    return 'strong';
  }

  /* ---------------------------------------------------------------- *
   * Presets + API export
   * ---------------------------------------------------------------- */

  var PRESETS = {
    addsub: cloneCfgLiteral(DEFAULT_CFG),
    tables: (function () { var c = cloneCfgLiteral(DEFAULT_CFG); c.ops = ['x']; return c; })()
  };

  var api = {
    GLYPH: GLYPH, OPS: OPS, TABLES: TABLES, MAXES: MAXES, LENGTHS: LENGTHS,
    PENALTY_MS: PENALTY_MS, SPRINT_MS: SPRINT_MS, REVEAL_AFTER: REVEAL_AFTER,
    NEW_CAP: NEW_CAP, COACH_MIN_SEEN: COACH_MIN_SEEN, DEFAULT_CFG: DEFAULT_CFG, PRESETS: PRESETS,

    normalizeCfg: normalizeCfg, makeFact: makeFact, pool: pool, rng: rng,
    buildSet: buildSet, coachWeight: coachWeight, coachFocus: coachFocus,
    fastMs: fastMs, recordAnswer: recordAnswer,

    createRun: createRun, elapsed: elapsed, current: current, press: press,
    tick: tick, remaining: remaining, pause: pause, resume: resume,
    summarize: summarize, toSession: toSession,

    cfgKey: cfgKey, cfgLabel: cfgLabel, isBetter: isBetter,
    gridFor: gridFor, mastery: mastery
  };

  if (root) root.MathEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
