/* =====================================================================
 * build-stamp.js  -  M-SETTINGS-CLARITY (2026-07-05): the "which build am
 * I actually looking at?" freshness stamp, shown next to the version in
 * the app footer (play/index.html Settings meta line) and at the bottom
 * of play/triad-inversions.html.
 * ---------------------------------------------------------------------
 * There is no build step (GitHub Pages serves raw files), so this stamp is
 * AUTHORED AT CHANGE TIME under the same discipline as the sw.js CACHE
 * bump: whenever CACHE bumps, VERSION and UPDATED_ISO here move with it in
 * the SAME commit. scripts/check-cache-bump.sh enforces the pair (a CACHE
 * bump with a stale stamp fails the check), and test/build-stamp.test.js
 * asserts VERSION matches sw.js's CACHE string byte-for-byte.
 *
 * VERSION is a DELIBERATE, GUARD-LOCKED duplicate of sw.js's CACHE (the
 * FORK-4 / shape-classify.js precedent: a tiny intentional copy beats a
 * runtime coupling). Pages can't read CACHE directly - sw.js is a service
 * worker, loadable in a window context only via async SW messaging that
 * needs an installed, controlling worker. This one-line mirror renders
 * synchronously on every load (first visit, online-only, offline) and the
 * two guards above make drift a failing check, not a silent lie.
 *
 * Why it exists (operator UAT, 2026-07-05): diagnosing a stale service-
 * worker cache used to mean cross-referencing the CACHE version number
 * against conversation scroll. The stamp answers it at a glance: the
 * footer names the build's version AND when it was authored, in the
 * user's own locale. If the page assets are stale, the DATE is visibly
 * old; if the page is fresh but an older worker is still active, the
 * Settings meta line flags the mismatch (see play/index.html showVersion).
 *
 * Dependency-free by design (like esc.js): no other shared module needed.
 *
 *   BuildStamp.VERSION       -> 'music-vNNN' (mirrors sw.js CACHE)
 *   BuildStamp.UPDATED_ISO   -> ISO 8601 authoring time (UTC)
 *   BuildStamp.fmt(iso)      -> locale date+time string ('' on a bad date)
 *   BuildStamp.text()        -> 'vNNN - updated <locale date+time>'
 *   BuildStamp.renderInto(el)-> sets el.textContent = text() (no-op on null)
 * ===================================================================== */
(function (root) {
  'use strict';

  // Both lines move together with sw.js's CACHE bump - see the header.
  var VERSION = 'music-v191';
  var UPDATED_ISO = '2026-07-18T15:58:00Z';

  // ISO -> the reader's locale, e.g. "Jul 5, 2026, 10:07 AM" (en-US, EDT).
  // toLocaleString renders in the DEVICE's locale + timezone - the stamp is
  // authored once in UTC and every reader sees their own local time.
  function fmt(iso) {
    if (typeof iso !== 'string' || !iso) return ''; // new Date(null) is epoch 0, not NaN - reject non-strings up front
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      // Ancient engine without options support - still a readable datetime.
      return d.toString();
    }
  }

  // 'music-v117' -> 'v117 - updated Jul 5, 2026, 10:07 AM'
  function text() {
    var when = fmt(UPDATED_ISO);
    return VERSION.replace(/^music-/, '') + (when ? ' - updated ' + when : '');
  }

  function renderInto(el) {
    if (!el) return;
    el.textContent = text();
  }

  var API = { VERSION: VERSION, UPDATED_ISO: UPDATED_ISO, fmt: fmt, text: text, renderInto: renderInto };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.BuildStamp = API;

})(typeof window !== 'undefined' ? window : this);
