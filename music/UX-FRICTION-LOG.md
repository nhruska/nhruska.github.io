# Music app - UX friction + affordance log

> Running list of UX friction and affordance ideas surfaced while unifying the Library list items. Reviewed between review-volleys. Newest at top.

## Open (candidate affordances)
- **Action differentiation per item**: Play (curated video) > YouTube link (has URL) > YouTube search (no URL). The action shown tells you at a glance whether an item is playable in-app vs needs a search. (locked - M1)
- **Edit to add missing details**: any item can be edited to fill key/year/genre/bpm/video URL/tags (overlay). Curating a video URL makes a song playable -> dissolves the songs-vs-tracks split. (locked - M2)
- **Songs/Tracks concept merge** (Nik, 2026-06-30): "tracks concept prob goes away - all songs are tracks (or can be edited to become fully curated and playable)." Likely Library simplification to one repertoire + a Set view. (M3+, emergent)
- **Set vs all-songs filtering** must remain clear even as Songs/Tracks merge (Nik). The Set is a running-order subset, not a separate item type.

## Surfaced during M1 (candidates for next volleys)
- **Action wraps under meta in Set items** (375px): when the reorder/remove controls take width, "YouTube ↗" wraps to a second line below the chord meta. Tighten the Set item layout (e.g. action inline-end, or controls overlaid) so it stays one row.
- **Meta row can get long** once an item has the full union (each chord + count + genre + bpm + capo + "mine"). Consider a cap / truncation / de-emphasis when many cells are present.
- **Jam-now hero cards stay separate by design** (`.heroCard` grid, not list items). Confirm with Nik this is intended (hero = quick-jam launcher, distinct from the repertoire list).
- **Songs now show a "YouTube" action** (search) - the first visible step toward "all songs are tracks". Once edit-to-curate (M2) lands, a curated song flips to "Play".

## Resolved
- **Songs vs Tracks list-item style divergence** (PR #60 + M1): retired `.songCard`/`.bt-card`/`.setItem` into one `.listItem` rendered by `music/shared/list-item.js`. All 3 segments verified identical (live render, 0 old classes, 0 console errors).

## Notes
- The three segments today: Songs ("your repertoire", add-to-set), Tracks ("find a track in your key", key + YouTube), Set ("tonight's running order", numbered + reorder/remove). M1 makes them one element + one CSS class via a shared renderer.
