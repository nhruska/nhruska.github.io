#!/usr/bin/env python3
"""
Regenerate the root portfolio index.html (git-scraping style, after Simon Willison).

Pipeline:
    scripts/data.json   (curated: hero text, featured Music build, Elsewhere links)
  + live GitHub API     (public, non-fork, non-archived repos for the configured user)
  + scripts/template.html
  ->  ../index.html      (the file GitHub Pages serves from `main` /(root))

Stdlib only - no pip dependencies. Uses urllib for the GitHub API call so it runs
unauthenticated locally and with the built-in GITHUB_TOKEN in Actions.

Design contract (DO NOT break):
  - The PS-brand visual design in template.html is the source of truth; this script
    only fills injection slots. The output must look identical to the hand-authored
    page PLUS the generated "Open source" section.
  - If the GitHub API call fails, the build NEVER produces a broken page: it reuses
    the repo list already embedded in the current ../index.html (so a transient API
    outage leaves the last-good section in place), and if none can be recovered it
    renders a graceful "GitHub" fallback card. The script exits 0 in both cases.
"""

import base64
import binascii
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_PATH = SCRIPT_DIR / "data.json"
TEMPLATE_PATH = SCRIPT_DIR / "template.html"
OUTPUT_PATH = REPO_ROOT / "index.html"

GITHUB_API = "https://api.github.com/users/{user}/repos?per_page=100&sort=updated"

# Embedded markers so a future build can recover the last-good repo list from the
# generated index.html if the API is unreachable.
REPO_CACHE_BEGIN = "<!-- repo-data:begin"
REPO_CACHE_END = "repo-data:end -->"

# Problem Solutions logo (matches the wordmark/footer SVG in the template).
PS_LOGO_SVG = (
    '<svg width="20" height="20" viewBox="0 0 631 510" aria-hidden="true">'
    '<path fill="#2075BC" d="M329.6,102.1c-51.05,33.67-82.35,91.22-82.35,152.67c0,61.45,31.3,118.99,82.35,152.67c51.05-33.67,82.36-91.22,82.36-152.67C411.96,193.33,380.66,135.77,329.6,102.1z"/>'
    '<path fill="#105480" d="M429.75,53.94c-29.09,0-56.71,6.24-81.67,17.36c61.76,40.21,99.73,109.44,99.73,183.47c0,74.03-37.96,143.27-99.73,183.48c24.96,11.13,52.58,17.36,81.67,17.36c110.92,0,200.84-89.91,200.84-200.84C630.58,143.85,540.66,53.94,429.75,53.94z"/>'
    '<path fill="#29AAE1" d="M210.85,254.76c0-74.03,37.97-143.25,99.73-183.47C285.62,60.17,258,53.94,228.91,53.94c-110.92,0-200.83,89.91-200.83,200.83c0,110.93,89.91,200.84,200.83,200.84c29.09,0,56.71-6.24,81.67-17.36C248.81,398.03,210.85,328.79,210.85,254.76z"/></svg>'
)
GITHUB_LOGO_SVG = (
    '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
)


def log(msg: str) -> None:
    print(f"[generate] {msg}", file=sys.stderr)


def esc(text) -> str:
    """HTML-escape plain text for safe insertion."""
    return html.escape(str(text), quote=True)


def fetch_repos(user: str):
    """Fetch public repos from the GitHub API. Returns a list or None on failure."""
    url = GITHUB_API.format(user=user)
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": f"{user}-portfolio-build",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
        log("using GITHUB_TOKEN for authenticated request")
    else:
        log("no token present - using unauthenticated request (rate-limited)")

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.load(resp)
        if not isinstance(data, list):
            log(f"unexpected API payload (not a list): {type(data).__name__}")
            return None
        log(f"fetched {len(data)} repos from the API")
        return data
    except urllib.error.HTTPError as e:
        log(f"HTTPError {e.code} from GitHub API: {e.reason}")
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        log(f"API fetch failed ({type(e).__name__}): {e}")
        return None


