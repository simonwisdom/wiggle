// Standing side bend: arms up through the middle, then over to the right side (n) and the left (f).
// The figure turns to face the camera (60 degrees from facing +x), so a bend to the side shows in the picture instead of
// toward the viewer. f is built the same way as n with the side swapped, not mirrored (a mirror would turn it to face away).
import { hand, foot, torso, add, sub, mul, norm } from "../rig.mjs";
import { POSES as C, armTo, FLAT } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const YAW = -60, a = ((YAW + 90) * Math.PI) / 180;
const FW = [Math.sin(a), 0, Math.cos(a)], RT = [-Math.cos(a), 0, Math.sin(a)]; // facing, and its right side
const X0 = 0.05;
const w = (u, f, y) => [X0 + u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]];
const v = (u, f, y) => [u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]];
const feet = { rf: foot(w(0.1, 0, 0.085), v(0.1, 1, 0), v(0.02, 0.143, -0.06)), lf: foot(w(-0.1, 0, 0.085), v(-0.1, 1, 0), v(-0.02, 0.143, -0.06)) };
// Arms up along the way the spine points, slightly bent so the hands stay in the picture, palms facing in.
const up = (sd, deg) => {
  let Q = { ...C.stand, yaw: YAW, p: w(-0.08 * sd, 0, 0.91), side: sd * deg, nflex: -3, ...feet,
    rh: hand([0, 1.7, 0.1], v(0.2, 0.2, 0), v(-0.9, 0.1, 0)), lh: hand([0, 1.7, -0.1], v(-0.2, 0.2, 0), v(0.9, 0.1, 0)) };
  const J = torso(Q), d = norm(sub(J.neck, J.pelvis));
  Q = armTo(Q, "r", add(d, v(0.03, 0, 0)), 0.41); Q = armTo(Q, "l", add(d, v(-0.03, 0, 0)), 0.41);
  Q = { ...Q, rh: { ...Q.rh, dir: add(mul(d, 0.5), v(-1, 0, 0)) }, lh: { ...Q.lh, dir: add(mul(d, 0.5), v(1, 0, 0)) } }; // palms in: the wrists bend about 60 degrees
  return Q;
};
void FLAT;
P["sidebend.mid"] = up(0, 0);
P["sidebend.n"] = up(1, 62);
P["sidebend.f"] = up(-1, 62);
