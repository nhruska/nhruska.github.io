---
description: Branch → commit → draft PR → tappable preview links → auto-watch the PR
argument-hint: [optional PR title / summary]
---

Ship the current working changes per the working agreement in CLAUDE.md.

1. **Branch.** If on `main`, create `claude/<short-slug>` from the change. Never
   commit to `main`.
2. **Verify first.** `node -c` every changed JS file; `JSON.parse` every changed
   JSON file; unit-test any new logic in Node. Note anything you could not
   verify (there's no headless browser).
3. **Commit.** Message explains the *why*; end with the session's Co-Authored-By
   and Claude-Session trailers.
4. **Push.** `git push -u origin <branch>` (retry with backoff on network errors).
5. **Draft PR.** Open a **draft** PR into `main` if none exists. Title from
   "$ARGUMENTS" or the change; body = why + what + how-verified. Keep it a draft.
6. **Preview.** Post tappable githack preview links for each instrument (see
   `/preview`) and the post-merge live URL.
7. **Watch.** Subscribe to the PR's activity and handle CI/review events until
   it's merged or closed.

**Never merge — that's Nik's call.** End with 3–5 ranked next steps, all links
tappable.
