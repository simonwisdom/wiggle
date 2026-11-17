// Beast to crab: hands and feet with the knees hovering, turn over around the planted left hand
// (through a side sit) into a crab with the hips up and the right arm reaching back.
import { base, hand, foot, straightArms } from "../rig.mjs";
import { floorHands } from "./_common.mjs";
const TUCK = [0.001, -0.084, 0]; // ball of the foot, heel well up (the ankle bends no more than 30 degrees past square)

export const POSES = {};
const P = POSES;
P.beast = straightArms({ ...base, p: [-0.05, 0.47, 0], pitch: 78, nflex: -14, ...floorHands,
  rf: foot([-0.47, 0.115, 0.12], [1, -0.25, 0], TUCK), lf: foot([-0.47, 0.115, -0.12], [1, -0.25, 0], TUCK) });
P.beast.lh = hand([0.46, 0.035, -0.18], [-0.4, 0.3, -0.4], [1, 0, 0]);
// The side sit, a pose the turn passes through: seated on the floor facing the camera, hips side by side, leaning on the
// planted left hand, the right arm reaching up. The feet stay where they were in the beast and the crab; the knees fall apart.
P.sideSit = { ...base, p: [0.08, 0.17, -0.2], yaw: -90, pitch: -4, roll: -40,
  lh: hand([0.46, 0.035, -0.18], [0.3, 0.2, -1], [0.3, 0, 0.9]), rh: hand([-0.25, 0.75, 0.1], [0, -1, 0.5], [-0.5, 0.3, 0.6]),
  rf: foot([-0.5, 0.06, 0.2], [0, 0.1, 1], [-0.067, -0.047, 0.089]), lf: foot([-0.1, 0.06, 0.1], [0, 0.1, 1], [-0.038, -0.012, 0.061]) };
// The turn goes through the side sit without stopping.
export const PASS = ["sideSit"];
P.crabN = { ...base, p: [-0.06, 0.52, -0.3], yaw: -180, pitch: -66, flex: -8, nflex: -20,
  lh: hand([0.46, 0.035, -0.18], [1, 0.3, 0.3], [1, 0, 0]), rh: hand([0.62, 1.12, -0.5], [0, 1, -0.4], [0.7, 0.7, 0]),
  rf: foot([-0.47, 0.085, -0.33], [0, 1, 0], [-0.143, -0.06, 0]), lf: foot([-0.47, 0.085, -0.16], [0, 1, 0], [-0.143, -0.06, 0]) };
