#!/usr/bin/env python3
"""Capture BEFORE/AFTER gate evidence for one PR at the three sprint profiles.

Usage:
  python3 docs/uat/capture.py --pr 355 --side after --ref <sha> --spec spec.json

spec.json: {"url": "/music/play/", "seed": {k: v}, "steps": [js, ...],
            "assert": "js expression returning {ok: bool, detail: str}",
            "settleMs": 1200}

The ref is checked out into a throwaway git worktree and served on a free
local port (no outbound network needed), so BEFORE (main) and AFTER (head)
render from real trees. PNGs land in docs/uat/evidence/<pr>/<profile>-<side>.png
and a JSON result (assert + app console errors per profile) prints to stdout.
Console errors from blocked external fetches are ignored, as in
test/pw/run-scenario.py.
"""
import argparse, glob, json, os, re, shutil, socket, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PROFILES = {
    'pixel10-portrait': dict(viewport={'width': 392, 'height': 711}, device_scale_factor=2.75,
                             is_mobile=True, has_touch=True),
    'pixel10-landscape': dict(viewport={'width': 767, 'height': 368}, device_scale_factor=2.75,
                              is_mobile=True, has_touch=True),
    'desktop-1440': dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=1),
}
# A returning user who has seen every tour mark, cue and tip, so the shot shows
# the feature under test rather than first-run overlays. A spec's own seed wins.
_TIPS = ['guidanceask', 'firstrun', 'chordtap', 'tunefirst', 'savebasics', 'postprog',
         'studiofirst', 'whynote', 'composeintro', 'pulljam', 'transposetip', 'scaletip',
         'roman', 'diagrampref', 'backup']
BASE_SEED = {
    'music.welcomeDone.v1': '1',
    'music.offlineReadyCued.v1': '1',
    'music.guidanceLevel.v1': 'intermediate',
    'music.calloutsShown.v1': json.dumps({t: 1 for t in
                                          ['library', 'songs', 'jam', 'compose', 'tune', 'settings', 'perform', 'studio', 'triads']}),
    'music.notables.v1': json.dumps({t: 1 for t in _TIPS}),
}
IGNORE = re.compile(r'youtube|ytimg|googleapis|gstatic|fonts\.|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|'
                    r'net::|Failed to load resource|githack|favicon', re.I)


def chrome():
    c = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    return c[-1] if c else None


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pr', required=True)
    ap.add_argument('--side', choices=['before', 'after'], required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--spec', required=True)
    ap.add_argument('--profiles', default=','.join(PROFILES))
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    wt = tempfile.mkdtemp(prefix='uatwt-')
    subprocess.run(['git', '-C', ROOT, 'worktree', 'add', '--detach', wt, a.ref],
                   check=True, capture_output=True)
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
                           cwd=wt, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out_dir = os.path.join(ROOT, 'docs', 'uat', 'evidence', str(a.pr))
    os.makedirs(out_dir, exist_ok=True)
    results = {}
    try:
        time.sleep(0.6)
        with sync_playwright() as p:
            exe = chrome()
            br = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
            for name in a.profiles.split(','):
                ctx = br.new_context(**PROFILES[name])
                seed = {} if spec.get('firstRun') else dict(BASE_SEED)
                seed.update(spec.get('seed') or {})
                for k, v in seed.items():
                    ctx.add_init_script('try{localStorage.setItem(%s,%s)}catch(e){}'
                                        % (json.dumps(k), json.dumps(v)))
                pg = ctx.new_page()
                errs = []
                pg.on('pageerror', lambda e, errs=errs: errs.append('pageerror: ' + str(e)))
                pg.on('console', lambda m, errs=errs: errs.append(m.text)
                      if m.type == 'error' and not IGNORE.search(m.text) else None)
                pg.goto('http://127.0.0.1:%d%s' % (port, spec.get('url', '/music/play/')),
                        wait_until='domcontentloaded')
                pg.wait_for_timeout(spec.get('settleMs', 1200))
                step_err = None
                for js in spec.get('steps', []):
                    try:
                        pg.evaluate(js)
                    except Exception as e:  # recorded, not fatal: BEFORE may lack the feature
                        step_err = str(e).splitlines()[0]
                    pg.wait_for_timeout(spec.get('stepMs', 500))
                res = {'ok': None, 'detail': ''}
                if spec.get('assert'):
                    try:
                        res = pg.evaluate(spec['assert'])
                    except Exception as e:
                        res = {'ok': False, 'detail': 'assert threw: ' + str(e).splitlines()[0]}
                shot = os.path.join(out_dir, '%s-%s.png' % (name, a.side))
                pg.screenshot(path=shot)
                results[name] = {'assert': res, 'step_error': step_err, 'app_errors': errs,
                                 'png': os.path.relpath(shot, ROOT)}
                ctx.close()
            br.close()
    finally:
        srv.terminate()
        subprocess.run(['git', '-C', ROOT, 'worktree', 'remove', '--force', wt], capture_output=True)
        shutil.rmtree(wt, ignore_errors=True)
    print(json.dumps({'pr': a.pr, 'side': a.side, 'ref': a.ref, 'results': results}, indent=1))


if __name__ == '__main__':
    main()
