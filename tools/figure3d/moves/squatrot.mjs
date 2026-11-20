// Squat with rotation: a deep squat, feet wide, both hands on the floor between the feet (mid). Then one hand stays by its
// foot while the chest turns and the other arm reaches to the sky: n reaches with the left arm (right hand down), f with the
// right. Like the Cossack shift, the figure faces the camera (60 degrees from facing +x) so the turn shows, and f is built
// the same way as n with the sides swapped, not mirrored (a mirror would turn it to face away).
import { base, hand, foot, torso, sub, norm, add } from "../rig.mjs";
import { armTo } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const YAW = -60, a = ((YAW + 90) * Math.PI) / 180;
const FW = [Math.sin(a), 0, Math.cos(a)], RT = [-Math.cos(a), 0, Math.sin(a)]; // facing, and its right side
const X0 = 0.08;
const w = (u, f, y) => [X0 + u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]]; // u: right, f: forward, y: up
const v = (u, f, y) => [u * RT[0] + f * FW[0], y, u * RT[2] + f * FW[2]];
const feet = { rf: foot(w(0.3, 0, 0.085), v(1.4, 0.7, 0), v(0.07, 0.13, -0.06)), lf: foot(w(-0.3, 0, 0.085), v(-1.4, 0.7, 0), v(-0.07, 0.13, -0.06)) };
const squat = { ...base, yaw: YAW, p: w(0, -0.06, 0.3), pitch: 48, flex: -4, nflex: -10, ...feet };
const down = (k, u, f) => hand(w(k * u, f, 0.04), v(k * 0.6, -0.6, 0.3), v(0, 1, 0)); // k = +1 right hand, -1 left

P["squatrot.mid"] = { ...squat, rh: down(1, 0.1, 0.3), lh: down(-1, 0.1, 0.3) };
// k = +1: right hand down, the chest turns left and the left arm reaches up; -1 the other way.
const reach = (k) => {
  const s = k > 0 ? "l" : "r", d = k > 0 ? "rh" : "lh";
  let Q = { ...squat, pitch: 34, twist: k * 55, side: -k * 6, ntwist: k * 30, nflex: -18, [d]: down(k, 0.16, 0.22),
    [s + "h"]: hand([0, 1.6, 0], v(-k * 0.2, -0.3, 0), v(0, 0, 1)) };
  const J = torso(Q), up = norm(sub(J.neck, J.pelvis));
  return armTo(Q, s, add(up, v(-k * 0.25, -0.15, 0)), 0.52);
};
P["squatrot.n"] = reach(1);
P["squatrot.f"] = reach(-1);
