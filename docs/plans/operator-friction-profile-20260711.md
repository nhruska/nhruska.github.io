# Operator Friction Profile - Nik (2026-07-11)

> "I am the user. establish my friction profile." The USDD persona for every
> Cockpit surface (and any operator-facing glass). Derived from observed
> behavior across the 2026-07-10/11 burst sessions, the ccp interaction model,
> and the mobile-dev-coach bench. This file is the contract the scenarios
> assert; taste stays human.

## Surfaces (in priority order)

| Surface | Constraints that bite |
|---|---|
| Pixel 10 Pro XL, portrait 412px (PRIMARY - "the true test") | one thumb, camera cutout (safe-area insets), ~6 rows above the fold, wide tables wrap to noise, bare URLs untappable |
| Pixel 10 Pro XL, landscape | rare; layouts must not break, need not be optimal |
| Desktop Chrome (D1/D2) | the planning/committing surface; density welcome HERE, never assumed on phone |

## Attention economics (the prime constraint)

- Presence is for INPUT (taste, direction, priorities). Absence is for
  THROUGHPUT. Any screen that makes him watch progress is a defect.
- Interaction budget per glance: ONE thumb action - a tap, a digit, or a short
  burst. If a decision needs typing a sentence, it should have been a queue
  item with options.
- Return-from-away contract: position 1 = the freshly rescored merged queue.
  The glass must answer, above the fold, in order:
  1. **What needs me?** (count + top item, tap-ready)
  2. **What is running?** (autonomous work, no action implied)
  3. **What shipped?** (wins since last look)

## Tenet: same-environment execution

Context switching IS friction. A surface that shows a decision but sends the
operator to a terminal (or another app) to act on it fails the profile. Every
actionable signal carries its action; actions dispatch real primitive-stack
execution (see vision doc 1.5). Scenario-visible form: queue cards render an
inline action control, never a bare pointer to elsewhere.

## Friction signals (observed, each has fired at least once)

| # | Signal | The rule it produced |
|---|---|---|
| F1 | Bare/`code`-wrapped URLs on phone | every link is a tappable markdown/anchor link |
| F2 | Wide tables on 412px | max 3 columns on phone; wrap to definition rows |
| F3 | Two numbered lists in one response | one navigation list per surface, ever |
| F4 | Red-at-rest delete handles read as armed | state grammar: red = ARMED only (S-SETRM-ARM) |
| F5 | "directive spent" idling while queue held swarmable items | queue items carry execution state; idle watch dispatches |
| F6 | Progress narration between fixes | batch, ship, report once - the diff is the record |
| F7 | Prescribed test steps he could not perform | steps-proven rule: trace executability before prescribing |
| F8 | Raw feeds (logs, event walls) as a "status" surface | roll-ups only; raw detail is a drill-down leaf |
| F9 | Mixed-meaning styling (one look, two meanings) | Element Consistency Law; fix at the primitive |
| F10 | Ambiguity parked as blocking questions | interview queue, any-subset answering; assume + cite |

## Cognitive overload triggers (the mockups' anti-checklist)

- More than one altitude of the ladder rendered in detail on one screen.
- More than ~7 peer tiles without grouping.
- Undifferentiated chronological feeds above the fold (feeds are leaves).
- A number without a trend or a threshold (raw counts are not signal).
- Any control whose consequence is not legible from its look (see F4/F9).

## The signal contract (what scenarios assert per screen)

| Contract row | Mechanical assert (412x915) |
|---|---|
| C1 boots clean | zero console errors on load |
| C2 needs-me above the fold | a needs-me count + top queue item visible without scroll |
| C3 running visible | live/running indicator count visible without scroll |
| C4 shipped visible | wins-since indicator visible without scroll |
| C5 tap budget | mission-level detail reachable in <= 3 taps from landing |
| C6 thumb targets | actionable elements >= 44px hit area |
| C7 one altitude | drill-down replaces context (panel/screen), never appends a second level inline |

## Form-factor grammar (inputs he will actually give)

| Form | Meaning | Surface treatment |
|---|---|---|
| tap | a URL/button is the whole answer | 44px+ target, one per item |
| digit | pick from a numbered list | max 5 options, position 1 = predicted |
| burst | short free text / voice fragment / screenshot | never blocked on; captured silently |
| interview | a queued question set | async queue, any-subset unblocks |

## Voice + copy notes for glass surfaces

ASCII only, no em dashes, no emoji in copy (status LEDs are drawn, not typed).
Labels in mono uppercase tracking (tactical grammar); prose sentences only in
drill-down leaves. Numbers carry units or trends. "Nothing needs you" is a
first-class state and should look calm, not empty.
