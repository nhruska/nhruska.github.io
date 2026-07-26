#!/usr/bin/env python3
# =====================================================================
# a11y-check.py - the accessibility gate this repo did not have.
#
# ux-philosophy/ui-primitives.md has flagged its own ARIA gap in prose since
# S-TOAST ("neither toast host currently sets role=status / aria-live=polite"),
# and nothing has ever enforced it. A documented gap with no check is a gap that
# stays open - so this is the check.
#
# Four assertions, all deterministic, all about whether a person using a screen
# reader or a keyboard can actually operate the app:
#
#   A1 accessible name   every actionable has one (text, aria-label,
#                        aria-labelledby, title, or an img alt inside it).
#                        An icon-only button with no name is announced as
#                        "button" and is unusable non-visually.
#   A2 live region       every transient-outcome host (toast) declares
#                        role=status or aria-live. Without it a screen-reader
#                        user gets NO announcement that the action happened.
#   A3 keyboard reach    nothing is click-wired without being keyboard-
#                        operable - a div/span carrying onclick and no
#                        tabindex/role=button can never be reached by Tab.
#   A4 image alt         every <img> has an alt attribute (empty alt is fine
#                        and means decorative; a MISSING one is not).
#
# BASELINE RATCHET (rules/machine-ssot-enforcement.md): this app predates the
# gate, so a hard linter would fail every subsequent PR and get disabled. The
# current violations are accepted once into scripts/a11y-baseline.json; a normal
# run fails only on violations NOT in it. The baseline can only shrink.
#
# Manual/pre-merge dev tool, same shape and rationale as layout-check.py: no CI
# browser runner in this repo, shared Python-Playwright venv, own throwaway
# server.
#
# Run:
#   source ~/.claude/.venv/bin/activate
#   python3 scripts/a11y-check.py                     # gate: fail on NEW only
#   python3 scripts/a11y-check.py --strict            # report ALL, non-gating
#   python3 scripts/a11y-check.py --update-baseline   # accept current (after review)
# =====================================================================
import argparse
import functools
import re
import http.server
import json
import os
import sys
import threading

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASELINE = os.path.join(os.path.dirname(__file__), 'a11y-baseline.json')

# Phone first - the review viewport. a11y failures are viewport-independent in
# practice, so one representative size keeps the run fast.
VIEWPORT = (412, 915)

ROUTES = [
    ('/music/play/', 'play'),
]


def start_server(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO_ROOT)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# One JS pass per page. Returns a flat list of {check, sel, detail} findings.
PROBE = r"""
() => {
  const out = [];

  // Only elements the user can actually see right now can be judged. A
  // zero-box element is not rendered - judging it produces the same bogus
  // finding for every hidden node (the trap render-verification-traps.md names).
  const visible = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // A stable-enough identifier for baselining: tag + id + first class + text.
  const key = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = el.classList.length ? '.' + el.classList[0] : '';
    const txt = (el.textContent || '').trim().slice(0, 24).replace(/\s+/g, ' ');
    return el.tagName.toLowerCase() + id + cls + (txt ? `[${txt}]` : '');
  };

  const accessibleName = el => {
    if ((el.getAttribute('aria-label') || '').trim()) return true;
    if ((el.getAttribute('aria-labelledby') || '').trim()) return true;
    if ((el.getAttribute('title') || '').trim()) return true;
    if ((el.textContent || '').trim()) return true;
    const img = el.querySelector('img[alt]');
    if (img && (img.getAttribute('alt') || '').trim()) return true;
    const svgTitle = el.querySelector('svg title');
    if (svgTitle && (svgTitle.textContent || '').trim()) return true;
    if (el.tagName === 'INPUT' && (el.getAttribute('placeholder') || '').trim()) return true;
    return false;
  };

  // A1 - actionables must be announceable. Selected by ROLE/behaviour, never a
  // hand-enumerated tag list (the C6 mistake).
  const actionable = Array.from(document.querySelectorAll(
    'button, a[href], [role="button"], [onclick], input, select, textarea, summary'
  )).filter(visible);
  for (const el of actionable) {
    if (el.tagName === 'INPUT' && ['hidden'].includes(el.type)) continue;
    if (!accessibleName(el)) out.push({check: 'A1', sel: key(el), detail: 'no accessible name'});
  }

  // A2 - transient-outcome hosts must announce themselves.
  for (const el of document.querySelectorAll('.toast, .composeToast, [data-toast]')) {
    const role = (el.getAttribute('role') || '').trim();
    const live = (el.getAttribute('aria-live') || '').trim();
    if (role !== 'status' && role !== 'alert' && !live) {
      out.push({check: 'A2', sel: key(el), detail: 'toast host declares neither role=status/alert nor aria-live'});
    }
  }

  // A3 - click-wired but unreachable by keyboard.
  for (const el of Array.from(document.querySelectorAll('[onclick]')).filter(visible)) {
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') continue;
    const ti = el.getAttribute('tabindex');
    const role = (el.getAttribute('role') || '').trim();
    if (ti === null && role !== 'button' && role !== 'link') {
      out.push({check: 'A3', sel: key(el), detail: 'onclick without tabindex or button/link role - unreachable by Tab'});
    }
  }

  // A4 - a MISSING alt is the defect; alt="" is a valid decorative marker.
  for (const el of document.querySelectorAll('img')) {
    if (!el.hasAttribute('alt')) out.push({check: 'A4', sel: key(el), detail: 'img has no alt attribute'});
  }

  return {
    findings: out,
    coverage: {
      A1: actionable.length,
      A2: document.querySelectorAll('.toast, .composeToast, [data-toast]').length,
      A3: Array.from(document.querySelectorAll('[onclick]')).filter(visible).length,
      A4: document.querySelectorAll('img').length,
    }
  };
}
"""


