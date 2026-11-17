// Cuts the render into one clip per step and writes the manifest.
//   node tools/figure3d/clips.mjs [--render render/renders/all.mp4]
// Needs out/cuts.json and the render from export.mjs (see the README, "Rendering"). Writes
//   out/clips/<step>.mp4       540x540 H.264, about 16 KB a second, a key frame every 30 frames
//   out/clips3d.json           the manifest: one entry per step (and side) with its clip, length, frame count and kind
//   out/clips3d-heads.json     the head track per frame of every clip (6 numbers a frame), for the app's flat head. A side file
//                              because it is most of the manifest's bytes and the app only needs it when it starts a session.
// Steps that get no clip of their own (a "still": the same pose held) are in the manifest with `still`, pointing at a frame of a
// clip that shows that pose.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { FPS } from "./rig.mjs";
import { SIZE, CAMS, project } from "./cameras.mjs";
import { posed, stepPoses, isStill, stepFrames } from "./motion.mjs";
import { figurePoints } from "./checks.mjs";

// Where the figure is in a clip: [left, top, right, bottom] in the SIZE square's pixels, over every frame, joints padded by
// their radius. The app zooms its panel to this box so the figure fills the screen.
export function clipBox(step) {
  const frames = stepFrames(step), cam = CAMS[step.camera];
  if (!frames || !cam) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const F of frames) for (const [p, r] of figurePoints(F)) {
    const q = project(cam, p), pad = r * q.perM;
    x0 = Math.min(x0, q.x - pad); y0 = Math.min(y0, q.y - pad); x1 = Math.max(x1, q.x + pad); y1 = Math.max(y1, q.y + pad);
  }
  return [x0, y0, x1, y1].map((v) => Math.round(Math.max(0, Math.min(SIZE, v))));
}

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const fileOf = (id) => id.replace(/>/g, "_to_").replace(/[:~]/g, "-").replace(/@/g, ".") + ".mp4";
export const ENCODE = ["-c:v", "libx264", "-crf", "30", "-preset", "slow", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

export function buildManifest(steps, cuts, files) {
  const clips = {}, heads = {};
  const byId = new Map(cuts.map((c) => [c.id, c]));
  for (const s of steps) {
    if (!posed(s) || isStill(s)) continue;
    const c = byId.get(s.id);
    if (c) {
      clips[s.id] = { file: files(s.id), kind: s.kind, camera: s.camera, from: s.from, to: s.to, side: s.side, moves: s.moves,
        seconds: Math.round(c.seconds * 1000) / 1000, frames: c.frames, fps: FPS, box: clipBox(s) };
      heads[s.id] = c.heads;
    }
  }
  // stills: a held pose has no clip; it shows a frame of a clip that starts or ends on that pose
  for (const s of steps) {
    if (!posed(s) || clips[s.id] || !isStill(s)) continue;
    let at = null;
    // A step between two names for one symmetric shape (pose and its mirror) can show either name, on either side.
    const names = s.from === s.to ? [s.from] : [s.from, s.to], anySide = s.from !== s.to;
    for (const [id, c] of Object.entries(clips)) {
      if (c.kind !== "move" || c.camera !== s.camera || (!anySide && c.side !== s.side && c.side !== "both" && s.side !== "both")) continue;
      if (names.includes(c.from)) { at = { clip: id, frame: 0 }; break; }
      if (names.includes(c.to) && !at) at = { clip: id, frame: c.frames - 1 };
    }
    clips[s.id] = { kind: "hold", still: at, camera: s.camera, from: s.from, to: s.to, side: s.side, moves: s.moves };
  }
  return { clips, heads };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const render = path.resolve(arg("--render", path.join(HERE, "render/renders/all.mp4")));
  const out = path.join(HERE, "out"), dir = path.join(out, "clips");
  const { cuts } = JSON.parse(fs.readFileSync(path.join(out, "cuts.json"), "utf8"));
  fs.mkdirSync(dir, { recursive: true });
  const steps = JSON.parse(fs.readFileSync(path.join(HERE, "steps.json"), "utf8")).steps;
  const manifestOnly = process.argv.includes("--manifest-only"); // keep the cut clips, rebuild the manifest from steps.json
  for (const c of manifestOnly ? [] : cuts) {
    const to = path.join(dir, fileOf(c.id));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", render, "-vf", `select='between(n,${c.firstFrame},${c.firstFrame + c.frames - 1})',setpts=N/${FPS}/TB,scale=${SIZE}:${SIZE}:flags=lanczos`,
      "-frames:v", String(c.frames), "-r", String(FPS), "-an", ...ENCODE, to]);
  }
  const { clips, heads } = buildManifest(steps, cuts, fileOf);
  const bytes = Object.values(clips).reduce((a, c) => a + (c.file ? fs.statSync(path.join(dir, c.file)).size : 0), 0);
  fs.writeFileSync(path.join(out, "clips3d.json"), JSON.stringify({ size: SIZE, fps: FPS, headsFile: "clips3d-heads.json", headFields: ["headX", "headY", "neckX", "neckY", "headHeight", "tiltDeg"], totalBytes: bytes, clips }, null, 1) + "\n");
  fs.writeFileSync(path.join(out, "clips3d-heads.json"), JSON.stringify(heads));
  console.log(`${cuts.length} clips, ${(bytes / 1e6).toFixed(2)} MB`);
  // --publish: copy what the app ships into public/clips3d/ (committed). out/ stays the full-size render's workspace.
  if (process.argv.includes("--publish")) {
    const pub = path.join(HERE, "../../public/clips3d");
    fs.mkdirSync(pub, { recursive: true });
    for (const f of fs.readdirSync(pub)) fs.unlinkSync(path.join(pub, f));
    for (const c of Object.values(clips)) if (c.file) fs.copyFileSync(path.join(dir, c.file), path.join(pub, c.file));
    for (const f of ["clips3d.json", "clips3d-heads.json"]) fs.copyFileSync(path.join(out, f), path.join(pub, f));
    console.log(`published to public/clips3d: ${fs.readdirSync(pub).length} files`);
  }
}
void stepPoses;
