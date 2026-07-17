#!/usr/bin/env python3
"""
=============================================================================
SHARED LLMS.TXT WRITER
=============================================================================
Doctrine upgrade (docs/company-control-panel-vision.md, "Doctrine upgrade:
prose is a defect; every surface is dual-audience"): every hub surface
(company/, command/, projects/<id>/) exposes a machine-readable twin next to
its own payload.json -- a compact, prioritized brief written for an agent's
session-start intent inference, not for a human reading prose. Format is
plain text (never markdown headers rendered as a webpage) so an agent can
`fetch()` or `cat` it directly.

Every generator (scripts/company-gen.py, scripts/portfolio-gen.py,
scripts/project-hub-gen.py) calls write_llms_txt() with its own already-
computed sections -- this module only formats + writes, it never fetches or
invents data itself.

Section order is fixed: NOW -> gaps/to-wire -> recent work products ->
links -> conventions. A section with no items renders one honest line
("Nothing urgent.", "None recorded.") rather than being silently omitted --
an agent parsing this file should never have to guess whether a missing
section means "empty" or "not generated."
=============================================================================
"""
from __future__ import annotations

from pathlib import Path


def _bullet_lines(items: list[str], empty_line: str) -> str:
    if not items:
        return f"- {empty_line}\n"
    return "".join(f"- {i}\n" for i in items)


def render_llms_txt(
    *,
    title: str,
    generated_at: str,
    now_items: list[str],
    gaps: list[str],
    recent_products: list[str],
    links: list[str],
    conventions: list[str],
    status: "str | None" = None,
    warnings: "list[str] | None" = None,
) -> str:
    """Build the llms.txt text body from already-computed section content
    (each a list of pre-formatted one-line strings). Never fetches or
    invents data -- callers pass in what their own generator already knows.

    `status`/`warnings` (W1D, additive + optional so pre-envelope callers
    keep working): the payload envelope's status renders as one header
    line right under Generated, and each warning as an indented line under
    it - header-block lines, NOT a new "## " section, so the fixed section
    order/contract below is untouched."""
    header = [
        f"# {title} - Problem Solutions (agent-readable brief)",
        f"Generated: {generated_at}",
    ]
    if status:
        header.append(f"Status: {status}")
        for w in warnings or []:
            header.append(f"  warning: {w}")
    lines = header + [
        "",
        "## NOW",
        _bullet_lines(now_items, "Nothing urgent.").rstrip("\n"),
        "",
        "## Open gaps / to-wire",
        _bullet_lines(gaps, "None recorded.").rstrip("\n"),
        "",
        "## Recent work products",
        _bullet_lines(recent_products, "None recorded yet.").rstrip("\n"),
        "",
        "## Links",
        _bullet_lines(links, "None recorded.").rstrip("\n"),
        "",
        "## Conventions",
        _bullet_lines(conventions, "See docs/company-control-panel-vision.md.").rstrip("\n"),
    ]
    return "\n".join(lines) + "\n"


def write_llms_txt(out_path: Path, **sections) -> None:
    """Render + write llms.txt to out_path (a sibling of that surface's
    payload.json). Sections match render_llms_txt()'s keyword args."""
    out_path.write_text(render_llms_txt(**sections))
