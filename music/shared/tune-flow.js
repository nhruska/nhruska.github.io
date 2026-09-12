/* =====================================================================
 * tune-flow.js  -  Guided Tune state machine (pure, DOM-free, deterministic)
 * ---------------------------------------------------------------------
 * The LOOP behind guided tuning, with no mic, no DOM, no clock of its own:
 *
 *     Start -> lowest string -> approach from flat -> sustained arrival
 *           -> landed -> celebrate -> auto-advance -> ... -> done
 *
 * tuner.js owns the audio (detectPitchNear, drone) and the pixels; THIS
 * file owns the decision "where are we in the loop", so the whole flow is
 * provable in Node. The caller feeds one detector frame at a time:
 *
 *     var flow = TuneFlow.create({ strings: [{ n, l, f }, ...] });
 *     flow.start();                       // target = strings[0]
 *     flow.feed(cents, nowMs);            // cents vs the CURRENT target, or
 *                                         // null for an unvoiced frame
 *     flow.on('landed', function (ev, st) { ... });
 *
 * Contract (the operator's stated model of tuning: approach from flat):
 *   - phases: 'idle' | 'approach' | 'arriving' | 'landed' | 'done'
 *   - hints:  'sharp' at >= sharpCents (+3), 'flat' at <= flatCents (-4),
 *             else 'near' - the same thresholds as tuner.js tuneHint.
 *   - smoothing lives HERE: a 5-frame median of voiced frames, then an EMA
 *     keyed to distance from target (fast attack far out, heavy damping
 *     when honing). A frame > 40 c from the running median is a glitch and
 *     is ignored unless 4 consecutive glitch frames agree, then adopted.
 *     start()/retarget() reset the window and EMA so the first voiced
 *     frame snaps (no lag on a new target).
 *   - arrival must be SUSTAINED and VOICED: smoothed |cents| <= inTuneCents
 *     enters 'arriving'; staying inside the zone for holdMs lands it; a
 *     voiced frame outside the zone, or an unvoiced gap longer than gapMs,
 *     drops back to 'approach'. Sharp frames never count toward arrival -
 *     overshoot is a normal approach state, never an error, never an
 *     advance.
 *   - landed holds for celebrateMs (the read is frozen on the landing
 *     value), then advances to the next undone string in order (wrapping),
 *     or 'done' when every string has landed.
 *   - the HOLD ACCUMULATES: voiced in-zone time adds up across brief dips
 *     (a pluck decaying, a flat-side wobble of < wobbleCents); only a pause
 *     longer than gapMs, a sharp read, or a real departure resets it.
 *   - the RATCHET: the peg is the controller. A read moving UP shows at
 *     once; a read going flatter must persist dropFrames frames by
 *     dropCents before the needle drops (flat side only).
 *   - state() also carries per-attempt diagnostics: bestHoldMs (the longest
 *     hold reached since the last retarget), resets and lastReset ('sound
 *     died' | 'went sharp' | 'dropped flat' | 'wobbled too long').
 *   - set(partial) updates any DEFAULTS key live (the tuning lab sliders);
 *     params() returns the current values.
 *   - ALL time comes from the nowMs argument. No Date.now, no timers.
 *   - state() returns a fresh plain object every call.
 *
 * Events (handler gets the payload, then flow.state()):
 *   'retarget' { index, target }      'landed' { index, target, nowMs }
 *   'advance'  { index, target }      'done'   { nowMs }
 * ===================================================================== */
