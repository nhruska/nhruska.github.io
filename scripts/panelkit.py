# vendored-from: nhruska/claude-config skills/control-panel/lib/panelkit.py
# vendor-hash: c7fc90bf7976
# vendored-at: 2026-07-05T13:21:02Z
# DO NOT EDIT DIRECTLY - re-run vendor-sync.sh to refresh from the SSOT.
#!/usr/bin/env python3
"""
=============================================================================
PANELKIT -- Control-Panel Generator SSOT (single source of truth)
=============================================================================
Extracted (not invented) shared logic behind four independently-written
control-panel/command-center payload generators that had converged on the
same patterns without sharing code:

  - workflows-hub/scripts/project-hub-gen.py   (per-project payload; the
    Layer 3.5 "Project Hub" - richest, most-copied-from source)
  - workflows-hub/scripts/portfolio-gen.py     (portfolio meta-layer)
  - workflows-hub/scripts/company-gen.py       (curated-data validator only;
    no gh-fetching logic to extract - noted for completeness, not vendored)
  - nhruska.github.io/scripts/command-center-gen.py (single-repo command
    center; independently reinvented gh_json + a DIFFERENT CI-status
    vocabulary from project-hub-gen's)

Every function below is a straight extraction with two real fixes applied
during the port (both are pre-existing bugs in the source scripts, not new
behavior):

  1. Repo-tree fetches now check GitHub's `truncated` flag (silently
     dropped by project-hub-gen.py's fetch_repo_tree_paths) and surface it
     as an explicit warning instead of quietly under-counting files.
  2. The two independently-invented CI-status vocabularies (project-hub-gen's
     lowercase success/failure/pending/none/mixed and command-center-gen's
     UPPERCASE SUCCESS/FAILURE/PENDING/MIXED/NONE) are unified into ONE
     canonical vocabulary: green / red / pending / unknown. Both original
     inputs map onto it via classify_ci_check_runs() and
     classify_ci_status_rollup() respectively - existing consumers of
     project-hub-gen's payload keep the same output values (its
     CI_STATUS_MAP already used green/red/pending/unknown).

SSOT / vendor model (this module is STDLIB-ONLY and single-file on purpose):
  - This file is the source of truth. Consuming repos do NOT `pip install`
    it or add this skill's `lib/` to their PYTHONPATH across repo
    boundaries - they VENDOR a copy via scripts/vendor-sync.sh, which
    stamps the copy with PANELKIT_VERSION + a content hash comment so
    `--check` can detect drift without relying on git history shared
    between unrelated repos.
  - Upgrade path: edit this file (the SSOT) -> bump PANELKIT_VERSION ->
    re-run vendor-sync.sh against each consuming repo -> each repo's own
    generator re-imports the refreshed module, unchanged call sites (this
    is why the public function signatures here are the interface contract -
    see "Locked interfaces" in the skill's SKILL.md before changing one).
  - `import panelkit` after vendoring works because vendor-sync.sh copies
    this single file next to (or importable from) the target generator -
    no package, no `__init__.py`, no dependency tree to keep in sync.

Auth: every function shells out to the caller's already-authenticated `gh`
CLI. This module never handles, embeds, or logs a token.

Usage (as a library):
    import panelkit
    prs = panelkit.fetch_open_prs("problemsolutions/Personalysis_VectorSpark")

Usage (self-check, no args needed - runs the CE-evidence canary + prints
the version/hash so a vendored copy can self-report its provenance):
    python3 panelkit.py --self-check
    python3 panelkit.py --version
=============================================================================
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import posixpath
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

# --------------------------------------------------------------------------
# Version + content-hash (the vendor/upgrade seam - see module docstring)
# --------------------------------------------------------------------------

PANELKIT_VERSION = "0.1.0"


def content_hash(path: "Path | str | None" = None) -> str:
    """SHA-256 hex digest (first 12 chars) of this module's own source file,
    or an arbitrary `path` when comparing a vendored copy elsewhere.
    scripts/vendor-sync.sh --check uses this to detect drift between the
    SSOT and a vendored copy without depending on git history the two repos
    don't share."""
    target = Path(path) if path else Path(__file__)
    return hashlib.sha256(target.read_bytes()).hexdigest()[:12]


