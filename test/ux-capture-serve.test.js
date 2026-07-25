/* =====================================================================
 * ux-capture-serve.test.js - the containment rule of the ux-coach capture
 * harness's local dev server (.claude/skills/ux-coach/scripts/web-ux-capture.js).
 * ---------------------------------------------------------------------
 * Why this exists (codex volley-1 on PR #301): the server hands out files
 * from a whole repo root with no auth, and its only guard was
 * `path.join(ROOT, p).startsWith(ROOT)` - which is not containment. With
 * ROOT=/home/u/repo, the request /../repo2/secret resolves to
 * /home/u/repo2/secret, and that string DOES start with /home/u/repo, so
 * the sibling directory was served. Nothing tested it, so the breakage
 * would have shipped green.
 *
 * These cases pin the three rules: stay inside the root, deny dotfiles
 * (.git / .env / .claude), and reject malformed paths.
 * Run: node test/ux-capture-serve.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var path = require('path');

var harness = require('../.claude/skills/ux-coach/scripts/web-ux-capture.js');
var resolveRequestPath = harness.resolveRequestPath;

var ROOT = path.resolve('/home/u/repo');

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

/* ---------- serves what it should ---------- */
test('a normal file under the root resolves inside the root', function () {
  var r = resolveRequestPath(ROOT, '/music/play/index.html');
  assert.ok(!r.status, 'expected a file, got ' + JSON.stringify(r));
  assert.strictEqual(r.file, path.join(ROOT, 'music', 'play', 'index.html'));
});

test('a directory path gets index.html appended', function () {
  var r = resolveRequestPath(ROOT, '/music/play/');
  assert.strictEqual(r.file, path.join(ROOT, 'music', 'play', 'index.html'));
});

test('a query string is stripped before resolution', function () {
  var r = resolveRequestPath(ROOT, '/music/play/index.html?p=ukulele-gcea');
  assert.strictEqual(r.file, path.join(ROOT, 'music', 'play', 'index.html'));
});

test('an interior .. that stays inside the root is allowed', function () {
  var r = resolveRequestPath(ROOT, '/music/../music/play/index.html');
  assert.strictEqual(r.file, path.join(ROOT, 'music', 'play', 'index.html'));
});

/* ---------- the escapes it must never honour ----------
 * The property under test is CONTAINMENT - "no request can ever resolve to a
 * file outside ROOT" - not a particular status code. A leading `..` in a URL
 * path is normalized away against the URL root first (what every static
 * server does, http.server included), so `/../repo2/secret` is neutralized
 * to ROOT/repo2/secret rather than rejected. Either outcome is acceptable;
 * resolving outside ROOT is not. The path.relative() guard in the
 * implementation is defence-in-depth behind that normalization.
 * Asserting "must return 403" here would pin an implementation detail and
 * pass/fail for the wrong reason. */
function assertContained(r, label) {
  if (r.status) return; // refused outright - also fine
  var rel = path.relative(ROOT, r.file);
  assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel),
    label + ' resolved OUTSIDE the root: ' + r.file);
}

test('THE SIBLING ESCAPE: /../repo2/secret can never reach the sibling dir (startsWith(ROOT) let it through)', function () {
  var r = resolveRequestPath(ROOT, '/../repo2/secret');
  assertContained(r, 'sibling escape');
  assert.notStrictEqual(r.file, path.resolve('/home/u/repo2/secret'),
    'the exact byte-for-byte escape the old startsWith(ROOT) check accepted');
});

test('a parent-directory escape can never reach /etc/passwd', function () {
  var r = resolveRequestPath(ROOT, '/../../etc/passwd');
  assertContained(r, 'parent escape');
  assert.notStrictEqual(r.file, '/etc/passwd');
});

test('a percent-encoded escape is decoded BEFORE the check, then contained', function () {
  var r = resolveRequestPath(ROOT, '/%2e%2e/repo2/secret');
  assertContained(r, 'encoded escape');
  assert.notStrictEqual(r.file, path.resolve('/home/u/repo2/secret'));
});

test('a backslash-separated escape is contained too (Windows-style separator in a URL)', function () {
  var r = resolveRequestPath(ROOT, '/..\\repo2\\secret');
  assertContained(r, 'backslash escape');
});

test('the root itself is not servable as a file', function () {
  var r = resolveRequestPath(ROOT, '/..');
  assert.strictEqual(r.status, 403);
});

/* ---------- dotfiles ---------- */
test('a dotfile at the root is refused (.env)', function () {
  var r = resolveRequestPath(ROOT, '/.env');
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.reason, 'dotfile');
});

test('a file inside a dot-directory is refused (.git/config)', function () {
  var r = resolveRequestPath(ROOT, '/.git/config');
  assert.strictEqual(r.status, 403);
});

test('a nested dot-directory is refused (.claude/skills/...)', function () {
  var r = resolveRequestPath(ROOT, '/music/.claude/secrets.json');
  assert.strictEqual(r.status, 403);
});

test('a dot INSIDE a filename is fine (not a dotfile)', function () {
  var r = resolveRequestPath(ROOT, '/music/shared/songbook.min.css');
  assert.ok(!r.status, 'expected a file, got ' + JSON.stringify(r));
});

/* ---------- malformed ---------- */
test('an undecodable percent sequence is rejected, not thrown', function () {
  var r = resolveRequestPath(ROOT, '/%E0%A4%A');
  assert.strictEqual(r.status, 400);
});

test('a null byte is rejected', function () {
  var r = resolveRequestPath(ROOT, '/music/play/index.html%00.png');
  assert.strictEqual(r.status, 400);
});

run();
