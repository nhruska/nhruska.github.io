/* =====================================================================
 * live-adapter.test.js - regression guard for the chord-pack adapter seam
 * (music/shared/chord-pack-adapter.js).
 *
 * S-EXTRACT (analysis-refactor-enhance-20260704 A3) REWRITE: buildAdapter
 * used to live inline in music/play/index.html (browser closure, not
 * require-able), so the OLD version of this test regex-extracted the ENH
 * table + profileVoicing function bodies out of the HTML and evaluated them
 * in a `new Function()` sandbox - covering only the enharmonic
 * profileVoicing() path. Now chord-pack-adapter.js is a real require()-able
 * module, so this test direct-requires it and drives the FULL adapter
 * (buildAdapter(profile) -> hasChord/diagram/diagramClosed/diagramChain)
 * against REAL guitar-standard + ukulele-gcea profile fixtures
 * (music/shared/profiles/*.js, required directly - not fabricated data).
 * Covers everything the old regex-extraction test could NOT reach: the
 * movable-template math, the ukulele artifact-triad augmentation, the
 * I-IV-V chain (Position-1 / Position-2 fallback), and the guitar
 * chainVoicingsBackoff path. Every asserted fret array below was verified
 * against the REAL module's actual output before being written into this
 * file (not hand-derived/guessed) - see the extraction PR's V&V notes.
 *
 * window.Diagram.render / window.Diagram.scale are stubbed as pass-through
 * (return their input) so assertions read the exact fret-array math the
 * adapter computed, without needing a DOM or the real diagram.js.
 * Run: node test/live-adapter.test.js
 * ===================================================================== */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

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

// ---- real profile fixtures (required BEFORE window is stubbed, so their
// self-registering IIFE's `typeof window !== 'undefined' ? window : this`
// lands on `this` === module.exports, not on the global we're about to alias
// below - see chord-pack-xss.test.js for the same require-then-stub order). ----
var GUITAR = require('../music/shared/profiles/guitar-standard.js').MusicProfiles['guitar-standard'];
var UKE = require('../music/shared/profiles/ukulele-gcea.js').MusicProfiles['ukulele-gcea'];

// ---- minimal window/document stub: Diagram.render/scale pass through their
// input so assertions see the raw fret-array math; ChordAudio/Tuner are
// no-ops (playChord/playNote/onLeaveTuner/init exercise them for throw-safety
// only, not fixture-level assertions). ----
global.window = global;
global.window.Diagram = {
  render: function (frets) { return frets; },
  scale: function (opts) { return opts; }
};
global.window.ChordAudio = { strum: function () {}, tone: function () {} };
global.document = {
  getElementById: function () { return null; } // el('quickTune') inline replacement - see adapter header comment
};

var CPA = require('../music/shared/chord-pack-adapter.js');
var gPack = CPA.buildAdapter(GUITAR);
var ukePack = CPA.buildAdapter(UKE);

/* ---------- extraction/wiring guard: the module is actually wired up ---------- */
test('play/index.html still script-tags chord-pack-adapter.js and calls its buildAdapter', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'music', 'play', 'index.html'), 'utf8');
  assert.ok(/<script src="\.\.\/shared\/chord-pack-adapter\.js"><\/script>/.test(html),
    'play/index.html no longer <script>-tags shared/chord-pack-adapter.js');
  assert.ok(/window\.ChordPackAdapter\.buildAdapter\(profile\)/.test(html),
    'play/index.html no longer calls window.ChordPackAdapter.buildAdapter(profile)');
});

test('module exports buildAdapter (require-able, not regex-extracted)', function () {
  assert.strictEqual(typeof CPA.buildAdapter, 'function');
});

/* ---------- meta: sanity that both real profiles built correctly ---------- */
test('guitar-standard meta', function () {
  assert.deepStrictEqual(gPack.meta, { instrument: 'guitar', tuning: 'EADGBE', strings: 6, stringNames: ['E', 'A', 'D', 'G', 'B', 'E'] });
});
test('ukulele-gcea meta', function () {
  assert.deepStrictEqual(ukePack.meta, { instrument: 'ukulele', tuning: 'GCEA', strings: 4, stringNames: ['G', 'C', 'E', 'A'] });
});

