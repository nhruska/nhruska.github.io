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

run();
