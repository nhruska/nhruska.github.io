/* Gate the repo-root marketplace manifest (.claude-plugin/marketplace.json)
 * against the plugin it lists, so install-by-name and directory-copy can
 * never drift apart (machine-SSOT rule: no manifest without its gate). */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mpPath = path.join(root, '.claude-plugin', 'marketplace.json');
const results = [];
function test(name, fn) {
  try { fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' - ' + e.message]); }
}

const mp = JSON.parse(fs.readFileSync(mpPath, 'utf8'));

test('manifest has name, owner, and a plugins array', function () {
  assert.strictEqual(typeof mp.name, 'string');
  assert.ok(mp.name.length > 0);
  assert.strictEqual(typeof mp.owner, 'object');
  assert.ok(Array.isArray(mp.plugins) && mp.plugins.length >= 1);
});

test('every listed plugin source dir exists and carries its own plugin.json', function () {
  mp.plugins.forEach(function (p) {
    assert.strictEqual(typeof p.source, 'string', p.name + ' missing source');
    const dir = path.join(root, p.source);
    assert.ok(fs.existsSync(dir), p.source + ' does not exist');
    assert.ok(fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json')),
      p.source + ' has no .claude-plugin/plugin.json');
  });
});

test('music-coach entry matches its plugin.json name + version', function () {
  const entry = mp.plugins.find(function (p) { return p.name === 'music-coach'; });
  assert.ok(entry, 'music-coach not listed in the marketplace');
  const pj = JSON.parse(fs.readFileSync(
    path.join(root, entry.source, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.strictEqual(entry.name, pj.name, 'name drift vs plugin.json');
  assert.strictEqual(entry.version, pj.version, 'version drift vs plugin.json');
});

test('manifest is plain ASCII (paste/marketplace-surface discipline)', function () {
  const raw = fs.readFileSync(mpPath, 'utf8');
  assert.ok(/^[\x00-\x7F]*$/.test(raw), 'non-ASCII character in marketplace.json');
});

let failed = 0;
results.forEach(function (r) { if (r[0] === 'FAIL') failed++; console.log('  ' + r[0] + '  ' + r[1]); });
if (failed > 0) { process.exitCode = 1; }
module.exports = { passed: results.length - failed, failed: failed };