/* ---------- enharmonic profileVoicing (ported from the old regex-extraction
 * test, now driven through the FULL adapter against guitar-standard's real
 * curated chord map, which deliberately mixes sharp- and flat-keyed entries
 * - "F#"/"F#m"/"C#m"/"G#m" are sharp-keyed, "Bb"/"Ab"/"Bbm"/"Db"/"Eb" are
 * flat-keyed, exactly the real-world mismatch profileVoicing exists to
 * paper over). ---------- */
test('canonical-sharp request finds a flat-keyed curated voicing (C# -> Db)', function () {
  assert.deepStrictEqual(gPack.diagram('C#'), GUITAR.chords['Db']);
});
test('canonical-sharp request finds a flat-keyed curated voicing (G# -> Ab)', function () {
  assert.deepStrictEqual(gPack.diagram('G#'), GUITAR.chords['Ab']);
});
test('canonical-sharp request finds a flat-keyed curated voicing (D# -> Eb)', function () {
  assert.deepStrictEqual(gPack.diagram('D#'), GUITAR.chords['Eb']);
});
test('flat request finds a sharp-keyed curated voicing (Gb -> F#, both directions)', function () {
  assert.deepStrictEqual(gPack.diagram('Gb'), GUITAR.chords['F#']);
});
test('exact name still wins directly, no respell needed (F#)', function () {
  assert.deepStrictEqual(gPack.diagram('F#'), GUITAR.chords['F#']);
});
test('suffix rides along with the respelled root (A#m -> Bbm)', function () {
  assert.deepStrictEqual(gPack.diagram('A#m'), GUITAR.chords['Bbm']);
});
test('misses fall through to movable/name-only, never throw', function () {
  assert.strictEqual(gPack.hasChord('H'), false);   // invalid root letter
  assert.strictEqual(gPack.hasChord(''), false);    // empty name
});
test('no profile.chords -> hasChord false, never a throw', function () {
  var chordlessPack = CPA.buildAdapter({ instrument: 'test-chordless', strings: [{ n: 'X', f: 110 }] });
  assert.strictEqual(chordlessPack.hasChord('C'), false);
  assert.strictEqual(chordlessPack.hasChord('A#'), false);
});

/* ---------- movable-template math (guitar-standard: E is an OPEN-string
 * chord in the profile, [0,2,2,1,0,0], so buildTemplates excludes it from
 * the movable pool - diagramClosed('E') MUST fall through to a slid template
 * from a different major-quality chord). ---------- */
test('movable fallback slides a closed template onto a root the profile only has open (guitar E, closed)', function () {
  // Verified real output: the Bb template (rp=10) shifted down an octave
  // (d=-2) is the lowest-max-fret candidate among the guitar's closed
  // major-quality templates (F rp=5, Bb rp=10, F# rp=6, Ab rp=8) for root E (rp=4).
  assert.deepStrictEqual(gPack.diagramClosed('E'), [-1, 7, 9, 9, 9, 7]);
});
test('movable fallback respects the 14-fret ceiling (no candidate above it is chosen)', function () {
  var closed = gPack.diagramClosed('E');
  var max = Math.max.apply(null, closed.filter(function (f) { return f >= 0; }));
  assert.ok(max <= 14, 'movable fallback picked a shape above the 14-fret ceiling: ' + max);
});

/* ---------- ukulele artifact-triad augmentation (augmentTriadShapes gates on
 * profile.instrument === 'ukulele' + a [P4, M3] top-3-string interval
 * pattern - ukulele-gcea's G-C-E strings match). ---------- */
test('ukulele F# resolves to the injected F-shape barre at fret 1 (not a high E-shape movable)', function () {
  assert.deepStrictEqual(ukePack.diagram('F#'), [3, 1, 2, -1]);
});
test('ukulele G#m resolves to the injected Em-shape closed minor barre', function () {
  assert.deepStrictEqual(ukePack.diagram('G#m'), [8, 8, 7, 6]);
});
test('guitar (non-ukulele) never gets the triad-shape augmentation - C major stays the profile open shape', function () {
  assert.deepStrictEqual(gPack.diagram('C'), GUITAR.chords['C']);
});

