const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const PLAN = require("../public/plan.js");
const F3 = require("../public/figure3d.js");

const DIR = path.join(__dirname, "../public/clips3d");
const MAN = JSON.parse(fs.readFileSync(path.join(DIR, "clips3d.json"), "utf8"));
const HEADS = JSON.parse(fs.readFileSync(path.join(DIR, "clips3d-heads.json"), "utf8"));
const M = MAN.clips;
// The moves that have a 3D pose file: the rest must fall back to the flat figure, and that is allowed.
const POSED = new Set(fs.readdirSync(path.join(__dirname, "../tools/figure3d/moves")).filter((f) => /^[a-z0-9]+\.mjs$/.test(f)).map((f) => f.slice(0, -4)));

// Sessions of every kind: each mode, focus, length and a few days, with swaps.
function sessions() {
  const out = [];
  const focuses = ["all", ...Object.keys(PLAN.AREAS), ...Object.keys(PLAN.MUSCLES)];
  for (const mode of Object.keys(PLAN.MODES)) for (const focus of focuses) for (const minutes of [5, 10, 15]) for (const day of [1, 2, 3]) {
    let s = PLAN.build({ minutes, focus, mode, today: `2026-03-0${day}`, level: day === 3 ? -1 : 0 });
    out.push(s);
    const i = s.steps.findIndex((x) => !x.fixed), next = i >= 0 ? PLAN.swap(s, i) : null;
    if (next) out.push(next);
  }
  return out;
}

test("every segment a session can produce gets a clip, a still, a loop or a crossfade; unposed moves fall back to flat", () => {
  const kinds = new Set();
  let seen = 0;
  for (const s of sessions()) {
    const tl = PLAN.timeline(s);
    const items = F3.plan(tl.segs, s, M);
    assert.ok(items.length >= 1 && items.length <= tl.segs.length);
    items.forEach((it, i) => {
      kinds.add(it.kind);
      assert.ok(["clip", "still", "loop", "fade", "flat"].includes(it.kind), it.kind);
      if (it.kind === "clip") { assert.ok(M[it.id] && M[it.id].file, `${it.id} has no file`); assert.ok(it.b > it.a && it.rate >= F3.RATE_MIN && it.rate <= F3.RATE_MAX); }
      if (it.kind === "loop") assert.ok(M[it.id] && M[it.id].file && it.len > 0);
      if (it.kind === "still" && it.id) assert.ok(M[it.id].file && it.frame >= 0 && it.frame < M[it.id].frames, `${it.id} frame ${it.frame}`);
      if (it.kind === "fade") { assert.ok(items[i + 1] && items[i + 1].kind !== "flat" && items[i + 1].kind !== "fade"); }
      // time is covered without gaps
      if (i > 0) assert.ok(Math.abs(items[i - 1].t1 - it.t0) < 1e-6);
      const g = it.seg;
      const move = g.step >= 0 ? s.steps[g.step].id : null;
      // every segment of a posed move, inside the move, has 3D
      if (move && POSED.has(move) && !g.lead) { seen++; assert.ok(it.kind !== "flat", `${move}: ${g.from} -> ${g.to} falls back to flat`); }
      // A move with no poses of its own (the new Qigong pieces, the gear moves) is allowed: it is flat, or it shares a pose
      // another move has (sky, settle), which then plays that pose's clip.
    });
  }
  assert.ok(seen > 1000, "the sessions covered posed moves");
  for (const k of ["clip", "still", "loop", "fade", "flat"]) assert.ok(kinds.has(k), `no session produced a ${k} item`);
});