(function (global) {
  'use strict';

  var DEFAULTS = {
    holdMs: 450,        // VOICED in-zone time that must ACCUMULATE before a string lands
    celebrateMs: 700,   // how long 'landed' shows before auto-advance
    inTuneCents: 2.5,   // |cents| <= this is "in the zone" for arrival
    wobbleCents: 2,     // out of the zone by less than this PAUSES the hold instead of resetting it
    sharpCents: 3,      // >= this reads 'sharp' (overshoot - back off, come up)
    flatCents: -4,      // <= this reads 'flat' (keep coming up - the good direction)
    gapMs: 700,         // a pause (unvoiced, or a small wobble) longer than this resets the hold
    medianFrames: 5,    // shorter than tuner.js's 8: guided mode tracks a moving peg
    honeK: 0.07,        // EMA coefficient when honing (|cents| <= 5)
    midK: 0.16,         // ... closing in (5 < |cents| <= 15)
    farK: 0.35,         // ... far off (fast attack)
    dropCents: 1.5,     // RATCHET: a flatter read must fall by at least this ...
    dropFrames: 6       // ... for this many consecutive frames before the needle drops (0 = off)
  };
  var GLITCH_CENTS = 40;   // a frame this far from the running median is a blip
  var GLITCH_ADOPT = 4;    // ... unless this many consecutive blips agree
  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Same thresholds as tuner.js tuneHint: tight on the sharp side, a little
  // room on the flat side, because you land coming UP from flat.
  function hintFor(cents, opts) {
    if (cents === null) return null;
    if (cents >= opts.sharpCents) return 'sharp';
    if (cents <= opts.flatCents) return 'flat';
    return 'near';
  }

  // EMA coefficient by distance from target (mirrors tuner.js micLoop):
  // far off -> track quickly (fast attack); closing in -> moderate;
  // honing (<= 5 c) -> heavy damping so the read sits dead still.
  function emaK(acents, o) {
    if (acents > 15) return o.farK;
    if (acents > 5) return o.midK;
    return o.honeK;
  }

  function create(opts) {
    opts = opts || {};
    if (!opts.strings || !opts.strings.length) throw new Error('TuneFlow.create: opts.strings is required');
    var strings = opts.strings.slice();
    var o = {};
    for (var key in DEFAULTS) o[key] = (opts[key] == null) ? DEFAULTS[key] : opts[key];

    var phase = 'idle', index = 0, target = null;
    var progress = strings.map(function () { return false; });
    var listeners = {};

    // smoothing state. `ema` tracks the signal; `shown` is what the user sees -
    // the RATCHET: the peg is the controller, so a read that goes UP (toward
    // the post) shows at once, a read that goes FLATTER must persist for
    // dropFrames frames by dropCents before the needle follows it down.
    var window = [], glitchRun = [], ema = null, shown = null, dropRun = 0, raw = null;
    // timing state (all in the caller's nowMs)
    var holdAcc = 0, lastInZoneAt = null, lastVoicedAt = null, landedAt = null, lastNow = null;
    // per-attempt diagnostics (the tuning lab's 'last pluck' line): the best hold
    // reached since the last retarget, how many times it was reset, and why
    var bestHold = 0, resets = 0, lastReset = null;

    function emit(name, payload) {
      var fns = (listeners[name] || []).slice();
      for (var i = 0; i < fns.length; i++) fns[i](payload, state());
    }

    function resetSmoothing() { window = []; glitchRun = []; ema = null; shown = null; dropRun = 0; raw = null; }
    function clearTimers() { holdAcc = 0; lastInZoneAt = null; lastVoicedAt = null; landedAt = null; bestHold = 0; resets = 0; lastReset = null; }
    function resetHold(why) { if (holdAcc > 0 || phase === 'arriving') { resets++; lastReset = why; } phase = 'approach'; holdAcc = 0; lastInZoneAt = null; }
    // live parameter update (the tuning lab sliders) - only known keys, never strings
    function set(partial) { for (var k in partial) if (k in DEFAULTS && partial[k] != null && isFinite(partial[k])) o[k] = +partial[k]; return o; }
    function params() { var c = {}; for (var k in o) c[k] = o[k]; return c; }

    // Push one voiced frame through median + glitch gate + EMA. Returns the
    // new smoothed cents.
    function smooth(cents) {
      if (window.length) {
        var ref = median(window);
        if (Math.abs(cents - ref) > GLITCH_CENTS) {
          // A blip must not yank the read. But if the deviation PERSISTS and
          // the blips agree with each other, it is a real move - adopt it.
          if (glitchRun.length && Math.abs(cents - glitchRun[glitchRun.length - 1]) > GLITCH_CENTS) glitchRun = [];
          glitchRun.push(cents);
          if (glitchRun.length >= GLITCH_ADOPT) { window = [cents]; glitchRun = []; }
          else return shown;
        } else {
          glitchRun = [];
          window.push(cents); while (window.length > o.medianFrames) window.shift();
        }
      } else {
        window = [cents];
      }
      var med = median(window);
      if (ema === null) ema = med;                    // first voiced frame snaps
      else ema += (med - ema) * emaK(Math.abs(med), o);
      // the ratchet (flat side only - on the sharp side a drop is the way home)
      if (shown === null || o.dropFrames <= 0 || shown >= o.sharpCents || ema >= shown - o.dropCents) { shown = ema; dropRun = 0; }
      else if (++dropRun >= o.dropFrames) { shown = ema; dropRun = 0; }
      return shown;
    }

    function holdProgress() {
      if (phase === 'landed') return 1;
      if (phase !== 'arriving') return 0;
      return Math.max(0, Math.min(1, holdAcc / o.holdMs));
    }

    function state() {
      return {
        phase: phase,
        index: index,
        target: target,
        cents: shown,
        rawCents: raw,
        hint: hintFor(shown, o),
        progress: progress.slice(),
        holdProgress: holdProgress(),
        landedAt: phase === 'landed' ? landedAt : null,
        bestHoldMs: bestHold,
        resets: resets,
        lastReset: lastReset
      };
    }

    // Point the flow at string i: phase 'approach', fresh smoothing, timers
    // cleared. Emits nothing - callers emit ('advance' must precede the
    // 'retarget' on the auto-advance path).
    function moveTo(i) {
      index = i;
      target = strings[i];
      phase = 'approach';
      resetSmoothing();
      clearTimers();
    }
    function goTo(i) {
      moveTo(i);
      emit('retarget', { index: index, target: target });
    }

    function nextUndone(from) {
      for (var step = 1; step <= strings.length; step++) {
        var i = (from + step) % strings.length;
        if (!progress[i]) return i;
      }
      return -1;
    }

    function start(i) {
      if (i == null) i = 0;
      if (i < 0 || i >= strings.length) return;
      if (phase === 'idle' || phase === 'done') progress = strings.map(function () { return false; });
      goTo(i);
    }

    function retarget(i) {
      if (phase === 'done') return;
      if (i == null || i < 0 || i >= strings.length) return;
      goTo(i);   // from 'landed' this cancels the celebration: no 'advance' fires
    }

    function stop() {
      phase = 'idle';
      resetSmoothing();
      clearTimers();
      lastNow = null;
    }

    function feed(cents, nowMs) {
      if (phase === 'idle' || phase === 'done') return state();
      lastNow = nowMs;
      var voiced = typeof cents === 'number' && isFinite(cents);

      if (phase === 'landed') {
        // Celebration: the read is frozen on the landing value; frames only
        // move the clock. After celebrateMs, advance or finish.
        if (nowMs - landedAt >= o.celebrateMs) {
          var nx = nextUndone(index);
          if (nx < 0) {
            phase = 'done';
            clearTimers();
            emit('done', { nowMs: nowMs });
          } else {
            moveTo(nx);
            emit('advance', { index: index, target: target });
            emit('retarget', { index: index, target: target });
          }
        }
        return state();
      }

      if (voiced) {
        raw = cents;
        lastVoicedAt = nowMs;
        var sm = smooth(cents);
        var a = Math.abs(sm), inZone = a <= o.inTuneCents;
        // a small flat-side wobble just outside the zone PAUSES the hold; a
        // sharp read or a real departure resets it
        var wobble = !inZone && sm < 0 && a <= o.inTuneCents + o.wobbleCents;
        if (inZone) {
          if (lastInZoneAt !== null && nowMs - lastInZoneAt <= o.gapMs) holdAcc += nowMs - lastInZoneAt;
          lastInZoneAt = nowMs;
          if (holdAcc > bestHold) bestHold = holdAcc;
          phase = 'arriving';
          if (holdAcc >= o.holdMs) {
            phase = 'landed'; landedAt = nowMs; progress[index] = true;
            emit('landed', { index: index, target: target, nowMs: nowMs });
          }
        } else if (wobble) {
          if (lastInZoneAt !== null && nowMs - lastInZoneAt > o.gapMs) resetHold('wobbled too long');
        } else {
          resetHold(sm > 0 ? 'went sharp' : 'dropped flat');   // drifted out / overshot - re-approach
        }
      } else if (phase === 'arriving' && lastInZoneAt !== null && nowMs - lastInZoneAt > o.gapMs) {
        resetHold('sound died');                               // the string died out - not sustained
      }
      return state();
    }

    function on(name, fn) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
      return function () {
        var arr = listeners[name] || [], i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      };
    }

    return { start: start, feed: feed, retarget: retarget, stop: stop, state: state, on: on, set: set, params: params };
  }

  var TuneFlow = { create: create, DEFAULTS: DEFAULTS };
  global.TuneFlow = TuneFlow;
  if (typeof module !== 'undefined' && module.exports) module.exports = TuneFlow;

})(typeof window !== 'undefined' ? window : this);
