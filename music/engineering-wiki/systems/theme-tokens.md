# Theme Tokens + Boot Mechanism (light/dark SSOT)

[Wiki](../index.md) > systems > Theme Tokens

## Purpose

One place naming the app's real color tokens and the real theme-selection mechanism, so any NEW rendered surface - a doc, an artifact pack, a case-study page, a future sibling app - matches the live app by reading these values rather than inventing its own palette. Written after a friction signal: a personal artifact pack (`docs/artifacts/thought-ware-development/`) was first built with an invented palette before being corrected to use the tokens below (operator: "match theme compliant style of repo using existing ssot").

## The contract [STABLE]

Theme is a single `<html data-theme="light">` / `<html data-theme="dark">` attribute, resolved from ONE localStorage key and applied before first paint (no flash). Any consumer that wants to be "theme-consistent with the app" needs exactly these three pieces, not a recreated color list:

1. **The stored preference**: `localStorage['music.theme.v1']` -> `'auto' | 'light' | 'dark'` (`music/play/index.html:1178`).
2. **The resolver**: `music/shared/theme.js`'s `Theme.effectiveTheme(stored, prefersLight)` - `'auto'` resolves against `window.matchMedia('(prefers-color-scheme: light)')`; explicit `light`/`dark` win outright.
3. **The token block**: `music/shared/songbook.css` `:root{}` (dark, the default - `songbook.css:14`) and `:root[data-theme="light"]{}` (the light override - `songbook.css:110`). Only flipping tokens are overridden in light; anything not restated inherits the dark value.

## Pre-paint boot script (the pattern to copy) [STABLE]

`music/play/index.html`'s `<head>`, verbatim shape - copy this pattern into any new surface, don't re-derive it:

```html
<script src="../shared/theme.js?v=music-vNNN"></script>
<script>
(function(){try{
  var stored=localStorage.getItem('music.theme.v1');
  var prefersLight=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
  var eff=window.Theme?Theme.effectiveTheme(stored,prefersLight)
    :((stored==='light'||stored==='dark')?stored:(prefersLight?'light':'dark'));
  document.documentElement.setAttribute('data-theme',eff);
}catch(e){}})();
</script>
```

A page OUTSIDE `music/` (an artifact pack under `docs/artifacts/`) cannot load `theme.js` by relative path across that boundary and does not need the app's Settings-driven accent picker - it only needs to **agree on light/dark**, so it may inline just the `stored`/`prefersLight`/`eff` resolution (skip the `window.Theme` branch) and hardcode its OWN copy of the token values below rather than `@import`ing `songbook.css` (that file is Music-app-specific: chord grids, diagram tokens, a Google Fonts `@import`). Copying values is fine; inventing DIFFERENT values is the violation this page exists to prevent.

## The token values (copy these, don't invent new ones) [STABLE]

Dark (default, `songbook.css:14-18`):

```
--bg:#0d0f12; --bg-2:#14171c; --surface:#181b21; --surface-2:#1f232b;
--line:#262b34; --line-strong:#323a45;
--txt:#e8ebf0; --txt-soft:#b6bcc6; --txt-dim:#8a92a0;
--accent:#5eead4; --accent-dim:#244b45; --accent-deep:#16302c; --accent-ink:var(--accent);
```

Light (`songbook.css:111-115`, only the flipping subset):

```
--bg:#eef1f4; --bg-2:#e3e8ee; --surface:#ffffff; --surface-2:#f2f5f8;
--line:#d6dce3; --line-strong:#bcc5cf;
--txt:#161b22; --txt-soft:#3f4854; --txt-dim:#5f6875;
--accent-dim:#bfe6df; --accent-deep:#e7f6f2; --accent-ink:#0f766e;
```

`--accent` itself is user-pickable (`music.accent.v1`, 8-swatch palette in `index.html`'s `PALETTE`) and stays fixed across themes; only `--accent-dim`/`--accent-deep`/`--accent-ink` re-derive per theme. A consumer that isn't offering an accent picker should just keep the default teal (`#5eead4`) and not build its own picker.

## Fonts (part of the same visual identity) [STABLE]

`Inter` (400/500/600/700/800) for UI text, `Space Mono` (400/700) for numeric/tab display - both via the Google Fonts `@import` at `songbook.css:13`. A standalone artifact page pulls the same two families from Google Fonts directly rather than substituting a different pairing.

## The rule

Any new rendered HTML surface associated with this app or its case studies - including things OUTSIDE `music/` like `docs/artifacts/*` packs - either (a) loads `theme.js` + the real `songbook.css` tokens when it lives inside the app's own tree, or (b) inlines the boot-script pattern above plus a literal copy of the token values above when it lives elsewhere. Never invent a new palette "in the spirit of" the app - if a token is needed that doesn't exist above, add it to `songbook.css`'s `:root` block first (see [ssot-registry.md](ssot-registry.md)), then reference it, so there is exactly one place a future theme audit has to check.

## Related

- [ssot-registry.md](ssot-registry.md) - the registry row for this page
- [layout-tokens.md](layout-tokens.md) - sibling SSOT page for the geometry token block in the same file
