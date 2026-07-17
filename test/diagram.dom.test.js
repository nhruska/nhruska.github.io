/* =====================================================================
 * diagram.dom.test.js  -  drives the REAL Diagram.scale() AND Diagram.render()
 * through a minimal stub document and inspects the produced SVG/HTML STRING.
 * scale(): the fret-number labels must paint AFTER the note dots (SVG paints
 * in document order - the old order hid the numbers behind the bottom
 * string's dots) and the canvas must reserve a label band below the board so
 * the two can't collide at all.
 * render() (S-DIAGRAM-PREF step 2): opts.patternLabel is EXTEND-not-overlay -
 * absent renders byte-identical to the pre-existing chord-diagram output;
 * present appends an escaped caption below the diagram, nothing else changes.
 * Also covers notifyRendered()'s music:diagram-rendered CustomEvent trigger
 * hook (S-DIAGRAM-PREF step 1).
 * Run: node test/diagram.dom.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var crypto = require('crypto');

/* ---- just enough DOM for scale(): createElement + className/innerHTML ---- */
global.document = {
  createElement: function (tag) { return { tagName: tag, className: '', innerHTML: '' }; }
};

// S-HARDEN (analysis-refactor-enhance-20260704 A5): diagram.js's esc() is now
// a delegate to esc.js's Esc.esc (the ghost-dot label path below calls it) -
// alias window to the real global BEFORE requiring either, same pattern as
// test/songbook.test.js, so both modules' IIFEs land on one shared object.
if (typeof global.window === 'undefined') global.window = global;
require('../music/shared/esc.js');
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
  //
  // RE-VERIFIED + UPDATED (M-EAR wave 1.5, U12): every dot now carries a
  // `class="kxDot"` + `data-pc="<pc>"` regardless of opts.tones - the
  // fretboard sounding-highlight lookup key key-explorer.js's
  // boxWrap.setSounding(pc) queries. This IS an intentional, reviewed change
  // to the tones-absent baseline (not a regression) - the kx-sounding CLASS
  // itself is still never baked into this render (added later via JS
  // classList, see key-explorer.js), so that half of the contract holds.
  assert.strictEqual(hash, 'fee1611e28fe2679e66a9c2bac65aa599ab01ee28e21318bd7eaf1932f56b524');
});

/* ---------- M-EAR wave 1.5 (U12): data-pc marker + kx-sounding never baked in ---------- */
test('opts.tones absent: every dot still carries data-pc (the sounding-highlight lookup key), one per in-scale note', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  var svg = el.innerHTML;
  var matches = svg.match(/data-pc="\d+"/g) || [];
  assert.ok(matches.length > 0, 'expected data-pc attributes on the tones-absent render');
  matches.forEach(function (m) {
    var pc = parseInt(m.match(/\d+/)[0], 10);
    assert.ok(C_MAJOR.indexOf(pc) !== -1, 'data-pc ' + pc + ' must be one of the rendered scale pcs');
  });
});
test('opts.tones present: dots ALSO carry data-pc alongside their kx-* class (both markers coexist)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord' }, rubPc: null }
  });
  var svg = el.innerHTML;
  var rootIdx = svg.indexOf('kx-root');
  var circleStart = svg.lastIndexOf('<circle', rootIdx);
  var circleTag = svg.slice(circleStart, svg.indexOf('/>', circleStart) + 2);
  assert.ok(/data-pc="0"/.test(circleTag), 'expected data-pc="0" on the kx-root dot, got: ' + circleTag);
});
test('kx-sounding is NEVER present in the static render (tones absent or present) - it is added later via JS classList, not baked in here', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var withoutTones = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7 });
  var withTones = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7, tones: { byPc: { 0: 'root' }, rubPc: null } });
  assert.strictEqual(withoutTones.innerHTML.indexOf('kx-sounding'), -1);
  assert.strictEqual(withTones.innerHTML.indexOf('kx-sounding'), -1);
});

/* ---------- M-EAR wave 1.5 (U13): F=POS_CAP(14) full-neck window geometry ----------
 * Same W = padX+openColW+F*fretW+padX formula defaultFrets' F=12 comment
 * documents (349px) - F=14 (the "0-14" full-neck span key-explorer.js
 * requests) computes 15+19+14*25+15 = 399px. */
