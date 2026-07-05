#!/usr/bin/env python3
"""
scripts/command-center-gen.py

Regenerates docs/artifacts/cc/payload-repo.json - the data payload for the
REPO COMMAND CENTER (the parent artifact above the per-mission HiTL panes),
scoped to THIS PUBLIC REPO ONLY.

SECURITY SCOPE (per docs/plans/vision-command-center-20260705.md, amended):
the portfolio/org meta-layer (operator's repo list + problemsolutions org
repos) is a SEPARATE, AAD-gated surface and is NOT built here. This
generator never queries org data, other repos, or anything private - every
field below is public data about this one repo, gathered via authenticated
`gh` (gh handles auth out-of-band; no token ever touches the payload). The
payload is plain JSON - no PIN/encryption needed at this scope.

Rerunnable: "refresh command center" = rerun this script, then commit the
regenerated docs/artifacts/cc/payload-repo.json.

Pipeline:
  gh CLI (commits, open PRs + CI, recent merges, Pages status)
  + urllib (live deployed sw.js CACHE version, read-only GET)
  + local repo scan (mission panes, vision docs, QUEUE.md horizons, test count)
  -> docs/artifacts/cc/payload-repo.json

Stdlib only, plus the `gh` binary (already required elsewhere in this repo's
toolchain - see rules/github-tool-selection.md).
"""

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
PLANS_DIR = REPO_ROOT / "docs" / "plans"
ARTIFACTS_DIR = REPO_ROOT / "docs" / "artifacts"
OUTPUT_PATH = ARTIFACTS_DIR / "cc" / "payload-repo.json"
TEST_DIR = REPO_ROOT / "test"
SW_PATH = REPO_ROOT / "music" / "sw.js"

OWNER = "nhruska"
REPO = "nhruska.github.io"
REPO_SLUG = f"{OWNER}/{REPO}"
REPO_URL = f"https://github.com/{REPO_SLUG}"
LIVE_SW_URL = "https://nhruska.github.io/music/sw.js"


def run_gh(args):
    """Run a `gh` CLI call, return stdout. Raises RuntimeError on non-zero exit."""
    result = subprocess.run(
        ["gh"] + args, capture_output=True, text=True, cwd=REPO_ROOT
    )
    if result.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def gh_json(args):
    return json.loads(run_gh(args))


def fetch_commits(limit=12):
    """HEAD + the last `limit` commits on the default branch (public data:
    sha, subject line, author date, commit URL)."""
    return gh_json(
        [
            "api",
            f"repos/{REPO_SLUG}/commits",
            "--jq",
            f'.[0:{limit}] | [.[] | {{sha: .sha, subject: (.commit.message | split("\\n")[0]), date: .commit.author.date, url: .html_url}}]',
        ]
    )


def ci_rollup_state(checks):
    if not checks:
        return "NONE"
    conclusions = [c.get("conclusion") for c in checks]
    statuses = [c.get("status") for c in checks]
    if any(c == "FAILURE" for c in conclusions):
        return "FAILURE"
    if any(s != "COMPLETED" for s in statuses):
        return "PENDING"
    if all(c == "SUCCESS" for c in conclusions):
        return "SUCCESS"
    return "MIXED"


def fetch_open_prs():
    prs = gh_json(
        [
            "pr",
            "list",
            "--state",
            "open",
            "--limit",
            "50",
            "--json",
            "number,title,headRefName,url,statusCheckRollup,isDraft",
        ]
    )
    out = []
    for pr in prs:
        checks = pr.get("statusCheckRollup") or []
        out.append(
            {
                "number": pr["number"],
                "title": pr["title"],
                "branch": pr["headRefName"],
                "url": pr["url"],
                "draft": pr.get("isDraft", False),
                "ciState": ci_rollup_state(checks),
                "checks": [
                    {
                        "name": c.get("name"),
                        "workflow": c.get("workflowName"),
                        "status": c.get("status"),
                        "conclusion": c.get("conclusion"),
                        "url": c.get("detailsUrl"),
                    }
                    for c in checks
                ],
            }
        )
    return out


def fetch_recent_merges(limit=15):
    return gh_json(
        [
            "pr",
            "list",
            "--state",
            "merged",
            "--limit",
            str(limit),
            "--json",
            "number,title,mergedAt,url",
        ]
    )


def fetch_pages_status():
    try:
        raw = gh_json(["api", f"repos/{REPO_SLUG}/pages"])
        return {
            "status": raw.get("status"),
            "htmlUrl": raw.get("html_url"),
            "sourceBranch": (raw.get("source") or {}).get("branch"),
            "buildType": raw.get("build_type"),
        }
    except RuntimeError as e:
        return {"status": "unknown", "error": str(e)}


def fetch_live_cache_version():
    try:
        with urllib.request.urlopen(LIVE_SW_URL, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        m = re.search(r"CACHE\s*=\s*'([^']+)'", body)
        return m.group(1) if m else None
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def local_cache_version():
    if not SW_PATH.exists():
        return None
    text = SW_PATH.read_text()
    m = re.search(r"CACHE\s*=\s*'([^']+)'", text)
    return m.group(1) if m else None


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def discover_mission_panes():
    """Any docs/artifacts/*.html (top level only) whose <title> contains
    'HiTL Mission Control' is a mission pane. Status is the literal cockpit
    .state span text (a content marker parsed from the pane, never guessed)."""
    panes = []
    for path in sorted(ARTIFACTS_DIR.glob("*.html")):
        text = path.read_text(errors="replace")
        title_m = re.search(r"<title>([^<]*)</title>", text)
        if not title_m or "HiTL Mission Control" not in title_m.group(1):
            continue
        h1_m = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.S)
        h1 = strip_tags(h1_m.group(1)).strip() if h1_m else path.stem
        state_m = re.search(r'class="state">(.*?)</div>', text, re.S)
        status = strip_tags(state_m.group(1)).strip() if state_m else "unknown"
        rel = path.relative_to(REPO_ROOT)
        panes.append(
            {
                "title": h1,
                "status": status,
                "file": str(rel),
                "sourceUrl": f"{REPO_URL}/blob/main/{rel}",
                "liveUrl": f"https://nhruska.github.io/{rel}",
            }
        )
    return panes


