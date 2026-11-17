// Suggests the camera numbers for cameras.mjs: for each camera, the tightest fixed view that keeps every
// posed frame of every step that uses it inside the picture with the margin. Prints; does not write.
//   node tools/figure3d/fit-cameras.mjs            the tightest view for each camera
//   node tools/figure3d/fit-cameras.mjs --scale 250   every camera at the same size (pixels per metre at its target), only centred;
//                                                  it says if a camera can't hold its poses at that size
import fs from "node:fs";
import path from "node:path";
import { add, sub, mul, dot, cross, norm } from "./rig.mjs";
import { CAMS, MARGIN, SIZE, project, position } from "./cameras.mjs";
import { stepFrames, posed } from "./motion.mjs";
import { figurePoints } from "./checks.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const steps = JSON.parse(fs.readFileSync(path.join(HERE, "steps.json"), "utf8")).steps;
const SCALE = process.argv.includes("--scale") ? +process.argv[process.argv.indexOf("--scale") + 1] : 0;
const WANT = Object.fromEntries(Object.entries(CAMS).map(([k, c]) => [k, { az: c.az, el: c.el }]));
for (const [name, base] of Object.entries(WANT)) {
  const pts = [];
  for (const s of steps.filter((x) => x.camera === name && x.clipSeconds > 0 && posed(x))) for (const F of stepFrames(s)) pts.push(...figurePoints(F));
  if (!pts.length) { console.log(name.padEnd(9), "no poses yet"); continue; }
  let cam = { ...CAMS[name], ...base };
  // the middle of the bounding box, then nudge the target until the picture is centred and the size just fits
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const [p] of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  cam.target = lo.map((v, k) => (v + hi[k]) / 2);
  if (SCALE) cam.dist = SIZE / 2 / (SCALE * Math.tan((30 * Math.PI) / 360));
  for (let it = 0; it < 40; it++) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [p, r] of pts) { const q = project(cam, p), pad = r * q.perM; x0 = Math.min(x0, q.x - pad); x1 = Math.max(x1, q.x + pad); y0 = Math.min(y0, q.y - pad); y1 = Math.max(y1, q.y + pad); }
    const cx = (x0 + x1) / 2 - SIZE / 2, cy = (y0 + y1) / 2 - SIZE / 2;
    const span = Math.max(x1 - x0, y1 - y0), want = SIZE * (1 - 2 * MARGIN - 0.02);
    const c = position(cam), f = norm(sub(cam.target, c)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    const k = (SIZE / 2) / (cam.dist * Math.tan((30 * Math.PI) / 360));
    cam.target = add(add(cam.target, mul(r, cx / k)), mul(u, -cy / k));
    if (!SCALE) cam.dist *= span / want;
    else if (it === 39) console.log("  ", name, span <= want ? "fits" : `does NOT fit: the poses span ${Math.round(span)} px, room for ${Math.round(want)}`);
  }
  const round = (v) => Math.round(v * 100) / 100;
  console.log(name.padEnd(9), `{ az: ${cam.az}, el: ${cam.el}, dist: ${round(cam.dist)}, target: [${cam.target.map(round).join(", ")}] }`, `(${pts.length / 25 | 0} frames, ${Math.round(project(cam, cam.target).perM)} px/m)`);
}
