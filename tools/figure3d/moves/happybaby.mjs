// Happy baby: on the back, knees wide and drawn toward the armpits, shins straight up, soles to the ceiling,
// each hand holding the outside of its foot. start: knees up over the belly, hands reaching. in: knees wide, feet held.
// out: the knees sink wider.
import { base, hand, foot, solve, add, sub, mul, norm } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const HIP_Z = 0.08;
// The leg is built from the thigh's direction (toward the head, up and out) so the shin can stand straight up from the knee.
// The foot is square to the shin with the toes toward the head and a little outward (about 30 degrees out of the knee's bend
// plane, inside the ankle's range): the sole faces the ceiling.
function legs(Q, thigh, lean = 0) {
  let R = Q;
  for (const s of ["r", "l"]) {
    const z = s === "r" ? 1 : -1, J = solve(R);
    const d = norm([thigh[0], thigh[1], thigh[2] * z]);
    const knee = add(J[s + "Hip"], mul(d, 0.378));
    R = { ...R, [s + "f"]: foot(add(knee, mul(norm([lean, 1, 0]), 0.402)), d, [-0.12, 0, 0.07 * z]) };
  }
  return R;
}
// Each hand holds the outer edge of its foot: the wrist just outside the ankle, the fingers curling in over the foot.
function grip(Q, out = 0.07, drop = 0.03) {
  let R = Q;
  for (const s of ["r", "l"]) {
    const z = s === "r" ? 1 : -1, J = solve(R);
    const wr = add(J[s + "Ankle"], [0.0, -drop, z * out]);
    R = { ...R, [s + "h"]: hand(wr, [0, -0.3, z], [0, 0.2, -z]) };
    const K = solve(R), fa = norm(sub(K[s + "Wr"], K[s + "El"]));
    R = { ...R, [s + "h"]: { ...R[s + "h"], dir: norm(add(fa, [0, 0, -z * 0.7])) } };
  }
  return R;
}
const rest = { rh: hand([-0.3, 0.04, 0.3], [0, 0, 1], [1, 0, 0]), lh: hand([-0.3, 0.04, -0.3], [0, 0, -1], [1, 0, 0]),
  rf: foot([0, 0.5, 0.2], [0, 0, 1], [0, 0, 0]), lf: foot([0, 0.5, -0.2], [0, 0, -1], [0, 0, 0]) };
const body = (flex, nflex = -14) => ({ ...base, p: [0, 0.1, 0], pitch: -90, flex, nflex, ...rest });
P["happybaby.start"] = grip(legs(body(40), [-0.3, 0.95, 0.5], -0.04), 0.06);
P["happybaby.in"] = grip(legs(body(40), [-0.65, 0.4, 0.65], -0.02));
P["happybaby.out"] = grip(legs(body(40), [-0.6, 0.25, 0.75], -0.02));
