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

Built on the vendored panelkit SSOT (scripts/panelkit.py, vendored from
claude-config skills/control-panel via its vendor-sync.sh; drift check:
scripts/vendor-check.py) for gh_json, the canonical CI-status vocabulary,
and the snapshot envelope. This retires this script's independently-
reinvented run_gh/gh_json pair and its UPPERCASE CI enum (SUCCESS/FAILURE/
PENDING/MIXED/NONE) - `ciState` now carries panelkit's canonical
green/red/pending/unknown, the exact vocabulary unification panelkit was
extracted to enforce (docs/artifacts/cc/repo.html updated in the same
pass; it is the payload's only consumer). The `gh pr list` fetchers keep
their cc-payload key shape (number/mergedAt/url) rather than adopting
panelkit's REST fetchers whose keys differ (n/created_at) - the key-style
knob is an upstreaming ask recorded in workflows-hub's org-ops ledger.

Snapshot envelope (additive): top-level {generator, source_repo,
freshness_seconds_at_render (always null at generation - render-time
field), status, warnings}. Degradations that used to be silent or fatal
now demote status: a failed PR-list fetch, an unknown Pages status, or an
unavailable test-case count each append a warning and mark the payload
partial; a failed commits fetch (the payload's spine) exits 1 WITHOUT
writing so the last-good payload on disk is never clobbered.
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
sys.path.insert(0, str(SCRIPT_DIR))
import panelkit  # noqa: E402  (vendored SSOT - see scripts/vendor-check.py)

REPO_ROOT = SCRIPT_DIR.parent

# Version stamping introduced with the panelkit adoption (2026-07-05).
# 0.3.0 = above-the-fold contract pass (additive lastCiRun field; viewer
# reordered to the contract - see workflows-hub
# docs/company-control-panel-vision.md "The above-the-fold contract").
# 0.4.0 = position 1b velocity (interview ruling): merged count via one
# search-API call, LOC from THIS local clone (git log --numstat, shallow-
# guarded), typical-merge median from recentMerges createdAt (additive).
GEN_VERSION = "0.4.0"

VELOCITY_WINDOW_DAYS = 7
VELOCITY_WEEKS = 4
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


def fetch_commits(limit=12):
    """HEAD + the last `limit` commits on the default branch (public data:
    sha, subject line, author date, commit URL). Returns None on fetch
    failure - the caller treats that as fatal (the payload's spine)."""
    result = panelkit.gh_json(
        "api",
        f"repos/{REPO_SLUG}/commits",
        "--jq",
        f'.[0:{limit}] | [.[] | {{sha: .sha, subject: (.commit.message | split("\\n")[0]), date: .commit.author.date, url: .html_url}}]',
    )
    return result if isinstance(result, list) else None


def fetch_open_prs(envelope):
    # -R keeps the call cwd-independent (the retired run_gh pinned cwd to
    # REPO_ROOT; panelkit.gh_json deliberately does not set a cwd).
    prs = panelkit.gh_json(
        "pr", "list", "-R", REPO_SLUG, "--state", "open", "--limit", "50",
        "--json", "number,title,headRefName,url,statusCheckRollup,isDraft",
    )
    if not isinstance(prs, list):
        panelkit.mark_partial(envelope, "open-PR list fetch failed - openPRs is empty this run")
        return []
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
                # Canonical panelkit vocabulary (green/red/pending/unknown) -
                # replaces this script's own UPPERCASE enum; repo.html's lamp/
                # pill mapping updated in the same pass.
                "ciState": panelkit.classify_ci_status_rollup(checks),
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


def fetch_recent_merges(envelope, limit=15):
    """Kept on `gh pr list` (not panelkit.fetch_recent_merges) so the cc
    payload keeps its locked key shape (number/mergedAt/url vs panelkit's
    n/created_at) - see the module docstring."""
    merges = panelkit.gh_json(
        "pr", "list", "-R", REPO_SLUG, "--state", "merged", "--limit", str(limit),
        # createdAt is additive (0.4.0): feeds the velocity block's
        # typical-merge median; the locked number/mergedAt/url keys stand.
        "--json", "number,title,mergedAt,url,createdAt",
    )
    if not isinstance(merges, list):
        panelkit.mark_partial(envelope, "merged-PR list fetch failed - recentMerges is empty this run")
        return []
    return merges


def fetch_latest_ci_run(envelope):
    """Above-the-fold contract block 4: the single most recent Actions run
    (any branch, any status) - workflow name, conclusion, duration, log
    link. None (with a partial warning) when the fetch fails; None without
    a warning when the repo simply has no runs. Never invents a
    conclusion - an in-progress run carries conclusion null."""
    result = panelkit.gh_json("api", f"repos/{REPO_SLUG}/actions/runs?per_page=1")
    if not isinstance(result, dict):
        panelkit.mark_partial(envelope, "latest-CI-run fetch failed - lastCiRun is null this run")
        return None
    runs = result.get("workflow_runs", [])
    if not runs:
        return None
    r = runs[0]
    started, updated = r.get("run_started_at"), r.get("updated_at")
    duration_seconds = None
    if started and updated:
        try:
            fmt = "%Y-%m-%dT%H:%M:%SZ"
            t0 = datetime.strptime(started, fmt).replace(tzinfo=timezone.utc)
            t1 = datetime.strptime(updated, fmt).replace(tzinfo=timezone.utc)
            duration_seconds = max(0, int((t1 - t0).total_seconds()))
        except (ValueError, TypeError):
            duration_seconds = None
    return {
        "workflowName": r.get("name"),
        "status": r.get("status"),
        "conclusion": r.get("conclusion"),
        "runStartedAt": started,
        "durationSeconds": duration_seconds,
        "url": r.get("html_url"),
        "headBranch": r.get("head_branch"),
    }


def _run_git(*args, timeout=60):
    """Read-only git against THIS repo checkout; None on any failure."""
    try:
        proc = subprocess.run(
            ["git", "-C", str(REPO_ROOT), *args],
            capture_output=True, text=True, timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return proc.stdout if proc.returncode == 0 else None


def _loc_between(since_days, until_days=0):
    """+added/-deleted on origin/main between since_days and until_days ago
    via --numstat (binary '-' rows skipped). None on git failure."""
    args = ["log", "origin/main", f"--since={since_days} days ago", "--numstat", "--format="]
    if until_days:
        args.insert(2, f"--until={until_days} days ago")
    out = _run_git(*args)
    if out is None:
        return None
    added = deleted = 0
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
            added += int(parts[0])
            deleted += int(parts[1])
    return {"added": added, "deleted": deleted}


def fetch_velocity(envelope, recent_merges):
    """Position 1b (above-the-fold contract, 2026-07-05 interview ruling):
    merged count via ONE search-API total_count call (accurate at any
    volume - never the capped recentMerges list); LOC from THIS local
    clone (`git log origin/main --since --numstat` - free, zero API cost),
    shallow-guarded so a CI depth-1 checkout omits LOC honestly instead of
    silently undercounting; typical-merge median from recentMerges'
    createdAt/mergedAt (plain-language rendered by the viewer). A 4-week
    LOC series rides along for later charting."""
    from datetime import timedelta

    since = (datetime.now(timezone.utc) - timedelta(days=VELOCITY_WINDOW_DAYS)).strftime("%Y-%m-%d")
    result = panelkit.gh_json(
        "api", f"search/issues?q=repo:{REPO_SLUG}+is:pr+is:merged+merged:>={since}",
    )
    merged_count = None
    if isinstance(result, dict) and "total_count" in result:
        merged_count = int(result["total_count"])
    else:
        panelkit.mark_partial(envelope, "velocity merged-count search failed - count line omitted this run")

    # Shallow guard, boundary-aware: a shallow checkout only invalidates a
    # window the cut history fails to cover (with a 1-day margin). A CI
    # depth-1 checkout omits everything honestly; a 28-day shallow local
    # clone still yields an accurate 7-day LOC.
    def history_covers(days):
        if (_run_git("rev-parse", "--is-shallow-repository") or "").strip() != "true":
            return True
        out = _run_git("log", "origin/main", "--reverse", "--format=%cI")
        if not out or not out.splitlines():
            return False
        try:
            oldest = datetime.fromisoformat(out.splitlines()[0])
        except ValueError:
            return False
        return oldest <= datetime.now(timezone.utc) - timedelta(days=days + 1)

    loc = None
    weekly = None
    loc_note = None
    if not history_covers(VELOCITY_WINDOW_DAYS):
        loc_note = (
            "checkout history is too shallow to cover the "
            f"{VELOCITY_WINDOW_DAYS}-day window - LOC omitted, never guessed"
        )
    else:
        loc = _loc_between(VELOCITY_WINDOW_DAYS)
        if loc is None:
            loc_note = "git log failed - LOC omitted this run"
        else:
            today = datetime.now(timezone.utc).date()
            weekly = []
            for w in range(VELOCITY_WEEKS):
                if not history_covers(7 * (w + 1)):
                    break  # older weeks would silently undercount - stop honestly
                span = _loc_between(7 * (w + 1), 7 * w)
                if span is None:
                    continue
                weekly.append({
                    "week_start": (today - timedelta(days=7 * (w + 1))).isoformat(),
                    "loc_added": span["added"],
                    "loc_deleted": span["deleted"],
                })

    # Typical merge time: median lead-time hours over the recentMerges
    # sample that carries both timestamps (plain-language at render; the
    # raw number stays here for agents).
    hours = sorted(
        h for h in (
            panelkit.lead_time_hours(m.get("createdAt"), m.get("mergedAt"))
            for m in recent_merges
        ) if h is not None
    )
    typical = None
    if hours:
        mid = len(hours) // 2
        typical = round(hours[mid] if len(hours) % 2 else (hours[mid - 1] + hours[mid]) / 2, 2)

    return {
        "window_days": VELOCITY_WINDOW_DAYS,
        "merged_count": merged_count,
        "loc": loc,
        "loc_note": loc_note,
        "typical_merge_hours": typical,
        "weekly": weekly,
    }


def fetch_pages_status(envelope):
    raw = panelkit.gh_json("api", f"repos/{REPO_SLUG}/pages")
    if not isinstance(raw, dict):
        panelkit.mark_partial(envelope, "Pages status fetch failed - deploy.pages.status is unknown this run")
        return {"status": "unknown", "error": "pages API fetch failed"}
    return {
        "status": raw.get("status"),
        "htmlUrl": raw.get("html_url"),
        "sourceBranch": (raw.get("source") or {}).get("branch"),
        "buildType": raw.get("build_type"),
    }


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
    shape = {
        "testFileCount": len(test_files),
        "testCaseCount": None,
        "testFailedCount": None,
        "workflow": ".github/workflows/tests.yml",
        "runner": "node test/run-all.js",
    }
    # File count alone undersells the suite (U-CC finding 2026-07-05: "40 test
    # files" vs 2117 executed cases). The runner's per-file "N passed, M failed"
    # lines are the authoritative case count - parse them; degrade to file
    # count with a warning if node/runner is unavailable.
    try:
        run = subprocess.run(
            ["node", "test/run-all.js"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=300,
        )
        counts = re.findall(r"(\d+) passed, (\d+) failed", run.stdout)
        if counts:
            shape["testCaseCount"] = sum(int(p) + int(f) for p, f in counts)
            shape["testFailedCount"] = sum(int(f) for _, f in counts)
        else:
            shape["warning"] = "runner output had no per-file counts"
    except (OSError, subprocess.TimeoutExpired) as exc:
        shape["warning"] = f"case count unavailable: {exc}"
    return shape


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
    envelope = panelkit.new_envelope(
        f"command-center-gen.py@{GEN_VERSION} (panelkit {panelkit.PANELKIT_VERSION})",
        source_repo=REPO_SLUG,
    )

    commits = fetch_commits()
    if commits is None:
        # The commits list is the payload's spine - never clobber the
        # last-good payload with a blank one. Exit 1 is the loud signal
        # (locally and in the cc-nightly workflow).
        print("FAIL: commits fetch failed (gh auth/network?) - NOT writing; last-good payload preserved", file=sys.stderr)
        return 1
    head = commits[0] if commits else None
    open_prs = fetch_open_prs(envelope)
    recent_merges = fetch_recent_merges(envelope)
    velocity = fetch_velocity(envelope, recent_merges)
    last_ci_run = fetch_latest_ci_run(envelope)
    pages = fetch_pages_status(envelope)
    live_cache = fetch_live_cache_version()
    local_cache = local_cache_version()
    missions = discover_mission_panes()
    visions = discover_visions()
    queue = parse_queue()
    suite = suite_shape()
    if suite.get("warning"):
        panelkit.mark_partial(envelope, f"suite: {suite['warning']}")
    ops = ops_links()

    cache_match = (live_cache == local_cache) if (live_cache and local_cache) else None

    payload = {
        "generatedAt": envelope["generatedAt"],
        "generator": envelope["generator"],
        "source_repo": envelope["source_repo"],
        "freshness_seconds_at_render": envelope["freshness_seconds_at_render"],
        "status": envelope["status"],
        "warnings": envelope["warnings"],
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
        "lastCiRun": last_ci_run,
        "velocity": velocity,
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

    status_note = payload["status"] if payload["status"] == "ok" else f"{payload['status']}: {len(payload['warnings'])} warning(s)"
    print(f"wrote {OUTPUT_PATH.relative_to(REPO_ROOT)} (status {status_note})")
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
    cases = suite.get("testCaseCount")
    print(
        f"  suite: {cases} test cases / {suite['testFileCount']} suites"
        if cases is not None
        else f"  suite: {suite['testFileCount']} test files (case count unavailable)"
    )


if __name__ == "__main__":
    sys.exit(main())
