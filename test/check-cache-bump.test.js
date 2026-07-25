/* =====================================================================
 * check-cache-bump.test.js - the CACHE-per-asset-changing-commit guard
 * (scripts/check-cache-bump.sh).
 * ---------------------------------------------------------------------
 * Why (S-SW-PER-COMMIT, 2026-07-24): the guard used to compare only the
 * branch TIP against the base, so a PR whose first commit bumped CACHE and
 * whose follow-up commits changed assets under that SAME version passed.
 * A phone that installed the PR preview at the first build then kept
 * serving it - PR #306 burned two UAT rounds on exactly that, with the
 * operator hearing the un-fixed audio while the fixes sat undelivered.
 *
 * The guard is history-dependent, so it cannot be unit-tested against this
 * repo's own log. Each case builds a THROWAWAY git repo in a temp dir,
 * commits the shape under test, runs the real script inside it, and
 * asserts the exit code. That keeps the three behaviours pinned:
 *   A) tip reuses the previous asset-changing commit's version -> FAIL
 *   B) an intermediate reuse a later bump superseded          -> PASS + WARN
 *   C) tip reuses a NON-adjacent earlier version              -> FAIL
 *   D) every asset-changing commit has its own version        -> PASS, no warn
 * Run: node test/check-cache-bump.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var SCRIPT = path.join(__dirname, '..', 'scripts', 'check-cache-bump.sh');

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

function git(repo, args) {
  return cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeBuild(repo, version) {
  fs.writeFileSync(path.join(repo, 'music', 'sw.js'),
    "var CACHE = '" + version + "';\nvar CORE = ['./'];\n");
  fs.writeFileSync(path.join(repo, 'music', 'shared', 'build-stamp.js'),
    "(function(){\n  var VERSION = '" + version + "';\n  var UPDATED_ISO = '" + stamp() + "';\n})();\n");
}

var isoCounter = 0;
function stamp() {
  // Distinct per call - the guard also fails a bump with an unchanged date.
  isoCounter++;
  return '2026-07-2' + (isoCounter % 10) + 'T0' + (isoCounter % 10) + ':00:00Z';
}

function touchAsset(repo, text) {
  fs.appendFileSync(path.join(repo, 'music', 'shared', 'songbook.css'), '/* ' + text + ' */\n');
}

function commit(repo, msg) {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', msg]);
}

// Builds a repo whose "base" branch holds music-v100, then applies the given
// sequence of [version, label] pairs as asset-changing commits on a branch.
function buildRepo(sequence) {
  var repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cachebump-'));
  fs.mkdirSync(path.join(repo, 'music', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', 'check-cache-bump.sh'));
  git(repo, ['init', '-q', '-b', 'base']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'cache bump test']);
  writeBuild(repo, 'music-v100');
  touchAsset(repo, 'base');
  commit(repo, 'base build');
  git(repo, ['checkout', '-q', '-b', 'feature']);
  sequence.forEach(function (step, i) {
    writeBuild(repo, step[0]);
    touchAsset(repo, step[1] || ('change ' + i));
    commit(repo, step[1] || ('commit ' + i));
  });
  return repo;
}

function runGuard(repo) {
  var res = cp.spawnSync('bash', ['scripts/check-cache-bump.sh', 'base'],
    { cwd: repo, encoding: 'utf8' });
  return { code: res.status, out: (res.stdout || '') + (res.stderr || '') };
}

/* ---------- A: live reuse of the previous version ---------- */
test('FAILS when the newest asset-changing commit reuses the previous version (the #306 shape)', function () {
  var repo = buildRepo([['music-v306', 'first build'], ['music-v306', 'follow-up fix, same version']]);
  var r = runGuard(repo);
  assert.strictEqual(r.code, 1, 'expected exit 1, got ' + r.code + '\n' + r.out);
  assert.ok(/newest asset-changing commit/.test(r.out), 'message must name the live reuse: ' + r.out);
});

/* ---------- B: historical reuse a later bump superseded ---------- */
test('PASSES with a WARN when an intermediate reuse was superseded by a later bump', function () {
  var repo = buildRepo([
    ['music-v306', 'first build'],
    ['music-v306', 'follow-up fix, same version'],
    ['music-v306-2', 'later commit takes its own version']
  ]);
  var r = runGuard(repo);
  assert.strictEqual(r.code, 0, 'expected exit 0, got ' + r.code + '\n' + r.out);
  assert.ok(/WARN/.test(r.out), 'the superseded reuse must still be reported: ' + r.out);
});

/* ---------- C: tip reuses a non-adjacent earlier version ---------- */
test('FAILS when the tip reuses a version an EARLIER (non-adjacent) commit already shipped', function () {
  var repo = buildRepo([
    ['music-v306', 'first build'],
    ['music-v306-2', 'second build'],
    ['music-v306', 'tip reverts to an already-shipped version']
  ]);
  var r = runGuard(repo);
  assert.strictEqual(r.code, 1, 'expected exit 1, got ' + r.code + '\n' + r.out);
});

/* ---------- D: the correct shape ---------- */
test('PASSES with no warning when every asset-changing commit carries its own version', function () {
  var repo = buildRepo([
    ['music-v306', 'first build'],
    ['music-v306-2', 'second build'],
    ['music-v306-3', 'third build']
  ]);
  var r = runGuard(repo);
  assert.strictEqual(r.code, 0, 'expected exit 0, got ' + r.code + '\n' + r.out);
  assert.ok(!/WARN/.test(r.out), 'no warning expected: ' + r.out);
});

/* ---------- the pre-existing tip-vs-base rule still holds ---------- */
test('still FAILS the original shape: assets changed vs base with no bump at all', function () {
  var repo = buildRepo([['music-v100', 'assets changed, version untouched']]);
  var r = runGuard(repo);
  assert.strictEqual(r.code, 1, 'expected exit 1, got ' + r.code + '\n' + r.out);
});

test('still FAILS a stamp/CACHE drift', function () {
  var repo = buildRepo([['music-v306', 'bumped']]);
  // Break the mirror: stamp says one thing, sw.js another.
  fs.writeFileSync(path.join(repo, 'music', 'shared', 'build-stamp.js'),
    "(function(){\n  var VERSION = 'music-v999';\n  var UPDATED_ISO = '2026-07-24T00:00:00Z';\n})();\n");
  commit(repo, 'drift the stamp');
  var r = runGuard(repo);
  assert.strictEqual(r.code, 1, 'expected exit 1, got ' + r.code + '\n' + r.out);
  assert.ok(/does not mirror/.test(r.out), r.out);
});

run();
