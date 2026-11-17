const test = require("node:test");
const assert = require("node:assert");
const { build, timeline, MOVES } = require("../public/plan.js");
const CLIPS = require("../public/clips.js");
const { POSES, LOOPS, poseOf, loopOf, playable, mirror, annotate, segmentFrame, swapSides, nextMoment } = require("../public/clipplay.js");

// Poses that stay hand-made on purpose: the hands-and-knees start between moves.
const HAND_MADE = ["table"];
const POSE_SRC = require("fs").readFileSync(require("path").join(__dirname, "../public/poses.js"), "utf8");
const isHand = (name) => !name.includes(".") && new RegExp(`\\b${name}: \\{`).test(POSE_SRC);
const have = playable(MOVES, CLIPS, isHand);

function posesUsed() {
  const used = new Set();
  for (const m of MOVES) {
    used.add(m.start);
    for (const s of m.segs(m.reps.max, { in: 3, out: 4.5 })) used.add(s[0]);
  }
  return used;
}

test("every pose a session uses has a clip with that moment, a loop, or is hand-made on purpose", () => {
  for (const pose of posesUsed()) {
    if (HAND_MADE.includes(pose)) continue;
    if (loopOf(pose)) { assert.ok(CLIPS[loopOf(pose)], `${pose}: loop clip ${loopOf(pose)} missing`); continue; }
    assert.ok(poseOf(pose), `${pose} has no clip`);
    const [clip, key] = poseOf(pose);
    assert.ok(CLIPS[clip], `${pose}: clip ${clip} missing`);
    assert.ok((CLIPS[clip].keys[key] || []).length, `${pose}: no moment for ${key} in ${clip}`);
  }
});

test("a qigong breath plays a short stretch of its clip, never most of the clip squeezed into one breath", () => {
  for (const minutes of [5, 10, 15]) {
    const s = build({ mode: "qigong", minutes, have });
    const segs = annotate(timeline(s).segs, CLIPS);
    for (const g of segs) if (g.motion.mode === "clip") {
      const speed = Math.abs(g.motion.tb - g.motion.ta) / g.d;
      assert.ok(speed <= 3.5, `${s.steps[g.step].id} -> ${g.to}: ${speed.toFixed(1)}x the demo's speed`);
    }
  }
});

test("every key moment lies inside its clip, and every frame has 22 points", () => {
  for (const [id, c] of Object.entries(CLIPS)) {
    const len = (c.frames.length - 1) / c.fps;
    for (const [key, times] of Object.entries(c.keys)) for (const t of times) assert.ok(t >= 0 && t <= len, `${id}.${key} at ${t}s, clip is ${len}s`);
    for (const f of c.frames) assert.strictEqual(f.length, 44, id);
  }
});

test("a built session plays clips forward between real key moments, and blends everything else", () => {
  for (const minutes of [5, 10, 15]) {
    const segs = annotate(timeline(build({ minutes, have })).segs, CLIPS);
    for (const g of segs) {
      const m = g.motion;
      assert.ok(m, "segment without a motion");
      if (m.mode === "clip") {
        const c = CLIPS[m.clip];
        const moments = Object.values(c.keys).flat();
        assert.ok(moments.includes(m.ta) && moments.includes(m.tb), `${g.from}->${g.to}: ${m.ta}->${m.tb} not key moments`);
      }
      if (m.mode === "blend") assert.ok(m.a && m.b, "blend needs both ends");
    }
    // The figure really moves: most of a session is clips, not hand-made poses.
    const clipTime = segs.filter((g) => g.motion.mode !== "hand").reduce((s, g) => s + g.d, 0);
    const total = segs.reduce((s, g) => s + g.d, 0);
    assert.ok(clipTime / total > 0.8, `${minutes} min: only ${(100 * clipTime / total).toFixed(0)}% real motion`);
  }
});

test("each segment starts where the one before it ended (no jumps)", () => {
  // Blends to and from hand-made poses are checked by the pose's name; the frame itself doesn't matter here.
  const hand = () => new Array(44).fill(0);
  for (const minutes of [5, 10, 15]) {
    const segs = annotate(timeline(build({ minutes, have })).segs, CLIPS);
    const at = (g, x) => {
      if (g.motion.mode === "hand") return null;
      if (g.motion.mode === "blend") { const ref = x ? g.motion.b : g.motion.a; if (ref.hand) return "hand:" + ref.hand; }
      return JSON.stringify(segmentFrame(CLIPS, g.motion, x, x * g.d, hand).F.map((v) => Math.round(v)));
    };
    for (let i = 1; i < segs.length; i++) {
      const a = at(segs[i - 1], 1), b = at(segs[i], 0);
      if (a && b) assert.strictEqual(b, a, `${minutes} min: jump between ${segs[i - 1].to} and ${segs[i].to} at ${segs[i].t0}s`);
    }
  }
});

test("without clips.js only the hand-made moves are used, drawn by hand", () => {
  const only = playable(MOVES, {}, isHand);
  assert.ok(only.length >= 8 && only.every((id) => !id.includes(".")));
  assert.ok(!only.includes("bridge"));
  const segs = annotate(timeline(build({ minutes: 10, have: only })).segs, {});
  assert.ok(segs.every((g) => g.motion.mode === "hand"));
});

test("the next key moment is the next one ahead, else the last one before", () => {
  assert.strictEqual(nextMoment([1, 4, 7], 4), 7);
  assert.strictEqual(nextMoment([1, 4, 7], 0), 1);
  assert.strictEqual(nextMoment([1, 4, 7], 9), 7);
});

test("swapping sides twice gives the same figure back", () => {
  const f = CLIPS.yt_thread.frames[10];
  assert.deepStrictEqual(swapSides(swapSides(f)), f);
  assert.notDeepStrictEqual(swapSides(f), f);
});

test("library poses name their clip and side", () => {
  assert.deepStrictEqual(poseOf("bridge.a"), ["yt_bridge", "a", false]);
  assert.deepStrictEqual(poseOf("pigeon.in.F"), ["yt_pigeon", "in", true]);
  assert.strictEqual(poseOf("armcircles.loop"), null);
  assert.strictEqual(loopOf("armcircles.loop"), "yt_armcircles");
  assert.deepStrictEqual(poseOf("cow"), POSES.cow);
});

test("the other side of a front view is its mirror image", () => {
  const f = CLIPS.yt_sky.frames[3];
  assert.deepStrictEqual(mirror(mirror(f)), f);
  assert.strictEqual(mirror(f)[0], 400 - f[0]);
  assert.strictEqual(mirror(f)[1], f[1]);
});
