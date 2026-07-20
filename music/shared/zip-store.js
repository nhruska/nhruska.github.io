/* =====================================================================
 * zip-store.js  -  minimal STORE-only (no compression) ZIP writer, so the
 * Skills panel can export the whole bundle - every skill as
 * `<skill-id>/SKILL.md` - as one .zip with zero dependencies. This is a
 * no-build static app: a bundler-less page cannot pull in JSZip, and
 * store-only is bit-simple and universally readable.
 * ---------------------------------------------------------------------
 *   ZipStore.build([{ path:'ukulele/SKILL.md', text:'...' }, ...])
 *     -> Uint8Array of a valid ZIP archive (UTF-8 names + contents,
 *        method 0 = stored, one local header + central-directory entry
 *        per file, single end-of-central-directory record).
 *   ZipStore.crc32(bytes) -> unsigned 32-bit CRC (exposed for tests).
 *
 * DOS timestamp is a fixed constant (2026-01-01 00:00): the archive's
 * meaningful "when" lives INSIDE each SKILL.md (`updated`), and a fixed
 * timestamp keeps the byte stream deterministic (no Date.now in modules).
 *
 * Pure and dependency-free; TextEncoder in the browser, Buffer fallback in
 * Node (tests). Exposes window.ZipStore and is require()-able.
 * music/sw.js CORE must precache this file.
 * ===================================================================== */
(function (root) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Array(256), c, k, n;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function toBytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    // Node fallback (tests): Buffer IS a Uint8Array subclass.
    return new Uint8Array(Buffer.from(String(text), 'utf8'));
  }

  // Fixed DOS date/time: 2026-01-01 00:00:00 -> date = ((2026-1980)<<9)|(1<<5)|1
  var DOS_TIME = 0;
  var DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

  function u16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
  function u32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }
  function pushBytes(arr, bytes) { for (var i = 0; i < bytes.length; i++) arr.push(bytes[i]); }

  // files: [{ path, text }] -> Uint8Array (a complete ZIP archive).
  // Duplicate paths are rejected: don't allow them, because a duplicate
  // path unzips unpredictably (behavior varies per tool).
  function build(files) {
    files = files || [];
    var seen = {};
    var out = [], central = [], count = 0;
    files.forEach(function (f) {
      var path = String(f.path);
      if (seen[path]) throw new Error('zip-store: duplicate path ' + path);
      seen[path] = true;
      var name = toBytes(path);
      var data = toBytes(f.text == null ? '' : f.text);
      var crc = crc32(data);
      var offset = out.length;
      // Local file header
      u32(out, 0x04034B50); u16(out, 20); u16(out, 0x0800 /* UTF-8 names */);
      u16(out, 0 /* stored */); u16(out, DOS_TIME); u16(out, DOS_DATE);
      u32(out, crc); u32(out, data.length); u32(out, data.length);
      u16(out, name.length); u16(out, 0);
      pushBytes(out, name); pushBytes(out, data);
      // Central directory entry
      u32(central, 0x02014B50); u16(central, 20); u16(central, 20); u16(central, 0x0800);
      u16(central, 0); u16(central, DOS_TIME); u16(central, DOS_DATE);
      u32(central, crc); u32(central, data.length); u32(central, data.length);
      u16(central, name.length); u16(central, 0); u16(central, 0);
      u16(central, 0); u16(central, 0); u32(central, 0); u32(central, offset);
      pushBytes(central, name);
      count++;
    });
    var cdOffset = out.length, cdSize = central.length;
    pushBytes(out, central);
    // End of central directory
    u32(out, 0x06054B50); u16(out, 0); u16(out, 0);
    u16(out, count); u16(out, count);
    u32(out, cdSize); u32(out, cdOffset); u16(out, 0);
    return new Uint8Array(out);
  }

  var API = { build: build, crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.ZipStore = API;

})(typeof window !== 'undefined' ? window : this);
