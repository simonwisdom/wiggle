// Shared by the move files: foot and hand shapes, and the poses more than one move uses (table, stand).
// Files starting with "_" are not moves. A move file may import from here; it must not edit it, so three writers can add moves at once.
// A shared pose needed by a new move that isn't here yet: define it in the move's own file under its plan.js name, unless
// two moves need it, in which case add it here in its own small commit.
import { base, hand, foot, straightArms, torso, add, mul, norm } from "../rig.mjs";

export const FLAT = [0.143, -0.06, 0]; // ankle to toe, foot flat, pointing forward
export const KNEEL = [-0.15, -0.02, 0]; // top of the foot on the floor, toes pointing back
export const TUCK = [0.05, -0.075, 0]; // on the ball of the foot, heel up
export const kneelFeet = { rf: foot([-0.5, 0.05, 0.09], [1, -0.3, 0], KNEEL), lf: foot([-0.5, 0.05, -0.09], [1, -0.3, 0], KNEEL) };
export const floorHands = { rh: hand([0.48, 0.035, 0.18], [-0.4, 0.3, 0.4], [1, 0, 0]), lh: hand([0.48, 0.035, -0.18], [-0.4, 0.3, -0.4], [1, 0, 0]) };
export const standFeet = { rf: foot([0, 0.085, 0.1], [1, 0, 0.1], FLAT), lf: foot([0, 0.085, -0.1], [1, 0, -0.1], FLAT) };
export const sideHands = (y) => ({ rh: hand([0.04, y, 0.25], [-1, 0, 0.3], [0.1, -1, 0]), lh: hand([0.04, y, -0.25], [-1, 0, -0.3], [0.1, -1, 0]) });

// A straight arm: the hand of side s ("l" or "r") a bit under an arm's length from the shoulder, along dir.
export const armTo = (Pz, s, dir, reach = 0.527) => ({ ...Pz, [s + "h"]: { ...Pz[s + "h"], t: add(torso(Pz)[s + "Sh"], mul(norm(dir), reach)) } });

export const POSES = {};
POSES.table = straightArms({ ...base, p: [0, 0.5, 0], pitch: 88, nflex: -12, ...floorHands, ...kneelFeet });
POSES.stand = { ...base, p: [0, 0.94, 0], ...sideHands(0.86), ...standFeet };