# --------------------------------------------------------------------------
# gh CLI helpers: JSON fetch, pagination, rate-tolerance
# --------------------------------------------------------------------------

_RATE_LIMIT_MARKERS = ("api rate limit", "secondary rate limit")


def gh_json(*args: str, retry_on_rate_limit: bool = True, backoff_seconds: float = 5.0) -> object:
    """Run `gh api ...` (or any gh subcommand) and parse JSON stdout.

    Rate-tolerance: a single retry after `backoff_seconds` when stderr
    signals a GitHub rate-limit (primary or secondary/abuse limit) - one
    retry is enough for the common secondary-limit blip from bursty calls;
    a persistent primary-limit exhaustion still fails through to the WARN
    + None path so callers degrade gracefully (per the payload CONTRACT's
    'partial'/'failed' status) rather than looping forever.
    """
    result = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        stderr_lower = result.stderr.lower()
        if retry_on_rate_limit and any(m in stderr_lower for m in _RATE_LIMIT_MARKERS):
            print(f"WARN: gh {' '.join(args)} hit a rate limit - retrying once after {backoff_seconds}s", file=sys.stderr)
            time.sleep(backoff_seconds)
            return gh_json(*args, retry_on_rate_limit=False)
        print(f"WARN: gh {' '.join(args)} failed: {result.stderr.strip()}", file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"WARN: gh {' '.join(args)} returned non-JSON output", file=sys.stderr)
        return None


def gh_json_paginated(
    path_builder: Callable[[int], str], per_page: int = 100, max_pages: int = 10
) -> "tuple[list, bool]":
    """Fetch a list-shaped `gh api` endpoint across multiple pages.

    `path_builder(page)` must return the full `gh api` path argument for
    that 1-indexed page (the caller bakes `per_page` + `page=N` into it).
    Stops when a page returns fewer than `per_page` items (natural end) or
    `max_pages` is reached. Returns `(items, hit_page_cap)` - `hit_page_cap`
    is True only when the loop stopped because of the cap, not because the
    data ran out, so a caller can surface an explicit undercount warning
    instead of silently truncating (the same class of bug the repo-tree
    `truncated` fix below addresses, generalized to any paginated list).
    """
    items: list = []
    for page in range(1, max_pages + 1):
        chunk = gh_json("api", path_builder(page))
        if not isinstance(chunk, list) or not chunk:
            return items, False
        items.extend(chunk)
        if len(chunk) < per_page:
            return items, False
    return items, True


def fetch_text_file(full_name: str, path: str, ref: "str | None" = None) -> "str | None":
    """Fetch a repo file's decoded text content via the contents API, or None."""
    if not path:
        return None
    q = f"repos/{full_name}/contents/{path}"
    if ref:
        q += f"?ref={ref}"
    result = gh_json("api", q)
    if not isinstance(result, dict) or "content" not in result:
        return None
    try:
        return base64.b64decode(result["content"]).decode("utf-8", errors="replace")
    except Exception:
        return None


# --------------------------------------------------------------------------
# ONE CI-status vocabulary (unifies the two independently-invented enums)
# --------------------------------------------------------------------------

# Canonical output vocabulary for every CI-status classifier in this module.
# Matches project-hub-gen.py's CI_STATUS_MAP output (the payload contract
# already locked to a sibling viewer PR - see that script's module
# docstring) so existing consumers see no value change.
CANONICAL_CI_STATUSES = ("green", "red", "pending", "unknown")

DEPLOYMENT_STATE_MAP = {
    "success": "succeeded",
    "failure": "failed",
    "error": "failed",
    "in_progress": "in_progress",
    "queued": "in_progress",
    "pending": "in_progress",
    "inactive": "unknown",
}

