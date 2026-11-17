// Thread the needle: the near (right) arm slides under toward the far side, then opens to the sky.
import { hand } from "../rig.mjs";
import { POSES as C, armTo } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P.threadUnderN = { ...C.table, p: [-0.03, 0.5, 0], pitch: 104, twist: 50, flex: 12, nflex: 10, ntwist: 30,
  rh: hand([0.36, 0.035, -0.3], [0.3, 0.3, 0.6], [0, 0, -1]), lh: hand([0.48, 0.035, -0.2], [-0.2, 0.2, -1], [1, 0, 0]) };
P.threadOpenN = armTo({ ...C.table, pitch: 84, twist: -62, flex: -6, nflex: -15, ntwist: -55,
  rh: hand([0.3, 1.02, 0.2], [-0.4, 0, 1], [0, 1, 0.1]), lh: hand([0.48, 0.035, -0.18], [-0.4, 0.3, -0.4], [1, 0, 0]) }, "r", [-0.05, 1, 0.05]);
// On the way between them the hand slides out along the mat, then lifts: no folding of the elbow, no dip under the floor.
const threadSlide = { ...C.table, pitch: 92, twist: 0, nflex: -5, ntwist: -10,
  rh: hand([0.4, 0.035, 0.38], [-0.3, 0.5, 0.2], [0, -0.15, 1]), lh: hand([0.48, 0.035, -0.2], [-0.4, 0.3, -0.4], [1, 0, 0]) };
// The fingers turn from pointing under the body to pointing out to the side by way of pointing forward (a straight blend of
// those two opposite directions flips the hand over in one frame).
const threadTurn = { ...threadSlide, rh: hand([0.38, 0.035, 0.05], [-0.3, 0.5, 0.2], [1, -0.15, 0]) };
export const VIA = { "threadUnderN>threadOpenN": [threadTurn, threadSlide] };
