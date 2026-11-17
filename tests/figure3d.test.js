const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const D = "../tools/figure3d/";
const STEPS = JSON.parse(fs.readFileSync(path.join(__dirname, D, "steps.json"), "utf8")).steps;
// Every move that has a file in tools/figure3d/moves/ is covered by every test below, without a list to keep.
const MOVES = fs.readdirSync(path.join(__dirname, D, "moves")).filter((f) => /^[a-z0-9]+\.mjs$/.test(f)).map((f) => f.slice(0, -4));
const mine = (s) => s.moves.some((m) => MOVES.includes(m));
const load = async () => ({
  rig: await import(D + "rig.mjs"), poses: await import(D + "poses3d.mjs"), motion: await import(D + "motion.mjs"),
  checks: await import(D + "checks.mjs"), cams: await import(D + "cameras.mjs"),
});

test("every move with a file has poses for every step, and its file name is a move id in plan.js", async () => {
  const PLAN = require("../public/plan.js");
  for (const m of MOVES) assert.ok(PLAN.MOVES.some((x) => x.id === m), `moves/${m}.mjs is not a move id in plan.js`);
  assert.ok(MOVES.length >= 9);
});

test("every step of every posed move has poses", async () => {
  const { motion } = await load();
  const missing = STEPS.filter(mine).filter((s) => !motion.posed(s)).map((s) => s.id);
  assert.deepStrictEqual(missing, []);
});

test("the other side is a mirror made by code: solving the mirrored pose gives the mirrored figure", async () => {
  const { rig, poses } = await load();
  for (const name of ["threadUnderN", "crabN", "lungeDropN", "bowN", "seatN", "sideSit", "beast"]) {
    const P = poses.POSES[name];
    const a = rig.solve(rig.mirrorPose(P)), b = rig.mirrorFrame(rig.solve(P));
    for (const j of rig.JOINTS) assert.ok(rig.len(rig.sub(a[j], b[j])) < 1e-9, `${name} ${j}`);
  }
  assert.ok(poses.resolve("crabF") && poses.resolve("threadUnderF") && poses.resolve("seatF") && poses.resolve("bowF"));
  assert.ok(!Object.keys(poses.POSES).some((k) => /F$/.test(k)), "no pose is typed twice: the F side is made by code");
});

test("on every frame of every posed step: planted hands and feet stay on the mat, nothing is under the floor, the figure stays in the picture, limbs keep apart, bones keep their length, no elbow or knee jumps", async () => {
  const { motion, checks, cams } = await load();
  const bad = [];
  for (const s of STEPS.filter(mine)) {
    if ((s.clipSeconds === 0 && s.kind === "hold") || motion.isStill(s)) { // a still: one frame
      const fr = motion.stepFrames(s);
      bad.push(...checks.checkFrames(s.id, fr, { plants: checks.planted(...(motion.stepPath(s) || [])), cam: cams.CAMS[s.camera] }));
      continue;
    }
    const fr = motion.stepFrames(s);
    assert.ok(fr && fr.length > 1, s.id);
    bad.push(...checks.checkFrames(s.id, fr, { plants: checks.planted(...(motion.stepPath(s) || [])), cam: cams.CAMS[s.camera] }));
  }
  assert.deepStrictEqual(bad, []);
});

test("a clip starts and ends exactly on its named poses", async () => {
  const { rig, poses, motion } = await load();
  for (const s of STEPS.filter(mine).filter((x) => x.kind === "move")) {
    const [A, B] = motion.stepPoses(s), fr = motion.stepFrames(s);
    for (const [F, P] of [[fr[0], A], [fr.at(-1), B]]) {
      const G = rig.solve(rig.settle(P, rig.plantedBoth(...motion.stepPath(s))));
      for (const j of rig.JOINTS) assert.ok(rig.len(rig.sub(F[j], G[j])) < 0.012, `${s.id} ${j} is ${(rig.len(rig.sub(F[j], G[j])) * 100).toFixed(1)} cm off its pose`);
    }
  }
  void poses;
});

test("the same pose is the same figure at the end of one clip and the start of the next", async () => {
  const { rig, motion } = await load();
  const ends = new Map(); // "pose@side" -> frame
  const moves = STEPS.filter(mine).filter((x) => x.kind === "move");
  for (const s of moves) {
    const fr = motion.stepFrames(s);
    for (const [name, F] of [[s.from, fr[0]], [s.to, fr.at(-1)]]) {
      const key = name + "@" + s.side;
      if (ends.has(key)) for (const j of rig.JOINTS) assert.ok(rig.len(rig.sub(F[j], ends.get(key)[j])) < 0.015, `${key} ${j} differs between clips (${s.id})`);
      else ends.set(key, F);
    }
  }
});

