/* =====================================================================
 * chord-pack-xss.test.js  -  regression guard for the chord-DIAGRAM XSS
 * sink (PR #67 volley 6). Drives the REAL pack diagram() (guitar + ukulele)
 * through a minimal window/document stub with a hostile chord name and
 * asserts the name is escaped, never injected as live HTML. renderSheet
 * escaping tests do NOT cover this path (the pack builds its own innerHTML).
 * Run: node test/chord-pack-xss.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');

// ~15-line window/document stub: just enough for the packs to load + build a
// diagram wrapper. innerHTML is a plain string sink so we can inspect it.
function makeEl() {
  var e = { children: [], className: '', style: {}, attrs: {},
    setAttribute: function (k, v) { e.attrs[k] = v; },
    appendChild: function (c) { e.children.push(c); return c; } };
  Object.defineProperty(e, 'innerHTML', { get: function () { return e._h || ''; }, set: function (v) { e._h = v; } });
  Object.defineProperty(e, 'textContent', { get: function () { return e._t || ''; }, set: function (v) { e._t = v; } });
  return e;
}
global.window = global;
global.window.addEventListener = function () {};
global.document = { createElement: makeEl, addEventListener: function () {} };

require('../music/shared/chords-guitar.js');
require('../music/shared/chords-ukulele.js');
var PACKS = { guitar: global.ChordPackGuitar, ukulele: global.ChordPackUkulele };

var passed = 0, failed = 0, cases = [];
function test(name, fn) { cases.push([name, fn]); }
function run() {
  cases.forEach(function (c) {
    try { c[1](); passed++; console.log('  ✓ ' + c[0]); }
    catch (e) { failed++; console.log('  ✗ ' + c[0] + '\n      ' + e.message); }
  });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

var HOSTILE = '<img src=x onerror=window.__pwn=1>';

Object.keys(PACKS).forEach(function (inst) {
  var pack = PACKS[inst];
  test(inst + ' pack loaded + exposes diagram()', function () {
    assert.ok(pack && typeof pack.diagram === 'function', inst + ' pack missing');
  });
  ['small', 'big'].forEach(function (size) {
    test(inst + ' diagram(' + size + ') never injects a hostile UNKNOWN chord name as live HTML', function () {
      var d = pack.diagram(HOSTILE, size);
      // ONLY innerHTML is a live-HTML sink; textContent is inherently inert (the
      // browser renders it as literal text, never parses it). So the security
      // assertion is: no raw <img in innerHTML. A name delivered via textContent
      // (uke unknown-chord path) or escaped into innerHTML (guitar/uke known
      // path, songbook fallback) is safe.
      assert.strictEqual((d.innerHTML || '').indexOf('<img'), -1,
        inst + '/' + size + ' injected raw <img> into innerHTML: ' + d.innerHTML);
    });
  });
  test(inst + ' diagram renders a KNOWN chord (C) normally', function () {
    var d = pack.diagram('C', 'small');
    assert.ok((d.innerHTML || d.textContent || '').indexOf('C') !== -1, inst + ' lost the C label');
  });
});

run();
