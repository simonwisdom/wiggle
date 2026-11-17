// Calf raises: a = up on the balls of the feet, b = heels down. Standing camera.
import { base, hand, foot } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["calfraise.a"] = { ...C.stand, p: [0.0, 0.99, 0], nflex: 0,
  rf: foot([-0.04, 0.155, 0.1], [1, 0, 0.1], [0.13, -0.13, 0]), lf: foot([-0.04, 0.155, -0.1], [1, 0, -0.1], [0.13, -0.13, 0]),
  rh: hand([0.02, 0.95, 0.25], [-1, 0, 0.3], [0.1, -1, 0]), lh: hand([0.02, 0.95, -0.25], [-1, 0, -0.3], [0.1, -1, 0]) };
P["calfraise.b"] = { ...C.stand };
