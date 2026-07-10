#!/usr/bin/env python3
"""
ops-emit.py - ONE command per mission milestone (Ops Deck acceptance A5).

Appends a single event to the Deck's append-only log
(docs/artifacts/ops/mission-events.jsonl). Commits/pushes are the v1
broadcast transport on GitHub Pages: the panel polls the same-origin file,
so `--push` makes the event visible on the glass within one poll (~15s
after Pages serves it). Any model tier can call this - it is stdlib-only,
zero-dependency, deliberately dumb.

Usage:
    python3 scripts/ops-emit.py <type> "<title>" [--mission m] [--detail d]
                                [--agent a] [--url u] [--push]

    <type>  start|phase|build|test|red|green|pr|merge|review|report|
            friction|queue|idle
    <title> short human line (what happened)

    --mission  mission slug (default: current git branch)
    --detail   one extra sentence of context
    --agent    emitting agent/lane (default: main). Parallel swarm agents
               pass their own name -> the panel renders them as lanes.
    --url      evidence link (PR, artifact, screenshot)
    --push     commit the log + push = the v1 broadcast

Examples:
    python3 scripts/ops-emit.py start "Ops Deck v1 build" --push
    python3 scripts/ops-emit.py green "persona-beginner-studio PASS" \
        --agent builder-2 --url https://github.com/nhruska/nhruska.github.io/pull/199
"""
import argparse
import json
import os
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(REPO, 'docs', 'artifacts', 'ops', 'mission-events.jsonl')
TYPES = ['start', 'phase', 'build', 'test', 'red', 'green', 'pr', 'merge',
         'review', 'report', 'friction', 'queue', 'idle']


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument('type', choices=TYPES)
    ap.add_argument('title')
    ap.add_argument('--mission')
    ap.add_argument('--detail')
    ap.add_argument('--agent', default='main')
    ap.add_argument('--url')
    ap.add_argument('--push', action='store_true')
    ap.add_argument('-h', '--help', action='store_true')
    try:
        a = ap.parse_args()
    except SystemExit:
        print(__doc__)
        raise
    if a.help:
        print(__doc__)
        sys.exit(0)

    mission = a.mission
    if not mission:
        try:
            mission = subprocess.check_output(
                ['git', 'branch', '--show-current'], cwd=REPO,
                text=True).strip() or 'main'
        except Exception:
            mission = 'main'

    ev = {'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
          'mission': mission, 'type': a.type, 'title': a.title,
          'agent': a.agent}
    if a.detail:
        ev['detail'] = a.detail
    if a.url:
        ev['url'] = a.url

    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, 'a') as f:
        f.write(json.dumps(ev) + '\n')
    print('emitted: %s' % json.dumps(ev))

    if a.push:
        rel = os.path.relpath(LOG, REPO)
        subprocess.check_call(['git', 'add', rel], cwd=REPO)
        subprocess.check_call(
            ['git', 'commit', '-m', 'ops: %s - %s' % (a.type, a.title[:60]),
             '--no-verify', '-q'], cwd=REPO)
        subprocess.check_call(['git', 'push', '-q'], cwd=REPO)
        print('pushed (broadcast live on next panel poll)')


if __name__ == '__main__':
    main()
