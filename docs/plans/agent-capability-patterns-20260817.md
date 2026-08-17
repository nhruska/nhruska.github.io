# Agent Capability Patterns - the Delivery-Shape Menu (innovation catalyst)

> Operator ask (2026-08-17): review the existing skill/tool bench and name the DISTINCT
> patterns by which agent capabilities reach a user - then use the menu to generate
> adjacent innovations for the Music-app agent demo. The insight seeding this: the
> conversation-browser skill reads local JSONL logs and spins a throwaway local server
> for a rich GUI - a whole delivery shape the app's ladder didn't name.

## The seven delivery shapes (observed across the operator's bench)

| # | Shape | Bench examples | Properties |
|---|---|---|---|
| P1 | **Offline PWA** - all capability in static files; interchange via files + links | the Music app itself | Zero infra, survives forever, works on a beach. The floor |
| P2 | **Deep link as remote control** - a URL carries the setup; any surface that renders links is a controller | `?jam=` (shipped v332); `?p=` before it | Phone-native, agent-agnostic, offline after tap |
| P3 | **Single-file HTML artifact** - the agent RENDERS a self-contained page; the file IS the app | html-artifact, generative-ui (round-trip JSON decision payloads), conversation-to-html, frontend-slides | No server at all; works on phone via any file/preview surface; state rides in the file |
| P4 | **Agent-spun local server** - agent starts a stdlib HTTP server over local data for a live GUI, dies with the session | conversation-browser (JSONL -> chat UI), phone-remote, the chrome-bridge channel pages, the app's own ux-capture harness | Rich live GUI with zero deploy; LAN-reachable from the phone; ephemeral by design |
| P5 | **Hosted static + CI** - deployed pages, no server-side compute | GitHub Pages (the live app), githack previews, workflows-hub | Shareable URLs, still no backend to maintain |
| P6 | **Messaging as transport** - capability rides chat/email; WAN reach with no infra of ours | telegram surface, email-remote (cmd: loop), slack bridge | Reaches the operator anywhere; links (P2) travel over it |
| P7 | **Hosted service** - real backend for the few things that need one | (work-side: AAD-gated Azure apps) | The only shape with running cost + auth; reserved for what P1-P6 cannot do |

The compounding realization: **these compose over ONE data contract.** The backup +
profile docs (spec section 2) are the single substrate; every shape above is a different
way of putting a capability over that substrate. Nothing about the contract changes
across shapes - which is exactly what makes the demo compelling: same JSON, seven
delivery costumes, graceful degradation between them.

## Catalyst: adjacent innovations this menu generates

| Idea | Shape | What it is |
|---|---|---|
| **Competency analytics artifact** | P3 | Agent reads the backup, renders a self-contained charts page (levels vs targets, evidence recency, repertoire growth) - hand it to the phone as a file/preview link. No server, no deploy. The phone-friendly default |
| **Coach's-office live dashboard** | P4 | conversation-browser pattern pointed at music data: local CC session serves a live GUI (charts, drill-down, "what should I practice" panel) on the LAN for at-desk sessions. The knowledge-sphere node viewer (QUEUE LONG) is this shape too |
| **Agent profiles in the plugin** | plugin | Ship AGENT definitions beside skills/commands: `music-coach` (assess + plan), `jam-dj` (emits P2 links), `theory-professor` (grounded in the coach bench). The plugin stops being "skills" and becomes a STAFF |
| **Pedagogical steering** | P1+contract | Teaching style rides the EXISTING `preferences[]` slot in profile docs ("prefers ask-then-reveal", "minimal prose, uke examples") + the app's guidance-level key. Agents adjust teaching style through the same one-validator import - no new schema, pedagogy-coach grades the defaults |
| **Songwriting copilot** | P2 | songwriting-coach emits section-by-section setup links (verse ii-V-I, chorus IV-V) - the writing session becomes a chain of taps |
| **Practice-goal scenarios** | P1 | USDD pattern applied to the USER: agent turns a goal into red persona scenarios over the user's own profile ("can play 3 songs in Bb start to finish"); green = demonstrated. The spec's evidence loop, made executable |
| **xAPI/LRS bridge** | P7 | The one legitimately-hosted piece: profile docs -> xAPI statements for org deployments. The enterprise wedge (operator's authored-standards credentials) |

## Demo narrative (one line)

One musician's data, one contract, seven delivery shapes: an offline PWA, a tap-link
remote control, a rendered analytics artifact, a live local dashboard, a deployed site,
a chat surface, and an enterprise LRS bridge - each degrading gracefully into the one
below it, none of them required except the static files.

## Routing

- P2 jam-link: SHIPPED (v332). Studio re-home: S15.
- Plugin + agent profiles: S16 (A9 extended - agents beside skills/commands).
- Analytics artifact (P3): queue as S-ANALYTICS-ARTIFACT after S16 - it is a plugin
  command (`/music:report`) more than an app change.
- Coach's-office (P4) + knowledge sphere: LONG (composes the P3 artifact's charts).
- Pedagogical steering: fold into S16's `/music:practice-plan` (preferences[] writes).
- xAPI bridge: LONG, enterprise track, own vision interview.