test("the clip for a segment: forwards, sides, sways and loops", () => {
  const seg = (from, to, d) => ({ from, to, d });
  const R = (from, to, poses, j, d = 3, move = "x") => F3.resolveStep(M, from, to, d, poses, j, move);
  const cc = R("cow", "cat", ["cow", "cat"], 0, 4.5);
  assert.deepStrictEqual([cc.kind, cc.id], ["clip", "cow>cat@both"]);
  assert.ok(Math.abs(cc.rate - M["cow>cat@both"].seconds / 4.5) < 1e-9);
  // beast and sideSit take the side of the named pose they go to, or come from
  const into = R("beast", "sideSit", ["beast", "sideSit", "crabF"], 0);
  assert.strictEqual(into.id, "beast>sideSit@F");
  const out = R("sideSit", "beast", ["crabN", "sideSit", "beast"], 1);
  assert.strictEqual(out.id, "sideSit>beast@N");
  // a hold's sway: the first half of the clip going in, the second half coming out
  const sway = Object.entries(M).find(([id, c]) => id.includes("~") && c.file);
  const [id, c] = sway;
  const a = R(c.from, c.to, [c.from, c.to], 0, 4), b = R(c.to, c.from, [c.to, c.from], 0, 4);
  assert.deepStrictEqual([a.id, a.a, a.b], [id, 0, c.seconds / 2]);
  assert.deepStrictEqual([b.id, b.a, b.b], [id, c.seconds / 2, c.seconds]);
  // a loop is one item for a run of segments, played in real time
  const lp = R("shakeA", "shakeB", ["shakeA", "shakeB"], 0, 0.25, "shake");
  assert.deepStrictEqual([lp.kind, lp.id], ["loop", "loop:shake"]);
  void seg;
});

test("the clip time for a session time: stretched to the segment, never past the end, loops wrap, a still sits on its frame", () => {
  const it = { kind: "clip", t0: 10, t1: 14, a: 0, b: 4, rate: 1 };
  assert.strictEqual(F3.clipTime(it, 10, 30), 0);
  assert.strictEqual(F3.clipTime(it, 12, 30), 2);
  assert.strictEqual(F3.clipTime(it, 20, 30), 4);
  const half = { kind: "clip", t0: 0, t1: 6, a: 2, b: 4, rate: 0.5 };
  assert.strictEqual(F3.clipTime(half, 2, 30), 3);
  assert.strictEqual(F3.clipTime(half, 6, 30), 4);
  const lp = { kind: "loop", t0: 5, len: 3.2 };
  assert.ok(Math.abs(F3.clipTime(lp, 5 + 3.2 + 1, 30) - 1) < 1e-9);
  assert.strictEqual(F3.clipTime({ kind: "still", t0: 0, frame: 29 }, 99, 30), 29.5 / 30);
  assert.strictEqual(F3.rateOf(4, 4), 1);
  assert.strictEqual(F3.rateOf(2, 30), F3.RATE_MIN);
  const items = [{ t0: 0 }, { t0: 3 }, { t0: 7 }];
  assert.deepStrictEqual([0, 2.99, 3, 6.9, 7, 99].map((t) => F3.itemIndexAt(items, t)), [0, 0, 1, 1, 2, 2]);
});

test("the head: between frames, the short way round, sized and turned from the track", () => {
  assert.deepStrictEqual(F3.headAt([[10, 20, 8, 30, 50, 0], [20, 40, 18, 50, 60, 10]], 0.5), [15, 30, 13, 40, 55, 5]);
  assert.strictEqual(F3.headAt([[0, 0, 0, 0, 50, 170], [0, 0, 0, 0, 50, -170]], 0.5)[5], 180);
  assert.deepStrictEqual(F3.headAt([[1, 2, 3, 4, 5, 6]], 7), [1, 2, 3, 4, 5, 6]);
  assert.strictEqual(F3.headAt([[0, 0, 0, 0, 50, 0], [10, 0, 0, 0, 50, 0]], 9)[0], 10); // clamps past the end
  assert.deepStrictEqual(F3.headPlace([300, 200, 290, 240, 56, -12]), { x: 300, y: 200, rot: -12, r: 28 * 0.88 });
  assert.strictEqual(F3.headAt([], 0), null);
});

