// World's greatest stretch: long lunge, near (right) foot forward, elbow down inside it, then reach up.
import { base, hand, foot } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const lungeFeet = { rf: foot([0.44, 0.085, 0.31], [0.2, 1, 0.5], [0.14, -0.06, 0.03]), lf: foot([-0.83, 0.12, -0.1], [0.2, -1, 0], [0.05, -0.09, 0]) };
P.lungeDropN = { ...base, p: [0, 0.38, 0], pitch: 70, twist: 26, flex: 24, nflex: -10, ...lungeFeet,
  rh: hand([0.62, 0.04, 0.08], [-0.5, -1, 0], [1, 0, 0]), lh: hand([0.47, 0.035, -0.24], [-0.4, 0.3, -0.5], [1, 0, 0]) };
P.lungeReachN = { ...base, p: [0, 0.38, 0], pitch: 64, twist: -72, flex: 4, nflex: -10, ntwist: -60, ...lungeFeet,
  rh: hand([0.36, 1.22, 0.22], [-0.4, 0, 1], [0, 1, 0.1]), lh: hand([0.47, 0.035, -0.24], [-0.4, 0.3, -0.5], [1, 0, 0]) };
// Changing sides (the drop on one side to the drop on the other) goes through the all-fours table: the front foot becomes the back foot.
export const VIA = { "lungeDropN>lungeDropF": [C.table] };
