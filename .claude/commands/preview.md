---
description: Tappable githack preview links for the current branch (no merge needed)
---

Give Nik tappable preview links for the current branch so he can check it on his
phone over https (the mic tuner needs a secure context; githack provides one).

1. Get the current HEAD commit SHA: `git rev-parse HEAD`.
2. Build links of the form
   `https://raw.githack.com/nhruska/nhruska.github.io/<SHA>/music/play/?p=<profile>`
   for `guitar-standard`, `ukulele-gcea`, and `mandolin-gdae`.
3. Present them as **tappable markdown hyperlinks**, not code.
4. Note the post-merge live URL:
   [nhruska.github.io/music/play/](https://nhruska.github.io/music/play/).

Use the commit **SHA** (unambiguous) rather than the branch name — slashes in
branch names break the githack path. The same links are also posted
automatically on every PR by `.github/workflows/pr-preview.yml`.
