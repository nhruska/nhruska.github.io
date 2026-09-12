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
    holdMs: 600,        // sustained in-zone time before a string counts as landed
    celebrateMs: 700,   // how long 'landed' shows before auto-advance
    inTuneCents: 2,     // |cents| <= this is "in the zone" for arrival
    sharpCents: 3,      // >= this reads 'sharp' (overshoot - back off, come up)
    flatCents: -4,      // <= this reads 'flat' (keep coming up - the good direction)
    gapMs: 150          // an unvoiced gap longer than this breaks an arrival
  };
  var MEDIAN_FRAMES = 5;   // shorter than tuner.js's 8: guided mode tracks a moving peg
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
  function emaK(acents) {
    if (acents > 15) return 0.35;
    if (acents > 5) return 0.16;
    return 0.07;
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

    // smoothing state
    var window = [], glitchRun = [], ema = null, raw = null;
    // timing state (all in the caller's nowMs)
    var arrivedAt = null, lastVoicedAt = null, landedAt = null, lastNow = null;

    function emit(name, payload) {
      var fns = (listeners[name] || []).slice();
      for (var i = 0; i < fns.length; i++) fns[i](payload, state());
    }

    function resetSmoothing() { window = []; glitchRun = []; ema = null; raw = null; }
    function clearTimers() { arrivedAt = null; lastVoicedAt = null; landedAt = null; }

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
          else return ema;
        } else {
          glitchRun = [];
          window.push(cents); if (window.length > MEDIAN_FRAMES) window.shift();
        }
      } else {
        window = [cents];
      }
      var med = median(window);
      if (ema === null) ema = med;                    // first voiced frame snaps
      else ema += (med - ema) * emaK(Math.abs(med));
      return ema;
    }

    function holdProgress() {
      if (phase === 'landed') return 1;
      if (phase !== 'arriving' || arrivedAt === null || lastNow === null) return 0;
      return Math.max(0, Math.min(1, (lastNow - arrivedAt) / o.holdMs));
    }

    function state() {
      return {
        phase: phase,
        index: index,
        target: target,
        cents: ema,
        rawCents: raw,
        hint: hintFor(ema, o),
        progress: progress.slice(),
        holdProgress: holdProgress(),
        landedAt: phase === 'landed' ? landedAt : null
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
        var inZone = Math.abs(sm) <= o.inTuneCents;
        if (phase === 'approach') {
          if (inZone) { phase = 'arriving'; arrivedAt = nowMs; }
        } else if (phase === 'arriving') {
          if (!inZone) {
            phase = 'approach'; arrivedAt = null;      // drifted out - re-approach
          } else if (nowMs - arrivedAt >= o.holdMs) {
            phase = 'landed'; landedAt = nowMs; progress[index] = true;
            emit('landed', { index: index, target: target, nowMs: nowMs });
          }
        }
      } else if (phase === 'arriving' && lastVoicedAt !== null && nowMs - lastVoicedAt > o.gapMs) {
        phase = 'approach'; arrivedAt = null;          // the string died out - not sustained
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

    return { start: start, feed: feed, retarget: retarget, stop: stop, state: state, on: on };
  }

  var TuneFlow = { create: create };
  global.TuneFlow = TuneFlow;
  if (typeof module !== 'undefined' && module.exports) module.exports = TuneFlow;

})(typeof window !== 'undefined' ? window : this);