VISION_STATUS_MARKERS = [
    ("mission closed", "SHIPPED"),
    ("interview pending", "INTERVIEW PENDING"),
    ("captured", "CAPTURED"),
]


def discover_visions():
    """docs/plans/vision-*.md - captured but not yet promoted to a goal spec /
    mission pane. Status-guess is a literal substring match against the
    doc's own header block (content marker, never inferred from silence)."""
    out = []
    for path in sorted(PLANS_DIR.glob("vision-*.md")):
        text = path.read_text(errors="replace")
        title_m = re.search(r"^#\s*(.+)$", text, re.M)
        title = title_m.group(1).strip() if title_m else path.stem
        head_block = text[:800].lower()
        status = "CAPTURED"
        for marker, label in VISION_STATUS_MARKERS:
            if marker in head_block:
                status = label
                break
        rel = path.relative_to(REPO_ROOT)
        out.append(
            {
                "title": title,
                "file": str(rel),
                "sourceUrl": f"{REPO_URL}/blob/main/{rel}",
                "statusGuess": status,
            }
        )
    return out


def classify_horizon(header_line):
    h = header_line.strip().upper()
    for name in ("NOW", "SHORT", "MID", "LONG"):
        if h.startswith(name):
            return name
    return None


def parse_markdown_tables(body):
    """Every markdown table found in `body` contributes its rows as dicts
    keyed by that table's own header row - table-shape-agnostic since
    QUEUE.md's horizons mix differently-shaped tables."""
    rows = []
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        is_header = line.strip().startswith("|")
        is_sep = i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1])
        if is_header and is_sep:
            headers = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                row = {
                    headers[j]: (cells[j] if j < len(cells) else "")
                    for j in range(len(headers))
                }
                rows.append(row)
                i += 1
            continue
        i += 1
    return rows


def parse_queue():
    """Parses docs/plans/QUEUE.md's ## NOW / SHORT / MID / LONG sections into
    { horizon: [ {col: val, ...}, ... ] }."""
    path = PLANS_DIR / "QUEUE.md"
    if not path.exists():
        return {}
    text = path.read_text()
    sections = re.split(r"^##\s+", text, flags=re.M)[1:]
    horizons = {}
    for section in sections:
        header_line, _, body = section.partition("\n")
        horizon = classify_horizon(header_line)
        if not horizon:
            continue
        rows = parse_markdown_tables(body)
        horizons.setdefault(horizon, []).extend(rows)
    return horizons


def suite_shape():
    test_files = (
        sorted(p.name for p in TEST_DIR.glob("*.test.js")) if TEST_DIR.exists() else []
    )
    return {
        "testFileCount": len(test_files),
        "workflow": ".github/workflows/tests.yml",
        "runner": "node test/run-all.js",
    }


def ops_links():
    return {
        "actions": f"{REPO_URL}/actions",
        "pagesSettings": f"{REPO_URL}/settings/pages",
        "wikiIndex": f"{REPO_URL}/blob/main/music/engineering-wiki/index.md",
        "decisions": f"{REPO_URL}/blob/main/music/engineering-wiki/decisions.md",
        "uatLog": f"{REPO_URL}/blob/main/docs/plans/uat-walkthrough-20260704.md",
        "queueFile": f"{REPO_URL}/blob/main/docs/plans/QUEUE.md",
        "liveApp": "https://nhruska.github.io/music/play/",
        "portfolioRoot": "https://nhruska.github.io/",
    }


def main():
    commits = fetch_commits()
    head = commits[0] if commits else None
    open_prs = fetch_open_prs()
    recent_merges = fetch_recent_merges()
    pages = fetch_pages_status()
    live_cache = fetch_live_cache_version()
    local_cache = local_cache_version()
    missions = discover_mission_panes()
    visions = discover_visions()
    queue = parse_queue()
    suite = suite_shape()
    ops = ops_links()

    cache_match = (live_cache == local_cache) if (live_cache and local_cache) else None

    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repo": {
            "owner": OWNER,
            "name": REPO,
            "slug": REPO_SLUG,
            "url": REPO_URL,
            "defaultBranch": "main",
        },
        "head": head,
        "commits": commits,
        "openPRs": open_prs,
        "recentMerges": recent_merges,
        "deploy": {
            "pages": pages,
            "liveCacheVersion": live_cache,
            "localCacheVersion": local_cache,
            "cacheMatch": cache_match,
        },
        "missions": missions,
        "visions": visions,
        "queue": queue,
        "suite": suite,
        "ops": ops,
        "infra": {
            "note": "Static GitHub Pages site - no Azure CD envs; Pages + Actions are the whole deploy surface for this repo.",
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")

    print(f"wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    print(
        f"  head: {head['sha'][:7] if head else '?'} - {len(commits)} commits, "
        f"{len(open_prs)} open PRs, {len(recent_merges)} recent merges"
    )
    print(
        f"  deploy: pages={pages.get('status')} liveCache={live_cache} "
        f"localCache={local_cache} match={cache_match}"
    )
    print(f"  missions: {len(missions)} panes, {len(visions)} visions")
    print(f"  queue horizons: {list(queue.keys())}")
    print(f"  suite: {suite['testFileCount']} test files")


if __name__ == "__main__":
    sys.exit(main())
