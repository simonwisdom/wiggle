// Wide-leg fold: legs wide apart on the floor, toes up, hands walking forward between the legs.
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const legs = { rf: foot([0.72, 0.065, 0.38], [0, 1, 0], [0.03, 0.12, 0.02]), lf: foot([0.72, 0.065, -0.38], [0, 1, 0], [0.03, 0.12, -0.02]) };
const reach = (x) => ({ rh: hand([x, 0.04, 0.12], [-0.3, 0.5, 1], [1, 0, 0]), lh: hand([x, 0.04, -0.12], [-0.3, 0.5, -1], [1, 0, 0]) });
P["straddle.start"] = { ...base, p: [0, 0.16, 0], pitch: 35, ...reach(0.5), ...legs };
P["straddle.in"] = { ...base, p: [0, 0.16, 0], pitch: 55, flex: 6, nflex: 8, ...reach(0.65), ...legs };
P["straddle.out"] = { ...base, p: [0, 0.16, 0], pitch: 72, flex: 8, nflex: 14, ...reach(0.8), ...legs };
