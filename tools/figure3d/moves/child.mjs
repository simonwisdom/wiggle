// Child's pose: sit back on the heels, arms long on the floor, forehead down. start is the all-fours table.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { POSES as C, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["child.start"] = C.table;
const feet = { rf: foot([-0.5, 0.05, 0.1], [1, 0.1, 0.3], KNEEL), lf: foot([-0.5, 0.05, -0.1], [1, 0.1, -0.3], KNEEL) };
const arms = (x) => ({ rh: hand([x, 0.035, 0.2], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([x, 0.035, -0.2], [-0.4, 0.3, -0.4], [1, 0, 0]) });
P["child.in"] = straightArms({ ...base, p: [-0.36, 0.25, 0], pitch: 80, nflex: -5, ...feet, ...arms(0.6) });
P["child.out"] = straightArms({ ...base, p: [-0.4, 0.2, 0], pitch: 85, nflex: 12, ...feet, ...arms(0.6) });
