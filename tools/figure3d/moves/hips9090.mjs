// 90/90 hip switches: seated and upright. In seatN the near (right) leg is in front with its shin across the body,
// the far (left) leg is behind with its shin out to the side, both knees at about right angles, both shins on the floor.
// seatUp is the passing pose between the two sides: feet planted wide, knees up, leaning back a little on the hands.
import { base, hand, foot, footInPlane, mixArms } from "../rig.mjs";

export const POSES = {};
const P = POSES;
const rad = (d) => (d * Math.PI) / 180;
const dirXZ = (deg) => [Math.cos(rad(deg)), 0, Math.sin(rad(deg))]; // 0 = forward, 90 = toward the near side
const at = (o, d, len, y) => [o[0] + d[0] * len, y, o[2] + d[2] * len];
// A leg lying on the floor: the thigh heads `th` degrees, the shin `sh` degrees (both in the floor plane).
// Returns the foot target (the ankle) and the knee direction as the pole; hip is where the leg starts.
const flatLeg = (hip, th, sh, ay = 0.05) => {
  const knee = at(hip, dirXZ(th), 0.378, ay), ankle = at(knee, dirXZ(sh), 0.402, ay);
  return foot(ankle, [Math.cos(rad(th)), 0.0, Math.sin(rad(th))], [...dirXZ(sh).map((v) => v * 0.11)].map((v, i) => (i === 1 ? -0.012 : v)));
};
const HIP_Y = 0.055, PEL = [0, 0.16, 0]; // pelvis on the floor
const rHip = [0, HIP_Y, 0.08], lHip = [0, HIP_Y, -0.08];
const floorBeside = { rh: hand([-0.13, 0.035, 0.3], [-1, 0.3, 0.3], [-0.3, 0, 0.9]), lh: hand([-0.13, 0.035, -0.3], [-1, 0.3, -0.3], [-0.3, 0, -0.9]) }; // fingers out to the sides
// The front (right) foot is flexed, square to its shin and pointing out of the knee's bend, lifted a little off the mat;
// the back (left) foot is pointed, the top of it on the floor behind the shin's line.
const front = (Q) => { const R = footInPlane(Q, "r", 0); const t = R.rf.toe; return { ...R, rf: { ...R.rf, toe: [t[0], 0.05, t[2]] } }; };
P.seatN = front({ ...base, p: PEL, pitch: 2, twist: -8, ...floorBeside,
  rf: flatLeg(rHip, 38, -52), lf: flatLeg(lHip, -105, -195) });
// Passing pose: feet planted wide, knees up and forward, torso upright-ish, hands on the floor behind.
P.seatUp = footInPlane(footInPlane({ ...base, p: [-0.12, 0.18, 0], pitch: -14, flex: 4,
  rh: hand([-0.45, 0.035, 0.27], [-1, 0.2, 0.3], [-0.5, 0, 0.8]), lh: hand([-0.45, 0.035, -0.27], [-1, 0.2, -0.3], [-0.5, 0, -0.8]),
  rf: foot([0.38, 0.06, 0.3], [0.2, 1, 0.1], [0.13, 0.02, 0.04]), lf: foot([0.38, 0.06, -0.3], [0.2, 1, -0.1], [0.13, 0.02, -0.04]) }, "r", 0.2), "l", 0.2);
// On the way from a seat to the passing pose the back foot lifts, swings out and comes round in front. A straight blend of its
// toe from "pointing back" to "pointing forward" twists the foot far out of the knee's bend plane, so the path is cut into
// short steps and the foot is put back in the plane at each one (half pointed at the start, nearly square at the end). The ankle goes
// out and up (an arc) so the knee doesn't flip.
const bez = (a, b, c, t) => a.map((_, i) => (1 - t) * (1 - t) * a[i] + 2 * (1 - t) * t * b[i] + t * t * c[i]);
const swing = (t) => {
  let Q = mixArms(P.seatN, P.seatUp, t);
  const lt = bez(P.seatN.lf.t, [0.0, 0.26, -0.58], P.seatUp.lf.t, t), rt = bez(P.seatN.rf.t, [0.5, 0.17, 0.17], P.seatUp.rf.t, t);
  const lp = bez(P.seatN.lf.pole, [0, 1, -0.5], P.seatUp.lf.pole, t);
  Q = { ...Q, lf: { ...Q.lf, t: lt, pole: lp }, rf: { ...Q.rf, t: rt } };
  return footInPlane(footInPlane(Q, "l", 0.45 - 0.25 * t), "r", 0.2 * t);
};
export const VIA = { "seatN>seatUp": [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map(swing) };