test("the head track sits on the neck on every frame of every clip: near the neck, the size of a head, a sane turn", () => {
  let n = 0;
  for (const [id, c] of Object.entries(M)) {
    if (!c.file) continue;
    const rows = HEADS[id];
    assert.strictEqual(rows.length, c.frames, id);
    for (const r of rows) {
      const d = Math.hypot(r[0] - r[2], r[1] - r[3]);
      assert.ok(r[4] > 30 && r[4] < 110, `${id}: head height ${r[4]}`);
      assert.ok(d < r[4] * 1.2, `${id}: head ${d.toFixed(0)} px from the neck`);
      assert.ok(r[0] > 0 && r[0] < MAN.size && r[1] > 0 && r[1] < MAN.size, `${id}: head out of the picture`);
      n++;
    }
  }
  assert.ok(n > 10000);
});

test("every clip the manifest names is in public/clips3d, and nothing else is", () => {
  const files = new Set(fs.readdirSync(DIR).filter((f) => f.endsWith(".mp4")));
  const named = new Set(Object.values(M).filter((c) => c.file).map((c) => c.file));
  assert.deepStrictEqual([...files].sort(), [...named].sort());
  const bytes = [...files].reduce((a, f) => a + fs.statSync(path.join(DIR, f)).size, 0);
  assert.ok(bytes < 20e6, "the clips stay under the 20 MB budget");
});

// The zoom: the figure fills the panel.
{
  const { moveBoxes, boxFor, fitBox } = require("../public/figure3d.js");
  const clips = {
    a: { camera: "floor", moves: ["lunge"], box: [200, 100, 300, 400] },
    b: { camera: "floor", moves: ["lunge"], box: [150, 150, 280, 420] },
    c: { camera: "floor", moves: ["lunge", "dog"], box: [100, 200, 400, 420] },
    d: { camera: "floor", moves: ["dog"], box: [120, 220, 380, 400] },
    s: { camera: "floor", moves: ["lunge"], kind: "hold" },
  };
  const B = moveBoxes(clips);
  test("moveBoxes: the union of a move's clips, per camera", () => {
    assert.deepStrictEqual(B["lunge|floor"], [100, 100, 400, 420]);
    assert.deepStrictEqual(B["dog|floor"], [100, 200, 400, 420]);
  });
  test("boxFor: a clip uses its own box; a still its move's box", () => {
    assert.deepStrictEqual(boxFor(clips.a, B), [200, 100, 300, 400]);
    assert.deepStrictEqual(boxFor(clips.s, B), [100, 100, 400, 420]);
    assert.strictEqual(boxFor({ camera: "x", moves: ["none"] }, B), null);
  });
  test("fitBox: a tall box fills the panel's height, centred, and stays inside", () => {
    const f = fitBox([200, 100, 300, 400], 390, 300, 540);
    assert.ok(Math.abs(f.k - (300 * 0.9) / 300) < 1e-9);
    const top = f.y + f.k * 100, bottom = f.y + f.k * 400, mid = f.x + f.k * 250;
    assert.ok(Math.abs(top - 15) < 1e-6 && Math.abs(bottom - 285) < 1e-6 && Math.abs(mid - 195) < 1e-6);
  });
  test("fitBox: never zooms past the cap, and never shows past the picture's edge", () => {
    const f = fitBox([0, 0, 20, 20], 390, 300, 540);
    assert.strictEqual(f.k, 2.6);
    assert.ok(f.x <= 0 && f.y <= 0);
    const g = fitBox([400, 300, 540, 540], 390, 300, 540);
    assert.ok(g.x + g.k * 540 >= 390 - 1e-6 && g.y + g.k * 540 >= 300 - 1e-6);
  });
  test("fitBox: no box shows the whole picture", () => {
    const f = fitBox(null, 300, 300, 540);
    assert.ok(f.k * 540 <= 300);
  });
}
