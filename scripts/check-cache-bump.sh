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

# ---------------------------------------------------------------------
# INTER-COMMIT reuse (S-SW-PER-COMMIT, 2026-07-24): everything above only
# compares the branch TIP against the base, so a PR whose first commit
# bumps CACHE and whose follow-up commits change assets while HOLDING that
# same CACHE passes - tip differs from base, so nothing complains.
#
# That is not a theoretical gap. It cost two UAT rounds on PR #306: the
# operator had already installed the preview at the first build, the
# follow-up fixes shipped under the SAME cache version, and the service
# worker kept serving the FIRST build. The fix was heard as "not fixed"
# twice, because the device never received it.
#
# The rule the SW actually needs: every commit that changes a precached
# asset must ship a CACHE distinct from the previous asset-changing state.
# Walk the branch oldest-first, seeded with the base's CACHE, and fail on
# the first repeat.
#
# Merge commits are skipped (--no-merges): merging the base in is not a new
# build of this PR, and `git diff-tree` on a merge reports no single-parent
# diff anyway.
# ---------------------------------------------------------------------
PREV_CACHE="$BASE_CACHE"
PREV_REF="$BASE"
SEEN_CACHES=""      # every cache value already SHIPPED by an earlier asset-changing commit
TIP_CACHE=""        # cache of the newest asset-changing commit (what a device gets today)
TIP_REF=""
TIP_REPEAT_OF=""    # the earlier commit whose cache the tip reuses, if any
WARNED=0

while read -r sha; do
  [ -z "$sha" ] && continue
  touched="$(git diff-tree --no-commit-id --name-only -r "$sha" -- music/shared music/play || true)"
  [ -z "$touched" ] && continue
  cur_cache="$(extract_cache "$sha")"
  if [ -z "$cur_cache" ]; then
    echo "check-cache-bump: FAIL - could not extract CACHE from music/sw.js at $sha." >&2
    exit 1
  fi
  # Reuse of the version shipped by the PREVIOUS asset-changing commit is the
  # bug shape. Whether it is fatal depends on whether it is still LIVE (below).
  if [ "$cur_cache" = "$PREV_CACHE" ]; then
    if [ "$sha" != "$(git rev-parse HEAD)" ]; then
      echo "check-cache-bump: WARN - $(git log -1 --format=%h "$sha") changed precached assets while reusing $cur_cache from $(git log -1 --format=%h "$PREV_REF"). A device that installed the preview at that commit was served the older build until the next bump." >&2
      WARNED=1
    fi
    TIP_REPEAT_OF="$PREV_REF"
  else
    TIP_REPEAT_OF=""
  fi
  # An exact repeat of ANY earlier shipped version is also stale-serving, even
  # if the immediately-preceding commit differed (v1 -> v2 -> v1 reuses v1's
  # cache entry, which the SW already has populated with the OLD assets).
  case " $SEEN_CACHES " in
    *" $cur_cache "*) TIP_REPEAT_OF="${TIP_REPEAT_OF:-an earlier commit on this branch}" ;;
  esac
  SEEN_CACHES="$SEEN_CACHES $cur_cache"
  TIP_CACHE="$cur_cache"
  TIP_REF="$sha"
  PREV_CACHE="$cur_cache"
  PREV_REF="$sha"
done <<EOF
$(git rev-list --reverse --no-merges "$BASE"..HEAD)
EOF

# FAIL only when the reuse is STILL LIVE - i.e. the newest asset-changing
# commit ships a version an earlier one already shipped. That is the state a
# phone testing this PR is in right now: it holds the old assets under this
# exact cache key and will not refetch. An intermediate reuse that a later
# commit already superseded is a WARN above, not a merge blocker - the author
# cannot fix history without a force-push, and the tip is what devices fetch.
if [ -n "$TIP_REPEAT_OF" ]; then
  echo "check-cache-bump: FAIL - the newest asset-changing commit $(git log -1 --format=%h "$TIP_REF") ships $TIP_CACHE, which $( [ "$TIP_REPEAT_OF" = "an earlier commit on this branch" ] && echo "an earlier commit on this branch" || git log -1 --format=%h "$TIP_REPEAT_OF" ) already shipped." >&2
  echo "A device that installed this PR's preview keeps serving the EARLIER build under that same cache key - the fix reads as 'not working' on the phone (PR #306 cost two UAT rounds to exactly this)." >&2
  echo "Give this build its own version: music-v<PR#> for the first asset-changing commit, then -2, -3 ... for each later one (music/CLAUDE.md), and mirror it into $STAMP_PATH." >&2
  exit 1
fi

if [ "$WARNED" -eq 1 ]; then
  echo "check-cache-bump: (warnings above are historical - the branch tip is clean)" >&2
fi

# The version is a TRIPLE, not a pair, since 2026-09-03: sw.js CACHE +
# build-stamp VERSION + the ?v= on every local asset URL. The first two only
# govern the service worker, which is network-first and was never the problem -
# it was HTTP/CDN caches keyed on URLs that never changed, which served a new
# index.html alongside an old songbook.css AND an old build-stamp.js, so the
# stamp itself misreported the build. Check the third leg here, at the moment an
# author bumps, rather than letting them find out from a phone.
# Gate this leg on the app HTML actually being present: check-cache-bump.test.js
# exercises the script inside synthetic fixture repos that hold only sw.js and
# build-stamp.js, where there are no asset URLs to stamp and the companion
# script is not copied in. Skipping there keeps those fixtures meaningful.
# Deleting the stamper from the REAL repo does not slip through - it is spawned
# directly by test/asset-version-lint.test.js, which fails loudly.
STAMPER="$(dirname "$0")/stamp-asset-versions.py"
if [ -f "music/play/index.html" ] && [ -f "$STAMPER" ]; then
  if ! python3 "$STAMPER" --check; then
    echo "check-cache-bump: FAIL - the asset URLs do not carry $HEAD_STAMP_VER." >&2
    echo "Run: python3 scripts/stamp-asset-versions.py   (then re-stage)" >&2
    exit 1
  fi
fi

echo "check-cache-bump: OK - CACHE bumped ($BASE_CACHE -> $HEAD_CACHE) alongside the music/shared|play diff vs $BASE; build-stamp pair verified (VERSION $HEAD_STAMP_VER, UPDATED_ISO $HEAD_STAMP_ISO); asset URLs stamped; the tip does not reuse a version an earlier commit already shipped."
exit 0