def normalize_repos(raw, cfg):
    """Filter + project the API payload down to what the template needs."""
    exclude = set(cfg.get("exclude_names", []))
    max_repos = int(cfg.get("max_repos", 9))
    out = []
    for r in raw:
        if r.get("private") or r.get("fork") or r.get("archived"):
            continue
        if r.get("name") in exclude:
            continue
        out.append(
            {
                "name": r.get("name", ""),
                "description": (r.get("description") or "").strip(),
                "html_url": r.get("html_url", ""),
                "stargazers_count": int(r.get("stargazers_count") or 0),
                "language": r.get("language") or "",
                "pushed_at": r.get("pushed_at") or "",
            }
        )
    out.sort(key=lambda x: x["pushed_at"], reverse=True)
    return out[:max_repos]


def recover_cached_repos():
    """Pull the last-good repo list embedded in the existing index.html, if any."""
    if not OUTPUT_PATH.exists():
        return None
    text = OUTPUT_PATH.read_text(encoding="utf-8")
    start = text.find(REPO_CACHE_BEGIN)
    end = text.find(REPO_CACHE_END)
    if start == -1 or end == -1 or end < start:
        return None
    blob = text[start + len(REPO_CACHE_BEGIN): end].strip()
    try:
        # cache is base64(JSON) so it can never contain "-->" and break the
        # HTML comment, nor leak control chars from repo descriptions.
        repos = json.loads(base64.b64decode(blob).decode("utf-8"))
        if not isinstance(repos, list):
            return None
        log(f"recovered {len(repos)} repos from cached index.html")
        return repos
    except (binascii.Error, json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return None


def fmt_pushed(iso: str) -> str:
    """'2026-06-07T21:31:12Z' -> 'Jun 2026'. Empty/garbage -> ''."""
    if not iso:
        return ""
    try:
        dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return dt.strftime("%b %Y")
    except ValueError:
        return ""


def render_chips(chips):
    parts = []
    for c in chips:
        # data.json hero chips may carry intentional HTML entities (e.g. &amp;)
        parts.append(f'      <span class="chip"><span class="dot"></span>{c}</span>')
    return "\n".join(parts)


def render_build_card(b):
    """Mirror the original client-side BUILDS card markup, now rendered server-side."""
    live = b.get("status") == "live" and b.get("href")
    tag = b.get("desc", "")  # noqa: F841 (kept for parity readability)
    icon = b.get("icon") or "&#9670;"
    title = b.get("title", "")
    desc = b.get("desc", "")
    foot_tag = b.get("tag", "")
    badge_cls = "live" if live else "soon"
    badge_txt = "live" if live else "soon"
    go = "open &rarr;" if live else ""
    inner = (
        '<div class="cardTop">'
        f'<div class="icn">{icon}</div>'
        f'<span class="badge {badge_cls}">{badge_txt}</span>'
        "</div>"
        f"<h3>{title}</h3>"
        f'<div class="desc">{desc}</div>'
        f'<div class="foot"><span>{foot_tag}</span><span class="go">{go}</span></div>'
    )
    if live:
        return (
            f'      <a class="card live reveal" href="{esc(b["href"])}">{inner}</a>'
        )
    return f'      <div class="card soon reveal">{inner}</div>'


def render_repo_card(r):
    # .get() defaults so a malformed/partial cached entry can never crash the build.
    name = esc(r.get("name", ""))
    url = esc(r.get("html_url", ""))
    description = (r.get("description") or "").strip()
    desc = esc(description) if description else "No description provided."
    meta_bits = []
    language = r.get("language") or ""
    if language:
        meta_bits.append(
            f'<span class="m"><span class="lang-dot"></span>{esc(language)}</span>'
        )
    try:
        stars = int(r.get("stargazers_count") or 0)
    except (TypeError, ValueError):
        stars = 0
    if stars:
        meta_bits.append(f'<span class="m">&#9733; {stars}</span>')
    pushed = fmt_pushed(r.get("pushed_at", ""))
    if pushed:
        meta_bits.append(f'<span class="m">Updated {esc(pushed)}</span>')
    meta = "".join(meta_bits)
    inner = (
        '<div class="cardTop">'
        f'<div class="icn">{GITHUB_LOGO_SVG}</div>'
        '<span class="badge live">repo</span>'
        "</div>"
        f"<h3>{name}</h3>"
        f'<div class="desc">{desc}</div>'
        f'<div class="meta">{meta}</div>'
    )
    return f'      <a class="card live reveal" href="{url}" target="_blank" rel="noopener">{inner}</a>'


def render_repo_section(repos, cfg):
    if repos:
        cards = "\n".join(render_repo_card(r) for r in repos)
        return cards
    # Graceful fallback: a single card pointing at the GitHub profile.
    user = cfg.get("github_user", "nhruska")
    fallback = (
        '<div class="cardTop">'
        f'<div class="icn">{GITHUB_LOGO_SVG}</div>'
        '<span class="badge live">github</span>'
        "</div>"
        "<h3>On GitHub</h3>"
        '<div class="desc">The live repo list could not be fetched at build time. '
        "Browse everything on the GitHub profile.</div>"
        '<div class="foot"><span></span><span class="go">open &rarr;</span></div>'
    )
    return (
        f'      <a class="card live reveal" href="https://github.com/{esc(user)}" '
        f'target="_blank" rel="noopener">{fallback}</a>'
    )


def render_elsewhere(links):
    parts = []
    for lk in links:
        icon = PS_LOGO_SVG if lk.get("icon") == "ps" else GITHUB_LOGO_SVG
        parts.append(
            '      <a class="linkbtn reveal" href="'
            + esc(lk.get("href", "#"))
            + '" target="_blank" rel="noopener">'
            + f'<span class="ico">{icon}</span>'
            + f'<span>{esc(lk.get("title", ""))}<br><span class="sub">{esc(lk.get("sub", ""))}</span></span>'
            + "</a>"
        )
    return "\n".join(parts)


def fill(template: str, mapping: dict) -> str:
    out = template
    for key, val in mapping.items():
        out = out.replace("{{" + key + "}}", val)
    # Safety: flag any unfilled slot so the build can't ship raw placeholders.
    leftover = re.findall(r"\{\{[A-Z_]+\}\}", out)
    if leftover:
        raise SystemExit(f"[generate] FATAL: unfilled template slots: {sorted(set(leftover))}")
    return out


def main() -> int:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    meta = data["meta"]
    hero = data["hero"]
    gh_cfg = data["github_section"]
    gh_cfg.setdefault("github_user", meta.get("github_user", "nhruska"))

    raw = fetch_repos(meta.get("github_user", "nhruska"))
    if raw is not None:
        repos = normalize_repos(raw, gh_cfg)
    else:
        log("API unavailable - attempting to reuse last-good cached repo list")
        repos = recover_cached_repos() or []

    build_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    mapping = {
        "TITLE": esc(meta["title"]),
        "DESCRIPTION": esc(meta["description"]),
        "ROLE_PILL": hero["role_pill"],
        "EYEBROW": esc(hero["eyebrow"]),
        "NAME_FIRST": esc(hero["name_first"]),
        "NAME_LAST": esc(hero["name_last"]),
        "LEAD": hero["lead"],
        "BIO": esc(hero["bio"]),
        "CHIPS": render_chips(hero["chips"]),
        "BUILDS_CARDS": "\n".join(render_build_card(b) for b in data["builds"]),
        "GH_LABEL": esc(gh_cfg.get("label", "Open source")),
        "GH_INTRO": esc(gh_cfg.get("intro", "")),
        "GH_CARDS": render_repo_section(repos, gh_cfg),
        "ELSEWHERE": render_elsewhere(data["elsewhere"]),
        "BUILD_DATE": esc(build_date),
    }

    rendered = fill(template, mapping)

    # Embed the repo list as a comment so a future build can recover it if the
    # API is down. base64(JSON) keeps it ASCII-safe and guarantees the blob can
    # never contain "-->" (which a repo description otherwise could), so it can't
    # break out of the HTML comment. Never affects layout.
    cache_blob = base64.b64encode(json.dumps(repos).encode("utf-8")).decode("ascii")
    cache_comment = f"\n{REPO_CACHE_BEGIN}\n{cache_blob}\n{REPO_CACHE_END}\n"
    rendered = rendered.replace("</body>", cache_comment + "</body>")

    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    log(f"wrote {OUTPUT_PATH} ({len(rendered)} bytes, {len(repos)} repos in Open source section)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
