/* =====================================================================
 * sound.js  -  M-EAR wave 1: zero-dependency scale/mode AUDITION. Global: Sound
 * ---------------------------------------------------------------------
 * "Music is heard, not seen" (vision-ear-first-20260704.md). A scale/mode is
 * hummable: tap play, hear it loop at a slow hum-along tempo, watch a marker
 * bounce across the notes so eye and ear land on the same note together.
 *
 * Public API:
 *   Sound.noteHz(pc, octave)                    - A440 equal-temperament Hz
 *                                                  for a pitch class + octave
 *   Sound.playScale(pcs, opts) -> { stop(), retarget(newPcs) }
 *     - loop an octave-folded
 *     opts: rootOctave (default 4), bpm (default 72), loop (default true),
 *           onNote(i)  - fires once per note, i indexes the FULL played
 *                        sequence (length = pcs.length + 1: the ascent plus
 *                        the closing root an octave up). Consumers with a
 *                        pcs.length-token notes/degrees line map the marker
 *                        back with `i % pcs.length` - the closing root lands
 *                        the marker back on token 0, no extra DOM node needed.
 *                        After a retarget(), i resumes counting from 0
 *                        against the NEW pcs - map against the CURRENTLY
 *                        active scale's length, not a value captured at
 *                        playScale() call time (M-EAR wave 1.5).
 *           onStop()   - fires once when playback ends (stop() called, the
 *                        non-looping pass finished, or another playScale()
 *                        call preempted this one). retarget() never fires
 *                        onStop - the loop keeps running, just on new pcs.
 *     handle.retarget(newPcs) (M-EAR wave 1.5, U11) - swaps the sounding
 *       scale to newPcs at the NEXT note boundary (no click/gap: the note
 *       already in flight finishes naturally; only the tick AFTER it picks
 *       up the new sequence, restarting the ascent from newPcs's own root -
 *       i resets to 0, not wherever the old sequence had reached). Lets a
 *       scale-chip switch keep the audition PLAYING for a live A/B compare
 *       instead of stop-then-restart. A no-op (silently ignored, playback
 *       continues unchanged) if newPcs is empty/unresolvable, or if playback
 *       has already stopped.
 *   Sound.stopAll()                              - stop whatever is playing,
 *     app-wide, without holding a handle (teardown safety net for a view
 *     that's going away).
 *
 * ONLY ONE PLAYBACK APP-WIDE: playScale() stops any prior active playback
 * (calling its onStop) before starting - so the Studio and Compose surfaces
 * never sound over each other; starting one always silences the other.
 *
 * THE SWAP SEAM: every oscillator this module ever creates goes through the
 * ONE internal voice(a, freq, when, dur) function below. A future provider
 * (Karplus-Strong string synthesis, #88; or sampled tones) replaces ONLY
 * voice()'s body - noteHz/playScale/schedulePass and every consumer
 * (tracks.js, songbook.js) stay untouched. Keep all timbre decisions there.
 *
 * OWN AudioContext (not shared with audio.js/tuner.js): this app's existing
 * convention is each module owns a private lazy AudioContext (audio.js's
 * ChordAudio has one, tuner.js has a SEPARATE one for reference tones plus
 * its own mic-input context) - none are exported for reuse. sound.js follows
 * the same convention rather than inventing a new cross-module sharing seam.
 *
 * Test-only hooks (leading underscore, mirrors notables.js's
 * _resetArbitration convention): _buildNoteSequence, _schedulePass,
 * _nextIndex, _ctxState. Real (non-test) consumers use only the public API
 * above.
 * ===================================================================== */
