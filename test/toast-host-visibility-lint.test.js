/* =====================================================================
 * toast-host-visibility-lint.test.js  -  S-TOAST-HOST (UAT U24) regression
 * guard: a visible, EMPTY toast/undo host must never survive a completed
 * toast.js lifecycle, for every host in the app.
 * ---------------------------------------------------------------------
 * Root cause (U24): songbook.js's showSetUndoBanner/showDeleteUndoBanner
 * paint the hidden state by setting `host.hidden = true` (the DOM `hidden`
 * attribute) and clearing innerHTML - but `.setUndo{display:flex;...}` is an
 * AUTHOR-origin CSS rule, and author-origin ALWAYS outranks the user-agent's
 * built-in `[hidden]{display:none}` rule in the cascade (origin is resolved
 * BEFORE specificity/order) - so setting `.hidden = true` on a `.setUndo`
 * host had ZERO visual effect. The emptied host stayed on screen as a
 * visible, empty pill (screenshot-confirmed, both the setlist-remove-undo
 * banner and the Library delete-undo banner, since both share the `.setUndo`
 * class). `.composeToast` and `.composeRow` already carried the correct
 * `[hidden]{display:none;}` override; `.setUndo` was the one instance of the
 * pattern that got missed when the S-TOAST+ACTION migration (UAT U19/U22)
 * moved these banners onto the DOM `hidden` attribute.
 *
 * This is a STATIC (no browser/CSSOM) lint because the existing stub-DOM
 * unit-test harness (mountForSetIntegrityTests, mountForSaveTests, etc.)
 * never applies real CSS, so it cannot see this class of bug - only a real
 * browser cascade can (see the paired live Playwright repro run manually for
 * this fix; this file is the regression net that survives in CI). Enumerates
 * EVERY host ever passed to toast.js's Toast.show()/showAction() so a FUTURE
 * new toast/undo host that reuses `.hidden` without its own `[hidden]` CSS
 * override fails loud here, instead of shipping a silent empty-pill bug
 * again.
 * Run: node test/toast-host-visibility-lint.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }

var JS_PATH = 'music/shared/songbook.js';
var CSS_PATH = 'music/shared/songbook.css';
var js = read(JS_PATH);
var css = read(CSS_PATH);

// Every `host: <var>` passed to Toast.show(/Toast.showAction( anywhere in the
// file - the complete enumeration of toast/undo hosts in the app (per
// toast.js's own per-host Map contract, every host is named exactly once at
// its call site this way).
function findHostVars(src) {
  var re = /host:\s*(\w+)/g;
  var vars = [];
  var m;
  while ((m = re.exec(src))) { if (vars.indexOf(m[1]) < 0) vars.push(m[1]); }
  return vars;
}

// The literal (non-concatenated) className prefix a host variable is
// constructed with, e.g. `setUndoBanner.className = 'setUndo toastAction';`
// -> 'setUndo toastAction'; `host.className = 'composeToast' + (isErr ...)`
// -> 'composeToast' (stops at the first `'` + `+`, same as a real string
// literal boundary).
function classNameOf(src, varName) {
  var re = new RegExp('\\b' + varName + '\\.className\\s*=\\s*\'([^\']*)\'');
  var m = re.exec(src);
  return m ? m[1] : null;
}

// True when this host's hide path uses the DOM `hidden` attribute (the class
// of bug this file guards) rather than a class/opacity toggle.
function isHiddenAttrControlled(src, varName) {
  return new RegExp('\\b' + varName + '\\.hidden\\s*=\\s*true').test(src);
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

test('every toast.js host in songbook.js is accounted for (known set, not silently grown/shrunk)', function () {
  var hostVars = findHostVars(js);
  var expected = ['toastEl', 'setUndoBanner', 'clearUndoBanner', 'composeToast', 'delUndoBanner'];
  assert.deepStrictEqual(hostVars.slice().sort(), expected.slice().sort(),
    'toast host set changed - update this lint\'s expectations (and check the new host\'s hidden-CSS invariant): found ' + JSON.stringify(hostVars));
});

test('every hidden-attribute-controlled toast host class has a matching CSS [hidden]{display:none} override', function () {
  var hostVars = findHostVars(js);
  var problems = [];
  hostVars.forEach(function (v) {
    if (!isHiddenAttrControlled(js, v)) return; // opacity/class-toggle hosts (toastEl) checked separately below
    var cls = classNameOf(js, v);
    assert.ok(cls, 'expected a literal className prefix for host var `' + v + '`');
    var firstToken = cls.split(/\s+/)[0];
    var ruleRe = new RegExp('\\.' + firstToken + '\\[hidden\\]\\s*\\{([^}]*)\\}');
    var ruleMatch = ruleRe.exec(css);
    if (!ruleMatch || !/display\s*:\s*none/i.test(ruleMatch[1])) {
      problems.push(v + ' (class="' + cls + '", first token .' + firstToken + '") - no `.' + firstToken + '[hidden]{display:none;}` rule found in ' + CSS_PATH);
    }
  });
  assert.strictEqual(problems.length, 0, 'hidden-attribute-controlled host(s) with NO matching CSS override (the U24 empty-host bug class):\n  ' + problems.join('\n  '));
});

test('the .setUndo[hidden] override exists and wins the cascade (S-TOAST-HOST fix, U24)', function () {
  var m = /\.setUndo\[hidden\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, 'expected a `.setUndo[hidden]{...}` rule in ' + CSS_PATH);
  assert.ok(/display\s*:\s*none/i.test(m[1]), 'expected `.setUndo[hidden]` to set display:none, got: ' + m[1]);
});

test('toastEl (the one non-hidden-attribute host) hides via opacity+pointer-events instead - both halves of its toggle must exist', function () {
  var hostVars = findHostVars(js);
  assert.ok(hostVars.indexOf('toastEl') >= 0, 'expected toastEl to remain a known toast host');
  assert.strictEqual(isHiddenAttrControlled(js, 'toastEl'), false, 'toastEl should not be hidden-attribute-controlled (would need its own [hidden] CSS rule if this ever changes)');
  var base = /\.toast\{([^}]*)\}/.exec(css);
  var on = /\.toast\.on\{([^}]*)\}/.exec(css);
  assert.ok(base && /opacity\s*:\s*0/.test(base[1]), 'expected .toast{opacity:0;...} as the hidden-by-default state');
  assert.ok(on && /opacity\s*:\s*1/.test(on[1]), 'expected .toast.on{opacity:1;...} as the shown state');
});

run();
