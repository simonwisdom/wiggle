// Windshield wipers: sitting back on the hands, feet wide and planted, knees drop to one side, then the other.
import { base, hand, foot, mirrorPose } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const hands = { rh: hand([-0.4, 0.035, 0.27], [-1, 0.2, 0.3], [-0.6, 0, 0.8]), lh: hand([-0.4, 0.035, -0.27], [-1, 0.2, -0.3], [-0.6, 0, -0.8]) };
const feet = { rf: foot([0.4, 0.06, 0.3], [0.2, 1, 0.1], [0.13, 0.02, 0.04]), lf: foot([0.4, 0.06, -0.3], [0.2, 1, -0.1], [0.13, 0.02, -0.04]) };
const sit = { ...base, p: [-0.12, 0.18, 0], pitch: -22, ...hands, ...feet };
P["wipers.mid"] = sit;
// both knees fall toward the near side (+z)
P["wipers.n"] = { ...sit, roll: 0, rf: { ...feet.rf, pole: [0, 0.05, 1] }, lf: { ...feet.lf, pole: [0.3, 0.05, 1] } };
P["wipers.f"] = mirrorPose(P["wipers.n"]);
