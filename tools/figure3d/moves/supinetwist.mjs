// Lying twist: on the back, shoulders flat, arms out, both knees dropped to one side (the near side, +z), head turned the other way.
// The pelvis has to roll about the length of the body, which the rig has no angle for, so `rolled` works out the
// yaw/pitch/roll of a pelvis that is lying on its back and then rolled phi degrees toward +z. The spine twists back
// by the same angle (twist is the whole spine's turn) so the shoulders stay flat on the floor.
import { base, hand, foot } from "../rig.mjs";
import { FLAT } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const Rx = (d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const Ry = (d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
function rolled(phi) {
  const R = mm(Rx(phi), mm(Ry(90), Rx(-90))); // R = Ry(a) Rx(b) Rz(c), the rig's order
  const b = -Math.asin(R[1][2]), c = Math.atan2(R[1][0], R[1][1]), a = Math.atan2(R[0][2], R[2][2]);
  return { yaw: deg(a) - 90, pitch: deg(b), roll: deg(c) };
}
const wide = { rh: hand([-0.1, 0.04, 0.37], [-0.3, 0.1, 1], [1, 0, 0]), lh: hand([-0.1, 0.04, -0.37], [-0.3, 0.1, -1], [1, 0, 0]) };
// start: knees up, feet planted, arms out.
P["supinetwist.start"] = { ...base, p: [0, 0.1, 0], pitch: -90, ...wide,
  rf: foot([0.5, 0.085, 0.11], [0, 1, 0.1], FLAT), lf: foot([0.5, 0.085, -0.11], [0, 1, -0.1], FLAT) };
// The feet lie along the shins, turned a little toward the body so the ankles stay in their range while the knees fall over
// (toes and knee directions found by trying values until every frame of every step passed the hand-and-foot checks).
// in/out: pelvis rolled toward +z, the knees stacked on the floor on that side (left knee on top of the right).
const dropped = (phi, kz) => ({ ...base, ...rolled(phi), p: [0, 0.12, 0.03], twist: phi, ntwist: -40, ...wide,
  rf: foot([0.5, 0.09, kz], [0, -2.3, 1.8], [0.077, -0.031, -0.029]),
  lf: foot([0.5, 0.2, kz - 0.02], [0, 0.26, 0.56], [0.117, -0.023, -0.074]) });
P["supinetwist.in"] = dropped(60, 0.38);
P["supinetwist.out"] = dropped(72, 0.4);
