// Puppy stretch: hips stay over the knees, the hands walk forward, the chest sinks toward the floor.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { POSES as C, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["puppy.start"] = C.table;
const feet = { rf: foot([-0.42, 0.05, 0.09], [1, -0.3, 0], KNEEL), lf: foot([-0.42, 0.05, -0.09], [1, -0.3, 0], KNEEL) };
const arms = (x) => ({ rh: hand([x, 0.035, 0.2], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([x, 0.035, -0.2], [-0.4, 0.3, -0.4], [1, 0, 0]) });
P["puppy.in"] = straightArms({ ...base, p: [0.0, 0.5, 0], pitch: 100, nflex: -10, ...feet, ...arms(0.64) });
P["puppy.out"] = { ...base, p: [0.0, 0.37, 0], pitch: 118, nflex: 15, ...feet, ...arms(0.8) };
