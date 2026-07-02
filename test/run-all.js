/* =====================================================================
 * run-all.js - discovers and runs every test/*.test.js self-runner,
 * aggregates results, exits non-zero on any failure. Dependency-free.
 * Run: node test/run-all.js   (CI runs this via .github/workflows/tests.yml)
 * ===================================================================== */
'use strict';
var fs = require('fs'), path = require('path'), cp = require('child_process');

var dir = __dirname;
var files = fs.readdirSync(dir).filter(function (f) { return /\.test\.js$/.test(f); }).sort();
var failedFiles = 0, totalLine = [];

files.forEach(function (f) {
  var r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  var out = (r.stdout || '').trim();
  var last = out.split('\n').pop() || '(no output)';
  var ok = r.status === 0;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + f + '  - ' + last);
  totalLine.push(f + ': ' + last);
  if (!ok) {
    failedFiles++;
    // Surface the failing file's full output so CI logs show the assertion.
    console.log(out);
    if (r.stderr) console.log(r.stderr);
  }
});

console.log('\n' + files.length + ' test files, ' + failedFiles + ' failed');
process.exit(failedFiles ? 1 : 0);
