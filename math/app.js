/* =====================================================================
 * app.js - the Math app's UI controller.
 * ---------------------------------------------------------------------
 * Wires the DOM to two pure modules and owns nothing else:
 *   MathEngine (engine.js) - facts, sets, the run state machine, coach, scoring
 *   MathStore  (store.js)  - profiles, per-fact stats, sessions, prefs
 * Theme + accent come from Music's shared theme.js (Theme.effectiveTheme /
 * accentVars / PALETTE); the theme key is the site-wide `music.theme.v1`.
 *
 * Layers (workout, results, sheets) sit on a small history stack so the
 * Android back button closes the top layer instead of leaving the app; back
 * during a workout pauses it rather than throwing the round away.
 * ===================================================================== */
(function () {
  'use strict';
  var E = window.MathEngine, S = window.MathStore, T = window.Theme, K = window.MathSkills;
  var esc = window.Esc ? window.Esc.esc : function (s) { return String(s); };
  var THEME_KEY = 'music.theme.v1';
  var OP_NAME = { '+': 'Add', '-': 'Subtract', 'x': 'Multiply', '/': 'Divide' };
  var MODE_LABEL = { race: 'Race', sprint: 'Sprint 60s', practice: 'Practice' };
  var MODE_PURPOSE = {
    race: 'Race the clock. A wrong answer adds 3 seconds.',
    sprint: 'Answer as many as you can in 60 seconds.',
    practice: 'No clock. Take your time.'
  };

  function $(id) { return document.getElementById(id); }
  function memStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }
  var ls;
  try { ls = window.localStorage; ls.getItem('math.schema.v1'); } catch (e) { ls = memStorage(); }
  var store = S.create(ls);
  store.migrate();

  var state = {
    tab: 'path', progOp: null, focusSkill: null, lastGains: null, lvlNext: null, lvlQueue: [], pendingLvl: null, afterLvl: null,
    run: null, stats: null, pid: null, raf: 0,
    badShow: null, flashT: 0, quitting: false,
    lastSummary: null, lastCfg: null, lastMissed: null,
    formMode: null, formColor: null, formPreset: 'addsub', firstRun: false
  };

  /* ------------------------------------------------------------------
   * Theme + accent (the active player's color is the app accent)
   * ------------------------------------------------------------------ */
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function storedTheme() {
    try { var v = ls.getItem(THEME_KEY); if (v === 'light' || v === 'dark' || v === 'auto') return v; } catch (e) {}
    return 'auto';
  }
  function effTheme() { return T.effectiveTheme(storedTheme(), !!(mql && mql.matches)); }
  function swatchFor(hex) {
    var P = T.PALETTE;
    for (var i = 0; i < P.length; i++) if (P[i].a === hex) return P[i];
    return P[0];
  }
  function applyTheme() {
    var eff = effTheme(), root = document.documentElement;
    root.setAttribute('data-theme', eff);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', eff === 'light' ? '#eef1f4' : '#0d0f12');
    var p = store.getActive(), sw = swatchFor(p ? p.color : null);
    var vars = T.accentVars(eff, sw.a, sw.d, sw.p);
    for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) root.style.setProperty(k, vars[k]);
  }
  if (mql && mql.addEventListener) mql.addEventListener('change', function () { if (storedTheme() === 'auto') applyTheme(); });
  window.addEventListener('storage', function (e) { if (e.key === THEME_KEY) { applyTheme(); renderSettings(); } });

  /* ------------------------------------------------------------------
   * Feedback: sound + vibration (both optional, both off-able)
   * ------------------------------------------------------------------ */
  var actx = null;
  function prefs() { return store.getPrefs(); }
  function unlockAudio() {
    if (!prefs().sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!actx && AC) actx = new AC();
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function blip(freq, dur, type, vol, delay) {
    var t0 = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function feedback(kind) {
    var pf = prefs();
    if (pf.sound && actx) {
      try {
        if (kind === 'ok') blip(880, 0.08, 'sine', 0.07);
        else if (kind === 'bad') blip(185, 0.18, 'triangle', 0.12);
        else if (kind === 'done') { blip(523, 0.14, 'sine', 0.08); blip(659, 0.14, 'sine', 0.08, 0.1); blip(784, 0.22, 'sine', 0.08, 0.2); }
      } catch (e) { /* audio is garnish - never break the round */ }
    }
    buzz(kind);
  }
  // Haptic grammar (Android; iOS Safari has no vibrate API). One light tick per
  // key so a press is FELT, a short pulse for right, a double for wrong, a
  // rising pattern for the finish and a longer one for a mastered skill.
  var BUZZ = { tick: 8, ok: 22, bad: [40, 50, 40], done: [30, 60, 90], level: [60, 40, 60, 40, 160] };
  function buzz(kind) {
    if (!BUZZ[kind] || !prefs().haptics || !navigator.vibrate) return;
    try { navigator.vibrate(BUZZ[kind]); } catch (e) {}
  }

  /* ------------------------------------------------------------------
   * Toasts (Music's shared toast.js owns the timing; we own the paint)
   * ------------------------------------------------------------------ */
  var toastEl = $('toast');
  function toast(msg) {
    Toast.show(msg, {
      host: toastEl, duration: 1800,
      onShow: function (host, m) { host.textContent = m; host.classList.add('on'); },
      onHide: function (host) { host.classList.remove('on'); }
    });
  }
  function showUndo(msg, undoFn) {
    var el = document.createElement('div');
    el.className = 'toast withAct toastAction';
    el.setAttribute('role', 'status');
    var sp = document.createElement('span'); sp.textContent = msg;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'toastGo'; b.textContent = 'Undo';
    el.appendChild(sp); el.appendChild(b); document.body.appendChild(el);
    var h = Toast.showAction(msg, {
      host: el, duration: 5000,
      onShow: function (host, m, bar) { if (bar) host.appendChild(bar); requestAnimationFrame(function () { host.classList.add('on'); }); },
      onHide: function (host) { host.classList.remove('on'); setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 260); }
    });
    var used = false; // once: the toast stays tappable through its fade-out (review finding #3)
    b.addEventListener('click', function () { if (used) return; used = true; b.disabled = true; undoFn(); if (h) h.finish(); });
  }

  /* ------------------------------------------------------------------
   * Layer stack: history entries carry their depth, so one popstate path
   * closes whatever sits above the new depth (sheet, results, workout).
   * ------------------------------------------------------------------ */
  var stack = [];
  try { history.replaceState({ mathDepth: 0 }, ''); } catch (e) {}
  function pushLayer(name) {
    stack.push(name);
    try { history.pushState({ mathDepth: stack.length }, ''); } catch (e) {}
  }
  function backTo(depth) {
    var n = stack.length - depth;
    if (n <= 0) return;
    try { history.go(-n); } catch (e) { unwindTo(depth); }
  }
  function unwindTo(depth) {
    while (stack.length > depth) closeLayer(stack.pop());
  }
  window.addEventListener('popstate', function (e) {
    var d = e.state && typeof e.state.mathDepth === 'number' ? e.state.mathDepth : 0;
    if (d >= stack.length) return;
    // Back during the last answer's green hold: the round is already won, so
    // finish it (session + stats saved) and show results (review #2).
    if (stack[stack.length - 1] === 'run' && d === stack.length - 1 && state.okHold && state.okHold.done) {
      try { history.pushState({ mathDepth: stack.length }, ''); } catch (err) {}
      endOkHold();
      return;
    }
    // Back out of a live workout: pause it instead of discarding the round.
    if (!state.quitting && stack[stack.length - 1] === 'run' && d === stack.length - 1 && state.run && !state.run.done) {
      try { history.pushState({ mathDepth: stack.length }, ''); } catch (err) {}
      pauseRun();
      return;
    }
    unwindTo(d);
  });
  function closeLayer(name) {
    if (name === 'run') {
      stopLoop(); clearTimeout(state.okT); state.okHold = null; $('card').classList.remove('ok', 'bad');
      if (state.run) {
        saveStats();
        // A quit round still counts toward stars; celebrate what it mastered (review #13).
        var upd = K.updateEarned(store.getEarned(state.pid), state.stats, Date.now());
        store.saveEarned(state.pid, upd.earned);
        if (upd.mastered.length) state.pendingLvl = upd.mastered;
      }
      state.run = null; $('runLayer').hidden = true;
    }
    else if (name === 'results') { $('resLayer').hidden = true; }
    else if (name === 'levelup') {
      $('lvlLayer').hidden = true; state.lvlQueue = [];
      // After the unwind finishes: a layer pushed from inside unwindTo would be closed by it at once.
      if (state.afterLvl) { var go = state.afterLvl; state.afterLvl = null; setTimeout(go, 0); }
    }
    else if (name === 'pause') {
      $('pauseOv').hidden = true;
      if (!state.quitting && state.run && state.run.pausedAt != null) resumeRun();
    }
    else if (name === 'players') {
      $('playersOv').hidden = true;
      if (!store.getActive()) ensurePlayer();
      state.firstRun = false; state.formMode = null; // back/backdrop out of first run (review finding #7)
    }
    else if (name === 'settings') { $('setOv').hidden = true; }
    if (!stack.length) {
      state.quitting = false;
      renderAll(); // the Skills home shows what the round just earned (review #1)
      if (state.pendingLvl) { var ids = state.pendingLvl; state.pendingLvl = null; setTimeout(function () { showLevelUps(ids); }, 0); }
    }
  }

  /* ------------------------------------------------------------------
   * Players
   * ------------------------------------------------------------------ */
  function active() { return store.getActive(); }
  function cfg() {
    var p = active(), c = E.normalizeCfg(p && p.cfg ? p.cfg : E.DEFAULT_CFG);
    if (c.coach && !c.skill) c.tables = []; // Custom's Coach means every table; v1 profiles kept stale picks (review #14)
    return c;
  }
  function saveCfg(c) { var p = active(); if (p) store.updateProfile(p.id, { cfg: E.normalizeCfg(c) }); renderSetup(); }
  function nextColor() {
    var used = store.getProfiles().list.map(function (p) { return p.color; }), P = T.PALETTE;
    for (var i = 0; i < P.length; i++) if (used.indexOf(P[i].a) < 0) return P[i].a;
    return P[0].a;
  }
  // Storage can refuse writes (quota shared with Music, blocked storage). Keep
  // the app usable for this visit and say progress won't be kept (finding #6).
  function useMemoryStore() {
    var snapshot = store.getProfiles();
    ls = memStorage(); store = S.create(ls);
    snapshot.list.forEach(function (p) { store.addProfile(p); });
    toast('This device is not saving progress right now');
  }
  function addPlayer(fields) {
    var p = store.addProfile(fields);
    if (!store.getProfiles().list.some(function (x) { return x.id === p.id; })) { useMemoryStore(); p = store.addProfile(fields); }
    store.setActive(p.id);
    return p;
  }
  function ensurePlayer() {
    if (active()) return;
    addPlayer({ name: 'Player 1', color: nextColor(), cfg: E.PRESETS.addsub, start: 'add-10' });
    applyTheme(); renderAll();
  }

  function renderPlayerChip() {
    var p = active();
    $('playerName').textContent = p ? p.name : 'Player';
  }

  function renderPlayers() {
    var body = $('playersBody'), prof = store.getProfiles(), html = '';
    if (!state.formMode) {
      $('playersTitle').textContent = 'Players';
      prof.list.forEach(function (p) {
        var on = p.id === prof.active;
        html += '<button type="button" class="setAction mPRow' + (on ? ' on' : '') + '" data-pid="' + esc(p.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
          '<span class="mDot" data-dot="' + esc(p.color) + '" aria-hidden="true"></span><span class="mPName">' + esc(p.name) + '</span>' +
          (on ? '<span class="mPNow">Playing</span>' : '') + '</button>';
      });
      html += '<button type="button" class="setAction" data-act="add">Add a player</button>';
      var a = active();
      if (a) html += '<button type="button" class="setAction" data-act="edit">Edit ' + esc(a.name) + '</button>';
      body.innerHTML = html;
    } else {
      var editing = state.formMode === 'edit' ? active() : null;
      $('playersTitle').textContent = state.firstRun ? 'Who\'s playing?' : (editing ? 'Edit player' : 'New player');
      html += '<div class="mForm">';
      html += '<div class="sub">Name</div><input class="mInput" id="pfName" type="text" maxlength="20" autocomplete="off" placeholder="Name" value="' + esc(editing ? editing.name : '') + '">';
      html += '<div class="sub">Color</div><div class="mSwatches" role="radiogroup" aria-label="Color">';
      T.PALETTE.forEach(function (sw) {
        var on = sw.a === state.formColor;
        html += '<button type="button" class="sw' + (on ? ' on' : '') + '" data-color="' + sw.a + '" role="radio" aria-checked="' + on + '" aria-label="' + esc(sw.n) + '"></button>';
      });
      html += '</div>';
      if (!editing) {
        html += '<div class="sub">Start with</div><div class="modeSwitch mSeg" id="pfPreset" role="radiogroup" aria-label="Start with">' +
          segBtn('addsub', 'Add &amp; subtract', state.formPreset === 'addsub') + segBtn('tables', 'Times tables', state.formPreset === 'tables') + '</div>';
      }
      html += '<div class="mFormBtns"><button type="button" class="btn ghost" data-act="cancel">Cancel</button><button type="button" class="btn red" data-act="save">Save</button></div>';
      if (editing && prof.list.length > 1) html += '<button type="button" class="btn danger mDanger" data-act="delete">Delete ' + esc(editing.name) + '</button>';
      html += '</div>';
      body.innerHTML = html;
    }
    // color dots/swatches are data, set as custom properties (no style= in markup)
    Array.prototype.forEach.call(body.querySelectorAll('[data-dot]'), function (el) { el.style.setProperty('--dot', el.getAttribute('data-dot')); });
    Array.prototype.forEach.call(body.querySelectorAll('.sw[data-color]'), function (el) { el.style.setProperty('--sc', el.getAttribute('data-color')); });
  }
  function openPlayers(formMode) {
    state.formMode = formMode || null;
    if (formMode === 'add') { state.formColor = nextColor(); state.formPreset = 'addsub'; }
    if (formMode === 'edit') { var a = active(); state.formColor = a ? a.color : nextColor(); }
    renderPlayers();
    if ($('playersOv').hidden) { $('playersOv').hidden = false; pushLayer('players'); }
    if (formMode) setTimeout(function () { var n = $('pfName'); if (n && !n.value) n.focus(); }, 60);
  }
  $('playerBtn').addEventListener('click', function () { openPlayers(null); });
  $('playersClose').addEventListener('click', function () { backTo(stack.lastIndexOf('players')); });
  $('playersOv').addEventListener('click', function (e) {
    if (e.target === $('playersOv')) { backTo(stack.lastIndexOf('players')); return; }
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-pid')) {
      store.setActive(t.getAttribute('data-pid')); state.focusSkill = null; applyTheme(); renderAll();
      backTo(stack.lastIndexOf('players'));
      return;
    }
    if (t.hasAttribute('data-color')) { state.formColor = t.getAttribute('data-color'); var nm = $('pfName') ? $('pfName').value : ''; renderPlayers(); if ($('pfName')) $('pfName').value = nm; return; }
    if (t.hasAttribute('data-seg')) { state.formPreset = t.getAttribute('data-seg'); var nm2 = $('pfName') ? $('pfName').value : ''; renderPlayers(); if ($('pfName')) $('pfName').value = nm2; return; }
    var act = t.getAttribute('data-act');
    if (act === 'add') openPlayers('add');
    else if (act === 'edit') openPlayers('edit');
    else if (act === 'cancel') {
      if (state.firstRun) { ensurePlayer(); state.firstRun = false; backTo(stack.lastIndexOf('players')); }
      else { state.formMode = null; renderPlayers(); }
    }
    else if (act === 'save') savePlayerForm();
    else if (act === 'delete') {
      var victim = active(); if (!victim) return;
      var snap = store.removeProfile(victim.id);
      applyTheme(); renderAll(); state.formMode = null; renderPlayers();
      showUndo('Deleted ' + victim.name, function () { store.restoreProfile(snap); applyTheme(); renderAll(); if (!$('playersOv').hidden) renderPlayers(); });
    }
  });
  function savePlayerForm() {
    if (!state.formMode) return; // a double-tapped Save must not add a second player (review finding #8)
    var name = ($('pfName') ? $('pfName').value : '').trim();
    if (state.formMode === 'edit') {
      var a = active(); if (a) store.updateProfile(a.id, { name: name || a.name, color: state.formColor });
    } else {
      addPlayer({ name: name || ('Player ' + (store.getProfiles().list.length + 1)), color: state.formColor, cfg: E.PRESETS[state.formPreset] || E.DEFAULT_CFG,
        start: state.formPreset === 'tables' ? 'x-2-5-10' : 'add-10' });
    }
    state.firstRun = false; state.formMode = null;
    applyTheme(); renderAll();
    backTo(stack.lastIndexOf('players'));
  }
  $('playersOv').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'pfName') savePlayerForm(); });

  /* ------------------------------------------------------------------
   * Setup screen
   * ------------------------------------------------------------------ */
  function segBtn(val, label, on) {
    return '<button type="button" role="radio" aria-checked="' + !!on + '" class="' + (on ? 'on' : '') + '" data-seg="' + val + '">' + label + '</button>';
  }
  function has(c, op) { return c.ops.indexOf(op) >= 0; }
  function fmtS(ms) {
    var s = Math.max(0, ms) / 1000;
    if (s < 60) return s.toFixed(1) + 's';
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function fmtClock(ms) {
    var s = Math.ceil(Math.max(0, ms) / 1000);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function scoreText(sess) {
    if (!sess) return '';
    if (sess.mode === 'sprint') return sess.n + ' in 60s';
    if (sess.mode === 'practice') return sess.n + ' done';
    return fmtS(sess.totalMs);
  }

  function renderSetup() {
    var c = cfg(), p = active();
    var hasAdd = has(c, '+') || has(c, '-'), hasMul = has(c, 'x') || has(c, '/');
    $('opChips').innerHTML = E.OPS.map(function (op) {
      var on = has(c, op);
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-op="' + op + '" aria-pressed="' + on + '" aria-label="' + OP_NAME[op] + '">' + E.GLYPH[op] + '</button>';
    }).join('');
    $('addSec').hidden = !hasAdd;
    $('rangeSeg').innerHTML = segBtn('10', 'Up to 10', c.addRange === 10) + segBtn('20', 'Up to 20', c.addRange === 20);
    $('mulSec').hidden = !hasMul;
    var g = has(c, 'x') ? E.GLYPH.x : E.GLYPH['/'];
    $('tableChips').hidden = c.coach;
    $('tableChips').innerHTML = E.TABLES.map(function (t) {
      var on = c.tables.indexOf(t) >= 0;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-table="' + t + '" aria-pressed="' + on + '">' + g + t + '</button>';
    }).join('');
    $('maxSeg').innerHTML = E.MAXES.map(function (m) { return segBtn(String(m), 'to ' + m, c.max === m); }).join('');
    var ordered = !c.coach && c.tables.length === 1 && c.ops.length === 1 && hasMul;
    $('orderChip').hidden = !ordered;
    $('orderChip').classList.toggle('on', c.order === 'ordered');
    $('orderChip').setAttribute('aria-pressed', String(c.order === 'ordered'));

    var coach = $('coachChip');
    coach.classList.toggle('on', c.coach);
    coach.setAttribute('aria-pressed', String(c.coach));
    var sub = 'picks the facts you need most';
    if (c.coach && p) {
      var focus = E.coachFocus(c, store.getFacts(p.id), Date.now(), 3);
      sub = focus.length ? 'working on ' + focus.map(function (f) { return f.text; }).join(', ') : 'learns from every answer';
    }
    $('coachSub').textContent = sub;

    $('modeSeg').innerHTML = ['race', 'sprint', 'practice'].map(function (m) { return segBtn(m, MODE_LABEL[m], c.mode === m); }).join('');
    $('lenRow').hidden = c.mode === 'sprint';
    $('lenSeg').innerHTML = E.LENGTHS.map(function (n) { return segBtn(String(n), String(n), c.length === n); }).join('');

    var best = p && c.mode !== 'practice' ? store.best(p.id, E.cfgKey(c), c.mode, E.isBetter) : null;
    $('startSub').textContent = best ? 'Best ' + scoreText(best) : '';
    if (state.tab === 'setup') $('purpose').textContent = MODE_PURPOSE[c.mode];
    renderPlayerChip();
  }

  $('scrSetup').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var c = cfg();
    if (t.hasAttribute('data-op')) {
      var op = t.getAttribute('data-op'), i = c.ops.indexOf(op);
      if (i >= 0) { if (c.ops.length === 1) { toast('Keep at least one'); return; } c.ops.splice(i, 1); }
      else c.ops.push(op);
      saveCfg(c); return;
    }
    if (t.hasAttribute('data-table')) {
      var tb = +t.getAttribute('data-table'), j = c.tables.indexOf(tb);
      if (j >= 0) c.tables.splice(j, 1); else c.tables.push(tb);
      saveCfg(c); return;
    }
    if (t.id === 'orderChip') { c.order = c.order === 'ordered' ? 'random' : 'ordered'; saveCfg(c); return; }
    // Coach in Custom draws from every table to max (tables are its scope, v1.1).
    if (t.closest('#coachChip')) { c.coach = !c.coach; if (c.coach) c.tables = []; saveCfg(c); return; }
    var seg = t.getAttribute('data-seg'); if (seg == null) return;
    var box = t.parentNode.id;
    if (box === 'rangeSeg') c.addRange = +seg;
    else if (box === 'maxSeg') c.max = +seg;
    else if (box === 'modeSeg') c.mode = seg;
    else if (box === 'lenSeg') c.length = +seg;
    saveCfg(c);
  });

  /* ------------------------------------------------------------------
   * Workout
   * ------------------------------------------------------------------ */
  function saveStats() { if (state.pid && state.stats) store.saveFacts(state.pid, state.stats); }
  function startRun(c, facts) {
    var p = active(); if (!p) { ensurePlayer(); p = active(); }
    if (!p) { toast('Could not start - add a player first'); return; }
    // Start keeps keyboard focus under the run layer; an Enter typed after an
    // answer would click it again and restart the round (review finding #2).
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    unlockAudio();
    var now = Date.now();
    state.pid = p.id;
    state.stats = store.getFacts(p.id);
    if (!facts) {
      var rng = E.rng(now >>> 0);
      facts = E.buildSet(c, state.stats, rng, c.mode === 'sprint' ? 200 : c.length, now);
    }
    state.run = E.createRun(c, facts, now);
    state.badShow = null; state.quitting = false;
    $('resLayer').hidden = true;
    $('runLayer').hidden = false;
    if (stack[stack.length - 1] === 'results') stack[stack.length - 1] = 'run';
    else pushLayer('run');
    renderRun();
    startLoop();
  }
  $('startBtn').addEventListener('click', function () { startRun(cfg()); });

  function startLoop() {
    stopLoop();
    var frame = function () {
      if (!state.run || state.run.done || state.run.pausedAt != null) return;
      var now = Date.now();
      if (state.run.cfg.mode === 'sprint') {
        var t = E.tick(state.run, now); state.run = t.run;
        if (t.event === 'done') { finishRun(now); return; }
      }
      renderClock(now);
      state.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  }
  function stopLoop() { if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; }

  function renderClock(now) {
    var r = state.run; if (!r) return;
    var mode = r.cfg.mode, clock = $('clock'), fill = $('barFill');
    if (mode === 'sprint') {
      var rem = E.remaining(r, now);
      clock.textContent = fmtClock(rem);
      fill.style.width = (rem / E.SPRINT_MS * 100) + '%';
      $('runCount').textContent = r.results.length + ' done';
    } else {
      clock.textContent = mode === 'race' ? fmtS(E.elapsed(r, now) + r.penaltyMs) : '';
      fill.style.width = (r.idx / r.facts.length * 100) + '%';
      $('runCount').textContent = Math.min(r.idx + 1, r.facts.length) + ' of ' + r.facts.length;
    }
  }
  function renderRun() {
    var r = state.run; if (!r) return;
    var f = E.current(r), ans = $('answer'), now = Date.now(), h = state.okHold;
    $('problem').textContent = h ? h.text : (f ? f.text : '');
    ans.className = 'mAnswer';
    if (h) { ans.textContent = h.typed; ans.classList.add('good'); $('hint').textContent = ''; renderClock(now); return; }
    if (r.input) { ans.textContent = r.input; ans.classList.add('typed'); }
    else if (state.badShow && state.badShow.until > now) { ans.textContent = state.badShow.text; ans.classList.add('bad'); }
    else if (r.reveal && f) { ans.textContent = String(f.answer); ans.classList.add('ghost'); }
    else ans.textContent = '?';
    var hint = '';
    if (f && r.reveal) hint = 'It\'s ' + f.answer + '. Type it to keep going.';
    else if (r.wrongs > 0) hint = 'Not quite. Try again.';
    $('hint').textContent = hint;
    renderClock(now);
  }
  function flashCard(cls) {
    var card = $('card');
    card.classList.remove('ok', 'bad');
    void card.offsetWidth; // restart the shake animation on repeat misses
    card.classList.add(cls);
    clearTimeout(state.flashT);
    state.flashT = setTimeout(function () { card.classList.remove('ok', 'bad'); renderRun(); }, cls === 'bad' ? 380 : 200);
  }
  function flashPenalty() {
    var el = $('penaltyFlash');
    el.textContent = '+' + (E.PENALTY_MS / 1000) + 's';
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('on'); }, 900);
  }
  // Right answer: the player's own digits turn green on the problem they just
  // solved for OK_HOLD_MS, with the clock PAUSED so the confirmation is free.
  // Keys during the hold are ignored (they would belong to a problem not yet
  // shown). Operator UAT 2026-09-25: "color highlights on my input".
  var OK_HOLD_MS = 260;
  function hitKey(k) {
    var el = document.querySelector('#keypad [data-k="' + k + '"]'); if (!el) return;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    clearTimeout(el._hitT);
    el._hitT = setTimeout(function () { el.classList.remove('hit'); }, 170);
  }
  function holdCorrect(fact, typed, now, done) {
    state.okHold = { text: fact ? fact.text : '', typed: typed, done: done, at: now };
    if (!done) { state.run = E.pause(state.run, now); stopLoop(); }
    clearTimeout(state.flashT); // a wrong answer's pending flash would strip the glow mid-hold (review #11)
    var card = $('card'); card.classList.remove('bad'); card.classList.add('ok');
    renderRun();
    clearTimeout(state.okT);
    state.okT = setTimeout(endOkHold, OK_HOLD_MS);
  }
  function endOkHold() {
    var h = state.okHold; if (!h) return;
    state.okHold = null; clearTimeout(state.okT);
    $('card').classList.remove('ok');
    if (h.done) { finishRun(h.at); return; }
    if (state.run && state.run.pausedAt != null) { state.run = E.resume(state.run, Date.now()); startLoop(); }
    renderRun();
  }
  function onKey(k) {
    var r0 = state.run;
    if (!r0 || r0.done || r0.pausedAt != null) return;
    var now = Date.now(), typed = r0.input + k, shown = E.current(r0);
    hitKey(k); buzz('tick');
    var out = E.press(r0, k, now);
    state.run = out.run;
    if (out.event === 'correct' || out.event === 'done') {
      var res = out.run.results[out.run.results.length - 1];
      state.stats = E.recordAnswer(state.stats, res, now, r0.startedAt); // one streak step per fact per workout (review #4)
      feedback('ok');
      holdCorrect(shown, typed, now, out.event === 'done');
      return;
    } else if (out.event === 'wrong') {
      state.badShow = { text: typed, until: now + 380 };
      feedback('bad'); flashCard('bad');
      if (out.run.cfg.mode !== 'practice') flashPenalty();
    }
    renderRun();
  }
  $('keypad').addEventListener('click', function (e) {
    var t = e.target.closest('[data-k]'); if (t) onKey(t.getAttribute('data-k'));
  });
  document.addEventListener('keydown', function (e) {
    if ($('runLayer').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (/^[0-9]$/.test(k)) { onKey(k); e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); } // answers auto-submit; never activate a covered button
    else if (k === 'Backspace') { onKey('back'); e.preventDefault(); }
    else if (k === 'Delete' || k === 'c' || k === 'C') { onKey('clear'); e.preventDefault(); }
    else if (k === 'Escape' && $('pauseOv').hidden) { pauseRun(); e.preventDefault(); }
  });

  function pauseRun() {
    if (state.okHold) endOkHold(); // never strand a paused-for-feedback clock
    if (!state.run || state.run.done || state.run.pausedAt != null) return;
    state.run = E.pause(state.run, Date.now());
    stopLoop();
    saveStats(); // a backgrounded app can be killed; keep what was learned (review finding #4)
    $('pauseNote').textContent = state.run.cfg.mode === 'practice' ? 'Take a break. Your place is saved.' : 'The clock is stopped.';
    $('pauseOv').hidden = false;
    pushLayer('pause');
  }
  function resumeRun() {
    if (!state.run || state.run.pausedAt == null) return;
    state.run = E.resume(state.run, Date.now());
    renderRun(); startLoop();
  }
  $('pauseBtn').addEventListener('click', pauseRun);
  $('resumeBtn').addEventListener('click', function () { backTo(stack.lastIndexOf('pause')); });
  $('quitBtn').addEventListener('click', function () { state.quitting = true; backTo(stack.lastIndexOf('run')); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pauseRun(); });
  window.addEventListener('pagehide', function () { if (state.run && !state.run.done) saveStats(); });

  /* ------------------------------------------------------------------
   * Results
   * ------------------------------------------------------------------ */
  function finishRun(now) {
    stopLoop();
    var r = state.run, c = r.cfg, sum = E.summarize(r, now);
    saveStats();
    var sess = E.toSession(c, sum, now);
    var saved = store.addSession(state.pid, sess, E.isBetter) || { isBest: false, prevBest: null };
    state.lastSummary = sum; state.lastCfg = c; state.lastMissed = sum.missed;
    // Skills: stars only ever rise; a newly mastered skill gets its moment.
    var upd = K.updateEarned(store.getEarned(state.pid), state.stats, now);
    store.saveEarned(state.pid, upd.earned);
    state.lastGains = upd;
    feedback('done');
    renderResults(sum, sess, saved, c);
    $('runLayer').hidden = true;
    $('resLayer').hidden = false;
    if (stack[stack.length - 1] === 'run') stack[stack.length - 1] = 'results';
    state.run = null;
    if (upd.mastered.length) showLevelUps(upd.mastered);
  }
  function starsHtml(n, big) {
    var h = '<span class="mStars' + (big ? ' big' : '') + '" role="img" aria-label="' + n + ' of 3 stars">';
    for (var i = 0; i < 3; i++) h += '<span' + (i < n ? ' class="on"' : '') + '>&#9733;</span>';
    return h + '</span>';
  }
  function showLevelUp(id) {
    var sk = K.skillById(id); if (!sk) return;
    var p = active(), pth = K.path(store.getFacts(p.id), store.getEarned(p.id)), next = nextSkillFor(p, pth);
    state.lvlNext = next && next !== id ? next : null;
    $('lvlBadge').textContent = sk.short;
    $('lvlName').textContent = sk.name;
    var nk = state.lvlNext ? K.skillById(state.lvlNext) : null;
    $('lvlNext').textContent = nk ? 'Up next: ' + nk.name : 'Every skill on the path is mastered!';
    $('lvlGo').hidden = !nk;
    $('lvlGo').textContent = nk ? 'Start ' + nk.name : '';
    $('lvlLayer').hidden = false;
    buzz('level');
  }
  // Every skill a round mastered gets its own moment, on its own layer, so
  // Back closes the celebration and leaves results underneath (review #12, #13).
  function showLevelUps(ids) {
    if (!ids || !ids.length) return;
    state.lvlQueue = ids.slice(1);
    showLevelUp(ids[0]);
    if (stack[stack.length - 1] !== 'levelup') pushLayer('levelup');
  }
  $('lvlDone').addEventListener('click', function () {
    if (state.lvlQueue && state.lvlQueue.length) { showLevelUp(state.lvlQueue.shift()); return; }
    backTo(stack.lastIndexOf('levelup'));
  });
  $('lvlGo').addEventListener('click', function () {
    var next = state.lvlNext; if (!next) return;
    state.afterLvl = function () { state.focusSkill = next; startSkill(next, 'race'); };
    backTo(stack.lastIndexOf('levelup'));
  });
  function renderResults(sum, sess, saved, c) {
    var msg;
    if (c.mode !== 'practice' && saved.isBest && saved.prevBest) msg = 'New best!';
    else if (c.mode !== 'practice' && saved.isBest) msg = 'First score on the board!';
    else if (sum.misses === 0 && sum.n > 0) msg = 'Perfect round!';
    else if (c.mode === 'sprint') msg = 'Time!';
    else msg = 'Nice work!';
    $('resMsg').textContent = msg;
    $('resBig').textContent = c.mode === 'race' ? fmtS(sum.totalMs) : (c.mode === 'sprint' ? String(sum.n) : sum.n + ' done');
    var bestLine = '';
    if (c.mode === 'sprint') bestLine = 'answered in 60 seconds';
    if (c.mode !== 'practice' && saved.prevBest && !saved.isBest) bestLine += (bestLine ? '. ' : '') + 'Your best: ' + scoreText(saved.prevBest);
    else if (saved.isBest && saved.prevBest) bestLine += (bestLine ? '. ' : '') + 'Beat ' + scoreText(saved.prevBest);
    $('resBest').textContent = bestLine;
    var tiles = [
      [sum.correct + '/' + sum.n, 'First try'],
      [String(sum.misses), 'Missed'],
      c.mode === 'practice' ? [fmtS(sum.elapsedMs), 'Time'] : ['+' + Math.round(sum.penaltyMs / 1000) + 's', 'Penalty']
    ];
    $('resTiles').innerHTML = tiles.map(function (t) { return '<div class="mTile"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>'; }).join('');
    var facts = '', seen = {};
    sum.missed.forEach(function (f) { seen[f.key] = 1; facts += '<span class="mFact miss">' + esc(f.text + ' = ' + f.answer) + '</span>'; });
    sum.slowest.forEach(function (res) { if (!seen[res.fact.key]) { seen[res.fact.key] = 1; facts += '<span class="mFact">' + esc(res.fact.text + ' = ' + res.fact.answer) + '</span>'; } });
    $('resFacts').innerHTML = facts;
    $('resFocusTitle').hidden = !facts;
    $('resFocusTitle').textContent = sum.missed.length ? 'Practice these' : 'Your slowest';
    $('drillBtn').hidden = !sum.missed.length;
    var g = state.lastGains, line = '';
    if (g && g.gains.length) {
      line = g.gains.map(function (x) { var sk = K.skillById(x.id); return sk ? starsHtml(x.to) + ' ' + esc(sk.name) : ''; }).filter(Boolean).join('<br>');
    }
    $('resStars').innerHTML = line;
    $('resStars').hidden = !line;
  }
  $('againBtn').addEventListener('click', function () {
    var lc = state.lastCfg;
    if (lc && lc.skill) startSkill(lc.skill, lc.mode); // a skill's Race or Practice, never Custom (review #3)
    else startRun(cfg());
  });
  $('drillBtn').addEventListener('click', function () {
    var missed = state.lastMissed || []; if (!missed.length) return;
    var rng = E.rng(Date.now() >>> 0), again = missed.slice();
    for (var i = again.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), x = again[i]; again[i] = again[j]; again[j] = x; }
    var facts = missed.concat(again);
    for (var k = 1; k < facts.length; k++) {
      if (facts[k].key === facts[k - 1].key && k + 1 < facts.length) { var y = facts[k]; facts[k] = facts[k + 1]; facts[k + 1] = y; }
    }
    var c = E.normalizeCfg(state.lastCfg || cfg()); c.mode = 'practice'; c.coach = false;
    startRun(c, facts);
  });
  $('doneBtn').addEventListener('click', function () { backTo(stack.lastIndexOf('results')); });

  /* ------------------------------------------------------------------
   * Skill path (home). All skills open; the path only suggests (v1.1).
   * Stars shown = max(earned, today's progress); earned never goes down.
   * ------------------------------------------------------------------ */
  var BAND_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  function nextSkillFor(p, pth) {
    var start = p && p.start ? K.FRAMEWORK.skills.map(function (sk) { return sk.id; }).indexOf(p.start) : -1;
    for (var i = Math.max(0, start); i < pth.skills.length; i++) if (pth.skills[i].stars < 3) return pth.skills[i].skill.id;
    return pth.upNext;
  }
  function startSkill(id, mode) {
    var sk = K.skillById(id), p = active(); if (!sk || !p) return;
    var pth = K.path(store.getFacts(p.id), store.getEarned(p.id));
    // Levels gate depth, not access: a beginner's race is 10 questions, 20 after.
    var len = pth.band === 'beginner' ? 10 : 20;
    startRun(K.skillCfg(sk, { mode: mode, length: len }));
  }
  function renderPath() {
    var p = active(); if (!p) return;
    var pth = K.path(store.getFacts(p.id), store.getEarned(p.id));
    var nextId = nextSkillFor(p, pth);
    var focusId = state.focusSkill || nextId || K.FRAMEWORK.skills[K.FRAMEWORK.skills.length - 1].id;
    var row = null;
    pth.skills.forEach(function (r) { if (r.skill.id === focusId) row = r; });
    $('bandLine').textContent = p.name + ': ' + BAND_LABEL[pth.band] + ', ' + pth.masteredCount + ' of ' + pth.skills.length + ' skills mastered';
    var tag = !nextId ? 'Every skill mastered' : (focusId === nextId ? 'Up next' : 'Practicing');
    var pr = row.progress;
    var h = '<div class="mNextTag">' + esc(tag) + '</div>' +
      '<div class="mNextHead"><span class="mBadge' + (row.stars === 3 ? ' earned' : '') + '" aria-hidden="true">' + esc(row.skill.short) + '</span>' +
      '<div class="mNextTxt"><h2 class="mNextName">' + esc(row.skill.name) + '</h2><p class="mNextDesc">' + esc(row.skill.desc) + '</p></div></div>' +
      starsHtml(row.stars, true) +
      '<div class="mMeter" role="progressbar" aria-label="Skill level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pr.level + '"><div class="mMeterFill" data-w="' + pr.level + '"></div></div>' +
      '<p class="mNextStat">' + pr.right + ' of ' + pr.total + ' facts right first try' + (pr.medianMs ? ', about ' + (pr.medianMs / 1000).toFixed(1) + 's each' : '') + '</p>' +
      '<div class="mNextBtns"><button type="button" class="btn red" data-go="race">Race</button><button type="button" class="btn" data-go="practice">Practice</button></div>';
    $('nextCard').innerHTML = h;
    $('nextCard').setAttribute('data-skill', row.skill.id);
    var list = '';
    pth.skills.forEach(function (r) {
      var on = r.skill.id === focusId, cls = 'setAction mSkill' + (on ? ' on' : '') + (r.stars === 3 ? ' done' : '');
      list += '<button type="button" class="' + cls + '" data-skill="' + esc(r.skill.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
        '<span class="mBadge sm' + (r.stars === 3 ? ' earned' : '') + '" aria-hidden="true">' + esc(r.skill.short) + '</span>' +
        '<span class="mSkName">' + esc(r.skill.name) + (r.skill.id === nextId ? '<span class="mTag">NEXT</span>' : '') + '</span>' +
        starsHtml(r.stars) + '</button>';
    });
    $('pathList').innerHTML = list;
    Array.prototype.forEach.call(document.querySelectorAll('#nextCard .mMeterFill'), function (el) { el.style.setProperty('--w', el.getAttribute('data-w') + '%'); });
    if (state.tab === 'path') $('purpose').textContent = 'Pick up where you left off';
    renderPlayerChip();
  }
  $('scrPath').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-go')) { startSkill($('nextCard').getAttribute('data-skill'), t.getAttribute('data-go')); return; }
    if (t.hasAttribute('data-skill')) { state.focusSkill = t.getAttribute('data-skill'); renderPath(); $('view').scrollTop = 0; }
  });

  /* ------------------------------------------------------------------
   * Progress
   * ------------------------------------------------------------------ */
  var GRID_AXES = {
    '+': ['Addition', 'Rows and columns are the two numbers.'],
    '-': ['Subtraction', 'Rows: the number taken away. Columns: the answer.'],
    'x': ['Times tables', 'Rows: the table. Columns: times.'],
    '/': ['Division', 'Rows: divide by. Columns: the answer.']
  };
  var MASTERY_LABEL = { 'new': 'New', weak: 'Needs work', learning: 'Learning', strong: 'Got it' };
  function parseKey(key) { var p = key.split(':'); return E.makeFact(p[0], +p[1], +p[2]); }
  function renderProgress() {
    var p = active(); if (!p) return;
    var c = cfg(), stats = store.getFacts(p.id);
    var op = state.progOp || c.ops[0];
    $('progOpSeg').innerHTML = E.OPS.map(function (o) { return segBtn(o, E.GLYPH[o], o === op); }).join('');
    Array.prototype.forEach.call($('progOpSeg').children, function (b) { b.setAttribute('aria-label', GRID_AXES[b.getAttribute('data-seg')][0]); });

    var g = E.gridFor(op, E.normalizeCfg({ ops: [op], addRange: 20, max: 12 }));
    var counts = { 'new': 0, weak: 0, learning: 0, strong: 0 }, seenKey = {};
    var html = '<div class="mGrid" id="grid" role="group">';
    html += '<div class="mHd"></div>';
    g.cols.forEach(function (cl) { html += '<div class="mHd">' + cl + '</div>'; });
    g.rows.forEach(function (rw, ri) {
      html += '<div class="mHd">' + rw + '</div>';
      g.cells[ri].forEach(function (key) {
        if (!key) { html += '<div class="mCell na"></div>'; return; }
        var m = E.mastery(stats[key]);
        if (!seenKey[key]) { seenKey[key] = 1; counts[m]++; }
        html += '<div class="mCell ' + m + '" data-key="' + esc(key) + '"></div>';
      });
    });
    html += '</div>';
    $('gridWrap').innerHTML = html;
    var grid = $('grid');
    grid.style.setProperty('--cols', g.cols.length);
    var total = counts['new'] + counts.weak + counts.learning + counts.strong;
    grid.setAttribute('aria-label', GRID_AXES[op][0] + ' fact map: ' + counts.strong + ' got it, ' + counts.learning + ' learning, ' + counts.weak + ' need work, ' + counts['new'] + ' new');
    $('gridTitle').innerHTML = '<span>' + GRID_AXES[op][0] + '</span><span>' + counts.strong + ' of ' + total + ' got it</span>';
    $('gridCaption').textContent = GRID_AXES[op][1];
    $('legend').innerHTML = ['new', 'weak', 'learning', 'strong'].map(function (m) {
      return '<span class="mLg"><i class="mCell ' + m + '" aria-hidden="true"></i>' + MASTERY_LABEL[m] + '</span>';
    }).join('');
    $('gridReadout').textContent = 'Tap a square to see that fact.';

    renderTrend(p, c);
    renderRecent(p);
    renderBadges(p);
  }
  function renderBadges(p) {
    var pth = K.path(store.getFacts(p.id), store.getEarned(p.id)), earned = store.getEarned(p.id), html = '';
    pth.skills.forEach(function (r) {
      var e = earned[r.skill.id], got = r.stars === 3, when = '';
      if (got && e && e.masteredAt) when = new Date(e.masteredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      html += '<div class="mBadgeCell' + (got ? ' earned' : '') + '" role="img" aria-label="' + esc(r.skill.name + (got ? ', badge earned' : ', ' + r.stars + ' of 3 stars')) + '">' +
        '<span class="mBadge' + (got ? ' earned' : '') + '">' + esc(r.skill.short) + '</span>' +
        '<span class="mBadgeName">' + esc(r.skill.name) + '</span>' +
        (got ? '<span class="mBadgeWhen">' + esc(when || 'Mastered') + '</span>' : starsHtml(r.stars)) + '</div>';
    });
    $('badges').innerHTML = html;
    $('badgeCount').textContent = pth.masteredCount + ' of ' + pth.skills.length;
  }
  $('gridWrap').addEventListener('click', function (e) {
    var cell = e.target.closest('[data-key]'); if (!cell) return;
    var prev = $('gridWrap').querySelector('.mCell.sel'); if (prev) prev.classList.remove('sel');
    cell.classList.add('sel');
    var key = cell.getAttribute('data-key'), f = parseKey(key), p = active();
    var st = p ? store.getFacts(p.id)[key] : null;
    var txt = f.text + ' = ' + f.answer + ': ';
    if (!st || !st.n) txt += 'not tried yet';
    else txt += 'asked ' + st.n + (st.n === 1 ? ' time' : ' times') + ', missed ' + st.miss + ', about ' + (st.ms / 1000).toFixed(1) + 's';
    $('gridReadout').textContent = txt;
  });
  $('progOpSeg').addEventListener('click', function (e) {
    var t = e.target.closest('[data-seg]'); if (!t) return;
    state.progOp = t.getAttribute('data-seg'); renderProgress();
  });

  function renderTrend(p, c) {
    var rc = E.normalizeCfg(c); rc.mode = 'race'; rc.coach = c.coach;
    var key = E.cfgKey(rc);
    $('trendTitle').textContent = 'Race times: ' + E.cfgLabel(rc);
    var pts = store.getSessions(p.id).filter(function (s) { return s.cfgKey === key && s.mode === 'race'; }).slice(-20);
    var box = $('trend');
    if (pts.length < 2) { box.innerHTML = '<p class="mEmpty">Finish two races with this setup to see your trend.</p>'; return; }
    var W = 320, H = 118, L = 8, R = 62, TP = 14, B = 14;
    var vals = pts.map(function (s) { return s.totalMs; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1000) { hi += 500; lo -= 500; }
    var bi = vals.indexOf(lo);
    function x(i) { return L + (W - L - R) * (pts.length === 1 ? 0 : i / (pts.length - 1)); }
    function y(v) { return TP + (H - TP - B) * (v - lo) / (hi - lo); }
    var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Race times over your last ' + pts.length + ' races, best ' + fmtS(lo) + ', latest ' + fmtS(vals[vals.length - 1]) + '">';
    s += '<line class="ax" x1="' + L + '" y1="' + (H - B + 4) + '" x2="' + (W - R) + '" y2="' + (H - B + 4) + '"/>';
    s += '<path class="ln" d="' + d + '"/>';
    vals.forEach(function (v, i) {
      s += '<circle class="pt' + (i === bi ? ' best' : '') + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4.5"><title>' + fmtS(v) + '</title></circle>';
    });
    var li = vals.length - 1;
    s += '<text class="tl" x="' + (x(li) + 9).toFixed(1) + '" y="' + (y(vals[li]) + 4).toFixed(1) + '">' + fmtS(vals[li]) + '</text>';
    if (bi !== li) s += '<text class="tl dim" x="' + (W - R + 9) + '" y="' + (y(lo) + 4 < 12 ? 12 : y(lo) + 4).toFixed(1) + '">best ' + fmtS(lo) + '</text>';
    s += '</svg>';
    box.innerHTML = s;
  }
  function renderRecent(p) {
    var list = store.getSessions(p.id).slice(-8).reverse(), html = '', bestTs = {};
    list.forEach(function (s) {
      var k = s.cfgKey + '|' + s.mode;
      if (bestTs[k] === undefined) { var b = s.mode === 'practice' ? null : store.best(p.id, s.cfgKey, s.mode, E.isBetter); bestTs[k] = b ? b.ts : null; }
      var when = new Date(s.ts), today = new Date();
      var ds = when.toDateString() === today.toDateString() ? 'Today' : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      ds += ' ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      html += '<div class="mRec"><div class="l"><span class="t">' + esc(s.label) + '</span><span class="d">' + esc(MODE_LABEL[s.mode] + ', ' + ds) + '</span></div>' +
        '<div class="v">' + esc(scoreText(s)) + (bestTs[k] === s.ts ? '<span class="mTag">BEST</span>' : '') + '</div></div>';
    });
    $('recent').innerHTML = html || '<p class="mEmpty">No workouts yet. Your finished rounds show up here.</p>';
  }

  /* ------------------------------------------------------------------
   * Settings
   * ------------------------------------------------------------------ */
  function renderSettings() {
    var th = storedTheme();
    Array.prototype.forEach.call($('themeSeg').querySelectorAll('.thSeg'), function (b) {
      var on = b.getAttribute('data-theme') === th;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('role', 'radio');
    });
    var pf = prefs();
    $('soundChip').classList.toggle('on', !!pf.sound); $('soundChip').setAttribute('aria-pressed', String(!!pf.sound));
    $('hapticChip').classList.toggle('on', !!pf.haptics); $('hapticChip').setAttribute('aria-pressed', String(!!pf.haptics));
    var a = active();
    $('resetBtn').textContent = 'Reset ' + (a ? a.name : 'player') + '\'s progress';
    $('buildMeta').textContent = 'Build ' + (window.MATH_VERSION || 'dev');
  }
  $('settingsBtn').addEventListener('click', function () { renderSettings(); $('setOv').hidden = false; pushLayer('settings'); });
  $('setClose').addEventListener('click', function () { backTo(stack.lastIndexOf('settings')); });
  $('setOv').addEventListener('click', function (e) {
    if (e.target === $('setOv')) { backTo(stack.lastIndexOf('settings')); return; }
    var t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('thSeg')) {
      try { ls.setItem(THEME_KEY, t.getAttribute('data-theme')); } catch (err) {}
      applyTheme(); renderSettings(); return;
    }
    if (t.id === 'soundChip') { store.setPrefs({ sound: !prefs().sound }); renderSettings(); unlockAudio(); return; }
    if (t.id === 'hapticChip') { store.setPrefs({ haptics: !prefs().haptics }); renderSettings(); return; }
    if (t.id === 'exportBtn') { exportSkills(); return; }
    if (t.id === 'importBtn') { $('importFile').click(); return; }
    if (t.id === 'resetBtn') {
      var a = active(); if (!a) return;
      var snap = store.resetProgress(a.id);
      renderAll();
      showUndo('Cleared ' + a.name + '\'s progress', function () { store.restoreProgress(a.id, snap); renderAll(); });
    }
  });

  // Portable profile (Music's skill-competency-profile/v1 shape) carrying the
  // raw fact stats, so moving to another device keeps a player's progress.
  function exportSkills() {
    var p = active(); if (!p) return;
    var doc = K.exportProfile(p.name, store.getFacts(p.id), store.getEarned(p.id), Date.now());
    try {
      var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = 'math-skills-' + p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + d.toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
      toast('Skills profile saved');
    } catch (e) { toast('Could not export on this browser'); }
  }
  $('importFile').addEventListener('change', function () {
    var f = this.files && this.files[0], input = this; if (!f) return;
    var p = active(); if (!p) return;
    var rd = new FileReader();
    rd.onload = function () {
      var prevFacts = store.getFacts(p.id), prevEarned = store.getEarned(p.id);
      var r = K.importProfile(String(rd.result || ''), prevFacts, prevEarned);
      input.value = '';
      if (!r.ok) { toast(r.error || 'That file is not a Math skills profile'); return; }
      // Stars the imported facts already earn are banked quietly, so a later
      // round never celebrates a skill it did not play.
      var earned = K.updateEarned(r.earned, r.stats, Date.now()).earned;
      function restore() { store.saveFacts(p.id, prevFacts); store.saveEarned(p.id, prevEarned); renderAll(); }
      if (!store.saveFacts(p.id, r.stats) || !store.saveEarned(p.id, earned)) {
        restore(); toast('Could not save the import on this device'); return; // review #6
      }
      renderAll();
      // Undo, and say whose skills they were: a sibling's file is an easy mis-tap (review #5).
      var whose = r.player && r.player !== p.name ? r.player + '\'s skills' : 'Skills';
      showUndo(whose + ' imported into ' + p.name, function () { restore(); toast('Import undone'); });
    };
    rd.onerror = function () { toast('Could not read that file'); input.value = ''; };
    rd.readAsText(f);
  });

  /* ------------------------------------------------------------------
   * Tabs + boot
   * ------------------------------------------------------------------ */
  function setTab(tab) {
    state.tab = tab;
    $('scrPath').classList.toggle('on', tab === 'path');
    $('scrSetup').classList.toggle('on', tab === 'setup');
    $('scrProgress').classList.toggle('on', tab === 'progress');
    $('app').classList.toggle('noStart', tab !== 'setup'); // the Start bar belongs to Custom only
    Array.prototype.forEach.call($('tabbar').querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (tab === 'progress') { $('purpose').textContent = 'How each fact is going'; renderProgress(); }
    else if (tab === 'path') renderPath();
    else renderSetup();
    $('view').scrollTop = 0;
  }
  $('tabbar').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.getAttribute('data-tab')); });

  function renderAll() {
    renderPlayerChip();
    if (state.tab === 'progress') renderProgress();
    else if (state.tab === 'path') renderPath();
    else renderSetup();
  }

  applyTheme();
  setTab(state.tab); // the same path a tab tap takes, so boot can't disagree with it
  if (!store.getProfiles().list.length) { state.firstRun = true; openPlayers('add'); }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
})();