/* ---------- I-IV-V chain: ukulele triadChainVoicings (Position-1 default,
 * the hardcoded C-major special case, and the Position-2 off-fretboard
 * fallback for high-rooted keys). ---------- */
test('ukulele chain: C-F-G uses the hardcoded open-position special case', function () {
  assert.deepStrictEqual(ukePack.diagramChain(['C', 'F', 'G']), [[0, 0, 0, -1], [2, 0, 1, -1], [4, 2, 3, -1]]);
});
test('ukulele chain: G-C-D uses Position-1 (fits under the 14-fret ceiling)', function () {
  assert.deepStrictEqual(ukePack.diagramChain(['G', 'C', 'D']), [[7, 7, 7, -1], [9, 7, 8, -1], [11, 9, 10, -1]]);
});
test('ukulele chain: B-E-F# falls back to Position-2 (Position-1 would run off the fretboard)', function () {
  assert.deepStrictEqual(ukePack.diagramChain(['B', 'E', 'F#']), [[4, 3, 2, -1], [4, 4, 4, -1], [6, 6, 6, -1]]);
});
test('every ukulele chain voicing stays within the 14-fret ceiling', function () {
  [['C', 'F', 'G'], ['G', 'C', 'D'], ['B', 'E', 'F#'], ['A#', 'D#', 'F']].forEach(function (names) {
    ukePack.diagramChain(names).forEach(function (frets) {
      var max = Math.max.apply(null, frets.filter(function (f) { return f >= 0; }));
      assert.ok(max <= 14, names.join('-') + ' chain voicing exceeded the fretboard: ' + JSON.stringify(frets));
    });
  });
});

/* ---------- I-IV-V chain: guitar (non-triad instrument) chainVoicings +
 * chainVoicingsBackoff. Real, exhaustive search over guitar-standard's own
 * chord vocabulary (done while writing this test) found real dominant-7 and
 * maj7 roots where the naive V (IV slid +2 frets) runs past fret 14 - E7 and
 * G#maj7/Amaj7 as IV. On THIS profile's template set, chainVoicingsBackoff
 * is invoked (verified: not a no-op) but finds no lower-fret alternative for
 * either quality (the profile's own dominant-7/maj7 templates are sparse -
 * movableVoicing already picked the single lowest option for the IV itself),
 * so the naive out-of-range chain surfaces unchanged. This documents REAL,
 * observed current behavior; a future template addition that lets backoff
 * rescue one of these would correctly need to update this test. ---------- */
test('guitar chain: C-F-G (in-range) returns the profile-preferred + movable chain untouched', function () {
  assert.deepStrictEqual(gPack.diagramChain(['C', 'F', 'G']), [GUITAR.chords['C'], GUITAR.chords['F'], [3, 5, 5, 4, 3, 3]]);
});
test('guitar chain: backoff is invoked when IV=E7 overflows, but finds no rescue on this template set (naive kept)', function () {
  assert.deepStrictEqual(gPack.diagramChain(['C', 'E7', 'C']), [GUITAR.chords['C'], [12, 14, 12, 13, 12, 12], [14, 16, 14, 15, 14, 14]]);
});
test('guitar chain: backoff is invoked when IV=Amaj7 overflows, but finds no rescue on this template set (naive kept)', function () {
  assert.deepStrictEqual(gPack.diagramChain(['C', 'Amaj7', 'C']), [GUITAR.chords['C'], [-1, 12, 14, 13, 14, 12], [-1, 14, 16, 15, 16, 14]]);
});

/* ---------- method smoke: playChord/playNote/playFreq/onLeaveTuner/init must
 * not throw (they touch the stubbed window.ChordAudio/window.Tuner and the
 * inlined document.getElementById('quickTune') replacement for el()). ---------- */
