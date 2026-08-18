/* =====================================================================
 * plugin-sync.test.js - S16 A9: the machine-SSOT gate for the music-coach
 * Claude Code plugin (plugin/music-coach/). Two independent drift sources
 * are guarded:
 *
 *  1. The three coach skills bundled into the plugin
 *     (plugin/music-coach/skills/{music-theory-coach,pedagogy-coach,
 *     songwriting-coach}/SKILL.md) must stay byte-faithful to their source
 *     at .claude/skills/<name>/SKILL.md - EXCEPT for markdown links whose
 *     target would resolve outside this plugin bundle once the plugin is
 *     installed standalone (a sibling skill not bundled here, or a wiki
 *     page under music/engineering-wiki/). Those are allowed to differ
 *     ONLY if:
 *       (a) the link TEXT is unchanged,
 *       (b) every other character on the line is unchanged (only the link
 *           target(s) moved), and
 *       (c) the new target is exactly the GitHub blob URL that the OLD
 *           relative target resolves to from the source file's location.
 *     A link that resolves to a path INSIDE the bundle (e.g. pedagogy-
 *     coach's link to music-theory-coach, also bundled here) must NOT be
 *     rewritten - the diff rule below fails the test if it is.
 *
 *  2. The music-interchange skill documents the jam-deep-link URL params
 *     (jam, key, yt, name) - this list must equal the locked param set
 *     that music/agent/capabilities.json's "jam-deep-link" capability
 *     names (test/agent-manifest.test.js is the sibling gate on that
 *     capability's own correctness; this test only asserts the two
 *     surfaces agree with each other).
 *
 * Run: node test/plugin-sync.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var REPO_BLOB_BASE = 'https://github.com/nhruska/nhruska.github.io/blob/main/';

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

function readLines(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').split('\n');
}

// Resolve a markdown-relative link target against the directory of the file
// it appears in, POSIX-style (repo paths are always posix on GitHub).
function resolveRelative(fromFilePath, relTarget) {
  var fromDir = path.posix.dirname(fromFilePath);
  return path.posix.normalize(path.posix.join(fromDir, relTarget));
}

// Extract [text](target) links from a line, in order.
var LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
function extractLinks(line) {
  var out = [];
  var m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(line))) out.push({ text: m[1], target: m[2] });
  return out;
}

// Replace every [text](target) with [text](@) so the surrounding prose of
// two lines can be compared with the link targets masked out.
function maskLinkTargets(line) {
  return line.replace(LINK_RE, function (whole, text) { return '[' + text + '](@)'; });
}

var BUNDLED_SKILLS = {
  'music-theory-coach': {
    src: '.claude/skills/music-theory-coach/SKILL.md',
    plugin: 'plugin/music-coach/skills/music-theory-coach/SKILL.md'
  },
  'pedagogy-coach': {
    src: '.claude/skills/pedagogy-coach/SKILL.md',
    plugin: 'plugin/music-coach/skills/pedagogy-coach/SKILL.md'
  },
  'songwriting-coach': {
    src: '.claude/skills/songwriting-coach/SKILL.md',
    plugin: 'plugin/music-coach/skills/songwriting-coach/SKILL.md'
  }
};

Object.keys(BUNDLED_SKILLS).forEach(function (name) {
  var paths = BUNDLED_SKILLS[name];

  test(name + ': bundled SKILL.md has the same line count as its source', function () {
    var srcLines = readLines(paths.src);
    var pluginLines = readLines(paths.plugin);
    assert.strictEqual(pluginLines.length, srcLines.length,
      name + ': line count drifted (source restructured? re-copy the skill body)');
  });

  test(name + ': every line is byte-identical, or differs ONLY by a documented link-target swap', function () {
    var srcLines = readLines(paths.src);
    var pluginLines = readLines(paths.plugin);
    var swaps = 0;

    srcLines.forEach(function (srcLine, i) {
      var pluginLine = pluginLines[i];
      if (srcLine === pluginLine) return; // identical line - fine, most lines are this

      // Non-identical: the ONLY allowed reason is a link-target swap. Prose
      // outside the link targets must be untouched.
      assert.strictEqual(maskLinkTargets(pluginLine), maskLinkTargets(srcLine),
        name + ' line ' + (i + 1) + ': text outside a link target changed - only link targets may differ.\n' +
        '        src: ' + JSON.stringify(srcLine) + '\n' +
        '        new: ' + JSON.stringify(pluginLine));

      var srcLinks = extractLinks(srcLine);
      var pluginLinks = extractLinks(pluginLine);
      assert.strictEqual(pluginLinks.length, srcLinks.length,
        name + ' line ' + (i + 1) + ': link count changed');

      srcLinks.forEach(function (srcLink, j) {
        var pluginLink = pluginLinks[j];
        assert.strictEqual(pluginLink.text, srcLink.text,
          name + ' line ' + (i + 1) + ': link text must be preserved verbatim');
        if (pluginLink.target === srcLink.target) return; // this particular link didn't move

        swaps++;
        assert.ok(srcLink.target.indexOf('../') === 0,
          name + ' line ' + (i + 1) + ': a link target changed but the original was not a "../" relative link - unexplained drift');

        var resolved = resolveRelative(paths.src, srcLink.target);
        var expected = REPO_BLOB_BASE + resolved;
        assert.strictEqual(pluginLink.target, expected,
          name + ' line ' + (i + 1) + ': link target must equal the GitHub blob URL the original relative link resolves to.\n' +
          '        resolved repo path: ' + resolved + '\n' +
          '        expected:           ' + expected + '\n' +
          '        got:                ' + pluginLink.target);

        // A swapped link must resolve OUTSIDE this plugin's own bundle - a
        // link that would still resolve to a co-bundled skill must NOT be
        // rewritten (it should stay a working relative link, per
        // pedagogy-coach's link to music-theory-coach, which is untouched).
        var stillBundled = Object.keys(BUNDLED_SKILLS).some(function (other) {
          return resolved === '.claude/skills/' + other + '/SKILL.md';
        });
        assert.ok(!stillBundled,
          name + ' line ' + (i + 1) + ': link resolves to a skill that IS bundled in this plugin (' + resolved +
          ') - it should stay a plain relative link, not be rewritten to GitHub');
      });
    });

    assert.ok(swaps >= 0); // presence of the assertions above is the real gate; this just documents intent
  });
});

test('a co-bundled cross-link (pedagogy-coach -> music-theory-coach) stays a working relative link, unrewritten', function () {
  var pluginLines = readLines(BUNDLED_SKILLS['pedagogy-coach'].plugin);
  var line = pluginLines.filter(function (l) { return l.indexOf('music-theory-coach') >= 0 && l.indexOf('](') >= 0; })[0];
  assert.ok(line, 'expected a link to music-theory-coach in the bundled pedagogy-coach skill');
  assert.ok(line.indexOf('](../music-theory-coach/SKILL.md)') >= 0,
    'the music-theory-coach link must remain a plain relative link (both skills are co-bundled at skills/<name>/SKILL.md)');
});

test('music-interchange skill documents exactly the jam-deep-link params (jam, key, yt, name)', function () {
  var lines = readLines('plugin/music-coach/skills/music-interchange/SKILL.md');
  var text = lines.join('\n');
  var section = text.split('## Emitting a jam deep link')[1];
  assert.ok(section, 'music-interchange SKILL.md is missing the "## Emitting a jam deep link" section');
  section = section.split('## ')[0]; // stop at the next heading

  var rowRe = /^\|\s*`([a-zA-Z]+)`\s*\|/gm;
  var params = [];
  var m;
  while ((m = rowRe.exec(section))) params.push(m[1]);
  params.sort();

  assert.deepStrictEqual(params, ['jam', 'key', 'name', 'yt'],
    'music-interchange param table drifted from the locked set (jam, key, yt, name)');
});

test('music-interchange param list agrees with music/agent/capabilities.json jam-deep-link interchange', function () {
  var caps = JSON.parse(fs.readFileSync(path.join(ROOT, 'music/agent/capabilities.json'), 'utf8'));
  var jl = caps.capabilities.filter(function (c) { return c.id === 'jam-deep-link'; })[0];
  assert.ok(jl, 'jam-deep-link capability missing from capabilities.json');

  var capMatch = /url-params:\s*([a-zA-Z,]+)/.exec(String(jl.interchange || ''));
  assert.ok(capMatch, 'capabilities.json jam-deep-link entry has no url-params list to compare against');
  var capParams = capMatch[1].split(',').map(function (s) { return s.trim(); }).sort();

  var lines = readLines('plugin/music-coach/skills/music-interchange/SKILL.md');
  var text = lines.join('\n');
  var section = text.split('## Emitting a jam deep link')[1].split('## ')[0];
  var rowRe = /^\|\s*`([a-zA-Z]+)`\s*\|/gm;
  var skillParams = [];
  var m;
  while ((m = rowRe.exec(section))) skillParams.push(m[1]);
  skillParams.sort();

  assert.deepStrictEqual(skillParams, capParams,
    'music-interchange skill and music/agent/capabilities.json have drifted on the jam-deep-link param list');
});

test('plugin.json is valid JSON with the required identity fields', function () {
  var pluginJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/music-coach/.claude-plugin/plugin.json'), 'utf8'));
  assert.strictEqual(pluginJson.name, 'music-coach');
  assert.ok(typeof pluginJson.description === 'string' && pluginJson.description.length > 0);
  assert.ok(typeof pluginJson.version === 'string' && pluginJson.version.length > 0);
});

run();