# Environments GitHub auto-creates for platform features (not real deploy
# targets) - always excluded from auto-discovered environments.
PLATFORM_ENV_NAMES = {"copilot"}


def classify_ci_check_runs(runs: "list[dict] | None") -> str:
    """Canonical CI status from a GitHub check-runs API list - the shape
    project-hub-gen.py fetches per open-PR via
    `repos/{full}/commits/{sha}/check-runs`. Each run has `.conclusion` in
    {success, failure, neutral, cancelled, timed_out, action_required,
    skipped, stale, None} - None means still running (no separate
    `.status` field is consulted here, matching the original)."""
    if not runs:
        return "unknown"
    conclusions = [r.get("conclusion") for r in runs]
    if any(c in ("failure", "timed_out", "cancelled", "action_required") for c in conclusions):
        return "red"
    if any(c is None for c in conclusions):
        return "pending"
    if all(c == "success" for c in conclusions):
        return "green"
    return "unknown"  # mixed neutral/skipped/stale combos - no clean single verdict


def classify_ci_status_rollup(checks: "list[dict] | None") -> str:
    """Canonical CI status from `gh pr list --json statusCheckRollup` shape
    - the vocabulary command-center-gen.py independently invented
    (UPPERCASE `.conclusion` in {SUCCESS, FAILURE, ...}, `.status` in
    {COMPLETED, IN_PROGRESS, QUEUED, ...}). Maps onto the SAME canonical
    output as classify_ci_check_runs() above - this is the vocabulary
    unification: two payload generators used to report CI health with two
    different enums for the same underlying concept."""
    if not checks:
        return "unknown"
    conclusions = [c.get("conclusion") for c in checks]
    statuses = [c.get("status") for c in checks]
    if any(c == "FAILURE" for c in conclusions):
        return "red"
    if any(s != "COMPLETED" for s in statuses):
        return "pending"
    if all(c == "SUCCESS" for c in conclusions):
        return "green"
    return "unknown"


# --------------------------------------------------------------------------
# Repo-tree fetch WITH truncation detection (the silent-undercount fix)
# --------------------------------------------------------------------------

def fetch_repo_tree(full_name: str, ref: str) -> dict:
    """All blob (file) paths in the repo at `ref`, via one recursive
    `git/trees` call. Returns `{"paths": [...], "truncated": bool,
    "warning": str | None}`.

    GitHub's recursive tree endpoint silently truncates responses over
    ~100k entries / 7MB (`truncated: true` in the response body).
    project-hub-gen.py's original `fetch_repo_tree_paths` read `.tree`
    directly without checking this flag - a large enough repo would
    silently under-count files feeding both `tests_info` (unit_files) and
    evidence discovery, with no signal to the operator that the count was
    incomplete. This fetcher surfaces the flag instead of dropping it."""
    tree = gh_json("api", f"repos/{full_name}/git/trees/{ref}?recursive=true")
    if not isinstance(tree, dict):
        return {"paths": [], "truncated": False, "warning": f"tree fetch failed for {full_name}@{ref}"}
    paths = [t["path"] for t in tree.get("tree", []) if t.get("type") == "blob"]
    truncated = bool(tree.get("truncated"))
    warning = (
        f"GitHub truncated the recursive tree response for {full_name}@{ref} "
        "- file counts / evidence discovery below may undercount"
        if truncated
        else None
    )
    return {"paths": paths, "truncated": truncated, "warning": warning}


def latest_commit_date(full_name: str, path: str) -> "str | None":
    """Latest commit touching `path`, or None if undiscoverable."""
    commits = gh_json("api", f"repos/{full_name}/commits?path={path}&per_page=1")
    if not (isinstance(commits, list) and commits):
        return None
    commit = commits[0].get("commit", {})
    return (commit.get("committer") or {}).get("date") or (commit.get("author") or {}).get("date")


