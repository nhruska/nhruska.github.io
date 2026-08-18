---
description: Compose a key-coherent progression for a stated goal and emit the Music-app jam deep link
argument-hint: <goal - e.g. "a folk verse in G" or "something to jam over like the Axis progression">
---

Compose a progression for: $ARGUMENTS

Pick the proven pattern via `songwriting-coach` (name the family and why it
fits the stated genre/section - never invent a "theory-true but song-false"
progression). Confirm chord choices and any modal color against
`music-theory-coach` before finalizing.

Then emit the deep link per the `music-interchange` skill's "Emitting a jam
deep link" rules:

- `jam=` the progression as comma-separated CANONICAL-SHARP tokens, with every `#` percent-encoded (`F#m` -> `F%23m` - a raw `#` truncates the URL and can load a wrong jam). Decode your final URL and confirm every chord survived before emitting.
- `key=` the tonic, unrespelled.
- `yt=` only if you can state a real video id/URL for a genuinely matching
  backing track AND its key - never invent one; omit the param otherwise.
- `name=` a short label for the Save form.

Base URL: `https://nhruska.github.io/music/play/`.

Output: the progression (roman + chord tokens), a one-line why (the proven
family + section fit), and the tappable deep link as a markdown link - never
inside backticks or a code block (the user taps it on a phone). Remind the
user the jam is ephemeral until they tap Save in the app.
