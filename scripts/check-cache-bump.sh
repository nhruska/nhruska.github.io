#!/usr/bin/env bash
# =====================================================================
# check-cache-bump.sh - S-HARDEN A6 (analysis-refactor-enhance-20260704)
# -----------------------------------------------------------------------
# Guards against the v83/v84 collision (PR #117): two missions each bumped
# CACHE while both touching music/shared/ files, and one bump landed as a
# byte-identical CACHE string to a change that should have forced a fresh
# precache - so already-installed users silently kept serving stale files
# until they manually cleared the cache. Compares HEAD against a base ref
# (default origin/main): if music/shared/** or music/play/** differ but
# music/sw.js's CACHE string is IDENTICAL between the two, that is exactly
# this collision shape - fail loudly instead of letting it merge silently.
#
# Usage: scripts/check-cache-bump.sh [base-ref]   (default: origin/main)
# Exit 0: no music/shared|play diff vs base, OR CACHE was bumped alongside it.
# Exit 1: music/shared|play diff vs base with an UNCHANGED CACHE string.
#
# Run manually before opening/updating a PR that touches music/shared or
# music/play (the "the law" CACHE-bump discipline - see
# music/engineering-wiki/systems/offline-pwa.md). Needs git history a unit
# test doesn't have, so it is NOT wired into node test/run-all.js - see
# test/sw-verify.test.js for the CORE-shape checks that DO run in the
# normal suite (every CORE path exists on disk; every shared/*.js
# <script src> tag is precached).
#
# Assumes the base ref is already fetched locally (per
# rules/pre-pr-ci-parity.md: `git fetch origin <base>` before comparing) -
# this script does not fetch on its own.
# =====================================================================
set -euo pipefail

BASE="${1:-origin/main}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "check-cache-bump: base ref '$BASE' not found locally - try 'git fetch origin main' first." >&2
  exit 1
fi

# 3-dot diff (vs the merge-base), matching the repo's own PR-diff-scope
# convention: a direct 2-dot diff against a stale local base would false-
# alarm on unrelated commits main picked up after this branch forked.
DIFF_FILES="$(git diff --name-only "$BASE"...HEAD -- music/shared music/play || true)"

if [ -z "$DIFF_FILES" ]; then
  echo "check-cache-bump: no music/shared or music/play changes vs $BASE - nothing to guard."
  exit 0
fi

extract_cache() {
  # $1 = git ref
  git show "$1:music/sw.js" 2>/dev/null | grep -oE "CACHE = '[^']+'" | head -1
}

BASE_CACHE="$(extract_cache "$BASE")"
HEAD_CACHE="$(extract_cache HEAD)"

if [ -z "$BASE_CACHE" ] || [ -z "$HEAD_CACHE" ]; then
  echo "check-cache-bump: could not extract CACHE from music/sw.js at $BASE or HEAD - has the declaration shape changed?" >&2
  exit 1
fi

if [ "$BASE_CACHE" = "$HEAD_CACHE" ]; then
  echo "check-cache-bump: FAIL - music/shared or music/play changed vs $BASE but CACHE is unchanged ($HEAD_CACHE)." >&2
  echo "Changed files:" >&2
  echo "$DIFF_FILES" | sed 's/^/  /' >&2
  echo "Bump CACHE in music/sw.js in the same commit (the v83/v84 collision this guards against - PR #117)." >&2
  exit 1
fi

echo "check-cache-bump: OK - CACHE bumped ($BASE_CACHE -> $HEAD_CACHE) alongside the music/shared|play diff vs $BASE."
exit 0
