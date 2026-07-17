/* =====================================================================
 * COCKPIT v2 shared runtime - snapshot data, live overlay, fractal drill.
 * The mockups render from SNAP (a sanitized real-state snapshot, public-safe
 * names only) and then try to overlay live numbers from the v1 payloads
 * (../ops/*.json) when served same-origin. Failures are silent - the mock
 * must render anywhere (githack, Pages, file://-less scenario server).
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---- snapshot: the fractal, portfolio altitude down to missions ---- */
  var SNAP = {
    updated: '2026-07-11T03:05Z',
    posture: 'OPERATIONAL',
    needsMe: 5, running: 2, shipped24: 17,
    departments: [
      { id: 'eng', name: 'Engineering', status: 'ok', attention: 3, running: 1, wins: 15,
        projects: [
          { id: 'music', name: 'music', status: 'ok', attention: 3, running: 0, wins: 12, ver: 'v150',
            missions: [
              { id: 'ui-reconcile', name: 'S-UI-RECONCILE sweep', state: 'ok', tag: 'SHIPPED', meta: '5 PRs - #230-#234 - v146-v149', prog: 100,
                prs: ['#230 css tokens', '#231 studio spelling', '#232 library labels', '#233 song view speller', '#234 close-out'] },
              { id: 'setrm', name: 'S-SETRM-ARM delete grammar', state: 'ok', tag: 'SHIPPED', meta: '#235 - v150 - red-first scenario', prog: 100, prs: ['#235 arm-to-delete on setlist'] },
              { id: 'm13', name: 'M-13 song builder LZ', state: 'hold', tag: 'GATED', meta: 'awaits: go song-builder LZ', prog: 0, prs: [] },
              { id: 'eartest', name: 'Strum engine ear test', state: 'warn', tag: 'YOUR CALL', meta: 'PR #88 draft - listen + judge', prog: 60, prs: ['#88 Karplus-Strong strum'] }
            ] },
          { id: 'config', name: 'claude-config', status: 'ok', attention: 0, running: 0, wins: 3, ver: 'main',
            missions: [ { id: 'ce', name: 'CE rules + skills garden', state: 'run', tag: 'STEADY', meta: 'compound loop - always on', prog: 70, prs: [] } ] }
        ] },
      { id: 'ventures', name: 'Ventures', status: 'warn', attention: 1, running: 1, wins: 2,
        projects: [
          { id: 'aios', name: 'ai-os', status: 'warn', attention: 1, running: 1, wins: 2, ver: 'alpha',
            missions: [ { id: 'cockpit', name: 'Cockpit v2 tactical UI', state: 'run', tag: 'IN FLIGHT', meta: 'this mission - 3 angles + vision', prog: 55, prs: [] } ] },
          { id: 'betting', name: 'betting-platform', status: 'idle', attention: 0, running: 0, wins: 0, ver: 'sandbox', missions: [] }
        ] },
      { id: 'rnd', name: 'R&D', status: 'idle', attention: 1, running: 0, wins: 0,
        projects: [
          { id: 'req', name: 'req-workflow', status: 'idle', attention: 1, running: 0, wins: 0, ver: 'main',
            missions: [ { id: 'iv1', name: 'IV-1 spec sitting', state: 'hold', tag: 'INTERVIEW', meta: 'queued question set', prog: 0, prs: [] } ] }
        ] }
    ],
    queue: [
      { pri: 88, cls: 'p-top',  form: 'burst',     ask: 'TR-4: play Calluses on the live app - feel pass', meta: 'music - taste', act: 'OPEN' },
      { pri: 76, cls: 'p-high', form: 'digit',     ask: 'M-13 song builder: go / hold the landing zone', meta: 'music - direction', act: 'GO' },
      { pri: 70, cls: 'p-high', form: 'tap',       ask: 'Ear-test the strum engine (PR #88 preview)', meta: 'music - your call', act: 'PLAY' },
      { pri: 62, cls: '',       form: 'burst',     ask: 'Drag-reorder your progression - touch feel pass', meta: 'music - taste', act: 'OPEN' },
      { pri: 48, cls: '',       form: 'interview', ask: 'IV-1: 4 questions on the req workflow shape', meta: 'req - any subset unblocks', act: 'ANSWER' }
    ],
    feed: [
      '03:05Z merge #235 setlist arm-to-delete (v150)',
      '00:56Z report S-UI-RECONCILE swarm CLOSED - 5 PRs',
      '00:54Z merge #233 song view spells by key (v149)',
      '00:45Z merge #232 library labels (v148)'
    ],
    competency: [
      { skill: 'Chords', score: 72 }, { skill: 'Strumming', score: 58 },
      { skill: 'Theory', score: 66 }, { skill: 'Composition', score: 44 },
      { skill: 'Lyrics', score: 30 }
    ],
    gates: [
      { at: '03:35Z', name: 'idle watch tick' },
      { at: 'open', name: 'ear test #88' },
      { at: 'open', name: 'M-13 keyword gate' }
    ]
  };

  /* ---- live overlay: quietly upgrade numbers from the v1 payloads ---- */
  function overlay(done) {
    var pending = 2;
    function fin() { if (--pending === 0 && done) done(); }
    fetch('../ops/queues.json').then(function (r) { return r.json(); }).then(function (q) {
      try {
        var items = [];
        Object.keys(q.queues || {}).forEach(function (k) { (q.queues[k].items || []).forEach(function (it) { items.push(it); }); });
        if (items.length) SNAP.needsMe = items.length;
      } catch (e) { }
      fin();
    }).catch(fin);
    fetch('../ops/mission-events.jsonl').then(function (r) { return r.text(); }).then(function (t) {
      try {
        var lines = t.trim().split('\n').slice(-6).reverse();
        SNAP.feed = lines.map(function (l) {
          var e = JSON.parse(l);
          return (e.ts || '').slice(11, 16) + 'Z ' + e.type + ' ' + e.title;
        });
      } catch (e) { }
      fin();
    }).catch(fin);
  }

  /* ---- shared chrome ---- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Hub header grammar (operator taste pick 2026-07-11, from the workflows-hub
     Org OS panel he liked - label reads COCKPIT here per his direction):
     hamburger menu, round PS mark, "Problem Solutions" wordmark, LED + COCKPIT,
     Light/Dark toggle (persisted, data-theme beats the OS hint). Posture + sync
     move to a breadcrumb line under it - same signals, calmer bar. */
  var THEME_KEY = 'cockpit.theme.v1';
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; }
  }
  function themeLabel() {
    var t = currentTheme();
    if (t === 'light') return 'Dark';
    if (t === 'dark') return 'Light';
    var prefersLight = false;
    try { prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { }
    return prefersLight ? 'Dark' : 'Light';
  }
  function header(angle) {
    return '<div class="hdr">'
      + '<button class="hmenu" type="button" id="hMenu" aria-label="Menu">&#9776;</button>'
      + '<img class="logo" src="https://problemsolutions.github.io/logo-badge.svg" alt="" onerror="this.style.visibility=\'hidden\'">'
      + '<span class="word">Problem <b>Solutions</b></span>'
      + '<span class="cockpitTag"><span class="led ok"></span>COCKPIT</span>'
      + '<div class="spacer"></div>'
      + '<button class="themeBtn" type="button" id="hTheme">' + themeLabel() + '</button>'
      + '</div>'
      + '<div class="crumb"><span class="cA">Problem Solutions</span><span class="cB">/</span>'
      + '<span class="cB">' + esc(angle) + '</span><div class="spacer"></div>'
      + '<span class="badge op"><span class="led ok"></span>' + esc(SNAP.posture) + '</span>'
      + '<span class="sync">SYNC ' + esc(SNAP.updated.slice(11)) + '</span></div>';
  }
  function wireHeader() {
    applyTheme(currentTheme());
    var tb = document.getElementById('hTheme');
    if (tb) tb.onclick = function () {
      var next = themeLabel().toLowerCase();
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
      applyTheme(next); tb.textContent = themeLabel();
    };
    var hm = document.getElementById('hMenu');
    if (hm) hm.onclick = function () {
      drill('Problem Solutions / Cockpit', 'Angles',
        '<a class="strip run" href="angle-instruments.html" style="display:flex;text-decoration:none;color:inherit"><div class="sbody"><div class="sname">A - Instruments</div><div class="smeta">navigate by derived state</div></div></a>'
        + '<a class="strip run" href="angle-tempo.html" style="display:flex;text-decoration:none;color:inherit"><div class="sbody"><div class="sname">B - Tempo</div><div class="smeta">navigate by when</div></div></a>'
        + '<a class="strip run" href="angle-signal.html" style="display:flex;text-decoration:none;color:inherit"><div class="sbody"><div class="sname">C - Signal</div><div class="smeta">navigate by what needs you</div></div></a>'
        + '<a class="strip hold" href="index.html" style="display:flex;text-decoration:none;color:inherit"><div class="sbody"><div class="sname">Chooser + rationale</div></div></a>');
    };
  }

  function sigbar() {
    return '<div class="sigbar" id="sigbar">'
      + '<div class="sig needs"><span class="lbl">Needs you</span><span class="num" id="sigNeeds">' + SNAP.needsMe + '</span><span class="sub">top: ' + esc(SNAP.queue[0].ask.slice(0, 26)) + '...</span></div>'
      + '<div class="sig run"><span class="lbl">Running</span><span class="num">' + SNAP.running + '</span><span class="sub">autonomous</span></div>'
      + '<div class="sig ship"><span class="lbl">Shipped 24h</span><span class="num">' + SNAP.shipped24 + '</span><span class="sub">merged + live</span></div>'
      + '</div>';
  }

  function ticker() {
    return '<div class="ticker"><span class="lbl">Feed</span><span class="tk" id="tk">' + esc(SNAP.feed.join('   |   ')) + '</span></div>';
  }

  function queueCards(limit) {
    return SNAP.queue.slice(0, limit || SNAP.queue.length).map(function (q) {
      return '<div class="qcard ' + q.cls + '"><span class="pri"></span>'
        + '<div class="qbody"><div class="qask">' + esc(q.ask) + '</div>'
        + '<div class="qmeta">p' + q.pri + ' - ' + esc(q.meta) + '</div></div>'
        + '<span class="qform ' + q.form + '">' + q.form + '</span>'
        + '<button class="qgo" type="button">' + esc(q.act) + '</button></div>';
    }).join('');
  }

  /* ---- fractal drill: one altitude per screen (contract C7) ---- */
  function ensureDrill() {
    var d = document.getElementById('drill');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'drill'; d.className = 'drill';
    d.innerHTML = '<div class="dhdr"><button class="dback" type="button" aria-label="Back">&#8592;</button>'
      + '<div><div class="dpath" id="dpath"></div><div class="dtitle" id="dtitle"></div></div></div>'
      + '<div class="dbody" id="dbody"></div>';
    document.body.appendChild(d);
    d.querySelector('.dback').onclick = function () { d.classList.remove('open'); };
    return d;
  }
  function drill(path, title, html) {
    var d = ensureDrill();
    d.querySelector('#dpath').textContent = path;
    d.querySelector('#dtitle').textContent = title;
    d.querySelector('#dbody').innerHTML = html;
    d.classList.add('open');
    wireDrillContent(d.querySelector('#dbody'));
  }

  function missionStrip(m) {
    return '<div class="strip ' + m.state + '" data-mission="' + esc(m.id) + '"><span class="led ' + (m.state === 'hold' ? 'idle' : m.state) + '"></span>'
      + '<div class="sbody"><div class="sname">' + esc(m.name) + '</div><div class="smeta">' + esc(m.meta) + '</div>'
      + (m.prog ? '<div class="prog"><i style="width:' + m.prog + '%"></i></div>' : '') + '</div>'
      + '<span class="stag ' + m.state + '">' + esc(m.tag) + '</span></div>';
  }

  function projectDrillHtml(p) {
    var h = '<div class="lbl" style="margin:4px 0 8px">Missions - one tap deeper for PRs</div>';
    h += p.missions.length ? p.missions.map(missionStrip).join('') : '<div class="qmeta" style="color:var(--faint)">Quiet. Nothing needs you here.</div>';
    return h;
  }
  function missionDrillHtml(m) {
    var h = '<div class="lbl" style="margin:4px 0 8px">' + esc(m.tag) + ' - ' + esc(m.meta) + '</div>';
    h += (m.prs && m.prs.length)
      ? m.prs.map(function (pr) { return '<div class="strip ok"><span class="led ok"></span><div class="sbody"><div class="sname">' + esc(pr) + '</div></div></div>'; }).join('')
      : '<div class="qmeta" style="color:var(--faint)">No PRs yet - this mission is a gate.</div>';
    return h;
  }

  function findMission(id) {
    var out = null;
    SNAP.departments.forEach(function (d) { d.projects.forEach(function (p) { p.missions.forEach(function (m) { if (m.id === id) out = { m: m, p: p }; }); }); });
    return out;
  }
  function findProject(id) {
    var out = null;
    SNAP.departments.forEach(function (d) { d.projects.forEach(function (p) { if (p.id === id) out = { p: p, d: d }; }); });
    return out;
  }

  /* wire taps inside any container (page or drill body) */
  function wireDrillContent(root) {
    root.querySelectorAll('[data-project]').forEach(function (el) {
      el.onclick = function () {
        var f = findProject(el.getAttribute('data-project'));
        if (f) drill(f.d.name + ' / project', f.p.name + '  (' + f.p.ver + ')', projectDrillHtml(f.p));
      };
    });
    root.querySelectorAll('[data-mission]').forEach(function (el) {
      el.onclick = function () {
        var f = findMission(el.getAttribute('data-mission'));
        if (f) drill(f.p.name + ' / mission', f.m.name, missionDrillHtml(f.m));
      };
    });
  }

  global.Cockpit = { SNAP: SNAP, overlay: overlay, esc: esc, header: header, wireHeader: wireHeader, sigbar: sigbar, ticker: ticker, queueCards: queueCards, drill: drill, missionStrip: missionStrip, wire: wireDrillContent };
})(window);
