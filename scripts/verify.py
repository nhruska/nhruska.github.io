#!/usr/bin/env python3
# vendor-from: agent-config skills/verify-runtime/lib/verify.py 1.0.0
# vendor-hash: 323dc3c1aecc501b
# vendor-note: DO NOT EDIT - re-sync from the SSOT; check with vendor-sync.sh <this> --check
"""
verify.py - agent-drivable verification runtime (SSOT, vendored per repo).

One command an agent runs to check its own change end to end and read back a
STRUCTURED verdict, so it can loop until green without a human relaying output.
Driven entirely by a per-repo manifest (.verify/manifest.json): the repo
declares its runtime, its always-on gates, and a FEATURE MAP (features ->
source globs -> checks + HTTP probes). This file never hardcodes a repo.

Subcommands (all print JSON on stdout; human summary on stderr):
  map                     the feature map + coverage counts
  plan  [selection]       which gates/checks/probes WOULD run, without running
  run   [selection]       run them; write .verify/run/verdict.json
  up / down / state       start / stop / inspect the isolated runtime
  lint  [--coverage]      validate the manifest; --coverage ratchets unmapped files

Selection: --changed [REF] (default) | --feature ID (repeatable) | --all

Exit codes: 0 pass, 1 verdict fail, 2 manifest/config/runtime error.
Stdlib only. Vendored copies carry a stamp line; see SKILL.md.
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path

VERIFY_VERSION = "1.0.0"
MANIFEST_SCHEMA = "verify-manifest/1"
VERDICT_SCHEMA = "verify-verdict/1"
TAIL_LINES = 30


class ConfigError(Exception):
    """Manifest or environment problem - exit 2, never a verdict."""


# ---------------------------------------------------------------- utilities

def sh(cmd: list[str], cwd: Path) -> str:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def git_root(start: Path) -> Path:
    out = sh(["git", "rev-parse", "--show-toplevel"], start)
    if not out:
        raise ConfigError(f"not a git repository: {start}")
    return Path(out)


def glob_to_regex(pattern: str) -> re.Pattern:
    """Gitignore-flavoured glob: ** spans dirs, * and ? stay within a segment."""
    i, out = 0, ""
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
            continue
        if pattern.startswith("**", i):
            out += ".*"
            i += 2
            continue
        out += {"*": "[^/]*", "?": "[^/]"}.get(c, re.escape(c))
        i += 1
    return re.compile(out + r"\Z")


def matches(path: str, globs: list[str]) -> bool:
    return any(glob_to_regex(g).match(path) for g in globs)


def tail(text: str, n: int = TAIL_LINES) -> str:
    return "\n".join(text.splitlines()[-n:])


# ---------------------------------------------------------------- manifest

def load_manifest(root: Path, path: str | None) -> tuple[dict, Path]:
    mp = Path(path) if path else root / ".verify" / "manifest.json"
    if not mp.is_absolute():
        mp = root / mp
    if not mp.exists():
        raise ConfigError(f"manifest not found: {mp}")
    try:
        m = json.loads(mp.read_text())
    except json.JSONDecodeError as e:
        raise ConfigError(f"manifest is not valid JSON: {e}") from e
    problems = lint_manifest(m)
    if problems:
        raise ConfigError("manifest invalid:\n  - " + "\n  - ".join(problems))
    return m, mp


def _check_unit(u: dict, where: str, problems: list[str], kind: str) -> None:
    if not isinstance(u, dict) or not u.get("id"):
        problems.append(f"{where}: {kind} needs an 'id'")
        return
    if kind == "check" and not u.get("cmd"):
        problems.append(f"{where}/{u['id']}: check needs 'cmd'")
    if kind == "probe":
        if not isinstance(u.get("http"), dict) or not u["http"].get("path"):
            problems.append(f"{where}/{u['id']}: probe needs http.path")
        exp = u.get("expect") or {}
        if "status" not in exp:
            problems.append(f"{where}/{u['id']}: probe needs expect.status "
                            "(a body is never read before its status)")
        if not any(k in exp for k in ("contains", "json")):
            problems.append(f"{where}/{u['id']}: probe needs a POSITIVE marker "
                            "(expect.contains or expect.json) - a bare status proves nothing")


def lint_manifest(m: dict) -> list[str]:
    p: list[str] = []
    if m.get("schema") != MANIFEST_SCHEMA:
        p.append(f"schema must be '{MANIFEST_SCHEMA}'")
    if not m.get("app"):
        p.append("'app' is required")
    rt = m.get("runtime")
    if rt is not None:
        if not (rt.get("up") or {}).get("cmd"):
            p.append("runtime.up.cmd is required when runtime is declared")
        if not (rt.get("ready") or {}).get("path"):
            p.append("runtime.ready.path is required (readiness is observed, not assumed)")
    seen: set[str] = set()
    for g in m.get("gates", []):
        _check_unit(g, "gates", p, "check")
        if g.get("id") in seen:
            p.append(f"duplicate gate id {g.get('id')}")
        seen.add(g.get("id"))
    feats = m.get("features")
    if not isinstance(feats, list) or not feats:
        p.append("'features' must be a non-empty list (the feature map)")
        feats = []
    fids: set[str] = set()
    for f in feats:
        fid = f.get("id")
        if not fid:
            p.append("feature needs 'id'")
            continue
        if fid in fids:
            p.append(f"duplicate feature id {fid}")
        fids.add(fid)
        if not f.get("paths"):
            p.append(f"feature {fid}: 'paths' globs required (how a change maps to it)")
        if not f.get("checks") and not f.get("probes"):
            p.append(f"feature {fid}: needs at least one check or probe")
        for c in f.get("checks", []):
            _check_unit(c, f"feature {fid}", p, "check")
        for pr in f.get("probes", []):
            _check_unit(pr, f"feature {fid}", p, "probe")
        if (f.get("probes") or any(c.get("needs_runtime") for c in f.get("checks", []))) and not rt:
            p.append(f"feature {fid}: uses the runtime but no 'runtime' is declared")
    return p


# ---------------------------------------------------------------- context

def build_ctx(root: Path, m: dict) -> dict:
    rt = m.get("runtime") or {}
    if os.environ.get("VERIFY_PORT"):
        port = int(os.environ["VERIFY_PORT"])
    elif rt.get("port"):
        port = int(rt["port"])
    else:
        base, span = int(rt.get("port_base", 18000)), int(rt.get("port_span", 1000))
        # Deterministic per worktree: N agents in N worktrees never collide on the
        # same port, and one worktree always gets the same one back.
        port = base + zlib.crc32(str(root).encode()) % span
    run_dir = root / ".verify" / "run"
    wid = hashlib.sha1(str(root).encode()).hexdigest()[:8]
    return {"root": str(root), "port": str(port), "run_dir": str(run_dir),
            "worktree_id": wid, "url": f"http://127.0.0.1:{port}"}


def subst(s: str, ctx: dict) -> str:
    return re.sub(r"\{(root|port|run_dir|worktree_id|url|sha)\}",
                  lambda mo: ctx.get(mo.group(1), mo.group(0)), s)


def env_for(unit: dict, m: dict, ctx: dict) -> dict:
    env = dict(os.environ)
    rt = m.get("runtime") or {}
    for k, v in {**rt.get("env", {}), **unit.get("env", {})}.items():
        env[k] = subst(str(v), ctx)
    env.update({"VERIFY_PORT": ctx["port"], "VERIFY_URL": ctx["url"],
                "VERIFY_RUN_DIR": ctx["run_dir"]})
    return env


# ---------------------------------------------------------------- selection

def changed_files(root: Path, ref: str) -> list[str]:
    if not sh(["git", "rev-parse", "--verify", "--quiet", ref], root):
        raise ConfigError(f"base ref '{ref}' does not resolve - fetch it "
                          "(an unresolvable base would silently select nothing)")
    files: set[str] = set()
    for cmd in (["git", "diff", "--name-only", f"{ref}...HEAD"],
                ["git", "diff", "--name-only"],
                ["git", "diff", "--name-only", "--cached"],
                ["git", "ls-files", "--others", "--exclude-standard"]):
        files.update(x for x in sh(cmd, root).splitlines() if x)
    return sorted(f for f in files if not f.startswith(".verify/run/"))


def select(root: Path, m: dict, args) -> dict:
    feats = {f["id"]: f for f in m["features"]}
    ignore = m.get("ignore", []) + [".verify/run/**"]
    sel = {"mode": "", "base": None, "changed_files": [], "features": [],
           "unmapped_files": []}
    if args.all:
        sel["mode"], sel["features"] = "all", list(feats)
    elif args.feature:
        unknown = [f for f in args.feature if f not in feats]
        if unknown:
            raise ConfigError(f"unknown feature id(s): {unknown}; see `verify map`")
        sel["mode"], sel["features"] = "feature", list(args.feature)
    else:
        ref = args.changed or m.get("base", "origin/main")
        files = changed_files(root, ref)
        hit: list[str] = []
        for fid, f in feats.items():
            if any(matches(x, f["paths"]) for x in files):
                hit.append(fid)
        sel.update(mode="changed", base=ref, changed_files=files, features=hit,
                   unmapped_files=[x for x in files
                                   if not matches(x, ignore)
                                   and not any(matches(x, f["paths"]) for f in feats.values())])
    return sel


def units_for(m: dict, sel: dict) -> list[dict]:
    feats = {f["id"]: f for f in m["features"]}
    units = [{**g, "kind": "gate", "qid": f"gate/{g['id']}"} for g in m.get("gates", [])]
    for fid in sel["features"]:
        f = feats[fid]
        units += [{**c, "kind": "check", "feature": fid, "qid": f"{fid}/{c['id']}"}
                  for c in f.get("checks", [])]
        units += [{**p, "kind": "probe", "feature": fid, "qid": f"{fid}/{p['id']}"}
                  for p in f.get("probes", [])]
    return units


# ---------------------------------------------------------------- runtime

def _state_path(ctx: dict) -> Path:
    return Path(ctx["run_dir"]) / "runtime.json"


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def http(ctx: dict, spec: dict, timeout: float = 10.0) -> dict:
    url = ctx["url"] + subst(spec["path"], ctx)
    req = urllib.request.Request(url, method=spec.get("method", "GET"),
                                 headers={k: subst(v, ctx) for k, v in spec.get("headers", {}).items()})
    body = spec.get("body")
    data = json.dumps(body).encode() if isinstance(body, (dict, list)) else (body.encode() if body else None)
    if data is not None and isinstance(body, (dict, list)):
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            return {"status": r.status, "body": r.read().decode(errors="replace"),
                    "content_type": r.headers.get("Content-Type", ""), "url": url}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": e.read().decode(errors="replace"),
                "content_type": e.headers.get("Content-Type", ""), "url": url}
    except (urllib.error.URLError, OSError) as e:
        return {"status": None, "body": "", "error": str(e), "url": url}


def ready(ctx: dict, m: dict) -> bool:
    r = m["runtime"]["ready"]
    res = http(ctx, r, timeout=5)
    ok = res["status"] in r.get("status", [200])
    if ok and r.get("contains"):
        ok = subst(r["contains"], ctx) in res["body"]
    return ok


def runtime_up(root: Path, m: dict, ctx: dict) -> dict:
    rt = m["runtime"]
    Path(ctx["run_dir"]).mkdir(parents=True, exist_ok=True)
    sp = _state_path(ctx)
    if sp.exists():
        st = json.loads(sp.read_text())
        if _alive(st["pid"]) and ready(ctx, m):
            return {**st, "reused": True}
    if ready(ctx, m):
        raise ConfigError(f"port {ctx['port']} already answers but was not started by "
                          "this worktree - set VERIFY_PORT or stop the other server "
                          "(verifying against someone else's server proves nothing)")
    log = open(Path(ctx["run_dir"]) / "runtime.log", "w")
    t0 = time.time()
    proc = subprocess.Popen(subst(rt["up"]["cmd"], ctx), shell=True,
                            cwd=root / rt["up"].get("cwd", "."), env=env_for(rt["up"], m, ctx),
                            stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    deadline = t0 + float(rt["ready"].get("timeout_s", 90))
    while time.time() < deadline:
        if proc.poll() is not None:
            raise ConfigError(f"runtime exited {proc.returncode} before ready; see "
                              f"{ctx['run_dir']}/runtime.log:\n"
                              + tail(Path(log.name).read_text(), 15))
        if ready(ctx, m):
            st = {"pid": proc.pid, "port": int(ctx["port"]), "url": ctx["url"],
                  "started_at": t0, "ready_s": round(time.time() - t0, 2),
                  "log": log.name, "reused": False}
            sp.write_text(json.dumps(st))
            return st
        time.sleep(0.5)
    _kill(proc.pid)
    raise ConfigError(f"runtime not ready within {rt['ready'].get('timeout_s', 90)}s; "
                      f"see {log.name}:\n" + tail(Path(log.name).read_text(), 15))


def _kill(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGTERM)
        for _ in range(20):
            if not _alive(pid):
                return
            time.sleep(0.25)
        os.killpg(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def runtime_down(m: dict, ctx: dict) -> dict:
    sp = _state_path(ctx)
    if not sp.exists():
        return {"stopped": False, "reason": "no runtime started by this worktree"}
    st = json.loads(sp.read_text())
    if m.get("runtime", {}).get("down", {}).get("cmd"):
        subprocess.run(subst(m["runtime"]["down"]["cmd"], ctx), shell=True,
                       env=env_for(m["runtime"]["down"], m, ctx))
    _kill(st["pid"])
    sp.unlink()
    return {"stopped": True, "pid": st["pid"]}


# ---------------------------------------------------------------- execution

def json_get(obj, dotted: str):
    for part in dotted.split("."):
        if isinstance(obj, list) and part.isdigit():
            obj = obj[int(part)]
        elif isinstance(obj, dict) and part in obj:
            obj = obj[part]
        else:
            raise KeyError(dotted)
    return obj


def run_probe(u: dict, ctx: dict) -> dict:
    t0 = time.time()
    res = http(ctx, u["http"], timeout=float(u.get("timeout_s", 15)))
    exp, fails = u["expect"], []
    want = exp["status"] if isinstance(exp["status"], list) else [exp["status"]]
    if res["status"] not in want:
        fails.append(f"status {res['status']} not in {want}" + (f" ({res['error']})" if res.get("error") else ""))
    else:  # body is evidence only once the status is the one we asked for
        if exp.get("contains") and subst(exp["contains"], ctx) not in res["body"]:
            fails.append(f"body lacks {subst(exp['contains'], ctx)!r}")
        if exp.get("json"):
            try:
                doc = json.loads(res["body"])
                for k, v in exp["json"].items():
                    got = json_get(doc, k)
                    v = subst(v, ctx) if isinstance(v, str) else v
                    if v == "*":
                        continue
                    if got != v:
                        fails.append(f"json {k}={got!r}, expected {v!r}")
            except (json.JSONDecodeError, KeyError) as e:
                fails.append(f"json assertion unreadable: {e}")
    return {"status": "fail" if fails else "pass", "http_status": res["status"],
            "url": res["url"], "failures": fails, "duration_s": round(time.time() - t0, 2),
            "tail": tail(res["body"], 10) if fails else ""}


def run_check(u: dict, root: Path, m: dict, ctx: dict) -> dict:
    logs = Path(ctx["run_dir"]) / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    logp = logs / (u["qid"].replace("/", "__") + ".log")
    t0 = time.time()
    try:
        r = subprocess.run(subst(u["cmd"], ctx), shell=True, cwd=root / u.get("cwd", "."),
                           env=env_for(u, m, ctx), capture_output=True, text=True,
                           timeout=float(u.get("timeout_s", 600)))
        out, code = r.stdout + r.stderr, r.returncode
        status = "pass" if code == 0 else "fail"
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        code, status = 124, "timeout"
    logp.write_text(out)
    return {"status": status, "exit_code": code, "duration_s": round(time.time() - t0, 2),
            "log": str(logp.relative_to(root)), "tail": tail(out) if status != "pass" else ""}


def run(root: Path, m: dict, mp: Path, ctx: dict, sel: dict, args) -> dict:
    units = units_for(m, sel)
    needs_rt = any(u["kind"] == "probe" or u.get("needs_runtime") for u in units)
    rt_info, started_here, results = None, False, []
    t0 = time.time()
    try:
        if needs_rt:
            rt_info = runtime_up(root, m, ctx)
            started_here = not rt_info.get("reused")
        for u in units:  # sequential on purpose: one heavy process at a time
            base = {"id": u["qid"], "kind": u["kind"], "feature": u.get("feature"),
                    "goalpost": bool(u.get("goalpost"))}
            if args.fail_fast and any(r["status"] in ("fail", "timeout") and not r["goalpost"]
                                      for r in results):
                results.append({**base, "status": "skip", "reason": "fail-fast"})
                continue
            res = run_probe(u, ctx) if u["kind"] == "probe" else run_check(u, root, m, ctx)
            if base["goalpost"] and res["status"] != "pass":
                res["status"] = "red"  # an open goalpost: the spec, not a regression
            results.append({**base, **res})
            print(f"  {res['status'].upper():7} {u['qid']} ({res['duration_s']}s)", file=sys.stderr)
    finally:
        if started_here and not args.keep:
            runtime_down(m, ctx)
    counts: dict[str, int] = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    failing = [r["id"] for r in results if r["status"] in ("fail", "timeout")]
    strict_unmapped = args.strict and sel["unmapped_files"]
    empty = not results
    verdict = "fail" if failing or strict_unmapped or empty else "pass"
    return {
        "schema": VERDICT_SCHEMA, "verify_version": VERIFY_VERSION, "app": m["app"],
        "sha": sh(["git", "rev-parse", "HEAD"], root),
        "dirty": bool(sh(["git", "status", "--porcelain"], root)),
        "manifest": {"path": str(mp.relative_to(root)),
                     "sha256": hashlib.sha256(mp.read_bytes()).hexdigest()[:16]},
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t0)),
        "duration_s": round(time.time() - t0, 2),
        "selection": sel,
        "runtime": rt_info,
        "results": results,
        "summary": counts,
        "failing": failing,
        "open_goalposts": [r["id"] for r in results if r["status"] == "red"],
        "verdict": verdict,
        "verdict_reason": ("no units selected - nothing was verified" if empty else
                           f"{len(failing)} failing" if failing else
                           "unmapped changed files under --strict" if strict_unmapped else
                           "all selected units passed"),
    }


# ---------------------------------------------------------------- coverage

def coverage(root: Path, m: dict) -> dict:
    ignore = m.get("ignore", [])
    tracked = [x for x in sh(["git", "ls-files"], root).splitlines() if x]
    unmapped = sorted(x for x in tracked if not matches(x, ignore)
                      and not any(matches(x, f["paths"]) for f in m["features"]))
    per = {f["id"]: sum(1 for x in tracked if matches(x, f["paths"])) for f in m["features"]}
    return {"tracked": len(tracked), "unmapped": unmapped, "per_feature_files": per}


# ---------------------------------------------------------------- cli

def emit(obj: dict, out: str | None) -> None:
    text = json.dumps(obj, indent=2, default=str)
    if out:
        Path(out).write_text(text + "\n")
    print(text)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="verify", description=__doc__.split("\n\n")[0])
    ap.add_argument("--manifest")
    ap.add_argument("--root", default=".")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("plan", "run"):
        s = sub.add_parser(name)
        g = s.add_mutually_exclusive_group()
        g.add_argument("--changed", nargs="?", const=None, default=None, metavar="REF")
        g.add_argument("--feature", action="append")
        g.add_argument("--all", action="store_true")
        s.add_argument("--strict", action="store_true", help="fail on unmapped changed files")
        if name == "run":
            s.add_argument("--keep", action="store_true", help="leave the runtime up")
            s.add_argument("--fail-fast", action="store_true")
            s.add_argument("--json", help="also write the verdict here")
    for name in ("map", "up", "down", "state"):
        sub.add_parser(name)
    li = sub.add_parser("lint")
    li.add_argument("--coverage", action="store_true")
    li.add_argument("--write-baseline", action="store_true")
    args = ap.parse_args(argv)

    try:
        root = git_root(Path(args.root).resolve())
        m, mp = load_manifest(root, args.manifest)
        ctx = build_ctx(root, m)
        ctx["sha"] = sh(["git", "rev-parse", "HEAD"], root)
        if args.cmd == "map":
            emit({"schema": "verify-feature-map/1", "app": m["app"],
                  "features": [{k: f.get(k) for k in ("id", "title", "paths", "how")}
                               | {"checks": [c["id"] for c in f.get("checks", [])],
                                  "probes": [p["id"] for p in f.get("probes", [])]}
                               for f in m["features"]],
                  "gates": [g["id"] for g in m.get("gates", [])],
                  "coverage": {k: (len(v) if k == "unmapped" else v)
                               for k, v in coverage(root, m).items()}}, None)
            return 0
        if args.cmd == "lint":
            out = {"manifest": "ok", "problems": []}
            rc = 0
            if args.coverage:
                cov = coverage(root, m)
                bp = root / ".verify" / "unmapped-baseline.txt"
                if args.write_baseline:
                    bp.write_text("\n".join(cov["unmapped"]) + ("\n" if cov["unmapped"] else ""))
                base = set(bp.read_text().split()) if bp.exists() else set()
                new = [x for x in cov["unmapped"] if x not in base]
                stale = sorted(base - set(cov["unmapped"]))
                out.update(unmapped=len(cov["unmapped"]), baseline=len(base),
                           new_unmapped=new, baseline_can_shrink=stale)
                rc = 1 if new else 0
            emit(out, None)
            return rc
        if args.cmd == "up":
            emit(runtime_up(root, m, ctx), None)
            return 0
        if args.cmd == "down":
            emit(runtime_down(m, ctx), None)
            return 0
        if args.cmd == "state":
            st = json.loads(_state_path(ctx).read_text()) if _state_path(ctx).exists() else None
            probes = {p["id"]: run_probe(p, ctx) for p in m.get("state", [])} if st else {}
            emit({"runtime": st, "alive": bool(st and _alive(st["pid"])),
                  "url": ctx["url"], "state": probes}, None)
            return 0
        sel = select(root, m, args)
        if args.cmd == "plan":
            emit({"selection": sel, "units": [{"id": u["qid"], "kind": u["kind"],
                                               "goalpost": bool(u.get("goalpost"))}
                                              for u in units_for(m, sel)]}, None)
            return 0
        verdict = run(root, m, mp, ctx, sel, args)
        Path(ctx["run_dir"]).mkdir(parents=True, exist_ok=True)
        (Path(ctx["run_dir"]) / "verdict.json").write_text(json.dumps(verdict, indent=2, default=str))
        emit(verdict, args.json)
        print(f"verify: {verdict['verdict'].upper()} - {verdict['verdict_reason']} "
              f"{verdict['summary']}", file=sys.stderr)
        return 0 if verdict["verdict"] == "pass" else 1
    except ConfigError as e:
        emit({"schema": VERDICT_SCHEMA, "verdict": "error", "error": str(e)}, None)
        print(f"verify: ERROR - {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