# --------------------------------------------------------------------------
# Environments + deployment-status fetch
# --------------------------------------------------------------------------

def deployment_state_for_env(full_name: str, env_name: str) -> "tuple[str | None, str | None]":
    """Latest GH deployment's (state, environment_url) for this env name, or
    (None, None) when no GH deployment record exists for it."""
    deployments = gh_json("api", f"repos/{full_name}/deployments?environment={env_name}&per_page=1")
    if not (isinstance(deployments, list) and deployments):
        return None, None
    dep_id = deployments[0]["id"]
    statuses = gh_json("api", f"repos/{full_name}/deployments/{dep_id}/statuses")
    if not (isinstance(statuses, list) and statuses):
        return None, None
    latest = statuses[0]
    return DEPLOYMENT_STATE_MAP.get(latest.get("state"), "unknown"), (latest.get("environment_url") or None)


def probe_url_state(url: "str | None", timeout: int = 8) -> str:
    """Live-reachability fallback when no GH-deployment-derived state
    exists (the common case for curated extra_envs - e.g. an Azure
    Container App never registered as a named GH Environment). 2xx/3xx/
    401/403 all mean the app answered (401/403 = auth-gated, still "up");
    5xx/timeout/connection failure means down; anything else is unknown."""
    if not url:
        return "unknown"
    try:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", str(timeout), url],
            capture_output=True, text=True, check=False,
        )
        code = result.stdout.strip()
        if code.isdigit():
            code_i = int(code)
            if 200 <= code_i < 500:
                return "succeeded"
            if code_i >= 500:
                return "failed"
    except Exception:
        pass
    return "unknown"


def fetch_environments_auto(full_name: str) -> "list[dict]":
    """Auto-discover GH Environments + their latest deployment's
    state/environment_url. `environment_url` is empirically unset on this
    org's deployments (workflows deploy via `az` CLI directly, not the
    Deployments API) - auto-discovery still runs since a future repo may
    wire it; real URLs today come from curated `extra_envs` (see
    merge_environments)."""
    result = gh_json("api", f"repos/{full_name}/environments")
    envs = result.get("environments", []) if isinstance(result, dict) else []
    out = []
    for e in envs:
        name = e.get("name")
        if name in PLATFORM_ENV_NAMES:
            continue
        state, url = deployment_state_for_env(full_name, name)
        out.append({"name": name, "url": url, "state": state or "unknown", "source": "gh-environment-auto"})
    return out


def merge_environments(full_name: str, auto_envs: "list[dict]", azure_config: "dict | None") -> "list[dict]":
    """Merge GH-auto-discovered environments with a config's curated
    `extra_envs` (project.json's `azure.extra_envs` shape). `extra_envs`
    entries may carry an optional `repo` key to disambiguate a multi-repo
    project; omit it when the config's single repo already owns every
    entry."""
    extra_envs = (azure_config or {}).get("extra_envs") or []
    relevant_extra = [e for e in extra_envs if e.get("repo") in (None, full_name)]
    merged: dict[str, dict] = {e["name"]: e for e in auto_envs}
    for ee in relevant_extra:
        name = ee.get("name")
        auto_entry = merged.get(name)
        if auto_entry and auto_entry.get("state") not in (None, "unknown"):
            state = auto_entry["state"]
        else:
            state = probe_url_state(ee.get("url"))
        entry = {
            "name": name,
            "url": ee.get("url"),
            "state": state,
            "portal_url": ee.get("portal_url"),
            "source": "extra_env (curated, verified)",
        }
        if name in merged and merged[name].get("url"):
            entry["note"] = "gh-environment-auto also registered this name with no discoverable URL"
        merged[name] = entry
    return list(merged.values())


# --------------------------------------------------------------------------
# PR / merge fetchers (incl. created_at, for lead-time)
# --------------------------------------------------------------------------

