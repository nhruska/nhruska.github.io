/* =====================================================================
 * song-templates.test.js  -  unit tests for the M-12 S-SDD-TEMPLATES
 * mining/family library (music/shared/song-templates.js)
 * Run: node test/song-templates.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var ST = require('../music/shared/song-templates.js');
var songs = require('../music/shared/songs.json');

var ROMAN_RE = /^b?(I|II|III|IV|V|VI|VII)$/i;

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

/* ---------- FAMILIES table integrity ---------- */
test('FAMILIES is a non-empty array of well-formed entries', function () {
  assert.ok(Array.isArray(ST.FAMILIES) && ST.FAMILIES.length >= 8, 'expected >=8 families');
  ST.FAMILIES.forEach(function (f) {
    assert.ok(f.id && typeof f.id === 'string', 'missing id: ' + JSON.stringify(f));
    assert.ok(f.name && typeof f.name === 'string', 'missing name: ' + f.id);
    assert.ok(Array.isArray(f.roman) && f.roman.length, 'missing roman[]: ' + f.id);
    assert.ok(['verse', 'chorus', 'prechorus', 'any'].indexOf(f.home) >= 0, 'bad home on ' + f.id + ': ' + f.home);
    assert.ok(f.note && typeof f.note === 'string', 'missing note: ' + f.id);
  });
});
test('every FAMILIES roman token is a well-formed degree numeral', function () {
  ST.FAMILIES.forEach(function (f) {
    f.roman.forEach(function (tok) {
      assert.ok(ROMAN_RE.test(tok), f.id + ' has malformed token: ' + tok);
    });
  });
});
test('FAMILIES ids are unique', function () {
  var ids = ST.FAMILIES.map(function (f) { return f.id; });
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate id in ' + ids.join(','));
});

/* ---------- mine() on the real catalog ---------- */
test('mine() on songs.json returns non-empty Verse and Chorus pattern lists with citations', function () {
  var m = ST.mine(songs);
  assert.ok(m && m.bySection, 'expected {bySection}');
  assert.ok(Array.isArray(m.bySection.Verse) && m.bySection.Verse.length > 0, 'expected Verse patterns');
  assert.ok(Array.isArray(m.bySection.Chorus) && m.bySection.Chorus.length > 0, 'expected Chorus patterns');
  m.bySection.Verse.concat(m.bySection.Chorus).forEach(function (p) {
    assert.ok(Array.isArray(p.roman) && p.roman.length, 'pattern missing roman[]');
    assert.ok(typeof p.count === 'number' && p.count >= 1, 'pattern missing count');
    assert.ok(Array.isArray(p.citations) && p.citations.length >= 1, 'pattern missing citations');
  });
});
test('mine() ranks each section\'s patterns by count descending', function () {
  var m = ST.mine(songs);
  ['Verse', 'Chorus'].forEach(function (label) {
    var list = m.bySection[label];
    for (var i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].count >= list[i].count, label + ' not sorted desc at index ' + i);
    }
  });
});
// Golden: "Three Little Birds" (A major reggae, seq starts 'A') - hand-checked
// against its sheet: Verse lines "[A]Rise up...[D]smiled...[A]sun" / (cont.)
// "Three little [E]birds...[A]doorstep" -> tags A,D,A,E,A (no adjacent dupes)
// -> roman against tonic A: I,IV,I,V,I.
test('golden: Three Little Birds verse pattern is I-IV-I-V-I and cites the song', function () {
  var m = ST.mine(songs);
  var hit = m.bySection.Verse.filter(function (p) {
    return p.citations.indexOf('Three Little Birds') >= 0;
  });
  assert.ok(hit.length === 1, 'expected exactly one Verse pattern citing Three Little Birds, got ' + hit.length);
  assert.deepStrictEqual(hit[0].roman, ['I', 'IV', 'I', 'V', 'I']);
});
test('flat-token songs (e.g. Bohemian Rhapsody, Bb-rooted) analyze without throwing', function () {
  var flatSongs = songs.filter(function (s) {
    return Array.isArray(s.seq) && /^[A-G]b/.test(s.seq[0] || '');
  });
  assert.ok(flatSongs.length > 0, 'expected at least one flat-rooted song in the catalog');
  flatSongs.forEach(function (s) {
    assert.doesNotThrow(function () { ST.mine([s]); }, s.t + ' threw during mine()');
  });
  var br = songs.filter(function (s) { return s.t === 'Bohemian Rhapsody'; })[0];
  assert.ok(br, 'fixture catalog changed - Bohemian Rhapsody missing');
  var m = ST.mine([br]);
  var allRoman = [].concat.apply([], Object.keys(m.bySection).map(function (k) {
    return [].concat.apply([], m.bySection[k].map(function (p) { return p.roman; }));
  }));
  assert.ok(allRoman.length > 0, 'expected resolvable roman degrees for a flat-rooted song');
  allRoman.forEach(function (r) {
    if (r != null) assert.ok(ROMAN_RE.test(r), 'unexpected roman token: ' + r);
  });
});

