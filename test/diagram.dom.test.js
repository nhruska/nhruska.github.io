/* =====================================================================
 * diagram.dom.test.js  -  drives the REAL Diagram.scale() through a minimal
 * stub document and inspects the produced SVG STRING: the fret-number labels
 * must paint AFTER the note dots (SVG paints in document order - the old
 * order hid the numbers behind the bottom string's dots) and the canvas must
 * reserve a label band below the board so the two can't collide at all.
 * Run: node test/diagram.dom.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var crypto = require('crypto');

/* ---- just enough DOM for scale(): createElement + className/innerHTML ---- */
global.document = {
  createElement: function (tag) { return { tagName: tag, className: '', innerHTML: '' }; }
};

var D = require('../music/shared/diagram.js');

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

// standard guitar open pitch classes: E A D G B E -> 4 9 2 7 11 4
var GUITAR_OPEN = [4, 9, 2, 7, 11, 4];
// C major scale pitch classes
var C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
// marker labels are the only #6b7280 fills in the SVG - use that to find them
var MARKER_FILL = 'fill="#6b7280"';

test('fret-number labels paint AFTER every note dot (z-order: numbers on top)', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  var svg = el.innerHTML;
  assert.ok(svg.indexOf(MARKER_FILL) >= 0, 'expected marker labels in the 1-7 window');
  var lastCircle = svg.lastIndexOf('<circle');
  var firstMarker = svg.indexOf(MARKER_FILL);
  assert.ok(lastCircle >= 0, 'expected note dots');
  assert.ok(firstMarker > lastCircle, 'marker labels must come after the last dot; got label@' + firstMarker + ' dot@' + lastCircle);
});

test('canvas reserves a 10px label band below the board when markers exist', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  // 6 strings: padY 13 * 2 + 5 * strSpace 21 + band 10 = 141
  assert.ok(el.innerHTML.indexOf('height="141"') >= 0, 'expected height 141, got: ' + (el.innerHTML.match(/height="\d+"/) || [])[0]);
});

test('marker labels sit clear BELOW the bottom string dots (no geometric overlap)', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  var svg = el.innerHTML;
  // lowest string line: cy = padY 13 + 5 * 21 = 118; dots reach 118 + 9.2 = 127.2
  var dotBottom = 118 + 9.2;
  // marker label baseline: y = H - 1 = 140; 10px font ascends to ~131.5 - still clear
  var labels = svg.split(MARKER_FILL).length - 1;
  assert.ok(labels >= 2, 'expected the 3/5/7 markers, got ' + labels);
  var re = /<text x="[\d.]+" y="([\d.]+)" fill="#6b7280"/g, m;
  while ((m = re.exec(svg))) {
    var baseline = parseFloat(m[1]);
    assert.ok(baseline - 10 > dotBottom, 'label text (baseline ' + baseline + ', 10px font) overlaps dots ending at ' + dotBottom);
  }
});

test('no markers in window -> no label band (height stays 131)', function () {
  // a 1-fret window (fret 1 only) contains none of the 3/5/7/9/12 marker frets
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 1 });
  var svg = el.innerHTML;
  assert.strictEqual(svg.indexOf(MARKER_FILL), -1, 'expected no marker labels');
  assert.ok(svg.indexOf('height="131"') >= 0, 'expected height 131, got: ' + (svg.match(/height="\d+"/) || [])[0]);
});

/* ---------- M-GUIDE W3a (section 2): opts.tones is EXTEND-not-overlay ---------- */
test('opts.tones ABSENT -> byte-identical render (SHA-256 lock against the pre-targeting baseline)', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  var hash = crypto.createHash('sha256').update(el.innerHTML).digest('hex');
  // Locked at the moment opts.tones was introduced (music/shared/diagram.js,
  // M-GUIDE W3a). A hash mismatch means the tones-absent render path changed -
  // re-verify deliberately before updating this literal.
  assert.strictEqual(hash, 'b4d62a3cde7c61effb9b551755e40ab58bcda42ba0142c8feaf5d8b4cb915004');
});
test('opts.tones present: root/chord/rub classes + CSS-var styles + dashed rub ring render', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10]; // C blues solo scale pcs (C D# F F# G A#)
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 10: 'chord' }, rubPc: 3 }
  });
  var svg = el.innerHTML;
  assert.ok(svg.indexOf('kx-root') >= 0, 'expected a kx-root dot');
  assert.ok(svg.indexOf('kx-chord') >= 0, 'expected a kx-chord dot');
  assert.ok(svg.indexOf('var(--kx-chord)') >= 0, 'chord dots must use the theme-safe --kx-chord var');
  assert.ok(svg.indexOf('kx-rub') >= 0, 'expected the rub modifier class on pc 3');
  assert.ok(svg.indexOf('stroke-dasharray="3 2"') >= 0, 'rub dot must render a dashed ring');
});
test('opts.tones present: chord/blue note text uses on-accent ink (legible against the bright kx fill)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 6: 'blue' }, rubPc: null }
  });
  var svg = el.innerHTML;
  // grab the <text> immediately following each kx-chord / kx-blue circle
  ['kx-chord', 'kx-blue'].forEach(function (cls) {
    var circleIdx = svg.indexOf(cls);
    assert.ok(circleIdx >= 0, 'expected a ' + cls + ' dot');
    var textIdx = svg.indexOf('<text', circleIdx);
    var textEl = svg.slice(textIdx, svg.indexOf('</text>', textIdx));
    assert.ok(textEl.indexOf('style="fill:var(--on-accent)"') >= 0, cls + ' note text must use --on-accent, got: ' + textEl);
  });
});
test('opts.tones present but a pc has no explicit class -> falls back to root/scale (not chord/blue)', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, tones: { byPc: {}, rubPc: null } });
  var svg = el.innerHTML;
  assert.ok(svg.indexOf('kx-root') >= 0, 'root pc falls back to kx-root when byPc has no entry');
  assert.ok(svg.indexOf('kx-scale') >= 0, 'non-root pcs fall back to kx-scale when byPc has no entry');
  assert.strictEqual(svg.indexOf('kx-chord'), -1, 'no chord entries -> no kx-chord class anywhere');
});

run();
