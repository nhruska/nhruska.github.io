/* =====================================================================
 * math-sw.test.js  -  Math app SW/version shape guard, sibling of
 * test/sw-verify.test.js (the Music app's equivalent).
 * ---------------------------------------------------------------------
 * Asserts, from the REAL source (regex-extracted; these are classic
 * <script>-tag / importScripts files, no module boundary to require()):
 *
 *   (a) math/version.js exports a 'math-v<digits>' MATH_VERSION.
 *   (b) every CORE-listed relative path in math/sw.js resolves to a real
 *       file/dir on disk (resolved relative to math/, ignoring './').
 *   (c) math/sw.js's activate handler only ever deletes 'math-' caches, and
 *       music/sw.js's activate handler only ever deletes 'music-' caches -
 *       the two apps share one origin, so a cache-family leak in either
 *       direction silently evicts the OTHER app's offline install
 *       (docs/plans/goal-math-app-v1-20260925.md "Architecture").
 *   (d) math/manifest.webmanifest parses and scope is './'.
 *
 * math/index.html, app.js, engine.js, store.js and math.css are written by
 * SIBLING agents landing on the same base branch - they will not exist in
 * an isolated worktree. The CORE-exists check SKIPS (prints a note) any of
 * those five specifically when absent; every other assertion here is
 * strict, including for math/version.js, math/sw.js, and
 * math/manifest.webmanifest themselves (this agent's own files).
 *
 * Run: node test/math-sw.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var MATH_ROOT = path.join(ROOT, 'math');
var MATH_SW_PATH = path.join(MATH_ROOT, 'sw.js');
var MATH_VERSION_PATH = path.join(MATH_ROOT, 'version.js');
var MATH_MANIFEST_PATH = path.join(MATH_ROOT, 'manifest.webmanifest');
var MUSIC_SW_PATH = path.join(ROOT, 'music', 'sw.js');

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

// Strip `//` line comments (same technique as sw-verify.test.js) so a
// comment can never pair up with a real string-literal quote and throw off
// a later match - assert against CODE, not comments.
function stripLineComments(src) {
  return src.split('\n').map(function (line) {
    var idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}

function extractCore(src) {
  var m = /var CORE = \[([\s\S]*?)\];/.exec(stripLineComments(src));
  if (!m) throw new Error('could not find "var CORE = [...]" - has the declaration shape changed?');
  var paths = [];
  var re = /'([^']+)'/g, mm;
  while ((mm = re.exec(m[1]))) paths.push(mm[1]);
  return paths;
}

// The activate handler's cache-delete family guard, e.g.
// `k.indexOf('math-') === 0` - returns the prefix string, or null.
function extractDeleteGuard(src) {
  var m = /addEventListener\('activate'[\s\S]*?indexOf\('([^']+)'\)\s*===\s*0/.exec(stripLineComments(src));
  return m ? m[1] : null;
}

var mathSwSrc = fs.existsSync(MATH_SW_PATH) ? fs.readFileSync(MATH_SW_PATH, 'utf8') : null;
var mathVersionSrc = fs.existsSync(MATH_VERSION_PATH) ? fs.readFileSync(MATH_VERSION_PATH, 'utf8') : null;
var musicSwSrc = fs.readFileSync(MUSIC_SW_PATH, 'utf8');

/* ---------- version ---------- */
test('math/version.js exports a math-v<digits> MATH_VERSION', function () {
  assert.ok(mathVersionSrc, 'math/version.js is missing');
  var m = /MATH_VERSION\s*=\s*'([^']+)'/.exec(stripLineComments(mathVersionSrc));
  assert.ok(m, 'could not find "root.MATH_VERSION = \'...\'" in math/version.js');
  assert.ok(/^math-v\d+$/.test(m[1]), 'MATH_VERSION should look like math-v<digits>, got ' + m[1]);
});

