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
# Also guards the freshness-stamp pair (M-SETTINGS-CLARITY, 2026-07-05):
# music/shared/build-stamp.js VERSION must mirror sw.js CACHE exactly, and
# its UPDATED_ISO must change whenever CACHE bumps - see the stamp section
# at the bottom of this script.
#
# Usage: scripts/check-cache-bump.sh [base-ref]   (default: origin/main)
# Exit 0: no music/shared|play diff vs base, OR CACHE was bumped alongside it
#         AND the build-stamp pair moved with it.
# Exit 1: music/shared|play diff vs base with an UNCHANGED CACHE string, a
#         stamp VERSION that drifted from CACHE, or a stale UPDATED_ISO.
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

# ---------------------------------------------------------------------
# Freshness-stamp pair (M-SETTINGS-CLARITY, 2026-07-05): music/shared/
# build-stamp.js carries a deliberate, guard-locked mirror of the CACHE
# version (VERSION) plus the authoring time (UPDATED_ISO) that the app
# footer renders. THIS check is what makes the pair trustworthy:
#   (a) HEAD's build-stamp VERSION must equal HEAD's sw.js CACHE exactly -
#       a CACHE bump that forgets the stamp fails here, and so does a
#       stamp edit that forgets the CACHE.
#   (b) when the base ref already has the stamp file, UPDATED_ISO must
#       CHANGE alongside a CACHE bump - a bump with a stale date would
#       ship a footer that lies about freshness.
# ---------------------------------------------------------------------
STAMP_PATH='music/shared/build-stamp.js'

extract_stamp_field() {
  # $1 = git ref, $2 = field name (VERSION | UPDATED_ISO); prints the bare value.
  # `|| true` so a missing file / no match yields '' instead of tripping
  # set -e via pipefail - the callers' -z / -n guards do the deciding.
  git show "$1:$STAMP_PATH" 2>/dev/null | grep -oE "var $2 = '[^']+'" | head -1 | sed "s/var $2 = '//; s/'\$//" || true
}

HEAD_CACHE_VAL="$(printf '%s' "$HEAD_CACHE" | sed "s/CACHE = '//; s/'\$//")"
HEAD_STAMP_VER="$(extract_stamp_field HEAD VERSION)"
HEAD_STAMP_ISO="$(extract_stamp_field HEAD UPDATED_ISO)"

if [ -z "$HEAD_STAMP_VER" ] || [ -z "$HEAD_STAMP_ISO" ]; then
  echo "check-cache-bump: FAIL - could not extract VERSION/UPDATED_ISO from $STAMP_PATH at HEAD - has the declaration shape changed (or the file gone missing)?" >&2
  exit 1
fi

if [ "$HEAD_STAMP_VER" != "$HEAD_CACHE_VAL" ]; then
  echo "check-cache-bump: FAIL - $STAMP_PATH VERSION ($HEAD_STAMP_VER) does not mirror music/sw.js CACHE ($HEAD_CACHE_VAL)." >&2
  echo "Update VERSION and UPDATED_ISO in $STAMP_PATH in the same commit as the CACHE bump." >&2
  exit 1
fi

BASE_STAMP_ISO="$(extract_stamp_field "$BASE" UPDATED_ISO)"
if [ -n "$BASE_STAMP_ISO" ] && [ "$BASE_STAMP_ISO" = "$HEAD_STAMP_ISO" ]; then
  echo "check-cache-bump: FAIL - CACHE bumped ($BASE_CACHE -> $HEAD_CACHE) but $STAMP_PATH UPDATED_ISO is unchanged ($HEAD_STAMP_ISO)." >&2
  echo "Refresh UPDATED_ISO (and VERSION) in $STAMP_PATH in the same commit - the footer stamp must move with every shipped build." >&2
  exit 1
fi

echo "check-cache-bump: OK - CACHE bumped ($BASE_CACHE -> $HEAD_CACHE) alongside the music/shared|play diff vs $BASE; build-stamp pair verified (VERSION $HEAD_STAMP_VER, UPDATED_ISO $HEAD_STAMP_ISO)."
exit 0
