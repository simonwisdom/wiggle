// Ragdoll fold: folded forward, hanging, hands holding opposite elbows. a = knees bent (the in-breath), b = legs straight.
import { base, hand, foot, torso, add } from "../rig.mjs";
import { POSES as C } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const feet = { rf: foot([0, 0.085, 0.12], [1, 0, 0.1], [0.143, -0.06, 0]), lf: foot([0, 0.085, -0.12], [1, 0, -0.1], [0.143, -0.06, 0]) };
// hands on the opposite elbows: the arms hang from the shoulders and cross
const holdElbows = (Pz, drop = 0.25) => {
  const J = torso(Pz), c = [(J.lSh[0] + J.rSh[0]) / 2, (J.lSh[1] + J.rSh[1]) / 2, (J.lSh[2] + J.rSh[2]) / 2];
  const lo = (p) => [p[0], Math.max(0.14, p[1]), p[2]];
  return { ...Pz, rh: hand(lo(add(c, [0.05, -drop, -0.14])), [0.3, 0, 1], [-0.5, -0.1, -0.8]), lh: hand(lo(add(c, [0.2, -drop + 0.04, 0.14])), [0.3, 0, -1], [-0.3, -0.1, 0.95]) };
};
const fold = { ...base, ...feet, rh: C.stand.rh, lh: C.stand.lh };
P["ragdoll.a"] = holdElbows({ ...fold, p: [-0.14, 0.8, 0], pitch: 136, flex: 20, nflex: 20,
  rf: { ...feet.rf, pole: [1, 0, 0.1] }, lf: { ...feet.lf, pole: [1, 0, -0.1] } });
P["ragdoll.b"] = holdElbows({ ...fold, p: [-0.05, 0.945, 0], pitch: 150, flex: 24, nflex: 20 });