test('F=14 open window (full-neck span, key-explorer.js POS_CAP): computes 399px wide', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 14 });
  assert.ok(el.innerHTML.indexOf('width="399"') >= 0, 'expected width 399, got: ' + (el.innerHTML.match(/width="\d+"/) || [])[0]);
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
test('opts.tones present: root note text uses on-accent ink (legible against the bright --accent fill)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 6: 'blue' }, rubPc: null }
  });
  var svg = el.innerHTML;
  var circleIdx = svg.indexOf('kx-root');
  assert.ok(circleIdx >= 0, 'expected a kx-root dot');
  var textIdx = svg.indexOf('<text', circleIdx);
  var textEl = svg.slice(textIdx, svg.indexOf('</text>', textIdx));
  assert.ok(textEl.indexOf('style="fill:var(--on-accent)"') >= 0, 'root note text must use --on-accent, got: ' + textEl);
});
// U3 (operator UAT 2026-07-04): kx-chord/kx-blue used to share the root dot's
// --on-accent ink, which is dark-on-dark in light theme (tracks.css darkens
// --kx-chord/--kx-blue there for contrast against the page). Each class now
// gets its own theme-safe ink var - tracks.css defines --kx-chord-ink and
// --kx-blue-ink per theme; diagram.js just needs to reference the right var.
test('opts.tones present: kx-chord note text uses --kx-chord-ink (not the shared --on-accent)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord' }, rubPc: null }
  });
  var svg = el.innerHTML;
  var circleIdx = svg.indexOf('kx-chord');
  assert.ok(circleIdx >= 0, 'expected a kx-chord dot');
  var textIdx = svg.indexOf('<text', circleIdx);
  var textEl = svg.slice(textIdx, svg.indexOf('</text>', textIdx));
  assert.ok(textEl.indexOf('style="fill:var(--kx-chord-ink)"') >= 0, 'kx-chord note text must use --kx-chord-ink, got: ' + textEl);
  assert.strictEqual(textEl.indexOf('var(--on-accent)'), -1, 'kx-chord note text must NOT fall back to the shared --on-accent');
});
test('opts.tones present: kx-blue note text uses --kx-blue-ink (not the shared --on-accent)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 6: 'blue' }, rubPc: null }
  });
  var svg = el.innerHTML;
  var circleIdx = svg.indexOf('kx-blue');
  assert.ok(circleIdx >= 0, 'expected a kx-blue dot');
  var textIdx = svg.indexOf('<text', circleIdx);
  var textEl = svg.slice(textIdx, svg.indexOf('</text>', textIdx));
  assert.ok(textEl.indexOf('style="fill:var(--kx-blue-ink)"') >= 0, 'kx-blue note text must use --kx-blue-ink, got: ' + textEl);
  assert.strictEqual(textEl.indexOf('var(--on-accent)'), -1, 'kx-blue note text must NOT fall back to the shared --on-accent');
});
test('opts.tones present but a pc has no explicit class -> falls back to root/scale (not chord/blue)', function () {
  var el = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_MAJOR, rootPc: 0, frets: 7, tones: { byPc: {}, rubPc: null } });
  var svg = el.innerHTML;
  assert.ok(svg.indexOf('kx-root') >= 0, 'root pc falls back to kx-root when byPc has no entry');
  assert.ok(svg.indexOf('kx-scale') >= 0, 'non-root pcs fall back to kx-scale when byPc has no entry');
  assert.strictEqual(svg.indexOf('kx-chord'), -1, 'no chord entries -> no kx-chord class anywhere');
});

/* ---------- P5 seasoned-player fold (2026-07-05): ghost dots for chord tones
 * OUTSIDE the current scale - supersedes the original D-TARGET "intersection-
 * only" deferral (hiding the money note taught the wrong habit). ---------- */