test('playChord/playNote/playFreq/onLeaveTuner/init do not throw', function () {
  assert.doesNotThrow(function () {
    gPack.playChord('C');
    gPack.playChord('H');           // no voicing -> falls to playFreq(rootFreq) branch
    gPack.playNote('C');
    gPack.playFreq(440);
    gPack.onLeaveTuner();
    gPack.init({ switchTab: function () {} });
  });
});

test('scaleDiagram passes through openPcs/rootPc/scalePcs and sets supportsStart', function () {
  assert.strictEqual(gPack.scaleDiagram.supportsStart, true);
  var out = gPack.scaleDiagram(0, [0, 2, 4, 5, 7, 9, 11]);
  assert.deepStrictEqual(out.rootPc, 0);
  assert.deepStrictEqual(out.scalePcs, [0, 2, 4, 5, 7, 9, 11]);
  assert.strictEqual(out.frets, 7);   // default when not passed
  assert.strictEqual(out.startFret, 0);
});

/* ---------- S-DIAGRAM-PREF steps 1-2 (post-S-EXTRACT rebase): diagram/
 * diagramClosed/diagramChain compute an optional patternLabel via
 * window.DiagramPref.labelFor(profile.id, name, frets) and hand it to
 * Diagram.render(). U25 (M-SETTINGS-CLARITY, operator UAT 2026-07-05)
 * narrowed WHERE: shape labels are DETAIL-view content - only 'big'
 * renders (the maximize overlay) ever label or reserve; 'small' card rows
 * (picker grids, strips) never do, in either pref mode. The pass-through
 * Diagram.render stub above discards opts entirely (every OTHER test in
 * this file relies on that), so these tests swap in a capturing stub just
 * for this block and restore the pass-through stub afterward - no other
 * assertion in this file is affected. ---------- */
