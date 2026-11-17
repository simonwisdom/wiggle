// Seated forward fold: long legs on the floor, toes up, fold forward from the hips with the hands out along the legs.
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const legs = { rf: foot([0.78, 0.065, 0.1], [0, 1, 0], [0.03, 0.12, 0]), lf: foot([0.78, 0.065, -0.1], [0, 1, 0], [0.03, 0.12, 0]) };
const reach = (x) => ({ rh: hand([x, 0.04, 0.24], [-0.3, 0.5, 1], [1, 0, 0]), lh: hand([x, 0.04, -0.24], [-0.3, 0.5, -1], [1, 0, 0]) });
P["seatedfold.start"] = { ...base, p: [0, 0.16, 0], pitch: 25, ...reach(0.4), ...legs };
P["seatedfold.in"] = { ...base, p: [0, 0.16, 0], pitch: 50, flex: 6, nflex: 8, ...reach(0.6), ...legs };
P["seatedfold.out"] = { ...base, p: [0, 0.16, 0], pitch: 68, flex: 10, nflex: 14, ...reach(0.72), ...legs };
