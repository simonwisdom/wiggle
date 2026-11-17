// Review videos: one looping MP4 per move, played in true order, the way a session plays it.
//   node tools/figure3d/review.mjs [move ids] [--out DIR]
// For each move (not `still`): from its start pose through one full cycle of its segments (plan.js, one rep: one rep on the
// first side, then the other side if it has sides), joining the manifest's clips (out/clips3d.json) in that order.
//   - a move step plays its clip once, at its render speed
//   - a sway (the in and out of a hold) plays its looping clip for one pass
//   - a loop (shake, arm circles) plays its clip for one pass, however many times the plan repeats it in a row
//   - a still (the same pose again) holds the last frame for 1 s
// Everything is joined with one re-encode (same settings as the clips), so the joins have no stutter. Where a move ends on the pose
// it starts on (the 90/90 switches, the thread the needle's table), the video loops cleanly.
// Writes <out>/<move>.mp4 and <out>/<move>.txt (the steps played, in order). Default out: ~/skywell/projects/morning-movement/3d/review.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { sideOf } from "./steps.mjs";
import { ENCODE } from "./clips.mjs";
import { FPS } from "./rig.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PLAN = require("../../public/plan.js");
const CP = require("../../public/clipplay.js");
const EITHER = new Set(["beast", "sideSit"]);
const HOLD_SECONDS = 1;

const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const OUT = path.resolve(oi >= 0 ? args[oi + 1] : path.join(os.homedir(), "skywell/projects/morning-movement/3d/review"));
const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");

const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "out/clips3d.json"), "utf8")).clips;
const clipPath = (c) => path.join(HERE, "out/clips", c.file);
const ff = (a) => execFileSync("ffmpeg", ["-y", "-v", "error", ...a]);

// The steps one rep of a move plays, as [id, kind] in order: kind "clip" (a move, sway or loop clip) or "hold" (a still).
export function stepsOf(m) {
  const b = PLAN.MODES[Object.keys(PLAN.MODES)[0]].breath;
  const poses = [m.start, ...m.segs(1, b).map((s) => s[0])];
  // The side a pose that names none (beast, sideSit) is on: going into the turn, that of the next named pose (crabN, crabF);
  // coming back out of it, that of the last one.
  const sideAt = (i, back) => {
    const order = back ? [[i, -1], [i, 1]] : [[i, 1], [i, -1]];
    for (const [from, dir] of order) for (let j = from; j >= 0 && j < poses.length; j += dir) if (sideOf(poses[j])) return sideOf(poses[j]);
    return "N";
  };
  const out = [];
  for (let i = 0; i + 1 < poses.length; i++) {
    const from = poses[i], to = poses[i + 1];
    if (CP.loopOf(from) || CP.loopOf(to)) {
      const id = `loop:${m.id}`;
      if (out.at(-1)?.[0] !== id) out.push([id, "clip"]); // a loop repeated in a row is one pass
      continue;
    }
    if (from === to) { out.push([`${from}=${to}`, "hold"]); continue; }
    const sf = sideOf(from), st = sideOf(to);
    const side = sf || st ? st || sf : EITHER.has(from) || EITHER.has(to) ? sideAt(i, to === "beast") : "both";
    const sway = m.type === "hold" && /\.(in|out)(\.F)?$/.test(from) && /\.(in|out)(\.F)?$/.test(to);
    out.push([sway ? `${[from, to].sort().join("~")}@${side}` : `${from}>${to}@${side}`, "clip"]);
  }
  return out;
}

function encodeStill(png, seconds, to) {
  ff(["-loop", "1", "-framerate", String(FPS), "-i", png, "-t", String(seconds), "-vf", "format=yuv420p", "-r", String(FPS), "-an", ...ENCODE, to]);
}

export function buildReview(m, outDir, tmp) {
  const steps = stepsOf(m), parts = [], lines = [];
  let last = null; // the file whose last frame is the pose the figure is in now
  for (const [id, kind] of steps) {
    if (kind === "hold" || (manifest[id] && !manifest[id].file)) { // a still: the same pose (or a pose and its mirror) held
      let src = last, seek = ["-sseof", "-0.2"];
      if (!src) { // a hold before any clip: the pose is the first frame of the first clip
        const first = steps.find(([sid, k]) => k === "clip" && manifest[sid]?.file);
        if (!first) throw new Error(`${m.id}: a hold and no clip`);
        src = clipPath(manifest[first[0]]); seek = [];
      }
      const png = path.join(tmp, `${m.id}-${parts.length}.png`), mp4 = path.join(tmp, `${m.id}-${parts.length}.mp4`);
      ff([...seek, "-i", src, "-update", "1", "-frames:v", "1", png]);
      encodeStill(png, HOLD_SECONDS, mp4);
      parts.push(mp4); lines.push(`hold ${HOLD_SECONDS}s  ${id}`);
      continue;
    }
    const c = manifest[id];
    if (!c || !c.file) throw new Error(`${m.id}: no clip for step ${id}`);
    parts.push(clipPath(c)); last = clipPath(c);
    lines.push(`${c.kind === "hold" ? "sway" : c.kind} ${c.seconds}s  ${id}`);
  }
  const list = path.join(tmp, `${m.id}.list`);
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const to = path.join(outDir, `${m.id}.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", "setpts=N/" + FPS + "/TB", "-r", String(FPS), "-an", ...ENCODE, to]);
  fs.writeFileSync(path.join(outDir, `${m.id}.txt`), lines.join("\n") + "\n");
  return { id: m.id, file: to, bytes: fs.statSync(to).size, steps: lines.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wiggle-review-"));
  let total = 0, n = 0;
  for (const m of PLAN.MOVES) {
    if (m.id === "still" || (only.length && !only.includes(m.id))) continue;
    const r = buildReview(m, OUT, tmp);
    total += r.bytes; n++;
    console.log(`${r.id.padEnd(12)} ${String(r.steps).padStart(2)} steps  ${(r.bytes / 1024).toFixed(0)} KB`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${n} videos, ${(total / 1048576).toFixed(2)} MB in ${OUT}`);
}