test("the shake loop ends where it starts", async () => {
  const { rig, motion } = await load();
  const fr = motion.stepFrames(STEPS.find((s) => s.kind === "loop" && s.moves.includes("shake")));
  for (const j of rig.JOINTS) assert.ok(rig.len(rig.sub(fr[0][j], fr.at(-1)[j])) < 0.01, j);
});

test("thread the needle: the arm sweeps up and opens without the elbow folding on the way", async () => {
  const { rig, motion } = await load();
  const fr = motion.stepFrames(STEPS.find((s) => s.id === "threadUnderN>threadOpenN@N"));
  const bend = (F) => { const u = rig.norm(rig.sub(F.rSh, F.rEl)), v = rig.norm(rig.sub(F.rWr, F.rEl)); return (Math.acos(rig.dot(u, v)) * 180) / Math.PI; };
  const up = fr.filter((F) => F.rWr[1] > 0.15); // once the hand has left the mat
  assert.ok(up.length > 20);
  let best = 0;
  for (const F of up) { best = Math.max(best, bend(F)); assert.ok(bend(F) > best - 8, `the elbow folds (${bend(F).toFixed(0)} deg after ${best.toFixed(0)})`); }
  assert.ok(bend(fr.at(-1)) > 155, "the arm ends straight");
});

test("world's greatest stretch: the elbow-down moment is not hidden behind the front leg", async () => {
  const { rig, cams, motion } = await load();
  const s = STEPS.find((x) => x.id === "lungeDropN>lungeReachN@N");
  const F = motion.stepFrames(s)[0], cam = cams.CAMS[s.camera];
  const e = cams.project(cam, F.rEl);
  const segPx = (a, b) => { const p = cams.project(cam, a), q = cams.project(cam, b), d = [q.x - p.x, q.y - p.y], t = Math.max(0, Math.min(1, ((e.x - p.x) * d[0] + (e.y - p.y) * d[1]) / (d[0] ** 2 + d[1] ** 2))); return Math.hypot(e.x - p.x - d[0] * t, e.y - p.y - d[1] * t); };
  const gap = Math.min(segPx(F.rHip, F.rKnee) - 0.065 * e.perM, segPx(F.rKnee, F.rAnkle) - 0.042 * e.perM);
  assert.ok(gap > 0, `the elbow is ${gap.toFixed(0)} px inside the front leg's outline`);
});

test("cameras: one fixed camera per position, every step uses one of them, the picture is square", async () => {
  const { cams } = await load();
  assert.deepStrictEqual(Object.keys(cams.CAMS).sort(), ["floor", "lying", "seated", "standing"]);
  for (const s of STEPS) assert.ok(cams.CAMS[s.camera], s.id);
  assert.strictEqual(cams.SIZE, 540);
  // the picture centre is what the camera looks at
  for (const c of Object.values(cams.CAMS)) { const q = cams.project(c, c.target); assert.ok(Math.abs(q.x - 270) < 1e-6 && Math.abs(q.y - 270) < 1e-6); }
});

test("head track: head and neck in the picture's pixels, per frame, for the app's own head", async () => {
  const { cams, motion } = await load();
  const { exportSteps } = await import(D + "export.mjs");
  const s = STEPS.find((x) => x.id === "cow>cat@both");
  const { cuts, data } = exportSteps([s], { head: false });
  assert.strictEqual(data.cfg.head, false, "the render can leave the 3D head out");
  assert.strictEqual(cuts[0].heads.length, cuts[0].frames);
  const F = motion.stepFrames(s)[10], h = cuts[0].heads[10], q = cams.project(cams.CAMS[s.camera], cams.headCentre(F));
  assert.ok(Math.abs(h[0] - q.x) < 0.11 && Math.abs(h[1] - q.y) < 0.11);
  assert.ok(h[4] > 20 && h[4] < 200, "head height in pixels");
  for (const v of h) assert.ok(Number.isFinite(v));
  // cat bends the head down, cow lifts it: the tilt changes
  const t = cuts[0].heads.map((x) => x[5]);
  assert.ok(Math.max(...t) - Math.min(...t) > 5);
});

// ---- the rendered clips and their manifest (tools/figure3d/out) ----
const OUT = path.join(__dirname, D, "out");
const manifest = () => JSON.parse(fs.readFileSync(path.join(OUT, "clips3d.json"), "utf8"));
const heads = () => JSON.parse(fs.readFileSync(path.join(OUT, "clips3d-heads.json"), "utf8"));
const { execFileSync, spawnSync } = require("node:child_process");
const haveFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0;
// The clips are rendered on the Mac (tools/figure3d/README.md, "Rendering") and not committed; without them, say so and skip.
const RENDERED = fs.existsSync(path.join(OUT, "clips3d.json"));
const NO_CLIPS = !RENDERED && "clips not rendered in this checkout (tools/figure3d/README.md, Rendering)";
// One frame of a clip as 64x64 grey pixels (for comparing the end of one clip with the start of the next).
const grey = (file, n) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `select=eq(n\\,${n}),scale=64:64,format=gray`, "-frames:v", "1", "-f", "rawvideo", "-"], { maxBuffer: 1e7 });

