// Cossack shift: wide stance, hands clasped at the chest. mid = centred, n = sitting deep into the near (right) leg with the
// other leg straight, f = the same on the other side.
// The mat is only 0.8 m wide, so the stance runs along the diagonal: the figure turns to face the camera (60 degrees from
// facing +x) and its sideways axis lies mostly along the mat's length. A plain mirror would turn it to face away, so f is built
// the same way as n with the sides swapped, not mirrored.
import { base, hand, foot } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const YAW = -60, c = Math.cos((YAW * Math.PI) / 180 + Math.PI / 2), s = Math.sin((YAW * Math.PI) / 180 + Math.PI / 2);
const FW = [s, 0, c];            // the way the figure faces (after the yaw)
const RT = [-c, 0, s];           // its right side: facing = (s, c); right = (-c, s) in (x, z) -- checked in the preview
const X0 = 0.1;                  // the middle of the stance
const w = (u, f, y) => [X0 + u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]]; // u: right, f: forward, y: up
const v = (u, f, y) => [u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]];
const HALF = 0.5;
// k = +1 sits into the right leg (near), -1 into the left
const mk = (k, depth) => {
  const u0 = k * depth.u, py = depth.y;
  const rf = foot(w(HALF, 0, 0.085), v(0.3, 1, 0), v(0.05, 0.12, -0.06)), lf = foot(w(-HALF, 0, 0.085), v(-0.3, 1, 0), v(-0.05, 0.12, -0.06));
  const sit = k > 0 ? "rf" : "lf";
  const q = { ...base, yaw: YAW, p: w(u0, -0.1 * (depth.u ? 1 : 0), py), pitch: depth.u ? 12 : 0, roll: -k * (depth.u ? 5 : 0), nflex: depth.u ? -6 : 0, rf, lf,
    rh: hand(w(u0 + 0.04, 0.22, py + 0.28 + (depth.u ? 0 : 0)), v(0.5, 0.1, -0.5), v(0, 0.3, 1)),
    lh: hand(w(u0 - 0.04, 0.22, py + 0.28), v(-0.5, 0.1, -0.5), v(0, 0.3, 1)) };
  if (depth.u) q[sit] = { ...q[sit], pole: v(0.35 * k, 1, 0) };
  return q;
};
P["cossack.mid"] = mk(1, { u: 0, y: 0.86 });
P["cossack.n"] = mk(1, { u: 0.36, y: 0.44 });
P["cossack.f"] = mk(-1, { u: 0.36, y: 0.44 });