def fetch_open_prs(full_name: str, per_page: int = 100, max_pages: int = 3) -> "list[dict]":
    """Open PRs with per-PR canonical CI status + `created_at` (feeds
    `lead_time_hours` once merged). Paginated (see gh_json_paginated) so a
    repo with >100 open PRs doesn't silently undercount - `_pagination`
    carries a warning when the page cap (not natural exhaustion) ended the
    fetch."""
    prs, hit_cap = gh_json_paginated(
        lambda page: f"repos/{full_name}/pulls?state=open&per_page={per_page}&page={page}",
        per_page=per_page, max_pages=max_pages,
    )
    out = []
    for p in prs:
        sha = (p.get("head") or {}).get("sha")
        raw_runs = gh_json("api", f"repos/{full_name}/commits/{sha}/check-runs") if sha else None
        runs = raw_runs.get("check_runs", []) if isinstance(raw_runs, dict) else []
        out.append({
            "n": p["number"], "title": p["title"], "url": p["html_url"],
            "created_at": p.get("created_at"),
            "ci": classify_ci_check_runs(runs),
        })
    if hit_cap:
        out_meta_warning = f"{full_name}: open-PR fetch hit the {max_pages}-page cap - possible undercount"
        print(f"WARN: {out_meta_warning}", file=sys.stderr)
    return out


def fetch_recent_merges(full_name: str, limit: int = 15, fetch_page: int = 30, max_pages: int = 3) -> "list[dict]":
    """Most recently merged PRs (newest first), capped at `limit`, each
    carrying `mergedAt` (existing field name, kept for backward
    compatibility with project-hub-gen's locked payload contract) plus the
    additive `created_at` for lead-time computation."""
    out: list[dict] = []
    for page in range(1, max_pages + 1):
        chunk = gh_json(
            "api",
            f"repos/{full_name}/pulls?state=closed&sort=updated&direction=desc&per_page={fetch_page}&page={page}",
        )
        if not isinstance(chunk, list) or not chunk:
            break
        for p in chunk:
            if p.get("merged_at"):
                out.append({
                    "n": p["number"], "title": p["title"],
                    "mergedAt": p["merged_at"], "url": p["html_url"],
                    "created_at": p.get("created_at"),
                })
            if len(out) >= limit:
                return out
        if len(chunk) < fetch_page:
            break
    return out


def lead_time_hours(created_at: "str | None", merged_at: "str | None") -> "float | None":
    """Hours between a PR's `created_at` and `merged_at` (both GitHub's
    `%Y-%m-%dT%H:%M:%SZ` timestamps), or None if either is missing/
    unparseable. Feeds a lead-time series/rollup - never invents a value
    when the inputs are absent."""
    if not created_at or not merged_at:
        return None
    try:
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        created = datetime.strptime(created_at, fmt).replace(tzinfo=timezone.utc)
        merged = datetime.strptime(merged_at, fmt).replace(tzinfo=timezone.utc)
        return round((merged - created).total_seconds() / 3600, 2)
    except (ValueError, TypeError):
        return None


# --------------------------------------------------------------------------
# Evidence scan (V&V / adversarial regex) WITH a canary self-check
# --------------------------------------------------------------------------

VV_PATTERN = re.compile(r"\b(V&V|Verification|Validation)\b", re.IGNORECASE)
ADVERSARIAL_PATTERN = re.compile(r"\badversarial\b", re.IGNORECASE)

# Tooling dirs that would otherwise false-positive against EVIDENCE_KEYWORDS
# (e.g. .claude/commands/plan/, .claude/skills/sprint-report/ are primitive
# IMPLEMENTATIONS, not evidence artifacts) - excluded before the keyword scan.
EVIDENCE_TOOLING_EXCLUDE = re.compile(
    r"^\.claude/(commands|skills|scripts)(/|$)|^claude-system/", re.IGNORECASE
)
EVIDENCE_ROOTS = ("docs/", ".claude/", "claude-system/", "tests/")
EVIDENCE_KEYWORDS = re.compile(
    r"sprint|hitl|regression|repro|review|plan|session|testing|qa[-_]?report|qa",
    re.IGNORECASE,
)
# A depth-0 file inside a matched evidence dir is promoted to an "exemplar"
# only when its own name also reads as a report/summary/plan artifact -
# avoids surfacing an incidental README.md as if it were the evidence.
EVIDENCE_EXEMPLAR_NAME = re.compile(r"report|summary|plan", re.IGNORECASE)


