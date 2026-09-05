/* =====================================================================
 * asset-version-lint.test.js - the gate for the MIXED-BUILD bug.
 *
 * Operator UAT 2026-09-03: the phone rendered v342-10's markup with
 * v342-9's CSS, and the build stamp read v342-9. Not an ordinary stale
 * cache - a Frankenstein build.
 *
 * Root cause: every asset was referenced by a bare path
 * (`../shared/songbook.css`). HTTP caches key on URL; index.html
 * revalidates, a URL that never changes never does. Bumping sw.js CACHE
 * did nothing for them - the service worker is network-first and was
 * never the culprit. And because build-stamp.js is itself one of those
 * assets, the STAMP - this repo's documented "which build am I on"
 * handle - reported the old version while newer HTML ran. The version
 * oracle lied, which is why several UAT rounds were spent judging a
 * build that was not the build under test.
 *
 * The fix makes the URL change when the build changes: one SSOT
 * (build-stamp VERSION) drives a `?v=` on every local asset tag. This
 * pins it, so an author who bumps the version and forgets to re-stamp
 * fails here instead of shipping another Frankenstein.
 *
 * Run: node test/asset-version-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var VERSION = (read('music/shared/build-stamp.js').match(/var VERSION = '([^']+)'/) || [])[1];
var CACHE = (read('music/sw.js').match(/var CACHE = '([^']+)'/) || [])[1];
var ASSET = /(?:href|src)="((?:\.\.\/|\.\/)?(?:shared|play)\/[A-Za-z0-9._/-]+\.(?:css|js))(\?v=([A-Za-z0-9._-]*))?"/g;

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

test('the three version fields agree: sw CACHE, build-stamp VERSION, and the asset query', function () {
  assert.ok(VERSION, 'build-stamp VERSION is readable');
  assert.strictEqual(CACHE, VERSION, 'sw.js CACHE and build-stamp VERSION must be byte-identical');
});

test('EVERY local asset URL in every HTML entry point carries the current version', function () {
  ['music/play/index.html', 'music/play/triad-inversions.html', 'music/index.html'].forEach(function (rel) {
    var full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) return;
    var src = read(rel), m, n = 0, bad = [];
    ASSET.lastIndex = 0;
    while ((m = ASSET.exec(src))) {
      n++;
      if (m[3] !== VERSION) bad.push(m[1] + ' -> ?v=' + (m[3] || '(none)'));
    }
    assert.strictEqual(bad.length, 0,
      rel + ' has ' + bad.length + '/' + n + ' asset URL(s) off ' + VERSION +
      ' (e.g. ' + bad.slice(0, 3).join(', ') + ') - run scripts/stamp-asset-versions.py');
  });
});

test('the app shell itself is versioned - if songbook.css or build-stamp.js were missed, the stamp would lie again', function () {
  var src = read('music/play/index.html');
  // These three are the ones the bug actually bit: the CSS that made it look
  // broken, the engine that renders the rows, and the stamp that misreported it.
  ['shared/songbook.css', 'shared/songbook.js', 'shared/build-stamp.js'].forEach(function (a) {
    var re = new RegExp(a.replace(/[.]/g, '\\.') + '\\?v=' + VERSION.replace(/[.]/g, '\\.'));
    assert.ok(re.test(src), a + ' must carry ?v=' + VERSION);
  });
});

test('the service worker resolves a versioned request against its unversioned precache', function () {
  var sw = read('music/sw.js');
  // CORE holds bare paths; requests now carry ?v=. Without ignoreSearch every
  // versioned asset misses the precache and a genuinely OFFLINE install breaks.
  assert.ok(/caches\.match\(req, \{ ignoreSearch: true \}\)/.test(sw),
    'the same-origin lookup must pass ignoreSearch, or offline 404s on every versioned asset');
});

test('the stamper agrees - running its own --check gate from the test suite', function () {
  var r = cp.spawnSync('python3', [path.join(ROOT, 'scripts', 'stamp-asset-versions.py'), '--check'],
    { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'stamp-asset-versions.py --check failed:\n' + (r.stdout || '') + (r.stderr || ''));
});

run();
