/* =====================================================================
 * studio-theory.js  -  Practice Studio theory + solo-guide + JIT text
 * ---------------------------------------------------------------------
 * The Practice Studio's non-UI theory layer, lifted verbatim out of
 * tracks.js so the theory/solo-scale/whynote reasoning reads apart from
 * the finder data (tracks-model.js) and the Studio DOM wiring (tracks.js).
 * Owns: mode resolution, the Circle/Notables/GuidanceLevel/SoloGuide
 * guarded refs, key labels, the studioTheory scale bundle, the
 * solo-scale chip bundle, the progression-aware default-scale inference,
 * box-scale eligibility, chord-tone targeting, and the whynote/scaletip/
 * studio-first JIT banner copy. Pure + module-scope so tests drive the
 * SAME functions the Studio wiring calls.
 *
 * No build step. Classic script. Exposes a single global: `StudioTheory`.
 * Loads AFTER tracks-model.js, BEFORE tracks.js (which rebinds these
 * names as locals). Depends only on tracks-model.js (5 helpers below) and,
 * at call time, the guarded window.Circle / Notables / GuidanceLevel /
 * SoloGuide singletons.
 * ===================================================================== */
(function (global) {
  'use strict';
  // Finder data layer helpers this theory layer needs (tracks-model.js loads
  // first; a require() fallback keeps the Node test path on one module instance).
  var TM = global.TracksModel || (typeof require === 'function' ? require('./tracks-model.js') : null);
  var normRoot = TM.normRoot;
  var rootIndex = TM.rootIndex;
  var notesToPcs = TM.notesToPcs;
  var familyMode = TM.familyMode;
  var normMode = TM.normMode;
  // Resolve any incoming mode string to the ACTUAL scale mode the Practice Studio
  // renders. The Studio teaches 4 modes faithfully: major/minor plus the two most
  // common modal colours (dorian, mixolydian). Accepts lowercase circle-family
  // names, legacy capitalized inputs (Major/Minor/Dorian/Mixolydian), and bare
  // family words - anything it does not recognize coarsens to the major/minor
  // family via normMode (never throws, never silently lands on ionian for a
  // minor-family input like phrygian). Unlike familyMode this preserves the modal
  // colour so an A Dorian track lights a Dorian scale, not a plain minor one.
  function resolveScaleMode(mode) {
    var m = String(mode == null ? '' : mode).trim().toLowerCase();
    if (m === 'ionian' || m === 'major') return 'ionian';
    if (m === 'aeolian' || m === 'minor') return 'aeolian';
    if (m === 'dorian') return 'dorian';
    if (m === 'mixolydian') return 'mixolydian';
    // Blues is a harmonizing key model (I7/IV7/V7, songbook.js MODES.Blues),
    // not a circle-of-fifths mode - resolve it explicitly before the major/minor
    // family fallback so a Blues-keyed Compose progression opens the Studio on its
    // own blues scale + BLUES_KEY palette (studioTheory below), not a coarsened major.
    if (m === 'blues') return 'blues';
    return familyMode(normMode(mode));
  }
  function shortMode(label) { return label.replace(/\s*\(.*\)/, ''); }
  // Mode-honest short key label: 'A' (major), 'Am' (minor), 'A dorian' /
  // 'G mixolydian' (modal). Used by the curation-queue rows; the Studio meta
  // derives its own from studioTheory. Library/finder facet labels still
  // coarsen modal modes - unifying them is queued in the UI-polish arc.
  function keyLabelFor(key, mode) {
    var m = String(mode == null ? '' : mode).trim().toLowerCase();
    // Key-aware spelling: the DISPLAYED key root is the preferred enharmonic
    // name (A# minor -> Bbm); the key TOKEN callers store/compare stays canonical.
    key = dispKeyRoot(key, m || 'major');
    if (m === 'minor' || m === 'aeolian') return key + 'm';
    if (m === 'dorian' || m === 'mixolydian') return key + ' ' + m;
    if (m === 'blues') return key + ' blues';
    return key;
  }
  // Circle source: window.Circle in the browser (classic scripts). Under Node
  // the IIFE's `global` is this module's own exports object, so a test can
  // never inject Circle there - fall back to a guarded require so the REAL
  // studioTheory is drivable from test/tracks.test.js. No-op in the browser.
  function circleRef() {
    if (global.Circle) return global.Circle;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./circle.js'); } catch (e) {}
    }
    return null;
  }
  // Same guarded-reference pattern as circleRef() above, for the Notables
  // singleton: window.Notables in the browser, a require() fallback in Node so
  // test/tracks.test.js drives the SAME module instance test/notables.test.js
  // exercises directly (shared require-cache entry, not a duplicate).
  function notablesRef() {
    if (global.Notables) return global.Notables;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./notables.js'); } catch (e) {}
    }
    return null;
  }
  // Same guarded-reference pattern, for guidance-level.js's
  // music.guidanceLevel.v1 singleton (window.GuidanceLevel in the browser,
  // a require() fallback in Node so test/tracks.test.js drives the SAME
  // module instance test/guidance-level.test.js exercises directly).
  function guidanceLevelRef() {
    if (global.GuidanceLevel) return global.GuidanceLevel;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./guidance-level.js'); } catch (e) {}
    }
    return null;
  }
  // The Practice Studio's theory bundle for a key+mode: scale notes, pitch
  // classes, degrees, diatonic chords, display label. Module-scope + exported
  // so tests can drive the SAME function the Studio wiring calls (a direct
  // resolveScaleMode test alone would let the openStudio path regress green).
  // Returns null when Circle is absent or the key is unresolvable (callers
  // fall back to the bare player / a YouTube search).
  function studioTheory(key, mode) {
    var C = circleRef(), k = normRoot(key), rp = rootIndex(k);
    if (!C || rp < 0) return null;
    var scaleMode = resolveScaleMode(mode);
    // Blues has no Circle.MODE_INFO/diatonic() entry (it is the solo
    // 'blues' scale plus the separate BLUES_KEY I7/IV7/V7 palette, not a circle-
    // of-fifths mode) - branch before the generic diatonic path below.
    if (scaleMode === 'blues') {
      // Key-aware spelling: display notes are KEY-AWARE (C blues -> C Eb F Gb G Bb, the
      // standard spelling) - tokens/pcs stay canonical; only note NAMES changed.
      var bnotes = C.soloScaleInKey ? C.soloScaleInKey(k, 'blues', mode) : C.soloScale(k, 'blues');
      return {
        key: k, scaleMode: scaleMode, rootPc: rp, notes: bnotes, pcs: notesToPcs(bnotes),
        degrees: C.soloScaleDegrees('blues'), chords: C.bluesKey(k), label: 'Blues'
      };
    }
    // Key-aware spelling: scale note names spell letter-per-degree from the preferred
    // tonic name (C mixolydian shows Bb, never A#; A#-major contexts render as Bb
    // major). CHORD tokens below stay canonical-sharp - they key voicing/audio/
    // theory lookups; their DISPLAY is remapped at the render seams (dispChord).
    var notes = C.scaleInKey ? C.scaleInKey(k, scaleMode) : C.scale(k, scaleMode);
    return {
      key: k, scaleMode: scaleMode, rootPc: rp, notes: notes, pcs: notesToPcs(notes),
      degrees: C.scaleDegrees(scaleMode), chords: C.diatonic(k, scaleMode),
      label: shortMode(C.modeInfo(scaleMode).label)
    };
  }
  // Key-aware spelling display helpers: a chord/note NAME rendered inside a stated
  // key respells by function (bVII of C = Bb); the underlying token is untouched
  // (packs, audio, targeting, storage all stay canonical-sharp). Pure; exported
  // for tests. Falls back to the token when Circle lacks the kernel.
  function dispKeyRoot(key, mode) {
    var C = circleRef();
    return (C && C.preferredTonicName) ? C.preferredTonicName(key, mode) : key;
  }
  function dispChord(chord, keyRoot, keyMode) {
    var C = circleRef();
    if (!C || !C.noteInKey) return chord;
    var m = /^([A-Ga-g][#b]?)(.*)$/.exec(String(chord || '').trim());
    if (!m) return chord;
    return C.noteInKey(keyRoot, keyMode, m[1]) + m[2];
  }
  // The Practice Studio's scale-chip swap bundle - SOLO LAYER ONLY.
  // scaleId 'mode' (or falsy) delegates straight to studioTheory() so the
  // default chip is IDENTICAL to prior Studio behavior (no
  // reimplementation, no drift risk). Any other scaleId (a Circle.SOLO_SCALES
  // key: pentMajor/pentMinor/blues) reads ONLY Circle.soloScale/soloScaleDegrees/
  // soloScaleInfo - it never touches C.diatonic()/chords, so chords-in-key,
  // buildWhy, and whynote are untouched by any chip tap (see the
  // harmonization-isolation test in tracks.test.js). Module-scope + exported
  // so tests drive the SAME function the Studio chip wiring calls. Returns
  // null when Circle/key/scaleId can't resolve (callers keep the prior bundle
  // on-screen rather than clearing it).
  function soloBundle(key, mode, scaleId) {
    if (!scaleId || scaleId === 'mode') {
      var th = studioTheory(key, mode);
      return th ? { notes: th.notes, pcs: th.pcs, degrees: th.degrees, label: th.label } : null;
    }
    var C = circleRef(), k = normRoot(key);
    if (!C || rootIndex(k) < 0 || typeof C.soloScale !== 'function') return null;
    // Key-aware spelling: key-aware note names (letter-per-degree from the mode-aware
    // preferred tonic); pcs derive from the same names so dots + names agree.
    var notes = C.soloScaleInKey ? C.soloScaleInKey(k, scaleId, mode) : C.soloScale(k, scaleId);
    if (!notes.length) return null;
    var info = C.soloScaleInfo(scaleId);
    return { notes: notes, pcs: notesToPcs(notes), degrees: C.soloScaleDegrees(scaleId), label: info ? info.label : scaleId };
  }
  // The theory-best solo scale to PRE-SELECT when the Studio opens (music-theory-coach),
  // from the incoming key + mode AND the actual progression shape (t.seq, which
  // studioTarget() preserves from the Compose hand-off). Reads Circle.romanFor (the
  // SSOT for degree analysis) - never
  // guesses. The two common modal signals:
  //   - a bVII MAJOR in a major-key progression  -> Mixolydian (the b7 rock/backdoor color)
  //   - a major IV in a minor-key progression      -> Dorian (the raised-6 color)
  // Otherwise the safe pentatonic of the key's quality (the home a player of any level
  // cannot sound wrong over). A Blues key keeps its own scale (its mode chip IS blues).
  // The result maps 1:1 onto a chip wireScaleChips offers for that key (guarded there).
  // Pure + module-scope + exported so tests drive the SAME function the Studio wiring calls.
  function inferSoloDefault(key, mode, seq) {
    var scaleMode = resolveScaleMode(mode);
    if (scaleMode === 'blues') return 'mode';
    var C = circleRef();
    var fam = (C && C.modeInfo) ? ((C.modeInfo(scaleMode) || {}).family) : null;
    var base = fam === 'minor' ? 'pentMinor' : 'pentMajor';
    if (!C || typeof C.romanFor !== 'function' || !Array.isArray(seq) || !seq.length) return base;
    var tonicChord = normRoot(key) + (fam === 'minor' ? 'm' : '');
    var romans = seq.map(function (ch) { return C.romanFor(ch, tonicChord); }).filter(Boolean);
    if (fam === 'major') {
      // a bVII MAJOR (uppercase = major quality) is the Mixolydian tell; only offer it
      // when the key is not ALREADY mixolydian (its own mode chip covers that).
      if (scaleMode !== 'mixolydian' && romans.indexOf('bVII') >= 0) return 'mixolydian';
    } else {
      // a MAJOR IV (uppercase) over a minor tonic is the Dorian tell (raised 6th).
      if (scaleMode !== 'dorian' && romans.indexOf('IV') >= 0) return 'dorian';
    }
    return base;
  }
  // Which of the 3 box-eligible scale ids (pentMajor/
  // pentMinor/blues) applies to the CURRENTLY selected chip - so the
  // Studio's named-box chip + pager-snap (KeyExplorer.renderScale's
  // opts.boxScaleId) only activate for those, never for a 7-note mode
  // scale. scaleId 'mode' resolves via modeScaleMode (th.scaleMode): the
  // ONLY 'mode' case that's box-eligible is the Blues key (its
  // own scale IS the SOLO_SCALES.blues 6-note set) - every other mode
  // (ionian/aeolian/dorian/mixolydian) keeps the classic fixed 0/5/10 walk.
  // Module-scope + exported (mirrors soloBundle/scaleKeyFor) so this is
  // directly unit-testable without the Studio DOM.
  var BOX_SCALE_IDS = { pentMajor: true, pentMinor: true, blues: true };
  function boxScaleIdFor(scaleId, modeScaleMode) {
    if (scaleId && scaleId !== 'mode') return BOX_SCALE_IDS[scaleId] ? scaleId : null;
    return modeScaleMode === 'blues' ? 'blues' : null;
  }
  // soloScaleFraming MOVED VERBATIM to solo-guide.js
  // as SoloGuide.framing(scaleId, family) - same behavior, same static
  // strings. Moved (not duplicated) so the Compose solo chips (songbook.js) can
  // call the identical function without depending on tracks.js.
  // Same guarded-reference pattern as circleRef()/notablesRef() above: window.SoloGuide
  // in the browser, a require() fallback in Node so tracks.test.js and solo-guide.test.js
  // share one require-cache module instance (not a duplicate).
  function soloGuideRef() {
    if (global.SoloGuide) return global.SoloGuide;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./solo-guide.js'); } catch (e) {}
    }
    return null;
  }
  // Chord-tone targeting: pure pc-arithmetic classifier.
  // Precedence root > chord > blue > scale (blue is defaultTones' job below, not
  // this fn's). The chord's root is parsed locally (not read off Circle.chordTones'
  // internal pc order) so this stays independent of that function's array shape.
  // Returns null when chordName is falsy/unresolvable - callers treat that as "no
  // target".
  //
  // Ghost dots: a chord tone OUTSIDE the
  // current scale is exactly the note a seasoned player reaches for on purpose
  // (e.g. C# - the major 3rd - over A7 in A blues is the money note that IS the
  // rub's resolution target). Hiding it taught the wrong habit - this supersedes
  // an earlier intersection-only approach that dropped those notes entirely.
  // ghostPcs carries those out-of-scale chord tones so the caller can render
  // them as hollow dots at their correct fret positions - never as a filled
  // kx-chord/kx-root mark.
  function targetTones(scalePcs, scaleRootPc, chordName) {
    var C = circleRef();
    if (!C || !chordName) return null;
    var m = /^([A-Ga-g][#b]?)/.exec(String(chordName).trim());
    if (!m) return null;
    var chordRootPc = rootIndex(normRoot(m[1]));
    if (chordRootPc < 0) return null;
    var ctPcs = C.chordTones(chordName);
    if (!ctPcs.length) return null;
    var inScale = {};
    (scalePcs || []).forEach(function (p) { inScale[((p % 12) + 12) % 12] = true; });
    var byPc = {}, ghostPcs = [];
    ctPcs.forEach(function (p) {
      var pc = ((p % 12) + 12) % 12;
      if (!inScale[pc]) { if (ghostPcs.indexOf(pc) < 0) ghostPcs.push(pc); return; }
      byPc[pc] = (pc === chordRootPc) ? 'root' : 'chord';
    });
    // dominant-quality rub: chordTones carries BOTH the major 3rd (+4) and the
    // dominant 7th (+10) -> the target's minor-3rd-equivalent (root+3) is the rub
    // note (e.g. Eb over C7, Bb over G7 in C blues; nothing over a plain IV7).
    var rubPc = null;
    if (ctPcs.indexOf((chordRootPc + 4) % 12) >= 0 && ctPcs.indexOf((chordRootPc + 10) % 12) >= 0) {
      var cand = (chordRootPc + 3) % 12;
      if (inScale[cand]) rubPc = cand;
    }
    return { byPc: byPc, rubPc: rubPc, ghostPcs: ghostPcs };
  }
  // The ALWAYS-ON default mark (independent of any active target) -
  // the blues solo scale's b5 (scaleRootPc+6), whenever the blues scale renders.
  // bundle.pcs[0] is always the scale's own root pc (every SOLO_SCALES/diatonic
  // formula starts at semitone 0), so this works for both a studioTheory bundle
  // and a soloBundle() chip-swap result without needing a separate rootPc field.
  function defaultTones(bundle) {
    if (!bundle || bundle.label !== 'Blues' || !bundle.pcs || !bundle.pcs.length) return null;
    var rootPc = bundle.pcs[0];
    var bluePc = (rootPc + 6) % 12;
    var byPc = {}; byPc[bluePc] = 'blue';
    return { byPc: byPc, rubPc: null };
  }
  // A one-shot JIT "why" notable
  // at the Compose -> Studio hand-off (openStudio below - the seam where the
  // solo-scale panel first renders for a key+mode). TWO STATIC templates only,
  // chosen by a plain string switch on th.scaleMode - zero new theory derivation.
  // modeName reuses the exact major/minor/label.toLowerCase() mapping buildWhy
  // already computes for its own "A minor" display line (no new lookup either).
  // Interpolates only th.key + that mode name - both are labels the Studio
  // already renders elsewhere on the same screen.
  function whynoteText(key, scaleMode, label) {
    key = dispKeyRoot(key, scaleMode); // Key-aware spelling: prose shows the preferred name
    var modeName = scaleMode === 'aeolian' ? 'minor' : scaleMode === 'ionian' ? 'major' : label.toLowerCase();
    if (scaleMode === 'ionian') {
      return 'Why this scale works: ' + key + ' major and its relative minor share the same notes - solo either over this progression.';
    }
    // Minor/modal (aeolian, dorian, mixolydian): the parallel-phrased equivalent -
    // true for all three (each differs from its parallel major by at least one
    // degree), so one template covers the whole non-ionian family.
    return 'Why this scale works: ' + key + ' ' + modeName + ' and its parallel major share the same home note, not the same notes - stick with ' + key + ' ' + modeName + ' here.';
  }
  // The whynote banner used to explain ONLY
  // the key's own mode scale (whynoteText above) and never updated when a
  // scale chip was tapped (wireScaleChips deliberately left it "keyed to
  // th"). This re-derives the banner copy for the ACTUAL selected scale chip.
  // scaleId 'mode' (or falsy) passes straight through to whynoteText - zero
  // behavior change for the default/unswapped case. Every other scaleId gets
  // its own STATIC one-line template (music-theory-coach + copy-coach) - no
  // new theory derivation, same shape as whynoteText: only
  // the key name is interpolated, via the same dispKeyRoot(key, keyScaleMode)
  // call whynoteText makes (so a flat key still reads "Bb", never "A#").
  // Scale identity is named by its own CHIP LABEL (Pent major/Pent minor/
  // Blues/Mixolydian/Dorian), same vocabulary choice scaletipText already
  // uses, rather than introducing the jargon noun "pentatonic" (whynote can
  // show at the 'intermediate' guidance level, whose copy vocabulary
  // budget doesn't yet include that word).
  function whynoteScaleText(key, scaleId, keyScaleMode, keyLabel) {
    if (!scaleId || scaleId === 'mode') return whynoteText(key, keyScaleMode, keyLabel);
    var dispKey = dispKeyRoot(key, keyScaleMode); // Key-aware spelling: prose shows the preferred name
    switch (scaleId) {
      case 'pentMajor':
        return 'Why Pent major works: it drops the two notes that ever clash, so nothing you play over ' + dispKey + ' sounds wrong.';
      case 'pentMinor':
        return 'Why Pent minor works: it drops the two notes that ever clash, so nothing you play over ' + dispKey + ' sounds wrong.';
      case 'blues':
        return 'Why Blues works: Pent minor plus one extra in-between note - the classic blue note - for grit over ' + dispKey + '.';
      case 'mixolydian':
        return 'Why Mixolydian works: ' + dispKey + ' major with the 7th flatted - the bluesy, backdoor color for this progression.';
      case 'dorian':
        return 'Why Dorian works: a minor scale with the 6th raised, for a brighter, hopeful color over ' + dispKey + '.';
      default:
        return whynoteText(key, keyScaleMode, keyLabel);
    }
  }
  // Consumer-side claim + template pick for the 'whynote' notable slot (priority
  // order + show-once persistence are notables.js's job, not re-implemented here).
  // Returns Notables.renderBanner()-ready opts when the slot is won (first ever
  // call, or a repeat call while still un-dismissed); returns null when the slot
  // is denied (already dismissed forever, OR a higher-priority notable - firstrun
  // outranks whynote - currently holds it) or Notables isn't loaded. Callers skip
  // silently on null, matching the notables.js consumer contract.
  // Reads the current level via guidanceLevelRef() and threads it as
  // claim()'s 3rd arg (retro-tagged 'intermediate'+'advanced' in notables.js's
  // LEVELS table) - a beginner or unset level now blocks whynote entirely.
  function whynoteBanner(th) {
    var N = notablesRef();
    var GL = guidanceLevelRef();
    var level = GL ? GL.get() : null;
    if (!N || typeof N.claim !== 'function' || !N.claim('whynote', undefined, level)) return null;
    return { consumerId: 'whynote', text: whynoteText(th.key, th.scaleMode, th.label), className: 'bt-st-notable' };
  }
  // "scale chips work over any chord in the key"
  // JIT cue on first Studio open, advanced tier only - mirrors whynoteBanner's
  // exact shape (consumer-side claim + template, priority/show-once left to notables.js).
  // Pure text fn kept separate (like whynoteText) so tests can assert the
  // copy independent of the claim/level plumbing.
  function scaletipText(key, mode) {
    key = dispKeyRoot(key, mode); // Key-aware spelling: prose shows the preferred name, real mode
    return 'Try the scale chips below - Pent major, Pent minor, and Blues all fit over ' + key + ' too. The fretboard pattern is the guide.';
  }
  // The BEGINNER Studio orientation tip (pedagogy-coach + copy-coach) -
  // whynote/scaletip gate to intermediate/advanced,
  // which correctly hid theory prose from beginners but left them with a bare
  // fretboard and jargon chips. ONE action-first line in the beginner
  // vocabulary budget, at the moment of relevance, show-once + dismissible
  // (the notables contract). Mirrors scaletipBanner's exact shape.
  function studioFirstText() {
    return 'Tap a chord below to hear it - the dots show where to play along on the neck.';
  }
  function studioFirstBanner() {
    var N = notablesRef();
    var GL = guidanceLevelRef();
    var level = GL ? GL.get() : null;
    if (!N || typeof N.claim !== 'function' || !N.claim('studiofirst', undefined, level)) return null;
    return { consumerId: 'studiofirst', text: studioFirstText(), className: 'bt-st-notable' };
  }
  function scaletipBanner(th) {
    var N = notablesRef();
    var GL = guidanceLevelRef();
    var level = GL ? GL.get() : null;
    if (!N || typeof N.claim !== 'function' || !N.claim('scaletip', undefined, level)) return null;
    return { consumerId: 'scaletip', text: scaletipText(th.key, th.scaleMode), className: 'bt-st-notable' };
  }

  global.StudioTheory = {
    resolveScaleMode: resolveScaleMode, shortMode: shortMode, keyLabelFor: keyLabelFor,
    circleRef: circleRef, notablesRef: notablesRef, guidanceLevelRef: guidanceLevelRef,
    soloGuideRef: soloGuideRef,
    studioTheory: studioTheory, dispKeyRoot: dispKeyRoot, dispChord: dispChord,
    soloBundle: soloBundle, inferSoloDefault: inferSoloDefault, boxScaleIdFor: boxScaleIdFor,
    targetTones: targetTones, defaultTones: defaultTones,
    whynoteText: whynoteText, whynoteScaleText: whynoteScaleText, whynoteBanner: whynoteBanner,
    scaletipText: scaletipText, scaletipBanner: scaletipBanner,
    studioFirstText: studioFirstText, studioFirstBanner: studioFirstBanner
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.StudioTheory;

})(typeof window !== 'undefined' ? window : this);