def fetch_ce_evidence(full_name: str, sample: int = 30, exemplar_cap: int = 5) -> dict:
    """Heuristic CE-evidence scan: how many of the last `sample` merged PRs
    carry V&V/Verification/Validation or adversarial-review markers in
    their body. This is the flagship metric the CE-rollup mission
    (docs/plans/control-panel-infra-sprint-20260705.md, W1C) aggregates
    across projects - see assert_scan_sane() below for its canary."""
    prs = gh_json("api", f"repos/{full_name}/pulls?state=closed&sort=updated&direction=desc&per_page={sample}")
    merged = [p for p in prs if p.get("merged_at")] if isinstance(prs, list) else []
    vv_count = 0
    adv_count = 0
    exemplars = []
    for p in merged:
        body = p.get("body") or ""
        is_vv = bool(VV_PATTERN.search(body))
        is_adv = bool(ADVERSARIAL_PATTERN.search(body))
        if is_vv:
            vv_count += 1
        if is_adv:
            adv_count += 1
        if (is_vv or is_adv) and len(exemplars) < exemplar_cap:
            exemplars.append({"n": p["number"], "title": p["title"], "url": p["html_url"]})
    return {
        "sample_size": len(merged),
        "vv_pr_count": vv_count,
        "adversarial_pr_count": adv_count,
        "exemplars": exemplars,
    }


def assert_scan_sane(
    known_repo: str = "problemsolutions/Personalysis_VectorSpark",
    min_ratio: float = 0.2,
    sample: int = 30,
) -> "tuple[bool, str]":
    """Canary self-check for the flagship CE-evidence metric.

    Re-runs fetch_ce_evidence() against a repo KNOWN to carry a high
    V&V/adversarial-review PR ratio (Personalysis, per this org's
    live-integration-evidence + codex-review-modes rules) and asserts the
    hit ratio clears a floor. If VV_PATTERN/ADVERSARIAL_PATTERN or GitHub's
    PR-body field name ever silently break, the flagship metric would
    otherwise quietly report near-zero everywhere with no error signal -
    this canary is what catches that. Call it from a test, from
    vendor-sync.sh --check, or as a periodic health check; it needs live
    `gh` auth to run for real (a test environment without `gh` auth should
    treat sample_size==0 as "fetch failed", not "canary failed" - see the
    return value below).
    """
    evidence = fetch_ce_evidence(known_repo, sample=sample)
    sample_size = evidence.get("sample_size", 0)
    if sample_size == 0:
        return False, (
            f"canary repo {known_repo} returned 0 merged PRs in sample - "
            "fetch likely failed (auth/network), not a regex break"
        )
    ratio = (evidence["vv_pr_count"] + evidence["adversarial_pr_count"]) / sample_size
    if ratio < min_ratio:
        return False, (
            f"canary repo {known_repo} scored {ratio:.0%} V&V/adversarial hit ratio "
            f"on last {sample_size} merged PRs (floor {min_ratio:.0%}) - "
            "VV_PATTERN/ADVERSARIAL_PATTERN may be broken or GitHub renamed the PR body field"
        )
    return True, f"canary OK: {ratio:.0%} hit ratio on {known_repo} (floor {min_ratio:.0%}, sample {sample_size})"


def _dir_prefixes(path: str) -> "list[str]":
    parts = path.split("/")
    return ["/".join(parts[:i]) for i in range(1, len(parts))]


