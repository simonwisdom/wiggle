// Frames for a step of the step map (steps.json): joint positions at 30 fps, standing still on the
// named poses at both ends. Returns null when a pose isn't in poses3d.mjs yet.
import { FPS, blendFrames, solve, smooth } from "./rig.mjs";
import { poseFor, viaFor, LOOP_OF, LOOPS, PASS } from "./poses3d.mjs";
import { createRequire } from "node:module";
const CP = createRequire(import.meta.url)("../../public/clipplay.js");

const ownSide = (name) => { if (CP.loopOf(name)) return null; const p = CP.poseOf(name); return p && p[2] === true ? "F" : p && p[2] === false ? "N" : null; };
export const stepPoses = (step) => {
  if (step.kind === "loop") return null;
  const A = poseFor(step.from, step.side === "both" ? "N" : step.side, ownSide(step.from));
  const B = poseFor(step.to, step.side === "both" ? "N" : step.side, ownSide(step.to));
  return A && B ? [A, B] : null;
};
// A still: the same pose held, or a step between two names for one shape (a symmetric pose and its mirror,
// e.g. lying flat before a twist to either side). It gets no clip; the manifest points it at a frame.
export const isStill = (step) => {
  if (step.kind === "hold" && step.form === "still") return true;
  if (step.kind !== "move") return false;
  const AB = stepPoses(step);
  if (!AB) return false;
  const a = solve(AB[0]), b = solve(AB[1]);
  return Object.keys(a).every((j) => !Array.isArray(a[j]) || typeof a[j][0] !== "number" || a[j].every((v, i) => Math.abs(v - b[j][i]) < 0.002));
};
export const posed = (step) => (step.kind === "loop" ? !!LOOPS[LOOP_OF[step.from] || step.id.replace(/^loop:/, "")] : step.kind === "hold" && step.form === "still" ? !!stepPoses(step) : !!stepPoses(step));

export function stepFrames(step) {
  const seconds = step.clipSeconds || 0;
  if (step.kind === "loop") {
    const L = LOOPS[LOOP_OF[step.from] || step.id.replace(/^loop:/, "")];
    return L ? blendFrames([poseFor(L.pose, "N"), poseFor(L.pose, "N")], L.seconds, { tweak: L.tweak }) : null;
  }
  const AB = stepPoses(step);
  if (!AB) return null;
  if (isStill(step)) return [solve(AB[0])];
  if (step.kind === "hold") return blendFrames([AB[0], AB[1]], seconds, { ease: (u) => 0.5 - 0.5 * Math.cos(2 * Math.PI * u) }); // there and back
  return blendFrames(stepPath(step), seconds, { ease: easeFor(step) });
}

// A pose in a move file's PASS list is passed through, not stopped at: the step runs into it (or out of it) at speed,
// so the two clips either side of it join up as one motion.
export function easeFor(step) {
  const into = PASS.has(step.to), out = PASS.has(step.from);
  if (into && out) return (u) => u;
  if (into) return (u) => u * u * (2 - u);            // slow start, full speed at the end
  if (out) return (u) => 1 - (1 - u) * (1 - u) * (1 + u); // full speed at the start, slow end
  return smooth;
}

// Every pose a step passes through, start to end, waypoints included.
export const stepPath = (step) => { const AB = stepPoses(step); return AB && [AB[0], ...viaFor(step.from, step.to, step.side), AB[1]]; };
