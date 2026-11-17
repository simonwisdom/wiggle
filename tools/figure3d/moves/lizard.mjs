// Lizard lunge: a long lunge, right foot forward and out, back leg long with the knee lifted, both hands on the floor inside the front foot.
// in = long back, out = the hips sink and the elbows soften toward the floor. start is the all-fours table.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["lizard.start"] = C.table;
const feet = { rf: foot([0.44, 0.085, 0.34], [0.2, 1, 0.5], [0.14, -0.06, 0.04]), lf: foot([-0.8, 0.12, -0.1], [0.2, -1, 0], [0.035, -0.083, 0]) };
const hands = { rh: hand([0.46, 0.035, 0.1], [-0.3, 0.2, -0.3], [1, 0, 0]), lh: hand([0.46, 0.035, -0.16], [-0.3, 0.3, -1], [1, 0, 0]) };
P["lizard.in"] = straightArms({ ...base, p: [-0.02, 0.4, 0], pitch: 60, nflex: -14, ...feet, ...hands });
P["lizard.out"] = { ...base, p: [0.0, 0.32, 0], pitch: 78, flex: 6, nflex: -8, ...feet, ...hands };
