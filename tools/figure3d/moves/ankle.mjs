// Kneeling ankle rock: right foot forward, left knee down. a = upright, shin vertical; b = the front knee pushed forward over the toes, heel down.
import { base, hand, foot } from "../rig.mjs";
import { FLAT, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const feet = { rf: foot([0.2, 0.085, 0.12], [0.5, 1, 0.1], FLAT), lf: foot([-0.52, 0.05, -0.1], [1, 0, 0], KNEEL) };
// Hands together in front of the chest, elbows out.
const prayer = (x, y) => ({ rh: hand([x, y, 0.04], [0, -0.3, 1], [0.5, 1, -0.6]), lh: hand([x, y, -0.04], [0, -0.3, -1], [0.5, 1, 0.6]) });
P["ankle.a"] = { ...base, p: [-0.12, 0.48, 0], pitch: 4, nflex: -4, ...feet, ...prayer(0.12, 0.74) };
P["ankle.b"] = { ...base, p: [0.06, 0.44, 0], pitch: 20, nflex: -4, ...feet, ...prayer(0.36, 0.68) };
