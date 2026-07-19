#!/usr/bin/env python3
"""
run-scenario.py - declarative Playwright scenario runner (pw-replay-style JSON).

The compound-engineering asset behind operator UAT: every supported usage flow is a
committed JSON scenario in test/pw/scenarios/, executable on demand:

    python3 test/pw/run-scenario.py test/pw/scenarios/solo-skip-mixolydian.json
    python3 test/pw/run-scenario.py --all          # every scenario, SEQUENTIALLY

Design constraints (music/CLAUDE.md):
  - ONE scenario per process, run sequentially - the dev box OOMs on parallel suites.
  - Self-contained: spawns its own http.server rooted at the repo root, fresh browser
    context per scenario (clean localStorage / service worker), kills the server after.
  - Chromium resolution: $PW_CHROME > /opt/pw-browsers/chromium-*/chrome-linux/chrome
    (Claude web container) > Playwright's own default (laptop shared install).
  - Console policy: pageerror is ALWAYS fatal; console.error is fatal unless it matches
    IGNORE_CONSOLE (external fetches blocked by the sandbox proxy - YouTube, fonts).

Step vocabulary (keep it small + declarative - add verbs here, not imperative code
in scenarios):
  goto {path}                          - navigate relative to base URL
  wait {ms}                            - settle time
  setOffline {on}                      - flip the browser context's network (true=offline;
                                         fetch() rejects + navigator.onLine false) - PWA tests
  tap {selector}                       - click first match
  tapText {text, scope?}               - click element whose exact trimmed text matches
  tapChord {name}                      - click the #buildGrid tile whose .chord-name == name
  waitFor {selector, state?}           - wait for attached+visible (default) / hidden
  assertVisible {selector}             - offsetParent-based + rendered
  assertHidden {selector}              - not rendered
  assertText {selector, contains}      - textContent contains
  assertChipOn {selector, text}        - among selector matches, the one with class "on"
                                         has exact text
  assertCount {selector, min}          - at least N matches
  assertInViewport {selector}          - element's box fully inside the viewport (no
                                         scroll needed to see it)
  evalAssert {js, label}               - escape hatch: JS expression must be truthy
  dragReorder {from, to, side?}        - pointer-drag from one element onto the
                                         before/after side of another (S-PROG-REORDER)
  screenshot {name}                    - PNG to test/pw/evidence/<scenario>/<name>.png
"""
import glob
import json
import os
import re
import socket
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EVIDENCE = os.path.join(REPO, 'test', 'pw', 'evidence')
IGNORE_CONSOLE = re.compile(
    r'ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED'
    r'|Failed to load resource|net::ERR_', re.I)


def chrome_path():
    if os.environ.get('PW_CHROME'):
        return os.environ['PW_CHROME']
    hits = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    return hits[-1] if hits else None  # None -> playwright default (laptop)


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def start_server(port):
    proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
        cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
            return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError('http.server failed to start')


