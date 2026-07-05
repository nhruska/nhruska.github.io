#!/usr/bin/env python3
"""
=============================================================================
VENDORED-PANELKIT DRIFT CHECK
=============================================================================
Two-layer check on scripts/panelkit.py (the copy vendor-sync.sh stamps in
from the claude-config SSOT at skills/control-panel/lib/panelkit.py):

  1. SELF-INTEGRITY (always runs, no SSOT needed): the vendored file's body
     (everything after the fixed 4-line stamp header) must hash to the
     `# vendor-hash:` value stamped on line 2. A mismatch means someone
     hand-edited the vendored copy - the exact drift the stamp exists to
     catch. Runs anywhere: CI, a teammate checkout, the operator machine.

  2. SSOT COMPARISON (runs only where the SSOT is present): when the
     claude-config skill checkout exists (default ~/.claude/skills/
     control-panel, override via PANELKIT_SSOT_ROOT), the vendored body
     hash must also match the SSOT's current content hash. A mismatch
     means the SSOT moved ahead (or behind) - re-run vendor-sync.sh to
     refresh. Where the SSOT is absent (CI has no claude-config checkout),
     this layer reports SKIP, never a false failure.

Exit codes: 0 = no drift detected (layer 2 may be SKIP). 1 = drift or a
malformed/missing vendored copy.

Usage:
    python3 scripts/vendor-check.py
    PANELKIT_SSOT_ROOT=/path/to/skills/control-panel python3 scripts/vendor-check.py
=============================================================================
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VENDORED = REPO_ROOT / "scripts" / "panelkit.py"
STAMP_LINES = 4  # fixed header vendor-sync.sh prepends (see its write block)

DEFAULT_SSOT_ROOT = Path.home() / ".claude" / "skills" / "control-panel"


def body_hash(path: Path) -> str:
    lines = path.read_text().splitlines(keepends=True)
    body = "".join(lines[STAMP_LINES:])
    return hashlib.sha256(body.encode("utf-8")).hexdigest()[:12]


def stamped_hash(path: Path) -> "str | None":
    lines = path.read_text().splitlines()
    if len(lines) < STAMP_LINES:
        return None
    m = re.match(r"#\s*vendor-hash:\s*([0-9a-f]{12})", lines[1])
    return m.group(1) if m else None


def main() -> int:
    if not VENDORED.exists():
        print(f"FAIL: vendored panelkit missing at {VENDORED} - run vendor-sync.sh from the claude-config control-panel skill", file=sys.stderr)
        return 1

    stamp = stamped_hash(VENDORED)
    if stamp is None:
        print(f"FAIL: {VENDORED} carries no '# vendor-hash:' stamp on line 2 - not a vendor-sync.sh copy; re-vendor it", file=sys.stderr)
        return 1

    actual = body_hash(VENDORED)
    if actual != stamp:
        print(f"FAIL: vendored panelkit body hash {actual} != stamped hash {stamp} - the copy was hand-edited; re-run vendor-sync.sh (edits belong in the SSOT)", file=sys.stderr)
        return 1
    print(f"OK: vendored panelkit self-integrity - body matches stamp {stamp}")

    ssot_root = Path(os.environ.get("PANELKIT_SSOT_ROOT", str(DEFAULT_SSOT_ROOT)))
    ssot = ssot_root / "lib" / "panelkit.py"
    if not ssot.exists():
        print(f"SKIP: SSOT not present at {ssot} (no claude-config skill checkout here) - self-integrity is the effective gate")
        return 0

    ssot_hash = hashlib.sha256(ssot.read_bytes()).hexdigest()[:12]
    if actual != ssot_hash:
        print(f"FAIL: vendored panelkit {actual} != SSOT {ssot_hash} at {ssot} - SSOT moved; re-run vendor-sync.sh to refresh the copy", file=sys.stderr)
        return 1
    print(f"OK: vendored panelkit matches SSOT ({ssot_hash}) at {ssot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
