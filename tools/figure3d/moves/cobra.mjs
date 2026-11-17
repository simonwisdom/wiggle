// Cobra: face down, hands under the shoulders, legs straight back with the tops of the feet on the floor; lift the chest.
import { base, hand, foot } from "../rig.mjs";
import { KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const feet = { rf: foot([-0.73, 0.05, 0.1], [0, 1, 0], KNEEL), lf: foot([-0.73, 0.05, -0.1], [0, 1, 0], KNEEL) };
const hands = { rh: hand([0.55, 0.035, 0.2], [-1, 0.5, 0.3], [1, 0, 0]), lh: hand([0.55, 0.035, -0.2], [-1, 0.5, -0.3], [1, 0, 0]) };
P["cobra.a"] = { ...base, p: [0.14, 0.1, 0], pitch: 90, nflex: -8, ...hands, ...feet };
P["cobra.b"] = { ...base, p: [0.14, 0.12, 0], pitch: 50, flex: -24, nflex: -24, ...hands, ...feet };