def fetch_evidence_dirs(
    full_name: str, ref: str, paths: "list[str]", pr_report_prs: "list[dict]", exemplar_cap: int = 5
) -> dict:
    """Discover git-tracked sprint/QA/plan/session/PR-review-shaped
    evidence directories under docs/, .claude/, claude-system/, tests/ -
    never invented, only directories with >=1 real matching file, each
    with a real file count and latest-commit date. `pr_report_prs` is
    passed through from ce_evidence's own discovery (recent merged PRs
    whose bodies carry V&V/adversarial markers) rather than re-fetched
    here."""
    buckets: dict[str, list[str]] = {}
    for p in paths:
        if not p.startswith(EVIDENCE_ROOTS):
            continue
        if EVIDENCE_TOOLING_EXCLUDE.search(p):
            continue
        match_dir = None
        for prefix in _dir_prefixes(p):
            if EVIDENCE_KEYWORDS.search(prefix.rsplit("/", 1)[-1]):
                match_dir = prefix
                break
        if match_dir:
            buckets.setdefault(match_dir, []).append(p)

    dated: list[tuple[str, list[str], "str | None"]] = [
        (d, files, latest_commit_date(full_name, d)) for d, files in buckets.items()
    ]
    dated.sort(key=lambda t: t[2] or "", reverse=True)

    dirs = [
        {
            "path": d,
            "url": f"https://github.com/{full_name}/tree/{ref}/{d}",
            "file_count": len(files),
            "latest": latest,
        }
        for d, files, latest in dated
    ]

    exemplars = []
    for d, files, _ in dated:
        if len(exemplars) >= exemplar_cap:
            break
        depth = d.count("/") + 1
        depth0_reports = sorted(
            f for f in files
            if f.count("/") == depth
            and f.lower().endswith((".md", ".html"))
            and EVIDENCE_EXEMPLAR_NAME.search(f.rsplit("/", 1)[-1])
        )
        if not depth0_reports:
            continue
        pick = depth0_reports[0]
        exemplars.append({
            "label": pick.rsplit("/", 1)[-1],
            "url": f"https://github.com/{full_name}/blob/{ref}/{pick}",
        })

    return {
        "dirs": dirs,
        "exemplars": exemplars,
        "pr_report_prs": pr_report_prs[:exemplar_cap],
    }


def fetch_wiki_topics(wiki_config: "dict | None", full_name: str, limit: int = 12) -> "list[dict]":
    """Extract [Title](path.md) links from a project's wiki index, resolved
    to blob URLs. Returns [] gracefully when no wiki is configured or the
    index can't be fetched - never invents topics. Kept here (rather than
    inlined per-repo) because it is pure text processing with no
    project-hub-specific state; candidate for wider reuse once a second
    consumer needs it."""
    if not wiki_config or not wiki_config.get("repo"):
        return []
    wiki_repo = wiki_config["repo"]
    index_path = wiki_config.get("index_path") or ""
    if wiki_repo != full_name:
        return []

    repo_meta = gh_json("api", f"repos/{wiki_repo}")
    branch = repo_meta.get("default_branch", "main") if isinstance(repo_meta, dict) else "main"

    content = fetch_text_file(wiki_repo, index_path, branch)
    if not content:
        return []

    link_re = re.compile(r"\[([^\]]+)\]\(([^)\s]+\.md)\)")
    base_dir = posixpath.dirname(index_path)

    def links_from(text: str) -> "list[dict]":
        seen: set[str] = set()
        found = []
        for m in link_re.finditer(text):
            title, rel = m.group(1), m.group(2)
            if rel.startswith("http"):
                continue
            resolved = posixpath.normpath(posixpath.join(base_dir, rel))
            if resolved in seen:
                continue
            seen.add(resolved)
            found.append({"title": title, "url": f"https://github.com/{wiki_repo}/blob/{branch}/{resolved}"})
        return found

    section_re = re.compile(r"^##\s+find your path\s*$(.*?)(?=^##\s|\Z)", re.IGNORECASE | re.MULTILINE | re.DOTALL)
    section_match = section_re.search(content)
    curated = links_from(section_match.group(1)) if section_match else []
    topics = curated if curated else links_from(content)
    return topics[:limit]


