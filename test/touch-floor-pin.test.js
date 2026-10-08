/* =====================================================================
 * touch-floor-pin.test.js - U1/U3 (ui-ux-polish-20261008) source pins
 * ---------------------------------------------------------------------
 * Static guard that the overlay/secondary controls swept to the 44x44 CSS px
 * touch floor stay there, and that the Tune card does not repeat the header
 * purpose line. The live geometry proof is the Playwright probe in the PR;
 * this only stops a later edit from silently shrinking a control or restoring
 * the duplicated subNote. Run: node test/touch-floor-pin.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var css = fs.readFileSync(path.join(__dirname, '../music/shared/songbook.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
var html = fs.readFileSync(path.join(__dirname, '../music/play/index.html'), 'utf8');

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

// The declaration block of the rule whose selector list is EXACTLY `sel`.
function rule(sel) {
  var esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var m = css.match(new RegExp('(?:^|\\})\\s*' + esc + '\\s*\\{([^}]*)\\}'));
  assert.ok(m, 'expected a rule for ' + sel);
  return m[1];
}
function px(decl, prop) {
  var m = decl.match(new RegExp('(?:^|;)\\s*' + prop + ':\\s*(\\d+)px'));
  return m ? +m[1] : 0;
}

['.maxClose', '.invModal-x', '.searchClear', '.listItem .li-up,.listItem .li-dn'].forEach(function (sel) {
  test(sel + ' keeps a >=44x44 tap box', function () {
    var d = rule(sel);
    assert.ok(px(d, 'width') >= 44, sel + ' width < 44: ' + d);
    assert.ok(px(d, 'height') >= 44, sel + ' height < 44: ' + d);
  });
});

test('focus-revealed li-up/li-dn restore the 44x44 box', function () {
  var d = rule('.listItem .li-up.li-a11yctrl:focus,.listItem .li-dn.li-a11yctrl:focus');
  assert.ok(px(d, 'width') >= 44 && px(d, 'height') >= 44, d);
});

test('li-up/li-dn use the --r-btn-sm radius token, not a literal', function () {
  var d = rule('.listItem .li-up,.listItem .li-dn');
  assert.ok(/border-radius:\s*var\(--r-btn-sm\)/.test(d), d);
});

test('#maxClose is a labeled type=button', function () {
  var m = html.match(/<button[^>]*id="maxClose"[^>]*>/);
  assert.ok(m, 'expected #maxClose button');
  assert.ok(/type="button"/.test(m[0]) && /aria-label="Close"/.test(m[0]), m[0]);
});

test('Tune card h3 does not repeat the header purpose line (U3)', function () {
  assert.ok(!/<h3>Tuner\s*<span class="subNote">/.test(html), 'Tuner h3 must not carry the subNote');
  assert.strictEqual((html.match(/bring each string up to the post/g) || []).length, 1, 'purpose line must appear exactly once (the contexts.tune header string)');
});

run();