def run(scenario_path, base_url=None):
    from playwright.sync_api import sync_playwright

    with open(scenario_path) as f:
        sc = json.load(f)
    name = sc.get('name') or os.path.splitext(os.path.basename(scenario_path))[0]
    evdir = os.path.join(EVIDENCE, name)
    os.makedirs(evdir, exist_ok=True)

    server = None
    if not base_url:
        port = free_port()
        server = start_server(port)
        base_url = 'http://127.0.0.1:%d' % port

    console_errors, page_errors = [], []
    failures = []
    try:
        with sync_playwright() as p:
            exe = chrome_path()
            browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
            vp = sc.get('viewport') or {'width': 412, 'height': 915}
            ctx = browser.new_context(viewport=vp)
            # S-WELCOME: every scenario runs in a FRESH context, which the app
            # reads as a brand-new device and greets with the first-run tour -
            # blocking every step behind an overlay. Scenarios model a RETURNING
            # user unless they opt in with "firstRun": true (the tour's own
            # scenario), so mark the tour done before any page script runs.
            if not sc.get('firstRun'):
                ctx.add_init_script(
                    "try{localStorage.setItem('music.welcomeDone.v1','1')}catch(e){}")
            # USDD: `persona` simulates a user skill level deterministically by
            # seeding the app's stores BEFORE any page script runs (beginner |
            # intermediate | advanced). A persona is a user who ANSWERED the
            # one-time ask, so seed BOTH halves of that state: the level value
            # AND the 'guidanceask' dismissal (choosing a level dismisses the
            # ask - see play/index.html renderGuidanceAsk). Level-gated UI (the
            # notables LEVELS table) then diverges per persona and is assertable.
            if sc.get('persona'):
                # Optional journey state: notables the persona has ALREADY
                # dismissed (the graded journey shows one tip at a time app-wide,
                # so e.g. the beginner Studio tip only surfaces after the welcome
                # card is closed - "dismissNotables": ["firstrun"] models a
                # beginner minutes into their first session).
                dismissed = {'guidanceask': 1}
                for cid in sc.get('dismissNotables', []):
                    dismissed[cid] = 1
                ctx.add_init_script(
                    "try{localStorage.setItem('music.guidanceLevel.v1',%s);"
                    "localStorage.setItem('music.notables.v1',%s)}catch(e){}"
                    % (json.dumps(sc['persona']), json.dumps(json.dumps(dismissed))))
            page = ctx.new_page()
            page.on('pageerror', lambda e: page_errors.append(str(e)))
            page.on('console', lambda m: console_errors.append(m.text)
                    if m.type == 'error' and not IGNORE_CONSOLE.search(m.text) else None)

            page.goto(base_url + sc.get('url', '/music/play/'), wait_until='domcontentloaded')
            page.wait_for_timeout(sc.get('settleMs', 900))

            for i, step in enumerate(sc['steps']):
                act = step['action']
                label = '%d:%s' % (i, act)
                try:
                    if act == 'goto':
                        page.goto(base_url + step['path'], wait_until='domcontentloaded')
                    elif act == 'wait':
                        page.wait_for_timeout(step['ms'])
                    elif act == 'setOffline':
                        # PWA offline testing: flips the CONTEXT's network (real
                        # request-level offline - fetch() rejects, navigator.onLine
                        # goes false). {"action":"setOffline","on":true|false}
                        ctx.set_offline(bool(step.get('on', True)))
                    elif act == 'tap':
                        page.locator(step['selector']).first.click(timeout=4000)
                    elif act == 'dragReorder':
                        # S-PROG-REORDER: pointer-drag `from` onto the far side
                        # of `to` (mouse pointerType -> movement-threshold lift,
                        # no long-press wait). Staged moves so pointermove fires.
                        src = page.locator(step['from']).first.bounding_box()
                        dst = page.locator(step['to']).first.bounding_box()
                        sx, sy = src['x'] + src['width'] / 2, src['y'] + src['height'] / 2
                        dx = dst['x'] + dst['width'] * (0.85 if step.get('side', 'after') == 'after' else 0.15)
                        dy = dst['y'] + dst['height'] / 2
                        page.mouse.move(sx, sy)
                        page.mouse.down()
                        for k in range(1, 7):
                            page.mouse.move(sx + (dx - sx) * k / 6, sy + (dy - sy) * k / 6)
                            page.wait_for_timeout(40)
                        page.mouse.up()
                    elif act == 'tapText':
                        scope = step.get('scope', 'body')
                        page.locator(scope).locator(
                            'button, [role=button], a, .chip, .chordSegBtn',
                            has_text=re.compile(r'^\s*%s\s*$' % re.escape(step['text']))
                        ).first.click(timeout=4000)
                    elif act == 'tapIfVisible':
                        # best-effort tap (one-time asks, optional banners) - never fails
                        try:
                            if step.get('text'):
                                loc = page.locator(step.get('scope', 'body')).locator(
                                    'button, [role=button], a',
                                    has_text=re.compile(r'^\s*%s\s*$' % re.escape(step['text']))).first
                            else:
                                loc = page.locator(step['selector']).first
                            if loc.is_visible():
                                loc.click(timeout=2000)
                                page.wait_for_timeout(250)
                        except Exception:
                            pass
                    elif act == 'tapChord':
                        # exact chord-name match anywhere in the compose palette (the
                        # In-key tiles live in .inKeyLead via KeyExplorer; the All view
                        # fills #buildGrid - search the compose screen, visible tiles only).
                        # S-CHORD-COLLAPSE: at the advanced persona the palettes render
                        # compact chips (.suggChip > .scName) instead of diagram tiles
                        # (.chord > .chord-name) - same one-tap add semantics, so this
                        # verb matches either token. The .prog filmstrip's own chips are
                        # excluded (a progression slot is not a palette tile).
                        ok = page.evaluate(
                            """(name) => {
                                 var grid = document.getElementById('s-compose') || document.body;
                                 var tiles = grid.querySelectorAll('.chord-name, .scName');
                                 for (var i = 0; i < tiles.length; i++) {
                                   if (tiles[i].closest('.prog')) continue;
                                   if (tiles[i].closest('#suggest')) continue;
                                   // Visible tiles only, as the verb's contract says: a
                                   // display:none ancestor (e.g. .keyOpen hiding the chord
                                   // list) zeroes offsetParent - skip, never DOM-click
                                   // through hidden/overlayed UI (V4 Medium finding).
                                   if (!tiles[i].offsetParent) continue;
                                   if (tiles[i].textContent.trim() === name) {
                                     var t = tiles[i].closest('.chord, .suggChip') || tiles[i].parentElement;
                                     t.click();
                                     return true;
                                   }
                                 }
                                 return 'chord not found: ' + name;
                               }""", step['name'])
                        if ok is not True:
                            raise AssertionError(str(ok))
                    elif act == 'waitFor':
                        state = step.get('state', 'visible')
                        # timeoutMs: cross-navigation waits (e.g. the welcome tour's
                        # finish reload) need to ride out a full app boot, which on a
                        # blocked-egress box includes a hanging external-font fetch
                        # (~12s) before `load` releases it. Default stays tight.
                        page.locator(step['selector']).first.wait_for(
                            state=state, timeout=step.get('timeoutMs', 6000))
                    elif act == 'assertVisible':
                        if not page.locator(step['selector']).first.is_visible():
                            raise AssertionError('%s not visible' % step['selector'])
                    elif act == 'assertHidden':
                        if page.locator(step['selector']).count() and \
                           page.locator(step['selector']).first.is_visible():
                            raise AssertionError('%s unexpectedly visible' % step['selector'])
                    elif act == 'assertText':
                        txt = page.locator(step['selector']).first.text_content() or ''
                        if step['contains'] not in txt:
                            raise AssertionError('%r not in %r' % (step['contains'], txt.strip()[:120]))
                    elif act == 'assertChipOn':
                        got = page.evaluate(
                            """(sel) => {
                                 var on = Array.from(document.querySelectorAll(sel))
                                   .filter(function (b) { return b.classList.contains('on'); });
                                 return on.map(function (b) { return b.textContent.trim(); });
                               }""", step['selector'])
                        if got != [step['text']]:
                            raise AssertionError('selected chip(s) %r, expected [%r]' % (got, step['text']))
                    elif act == 'assertCount':
                        n = page.locator(step['selector']).count()
                        if n < step['min']:
                            raise AssertionError('%s count %d < %d' % (step['selector'], n, step['min']))
                    elif act == 'assertInViewport':
                        ok = page.evaluate(
                            """(sel) => {
                                 var el = document.querySelector(sel);
                                 if (!el) return 'missing ' + sel;
                                 var r = el.getBoundingClientRect();
                                 var vh = window.innerHeight, vw = window.innerWidth;
                                 if (r.top < 0 || r.left < 0 || r.bottom > vh || r.right > vw)
                                   return 'out of viewport: ' + JSON.stringify(r);
                                 return true;
                               }""", step['selector'])
                        if ok is not True:
                            raise AssertionError(str(ok))
                    elif act == 'evalAssert':
                        ok = page.evaluate('() => (%s)' % step['js'])
                        if not ok:
                            raise AssertionError(step.get('label', step['js']))
                    elif act == 'screenshot':
                        page.screenshot(path=os.path.join(evdir, step['name'] + '.png'))
                    else:
                        raise AssertionError('unknown action %r' % act)
                except Exception as e:  # collect, snapshot, and stop - later steps depend on earlier
                    page.screenshot(path=os.path.join(evdir, 'FAIL-%s.png' % label.replace(':', '-')))
                    failures.append('%s [%s]: %s' % (label, json.dumps(step), e))
                    break
            browser.close()
    finally:
        if server:
            server.kill()

    if page_errors:
        failures.append('pageerror(s): ' + ' | '.join(page_errors[:5]))
    if console_errors:
        failures.append('console error(s): ' + ' | '.join(console_errors[:5]))

    if failures:
        print('FAIL %s' % name)
        for f in failures:
            print('  - ' + f)
        return 1
    print('PASS %s (%d steps, evidence: %s)' % (name, len(sc['steps']), os.path.relpath(evdir, REPO)))
    return 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    base = None
    for a in sys.argv[1:]:
        if a.startswith('--base-url='):
            base = a.split('=', 1)[1]
    if '--all' in sys.argv:
        paths = sorted(glob.glob(os.path.join(REPO, 'test', 'pw', 'scenarios', '*.json')))
        rc = 0
        for pth in paths:  # sequential by design - never parallel (OOM)
            rc |= run(pth, base)
        sys.exit(rc)
    if not args:
        print(__doc__)
        sys.exit(2)
    sys.exit(run(args[0], base))


if __name__ == '__main__':
    main()
