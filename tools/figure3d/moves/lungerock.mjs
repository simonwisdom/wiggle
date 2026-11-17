// Kneeling hip flexor rock: right foot forward, left knee down, hands on the hips, tall. a = hips back, b = hips forward.
import { base, hand, foot } from "../rig.mjs";
import { FLAT, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const feet = { rf: foot([0.5, 0.085, 0.12], [0.5, 1, 0.1], FLAT), lf: foot([-0.62, 0.05, -0.1], [1, 0, 0], KNEEL) };
const onHips = (x, y) => ({ rh: hand([x, y, 0.22], [-1, 0.3, 1], [0.1, -1, 0.3]), lh: hand([x, y, -0.22], [-1, 0.3, -1], [0.1, -1, -0.3]) });
P["lungerock.a"] = { ...base, p: [-0.2, 0.49, 0], pitch: 0, nflex: -4, ...feet, rf: foot([0.4, 0.085, 0.12], [0.5, 1, 0.1], FLAT), ...onHips(-0.2, 0.51) };
P["lungerock.b"] = { ...base, p: [0.0, 0.4, 0], pitch: 0, flex: -6, nflex: -6, ...feet, ...onHips(0.0, 0.42) };
