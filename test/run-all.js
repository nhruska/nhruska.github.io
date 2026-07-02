/* =====================================================================
 * run-all.js - discovers and runs every test/*.test.js self-runner,
 * aggregates results, exits non-zero on any failure. Dependency-free.
 * Run: node test/run-all.js   (CI runs this via .github/workflows/tests.yml)
 * ===================================================================== */
'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');

var dir = __dirname;
var files = fs.readdirSync(dir).filter(function (f) { return /\.test\.js$/.test(f); }).sort();
if (files.length === 0) {
  // Green must mean "tests ran" - an empty discovery is a broken checkout/glob.
  console.error('run-all: no *.test.js files discovered in ' + dir);
  process.exit(1);
}
var failedFiles = 0;

files.forEach(function (f) {
  var r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  var out = (r.stdout || '').trim();
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