test("manifest: every step of every posed move has a clip, or is a still of a pose a clip shows", { skip: NO_CLIPS }, async () => {
  const { motion } = await load();
  const M = manifest(), missing = [];
  for (const s of STEPS.filter(mine).filter((x) => motion.posed(x))) {
    const c = M.clips[s.id];
    if (!c) { missing.push(s.id); continue; }
    if (c.file) continue;
    assert.ok(motion.isStill(s), `${s.id} has no clip and is not a still`);
    assert.ok(c.still && M.clips[c.still.clip]?.file, `${s.id} is a still with no clip showing its pose`);
  }
  assert.deepStrictEqual(missing, [], "steps with no clip: render again (README, Rendering)");
});

test("manifest: the clip files exist, with the frame counts and lengths the poses give, and one head track entry per frame", { skip: NO_CLIPS }, async () => {
  const { motion } = await load();
  const M = manifest(), H = heads();
  for (const [id, c] of Object.entries(M.clips)) {
    if (!c.file) continue;
    const s = STEPS.find((x) => x.id === id), file = path.join(OUT, "clips", c.file);
    assert.ok(s && fs.existsSync(file), `${id}: ${c.file} is missing`);
    const n = motion.stepFrames(s).length;
    assert.strictEqual(c.frames, n, `${id}: the manifest says ${c.frames} frames, the poses give ${n}`);
    assert.ok(Math.abs(c.seconds - (n - 1) / M.fps) < 1e-3, id);
    assert.strictEqual(H[id].length, n, `${id}: head track length`);
    if (haveFfmpeg) {
      const got = execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames,width,height", "-of", "csv=p=0", file]).toString().trim();
      assert.strictEqual(got, `${M.size},${M.size},${n}`, `${id}: the file has ${got} (width, height, frames)`);
    }
  }
});

test("manifest: the head track of each clip starts and ends on the head of its poses", { skip: NO_CLIPS }, async () => {
  const { motion, cams } = await load();
  const M = manifest(), H = heads();
  for (const [id, c] of Object.entries(M.clips)) {
    if (!c.file) continue;
    const fr = motion.stepFrames(STEPS.find((x) => x.id === id)), cam = cams.CAMS[c.camera];
    for (const [k, F] of [[0, fr[0]], [fr.length - 1, fr.at(-1)]]) assert.deepStrictEqual(H[id][k], cams.headTrack(cam, F), `${id} frame ${k}`);
  }
});

test("rendered clips: where one clip ends on a pose the next starts on it, the pictures match (no jump at the seam)", { skip: NO_CLIPS || (!haveFfmpeg && "ffmpeg is not installed") }, () => {
  const M = manifest(), ends = new Map(), problems = [];
  for (const [id, c] of Object.entries(M.clips)) {
    if (c.kind !== "move" || !c.file) continue;
    const file = path.join(OUT, "clips", c.file);
    for (const [pose, n] of [[c.from, 0], [c.to, c.frames - 1]]) {
      const key = pose + "@" + c.side, px = grey(file, n);
      if (ends.has(key)) {
        let d = 0; for (let i = 0; i < px.length; i++) d += Math.abs(px[i] - ends.get(key).px[i]);
        d /= px.length;
        if (d > 3) problems.push(`${key}: ${id} frame ${n} differs from ${ends.get(key).id} by ${d.toFixed(1)} of 255`);
      } else ends.set(key, { id, px });
    }
  }
  assert.deepStrictEqual(problems, []);
});

test("rendered clips: the first and last pictures are the poses (a clip is not blank and its ends differ from its middle only by motion)", { skip: NO_CLIPS || (!haveFfmpeg && "ffmpeg is not installed") }, () => {
  const M = manifest();
  for (const [id, c] of Object.entries(M.clips)) {
    if (c.kind !== "move" || !c.file) continue;
    const file = path.join(OUT, "clips", c.file), a = grey(file, 0), b = grey(file, c.frames - 1);
    let sa = 0, sb = 0, d = 0; for (let i = 0; i < a.length; i++) { sa += Math.abs(a[i] - a[0]); sb += Math.abs(b[i] - b[0]); d += Math.abs(a[i] - b[i]); }
    assert.ok(sa > 500 && sb > 500, `${id}: a blank first or last frame`);
    assert.ok(d / a.length > 0.2, `${id}: the first and last frames are the same picture`);
  }
});
