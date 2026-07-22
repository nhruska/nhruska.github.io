/* =====================================================================
 * build-stamp.js  -  the build-freshness stamp shown in the app footer
 * (play/index.html Settings meta line) and at the bottom of
 * play/triad-inversions.html, answering "which build am I looking at?".
 * ---------------------------------------------------------------------
 * Pattern: there is no build step (GitHub Pages serves raw files), so
 * VERSION and UPDATED_ISO are authored at change time. VERSION is a
 * deliberate duplicate of sw.js's CACHE string - a page can't read CACHE
 * directly (that lives in the service worker, reachable only via async SW
 * messaging that needs an installed, controlling worker), so this mirror
 * renders synchronously on every load (first visit, online, offline).
 * Two guards keep the copy honest: scripts/check-cache-bump.sh fails a
 * CACHE bump that left the stamp stale, and test/build-stamp.test.js
 * asserts VERSION equals sw.js's CACHE byte-for-byte.
 *
 * Dependency-free by design: no other shared module needed.
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
  var VERSION = 'music-v298';
  var UPDATED_ISO = '2026-07-22T06:16:51Z';

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
