// Lying figure four: on the back, the right ankle across the left knee, then the left thigh drawn in with both hands.
// start: left foot planted, right ankle resting on the left thigh, hands on the floor.
// in/out: left foot lifted, left thigh pulled toward the chest, hands clasped behind it.
import { base, hand, foot, solve, footInPlane, add, sub, mul, norm } from "../rig.mjs";
import { FLAT } from "./_common.mjs";

export const POSES = {};
const P = POSES;
const body = { ...base, p: [0, 0.1, 0], pitch: -90 };
const curl = { flex: 26, nflex: 10 }; // shoulders a little off the floor when the thigh is held
const down = { rh: hand([0.02, 0.04, 0.27], [0, 0, 1], [1, 0, 0]), lh: hand([0.02, 0.04, -0.27], [0, 0, -1], [1, 0, 0]) };
// The right ankle goes just above the left thigh, near the knee, so the right shin rests across it. Worked out from
// where the solver puts the left knee, so it stays on the thigh whatever the left foot does.
function crossed(Q, extra = {}) {
  const J = solve(Q), thigh = norm(sub(J.lHip, J.lKnee));
  const ankle = add(add(J.lKnee, mul(thigh, 0.1)), [0, 0.11, 0.06]);
  const R = { ...Q, rf: foot(ankle, [0.1, -0.2, 1], [0, 0, 0]), ...extra };
  return footInPlane(R, "r", 0.35); // the right foot is flexed, square to the shin and in the knee's bend plane
}
P["figure4.start"] = crossed({ ...body, ...down, lf: foot([0.5, 0.085, -0.1], [0, 1, 0], FLAT), rf: foot([0.3, 0.4, 0.1], [0, 0, 1], [0, 0, 0]) });
// The left leg drawn in, with the hands behind the thigh.
function pulled(ax, ay, az) {
  const L = { ...body, ...curl, lf: foot([ax, ay, az], [-1, 0.6, 0], [0.0, 0.1, 0.0]), rf: foot([0.3, 0.4, 0.1], [0, 0, 1], [0, 0, 0]), ...down };
  const J = solve(L), thigh = norm(sub(J.lKnee, J.lHip));
  const grip = add(J.lHip, mul(thigh, 0.22));
  return crossed({ ...L, lh: hand(add(grip, [-0.06, 0.0, -0.1]), [-0.3, -0.5, -1], [1, 0, 0.5]), rh: hand(add(grip, [-0.06, 0.0, 0.1]), [-0.3, -0.5, 1], [1, 0, -0.5]) });
}
P["figure4.in"] = pulled(0.5, 0.46, -0.1);
P["figure4.out"] = pulled(0.45, 0.5, -0.1);
