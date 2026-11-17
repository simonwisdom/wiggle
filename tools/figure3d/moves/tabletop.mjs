// Reverse tabletop: sitting with the hands behind, fingers forward, feet planted; lift the hips until the body is a table.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { FLAT } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const hands = { rh: hand([-0.38, 0.035, 0.2], [-1, 0.2, 0.2], [1, 0, 0]), lh: hand([-0.38, 0.035, -0.2], [-1, 0.2, -0.2], [1, 0, 0]) };
const feet = { rf: foot([0.4, 0.085, 0.12], [0, 1, 0.1], FLAT), lf: foot([0.4, 0.085, -0.12], [0, 1, -0.1], FLAT) };
P["tabletop.a"] = { ...base, p: [-0.02, 0.17, 0], pitch: -30, nflex: 0, ...hands, ...feet };
P["tabletop.b"] = straightArms({ ...base, p: [0.0, 0.5, 0], pitch: -80, flex: -6, nflex: -22, ...hands, ...feet });
