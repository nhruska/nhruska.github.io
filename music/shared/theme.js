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
 * ===================================================================== */
(function (root) {
  'use strict';

  // 'auto' (or any unknown value) resolves against the OS preference;
  // an explicit 'light' / 'dark' wins regardless of the OS.
  function effectiveTheme(stored, prefersLight) {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersLight ? 'light' : 'dark';
  }

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

  var api = { effectiveTheme: effectiveTheme, accentVars: accentVars };
  if (root) root.Theme = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);
