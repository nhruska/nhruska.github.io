# Audition-first composing: what the circle-of-fifths chord strip got right

> Operator, 2026-09-02: "the chords shown under the circle of fifths have been a
> surprisingly nice tool for me to write progressions before using compose tab.
> what is the pattern here we can enable?"

Consulted: songwriting-coach (proven families), music-theory-coach (the strip is
already theory-correct by construction), ux-coach (why the calm matters).

## The diagnosis: it is a PALETTE, not a canvas

The Studio's "Chords in this key - tap to hear" strip beats Compose for sketching
because of four properties Compose does not have:

| Property | Why it frees you |
|---|---|
| **Zero commitment per tap** | A tap makes a SOUND and changes nothing else. No slot filled, no delete handle to manage, no undo to think about. The cost of a wrong guess is zero, so you guess freely. Compose is commit-first: tap = a chord lands in the progression, and hearing is a side effect. |
| **Seven chips, all correct** | Everything on screen is in-key by construction. No All-vs-In-key pin, no mode picker, no filtering. The CONSTRAINT is the creative aid - you choose by ear, never by theory. |
| **Auditioned against a live context** | You are in the Studio with the key established (often a jam playing). You hear each candidate against the thing you are actually playing over, not in a vacuum. |
| **The circle sits directly above** | The spatial map and the audible palette are co-present, so WHY a chord belongs is visible while you hear it. |

**The pattern, named: audition-first composing.** Hear -> choose -> *then* commit.
Compose today is commit-first. That inversion is the whole finding.

## The gap this exposes

`renderChordChips()` (tracks.js) plays the chord and targets the fretboard - and
then **throws the tap away**. The operator is producing a real artifact (an
ordered sequence of chords he chose by ear) and the app captures none of it. He
then re-enters it by hand in Compose. That is the friction, and it is pure loss.

## What to enable (ranked)

### 1. TAP-TRAIL CAPTURE - "keep what you just played" (recommended, small)
Silently remember the last N chord chips tapped, in order. Once 2+ exist, a quiet
affordance appears: **"Keep these 4 -> Compose"**, handing the sequence straight
into Compose as a seeded progression (the `seedKey` bridge already exists).
Changes nothing about how the strip feels - it just stops discarding his work.
Trail clears on key change / Studio close; never persisted, never in the way.

### 2. NAME THE PATTERN HE STUMBLED INTO (the delightful half)
As the trail forms, match it against songwriting-coach's proven-families table
(Axis I-V-vi-IV, 50s I-vi-IV-V, folk cadence I-IV-V, minor axis i-bVI-bIII-bVII,
Andalusian, ii-V-I...) using `Circle.romanFor` for degree analysis - never
eyeballed intervals. When it matches, say so in one line ("that is the Axis loop")
and offer the canonical completion. This teaches while he plays, which is the
compounding move: the app gets better at making HIM better, not just at storing
chords.

### 3. NEXT-CHORD EMPHASIS ON THE STRIP - carefully (enhancement)
The suggestion engine (`suggestNext`) already ranks what commonly follows a chord,
and PR #342 shipped the `sugg-reco` emphasis marker. The strip could hint the
likely next chords after each tap.
**Hard constraint: emphasis ONLY, never reordering.** The strip works partly
because those seven chips never move - spatial memory is what makes it calm
(ux-coach: recognition over recall). A palette that re-sorts under his fingers
would destroy the exact property that made him prefer it.

### 4. AUDITION MODE IN COMPOSE (operator's call - a vision question)
The deeper fix is to lower Compose's commit-cost: tap = hear, and a second
deliberate act (long-press, or a + on the chip) commits. That changes Compose's
core interaction model, so it is a taste/vision decision the operator owns, not
an implementation detail. Flagged, not assumed.

## Recommendation

Build 1 + 2 together - they are one coherent feature ("catch the sketch, name
it"), they need no change to the strip's feel, and they convert an existing habit
into shipped songs. Hold 3 to emphasis-only. Ask before 4.

---

## OPERATOR DECISION, 2026-09-17

Verbatim: **"it should be in the compose section - or move users into compose"**

That answers the open question flagged in item 4, and it picks a side on the one
thing this doc could not decide for itself: **where audition-first lives.**

The answer is Compose, not a second sketching surface bolted onto the Studio
strip. Two readings of "or move users into compose", and both land in the same
place:

| Reading | What it means to build |
|---|---|
| **Audition belongs to Compose** | Item 4 is promoted from "ask first" to the chosen direction: lower Compose's commit-cost so tap = hear and a second deliberate act commits. Compose becomes the palette it should have been. |
| **The Studio strip is a doorway, not a destination** | Item 1's tap-trail stays valuable, but its job is explicitly to HAND OFF - "Keep these 4 -> Compose" moves him into Compose with the sketch already seeded, rather than growing sketching features where he happened to start. |

**What this rules out:** building a parallel composing surface inside the Studio.
The strip stays a palette that captures and hands off; it does not grow slots,
editing, or persistence. That keeps the four properties at the top of this doc
intact - the moment the strip gains commitment mechanics, it stops being the calm
thing he preferred.

**Revised build order** (supersedes the Recommendation above):

1. **Item 4 first, not last** - audition mode IN Compose (tap = hear, second act
   commits). This is now the headline, because the operator has made the call the
   old ordering was waiting on.
2. **Item 1 as the doorway** - tap-trail capture whose affordance moves him into
   Compose with the sequence seeded (the `seedKey` bridge already exists).
3. **Item 2** - name the pattern, once a trail exists to name.
4. **Item 3** - emphasis only, hard constraint unchanged: never reorder the strip.

Not yet scheduled - this records the decision so the next build starts from it
instead of re-litigating where audition-first belongs.
