/* =====================================================================
 * run-all.js - discovers and runs every test/*.test.js self-runner,
 * aggregates results, exits non-zero on any failure. Dependency-free.
 * Run: node test/run-all.js   (CI runs this via .github/workflows/tests.yml)
 * ===================================================================== */
'use strict';
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

var dir = __dirname;
var files = fs.readdirSync(dir).filter(function (f) { return /\.test\.js$/.test(f); }).sort();
if (files.length === 0) {
  // Green must mean "tests ran" - an empty discovery is a broken checkout/glob.
  console.error('run-all: no *.test.js files discovered in ' + dir);
  process.exit(1);
}
var failedFiles = 0;

files.forEach(function (f) {
  // stdout goes to a file, not a pipe: a child that writes past the 64 KB
  // pipe buffer and then calls process.exit() loses its queued tail - the
  // summary line - so the case count silently dropped (jam-queries, 2151
  // cases, was missing from the Command Center count on ~2 of 3 runs).
  // File writes are synchronous in Node, so nothing is left queued.
  var tmp = path.join(os.tmpdir(), 'run-all-' + process.pid + '-' + f + '.out');
  var fd = fs.openSync(tmp, 'w');
  var r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', stdio: ['ignore', fd, 'pipe'] });
  fs.closeSync(fd);
  var out = fs.readFileSync(tmp, 'utf8').trim();
  fs.unlinkSync(tmp);
  var last = out.split('\n').pop() || '(no output)';
  // A true spawn failure yields status null (never 0), so it already counts
  // as FAIL; surfacing r.error keeps the cause visible in CI logs.
  var ok = r.status === 0 && !r.error;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + f + '  - ' + last);
  if (!ok) {
    failedFiles++;
    if (r.error) console.log('spawn error: ' + r.error);
    // Surface the failing file's full output so CI logs show the assertion.
    console.log(out);
    if (r.stderr) console.log(r.stderr);
  }
});

console.log('\n' + files.length + ' test files, ' + failedFiles + ' failed');
process.exit(failedFiles ? 1 : 0);