/* ---------- consecutive-dedupe (mine() pipeline) ---------- */
test('consecutive-dedupe collapses adjacent repeats across a line boundary', function () {
  var m = ST.mine([{
    t: 'Dedupe Fixture', seq: ['A'],
    sheet: [['Verse', '[A]a [A]a [D]d'], ['', '[D]d [E]e']]
  }]);
  // raw tag stream: A,A,D,D,E -> deduped: A,D,E -> roman vs tonic A: I,IV,V
  assert.deepStrictEqual(m.bySection.Verse[0].roman, ['I', 'IV', 'V']);
});
test('does not collapse non-adjacent repeats (a loop is reported as-is)', function () {
  var m = ST.mine([{
    t: 'Loop Fixture', seq: ['A'],
    sheet: [['Verse', '[A]a [D]d [A]a [D]d']]
  }]);
  assert.deepStrictEqual(m.bySection.Verse[0].roman, ['I', 'IV', 'I', 'IV']);
});

/* ---------- section-label normalization ---------- */
test('section labels merge case-insensitively (Pre-Chorus / prechorus) with dashes/spaces ignored', function () {
  var m = ST.mine([
    { t: 'S1', seq: ['C'], sheet: [['Pre-Chorus', '[C]a [G]b']] },
    { t: 'S2', seq: ['C'], sheet: [['prechorus', '[C]c [G]d']] },
    { t: 'S3', seq: ['C'], sheet: [['pre chorus', '[C]e [G]f']] }
  ]);
  var keys = Object.keys(m.bySection);
  assert.strictEqual(keys.length, 1, 'expected the three Pre-Chorus variants to merge into one bucket, got ' + keys.join(','));
  var bucket = m.bySection[keys[0]];
  var citing = [].concat.apply([], bucket.map(function (p) { return p.citations; }));
  assert.ok(citing.indexOf('S1') >= 0 && citing.indexOf('S2') >= 0 && citing.indexOf('S3') >= 0,
    'expected all three songs cited under the merged bucket, got ' + citing.join(','));
});
test('a continuation line ("") attaches to the preceding section, not a new one', function () {
  var m = ST.mine([{
    t: 'Continuation Fixture', seq: ['C'],
    sheet: [['Chorus', '[C]a [G]b'], ['', '[F]c [G]d']]
  }]);
  assert.deepStrictEqual(Object.keys(m.bySection), ['Chorus']);
  assert.deepStrictEqual(m.bySection.Chorus[0].roman, ['I', 'V', 'IV', 'V']);
});
test('a section repeated non-adjacently in one song folds into a single bucket', function () {
  var m = ST.mine([{
    t: 'Repeat Fixture', seq: ['C'],
    sheet: [['Verse', '[C]a [G]b'], ['Chorus', '[F]c [G]d'], ['Verse', '[C]e [G]f']]
  }]);
  assert.deepStrictEqual(Object.keys(m.bySection).sort(), ['Chorus', 'Verse']);
  // both Verse occurrences use C-G -> one pattern, count 1 (one song), cited once
  assert.strictEqual(m.bySection.Verse.length, 1);
  assert.strictEqual(m.bySection.Verse[0].count, 1);
  assert.deepStrictEqual(m.bySection.Verse[0].citations, ['Repeat Fixture']);
});

/* ---------- forSection() ranking + dedup ---------- */
test('forSection() returns mined patterns first (already ranked), then FAMILIES', function () {
  var out = ST.forSection('Chorus', songs);
  assert.ok(out.length > 0, 'expected suggestions for Chorus');
  var firstFamilyIdx = out.map(function (o) { return o.source; }).indexOf('family');
  if (firstFamilyIdx >= 0) {
    for (var i = 0; i < firstFamilyIdx; i++) assert.strictEqual(out[i].source, 'mined');
  }
  out.forEach(function (o) { assert.ok(o.source === 'mined' || o.source === 'family', 'bad source: ' + o.source); });
});
test('forSection() dedupes families already covered by a mined pattern (same roman signature)', function () {
  // Axis I-V-vi-IV is both the top mined Chorus pattern in the real catalog
  // AND the 'axis' FAMILIES entry (home: chorus) - it must appear exactly once.
  var out = ST.forSection('Chorus', songs);
  var axisHits = out.filter(function (o) { return o.roman.join(',') === ['I', 'V', 'vi', 'IV'].join(','); });
  assert.strictEqual(axisHits.length, 1, 'expected the axis signature to appear exactly once, got ' + axisHits.length);
  assert.strictEqual(axisHits[0].source, 'mined', 'expected the mined entry (with citations) to win over the family stub');
});
test('forSection() home:"any" families appear for any section; home-scoped families only for their section', function () {
  var verse = ST.forSection('Verse', []);
  var chorus = ST.forSection('Chorus', []);
  var bridge = ST.forSection('Bridge', []);
  // jazzTurnaround is home:'any' -> present everywhere
  [verse, chorus, bridge].forEach(function (out) {
    assert.ok(out.some(function (o) { return o.id === 'jazzTurnaround'; }), 'expected jazzTurnaround (any) present');
  });
  // folk is home:'verse' -> present for Verse, absent for Chorus/Bridge
  assert.ok(verse.some(function (o) { return o.id === 'folk'; }), 'expected folk in Verse');
  assert.ok(!chorus.some(function (o) { return o.id === 'folk'; }), 'did not expect folk in Chorus');
  assert.ok(!bridge.some(function (o) { return o.id === 'folk'; }), 'did not expect folk in Bridge');
});
test('forSection() is case-insensitive on the section argument', function () {
  var a = ST.forSection('chorus', songs);
  var b = ST.forSection('Chorus', songs);
  assert.deepStrictEqual(a, b);
});

run();