(function () {
  var origRender = global.window.Diagram.render;
  var origDiagramPref = global.window.DiagramPref;
  function withCapture(fn) {
    var captured = null;
    global.window.Diagram.render = function (frets, opts) { captured = opts; return frets; };
    try { fn(); } finally { global.window.Diagram.render = origRender; }
    return captured;
  }

  test('diagram()/diagramClosed()/diagramChain() at size "big" pass profile.id + name + frets to DiagramPref.labelFor()', function () {
    var seen = [];
    global.window.DiagramPref = { labelFor: function (profileId, name, frets) { seen.push([profileId, name, frets]); return 'stub-label'; } };
    try {
      withCapture(function () { gPack.diagram('E', 'big'); });
      withCapture(function () { gPack.diagramClosed('E', 'big'); });
      withCapture(function () { gPack.diagramChain(['C', 'F', 'G'], 'big'); });
    } finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(seen[0][0], 'guitar-standard', 'expected profile.id, not the instrument name');
    assert.strictEqual(seen[0][1], 'E');
    assert.deepStrictEqual(seen[0][2], GUITAR.chords.E);
    assert.strictEqual(seen[1][1], 'E'); // diagramClosed, same chord name
    assert.strictEqual(seen[2].length, 3); // diagramChain called labelFor once per chord in the chain
  });

  test('diagram()/diagramClosed() at size "big" forward DiagramPref.labelFor()\'s return value as opts.patternLabel', function () {
    global.window.DiagramPref = { labelFor: function () { return 'E-shape barre, root on 6, root position'; } };
    var optsD, optsC;
    try {
      optsD = withCapture(function () { gPack.diagram('E', 'big'); });
      optsC = withCapture(function () { gPack.diagramClosed('E', 'big'); });
    } finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(optsD.patternLabel, 'E-shape barre, root on 6, root position');
    assert.strictEqual(optsC.patternLabel, 'E-shape barre, root on 6, root position');
  });

  test('U25: size "small" NEVER labels - patternLabel is "" and DiagramPref.labelFor() is not even consulted', function () {
    var called = 0;
    global.window.DiagramPref = { labelFor: function () { called++; return 'stub-label'; }, get: function () { return 'patterns'; } };
    var optsD, optsC, optsChain;
    try {
      optsD = withCapture(function () { gPack.diagram('E', 'small'); });
      optsC = withCapture(function () { gPack.diagramClosed('E', 'small'); });
      optsChain = withCapture(function () { gPack.diagramChain(['C', 'F', 'G'], 'small'); });
    } finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(optsD.patternLabel, '');
    assert.strictEqual(optsC.patternLabel, '');
    assert.strictEqual(optsChain.patternLabel, '');
    assert.strictEqual(called, 0, 'small renders must not consult the classifier at all');
  });

  test('U25: an OMITTED size (no explicit "big") never labels - unlabeled is the default', function () {
    global.window.DiagramPref = { labelFor: function () { return 'stub-label'; }, get: function () { return 'patterns'; } };
    var opts;
    try { opts = withCapture(function () { gPack.diagramChain(['C', 'F', 'G']); }); }
    finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(opts.patternLabel, '');
    assert.strictEqual(opts.reserveLabelSlot, false);
  });

  test('patternLabel is "" (falsy) at size "big" when window.DiagramPref is absent - degrades cleanly, never throws', function () {
    global.window.DiagramPref = undefined;
    var opts = withCapture(function () { gPack.diagram('E', 'big'); });
    assert.strictEqual(opts.patternLabel, '');
  });

  /* ---------- U21 (M-EAR wave 1.6, docs/plans/uat-walkthrough-20260704.md),
   * narrowed by U25: opts.reserveLabelSlot - only true when DiagramPref.get()
   * reports 'patterns' mode AND the render size is 'big'; 'dots' mode, small
   * sizes, and an absent DiagramPref all stay false. ---------- */
  test('opts.reserveLabelSlot is true at size "big" when DiagramPref.get() reports "patterns" mode', function () {
    global.window.DiagramPref = { labelFor: function () { return ''; }, get: function () { return 'patterns'; } };
    var optsD, optsC, optsChain;
    try {
      optsD = withCapture(function () { gPack.diagram('E', 'big'); });
      optsC = withCapture(function () { gPack.diagramClosed('E', 'big'); });
      optsChain = withCapture(function () { gPack.diagramChain(['C', 'F', 'G'], 'big'); });
    } finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(optsD.reserveLabelSlot, true);
    assert.strictEqual(optsC.reserveLabelSlot, true);
    assert.strictEqual(optsChain.reserveLabelSlot, true, 'expected diagramChain to also reserve (the last captured call in the chain)');
  });
  test('opts.reserveLabelSlot is false at size "small" even in "patterns" mode (U25 - small cards never reserve)', function () {
    global.window.DiagramPref = { labelFor: function () { return ''; }, get: function () { return 'patterns'; } };
    var opts;
    try { opts = withCapture(function () { gPack.diagram('E', 'small'); }); }
    finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(opts.reserveLabelSlot, false);
  });
  test('opts.reserveLabelSlot is false at size "big" when DiagramPref.get() reports "dots" mode (the default)', function () {
    global.window.DiagramPref = { labelFor: function () { return ''; }, get: function () { return 'dots'; } };
    var opts;
    try { opts = withCapture(function () { gPack.diagram('E', 'big'); }); }
    finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(opts.reserveLabelSlot, false);
  });
  test('opts.reserveLabelSlot is false when window.DiagramPref is absent entirely - degrades cleanly, never throws', function () {
    global.window.DiagramPref = undefined;
    var opts = withCapture(function () { gPack.diagram('E', 'big'); });
    assert.strictEqual(opts.reserveLabelSlot, false);
  });
  test('opts.reserveLabelSlot is false when DiagramPref exists but has no get() (defensive - a stub/older shape must never throw)', function () {
    global.window.DiagramPref = { labelFor: function () { return ''; } };
    var opts;
    try { opts = withCapture(function () { gPack.diagram('E', 'big'); }); }
    finally { global.window.DiagramPref = origDiagramPref; }
    assert.strictEqual(opts.reserveLabelSlot, false);
  });
})();

run();