test('opts.tones.ghostPcs renders hollow kx-ghost dots (fill:none, --kx-ghost stroke) at the correct fret position', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10]; // C blues solo scale (C D# F F# G A#) - E (pc 4) is NOT in it
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 10: 'chord' }, rubPc: 3, ghostPcs: [4] }
  });
  var svg = el.innerHTML;
  assert.ok(svg.indexOf('kx-ghost') >= 0, 'expected a kx-ghost dot for pc 4 (E, the C7 major 3rd, outside C blues)');
  var ghostIdx = svg.indexOf('kx-ghost');
  var circleStart = svg.lastIndexOf('<circle', ghostIdx);
  var circleTag = svg.slice(circleStart, svg.indexOf('/>', circleStart) + 2);
  assert.ok(circleTag.indexOf('fill="none"') >= 0, 'ghost dot must be hollow (fill:none), got: ' + circleTag);
  assert.ok(circleTag.indexOf('var(--kx-ghost)') >= 0, 'ghost dot must use the theme-safe --kx-ghost var, got: ' + circleTag);
  // note text right after the ghost circle also uses --kx-ghost ink
  var textIdx = svg.indexOf('<text', ghostIdx);
  var textEl = svg.slice(textIdx, svg.indexOf('</text>', textIdx));
  assert.ok(textEl.indexOf('var(--kx-ghost)') >= 0, 'ghost note text must use --kx-ghost, got: ' + textEl);
});
test('opts.tones.ghostPcs ABSENT or empty -> zero kx-ghost dots (no target active = no ghosts)', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var noGhostKey = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 10: 'chord' }, rubPc: 3 } });
  assert.strictEqual(noGhostKey.innerHTML.indexOf('kx-ghost'), -1, 'ghostPcs key absent -> no ghost dots');
  var emptyGhosts = D.scale({ openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root' }, rubPc: null, ghostPcs: [] } });
  assert.strictEqual(emptyGhosts.innerHTML.indexOf('kx-ghost'), -1, 'empty ghostPcs array -> no ghost dots');
});
test('ghost dots still respect z-order: fret-number labels paint AFTER them too', function () {
  var C_BLUES = [0, 3, 5, 6, 7, 10];
  var el = D.scale({
    openPcs: GUITAR_OPEN, scalePcs: C_BLUES, rootPc: 0, frets: 7,
    tones: { byPc: { 0: 'root', 7: 'chord', 10: 'chord' }, rubPc: 3, ghostPcs: [4] }
  });
  var svg = el.innerHTML;
  var lastGhostCircle = svg.lastIndexOf('kx-ghost');
  var firstMarker = svg.indexOf(MARKER_FILL);
  assert.ok(firstMarker > lastGhostCircle, 'marker labels must paint after ghost dots too');
});

/* ---------- S-DIAGRAM-PREF step 2: Diagram.render()'s opts.patternLabel is
 * EXTEND-not-overlay, same contract as scale()'s opts.tones above. ---------- */
var E_OPEN = [0, 2, 2, 1, 0, 0]; // guitar open E - a real, classifiable voicing

test('opts.patternLabel ABSENT -> byte-identical chord-diagram render, small size (SHA-256 lock)', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E' });
  var hash = crypto.createHash('sha256').update(el.innerHTML).digest('hex');
  // Locked at the moment opts.patternLabel was introduced (music/shared/
  // diagram.js, S-DIAGRAM-PREF step 2). A hash mismatch means the label-
  // absent render path changed - re-verify deliberately before updating.
  assert.strictEqual(hash, '47a0d049153b841f4b8270e3210299c4d53ab9459d89e6fc963aeb9f7588ce32');
});
test('opts.patternLabel ABSENT -> byte-identical chord-diagram render, big size (SHA-256 lock)', function () {
  var el = D.render(E_OPEN, { size: 'big', name: 'E' });
  var hash = crypto.createHash('sha256').update(el.innerHTML).digest('hex');
  assert.strictEqual(hash, 'e3d216a3bef5d0eb0dfd17e08117955064ca9724ad75266315fca0789c585b58');
});
test('opts.patternLabel present appends an escaped caption; the diagram markup ahead of it is untouched', function () {
  var label = 'open E shape, root on 6, root position';
  var withLabel = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: label });
  var withoutLabel = D.render(E_OPEN, { size: 'small', name: 'E' });
  var labelStart = withLabel.innerHTML.indexOf('<div class="dg-shapeLabel"');
  assert.ok(labelStart > 0, 'expected a dg-shapeLabel div appended to the render');
  assert.strictEqual(withLabel.innerHTML.slice(0, labelStart), withoutLabel.innerHTML,
    'everything before the label div must render identically to the label-absent output');
  assert.ok(withLabel.innerHTML.indexOf(label) >= 0, 'expected the label text itself in the render');
});
test('opts.patternLabel escapes HTML-unsafe characters (never raw-injects markup)', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: '<script>x</script>' });
  assert.strictEqual(el.innerHTML.indexOf('<script>x</script>'), -1, 'must not render an unescaped <script> tag');
  assert.ok(el.innerHTML.indexOf('&lt;script&gt;') >= 0, 'expected the HTML-escaped form');
});
test('opts.patternLabel as an empty string behaves like absent (no label div rendered)', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: '' });
  assert.strictEqual(el.innerHTML.indexOf('dg-shapeLabel'), -1, 'empty string must not render a label div');
});

