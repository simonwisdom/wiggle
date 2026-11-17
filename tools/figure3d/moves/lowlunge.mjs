// Low lunge, arms up: right foot forward, back (left) knee down. in = tall with the arms reaching up, out = hips sink forward.
import { base, hand, foot, mixArms, footInPlane } from "../rig.mjs";
import { POSES as C, FLAT, KNEEL, armTo } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["lowlunge.start"] = C.table;
const feet = { rf: foot([0.5, 0.085, 0.12], [0.5, 1, 0.1], FLAT), lf: foot([-0.62, 0.05, -0.1], [1, 0, 0], KNEEL) };
const up = (Q, lean) => armTo(armTo({ ...Q, rh: hand([0, 0, 0.12], [-0.3, 0, 1], [0, 1, 0]), lh: hand([0, 0, -0.12], [-0.3, 0, -1], [0, 1, 0]) }, "r", [lean, 1, 0.1], 0.47), "l", [lean, 1, -0.1], 0.47);
P["lowlunge.in"] = up({ ...base, p: [-0.04, 0.44, 0], pitch: 0, flex: 0, nflex: -6, ...feet }, 0.05);
P["lowlunge.out"] = up({ ...base, p: [0.06, 0.365, 0], pitch: 0, flex: -14, nflex: -14, ...feet }, -0.1);
// Bringing the right foot forward from the all-fours table, its toes turn from "pointing back" to "pointing forward". A straight
// blend of the two passes straight down with the foot almost in line with the shin (a pointed ankle past what it allows);
// half way, the foot is put square-ish to the shin, in the knee's plane.
const step = (t) => {
  const Q = footInPlane(mixArms(P["lowlunge.start"], P["lowlunge.in"], t), "r", 0.8);
  const low = Q.rf.t[1] + Q.rf.toe[1]; // keep the toes just above the mat
  return low < 0.03 ? { ...Q, rf: { ...Q.rf, t: [Q.rf.t[0], Q.rf.t[1] + 0.03 - low, Q.rf.t[2]] } } : Q;
};
export const VIA = { "lowlunge.start>lowlunge.in": [step(0.5)] };
