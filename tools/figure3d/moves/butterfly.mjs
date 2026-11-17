// Butterfly: sitting, soles together, knees wide, leaning forward with the hands on the feet.
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const legs = (ax, kd) => ({ rf: foot([ax, 0.065, 0.04], [0, kd, 1], [0.08, -0.04, 0.0]), lf: foot([ax, 0.065, -0.04], [0, kd, -1], [0.08, -0.04, 0.0]) });
const onFeet = (ax) => ({ rh: hand([ax + 0.02, 0.05, 0.11], [-0.2, 0.3, 1], [1, 0, 0]), lh: hand([ax + 0.02, 0.05, -0.11], [-0.2, 0.3, -1], [1, 0, 0]) });
P["butterfly.start"] = { ...base, p: [0, 0.16, 0], pitch: 42, nflex: 8, ...legs(0.5, 0), ...onFeet(0.5) };
P["butterfly.in"] = { ...base, p: [0, 0.16, 0], pitch: 34, ...legs(0.5, 0.05), ...onFeet(0.5) };
P["butterfly.out"] = { ...base, p: [0, 0.16, 0], pitch: 46, nflex: 10, ...legs(0.48, -0.1), ...onFeet(0.48) };
