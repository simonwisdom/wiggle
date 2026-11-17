// Down dog pedal: from down dog, one knee bends (heel up, on the ball of the foot) while the other heel presses down. Switch.
import { base, hand, foot, mirrorPose } from "../rig.mjs";
import { FLAT, TUCK } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const hands = { rh: hand([0.62, 0.035, 0.2], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([0.62, 0.035, -0.2], [-0.4, 0.3, -0.4], [1, 0, 0]) };
// n: the near (right) heel presses down with the leg straight, the far (left) knee bends.
P["dogpedal.n"] = { ...base, p: [0.0, 0.66, -0.02], pitch: 117, nflex: -8, roll: -3, side: 3, ...hands,
  rf: foot([-0.52, 0.085, 0.1], [1, 0, 0.1], FLAT), lf: foot([-0.27, 0.13, -0.1], [1, 0.1, -0.5], TUCK) };
P["dogpedal.f"] = mirrorPose(P["dogpedal.n"]);