/* ---------- CORE precache (math/sw.js) ---------- */
// Named per docs/plans/goal-math-app-v1-20260925.md "Architecture" - the UI
// shell + engine/store files a sibling agent owns, absent in an isolated
// worktree. Every other CORE entry (this agent's own files, plus the
// music/shared/ primitives that already exist) is strict.
var SIBLING_FILES = ['./index.html', './app.js', './engine.js', './store.js', './math.css'];

if (mathSwSrc) {
  var corePaths = extractCore(mathSwSrc);
  test('math/sw.js CORE array was actually extracted (extraction sanity check)', function () {
    assert.ok(corePaths.length > 5, 'expected a substantial CORE list, got ' + corePaths.length + ' entries - extraction likely broken');
  });
  corePaths.forEach(function (p) {
    var isSibling = SIBLING_FILES.indexOf(p) !== -1;
    test('CORE entry resolves to a real file/dir: ' + p + (isSibling ? ' (sibling-agent file)' : ''), function () {
      var abs = path.join(MATH_ROOT, p);
      var exists = fs.existsSync(abs);
      if (!exists && isSibling) {
        console.log('      SKIP - ' + p + ' not yet written by a sibling agent; will be strict once the math/ mission lands');
        return;
      }
      assert.ok(exists, 'CORE lists ' + p + ' but nothing exists at ' + abs);
    });
  });
} else {
  test('math/sw.js exists', function () {
    assert.fail('math/sw.js is missing');
  });
}

/* ---------- cache-family isolation (both service workers) ---------- */
test('math/sw.js activate only ever deletes "math-" caches', function () {
  assert.ok(mathSwSrc, 'math/sw.js is missing');
  var guard = extractDeleteGuard(mathSwSrc);
  assert.strictEqual(guard, 'math-', 'expected activate to gate cache deletion on k.indexOf(\'math-\') === 0, got ' + JSON.stringify(guard) + ' - deleting outside its own cache family would evict the Music app\'s offline install');
});

test('music/sw.js activate only ever deletes "music-" caches', function () {
  var guard = extractDeleteGuard(musicSwSrc);
  assert.strictEqual(guard, 'music-', 'expected activate to gate cache deletion on k.indexOf(\'music-\') === 0, got ' + JSON.stringify(guard) + ' - deleting outside its own cache family would evict the Math app\'s offline install');
});

// Review finding #1 (blocker): the ORIGIN-WIDE caches.match() searches every
// cache on the origin, oldest first - so each app could answer a request for a
// shared file (theme.js, songbook.css, esc.js, toast.js) with the OTHER app's
// stale copy. Offline Math then booted on a pre-PALETTE theme.js and died.
// Every lookup must go through the worker's own cache (caches.open(CACHE)).
[['math/sw.js', function () { return mathSwSrc; }], ['music/sw.js', function () { return musicSwSrc; }]].forEach(function (pair) {
  test(pair[0] + ' never looks up the origin-wide caches.match (only its own CACHE)', function () {
    var src = pair[1]();
    assert.ok(src, pair[0] + ' is missing');
    var code = stripLineComments(src);
    assert.ok(!/\bcaches\.match\s*\(/.test(code), pair[0] + ' calls caches.match(...) - a sibling app\'s cache can answer; use caches.open(CACHE).then(c => c.match(...))');
    assert.ok(/caches\.open\(\s*CACHE\s*\)[\s\S]{0,80}\.match\(/.test(code), pair[0] + ' has no own-cache lookup (caches.open(CACHE) ... .match)');
  });
});

/* ---------- manifest ---------- */
test('math/manifest.webmanifest parses and scope is "./"', function () {
  assert.ok(fs.existsSync(MATH_MANIFEST_PATH), 'math/manifest.webmanifest is missing');
  var manifest = JSON.parse(fs.readFileSync(MATH_MANIFEST_PATH, 'utf8'));
  assert.strictEqual(manifest.scope, './');
});

run();
