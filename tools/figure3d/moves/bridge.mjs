// Bridge: on the back, knees bent, feet planted; lift the hips so the body makes a slope from shoulders to knees.
import { base, hand, foot } from "../rig.mjs";
import { FLAT } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const armsDown = { rh: hand([0.02, 0.04, 0.27], [0, 0, 1], [1, 0, 0]), lh: hand([0.02, 0.04, -0.27], [0, 0, -1], [1, 0, 0]) };
const feet = { rf: foot([0.5, 0.085, 0.11], [0, 1, 0.1], FLAT), lf: foot([0.5, 0.085, -0.11], [0, 1, -0.1], FLAT) };
P["bridge.a"] = { ...base, p: [0, 0.1, 0], pitch: -90, ...armsDown, ...feet };
P["bridge.b"] = { ...base, p: [-0.1, 0.34, 0], pitch: -125, flex: 0, nflex: 50, ...armsDown, ...feet };
