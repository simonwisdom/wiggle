// Down dog, fold, roll up (stand is shared, in _common.mjs).
//   dog   an upside-down V: hips the highest point, arms and legs straight, feet flat so the heels reach down
//   fold  legs nearly straight, the torso hanging over them, head toward the shins, hands on the floor by the feet
//   half  halfway up: a flat back, hands on the shins
import { base, hand, foot, mixArms } from "../rig.mjs";
import { FLAT, standFeet } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P.dog = { ...base, p: [0, 0.69, 0], pitch: 117, nflex: -8,
  rh: hand([0.62, 0.035, 0.2], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([0.62, 0.035, -0.2], [-0.4, 0.3, -0.4], [1, 0, 0]),
  rf: foot([-0.5, 0.085, 0.1], [1, 0, 0.1], FLAT), lf: foot([-0.5, 0.085, -0.1], [1, 0, -0.1], FLAT) };
P.fold = { ...base, p: [-0.14, 0.94, 0], pitch: 158, flex: 18, nflex: 26, ...standFeet,
  rh: hand([0.2, 0.035, 0.22], [-0.3, 0.2, 1], [1, 0, 0]), lh: hand([0.2, 0.035, -0.22], [-0.3, 0.2, -1], [1, 0, 0]) };
P.half = { ...base, p: [-0.2, 0.9, 0], pitch: 92, nflex: -10, ...standFeet,
  rh: hand([0.1, 0.5, 0.19], [-0.3, 0.2, 1], [0.1, -1, 0]), lh: hand([0.1, 0.5, -0.19], [-0.3, 0.2, -1], [0.1, -1, 0]) };
// The hands turn from "fingers forward" on the floor to "fingers down the shins": half way, the fingers point forward and down
// (a straight blend of the two flips the hand over in one frame as the back comes up).
const halfway = mixArms(P.fold, P.half, 0.5);
export const VIA = { "fold>half": [{ ...halfway, rh: { ...halfway.rh, dir: [0.7, -0.7, 0] }, lh: { ...halfway.lh, dir: [0.7, -0.7, 0] } }] };
