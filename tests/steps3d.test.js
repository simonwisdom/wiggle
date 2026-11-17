const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { MOVES } = require("../public/plan.js");
const CP = require("../public/clipplay.js");

const STEPS_JSON = path.join(__dirname, "../tools/figure3d/steps.json");
const load = () => import("../tools/figure3d/steps.mjs");

test("the step map covers every move in the library and every pose pair its segments use", async () => {
  const { buildSteps } = await load();
  const { steps } = buildSteps();
  const ids = new Set(steps.map((s) => s.id));
  const movesCovered = new Set(steps.flatMap((s) => s.moves));
  for (const m of MOVES) assert.ok(movesCovered.has(m.id), `${m.id} has no step`);
  for (const m of MOVES) {
    for (const n of [m.reps.min, m.reps.max]) {
      let from = m.start;
      for (const seg of m.segs(n, { in: 3, out: 4.5 })) {
        const to = seg[0];
        const hit = steps.some((s) => s.moves.includes(m.id) && (s.kind === "loop" ? CP.loopOf(from) || CP.loopOf(to)
          : (s.from === from && s.to === to) || (s.form === "sway" && s.from === to && s.to === from) || (s.form === "sway" && s.from === from && s.to === to)));
        assert.ok(hit, `${m.id}: ${from} -> ${to} is not in the map`);
        from = to;
      }
    }
  }
  assert.ok(ids.size === steps.length, "step ids are unique");
});

test("steps are well formed: a kind, a side, and a clip length that keeps the speed inside 0.6x to 1.6x", async () => {
  const { buildSteps } = await load();
  const { steps } = buildSteps();
  for (const s of steps) {
    assert.ok(["move", "hold", "loop"].includes(s.kind), s.id);
    assert.ok(["N", "F", "both"].includes(s.side), s.id);
    if (s.kind === "move") { assert.ok(s.clipSeconds >= 0.8 && s.speedOk, `${s.id}: ${s.speeds}`); assert.notStrictEqual(s.from, s.to); }
    if (s.kind === "hold" && s.form === "still") assert.strictEqual(s.from, s.to);
  }
});

test("steps.json is up to date with plan.js and clipplay.js (run: node tools/figure3d/steps.mjs)", async () => {
  const { buildSteps } = await load();
  const fresh = buildSteps();
  const saved = JSON.parse(fs.readFileSync(STEPS_JSON, "utf8"));
  assert.deepStrictEqual(saved.steps, JSON.parse(JSON.stringify(fresh.steps)));
  assert.deepStrictEqual(saved.links, JSON.parse(JSON.stringify(fresh.links)));
});
