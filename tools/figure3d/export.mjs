// Writes what the renderer needs for a list of steps from steps.json:
//   render/assets/motion-data.js  the joint positions of every clip, back to back (render/index.html reads it)
//   render/_main.html             index.html with the length filled in: render it with
//                                   bash ~/skywell/projects/skills/explainer-video/scripts/hf.sh render --composition=_main.html --output=renders/all.mp4 --fps=30
//   out/cuts.json                 where each clip starts and how many frames it has, plus its head track
//   node tools/figure3d/export.mjs [--steps id,id,...] [--no-head] [--out DIR]
// Default: every step that has poses and needs a clip. --no-head leaves the 3D head out (the neck stays); the
// head track (head and neck in the picture's pixels, per frame) is written either way, for the app's own head.
import fs from "node:fs";
import path from "node:path";
import { JOINTS, FPS } from "./rig.mjs";
import { CAMS, FOV, MAT, SIZE, headTrack } from "./cameras.mjs";
import { stepFrames, posed, isStill } from "./motion.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);

export function exportSteps(steps, { head = true } = {}) {
  const segs = [], cuts = [];
  let f0 = 0;
  for (const s of steps) {
    const frames = stepFrames(s);
    if (!frames || frames.length < 2) continue;
    const cam = CAMS[s.camera];
    segs.push({ name: s.id, cam, n: frames.length, d: frames.flatMap((F) => JOINTS.flatMap((j) => F[j].map((v) => Math.round(v * 1000)))) });
    cuts.push({ id: s.id, kind: s.kind, camera: s.camera, firstFrame: f0, frames: frames.length, seconds: (frames.length - 1) / FPS, heads: frames.map((F) => headTrack(cam, F)) });
    f0 += frames.length;
  }
  return { data: { joints: JOINTS, fps: FPS, cfg: { fov: FOV, mat: MAT, size: SIZE, head }, segs }, cuts };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const all = JSON.parse(fs.readFileSync(path.join(HERE, "steps.json"), "utf8")).steps;
  const want = arg("--steps") ? arg("--steps").split(",") : null;
  const steps = all.filter((s) => (want ? want.includes(s.id) : s.clipSeconds > 0 && posed(s) && !isStill(s)));
  const { data, cuts } = exportSteps(steps, { head: !process.argv.includes("--no-head") });
  const out = arg("--out") || path.join(HERE, "out");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(HERE, "render/assets/motion-data.js"), "window.MOTION = " + JSON.stringify(data) + ";\n");
  // HyperFrames reads the length from the page's own attribute, so write a copy of index.html with it filled in.
  const frames = cuts.reduce((a, c) => a + c.frames, 0), page = fs.readFileSync(path.join(HERE, "render/index.html"), "utf8");
  fs.writeFileSync(path.join(HERE, "render/_main.html"), page.replace('data-duration="1"', `data-duration="${frames / FPS}"`));
  fs.writeFileSync(path.join(out, "cuts.json"), JSON.stringify({ size: SIZE, fps: FPS, cuts }));
  console.log(`${cuts.length} clips, ${cuts.reduce((a, c) => a + c.frames, 0)} frames`);
}
