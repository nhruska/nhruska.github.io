#!/usr/bin/env python3
"""Stamp the build version onto every local asset URL in the HTML entry points.

WHY THIS EXISTS (operator UAT 2026-09-03, the mixed-build bug)
--------------------------------------------------------------
The operator's phone showed v342-10's markup styled by v342-9's CSS, with the
build stamp reading v342-9. Not a stale cache in the ordinary sense - a
FRANKENSTEIN build: new index.html, old songbook.css/js.

Root cause: every asset was referenced by a bare, unversioned path
(`../shared/songbook.css`). HTTP caches - githack's CDN, the browser's own -
key on URL. index.html revalidates; a URL that never changes never does. So
bumping sw.js CACHE did nothing for them: the service worker is network-first
and was never the culprit.

The deepest part: build-stamp.js is ITSELF one of those assets, so the stamp -
the repo's documented handle for "which build am I on" - reported the OLD
version while newer HTML was already running. The version oracle lied, which
is why several UAT rounds this session were spent judging builds that were not
the build under test.

The fix is to make the URL change when the build changes. One SSOT (VERSION in
shared/build-stamp.js) drives a `?v=` query on every local asset tag, so a new
index.html can NEVER pair with an old asset: different URL, forced fetch.

Run it after bumping the CACHE/VERSION pair:
    python3 scripts/stamp-asset-versions.py           # rewrite in place
    python3 scripts/stamp-asset-versions.py --check    # gate: exit 1 on drift

The --check mode is the gate (machine-ssot-enforcement: ship the linter with
the tokens). It is wired into scripts/check-cache-bump.sh and
test/asset-version-lint.test.js.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The HTML entry points that script-tag shared assets. music/index.html has
# none (the launcher is self-contained) - it is listed so a future asset tag
# added there is covered rather than silently unversioned.
HTML = [
    'music/play/index.html',
    'music/play/triad-inversions.html',
    'music/index.html',
]

STAMP = 'music/shared/build-stamp.js'

# A local asset reference in an href/src: a relative path (never absolute, never
# a scheme) ending in .css or .js, with an optional existing ?v= to replace.
# The path itself is captured so the rewrite cannot alter anything but the query.
ASSET = re.compile(r'((?:href|src)=")((?:\.\./|\./)?(?:shared|play)/[A-Za-z0-9._/-]+\.(?:css|js))(\?v=[A-Za-z0-9._-]*)?(")')


def read(rel):
    with open(os.path.join(ROOT, rel), 'r', encoding='utf-8') as f:
        return f.read()


def version():
    m = re.search(r"var VERSION = '([^']+)'", read(STAMP))
    if not m:
        sys.exit('stamp-asset-versions: could not read VERSION from ' + STAMP)
    return m.group(1)


def main():
    check = '--check' in sys.argv
    ver = version()
    drift = []
    changed = []
    for rel in HTML:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        src = read(rel)
        want = r'\1\2?v=' + ver + r'\4'
        out = ASSET.sub(want, src)
        n = len(ASSET.findall(src))
        if out != src:
            if check:
                # Report WHICH tags disagree, not just that some do - a count
                # alone sends the next reader back to grep for it.
                for m in ASSET.finditer(src):
                    got = (m.group(3) or '')[3:]
                    if got != ver:
                        drift.append('%s: %s has ?v=%s, want %s'
                                     % (rel, m.group(2), got or '(none)', ver))
            else:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(out)
                changed.append('%s (%d asset tags)' % (rel, n))
        elif not check and n:
            changed.append('%s (%d asset tags, already current)' % (rel, n))

    if check:
        if drift:
            print('stamp-asset-versions: FAIL - %d asset URL(s) disagree with VERSION %s'
                  % (len(drift), ver))
            for d in drift[:20]:
                print('  ' + d)
            print('  fix: python3 scripts/stamp-asset-versions.py')
            return 1
        print('stamp-asset-versions: OK - every local asset URL carries ?v=%s' % ver)
        return 0

    print('stamp-asset-versions: stamped ?v=%s' % ver)
    for c in changed:
        print('  ' + c)
    return 0


if __name__ == '__main__':
    sys.exit(main())