/* ---------- U21 (M-EAR wave 1.6, docs/plans/uat-walkthrough-20260704.md):
 * opts.reserveLabelSlot - card-height parity for an honest-null classifier
 * result (e.g. an uncurated dim/aug quality) alongside classified siblings
 * in the same row. ---------- */
test('opts.reserveLabelSlot ABSENT (every pre-existing caller) -> byte-identical to the pre-U21 SHA-256 lock, small size', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E' });
  var hash = crypto.createHash('sha256').update(el.innerHTML).digest('hex');
  assert.strictEqual(hash, '47a0d049153b841f4b8270e3210299c4d53ab9459d89e6fc963aeb9f7588ce32');
});
test('opts.reserveLabelSlot=true + patternLabel empty -> renders an EMPTY dg-shapeLabel div (the reserved slot), never the classifier text', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: '', reserveLabelSlot: true });
  var start = el.innerHTML.indexOf('<div class="dg-shapeLabel"');
  assert.ok(start > 0, 'expected a dg-shapeLabel div even with an empty patternLabel');
  var afterOpenTag = el.innerHTML.indexOf('>', start) + 1;
  var closeTag = el.innerHTML.indexOf('</div>', afterOpenTag);
  assert.strictEqual(el.innerHTML.slice(afterOpenTag, closeTag), '', 'expected the reserved slot to hold no text when patternLabel is empty');
});
test('opts.reserveLabelSlot=true reserves the SAME slot markup ahead of it as a classified sibling - only the inner text differs', function () {
  var label = 'open E shape, root on 6, root position';
  var classified = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: label, reserveLabelSlot: true });
  var unclassified = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: '', reserveLabelSlot: true });
  var classifiedLabelStart = classified.innerHTML.indexOf('<div class="dg-shapeLabel"');
  var unclassifiedLabelStart = unclassified.innerHTML.indexOf('<div class="dg-shapeLabel"');
  assert.strictEqual(classified.innerHTML.slice(0, classifiedLabelStart), unclassified.innerHTML.slice(0, unclassifiedLabelStart),
    'the diagram markup ahead of the label div must be identical regardless of classifier result');
  assert.ok(/min-height:3\.75em/.test(unclassified.innerHTML), 'expected the reserved slot to carry the same min-height as a populated slot, so an empty row-mate renders close to the same height');
});
test('opts.reserveLabelSlot=false (explicit) + empty patternLabel behaves like absent - no label div (does not accidentally reserve)', function () {
  var el = D.render(E_OPEN, { size: 'small', name: 'E', patternLabel: '', reserveLabelSlot: false });
  assert.strictEqual(el.innerHTML.indexOf('dg-shapeLabel'), -1, 'reserveLabelSlot:false must not render a label div for an empty label');
});

/* ---------- S-DIAGRAM-PREF step 1: notifyRendered()'s trigger hook ---------- */
test('render() with a real voicing dispatches exactly one music:diagram-rendered CustomEvent', function () {
  var fired = 0;
  var origDispatch = global.dispatchEvent, origCE = global.CustomEvent;
  global.CustomEvent = function (type) { this.type = type; };
  global.dispatchEvent = function (ev) { if (ev && ev.type === 'music:diagram-rendered') fired++; };
  try { D.render(E_OPEN, { size: 'small', name: 'E' }); }
  finally { global.dispatchEvent = origDispatch; global.CustomEvent = origCE; }
  assert.strictEqual(fired, 1, 'expected exactly one dispatch for a real chord render');
});
test('render() with no frets (name-only placeholder) never dispatches the trigger signal', function () {
  var fired = 0;
  var origDispatch = global.dispatchEvent, origCE = global.CustomEvent;
  global.CustomEvent = function (type) { this.type = type; };
  global.dispatchEvent = function (ev) { if (ev && ev.type === 'music:diagram-rendered') fired++; };
  try { D.render(null, { size: 'small', name: 'Zzz' }); }
  finally { global.dispatchEvent = origDispatch; global.CustomEvent = origCE; }
  assert.strictEqual(fired, 0, 'a name-only fallback (no real chord data) must not fire the trigger signal');
});
test('render() is a safe no-op signal-wise when window.dispatchEvent/CustomEvent are absent (Node test harness default)', function () {
  assert.strictEqual(typeof global.dispatchEvent, 'undefined', 'precondition: no dispatchEvent stub active');
  assert.doesNotThrow(function () { D.render(E_OPEN, { size: 'small', name: 'E' }); });
});

run();
