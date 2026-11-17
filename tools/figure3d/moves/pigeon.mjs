// Pigeon: the near (right) shin lies across in front of the hips, the far (left) leg long behind, hips down on the floor.
// in = chest lifted on straight arms, out = folded forward over the front shin. start is the all-fours table.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { POSES as C, KNEEL } from "./_common.mjs";

export const POSES = {};
const P = POSES;
P["pigeon.start"] = C.table;
const rad = (d) => (d * Math.PI) / 180;
const dirXZ = (deg) => [Math.cos(rad(deg)), 0, Math.sin(rad(deg))]; // 0 = forward, 90 = toward the near side
// The near leg lying on the floor: the thigh heads `th` degrees, the shin `sh` degrees; the foot target is the ankle.
const flatLeg = (hip, th, sh, y = 0.05) => {
  const knee = [hip[0] + dirXZ(th)[0] * 0.378, y, hip[2] + dirXZ(th)[2] * 0.378];
  const d = dirXZ(sh);
  return foot([knee[0] + d[0] * 0.402, y, knee[2] + d[2] * 0.402], [dirXZ(th)[0], 0, dirXZ(th)[2]], [d[0] * 0.11, -0.012, d[2] * 0.11]);
};
const legs = { rf: flatLeg([0.04, 0.055, 0.08], 40, -105), lf: foot([-0.76, 0.05, -0.1], [0.2, 0.3, -1], KNEEL) };
const arms = (x) => ({ rh: hand([x, 0.035, 0.18], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([x, 0.035, -0.18], [-0.4, 0.3, -0.4], [1, 0, 0]) });
P["pigeon.in"] = { ...base, p: [0.04, 0.15, 0], pitch: 25, nflex: -12, flex: -6, ...legs, ...arms(0.36) };
P["pigeon.out"] = straightArms({ ...base, p: [0.04, 0.15, 0], pitch: 70, nflex: 15, ...legs, ...arms(0.66) });
// Getting in or out, the hips hover over the floor with the legs already in place, so the knees don't flip on the way.
const hover = { ...P["pigeon.in"], p: [0.02, 0.33, 0], pitch: 40, flex: -4, ...{ rh: P["pigeon.in"].rh, lh: P["pigeon.in"].lh } };
export const VIA = { "pigeon.start>pigeon.in": [hover] };
