// One image per move with its key poses and the middle of each of its moving steps, for a quick look.
//   node tools/figure3d/preview.mjs [move ids...]     writes tools/figure3d/previews/<move>.png
// Draws in headless Chrome with the same scene as the video render, on the camera that move's position uses.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { JOINTS } from "./rig.mjs";
import { CAMS, FOV, MAT, SIZE, project, headCentre } from "./cameras.mjs";
import { stepFrames, posed } from "./motion.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PLAN = createRequire(import.meta.url)("../../public/plan.js");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CELL = +process.env.CELL || 300, COLS = +process.env.COLS || 5, LABEL = 22; // CELL=540 COLS=3 for a closer look

const flat = (F) => JOINTS.flatMap((j) => F[j].map((v) => Math.round(v * 1000)));

export function cellsFor(moveId, steps) {
  const mine = steps.filter((s) => s.moves.includes(moveId) && s.side !== "F" && posed(s));
  const cells = [], seen = new Set();
  const cam = CAMS[mine[0]?.camera];
  const add = (label, F, c) => cells.push({ label, d: flat(F), cam: c, probe: headCentre(F), expect: (({ x, y }) => [x, y])(project(c, headCentre(F))) });
  // key poses in the order the move uses them, then the middle of each moving step
  for (const s of mine) for (const name of [s.from, s.to]) {
    if (seen.has(name) || s.kind === "loop") continue;
    seen.add(name);
    add(name, stepFrames({ ...s, kind: "hold", form: "still", from: name, to: name, side: s.side }) [0], CAMS[s.camera]);
  }
  for (const s of mine) {
    if (s.kind === "move" || s.kind === "loop") { const fr = stepFrames(s); if (fr) add(`${s.kind === "loop" ? s.id : s.from + " > " + s.to} (mid)`, fr[Math.floor(fr.length / 2)], CAMS[s.camera]); }
  }
  void cam;
  return cells;
}

export function preview(moveIds) {
  const steps = JSON.parse(fs.readFileSync(path.join(HERE, "steps.json"), "utf8")).steps;
  const outDir = path.join(HERE, "previews");
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const id of moveIds) {
    const cells = cellsFor(id, steps);
    if (!cells.length) { console.log(`${id}: no poses yet`); continue; }
    const data = { joints: JOINTS, cell: CELL, cols: COLS, cfg: { fov: FOV, mat: MAT, size: CELL, head: true }, cells };
    // the camera check compares at cell size, so scale the expected pixels
    for (const c of data.cells) c.expect = c.expect.map((v) => (v * CELL) / SIZE);
    fs.writeFileSync(path.join(HERE, "render/assets/preview-data.js"), "window.PREVIEW = " + JSON.stringify(data) + ";\n");
    const rows = Math.ceil(cells.length / COLS), file = path.join(outDir, id + ".png");
    execFileSync(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-device-scale-factor=1",
      `--window-size=${COLS * CELL},${rows * (CELL + LABEL)}`, "--virtual-time-budget=15000", `--screenshot=${file}`, "file://" + path.join(HERE, "render/preview.html")], { stdio: "ignore" });
    written.push(file);
    console.log(file);
  }
  return written;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const asked = process.argv.slice(2);
  const ids = asked.length ? asked : ["catcow", "thread", "hips9090", "beastcrab", "wgs", "dogfold", "shake", "skybow", "still"];
  void PLAN;
  preview(ids);
}
