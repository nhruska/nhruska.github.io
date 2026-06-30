# Music app - UX friction + affordance log

> Running list of UX friction and affordance ideas surfaced while unifying the Library list items. Reviewed between review-volleys. Newest at top.

## Open (candidate affordances)
- **Action differentiation per item**: Play (curated video) > YouTube link (has URL) > YouTube search (no URL). The action shown tells you at a glance whether an item is playable in-app vs needs a search. (locked - M1)
- **Edit to add missing details**: any item can be edited to fill key/year/genre/bpm/video URL/tags (overlay). Curating a video URL makes a song playable -> dissolves the songs-vs-tracks split. (locked - M2)
- **Songs/Tracks concept merge** (Nik, 2026-06-30): "tracks concept prob goes away - all songs are tracks (or can be edited to become fully curated and playable)." Likely Library simplification to one repertoire + a Set view. (M3+, emergent)
- **Set vs all-songs filtering** must remain clear even as Songs/Tracks merge (Nik). The Set is a running-order subset, not a separate item type.

## HF polish plan (plan:council synthesis, 2026-06-30) - 4 personas + codex adversarial

Lens: user is HOLDING AN INSTRUMENT (one free thumb, phone propped, arm's-length glance). `[CODEX]` = the adversarial pass changed/flagged the item.

**Organizing insights (codex meta-findings):**
- **Scroll-rail safety `[CODEX]`**: the hot right edge is where the thumb scrolls + stabilizes the phone. A bigger always-hot action/control there is MORE dangerous, not safer - it fires on scroll-grab. Rule: action/destructive controls on the scroll rail MUST be movement-cancelled (no fire if the touch moved) and/or mode-gated.
- **Mode model `[CODEX]`**: browse / set-edit / perform have different safety needs. Don't pile all controls + perform cues into one always-hot row. `.perform` already owns the PLAY moment (don't duplicate it in the list).
- **Information budget first**: define row height + a UNIVERSAL priority order (key > capo > tempo > difficulty/hazard > genre/ownership) BEFORE bumping type. Context HIDES low-priority fields but never reshuffles positional meaning `[CODEX refutes segment-keyed reorder]`.

**P0 (high impact, mostly consensus):**
1. Legibility (CSS-only, no fork): meta .69->.78rem + --txt-dim->--txt-soft; artist ->--txt-soft; title ->~1.12rem; key tag .72->.82rem; dots 3->4px; note .6->.68rem drop uppercase. [accessibility + musician]
2. Action: make it a real >=44px tappable target, but **movement-cancelled** so a scroll-grab can't fire it `[CODEX]`; relabel by CONSEQUENCE - "Video" (curated, in-app) vs "Search" (external + leave-app icon), not "Play"/"YouTube"/"Find" `[CODEX]`. [all]
3. Meta: drop the per-chord spell-out; keep "N chords" PLUS a hazard/difficulty flag (barre / capo / non-diatonic) `[CODEX: count-only loses the pre-commit risk signal]`; clamp to one no-wrap line with fixed priority slots (not generic truncation) `[CODEX]`. [info-density + codex]
4. Key-first tag: never silent year-fallback in the accent key-slot; when key unknown show a consistent "Key?" badge (not empty - reads as a bug) `[CODEX]`; year/version moves to a secondary identity token only when needed. [musician + codex]

**P1:**
5. Capo: promote out of the meta into a labeled badge by the key, EXPLICIT convention ("Capo 2" + "Shapes: G" or "Key A") so it can't be misread `[CODEX]`; reserve a stable setup zone so present/absent doesn't shift layout. [musician + codex]
6. Add (28->44) + edit (26->44) targets; move rarely-used edit OFF the hot rail (overflow / long-press) `[CODEX: big targets on the scroll rail repeat the accidental-tap problem]`. [ergonomics + codex]
7. Notes: CLASSIFY them `[CODEX]` - routine notes quiet, performance-critical notes (alt tuning, skip intro) get a stable warning treatment. Don't blanket-de-emphasize. [musician + codex]

**P2 / forks to decide:**
8. Set-edit controls (reorder ▲▼ + remove ×): `[CODEX strongly argues]` move behind an explicit "Edit set" mode OR swipe-to-reveal + drag-handle, with PERSISTENT undo (not a short toast), rather than always-hot destructive buttons next to reorder. **DESIGN FORK - Nik to decide** (always-hot-but-bigger vs edit-mode vs swipe).
9. "mine"/custom: explicit owner token, NOT just a left border `[CODEX: border collides with selection/playing/drag states]`. [info-density + codex]

**Resolved tension:** info-density wanted chords hidden at rest; accessibility called chords performance-critical. Resolution: the chord SEQUENCE is not useful in the browse row (not in playable order, too small) and lives in the chord sheet / `.perform`; the browse row keeps a count + hazard flag. Both satisfied.

## Surfaced during M1 (candidates for next volleys)
- **Action wraps under meta in Set items** (375px): when the reorder/remove controls take width, "YouTube ↗" wraps to a second line below the chord meta. Tighten the Set item layout (e.g. action inline-end, or controls overlaid) so it stays one row.
- **Meta row can get long** once an item has the full union (each chord + count + genre + bpm + capo + "mine"). Consider a cap / truncation / de-emphasis when many cells are present.
- **Jam-now hero cards stay separate by design** (`.heroCard` grid, not list items). Confirm with Nik this is intended (hero = quick-jam launcher, distinct from the repertoire list).
- **Songs now show a "YouTube" action** (search) - the first visible step toward "all songs are tracks". Once edit-to-curate (M2) lands, a curated song flips to "Play".

## Resolved
- **Songs vs Tracks list-item style divergence** (PR #60 + M1): retired `.songCard`/`.bt-card`/`.setItem` into one `.listItem` rendered by `music/shared/list-item.js`. All 3 segments verified identical (live render, 0 old classes, 0 console errors).

## Notes
- The three segments today: Songs ("your repertoire", add-to-set), Tracks ("find a track in your key", key + YouTube), Set ("tonight's running order", numbered + reorder/remove). M1 makes them one element + one CSS class via a shared renderer.
