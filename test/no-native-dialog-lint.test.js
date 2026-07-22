/* =====================================================================
 * no-native-dialog-lint.test.js - M-DESIGN-ENFORCE wave 2 (UAT U19) teeth:
 * "MODAL with disabled background... NO native dialogs" pins the KNOWN
 * confirm()/alert() call sites so a regression (a new native dialog added
 * anywhere, or the backup/restore flow drifting back to one) fails loud,
 * rather than requiring a human to re-grep the whole app on every future
 * change. Same static (no DOM/browser) style as consistency-lint.test.js.
 *
 * This wave's grant covered the Settings backup/restore flow (play/
 * index.html) only - it replaced every native alert()/confirm() there with
 * the app-styled Toast/Modal primitives. The remaining confirm() calls in
 * songbook.js (delete a custom item, clear the whole setlist) and
 * repertoire-form.js (delete confirmation) are PRE-EXISTING, out-of-scope
 * debt (component-conventions.md Findings register: "backlog SETX phase
 * 2") - this lint pins their count so it can't silently grow, without
 * requiring this wave to have fixed them.
 *
 * Run: node test/no-native-dialog-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }

// Matches an actual confirm(/alert( CALL, not the word appearing in a code
// comment (mirrors songbook.test.js's own /confirm\(['"]/ discipline) - here
// widened to `confirm(` / `alert(` immediately followed by a real argument
// start (a quote, a variable, or a template literal), which a prose mention
// like "replaces native confirm()/alert()" or "native confirm() dialog"
// never has (those read confirm()/alert() - empty parens - or confirm()
// followed by a word, never confirm(<arg>).
function realCallSites(src, fnName) {
  var re = new RegExp(fnName + '\\(\\s*[^)]', 'g');
  var out = [];
  var m;
  while ((m = re.exec(src))) {
    var lineNo = src.slice(0, m.index).split('\n').length;
    var line = src.split('\n')[lineNo - 1];
    // skip prose mentions inside a comment line (// ... or a block-comment
    // line starting with * ) - a real call site is executable code.
    var trimmed = line.trim();
    if (/^\/\//.test(trimmed) || /^\*/.test(trimmed)) continue;
    out.push({ line: lineNo, text: trimmed });
  }
  return out;
}

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

test('play/index.html (Settings backup/restore) has ZERO native confirm()/alert() call sites (U19: this wave\'s grant)', function () {
  var src = read('music/play/index.html');
  var confirms = realCallSites(src, 'confirm');
  var alerts = realCallSites(src, 'alert');
  assert.strictEqual(confirms.length, 0, 'found unexpected confirm() call site(s): ' + JSON.stringify(confirms));
  assert.strictEqual(alerts.length, 0, 'found unexpected alert() call site(s): ' + JSON.stringify(alerts));
});

test('play/index.html uses the app-styled Toast/Modal primitives for backup/restore feedback', function () {
  var src = read('music/play/index.html');
  assert.ok(/function showSettingsToast\(/.test(src), 'expected showSettingsToast() to exist');
  assert.ok(/function openConfirmModal\(/.test(src), 'expected openConfirmModal() to exist');
  assert.ok(/showSettingsToast\('Backup is unavailable right now\.', true\)/.test(src), 'Backup-unavailable must route through showSettingsToast');
  assert.ok(/openConfirmModal\(\s*[\s\S]{0,40}'This backup'/.test(src), 'restore confirm must route through openConfirmModal');
});

test('songbook.js confirm() call sites are pinned to the KNOWN pre-existing debt (delete-item) - exactly 1, not grown', function () {
  var src = read('music/shared/songbook.js');
  var confirms = realCallSites(src, 'confirm');
  // Was 2 (delete-item + clear-setlist); the setlist Clear moved to an
  // arm-to-delete pattern (operator UAT: tap-to-red, no popup), so only the
  // delete-custom-item confirm() remains as pre-existing native-dialog debt.
  assert.strictEqual(confirms.length, 1, 'expected exactly 1 pre-existing confirm() call site in songbook.js (delete custom item), found: ' + JSON.stringify(confirms));
  var texts = confirms.map(function (c) { return c.text; });
  assert.ok(texts.some(function (t) { return /confirm\(msg\)/.test(t); }), 'expected the delete-custom-item confirm(msg) call site');
  assert.ok(!texts.some(function (t) { return /Clear your setlist/.test(t); }), 'the clear-setlist native confirm() must be gone (replaced by arm-to-delete)');
});

test('songbook.js has ZERO native alert() call sites (already fully migrated to toast.js pre-U19)', function () {
  var src = read('music/shared/songbook.js');
  var alerts = realCallSites(src, 'alert');
  assert.strictEqual(alerts.length, 0, 'found unexpected alert() call site(s) in songbook.js: ' + JSON.stringify(alerts));
});

test('repertoire-form.js confirm() call sites are pinned to the KNOWN pre-existing debt (delete confirmation) - exactly 1, not grown (sibling-owned file, out of this wave\'s grant)', function () {
  var src = read('music/shared/repertoire-form.js');
  var confirms = realCallSites(src, 'confirm');
  assert.strictEqual(confirms.length, 1, 'expected exactly 1 pre-existing confirm() call site in repertoire-form.js, found: ' + JSON.stringify(confirms));
});

run();
