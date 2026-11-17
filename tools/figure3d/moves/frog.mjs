// Frog rock-back: knees wide, shins out behind, on the forearms. a = rocked forward, b = hips back toward the heels.
// The knees and feet stay put; only the hips travel (they stay about a thigh's length from the knees).
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const frogFeet = { rf: foot([-0.5, 0.04, 0.39], [0.3, -1, 0.3], [-0.13, -0.01, 0]), lf: foot([-0.5, 0.04, -0.39], [0.3, -1, -0.3], [-0.13, -0.01, 0]) };
const forearms = { rh: hand([0.62, 0.05, 0.14], [-0.3, -1, 0.5], [1, 0, 0]), lh: hand([0.62, 0.05, -0.14], [-0.3, -1, -0.5], [1, 0, 0]) };
P["frog.a"] = { ...base, p: [0.05, 0.2, 0], pitch: 80, nflex: -10, ...frogFeet, ...forearms };
P["frog.b"] = { ...base, p: [-0.23, 0.2, 0], pitch: 82, nflex: -10, ...frogFeet, ...forearms };
