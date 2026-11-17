// Lunge to half split: right foot forward. a = low lunge, back knee down, hands on the floor; b = hips back over the back knee,
// the front leg straight with the toes up, folding over it.
import { base, hand, foot, straightArms, mixArms, mirrorPose } from "../rig.mjs";
import { POSES as C, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const back = { lf: foot([-0.62, 0.05, -0.1], [1, 0, 0], KNEEL) };
const hands = (x) => ({ rh: hand([x, 0.035, 0.28], [-0.4, 0.3, 0.5], [1, 0, 0]), lh: hand([x, 0.035, -0.2], [-0.4, 0.3, -0.5], [1, 0, 0]) });
P["halfsplit.a"] = straightArms({ ...base, p: [0.05, 0.38, 0], pitch: 40, nflex: -12, ...back, rf: foot([0.52, 0.05, 0.12], [0.5, 1, 0.1], [0.14, -0.02, 0]), ...hands(0.42) });
P["halfsplit.b"] = straightArms({ ...base, p: [-0.1, 0.42, 0], pitch: 60, nflex: -5, ...back, rf: foot([0.52, 0.05, 0.12], [0.5, 1, 0.1], [0.12, 0.07, 0]), ...hands(0.42) });
// Changing sides goes down to the low lunge and through the all-fours table: the front foot becomes the back foot. The foot is
// lifted and swung back with its toes turning down (a straight blend slides it along the mat, folding the leg back on itself and
// turning the toes right round through the shin).
const swung = (x, toe, y = 0.21) => { const Q = mixArms(P["halfsplit.a"], C.table, 0.5); return { ...Q, rf: foot([x, y, 0.11], [1, -0.5, 0.6], toe) }; };
// ... and the other foot comes forward the same way into the low lunge on the new side.
const A_F = mirrorPose(P["halfsplit.a"]);
const brought = (x, toe, y = 0.21) => { const Q = mixArms(C.table, A_F, 0.5); return { ...Q, lf: foot([x, y, -0.11], [1, 0.5, -0.1], toe) }; };
export const VIA = { "halfsplit.b>halfsplit.a.F": [P["halfsplit.a"], swung(0.3, [0.12, -0.05, 0]), swung(0.1, [0.02, -0.12, 0], 0.26), swung(-0.1, [-0.09, -0.09, 0]), swung(-0.3, [-0.09, -0.09, 0], 0.12), C.table,
  brought(-0.3, [-0.09, -0.09, 0], 0.12), brought(-0.1, [-0.09, -0.09, 0]), brought(0.1, [0.02, -0.12, 0], 0.26), brought(0.3, [0.12, -0.05, 0])] };
