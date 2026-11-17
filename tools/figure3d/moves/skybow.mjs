// Hold up the sky, draw the bow. Standing (stand is shared, in _common.mjs).
import { base, hand, foot } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P.skyLow = { ...C.stand, rh: hand([0.2, 1.0, 0.11], [-0.3, -0.4, 1], [0, 0, -1]), lh: hand([0.2, 1.0, -0.11], [-0.3, -0.4, -1], [0, 0, 1]) };
P.sky = { ...C.stand, p: [0, 0.95, 0], flex: -8, nflex: -28,
  rh: hand([0.0, 1.8, 0.16], [0.2, 0, 1], [0, 0.15, -1]), lh: hand([0.0, 1.8, -0.16], [0.2, 0, -1], [0, 0.15, 1]) };
const wideFeet = { rf: foot([0, 0.085, 0.32], [0.5, 0, 1], [0.12, -0.06, 0.07]), lf: foot([0, 0.085, -0.32], [0.5, 0, -1], [0.12, -0.06, -0.07]) };
P.bowRest = { ...base, p: [0, 0.78, 0], ...wideFeet, rh: hand([0.27, 1.17, 0.07], [-0.2, -0.5, 1], [0.3, 0.9, -0.2]), lh: hand([0.27, 1.17, -0.07], [-0.2, -0.5, -1], [0.3, 0.9, 0.2]) };
P.bowN = { ...P.bowRest, p: [0, 0.74, 0], twist: 10, ntwist: 70,
  lh: hand([0.02, 1.22, -0.72], [0, -1, 0], [0, 0.9, -0.4]), rh: hand([0.1, 1.2, 0.2], [-0.25, -0.05, 1], [0.6, 0.2, -0.6]) };