# --------------------------------------------------------------------------
# Payload CONTRACT helpers (the snapshot envelope - additive, new)
# --------------------------------------------------------------------------

VALID_ENVELOPE_STATUSES = ("ok", "partial", "failed")
REQUIRED_ENVELOPE_FIELDS = (
    "generatedAt", "generator", "source_repo",
    "freshness_seconds_at_render", "status", "warnings",
)


def new_envelope(generator: str, source_repo: "str | None" = None) -> dict:
    """The snapshot contract every panelkit-built payload wraps around its
    own domain-specific fields:

        {generatedAt, generator, source_repo,
         freshness_seconds_at_render, status, warnings}

    `freshness_seconds_at_render` is ALWAYS None at generation time - it is
    a RENDER-time computed field (now - generatedAt), intentionally left
    null here so a stale payload can never masquerade as fresh; the viewer
    computes it at load from `generatedAt`. `generator` names the script
    that built the payload (e.g. "project-hub-gen.py@0.3.0" or
    "panelkit@0.1.0") and `source_repo` is the `owner/repo` the payload
    describes (None for a cross-repo/portfolio-level payload).

    This envelope is ADDITIVE - existing locked per-generator payload
    contracts (e.g. project-hub-gen.py's top-level {generatedAt, project,
    jira_links, repos}) are not required to nest under this shape yet;
    wiring it in is wave-1 mission W1D (provenance pane + error/empty
    states), tracked in
    docs/plans/control-panel-infra-sprint-20260705.md.
    """
    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": generator,
        "source_repo": source_repo,
        "freshness_seconds_at_render": None,
        "status": "ok",
        "warnings": [],
    }


def mark_partial(envelope: dict, warning: str) -> None:
    """Append a warning and demote status ok -> partial. Never downgrades
    an already-'failed' envelope back to 'partial'."""
    envelope.setdefault("warnings", []).append(warning)
    if envelope.get("status") == "ok":
        envelope["status"] = "partial"


def mark_failed(envelope: dict, warning: str) -> None:
    """Append a warning and force status -> failed (terminal - a payload
    that failed to build should never present as ok/partial)."""
    envelope.setdefault("warnings", []).append(warning)
    envelope["status"] = "failed"


def validate_envelope(payload: dict) -> "list[str]":
    """Schema-check the envelope fields on a payload dict. Returns a list
    of violation strings (empty = valid). Does not validate any
    domain-specific fields beyond the envelope itself - each generator's
    own validator still owns its per-repo/per-project schema."""
    errors: list[str] = []
    for field in REQUIRED_ENVELOPE_FIELDS:
        if field not in payload:
            errors.append(f"payload missing envelope field '{field}'")
    if payload.get("status") not in VALID_ENVELOPE_STATUSES:
        errors.append(f"invalid envelope status '{payload.get('status')}' (must be one of {VALID_ENVELOPE_STATUSES})")
    if not isinstance(payload.get("warnings"), list):
        errors.append("envelope field 'warnings' must be a list")
    return errors


# --------------------------------------------------------------------------
# CLI: self-check (canary) + version/hash reporting
# --------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--self-check", action="store_true", help="run the CE-evidence canary against a known repo (needs live gh auth)")
    parser.add_argument("--version", action="store_true", help="print PANELKIT_VERSION + this file's content hash")
    parser.add_argument("--canary-repo", default="problemsolutions/Personalysis_VectorSpark", help="repo to run --self-check against")
    args = parser.parse_args()

    if args.version:
        print(f"panelkit {PANELKIT_VERSION} ({content_hash()})")
        return 0

    if args.self_check:
        ok, message = assert_scan_sane(known_repo=args.canary_repo)
        print(("OK: " if ok else "FAIL: ") + message)
        return 0 if ok else 1

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
