/* =====================================================================
 * theme.test.js  -  unit tests for the Light/Dark/Auto theme resolution
 * (music/shared/theme.js). Run: node test/theme.test.js   (pure Node assert)
 * ===================================================================== */
'use strict';
var assert = require('assert');
var Theme = require('../music/shared/theme.js');

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

/* ---------- effectiveTheme ---------- */
test('explicit dark wins over an OS light preference', function () {
  assert.strictEqual(Theme.effectiveTheme('dark', true), 'dark');
});
test('explicit light wins over an OS dark preference', function () {
  assert.strictEqual(Theme.effectiveTheme('light', false), 'light');
});
test('auto follows the OS: prefersLight true -> light', function () {
  assert.strictEqual(Theme.effectiveTheme('auto', true), 'light');
});
test('auto follows the OS: prefersLight false -> dark', function () {
  assert.strictEqual(Theme.effectiveTheme('auto', false), 'dark');
});
test('missing/unknown stored value is treated as auto', function () {
  assert.strictEqual(Theme.effectiveTheme(null, true), 'light');
  assert.strictEqual(Theme.effectiveTheme(undefined, false), 'dark');
  assert.strictEqual(Theme.effectiveTheme('nonsense', true), 'light');
});

/* ---------- accentVars ---------- */
test('dark uses the swatch dim/deep verbatim, ink = the vivid accent', function () {
  var v = Theme.accentVars('dark', '#5eead4', '#244b45', '#16302c');
  assert.strictEqual(v['--accent'], '#5eead4');
  assert.strictEqual(v['--accent-dim'], '#244b45');   // pixel-identical to pre-theme builds
  assert.strictEqual(v['--accent-deep'], '#16302c');
  assert.strictEqual(v['--accent-ink'], '#5eead4');   // accent reads on the dark surface as-is
});
test('light re-derives dim/deep/ink from the accent hue (ignores dark tints)', function () {
  var v = Theme.accentVars('light', '#5eead4', '#244b45', '#16302c');
  assert.strictEqual(v['--accent'], '#5eead4');       // the hue itself is preserved
  // dim/deep/ink are color-mix derivations off the accent, NOT the dark tints
  ['--accent-dim', '--accent-deep', '--accent-ink'].forEach(function (k) {
    assert.ok(/color-mix\(in srgb/.test(v[k]), k + ' should be a color-mix derivation, got ' + v[k]);
    assert.ok(v[k].indexOf('#5eead4') !== -1, k + ' should be derived from the accent hue');
  });
  assert.strictEqual(v['--accent-ink'].indexOf('#244b45'), -1, 'light must not reuse the dark dim tint');
});
test('light ink darkens (mix toward a near-black teal), so it reads on light surfaces', function () {
  var ink = Theme.accentVars('light', '#f472b6', '#5c2a45', '#371829')['--accent-ink'];
  assert.ok(/#0a1f1b/.test(ink), 'ink mixes toward the dark anchor for legibility, got ' + ink);
});

run();