(function (global) {
  'use strict';

  var AC = null;
  function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }

  function whenRunning(a, play) {
    if (a.state === 'running') { play(); return; }
    a.resume().then(play);
  }

  // A440 equal temperament. MIDI 69 = A4 = 440Hz; MIDI = 12*(octave+1) + pc.
  // pc wraps to 0-11 and folds any overflow/underflow into the octave, so
  // noteHz(12, 4) === noteHz(0, 5) and noteHz(-1, 4) === noteHz(11, 3).
  function noteHz(pc, octave) {
    var oct = typeof octave === 'number' ? octave : 4;
    var wrapped = ((pc % 12) + 12) % 12;
    oct += Math.floor(pc / 12);
    var midi = 12 * (oct + 1) + wrapped;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Pure: turns a scale's pitch-class list (as circle.js returns it - NOT
  // guaranteed monotonically increasing; e.g. F# major's pcs run
  // 6,8,10,11,1,3,5 because pitch classes wrap at 12 while the scale keeps
  // ascending) into an octave-folded ASCENDING note sequence, then appends
  // the closing root one octave above wherever the ascent left off. Every
  // entry is { pc, octave }. Length is always pcs.length + 1 for a non-empty
  // input, [] for an empty one.
  function buildNoteSequence(pcsIn, rootOctave) {
    var rootOct = typeof rootOctave === 'number' ? rootOctave : 4;
    var pcs = (pcsIn || []).map(function (p) { return ((p % 12) + 12) % 12; });
    if (!pcs.length) return [];
    var notes = [], oct = rootOct, prev = null;
    pcs.forEach(function (pc) {
      if (prev !== null && pc <= prev) oct++;
      notes.push({ pc: pc, octave: oct });
      prev = pc;
    });
    var rootPc = notes[0].pc;
    if (rootPc <= prev) oct++;
    notes.push({ pc: rootPc, octave: oct });
    return notes;
  }

  // Pure: the loop-wrap arithmetic for the live ticker below. Returns the
  // next index (0..len-1) when looping wraps past the end, or -1 to signal
  // "sequence complete, stop" for a non-looping pass.
  function nextIndex(i, len, loop) {
    var n = i + 1;
    if (n < len) return n;
    return loop ? 0 : -1;
  }

  // THE SWAP SEAM (see header). Triangle-wave oscillator, short linear
  // attack into an exponential decay - hummable, not harsh (no click at
  // note-on, no abrupt cutoff at note-off). `a` is any AudioContext-shaped
  // object (real-time AudioContext OR OfflineAudioContext) so the exact same
  // function renders live playback and the offline render-evidence test.
  function voice(a, freq, when, dur) {
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    var peak = 0.22;
    var attack = Math.min(0.03, dur * 0.3);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(a.destination);
    o.start(when); o.stop(when + dur + 0.02);
  }

  // Schedules ONE pass of `notes` (an array of { pc, octave }, as returned by
  // buildNoteSequence) onto `a`, starting at `startAt` (seconds, `a`'s own
  // clock), each note lasting `noteDur` seconds with a short release gap so
  // consecutive notes don't blur together. Works for both a single note
  // ([n]) and a full pass (the whole array) - the live ticker below calls it
  // once per note; the OfflineAudioContext test calls it once for the whole
  // sequence, then renders. Returns the scheduled pass duration (seconds).
  function schedulePass(a, notes, startAt, noteDur) {
    notes.forEach(function (n, i) {
      voice(a, noteHz(n.pc, n.octave), startAt + i * noteDur, noteDur * 0.85);
    });
    return notes.length * noteDur;
  }

  // ---- app-wide "only one playback at a time" singleton ----
  var activePlayback = null;
  function stopAll() { if (activePlayback) activePlayback.stop(); }

  function playScale(pcsIn, opts) {
    opts = opts || {};
    var notes = buildNoteSequence(pcsIn, opts.rootOctave);
    var onNote = typeof opts.onNote === 'function' ? opts.onNote : null;
    var onStop = typeof opts.onStop === 'function' ? opts.onStop : null;
    if (!notes.length) { if (onStop) onStop(); return { stop: function () {} }; }
    var bpm = opts.bpm || 72;
    var noteDur = 60 / bpm; // quarter-note pulse at a hummable (slow) tempo
    var loop = opts.loop !== false;

    stopAll(); // starting a new audition always silences whatever else was sounding

    var a = ctx();
    var stopped = false;
    var timers = [];
    // M-EAR wave 1.5 (U11): a queued scale swap, applied at the NEXT step()
    // tick rather than immediately - the note already scheduled via
    // schedulePass keeps sounding to its natural end (no click/gap); only the
    // boundary after it picks up the new sequence, restarting at index 0 (the
    // new scale's own root) per the header's documented contract.
    var pendingNotes = null;
    var handle = { stop: doStop, retarget: retarget };
    activePlayback = handle;

    function clearTimers() { timers.forEach(clearTimeout); timers.length = 0; }
    function doStop() {
      if (stopped) return;
      stopped = true;
      clearTimers();
      if (activePlayback === handle) activePlayback = null;
      if (onStop) onStop();
      // polite audio citizen (matches audio.js/tuner.js convention): release
      // the device's audio focus shortly after the loop actually stops.
      setTimeout(function () { if (a && a.state === 'running') a.suspend(); }, 500);
    }
    function retarget(newPcsIn) {
      if (stopped) return;
      var newNotes = buildNoteSequence(newPcsIn, opts.rootOctave);
      if (!newNotes.length) return; // unresolvable target - keep playing the current scale
      pendingNotes = newNotes;
    }
    function step(i) {
      if (stopped) return;
      if (pendingNotes) { notes = pendingNotes; pendingNotes = null; i = 0; }
      if (onNote) onNote(i);
      schedulePass(a, [notes[i]], a.currentTime, noteDur);
      var ni = nextIndex(i, notes.length, loop);
      if (ni === -1) { timers.push(setTimeout(doStop, noteDur * 1000)); return; }
      timers.push(setTimeout(function () { step(ni); }, noteDur * 1000));
    }
    whenRunning(a, function () { step(0); });
    return handle;
  }

  global.Sound = {
    noteHz: noteHz,
    playScale: playScale,
    stopAll: stopAll,
    // test-only hooks (leading underscore - see header)
    _buildNoteSequence: buildNoteSequence,
    _schedulePass: schedulePass,
    _nextIndex: nextIndex,
    _ctxState: function () { return AC ? AC.state : null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Sound;

})(typeof window !== 'undefined' ? window : this);
