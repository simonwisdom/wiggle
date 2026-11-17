// Plays real-motion clips (clips.js) in place of the hand-made poses. The session's timeline is
// unchanged: each segment still goes from one key pose to the next in one breath. When both poses
// come from the same clip, the figure plays the clip from the moment of the first to the moment of the
// second, stretched to the breath. Otherwise (another clip, or a pose with no clip) it blends between them.
// Pure functions, no DOM: the page uses window.CLIPPLAY, the tests use module.exports.
(function (root) {
  // Key pose name in plan.js -> [clip, key in that clip, side]. Side: false = first side, true = the
  // other side (drawn by swapping which limbs are near), undefined = either (keeps the side it's on).
  const POSES = {
    cow: ["yt_catcow", "cow"], cat: ["yt_catcow", "cat"],
    threadUnderN: ["yt_thread", "threadUnder", false], threadOpenN: ["yt_thread", "threadOpen", false],
    threadUnderF: ["yt_thread", "threadUnder", true], threadOpenF: ["yt_thread", "threadOpen", true],
    seatN: ["yt_9090", "seatN"], seatUp: ["yt_9090", "seatUp"], seatF: ["yt_9090", "seatF"],
    beast: ["yt_beastcrab", "beast"], sideSit: ["yt_beastcrab", "sideSit"],
    crabN: ["yt_beastcrab", "crab", false], crabF: ["yt_beastcrab", "crab", true],
    lungeDropN: ["yt_wgs", "lungeDrop", false], lungeReachN: ["yt_wgs", "lungeReach", false],
    lungeDropF: ["yt_wgs", "lungeDrop", true], lungeReachF: ["yt_wgs", "lungeReach", true],
    dog: ["yt_dogfold", "dog"], fold: ["yt_dogfold", "fold"], half: ["yt_dogfold", "half"], stand: ["yt_dogfold", "stand"],
    sky: ["yt_sky", "sky"], skyLow: ["yt_sky", "skyLow"],
    bowRest: ["yt_bow", "bowRest"], bowN: ["yt_bow", "bowN"], bowF: ["yt_bow", "bowF"],
  };
  // Poses that just play a clip on a loop, in real time (the shake).
  const LOOPS = { shakeA: "yt_shake", shakeB: "yt_shake" };

  // Library moves name their poses "move.key" (first side) or "move.key.F" (the other side), and
  // play from clip "yt_move"; "move.loop" plays that clip on a loop.
  function poseOf(name) {
    if (POSES[name]) return POSES[name];
    const m = /^(\w+)\.(\w+)(\.F)?$/.exec(name);
    return m && m[2] !== "loop" ? ["yt_" + m[1], m[2], !!m[3]] : null;
  }
  function loopOf(name) {
    if (LOOPS[name]) return LOOPS[name];
    const m = /^(\w+)\.loop$/.exec(name);
    return m ? "yt_" + m[1] : null;
  }

  const length = (clip) => (clip.frames.length - 1) / clip.fps;

  // The moment of `key` to go to from clip time `now`: the next one ahead, else the last one before.
  function nextMoment(times, now) {
    const ahead = times.filter((t) => t > now + 1e-6);
    if (ahead.length) return Math.min(...ahead);
    const before = times.filter((t) => t <= now + 1e-6);
    return before.length ? Math.max(...before) : times[0];
  }

  // Works out how each timeline segment is drawn. Adds seg.motion:
  //   { mode: "hand" }                                      both poses hand-made: the old drawing
  //   { mode: "clip", clip, ta, tb, swap, swapFrom }        play clip from ta to tb (fading sides if they change)
  //   { mode: "loop", clip, start, swap }                   play clip on a loop from time `start`
  //   { mode: "blend", a, b }                               blend; a and b are {clip, t, swap} or {hand: pose}
  function annotate(segs, clips) {
    const ok = (name) => { const p = poseOf(name); return !!(p && clips[p[0]] && (clips[p[0]].keys[p[1]] || []).length); };
    let end = null; // where the previous segment ended: {clip, t, swap} or {hand}
    let side = false;
    for (const g of segs) {
      const from = end || { hand: g.from };
      if (loopOf(g.to) && clips[loopOf(g.to)]) {
        const clip = loopOf(g.to);
        if (clips[clip].view === "front") side = false;
        if (from.clip === clip && from.loop) {
          // Already looping: carry on from where the last segment stopped.
          g.motion = { mode: "loop", clip, start: from.t, swap: side };
          end = { clip, t: (from.t + g.d) % length(clips[clip]), swap: side, loop: true };
        } else {
          // Coming from another pose: blend into the loop's first frame, then loop from there.
          g.motion = { mode: "blend", a: from, b: { clip, t: 0, swap: side } };
          end = { clip, t: 0, swap: side, loop: true };
        }
        continue;
      }
      if (!ok(g.to)) {
        g.motion = from.hand ? { mode: "hand" } : { mode: "blend", a: from, b: { hand: g.to } };
        end = { hand: g.to };
        continue;
      }
      const [clip, key, s] = poseOf(g.to);
      if (s !== undefined) side = s;
      else if (clips[clip].view === "front") side = false; // a front view has no near side to keep
      const times = clips[clip].keys[key];
      if (from.clip === clip && !from.loop) {
        const tb = nextMoment(times, from.t);
        g.motion = { mode: "clip", clip, ta: from.t, tb, swap: side, swapFrom: from.swap };
        end = { clip, t: tb, swap: side };
      } else {
        const tb = times[0];
        g.motion = { mode: "blend", a: from, b: { clip, t: tb, swap: side } };
        end = { clip, t: tb, swap: side };
      }
    }
    return segs;
  }

  // The figure (44 numbers: see clips.js) at clip time t, between frames for smooth motion.
  function frameAt(clip, t, swap) {
    const n = clip.frames.length;
    const f = Math.max(0, Math.min(n - 1, t * clip.fps));
    const i = Math.min(n - 2, Math.floor(f)), k = f - i;
    const A = clip.frames[i], B = clip.frames[i + 1];
    const out = A.map((v, j) => v + (B[j] - v) * k);
    return swap ? swapSides(clip.view === "front" ? mirror(out) : out) : out;
  }

  // Seen from the front, the other side is the mirror image (x flips about the box's middle).
  const mirror = (F) => F.map((v, j) => (j % 2 ? v : 400 - v));

  // Near and far limbs trade places: the same move done on the other side, seen from the same side.
  function swapSides(F) {
    const p = (a, b) => F.slice(a * 2, b * 2);
    return [...p(0, 6), ...p(10, 14), ...p(6, 10), ...p(18, 22), ...p(14, 18)];
  }

  const lerp = (A, B, x) => A.map((v, j) => v + (B[j] - v) * x);
  const ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;

  // The figure for segment motion m at progress x (0..1), `since` seconds into the segment.
  // handFrame(pose) gives a hand-made pose as 44 numbers. Returns { F, front } or null for "hand".
  function segmentFrame(clips, m, x, since, handFrame) {
    const front = (ref) => !!(ref && ref.clip && clips[ref.clip].view === "front");
    const at = (ref) => (ref.hand ? handFrame(ref.hand) : frameAt(clips[ref.clip], ref.t, ref.swap));
    if (m.mode === "hand") return null;
    if (m.mode === "clip") {
      const c = clips[m.clip], t = m.ta + (m.tb - m.ta) * x;
      const F = m.swapFrom === undefined || m.swapFrom === m.swap ? frameAt(c, t, m.swap) : lerp(frameAt(c, t, m.swapFrom), frameAt(c, t, m.swap), ease(x));
      return { F, front: front(m) };
    }
    if (m.mode === "loop") return { F: frameAt(clips[m.clip], (m.start + since) % length(clips[m.clip]), m.swap), front: front(m) };
    return { F: lerp(at(m.a), at(m.b), ease(x)), front: front(m.b) || (x < 0.5 && front(m.a)) };
  }

  // Ids of the moves that can be drawn: every pose they use is hand-made (isHand) or has its clip moment.
  function playable(moves, clips, isHand) {
    const can = (name) => {
      if (isHand(name)) return true;
      const loop = loopOf(name);
      if (loop) return !!clips[loop];
      const p = poseOf(name);
      return !!(p && clips[p[0]] && (clips[p[0]].keys[p[1]] || []).length);
    };
    return moves.filter((m) => [m.start, ...m.segs(m.reps.max, { in: 3, out: 4.5 }).map((s) => s[0])].every(can)).map((m) => m.id);
  }

  const api = { playable, POSES, LOOPS, poseOf, loopOf, mirror, annotate, frameAt, segmentFrame, swapSides, nextMoment, lerp, length };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CLIPPLAY = api;
})(typeof window !== "undefined" ? window : globalThis);
