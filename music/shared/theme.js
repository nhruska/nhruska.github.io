/* =====================================================================
 * theme.js  -  pure theme-resolution helpers for the Music app.
 * ---------------------------------------------------------------------
 * Two decisions, kept pure + dependency-free so the boot (anti-flash) inline
 * script, the Settings script, AND the unit test all share one source:
 *   effectiveTheme(stored, prefersLight) -> 'light' | 'dark'
 *   accentVars(theme, accent, dim, deep) -> { --accent, --accent-dim, ... }
 *
 * Dark returns each swatch's hand-tuned dim/deep with ink = the vivid accent.
 * Light re-derives pale dim/deep + a darkened, legible ink from the accent hue
 * via color-mix, so ANY picked accent stays readable on light surfaces.
 *
 * Also exports PALETTE (the accent-swatch list) so it is a real SSOT rather
 * than a value only play/index.html happened to define - the Math app reads
 * the same array for player colours (docs/plans/goal-math-app-v1-20260925.md).
 * ===================================================================== */
(function (root) {
  'use strict';

  // 'auto' (or any unknown value) resolves against the OS preference;
  // an explicit 'light' / 'dark' wins regardless of the OS.
  function effectiveTheme(stored, prefersLight) {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersLight ? 'light' : 'dark';
  }

  // a = accent, d = dim (borders), p = deep (tinted backgrounds).
  // A curated bold jewel spectrum, 1 shade per hue, on the calm dark base
  // (jewel accent, not a flood - the "one calm screen" principle holds). Style
  // only, no semantic color-coding. Tuner red/amber/green stay FIXED
  // (pitch-feedback trust) and are untouched by this list. d/p mix each accent
  // toward the #0d0f12 canvas (~29% / ~14%); Teal + Amethyst keep their heritage
  // hex so a saved pick carries over.
  // Order (operator UAT 2026-07-22): Teal FIRST - it's the default (PALETTE[0],
  // the fresh-install accent) - then the remaining chromatic swatches in rainbow
  // order (Ruby->Ember->Gold->Azure->Amethyst), then the two neutrals last
  // (achromatic, not part of the rainbow). Retired the near-duplicate hues
  // (Emerald/Jade greens, Sapphire, Magenta) to keep one shade per hue.
  var PALETTE = [
    { n: 'Teal',     a: '#5eead4', d: '#244b45', p: '#16302c' },
    { n: 'Ruby',     a: '#fb3b5c', d: '#521c27', p: '#2e151c' },
    { n: 'Ember',    a: '#fb7a3c', d: '#522e1e', p: '#2e1e18' },
    { n: 'Gold',     a: '#f6c945', d: '#514521', p: '#2e2919' },
    { n: 'Azure',    a: '#38bdf8', d: '#194155', p: '#132732' },
    { n: 'Amethyst', a: '#a78bfa', d: '#3a2f63', p: '#221b3d' },
    { n: 'Silver',   a: '#cdd7e3', d: '#45494f', p: '#282b2f' },
    { n: 'Steel',    a: '#93a4b8', d: '#343a42', p: '#202429' }
  ];

  // CSS custom-property map to apply for a given theme + accent.
  // dim/deep are the swatch's stored dark tints (ignored in light).
  function accentVars(theme, accent, dim, deep) {
    if (theme === 'light') {
      return {
        '--accent': accent,
        '--accent-dim':  'color-mix(in srgb, ' + accent + ' 30%, #ffffff)',
        '--accent-deep': 'color-mix(in srgb, ' + accent + ' 14%, #ffffff)',
        '--accent-ink':  'color-mix(in srgb, ' + accent + ' 62%, #0a1f1b)'
      };
    }
    return {
      '--accent': accent,
      '--accent-dim': dim,
      '--accent-deep': deep,
      '--accent-ink': accent
    };
  }

  var api = { effectiveTheme: effectiveTheme, accentVars: accentVars, PALETTE: PALETTE };
  if (root) root.Theme = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