def collect(page, route_label):
    res = page.evaluate(PROBE)
    found = [f"{route_label} {f['check']} {f['sel']} - {f['detail']}" for f in res['findings']]
    return found, res['coverage']


# A toast HOST is an element whose class list contains one of these as an EXACT
# token. Not a substring match: `toastGo` is a button inside a toast and
# `toastAction` is a style modifier on a banner - flagging those is a gate that
# cries wolf. Not `\btoast\b` either: that never matches `composeToast`, and
# missing a host is the dead-selector failure this gate exists to catch.
HOST_CLASSES = {'toast', 'composeToast'}
CLASSNAME_RE = re.compile(r"""className\s*=\s*['"]([^'"]*)['"]""")


def check_toast_source():
    """A2s - the source-level half of A2.

    The toast host is created lazily at runtime (songbook.js builds the div on
    first use), so at page load there is no .toast in the DOM and the runtime A2
    check examines ZERO elements. A check that examines nothing is not a passing
    check - so the documented ARIA gap is asserted against the SOURCE too: any
    site that creates a toast host must set role= or aria-live on it.
    """
    findings = []
    examined = 0
    shared = os.path.join(REPO_ROOT, 'music', 'shared')
    for name in sorted(os.listdir(shared)):
        if not name.endswith('.js'):
            continue
        path = os.path.join(shared, name)
        lines = open(path, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            m = CLASSNAME_RE.search(line)
            if not m or not (set(m.group(1).split()) & HOST_CLASSES):
                continue
            window = '\n'.join(lines[max(0, i - 6):i + 7])
            # Only a CREATION site can be missing the attributes. A later
            # `host.className = 'composeToast ...'` restyle does not clear
            # role/aria-live set at creation, so flagging it is a false alarm -
            # and a gate that cries wolf stops being read.
            # Limitation, stated rather than hidden: a host created in one place
            # and classed >6 lines away is not seen. Coverage is printed every
            # run so that blindness is visible instead of silent.
            if 'createElement' not in window:
                continue
            examined += 1
            if 'role' not in window and 'aria-live' not in window:
                findings.append(
                    f"source A2s music/shared/{name}:{i + 1} - toast host created "
                    "without role=status/alert or aria-live nearby"
                )
    return findings, examined


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8137)
    ap.add_argument('--update-baseline', action='store_true',
                    help='accept the current findings as the new baseline (after review)')
    ap.add_argument('--strict', action='store_true',
                    help='ignore the baseline and report every finding (non-gating)')
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('playwright not installed in this interpreter - '
              'source ~/.claude/.venv/bin/activate first', file=sys.stderr)
        return 2

    httpd = start_server(args.port)
    base = f'http://127.0.0.1:{args.port}'
    findings = []
    coverage = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={'width': VIEWPORT[0], 'height': VIEWPORT[1]})
            page = ctx.new_page()
            for path, label in ROUTES:
                page.goto(base + path, wait_until='networkidle')
                page.wait_for_timeout(1200)
                found, cov = collect(page, label)
                findings.extend(found)
                for k, v in cov.items():
                    coverage[k] = coverage.get(k, 0) + v
            browser.close()
    finally:
        httpd.shutdown()

    src_findings, src_examined = check_toast_source()
    findings.extend(src_findings)
    coverage['A2s'] = src_examined
    findings = sorted(set(findings))

    # A check that examined nothing has not passed - it did not run. Say so
    # loudly rather than letting zero coverage read as a clean bill of health.
    print('coverage: ' + ', '.join(f'{k}={v}' for k, v in sorted(coverage.items())))
    inert = [k for k, v in coverage.items() if v == 0]
    if inert:
        print(f'WARN  {len(inert)} check(s) examined ZERO elements and therefore '
              f'asserted nothing: {", ".join(sorted(inert))}')

    if args.update_baseline:
        with open(BASELINE, 'w') as fh:
            json.dump({'violations': findings}, fh, indent=1)
            fh.write('\n')
        print(f'baseline updated: {len(findings)} accepted violation(s) -> {BASELINE}')
        return 0

    baseline = []
    if os.path.exists(BASELINE):
        with open(BASELINE) as fh:
            baseline = json.load(fh).get('violations', [])
    known = set(baseline)

    if args.strict:
        print(f'A-checks (--strict): {len(findings)} total, baseline ignored')
        for f in findings:
            print('  ' + f)
        return 0

    new = [f for f in findings if f not in known]
    fixed = [f for f in known if f not in set(findings)]

    if fixed:
        print(f'NOTE: {len(fixed)} baselined violation(s) no longer reproduce - '
              f're-run with --update-baseline to shrink the baseline:')
        for f in fixed:
            print('  - ' + f)

    if new:
        print(f'\nFAIL  {len(new)} NEW accessibility violation(s) '
              f'({len(findings)} total, {len(findings) - len(new)} baselined):\n')
        for f in new:
            print('  ' + f)
        return 1

    print(f'PASS  a11y gate: {len(findings)} total, {len(findings)} baselined, 0 new')
    return 0


if __name__ == '__main__':
    sys.exit(main())
