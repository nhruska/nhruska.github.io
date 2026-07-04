/* =====================================================================
 * sw-verify.test.js  -  regression guard for the Service Worker's CORE
 * precache list (S-HARDEN A6, analysis-refactor-enhance-20260704).
 * ---------------------------------------------------------------------
 * "the law" (music/engineering-wiki/systems/offline-pwa.md) - every file the
 * app needs offline must be in music/sw.js's CORE array - had ZERO automated
 * verification; several missions have independently bumped CACHE. Asserts,
 * from the REAL sw.js + play/index.html source (regex-extracted; both are
 * classic <script>-tag files, no module boundary to require()):
 *
 *   (a) every CORE-listed relative path resolves to a real file/dir on disk.
 *   (b) every shared/*.js file loaded via a <script src> tag in
 *       play/index.html is precached in CORE - the actual A6 gap this test
 *       caught on its first run: shared/list-item.js, shared/repertoire.js
 *       and shared/repertoire-form.js were all script-tagged but had never
 *       been added to CORE (fixed in the same commit, CACHE v86->v87).
 *
 * The CACHE-bump-vs-diff check (did CACHE actually change when shared/play
 * files did?) needs git history a unit test doesn't have access to -
 * see scripts/check-cache-bump.sh for that half of A6.
 * Run: node test/sw-verify.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var MUSIC_ROOT = path.join(__dirname, '..', 'music');
var SW_PATH = path.join(MUSIC_ROOT, 'sw.js');
var INDEX_PATH = path.join(MUSIC_ROOT, 'play', 'index.html');

var swSrc = fs.readFileSync(SW_PATH, 'utf8');
var indexSrc = fs.readFileSync(INDEX_PATH, 'utf8');

// Extract the `var CORE = [ ... ];` array literal's string entries. CORE only
// ever holds single-quoted relative-path string literals (no expressions,
// no concatenation) - a regex over the array body is safe and avoids
// eval()-ing app source inside the test runner.
function extractCore(src) {
  var m = /var CORE = \[([\s\S]*?)\];/.exec(src);
  if (!m) throw new Error('sw-verify: could not find "var CORE = [...]" in sw.js - has the declaration shape changed?');
  // Strip `//` line comments FIRST - several CORE-adjacent comments contain an
  // apostrophe (e.g. "the play app's Tracks tab"), which would otherwise pair
  // up with a real string-literal quote and throw off every match after it.
  // Safe because no CORE path ever contains "//".
  var body = m[1].split('\n').map(function (line) {
    var idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
  var paths = [];
  var re = /'([^']+)'/g, mm;
  while ((mm = re.exec(body))) paths.push(mm[1]);
  return paths;
}

// Extract every shared/*.js path from <script src="../shared/X.js"> tags in
// play/index.html, normalized to the same './shared/X.js' shape CORE uses.
function extractSharedScriptTags(src) {
  var out = [];
  var re = /<script src="\.\.\/shared\/([^"]+\.js)"><\/script>/g, mm;
  while ((mm = re.exec(src))) out.push('./shared/' + mm[1]);
  return out;
}

var corePaths = extractCore(swSrc);
var scriptPaths = extractSharedScriptTags(indexSrc);

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

test('CORE array was actually extracted (extraction sanity check)', function () {
  assert.ok(corePaths.length > 10, 'expected a substantial CORE list, got ' + corePaths.length + ' entries - extraction likely broken');
});

test('play/index.html script tags were actually extracted (extraction sanity check)', function () {
  assert.ok(scriptPaths.length > 10, 'expected several shared/*.js script tags, got ' + scriptPaths.length + ' - extraction likely broken');
});

corePaths.forEach(function (p) {
  test('CORE entry resolves to a real file/dir: ' + p, function () {
    var abs = path.join(MUSIC_ROOT, p);
    assert.ok(fs.existsSync(abs), 'CORE lists ' + p + ' but nothing exists at ' + abs);
  });
});

test('(A6) every shared/*.js <script src> in play/index.html is precached in CORE', function () {
  var missing = scriptPaths.filter(function (p) { return corePaths.indexOf(p) === -1; });
  assert.deepStrictEqual(missing, [], 'script-tagged but NOT in CORE (an install before ever going online 404s on these offline): ' + missing.join(', '));
});

test('(A5) esc.js specifically is both script-tagged and precached', function () {
  assert.ok(scriptPaths.indexOf('./shared/esc.js') !== -1, 'esc.js must be <script src>-loaded in play/index.html (before its consumers)');
  assert.ok(corePaths.indexOf('./shared/esc.js') !== -1, 'esc.js must be listed in sw.js CORE');
});

run();
