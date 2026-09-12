# Branch prototypes - feel a variant on the phone before choosing it

> This app is static, no build, and every branch gets a live githack URL the
> moment it is pushed. That makes a branch the cheapest prototype there is:
> real app, real data, real phone, real thumb - not a mockup. Cut a branch per
> variant, push, tap, compare, keep one, delete the rest. The loop costs
> nothing and repeats forever. Operator, 2026-09-12: "we can branch as much as
> we want for free... and commit... and test on githack... and delete branches...
> and loop repeats."

[Index](../index.md) > workflows > branch prototypes

## When to reach for it

| Use it | Do not use it |
|---|---|
| A FEEL call: motion, timing, layout, an interaction grammar (the tuner runway, a swipe threshold, a landing animation) | A correctness call - that is a test, not a taste pass |
| Two or three plausible designs and the operator's thumb is the only oracle | One obvious design - just build it |
| Anything a screenshot cannot carry (animation, haptics, audio timing) | Static copy or colour - a screenshot in the PR is enough |

## The loop

1. **Base branch first.** The PR branch carries the shared machinery (the
   state machine, the detector, the test hook). Variants change ONLY the feel
   layer on top of it, so they stay small and comparable.
2. **One branch per variant**, named `claude/<feature>-v<letter>-<slug>`
   (`claude/tuner-runway-vA-puck`, `-vB-arc`, `-vC-climb`). Cut each from the
   PR branch, not from main.
3. **Make the variant demoable with no setup.** A URL flag that drives the
   production code path with synthetic input - the tuner's `?tunerdemo=1`
   runs the whole guided loop through `Tuner._sim`, so the runway animates
   before the mic is even granted. A variant that needs a real instrument to
   compare is a variant nobody compares.
4. **Push, do not open PRs for variants.** Each variant's COMMIT-pinned
   githack URL is the deliverable:
   `https://raw.githack.com/nhruska/nhruska.github.io/<full-sha>/music/play/?p=guitar-standard&tunerdemo=1`.
   Commit, not branch: the branch path is CDN-cached and can show the
   previous push for minutes, which is exactly the wrong failure when three
   variants are being compared side by side. Post the 2-3 links in ONE
   message with one line each on what differs. The PR-preview workflow
   only fires on PRs, which is right - variants are not PRs.
5. **Cache-bump every variant** (`music-v<PR#>-<n>`, stamp pair, restamp).
   The service worker and the CDN key on version; two variants under one
   version show the operator the FIRST one twice, and the comparison is void.
   Since variants are branches off the PR, give each its own suffix letter:
   `music-v348-4a`, `-4b`, `-4c` - distinct strings, and the gate only needs
   distinctness within a branch.
6. **The operator picks by thumb**, one word. Merge the winner's diff into
   the PR branch (cherry-pick or merge), delete the other branches. Record
   the pick and the one-line why in the design doc's interview table - the
   losing variants do not need to survive anywhere else.
7. **A variant that answers a NEW question** (the operator says "what if it
   also...") is a new row in QUEUE.md, not a fourth branch on the spot.

## Why not a Claude artifact / mock

A mock proves the picture. The phone proves the FEEL: the real smoothing,
the real 60 fps loop, the real tap targets under a real thumb, the real
cache. The operator's own words: artifacts are "smoke and mirrors" next to
a branch that IS the app. Keep prototyping where the product runs.

## Related

- [dev-verify-ship.md](dev-verify-ship.md) - the githack preview policy this rides on
- [systems/tuner.md](../systems/tuner.md) - `Tuner._sim` + `?tunerdemo=1`, the first demoable feel layer
- [testing.md](testing.md) - the scenario that proves the loop the variants sit on
